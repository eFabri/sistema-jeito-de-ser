-- 010_pagamento_parcial.sql — Campos de pagamento parcial em contas_a_receber
-- Execute no Supabase → SQL Editor

ALTER TABLE contas_a_receber ADD COLUMN IF NOT EXISTS valor_pago          numeric(10,2) DEFAULT 0;
ALTER TABLE contas_a_receber ADD COLUMN IF NOT EXISTS saldo_devedor_original numeric(10,2) DEFAULT 0;
ALTER TABLE contas_a_receber ADD COLUMN IF NOT EXISTS parcialmente_pago   boolean DEFAULT false;

-- Índices compostos para acelerar filtros frequentes
CREATE INDEX IF NOT EXISTS idx_car_pago_vencimento
  ON contas_a_receber(pago, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_car_parcialmente_pago
  ON contas_a_receber(parcialmente_pago)
  WHERE parcialmente_pago = true;
