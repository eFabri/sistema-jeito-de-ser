// src/app/api/clientes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/clientes?q=nome&pagina=1&limite=20&categoria=Crediário
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q') || ''
  const pagina   = parseInt(searchParams.get('pagina') || '1')
  const limite   = parseInt(searchParams.get('limite') || '20')
  const categoria = searchParams.get('categoria') || ''
  const offset   = (pagina - 1) * limite

  let query = supabase
    .from('clientes')
    .select('id, codigo_legado, nome, celular, whatsapp, cpf, cidade, categoria, limite_credito, data_nascimento, data_cadastro', { count: 'exact' })
    .eq('ativo', true)
    .order('nome', { ascending: true })
    .range(offset, offset + limite - 1)

  if (q) {
    query = query.or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,celular.ilike.%${q}%,whatsapp.ilike.%${q}%`)
  }
  if (categoria) {
    query = query.eq('categoria', categoria)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ clientes: data, total: count, pagina, limite })
}

// POST /api/clientes — novo cliente
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()

  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...body, data_cadastro: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
