// src/app/api/compras/itens/[itemId]/route.ts
// PATCH: atualiza um item (ajusta estoque pela diferença de quantidade)
// DELETE: remove item (reverte estoque)
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const supabase = await createServerSupabase()
  const { itemId } = await params
  const body = await req.json()

  // 1. Pega o item atual
  const { data: atual, error: errA } = await supabase
    .from('compras_itens').select('*').eq('id', itemId).single()
  if (errA || !atual) return NextResponse.json({ erro: 'item não encontrado' }, { status: 404 })

  // 2. Monta updates
  const updates: any = {}
  for (const k of ['produto', 'cod_barras', 'referencia', 'preco_venda', 'tamanho', 'cor', 'marca', 'detalhes', 'atualiza_estoque', 'atualiza_preco']) {
    if (k in body) updates[k] = body[k]
  }
  if ('quantidade' in body) updates.quantidade = Number(body.quantidade) || 1
  if ('valor_unitario' in body) updates.valor_unitario = Number(body.valor_unitario) || 0
  // recalcula subtotal se mudou qtd ou valor
  const qtdNova = updates.quantidade !== undefined ? updates.quantidade : Number(atual.quantidade)
  const valorNovo = updates.valor_unitario !== undefined ? updates.valor_unitario : Number(atual.valor_unitario)
  updates.sub_total = qtdNova * valorNovo

  // 3. Aplica
  const { data: novo, error: errU } = await supabase
    .from('compras_itens').update(updates).eq('id', itemId).select().single()
  if (errU) return NextResponse.json({ erro: errU.message }, { status: 500 })

  // 4. Ajusta estoque pela DIFERENÇA de quantidade (se item já contava no estoque)
  if (atual.cod_produto && atual.atualiza_estoque) {
    const diff = qtdNova - Number(atual.quantidade)
    if (diff !== 0) {
      const { data: prod } = await supabase
        .from('produtos').select('estoque').eq('id', atual.cod_produto).single()
      if (prod) {
        const novoEstoque = Math.max(0, (Number(prod.estoque) || 0) + diff)
        await supabase.from('produtos').update({ estoque: novoEstoque, atualizado_em: new Date().toISOString() }).eq('id', atual.cod_produto)
      }
    }
  }

  // 5. Recalcula total da compra
  const { data: todosItens } = await supabase
    .from('compras_itens').select('sub_total').eq('cod_compra', atual.cod_compra)
  const novoTotal = (todosItens || []).reduce((s: number, i: any) => s + Number(i.sub_total), 0)
  await supabase.from('compras').update({ valor_total: novoTotal }).eq('id', atual.cod_compra)

  return NextResponse.json(novo)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const supabase = await createServerSupabase()
  const { itemId } = await params

  const { data: atual } = await supabase
    .from('compras_itens').select('cod_compra, cod_produto, quantidade, atualiza_estoque').eq('id', itemId).single()
  if (!atual) return NextResponse.json({ erro: 'item não encontrado' }, { status: 404 })

  // Reverte estoque
  if (atual.cod_produto && atual.atualiza_estoque) {
    const { data: prod } = await supabase
      .from('produtos').select('estoque').eq('id', atual.cod_produto).single()
    if (prod) {
      const novoEstoque = Math.max(0, (Number(prod.estoque) || 0) - Number(atual.quantidade))
      await supabase.from('produtos').update({ estoque: novoEstoque }).eq('id', atual.cod_produto)
    }
  }

  const { error } = await supabase.from('compras_itens').delete().eq('id', itemId)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Recalcula total da compra
  const { data: todosItens } = await supabase
    .from('compras_itens').select('sub_total').eq('cod_compra', atual.cod_compra)
  const novoTotal = (todosItens || []).reduce((s: number, i: any) => s + Number(i.sub_total), 0)
  await supabase.from('compras').update({ valor_total: novoTotal }).eq('id', atual.cod_compra)

  return NextResponse.json({ ok: true })
}
