-- 011_data_recebimento.sql — Data de recebimento em contas_a_receber
-- Execute no Supabase → SQL Editor

ALTER TABLE contas_a_receber ADD COLUMN IF NOT EXISTS data_recebimento date;

CREATE INDEX IF NOT EXISTS idx_car_data_recebimento
  ON contas_a_receber(data_recebimento)
  WHERE data_recebimento IS NOT NULL;
