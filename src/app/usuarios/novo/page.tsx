// src/app/usuarios/novo/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import FormUsuario, { defaultsUsuario, DadosUsuario } from '../_form'

export default function NovoUsuarioPage() {
  const router = useRouter()

  async function criar(dados: DadosUsuario) {
    const res = await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Erro ao criar')
    router.push('/usuarios')
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 920 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#F2EBD9' }}>
          Novo Usuário
        </h1>
        <FormUsuario inicial={defaultsUsuario()} modo="novo" onSalvar={criar} />
      </div>
    </AppLayout>
  )
}
