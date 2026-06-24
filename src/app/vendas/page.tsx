// src/app/vendas/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function Badge({ text }: { text: string }) {
  const cores: any = {
    'Venda':          { bg: 'rgba(76,175,130,0.1)',  c: '#4CAF82', b: 'rgba(76,175,130,0.2)' },
    'Venda Direta':   { bg: 'rgba(201,168,76,0.1)',   c: '#C9A84C', b: 'rgba(201,168,76,0.2)' },
    'Cancelada':      { bg: 'rgba(229,88,74,0.1)',   c: '#E5584A', b: 'rgba(229,88,74,0.25)' },
  }
  const s = cores[text] || cores['Venda']
  return (
    <span style={{ background: s.bg, color: s.c, border: `1px solid ${s.b}`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {text}
    </span>
  )
}

export default function VendasPage() {
  const router = useRouter()
  const [vendas, setVendas] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [busca, setBusca] = useState('')
  const [data, setData] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const limite = 25

  const buscar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q: busca, pagina: String(pagina), limite: String(limite), ...(data && { data }) })
    const res = await fetch(`/api/vendas?${params}`)
    const d = await res.json()
    setVendas(d.vendas || [])
    setTotal(d.total || 0)
    setLoading(false)
  }, [busca, pagina, data])

  useEffect(() => { buscar() }, [buscar])
  useEffect(() => { const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350); return () => clearTimeout(t) }, [q])

  const totalPaginas = Math.ceil(total / limite)

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#F2EBD9' }}>Vendas</h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>{total.toLocaleString('pt-BR')} vendas registradas</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')}>+ Nova Venda</button>
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>⊙</span>
            <input className="input" style={{ paddingLeft: 34 }} placeholder="Buscar por cliente..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <input type="date" className="input" style={{ width: 160 }} value={data} onChange={e => { setData(e.target.value); setPagina(1) }} />
          {data && <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => setData('')}>Limpar data</button>}
        </div>

        {/* TABELA */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px 120px 130px 80px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
            {['Nº', 'Cliente', 'Data', 'Forma', 'Total', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : vendas.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◈</div>
              Nenhuma venda encontrada
            </div>
          ) : vendas.map((v, i) => (
            <div key={v.id} onClick={() => router.push(`/vendas/${v.id}`)}
              style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px 120px 130px 80px', padding: '13px 20px', borderBottom: i < vendas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{v.codigo_legado || v.id}</div>
              <div>
                <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome_cliente}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.vendedor || '—'}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fmtData(v.data)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.forma_pagamento || '—'}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>{BRL(v.valor_total)}</div>
              <Badge text={v.situacao} />
            </div>
          ))}
        </div>

        {totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>‹ Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>{pagina} de {totalPaginas}</span>
            <button className="btn btn-ghost" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>Próxima ›</button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
