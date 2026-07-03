// src/app/api/compras/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// ── EAN-13 helpers ──
function calcCheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10)
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

function buildEAN13(seq: number): string {
  const body = '789' + String(seq).padStart(9, '0')
  return body + calcCheckDigit(body)
}

// ── GET — list purchases with aggregate item data ──
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '25')
  const q = searchParams.get('q') || ''
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('compras')
    .select('id, data, nota_numero, grupo, evento, valor_total, forma_pagamento, status, created_at, fornecedores(nome)', { count: 'exact' })
    .order('id', { ascending: false })
    .range(offset, offset + limite - 1)

  if (q) {
    const n = parseInt(q)
    if (!isNaN(n)) query = query.eq('nota_numero', n)
    else query = query.ilike('grupo', `%${q}%`)
  }

  const { data: compras, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Aggregate data from compras_itens
  const ids = (compras || []).map((c: any) => c.id)
  const aggMap = new Map<number, { qtd: number; venda_total: number; custo_total: number }>()
  if (ids.length > 0) {
    const { data: itens } = await supabase
      .from('compras_itens')
      .select('cod_compra, quantidade, preco_venda, sub_total')
      .in('cod_compra', ids)
    for (const it of itens || []) {
      const cur = aggMap.get(it.cod_compra) || { qtd: 0, venda_total: 0, custo_total: 0 }
      cur.qtd += Number(it.quantidade || 0)
      cur.venda_total += Number(it.preco_venda || 0) * Number(it.quantidade || 0)
      cur.custo_total += Number(it.sub_total || 0)
      aggMap.set(it.cod_compra, cur)
    }
  }

  const resultado = (compras || []).map((c: any) => ({
    ...c,
    fornecedor_nome: (c.fornecedores as any)?.nome || null,
    qtd_pecas: aggMap.get(c.id)?.qtd || 0,
    valor_venda_total: aggMap.get(c.id)?.venda_total || 0,
    ganho_previsto: (aggMap.get(c.id)?.venda_total || 0) - (aggMap.get(c.id)?.custo_total || 0),
  }))

  return NextResponse.json({ compras: resultado, total: count, pagina, limite })
}

