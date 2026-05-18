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

// PATCH — atualiza dados da compra (data, fornecedor, nota, grupo, evento, documento)
// Não toca em itens (esses têm endpoint próprio em /api/compras/itens/[id])
// Recalcula valor_total baseado nos itens atuais.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params
  const body = await req.json()

  const updates: any = {}
  for (const k of ['data', 'nota_numero', 'cod_fornecedor', 'grupo', 'evento', 'documento']) {
    if (k in body) updates[k] = body[k] === '' ? null : body[k]
  }

  // Recalcula valor_total se solicitado (ou sempre)
  if (body.recalcular_total !== false) {
    const { data: itens } = await supabase
      .from('compras_itens').select('quantidade, valor_unitario').eq('cod_compra', id)
    updates.valor_total = (itens || []).reduce((s: number, i: any) => s + Number(i.quantidade) * Number(i.valor_unitario), 0)
  }

  const { data, error } = await supabase
    .from('compras').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
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
