// src/app/relatorios/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const BRL    = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const fmtDia = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''

const CORES = ['#d4af5f', '#64c88c', '#5eaadf', '#f5a623', '#ef6b4d', '#b08fd4', '#f0e68c', '#87ceeb']

const PERIODOS = [
  { id: '7d',    label: 'Últimos 7 dias' },
  { id: '30d',   label: 'Últimos 30 dias' },
  { id: 'mes',   label: 'Este mês' },
  { id: 'mesant',label: 'Mês anterior' },
  { id: 'ano',   label: 'Este ano' },
  { id: 'custom',label: 'Personalizado' },
]

function calcPeriodo(id: string): { ini: string; fim: string } {
  const hoje = new Date()
  const pad  = (n: number) => String(n).padStart(2, '0')
  const fmt  = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

  if (id === '7d') {
    const ini = new Date(hoje); ini.setDate(ini.getDate() - 7)
    return { ini: fmt(ini), fim: fmt(hoje) }
  }
  if (id === '30d') {
    const ini = new Date(hoje); ini.setDate(ini.getDate() - 30)
    return { ini: fmt(ini), fim: fmt(hoje) }
  }
  if (id === 'mes') {
    return { ini: `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-01`, fim: fmt(hoje) }
  }
  if (id === 'mesant') {
    const m = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    const ini = new Date(m.getFullYear(), m.getMonth(), 1)
    return { ini: fmt(ini), fim: fmt(m) }
  }
  if (id === 'ano') {
    return { ini: `${hoje.getFullYear()}-01-01`, fim: fmt(hoje) }
  }
  return { ini: fmt(hoje), fim: fmt(hoje) }
}

// ─── TOOLTIP CUSTOMIZADO ──────────────────────────────────
function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a1610', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-dropdown)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 13, color: p.color || '#f5ecd7', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' && p.name !== 'Qtd' ? BRL(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

// ─── CARD MÉTRICA ─────────────────────────────────────────
function MetricCard({ label, value, sub, gold, alert }: any) {
  return (
    <div className="card">
      <div style={{ fontSize: 10, color: alert ? '#ef6b4d' : 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: alert ? '#ef6b4d' : gold ? '#d4af5f' : '#f5ecd7', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// ─── SEÇÃO COM TÍTULO ─────────────────────────────────────
function Section({ title, children, action, onAction }: any) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: '#f5ecd7' }}>{title}</h3>
        {action && <button onClick={onAction} style={{ fontSize: 11, color: '#d4af5f', background: 'none', border: 'none', cursor: 'pointer' }}>{action} →</button>}
      </div>
      {children}
    </div>
  )
}

// ─── RELATÓRIOS PRINCIPAL ─────────────────────────────────
type TipoRelatorio = 'vendas' | 'produtos' | 'inadimplencia' | 'estoque' | 'vendedoras' | 'inativos' | 'top-clientes'

