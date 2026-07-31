// src/app/api/vendas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()

  const { data: venda, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !venda) return NextResponse.json({ erro: 'Venda não encontrada' }, { status: 404 })

  const { data: itens }      = await supabase.from('vendas_itens').select('*').eq('cod_venda', params.id)
  const { data: pagamentos } = await supabase.from('vendas_pagamento').select('*').eq('cod_venda', params.id)
  const { data: crediario }  = await supabase.from('contas_a_receber').select('*').eq('cod_venda', params.id).order('data_vencimento', { ascending: true })
  const { data: cliente }    = venda.cod_cliente
    ? await supabase.from('clientes').select('id, nome, celular, whatsapp, cpf, endereco, cidade').eq('id', venda.cod_cliente).single()
    : { data: null }

  return NextResponse.json({ venda, itens: itens || [], pagamentos: pagamentos || [], crediario: crediario || [], cliente })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const { data, error } = await supabase
    .from('vendas').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT /api/vendas/[id] — edição completa com reconciliação de estoque
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { id } = params
  const body = await req.json()
  const { itens = [], pagamentos = [], parcelas = [], valor_total, observacao, data } = body

  // 1. Carregar itens antigos para reconciliar estoque
  const { data: oldItens } = await supabase.from('vendas_itens').select('*').eq('cod_venda', id)
  const oldItemMap = new Map((oldItens || []).map((i: any) => [Number(i.id), i]))

  // 2. Atualizar cabeçalho da venda
  const formaStr = (pagamentos as any[]).map(p => p.forma).join(', ')
  const updVenda: any = { valor_total, forma_pagamento: formaStr }
  if (observacao !== undefined) updVenda.observacao = observacao || null
  if (data) updVenda.data = data
  if (body.vendedor !== undefined) updVenda.vendedor = body.vendedor || null

  const { error: errV } = await supabase.from('vendas').update(updVenda).eq('id', id)
  if (errV) return NextResponse.json({ erro: errV.message }, { status: 500 })

  // 3. Reconciliação de itens + estoque
  const newItemIds = new Set((itens as any[]).filter(i => i.id).map(i => Number(i.id)))

  // Itens removidos: deletar + restaurar estoque
  for (const old of oldItens || []) {
    if (!newItemIds.has(Number(old.id))) {
      await supabase.from('vendas_itens').delete().eq('id', old.id)
      if (old.cod_produto) {
        const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', old.cod_produto).single()
        if (prod) await supabase.from('produtos').update({ estoque: (prod.estoque || 0) + Number(old.quantidade) }).eq('id', old.cod_produto)
      }
    }
  }

  // Itens existentes (update) + novos (insert)
  for (const item of itens as any[]) {
    const sub = Number(item.quantidade) * Number(item.preco_venda)
    if (item.id && oldItemMap.has(Number(item.id))) {
      const old = oldItemMap.get(Number(item.id))
      await supabase.from('vendas_itens').update({
        produto: item.produto,
        cod_produto: item.cod_produto || null,
        quantidade: item.quantidade,
        preco_venda: item.preco_venda,
        sub_total: sub,
      }).eq('id', item.id)
      // Ajustar estoque pela diferença de quantidade
      if (item.cod_produto && Number(item.quantidade) !== Number(old.quantidade)) {
        const diff = Number(item.quantidade) - Number(old.quantidade)
        const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.cod_produto).single()
        if (prod) await supabase.from('produtos').update({ estoque: Math.max(0, (prod.estoque || 0) - diff) }).eq('id', item.cod_produto)
      }
    } else if (!item.id) {
      // Item novo
      await supabase.from('vendas_itens').insert({
        cod_venda: id,
        cod_produto: item.cod_produto || null,
        produto: item.produto,
        quantidade: item.quantidade,
        preco_venda: item.preco_venda,
        sub_total: sub,
        desconto_valor: 0,
        desconto_pct: 0,
      })
      if (item.cod_produto) {
        const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.cod_produto).single()
        if (prod) await supabase.from('produtos').update({ estoque: Math.max(0, (prod.estoque || 0) - Number(item.quantidade)) }).eq('id', item.cod_produto)
      }
    }
  }

  // 4. Pagamentos: substituir todos (simples e seguro)
  await supabase.from('vendas_pagamento').delete().eq('cod_venda', id)
  if ((pagamentos as any[]).length > 0) {
    await supabase.from('vendas_pagamento').insert(
      (pagamentos as any[]).map(p => ({
        cod_venda: id,
        forma: p.forma,
        valor: p.valor,
        operadora: p.operadora || null,
        conta: null,
        conta_a_receber: p.forma === 'Crediário',
        parcelas: null,
        data: null,
      }))
    )
  }

  // 5. Reconciliação de parcelas em aberto
  const { data: oldParcelas } = await supabase
    .from('contas_a_receber').select('*').eq('cod_venda', id).eq('pago', false)
  const newParIds = new Set((parcelas as any[]).filter(p => p.id).map(p => Number(p.id)))

  // Deletar parcelas removidas
  for (const old of oldParcelas || []) {
    if (!newParIds.has(Number(old.id))) {
      await supabase.from('contas_a_receber').delete().eq('id', old.id)
    }
  }

  // Atualizar existentes + inserir novas
  const { data: vendaRow } = await supabase.from('vendas').select('cod_cliente').eq('id', id).single()
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  for (const par of parcelas as any[]) {
    if (par.id) {
      await supabase.from('contas_a_receber').update({
        data_vencimento: par.data_vencimento,
        valor: par.valor,
        parcela: par.parcela,
      }).eq('id', par.id).eq('pago', false)
    } else {
      await supabase.from('contas_a_receber').insert({
        cod_cliente: vendaRow?.cod_cliente || null,
        cod_venda: id,
        parcela: par.parcela,
        data_lancamento: hoje,
        data_vencimento: par.data_vencimento,
        valor: par.valor,
        historico: `Venda #${id}`,
        status: 'Em aberto',
        pago: false,
        inadimplente: false,
      })
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/vendas/[id] — cancelar venda com restauração de estoque
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { id } = params

  // Buscar itens para restaurar estoque
  const { data: itens } = await supabase.from('vendas_itens').select('*').eq('cod_venda', id)

  // Restaurar estoque de cada item
  for (const item of itens || []) {
    if (item.cod_produto) {
      const { data: prod } = await supabase.from('produtos').select('estoque').eq('id', item.cod_produto).single()
      if (prod) await supabase.from('produtos').update({ estoque: (prod.estoque || 0) + Number(item.quantidade) }).eq('id', item.cod_produto)
    }
  }

  // Deletar apenas parcelas em aberto (pagas ficam no histórico)
  await supabase.from('contas_a_receber').delete().eq('cod_venda', id).eq('pago', false)

  // Marcar venda como cancelada
  const { error } = await supabase.from('vendas').update({ situacao: 'Cancelada' }).eq('id', id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Reverter crédito de troca usado nesta venda, se houver
  const { data: venda } = await supabase.from('vendas').select('cod_cliente, codigo_legado').eq('id', id).single()
  if (venda?.cod_cliente) {
    const { data: usoTroca } = await supabase
      .from('creditos_clientes')
      .select('id, valor')
      .eq('cod_cliente', venda.cod_cliente)
      .eq('tipo', 'uso_troca')
      .or(`descricao.ilike.%#${venda.codigo_legado || id}%`)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (usoTroca && usoTroca.valor > 0) {
      const { data: cli } = await supabase.from('clientes').select('credito_troca').eq('id', venda.cod_cliente).single()
      const saldoAtual = Number(cli?.credito_troca || 0)
      await Promise.all([
        supabase.from('clientes').update({ credito_troca: saldoAtual + usoTroca.valor }).eq('id', venda.cod_cliente),
        supabase.from('creditos_clientes').insert({
          cod_cliente: venda.cod_cliente,
          tipo: 'estorno_troca',
          valor: usoTroca.valor,
          descricao: `Estorno de crédito de troca — venda #${venda.codigo_legado || id} cancelada`,
        }),
      ])
    }
  }

  return NextResponse.json({ ok: true })
}
