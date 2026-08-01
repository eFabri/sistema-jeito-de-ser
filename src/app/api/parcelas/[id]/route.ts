// src/app/api/parcelas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { id } = params
  const { data_vencimento, valor } = await req.json()

  const { data: parcela, error: errFind } = await supabase
    .from('contas_a_receber').select('id, pago').eq('id', id).single()

  if (errFind || !parcela) return NextResponse.json({ erro: 'Parcela não encontrada' }, { status: 404 })
  if (parcela.pago) return NextResponse.json({ erro: 'Parcela já paga não pode ser editada.' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (data_vencimento !== undefined) updates.data_vencimento = data_vencimento
  if (valor !== undefined) updates.valor = Number(valor)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ erro: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const { error } = await supabase.from('contas_a_receber').update(updates).eq('id', id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { id } = params

  const { data: parcela, error: errFind } = await supabase
    .from('contas_a_receber').select('id, pago').eq('id', id).single()

  if (errFind || !parcela) return NextResponse.json({ erro: 'Parcela não encontrada' }, { status: 404 })
  if (parcela.pago) return NextResponse.json({ erro: 'Parcela já paga não pode ser removida.' }, { status: 400 })

  const { error } = await supabase.from('contas_a_receber').delete().eq('id', id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
