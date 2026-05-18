// src/app/api/financeiro/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

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
  const hoje   = new Date().toISOString().split('T')[0]

  // ─── CONTAS A RECEBER ──────────────────────────────────
  if (aba === 'receber') {
    let query = supabase
      .from('contas_a_receber')
      .select(`
        id, cod_cliente, cod_venda, parcela,
        data_vencimento, data_lancamento, valor, juros, saldo_devedor,
        status, pago, inadimplente, historico,
        clientes!cod_cliente(id, nome, celular, whatsapp)
      `, { count: 'exact' })
      .order('data_vencimento', { ascending: filtro !== 'pago' })
      .range(offset, offset + limite - 1)

    if (filtro === 'aberto')  query = query.eq('pago', false).gte('data_vencimento', hoje)
    if (filtro === 'vencido') query = query.eq('pago', false).lt('data_vencimento', hoje)
    if (filtro === 'pago')    query = query.eq('pago', true)
    if (filtro === 'todos')   {}

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

  // ─── RESUMO GERAL ──────────────────────────────────────
  const [receber, vencido, pagar, pagar_v] = await Promise.all([
    supabase.from('contas_a_receber').select('valor').eq('pago', false).gte('data_vencimento', hoje),
    supabase.from('contas_a_receber').select('valor').eq('pago', false).lt('data_vencimento', hoje),
    supabase.from('contas_a_pagar').select('valor').eq('pago', false).gte('data_vencimento', hoje),
    supabase.from('contas_a_pagar').select('valor').eq('pago', false).lt('data_vencimento', hoje),
  ])

  return NextResponse.json({
    a_receber: receber.data?.reduce((s, c) => s + c.valor, 0) || 0,
    vencido_receber: vencido.data?.reduce((s, c) => s + c.valor, 0) || 0,
    a_pagar: pagar.data?.reduce((s, c) => s + c.valor, 0) || 0,
    vencido_pagar: pagar_v.data?.reduce((s, c) => s + c.valor, 0) || 0,
  })
}
