// src/app/api/vendas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()

  const { data: venda, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !venda) return NextResponse.json({ erro: 'Venda não encontrada' }, { status: 404 })

  const { data: itens }      = await supabase.from('vendas_itens').select('*').eq('cod_venda', params.id)
  const { data: pagamentos } = await supabase.from('vendas_pagamento').select('*').eq('cod_venda', params.id)
  const { data: crediario }  = await supabase.from('contas_a_receber').select('*').eq('cod_venda', params.id)
  const { data: cliente }    = venda.cod_cliente
    ? await supabase.from('clientes').select('id, nome, celular, whatsapp, cpf, endereco, cidade').eq('id', venda.cod_cliente).single()
    : { data: null }

  return NextResponse.json({ venda, itens: itens || [], pagamentos: pagamentos || [], crediario: crediario || [], cliente })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const { data, error } = await supabase
    .from('vendas').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}
