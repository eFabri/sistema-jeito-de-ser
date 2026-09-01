-- ─────────────────────────────────────────────────────────────────────────────
-- 007 — Opt-in de marketing WhatsApp + log de envios via Cloud API (Meta)
-- ─────────────────────────────────────────────────────────────────────────────

-- Consentimento explícito de marketing via WhatsApp.
-- Default FALSE: não assume opt-in retroativo para cadastros existentes.
-- A data é registrada no momento em que o operador marca o consentimento
-- a partir do registro físico que a loja possui.
alter table clientes
  add column if not exists whatsapp_marketing_optin      boolean     not null default false,
  add column if not exists whatsapp_marketing_optin_data timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- Log de envios via templates da Cloud API Meta (separado do whatsapp_logs
-- existente, que registra mensagens de texto livre da Evolution API)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists whatsapp_envios_log (
  id              uuid primary key default uuid_generate_v4(),
  cliente_id      bigint references clientes(id),
  template        text not null,                      -- nome do template Meta
  status          text not null,                      -- 'enviado' | 'bloqueado' | 'erro'
  motivo          text,                               -- razão quando bloqueado ou erro
  numero          text,                               -- número de destino (formatado)
  variaveis       jsonb,                              -- array de variáveis posicionais enviadas
  meta_message_id text,                               -- wamid retornado pela Cloud API
  created_at      timestamptz default now()
);

create index if not exists idx_wenvios_cliente  on whatsapp_envios_log(cliente_id);
create index if not exists idx_wenvios_template on whatsapp_envios_log(template);
create index if not exists idx_wenvios_status   on whatsapp_envios_log(status);
create index if not exists idx_wenvios_created  on whatsapp_envios_log(created_at desc);

alter table whatsapp_envios_log enable row level security;
create policy "Acesso autenticado" on whatsapp_envios_log
  for all using (auth.role() = 'authenticated');
