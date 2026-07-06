// scripts/fix_crediario.js
// Corrige pago/parcial/saldo_devedor nas contas_a_receber e importa recebimentos históricos
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... CSV_DIR=... node scripts/fix_crediario.js

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL     = process.env.SUPABASE_URL     || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY
const CSV_DIR          = process.env.CSV_DIR          || '/Users/alkmimsilva/Downloads/jeito_fix_crediario'
const BATCH            = 200  // registros por upsert

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── HELPERS ────────────────────────────────────────────────────────────────

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n').filter(Boolean)
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    // Parsing simples que respeita aspas e vírgulas dentro delas
    const values = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ }
      else if (line[i] === ',' && !inQ) { values.push(cur); cur = '' }
      else cur += line[i]
    }
    values.push(cur)
    const row = {}
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim() })
    return row
  }).filter(r => Object.values(r).some(v => v !== ''))
}

function parseFloat2(v) { return parseFloat((v || '0').replace(',', '.')) || 0 }
function parseInt2(v)   { return parseInt((v || '0').replace(/\D/g, ''), 10) || 0 }

function parseDate(v) {
  if (!v) return null
  // Formato: "06/08/17 00:00:00" ou "2017-06-08"
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (!m) return null
  const [, mm, dd, yy] = m
  const ano = yy.length === 2 ? (parseInt(yy) < 30 ? '20' + yy : '19' + yy) : yy
  return `${ano}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
}

function chunks(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

// ─── PARTE 1: GARANTIR COLUNAS ──────────────────────────────────────────────

async function garantirColunas() {
  console.log('\n── Verificando colunas no banco...')
  // Testar se valor_pago existe fazendo um select limitado
  const { error } = await supabase
    .from('contas_a_receber')
    .select('valor_pago, parcialmente_pago, saldo_devedor_original')
    .limit(1)

  if (error && error.message.includes('column')) {
    console.warn('  ⚠  Colunas ainda não existem. Execute no Supabase SQL Editor:')
    console.warn(`
ALTER TABLE contas_a_receber
  ADD COLUMN IF NOT EXISTS valor_pago              numeric(10,2) default 0,
  ADD COLUMN IF NOT EXISTS parcialmente_pago       boolean       default false,
  ADD COLUMN IF NOT EXISTS saldo_devedor_original  numeric(10,2) default 0;
`)
    console.warn('  Após rodar o SQL acima, execute este script novamente.')
    process.exit(1)
  } else {
    console.log('  ✓ Colunas valor_pago, parcialmente_pago, saldo_devedor_original OK')
  }
}

// ─── PARTE 2: FIX CONTAS A RECEBER ──────────────────────────────────────────

async function fixContasAReceber() {
  console.log('\n── Lendo tbl_ContasAReceber.csv...')
  const rows = parseCsv(path.join(CSV_DIR, 'tbl_ContasAReceber.csv'))
  console.log(`  ${rows.length} linhas lidas`)

  const stats = { quitadas: 0, parciais: 0, aberto: 0, erros: 0 }
  const updates = []

  for (const row of rows) {
    const codLegado = parseInt2(row.Cod_ContaReceber)
    if (!codLegado) continue

    const pagoFlag = row.Pago === '1'
    const valor    = parseFloat2(row.Valor)
    const saldo    = parseFloat2(row.Saldo_Devedor)
    const valorPago = Math.max(0, valor - saldo)

    let patch

    // Pago=0 com Saldo vazio = parcela aberta (saldo real = valor integral)
    if (!pagoFlag && saldo <= 0.01) {
      stats.aberto++
      updates.push({
        codigo_legado: codLegado,
        pago: false,
        parcialmente_pago: false,
        valor_pago: 0,
        saldo_devedor: valor,
        saldo_devedor_original: valor,
        status: 'Em aberto',
        inadimplente: row.Inadiplente === '1',
      })
      continue
    }

    if (pagoFlag || saldo <= 0.01) {
      // QUITADA
      stats.quitadas++
      patch = {
        codigo_legado: codLegado,
        pago: true,
        parcialmente_pago: false,
        valor_pago: valor,
        saldo_devedor: 0,
        saldo_devedor_original: 0,
        status: 'Pago',
        inadimplente: false,
      }
    } else if (saldo < valor - 0.01 && saldo > 0.01) {
      // PAGAMENTO PARCIAL
      stats.parciais++
      patch = {
        codigo_legado: codLegado,
        pago: false,
        parcialmente_pago: true,
        valor_pago: valorPago,
        saldo_devedor: saldo,
        saldo_devedor_original: saldo,
        status: 'Pago Parcial',
        inadimplente: row.Inadiplente === '1',
      }
    } else {
      // EM ABERTO (saldo ≈ valor)
      stats.aberto++
      patch = {
        codigo_legado: codLegado,
        pago: false,
        parcialmente_pago: false,
        valor_pago: 0,
        saldo_devedor: saldo,
        saldo_devedor_original: saldo,
        status: 'Em aberto',
        inadimplente: row.Inadiplente === '1',
      }
    }

    updates.push(patch)
  }

  console.log(`  Preparados: ${stats.quitadas} quitadas | ${stats.parciais} parciais | ${stats.aberto} em aberto`)
  console.log('  Enviando ao banco em lotes de ' + BATCH + '...')

  // Usar UPDATE (não upsert) para não tentar inserir registros novos
  // Agrupar em lotes e fazer update individual por codigo_legado
  let ok = 0, erros = 0
  for (const lote of chunks(updates, BATCH)) {
    // Para cada lote, fazer um único upsert apenas dos campos de status
    // Mas como upsert pode inserir, usamos RPC ou update individual
    const promises = lote.map(({ codigo_legado, ...campos }) =>
      supabase
        .from('contas_a_receber')
        .update(campos)
        .eq('codigo_legado', codigo_legado)
        .then(({ error }) => {
          if (error) { erros++; return false }
          ok++; return true
        })
    )
    await Promise.all(promises)
    if (ok % 1000 === 0 && ok > 0) console.log(`    ... ${ok} processados`)
  }

  console.log(`  ✓ ${ok} registros atualizados | ✗ ${erros} erros`)
  return { ...stats, erros }
}

// ─── PARTE 3: IMPORTAR RECEBIMENTOS HISTÓRICOS ──────────────────────────────

async function importarRecebimentos() {
  console.log('\n── Lendo tbl_Recebimentos.csv...')
  const rows = parseCsv(path.join(CSV_DIR, 'tbl_Recebimentos.csv'))
  console.log(`  ${rows.length} recebimentos no CSV`)

  // Carregar mapa de codigo_legado → id das contas
  console.log('  Carregando mapa contas_a_receber...')
  const { data: contas, error: errContas } = await supabase
    .from('contas_a_receber')
    .select('id, codigo_legado, cod_cliente')
  if (errContas) { console.error('  ✗ Erro ao carregar contas:', errContas.message); return }
  const mapaConta = {}
  for (const c of contas) {
    if (c.codigo_legado) mapaConta[c.codigo_legado] = { id: c.id, cod_cliente: c.cod_cliente }
  }

  // Carregar codigo_legado já existentes em recebimentos para evitar duplicatas
  const { data: recExist } = await supabase
    .from('recebimentos')
    .select('codigo_legado')
  const codigosJaExistentes = new Set((recExist || []).map(r => r.codigo_legado).filter(Boolean))
  console.log(`  ${codigosJaExistentes.size} recebimentos já no banco`)

  const inserir = []
  let ignorados = 0

  for (const row of rows) {
    const codRec   = parseInt2(row.Codigo)
    const codConta = parseInt2(row.Cod_ContaReceber)

    if (codigosJaExistentes.has(codRec)) { ignorados++; continue }

    const conta = mapaConta[codConta]
    inserir.push({
      codigo_legado: codRec || null,
      cod_conta:    conta?.id || null,
      cod_cliente:  conta?.cod_cliente || null,
      data_pgto:    parseDate(row.Data_Pgto) || '2000-01-01',
      forma_pgto:   row.Forma_Pgto || 'Dinheiro',
      valor_recebido: parseFloat2(row.Valor_Recebido),
      entrada:      row.Entrada || null,
    })
  }

  console.log(`  ${ignorados} já existiam | ${inserir.length} novos para inserir`)

  if (inserir.length === 0) { console.log('  Nada a inserir.'); return }

  let ok = 0, erros = 0
  for (const lote of chunks(inserir, BATCH)) {
    const { error } = await supabase.from('recebimentos').insert(lote)
    if (error) {
      console.error('  ✗ Erro no lote:', error.message)
      erros += lote.length
    } else {
      ok += lote.length
    }
  }

  console.log(`  ✓ ${ok} inseridos | ✗ ${erros} erros`)
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  FIX CREDIÁRIO — Jeito de Ser')
  console.log('═══════════════════════════════════════')
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log(`  CSV dir : ${CSV_DIR}`)

  await garantirColunas()
  const statsCAR = await fixContasAReceber()
  await importarRecebimentos()

  console.log('\n═══════════════════════════════════════')
  console.log('  RELATÓRIO FINAL')
  console.log('═══════════════════════════════════════')
  console.log(`  Parcelas QUITADAS    : ${statsCAR.quitadas}`)
  console.log(`  Parcelas PARCIAIS    : ${statsCAR.parciais}`)
  console.log(`  Parcelas EM ABERTO   : ${statsCAR.aberto}`)
  console.log(`  Erros                : ${statsCAR.erros}`)
  console.log('═══════════════════════════════════════')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
