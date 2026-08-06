-- Checklist de contas mensais (aluguel, faturas, financiamento etc).
-- contas_recorrentes é o cadastro (o "molde" da conta); contas_recorrentes_pagamentos
-- guarda o status de cada mês. Uma conta com recorrente=true aparece em todo mês do
-- checklist mesmo sem linha em pagamentos (a UI trata isso como pendente com o
-- valor_padrao); uma conta avulsa (recorrente=false) só aparece no mês atual, ou em
-- meses que já tenham uma linha salva. A linha só é gravada quando o usuário marca
-- como paga ou edita o valor daquele mês.

CREATE TABLE IF NOT EXISTS contas_recorrentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  valor_padrao NUMERIC(12,2) NOT NULL DEFAULT 0,
  dia_vencimento INT NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 31),
  recorrente BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contas_recorrentes_pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id UUID NOT NULL REFERENCES contas_recorrentes(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL, -- sempre dia 01 do mês
  valor NUMERIC(12,2) NOT NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conta_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_contas_recorrentes_pagamentos_mes
  ON contas_recorrentes_pagamentos (mes_referencia);

ALTER TABLE contas_recorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_recorrentes_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON contas_recorrentes;
CREATE POLICY "authenticated_full_access" ON contas_recorrentes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_full_access" ON contas_recorrentes_pagamentos;
CREATE POLICY "authenticated_full_access" ON contas_recorrentes_pagamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
