-- Dividendos e JCP recebidos por ativo. Cada provento lançado também gera um
-- crédito em carteira_corretora_movimentos (mesmo padrão de uma venda), pra
-- entrar automaticamente no saldo disponível pra próxima compra.

CREATE TABLE IF NOT EXISTS carteira_proventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo_id UUID REFERENCES carteira_investimentos(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('dividendo', 'jcp')),
  valor NUMERIC(14,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE carteira_proventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON carteira_proventos;
CREATE POLICY "authenticated_full_access" ON carteira_proventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Amplia o CHECK de tipo em carteira_corretora_movimentos pra aceitar
-- 'provento', sem depender de adivinhar o nome que o Postgres deu ao
-- constraint original (gerado automaticamente na migration 013).
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'carteira_corretora_movimentos'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%deposito%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE carteira_corretora_movimentos DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE carteira_corretora_movimentos
  ADD CONSTRAINT carteira_corretora_movimentos_tipo_check
  CHECK (tipo IN ('deposito', 'saque', 'venda', 'compra', 'provento'));

ALTER TABLE carteira_corretora_movimentos
  ADD COLUMN IF NOT EXISTS provento_id UUID REFERENCES carteira_proventos(id) ON DELETE SET NULL;
