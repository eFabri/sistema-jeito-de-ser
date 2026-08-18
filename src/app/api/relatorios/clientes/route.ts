export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ativo     = searchParams.get('ativo')     // 'true' | 'false' | 'todos'
  const cidade    = searchParams.get('cidade')    // filtro opcional
  const categoria = searchParams.get('categoria') // filtro opcional
  const q         = searchParams.get('q')         // busca por nome

  const supabase = createServerSupabaseAdmin()

  let query = supabase
    .from('clientes')
    .select('id, nome, celular, whatsapp, cidade, categoria, ativo, data_cadastro')
    .order('nome', { ascending: true })
    .limit(5000)

  if (ativo === 'true')  query = query.eq('ativo', true)
  if (ativo === 'false') query = query.eq('ativo', false)
  // 'todos' ou ausente: sem filtro de ativo

  if (cidade)    query = query.ilike('cidade', `%${cidade}%`)
  if (categoria) query = query.eq('categoria', categoria)
  if (q)         query = query.ilike('nome', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Listas únicas para os selects de filtro
  const cidades    = [...new Set((data || []).map((c: any) => c.cidade).filter(Boolean))].sort()
  const categorias = [...new Set((data || []).map((c: any) => c.categoria).filter(Boolean))].sort()

  return NextResponse.json({
    clientes: data || [],
    total: data?.length || 0,
    cidades,
    categorias,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
