// src/app/trocas/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'

export default function TrocaDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [troca, setTroca] = useState<any>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch(`/api/trocas/${params.id}`)
      .then(r => r.json())
      .then(d => { if (d.erro) setErro(d.erro); else setTroca(d) })
  }, [params.id])

  async function excluir() {
    if (!confirm('Excluir esta troca? O estoque será revertido.')) return
    const res = await fetch(`/api/trocas/${params.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/trocas')
    else { const d = await res.json(); alert(d.erro || 'Erro') }
  }

  if (erro) return <AppLayout><div style={{ color: '#ef6b4d' }}>{erro}</div></AppLayout>
  if (!troca) return <AppLayout><div>Carregando...</div></AppLayout>

  const devolvidos = (troca.vendas_trocas_itens || []).filter((i: any) => Number(i.valor) < 0)
  const novos      = (troca.vendas_trocas_itens || []).filter((i: any) => Number(i.valor) >= 0)
  const diff = Number(troca.diferenca || 0)

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#f5ecd7' }}>
              Troca #{troca.id}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {new Date(troca.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {troca.nome_cliente}
              {troca.cod_venda_orig && ` · referente à venda #${troca.cod_venda_orig}`}
            </p>
          </div>
          <button onClick={excluir} style={{
            background: 'rgba(239,107,77,0.08)', border: '1px solid rgba(239,107,77,0.3)',
            color: '#ef6b4d', padding: '10px 18px', borderRadius: 8,
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Excluir Troca
          </button>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            <Info label="Devolvido" valor={BRL(Number(troca.valor_original))} cor="#ef6b4d" />
            <Info label="Novos" valor={BRL(Number(troca.valor_troca))} cor="#64c88c" />
            <Info label={diff > 0 ? 'Cliente pagou +' : diff < 0 ? 'Crédito ao cliente' : 'Diferença'} valor={BRL(Math.abs(diff))} cor={diff > 0 ? '#d4af5f' : '#5eaadf'} destaque />
          </div>
          {troca.observacao && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>Observação:</strong> {troca.observacao}
            </div>
          )}
        </div>

        {devolvidos.length > 0 && (
          <SecaoItens titulo="Devolvidos" cor="#ef6b4d" itens={devolvidos} />
        )}
        {novos.length > 0 && (
          <SecaoItens titulo="Novos" cor="#64c88c" itens={novos} />
        )}
      </div>
    </AppLayout>
  )
}

function Info({ label, valor, cor, destaque }: { label: string; valor: any; cor?: string; destaque?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: destaque ? 22 : 16, color: cor || '#f5ecd7', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{valor}</div>
    </div>
  )
}

function SecaoItens({ titulo, cor, itens }: { titulo: string; cor: string; itens: any[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 13, color: cor, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{titulo}</h2>
      </div>
      {itens.map((it, idx) => (
        <div key={it.id} style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 120px 120px',
          padding: '12px 20px', alignItems: 'center',
          borderBottom: idx < itens.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
        }}>
          <div style={{ fontSize: 13, color: '#f5ecd7' }}>{it.produto}</div>
          <div style={{ fontSize: 13, color: '#f5ecd7' }}>{it.quantidade}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{BRL(Math.abs(Number(it.valor)))}</div>
          <div style={{ fontSize: 13, color: cor, fontWeight: 600 }}>
            {BRL(Math.abs(Number(it.valor)) * Number(it.quantidade))}
          </div>
        </div>
      ))}
    </div>
  )
}
