// src/app/api/compras/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params

  const { data: compra, error } = await supabase
    .from('compras')
    .select('*, fornecedores(id, nome), compras_itens(*)')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 404 })

  return NextResponse.json(compra)
}

// DELETE — reverte estoque, deleta itens (cascade), deleta compra
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params

  // Pega itens pra reverter estoque
  const { data: itens } = await supabase
    .from('compras_itens').select('cod_produto, quantidade, atualiza_estoque').eq('cod_compra', id)

  // Reverte estoque (subtrai a quantidade que tinha sido adicionada)
  for (const item of itens || []) {
    if (!item.cod_produto || item.atualiza_estoque === false) continue
    const { data: prod } = await supabase
      .from('produtos').select('estoque').eq('id', item.cod_produto).single()
    if (!prod) continue
    const novo = Math.max(0, (Number(prod.estoque) || 0) - Number(item.quantidade))
    await supabase.from('produtos').update({ estoque: novo }).eq('id', item.cod_produto)
  }

  // Deleta compra (itens caem por cascade)
  const { error } = await supabase.from('compras').delete().eq('id', id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
