// src/app/api/financeiro/receber/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { cod_conta, valor_recebido, forma_pgto, juros = 0, desconto = 0, data_pgto, tipo = 'total' } = await req.json()

  const { data: conta, error: errConta } = await supabase
    .from('contas_a_receber')
    .select('*, clientes!cod_cliente(id, nome)')
    .eq('id', cod_conta)
    .single()

  if (errConta || !conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  const hoje = data_pgto || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const saldoAtual = conta.parcialmente_pago
    ? Number(conta.saldo_devedor_original || conta.saldo_devedor || conta.valor)
    : Number(conta.valor || 0)

  // Para pagamento total: saldo zera independente do valor enviado
  // Para parcial: saldo reduz pelo valor recebido (desconto já incluso no valor_recebido)
  const novoSaldo = tipo === 'total' ? 0 : Math.max(0, saldoAtual - valor_recebido)
  const quitado   = tipo === 'total' || novoSaldo < 0.01

  // O que entra no caixa = valor_recebido + juros (desconto já foi subtraído no front)
  const cashRecebido = valor_recebido + juros

  // Registra recebimento
  await supabase.from('recebimentos').insert({
    cod_conta,
    cod_cliente:    conta.cod_cliente,
    cod_venda:      conta.cod_venda,
    data_pgto:      hoje,
    forma_pgto,
    valor_recebido: cashRecebido,
    desconto,
    entrada: 'Caixa',
  })

  // Atualiza conta a receber
  const novoValorPago = (Number(conta.valor_pago) || 0) + valor_recebido
  await supabase.from('contas_a_receber').update({
    pago:                   quitado,
    status:                 quitado ? 'Pago' : 'Pago Parcial',
    juros:                  (Number(conta.juros) || 0) + juros,
    inadimplente:           false,
    saldo_devedor:          novoSaldo,
    saldo_devedor_original: quitado ? 0 : novoSaldo,
    valor_pago:             novoValorPago,
    parcialmente_pago:      !quitado,
  }).eq('id', cod_conta)

  // Fluxo de caixa
  await supabase.from('fluxo_caixa').insert({
    tipo_caixa:  'Caixa',
    descricao:   `Recebimento ${quitado ? '' : 'parcial '}parcela ${conta.parcela || ''}`.trim(),
    historico:   `Cliente: ${(conta as any).clientes?.nome || ''} | Venda #${conta.cod_venda}${desconto > 0 ? ` | Desconto: R$ ${desconto.toFixed(2)}` : ''}`,
    credito:     cashRecebido,
    debito:      0,
    data:        hoje,
    tipo:        'C',
    condicao:    forma_pgto,
  })

  return NextResponse.json({ ok: true, quitado, saldo_restante: novoSaldo })
}
