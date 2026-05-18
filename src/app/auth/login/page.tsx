// src/app/auth/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('Email ou senha incorretos')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0e0c09 0%, #13100c 60%, #0f0d0a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Fundo decorativo */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,175,95,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(212,175,95,0.2), rgba(212,175,95,0.05))',
            border: '1px solid rgba(212,175,95,0.2)',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: '#d4af5f', fontWeight: 700 }}>JS</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700,
            color: '#f5ecd7', letterSpacing: '0.02em', lineHeight: 1,
          }}>
            Jeito de Ser
          </h1>
          <p style={{ color: 'rgba(212,175,95,0.5)', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 6 }}>
            Sistema de Gestão
          </p>
        </div>

        {/* Card do formulário */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(212,175,95,0.12)',
          borderRadius: 20, padding: '32px 28px',
          backdropFilter: 'blur(8px)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
            color: '#f5ecd7', marginBottom: 24,
          }}>
            Entrar no sistema
          </h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(212,175,95,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="input"
                style={{ padding: '11px 14px', fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'rgba(212,175,95,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Senha
              </label>
              <input
                type="password" required value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                className="input"
                style={{ padding: '11px 14px', fontSize: 14 }}
              />
            </div>

            {erro && (
              <div style={{
                background: 'rgba(239,107,77,0.1)', border: '1px solid rgba(239,107,77,0.25)',
                borderRadius: 8, padding: '10px 14px',
                color: '#ef6b4d', fontSize: 13,
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                padding: '13px',
                borderRadius: 10,
                background: loading
                  ? 'rgba(212,175,95,0.08)'
                  : 'linear-gradient(135deg, rgba(212,175,95,0.28), rgba(212,175,95,0.12))',
                border: '1px solid rgba(212,175,95,0.3)',
                color: loading ? 'rgba(212,175,95,0.4)' : '#d4af5f',
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
                letterSpacing: '0.04em', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(245,236,215,0.2)' }}>
          Jeito de Ser Ltda. · Ouro Branco, MG
        </p>
      </div>
    </div>
  )
}
