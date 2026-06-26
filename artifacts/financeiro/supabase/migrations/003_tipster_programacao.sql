CREATE TABLE tipster_programacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  casa TEXT NOT NULL,
  dia_semana TEXT NOT NULL,
  valor REAL NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tipster_programacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON tipster_programacao USING (true);
