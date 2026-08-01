// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Mapeamento rota → coluna de permissão em perfis_usuario
const ROTA_PERMISSAO: Record<string, string> = {
  '/financeiro':    'ver_financeiro',
  '/relatorios':    'ver_relatorios',
  '/whatsapp':      'ver_whatsapp',
  '/configuracoes': 'ver_configuracoes',
  '/compras':       'ver_compras',
  '/crediario':     'ver_crediario',
  '/trocas':        'ver_trocas',
  '/vendas':        'ver_vendas',
  '/clientes':      'ver_clientes',
  '/produtos':      'ver_produtos',
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/auth')
  const isCronRoute = pathname.startsWith('/api/whatsapp/cron') || pathname.startsWith('/api/condicionais/alertas')

  if (isCronRoute) return supabaseResponse

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // /usuarios é restrita a admin independente de toggles
  const rotaApenasAdmin = pathname.startsWith('/usuarios')

  // Detecta qual permissão cobre a rota atual
  const rotaKey = Object.keys(ROTA_PERMISSAO).find(r => pathname.startsWith(r))

  if (user && (rotaKey || rotaApenasAdmin)) {
    const { data: perfil } = await supabase
      .from('perfis_usuario')
      .select('perfil, ver_financeiro, ver_relatorios, ver_whatsapp, ver_configuracoes, ver_compras, ver_crediario, ver_trocas, ver_vendas, ver_clientes, ver_produtos')
      .eq('user_id', user.id)
      .single()

    if (perfil) {
      const ehAdmin = perfil.perfil === 'admin'

      // Admin sempre passa
      if (ehAdmin) return supabaseResponse

      // Rota exclusiva de admin (Usuários)
      if (rotaApenasAdmin) {
        const url = new URL('/vendas', request.url)
        url.searchParams.set('acesso_negado', '1')
        return NextResponse.redirect(url)
      }

      // Verifica a permissão específica da rota
      if (rotaKey) {
        const coluna = ROTA_PERMISSAO[rotaKey] as keyof typeof perfil
        if (perfil[coluna] === false) {
          const url = new URL('/vendas', request.url)
          url.searchParams.set('acesso_negado', '1')
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
