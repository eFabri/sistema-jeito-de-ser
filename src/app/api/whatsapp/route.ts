// src/app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { verificarInstancia, obterQRCode } from '@/lib/whatsapp'
import { hojeNoBrasil, diasAFrente } from '@/lib/dates'

// GET — status da instância + modelos + logs recentes
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const aba = searchParams.get('aba') || 'status'

  if (aba === 'status') {
    let status = { state: 'desconhecido', qrcode: null as any }
    try {
      const inst = await verificarInstancia()
      status.state = inst?.instance?.state || inst?.state || 'disconnected'
    } catch { status.state = 'sem_conexao' }

    const { data: modelos } = await supabase
      .from('whatsapp_modelos').select('*').order('tipo')

    const { data: logs } = await supabase
      .from('whatsapp_logs')
      .select('*, clientes!cod_cliente(nome)')
      .order('enviado_em', { ascending: false })
      .limit(20)

    return NextResponse.json({ status, modelos: modelos || [], logs: logs || [] })
  }

  if (aba === 'qr') {
    try {
      const qr = await obterQRCode()
      return NextResponse.json({ qr })
    } catch (e: any) {
      return NextResponse.json({ erro: e.message }, { status: 500 })
    }
  }

  if (aba === 'logs') {
    const pagina = parseInt(searchParams.get('pagina') || '1')
    const limite = 30
    const { data, count } = await supabase
      .from('whatsapp_logs')
      .select('*, clientes!cod_cliente(nome)', { count: 'exact' })
      .order('enviado_em', { ascending: false })
      .range((pagina - 1) * limite, pagina * limite - 1)

    return NextResponse.json({ logs: data || [], total: count, pagina, limite })
  }

  // aniversariantes e vencimentos para disparo manual
  if (aba === 'pendentes') {
    const hoje = hojeNoBrasil()
    const em5  = diasAFrente(5)

    const { data: aniv } = await supabase.rpc('aniversariantes_hoje')
    const { data: venc } = await supabase.rpc('vencimentos_proximos', { dias: 7 })

    return NextResponse.json({
      aniversariantes: aniv || [],
      vencimentos: (venc || []).filter((v: any) => v.dias_para_vencer >= 0 && v.dias_para_vencer <= 7),
    })
  }

  if (aba === 'whatsapp_hoje') {
    const hoje = hojeNoBrasil()
    const em5dias = diasAFrente(5)
    const monthDay = hoje.slice(5) // 'MM-DD' — para LIKE em data_nascimento/data_casamento

    const [logsRes, carDiaRes, car5dRes, anivRes, casRes] = await Promise.all([
      supabase
        .from('whatsapp_logs')
        .select('id, tipo, status, enviado_em, numero, erro, clientes!cod_cliente(nome)')
        .in('tipo', ['aniversario', 'aniversario_casamento', 'cobranca_5d', 'cobranca_dia'])
        .gte('enviado_em', `${hoje}T00:00:00-03:00`)
        .order('enviado_em', { ascending: true }),

      // Vencimentos hoje sem filtro de WhatsApp (para contar excluídos)
      supabase
        .from('contas_a_receber')
        .select('id, clientes!cod_cliente(whatsapp, whatsapp_ativo)')
        .eq('data_vencimento', hoje)
        .eq('pago', false)
        .eq('msg_dia_enviada', false)
        .or('inadimplente.is.null,inadimplente.eq.false'),

      // Vencimentos em 5 dias sem filtro de WhatsApp
      supabase
        .from('contas_a_receber')
        .select('id, clientes!cod_cliente(whatsapp, whatsapp_ativo)')
        .eq('data_vencimento', em5dias)
        .eq('pago', false)
        .eq('msg_5d_enviada', false)
        .or('inadimplente.is.null,inadimplente.eq.false'),

      // Aniversariantes de nascimento hoje sem WhatsApp ativo
      supabase
        .from('clientes')
        .select('id, whatsapp, whatsapp_ativo')
        .like('data_nascimento', `%-${monthDay}`),

      // Aniversariantes de casamento hoje sem WhatsApp ativo
      supabase
        .from('clientes')
        .select('id, whatsapp, whatsapp_ativo')
        .like('data_casamento', `%-${monthDay}`),
    ])

    const semWppCobranca = (p: any) => {
      const cli = p.clientes
      return !cli?.whatsapp || cli?.whatsapp_ativo === false
    }
    const semWppCliente = (c: any) => !c.whatsapp || c.whatsapp_ativo === false

    const excluidos: Record<string, number> = {
      cobranca_dia:          (carDiaRes.data || []).filter(semWppCobranca).length,
      cobranca_5d:           (car5dRes.data  || []).filter(semWppCobranca).length,
      aniversario:           (anivRes.data   || []).filter(semWppCliente).length,
      aniversario_casamento: (casRes.data    || []).filter(semWppCliente).length,
    }

    return NextResponse.json({ hoje, logs: logsRes.data || [], excluidos })
  }

  return NextResponse.json({ erro: 'Aba inválida' }, { status: 400 })
}

// PATCH — atualizar modelo de mensagem
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { id, mensagem, ativo } = await req.json()
  const { data, error } = await supabase
    .from('whatsapp_modelos')
    .update({ mensagem, ativo, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}
