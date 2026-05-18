// src/app/usuarios/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import FormUsuario, { DadosUsuario } from '../_form'

export default function EditarUsuarioPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [inicial, setInicial] = useState<DadosUsuario | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch(`/api/usuarios/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.erro) setErro(d.erro)
        else setInicial(d)
      })
  }, [params.id])

  async function salvar(dados: DadosUsuario) {
    const payload: any = { ...dados }
    // Não envia senha vazia (mantém a atual)
    if (!payload.senha) delete payload.senha
    delete payload.id
    delete payload.email // não permite mudar email
    const res = await fetch(`/api/usuarios/${params.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Erro ao salvar')
    router.push('/usuarios')
  }

  async function deletar() {
    const res = await fetch(`/api/usuarios/${params.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.erro || 'Erro ao deletar')
    router.push('/usuarios')
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 920 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#f5ecd7' }}>
            {inicial?.nome || 'Editar Usuário'}
          </h1>
          {inicial?.email && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{inicial.email}</p>
          )}
        </div>
        {erro && (
          <div style={{ background: 'rgba(239,107,77,0.1)', border: '1px solid rgba(239,107,77,0.3)', color: '#ef6b4d', padding: 12, borderRadius: 8, fontSize: 13 }}>
            {erro}
          </div>
        )}
        {inicial && (
          <FormUsuario inicial={inicial} modo="editar" onSalvar={salvar} onDeletar={deletar} />
        )}
      </div>
    </AppLayout>
  )
}
