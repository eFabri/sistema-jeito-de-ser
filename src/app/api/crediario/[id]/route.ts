// src/app/api/crediario/[id]/route.ts
// Detalhe do crediário de UM cliente: compras + itens (peças) + parcelas.
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase()
  const { id } = await params
  const codCliente = parseInt(id)
  if (isNaN(codCliente)) return NextResponse.json({ erro: 'id inválido' }, { status: 400 })

  // Cliente
  const { data: cliente } = await supabase
    .from('clientes').select('*').eq('id', codCliente).single()
  if (!cliente) return NextResponse.json({ erro: 'cliente não encontrado' }, { status: 404 })

  // Vendas desse cliente (somente as que têm crediário OU todas?)
  // Vamos trazer TODAS as vendas pra ter histórico completo, mas marcar quais têm crediário
  const { data: vendas } = await supabase
    .from('vendas')
    .select('id, codigo_legado, data, valor_total, situacao, vendedor')
    .eq('cod_cliente', codCliente)
    .order('data', { ascending: false })
    .limit(100)

  // Pra cada venda, pega itens (peças)
  const idsVendas = (vendas || []).map(v => v.id)
  const itensPorVenda: Record<number, any[]> = {}
  if (idsVendas.length > 0) {
    for (let i = 0; i < idsVendas.length; i += 100) {
      const lote = idsVendas.slice(i, i + 100)
      const { data: itens } = await supabase
        .from('vendas_itens')
        .select('cod_venda, produto, quantidade, preco_venda, sub_total, cod_produto')
        .in('cod_venda', lote)
      ;(itens || []).forEach((it: any) => {
        if (!itensPorVenda[it.cod_venda]) itensPorVenda[it.cod_venda] = []
        itensPorVenda[it.cod_venda].push(it)
      })
    }
  }

  // Contas a receber (parcelas) desse cliente
  const { data: parcelas } = await supabase
    .from('contas_a_receber')
    .select('id, parcela, valor, saldo_devedor, saldo_devedor_original, valor_pago, parcialmente_pago, data_vencimento, data_cobranca, pago, status, cod_venda, historico')
    .eq('cod_cliente', codCliente)
    .order('data_vencimento', { ascending: true })

  // Busca data real de pagamento via recebimentos (cod_conta → contas_a_receber.id)
  const parcelaIds = (parcelas || []).map((p: any) => p.id)
  const recebimentosMap: Record<number, string> = {}
  if (parcelaIds.length > 0) {
    const { data: recbs } = await supabase
      .from('recebimentos')
      .select('cod_conta, data_pgto')
      .in('cod_conta', parcelaIds)
      .order('data_pgto', { ascending: false })
    for (const r of (recbs || []) as any[]) {
      if (r.cod_conta && r.data_pgto && !recebimentosMap[r.cod_conta]) {
        recebimentosMap[r.cod_conta] = r.data_pgto
      }
    }
  }
  const parcelasComPgto = (parcelas || []).map((p: any) => ({
    ...p,
    data_pagamento: recebimentosMap[p.id] || null,
  }))

  // Saldo real de uma parcela: parcial usa saldo_devedor_original, senão valor completo
  const saldoReal = (p: any) => p.parcialmente_pago ? Number(p.saldo_devedor_original || p.saldo_devedor || p.valor || 0) : Number(p.valor || 0)

  // Agregação de peças mais compradas
  const pecasAgg = new Map<string, { produto: string; qtd: number; valor: number; cod_produto: number | null }>()
  for (const v of vendas || []) {
    const itens = itensPorVenda[v.id] || []
    for (const it of itens) {
      const key = it.cod_produto ? `p:${it.cod_produto}` : `n:${it.produto}`
      const cur = pecasAgg.get(key) || { produto: it.produto, qtd: 0, valor: 0, cod_produto: it.cod_produto || null }
      cur.qtd += Number(it.quantidade || 0)
      cur.valor += Number(it.sub_total || 0)
      pecasAgg.set(key, cur)
    }
  }
  const pecasTop = [...pecasAgg.values()].sort((a, b) => b.qtd - a.qtd)

  // Totais usando saldo real (não valor original para parciais)
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const em_aberto = (parcelas || []).filter(p => !p.pago).reduce((s, p) => s + saldoReal(p), 0)
  const em_atraso = (parcelas || []).filter(p => !p.pago && p.data_vencimento && p.data_vencimento < hoje).reduce((s, p) => s + saldoReal(p), 0)
  const pago = (parcelas || []).filter(p => p.pago).reduce((s, p) => s + Number(p.valor || 0), 0)
  const proxima = (parcelas || []).filter(p => !p.pago && p.data_vencimento && p.data_vencimento >= hoje).sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))[0]

  // Anexa itens em cada venda
  const vendasComItens = (vendas || []).map(v => ({ ...v, itens: itensPorVenda[v.id] || [] }))

  return NextResponse.json({
    cliente,
    totais: { em_aberto, em_atraso, pago, total_compras: vendasComItens.length, proxima_parcela: proxima || null },
    vendas: vendasComItens,
    parcelas: parcelasComPgto,
    pecas_top: pecasTop,
  })
}
