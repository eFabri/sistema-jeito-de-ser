// src/app/usuarios/page.tsx — listagem de usuários
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Circle, ChevronRight } from 'lucide-react'

export default function UsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    const data = await res.json()
    if (data.erro) setErro(data.erro)
    else setUsuarios(data.usuarios || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
              Usuários
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {usuarios.length} usuário(s) com acesso ao sistema
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/usuarios/novo')}>
            + Novo Usuário
          </button>
        </div>

        {erro && (
          <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.3)', color: '#E5584A', padding: 12, borderRadius: 8, fontSize: 13 }}>
            {erro === 'Apenas admin'
              ? 'Apenas administradores podem ver/gerenciar usuários.'
              : erro}
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr 140px 120px 90px 44px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(201,168,76,0.03)',
          }}>
            {['Nome', 'Email', 'Cargo', 'Perfil', 'Status', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : usuarios.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.3 }}><Circle size={32} strokeWidth={1} /></div>
              Nenhum usuário cadastrado
            </div>
          ) : usuarios.map((u, i) => (
            <div
              key={u.id}
              onClick={() => router.push(`/usuarios/${u.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.2fr 140px 120px 90px 44px',
                padding: '13px 20px',
                borderBottom: i < usuarios.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.1s',
                alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.05))',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C', fontSize: 15,
                }}>
                  {u.nome?.charAt(0) || '?'}
                </div>
                <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.nome || '—'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email || '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.cargo || '—'}</div>
              <div>
                <span style={{
                  background: u.perfil === 'admin' ? 'rgba(201,168,76,0.15)' : 'rgba(77,158,204,0.1)',
                  color: u.perfil === 'admin' ? '#C9A84C' : '#4D9ECC',
                  border: `1px solid ${u.perfil === 'admin' ? 'rgba(201,168,76,0.3)' : 'rgba(77,158,204,0.2)'}`,
                  borderRadius: 6, padding: '2px 8px', fontSize: 10,
                  fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  {u.perfil === 'admin' ? 'Admin' : 'Funcionário'}
                </span>
              </div>
              <div>
                <span style={{
                  background: u.ativo ? 'rgba(76,175,130,0.1)' : 'rgba(229,88,74,0.08)',
                  color: u.ativo ? '#4CAF82' : '#E5584A',
                  border: `1px solid ${u.ativo ? 'rgba(76,175,130,0.2)' : 'rgba(229,88,74,0.2)'}`,
                  borderRadius: 6, padding: '2px 8px', fontSize: 10,
                  fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}><ChevronRight size={16} strokeWidth={1.5} /></div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
