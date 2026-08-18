// POST /api/whatsapp/disparo — envia 1 mensagem por vez (o frontend controla o loop)
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { enviarMensagem } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { numero, mensagem, nome } = await req.json()

  if (!numero || !mensagem) {
    return NextResponse.json({ erro: 'numero e mensagem são obrigatórios' }, { status: 400 })
  }

  try {
    await enviarMensagem({ numero, mensagem })

    await supabase.from('whatsapp_logs').insert({
      tipo: 'disparo_manual',
      cod_cliente: null,
      numero,
      mensagem,
      status: 'enviado',
      erro: null,
    })

    return NextResponse.json({ ok: true, nome, numero })
  } catch (e: any) {
    await supabase.from('whatsapp_logs').insert({
      tipo: 'disparo_manual',
      cod_cliente: null,
      numero,
      mensagem,
      status: 'erro',
      erro: e.message,
    })
    return NextResponse.json({ ok: false, erro: e.message, nome, numero }, { status: 200 })
  }
}
