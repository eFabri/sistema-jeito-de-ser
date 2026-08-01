'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtDataHora(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    aberta:     { label: 'Aberta',     color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
    confirmada: { label: 'Confirmada', color: '#4CAF82', bg: 'rgba(76,175,130,0.12)' },
    devolvida:  { label: 'Devolvida',  color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
  }
  const s = map[status] || map.aberta
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: s.bg, color: s.color, letterSpacing: '0.04em', border: `1px solid ${s.color}30` }}>
      {s.label}
    </span>
  )
}

export default function CondicionaisPage() {
  const router = useRouter()
  const [condicionais, setCondicionais] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('aberta')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/condicionais${filtro ? `?status=${filtro}` : ''}`)
      .then(r => r.json())
      .then(d => { setCondicionais(d.condicionais || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filtro])

  const agora = new Date()

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
              Condicionais
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              Saídas condicionais — cliente leva para experimentar e confirma em 24h
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')}>
            + Nova Saída Condicional
          </button>
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start' }}>
          {[
            { value: '', label: 'Todas' },
            { value: 'aberta', label: 'Abertas' },
            { value: 'confirmada', label: 'Confirmadas' },
            { value: 'devolvida', label: 'Devolvidas' },
          ].map((f, i, arr) => (
            <button key={f.value} onClick={() => setFiltro(f.value)}
              style={{
                padding: '7px 16px',
                background: filtro === f.value ? 'rgba(201,168,76,0.15)' : 'none',
                color: filtro === f.value ? '#C9A84C' : 'var(--text-muted)',
                border: 'none',
                borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 32, textAlign: 'center' }}>Carregando...</div>
        ) : condicionais.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 40, color: 'var(--gold-dim)', marginBottom: 12 }}>◑</div>
            <p style={{ fontSize: 15, color: '#332F3A', marginBottom: 8 }}>Nenhuma condicional encontrada</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              No PDV, selecione &quot;Saída Condicional&quot; para registrar
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Cabeçalho */}
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 160px 110px 100px', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              {['#', 'Cliente / Vendedor', 'Retorno previsto', 'Total', 'Status'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {condicionais.map(c => {
              const itens = c.vendas_condicionais_itens || []
              const total = itens.reduce((s: number, i: any) => s + i.preco_venda * i.quantidade, 0)
              const vencida = c.status === 'aberta' && c.data_retorno_prevista && new Date(c.data_retorno_prevista) < agora
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/condicionais/${c.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '70px 1fr 160px 110px 100px', gap: 12, padding: '13px 18px', borderBottom: '1px solid rgba(201,168,76,0.05)', cursor: 'pointer', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{c.id}</span>
                    {c.alerta_enviado && c.status === 'aberta' && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E5584A', flexShrink: 0 }} title="Alerta enviado" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 600 }}>{c.nome_cliente}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {c.vendedor || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: vencida ? '#E5584A' : '#332F3A' }}>
                      {fmtDataHora(c.data_retorno_prevista)}
                    </div>
                    {vencida && (
                      <div style={{ fontSize: 10, color: '#E5584A', fontWeight: 700, marginTop: 2 }}>VENCIDA</div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>
                    {BRL(total)}
                  </div>
                  <div><StatusBadge status={c.status} /></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
