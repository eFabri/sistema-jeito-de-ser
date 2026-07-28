// src/app/api/caixa/route.ts — Módulo de Caixa
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

async function calcularEsperado(supabase: ReturnType<typeof createServerSupabaseAdmin>, caixaId: number, valorAbertura: number, hoje: string) {
  const [vpRes, fcCreditoRes, fcDebitoRes, movRes] = await Promise.all([
    // ① Vendas à vista em Dinheiro hoje (vendas_pagamento JOIN vendas)
    supabase.from('vendas_pagamento')
      .select('valor, vendas!inner(data, situacao)')
      .eq('forma', 'Dinheiro')
      .eq('vendas.data', hoje)
      .neq('vendas.situacao', 'Cancelada'),

    // ② Recebimentos crediário em Dinheiro hoje
    supabase.from('fluxo_caixa')
      .select('credito')
      .eq('tipo', 'C')
      .eq('condicao', 'Dinheiro')
      .eq('tipo_caixa', 'Caixa')
      .eq('data', hoje),

    // ③ Saídas em Dinheiro hoje (contas pagas, devoluções etc.)
    supabase.from('fluxo_caixa')
      .select('debito')
      .eq('tipo', 'D')
      .eq('condicao', 'Dinheiro')
      .eq('tipo_caixa', 'Caixa')
      .eq('data', hoje),

    // ④ Sangrias e suprimentos do caixa de hoje
    supabase.from('caixa_movimentos')
      .select('tipo, valor')
      .eq('caixa_id', caixaId),
  ])

  const vendasDinheiro      = (vpRes.data ?? []).reduce((s: number, r: any) => s + Number(r.valor), 0)
  const recebimentosDinheiro = (fcCreditoRes.data ?? []).reduce((s: number, r: any) => s + Number(r.credito), 0)
  const saidasDinheiro      = (fcDebitoRes.data ?? []).reduce((s: number, r: any) => s + Number(r.debito), 0)
  const movimentos          = movRes.data ?? []
  const suprimentos         = movimentos.filter((m: any) => m.tipo === 'suprimento').reduce((s: number, m: any) => s + Number(m.valor), 0)
  const sangrias            = movimentos.filter((m: any) => m.tipo === 'sangria').reduce((s: number, m: any) => s + Number(m.valor), 0)

  const valorEsperado = valorAbertura + vendasDinheiro + recebimentosDinheiro + suprimentos - sangrias - saidasDinheiro

  return {
    valor_abertura:         valorAbertura,
    vendas_dinheiro:        vendasDinheiro,
    recebimentos_dinheiro:  recebimentosDinheiro,
    suprimentos,
    sangrias,
    saidas_dinheiro:        saidasDinheiro,
    valor_esperado:         valorEsperado,
    movimentos,
  }
}

// GET /api/caixa — estado do caixa de hoje + cálculo em tempo real
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseAdmin()
  const hoje = hojeNoBrasil()
  const url = new URL(req.url)
  const aba = url.searchParams.get('aba')

  if (aba === 'historico') {
    const { data } = await supabase
      .from('caixa_diario')
      .select('id, data, valor_abertura, valor_contado, status, aberto_por, fechado_por, detalhamento, fechado_em')
      .order('data', { ascending: false })
      .limit(30)
    return NextResponse.json(data ?? [])
  }

  const { data: caixa } = await supabase
    .from('caixa_diario')
    .select('*')
    .eq('data', hoje)
    .maybeSingle()

  if (!caixa) {
    // Verificar se há caixa de dia anterior esquecido (aberto sem fechar)
    const { data: abertos } = await supabase
      .from('caixa_diario')
      .select('id, data')
      .eq('status', 'aberto')
      .lt('data', hoje)
    return NextResponse.json({ caixa: null, abertos_anteriores: abertos ?? [] })
  }

  const detalhe = await calcularEsperado(supabase, caixa.id, Number(caixa.valor_abertura), hoje)
  return NextResponse.json({ caixa, ...detalhe })
}

