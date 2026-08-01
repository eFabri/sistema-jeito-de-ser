// DIAGNÓSTICO TEMPORÁRIO — remover após resolver o bug do dashboard
// GET /api/debug-dashboard
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

function dataBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export async function GET() {
  const hoje = dataBR()
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || ''
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  // Decodificar role do JWT
  let jwtRole = '(erro)'
  try {
    const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1] || '', 'base64').toString())
    jwtRole = payload.role || payload.sub || JSON.stringify(payload)
  } catch { /* noop */ }

  const admin = createServerSupabaseAdmin()

  // 1. Buscar últimas 5 vendas SEM NENHUM FILTRO de data
  const { data: top5, error: e1 } = await admin
    .from('vendas')
    .select('id, data, situacao, valor_total')
    .order('id', { ascending: false })
    .limit(5)

  // 2. Buscar id=45276 diretamente (a venda de R$1,20 de hoje)
  const { data: v45276, error: e2 } = await admin
    .from('vendas')
    .select('id, data, situacao, valor_total')
    .eq('id', 45276)
    .maybeSingle()

  // 3. Buscar id=45275 (venda de ontem R$4,00)
  const { data: v45275, error: e3 } = await admin
    .from('vendas')
    .select('id, data, situacao, valor_total')
    .eq('id', 45275)
    .maybeSingle()

  // 4. Query com filtro de data = hoje (como debug anterior)
  const { data: hoje_rows, error: e4 } = await admin
    .from('vendas')
    .select('id, data, situacao, valor_total')
    .eq('data', hoje)
    .order('id', { ascending: false })

  // 5. Contar TOTAL de vendas no banco (sem filtro)
  const { count: totalVendas, error: e5 } = await admin
    .from('vendas')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    env: {
      hoje,
      utc_now: new Date().toISOString(),
      supabase_url_preview: url.slice(0, 40),
      jwt_role: jwtRole,
    },
    top5_sem_filtro: { rows: top5 ?? [], error: e1?.message ?? null },
    venda_45276:     { found: !!v45276, data: v45276 ?? null, error: e2?.message ?? null },
    venda_45275:     { found: !!v45275, data: v45275 ?? null, error: e3?.message ?? null },
    hoje_rows:       { count: hoje_rows?.length ?? 0, rows: hoje_rows ?? [], error: e4?.message ?? null },
    total_vendas_db: { count: totalVendas ?? null, error: e5?.message ?? null },
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache' },
  })
}
