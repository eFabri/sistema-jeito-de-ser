// src/components/modules/Dashboard.tsx — Dashboard administrador (boutique premium)
'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
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

  const [metaMes, setMetaMes] = useState<number>(50000)
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaTicket, setMetaTicket] = useState<number>(250)
  const [editandoTicket, setEditandoTicket] = useState(false)

  const [periodo, setPeriodo] = useState<'7d' | '14d' | '30d' | 'mes'>('14d')
  const [valoresVisiveis, setValoresVisiveis] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('jeito-de-ser-valores-visiveis') === 'true' : false
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null)
  const [ultimaFalha, setUltimaFalha] = useState<string | null>(null)

  function toggleValores() {
    setValoresVisiveis(v => {
      const next = !v
      if (typeof window !== 'undefined') localStorage.setItem('jeito-de-ser-valores-visiveis', String(next))
      return next
    })
  }

  const V = (v: number) => valoresVisiveis ? BRL(v) : 'R$ ••••••'

  const buscarDados = useCallback(async () => {
    setIsRefreshing(true)
    const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    try {
      const bust = Date.now()
      const [dash, per] = await Promise.all([
        fetch(`/api/dashboard?_t=${bust}`, { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/perfil', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      ])
      console.log('[Dashboard] refresh ok', { hora: horaAgora, vendas_hoje_qtd: dash?.vendas_hoje?.qtd, vendas_hoje_total: dash?.vendas_hoje?.total })
      setD(dash)
      setPerfil(per)
      setUltimaAtualizacao(horaAgora)
      setUltimaFalha(null)
    } catch (err) {
      console.error('[Dashboard] falha no auto-refresh:', horaAgora, err)
      setUltimaFalha(horaAgora)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    buscarDados()
    if (typeof window !== 'undefined') {
      const m = localStorage.getItem(META_KEY)
      if (m) setMetaMes(Number(m) || 50000)
      const t = localStorage.getItem(META_DIA_KEY)
      if (t) setMetaTicket(Number(t) || 250)
    }
    const interval = setInterval(buscarDados, 5 * 60 * 1000)
    const onVisibility = () => { if (document.visibilityState === 'visible') buscarDados() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [buscarDados])

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

  const vendasMes      = d?.vendas_mes?.total || 0
  const qtdVendasMes   = d?.vendas_mes?.qtd   || 0
  const diaAtual       = agora.getDate()
  const totalDias      = diasNoMes(agora)
  const projecaoMes    = diaAtual > 0 ? (vendasMes / diaAtual) * totalDias : 0
  const ticketDiaAtual = d?.ticket_medio_dia || 0
  const topVendedora   = d?.vendedoras_mes?.[0]?.total || 1

  const serieGrafico = useMemo(() => {
    if (!d) return []
    if (periodo === '7d')  return d.vendas_7d  || []
    if (periodo === '14d') return d.vendas_14d || []
    if (periodo === '30d') return d.vendas_30d || []
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

  // ─── Dashboard Colaboradora ─────────────────────────────────
  if (!loading && perfil && !isAdmin) {
    const nomeCompleto = perfil?.nome || ''
    const apelido     = perfil?.apelido || ''
    const matchVendedor = (v: any) =>
      v.vendedor === nomeCompleto || (apelido && v.vendedor === apelido)
    const ranking  = d?.vendedoras_mes || []
    const minhaPos = ranking.findIndex(matchVendedor) + 1
    const meusDados = ranking.find(matchVendedor)
    const minhasVendasHoje = (d?.vendas_hoje_vendedoras || []).find(matchVendedor)
    const metaIndividualKey = `meta_vendedora_${nomeCompleto}`
    const metaInd = typeof window !== 'undefined'
      ? (Number(localStorage.getItem(metaIndividualKey)) || 5000)
      : 5000
    const pctMeta = metaInd > 0 ? Math.min(100, ((meusDados?.total || 0) / metaInd) * 100) : 0
    const ultimasVendas = (d?.vendas_recentes || [])
      .filter(matchVendedor)
      .slice(0, 5)

    return (
      <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {greeting}{nome ? `, ${nome}` : ''} <span style={{ color: 'var(--accent)' }}>·</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, textTransform: 'capitalize' }}>
              {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <button onClick={buscarDados} title="Atualizar dados" disabled={isRefreshing}
                style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={14} strokeWidth={1.8} style={{ transition: 'transform 0.6s', transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)' }} />
              </button>
              {ultimaFalha ? (
                <span style={{ fontSize: 9, color: 'var(--danger)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                  tentativa {ultimaFalha} (falhou)
                </span>
              ) : ultimaAtualizacao ? (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                  {ultimaAtualizacao}
                </span>
              ) : null}
            </div>
            <button onClick={toggleValores} title={valoresVisiveis ? 'Ocultar valores' : 'Mostrar valores'}
              style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              {valoresVisiveis ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
              {valoresVisiveis ? 'Ocultar' : 'Mostrar'}
            </button>
            <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')}>
              + Nova Venda
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <KpiCard icon="◈" label="Minhas Vendas Hoje"
            value={V(minhasVendasHoje?.total || 0)}
            sub={`${minhasVendasHoje?.qtd || 0} venda${(minhasVendasHoje?.qtd || 0) === 1 ? '' : 's'}`}
            tone="gold" onClick={() => router.push('/vendas')} />
          <KpiCard icon="◎" label="Minha Meta do Mês"
            value={V(meusDados?.total || 0)}
            sub={`${pctMeta.toFixed(0)}% de ${BRL(metaInd)}`}
            tone={pctMeta >= 100 ? 'success' : pctMeta >= 70 ? 'gold' : 'alert'} />
          {minhaPos > 0 && (
            <KpiCard icon="◆" label="Meu Ranking"
              value={`${minhaPos}ª lugar`}
              sub="no mês atual"
              tone={minhaPos === 1 ? 'success' : 'gold'} />
          )}
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Minha meta do mês</span>
            <span style={{ fontSize: 13, color: 'var(--accent-gold)', fontWeight: 700 }}>{pctMeta.toFixed(0)}%</span>
          </div>
          <ProgressBar value={meusDados?.total || 0} max={metaInd || 1} height={12} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>{BRL(meusDados?.total || 0)} vendido</span>
            <span>Meta: {BRL(metaInd)}</span>
          </div>
        </div>

        {ultimasVendas.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Minhas Últimas Vendas</h3>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => router.push('/vendas')}>Ver todas</button>
            </div>
            {ultimasVendas.map((v: any, i: number) => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', borderBottom: i < ultimasVendas.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>#{v.codigo_legado || v.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.nome_cliente || '—'}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>{BRL(Number(v.valor_total || 0))}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Nova Venda', icon: '◈', path: '/vendas/nova' },
            { label: 'Clientes', icon: '◉', path: '/clientes' },
            { label: 'Nova Troca', icon: '⇄', path: '/trocas/nova' },
          ].map(a => (
            <button key={a.path} onClick={() => router.push(a.path)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', color: 'var(--accent-gold)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,110,0.12)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── Variáveis admin ────────────────────────────────────────
  const restanteMeta = Math.max(0, metaMes - vendasMes)
  const metaBatida   = vendasMes >= metaMes
  const projecaoPct  = metaMes > 0 ? (projecaoMes / metaMes) * 100 : 0
  const noRitmo      = projecaoMes >= metaMes
  const ticketMetaOk = ticketDiaAtual >= metaTicket

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ─── HEADER DO DIA ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 36, fontWeight: 900,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em', lineHeight: 1.1,
          }}>
            {greeting}{nome ? `, ${nome}` : ''} <span style={{ color: 'var(--accent)' }}>·</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
            {dataExtenso}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <button onClick={buscarDados} title="Atualizar dados" disabled={isRefreshing}
              style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={14} strokeWidth={1.8} style={{ transition: 'transform 0.6s', transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)' }} />
            </button>
            {ultimaFalha ? (
              <span style={{ fontSize: 9, color: 'var(--danger)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                tentativa {ultimaFalha} (falhou)
              </span>
            ) : ultimaAtualizacao ? (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                {ultimaAtualizacao}
              </span>
            ) : null}
          </div>
          <button onClick={toggleValores} title={valoresVisiveis ? 'Ocultar valores' : 'Mostrar valores'}
            style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            {valoresVisiveis ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
            {valoresVisiveis ? 'Ocultar' : 'Mostrar'}
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/relatorios')}>Relatórios</button>
          <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')}>+ Nova Venda</button>
        </div>
      </div>

      {/* ─── CARD ASSINATURA — META DO MÊS ─────────────────── */}
      <div className="card-assinatura" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
              ◆ Meta do Mês
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
              {agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase())}
            </div>
            <span className="card-assinatura-accent" />
          </div>
          {!editandoMeta ? (
            <button onClick={() => setEditandoMeta(true)} title="Editar meta"
              style={{
                background: 'rgba(201,169,110,0.10)', border: '1px solid var(--border)',
                color: 'var(--accent-gold)', padding: '6px 10px', borderRadius: 8,
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
                style={{ background: 'rgba(107,155,122,0.12)', border: '1px solid rgba(107,155,122,0.3)', color: 'var(--success)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                ✓
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <ProgressBar value={vendasMes} max={metaMes || 1} height={14} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              Vendido no Mês
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 900, color: 'var(--accent-gold)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {loading ? <Skeleton width={160} height={36} /> : V(vendasMes)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {qtdVendasMes} vendas
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              Meta
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {V(metaMes)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              estabelecida
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: metaBatida ? 'var(--success)' : 'var(--danger)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              {metaBatida ? 'Meta atingida' : 'Faltam'}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 900, color: metaBatida ? 'var(--success)' : 'var(--danger)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {metaBatida ? '🏆' : V(restanteMeta)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {metaBatida ? 'parabéns!' : `${diaAtual}/${totalDias} dias`}
            </div>
          </div>
        </div>

        <div style={{
          padding: '12px 16px',
          background: noRitmo ? 'rgba(107,155,122,0.08)' : 'rgba(201,130,74,0.08)',
          border: `1px solid ${noRitmo ? 'rgba(107,155,122,0.20)' : 'rgba(201,130,74,0.20)'}`,
          borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Projeção para o mês: </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>
              {V(projecaoMes)}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: noRitmo ? 'var(--success)' : 'var(--warning)' }}>
            {noRitmo
              ? '✓ No ritmo para bater a meta'
              : `Ritmo atual: ${projecaoPct.toFixed(0)}% da meta`}
          </div>
        </div>
      </div>

      {/* ─── KPIs ──────────────────────────────────────────── */}
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
              value={V(d?.vendas_hoje?.total || 0)}
              sub={`${d?.vendas_hoje?.qtd || 0} vendas realizadas`}
              delta={d?.vendas_hoje?.comparativo_ontem_pct != null ? { pct: d.vendas_hoje.comparativo_ontem_pct } : undefined}
              tone="gold"
              onClick={() => router.push('/vendas')}
            />
            <KpiCard
              icon="●" label="Ticket Médio do Dia"
              value={V(ticketDiaAtual)}
              sub={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Meta:
                  {!editandoTicket ? (
                    <button onClick={() => setEditandoTicket(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: 0 }}>
                      {BRL(metaTicket)} ✎
                    </button>
                  ) : (
                    <>
                      <input type="number" value={metaTicket} autoFocus
                        onChange={e => salvarMetaTicket(Number(e.target.value) || 0)}
                        style={{ width: 70, fontSize: 11, padding: '2px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4 }}
                        onBlur={() => setEditandoTicket(false)} />
                    </>
                  )}
                </span>
              }
              tone={ticketMetaOk ? 'success' : 'alert'}
            />
            <KpiCard
              icon="○" label="Ticket Médio do Mês"
              value={V(d?.ticket_medio_mes || 0)}
              sub={`Baseado em ${qtdVendasMes} vendas`}
              tone="gold"
            />
            <KpiCard
              icon="◎" label="A Receber Hoje"
              value={V(d?.a_receber_hoje?.total || 0)}
              sub={`${d?.a_receber_hoje?.qtd || 0} clientes`}
              tone={d?.a_receber_hoje?.qtd > 0 ? 'warning' : 'neutral'}
              onClick={() => router.push('/crediario')}
            />
            <KpiCard
              icon="⚠" label="Inadimplentes"
              value={V(d?.inadimplentes?.total || 0)}
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

      {/* ─── GRÁFICO ────────────────────────────────────────── */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Vendas por Dia
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              Média diária: <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>{BRL(mediaDiaria)}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(44,36,32,0.06)', borderRadius: 10, padding: 4 }}>
            {(['7d', '14d', '30d', 'mes'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
                  background: periodo === p ? '#FFFFFF' : 'transparent',
                  color: periodo === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: periodo === p ? '0 1px 4px rgba(44,36,32,0.10)' : 'none',
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
                  <stop offset="0%" stopColor="#C9A96E" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#C9A96E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(44,36,32,0.05)" />
              <XAxis dataKey="data"
                tickFormatter={fmtDia}
                tick={{ fill: 'rgba(44,36,32,0.45)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={BRLshort}
                tick={{ fill: 'rgba(44,36,32,0.45)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={false} tickLine={false}
                width={50}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null
                  const p = payload[0].payload
                  return (
                    <div style={{
                      background: '#FFFFFF', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-clay)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                        {label && fmtDia(label as string)}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--accent-gold)' }}>
                        {BRL(p.total)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {p.qtd} venda{p.qtd === 1 ? '' : 's'}
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: 'rgba(201,169,110,0.3)', strokeWidth: 1 }}
              />
              <ReferenceLine y={mediaDiaria} stroke="rgba(201,169,110,0.40)" strokeDasharray="4 6" />
              <Area type="monotone" dataKey="total"
                stroke="#C9A96E" strokeWidth={2}
                fill="url(#goldArea)"
                dot={{ r: 0 }} activeDot={{ r: 5, fill: '#C9A96E', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── RANKING DE VENDEDORAS ──────────────────────────── */}
      <div className="card" style={{ padding: '22px 24px' }}>
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

      {/* ─── MENSAGENS AUTOMÁTICAS HOJE ─────────────────────── */}
      <SecaoWhatsAppHoje />

      {/* ─── GRID INFERIOR ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14 }}>
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

          {(() => {
            const aniv = (d?.aniversariantes || []).filter((a: any) => !a.tipo_aniversario || a.tipo_aniversario === 'aniversario')
            if (!aniv.length) return null
            return (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>🎂</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                      Aniversariantes Hoje
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {aniv.length} cliente{aniv.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {aniv.slice(0, 3).map((a: any) => (
                    <div key={a.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      • {a.nome?.split(' ').slice(0, 2).join(' ')}
                    </div>
                  ))}
                  {aniv.length > 3 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+ {aniv.length - 3} mais</div>
                  )}
                </div>
                <button className="btn btn-primary" onClick={() => router.push('/whatsapp')} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                  Enviar mensagens
                </button>
              </div>
            )
          })()}

          {(() => {
            const casam = (d?.aniversariantes || []).filter((a: any) => a.tipo_aniversario === 'casamento')
            if (!casam.length) return null
            return (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>💍</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                      Aniversário de Casamento
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {casam.length} cliente{casam.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {casam.slice(0, 3).map((a: any) => (
                    <div key={a.id + '-casam'} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      • {a.nome?.split(' ').slice(0, 2).join(' ')}
                    </div>
                  ))}
                  {casam.length > 3 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+ {casam.length - 3} mais</div>
                  )}
                </div>
                <button className="btn btn-primary" onClick={() => router.push('/whatsapp')} style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                  Enviar mensagens
                </button>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── SEÇÃO MENSAGENS AUTOMÁTICAS HOJE ────────────────────────

const TIPOS_WPP = [
  { key: 'aniversario',          label: 'Aniversários de Nascimento', emoji: '🎂' },
  { key: 'aniversario_casamento', label: 'Aniversários de Casamento',  emoji: '💍' },
  { key: 'cobranca_5d',          label: 'Avisos de Vencimento (5 dias)', emoji: '💰' },
  { key: 'cobranca_dia',         label: 'Vencimentos no Dia',          emoji: '⏰' },
] as const

function statusIcon(status: string) {
  if (status === 'enviado')                      return { icon: '✅', cor: 'var(--success)' }
  if (status === 'sem_whatsapp')                 return { icon: '⚪', cor: 'var(--text-muted)' }
  if (status === 'erro' || status === 'erro_interno') return { icon: '❌', cor: 'var(--danger)' }
  return { icon: '—', cor: 'var(--text-muted)' }
}

function SecaoWhatsAppHoje() {
  const [data, setData]     = useState<{ hoje: string; logs: any[]; excluidos?: Record<string, number> } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/whatsapp?aba=whatsapp_hoje', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData({ hoje: '', logs: [] }))
      .finally(() => setLoading(false))
  }, [])

  const logs: any[] = (data?.logs ?? []).filter(l => {
    if (!l.enviado_em || !data?.hoje) return true
    const dataLocal = new Date(l.enviado_em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    return dataLocal === data.hoje
  })

  const nEnviados  = logs.filter(l => l.status === 'enviado').length
  const nErros     = logs.filter(l => l.status === 'erro' || l.status === 'erro_interno').length
  const nSemWpp    = logs.filter(l => l.status === 'sem_whatsapp').length
  const nTotal     = logs.length

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Cabeçalho */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
            Mensagens Automáticas Hoje
          </h3>
          {!loading && data && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {data.hoje || '—'} · {nTotal} disparo{nTotal !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Resumo — calculado dos logs, nunca do cron_resumo */}
        {!loading && nTotal > 0 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Chip cor="var(--success)"     icone="✅" valor={nEnviados}  label="enviada"  />
            <Chip cor="var(--danger)"      icone="❌" valor={nErros}     label="erro"     />
            <Chip cor="var(--text-muted)"  icone="⚪" valor={nSemWpp}    label="sem WPP"  />
          </div>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} width="100%" height={20} />
          ))}
        </div>
      )}

      {/* Seções por tipo */}
      {!loading && (
        <div>
          {TIPOS_WPP.map((tipo, ti) => {
            const grupo = logs.filter(l => l.tipo === tipo.key)
            const isLast = ti === TIPOS_WPP.length - 1
            return (
              <div key={tipo.key} style={{
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
              }}>
                {/* Header do tipo */}
                <div style={{
                  padding: '10px 20px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(44,36,32,0.02)',
                }}>
                  <span style={{ fontSize: 15 }}>{tipo.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    {tipo.label}
                  </span>
                  {grupo.length > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 10, fontWeight: 700,
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(44,36,32,0.06)',
                      borderRadius: 5, padding: '2px 7px',
                    }}>
                      {grupo.length}
                    </span>
                  )}
                </div>

                {/* Linhas ou estado vazio */}
                {grupo.length === 0 ? (
                  <div style={{ padding: '8px 20px 12px 20px' }}>
                    {(data?.excluidos?.[tipo.key] ?? 0) > 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--warning)', fontStyle: 'italic' }}>
                        Nenhuma mensagem enviada — {data!.excluidos![tipo.key]} sem WhatsApp ativo
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Nenhum para hoje
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    {grupo.map((l: any, li: number) => {
                      const { icon, cor } = statusIcon(l.status)
                      const nome = l.clientes?.nome?.split(' ').slice(0, 3).join(' ') || l.numero || '—'
                      const erroResumido = l.erro ? l.erro.slice(0, 70) + (l.erro.length > 70 ? '…' : '') : null
                      return (
                        <div key={l.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '22px 1fr auto',
                          gap: 10, alignItems: 'start',
                          padding: '7px 20px',
                          borderTop: li === 0 ? 'none' : '1px solid rgba(44,36,32,0.04)',
                        }}>
                          <span style={{ fontSize: 13, lineHeight: '20px' }}>{icon}</span>
                          <div>
                            <div style={{ fontSize: 12.5, color: l.status === 'enviado' ? 'var(--text-primary)' : cor, fontWeight: l.status === 'enviado' ? 500 : 600 }}>
                              {nome}
                            </div>
                            {erroResumido && (
                              <div style={{ fontSize: 10.5, color: 'var(--danger)', marginTop: 1, fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                                {erroResumido}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', lineHeight: '20px' }}>
                            {l.enviado_em
                              ? new Date(l.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                              : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chip({ cor, icone, valor, label }: { cor: string; icone: string; valor: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 13 }}>{icone}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: cor }}>{valor}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}{valor !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ─── HELPERS ─────────────────────────────────────────────────

function SecaoHeader({ title, action, onAction }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
      {action && (
        <button onClick={onAction}
          style={{ fontSize: 11, color: 'var(--accent-gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
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
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-gold)', fontSize: 14,
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
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--accent-gold)' }}>
        {BRL(Number(v.valor_total))}
      </div>
    </div>
  )
}

function LinhaVencimento({ v, isLast, onClick }: any) {
  const atrasado = v.dias_para_vencer < 0
  const hoje = v.dias_para_vencer === 0
  const cor = atrasado ? 'var(--danger)' : hoje ? 'var(--warning)' : 'var(--accent-gold)'
  return (
    <div onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
        alignItems: 'center', padding: '10px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
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
        background: atrasado ? 'rgba(184,92,92,0.10)' : hoje ? 'rgba(201,130,74,0.10)' : 'rgba(201,169,110,0.10)',
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
      background: podio ? 'linear-gradient(90deg, rgba(201,169,110,0.06), rgba(201,169,110,0.02))' : 'rgba(44,36,32,0.02)',
      border: `1px solid ${podio ? 'rgba(201,169,110,0.20)' : 'var(--border)'}`,
      borderRadius: 10,
      transition: 'all 0.25s var(--ease-silk)',
    }}>
      <RankBadge pos={pos} size={36} />
      <div style={{ minWidth: 0, position: 'relative' }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {vendedora.vendedor}
        </div>
        <div style={{ marginTop: 5, position: 'relative', width: '100%', height: 4, background: 'rgba(44,36,32,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${widthPct}%`,
            background: 'linear-gradient(90deg, var(--accent-gold-dark), var(--accent-gold), var(--accent-gold-light))',
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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>{BRL(vendedora.total)}</div>
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
            style={{ width: 90, fontSize: 12, padding: '4px 6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, textAlign: 'right' }} />
        )}
      </div>
    </div>
  )
}
