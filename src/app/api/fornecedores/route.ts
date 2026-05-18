// src/app/api/fornecedores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const limite = parseInt(searchParams.get('limite') || '50')

  let query = supabase
    .from('fornecedores')
    .select('id, nome, cnpj_cpf, cidade, uf, contato')
    .order('nome')
    .limit(limite)

  if (q) query = query.ilike('nome', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ fornecedores: data || [] })
}
