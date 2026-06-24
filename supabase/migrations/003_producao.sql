-- ============================================================
-- JEITO DE SER — Migração de Produção (Parte 3)
-- Execute no Supabase → SQL Editor
-- ============================================================

-- 1. Adicionar campo apelido em perfis_usuario
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS apelido text;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz;

-- 2. Novos campos de permissão granular
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS cancelar_vendas boolean default false;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS alterar_preco_pdv boolean default false;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS ver_crediario boolean default false;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS fazer_trocas boolean default true;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS ver_proprio_desempenho boolean default true;

-- Para admins existentes, ativar as novas permissões
UPDATE perfis_usuario SET
  cancelar_vendas = true,
  alterar_preco_pdv = true,
  ver_crediario = true,
  fazer_trocas = true,
  ver_proprio_desempenho = true
WHERE perfil = 'admin';

-- 2b. Adicionar fotos aos produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fotos text[] default '{}';
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS colecao text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS composicao text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS lavagem text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS observacoes_internas text;

-- 2c. Adicionar credito_troca aos clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS credito_troca numeric(12,2) default 0;

-- 3. Tabela de Metas
CREATE TABLE IF NOT EXISTS metas (
  id uuid primary key default uuid_generate_v4(),
  tipo text not null, -- 'global' | 'individual'
  user_id uuid references auth.users(id) on delete cascade,
  mes int not null check (mes between 1 and 12),
  ano int not null,
  valor numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(tipo, user_id, mes, ano)
);

ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso autenticado" ON metas;
CREATE POLICY "Acesso autenticado" ON metas
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. Criar buckets no Supabase Storage (via SQL não é possível — fazer manualmente)
-- Storage → New bucket → 'avatares' (público) e 'produtos' (público)
-- Ou via dashboard: Storage > Create bucket

-- 5. Atualizar trigger de updated_at para metas
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS metas_updated_at ON metas;
CREATE TRIGGER metas_updated_at BEFORE UPDATE ON metas
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
