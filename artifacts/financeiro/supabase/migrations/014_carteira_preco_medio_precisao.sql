-- Aumenta a precisão do preço médio guardado (a corretora costuma calcular
-- com mais casas decimais do que cabia no formulário antes, e essa diferença
-- se multiplica pela quantidade de ações, distorcendo o lucro/prejuízo mostrado).
ALTER TABLE carteira_investimentos ALTER COLUMN preco_medio TYPE NUMERIC(14,4);
