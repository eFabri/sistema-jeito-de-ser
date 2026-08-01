// src/app/compras/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Search, ChevronRight } from 'lucide-react'

interface Compra {
  id: string
  data: string
  nota_numero: string | null
  valor_total: number
  grupo?: string
  evento?: string
  // new fields from updated API
  fornecedor_nome: string
  qtd_pecas: number
  valor_venda_total: number
  ganho_previsto: number
  status: string
}

const BRL = (v: number) =>
  'R$ ' + (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatarData(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('pt-BR')
}

function StatusBadge({ status }: { status: string }) {
  const isFinalizada = status === 'Finalizada'
  return (
    <span
      style={{
        background: isFinalizada ? 'rgba(201,168,76,0.04)' : 'rgba(255,255,255,0.05)',
        border: isFinalizada ? '1px solid rgba(124,58,237,0.12)' : '1px solid rgba(255,255,255,0.08)',
        color: isFinalizada ? '#C9A84C' : '#a0a0a0',
        borderRadius: 99,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {status || '—'}
    </span>
  )
}

export default function ComprasPage() {
  const router = useRouter()
  const [compras, setCompras] = useState<Compra[]>([])
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

  // Grid columns: Data | Fornecedor | Nota | Qtd | Valor Custo | Valor Venda | Ganho | Status | Ações
  const gridCols = '110px 1fr 100px 60px 120px 120px 120px 110px 36px'

  const headers = ['Data', 'Fornecedor', 'Nota Fiscal', 'Qtd Peças', 'Valor Custo', 'Valor Venda', 'Ganho Previsto', 'Status', '']

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
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
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Search size={13} strokeWidth={1.8} /></span>
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Buscar por número da nota ou fornecedor..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(201,168,76,0.03)',
          }}>
            {headers.map((h, i) => (
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
                gridTemplateColumns: gridCols,
                padding: '13px 20px',
                borderBottom: i < compras.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                cursor: 'pointer',
                alignItems: 'center',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Data */}
              <div style={{ fontSize: 12, color: '#332F3A' }}>{formatarData(c.data)}</div>

              {/* Fornecedor */}
              <div style={{ fontSize: 13, color: '#332F3A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.fornecedor_nome || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>

              {/* Nota Fiscal */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {c.nota_numero ? `NF ${c.nota_numero}` : '—'}
              </div>

              {/* Qtd Peças */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                {c.qtd_pecas ?? '—'}
              </div>

              {/* Valor Custo */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                {BRL(Number(c.valor_total))}
              </div>

              {/* Valor Venda */}
              <div style={{ fontSize: 12, color: '#332F3A', textAlign: 'right' }}>
                {BRL(Number(c.valor_venda_total))}
              </div>

              {/* Ganho Previsto */}
              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C', textAlign: 'right' }}>
                {BRL(Number(c.ganho_previsto))}
              </div>

              {/* Status */}
              <div>
                <StatusBadge status={c.status} />
              </div>

              {/* Ações */}
              <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}><ChevronRight size={16} strokeWidth={1.5} /></div>
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
              Próxima <ChevronRight size={13} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
