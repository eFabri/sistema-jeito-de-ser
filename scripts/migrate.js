#!/usr/bin/env node
// ============================================================
// JEITO DE SER — Script de Migração de Dados
// Importa os CSVs exportados do Access para o Supabase
//
// Como usar:
//   npm install @supabase/supabase-js csv-parse
//   SUPABASE_URL=sua_url SUPABASE_KEY=sua_key node migrate.js
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // use a service key
const CSV_DIR = process.env.CSV_DIR || './csvs'; // pasta com os CSVs exportados

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── HELPERS ────────────────────────────────────────────────

function readCSV(filename) {
  const filePath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Arquivo não encontrado: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
}

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  // formato Access: MM/DD/YY HH:MM:SS
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!match) return null;
  const [, mm, dd, yy] = match;
  // valida dia e mês (Access às vezes exporta "01/00/00" → "2000-01-00" inválido)
  const mmN = parseInt(mm, 10);
  const ddN = parseInt(dd, 10);
  if (mmN < 1 || mmN > 12 || ddN < 1 || ddN > 31) return null;
  const year = yy.length === 2 ? (parseInt(yy) > 30 ? `19${yy}` : `20${yy}`) : yy;
  return `${year}-${mm}-${dd}`;
}

// Schema usa numeric(10,2) — cap em 99999999.99 evita overflow de dados sujos do Access
const MONEY_CAP = 99999999.99;
function parseMoney(str) {
  if (!str || str.trim() === '') return 0;
  const n = parseFloat(str.replace(',', '.')) || 0;
  if (n > MONEY_CAP) return MONEY_CAP;
  if (n < -MONEY_CAP) return -MONEY_CAP;
  return n;
}

function parseBool(str) {
  return str === '1' || str === 'true' || str === 'True';
}

function parseInt2(str) {
  if (!str || str.trim() === '') return null;
  return parseInt(str) || null;
}

async function upsertBatch(table, rows, batchSize = 100) {
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'codigo_legado' });
    if (error) {
      // batch falhou — uma linha ruim derruba todas. Faz fallback row-by-row
      // pra salvar as válidas e logar só as defeituosas.
      let batchOk = 0;
      for (const row of batch) {
        const { error: rowErr } = await supabase.from(table).upsert(row, { onConflict: 'codigo_legado' });
        if (rowErr) {
          failed++;
          console.error(`  ⚠️  ${table} linha ${i + batch.indexOf(row)} (codigo_legado=${row.codigo_legado}): ${rowErr.message}`);
        } else {
          batchOk++;
        }
      }
      inserted += batchOk;
      console.log(`  🔧 batch ${i}-${i + batchSize}: salvas ${batchOk}/${batch.length} via fallback row-by-row`);
    } else {
      inserted += batch.length;
    }
  }
  if (failed > 0) console.log(`  ⚠️  ${table}: ${failed} linhas com dados irrecuperáveis foram puladas`);
  return inserted;
}

// ─── EMPRESA ────────────────────────────────────────────────

async function migrarEmpresa() {
  console.log('\n📋 Migrando empresa...');
  const rows = readCSV('TB_DadosMinhaEmpresa.csv');
  if (!rows.length) return;
  const row = rows[0];
  const { error } = await supabase.from('empresa').upsert({
    nome: row.Empresa,
    cnpj: row.CNPJ,
    inscricao_estadual: row.Insc_Estadual,
    inscricao_municipal: row.Insc_Municipal,
    endereco: row.Endereco,
    numero: String(row.Numero || ''),
    bairro: row.Bairro,
    cidade: row.Cidade,
    uf: row.UF,
    cep: row.CEP,
    fone_comercial: row.Fone_Comercial,
    email: row.Email,
    banco: row.Banco,
    agencia: row.Agencia,
    conta_corrente: row.ContaCorrente,
    site: row.Site,
  });
  if (error) console.error('  ❌', error.message);
  else console.log('  ✅ Empresa importada');
}

// ─── CLIENTES ───────────────────────────────────────────────

async function migrarClientes() {
  console.log('\n👤 Migrando clientes...');
  const rows = readCSV('tbl_Clientes.csv');
  const mapped = rows.map(r => ({
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
    categoria: r.Categoria || null,
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
    data_cadastro: parseDate(r.Data_Cadastro) || new Date().toISOString(),
  }));

  const count = await upsertBatch('clientes', mapped);
  console.log(`  ✅ ${count} clientes importados`);
}

