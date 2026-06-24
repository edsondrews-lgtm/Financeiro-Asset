-- Extratos Bancários
-- Tabela para armazenar transações importadas de extratos bancários (Nubank, etc.)

CREATE TABLE IF NOT EXISTS extratos_bancarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('credito', 'debito')),
  descricao TEXT NOT NULL,
  identificador VARCHAR(100),
  categoria VARCHAR(50) DEFAULT 'Outros',
  observacao TEXT,
  arquivo_origem VARCHAR(255),
  data_importacao TIMESTAMPTZ DEFAULT now(),
  data_atualizacao TIMESTAMPTZ DEFAULT now()
);

-- Tabela para regras de aprendizado (categorização automática)
CREATE TABLE IF NOT EXISTS extratos_regras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  termo_busca TEXT NOT NULL UNIQUE,
  categoria_destino VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para buscas por data
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_data ON extratos_bancarios (data DESC);
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_categoria ON extratos_bancarios (categoria);

-- RLS
ALTER TABLE extratos_bancarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE extratos_regras ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário autenticado pode tudo
CREATE POLICY "usuarios podem ler extratos" ON extratos_bancarios
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "usuarios podem inserir extratos" ON extratos_bancarios
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "usuarios podem atualizar extratos" ON extratos_bancarios
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "usuarios podem deletar extratos" ON extratos_bancarios
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "usuarios podem ler regras" ON extratos_regras
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "usuarios podem inserir regras" ON extratos_regras
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "usuarios podem atualizar regras" ON extratos_regras
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "usuarios podem deletar regras" ON extratos_regras
  FOR DELETE USING (auth.role() = 'authenticated');
