-- Contemplação de consórcio: quando o cliente é sorteado/dá lance embutido,
-- o crédito disponível passa a ser um valor final informado pelo
-- administrador (não recalculável no app), a parcela vira fixa (sem IPCA),
-- e o crédito parado até o uso rende um valor periódico informado à parte.

ALTER TABLE consorcios ADD COLUMN IF NOT EXISTS data_contemplacao DATE;
ALTER TABLE consorcios ADD COLUMN IF NOT EXISTS credito_disponivel NUMERIC(12,2);

ALTER TABLE lances_consorcio ADD COLUMN IF NOT EXISTS tipo_lance TEXT
  DEFAULT 'livre' CHECK (tipo_lance IN ('embutido', 'livre'));

CREATE TABLE IF NOT EXISTS consorcio_rendimentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consorcio_id UUID NOT NULL REFERENCES consorcios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consorcio_rendimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON consorcio_rendimentos;
CREATE POLICY "authenticated_full_access" ON consorcio_rendimentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
