import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()
  const { cod_cliente, nome_cliente, observacao, valor, desconto, data_recebimento, forma_pagamento } = body

  if (!cod_cliente || !observacao?.trim() || !valor || !data_recebimento || !forma_pagamento) {
    return NextResponse.json({ erro: 'Preencha todos os campos obrigatórios' }, { status: 400 })
  }

  const valorNum    = Number(valor)
  const descontoNum = Number(desconto || 0)
  const valorLiq    = Math.max(0, valorNum - descontoNum)

  // 1 — contas_a_receber (já pago, avulso)
  const { data: conta, error: errConta } = await supabase
    .from('contas_a_receber')
    .insert({
      cod_cliente,
      parcela:               'Avulso',
      data_lancamento:       data_recebimento,
      data_vencimento:       data_recebimento,
      valor:                 valorNum,
      pago:                  true,
      status:                'Pago',
      valor_pago:            valorLiq,
      saldo_devedor:         0,
      saldo_devedor_original: 0,
      parcialmente_pago:     false,
      historico:             observacao.trim(),
    })
    .select()
    .single()

  if (errConta || !conta) {
    return NextResponse.json({ erro: errConta?.message ?? 'Erro ao criar conta' }, { status: 500 })
  }

  // 2 — recebimentos
  const { error: errRec } = await supabase
    .from('recebimentos')
    .insert({
      cod_conta:      conta.id,
      cod_cliente,
      data_pgto:      data_recebimento,
      forma_pgto:     forma_pagamento,
      valor_recebido: valorLiq,
      desconto:       descontoNum,
      entrada:        observacao.trim(),
    })

  if (errRec) {
    await supabase.from('contas_a_receber').delete().eq('id', conta.id)
    return NextResponse.json({ erro: errRec.message }, { status: 500 })
  }

  // 3 — fluxo_caixa (mantém consistência com recebimentos normais)
  await supabase.from('fluxo_caixa').insert({
    tipo_caixa: 'Caixa',
    descricao:  'Recebimento Avulso',
    historico:  `${nome_cliente || 'Cliente'} | ${observacao.trim()}${descontoNum > 0 ? ` | Desconto: R$ ${descontoNum.toFixed(2)}` : ''}`,
    credito:    valorLiq,
    debito:     0,
    data:       data_recebimento,
    tipo:       'C',
    condicao:   forma_pagamento,
  })

  return NextResponse.json({ ok: true })
}
