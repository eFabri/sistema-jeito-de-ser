// src/app/api/produtos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const q      = searchParams.get('q') || ''
  const limite = parseInt(searchParams.get('limite') || '30')
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const grupo  = searchParams.get('grupo') || ''
  const baixo  = searchParams.get('baixo') === 'true'
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('produtos')
    .select('id, codigo_legado, descricao, grupo, sub_grupo, preco_venda, preco_custo, estoque, estoque_minimo, cod_barras, cod_referencia, marca, cor, tamanho, permite_desconto', { count: 'exact' })
    .eq('ativo', true)
    .order('descricao', { ascending: true })
    .range(offset, offset + limite - 1)

  if (q) {
    query = query.or(`descricao.ilike.%${q}%,cod_barras.ilike.%${q}%,cod_referencia.ilike.%${q}%,marca.ilike.%${q}%`)
  }
  if (grupo) query = query.eq('grupo', grupo)
  if (baixo)  query = query.lte('estoque', supabase.rpc as any) // handled differently below

  const { data, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ produtos: data, total: count, pagina, limite })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const { data, error } = await supabase.from('produtos').insert(body).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
