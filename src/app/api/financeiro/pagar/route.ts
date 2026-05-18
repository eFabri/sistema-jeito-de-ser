// src/app/api/financeiro/pagar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { cod_conta, valor_pago, forma_pgto, juros = 0, desconto = 0, data_pgto } = await req.json()

  const { data: conta, error } = await supabase
    .from('contas_a_pagar').select('*').eq('id', cod_conta).single()
  if (error || !conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  const hoje = data_pgto || new Date().toISOString().split('T')[0]
  const valorFinal = valor_pago + juros - desconto

  await supabase.from('pagamentos').insert({
    cod_conta, data: hoje, valor: valorFinal, forma_pgto,
  })

  await supabase.from('contas_a_pagar').update({
    pago: true, status: 'Pago', juros, desconto,
  }).eq('id', cod_conta)

  await supabase.from('fluxo_caixa').insert({
    tipo_caixa: 'Caixa',
    despesa: conta.despesa,
    descricao: conta.descricao || conta.despesa,
    historico: `Pagamento: ${conta.descricao || conta.despesa}`,
    credito: 0,
    debito: valorFinal,
    data: hoje,
    tipo: 'D',
    condicao: forma_pgto,
    plano_contas: conta.plano_contas,
  })

  return NextResponse.json({ ok: true })
}

// POST nova conta a pagar
export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const { data, error } = await supabase.from('contas_a_pagar').insert(body).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
