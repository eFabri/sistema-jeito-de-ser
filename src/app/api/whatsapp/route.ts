// src/app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { verificarInstancia, obterQRCode } from '@/lib/whatsapp'

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
    const hoje = new Date().toISOString().split('T')[0]
    const em5  = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]

    const { data: aniv } = await supabase.rpc('aniversariantes_hoje')
    const { data: venc } = await supabase.rpc('vencimentos_proximos', { dias: 7 })

    return NextResponse.json({
      aniversariantes: aniv || [],
      vencimentos: (venc || []).filter((v: any) => v.dias_para_vencer >= 0 && v.dias_para_vencer <= 7),
    })
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
