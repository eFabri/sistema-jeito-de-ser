// src/app/compras/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'

export default function CompraDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [compra, setCompra] = useState<any>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch(`/api/compras/${params.id}`)
      .then(r => r.json())
      .then(d => { if (d.erro) setErro(d.erro); else setCompra(d) })
  }, [params.id])

  async function deletar() {
    if (!confirm('Excluir esta compra? O estoque será revertido (subtraído).')) return
    const res = await fetch(`/api/compras/${params.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/compras')
    else { const d = await res.json(); alert(d.erro || 'Erro') }
  }

  if (erro) return <AppLayout><div style={{ color: '#ef6b4d' }}>{erro}</div></AppLayout>
  if (!compra) return <AppLayout><div>Carregando...</div></AppLayout>

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#f5ecd7' }}>
              Compra #{compra.id}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {new Date(compra.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {compra.fornecedores?.nome || 'Sem fornecedor'}
            </p>
          </div>
          <button onClick={deletar} style={{
            background: 'rgba(239,107,77,0.08)', border: '1px solid rgba(239,107,77,0.3)',
            color: '#ef6b4d', padding: '10px 18px', borderRadius: 8,
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Excluir Compra
          </button>
        </div>

        {/* RESUMO */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            <Info label="Data" valor={new Date(compra.data + 'T00:00:00').toLocaleDateString('pt-BR')} />
            <Info label="Nº Nota" valor={compra.nota_numero || '—'} />
            <Info label="Grupo / Evento" valor={compra.grupo || compra.evento || '—'} />
            <Info label="Valor Total" valor={BRL(Number(compra.valor_total))} destaque />
          </div>
        </div>

        {/* ITENS */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              {compra.compras_itens?.length || 0} itens
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 130px 130px 100px',
            padding: '10px 20px', background: 'rgba(212,175,95,0.03)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Produto', 'Qtd', 'Custo Unit.', 'Subtotal', 'Estoque'].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>
          {(compra.compras_itens || []).map((item: any, idx: number) => (
            <div key={item.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 130px 130px 100px',
              padding: '12px 20px', alignItems: 'center',
              borderBottom: idx < compra.compras_itens.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
            }}>
              <div style={{ fontSize: 13, color: '#f5ecd7' }}>{item.produto}</div>
              <div style={{ fontSize: 13, color: '#f5ecd7' }}>{item.quantidade}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{BRL(Number(item.valor_unitario))}</div>
              <div style={{ fontSize: 13, color: '#d4af5f', fontWeight: 600 }}>{BRL(Number(item.sub_total))}</div>
              <div style={{ fontSize: 11, color: item.atualiza_estoque ? '#64c88c' : 'var(--text-muted)' }}>
                {item.atualiza_estoque ? '✓ atualizou' : '— não atualiza'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

function Info({ label, valor, destaque }: { label: string; valor: any; destaque?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: destaque ? 18 : 14, color: destaque ? '#d4af5f' : '#f5ecd7', fontWeight: destaque ? 700 : 500, fontFamily: destaque ? 'var(--font-display)' : 'var(--font-body)' }}>
        {valor}
      </div>
    </div>
  )
}