// ─── FORNECEDORES ───────────────────────────────────────────

async function migrarFornecedores() {
  console.log('\n🏭 Migrando fornecedores...');
  const rows = readCSV('tbl_Fornecedores.csv');
  const mapped = rows.map(r => ({
    codigo_legado: parseInt2(r.Codigo),
    nome: r.Nome_Fornecedor || 'Sem Nome',
    contato: r.Contato || null,
    endereco: r.Endereco || null,
    numero: r.Numero || null,
    bairro: r.Bairro || null,
    cidade: r.Cidade || null,
    estado: r.Estado || null,
    cep: r.CEP || null,
    telefone: r.Telefone || null,
    celular: r.Celular || null,
    email: r.Email || null,
    cnpj: r.CNPJ || null,
    cpf: r.CPF || null,
    inscricao_estadual: r.Inscricao_Estadual || null,
    identidade: r.Identidade || null,
    tipo_pessoa: r.Tipo_Pessoa || null,
    atividade: r.Atividade || null,
  }));
  const count = await upsertBatch('fornecedores', mapped);
  console.log(`  ✅ ${count} fornecedores importados`);
}

// ─── FUNCIONÁRIOS ───────────────────────────────────────────

async function migrarFuncionarios() {
  console.log('\n👩‍💼 Migrando funcionários...');
  const rows = readCSV('tbl_Funcionarios.csv');
  const mapped = rows.map(r => ({
    codigo_legado: parseInt2(r.Codigo),
    nome: r.Nome_Funcionario || 'Sem Nome',
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
    ativo: parseBool(r.Ativo),
    observacao: r.Observacao || null,
  }));
  const count = await upsertBatch('funcionarios', mapped);
  console.log(`  ✅ ${count} funcionários importados`);
}

// ─── PRODUTOS ───────────────────────────────────────────────

async function migrarProdutos() {
  console.log('\n👗 Migrando produtos...');
  const rows = readCSV('tbl_Produtos.csv');
  const mapped = rows.map(r => ({
    codigo_legado: parseInt2(r.Cod_Produto),
    grupo: r.Grupo || null,
    sub_grupo: r.Sub_Grupo || null,
    partes: r.Partes || null,
    medida: r.Medida || null,
    descricao: r.Descricao || 'Produto sem descrição',
    cod_barras: r.Cod_Barras || null,
    cod_referencia: r.Cod_Referencia || null,
    marca: r.Marca || null,
    cor: r.Cor || null,
    tamanho: r.Tamanho || null,
    fornecedor: r.Fornecedor || null,
    localizacao: r.Localizacao || null,
    aplicacao: r.Aplicacao || null,
    estoque: parseMoney(r.Estoque),
    estoque_minimo: parseInt2(r.Estoque_Minimo) || 1,
    preco_custo: parseMoney(r.Preco_Custo),
    margem_lucro: parseMoney(r.Margem_Lucro),
    preco_venda: parseMoney(r.Preco_Venda),
    permite_desconto: parseBool(r.Desconto),
    atualizado_em: parseDate(r.Atualizacao) || new Date().toISOString(),
  }));
  const count = await upsertBatch('produtos', mapped);
  console.log(`  ✅ ${count} produtos importados`);
}

// ─── VENDAS ─────────────────────────────────────────────────

async function migrarVendas() {
  console.log('\n🛍️  Migrando vendas...');

  // Buscar mapa de clientes legado→novo id
  const { data: clientesMap } = await supabase
    .from('clientes').select('id, codigo_legado');
  const cliMap = Object.fromEntries((clientesMap || []).map(c => [c.codigo_legado, c.id]));

  const rows = readCSV('tbl_Vendas.csv');
  const mapped = rows.map(r => ({
    codigo_legado: parseInt2(r.Cod_Venda),
    vendedor: r.Vendedor || null,
    data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
    cod_cliente: cliMap[parseInt2(r.Cod_Cliente)] || null,
    nome_cliente: r.Nome_Cliente || 'Cliente',
    desc_porcentagem: parseMoney(r.Desc_Porcentagem),
    desc_valor: parseMoney(r.Desc_Valor),
    valor_total: parseMoney(r.Valor_Total),
    situacao: r.Situacao || 'Venda',
    forma_pagamento: r.Forma_Pagamento || null,
    observacao: r.Observacao || null,
  }));

  const count = await upsertBatch('vendas', mapped);
  console.log(`  ✅ ${count} vendas importadas`);
}

