import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from('vendas_condicionais')
    .select('*, vendas_condicionais_itens(*)')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase()
  const body = await request.json()

  // Atualiza status de cada item
  if (body.itens?.length) {
    for (const item of body.itens) {
      await supabase
        .from('vendas_condicionais_itens')
        .update({ status: item.status })
        .eq('id', item.id)
    }
  }

  if (!body.confirmar) {
    if (body.status) {
      await supabase.from('vendas_condicionais').update({ status: body.status }).eq('id', params.id)
    }
    return NextResponse.json({ ok: true })
  }

  // Confirmar: busca itens e cria venda para os que ficaram
  const { data: cond } = await supabase
    .from('vendas_condicionais')
    .select('*, vendas_condicionais_itens(*)')
    .eq('id', params.id)
    .single()

  if (!cond) return NextResponse.json({ erro: 'Condicional não encontrada' }, { status: 404 })

  const itensConfirmados = ((cond as any).vendas_condicionais_itens as any[]).filter(i => i.status === 'ficou')
  const descValor = Number(body.desc_valor || 0)
  const itensExtras: any[] = body.itens_extras || []

  // Tudo devolvido
  if (itensConfirmados.length === 0 && itensExtras.length === 0) {
    await supabase.from('vendas_condicionais').update({ status: 'devolvida' }).eq('id', params.id)
    return NextResponse.json({ ok: true, status: 'devolvida' })
  }

  const totalBase = itensConfirmados.reduce((s: number, i: any) => s + Number(i.preco_venda) * i.quantidade, 0)
  const totalExtras = itensExtras.reduce((s: number, i: any) => s + Number(i.preco_venda) * i.quantidade, 0)
  const total = Math.max(0, totalBase + totalExtras - descValor)
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const { data: venda, error: errVenda } = await supabase
    .from('vendas')
    .insert({
      cod_cliente: (cond as any).cod_cliente ?? null,
      nome_cliente: (cond as any).nome_cliente,
      vendedor: (cond as any).vendedor ?? null,
      valor_total: total,
      desc_valor: descValor,
      desc_porcentagem: 0,
      situacao: 'Venda',
      forma_pagamento: 'A Definir',
      observacao: `Condicional #${params.id}`,
      data: hoje,
    })
    .select()
    .single()

  if (errVenda || !venda) {
    return NextResponse.json({ erro: errVenda?.message ?? 'Erro ao criar venda' }, { status: 500 })
  }

  // Inserir itens da condicional
  if (itensConfirmados.length > 0) {
    await supabase.from('vendas_itens').insert(
      itensConfirmados.map((i: any) => ({
        cod_venda: (venda as any).id,
        cod_produto: i.cod_produto ?? null,
        produto: i.produto,
        preco_venda: i.preco_venda,
        quantidade: i.quantidade,
        sub_total: Number(i.preco_venda) * i.quantidade,
        desconto_valor: 0,
        desconto_pct: 0,
      }))
    )
  }

  // Inserir itens extras
  if (itensExtras.length > 0) {
    await supabase.from('vendas_itens').insert(
      itensExtras.map((i: any) => ({
        cod_venda: (venda as any).id,
        cod_produto: i.cod_produto ?? null,
        produto: i.produto,
        preco_venda: i.preco_venda,
        quantidade: i.quantidade,
        sub_total: Number(i.preco_venda) * i.quantidade,
        desconto_valor: 0,
        desconto_pct: 0,
      }))
    )
  }

  // Decrementar estoque — itens da condicional
  for (const item of itensConfirmados) {
    if (item.cod_produto) {
      try {
        await supabase.rpc('decrementar_estoque', { p_id: item.cod_produto, p_qtd: item.quantidade })
      } catch {}
      const { data: prod } = await supabase
        .from('produtos').select('estoque').eq('id', item.cod_produto).single()
      if (prod) {
        await supabase.from('produtos')
          .update({ estoque: Math.max(0, ((prod as any).estoque ?? 0) - item.quantidade) })
          .eq('id', item.cod_produto)
      }
    }
  }

  // Decrementar estoque — itens extras
  for (const item of itensExtras) {
    if (item.cod_produto) {
      try {
        await supabase.rpc('decrementar_estoque', { p_id: item.cod_produto, p_qtd: item.quantidade })
      } catch {}
      const { data: prod } = await supabase
        .from('produtos').select('estoque').eq('id', item.cod_produto).single()
      if (prod) {
        await supabase.from('produtos')
          .update({ estoque: Math.max(0, ((prod as any).estoque ?? 0) - item.quantidade) })
          .eq('id', item.cod_produto)
      }
    }
  }

  await supabase.from('vendas_condicionais').update({ status: 'confirmada' }).eq('id', params.id)

  return NextResponse.json({
    ok: true,
    status: 'confirmada',
    venda_id: (venda as any).id,
    codigo_legado: (venda as any).codigo_legado ?? null,
  })
}
