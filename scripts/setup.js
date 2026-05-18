#!/usr/bin/env node
// scripts/setup.js — Script de verificação e setup automático
// Rodado pelo Claude Code durante o deploy

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const verde  = (t) => `\x1b[32m${t}\x1b[0m`
const amarelo = (t) => `\x1b[33m${t}\x1b[0m`
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`
const negrito  = (t) => `\x1b[1m${t}\x1b[0m`

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts })
  } catch (e) {
    return null
  }
}

function checkVersion(cmd, minVersion, name) {
  const out = run(`${cmd} --version`, { silent: true })
  if (!out) {
    console.log(vermelho(`✕ ${name} não encontrado`))
    return false
  }
  const version = out.trim().replace('v', '').split('.')[0]
  if (parseInt(version) < minVersion) {
    console.log(amarelo(`⚠ ${name} versão ${out.trim()} — recomendado ${minVersion}+`))
    return true
  }
  console.log(verde(`✓ ${name} ${out.trim()}`))
  return true
}

console.log(negrito('\n🌸 Jeito de Ser — Verificação de Ambiente\n'))

// ─── VERIFICAR DEPENDÊNCIAS ──────────────────────────────
console.log(negrito('Verificando dependências:'))
const nodeOk = checkVersion('node', 18, 'Node.js')
const npmOk  = checkVersion('npm', 9, 'npm')
const gitOk  = checkVersion('git', 2, 'Git')

if (!nodeOk) {
  console.log(vermelho('\n❌ Node.js 18+ é necessário.'))
  console.log('Baixe em: https://nodejs.org/en/download')
  process.exit(1)
}

// ─── VERIFICAR ESTRUTURA DO PROJETO ──────────────────────
console.log(negrito('\nVerificando estrutura do projeto:'))
const arquivosNecessarios = [
  'package.json', 'next.config.ts', 'src/app/page.tsx',
  'supabase/migrations/001_schema_completo.sql',
  'supabase/migrations/002_mensagens_whatsapp.sql',
  'scripts/migrate.js',
]
let tudo_ok = true
for (const arq of arquivosNecessarios) {
  if (fs.existsSync(path.join(process.cwd(), arq))) {
    console.log(verde(`  ✓ ${arq}`))
  } else {
    console.log(vermelho(`  ✕ ${arq} não encontrado`))
    tudo_ok = false
  }
}

if (!tudo_ok) {
  console.log(vermelho('\n❌ Arquivos do projeto incompletos. Verifique se extraiu o zip corretamente.'))
  process.exit(1)
}

// ─── VERIFICAR .ENV.LOCAL ────────────────────────────────
console.log(negrito('\nVerificando configuração:'))
if (fs.existsSync('.env.local')) {
  const env = fs.readFileSync('.env.local', 'utf-8')
  const vars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  for (const v of vars) {
    if (env.includes(v) && !env.includes(`${v}=seu`) && !env.includes(`${v}=https://XXXX`)) {
      console.log(verde(`  ✓ ${v} configurado`))
    } else {
      console.log(amarelo(`  ⚠ ${v} não configurado (necessário para rodar)`))
    }
  }
} else {
  console.log(amarelo('  ⚠ .env.local não existe ainda (precisará ser criado)'))
}

// ─── VERIFICAR NODE_MODULES ──────────────────────────────
console.log(negrito('\nVerificando dependências npm:'))
if (fs.existsSync('node_modules')) {
  console.log(verde('  ✓ node_modules existe'))
} else {
  console.log(amarelo('  ⚠ node_modules não encontrado — rodando npm install...'))
  run('npm install')
  console.log(verde('  ✓ npm install concluído'))
}

// ─── SUMÁRIO ─────────────────────────────────────────────
console.log(negrito('\n─────────────────────────────────────'))
console.log(negrito('Próximos passos:\n'))
console.log('1. Criar projeto no Supabase (supabase.com)')
console.log('2. Executar os SQLs de schema')
console.log('3. Criar .env.local com as chaves do Supabase')
console.log('4. Rodar npm run dev para testar localmente')
console.log('5. Deploy no Vercel com: npx vercel --prod')
console.log('\nO Claude Code tem todas as instruções no CLAUDE.md')
console.log(verde('\n✅ Verificação concluída!\n'))