// ─── VENDAS ITENS ────────────────────────────────────────────

async function migrarVendasItens() {
  console.log('\n📦 Migrando itens de vendas...');

  const { data: vendasMap } = await supabase.from('vendas').select('id, codigo_legado');
  const vMap = Object.fromEntries((vendasMap || []).map(v => [v.codigo_legado, v.id]));
  const { data: prodMap } = await supabase.from('produtos').select('id, codigo_legado');
  const pMap = Object.fromEntries((prodMap || []).map(p => [p.codigo_legado, p.id]));

  const rows = readCSV('tbl_VendasItens.csv');
  const mapped = rows
    .filter(r => vMap[parseInt2(r.Cod_Venda)])
    .map(r => ({
      codigo_legado: parseInt2(r.Codigo),
      cod_venda: vMap[parseInt2(r.Cod_Venda)],
      cod_produto: pMap[parseInt2(r.Cod_Produto)] || null,
      produto: r.Produto || 'Produto',
      preco_venda: parseMoney(r.Preco_Venda),
      quantidade: parseInt2(r.Quantidade) || 1,
      sub_total: parseMoney(r.Sub_Total),
      desconto_valor: parseMoney(r.Desconto_Valor),
      desconto_pct: parseMoney(r.Desconto),
    }));

  // vendas_itens não tem codigo_legado como unique, inserir diretamente
  let inserted = 0;
  for (let i = 0; i < mapped.length; i += 200) {
    const batch = mapped.slice(i, i + 200);
    const { error } = await supabase.from('vendas_itens').insert(batch);
    if (!error) inserted += batch.length;
    else console.error('  ❌', error.message);
  }
  console.log(`  ✅ ${inserted} itens de venda importados`);
}

// ─── CONTAS A RECEBER ────────────────────────────────────────

async function migrarContasReceber() {
  console.log('\n💰 Migrando contas a receber...');

  const { data: cliData } = await supabase.from('clientes').select('id, codigo_legado');
  const cliMap = Object.fromEntries((cliData || []).map(c => [c.codigo_legado, c.id]));
  const { data: vData } = await supabase.from('vendas').select('id, codigo_legado');
  const vMap = Object.fromEntries((vData || []).map(v => [v.codigo_legado, v.id]));

  const rows = readCSV('tbl_ContasAReceber.csv');
  const mapped = rows.map(r => ({
    codigo_legado: parseInt2(r.Cod_ContaReceber),
    cod_cliente: cliMap[parseInt2(r.Cod_Cliente)] || null,
    cod_venda: vMap[parseInt2(r.Cod_Venda)] || null,
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
    inadimplente: parseBool(r.Inadiplente),
  }));

  const count = await upsertBatch('contas_a_receber', mapped);
  console.log(`  ✅ ${count} contas a receber importadas`);
}

// ─── CONTAS A PAGAR ──────────────────────────────────────────

async function migrarContasPagar() {
  console.log('\n📤 Migrando contas a pagar...');
  const rows = readCSV('tbl_ContasAPagar.csv');
  const mapped = rows.map(r => ({
    codigo_legado: parseInt2(r.Cod_ContaPagar),
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
  }));
  const count = await upsertBatch('contas_a_pagar', mapped);
  console.log(`  ✅ ${count} contas a pagar importadas`);
}

// ─── COMPRAS ─────────────────────────────────────────────────

async function migrarCompras() {
  console.log('\n🛒 Migrando compras...');

  // Map cod_fornecedor (legado) → id novo
  const { data: fornMap } = await supabase.from('fornecedores').select('id, codigo_legado');
  const fMap = Object.fromEntries((fornMap || []).map(f => [f.codigo_legado, f.id]));

  const rows = readCSV('tbl_Compras.csv');
  // Filtra linhas-fantasma do Access (registros vazios que só têm o Cod_Compra preenchido)
  const validas = rows.filter(r => (r.Data && r.Data.trim() !== '') || (r.Valor_Total && r.Valor_Total.trim() !== ''));
  const puladas = rows.length - validas.length;
  if (puladas > 0) console.log(`  ⚠️  ${puladas} compras-fantasma ignoradas (Data e Valor_Total vazios)`);

  const mapped = validas.map(r => ({
    codigo_legado: parseInt2(r.Cod_Compra),
    data: parseDate(r.Data) || new Date().toISOString().split('T')[0],
    nota_numero: parseInt2(r.Nota_Numero),
    cod_fornecedor: fMap[parseInt2(r.Cod_Fornecedor)] || null,
    grupo: r.Grupo || null,
    evento: r.Evento || null,
    valor_total: parseMoney(r.Valor_Total),
    documento: r.Documento || null,
  }));

  const count = await upsertBatch('compras', mapped);
  console.log(`  ✅ ${count} compras importadas`);
}

