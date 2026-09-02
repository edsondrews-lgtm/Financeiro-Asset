-- Histórico de vendas de ativos (ações/FIIs) e saldo parado na corretora.
-- Ao vender, guarda um "retrato" da posição (preço médio e data de compra no
-- momento da venda) em vez de depender só de ativo_id, porque a posição em
-- carteira_investimentos pode ser reduzida (venda parcial) ou até apagada
-- (venda total) depois — o histórico não pode sumir junto.

CREATE TABLE IF NOT EXISTS carteira_vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo_id UUID REFERENCES carteira_investimentos(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  nome TEXT,
  tipo TEXT NOT NULL,
  quantidade_vendida NUMERIC NOT NULL,
  preco_medio_compra NUMERIC(12,2) NOT NULL,
  data_compra DATE NOT NULL,
  preco_venda NUMERIC(12,2) NOT NULL,
  data_venda DATE NOT NULL,
  destino TEXT NOT NULL CHECK (destino IN ('corretora', 'saque')),
  lucro_prejuizo NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger do dinheiro parado na corretora (saldo = soma de "valor"; positivo
-- entra, negativo sai). Cobre depósito manual, saque manual, o valor de uma
-- venda que ficou lá, e a compra de um novo ativo pago com esse saldo.
CREATE TABLE IF NOT EXISTS carteira_corretora_movimentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('deposito', 'saque', 'venda', 'compra')),
  valor NUMERIC(12,2) NOT NULL,
  descricao TEXT,
  venda_id UUID REFERENCES carteira_vendas(id) ON DELETE SET NULL,
  data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE carteira_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE carteira_corretora_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON carteira_vendas;
CREATE POLICY "authenticated_full_access" ON carteira_vendas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_full_access" ON carteira_corretora_movimentos;
CREATE POLICY "authenticated_full_access" ON carteira_corretora_movimentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
