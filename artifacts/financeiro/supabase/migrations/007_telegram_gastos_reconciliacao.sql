-- Suporte a cruzar lançamentos do Telegram com a fatura do cartão
-- (mesma compra, duas origens): quando a fatura é importada, o sistema
-- tenta casar por valor + data (janela de alguns dias, já que o cartão
-- costuma "postar" a compra depois da data real).

ALTER TABLE telegram_gastos ADD COLUMN IF NOT EXISTS reconciliado BOOLEAN DEFAULT false;
ALTER TABLE telegram_gastos ADD COLUMN IF NOT EXISTS pessoal_saida_id UUID REFERENCES pessoal_saidas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_gastos_reconciliado ON telegram_gastos(reconciliado) WHERE reconciliado = false;
