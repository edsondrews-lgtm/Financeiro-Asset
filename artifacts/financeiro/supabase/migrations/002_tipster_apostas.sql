CREATE TABLE tipster_apostas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('simples', 'bonus')),
  stake_unidades NUMERIC(4,2),
  valor_bonus NUMERIC(10,2),
  lucro_maximo NUMERIC(10,2),
  casa_aposta TEXT,
  odd_total NUMERIC(6,2) NOT NULL,
  resultado TEXT NOT NULL DEFAULT 'pendente' CHECK (resultado IN ('pendente', 'green', 'red', 'void')),
  lucro_reais NUMERIC(10,2),
  observacao TEXT,
  banca_momento NUMERIC(10,2) DEFAULT 1000.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tipster_apostas_detalhes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aposta_id UUID NOT NULL REFERENCES tipster_apostas(id) ON DELETE CASCADE,
  esporte TEXT NOT NULL,
  campeonato TEXT,
  jogo TEXT NOT NULL,
  mercado TEXT NOT NULL,
  selecao TEXT NOT NULL,
  odd_parcial NUMERIC(6,2)
);

CREATE INDEX ON tipster_apostas(data);
CREATE INDEX ON tipster_apostas(resultado);
CREATE INDEX ON tipster_apostas_detalhes(aposta_id);

ALTER TABLE tipster_apostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipster_apostas_detalhes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON tipster_apostas;
DROP POLICY IF EXISTS "auth_all" ON tipster_apostas_detalhes;

CREATE POLICY "allow_all" ON tipster_apostas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON tipster_apostas_detalhes FOR ALL USING (true) WITH CHECK (true);
