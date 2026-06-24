// src/app/api/metas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mes  = parseInt(searchParams.get('mes')  || String(new Date().getMonth() + 1))
  const ano  = parseInt(searchParams.get('ano')  || String(new Date().getFullYear()))
  const tipo = searchParams.get('tipo') || 'global'
  const userId = searchParams.get('user_id') || null

  let query = supabase.from('metas').select('*').eq('mes', mes).eq('ano', ano)

  if (tipo === 'global') {
    query = query.eq('tipo', 'global').is('user_id', null)
  } else if (tipo === 'individual' && userId) {
    query = query.eq('tipo', 'individual').eq('user_id', userId)
  } else {
    // Busca todas as metas do mês (global + individuais)
    query = query.eq('mes', mes).eq('ano', ano)
  }

  const { data } = await query
  return NextResponse.json({ metas: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  // Verificar se é admin
  const { data: perfil } = await supabase
    .from('perfis_usuario').select('perfil').eq('user_id', user.id).single()
  if (!perfil || perfil.perfil !== 'admin') {
    return NextResponse.json({ erro: 'Apenas administradores podem definir metas' }, { status: 403 })
  }

  const body = await req.json()
  const { tipo, user_id, mes, ano, valor } = body

  if (!tipo || !mes || !ano || valor === undefined) {
    return NextResponse.json({ erro: 'tipo, mes, ano e valor são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase.from('metas').upsert({
    tipo,
    user_id: user_id || null,
    mes: parseInt(mes),
    ano: parseInt(ano),
    valor: parseFloat(valor),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'tipo,user_id,mes,ano',
  }).select().single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}
