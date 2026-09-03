import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const APP_ID    = '965760143217209'
const GRAPH_URL = 'https://graph.facebook.com/v20.0'

export async function POST(req: NextRequest) {
  const { code, phone_number_id, waba_id } = await req.json()

  if (!code || !phone_number_id || !waba_id) {
    return NextResponse.json(
      { erro: 'Obrigatório: code, phone_number_id, waba_id' },
      { status: 400 }
    )
  }

  const supabase   = await createServerSupabase()
  const APP_SECRET = process.env.META_APP_SECRET

  if (!APP_SECRET) {
    // Salva dados parciais para não perder phone_number_id e waba_id
    await supabase.from('whatsapp_meta_config').insert({
      app_id: APP_ID, phone_number_id, waba_id, status: 'pendente_secret',
    })
    return NextResponse.json(
      {
        ok: false,
        erro: 'META_APP_SECRET não configurado. Configure a variável de ambiente e reconecte.',
        phone_number_id,
        waba_id,
      },
      { status: 400 }
    )
  }

  const tokenRes = await fetch(
    `${GRAPH_URL}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`
  )
  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    return NextResponse.json({ erro: `Falha na troca do code: ${body}` }, { status: 500 })
  }

  const { access_token } = await tokenRes.json()
  const expires_at = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('whatsapp_meta_config')
    .update({ status: 'substituido', updated_at: new Date().toISOString() })
    .eq('status', 'connected')

  const { error } = await supabase.from('whatsapp_meta_config').insert({
    app_id: APP_ID,
    phone_number_id,
    waba_id,
    access_token,
    token_expires_at: expires_at,
    status: 'connected',
  })
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, phone_number_id, waba_id, expires_at })
}
