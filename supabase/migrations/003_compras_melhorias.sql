-- Adiciona forma_pagamento e status à tabela compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS status text DEFAULT 'Finalizada';
