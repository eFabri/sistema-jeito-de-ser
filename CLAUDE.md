# 🌸 Jeito de Ser — Instruções para o Claude Code

## O que você é e o que precisa fazer

Você é o assistente de deploy do sistema Jeito de Ser, uma loja de moda feminina em Ouro Branco/MG.
Este é um sistema web completo em Next.js 14 + Supabase, já construído e pronto para subir no ar.

**Seu trabalho:** guiar o usuário por cada etapa do deploy, executar tudo que puder automaticamente, e pedir input apenas quando for estritamente necessário (chaves de API, senhas).

---

## Regras de comportamento

1. **Seja proativo.** Não pergunte "posso fazer X?" — faça X e informe o que fez.
2. **Avise antes de pedir input.** Quando precisar de uma chave ou senha, explique exatamente onde o usuário encontra aquela informação.
3. **Valide cada etapa.** Após cada passo, confirme se funcionou antes de avançar.
4. **Em caso de erro**, mostre o erro completo, explique o que significa e corrija automaticamente se possível.
5. **Nunca pare no meio.** Se travar em algo, tente uma alternativa antes de pedir ajuda.

---

## Etapas do deploy — execute nesta ordem

### ETAPA 0 — Verificar ambiente
```bash
node --version        # precisa ser 18+
npm --version
git --version
```
Se algum não estiver instalado, instrua o usuário a instalar antes de continuar.

### ETAPA 1 — Instalar dependências
```bash
npm install
```
Aguarde terminar. Se houver erros de peer dependencies, use `npm install --legacy-peer-deps`.

### ETAPA 2 — Configurar Git e GitHub

2a. Inicializar o repositório local:
```bash
git init
git add .
git commit -m "feat: sistema Jeito de Ser - deploy inicial"
```

2b. Pedir ao usuário: "Abra github.com, crie um repositório PRIVADO chamado `jeito-de-ser` e me dê a URL (formato: https://github.com/SEU_USUARIO/jeito-de-ser.git)"

2c. Após receber a URL:
```bash
git branch -M main
git remote add origin URL_QUE_O_USUARIO_DEU
git push -u origin main
```

### ETAPA 3 — Configurar Supabase

3a. Dizer ao usuário:
"Acesse https://supabase.com/dashboard e crie um novo projeto:
- Nome: jeito-de-ser
- Senha do banco: anote em lugar seguro
- Região: South America (São Paulo)
Aguarde ~2 minutos para o projeto ficar pronto."

