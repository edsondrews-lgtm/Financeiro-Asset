-- Categorias de gasto passam a ser uma tabela editável em vez de uma lista
-- hardcoded duplicada em SaidasPainel.tsx, TelegramGastos.tsx e no prompt do
-- Gemini em api/telegram-webhook.ts. Sem FK em pessoal_saidas.categoria /
-- telegram_gastos.categoria de propósito: continuam texto livre, casados por
-- nome exato, pra não quebrar dados existentes e permitir degradação
-- graciosa (categoria antiga renomeada/apagada não derruba a UI).

CREATE TABLE IF NOT EXISTS categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON categorias;
CREATE POLICY "authenticated_full_access" ON categorias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO categorias (nome, cor) VALUES
  ('Investimento', '#7C3AED'),
  ('Moradia',      '#0284C7'),
  ('Lazer',        '#059669'),
  ('Vestuário',    '#D97706'),
  ('Alimentação',  '#E11D48'),
  ('Assinatura',   '#4338CA'),
  ('Mercado',      '#0D9488'),
  ('Supérfluos',   '#DB2777'),
  ('Transporte',   '#EA580C'),
  ('Saúde',        '#0891B2'),
  ('Outros',       '#64748B')
ON CONFLICT (nome) DO NOTHING;
