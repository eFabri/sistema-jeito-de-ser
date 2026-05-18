// src/app/api/trocas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '25')
  const offset = (pagina - 1) * limite

  const { data, count, error } = await supabase
    .from('vendas_trocas')
    .select('id, data, nome_cliente, vendedor, valor_original, valor_troca, diferenca, status, cod_venda_orig', { count: 'exact' })
    .order('data', { ascending: false })
    .range(offset, offset + limite - 1)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ trocas: data || [], total: count, pagina, limite })
}

// POST /api/trocas
// body: {
//   cod_venda_orig?, cod_cliente?, nome_cliente, vendedor?, observacao?,
//   devolvidos: [{ cod_produto?, produto, quantidade, valor }],
//   novos:      [{ cod_produto?, produto, quantidade, valor }]
// }
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const {
    cod_venda_orig, cod_cliente, nome_cliente, vendedor, observacao,
    devolvidos = [], novos = [],
  } = body

  if (!nome_cliente) return NextResponse.json({ erro: 'nome_cliente obrigatório' }, { status: 400 })
  if (devolvidos.length === 0 && novos.length === 0) {
    return NextResponse.json({ erro: 'inclua ao menos um item devolvido ou novo' }, { status: 400 })
  }

  const valor_original = devolvidos.reduce((s: number, i: any) => s + (i.quantidade * i.valor), 0)
  const valor_troca    = novos.reduce((s: number, i: any) => s + (i.quantidade * i.valor), 0)
  const diferenca      = valor_troca - valor_original
  // diferenca > 0: cliente paga mais; < 0: cliente tem crédito; = 0: troca neutra

  // 1. Cria troca
  const { data: troca, error: errT } = await supabase.from('vendas_trocas').insert({
    cod_venda_orig: cod_venda_orig || null,
    cod_cliente: cod_cliente || null,
    nome_cliente, vendedor, observacao,
    valor_original, valor_troca, diferenca,
    status: 'Concluída',
  }).select().single()
  if (errT) return NextResponse.json({ erro: errT.message }, { status: 500 })

  // 2. Insere itens: devolvidos com valor negativo (convenção), novos com valor positivo
  const itensInsert = [
    ...devolvidos.map((i: any) => ({
      cod_troca: troca.id, cod_produto: i.cod_produto || null,
      produto: i.produto, quantidade: i.quantidade, valor: -Math.abs(Number(i.valor)),
    })),
    ...novos.map((i: any) => ({
      cod_troca: troca.id, cod_produto: i.cod_produto || null,
      produto: i.produto, quantidade: i.quantidade, valor: Math.abs(Number(i.valor)),
    })),
  ]
  if (itensInsert.length > 0) {
    const { error: errI } = await supabase.from('vendas_trocas_itens').insert(itensInsert)
    if (errI) {
      await supabase.from('vendas_trocas').delete().eq('id', troca.id)
      return NextResponse.json({ erro: errI.message }, { status: 500 })
    }
  }

  // 3. Ajusta estoque
  // Devolvidos: estoque + quantidade. Novos: estoque - quantidade.
  for (const item of devolvidos) {
    if (!item.cod_produto) continue
    const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.cod_produto).single()
    if (!prod) continue
    await supabase.from('produtos')
      .update({ estoque: (Number(prod.estoque) || 0) + Number(item.quantidade), atualizado_em: new Date().toISOString() })
      .eq('id', item.cod_produto)
  }
  for (const item of novos) {
    if (!item.cod_produto) continue
    const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.cod_produto).single()
    if (!prod) continue
    await supabase.from('produtos')
      .update({ estoque: Math.max(0, (Number(prod.estoque) || 0) - Number(item.quantidade)), atualizado_em: new Date().toISOString() })
      .eq('id', item.cod_produto)
  }

  // 4. Financeiro
  // Se diferenca > 0: cliente paga a mais → conta_a_receber
  // Se diferenca < 0: cliente tem crédito → registra crédito como conta_a_pagar (loja deve ao cliente)
  if (diferenca > 0 && cod_cliente) {
    const hoje = new Date().toISOString().split('T')[0]
    await supabase.from('contas_a_receber').insert({
      cod_cliente, parcela: '1/1', valor: diferenca,
      data_vencimento: hoje, pago: false,
      observacao: `Diferença troca #${troca.id}`,
    })
  } else if (diferenca < 0 && cod_cliente) {
    await supabase.from('contas_a_pagar').insert({
      documento: `Crédito troca #${troca.id} - ${nome_cliente}`,
      parcela: '1/1', valor: Math.abs(diferenca),
      data_vencimento: new Date().toISOString().split('T')[0], pago: false,
    })
  }

  return NextResponse.json({ ...troca, valor_original, valor_troca, diferenca }, { status: 201 })
}
