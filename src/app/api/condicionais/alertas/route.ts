import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createServerSupabaseAdmin()

  const { data: condicionais, error } = await supabase
    .from('vendas_condicionais')
    .select('id, nome_cliente, data_retorno_prevista')
    .eq('status', 'aberta')
    .eq('alerta_enviado', false)
    .lte('data_retorno_prevista', new Date().toISOString())

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  let alertas = 0
  for (const cond of condicionais ?? []) {
    const dataFmt = cond.data_retorno_prevista
      ? new Date(cond.data_retorno_prevista).toLocaleDateString('pt-BR')
      : '—'

    await supabase.from('notificacoes').insert({
      user_id: null,
      tipo: 'condicional_vencida',
      titulo: `Condicional #${cond.id} vencida`,
      mensagem: `A saída condicional de ${cond.nome_cliente} venceu em ${dataFmt}. Confirme ou registre a devolução.`,
      link: `/condicionais/${cond.id}`,
      lida: false,
    })

    await supabase
      .from('vendas_condicionais')
      .update({ alerta_enviado: true })
      .eq('id', cond.id)

    alertas++
  }

  return NextResponse.json({ ok: true, alertas })
}
