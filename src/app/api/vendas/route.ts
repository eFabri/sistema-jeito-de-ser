// src/app/api/vendas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '50')
  const q      = searchParams.get('q') || ''
  const ini    = searchParams.get('ini') || ''
  const fim    = searchParams.get('fim') || ''
  const tipo   = searchParams.get('tipo') || ''
  const offset = (pagina - 1) * limite

  // Condicionais: tabela separada
  if (tipo === 'condicional') {
    let cq = supabase
      .from('vendas_condicionais')
      .select('id, nome_cliente, vendedor, status, created_at, data_retorno_prevista', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limite - 1)

    if (q)   cq = cq.ilike('nome_cliente', `%${q}%`)
    if (ini) cq = cq.gte('created_at', ini)
    if (fim) cq = cq.lte('created_at', fim + 'T23:59:59')

    const { data: conds, count, error } = await cq
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    const vendas = (conds || []).map((c: any) => ({
      id:            c.id,
      codigo_legado: null,
      nome_cliente:  c.nome_cliente,
      vendedor:      c.vendedor,
      data:          c.created_at?.split('T')[0] ?? '',
      forma_pagamento: 'Condicional',
      valor_total:   null,
      situacao:      'Condicional',
      origem:        'condicional',
      cond_status:   c.status,
      cond_id:       c.id,
    }))

    return NextResponse.json({ vendas, total: count, pagina, limite })
  }

  let query = supabase
    .from('vendas')
    .select('id, codigo_legado, vendedor, data, nome_cliente, valor_total, situacao, forma_pagamento, created_at', { count: 'exact' })
    .order('id', { ascending: false })
    .range(offset, offset + limite - 1)

  if (q)   query = query.ilike('nome_cliente', `%${q}%`)
  if (ini) query = query.gte('data', ini)
  if (fim) query = query.lte('data', fim)

  if (tipo === 'cancelada') {
    query = query.eq('situacao', 'Cancelada')
  } else if (tipo === 'direta') {
    query = query.eq('situacao', 'Venda Direta').neq('situacao', 'Cancelada')
  } else if (tipo === 'crediario') {
    query = query.ilike('forma_pagamento', '%Crediário%').neq('situacao', 'Cancelada')
  } else if (tipo === 'venda') {
    query = query.eq('situacao', 'Venda').not('forma_pagamento', 'ilike', '%Crediário%')
  }
  // tipo='' → all, no extra filter

  const { data: vendas, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const mapped = (vendas || []).map((v: any) => ({ ...v, origem: 'venda' }))
  return NextResponse.json({ vendas: mapped, total: count, pagina, limite })
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
    data: dataCustom,
    codigo_legado,
    abatimento_credito_troca,
  } = body

  // 1. Criar venda
  const dataVenda = dataCustom || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

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
      data: dataVenda,
      ...(codigo_legado ? { codigo_legado } : {}),
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
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const { error: errPgto } = await supabase.from('vendas_pagamento').insert(
      pagamentos.map((p: any) => ({
        ...p,
        cod_venda: venda.id,
        data: p.data ?? hoje,  // preserva data customizada (ex: entrada futura)
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
      data_lancamento: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
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

  // 6. Debitar crédito de troca (double-spend check no momento da confirmação)
  if (abatimento_credito_troca > 0 && cod_cliente) {
    const { data: cli } = await supabase
      .from('clientes').select('credito_troca').eq('id', cod_cliente).single()
    const saldoAtual = Number(cli?.credito_troca || 0)
    const valorDebito = Math.min(abatimento_credito_troca, saldoAtual)
    if (valorDebito > 0) {
      await Promise.all([
        supabase.from('clientes')
          .update({ credito_troca: Math.max(0, saldoAtual - valorDebito) })
          .eq('id', cod_cliente),
        supabase.from('creditos_clientes').insert({
          cod_cliente,
          tipo: 'uso_troca',
          valor: valorDebito,
          descricao: `Crédito de troca utilizado na venda #${venda.codigo_legado || venda.id}`,
        }),
      ])
    }
  }

  return NextResponse.json(venda, { status: 201 })
}
