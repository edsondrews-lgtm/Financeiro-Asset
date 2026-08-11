-- Permite sobrescrever manualmente a alíquota do Simples Nacional aplicada
-- num mês específico. A regra padrão (6% até maio, 7% de junho em diante)
-- é só uma aproximação — a alíquota real do Simples Nacional é progressiva
-- e depende do faturamento acumulado dos últimos 12 meses (RBT12), então
-- às vezes não bate com o padrão fixo.

CREATE TABLE IF NOT EXISTS empresa_aliquotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_ano TEXT NOT NULL UNIQUE, -- formato 'YYYY-MM'
  aliquota NUMERIC(5,2) NOT NULL, -- percentual, ex: 7.00
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE empresa_aliquotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON empresa_aliquotas;
CREATE POLICY "authenticated_full_access" ON empresa_aliquotas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
