#!/usr/bin/env node
// ============================================================
// JEITO DE SER — Script de ATUALIZAÇÃO de dados
//
// Atualiza o banco Supabase com CSVs mais recentes do sistema Access.
// NUNCA toca em: produtos, compras_itens, vendas_trocas_itens
// (o estoque é gerido manualmente pela proprietária).
//
// Como usar:
//   CSV_DIR=/caminho/dos/csvs node scripts/update.js
// As credenciais (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY)
// vêm do .env.local automaticamente.
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

// ─── Carrega .env.local ─────────────────────────────────────
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf-8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CSV_DIR      = process.env.CSV_DIR || './csvs';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_KEY (.env.local ou env vars)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Parsers (reaproveitados de migrate.js) ─────────────────
function readCSV(filename) {
  const filePath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  Arquivo não encontrado: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
}

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  const mmN = parseInt(mm, 10), ddN = parseInt(dd, 10);
  if (mmN < 1 || mmN > 12 || ddN < 1 || ddN > 31) return null;
  const year = yy.length === 2 ? (parseInt(yy) > 30 ? `19${yy}` : `20${yy}`) : yy;
  return `${year}-${mm}-${dd}`;
}

const MONEY_CAP = 99999999.99;
function parseMoney(str) {
  if (!str || str.trim() === '') return 0;
  const n = parseFloat(str.replace(',', '.')) || 0;
  if (n > MONEY_CAP) return MONEY_CAP;
  if (n < -MONEY_CAP) return -MONEY_CAP;
  return n;
}
function parseBool(str) { return str === '1' || str === 'true' || str === 'True'; }
function parseInt2(str) {
  if (!str || String(str).trim() === '') return null;
  return parseInt(str) || null;
}
function strip(s) { return s ? String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null; }

// ─── Helpers de paginação ──────────────────────────────────
/** Retorna um Map<codigo_legado, id> de uma tabela inteira (paginada). */
async function loadLegacyMap(table) {
  const map = {};
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table).select('id, codigo_legado').range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.codigo_legado != null) map[r.codigo_legado] = r.id;
    if (data.length < 1000) break;
    from += 1000;
  }
  return map;
}

/** Retorna um Set<codigo_legado> que já existem na tabela (paginado). */
async function loadExistingLegado(table) {
  const set = new Set();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table).select('codigo_legado').range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.codigo_legado != null) set.add(r.codigo_legado);
    if (data.length < 1000) break;
    from += 1000;
  }
  return set;
}

/** Retorna Set<codigo_legado> que já estão pagos (pra preservar contas a receber). */
async function loadPagosCodigos(table) {
  const set = new Set();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table).select('codigo_legado').eq('pago', true).range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.codigo_legado != null) set.add(r.codigo_legado);
    if (data.length < 1000) break;
    from += 1000;
  }
  return set;
}

