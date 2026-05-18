// src/app/api/clientes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

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

  // Crediário em aberto
  const { data: crediario } = await supabase
    .from('contas_a_receber')
    .select('id, parcela, data_vencimento, valor, status, pago, inadimplente, juros')
    .eq('cod_cliente', params.id)
    .eq('pago', false)
    .order('data_vencimento', { ascending: true })

  // Resumo financeiro
  const { data: resumo } = await supabase
    .from('contas_a_receber')
    .select('valor, pago, inadimplente')
    .eq('cod_cliente', params.id)

  const totalCompras = vendas?.reduce((s, v) => s + (v.valor_total || 0), 0) || 0
  const totalAberto = crediario?.reduce((s, c) => s + (c.valor || 0), 0) || 0
  const totalVencido = crediario?.filter(c => new Date(c.data_vencimento) < new Date()).reduce((s, c) => s + (c.valor || 0), 0) || 0

  return NextResponse.json({
    cliente,
    vendas: vendas || [],
    crediario: crediario || [],
    resumo: { totalCompras, totalAberto, totalVencido, qtdVendas: vendas?.length || 0 },
  })
}

// PATCH /api/clientes/:id — atualizar
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const body = await req.json()

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