3b. Após o projeto estar criado, pedir:
"Vá em Settings → API e me dê:
1. A URL do projeto (ex: https://abcxyz.supabase.co)
2. A chave anon/public
3. A chave service_role (clique em 'Reveal')"

3c. Criar o arquivo .env.local com as chaves:
```
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_KEY=<service_key>
EVOLUTION_API_URL=https://placeholder.railway.app
EVOLUTION_API_KEY=placeholder
EVOLUTION_INSTANCE=jeito-de-ser
CRON_SECRET=<gerar automaticamente com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3d. Executar o schema SQL:
- Dizer ao usuário: "Vá em Supabase → SQL Editor → New query, abra o arquivo `supabase/migrations/001_schema_completo.sql`, copie todo o conteúdo e execute. Depois faça o mesmo com `supabase/migrations/002_mensagens_whatsapp.sql`."
- Aguardar confirmação do usuário de que executou.

### ETAPA 4 — Migrar dados do Access

4a. Perguntar: "Você tem a pasta com os CSVs exportados do sistema antigo? Se sim, me diga o caminho da pasta."

4b. Se sim, executar:
```bash
CSV_DIR="CAMINHO_QUE_O_USUARIO_DEU" \
SUPABASE_URL="URL_DO_SUPABASE" \
SUPABASE_SERVICE_KEY="SERVICE_KEY" \
node scripts/migrate.js
```

4c. Verificar se a migração terminou sem erros críticos. Erros de registros duplicados são aceitáveis.

### ETAPA 5 — Testar localmente

```bash
npm run dev
```

Dizer ao usuário: "O sistema está rodando em http://localhost:3000 — abra no navegador e veja se a tela de login aparece."

Se aparecer: prosseguir. Se não: diagnosticar o erro.

### ETAPA 6 — Instalar Vercel CLI e fazer deploy

```bash
npm install -g vercel
vercel login
```
(O usuário precisará confirmar o login no navegador)

```bash
vercel --prod
```

Durante o processo, o Vercel vai perguntar algumas coisas — responda:
- Set up and deploy: Y
- Which scope: selecionar a conta pessoal
- Link to existing project: N
- Project name: jeito-de-ser
- Directory: ./
- Override settings: N

### ETAPA 7 — Configurar variáveis de ambiente no Vercel

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_KEY production
vercel env add EVOLUTION_API_URL production
vercel env add EVOLUTION_API_KEY production
vercel env add EVOLUTION_INSTANCE production
vercel env add CRON_SECRET production
```
Para cada uma, o Vercel vai pedir o valor — instrua o usuário a digitar ou colar.

Após adicionar todas:
```bash
vercel --prod
```
(Redeploy para pegar as variáveis)

### ETAPA 8 — Criar usuário administrador

Dizer ao usuário:
"Acesse o Supabase → Authentication → Users → Add user:
- Email: email que você quer usar para login
- Password: senha segura
- Auto Confirm User: SIM

Depois vá em SQL Editor e execute:
```sql
INSERT INTO perfis_usuario (user_id, nome, cargo, perfil,
  ver_dashboard, ver_vendas, fazer_vendas, ver_clientes, editar_clientes,
  ver_produtos, editar_produtos, ver_financeiro, ver_compras,
  ver_relatorios, ver_whatsapp, ver_configuracoes)
SELECT id, 'Administrador', 'Proprietária', 'admin',
  true, true, true, true, true, true, true, true, true, true, true, true
FROM auth.users WHERE email = 'SEU_EMAIL_AQUI';
```
Substitua SEU_EMAIL_AQUI pelo email que você cadastrou."

### ETAPA 9 — Instalar QZ Tray (impressora)

Dizer ao usuário:
"Para a impressora térmica funcionar:
1. Acesse https://qz.io/download
2. Baixe e instale o QZ Tray (próximo, próximo, concluir)
3. Ele vai aparecer na bandeja do Windows (canto inferior direito)
4. Deixe rodando sempre que for usar o sistema"

### ETAPA 10 — Verificação final

Acessar a URL do Vercel que foi gerada e verificar:
- [ ] Tela de login aparece
- [ ] Login funciona com o usuário criado
- [ ] Dashboard carrega com dados
- [ ] Menu lateral tem todos os módulos
- [ ] Clientes carregam (deve ter ~3.152 se migração funcionou)

---

## Se o usuário perguntar sobre a Evolution API / WhatsApp

Dizer: "O WhatsApp é configurado depois que o sistema estiver no ar. Você precisará de uma conta na Evolution API — pode ser hospedada no Railway. Me diga quando quiser configurar essa parte e eu te guio."

---

## Erros comuns e soluções

**`Cannot find module`** → `npm install` novamente

**`Error: supabaseUrl is required`** → variáveis de ambiente não estão no .env.local, verificar ETAPA 3c

**`relation does not exist`** → SQL do schema não foi executado, voltar para ETAPA 3d

**`JWT expired`** → normal no dev, recarregar a página

**`git push` rejeitado** → `git pull --rebase origin main` e tentar novamente

**Vercel build error com TypeScript** → `npm run build` localmente para ver o erro antes

---

## Mensagem de conclusão

Quando tudo estiver funcionando, dizer:
"✅ Sistema Jeito de Ser está no ar!

🌐 URL: [URL do Vercel]
👤 Login: [email do administrador]

Próximos passos opcionais:
- Configurar Evolution API para WhatsApp automático
- Instalar QZ Tray para impressão de recibos
- Adicionar domínio personalizado no Vercel

Qualquer dúvida, volte ao Claude.ai e descreva o problema."