// ─── Núcleo: processa uma tabela conforme o modo ────────────
// modos:
//   'upsert'        → insere ou atualiza por codigo_legado (default)
//   'insert-only'   → só insere registros cujo codigo_legado ainda não existe
//   'preserve-pago' → upsert mas não toca em quem já está pago=true
async function processar({ tabela, csv, mapFn, modo = 'upsert', conflito = 'codigo_legado' }) {
  console.log(`\n── ${tabela.padEnd(22)} (${csv}) ──`);
  const rows = readCSV(csv);
  if (rows.length === 0) {
    console.log('  (vazio, pulando)');
    return { tabela, inserted: 0, updated: 0, ignored: 0, errors: 0, skipped: 0 };
  }

  let mapped = (await Promise.all(rows.map(mapFn)))
    .filter(r => r !== null && r !== undefined);
  const total = mapped.length;
  let skippedByMap = rows.length - total;

  // Modo insert-only ou tabela sem unique key (vendas_itens, vendas_pagamento, etc.)
  if (modo === 'insert-only') {
    const existing = await loadExistingLegado(tabela);
    const novos = mapped.filter(r => r.codigo_legado != null && !existing.has(r.codigo_legado));
    const ignored = total - novos.length;
    let inserted = 0, errors = 0;
    for (let i = 0; i < novos.length; i += 200) {
      const batch = novos.slice(i, i + 200);
      const { error } = await supabase.from(tabela).insert(batch);
      if (error) {
        // fallback row-by-row pra não derrubar batch inteiro por 1 ruim
        for (const r of batch) {
          const { error: e2 } = await supabase.from(tabela).insert(r);
          if (e2) errors++; else inserted++;
        }
      } else {
        inserted += batch.length;
      }
    }
    console.log(`  ✅ inserted=${inserted} · ignored=${ignored} (já existiam) · errors=${errors}`);
    return { tabela, inserted, updated: 0, ignored, errors, skipped: skippedByMap };
  }

  // Modo preserve-pago — remove os já pagos do upsert
  let preservados = 0;
  if (modo === 'preserve-pago') {
    const pagos = await loadPagosCodigos(tabela);
    const antes = mapped.length;
    mapped = mapped.filter(r => !pagos.has(r.codigo_legado));
    preservados = antes - mapped.length;
  }

  // Modo upsert (default) — categoriza pra contar insert vs update
  const existing = await loadExistingLegado(tabela);
  const insertCount = mapped.filter(r => r.codigo_legado != null && !existing.has(r.codigo_legado)).length;
  const updateCount = mapped.length - insertCount;

  let processed = 0, errors = 0;
  for (let i = 0; i < mapped.length; i += 200) {
    const batch = mapped.slice(i, i + 200);
    const { error } = await supabase
      .from(tabela).upsert(batch, { onConflict: conflito });
    if (error) {
      // fallback row-by-row
      for (const r of batch) {
        const { error: e2 } = await supabase
          .from(tabela).upsert(r, { onConflict: conflito });
        if (e2) errors++; else processed++;
      }
    } else {
      processed += batch.length;
    }
  }
  const msg = preservados > 0
    ? `  ✅ inserted=${insertCount} · updated=${updateCount} · preservados=${preservados} (pago=true) · errors=${errors}`
    : `  ✅ inserted=${insertCount} · updated=${updateCount} · errors=${errors}`;
  console.log(msg);
  return {
    tabela, inserted: insertCount, updated: updateCount,
    ignored: preservados, errors, skipped: skippedByMap,
  };
}

// ─── Maps de FKs (carregados sob demanda) ───────────────────
let mapClientes, mapVendas, mapFornecedores, mapContasReceber, mapContasPagar, mapCompras, mapVendasTrocas;

async function carregarMapsBasicos() {
  console.log('\n📚 Carregando mapas FK (legacy → novo id)...');
  mapClientes = await loadLegacyMap('clientes');
  mapVendas = await loadLegacyMap('vendas');
  mapFornecedores = await loadLegacyMap('fornecedores');
  mapContasReceber = await loadLegacyMap('contas_a_receber');
  mapContasPagar = await loadLegacyMap('contas_a_pagar');
  mapCompras = await loadLegacyMap('compras');
  mapVendasTrocas = await loadLegacyMap('vendas_trocas');
  console.log(`   clientes=${Object.keys(mapClientes).length} vendas=${Object.keys(mapVendas).length} fornecedores=${Object.keys(mapFornecedores).length}`);
  console.log(`   car=${Object.keys(mapContasReceber).length} cap=${Object.keys(mapContasPagar).length} compras=${Object.keys(mapCompras).length} trocas=${Object.keys(mapVendasTrocas).length}`);
}

