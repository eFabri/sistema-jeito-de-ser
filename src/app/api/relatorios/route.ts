// src/app/api/relatorios/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') || 'vendas_periodo'
  const ini  = searchParams.get('ini') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const fim  = searchParams.get('fim') || new Date().toISOString().split('T')[0]

  // ─── VENDAS POR PERÍODO (agrupado por dia) ──────────────
  if (tipo === 'vendas_periodo') {
    const { data } = await supabase
      .from('vendas')
      .select('data, valor_total, situacao, forma_pagamento')
      .gte('data', ini).lte('data', fim)
      .neq('situacao', 'Cancelada')
      .order('data')

    // Agrupar por dia
    const porDia: Record<string, { data: string; total: number; qtd: number }> = {}
    for (const v of data || []) {
      const d = v.data
      if (!porDia[d]) porDia[d] = { data: d, total: 0, qtd: 0 }
      porDia[d].total += v.valor_total || 0
      porDia[d].qtd   += 1
    }

    // Agrupado por forma de pagamento
    const porForma: Record<string, number> = {}
    for (const v of data || []) {
      const f = v.forma_pagamento?.split(',')[0]?.trim() || 'Outros'
      porForma[f] = (porForma[f] || 0) + (v.valor_total || 0)
    }

    const totalGeral = (data || []).reduce((s, v) => s + (v.valor_total || 0), 0)
    const ticketMedio = data?.length ? totalGeral / data.length : 0

    return NextResponse.json({
      porDia: Object.values(porDia),
      porForma: Object.entries(porForma).map(([forma, total]) => ({ forma, total })).sort((a, b) => b.total - a.total),
      totalGeral,
      ticketMedio,
      qtdVendas: data?.length || 0,
    })
  }

  // ─── PRODUTOS MAIS VENDIDOS ──────────────────────────────
  if (tipo === 'produtos') {
    const { data: vendas } = await supabase
      .from('vendas')
      .select('id, data')
      .gte('data', ini).lte('data', fim)
      .neq('situacao', 'Cancelada')

    const ids = (vendas || []).map(v => v.id)
    if (!ids.length) return NextResponse.json({ produtos: [] })

    const { data: itens } = await supabase
      .from('vendas_itens')
      .select('produto, cod_produto, quantidade, sub_total')
      .in('cod_venda', ids)

    const map: Record<string, { produto: string; qtd: number; receita: number }> = {}
    for (const i of itens || []) {
      const k = i.produto
      if (!map[k]) map[k] = { produto: k, qtd: 0, receita: 0 }
      map[k].qtd     += i.quantidade || 0
      map[k].receita += i.sub_total  || 0
    }

    const produtos = Object.values(map).sort((a, b) => b.receita - a.receita).slice(0, 20)
    return NextResponse.json({ produtos })
  }

  // ─── VENDAS POR VENDEDORA ────────────────────────────────
  if (tipo === 'vendedoras') {
    const { data } = await supabase
      .from('vendas')
      .select('vendedor, valor_total')
      .gte('data', ini).lte('data', fim)
      .neq('situacao', 'Cancelada')

    const map: Record<string, { vendedor: string; total: number; qtd: number }> = {}
    for (const v of data || []) {
      const k = v.vendedor || 'Sem vendedor'
      if (!map[k]) map[k] = { vendedor: k, total: 0, qtd: 0 }
      map[k].total += v.valor_total || 0
      map[k].qtd   += 1
    }

    return NextResponse.json({
      vendedoras: Object.values(map).sort((a, b) => b.total - a.total)
    })
  }

  // ─── INADIMPLÊNCIA ────────────────────────────────────────
  if (tipo === 'inadimplencia') {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('contas_a_receber')
      .select(`
        id, parcela, data_vencimento, valor, juros,
        clientes!cod_cliente(id, nome, celular, whatsapp, categoria)
      `)
      .eq('pago', false)
      .lt('data_vencimento', hoje)
      .order('data_vencimento')

    // Agrupar por cliente
    const porCliente: Record<number, any> = {}
    for (const c of data || []) {
      const cli = (c as any).clientes
      if (!cli) continue
      const id = cli.id
      if (!porCliente[id]) porCliente[id] = { cliente: cli, parcelas: [], total: 0, maxAtraso: 0 }
      porCliente[id].parcelas.push(c)
      porCliente[id].total += c.valor || 0
      const dias = Math.floor((Date.now() - new Date(c.data_vencimento).getTime()) / 86400000)
      if (dias > porCliente[id].maxAtraso) porCliente[id].maxAtraso = dias
    }

    const lista = Object.values(porCliente).sort((a: any, b: any) => b.total - a.total)
    const totalInadimplente = lista.reduce((s: number, c: any) => s + c.total, 0)

    return NextResponse.json({ inadimplentes: lista, totalInadimplente, qtdClientes: lista.length })
  }

  // ─── ESTOQUE CRÍTICO ─────────────────────────────────────
  if (tipo === 'estoque') {
    const { data: baixo } = await supabase
      .from('produtos')
      .select('id, descricao, grupo, sub_grupo, marca, cor, tamanho, estoque, estoque_minimo, preco_venda, localizacao')
      .eq('ativo', true)
      .order('estoque', { ascending: true })

    const semEstoque  = (baixo || []).filter(p => p.estoque <= 0)
    const estoqueBaixo = (baixo || []).filter(p => p.estoque > 0 && p.estoque <= p.estoque_minimo)
    const ok          = (baixo || []).filter(p => p.estoque > p.estoque_minimo)

    return NextResponse.json({
      semEstoque: semEstoque.slice(0, 30),
      estoqueBaixo: estoqueBaixo.slice(0, 30),
      resumo: { semEstoque: semEstoque.length, baixo: estoqueBaixo.length, ok: ok.length },
    })
  }

  // ─── CLIENTES MAIS ATIVOS ─────────────────────────────────
  if (tipo === 'clientes_top') {
    const { data: vendas } = await supabase
      .from('vendas')
      .select('cod_cliente, nome_cliente, valor_total')
      .gte('data', ini).lte('data', fim)
      .neq('situacao', 'Cancelada')
      .not('cod_cliente', 'is', null)

    const map: Record<number, { id: number; nome: string; total: number; qtd: number }> = {}
    for (const v of vendas || []) {
      const id = v.cod_cliente!
      if (!map[id]) map[id] = { id, nome: v.nome_cliente, total: 0, qtd: 0 }
      map[id].total += v.valor_total || 0
      map[id].qtd   += 1
    }

    return NextResponse.json({
      clientes: Object.values(map).sort((a, b) => b.total - a.total).slice(0, 20)
    })
  }

  return NextResponse.json({ erro: 'Tipo inválido' }, { status: 400 })
}
