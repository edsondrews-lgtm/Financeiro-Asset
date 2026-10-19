-- Saldo do crédito parado do consórcio contemplado. O crédito rende e o valor
-- real só a administradora sabe, então o app guarda os saldos que você
-- informa (extrato) e estima o de hoje pelo CDI a partir do último. O mais
-- recente por data é a referência; o histórico mostra a evolução.

CREATE TABLE IF NOT EXISTS consorcio_saldos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consorcio_id UUID NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consorcio_saldos_consorcio ON consorcio_saldos(consorcio_id, data DESC);

ALTER TABLE consorcio_saldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON consorcio_saldos;
CREATE POLICY "authenticated_full_access" ON consorcio_saldos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- % do CDI que a administradora paga sobre o crédito parado (100 = 100% do CDI).
ALTER TABLE consorcios ADD COLUMN IF NOT EXISTS percentual_cdi NUMERIC(6,2) NOT NULL DEFAULT 100;

-- Backfill: o crédito já informado na contemplação vira o primeiro saldo do
-- histórico. Re-executar não duplica (NOT EXISTS).
INSERT INTO consorcio_saldos (consorcio_id, data, valor, observacao)
SELECT c.id, COALESCE(c.data_contemplacao, CURRENT_DATE), c.credito_disponivel, 'Crédito na contemplação'
FROM consorcios c
WHERE c.credito_disponivel IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM consorcio_saldos s WHERE s.consorcio_id = c.id);
