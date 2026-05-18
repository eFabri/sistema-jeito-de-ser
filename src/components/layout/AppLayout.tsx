// src/components/layout/AppLayout.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { id: '/',               label: 'Dashboard',     icon: '⊞', permissao: 'ver_dashboard' },
  { id: '/vendas',         label: 'Vendas / PDV',  icon: '◈', permissao: 'ver_vendas' },
  { id: '/clientes',       label: 'Clientes',      icon: '◉', permissao: 'ver_clientes' },
  { id: '/produtos',       label: 'Produtos',      icon: '◫', permissao: 'ver_produtos' },
  { id: '/financeiro',     label: 'Financeiro',    icon: '◎', permissao: 'ver_financeiro' },
  { id: '/crediario',      label: 'Crediário',     icon: '◈', permissao: 'ver_financeiro' },
  { id: '/compras',        label: 'Compras',       icon: '◐', permissao: 'ver_compras' },
  { id: '/trocas',         label: 'Trocas',        icon: '⇄', permissao: 'ver_vendas' },
  { id: '/relatorios',     label: 'Relatórios',    icon: '▤', permissao: 'ver_relatorios' },
  { id: '/whatsapp',       label: 'WhatsApp',      icon: '◍', permissao: 'ver_whatsapp' },
  { id: '/usuarios',       label: 'Usuários',      icon: '◇', permissao: '__admin__' },
  { id: '/configuracoes',  label: 'Configurações', icon: '⊛', permissao: 'ver_configuracoes' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [perfil, setPerfil] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // /api/perfil roda server-side com o cookie de sessão — mais confiável que
    // chamar supabase.auth.getUser() no browser logo após o login (race condition
    // entre o cookie chegar e o client ler).
    fetch('/api/perfil')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.user_id) setPerfil(d) })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isAdmin = perfil?.perfil === 'admin'
  const navVisivel = NAV.filter(n => {
    if (n.permissao === '__admin__') return isAdmin // só admins veem
    if (isAdmin) return true
    if (!perfil) return false
    return perfil[n.permissao] === true
  })

  const sidebarW = collapsed ? 64 : 220

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: 'linear-gradient(180deg, #0b0a07 0%, #0e0c09 100%)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 12px' : '24px 20px 20px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 8, overflow: 'hidden',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 8 }}>
            <img
              src="/logo.png"
              alt="Jeito de Ser"
              style={{
                width: collapsed ? 40 : 72,
                height: collapsed ? 40 : 72,
                borderRadius: '50%',
                border: '1.5px solid rgba(212,175,95,0.35)',
                boxShadow: '0 2px 12px rgba(212,175,95,0.12)',
                transition: 'width 0.2s, height 0.2s',
              }}
            />
            {!collapsed && (
              <div style={{ fontSize: 10, color: 'rgba(212,175,95,0.5)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
                Gestão & Moda
              </div>
            )}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(212,175,95,0.4)', fontSize: 16, padding: 4,
            position: collapsed ? 'absolute' : 'static',
            top: collapsed ? 6 : 'auto',
            right: collapsed ? 6 : 'auto',
          }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 10px', overflowY: 'auto' }}>
          {navVisivel.map(item => {
            const ativo = pathname === item.id || (item.id !== '/' && pathname.startsWith(item.id))
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.id)}
                title={collapsed ? item.label : undefined}
                className="nav-item"
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '11px 0' : '10px 12px',
                  borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: ativo
                    ? 'linear-gradient(135deg, rgba(212,175,95,0.18), rgba(212,175,95,0.06))'
                    : 'transparent',
                  color: ativo ? '#d4af5f' : 'rgba(245,236,215,0.42)',
                  borderLeft: ativo ? '2px solid #d4af5f' : '2px solid transparent',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: ativo ? 600 : 400,
                  transition: 'background 0.25s ease, color 0.25s ease, border-color 0.25s ease',
                  whiteSpace: 'nowrap', width: '100%',
                }}
                onMouseEnter={e => {
                  if (!ativo) e.currentTarget.style.background = 'rgba(212,175,95,0.05)'
                  if (!ativo) e.currentTarget.style.color = 'rgba(245,236,215,0.85)'
                }}
                onMouseLeave={e => {
                  if (!ativo) e.currentTarget.style.background = 'transparent'
                  if (!ativo) e.currentTarget.style.color = 'rgba(245,236,215,0.42)'
                }}
              >
                <span
                  className={`nav-icon ${ativo ? 'nav-icon-active' : ''}`}
                  style={{ fontSize: 17, flexShrink: 0, display: 'inline-block' }}
                >
                  {item.icon}
                </span>
                {!collapsed && item.label}
              </button>
            )
          })}
        </nav>

        {/* Usuário */}
        <div style={{
          margin: '8px 10px 12px',
          padding: collapsed ? '10px 0' : '12px',
          borderRadius: 12,
          background: 'rgba(212,175,95,0.04)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #d4af5f, #9a7230)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: '#0e0c09', fontWeight: 700, fontFamily: 'var(--font-display)',
          }}>
            {perfil?.nome?.charAt(0) || 'A'}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#f5ecd7', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {perfil?.nome || 'Carregando...'}
              </div>
              <button onClick={handleLogout} style={{
                fontSize: 10, color: 'rgba(212,175,95,0.45)', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
              }}>
                Sair →
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', minWidth: 0 }}>
        {pathname !== '/' && (
          <button
            onClick={() => router.back()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(212,175,95,0.06)',
              border: '1px solid var(--border)',
              color: '#d4af5f',
              padding: '8px 14px', borderRadius: 8,
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', marginBottom: 18,
              letterSpacing: '0.02em',
              transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(212,175,95,0.16)'
              e.currentTarget.style.transform = 'translateX(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(212,175,95,0.06)'
              e.currentTarget.style.transform = 'translateX(0)'
            }}
          >
            ← Voltar
          </button>
        )}
        {/* key={pathname} força remount em troca de rota → re-dispara animação de entrada */}
        <div key={pathname} className="animate-in">
          {children}
        </div>
      </main>
    </div>
  )
}
