// src/app/auth/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      background: 'linear-gradient(135deg, #080608 0%, #0c0a0d 60%, #0f0d0a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Fundo decorativo — duas elipses douradas com leve movimento (tema 'tecido') */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%)',
      }} />
      <div className="float" style={{
        position: 'fixed', top: '15%', left: '-10%', width: 320, height: 320,
        background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)',
        pointerEvents: 'none', animationDuration: '8s',
      }} />
      <div className="float" style={{
        position: 'fixed', bottom: '10%', right: '-8%', width: 280, height: 280,
        background: 'radial-gradient(circle, rgba(176,143,212,0.04) 0%, transparent 70%)',
        pointerEvents: 'none', animationDuration: '10s', animationDelay: '1.2s',
      }} />

      <div className="animate-in" style={{ width: '100%', maxWidth: 400, padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="float" style={{
            display: 'inline-block', marginBottom: 18,
            filter: 'drop-shadow(0 8px 24px rgba(201,168,76,0.18))',
          }}>
            <img
              src="/logo.png"
              alt="Jeito de Ser"
              style={{
                width: 110, height: 110, borderRadius: '50%',
                border: '2px solid rgba(201,168,76,0.4)',
                boxShadow: '0 0 0 6px rgba(201,168,76,0.06), 0 0 28px rgba(201,168,76,0.15)',
              }}
            />
          </div>
        </div>

        {/* Card do formulário */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(201,168,76,0.12)',
          borderRadius: 20, padding: '32px 28px',
          backdropFilter: 'blur(8px)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
            color: 'rgba(242,235,217,0.9)', marginBottom: 4,
          }}>
            Bem-vinda ao sistema Jeito de Ser
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
            Entre com suas credenciais para continuar
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(201,168,76,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
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
              <label style={{ fontSize: 11, color: 'rgba(201,168,76,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
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
                background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.25)',
                borderRadius: 8, padding: '10px 14px',
                color: '#E5584A', fontSize: 13,
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
                  ? 'rgba(201,168,76,0.08)'
                  : 'linear-gradient(135deg, rgba(201,168,76,0.28), rgba(201,168,76,0.12))',
                border: '1px solid rgba(201,168,76,0.3)',
                color: loading ? 'rgba(201,168,76,0.4)' : '#C9A84C',
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700,
                letterSpacing: '0.04em', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(242,235,217,0.2)' }}>
          Jeito de Ser Ltda. · Ouro Branco, MG
        </p>
      </div>
    </div>
  )
}
