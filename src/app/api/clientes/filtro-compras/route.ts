export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

// GET /api/clientes/filtro-compras
// Parâmetros: ini, fim, formas (CSV), ticket_min, ticket_max, q, pagina, limite
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseAdmin()
  const { searchParams } = new URL(req.url)

  const ini        = searchParams.get('ini') || ''
  const fim        = searchParams.get('fim') || ''
  const formasStr  = searchParams.get('formas') || ''        // ex: "Dinheiro,PIX,Cartão Débito"
  const ticketMin  = parseFloat(searchParams.get('ticket_min') || '0') || 0
  const ticketMax  = parseFloat(searchParams.get('ticket_max') || '0') || 0
  const q          = searchParams.get('q') || ''
  const pagina     = parseInt(searchParams.get('pagina') || '1')
  const limite     = parseInt(searchParams.get('limite') || '25')

  const formas = formasStr ? formasStr.split(',').map(f => f.trim()).filter(Boolean) : []

  // ── 1. Buscar vendas com os filtros de compra ──────────────
  let vendasQuery = supabase
    .from('vendas')
    .select('cod_cliente, valor_total, data, forma_pagamento')
    .neq('situacao', 'Cancelada')
    .not('cod_cliente', 'is', null)

  if (ini) vendasQuery = vendasQuery.gte('data', ini)
  if (fim) vendasQuery = vendasQuery.lte('data', fim)
  if (ticketMin > 0) vendasQuery = vendasQuery.gte('valor_total', ticketMin)
  if (ticketMax > 0) vendasQuery = vendasQuery.lte('valor_total', ticketMax)

  // "À Vista" expande para todas as formas não-crediário
  let formasFiltro = formas
  if (formas.includes('À Vista')) {
    formasFiltro = [...formas.filter(f => f !== 'À Vista'), 'Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Boleto', 'Transferência']
  }
  // "Cartão" expande para Débito + Crédito
  if (formas.includes('Cartão')) {
    formasFiltro = [...formasFiltro.filter(f => f !== 'Cartão'), 'Cartão Débito', 'Cartão Crédito']
  }
  formasFiltro = [...new Set(formasFiltro)]

  if (formasFiltro.length > 0) {
    vendasQuery = vendasQuery.in('forma_pagamento', formasFiltro)
  }

  const { data: vendas, error: vendasError } = await vendasQuery.limit(50000)
  if (vendasError) return NextResponse.json({ erro: vendasError.message }, { status: 500 })
  if (!vendas || vendas.length === 0) {
    return NextResponse.json({ clientes: [], total: 0, pagina, limite })
  }

  // ── 2. Agregar por cod_cliente ─────────────────────────────
  const mapa = new Map<number, { total: number; qtd: number; ultima: string; formas: Set<string> }>()
  for (const v of vendas) {
    const id = v.cod_cliente as number
    const cur = mapa.get(id) || { total: 0, qtd: 0, ultima: '', formas: new Set() }
    cur.total += Number(v.valor_total || 0)
    cur.qtd   += 1
    if (!cur.ultima || v.data > cur.ultima) cur.ultima = v.data
    if (v.forma_pagamento) cur.formas.add(v.forma_pagamento)
    mapa.set(id, cur)
  }

  const ids = [...mapa.keys()]

  // ── 3. Buscar clientes por esses IDs ──────────────────────
  let clientesQuery = supabase
    .from('clientes')
    .select('id, nome, celular, whatsapp, cidade, categoria, ativo')
    .in('id', ids)
    .eq('ativo', true)

  if (q) {
    clientesQuery = clientesQuery.or(`nome.ilike.%${q}%,celular.ilike.%${q}%,whatsapp.ilike.%${q}%`)
  }

  const { data: clientesRaw, error: cliError } = await clientesQuery.order('nome').limit(5000)
  if (cliError) return NextResponse.json({ erro: cliError.message }, { status: 500 })

  // ── 4. Mesclar e ordenar (mais que compraram primeiro) ────
  const merged = (clientesRaw || [])
    .map(c => ({
      ...c,
      total_comprado:  mapa.get(c.id)?.total  || 0,
      qtd_compras:     mapa.get(c.id)?.qtd    || 0,
      ultima_compra:   mapa.get(c.id)?.ultima || '',
      formas_usadas:   [...(mapa.get(c.id)?.formas || [])].join(', '),
    }))
    .sort((a, b) => b.total_comprado - a.total_comprado)

  const total = merged.length
  const offset = (pagina - 1) * limite
  const paginated = merged.slice(offset, offset + limite)

  return NextResponse.json({
    clientes: paginated,
    total,
    pagina,
    limite,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
