// src/app/api/caixa/detalhe/route.ts — dados detalhados para a tela de fechamento com abas
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function proximoDia(data: string): string {
  const [y, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseAdmin()
  const url = new URL(req.url)
  const caixaIdParam = url.searchParams.get('caixa_id')
  const hoje = hojeNoBrasil()

  const { data: caixa } = caixaIdParam
    ? await supabase.from('caixa_diario').select('*').eq('id', Number(caixaIdParam)).maybeSingle()
    : await supabase.from('caixa_diario').select('*').eq('data', hoje).maybeSingle()

  if (!caixa) return NextResponse.json({ erro: 'Caixa não encontrado' }, { status: 404 })

  const dataCaixa = caixa.data as string
  const next = proximoDia(dataCaixa)
  // Fuso BR = UTC-3: meia-noite BR = 03:00 UTC
  const dayStart = dataCaixa + 'T03:00:00.000Z'
  const dayEnd   = next      + 'T03:00:00.000Z'

  const [vendasRes, recebRes, saidasRes, movsRes, clientesRes, trocasRes] = await Promise.all([
    // Vendas do dia com formas de pagamento embutidas
    supabase.from('vendas')
      .select('id, nome_cliente, valor_total, situacao, forma_pagamento, vendas_pagamento(forma, valor, operadora, parcela)')
      .eq('data', dataCaixa)
      .neq('situacao', 'Cancelada')
      .order('id'),

    // Recebimentos em dinheiro no caixa físico (crediário pago em dinheiro)
    supabase.from('fluxo_caixa')
      .select('id, credito, historico, descricao, condicao')
      .eq('data', dataCaixa)
      .eq('tipo', 'C')
      .eq('tipo_caixa', 'Caixa')
      .order('id'),

    // Saídas em dinheiro no caixa físico (contas pagas)
    supabase.from('fluxo_caixa')
      .select('id, debito, historico, descricao, despesa, condicao')
      .eq('data', dataCaixa)
      .eq('tipo', 'D')
      .eq('tipo_caixa', 'Caixa')
      .order('id'),

    // Sangrias e suprimentos
    supabase.from('caixa_movimentos')
      .select('*')
      .eq('caixa_id', caixa.id)
      .order('criado_em'),

    // Clientes cadastrados no dia (fuso BR)
    supabase.from('clientes')
      .select('*', { count: 'exact', head: true })
      .gte('data_cadastro', dayStart)
      .lt('data_cadastro', dayEnd),

    // Trocas/devoluções do dia
    supabase.from('vendas_trocas')
      .select('id, nome_cliente, valor_original, valor_troca, diferenca, status, observacao, created_at')
      .eq('data', dataCaixa)
      .order('id'),
  ])

  return NextResponse.json({
    caixa_id:       caixa.id,
    data_caixa:     dataCaixa,
    vendas:         vendasRes.data  ?? [],
    recebimentos:   recebRes.data   ?? [],
    saidas_fluxo:   saidasRes.data  ?? [],
    movimentos:     movsRes.data    ?? [],
    clientes_novos: clientesRes.count ?? 0,
    trocas:         trocasRes.data  ?? [],
  })
}
