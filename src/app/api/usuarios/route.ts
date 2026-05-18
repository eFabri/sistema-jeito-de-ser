// src/app/api/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Verifica se o usuário logado é admin. Retorna o user_id ou null.
async function exigirAdmin() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: 'Não autenticado', status: 401 as const }
  const { data: perfil } = await supabase
    .from('perfis_usuario').select('perfil').eq('user_id', user.id).single()
  if (perfil?.perfil !== 'admin') return { erro: 'Apenas admin', status: 403 as const }
  return { user }
}

// GET /api/usuarios — lista todos
export async function GET() {
  const auth = await exigirAdmin()
  if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

  const admin = createAdminClient()
  const { data: perfis, error } = await admin
    .from('perfis_usuario')
    .select('*')
    .order('nome', { ascending: true })
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Junta com emails do auth.users
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailPorId = new Map(users.map(u => [u.id, u.email]))
  const usuarios = perfis.map(p => ({ ...p, email: emailPorId.get(p.user_id) || null }))

  return NextResponse.json({ usuarios })
}

// POST /api/usuarios — cria novo usuário (auth + perfil)
export async function POST(req: NextRequest) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

  const body = await req.json()
  const { email, senha, ...perfilDados } = body
  if (!email || !senha) return NextResponse.json({ erro: 'email e senha são obrigatórios' }, { status: 400 })
  if (senha.length < 6) return NextResponse.json({ erro: 'senha deve ter ≥ 6 caracteres' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Cria no Auth
  const { data: userData, error: errAuth } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (errAuth) return NextResponse.json({ erro: errAuth.message }, { status: 500 })

  // 2. Cria perfil
  const { data: perfil, error: errPerfil } = await admin
    .from('perfis_usuario')
    .insert({ user_id: userData.user.id, ...perfilDados })
    .select()
    .single()
  if (errPerfil) {
    // rollback: deleta o user do auth pra não ficar órfão
    await admin.auth.admin.deleteUser(userData.user.id)
    return NextResponse.json({ erro: errPerfil.message }, { status: 500 })
  }

  return NextResponse.json({ ...perfil, email }, { status: 201 })
}
