// src/app/api/caixa/movimentos/route.ts — sangria e suprimento
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseAdmin()
  const hoje = hojeNoBrasil()
  const { tipo, valor, motivo, criado_por } = await req.json()

  if (!tipo || !['sangria', 'suprimento'].includes(tipo)) {
    return NextResponse.json({ erro: 'tipo deve ser "sangria" ou "suprimento".' }, { status: 422 })
  }
  const v = Number(valor)
  if (!v || v <= 0 || isNaN(v)) {
    return NextResponse.json({ erro: 'Valor deve ser maior que zero.' }, { status: 422 })
  }

  const { data: caixa } = await supabase
    .from('caixa_diario')
    .select('id, status')
    .eq('data', hoje)
    .maybeSingle()

  if (!caixa) return NextResponse.json({ erro: 'Caixa de hoje não está aberto.' }, { status: 404 })
  if (caixa.status === 'fechado') return NextResponse.json({ erro: 'Caixa já foi fechado.' }, { status: 409 })

  const { data, error } = await supabase
    .from('caixa_movimentos')
    .insert({ caixa_id: caixa.id, tipo, valor: v, motivo: motivo?.trim() || null, criado_por: criado_por || null })
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
