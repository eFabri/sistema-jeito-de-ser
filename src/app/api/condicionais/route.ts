import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(request.url)

  if (searchParams.get('badge') === '1') {
    const { count } = await supabase
      .from('vendas_condicionais')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'aberta')
    return NextResponse.json({ badge: count ?? 0 })
  }

  const status = searchParams.get('status') || ''
  let query = supabase
    .from('vendas_condicionais')
    .select('*, vendas_condicionais_itens(*)')
    .order('created_at', { ascending: false })

  if (status) query = (query as any).eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ condicionais: data })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const body = await request.json()
  const { cod_cliente, nome_cliente, vendedor, itens, observacao, data_retorno_prevista } = body

  if (!nome_cliente || !itens?.length) {
    return NextResponse.json({ erro: 'Dados incompletos' }, { status: 400 })
  }

  const retorno = data_retorno_prevista || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: cond, error: errCond } = await supabase
    .from('vendas_condicionais')
    .insert({
      cod_cliente: cod_cliente ?? null,
      nome_cliente,
      vendedor: vendedor ?? null,
      data_retorno_prevista: retorno,
      observacao: observacao ?? null,
      status: 'aberta',
    })
    .select()
    .single()

  if (errCond || !cond) {
    return NextResponse.json({ erro: errCond?.message ?? 'Erro ao criar condicional' }, { status: 500 })
  }

  const { error: errItens } = await supabase
    .from('vendas_condicionais_itens')
    .insert(
      itens.map((i: any) => ({
        cod_condicional: cond.id,
        cod_produto: i.cod_produto ?? null,
        produto: i.produto,
        preco_venda: i.preco_venda,
        quantidade: i.quantidade,
        status: 'pendente',
      }))
    )

  if (errItens) {
    await supabase.from('vendas_condicionais').delete().eq('id', cond.id)
    return NextResponse.json({ erro: errItens.message }, { status: 500 })
  }

  return NextResponse.json(cond, { status: 201 })
}
