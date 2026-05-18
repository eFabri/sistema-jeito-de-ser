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
  { id: '/compras',        label: 'Compras',       icon: '◐', permissao: 'ver_compras' },
  { id: '/relatorios',     label: 'Relatórios',    icon: '▤', permissao: 'ver_relatorios' },
  { id: '/whatsapp',       label: 'WhatsApp',      icon: '◍', permissao: 'ver_whatsapp' },
  { id: '/configuracoes',  label: 'Configurações', icon: '⊛', permissao: 'ver_configuracoes' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [perfil, setPerfil] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    async function loadPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('perfis_usuario')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setPerfil(data)
    }
    loadPerfil()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isAdmin = perfil?.perfil === 'admin'
  const navVisivel = NAV.filter(n => {
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
          padding: collapsed ? '24px 16px' : '28px 24px 22px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 8, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        }}>
          {!collapsed && (
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, color: '#d4af5f', letterSpacing: '0.03em' }}>
                Jeito de Ser
              </div>
              <div style={{ fontSize: 10, color: 'rgba(212,175,95,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>
                Gestão & Moda
              </div>
            </div>
          )}
          {collapsed && (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#d4af5f' }}>JS</span>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(212,175,95,0.4)', fontSize: 16, padding: 4,
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
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '11px 0' : '10px 12px',
                  borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: ativo
                    ? 'linear-gradient(135deg, rgba(212,175,95,0.18), rgba(212,175,95,0.06))'
                    : 'transparent',
                  color: ativo ? '#d4af5f' : 'rgba(245,236,215,0.38)',
                  borderLeft: ativo ? '2px solid #d4af5f' : '2px solid transparent',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: ativo ? 600 : 400,
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
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
        {children}
      </main>
    </div>
  )
}
