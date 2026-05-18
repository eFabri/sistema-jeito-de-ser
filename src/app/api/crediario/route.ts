// src/app/api/crediario/route.ts
// Resumo geral do crediário: clientes com saldo em aberto.
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const incluirPagos = searchParams.get('incluirPagos') === '1'

  // 1. Busca contas com paginação manual via offset/limit
  //    (range() do supabase-js às vezes interpreta como HTTP Range bytes)
  type CR = { id: number; cod_cliente: number; valor: number; pago: boolean; data_vencimento: string | null; data_pagamento: string | null }
  const todas: CR[] = []
  const pageSize = 1000
  let pagina = 0
  while (true) {
    let q1 = supabase
      .from('contas_a_receber')
      .select('id, cod_cliente, valor, pago, data_vencimento, data_pagamento')
      .not('cod_cliente', 'is', null)
      .limit(pageSize)
    // Pula offset registros manualmente — supabase-js usa range() que funciona
    // mas precisa do header range-unit. Usa OFFSET via .range() com cuidado:
    q1 = q1.range(pagina * pageSize, pagina * pageSize + pageSize - 1)

    const { data, error } = await q1
    if (error) return NextResponse.json({ erro: error.message, contexto: 'fetch contas_a_receber' }, { status: 500 })
    if (!data || data.length === 0) break
    todas.push(...(data as any))
    if (data.length < pageSize) break
    pagina++
    if (pagina > 20) break // safety
  }

  // 2. Agrega por cliente
  const hoje = new Date().toISOString().split('T')[0]
  type Agg = {
    cod_cliente: number; em_aberto: number; parcelas_em_aberto: number
    pago_acumulado: number; parcelas_pagas: number
    proxima_vencimento: string | null; em_atraso: number; parcelas_em_atraso: number
  }
  const agg = new Map<number, Agg>()
  for (const c of todas) {
    if (!c.cod_cliente) continue
    const cur = agg.get(c.cod_cliente) || {
      cod_cliente: c.cod_cliente, em_aberto: 0, parcelas_em_aberto: 0,
      pago_acumulado: 0, parcelas_pagas: 0, proxima_vencimento: null,
      em_atraso: 0, parcelas_em_atraso: 0,
    }
    const valor = Number(c.valor || 0)
    if (c.pago) {
      cur.pago_acumulado += valor
      cur.parcelas_pagas += 1
    } else {
      cur.em_aberto += valor
      cur.parcelas_em_aberto += 1
      if (c.data_vencimento && c.data_vencimento < hoje) {
        cur.em_atraso += valor
        cur.parcelas_em_atraso += 1
      }
      if (c.data_vencimento && (!cur.proxima_vencimento || c.data_vencimento < cur.proxima_vencimento)) {
        cur.proxima_vencimento = c.data_vencimento
      }
    }
    agg.set(c.cod_cliente, cur)
  }

  // 3. Filtra clientes com alguma movimentação
  const lista = [...agg.values()].filter(c => c.em_aberto > 0 || c.pago_acumulado > 0)
  lista.sort((a, b) => (b.em_atraso - a.em_atraso) || (b.em_aberto - a.em_aberto))

  // 4. Busca nomes dos clientes em lotes
  const ids = lista.map(l => l.cod_cliente)
  const clientesPorId = new Map<number, any>()
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200)
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, celular, whatsapp, cpf, cidade, categoria, limite_credito')
      .in('id', lote)
    ;(data || []).forEach((c: any) => clientesPorId.set(c.id, c))
  }

  let resultado = lista.map(l => ({
    ...l,
    nome:      clientesPorId.get(l.cod_cliente)?.nome      || '(removido)',
    celular:   clientesPorId.get(l.cod_cliente)?.celular   || clientesPorId.get(l.cod_cliente)?.whatsapp || null,
    cidade:    clientesPorId.get(l.cod_cliente)?.cidade    || null,
    categoria: clientesPorId.get(l.cod_cliente)?.categoria || null,
    limite_credito: clientesPorId.get(l.cod_cliente)?.limite_credito || null,
  }))

  // 5. Busca textual
  if (q) {
    const ql = q.toLowerCase()
    resultado = resultado.filter(c =>
      c.nome.toLowerCase().includes(ql) ||
      (c.celular || '').includes(q.replace(/\D/g, ''))
    )
  }

  const totais = {
    em_aberto_total:      lista.reduce((s, c) => s + c.em_aberto, 0),
    em_atraso_total:      lista.reduce((s, c) => s + c.em_atraso, 0),
    clientes_com_aberto:  lista.filter(c => c.em_aberto > 0).length,
    clientes_em_atraso:   lista.filter(c => c.em_atraso > 0).length,
  }

  // DEBUG: total raw contas lidas vs após filtro
  return NextResponse.json({
    totais,
    clientes: resultado,
    _debug: { total_contas_lidas: todas.length, clientes_unicos: agg.size, lista_final: resultado.length },
  })
}
