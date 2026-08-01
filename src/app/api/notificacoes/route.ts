import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(request.url)

  if (searchParams.get('count') === '1') {
    const { count } = await supabase
      .from('notificacoes')
      .select('*', { count: 'exact', head: true })
      .eq('lida', false)
    return NextResponse.json({ count: count ?? 0 })
  }

  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ notificacoes: data ?? [] })
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase()
  const body = await request.json()

  if (body.todos) {
    await supabase.from('notificacoes').update({ lida: true }).eq('lida', false)
  } else if (body.id) {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', body.id)
  }

  return NextResponse.json({ ok: true })
}