// ─── Map functions (CSV → row da tabela) ────────────────────
const MAPS = {
  fornecedores: r => ({
    codigo_legado: parseInt2(r.Codigo),
    nome:        r.Nome_Fornecedor || 'Fornecedor',
    contato:     r.Contato || null,
    endereco:    r.Endereco || null,
    numero:      r.Numero || null,
    bairro:      r.Bairro || null,
    cidade:      r.Cidade || null,
    estado:      r.Estado || null,
    cep:         r.CEP || null,
    telefone:    r.Telefone || null,
    celular:     r.Celular || null,
    email:       r.Email || null,
    cnpj:        r.CNPJ || null,
    cpf:         r.CPF || null,
    inscricao_estadual: r.Inscricao_Estadual || null,
    identidade:  r.Identidade || null,
    tipo_pessoa: r.Tipo_Pessoa || null,
    atividade:   r.Atividade || null,
  }),

  funcionarios: r => ({
    codigo_legado: parseInt2(r.Codigo),
    nome: r.Nome_Funcionario || 'Funcionário',
    funcao: r.Funcao || null,
    endereco: r.Endereco || null,
    numero: r.Numero || null,
    bairro: r.Bairro || null,
    cidade: r.Cidade || null,
    estado: r.Estado || null,
    cep: r.CEP || null,
    telefone: r.Telefone || null,
    celular: r.Celular || null,
    email: r.Email || null,
    cpf: r.CPF || null,
    identidade: r.Identidade || null,
    data_entrada: parseDate(r.Data_Entrada),
    ativo: r.Ativo === undefined ? true : parseBool(r.Ativo),
    observacao: r.Observacao || null,
  }),

  clientes: r => ({
    codigo_legado: parseInt2(r.Codigo),
    nome: r.Nome_Cliente || 'Sem Nome',
    data_nascimento: parseDate(r.Data_Nascimento),
    estado_civil: r.Estado_Civil || null,
    conjuge: r.Conjuge || null,
    conjuge_telefone: r.Conjuge_Telefone || null,
    endereco: r.Endereco || null,
    numero: r.Numero || null,
    bairro: r.Bairro || null,
    cidade: r.Cidade || null,
    estado: r.Estado || null,
    cep: r.CEP || null,
    complemento: r.Complemento || null,
    telefone: r.Telefone || null,
    celular: r.Celular || null,
    whatsapp: r.WhatsApp_Numero || r.Celular || null,
    whatsapp_ativo: parseBool(r.WhatsApp),
    email: r.Email || null,
    cpf: r.CPF || null,
    identidade: r.Identidade || null,
    cnpj: r.CNPJ || null,
    inscricao_estadual: r.Inscricao_Estadual || null,
    tipo_pessoa: r.Tipo_Pessoa || 'Física',
    renda: r.Renda || null,
    trabalho_nome: r.Trabalho_Nome || null,
    trabalho_telefone: r.Trabalho_Telefone || null,
    trabalho_cargo: r.Trabalho_Cargo || null,
    trabalho_tempo: r.Trabalho_Tempo || null,
    ref_comercial: r.Referencia_Comercial || null,
    ref_comercial_tel: r.Referencia_Comercial_Telefone || null,
    ref_pessoal1: r.Referencia_Pessoal1 || null,
    ref_pessoal1_tel: r.Referencia_Pessoal1_Telefone || null,
    ref_pessoal2: r.Referencia_Pessoal2 || null,
    ref_pessoal2_tel: r.Referencia_Pessoal2_Telefone || null,
    filiacao_mae: r.Filiacao_Mae || null,
    filiacao_mae_tel: r.Filiacao_Mae_Telefone || null,
    filiacao_pai: r.Filiacao_Pai || null,
    filiacao_pai_tel: r.Filiacao_Pai_Telefone || null,
    filho: r.Filho || null,
    filho_telefone: r.Filho_Telefone || null,
    autorizados: r.Autorizados || null,
    naturalidade: r.Naturalidade || null,
    categoria: r.Categoria || 'Avista',
    perfil: r.Perfil || null,
    tamanho: r.Tamanho || null,
    tamanho2: r.Tamanho2 || null,
    tamanho3: r.Tamanho3 || null,
    limite_credito: parseMoney(r.LimiteCredito),
    credito_troca: parseMoney(r.Credito_Troca),
    desconto_familia: parseMoney(r.Desconto_Familia),
    rede_social: r.Rede_Social || null,
    rede_social_add: parseBool(r.Rede_Social_Add),
    observacao: r.Observacao || null,
  }),

  vendas: r => ({
    codigo_legado: parseInt2(r.Cod_Venda),
    vendedor: r.Vendedor || null,
    data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
    cod_cliente: mapClientes[parseInt2(r.Cod_Cliente)] || null,
    nome_cliente: r.Nome_Cliente || 'Cliente',
    desc_porcentagem: parseMoney(r.Desc_Porcentagem),
    desc_valor: parseMoney(r.Desc_Valor),
    valor_total: parseMoney(r.Valor_Total),
    situacao: r.Situacao || 'Venda',
    forma_pagamento: r.Forma_Pagamento || null,
    observacao: r.Observacao || null,
  }),

  vendas_itens: r => {
    const vid = mapVendas[parseInt2(r.Cod_Venda)];
    if (!vid) return null; // FK obrigatória — sem venda, descarta
    return {
      codigo_legado: parseInt2(r.Codigo),
      cod_venda: vid,
      // ⚠️  NÃO mexe em produtos — mantém cod_produto=null
      // mas grava o nome do produto pra preservar histórico legível
      cod_produto: null,
      produto: r.Produto || 'Produto',
      preco_venda: parseMoney(r.Preco_Venda),
      quantidade: parseInt2(r.Quantidade) || 1,
      sub_total: parseMoney(r.Sub_Total),
      desconto_valor: parseMoney(r.Desconto_Valor),
      desconto_pct: parseMoney(r.Desconto),
    };
  },

  vendas_pagamento: r => {
    const vid = mapVendas[parseInt2(r.Cod_Venda)];
    if (!vid) return null;
    return {
      codigo_legado: parseInt2(r.Codigo),
      cod_venda: vid,
      data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
      forma: r.Forma || 'Não informado',
      operadora: r.Operadora || null,
      conta: r.Conta || null,
      valor: parseMoney(r.Valor),
      parcela: r.Parcela || null,
      conta_a_receber: parseBool(r.ContaAReceber),
    };
  },

  contas_a_receber: r => ({
    codigo_legado: parseInt2(r.Cod_ContaReceber),
    cod_cliente: mapClientes[parseInt2(r.Cod_Cliente)] || null,
    cod_venda:   mapVendas[parseInt2(r.Cod_Venda)] || null,
    parcela: r.Parcela || null,
    data_lancamento: parseDate(r.Data_Lancamento) || new Date().toISOString().split('T')[0],
    data_vencimento: parseDate(r.Data_Vencimento) || new Date().toISOString().split('T')[0],
    data_cobranca: parseDate(r.Data_Cobranca),
    valor: parseMoney(r.Valor),
    juros: parseMoney(r.Juros),
    taxa: parseMoney(r.Taxa),
    saldo_devedor: parseMoney(r.Saldo_Devedor),
    historico: r.Historico || null,
    condicao: r.Condicao || null,
    status: r.Status || 'Em aberto',
    pago: parseBool(r.Pago),
    inadimplente: parseBool(r.Inadimplente),
  }),

  contas_a_pagar: r => ({
    codigo_legado: parseInt2(r.Cod_ContaPagar),
    cod_compra: mapCompras[parseInt2(r.Cod_Compra)] || null,
    despesa: r.Despesa || null,
    descricao: r.Descricao || null,
    documento: r.Documento || null,
    parcela: r.Parcela || null,
    data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
    data_vencimento: parseDate(r.Data_Vencimento) || new Date().toISOString().split('T')[0],
    valor: parseMoney(r.Valor),
    juros: parseMoney(r.Juros),
    desconto: parseMoney(r.Desconto),
    taxa: parseMoney(r.Taxa),
    saldo_devedor: parseMoney(r.Saldo_Devedor),
    historico: r.Historico || null,
    forma_pgto: r.Forma_Pgto || null,
    plano_contas: r.Plano_Contas || null,
    status: r.Status || 'Em aberto',
    pago: parseBool(r.Pago),
  }),

  recebimentos: r => ({
    codigo_legado: parseInt2(r.Codigo),
    cod_conta: mapContasReceber[parseInt2(r.Cod_ContaReceber)] || null,
    cod_cliente: mapClientes[parseInt2(r.Cod_Cliente)] || null,
    cod_venda: mapVendas[parseInt2(r.Cod_Venda)] || null,
    data_pgto: parseDate(r.Data_Pgto) || new Date().toISOString().split('T')[0],
    forma_pgto: r.Forma_Pgto || null,
    valor_recebido: parseMoney(r.Valor_Recebido),
    entrada: r.Entrada || null,
  }),

  pagamentos: r => {
    const cod = mapContasPagar[parseInt2(r.Cod_ContaPagar)];
    if (!cod) return null; // sem conta, sem pagamento
    return {
      codigo_legado: parseInt2(r.Codigo),
      cod_conta: cod,
      data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
      valor: parseMoney(r.Valor),
      forma_pgto: r.Forma_Pgto || null,
      retirada: r.Retirada || null,
    };
  },

  fluxo_caixa: r => ({
    codigo_legado: parseInt2(r.Cod_FluxoCaixa),
    tipo_caixa: r.Tipo_Caixa || null,
    despesa: r.Despesa || null,
    descricao: r.Descricao || null,
    credito: parseMoney(r.Credito),
    debito: parseMoney(r.Debito),
    data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
    historico: r.Historico || null,
    tipo: r.Tipo || null,
    condicao: r.Condicao || null,
    plano_contas: r.Plano_Contas || null,
  }),

  compras: r => {
    // Ignora linhas-fantasma do Access
    if ((!r.Data || r.Data.trim() === '') && (!r.Valor_Total || r.Valor_Total.trim() === '')) return null;
    return {
      codigo_legado: parseInt2(r.Cod_Compra),
      data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
      nota_numero: parseInt2(r.Nota_Numero),
      cod_fornecedor: mapFornecedores[parseInt2(r.Cod_Fornecedor)] || null,
      grupo: r.Grupo || null,
      evento: r.Evento || null,
      valor_total: parseMoney(r.Valor_Total),
      documento: r.Documento || null,
    };
  },

  vendas_trocas: r => {
    if (!r.Data || r.Data.trim() === '') return null;
    const valor_original = parseMoney(r.Valor_Venda);
    const valor_troca = parseMoney(r.Valor_Troca);
    return {
      codigo_legado: parseInt2(r.Cod_Troca),
      cod_cliente: mapClientes[parseInt2(r.Cod_Cliente)] || null,
      nome_cliente: 'Cliente', // resolvido em runtime se quiser
      data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
      valor_original,
      valor_troca,
      diferenca: valor_troca - valor_original,
      status: r.Status || 'Concluída',
      vendedor: r.Cod_Vendedor ? String(r.Cod_Vendedor) : null,
    };
  },

  lembretes: r => {
    const descricao = strip(r.Lembrete);
    if (!descricao) return null;
    return {
      codigo_legado: parseInt2(r.Codigo),
      titulo: descricao.slice(0, 80),
      descricao,
      data_lembrete: parseDate(r.Data),
      concluido: parseBool(r.Realizado),
    };
  },

  fechamento_caixa: r => {
    if (!r.Data || r.Data.trim() === '') return null;
    const data = parseDate(r.Data);
    if (!data) return null;
    return {
      codigo_legado: parseInt2(r.Codigo),
      data,
      saldo_anterior: parseMoney(r.Saldo_Inicial),
      saldo_final: parseMoney(r.Saldo_Dia),
      saidas: parseMoney(r.Saidas),
      observacao: r.Observacao || null,
    };
  },
};

