// src/app/api/compras/proximo-codigo-barras/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

function calcCheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10)
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

function buildEAN13(seq: number): string {
  const body = '789' + String(seq).padStart(9, '0') // 12 digits
  return body + calcCheckDigit(body)
}

export async function GET() {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('produtos')
    .select('cod_barras')
    .like('cod_barras', '789%')
    .order('cod_barras', { ascending: false })
    .limit(1)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  let seq = 1
  if (data && data.length > 0) {
    const last = data[0].cod_barras
    if (typeof last === 'string' && last.length === 13) {
      const num = parseInt(last.substring(3, 12), 10) // extract 9-digit seq
      if (!isNaN(num)) seq = num + 1
    }
  }

  return NextResponse.json({ codigo: buildEAN13(seq) })
}
