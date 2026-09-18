// src/app/api/relatorio-vendas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const inicio = searchParams.get('inicio')
  const fim    = searchParams.get('fim')

  if (!inicio || !fim) return NextResponse.json({ erro: 'inicio e fim são obrigatórios' }, { status: 400 })

  const { data, error } = await supabase
    .from('vendas')
    .select(`
      id, data, valor_total, forma_pagamento, nome_cliente,
      clientes!cod_cliente(nome, celular, whatsapp),
      vendas_pagamento(forma, valor)
    `)
    .gte('data', inicio)
    .lte('data', fim)
    .neq('situacao', 'Cancelada')
    .order('data', { ascending: false })
    .limit(5000)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  const rows = (data || []).map((v: any) => {
    const pgtos = v.vendas_pagamento || []
    const formas = pgtos.length > 0
      ? [...new Set(pgtos.map((p: any) => p.forma))].join(', ')
      : (v.forma_pagamento || '—')
    const cli = v.clientes
    return {
      id:              v.id,
      data:            v.data,
      nomeCliente:     cli?.nome || v.nome_cliente || 'Cliente não informado',
      telefone:        cli?.celular || cli?.whatsapp || '—',
      valorTotal:      Number(v.valor_total || 0),
      formasPagamento: formas,
    }
  })

  return NextResponse.json({ rows, total: rows.length })
}
