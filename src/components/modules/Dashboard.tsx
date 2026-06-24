// src/components/modules/Dashboard.tsx — Dashboard administrador (luxury premium)
'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { KpiCard } from '@/components/ui/KpiCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton, SkeletonKpi } from '@/components/ui/Skeleton'
import { RankBadge } from '@/components/ui/RankBadge'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const BRLshort = (v: number) => {
  if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + 'k'
  return 'R$ ' + v.toFixed(0)
}
const fmtDia = (d: string) => {
  const [, m, dd] = d.split('-')
  return `${dd}/${m}`
}

function saudacao(hour: number) {
  if (hour >= 0 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function diasNoMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

const META_KEY = 'meta_mensal'
const META_DIA_KEY = 'meta_ticket_dia'

export default function Dashboard() {
  const router = useRouter()
  const [d, setD] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Meta editável (localStorage)
  const [metaMes, setMetaMes] = useState<number>(50000)
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaTicket, setMetaTicket] = useState<number>(250)
  const [editandoTicket, setEditandoTicket] = useState(false)

  // Período do gráfico
  const [periodo, setPeriodo] = useState<'7d' | '14d' | '30d' | 'mes'>('14d')

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/perfil').then(r => r.ok ? r.json() : null),
    ]).then(([dash, per]) => {
      setD(dash)
      setPerfil(per)
      setLoading(false)
    }).catch(() => setLoading(false))

    // Lê localStorage
    if (typeof window !== 'undefined') {
      const m = localStorage.getItem(META_KEY)
      if (m) setMetaMes(Number(m) || 50000)
      const t = localStorage.getItem(META_DIA_KEY)
      if (t) setMetaTicket(Number(t) || 250)
    }
  }, [])

  function salvarMetaMes(v: number) {
    setMetaMes(v)
    if (typeof window !== 'undefined') localStorage.setItem(META_KEY, String(v))
  }
  function salvarMetaTicket(v: number) {
    setMetaTicket(v)
    if (typeof window !== 'undefined') localStorage.setItem(META_DIA_KEY, String(v))
  }

  const agora = new Date()
  const dataExtenso = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const nome = perfil?.apelido || perfil?.nome?.split(' ')[0] || ''
  const greeting = saudacao(agora.getHours())
  const isAdmin = perfil?.perfil === 'admin'

  // ─── Dashboard Colaboradora ──────────────────────────────
  if (!loading && perfil && !isAdmin) {
    const nomeCompleto = perfil?.nome || ''
    // Achar dados da vendedora no ranking
    const ranking = d?.vendedoras_mes || []
    const minhaPos = ranking.findIndex((v: any) => v.vendedor === nomeCompleto) + 1
    const meusDados = ranking.find((v: any) => v.vendedor === nomeCompleto)
    const metaIndividualKey = `meta_vendedora_${nomeCompleto}`
    const metaInd = typeof window !== 'undefined' ? Number(localStorage.getItem(metaIndividualKey) || 5000) : 5000
    const pctMeta = metaInd > 0 ? Math.min(100, ((meusDados?.total || 0) / metaInd) * 100) : 0
    const ultimasVendas = d?.ultimas_vendas?.filter((v: any) => v.vendedor === nomeCompleto).slice(0, 5) || []

    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Saudação */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 500, color: 'var(--gold-light)', lineHeight: 1.1 }}>
              {greeting}{nome ? `, ${nome}` : ''} ·
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, textTransform: 'capitalize' }}>
              {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')} style={{ alignSelf: 'flex-start' }}>
            + Nova Venda
          </button>
        </div>

        {/* Minhas vendas de hoje */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <KpiCard icon="◈" label="Minhas Vendas Hoje"
            value={BRL(d?.vendas_hoje?.total || 0)}
            sub={`${d?.vendas_hoje?.qtd || 0} vendas`}
            tone="gold" onClick={() => router.push('/vendas')} />
          <KpiCard icon="◎" label="Minha Meta do Mês"
            value={BRL(meusDados?.total || 0)}
            sub={`${pctMeta.toFixed(0)}% de ${BRL(metaInd)}`}
            tone={pctMeta >= 100 ? 'success' : pctMeta >= 70 ? 'gold' : 'alert'} />
          {minhaPos > 0 && (
            <KpiCard icon="◆" label="Meu Ranking"
              value={`${minhaPos}ª lugar`}
              sub="no mês atual"
              tone={minhaPos === 1 ? 'success' : 'gold'} />
          )}
        </div>

        {/* Barra de meta */}
        <div className="card-premium" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Minha meta do mês</span>
            <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>{pctMeta.toFixed(0)}%</span>
          </div>
          <ProgressBar value={meusDados?.total || 0} max={metaInd || 1} height={12} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>{BRL(meusDados?.total || 0)} vendido</span>
            <span>Meta: {BRL(metaInd)}</span>
          </div>
        </div>

        {/* Últimas vendas */}
        {ultimasVendas.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9' }}>Minhas Últimas Vendas</h3>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => router.push('/vendas')}>Ver todas</button>
            </div>
            {ultimasVendas.map((v: any, i: number) => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', borderBottom: i < ultimasVendas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#F2EBD9' }}>#{v.codigo_legado || v.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.nome_cliente || '—'}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>{BRL(Number(v.valor_total || 0))}</div>
              </div>
            ))}
          </div>
        )}

        {/* Atalhos rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Nova Venda', icon: '◈', path: '/vendas/nova' },
            { label: 'Clientes', icon: '◉', path: '/clientes' },
            { label: 'Nova Troca', icon: '⇄', path: '/trocas/nova' },
          ].map(a => (
            <button key={a.path} onClick={() => router.push(a.path)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 12px', background: 'rgba(201,168,76,0.04)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', color: 'var(--gold-light)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.1)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.04)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── Métricas derivadas (ADMIN) ──────────────────────────
  const vendasMes = d?.vendas_mes?.total || 0
  const qtdVendasMes = d?.vendas_mes?.qtd || 0
  const restanteMeta = Math.max(0, metaMes - vendasMes)
  const metaBatida = vendasMes >= metaMes
  const diaAtual = agora.getDate()
  const totalDias = diasNoMes(agora)
  const projecaoMes = diaAtual > 0 ? (vendasMes / diaAtual) * totalDias : 0
  const projecaoPct = metaMes > 0 ? (projecaoMes / metaMes) * 100 : 0
  const noRitmo = projecaoMes >= metaMes

  const ticketDiaAtual = d?.ticket_medio_dia || 0
  const ticketMetaOk = ticketDiaAtual >= metaTicket

  // Dados gráfico conforme período
  const serieGrafico = useMemo(() => {
    if (!d) return []
    if (periodo === '7d') return d.vendas_7d || []
    if (periodo === '14d') return d.vendas_14d || []
    if (periodo === '30d') return d.vendas_30d || []
    // 'mes': filtra do início do mês
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    const inicioStr = inicioMes.toISOString().split('T')[0]
    return (d.vendas_30d || []).filter((x: any) => x.data >= inicioStr)
  }, [d, periodo])

  const mediaDiaria = useMemo(() => {
    if (!serieGrafico.length) return 0
    const comVenda = serieGrafico.filter((x: any) => x.qtd > 0)
    if (comVenda.length === 0) return 0
    return comVenda.reduce((s: number, x: any) => s + x.total, 0) / comVenda.length
  }, [serieGrafico])

  // Top vendedora (pra normalizar barras)
  const topVendedora = d?.vendedoras_mes?.[0]?.total || 1

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ─── LINHA 1: HEADER DO DIA ────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 36, fontWeight: 500,
            color: 'var(--gold-light)',
            letterSpacing: '-0.01em', lineHeight: 1.1,
          }}>
            {greeting}{nome ? `, ${nome}` : ''} <span style={{ color: 'var(--gold)' }}>·</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
            {dataExtenso}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/relatorios')}>Relatórios</button>
          <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')}>+ Nova Venda</button>
        </div>
      </div>

      {/* ─── LINHA 2: META DO MÊS ──────────────────────────── */}
      <div className="card-premium" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gold-light)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
              ◆ Meta do Mês
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
              {agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
            </div>
          </div>
          {!editandoMeta ? (
            <button onClick={() => setEditandoMeta(true)} title="Editar meta"
              style={{
                background: 'rgba(201,168,76,0.08)', border: '1px solid var(--border)',
                color: 'var(--gold-light)', padding: '6px 10px', borderRadius: 8,
                fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
              ✎ Editar meta
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>R$</span>
              <input className="input" type="number" value={metaMes} autoFocus
                onChange={e => salvarMetaMes(Number(e.target.value) || 0)}
                style={{ width: 140, fontSize: 13 }} />
              <button onClick={() => setEditandoMeta(false)}
                style={{ background: 'rgba(76,175,130,0.12)', border: '1px solid rgba(76,175,130,0.3)', color: 'var(--success)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                ✓
              </button>
            </div>
          )}
        </div>

        {/* Barra de progresso */}
        <div style={{ marginBottom: 16 }}>
          <ProgressBar value={vendasMes} max={metaMes || 1} height={14} />
        </div>

        {/* 3 colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              Vendido no Mês
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--gold-light)', lineHeight: 1, letterSpacing: '-0.01em' }}>
              {loading ? <Skeleton width={160} height={28} /> : BRL(vendasMes)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {qtdVendasMes} vendas
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              Meta
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.01em' }}>
              {BRL(metaMes)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              estabelecida
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: metaBatida ? 'var(--success)' : 'var(--danger)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              {metaBatida ? 'Meta atingida' : 'Faltam'}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: metaBatida ? 'var(--success)' : 'var(--danger)', lineHeight: 1, letterSpacing: '-0.01em' }}>
              {metaBatida ? '🏆' : BRL(restanteMeta)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {metaBatida ? 'parabéns!' : `${diaAtual}/${totalDias} dias`}
            </div>
          </div>
        </div>

        {/* Projeção */}
        <div style={{
          padding: '12px 16px',
          background: noRitmo ? 'rgba(76,175,130,0.06)' : 'rgba(232,148,58,0.06)',
          border: `1px solid ${noRitmo ? 'rgba(76,175,130,0.20)' : 'rgba(232,148,58,0.20)'}`,
          borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Projeção para o mês: </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>
              {BRL(projecaoMes)}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: noRitmo ? 'var(--success)' : 'var(--warning)' }}>
            {noRitmo
              ? '✓ No ritmo para bater a meta'
              : `Ritmo atual: ${projecaoPct.toFixed(0)}% da meta`}
          </div>
        </div>
      </div>

      {/* ─── LINHA 3: KPIs ─────────────────────────────────── */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {loading ? (
          <>
            <SkeletonKpi /><SkeletonKpi /><SkeletonKpi />
            <SkeletonKpi /><SkeletonKpi /><SkeletonKpi />
          </>
        ) : (
          <>
            <KpiCard
              icon="◈" label="Vendas Hoje"
              value={BRL(d?.vendas_hoje?.total || 0)}
              sub={`${d?.vendas_hoje?.qtd || 0} vendas realizadas`}
              delta={d?.vendas_hoje?.comparativo_ontem_pct != null ? { pct: d.vendas_hoje.comparativo_ontem_pct } : undefined}
              tone="gold"
              onClick={() => router.push('/vendas')}
            />
            <KpiCard
              icon="●" label="Ticket Médio do Dia"
              value={BRL(ticketDiaAtual)}
              sub={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Meta:
                  {!editandoTicket ? (
                    <button onClick={() => setEditandoTicket(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--gold-light)', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
                      {BRL(metaTicket)} ✎
                    </button>
                  ) : (
                    <>
                      <input type="number" value={metaTicket} autoFocus
                        onChange={e => salvarMetaTicket(Number(e.target.value) || 0)}
                        style={{ width: 70, fontSize: 11, padding: '2px 6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }}
                        onBlur={() => setEditandoTicket(false)} />
                    </>
                  )}
                </span>
              }
              tone={ticketMetaOk ? 'success' : 'alert'}
            />
            <KpiCard
              icon="○" label="Ticket Médio do Mês"
              value={BRL(d?.ticket_medio_mes || 0)}
              sub={`Baseado em ${qtdVendasMes} vendas`}
              tone="gold"
            />
            <KpiCard
              icon="◎" label="A Receber Hoje"
              value={BRL(d?.a_receber_hoje?.total || 0)}
              sub={`${d?.a_receber_hoje?.qtd || 0} clientes`}
              tone={d?.a_receber_hoje?.qtd > 0 ? 'warning' : 'neutral'}
              onClick={() => router.push('/crediario')}
            />
            <KpiCard
              icon="⚠" label="Inadimplentes"
              value={BRL(d?.inadimplentes?.total || 0)}
              sub={`${d?.inadimplentes?.qtd || 0} parcelas em atraso`}
              tone={d?.inadimplentes?.qtd > 0 ? 'alert' : 'neutral'}
              onClick={() => router.push('/crediario?filtro=atraso')}
            />
            <KpiCard
              icon="◫" label="Estoque Crítico"
              value={d?.estoque_critico || 0}
              sub="produtos precisam de reposição"
              tone={d?.estoque_critico > 0 ? 'warning' : 'neutral'}
              onClick={() => router.push('/produtos')}
            />
          </>
        )}
      </div>

      {/* ─── LINHA 4: GRÁFICO 14d ──────────────────────────── */}
      <div className="card-premium" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Vendas por Dia
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              Média diária: <span style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-mono)' }}>{BRL(mediaDiaria)}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 4 }}>
            {(['7d', '14d', '30d', 'mes'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
                  background: periodo === p ? 'rgba(201,168,76,0.18)' : 'transparent',
                  color: periodo === p ? 'var(--gold-light)' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}>
                {p === 'mes' ? 'Mês' : p}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={serieGrafico} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(201,168,76,0.06)" />
              <XAxis dataKey="data"
                tickFormatter={fmtDia}
                tick={{ fill: 'rgba(242,235,217,0.4)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: 'rgba(201,168,76,0.08)' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={BRLshort}
                tick={{ fill: 'rgba(242,235,217,0.4)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={false} tickLine={false}
                width={50}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  const p = payload[0].payload
                  return (
                    <div style={{
                      background: '#0c0a0d', border: '1px solid rgba(201,168,76,0.25)',
                      borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-dropdown)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                        {label && fmtDia(label as string)}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--gold-light)' }}>
                        {BRL(p.total)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {p.qtd} venda{p.qtd === 1 ? '' : 's'}
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: 'rgba(201,168,76,0.2)', strokeWidth: 1 }}
              />
              <ReferenceLine y={mediaDiaria} stroke="rgba(201,168,76,0.4)" strokeDasharray="4 6" />
              <Area type="monotone" dataKey="total"
                stroke="#C9A84C" strokeWidth={2}
                fill="url(#goldArea)"
                dot={{ r: 0 }} activeDot={{ r: 5, fill: '#C9A84C', stroke: '#F2EBD9', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── LINHA 5: RANKING DE VENDEDORAS ────────────────── */}
      <div className="card-premium" style={{ padding: '22px 24px' }}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            ◆ Ranking de Vendedoras — {agora.toLocaleDateString('pt-BR', { month: 'long' }).replace(/^./, c => c.toUpperCase())}
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {d?.vendedoras_mes?.length || 0} ativa(s) no mês
          </p>
        </div>
        {!d?.vendedoras_mes?.length ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
            Nenhuma venda registrada neste mês.
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.vendedoras_mes.map((v: any, i: number) => (
              <RowVendedora key={v.vendedor} pos={i + 1} vendedora={v} maxTotal={topVendedora} router={router} />
            ))}
          </div>
        )}
      </div>

      {/* ─── LINHA 6: GRID INFERIOR ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14 }}>
        {/* Últimas vendas */}
        <div className="card">
          <SecaoHeader title="Últimas Vendas" action="Ver todas" onAction={() => router.push('/vendas')} />
          {!d?.vendas_recentes?.length ? (
            <Empty texto="Nenhuma venda" />
          ) : (
            <div>
              {d.vendas_recentes.slice(0, 8).map((v: any, i: number, arr: any[]) => (
                <LinhaUltimaVenda key={v.id} v={v} isLast={i === arr.length - 1} onClick={() => router.push(`/vendas/${v.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Próximos vencimentos */}
        <div className="card">
          <SecaoHeader title="Próximos Vencimentos" action="Ver" onAction={() => router.push('/crediario')} />
          {!d?.vencimentos?.length ? (
            <Empty texto="Sem vencimentos próximos" />
          ) : (
            <div>
              {d.vencimentos.slice(0, 8).map((v: any, i: number, arr: any[]) => (
                <LinhaVencimento key={v.id} v={v} isLast={i === arr.length - 1} onClick={() => router.push(`/crediario/${v.cod_cliente}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Ações + aniversariantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
              Ações Rápidas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')} style={{ padding: '12px', justifyContent: 'center' }}>
                + Nova Venda
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/clientes/novo')} style={{ padding: '12px', justifyContent: 'center' }}>
                + Novo Cliente
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/whatsapp')} style={{ padding: '12px', justifyContent: 'center' }}>
                ◍ Cobranças WhatsApp
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/relatorios')} style={{ padding: '12px', justifyContent: 'center' }}>
                ▤ Relatório do Dia
              </button>
            </div>
          </div>

          {d?.aniversariantes?.length > 0 && (
            <div className="card-premium" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>🎂</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--gold-light)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                    Aniversariantes Hoje
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {d.aniversariantes.length} cliente{d.aniversariantes.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {d.aniversariantes.slice(0, 3).map((a: any) => (
                  <div key={a.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    • {a.nome?.split(' ').slice(0, 2).join(' ')}
                  </div>
                ))}
                {d.aniversariantes.length > 3 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    + {d.aniversariantes.length - 3} mais
                  </div>
                )}
              </div>
              <button className="btn btn-primary" onClick={() => router.push('/whatsapp')} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                Enviar mensagens
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── HELPERS COMPONENTES ──────────────────────────────────────

function SecaoHeader({ title, action, onAction }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
      {action && (
        <button onClick={onAction}
          style={{ fontSize: 11, color: 'var(--gold-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {action} →
        </button>
      )}
    </div>
  )
}

function Empty({ texto }: { texto: string }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
      {texto}
    </div>
  )
}

function LinhaUltimaVenda({ v, isLast, onClick }: any) {
  return (
    <div onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 10,
        alignItems: 'center', padding: '10px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(201,168,76,0.06)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.04))',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold-light)', fontSize: 14,
      }}>
        {v.nome_cliente?.charAt(0) || '?'}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {v.nome_cliente?.split(' ').slice(0, 2).join(' ') || '—'}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          #{v.codigo_legado || v.id} · {v.forma_pagamento || 'à vista'}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--gold-light)' }}>
        {BRL(Number(v.valor_total))}
      </div>
    </div>
  )
}

function LinhaVencimento({ v, isLast, onClick }: any) {
  const atrasado = v.dias_para_vencer < 0
  const hoje = v.dias_para_vencer === 0
  const cor = atrasado ? 'var(--danger)' : hoje ? 'var(--warning)' : 'var(--gold-light)'
  return (
    <div onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
        alignItems: 'center', padding: '10px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(201,168,76,0.06)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: atrasado ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {v.nome_cliente?.split(' ').slice(0, 2).join(' ')}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Parcela {v.parcela || '—'}
        </div>
      </div>
      <span style={{
        fontSize: 9.5, fontWeight: 700, color: cor,
        background: atrasado ? 'rgba(229,88,74,0.10)' : hoje ? 'rgba(232,148,58,0.10)' : 'rgba(201,168,76,0.10)',
        border: `1px solid ${cor}33`,
        borderRadius: 5, padding: '2px 7px',
        letterSpacing: '0.05em', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>
        {atrasado ? `${Math.abs(v.dias_para_vencer)}d atraso` : hoje ? 'Hoje' : `${v.dias_para_vencer}d`}
      </span>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: cor }}>
        {BRL(Number(v.valor))}
      </div>
    </div>
  )
}

function RowVendedora({ pos, vendedora, maxTotal, router }: any) {
  const META_KEY = `meta_vendedora_${vendedora.vendedor}`
  const [metaInd, setMetaInd] = useState<number>(0)
  const [editando, setEditando] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const v = localStorage.getItem(META_KEY)
    setMetaInd(v ? Number(v) : 10000)
  }, [META_KEY])
  function salvar(v: number) {
    setMetaInd(v)
    if (typeof window !== 'undefined') localStorage.setItem(META_KEY, String(v))
  }
  const pctMeta = metaInd > 0 ? (vendedora.total / metaInd) * 100 : 0
  const widthPct = maxTotal > 0 ? (vendedora.total / maxTotal) * 100 : 0
  const podio = pos <= 3

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '48px 1fr 90px 130px 110px 120px',
      gap: 14, alignItems: 'center',
      padding: '12px 14px',
      background: podio ? 'linear-gradient(90deg, rgba(201,168,76,0.05), rgba(201,168,76,0.01))' : 'rgba(255,255,255,0.015)',
      border: `1px solid ${podio ? 'rgba(201,168,76,0.18)' : 'var(--border)'}`,
      borderRadius: 10,
      transition: 'all 0.25s var(--ease-silk)',
    }}>
      <RankBadge pos={pos} size={36} />
      <div style={{ minWidth: 0, position: 'relative' }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {vendedora.vendedor}
        </div>
        <div style={{ marginTop: 5, position: 'relative', width: '100%', height: 4, background: 'rgba(201,168,76,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${widthPct}%`,
            background: 'linear-gradient(90deg, var(--gold-dark), var(--gold), var(--gold-light))',
            borderRadius: 2,
            transition: 'width 0.7s var(--ease-silk)',
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{vendedora.qtd}</div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>vendas</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--gold-light)' }}>{BRL(vendedora.total)}</div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>total</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{BRL(vendedora.ticket)}</div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>ticket</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {!editando ? (
          <button onClick={() => setEditando(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'right', width: '100%' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: pctMeta >= 100 ? 'var(--success)' : 'var(--warning)' }}>
              {pctMeta.toFixed(0)}% ✎
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>da meta</div>
          </button>
        ) : (
          <input type="number" value={metaInd} autoFocus
            onChange={e => salvar(Number(e.target.value) || 0)}
            onBlur={() => setEditando(false)}
            style={{ width: 90, fontSize: 12, padding: '4px 6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, textAlign: 'right' }} />
        )}
      </div>
    </div>
  )
}