// ─── Empresa: tratamento especial (sem codigo_legado) ──────
async function atualizarEmpresa() {
  console.log('\n── empresa                  (TB_DadosMinhaEmpresa.csv) ──');
  const rows = readCSV('TB_DadosMinhaEmpresa.csv');
  if (!rows.length) { console.log('  (vazio, pulando)'); return { tabela: 'empresa', inserted: 0, updated: 0, ignored: 0, errors: 0, skipped: 0 }; }
  const r = rows[0];
  const dados = {
    nome: r.Empresa,
    cnpj: r.CNPJ,
    inscricao_estadual: r.Insc_Estadual,
    inscricao_municipal: r.Insc_Municipal,
    endereco: r.Endereco,
    numero: String(r.Numero || ''),
    bairro: r.Bairro,
    cidade: r.Cidade,
    uf: r.UF,
    cep: r.CEP,
    fone_comercial: r.Fone_Comercial,
    email: r.Email,
    banco: r.Banco,
    agencia: r.Agencia,
    conta_corrente: r.ContaCorrente,
    site: r.Site,
  };
  const { data: existentes } = await supabase.from('empresa').select('id').limit(1);
  if (existentes && existentes.length > 0) {
    const { error } = await supabase.from('empresa').update(dados).eq('id', existentes[0].id);
    if (error) { console.log('  ❌', error.message); return { tabela: 'empresa', inserted: 0, updated: 0, ignored: 0, errors: 1, skipped: 0 }; }
    console.log('  ✅ updated=1');
    return { tabela: 'empresa', inserted: 0, updated: 1, ignored: 0, errors: 0, skipped: 0 };
  }
  const { error } = await supabase.from('empresa').insert(dados);
  if (error) { console.log('  ❌', error.message); return { tabela: 'empresa', inserted: 0, updated: 0, ignored: 0, errors: 1, skipped: 0 }; }
  console.log('  ✅ inserted=1');
  return { tabela: 'empresa', inserted: 1, updated: 0, ignored: 0, errors: 0, skipped: 0 };
}

