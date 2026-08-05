-- Liga cada pagamento de conta recorrente ao lançamento correspondente em
-- pessoal_saidas, pra marcar como pago também contar no fluxo de gastos
-- pessoais (Resumo, Pra onde vai etc). ON DELETE SET NULL: se a saída for
-- apagada direto na tela de Saídas, o pagamento continua marcado como pago,
-- só perde o vínculo.

ALTER TABLE contas_recorrentes_pagamentos
  ADD COLUMN IF NOT EXISTS saida_id UUID REFERENCES pessoal_saidas(id) ON DELETE SET NULL;
