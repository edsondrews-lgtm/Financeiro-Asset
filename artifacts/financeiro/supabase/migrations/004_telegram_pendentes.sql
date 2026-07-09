-- Suporte a lançamento de gastos via Telegram (foto de cupom ou texto),
-- com fluxo de aprovação antes de gravar em pessoal_saidas.

ALTER TABLE pessoal_saidas ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS telegram_pendentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_gasto DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON telegram_pendentes(chat_id, message_id);

ALTER TABLE telegram_pendentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON telegram_pendentes;
CREATE POLICY "authenticated_full_access" ON telegram_pendentes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- A Edge Function grava usando a service role key (bypassa RLS por padrão),
-- então esta policy só protege contra acesso via anon key direto na API.
