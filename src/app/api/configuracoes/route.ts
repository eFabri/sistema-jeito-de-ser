// src/app/api/configuracoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const aba = searchParams.get('aba') || 'empresa'

  if (aba === 'empresa') {
    const { data } = await supabase.from('empresa').select('*').single()
    return NextResponse.json({ empresa: data })
  }

  if (aba === 'usuarios') {
    const { data: perfis } = await supabase
      .from('perfis_usuario')
      .select('*, auth_users:user_id(email)')
      .order('created_at')

    // Buscar emails via admin (workaround — pegar do auth)
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const emailMap = Object.fromEntries((users || []).map(u => [u.id, u.email]))

    const resultado = (perfis || []).map(p => ({
      ...p,
      email: emailMap[p.user_id] || '—',
    }))

    return NextResponse.json({ usuarios: resultado })
  }

  return NextResponse.json({ erro: 'Aba inválida' }, { status: 400 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { aba, ...body } = await req.json()

  if (aba === 'empresa') {
    const { data: existing } = await supabase.from('empresa').select('id').single()
    const { data, error } = existing
      ? await supabase.from('empresa').update(body).eq('id', existing.id).select().single()
      : await supabase.from('empresa').insert(body).select().single()
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (aba === 'usuario') {
    const { id, ...perms } = body
    const { data, error } = await supabase
      .from('perfis_usuario').update(perms).eq('id', id).select().single()
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ erro: 'Aba inválida' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { email, senha, nome, cargo, perfil } = await req.json()

  // Criar usuário no Supabase Auth
  const { data: { user }, error: errAuth } = await supabase.auth.admin.createUser({
    email, password: senha, email_confirm: true,
  })

  if (errAuth || !user) return NextResponse.json({ erro: errAuth?.message || 'Erro ao criar usuário' }, { status: 500 })

  // Criar perfil
  const { data, error } = await supabase.from('perfis_usuario').insert({
    user_id: user.id, nome, cargo,
    perfil: perfil || 'funcionario',
    ver_dashboard: true, ver_vendas: true, fazer_vendas: true,
    ver_clientes: true, ver_produtos: true,
    editar_clientes: perfil === 'admin',
    editar_produtos: perfil === 'admin',
    ver_financeiro: perfil === 'admin',
    ver_compras: perfil === 'admin',
    ver_relatorios: perfil === 'admin',
    ver_whatsapp: perfil === 'admin',
    ver_configuracoes: perfil === 'admin',
  }).select().single()

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json({ ...data, email }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { id, user_id } = await req.json()

  await supabase.from('perfis_usuario').update({ ativo: false }).eq('id', id)
  // Não deleta o usuário do Auth para preservar histórico

  return NextResponse.json({ ok: true })
}