// ─── MAIN ──────────────────────────────────────────────────
async function main() {
  console.log('🔄 Atualização de dados — Jeito de Ser');
  console.log(`📁 CSVs:    ${CSV_DIR}`);
  console.log(`🗄️  Destino: ${SUPABASE_URL}\n`);
  const t0 = Date.now();

  const relatorio = [];

  // 1. Empresa (especial — sem codigo_legado)
  relatorio.push(await atualizarEmpresa());

  // 2. Fornecedores, Funcionários, Clientes (upsert)
  relatorio.push(await processar({ tabela: 'fornecedores', csv: 'tbl_Fornecedores.csv', mapFn: MAPS.fornecedores, modo: 'upsert' }));
  relatorio.push(await processar({ tabela: 'funcionarios', csv: 'tbl_Funcionarios.csv', mapFn: MAPS.funcionarios, modo: 'upsert' }));
  relatorio.push(await processar({ tabela: 'clientes',     csv: 'tbl_Clientes.csv',     mapFn: MAPS.clientes,     modo: 'upsert' }));

  // 3. Carrega mapas FK depois dos cadastros básicos
  await carregarMapsBasicos();

  // 4. Vendas (insert-only — nunca duplica, mas não atualiza existentes)
  relatorio.push(await processar({ tabela: 'vendas', csv: 'tbl_Vendas.csv', mapFn: MAPS.vendas, modo: 'insert-only' }));

  // 5. Re-carrega map de vendas pra incluir as novas
  mapVendas = await loadLegacyMap('vendas');

  // 6. Vendas_itens, vendas_pagamento (insert-only — sem unique constraint)
  relatorio.push(await processar({ tabela: 'vendas_itens',     csv: 'tbl_VendasItens.csv',     mapFn: MAPS.vendas_itens,     modo: 'insert-only' }));
  relatorio.push(await processar({ tabela: 'vendas_pagamento', csv: 'tbl_VendasPagamento.csv', mapFn: MAPS.vendas_pagamento, modo: 'insert-only' }));

  // 7. Compras antes de contas_a_pagar (FK)
  relatorio.push(await processar({ tabela: 'compras', csv: 'tbl_Compras.csv', mapFn: MAPS.compras, modo: 'upsert' }));
  mapCompras = await loadLegacyMap('compras');

  // 8. Contas a receber (preserva pago=true) e contas a pagar (upsert)
  relatorio.push(await processar({ tabela: 'contas_a_receber', csv: 'tbl_ContasAReceber.csv', mapFn: MAPS.contas_a_receber, modo: 'preserve-pago' }));
  relatorio.push(await processar({ tabela: 'contas_a_pagar',   csv: 'tbl_ContasAPagar.csv',   mapFn: MAPS.contas_a_pagar,   modo: 'upsert' }));
  mapContasReceber = await loadLegacyMap('contas_a_receber');
  mapContasPagar = await loadLegacyMap('contas_a_pagar');

  // 9. Recebimentos e Pagamentos (insert-only)
  relatorio.push(await processar({ tabela: 'recebimentos', csv: 'tbl_Recebimentos.csv', mapFn: MAPS.recebimentos, modo: 'insert-only' }));
  relatorio.push(await processar({ tabela: 'pagamentos',   csv: 'tbl_Pagamentos.csv',   mapFn: MAPS.pagamentos,   modo: 'insert-only' }));

  // 10. Fluxo de caixa (upsert)
  relatorio.push(await processar({ tabela: 'fluxo_caixa', csv: 'tbl_FluxoCaixa.csv', mapFn: MAPS.fluxo_caixa, modo: 'upsert' }));

  // 11. Trocas (upsert)
  relatorio.push(await processar({ tabela: 'vendas_trocas', csv: 'tbl_VendasTrocas.csv', mapFn: MAPS.vendas_trocas, modo: 'upsert' }));

  // 12. Lembretes (insert-only — sem unique)
  relatorio.push(await processar({ tabela: 'lembretes', csv: 'tbl_Lembretes.csv', mapFn: MAPS.lembretes, modo: 'insert-only' }));

  // 13. Fechamento de caixa (upsert)
  relatorio.push(await processar({ tabela: 'fechamento_caixa', csv: 'TB_FechamentoCaixa.csv', mapFn: MAPS.fechamento_caixa, modo: 'upsert' }));

  // ─── RELATÓRIO FINAL ─────────────────────────────────────
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RELATÓRIO FINAL DE ATUALIZAÇÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ${'Tabela'.padEnd(22)} ${'Inseridos'.padStart(10)} ${'Atualizad'.padStart(10)} ${'Ignorados'.padStart(10)} ${'Erros'.padStart(8)}`);
  console.log('  ' + '─'.repeat(60));
  let tIns = 0, tUpd = 0, tIgn = 0, tErr = 0;
  for (const r of relatorio) {
    console.log(`  ${r.tabela.padEnd(22)} ${String(r.inserted).padStart(10)} ${String(r.updated).padStart(10)} ${String(r.ignored).padStart(10)} ${String(r.errors).padStart(8)}`);
    tIns += r.inserted; tUpd += r.updated; tIgn += r.ignored; tErr += r.errors;
  }
  console.log('  ' + '─'.repeat(60));
  console.log(`  ${'TOTAIS'.padEnd(22)} ${String(tIns).padStart(10)} ${String(tUpd).padStart(10)} ${String(tIgn).padStart(10)} ${String(tErr).padStart(8)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n✅ Atualização concluída em ${elapsed}s`);
  console.log('⚠️  Tabelas IGNORADAS: produtos, compras_itens, vendas_trocas_itens (estoque manual)\n');
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
