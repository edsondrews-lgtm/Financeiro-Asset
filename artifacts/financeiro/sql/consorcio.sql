-- ================================================================
-- MÓDULO DE GESTÃO DE CONSÓRCIO — FinançasHub
-- Execute este script completo no Supabase SQL Editor
-- ================================================================

-- ── 1. TABELAS ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consorcios (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao            text        NOT NULL,
  valor_bem            numeric(12,2) NOT NULL,
  prazo                integer     NOT NULL,
  taxa_adm_total       numeric(6,4) NOT NULL,      -- % total no prazo (ex: 6.4)
  fundo_reserva_total  numeric(6,4) NOT NULL,      -- % total no prazo (ex: 2.0)
  valor_parcela_base   numeric(12,2) NOT NULL,
  fator_correcao       numeric(10,6) NOT NULL DEFAULT 1.000000,
  data_inicio          date        NOT NULL DEFAULT CURRENT_DATE,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcelas_calculadas (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  consorcio_id         uuid        NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  numero_parcela       integer     NOT NULL,

  -- Valores correntes (atualizados por IPCA / lances)
  valor_fundo_comum    numeric(12,2) NOT NULL,
  valor_taxa_adm       numeric(12,2) NOT NULL,
  valor_fundo_reserva  numeric(12,2) NOT NULL,
  valor_total          numeric(12,2) NOT NULL,

  -- Valores-base originais (usados como referência para recálculo)
  base_fundo_comum     numeric(12,2) NOT NULL,
  base_taxa_adm        numeric(12,2) NOT NULL,
  base_fundo_reserva   numeric(12,2) NOT NULL,
  base_total           numeric(12,2) NOT NULL,

  status               text        NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pago', 'pendente', 'cancelada')),
  data_vencimento      date,
  data_pagamento       date,
  valor_pago           numeric(12,2),
  observacao           text,
  created_at           timestamptz DEFAULT now(),

  UNIQUE (consorcio_id, numero_parcela)
);

CREATE TABLE IF NOT EXISTS lances_consorcio (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  consorcio_id         uuid        NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  valor_lance          numeric(12,2) NOT NULL,
  tipo_amortizacao     text        NOT NULL
                         CHECK (tipo_amortizacao IN ('reduzir_parcela', 'reduzir_prazo')),
  parcela_inicio       integer     NOT NULL,
  data_lance           date        NOT NULL DEFAULT CURRENT_DATE,
  observacao           text,
  created_at           timestamptz DEFAULT now()
);

-- ── 2. GERAÇÃO AUTOMÁTICA DAS 75 PARCELAS ───────────────────────

-- Função disparada ao inserir um consórcio
CREATE OR REPLACE FUNCTION gerar_parcelas_consorcio()
RETURNS TRIGGER AS $$
DECLARE
  i            integer;
  v_fc         numeric(12,2);   -- fundo comum por parcela
  v_adm        numeric(12,2);   -- taxa adm por parcela
  v_fr         numeric(12,2);   -- fundo reserva por parcela
  v_total      numeric(12,2);   -- soma dos três
  v_vencimento date;
BEGIN
  -- Cálculos proporcionais mensais
  v_fc    := ROUND((NEW.valor_bem / NEW.prazo)::numeric, 2);
  v_adm   := ROUND((NEW.valor_bem * NEW.taxa_adm_total / 100.0 / NEW.prazo)::numeric, 2);
  v_fr    := ROUND((NEW.valor_bem * NEW.fundo_reserva_total / 100.0 / NEW.prazo)::numeric, 2);
  v_total := v_fc + v_adm + v_fr;

  FOR i IN 1..NEW.prazo LOOP
    v_vencimento := (NEW.data_inicio + (interval '1 month' * i))::date;

    INSERT INTO parcelas_calculadas (
      consorcio_id, numero_parcela,
      valor_fundo_comum,  valor_taxa_adm,  valor_fundo_reserva,  valor_total,
      base_fundo_comum,   base_taxa_adm,   base_fundo_reserva,   base_total,
      status, data_vencimento
    ) VALUES (
      NEW.id, i,
      v_fc,   v_adm,   v_fr,   v_total,
      v_fc,   v_adm,   v_fr,   v_total,   -- base = original
      'pendente', v_vencimento
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove e recria o trigger (seguro para re-execução)
DROP TRIGGER IF EXISTS trigger_gerar_parcelas ON consorcios;
CREATE TRIGGER trigger_gerar_parcelas
  AFTER INSERT ON consorcios
  FOR EACH ROW EXECUTE FUNCTION gerar_parcelas_consorcio();

-- ── 3. CORREÇÃO IPCA ─────────────────────────────────────────────

-- Aplica fator de correção acumulado às parcelas PENDENTES
-- Usa os valores-BASE para que o fator seja sempre relativo ao original,
-- evitando erro acumulativo em aplicações sucessivas.
CREATE OR REPLACE FUNCTION aplicar_correcao_ipca(
  p_consorcio_id uuid,
  p_fator        numeric   -- ex: 1.05 para +5%
)
RETURNS void AS $$
BEGIN
  -- Recalcula a partir dos valores-base originais
  UPDATE parcelas_calculadas
  SET
    valor_fundo_comum   = ROUND((base_fundo_comum   * p_fator)::numeric, 2),
    valor_taxa_adm      = ROUND((base_taxa_adm       * p_fator)::numeric, 2),
    valor_fundo_reserva = ROUND((base_fundo_reserva  * p_fator)::numeric, 2),
    valor_total         = ROUND((base_total          * p_fator)::numeric, 2)
  WHERE consorcio_id = p_consorcio_id
    AND status = 'pendente';

  -- Grava o fator na tabela principal para referência
  UPDATE consorcios
  SET fator_correcao = p_fator
  WHERE id = p_consorcio_id;
END;
$$ LANGUAGE plpgsql;

-- ── 4. PROCESSAMENTO DE LANCE ────────────────────────────────────

-- tipo_amortizacao:
--   'reduzir_parcela' → reduz o valor de cada parcela futura proporcionalmente
--   'reduzir_prazo'   → elimina as últimas parcelas (mantém valor)
CREATE OR REPLACE FUNCTION processar_lance(
  p_consorcio_id    uuid,
  p_valor_lance     numeric,
  p_tipo_amortizacao text,
  p_data_lance      date    DEFAULT CURRENT_DATE,
  p_observacao      text    DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_qtd_pendentes      integer;
  v_reducao_por_parc   numeric(12,2);
  v_valor_parcela_ref  numeric(12,2);
  v_parcelas_a_cortar  integer;
  v_parcela_inicio     integer;
BEGIN
  -- Número da primeira parcela pendente (para log)
  SELECT MIN(numero_parcela) INTO v_parcela_inicio
  FROM parcelas_calculadas
  WHERE consorcio_id = p_consorcio_id AND status = 'pendente';

  -- Registra o lance
  INSERT INTO lances_consorcio
    (consorcio_id, valor_lance, tipo_amortizacao, parcela_inicio, data_lance, observacao)
  VALUES
    (p_consorcio_id, p_valor_lance, p_tipo_amortizacao, COALESCE(v_parcela_inicio, 0), p_data_lance, p_observacao);

  -- ── Reduzir Parcela ──────────────────────────────────────────
  IF p_tipo_amortizacao = 'reduzir_parcela' THEN

    SELECT COUNT(*) INTO v_qtd_pendentes
    FROM parcelas_calculadas
    WHERE consorcio_id = p_consorcio_id AND status = 'pendente';

    IF v_qtd_pendentes = 0 THEN RETURN; END IF;

    v_reducao_por_parc := ROUND((p_valor_lance / v_qtd_pendentes)::numeric, 2);

    UPDATE parcelas_calculadas
    SET
      valor_fundo_comum   = GREATEST(0, ROUND((valor_fundo_comum   - (v_reducao_por_parc * base_fundo_comum   / NULLIF(base_total,0)))::numeric, 2)),
      valor_taxa_adm      = GREATEST(0, ROUND((valor_taxa_adm      - (v_reducao_por_parc * base_taxa_adm      / NULLIF(base_total,0)))::numeric, 2)),
      valor_fundo_reserva = GREATEST(0, ROUND((valor_fundo_reserva - (v_reducao_por_parc * base_fundo_reserva / NULLIF(base_total,0)))::numeric, 2)),
      valor_total         = GREATEST(0, ROUND((valor_total - v_reducao_por_parc)::numeric, 2)),
      observacao          = TRIM(COALESCE(observacao || ' | ', '') || 'Lance -R$' || v_reducao_por_parc)
    WHERE consorcio_id = p_consorcio_id AND status = 'pendente';

  -- ── Reduzir Prazo ────────────────────────────────────────────
  ELSIF p_tipo_amortizacao = 'reduzir_prazo' THEN

    -- Pega o valor da 1ª parcela pendente como referência
    SELECT valor_total INTO v_valor_parcela_ref
    FROM parcelas_calculadas
    WHERE consorcio_id = p_consorcio_id AND status = 'pendente'
    ORDER BY numero_parcela ASC
    LIMIT 1;

    IF v_valor_parcela_ref IS NULL OR v_valor_parcela_ref = 0 THEN RETURN; END IF;

    v_parcelas_a_cortar := FLOOR(p_valor_lance / v_valor_parcela_ref)::integer;

    -- Cancela as ÚLTIMAS N parcelas pendentes
    UPDATE parcelas_calculadas
    SET
      status     = 'cancelada',
      observacao = TRIM(COALESCE(observacao || ' | ', '') || 'Quitada por lance de R$' || p_valor_lance)
    WHERE id IN (
      SELECT id FROM parcelas_calculadas
      WHERE consorcio_id = p_consorcio_id AND status = 'pendente'
      ORDER BY numero_parcela DESC
      LIMIT v_parcelas_a_cortar
    );

  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── 5. VERIFICAÇÃO ───────────────────────────────────────────────
-- Após executar, confirme com:
--   SELECT * FROM consorcios;
--   SELECT COUNT(*) FROM parcelas_calculadas;  -- deve retornar 0 (populado por trigger ao inserir)

-- ── 6. EXEMPLO DE USO ────────────────────────────────────────────
-- Insira um consórcio e as 75 parcelas são geradas automaticamente:
--
-- INSERT INTO consorcios (descricao, valor_bem, prazo, taxa_adm_total, fundo_reserva_total, valor_parcela_base, data_inicio)
-- VALUES ('Consórcio Imóvel 105k', 105000, 75, 6.4, 2, 1517.60, '2024-01-01');
--
-- Confira:
-- SELECT numero_parcela, valor_fundo_comum, valor_taxa_adm, valor_fundo_reserva, valor_total
-- FROM parcelas_calculadas ORDER BY numero_parcela;
--
-- Aplicar IPCA de 5%:
-- SELECT aplicar_correcao_ipca('<id-do-consorcio>', 1.05);
--
-- Lance de R$ 20.000 reduzindo parcela:
-- SELECT processar_lance('<id-do-consorcio>', 20000, 'reduzir_parcela');
--
-- Lance de R$ 20.000 reduzindo prazo:
-- SELECT processar_lance('<id-do-consorcio>', 20000, 'reduzir_prazo');
