-- ============================================================
-- JEITO DE SER — Migração de Permissões (Parte 4)
-- Execute no Supabase → SQL Editor
-- ============================================================

-- 1. Garantir defaults true em todas as colunas existentes
ALTER TABLE perfis_usuario ALTER COLUMN ver_dashboard    SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_vendas       SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN fazer_vendas     SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_clientes     SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN editar_clientes  SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_produtos     SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN editar_produtos  SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_financeiro   SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_compras      SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_relatorios   SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_whatsapp     SET DEFAULT true;
ALTER TABLE perfis_usuario ALTER COLUMN ver_configuracoes SET DEFAULT true;

-- 2. Adicionar colunas novas (se ainda não existirem)
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS cancelar_vendas   boolean DEFAULT true;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS aplicar_desconto  boolean DEFAULT true;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS ver_trocas        boolean DEFAULT true;
ALTER TABLE perfis_usuario ADD COLUMN IF NOT EXISTS ver_crediario     boolean DEFAULT true;

-- 3. Atualizar todos os registros existentes de funcionários para true em tudo
UPDATE perfis_usuario SET
  ver_dashboard     = true,
  ver_vendas        = true,
  fazer_vendas      = true,
  ver_clientes      = true,
  editar_clientes   = true,
  ver_produtos      = true,
  editar_produtos   = true,
  ver_financeiro    = true,
  ver_compras       = true,
  ver_relatorios    = true,
  ver_whatsapp      = true,
  ver_configuracoes = true,
  cancelar_vendas   = true,
  aplicar_desconto  = true,
  ver_trocas        = true,
  ver_crediario     = true
WHERE perfil != 'admin';
