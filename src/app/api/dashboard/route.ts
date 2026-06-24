// src/app/api/dashboard/route.ts — agrega tudo que o Dashboard precisa numa só chamada
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

function fmt(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export async function GET() {
  const supabase = await createServerSupabase()
  const hoje = new Date()
  const hojeStr = fmt(hoje)
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1)
  const ontemStr = fmt(ontem)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const inicioMesStr = fmt(inicioMes)
  const ha14 = new Date(hoje); ha14.setDate(ha14.getDate() - 13)
  const ha14Str = fmt(ha14)
  const ha30 = new Date(hoje); ha30.setDate(ha30.getDate() - 29)
  const ha30Str = fmt(ha30)
  const inicioPeriodoVendas = ha30Str // pega 30 dias pra trás (cobre 7/14/30/mês)

  // ─── 1. Vendas no período (carrega uma vez, fatia depois) ──────
  // Paginação manual porque podem haver muitas vendas
  const vendasPeriodo: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('vendas')
      .select('id, codigo_legado, vendedor, data, nome_cliente, valor_total, situacao, forma_pagamento, created_at')
      .gte('data', inicioPeriodoVendas)
      .neq('situacao', 'Cancelada')
      .order('data', { ascending: false })
      .range(from, from + 999)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    vendasPeriodo.push(...data)
    if (data.length < 1000) break
    from += 1000
    if (from > 9000) break
  }

  const vendasHoje    = vendasPeriodo.filter(v => v.data === hojeStr)
  const vendasOntem   = vendasPeriodo.filter(v => v.data === ontemStr)
  const vendasMes     = vendasPeriodo.filter(v => v.data >= inicioMesStr)
  const totalHoje  = vendasHoje.reduce((s, v) => s + Number(v.valor_total || 0), 0)
  const totalOntem = vendasOntem.reduce((s, v) => s + Number(v.valor_total || 0), 0)
  const totalMes   = vendasMes.reduce((s, v) => s + Number(v.valor_total || 0), 0)
  const comparativoOntemPct = totalOntem > 0 ? ((totalHoje - totalOntem) / totalOntem) * 100 : null

  const ticketMedioDia = vendasHoje.length > 0 ? totalHoje / vendasHoje.length : 0
  const ticketMedioMes = vendasMes.length > 0 ? totalMes / vendasMes.length : 0

  // ─── 2. Vendas 14d (gráfico) e 30d (mês) ─────────────────
  // Agrupa por data
  function agruparPorData(vendas: any[]) {
    const map = new Map<string, { data: string; total: number; qtd: number }>()
    for (const v of vendas) {
      const cur = map.get(v.data) || { data: v.data, total: 0, qtd: 0 }
      cur.total += Number(v.valor_total || 0)
      cur.qtd += 1
      map.set(v.data, cur)
    }
    return [...map.values()].sort((a, b) => a.data.localeCompare(b.data))
  }
  // Series com TODOS os dias (mesmo zerados) — só pros gráficos
  function preencherDias(diasAtras: number) {
    const result: { data: string; total: number; qtd: number }[] = []
    const agg = agruparPorData(vendasPeriodo)
    const aggMap = new Map(agg.map(a => [a.data, a]))
    for (let i = diasAtras - 1; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(d.getDate() - i)
      const s = fmt(d)
      const e = aggMap.get(s)
      result.push({ data: s, total: e?.total || 0, qtd: e?.qtd || 0 })
    }
    return result
  }
  const vendas14d = preencherDias(14)
  const vendas7d  = preencherDias(7)
  const vendas30d = preencherDias(30)

  // ─── 3. Ranking de vendedoras (mês) ──────────────────────
  const agg = new Map<string, { vendedor: string; qtd: number; total: number }>()
  for (const v of vendasMes) {
    const k = v.vendedor || '(sem vendedor)'
    const cur = agg.get(k) || { vendedor: k, qtd: 0, total: 0 }
    cur.qtd += 1
    cur.total += Number(v.valor_total || 0)
    agg.set(k, cur)
  }
  const vendedorasMes = [...agg.values()]
    .map(v => ({ ...v, ticket: v.qtd > 0 ? v.total / v.qtd : 0 }))
    .sort((a, b) => b.total - a.total)

  // ─── 4. A receber hoje + Inadimplentes ───────────────────
  const aRecHoje: any[] = []
  const inadimplentes: any[] = []
  let offCar = 0
  while (true) {
    const { data, error } = await supabase
      .from('contas_a_receber')
      .select('id, cod_cliente, valor, pago, data_vencimento, parcela')
      .eq('pago', false)
      .range(offCar, offCar + 999)
    if (error || !data || data.length === 0) break
    for (const c of data) {
      if (c.data_vencimento === hojeStr) aRecHoje.push(c)
      else if (c.data_vencimento && c.data_vencimento < hojeStr) inadimplentes.push(c)
    }
    if (data.length < 1000) break
    offCar += 1000
    if (offCar > 9000) break
  }
  const totalReceberHoje = aRecHoje.reduce((s, c) => s + Number(c.valor || 0), 0)
  const totalInadimplente = inadimplentes.reduce((s, c) => s + Number(c.valor || 0), 0)

  // ─── 5. Estoque crítico ──────────────────────────────────
  // Como `lte('estoque', 'estoque_minimo')` exige filter('estoque', 'lte', 'estoque_minimo') que olha
  // o valor literal "estoque_minimo" — vou fazer manualmente: pegar tudo e filtrar
  let estoqueCriticoCount = 0
  let offProd = 0
  while (true) {
    const { data, error } = await supabase
      .from('produtos')
      .select('estoque, estoque_minimo, ativo')
      .eq('ativo', true)
      .range(offProd, offProd + 999)
    if (error || !data || data.length === 0) break
    for (const p of data) {
      if (Number(p.estoque) <= Number(p.estoque_minimo)) estoqueCriticoCount++
    }
    if (data.length < 1000) break
    offProd += 1000
    if (offProd > 9000) break
  }

  // ─── 6. Próximos 8 vencimentos via RPC já existente ──────
  let proximos: any[] = []
  try {
    const { data } = await supabase.rpc('vencimentos_proximos', { dias: 15 })
    if (data) proximos = data.slice(0, 8)
  } catch {}

  // ─── 7. Últimas 8 vendas ─────────────────────────────────
  const ultimasVendas = vendasPeriodo.slice(0, 8)

  // ─── 8. Aniversariantes ──────────────────────────────────
  let aniversariantes: any[] = []
  try {
    const { data } = await supabase.rpc('aniversariantes_hoje')
    if (data) aniversariantes = data
  } catch {}

  return NextResponse.json({
    vendas_hoje: { total: totalHoje, qtd: vendasHoje.length, comparativo_ontem_pct: comparativoOntemPct },
    vendas_mes:  { total: totalMes, qtd: vendasMes.length },
    ticket_medio_dia: ticketMedioDia,
    ticket_medio_mes: ticketMedioMes,
    a_receber_hoje: { total: totalReceberHoje, qtd: aRecHoje.length },
    inadimplentes:  { total: totalInadimplente, qtd: inadimplentes.length },
    estoque_critico: estoqueCriticoCount,
    vendas_14d: vendas14d,
    vendas_7d:  vendas7d,
    vendas_30d: vendas30d,
    vendedoras_mes: vendedorasMes,
    vencimentos: proximos,
    vendas_recentes: ultimasVendas,
    aniversariantes,
  })
}