export default function RelatoriosPage() {
  const router     = useRouter()
  const [relatorio, setRelatorio] = useState<TipoRelatorio>('vendas')
  const [periodo,  setPeriodo]   = useState('mes')
  const [iniCustom, setIniCustom] = useState('')
  const [fimCustom, setFimCustom] = useState('')
  const [data,     setData]      = useState<any>(null)
  const [loading,  setLoading]   = useState(true)

  // Filtros específicos dos novos relatórios
  const [diasInativo, setDiasInativo] = useState(30)
  const [tipoRanking, setTipoRanking] = useState<'mes' | 'trimestre' | 'custom'>('mes')
  const [rankIni, setRankIni] = useState('')
  const [rankFim, setRankFim] = useState('')

  const { ini, fim } = periodo === 'custom'
    ? { ini: iniCustom, fim: fimCustom }
    : calcPeriodo(periodo)

  const carregar = useCallback(async () => {
    if (periodo === 'custom' && (!iniCustom || !fimCustom)) return
    setLoading(true)
    let res: Response
    if (relatorio === 'inativos') {
      res = await fetch(`/api/relatorios/clientes-inativos?dias=${diasInativo}&limit=500`)
    } else if (relatorio === 'top-clientes') {
      if (tipoRanking === 'custom') {
        if (!rankIni || !rankFim) { setLoading(false); return }
        res = await fetch(`/api/relatorios/top-clientes?tipo=custom&ini=${rankIni}&fim=${rankFim}&limit=20`)
      } else {
        res = await fetch(`/api/relatorios/top-clientes?tipo=${tipoRanking}&limit=20`)
      }
    } else {
      const tipoMap: Record<string, string> = {
        vendas: 'vendas_periodo', produtos: 'produtos',
        inadimplencia: 'inadimplencia', estoque: 'estoque', vendedoras: 'vendedoras',
      }
      res = await fetch(`/api/relatorios?tipo=${tipoMap[relatorio]}&ini=${ini}&fim=${fim}`)
    }
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [relatorio, ini, fim, periodo, iniCustom, fimCustom, diasInativo, tipoRanking, rankIni, rankFim])

  useEffect(() => { carregar() }, [carregar])

  const TABS = [
    { id: 'vendas',        label: 'Vendas',       icon: '◈' },
    { id: 'produtos',      label: 'Produtos',     icon: '◫' },
    { id: 'vendedoras',    label: 'Vendedoras',   icon: '◉' },
    { id: 'top-clientes',  label: 'Top Clientes', icon: '♛' },
    { id: 'inativos',      label: 'Inativos',     icon: '◌' },
    { id: 'inadimplencia', label: 'Inadimplência',icon: '⚠' },
    { id: 'estoque',       label: 'Estoque',      icon: '◐' },
  ]

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#f5ecd7' }}>Relatórios</h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {ini && fim ? `${new Date(ini+'T12:00:00').toLocaleDateString('pt-BR')} — ${new Date(fim+'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
            </p>
          </div>
        </div>

        {/* ABAS RELATÓRIO */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, flexWrap: 'wrap', width: 'fit-content' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setRelatorio(tab.id as any)} style={{
              padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              background: relatorio === tab.id ? 'rgba(212,175,95,0.18)' : 'transparent',
              color: relatorio === tab.id ? '#d4af5f' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>
              <span>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* FILTRO PERÍODO (apenas relatórios de vendas/produtos/vendedoras) */}
        {['vendas', 'produtos', 'vendedoras'].includes(relatorio) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id)} style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${periodo === p.id ? 'rgba(212,175,95,0.3)' : 'var(--border)'}`,
                background: periodo === p.id ? 'rgba(212,175,95,0.15)' : 'rgba(255,255,255,0.02)',
                color: periodo === p.id ? '#d4af5f' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              }}>{p.label}</button>
            ))}
            {periodo === 'custom' && (
              <>
                <input type="date" className="input" style={{ width: 150 }} value={iniCustom} onChange={e => setIniCustom(e.target.value)} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>até</span>
                <input type="date" className="input" style={{ width: 150 }} value={fimCustom} onChange={e => setFimCustom(e.target.value)} />
              </>
            )}
          </div>
        )}

        {/* FILTRO INATIVOS — quantos dias sem comprar */}
        {relatorio === 'inativos' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Sem comprar há:</span>
            {[30, 60, 90, 180, 365].map(d => (
              <button key={d} onClick={() => setDiasInativo(d)} style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${diasInativo === d ? 'rgba(212,175,95,0.3)' : 'var(--border)'}`,
                background: diasInativo === d ? 'rgba(212,175,95,0.15)' : 'rgba(255,255,255,0.02)',
                color: diasInativo === d ? '#d4af5f' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              }}>+{d}d</button>
            ))}
          </div>
        )}

        {/* FILTRO TOP CLIENTES — mensal, trimestral ou período personalizado */}
        {relatorio === 'top-clientes' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>Ranking por:</span>
            {([['mes', 'Mês atual'], ['trimestre', 'Trimestre atual'], ['custom', 'Personalizado']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTipoRanking(id)} style={{
                padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${tipoRanking === id ? 'rgba(212,175,95,0.3)' : 'var(--border)'}`,
                background: tipoRanking === id ? 'rgba(212,175,95,0.15)' : 'rgba(255,255,255,0.02)',
                color: tipoRanking === id ? '#d4af5f' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              }}>{label}</button>
            ))}
            {tipoRanking === 'custom' && (
              <>
                <input type="date" className="input" style={{ width: 150 }} value={rankIni} onChange={e => setRankIni(e.target.value)} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>até</span>
                <input type="date" className="input" style={{ width: 150 }} value={rankFim} onChange={e => setRankFim(e.target.value)} />
                {(!rankIni || !rankFim) && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>selecione as duas datas</span>
                )}
              </>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>
            Carregando relatório...
          </div>
        ) : (

          /* ── VENDAS ─────────────────────────────────────── */
          relatorio === 'vendas' && data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 12 }}>
                <MetricCard label="Total de Vendas"    value={BRL(data.totalGeral)}  gold />
                <MetricCard label="Qtd. de Vendas"     value={data.qtdVendas}         sub="transações" />
                <MetricCard label="Ticket Médio"        value={BRL(data.ticketMedio)} />
                <MetricCard label="Média por Dia"       value={BRL(data.porDia?.length ? data.totalGeral / data.porDia.length : 0)} />
              </div>

              {/* Gráfico área — vendas por dia */}
              <Section title="Evolução das Vendas">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.porDia} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"   stopColor="#d4af5f" stopOpacity={0.25} />
                        <stop offset="95%"  stopColor="#d4af5f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,95,0.06)" />
                    <XAxis dataKey="data" tickFormatter={fmtDia} tick={{ fill: 'rgba(245,236,215,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: 'rgba(245,236,215,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipCustom />} />
                    <Area type="monotone" dataKey="total" name="Vendas" stroke="#d4af5f" strokeWidth={2} fill="url(#gradGold)" dot={false} activeDot={{ r: 5, fill: '#d4af5f' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Section>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Qtd de vendas por dia */}
                <Section title="Quantidade de Vendas por Dia">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.porDia} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,95,0.06)" />
                      <XAxis dataKey="data" tickFormatter={fmtDia} tick={{ fill: 'rgba(245,236,215,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(245,236,215,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<TooltipCustom />} />
                      <Bar dataKey="qtd" name="Qtd" fill="rgba(94,170,223,0.6)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Section>

                {/* Pizza — forma de pagamento */}
                <Section title="Por Forma de Pagamento">
                  {data.porForma?.length ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie data={data.porForma} dataKey="total" nameKey="forma" cx="50%" cy="50%" innerRadius={45} outerRadius={75} strokeWidth={0}>
                            {data.porForma.map((_: any, i: number) => (
                              <Cell key={i} fill={CORES[i % CORES.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => BRL(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {data.porForma.slice(0, 6).map((f: any, i: number) => (
                          <div key={f.forma} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[i % CORES.length] }} />
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.forma}</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: '#f5ecd7' }}>{BRL(f.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sem dados</div>}
                </Section>
              </div>
            </div>

          /* ── PRODUTOS ───────────────────────────────────── */
          ) : relatorio === 'produtos' && data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Section title="Produtos Mais Vendidos — Receita">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.produtos?.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,95,0.06)" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: 'rgba(245,236,215,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="produto" width={200} tick={{ fill: 'rgba(245,236,215,0.6)', fontSize: 10 }}
                      tickFormatter={(v: string) => v.length > 26 ? v.substring(0, 26) + '…' : v} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipCustom />} />
                    <Bar dataKey="receita" name="Receita" fill="#d4af5f" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(212,175,95,0.03)', display: 'grid', gridTemplateColumns: '24px 1fr 80px 130px', gap: 12 }}>
                  {['#', 'Produto', 'Qtd', 'Receita'].map(h => (
                    <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {data.produtos?.slice(0, 20).map((p: any, i: number) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 130px', gap: 12, padding: '12px 20px', borderBottom: i < 19 ? '1px solid rgba(212,175,95,0.05)' : 'none', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: '#f5ecd7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.produto}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.qtd} un.</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#d4af5f' }}>{BRL(p.receita)}</div>
                  </div>
                ))}
              </div>
            </div>

          /* ── VENDEDORAS ─────────────────────────────────── */
          ) : relatorio === 'vendedoras' && data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12 }}>
                {data.vendedoras?.map((v: any, i: number) => (
                  <div key={v.vendedor} className="card" style={{ borderColor: i === 0 ? 'rgba(212,175,95,0.3)' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#f5ecd7', fontWeight: 600 }}>{v.vendedor}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{v.qtd} vendas</div>
                      </div>
                      {i === 0 && <span style={{ fontSize: 16 }}>🏆</span>}
                      {i === 1 && <span style={{ fontSize: 16 }}>🥈</span>}
                      {i === 2 && <span style={{ fontSize: 16 }}>🥉</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#d4af5f', marginTop: 10 }}>{BRL(v.total)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Ticket médio: {BRL(v.total / v.qtd)}</div>
                  </div>
                ))}
              </div>

              <Section title="Comparativo de Vendas">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.vendedoras} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,95,0.06)" />
                    <XAxis dataKey="vendedor" tick={{ fill: 'rgba(245,236,215,0.5)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: 'rgba(245,236,215,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipCustom />} />
                    <Bar dataKey="total" name="Total Vendido" radius={[6, 6, 0, 0]}>
                      {data.vendedoras?.map((_: any, i: number) => (
                        <Cell key={i} fill={CORES[i % CORES.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Section>
            </div>

          /* ── INADIMPLÊNCIA ──────────────────────────────── */
          ) : relatorio === 'inadimplencia' && data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
                <MetricCard label="Total Inadimplente" value={BRL(data.totalInadimplente)} alert />
                <MetricCard label="Clientes em Atraso"  value={data.qtdClientes} sub="clientes" alert />
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(212,175,95,0.03)', display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px 80px' }}>
                  {['Cliente', 'Parcelas', 'Max. Atraso', 'Total', 'WhatsApp'].map(h => (
                    <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {data.inadimplentes?.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px 80px', padding: '12px 20px', borderBottom: i < data.inadimplentes.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#f5ecd7', fontWeight: 500, cursor: 'pointer' }}
                        onClick={() => router.push(`/clientes/${item.cliente.id}`)}>
                        {item.cliente.nome?.split(' ').slice(0, 3).join(' ')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.cliente.celular || '—'}</div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.parcelas.length}</div>
                    <div style={{ fontSize: 13, color: '#ef6b4d', fontWeight: 600 }}>{item.maxAtraso}d</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#ef6b4d' }}>{BRL(item.total)}</div>
                    <div>
                      {item.cliente.whatsapp && (
                        <a href={`https://wa.me/55${item.cliente.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: '#64c88c', textDecoration: 'none' }}>
                          Cobrar ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          /* ── ESTOQUE ────────────────────────────────────── */
          ) : relatorio === 'estoque' && data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <MetricCard label="Sem Estoque"    value={data.resumo?.semEstoque} alert sub="produtos zerados" />
                <MetricCard label="Estoque Baixo"  value={data.resumo?.baixo} sub="abaixo do mínimo" />
                <MetricCard label="Estoque OK"     value={data.resumo?.ok} sub="produtos normais" />
              </div>

              {data.semEstoque?.length > 0 && (
                <Section title="🚨 Sem Estoque — Reposição Urgente">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 10 }}>
                    {data.semEstoque.map((p: any) => (
                      <div key={p.id} onClick={() => router.push(`/produtos/${p.id}`)}
                        style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,107,77,0.06)', border: '1px solid rgba(239,107,77,0.2)', cursor: 'pointer' }}>
                        <div style={{ fontSize: 12, color: '#f5ecd7', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.grupo}{p.cor ? ` · ${p.cor}` : ''}{p.tamanho ? ` · ${p.tamanho}` : ''}</div>
                        <div style={{ fontSize: 13, color: '#ef6b4d', fontWeight: 700, marginTop: 6 }}>Estoque: 0 un.</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {data.estoqueBaixo?.length > 0 && (
                <Section title="⚠ Estoque Baixo">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 10 }}>
                    {data.estoqueBaixo.map((p: any) => (
                      <div key={p.id} onClick={() => router.push(`/produtos/${p.id}`)}
                        style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)', cursor: 'pointer' }}>
                        <div style={{ fontSize: 12, color: '#f5ecd7', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.grupo}{p.localizacao ? ` · ${p.localizacao}` : ''}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                          <span style={{ fontSize: 13, color: '#f5a623', fontWeight: 700 }}>Estoque: {p.estoque} un.</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mín: {p.estoque_minimo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          ) : relatorio === 'top-clientes' && data ? (
            <TopClientesBlock data={data} router={router} />
          ) : relatorio === 'inativos' && data ? (
            <InativosBlock data={data} router={router} dias={diasInativo} />
          ) : null
        )}
      </div>
    </AppLayout>
  )
}

// ─── TOP CLIENTES (Ranking) ──────────────────────────────────
function TopClientesBlock({ data, router }: { data: any; router: any }) {
  const ranking: any[] = data.ranking || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Métricas resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
        <MetricCard label="Período"           value={data.label} />
        <MetricCard label="Clientes que compraram" value={data.total_clientes_que_compraram?.toLocaleString('pt-BR') || 0} />
        <MetricCard label="Total no período"  value={BRL(data.total_periodo || 0)} gold />
        <MetricCard label="Top exibidos"      value={`${ranking.length}`} sub="ordenados por valor" />
      </div>

      <Section title="🏆 Ranking dos Clientes que Mais Compraram">
        {ranking.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
            Nenhuma venda registrada nesse período.
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ranking.map((c: any) => (
              <RankingRow key={c.cod_cliente} cliente={c} onClick={() => router.push(`/clientes/${c.cod_cliente}`)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function RankingRow({ cliente, onClick }: { cliente: any; onClick: () => void }) {
  // Top 1-3 ganham medalha. Restante: número simples.
  const pos = cliente.posicao
  const isPodium = pos <= 3
  const medalhas: any = {
    1: { bg: 'linear-gradient(135deg, #f5d76e, #d4af5f)', glow: 'rgba(245,215,110,0.5)', label: '1' },
    2: { bg: 'linear-gradient(135deg, #d1d1d1, #9a9a9a)', glow: 'rgba(209,209,209,0.4)', label: '2' },
    3: { bg: 'linear-gradient(135deg, #cd9b6a, #a0673b)', glow: 'rgba(205,155,106,0.4)', label: '3' },
  }
  const med = medalhas[pos]

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '60px 1fr 140px 130px 130px 44px',
        gap: 14, alignItems: 'center',
        padding: '14px 18px',
        background: isPodium
          ? 'linear-gradient(90deg, rgba(212,175,95,0.06), rgba(212,175,95,0.02))'
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isPodium ? 'rgba(212,175,95,0.2)' : 'var(--border)'}`,
        borderRadius: 12, cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateX(4px)'
        e.currentTarget.style.borderColor = 'rgba(212,175,95,0.35)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateX(0)'
        e.currentTarget.style.borderColor = isPodium ? 'rgba(212,175,95,0.2)' : 'var(--border)'
      }}
    >
      {/* Medalha ou número */}
      <div className="medal-in" style={{ display: 'flex', justifyContent: 'center' }}>
        {med ? (
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: med.bg,
            boxShadow: `0 0 18px ${med.glow}, inset 0 -2px 0 rgba(0,0,0,0.2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
            color: '#1a1610',
          }}>
            {med.label}
          </div>
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(212,175,95,0.06)',
            border: '1px solid rgba(212,175,95,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: 'var(--gold-dim)', fontWeight: 700,
          }}>
            {pos}
          </div>
        )}
      </div>

      {/* Nome + cidade */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#d4af5f', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            Top cliente {pos}
          </span>
          {cliente.categoria && (
            <span className="badge badge-gold" style={{ fontSize: 9 }}>{cliente.categoria}</span>
          )}
        </div>
        <div style={{ fontSize: 15, color: '#f5ecd7', fontWeight: 600, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cliente.nome}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {cliente.cidade || '—'}{cliente.celular ? ` · ${cliente.celular}` : ''}
        </div>
      </div>

      {/* Total comprado */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#d4af5f', marginTop: 2 }}>
          {BRL(cliente.total)}
        </div>
      </div>

      {/* Qtd compras */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Compras</div>
        <div style={{ fontSize: 15, color: '#f5ecd7', fontWeight: 600, marginTop: 2 }}>
          {cliente.qtd_compras}
        </div>
      </div>

      {/* Ticket médio */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Ticket médio</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          {BRL(cliente.ticket_medio)}
        </div>
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 16, textAlign: 'right' }}>›</div>
    </div>
  )
}

// ─── INATIVOS ────────────────────────────────────────────────
function InativosBlock({ data, router, dias }: { data: any; router: any; dias: number }) {
  const clientes: any[] = data.clientes || []
  const nuncaCompraram = clientes.filter(c => c.dias_sem_comprar === null).length
  const inativosLongos = clientes.filter(c => (c.dias_sem_comprar || 0) > 90).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
        <MetricCard label="Clientes Inativos" value={data.total?.toLocaleString('pt-BR')} sub={`sem compra há ${dias}+ dias`} alert={data.total > 100} />
        <MetricCard label="Nunca Compraram" value={nuncaCompraram.toLocaleString('pt-BR')} />
        <MetricCard label="Há mais de 90 dias" value={inativosLongos.toLocaleString('pt-BR')} alert={inativosLongos > 50} />
      </div>

      <Section title="◌ Clientes que precisam de reativação">
        {clientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
            Nenhum cliente inativo nesse critério 🎉
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 130px 110px 130px 44px',
              padding: '12px 18px', borderBottom: '1px solid var(--border)',
              background: 'rgba(212,175,95,0.03)',
            }}>
              {['Cliente', 'Telefone', 'Cidade', 'Categoria', 'Última compra', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {clientes.slice(0, 200).map((c, i) => {
              const d = c.dias_sem_comprar
              const corDias = d === null ? '#5eaadf' : d > 180 ? '#ef6b4d' : d > 90 ? '#f5a623' : 'var(--text-secondary)'
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/clientes/${c.id}`)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 130px 110px 130px 44px',
                    padding: '12px 18px',
                    borderBottom: i < clientes.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
                    cursor: 'pointer', alignItems: 'center', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,95,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(212,175,95,0.18), rgba(212,175,95,0.05))',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d4af5f', fontSize: 13,
                    }}>
                      {c.nome?.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#f5ecd7', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nome}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.celular || c.whatsapp || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.cidade || '—'}</div>
                  <div>
                    {c.categoria ? <span className="badge badge-gold" style={{ fontSize: 9 }}>{c.categoria}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                  </div>
                  <div style={{ fontSize: 12, color: corDias, fontWeight: 600 }}>
                    {d === null ? 'Nunca comprou' : `há ${d} dias`}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 16, textAlign: 'right' }}>›</div>
                </div>
              )
            })}
            {clientes.length > 200 && (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, borderTop: '1px solid var(--border)' }}>
                Mostrando 200 de {clientes.length} inativos. Use filtros mais restritivos para refinar.
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  )
}
