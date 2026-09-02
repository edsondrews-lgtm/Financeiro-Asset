-- Marca se uma posição foi comprada com capital novo (de fora) ou com lucro
-- reciclado de outra venda/provento (via saldo da corretora) — pra não
-- contar esse dinheiro reinvestido como se fosse capital novo colocado.
-- Não mexe no Total Investido/Lucro (que precisam do custo de TODAS as
-- posições pra bater com o Valor Atual) — só afeta a legenda de capital
-- originalmente investido.
ALTER TABLE carteira_investimentos ADD COLUMN IF NOT EXISTS capital_novo BOOLEAN NOT NULL DEFAULT true;
