// src/app/api/produtos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.from('produtos').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ erro: 'Produto não encontrado' }, { status: 404 })

  // Histórico de vendas desse produto
  const { data: vendas } = await supabase
    .from('vendas_itens')
    .select('quantidade, sub_total, preco_venda, vendas!cod_venda(data, nome_cliente)')
    .eq('cod_produto', params.id)
    .order('codigo_legado', { ascending: false })
    .limit(20)

  // Histórico de compras
  const { data: compras } = await supabase
    .from('compras_itens')
    .select('quantidade, valor_unitario, sub_total, compras!cod_compra(data)')
    .eq('cod_produto', params.id)
    .order('codigo_legado', { ascending: false })
    .limit(10)

  return NextResponse.json({ produto: data, vendas: vendas || [], compras: compras || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const { data, error } = await supabase
    .from('produtos').update({ ...body, atualizado_em: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', params.id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
