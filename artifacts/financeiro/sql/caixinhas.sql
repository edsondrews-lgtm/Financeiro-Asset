-- ================================================================
-- MÓDULO DE CAIXINHAS — FinançasHub
-- Execute no Supabase SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS caixinhas (
  id                       uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  nome                     text          NOT NULL,
  valor_atual              numeric(12,2) NOT NULL DEFAULT 0,
  meta                     numeric(12,2),
  prazo                    date,
  descricao                text,
  taxa_rendimento_mensal   numeric(8,4)  NOT NULL DEFAULT 0.87,
  created_at               timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caixinhas_aportes (
  id               uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  caixinha_id      uuid          NOT NULL REFERENCES caixinhas(id) ON DELETE CASCADE,
  valor_adicionado numeric(12,2) NOT NULL,
  valor_anterior   numeric(12,2) NOT NULL,
  valor_apos       numeric(12,2) NOT NULL,
  data_aporte      date          NOT NULL DEFAULT CURRENT_DATE,
  observacao       text,
  created_at       timestamptz   DEFAULT now()
);

-- Desativa RLS (app já tem senha própria)
ALTER TABLE caixinhas         DISABLE ROW LEVEL SECURITY;
ALTER TABLE caixinhas_aportes DISABLE ROW LEVEL SECURITY;
