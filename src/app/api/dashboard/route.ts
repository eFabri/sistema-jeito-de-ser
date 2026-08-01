// src/app/api/dashboard/route.ts — agrega tudo que o Dashboard precisa numa só chamada
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

// Data no fuso de Brasília (UTC-3) — servidor Vercel roda em UTC
function dataBR(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function subDias(str: string, n: number): string {
  const [y, m, dia] = str.split('-').map(Number)
  const dt = new Date(y, m - 1, dia - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export async function GET() {
  const supabase = createServerSupabaseAdmin()
  const hojeStr = dataBR()
  const ontemStr = subDias(hojeStr, 1)
  const inicioMesStr = hojeStr.substring(0, 8) + '01'
  const ha14Str = subDias(hojeStr, 13)
  const ha30Str = subDias(hojeStr, 29)
  const inicioPeriodoVendas = ha30Str // pega 30 dias pra trás (cobre 7/14/30/mês)

  // ─── 1. Vendas no período (carrega uma vez, fatia depois) ──────
  const { data: vendasData, error: vendasError } = await supabase
    .from('vendas')
    .select('id, codigo_legado, vendedor, data, nome_cliente, valor_total, situacao, forma_pagamento, created_at')
    .gte('data', inicioPeriodoVendas)
    .neq('situacao', 'Cancelada')
    .order('id', { ascending: false })
    .limit(1500)
  if (vendasError) return NextResponse.json({ erro: vendasError.message }, { status: 500 })
  const vendasPeriodo: any[] = vendasData || []

  const vendasHoje    = vendasPeriodo.filter(v => v.data === hojeStr)
  const vendasOntem   = vendasPeriodo.filter(v => v.data === ontemStr)
  const vendasMes     = vendasPeriodo.filter(v => v.data >= inicioMesStr)
  const totalHoje  = vendasHoje.reduce((s, v) => s + Number(v.valor_total || 0), 0)
  const totalOntem = vendasOntem.reduce((s, v) => s + Number(v.valor_total || 0), 0)
  const totalMes   = vendasMes.reduce((s, v) => s + Number(v.valor_total || 0), 0)
  const comparativoOntemPct = totalOntem > 0 ? ((totalHoje - totalOntem) / totalOntem) * 100 : null

  const ticketMedioDia = vendasHoje.length > 0 ? totalHoje / vendasHoje.length : 0
  const ticketMedioMes = vendasMes.length > 0 ? totalMes / vendasMes.length : 0

  // Agrupamento de hoje por vendedora (para "Minhas Vendas Hoje" da colaboradora)
  const aggHoje = new Map<string, { vendedor: string; qtd: number; total: number }>()
  for (const v of vendasHoje) {
    const k = v.vendedor || '(sem vendedor)'
    const cur = aggHoje.get(k) || { vendedor: k, qtd: 0, total: 0 }
    cur.qtd += 1
    cur.total += Number(v.valor_total || 0)
    aggHoje.set(k, cur)
  }
  const vendedorasHoje = [...aggHoje.values()]

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
      const s = subDias(hojeStr, i)
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
      .select('id, cod_cliente, valor, saldo_devedor_original, parcialmente_pago, pago, data_vencimento, parcela')
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
  const saldoRealDash = (c: any) => c.parcialmente_pago ? Number(c.saldo_devedor_original || c.valor || 0) : Number(c.valor || 0)
  const totalReceberHoje = aRecHoje.reduce((s, c) => s + saldoRealDash(c), 0)
  const totalInadimplente = inadimplentes.reduce((s, c) => s + saldoRealDash(c), 0)

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

  // ─── 7. Últimas 50 vendas (colaboradora pode precisar filtrar mais que 8) ──
  const ultimasVendas = vendasPeriodo.slice(0, 50)

  // ─── 8. Aniversariantes ──────────────────────────────────
  let aniversariantes: any[] = []
  try {
    const { data } = await supabase.rpc('aniversariantes_hoje', { data_ref: dataBR() })
    if (data) aniversariantes = data
  } catch {}

  return NextResponse.json({
    _debug: { hojeStr, inicioPeriodoVendas, vendas_count: vendasPeriodo.length, top3: vendasPeriodo.slice(0, 3).map((v: any) => ({ id: v.id, data: v.data })) },
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
    vendas_hoje_vendedoras: vendedorasHoje,
    vencimentos: proximos,
    vendas_recentes: ultimasVendas,
    aniversariantes,
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
}
