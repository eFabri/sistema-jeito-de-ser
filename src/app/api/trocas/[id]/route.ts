// src/app/api/trocas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params

  const { data, error } = await supabase
    .from('vendas_trocas')
    .select('*, vendas_trocas_itens(*), clientes(nome, celular)')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE: reverte estoque (subtrai devolvidos, soma novos de volta)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params

  const { data: itens } = await supabase
    .from('vendas_trocas_itens').select('cod_produto, quantidade, valor').eq('cod_troca', id)

  for (const it of itens || []) {
    if (!it.cod_produto) continue
    const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', it.cod_produto).single()
    if (!prod) continue
    // Se foi devolvido (valor < 0), tira do estoque (estamos desfazendo a devolução)
    // Se foi novo (valor > 0), devolve ao estoque
    const delta = Number(it.valor) < 0
      ? -Number(it.quantidade)  // estoque -= qtd (desfaz devolução)
      :  Number(it.quantidade)  // estoque += qtd (desfaz saída)
    const novo = Math.max(0, (Number(prod.estoque) || 0) + delta)
    await supabase.from('produtos').update({ estoque: novo }).eq('id', it.cod_produto)
  }

  const { error } = await supabase.from('vendas_trocas').delete().eq('id', id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
