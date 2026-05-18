// src/app/api/perfil/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null, { status: 401 })

  const { data } = await supabase
    .from('perfis_usuario').select('*').eq('user_id', user.id).single()

  return NextResponse.json({ ...data, email: user.email })
}
