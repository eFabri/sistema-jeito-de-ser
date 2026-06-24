// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

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
  const isCronRoute = pathname.startsWith('/api/whatsapp/cron')

  // Cron não precisa de auth do usuário
  if (isCronRoute) return supabaseResponse

  // Redirecionar para login se não autenticado
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Redirecionar para dashboard se já logado e tentando acessar login
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Proteção de rotas restritas a admins
  const rotasAdmin = ['/financeiro', '/relatorios', '/configuracoes', '/whatsapp', '/compras', '/usuarios']
  const acessandoRotaAdmin = rotasAdmin.some(r => pathname.startsWith(r))

  if (user && acessandoRotaAdmin) {
    const { data: perfil } = await supabase
      .from('perfis_usuario')
      .select('perfil')
      .eq('user_id', user.id)
      .single()

    if (perfil && perfil.perfil !== 'admin') {
      const url = new URL('/vendas', request.url)
      url.searchParams.set('acesso_negado', '1')
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
