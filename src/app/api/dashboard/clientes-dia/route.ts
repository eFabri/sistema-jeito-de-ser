// src/app/api/dashboard/clientes-dia/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// TIMEZONE — REGRA OBRIGATÓRIA: data_cadastro é timestamptz em UTC.
// "Hoje" em BRT (UTC-3): fronteira = dia X às 03:00Z até dia X+1 às 03:00Z.
function fronteirasHojeBRT(): { ini: string; fim: string } {
  const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const [y, m, d] = hojeStr.split('-').map(Number)
  const amanha = new Date(Date.UTC(y, m - 1, d + 1))
  const amanhaStr = amanha.toISOString().split('T')[0]
  return {
    ini: `${hojeStr}T03:00:00Z`,
    fim: `${amanhaStr}T03:00:00Z`,
  }
}

export async function GET() {
  const supabase = await createServerSupabase()
  const { ini, fim } = fronteirasHojeBRT()

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, celular, whatsapp, encaminhado_em, acoes_disparadas')
    .gte('data_cadastro', ini)
    .lt('data_cadastro', fim)
    .order('data_cadastro', { ascending: false })

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ clientes: data || [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { id, acao } = await req.json()

  if (!id) return NextResponse.json({ erro: 'id obrigatório' }, { status: 400 })

  if (acao === 'encaminhar') {
    const { error } = await supabase
      .from('clientes')
      .update({ encaminhado_em: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const ACOES_VALIDAS = ['boas-vindas', 'gostou-da-compra', 'oferta-segunda-compra']
  if (ACOES_VALIDAS.includes(acao)) {
    const { data: cli } = await supabase.from('clientes').select('acoes_disparadas').eq('id', id).single()
    const existentes: any[] = cli?.acoes_disparadas || []
    const novas = [...existentes, { acao, registrado_em: new Date().toISOString() }]
    const { error } = await supabase.from('clientes').update({ acoes_disparadas: novas }).eq('id', id)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ erro: 'ação inválida' }, { status: 400 })
}
