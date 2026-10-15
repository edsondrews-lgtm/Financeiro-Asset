-- Histórico de compras/aportes por posição ("lotes"). A posição em
-- carteira_investimentos continua guardando só o agregado (quantidade e
-- preço médio ponderado, que é o que o resto do app lê); aqui fica o
-- detalhe de cada compra, com a origem do dinheiro (capital novo ou lucro
-- reinvestido via saldo da corretora) e uma anotação.

CREATE TABLE IF NOT EXISTS carteira_aportes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo_id UUID NOT NULL REFERENCES carteira_investimentos(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL,
  preco NUMERIC(14,4) NOT NULL,
  data_aporte DATE NOT NULL,
  origem TEXT NOT NULL DEFAULT 'novo' CHECK (origem IN ('novo', 'corretora')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carteira_aportes_ativo ON carteira_aportes(ativo_id);

ALTER TABLE carteira_aportes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON carteira_aportes;
CREATE POLICY "authenticated_full_access" ON carteira_aportes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill: um lote inicial pra cada posição que ainda não tem nenhum, pra o
-- histórico nunca começar vazio. Re-executar não duplica (NOT EXISTS).
INSERT INTO carteira_aportes (ativo_id, quantidade, preco, data_aporte, origem, notas)
SELECT
  ci.id,
  COALESCE(NULLIF(ci.quantidade_original, 0), ci.quantidade),
  ci.preco_medio,
  ci.data_compra,
  CASE WHEN ci.capital_novo THEN 'novo' ELSE 'corretora' END,
  ci.notas
FROM carteira_investimentos ci
WHERE NOT EXISTS (SELECT 1 FROM carteira_aportes ca WHERE ca.ativo_id = ci.id);
