// src/app/api/clientes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/clientes/:id — ficha completa
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !cliente) return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })

  // Histórico de vendas
  const { data: vendas } = await supabase
    .from('vendas')
    .select('id, codigo_legado, data, valor_total, situacao, forma_pagamento, vendedor')
    .eq('cod_cliente', params.id)
    .order('data', { ascending: false })
    .limit(20)

  // Crediário em aberto (inclui parciais)
  const { data: crediario } = await supabase
    .from('contas_a_receber')
    .select('id, parcela, data_vencimento, valor, saldo_devedor, saldo_devedor_original, valor_pago, parcialmente_pago, status, pago, inadimplente, juros')
    .eq('cod_cliente', params.id)
    .eq('pago', false)
    .order('data_vencimento', { ascending: true })

  // Histórico financeiro completo (pago e em aberto)
  const { data: historico } = await supabase
    .from('contas_a_receber')
    .select('id, parcela, data_vencimento, data_lancamento, valor, saldo_devedor, saldo_devedor_original, valor_pago, parcialmente_pago, juros, status, pago, inadimplente, cod_venda')
    .eq('cod_cliente', params.id)
    .order('data_vencimento', { ascending: false })

  // Resumo financeiro com todos os campos necessários
  const { data: todasContas } = await supabase
    .from('contas_a_receber')
    .select('valor, saldo_devedor, valor_pago, parcialmente_pago, pago, inadimplente, data_vencimento')
    .eq('cod_cliente', params.id)

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const totalCompras = vendas?.reduce((s, v) => s + (v.valor_total || 0), 0) || 0

  // Saldo devedor real = soma dos saldos de parcelas não quitadas
  const saldoDevedorReal = todasContas?.filter(c => !c.pago).reduce((s, c) => s + (c.saldo_devedor || c.valor || 0), 0) || 0
  const totalVencido = todasContas?.filter(c => !c.pago && c.data_vencimento < hoje).reduce((s, c) => s + (c.saldo_devedor || c.valor || 0), 0) || 0
  const totalAberto  = todasContas?.filter(c => !c.pago && c.data_vencimento >= hoje && !c.parcialmente_pago).reduce((s, c) => s + (c.valor || 0), 0) || 0

  // Total já pago = soma dos valores quitados + valor_pago de parciais
  const totalPago = (todasContas?.filter(c => c.pago).reduce((s, c) => s + (c.valor || 0), 0) || 0)
    + (todasContas?.filter(c => c.parcialmente_pago && !c.pago).reduce((s, c) => s + (c.valor_pago || 0), 0) || 0)

  const qtdParciais = todasContas?.filter(c => c.parcialmente_pago && !c.pago).length || 0
  const totalParcelas = todasContas?.reduce((s, c) => s + (c.valor || 0), 0) || 0

  return NextResponse.json({
    cliente,
    vendas: vendas || [],
    crediario: crediario || [],
    historico: historico || [],
    resumo: {
      totalCompras, totalAberto, totalVencido, totalPago,
      saldoDevedorReal, qtdParciais, totalParcelas,
      qtdVendas: vendas?.length || 0,
    },
  })
}

// PATCH /api/clientes/:id — atualizar
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const body = await req.json()

  // Número de WhatsApp alterado → resetar flag de ativo (será revalidado pelo cron)
  if ('whatsapp' in body) {
    const { data: atual } = await supabase
      .from('clientes')
      .select('whatsapp')
      .eq('id', params.id)
      .single()
    if (atual && body.whatsapp !== atual.whatsapp) {
      body.whatsapp_ativo = null
    }
  }

  const { data, error } = await supabase
    .from('clientes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/clientes/:id — desativar (soft delete)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from('clientes')
    .update({ ativo: false })
    .eq('id', params.id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
