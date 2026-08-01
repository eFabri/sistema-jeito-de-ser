// src/app/api/financeiro/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/financeiro?aba=receber|pagar|fluxo&filtro=aberto|vencido|pago&pagina=1
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const aba    = searchParams.get('aba') || 'receber'
  const filtro = searchParams.get('filtro') || 'aberto'
  const q      = searchParams.get('q') || ''
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '30')
  const offset = (pagina - 1) * limite
  const hoje   = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  // ─── CONTAS A RECEBER ──────────────────────────────────
  if (aba === 'receber') {
    let query = supabase
      .from('contas_a_receber')
      .select(`
        id, cod_cliente, cod_venda, parcela,
        data_vencimento, data_lancamento, valor, juros,
        saldo_devedor, saldo_devedor_original, valor_pago, parcialmente_pago,
        status, pago, inadimplente, historico,
        clientes!cod_cliente(id, nome, celular, whatsapp)
      `, { count: 'exact' })
      .order('data_vencimento', { ascending: filtro !== 'pago' })
      .range(offset, offset + limite - 1)

    if (filtro === 'inadimplente') {
      query = query.eq('inadimplente', true).eq('pago', false)
    } else {
      // Excluir inadimplentes de todas as listagens normais
      query = query.or('inadimplente.is.null,inadimplente.eq.false')

      if (filtro === 'aberto')        query = query.eq('pago', false).gte('data_vencimento', hoje).eq('parcialmente_pago', false)
      if (filtro === 'vencido')       query = query.eq('pago', false).lt('data_vencimento', hoje)
      if (filtro === 'parcial')       query = query.eq('pago', false).eq('parcialmente_pago', true)
      if (filtro === 'pago')          query = query.eq('pago', true)
      if (filtro === 'todos')         {}
      if (filtro === 'todos_abertos') query = query.eq('pago', false)
      if (filtro === 'vence_hoje')    query = query.eq('pago', false).eq('data_vencimento', hoje)
      if (filtro === 'proximos_7_dias') {
        const d7 = new Date(hoje + 'T12:00:00')
        d7.setDate(d7.getDate() + 7)
        const em7 = d7.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
        query = query.eq('pago', false).gte('data_vencimento', hoje).lte('data_vencimento', em7)
      }
      if (filtro === 'vencido_mes_atual') {
        // Vencidas + mês atual = tudo não pago até fim do mês
        const fimMes = hoje.substring(0, 7) + '-31'
        query = query.eq('pago', false).lte('data_vencimento', fimMes)
      }
      if (filtro === 'mes_atual') {
        const inicioMes = hoje.substring(0, 7) + '-01'
        const fimMes    = hoje.substring(0, 7) + '-31'
        query = query.eq('pago', false).gte('data_vencimento', inicioMes).lte('data_vencimento', fimMes)
      }
    }

    if (q) {
      const { data: clis } = await supabase.from('clientes').select('id').ilike('nome', `%${q}%`)
      const ids = (clis || []).map((c: any) => c.id)
      if (ids.length > 0) query = query.in('cod_cliente', ids)
      else return NextResponse.json({ contas: [], total: 0 })
    }

    const { data, count, error } = await query
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ contas: data, total: count, pagina, limite })
  }

  // ─── CONTAS A PAGAR ────────────────────────────────────
  if (aba === 'pagar') {
    let query = supabase
      .from('contas_a_pagar')
      .select('*', { count: 'exact' })
      .order('data_vencimento', { ascending: filtro !== 'pago' })
      .range(offset, offset + limite - 1)

    if (filtro === 'aberto')  query = query.eq('pago', false).gte('data_vencimento', hoje)
    if (filtro === 'vencido') query = query.eq('pago', false).lt('data_vencimento', hoje)
    if (filtro === 'pago')    query = query.eq('pago', true)

    if (q) query = query.or(`descricao.ilike.%${q}%,despesa.ilike.%${q}%`)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ contas: data, total: count, pagina, limite })
  }

  // ─── FLUXO DE CAIXA ────────────────────────────────────
  if (aba === 'fluxo') {
    const mes  = searchParams.get('mes') || hoje.substring(0, 7)
    const ini  = `${mes}-01`
    const fim  = `${mes}-31`

    const { data: fluxo } = await supabase
      .from('fluxo_caixa')
      .select('*')
      .gte('data', ini).lte('data', fim)
      .order('data', { ascending: true })

    const totalCredito = fluxo?.reduce((s, f) => s + (f.credito || 0), 0) || 0
    const totalDebito  = fluxo?.reduce((s, f) => s + (f.debito || 0), 0) || 0

    return NextResponse.json({ fluxo: fluxo || [], totalCredito, totalDebito, saldo: totalCredito - totalDebito })
  }

  // ─── RESUMO CONTAS A RECEBER (4 cards + badge) ────────
  if (aba === 'resumo_receber') {
    const d7 = new Date(hoje + 'T12:00:00')
    d7.setDate(d7.getDate() + 7)
    const em7 = d7.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

    const [todos, venc, hj, prox7] = await Promise.all([
      supabase.from('contas_a_receber').select('valor, saldo_devedor_original, parcialmente_pago').eq('pago', false),
      supabase.from('contas_a_receber').select('valor, saldo_devedor_original, parcialmente_pago').eq('pago', false).lt('data_vencimento', hoje),
      supabase.from('contas_a_receber').select('valor, saldo_devedor_original, parcialmente_pago').eq('pago', false).eq('data_vencimento', hoje),
      supabase.from('contas_a_receber').select('valor, saldo_devedor_original, parcialmente_pago').eq('pago', false).gte('data_vencimento', hoje).lte('data_vencimento', em7),
    ])

    const saldoFn = (c: any) => c.parcialmente_pago ? (Number(c.saldo_devedor_original) || Number(c.valor) || 0) : Number(c.valor || 0)
    const agg = (rows: any[]) => ({ valor: rows.reduce((s, c) => s + saldoFn(c), 0), count: rows.length })

    return NextResponse.json({
      aberto:      agg(todos.data || []),
      vencido:     agg(venc.data || []),
      vence_hoje:  agg(hj.data || []),
      proximos_7:  agg(prox7.data || []),
      badge:       (venc.data || []).length + (hj.data || []).length,
    })
  }

  // ─── RESUMO GERAL ──────────────────────────────────────
  const [receber, vencido, pagar, pagar_v] = await Promise.all([
    supabase.from('contas_a_receber').select('valor, saldo_devedor_original, parcialmente_pago').eq('pago', false).gte('data_vencimento', hoje),
    supabase.from('contas_a_receber').select('valor, saldo_devedor_original, parcialmente_pago').eq('pago', false).lt('data_vencimento', hoje),
    supabase.from('contas_a_pagar').select('valor').eq('pago', false).gte('data_vencimento', hoje),
    supabase.from('contas_a_pagar').select('valor').eq('pago', false).lt('data_vencimento', hoje),
  ])

  const saldoR = (c: any) => c.parcialmente_pago ? (c.saldo_devedor_original || c.valor || 0) : (c.valor || 0)

  return NextResponse.json({
    a_receber: receber.data?.reduce((s, c) => s + saldoR(c), 0) || 0,
    vencido_receber: vencido.data?.reduce((s, c) => s + saldoR(c), 0) || 0,
    a_pagar: pagar.data?.reduce((s, c) => s + c.valor, 0) || 0,
    vencido_pagar: pagar_v.data?.reduce((s, c) => s + c.valor, 0) || 0,
  })
}
