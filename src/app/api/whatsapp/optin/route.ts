// src/app/api/whatsapp/optin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Verifica sessão ativa e permissão ver_whatsapp (ou admin).
// Retorna { erro, status } se acesso negado, ou { user } se ok.
async function verificarAcesso() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: 'Não autenticado', status: 401 as const }

  const { data: perfil } = await supabase
    .from('perfis_usuario')
    .select('perfil, ver_whatsapp')
    .eq('user_id', user.id)
    .single()

  if (!perfil) return { erro: 'Perfil não encontrado', status: 403 as const }
  if (perfil.perfil !== 'admin' && !perfil.ver_whatsapp) {
    return { erro: 'Sem permissão para acessar WhatsApp', status: 403 as const }
  }

  return { user, supabase }
}

// GET /api/whatsapp/optin?q=nome&somente_sem_optin=true&pagina=1&limite=50
export async function GET(req: NextRequest) {
  const auth = await verificarAcesso()
  if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const q               = searchParams.get('q') || ''
  const somenteSemOptin = searchParams.get('somente_sem_optin') === 'true'
  const pagina          = parseInt(searchParams.get('pagina') || '1')
  const limite          = parseInt(searchParams.get('limite') || '50')
  const offset          = (pagina - 1) * limite

  let query = supabase
    .from('clientes')
    .select(
      'id, nome, whatsapp, celular, whatsapp_marketing_optin, whatsapp_marketing_optin_data, categoria',
      { count: 'exact' }
    )
    .eq('ativo', true)
    .not('whatsapp', 'is', null)
    .order('nome', { ascending: true })
    .range(offset, offset + limite - 1)

  if (q) {
    query = query.or(`nome.ilike.%${q}%,whatsapp.ilike.%${q}%`)
  }
  if (somenteSemOptin) {
    query = query.eq('whatsapp_marketing_optin', false)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ clientes: data, total: count, pagina, limite })
}

// PATCH /api/whatsapp/optin — atualizar opt-in individual ou em lote
// Body: { ids: number[], optin: boolean }
export async function PATCH(req: NextRequest) {
  const auth = await verificarAcesso()
  if ('erro' in auth) return NextResponse.json({ erro: auth.erro }, { status: auth.status })

  const supabase = await createServerSupabase()
  const { ids, optin }: { ids: number[]; optin: boolean } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ erro: 'ids é obrigatório e deve ser array não vazio' }, { status: 400 })
  }

  const agora = optin ? new Date().toISOString() : null

  const { error } = await supabase
    .from('clientes')
    .update({
      whatsapp_marketing_optin:      optin,
      whatsapp_marketing_optin_data: agora,
    })
    .in('id', ids)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, atualizados: ids.length })
}
