// src/app/api/produtos/proximo-codigo/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseAdmin()
  const brDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const ano = brDate.substring(2, 4)   // '26'
  const mes = brDate.substring(5, 7)   // '07'
  const prefixo = `JS${ano}${mes}`     // 'JS2607'

  const { data, error } = await supabase
    .from('produtos')
    .select('cod_referencia')
    .like('cod_referencia', `${prefixo}%`)
    .order('cod_referencia', { ascending: false })
    .limit(1)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  let seq = 1
  if (data && data.length > 0) {
    const ultimo = data[0].cod_referencia
    if (typeof ultimo === 'string' && ultimo.startsWith(prefixo)) {
      const numStr = ultimo.substring(prefixo.length)
      if (numStr.length === 4) {
        const num = parseInt(numStr, 10)
        if (!isNaN(num)) seq = num + 1
      }
    }
  }

  const codigo = `${prefixo}${String(seq).padStart(4, '0')}`
  return NextResponse.json({ codigo })
}
