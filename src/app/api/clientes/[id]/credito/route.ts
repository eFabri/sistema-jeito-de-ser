// src/app/api/clientes/[id]/credito/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseAdmin()

  const [{ data: cliente }, { data: historico }] = await Promise.all([
    supabase.from('clientes').select('saldo_credito').eq('id', params.id).single(),
    supabase.from('creditos_clientes')
      .select('id, tipo, valor, descricao, criado_em')
      .eq('cod_cliente', params.id)
      .order('criado_em', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    saldo_atual: Number(cliente?.saldo_credito || 0),
    historico: historico || [],
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseAdmin()
  const { tipo, valor, descricao } = await req.json()

  if (!tipo || !valor || valor <= 0) {
    return NextResponse.json({ erro: 'Tipo e valor obrigatórios' }, { status: 400 })
  }

  const { data: cliente } = await supabase
    .from('clientes').select('saldo_credito').eq('id', params.id).single()

  const saldoAtual = Number(cliente?.saldo_credito || 0)
  const delta = tipo === 'uso' ? -valor : valor
  const novoSaldo = Math.max(0, saldoAtual + delta)

  const [{ error: insertError }] = await Promise.all([
    supabase.from('creditos_clientes').insert({
      cod_cliente: params.id,
      tipo,
      valor,
      descricao: descricao || (tipo === 'uso' ? 'Crédito utilizado' : 'Crédito lançado'),
    }),
    supabase.from('clientes').update({ saldo_credito: novoSaldo }).eq('id', params.id),
  ])

  if (insertError) return NextResponse.json({ erro: insertError.message }, { status: 500 })

  return NextResponse.json({ ok: true, novo_saldo: novoSaldo })
}
