-- Tabela separada só pros gastos confirmados via Telegram, pra não duplicar
-- com pessoal_saidas (cartão de crédito, fatura, etc.) enquanto o fluxo
-- de deduplicação não existe ainda.

CREATE TABLE IF NOT EXISTS telegram_gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_gasto DATE NOT NULL,
  itens JSONB,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON telegram_gastos(data_gasto);

ALTER TABLE telegram_gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON telegram_gastos;
CREATE POLICY "authenticated_full_access" ON telegram_gastos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- telegram_pendentes precisa carregar os itens também, entre o parse do
-- Gemini e a confirmação do usuário.
ALTER TABLE telegram_pendentes ADD COLUMN IF NOT EXISTS itens JSONB;
