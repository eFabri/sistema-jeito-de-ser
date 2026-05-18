# 🌸 Jeito de Ser — Sistema de Gestão Web

Sistema de gestão para loja de moda feminina. Construído com Next.js 14, Supabase e Evolution API.

---

## 📋 Pré-requisitos

- [Node.js 18+](https://nodejs.org)
- Conta no [GitHub](https://github.com)
- Conta no [Supabase](https://supabase.com)
- Conta no [Vercel](https://vercel.com)
- Evolution API instalada (Railway ou outro servidor)

---

## 🚀 Passo a Passo de Deploy

### ETAPA 1 — Criar o banco de dados no Supabase

1. Acesse https://supabase.com/dashboard
2. Clique em **"New Project"**
3. Nome: `jeito-de-ser` | Senha: (anote em lugar seguro)
4. Aguarde o projeto ser criado (~2 min)
5. Clique em **"SQL Editor"** no menu lateral
6. Clique em **"New query"**
7. Abra o arquivo `supabase/migrations/001_schema_completo.sql`
8. Copie todo o conteúdo e cole no editor
9. Clique em **"Run"** (▶)
10. ✅ Deve aparecer "Success" em verde

### ETAPA 2 — Migrar os dados do Access

1. Crie uma pasta `csvs/` dentro do projeto
2. Copie todos os CSVs de `jeito_de_ser_dados_exportados.zip` para `csvs/`
3. No Supabase: Settings → API → copie a `URL` e a `service_role key`
4. No terminal, dentro da pasta do projeto:
```bash
npm install
SUPABASE_URL=sua_url SUPABASE_SERVICE_KEY=sua_service_key CSV_DIR=./csvs node scripts/migrate.js
```
5. ✅ Deve mostrar "Migração concluída"

### ETAPA 3 — Subir o código no GitHub

1. Crie um repositório privado no GitHub: `jeito-de-ser`
2. No terminal:
```bash
git init
git add .
git commit -m "Initial commit - Jeito de Ser"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/jeito-de-ser.git
git push -u origin main
```

### ETAPA 4 — Deploy no Vercel

1. Acesse https://vercel.com/new
2. Clique em **"Import Git Repository"**
3. Selecione o repositório `jeito-de-ser`
4. Em **"Environment Variables"**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` → URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon/public key do Supabase
   - `EVOLUTION_API_URL` → URL da sua Evolution API
   - `EVOLUTION_API_KEY` → chave da Evolution API
   - `EVOLUTION_INSTANCE` → nome da instância (ex: `jeito-de-ser`)
   - `CRON_SECRET` → uma senha qualquer para proteger a cron
5. Clique em **"Deploy"**
6. ✅ Aguarde ~2 min. Seu sistema estará em `https://jeito-de-ser.vercel.app`

### ETAPA 5 — Criar o usuário administrador

1. No Supabase: Authentication → Users → **"Add user"**
2. Email: seu email | Senha: sua senha
3. No SQL Editor, execute:
```sql
insert into perfis_usuario (user_id, nome, cargo, perfil)
values (
  'ID_DO_USUARIO_QUE_ACABOU_DE_CRIAR',
  'Administrador',
  'Proprietária',
  'admin'
);
```
4. ✅ Acesse seu sistema e faça login!

### ETAPA 6 — Conectar WhatsApp (Evolution API)

1. Acesse o painel da Evolution API
2. Crie uma instância chamada `jeito-de-ser`
3. Abra o sistema → menu **WhatsApp** → **"Conectar Linha"**
4. Escaneie o QR Code com o WhatsApp da loja
5. ✅ A partir daí, mensagens automáticas funcionam todo dia às 9h

---

## 📁 Estrutura do Projeto

```
jeito-de-ser/
├── src/
│   ├── app/                    # Pages e API routes (Next.js App Router)
│   │   ├── (dashboard)/        # Área logada
│   │   │   ├── page.tsx        # Dashboard principal
│   │   │   ├── clientes/       # Módulo clientes
│   │   │   ├── vendas/         # PDV e vendas
│   │   │   ├── produtos/       # Estoque e produtos
│   │   │   ├── financeiro/     # Contas a pagar/receber
│   │   │   ├── compras/        # Compras de mercadoria
│   │   │   ├── relatorios/     # Relatórios
│   │   │   └── configuracoes/  # Configurações e WhatsApp
│   │   ├── auth/               # Login e logout
│   │   └── api/                # API Routes
│   │       └── whatsapp/
│   │           └── cron/       # Disparo automático diário
│   ├── components/
│   │   ├── ui/                 # Componentes base (Button, Input, Badge...)
│   │   ├── layout/             # Sidebar, Header, Layout
│   │   └── modules/            # Componentes de cada módulo
│   ├── lib/
│   │   ├── supabase.ts         # Cliente Supabase
│   │   └── whatsapp.ts         # Integração Evolution API
│   ├── types/                  # TypeScript types
│   └── hooks/                  # Custom hooks
├── supabase/
│   └── migrations/
│       └── 001_schema_completo.sql  # Schema completo do banco
├── scripts/
│   └── migrate.js              # Script de migração dos dados do Access
├── csvs/                       # (criar) CSVs exportados do Access
├── vercel.json                 # Configuração da cron do Vercel
├── .env.example                # Exemplo de variáveis de ambiente
└── package.json
```

---

## 🔧 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env.local
# Preencher os valores no .env.local

# Rodar o servidor de desenvolvimento
npm run dev
# Acesse http://localhost:3000
```

---

## 📱 Módulos do Sistema

| Módulo | Descrição |
|--------|-----------|
| Dashboard | Visão geral, KPIs do dia, alertas |
| PDV / Vendas | Registro de vendas, crediário, recibos |
| Clientes | Cadastro completo, histórico, crediário |
| Produtos | Estoque, preços, código de barras |
| Financeiro | Contas a pagar/receber, fluxo de caixa |
| Compras | Entrada de mercadoria, NF |
| Relatórios | Vendas por período, inadimplência, estoque |
| WhatsApp | Modelos de mensagem, logs, conexão |
| Configurações | Usuários, permissões, dados da empresa |

---

## 💬 WhatsApp Automático

Mensagens disparadas automaticamente todo dia às **9h**:

- 🎂 **Aniversário**: para todos os clientes que fazem aniversário hoje
- 💰 **Cobrança 5 dias**: para parcelas que vencem em exatamente 5 dias

Os textos das mensagens podem ser editados no módulo **WhatsApp → Modelos**.

---

## 🔒 Segurança

- Autenticação via Supabase Auth (email + senha)
- Row Level Security no banco (só usuários logados acessam dados)
- Permissões granulares por usuário (admin configura o que cada funcionária vê)
- HTTPS automático no Vercel
