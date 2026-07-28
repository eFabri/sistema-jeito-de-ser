// src/components/layout/AppLayout.tsx — Claymorphism layout
'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus'
import {
  LayoutDashboard, ShoppingBag, PackageCheck, Users, Package,
  Wallet, Receipt, CreditCard, ShoppingCart, RefreshCw,
  BarChart3, MessageCircle, UserCog, Settings, AlertCircle,
  ChevronLeft, ChevronRight, AlertTriangle, ArrowLeft, LogOut,
  Banknote,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import PageTransition from '@/components/layout/PageTransition'

interface NavItem {
  id: string
  label: string
  Icon: LucideIcon
  permissao: string
  grupo: 'principal' | 'operacao' | 'admin'
  badgeKey?: string
}

const NAV: NavItem[] = [
  { id: '/',                 label: 'Dashboard',        Icon: LayoutDashboard, permissao: 'ver_dashboard',    grupo: 'principal' },
  { id: '/vendas',           label: 'Vendas / PDV',     Icon: ShoppingBag,     permissao: 'ver_vendas',       grupo: 'operacao' },
  { id: '/condicionais',     label: 'Condicionais',     Icon: PackageCheck,    permissao: 'ver_vendas',       grupo: 'operacao', badgeKey: 'condicionais' },
  { id: '/clientes',         label: 'Clientes',         Icon: Users,           permissao: 'ver_clientes',     grupo: 'operacao' },
  { id: '/produtos',         label: 'Produtos',         Icon: Package,         permissao: 'ver_produtos',     grupo: 'operacao' },
  { id: '/financeiro',       label: 'Financeiro',       Icon: Wallet,          permissao: 'ver_financeiro',   grupo: 'operacao' },
  { id: '/caixa',            label: 'Caixa',            Icon: Banknote,        permissao: 'ver_financeiro',   grupo: 'operacao' },
  { id: '/contas-a-receber', label: 'Contas a Receber', Icon: Receipt,         permissao: 'ver_financeiro',   grupo: 'operacao', badgeKey: 'contasReceber' },
  { id: '/crediario',        label: 'Crediário',        Icon: CreditCard,      permissao: 'ver_crediario',    grupo: 'operacao' },
  { id: '/compras',          label: 'Compras',          Icon: ShoppingCart,    permissao: 'ver_compras',      grupo: 'operacao' },
  { id: '/trocas',           label: 'Trocas',           Icon: RefreshCw,       permissao: 'ver_trocas',       grupo: 'operacao' },
  { id: '/relatorios',       label: 'Relatórios',       Icon: BarChart3,       permissao: 'ver_relatorios',   grupo: 'admin' },
  { id: '/whatsapp',         label: 'WhatsApp',         Icon: MessageCircle,   permissao: 'ver_whatsapp',     grupo: 'admin' },
  { id: '/usuarios',         label: 'Usuários',         Icon: UserCog,         permissao: '__admin__',        grupo: 'admin' },
  { id: '/configuracoes',    label: 'Configurações',    Icon: Settings,        permissao: 'ver_configuracoes',grupo: 'admin' },
]

const SECTION_LABELS: Record<NavItem['grupo'], string> = {
  principal: '',
  operacao:  'OPERAÇÕES',
  admin:     'GESTÃO',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [perfil, setPerfil]         = useState<any>(null)
  const [collapsed, setCollapsed]   = useState(false)
  const [toastMsg, setToastMsg]     = useState('')
  const [badges, setBadges]         = useState<Record<string, number>>({})
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    fetch('/api/perfil')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.user_id) setPerfil(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/financeiro?aba=resumo_receber')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.badge != null) setBadges(b => ({ ...b, contasReceber: d.badge })) })
      .catch(() => {})
    fetch('/api/condicionais?badge=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.badge != null) setBadges(b => ({ ...b, condicionais: d.badge })) })
      .catch(() => {})
    fetch('/api/notificacoes?count=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.count != null) setNotifCount(d.count) })
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    if (searchParams.get('acesso_negado') === '1') {
      setToastMsg('Você não tem permissão para acessar este módulo. Fale com a administradora.')
      setTimeout(() => setToastMsg(''), 4000)
    }
  }, [searchParams])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const whatsappStatus = useWhatsAppStatus()
  const isAdmin        = perfil?.perfil === 'admin'
  const navVisivel     = NAV.filter(n => {
    if (n.permissao === '__admin__') return isAdmin
    if (isAdmin) return true
    if (!perfil) return false
    return perfil[n.permissao] === true
  })

  const sidebarW = collapsed ? 64 : 224

  const grupos: Record<NavItem['grupo'], NavItem[]> = { principal: [], operacao: [], admin: [] }
  for (const it of navVisivel) grupos[it.grupo].push(it)

  const nomeExibido = perfil?.apelido || perfil?.nome?.split(' ')[0] || ''
  const initialUser = perfil?.nome?.charAt(0) || 'A'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'transparent', position: 'relative' }}>

      {/* ─── BLOBS ANIMADOS (background fixo) ──────────────── */}
      <div style={{
        position: 'fixed', inset: 0,
        overflow: 'hidden', zIndex: 0, pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute',
          top: '-20%', left: '-10%',
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.30) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'clay-float 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-15%', right: '-5%',
          width: 520, height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.24) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'clay-float-delayed 22s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          top: '35%', right: '28%',
          width: 380, height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'clay-float 30s ease-in-out infinite reverse',
        }} />
      </div>

      {/* ─── SIDEBAR ────────────────────────────────────────── */}
      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: 'rgba(244,241,250,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(124,58,237,0.10)',
        boxShadow: '4px 0 24px rgba(124,58,237,0.08)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.3s var(--ease-premium)',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        zIndex: 10,
      }}>

        {/* ── Brand ─────────────────────────────────────────── */}
        <div style={{
          padding: collapsed ? '20px 12px' : '24px 18px 18px',
          borderBottom: '1px solid rgba(124,58,237,0.08)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10, position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            <div style={{
              width: collapsed ? 34 : 38, height: collapsed ? 34 : 38,
              borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
              transition: 'all 0.3s var(--ease-premium)',
              overflow: 'hidden',
            }}>
              <img
                src="/logo.png"
                alt="Jeito de Ser"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16, fontWeight: 900,
                  background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                }}>
                  Jeito de Ser
                </div>
                <div style={{
                  fontSize: 9, color: 'var(--text-muted)',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontWeight: 600, marginTop: 1,
                }}>
                  Gestão
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir' : 'Recolher menu'}
            style={{
              background: 'rgba(124,58,237,0.08)', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', padding: 4, borderRadius: 8,
              transition: 'background 0.2s', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...(collapsed ? { position: 'absolute', top: 8, right: 8 } : {}),
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.08)')}
          >
            {collapsed
              ? <ChevronRight size={14} />
              : <ChevronLeft size={14} />
            }
          </button>
        </div>

        {/* ── Nav ───────────────────────────────────────────── */}
        <nav style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', gap: 2,
          padding: '10px 8px', overflowY: 'auto',
        }}>
          {(['principal', 'operacao', 'admin'] as const).map((grupo, idxGrupo) => (
            grupos[grupo].length > 0 && (
              <div key={grupo}>
                {idxGrupo > 0 && !collapsed && SECTION_LABELS[grupo] && (
                  <div style={{
                    padding: '12px 10px 4px',
                    fontSize: 9, fontWeight: 700,
                    color: 'rgba(124,58,237,0.50)',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                  }}>
                    {SECTION_LABELS[grupo]}
                  </div>
                )}
                {idxGrupo > 0 && collapsed && (
                  <div style={{
                    margin: '8px auto',
                    height: 1, width: 24,
                    background: 'rgba(124,58,237,0.15)',
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
                        gap: collapsed ? 0 : 10,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        padding: collapsed ? '11px 0' : '9px 12px',
                        borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: ativo ? 'rgba(255,255,255,0.90)' : 'transparent',
                        color: ativo ? 'var(--accent)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 13, fontWeight: ativo ? 600 : 400,
                        boxShadow: ativo ? 'var(--shadow-clay-sm)' : 'none',
                        borderLeft: ativo ? '3px solid #7C3AED' : '3px solid transparent',
                        transition: 'background 0.2s, color 0.2s, box-shadow 0.2s, border-color 0.2s, transform 0.12s var(--ease-spring)',
                        whiteSpace: 'nowrap', width: '100%',
                      }}
                      onMouseEnter={e => {
                        if (!ativo) {
                          e.currentTarget.style.background = 'rgba(124,58,237,0.08)'
                          e.currentTarget.style.color = 'var(--accent)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!ativo) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                        }
                      }}
                    >
                      <span
                        className="nav-icon"
                        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
                      >
                        <item.Icon size={15} strokeWidth={ativo ? 2.5 : 1.8} />
                      </span>
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.badgeKey && (badges[item.badgeKey] || 0) > 0 && (
                            <span style={{
                              background: 'var(--danger)', color: '#fff',
                              borderRadius: 99, fontSize: 10, fontWeight: 700,
                              padding: '1px 6px', lineHeight: 1.5, flexShrink: 0,
                            }}>
                              {badges[item.badgeKey]}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && item.badgeKey && (badges[item.badgeKey] || 0) > 0 && (
                        <span style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'var(--danger)', color: '#fff',
                          borderRadius: 99, fontSize: 9, fontWeight: 700,
                          padding: '1px 4px', lineHeight: 1.4,
                        }}>
                          {badges[item.badgeKey]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          ))}
        </nav>

        {/* ── Condicionais vencidas ─────────────────────────── */}
        {notifCount > 0 && (
          <button
            onClick={() => router.push('/condicionais')}
            title="Condicionais vencidas"
            style={{
              margin: '0 8px 6px',
              padding: collapsed ? '10px 0' : '9px 12px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.20)',
              background: 'rgba(239,68,68,0.06)',
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
          >
            <AlertCircle size={15} strokeWidth={2} color="var(--danger)" style={{ flexShrink: 0 }} />
            {!collapsed && (
              <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600, flex: 1 }}>
                Cond. vencidas
              </span>
            )}
            <span style={{
              background: 'var(--danger)', color: '#fff',
              borderRadius: 99, fontSize: 10, fontWeight: 700,
              padding: '1px 6px', lineHeight: 1.5, flexShrink: 0,
              ...(collapsed ? { position: 'absolute', top: 4, right: 4 } : {}),
            }}>
              {notifCount}
            </span>
          </button>
        )}

        {/* ── Usuário (rodapé) ──────────────────────────────── */}
        <div style={{
          margin: '8px 8px 14px',
          padding: collapsed ? '10px 0' : '11px 12px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.80)',
          border: '1px solid rgba(124,58,237,0.10)',
          boxShadow: 'var(--shadow-clay-sm)',
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#FFFFFF', fontWeight: 900,
            fontFamily: 'var(--font-display)',
            boxShadow: '0 2px 8px rgba(124,58,237,0.30)',
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
                fontSize: 10, color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, textAlign: 'left', fontFamily: 'var(--font-body)',
                letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600,
                transition: 'color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Sair <LogOut size={10} strokeWidth={2} style={{ marginLeft: 2 }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── CONTEÚDO PRINCIPAL ─────────────────────────────── */}
      <main style={{
        flex: 1, overflowY: 'auto', minWidth: 0,
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
      }}>
        {whatsappStatus === 'desconectado' && (
          <div style={{
            background: 'rgba(239,68,68,0.06)',
            borderBottom: '1px solid rgba(239,68,68,0.18)',
            padding: '10px 28px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--danger)',
                animation: 'waPulse 2s infinite',
              }} />
              <span style={{ fontSize: 13, color: 'var(--danger)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                WhatsApp desconectado — mensagens automáticas pausadas
              </span>
            </div>
            <a href="/whatsapp" style={{
              fontSize: 12, color: 'var(--danger)', textDecoration: 'none', fontWeight: 700,
              padding: '4px 12px',
              border: '1px solid rgba(239,68,68,0.28)',
              borderRadius: 8, whiteSpace: 'nowrap',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Reconectar →
            </a>
          </div>
        )}
        <div style={{ flex: 1, padding: '28px 32px' }}>
          {toastMsg && (
            <div style={{
              position: 'fixed', top: 20, right: 24, zIndex: 9999,
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, padding: '12px 18px',
              color: 'var(--danger)', fontSize: 13, fontWeight: 600,
              boxShadow: 'var(--shadow-clay)',
              animation: 'pageEnter 0.3s ease forwards',
            }}>
              <AlertTriangle size={13} strokeWidth={2} style={{ flexShrink: 0 }} /> {toastMsg}
            </div>
          )}
          {pathname !== '/' && (
            <button
              onClick={() => router.back()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.70)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                padding: '7px 14px', borderRadius: 10,
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', marginBottom: 20,
                boxShadow: 'var(--shadow-clay-sm)',
                transition: 'all 0.2s var(--ease-silk)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--accent)'
                e.currentTarget.style.borderColor = 'var(--border-strong)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <ArrowLeft size={13} strokeWidth={2} /> Voltar
            </button>
          )}
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  )
}
