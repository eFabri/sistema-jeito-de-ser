// src/app/crediario/page.tsx — Aba dedicada ao Crediário
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const formatarData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

export default function CrediarioPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [q, setQ] = useState('')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'aberto' | 'atraso'>('aberto')

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/crediario?q=${encodeURIComponent(busca)}`)
    const d = await res.json()
    setData(d)
    setLoading(false)
  }, [busca])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const t = setTimeout(() => setBusca(q), 350)
    return () => clearTimeout(t)
  }, [q])

  if (loading && !data) return (
    <AppLayout>
      <div style={{ padding: 32, color: 'var(--text-muted)' }}>Carregando crediário...</div>
    </AppLayout>
  )

  const todos: any[] = data?.clientes || []
  const filtrados = filtro === 'aberto'
    ? todos.filter(c => c.em_aberto > 0)
    : filtro === 'atraso'
    ? todos.filter(c => c.em_atraso > 0)
    : todos
  const totais = data?.totais || {}

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* HEADER */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#F2EBD9', letterSpacing: '-0.01em' }}>
            Crediário
          </h1>
          <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
            Acompanhamento de clientes do crediário · compras, parcelas e peças
          </p>
        </div>

        {/* MÉTRICAS GERAIS */}
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Metrica label="Em aberto" valor={BRL(totais.em_aberto_total || 0)} sub={`${totais.clientes_com_aberto || 0} cliente(s)`} cor="#C9A84C" destaque />
          <Metrica label="Em atraso" valor={BRL(totais.em_atraso_total || 0)} sub={`${totais.clientes_em_atraso || 0} cliente(s) inadimplentes`} cor="#E5584A" />
          <Metrica label="Clientes ativos" valor={String(todos.length)} sub="com histórico de crediário" cor="#4D9ECC" />
          <Metrica label="Ticket médio em aberto" valor={BRL((totais.em_aberto_total || 0) / Math.max(1, totais.clientes_com_aberto || 1))} sub="por cliente" cor="#4CAF82" />
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>⊙</span>
            <input
              className="input"
              style={{ paddingLeft: 34 }}
              placeholder="Buscar por nome ou telefone..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          {([['aberto', 'Em aberto'], ['atraso', 'Em atraso'], ['todos', 'Todos']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)} style={{
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${filtro === id ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
              background: filtro === id ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.02)',
              color: filtro === id ? '#C9A84C' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
            }}>{label}</button>
          ))}
        </div>

        {/* LISTA */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 130px 130px 140px 44px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(201,168,76,0.03)',
          }}>
            {['Cliente', 'Em aberto', 'Em atraso', 'Já pago', 'Próx. vencimento', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {filtrados.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              {filtro === 'atraso' ? 'Nenhum cliente em atraso 🎉' :
               filtro === 'aberto' ? 'Nenhum cliente com saldo em aberto' :
               'Nenhum cliente'}
            </div>
          ) : filtrados.map((c, i) => (
            <div
              key={c.cod_cliente}
              onClick={() => router.push(`/crediario/${c.cod_cliente}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 130px 130px 130px 140px 44px',
                padding: '13px 20px',
                borderBottom: i < filtrados.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                cursor: 'pointer', alignItems: 'center', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.05))',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C', fontSize: 15,
                }}>
                  {c.nome?.charAt(0) || '?'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nome}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {c.celular || '—'}{c.cidade ? ` · ${c.cidade}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: c.em_aberto > 0 ? '#C9A84C' : 'var(--text-muted)' }}>
                {c.em_aberto > 0 ? BRL(c.em_aberto) : '—'}
                {c.parcelas_em_aberto > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                    {c.parcelas_em_aberto} parcela(s)
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.em_atraso > 0 ? '#E5584A' : 'var(--text-muted)' }}>
                {c.em_atraso > 0 ? BRL(c.em_atraso) : '—'}
                {c.parcelas_em_atraso > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                    {c.parcelas_em_atraso} em atraso
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {c.pago_acumulado > 0 ? BRL(c.pago_acumulado) : '—'}
              </div>
              <div style={{ fontSize: 12, color: c.proxima_vencimento && c.proxima_vencimento < new Date().toISOString().split('T')[0] ? '#E5584A' : '#F2EBD9' }}>
                {formatarData(c.proxima_vencimento)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 16, textAlign: 'right' }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

function Metrica({ label, valor, sub, cor, destaque }: { label: string; valor: string; sub: string; cor: string; destaque?: boolean }) {
  return (
    <div className="card">
      <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: destaque ? 28 : 22, fontWeight: 700, color: cor, lineHeight: 1 }}>
        {valor}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
    </div>
  )
}