// ─── COMPRAS ITENS ───────────────────────────────────────────

async function migrarComprasItens() {
  console.log('\n📦 Migrando itens de compras...');

  // Maps necessários: cod_compra (legado→novo), cod_produto (legado→novo)
  const { data: comprasMap } = await supabase.from('compras').select('id, codigo_legado');
  const cMap = Object.fromEntries((comprasMap || []).map(c => [c.codigo_legado, c.id]));
  const { data: prodMap } = await supabase.from('produtos').select('id, codigo_legado');
  const pMap = Object.fromEntries((prodMap || []).map(p => [p.codigo_legado, p.id]));

  const rows = readCSV('tbl_ComprasItens.csv');
  const mapped = rows
    .filter(r => cMap[parseInt2(r.Cod_Compra)])  // só itens cuja compra foi importada
    .map(r => ({
      codigo_legado: parseInt2(r.Codigo),
      cod_compra: cMap[parseInt2(r.Cod_Compra)],
      cod_produto: pMap[parseInt2(r.Cod_Produto)] || null,
      produto: r.Produto || 'Produto',
      cod_barras: r.Cod_Barras || null,
      referencia: r.Referencia || null,
      quantidade: parseInt2(r.Quantidade) || 1,
      valor_unitario: parseMoney(r.Valor_Unitario),
      sub_total: parseMoney(r.Sub_Total),
      preco_venda: parseMoney(r.Preco_Venda) || null,
      margem_valor: parseMoney(r.Margem_Valor) || null,
      margem_porcent: parseMoney(r.Margem_Porcent) || null,
      sub_grupo: r.Sub_Grupo || null,
      partes: r.Partes || null,
      tamanho: r.Tamanho || null,
      cor: r.Cor || null,
      marca: r.Marca || null,
      atualiza_estoque: parseBool(r.Atualizar),
      detalhes: r.Detalhes || null,
    }));

  // compras_itens não tem codigo_legado como unique — insere direto em batches com fallback
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < mapped.length; i += 200) {
    const batch = mapped.slice(i, i + 200);
    const { error } = await supabase.from('compras_itens').insert(batch);
    if (error) {
      // fallback row-by-row pra salvar o que dá
      let ok = 0;
      for (const row of batch) {
        const { error: e2 } = await supabase.from('compras_itens').insert(row);
        if (!e2) ok++; else failed++;
      }
      inserted += ok;
      console.log(`  🔧 batch ${i}-${i + 200}: ${ok}/${batch.length} via fallback`);
    } else {
      inserted += batch.length;
    }
  }
  if (failed > 0) console.log(`  ⚠️  ${failed} itens com dados irrecuperáveis foram pulados`);
  console.log(`  ✅ ${inserted} itens de compra importados`);
}

// ─── FLUXO DE CAIXA ──────────────────────────────────────────

async function migrarFluxoCaixa() {
  console.log('\n🏦 Migrando fluxo de caixa...');
  const rows = readCSV('tbl_FluxoCaixa.csv');
  const mapped = rows.map(r => ({
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
  }));
  const count = await upsertBatch('fluxo_caixa', mapped);
  console.log(`  ✅ ${count} registros de fluxo de caixa importados`);
}

// ─── MAIN ────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando migração de dados — Jeito de Ser');
  console.log(`📁 Lendo CSVs de: ${CSV_DIR}`);
  console.log(`🗄️  Destino: ${SUPABASE_URL}\n`);

  const start = Date.now();

  await migrarEmpresa();
  await migrarFornecedores();
  await migrarFuncionarios();
  await migrarClientes();
  await migrarProdutos();
  await migrarVendas();
  await migrarVendasItens();
  await migrarContasReceber();
  await migrarContasPagar();
  await migrarFluxoCaixa();
  await migrarCompras();
  await migrarComprasItens();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Migração concluída em ${elapsed}s`);
  console.log('📊 Acesse o Supabase para verificar os dados.');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
