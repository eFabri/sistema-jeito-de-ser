// src/app/api/relatorios/top-clientes/route.ts
// Ranking dos clientes que mais compraram num período (mensal/trimestral/custom).
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

function calcularPeriodo(tipo: string, refDate: Date): { ini: string; fim: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  if (tipo === 'mes') {
    const ini = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
    const fim = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
    return { ini: fmt(ini), fim: fmt(fim), label: `${MESES[refDate.getMonth()]}/${refDate.getFullYear()}` }
  }
  if (tipo === 'trimestre') {
    const q = Math.floor(refDate.getMonth() / 3)            // 0..3
    const ini = new Date(refDate.getFullYear(), q * 3, 1)
    const fim = new Date(refDate.getFullYear(), q * 3 + 3, 0)
    return { ini: fmt(ini), fim: fmt(fim), label: `${q + 1}º Tri/${refDate.getFullYear()}` }
  }
  // fallback: últimos 30 dias
  const ini = new Date(refDate); ini.setDate(ini.getDate() - 30)
  return { ini: fmt(ini), fim: fmt(refDate), label: 'Últimos 30 dias' }
}

function formatarLabelCustom(ini: string, fim: string): string {
  const f = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
  return `${f(ini)} — ${f(fim)}`
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const tipo  = searchParams.get('tipo') || 'mes'   // mes | trimestre | custom
  const ref   = searchParams.get('ref')              // ISO date (default: hoje)
  const iniQ  = searchParams.get('ini')              // usado quando tipo=custom
  const fimQ  = searchParams.get('fim')
  const limit = parseInt(searchParams.get('limit') || '20')

  let ini: string, fim: string, label: string
  if (tipo === 'custom') {
    if (!iniQ || !fimQ) {
      return NextResponse.json({ erro: 'tipo=custom exige parametros ini e fim' }, { status: 400 })
    }
    ini = iniQ; fim = fimQ
    label = formatarLabelCustom(ini, fim)
  } else {
    const refDate = ref ? new Date(ref + 'T12:00:00') : new Date()
    const r = calcularPeriodo(tipo, refDate)
    ini = r.ini; fim = r.fim; label = r.label
  }

  // Pega todas as vendas do período (precisa de cod_cliente, valor_total)
  // Usa paginação porque pode passar de 1000
  const vendas: { cod_cliente: number; valor_total: number }[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('vendas')
      .select('cod_cliente, valor_total')
      .gte('data', ini)
      .lte('data', fim)
      .not('cod_cliente', 'is', null)
      .neq('situacao', 'Cancelada')
      .range(offset, offset + pageSize - 1)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    vendas.push(...data as any)
    if (data.length < pageSize) break
    offset += pageSize
  }

  // Agrega por cliente
  const agg = new Map<number, { total: number; qtd: number }>()
  for (const v of vendas) {
    const cur = agg.get(v.cod_cliente) || { total: 0, qtd: 0 }
    cur.total += Number(v.valor_total || 0)
    cur.qtd += 1
    agg.set(v.cod_cliente, cur)
  }

  // Top N (ordenado por total)
  const ranking = [...agg.entries()]
    .map(([id, v]) => ({ cod_cliente: id, total: v.total, qtd_compras: v.qtd }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)

  // Busca nomes
  if (ranking.length > 0) {
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, celular, whatsapp, cidade, categoria')
      .in('id', ranking.map(r => r.cod_cliente))
    const mapa = new Map((clientes || []).map((c: any) => [c.id, c]))
    ranking.forEach((r: any, i) => {
      const c = mapa.get(r.cod_cliente)
      r.posicao = i + 1
      r.nome = c?.nome || '(cliente removido)'
      r.celular = c?.celular || c?.whatsapp
      r.cidade = c?.cidade
      r.categoria = c?.categoria
      r.ticket_medio = r.qtd_compras > 0 ? r.total / r.qtd_compras : 0
    })
  }

  return NextResponse.json({
    tipo, label, periodo_ini: ini, periodo_fim: fim,
    total_clientes_que_compraram: agg.size,
    total_periodo: vendas.reduce((s, v) => s + Number(v.valor_total || 0), 0),
    ranking,
  })
}
