// src/app/api/financeiro/receber/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

// POST — dar baixa em conta a receber
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { cod_conta, valor_recebido, forma_pgto, juros = 0, data_pgto } = await req.json()

  const { data: conta, error: errConta } = await supabase
    .from('contas_a_receber')
    .select('*, clientes!cod_cliente(id, nome)')
    .eq('id', cod_conta)
    .single()

  if (errConta || !conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  const hoje = data_pgto || new Date().toISOString().split('T')[0]
  const valorTotal = valor_recebido + juros

  // Registrar recebimento
  await supabase.from('recebimentos').insert({
    cod_conta,
    cod_cliente: conta.cod_cliente,
    cod_venda: conta.cod_venda,
    data_pgto: hoje,
    forma_pgto,
    valor_recebido: valorTotal,
    entrada: 'Caixa',
  })

  // Baixar conta
  await supabase.from('contas_a_receber').update({
    pago: true,
    status: 'Pago',
    juros,
    inadimplente: false,
  }).eq('id', cod_conta)

  // Registrar no fluxo de caixa
  await supabase.from('fluxo_caixa').insert({
    tipo_caixa: 'Caixa',
    descricao: `Recebimento parcela ${conta.parcela || ''}`,
    historico: `Cliente: ${(conta as any).clientes?.nome || ''} | Venda #${conta.cod_venda}`,
    credito: valorTotal,
    debito: 0,
    data: hoje,
    tipo: 'C',
    condicao: forma_pgto,
  })

  return NextResponse.json({ ok: true })
}
