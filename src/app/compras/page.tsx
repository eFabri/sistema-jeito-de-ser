// src/app/compras/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'

function formatarData(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('pt-BR')
}

export default function ComprasPage() {
  const router = useRouter()
  const [compras, setCompras] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const limite = 25

  const carregar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q: busca, pagina: String(pagina), limite: String(limite) })
    const res = await fetch(`/api/compras?${params}`)
    const data = await res.json()
    setCompras(data.compras || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [busca, pagina])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350)
    return () => clearTimeout(t)
  }, [q])

  const totalPaginas = Math.ceil(total / limite)
  const valorTotal = compras.reduce((s, c) => s + Number(c.valor_total || 0), 0)

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#f5ecd7', letterSpacing: '-0.01em' }}>
              Compras
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {total.toLocaleString('pt-BR')} compras registradas · página soma {BRL(valorTotal)}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/compras/nova')}>
            + Nova Compra
          </button>
        </div>

        <div style={{ position: 'relative', maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>⊙</span>
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Buscar por número da nota ou grupo..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 120px 140px 130px 44px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(212,175,95,0.03)',
          }}>
            {['Data', 'Fornecedor', 'Nota', 'Grupo / Evento', 'Valor', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : compras.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◐</div>
              Nenhuma compra registrada
            </div>
          ) : compras.map((c, i) => (
            <div
              key={c.id}
              onClick={() => router.push(`/compras/${c.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 120px 140px 130px 44px',
                padding: '13px 20px',
                borderBottom: i < compras.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
                cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,95,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 12, color: '#f5ecd7' }}>{formatarData(c.data)}</div>
              <div style={{ fontSize: 13, color: '#f5ecd7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.fornecedor_nome || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {c.nota_numero ? `NF ${c.nota_numero}` : '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.grupo || c.evento || '—'}</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d4af5f' }}>
                {BRL(Number(c.valor_total))}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 16, textAlign: 'right' }}>›</div>
            </div>
          ))}
        </div>

        {totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>
              ‹ Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>
              {pagina} de {totalPaginas}
            </span>
            <button className="btn btn-ghost" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>
              Próxima ›
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
