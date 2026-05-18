// src/app/api/vendas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '25')
  const q      = searchParams.get('q') || ''
  const data   = searchParams.get('data') || ''
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('vendas')
    .select('id, codigo_legado, vendedor, data, nome_cliente, valor_total, situacao, forma_pagamento, created_at', { count: 'exact' })
    .order('id', { ascending: false })
    .range(offset, offset + limite - 1)

  if (q) query = query.ilike('nome_cliente', `%${q}%`)
  if (data) query = query.eq('data', data)

  const { data: vendas, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ vendas, total: count, pagina, limite })
}

// POST /api/vendas — registrar nova venda completa
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()

  const {
    vendedor,
    cod_cliente,
    nome_cliente,
    itens,           // [{ cod_produto, produto, preco_venda, quantidade, sub_total, desconto_valor, desconto_pct }]
    pagamentos,      // [{ forma, operadora, conta, valor, parcela, conta_a_receber }]
    crediario,       // [{ parcela, data_vencimento, valor }] — se forma crediário
    desc_porcentagem,
    desc_valor,
    valor_total,
    situacao,
    observacao,
  } = body

  // 1. Criar venda
  const { data: venda, error: errVenda } = await supabase
    .from('vendas')
    .insert({
      vendedor,
      cod_cliente: cod_cliente || null,
      nome_cliente: nome_cliente || 'Cliente',
      desc_porcentagem: desc_porcentagem || 0,
      desc_valor: desc_valor || 0,
      valor_total,
      situacao: situacao || 'Venda',
      forma_pagamento: pagamentos?.map((p: any) => p.forma).join(', ') || '',
      observacao: observacao || null,
      data: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (errVenda) return NextResponse.json({ erro: errVenda.message }, { status: 500 })

  // 2. Itens
  if (itens?.length) {
    const { error: errItens } = await supabase.from('vendas_itens').insert(
      itens.map((i: any) => ({ ...i, cod_venda: venda.id }))
    )
    if (errItens) console.error('Erro itens:', errItens.message)
  }

  // 3. Pagamentos
  if (pagamentos?.length) {
    const { error: errPgto } = await supabase.from('vendas_pagamento').insert(
      pagamentos.map((p: any) => ({
        ...p,
        cod_venda: venda.id,
        data: new Date().toISOString().split('T')[0],
      }))
    )
    if (errPgto) console.error('Erro pagamentos:', errPgto.message)
  }

  // 4. Contas a receber (crediário)
  if (crediario?.length && cod_cliente) {
    const parcelas = crediario.map((c: any, idx: number) => ({
      cod_cliente,
      cod_venda: venda.id,
      parcela: c.parcela || `${idx + 1}/${crediario.length}`,
      data_lancamento: new Date().toISOString().split('T')[0],
      data_vencimento: c.data_vencimento,
      valor: c.valor,
      historico: `Venda #${venda.id}`,
      status: 'Em aberto',
      pago: false,
      inadimplente: false,
    }))
    const { error: errCar } = await supabase.from('contas_a_receber').insert(parcelas)
    if (errCar) console.error('Erro crediário:', errCar.message)
  }

  // 5. Atualizar estoque
  for (const item of itens || []) {
    if (item.cod_produto) {
      try {
        await supabase.rpc('decrementar_estoque', {
          p_id: item.cod_produto,
          p_qtd: item.quantidade,
        })
      } catch {}
      // Fallback manual
      const { data: prod } = await supabase
        .from('produtos').select('estoque').eq('id', item.cod_produto).single()
      if (prod) {
        await supabase.from('produtos')
          .update({ estoque: Math.max(0, (prod.estoque || 0) - item.quantidade) })
          .eq('id', item.cod_produto)
      }
    }
  }

  return NextResponse.json(venda, { status: 201 })
}
