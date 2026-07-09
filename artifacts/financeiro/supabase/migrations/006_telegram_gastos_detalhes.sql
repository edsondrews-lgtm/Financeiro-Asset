-- Adiciona nome do estabelecimento e permite que "itens" carregue a
-- categoria de cada produto (útil quando um cupom mistura categorias,
-- ex: limpeza + alimentação + supérfluos no mesmo mercado).
-- "itens" continua JSONB — sem mudança de schema, só de formato:
-- antes: ["Detergente", "Picanha"]
-- agora: [{"nome": "Detergente", "categoria": "Limpeza"}, ...]

ALTER TABLE telegram_gastos ADD COLUMN IF NOT EXISTS estabelecimento TEXT;
ALTER TABLE telegram_pendentes ADD COLUMN IF NOT EXISTS estabelecimento TEXT;