// POST /api/caixa — abrir caixa do dia
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseAdmin()
  const hoje = hojeNoBrasil()
  const { valor_abertura = 0, aberto_por } = await req.json()

  // Verificar caixa anterior aberto não fechado
  const { data: abertos } = await supabase
    .from('caixa_diario')
    .select('id, data')
    .eq('status', 'aberto')
    .lt('data', hoje)

  if (abertos && abertos.length > 0) {
    return NextResponse.json({
      erro: 'caixa_anterior_aberto',
      mensagem: `Existe um caixa de ${abertos[0].data} que não foi fechado. Feche antes de abrir hoje.`,
      caixas: abertos,
    }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('caixa_diario')
    .insert({ data: hoje, valor_abertura, aberto_por: aberto_por || null })
    .select()
    .single()

  if (error) {
    // Violação de UNIQUE(data) — caixa de hoje já existe
    if (error.code === '23505') {
      return NextResponse.json({ erro: 'Caixa de hoje já foi aberto.' }, { status: 409 })
    }
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/caixa — fechar ou reabrir caixa
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseAdmin()
  const hoje = hojeNoBrasil()
  const body = await req.json()
  const { acao, valor_contado, fechado_por, motivo_reabertura, aberto_por, perfil } = body

  const { data: caixa } = await supabase
    .from('caixa_diario')
    .select('*')
    .eq('data', hoje)
    .maybeSingle()

  if (!caixa) return NextResponse.json({ erro: 'Caixa de hoje não encontrado.' }, { status: 404 })

  // ─── FECHAMENTO ─────────────────────────────────────────────
  if (acao === 'fechar') {
    if (caixa.status === 'fechado') {
      return NextResponse.json({ erro: 'Caixa já está fechado.' }, { status: 409 })
    }
    // Validar valor_contado
    if (valor_contado === null || valor_contado === undefined || valor_contado === '') {
      return NextResponse.json({ erro: 'Informe o valor contado para fechar o caixa.' }, { status: 422 })
    }
    const contado = Number(valor_contado)
    if (isNaN(contado)) {
      return NextResponse.json({ erro: 'Valor contado inválido.' }, { status: 422 })
    }

    const detalhe = await calcularEsperado(supabase, caixa.id, Number(caixa.valor_abertura), hoje)
    const diferenca = contado - detalhe.valor_esperado

    const snapshot = {
      calculado_em:          new Date().toISOString(),
      valor_abertura:        detalhe.valor_abertura,
      vendas_dinheiro:       detalhe.vendas_dinheiro,
      recebimentos_dinheiro: detalhe.recebimentos_dinheiro,
      suprimentos:           detalhe.suprimentos,
      sangrias:              detalhe.sangrias,
      saidas_dinheiro:       detalhe.saidas_dinheiro,
      valor_esperado:        detalhe.valor_esperado,
      valor_contado:         contado,
      diferenca,
    }

    const { data: fechado, error } = await supabase
      .from('caixa_diario')
      .update({
        status:        'fechado',
        valor_contado: contado,
        fechado_por:   fechado_por || null,
        fechado_em:    new Date().toISOString(),
        detalhamento:  snapshot,
      })
      .eq('id', caixa.id)
      .select()
      .single()

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ...fechado, diferenca, valor_esperado: detalhe.valor_esperado })
  }

  // ─── REABERTURA (admin) ──────────────────────────────────────
  if (acao === 'reabrir') {
    if (perfil !== 'admin') {
      return NextResponse.json({ erro: 'Somente admin pode reabrir o caixa.' }, { status: 403 })
    }
    if (caixa.status !== 'fechado') {
      return NextResponse.json({ erro: 'Caixa não está fechado.' }, { status: 409 })
    }
    if (!motivo_reabertura?.trim()) {
      return NextResponse.json({ erro: 'Informe o motivo da reabertura.' }, { status: 422 })
    }

    const historico = Array.isArray(caixa.historico_reabertura) ? caixa.historico_reabertura : []
    historico.push({
      reaberto_por: aberto_por || 'admin',
      reaberto_em:  new Date().toISOString(),
      motivo:       motivo_reabertura.trim(),
    })

    const { data: reaberto, error } = await supabase
      .from('caixa_diario')
      .update({
        status:               'aberto',
        valor_contado:        null,
        fechado_por:          null,
        fechado_em:           null,
        detalhamento:         null,
        historico_reabertura: historico,
      })
      .eq('id', caixa.id)
      .select()
      .single()

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json(reaberto)
  }

  return NextResponse.json({ erro: 'acao inválida. Use "fechar" ou "reabrir".' }, { status: 400 })
}

