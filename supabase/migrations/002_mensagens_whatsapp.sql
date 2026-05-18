-- ============================================================
-- JEITO DE SER — Atualizar modelos de mensagem WhatsApp
-- Cole e execute no Supabase → SQL Editor
-- ============================================================

-- ─── REMOVER TEMPLATE ANTIGO DE ANIVERSÁRIO ────────────────
DELETE FROM whatsapp_modelos WHERE tipo = 'aniversario';

-- ─── 5 VARIAÇÕES DE ANIVERSÁRIO ────────────────────────────
-- O sistema sorteia uma delas automaticamente no envio

INSERT INTO whatsapp_modelos (tipo, nome, mensagem, ativo) VALUES

('aniversario_1',
 'Aniversário — Variação 1',
 'Olá, {nome}! 🎂 Hoje é um dia especial — o seu aniversário! Toda a equipe Jeito de Ser te deseja um dia lindo, repleto de alegria e realizações. Você merece tudo de bom! 💛 *Jeito de Ser Fashion*',
 true),

('aniversario_2',
 'Aniversário — Variação 2',
 'Feliz aniversário, {nome}! 🌸 Que esse novo ciclo traga muitas bênçãos, saúde e conquistas. A equipe Jeito de Ser está torcendo muito por você! Com carinho 💛 *Jeito de Ser Fashion*',
 true),

('aniversario_3',
 'Aniversário — Variação 3',
 'Oi, {nome}! 🎉 A gente não poderia deixar o seu dia passar em branco! Feliz aniversário! Que você seja muito feliz e que todos os seus sonhos se realizem. Te esperamos na loja para comemorar juntas! 💛 *Jeito de Ser Fashion*',
 true),

('aniversario_4',
 'Aniversário — Variação 4',
 '{nome}, hoje é o seu dia! 🥳 Parabéns! Que Deus te abençoe com saúde, amor e muita prosperidade. Um beijo carinhoso da equipe Jeito de Ser! 💛 *Jeito de Ser Fashion*',
 true),

('aniversario_5',
 'Aniversário — Variação 5',
 'Parabéns, {nome}! 🌺 Mais um ano de vida para celebrar. Que essa data renove as suas energias e traga coisas lindas pela frente. Com muito amor, equipe Jeito de Ser! 💛 *Jeito de Ser Fashion*',
 true);

-- ─── COBRANÇAS — texto exato definido por você ──────────────

UPDATE whatsapp_modelos SET
  mensagem = 'Olá, {nome}, tudo bem? O vencimento da sua parcela é dia {data_vencimento}. Não deixe de acertar em dia para não gerar juros! Essa é uma mensagem automática do nosso sistema! 💛 *Jeito de Ser Fashion*',
  updated_at = now()
WHERE tipo = 'cobranca_5d';

UPDATE whatsapp_modelos SET
  mensagem = 'Olá, {nome}, tudo bem? O vencimento da sua parcela é *hoje*, dia {data_vencimento}. Não deixe de acertar em dia para não gerar juros! Essa é uma mensagem automática do nosso sistema! 💛 *Jeito de Ser Fashion*',
  updated_at = now()
WHERE tipo = 'cobranca_vencimento';

UPDATE whatsapp_modelos SET
  mensagem = 'Olá, {nome}, tudo bem? Identificamos que a sua parcela com vencimento em {data_vencimento} ainda está em aberto. Regularize para evitar acúmulo de juros. Qualquer dúvida, estamos à disposição! Essa é uma mensagem automática do nosso sistema! 💛 *Jeito de Ser Fashion*',
  updated_at = now()
WHERE tipo = 'cobranca_atraso';

-- ─── VERIFICAR RESULTADO ────────────────────────────────────
SELECT tipo, nome, LEFT(mensagem, 80) as preview, ativo
FROM whatsapp_modelos
ORDER BY tipo;
