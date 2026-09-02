-- Guarda a quantidade originalmente comprada separada da quantidade que
-- resta hoje. Antes, vender parte de uma posição "apagava" o registro de
-- quanto tinha sido comprado (só sobrava a quantidade restante), fazendo o
-- Total Investido parecer menor do que o capital realmente colocado.
-- quantidade nunca diminui aqui, mesmo com vendas parciais.

ALTER TABLE carteira_investimentos ADD COLUMN IF NOT EXISTS quantidade_original NUMERIC;

-- Backfill: quantidade atual + tudo que já foi vendido dessa posição
-- (histórico em carteira_vendas, vinculado por ativo_id).
UPDATE carteira_investimentos ci
SET quantidade_original = ci.quantidade + COALESCE((
  SELECT SUM(cv.quantidade_vendida) FROM carteira_vendas cv WHERE cv.ativo_id = ci.id
), 0)
WHERE quantidade_original IS NULL;

ALTER TABLE carteira_investimentos ALTER COLUMN quantidade_original SET DEFAULT 0;
ALTER TABLE carteira_investimentos ALTER COLUMN quantidade_original SET NOT NULL;
