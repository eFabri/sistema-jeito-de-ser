import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const ini = searchParams.get('ini') || ''
  const fim = searchParams.get('fim') || ''

  let q = supabase
    .from('vendas')
    .select('id, valor_total')
    .neq('situacao', 'Cancelada')

  if (ini) q = q.gte('data', ini)
  if (fim) q = q.lte('data', fim)

  const { data: vendas, error } = await q
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const total_vendas = vendas?.length ?? 0
  const valor_total  = vendas?.reduce((s, v) => s + (Number(v.valor_total) || 0), 0) ?? 0
  const ticket_medio = total_vendas > 0 ? valor_total / total_vendas : 0

  const ids = (vendas || []).map(v => v.id)
  let por_forma: { forma: string; total: number }[] = []

  if (ids.length > 0) {
    const { data: pgtos } = await supabase
      .from('vendas_pagamento')
      .select('forma, valor')
      .in('cod_venda', ids)

    const mapa: Record<string, number> = {}
    for (const p of pgtos || []) {
      const forma = p.forma || 'Outros'
      mapa[forma] = (mapa[forma] || 0) + (Number(p.valor) || 0)
    }
    por_forma = Object.entries(mapa)
      .map(([forma, total]) => ({ forma, total }))
      .sort((a, b) => b.total - a.total)
  }

  return NextResponse.json({ total_vendas, valor_total, ticket_medio, por_forma })
}
