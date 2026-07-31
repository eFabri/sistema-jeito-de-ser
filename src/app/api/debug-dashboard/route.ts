// DIAGNÓSTICO TEMPORÁRIO — remover após resolver o bug do dashboard
// GET /api/debug-dashboard
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function dataBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export async function GET() {
  const hoje = dataBR()
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || ''
  const anonKey   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const url       = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  // 1. Verificar se a chave parece ser service_role (começa com 'eyJ' e é longa)
  const keyLen      = serviceKey.length
  const keyPreview  = serviceKey ? `${serviceKey.slice(0, 8)}...${serviceKey.slice(-4)}` : '(vazio)'
  const isLikelyServiceRole = serviceKey.length > 200 // service_role JWTs são ~500 chars; anon keys também, mas diferem no payload

  // 2. Decodificar o role do JWT sem verificar assinatura (apenas base64)
  let jwtRole = '(erro ao decodificar)'
  try {
    const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1] || '', 'base64').toString())
    jwtRole = payload.role || payload.sub || JSON.stringify(payload)
  } catch { jwtRole = '(JWT inválido ou vazio)' }

  // 3. Query direta pelo admin client — buscar venda de hoje
  const admin = createServerSupabaseAdmin()
  const { data: vendasAdmin, error: errAdmin } = await admin
    .from('vendas')
    .select('id, data, situacao, valor_total')
    .eq('data', hoje)
    .neq('situacao', 'Cancelada')
    .order('id', { ascending: false })

  // 4. Query com anon key para comparar
  const anonClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: vendasAnon, error: errAnon } = await anonClient
    .from('vendas')
    .select('id, data, situacao, valor_total')
    .eq('data', hoje)
    .neq('situacao', 'Cancelada')
    .order('id', { ascending: false })

  // 5. Buscar venda 45275 especificamente pelo admin
  const { data: venda45275, error: errV } = await admin
    .from('vendas')
    .select('id, data, situacao, valor_total')
    .eq('id', 45275)
    .maybeSingle()

  // 6. Verificar RLS policies (via pg_policies se acessível)
  const { data: rlsPolicies, error: errRls } = await admin
    .rpc('exec_sql', { sql: "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'vendas'" })
    .maybeSingle()

  return NextResponse.json({
    hoje,
    service_key: {
      preview: keyPreview,
      length: keyLen,
      jwt_role: jwtRole,
      likely_service_role: isLikelyServiceRole,
    },
    admin_query_hoje: {
      count: vendasAdmin?.length ?? 0,
      rows: vendasAdmin ?? [],
      error: errAdmin?.message ?? null,
    },
    anon_query_hoje: {
      count: vendasAnon?.length ?? 0,
      rows: vendasAnon ?? [],
      error: errAnon?.message ?? null,
    },
    venda_45275: {
      found: !!venda45275,
      data: venda45275 ?? null,
      error: errV?.message ?? null,
    },
    rls_policies: {
      data: rlsPolicies ?? null,
      error: errRls?.message ?? null,
    },
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache' },
  })
}
