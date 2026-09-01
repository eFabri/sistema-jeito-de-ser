-- ─────────────────────────────────────────────────────────────────────────────
-- 008 — Campo de observação de opt-in WhatsApp
-- Aplicado manualmente em produção em 01/09/2026.
-- ─────────────────────────────────────────────────────────────────────────────

alter table clientes
  add column if not exists observacao_optin text;
