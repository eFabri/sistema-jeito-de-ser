// src/components/layout/AppLayout.tsx — Layout principal com sidebar premium
'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavItem { id: string; label: string; icon: string; permissao: string; grupo: 'principal' | 'operacao' | 'admin' }

const NAV: NavItem[] = [
  { id: '/',               label: 'Dashboard',     icon: '⊞', permissao: 'ver_dashboard',       grupo: 'principal' },

  { id: '/vendas',         label: 'Vendas / PDV',  icon: '◈', permissao: 'ver_vendas',          grupo: 'operacao' },
  { id: '/clientes',       label: 'Clientes',      icon: '◉', permissao: 'ver_clientes',        grupo: 'operacao' },
  { id: '/produtos',       label: 'Produtos',      icon: '◫', permissao: 'ver_produtos',        grupo: 'operacao' },
  { id: '/financeiro',     label: 'Financeiro',    icon: '◎', permissao: 'ver_financeiro',      grupo: 'operacao' },
  { id: '/crediario',      label: 'Crediário',     icon: '◈', permissao: 'ver_financeiro',      grupo: 'operacao' },
  { id: '/compras',        label: 'Compras',       icon: '◐', permissao: 'ver_compras',         grupo: 'operacao' },
  { id: '/trocas',         label: 'Trocas',        icon: '⇄', permissao: 'ver_vendas',          grupo: 'operacao' },

  { id: '/relatorios',     label: 'Relatórios',    icon: '▤', permissao: 'ver_relatorios',      grupo: 'admin' },
  { id: '/whatsapp',       label: 'WhatsApp',      icon: '◍', permissao: 'ver_whatsapp',        grupo: 'admin' },
  { id: '/usuarios',       label: 'Usuários',      icon: '◇', permissao: '__admin__',           grupo: 'admin' },
  { id: '/configuracoes',  label: 'Configurações', icon: '⊛', permissao: 'ver_configuracoes',   grupo: 'admin' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [perfil, setPerfil] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    fetch('/api/perfil')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.user_id) setPerfil(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchParams.get('acesso_negado') === '1') {
      setToastMsg('Acesso restrito a administradores')
      setTimeout(() => setToastMsg(''), 4000)
    }
  }, [searchParams])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const isAdmin = perfil?.perfil === 'admin'
  const navVisivel = NAV.filter(n => {
    if (n.permissao === '__admin__') return isAdmin
    if (isAdmin) return true
    if (!perfil) return false
    return perfil[n.permissao] === true
  })

  const sidebarW = collapsed ? 64 : 230

  // Agrupa items pra renderizar com separadores
  const grupos: Record<NavItem['grupo'], NavItem[]> = { principal: [], operacao: [], admin: [] }
  for (const it of navVisivel) grupos[it.grupo].push(it)

  const nomeExibido = perfil?.apelido || perfil?.nome?.split(' ')[0] || ''
  const initialUser = perfil?.nome?.charAt(0) || 'A'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>

      {/* ─── SIDEBAR ───────────────────────────────────────── */}
      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: 'linear-gradient(180deg, #060507 0%, #09070A 100%)',
        borderRight: '1px solid rgba(201,168,76,0.12)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.3s var(--ease-premium)',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        zIndex: 10,
      }}>
        {/* Separador superior dourado */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)',
        }} />

        {/* ── Brand ─────────────────────────────────────────── */}
        <div style={{
          padding: collapsed ? '22px 12px' : '24px 22px 20px',
          borderBottom: '1px solid rgba(201,168,76,0.10)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          gap: 10, position: 'relative',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, minWidth: 0 }}>
            <img
              src="/logo.png"
              alt="Jeito de Ser"
              style={{
                width: collapsed ? 40 : 48, height: collapsed ? 40 : 48,
                borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.4)',
                boxShadow: '0 2px 12px rgba(201,168,76,0.18)',
                transition: 'all 0.3s var(--ease-premium)',
              }}
            />
            {!collapsed && (
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 24, fontWeight: 700,
                color: 'var(--gold)',
                letterSpacing: '0.01em', lineHeight: 1.05,
                marginTop: 10,
              }}>
                Jeito de Ser
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir' : 'Recolher menu'}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(201,168,76,0.4)', fontSize: 15, padding: 4,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(201,168,76,0.4)')}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* ── Nav ───────────────────────────────────────────── */}
        <nav style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', gap: 2,
          padding: '12px 10px', overflowY: 'auto',
        }}>
          {(['principal', 'operacao', 'admin'] as const).map((grupo, idxGrupo) => (
            grupos[grupo].length > 0 && (
              <div key={grupo}>
                {idxGrupo > 0 && !collapsed && (
                  <div style={{
                    margin: '10px 8px 6px',
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.10), transparent)',
                  }} />
                )}
                {idxGrupo > 0 && collapsed && (
                  <div style={{
                    margin: '8px auto',
                    width: 24, height: 1,
                    background: 'rgba(201,168,76,0.15)',
                  }} />
                )}
                {grupos[grupo].map(item => {
                  const ativo = pathname === item.id || (item.id !== '/' && pathname.startsWith(item.id))
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.id)}
                      title={collapsed ? item.label : undefined}
                      className="nav-item"
                      style={{
                        position: 'relative',
                        display: 'flex', alignItems: 'center',
                        gap: collapsed ? 0 : 11,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        padding: collapsed ? '11px 0' : '10px 14px',
                        borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: ativo
                          ? 'linear-gradient(135deg, rgba(201,168,76,0.16), rgba(201,168,76,0.05))'
                          : 'transparent',
                        color: ativo ? 'var(--gold-light)' : 'rgba(242,235,217,0.42)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 13, fontWeight: ativo ? 600 : 400,
                        transition: 'background 0.25s ease, color 0.25s ease',
                        whiteSpace: 'nowrap', width: '100%',
                      }}
                      onMouseEnter={e => {
                        if (!ativo) {
                          e.currentTarget.style.background = 'rgba(201,168,76,0.05)'
                          e.currentTarget.style.color = 'rgba(242,235,217,0.85)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!ativo) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'rgba(242,235,217,0.42)'
                        }
                      }}
                    >
                      {/* Indicador esquerdo dourado */}
                      {ativo && (
                        <span style={{
                          position: 'absolute', left: 0, top: 6, bottom: 6,
                          width: 2,
                          background: 'linear-gradient(180deg, var(--gold-light), var(--gold))',
                          borderRadius: 2,
                        }} />
                      )}
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
              </div>
            )
          ))}
        </nav>

        {/* ── Usuário (rodapé) ──────────────────────────────── */}
        <div style={{
          margin: '8px 10px 14px',
          padding: collapsed ? '10px 0' : '12px 14px',
          borderRadius: 12,
          background: 'rgba(201,168,76,0.04)',
          border: '1px solid rgba(201,168,76,0.12)',
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: '#1a1610', fontWeight: 700,
            fontFamily: 'var(--font-display)',
            boxShadow: '0 2px 8px rgba(201,168,76,0.25), inset 0 -1px 0 rgba(0,0,0,0.15)',
          }}>
            {initialUser.toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, color: 'var(--text-primary)', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {nomeExibido || 'Carregando...'}
              </div>
              <button onClick={handleLogout} style={{
                fontSize: 10, color: 'rgba(201,168,76,0.55)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, textAlign: 'left', fontFamily: 'var(--font-body)',
                letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600,
                transition: 'color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold-light)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(201,168,76,0.55)')}
              >
                Sair →
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── CONTEÚDO PRINCIPAL ────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', minWidth: 0, position: 'relative', zIndex: 1 }}>
        {toastMsg && (
          <div style={{
            position: 'fixed', top: 20, right: 24, zIndex: 9999,
            background: 'rgba(229,88,74,0.12)', border: '1px solid rgba(229,88,74,0.3)',
            borderRadius: 10, padding: '12px 18px',
            color: '#E5584A', fontSize: 13, fontWeight: 600,
            backdropFilter: 'blur(8px)',
            animation: 'silkFade 0.3s ease forwards',
          }}>
            ⚠ {toastMsg}
          </div>
        )}
        {pathname !== '/' && (
          <button
            onClick={() => router.back()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(201,168,76,0.06)',
              border: '1px solid var(--border)',
              color: 'var(--gold-light)',
              padding: '8px 14px', borderRadius: 8,
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', marginBottom: 18,
              letterSpacing: '0.02em',
              transition: 'all 0.2s var(--ease-silk)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(201,168,76,0.16)'
              e.currentTarget.style.transform = 'translateX(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(201,168,76,0.06)'
              e.currentTarget.style.transform = 'translateX(0)'
            }}
          >
            ← Voltar
          </button>
        )}
        <div key={pathname} className="animate-in">
          {children}
        </div>
      </main>
    </div>
  )
}
