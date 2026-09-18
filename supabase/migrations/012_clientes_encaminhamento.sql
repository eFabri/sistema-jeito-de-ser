-- 012_clientes_encaminhamento.sql — Encaminhamento de clientes do dia no Dashboard
-- Execute no Supabase → SQL Editor

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS encaminhado_em    timestamptz;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS acoes_disparadas  jsonb DEFAULT '[]';

-- Acelera a busca "clientes cadastrados hoje"
CREATE INDEX IF NOT EXISTS idx_clientes_data_cadastro ON clientes(data_cadastro);
