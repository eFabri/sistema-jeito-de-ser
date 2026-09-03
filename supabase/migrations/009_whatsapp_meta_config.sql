create table if not exists whatsapp_meta_config (
  id               uuid default gen_random_uuid() primary key,
  app_id           text not null default '965760143217209',
  phone_number_id  text,
  waba_id          text,
  access_token     text,
  token_expires_at timestamptz,
  status           text not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
