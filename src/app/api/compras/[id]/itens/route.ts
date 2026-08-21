// src/app/api/compras/[id]/itens/route.ts
// POST: adiciona um novo item à compra existente, incrementa estoque do produto
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id: codCompra } = await params
  const body = await req.json()

  const item = {
    cod_compra: parseInt(codCompra),
    cod_produto: body.cod_produto || null,
    produto: body.produto || 'Produto',
    cod_barras: body.cod_barras || null,
    referencia: body.referencia || null,
    quantidade: Number(body.quantidade) || 1,
    valor_unitario: Number(body.valor_unitario) || 0,
    sub_total: (Number(body.quantidade) || 1) * (Number(body.valor_unitario) || 0),
    preco_venda: body.preco_venda || null,
    atualiza_estoque: body.atualiza_estoque !== false,
    atualiza_preco: !!body.atualiza_preco,
    sub_grupo: body.sub_grupo || null,
    partes: body.partes || null,
    tamanho: body.tamanho || null,
    cor: body.cor || null,
    marca: body.marca || null,
  }

  const { data: novoItem, error } = await supabase
    .from('compras_itens').insert(item).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Atualiza estoque (incrementa) e opcionalmente preço de venda
  if (item.cod_produto && (item.atualiza_estoque || (item.atualiza_preco && item.preco_venda))) {
    const { data: prod } = await supabase
      .from('produtos').select('estoque').eq('id', item.cod_produto).single()
    if (prod) {
      const updates: any = { atualizado_em: new Date().toISOString() }
      if (item.atualiza_estoque) updates.estoque = (Number(prod.estoque) || 0) + item.quantidade
      if (item.atualiza_preco && item.preco_venda) {
        updates.preco_venda = item.preco_venda
        updates.preco_custo = item.valor_unitario
      }
      await supabase.from('produtos').update(updates).eq('id', item.cod_produto)
    }
  }

  // Recalcula total da compra
  const { data: todosItens } = await supabase
    .from('compras_itens').select('sub_total').eq('cod_compra', codCompra)
  const novoTotal = (todosItens || []).reduce((s: number, i: any) => s + Number(i.sub_total), 0)
  await supabase.from('compras').update({ valor_total: novoTotal }).eq('id', codCompra)

  return NextResponse.json(novoItem, { status: 201 })
}
