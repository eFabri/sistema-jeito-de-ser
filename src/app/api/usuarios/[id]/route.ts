// src/app/api/usuarios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function exigirAdmin() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: 'Não autenticado', status: 401 as const }
  const { data: perfil } = await supabase
    .from('perfis_usuario').select('perfil').eq('user_id', user.id).single()
  if (perfil?.perfil !== 'admin') return { erro: 'Apenas admin', status: 403 as const }
  return { user }
}

// GET /api/usuarios/[id] — perfil_id (não user_id)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })
  const { id } = await params

  const admin = createAdminClient()
  const { data: perfil, error } = await admin
    .from('perfis_usuario').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 404 })

  const { data: userData } = await admin.auth.admin.getUserById(perfil.user_id)
  return NextResponse.json({ ...perfil, email: userData?.user?.email || null })
}

// PATCH — atualiza perfil + opcionalmente senha
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })
  const { id } = await params
  const body = await req.json()
  const { senha, email, ...perfilDados } = body

  const admin = createAdminClient()
  const { data: perfil, error } = await admin
    .from('perfis_usuario')
    .update({ ...perfilDados, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Atualiza senha/email no Auth se foram passados
  if (senha || email) {
    const updates: any = {}
    if (senha) {
      if (senha.length < 6) return NextResponse.json({ erro: 'senha deve ter ≥ 6 caracteres' }, { status: 400 })
      updates.password = senha
    }
    if (email) updates.email = email
    const { error: errAuth } = await admin.auth.admin.updateUserById(perfil.user_id, updates)
    if (errAuth) return NextResponse.json({ erro: errAuth.message }, { status: 500 })
  }

  return NextResponse.json(perfil)
}

// DELETE — remove perfil + user do Auth
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })
  const { id } = await params

  const admin = createAdminClient()
  // Pega user_id antes de deletar
  const { data: perfil } = await admin
    .from('perfis_usuario').select('user_id').eq('id', id).single()
  if (!perfil) return NextResponse.json({ erro: 'Perfil não encontrado' }, { status: 404 })

  // Impede que admin delete a si mesmo (sem isso, ele se trancaria fora)
  if (perfil.user_id === auth.user.id) {
    return NextResponse.json({ erro: 'Você não pode deletar seu próprio usuário' }, { status: 400 })
  }

  // Deletar do auth.users cascateia pra perfis_usuario via FK on delete cascade
  const { error } = await admin.auth.admin.deleteUser(perfil.user_id)
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
