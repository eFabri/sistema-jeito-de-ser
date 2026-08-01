// src/app/api/contas-a-receber/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// POST /api/contas-a-receber — inserir crediário avulso
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()

  const { cod_cliente, parcela, data_lancamento, data_vencimento, valor, historico } = body

  if (!cod_cliente || !data_vencimento || !valor) {
    return NextResponse.json({ erro: 'Cliente, data de vencimento e valor são obrigatórios.' }, { status: 400 })
  }

  const { data, error } = await supabase.from('contas_a_receber').insert({
    cod_cliente,
    parcela:         parcela || '1/1',
    data_lancamento: data_lancamento || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    data_vencimento,
    valor:           Number(valor),
    historico:       historico || null,
    status:          'Em aberto',
    pago:            false,
    inadimplente:    false,
  }).select().single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/contas-a-receber — atualizar inadimplente
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const { id, inadimplente } = body

  if (!id) return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 })

  const status = inadimplente ? 'Inadimplente' : 'Em aberto'

  const { error } = await supabase
    .from('contas_a_receber')
    .update({ inadimplente, status })
    .eq('id', id)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
