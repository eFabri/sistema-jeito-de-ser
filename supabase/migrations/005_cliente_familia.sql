-- ============================================================
-- JEITO DE SER — Migração 005: Seção Família + Casamento
-- Execute no Supabase → SQL Editor
-- ============================================================

-- 1. Novos campos em clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_casamento date;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS filho text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS filho_telefone text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ref_pessoal2 text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ref_pessoal2_tel text;

-- 2. Flag de produto cadastrado no PDV
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cadastrado_no_pdv boolean DEFAULT false;

-- 3. Função aniversariantes_hoje — retorna aniversários de nascimento E de casamento
CREATE OR REPLACE FUNCTION aniversariantes_hoje()
RETURNS TABLE (
  id          uuid,
  nome        text,
  celular     text,
  whatsapp    text,
  categoria   text,
  tipo_aniversario text
) AS $$
BEGIN
  -- Aniversários de nascimento
  RETURN QUERY
  SELECT
    c.id, c.nome, c.celular, c.whatsapp, c.categoria,
    'aniversario'::text AS tipo_aniversario
  FROM clientes c
  WHERE c.ativo = true
    AND c.data_nascimento IS NOT NULL
    AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY   FROM c.data_nascimento) = EXTRACT(DAY   FROM CURRENT_DATE);

  -- Aniversários de casamento
  RETURN QUERY
  SELECT
    c.id, c.nome, c.celular, c.whatsapp, c.categoria,
    'casamento'::text AS tipo_aniversario
  FROM clientes c
  WHERE c.ativo = true
    AND c.data_casamento IS NOT NULL
    AND EXTRACT(MONTH FROM c.data_casamento) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY   FROM c.data_casamento) = EXTRACT(DAY   FROM CURRENT_DATE);
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Template WhatsApp para aniversário de casamento
INSERT INTO whatsapp_modelos (tipo, nome, mensagem, ativo)
VALUES (
  'aniversario_casamento',
  'Aniversário de Casamento',
  'Parabéns, {nome}! 💍 Desejamos a vocês um feliz aniversário de casamento! Que esse dia seja especial e repleto de amor. Com carinho, equipe Jeito de Ser 🌸',
  true
)
ON CONFLICT (tipo) DO NOTHING;