// ── POST — create purchase, upsert products, assign barcodes ──
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()

  const { cabecalho, itens } = body as {
    cabecalho: {
      fornecedor_id: number | null
      fornecedor_nome: string
      data: string
      nota_numero: string
      grupo: string
      evento: string
      forma_pagamento: string
    }
    itens: Array<{
      cod_barras: string
      sub_grupo: string
      marca: string
      produto: string
      partes: string
      tamanho: string
      cor: string
      quantidade: number
      preco_custo: number
      preco_venda: number
      ganho_rs: number
      ganho_pct: number
    }>
  }

  if (!itens || itens.length === 0)
    return NextResponse.json({ erro: 'Nenhum item informado' }, { status: 400 })

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  // Get current max EAN-13 sequence
  const { data: lastBarcode } = await supabase
    .from('produtos')
    .select('cod_barras')
    .like('cod_barras', '789%')
    .order('cod_barras', { ascending: false })
    .limit(1)

  let seq = 1
  if (lastBarcode && lastBarcode.length > 0) {
    const last = lastBarcode[0].cod_barras
    if (typeof last === 'string' && last.length === 13) {
      const num = parseInt(last.substring(3, 12), 10)
      if (!isNaN(num)) seq = num + 1
    }
  }

  // Process each item: assign barcode, find-or-create product
  let produtos_criados = 0
  let produtos_atualizados = 0

  interface ItemProcessado {
    cod_produto: number
    cod_barras: string
    produto: string
    sub_grupo: string
    marca: string
    partes: string
    tamanho: string
    cor: string
    quantidade: number
    valor_unitario: number
    sub_total: number
    preco_venda: number
    margem_valor: number
    margem_porcent: number
  }

  const itensProcessados: ItemProcessado[] = []

  for (const item of itens) {
    let cod_barras = (item.cod_barras || '').trim()
    if (!cod_barras) {
      cod_barras = buildEAN13(seq++)
    }

    // Find existing product: by barcode first, then by descricao+cor+tamanho
    let produtoId: number | null = null
    let estoqueAtual = 0

    if (cod_barras) {
      const { data: byBarcode } = await supabase
        .from('produtos')
        .select('id, estoque')
        .eq('cod_barras', cod_barras)
        .maybeSingle()
      if (byBarcode) {
        produtoId = byBarcode.id
        estoqueAtual = Number(byBarcode.estoque || 0)
      }
    }

    if (!produtoId && item.produto && item.tamanho && item.cor) {
      const { data: byDesc } = await supabase
        .from('produtos')
        .select('id, estoque')
        .ilike('descricao', item.produto)
        .eq('tamanho', item.tamanho)
        .eq('cor', item.cor)
        .maybeSingle()
      if (byDesc) {
        produtoId = byDesc.id
        estoqueAtual = Number(byDesc.estoque || 0)
      }
    }

    if (produtoId) {
      // Update existing product
      await supabase
        .from('produtos')
        .update({
          preco_custo: item.preco_custo,
          preco_venda: item.preco_venda,
          margem_lucro: item.ganho_pct,
          estoque: estoqueAtual + item.quantidade,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', produtoId)
      produtos_atualizados++
    } else {
      // Create new product
      const { data: novoProd, error: errProd } = await supabase
        .from('produtos')
        .insert({
          descricao: item.produto,
          sub_grupo: item.sub_grupo || null,
          marca: item.marca || null,
          partes: item.partes || null,
          tamanho: item.tamanho || null,
          cor: item.cor || null,
          cod_barras,
          preco_custo: item.preco_custo,
          preco_venda: item.preco_venda,
          margem_lucro: item.ganho_pct,
          estoque: item.quantidade,
          grupo: cabecalho.grupo || null,
          fornecedor: cabecalho.fornecedor_nome || null,
          ativo: true,
        })
        .select('id')
        .single()

      if (errProd)
        return NextResponse.json({ erro: `Erro ao criar produto "${item.produto}": ${errProd.message}` }, { status: 500 })

      produtoId = novoProd.id
      produtos_criados++
    }

    itensProcessados.push({
      cod_produto: produtoId!,
      cod_barras,
      produto: item.produto,
      sub_grupo: item.sub_grupo,
      marca: item.marca,
      partes: item.partes,
      tamanho: item.tamanho,
      cor: item.cor,
      quantidade: item.quantidade,
      valor_unitario: item.preco_custo,
      sub_total: item.quantidade * item.preco_custo,
      preco_venda: item.preco_venda,
      margem_valor: item.ganho_rs,
      margem_porcent: item.ganho_pct,
    })
  }

  // Compute totals
  const valor_total = itensProcessados.reduce((s, i) => s + i.sub_total, 0)
  const valor_venda_total = itensProcessados.reduce((s, i) => s + i.preco_venda * i.quantidade, 0)
  const ganho_total = valor_venda_total - valor_total
  const total_pecas = itensProcessados.reduce((s, i) => s + i.quantidade, 0)

  // Create compra record
  const { data: compra, error: errCompra } = await supabase
    .from('compras')
    .insert({
      data: cabecalho.data || hoje,
      nota_numero: cabecalho.nota_numero ? parseInt(cabecalho.nota_numero) : null,
      cod_fornecedor: cabecalho.fornecedor_id || null,
      grupo: cabecalho.grupo || null,
      evento: cabecalho.evento || null,
      valor_total,
      forma_pagamento: cabecalho.forma_pagamento || null,
      status: 'Finalizada',
    })
    .select()
    .single()

  if (errCompra) return NextResponse.json({ erro: errCompra.message }, { status: 500 })

  // Insert compras_itens
  const { error: errItens } = await supabase
    .from('compras_itens')
    .insert(itensProcessados.map(i => ({ ...i, cod_compra: compra.id })))
  if (errItens) console.error('Erro compras_itens:', errItens.message)

  // Create contas_a_pagar if payment method requires it (not PIX or Dinheiro)
  // Schema columns: cod_compra, valor, data (lancamento), data_vencimento, historico, forma_pgto, pago
  const fpag = cabecalho.forma_pagamento
  if (fpag && fpag !== 'PIX' && fpag !== 'Dinheiro') {
    const dataBase = cabecalho.data || hoje
    let vencimento = dataBase
    if (fpag === 'Boleto' || fpag === 'Duplicata') {
      const d = new Date(dataBase + 'T12:00:00')
      d.setDate(d.getDate() + 30)
      vencimento = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    }
    const { error: errCp } = await supabase
      .from('contas_a_pagar')
      .insert({
        cod_compra: compra.id,
        valor: valor_total,
        data: dataBase,
        data_vencimento: vencimento,
        historico: `Compra #${compra.id}${cabecalho.nota_numero ? ` — NF ${cabecalho.nota_numero}` : ''}`,
        forma_pgto: fpag,
        pago: false,
      })
    if (errCp) console.error('Erro contas_a_pagar:', errCp.message)
  }

  return NextResponse.json({
    id: compra.id,
    total_pecas,
    valor_total,
    valor_venda_total,
    ganho_total,
    produtos_criados,
    produtos_atualizados,
    itens: itensProcessados.map(i => ({
      produto: i.produto,
      cod_barras: i.cod_barras,
      quantidade: i.quantidade,
      preco_custo: i.valor_unitario,
      preco_venda: i.preco_venda,
    })),
  }, { status: 201 })
}
