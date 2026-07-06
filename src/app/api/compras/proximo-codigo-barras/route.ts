// src/app/api/compras/proximo-codigo-barras/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)

  // Fetch all 4-character barcode strings and find the max numeric one
  const { data, error } = await supabase
    .from('produtos')
    .select('cod_barras')
    .like('cod_barras', '____')   // exactly 4 characters
    .order('cod_barras', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const maxCode = (data || [])
    .map(r => r.cod_barras as string)
    .filter(b => /^\d{4}$/.test(b))
    .map(b => parseInt(b, 10))
    .reduce((a, b) => Math.max(a, b), 0)

  const next = (maxCode || 0) + 1 + offset
  return NextResponse.json({ codigo: String(next).padStart(4, '0') })
}
