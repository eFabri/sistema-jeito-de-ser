// src/app/vendas/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Check, Search, Circle, Wallet, ChevronRight } from 'lucide-react'

const BRL = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const fmtDia = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

const fmtDiaCompleto = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

// ── Date utils ──────────────────────────────────────────────────────────────
function getToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

function calcRange(key: string, custom: { ini: string; fim: string }): { ini: string; fim: string } {
  if (key === 'personalizado') return { ini: custom.ini, fim: custom.fim }
  const hoje = getToday()
  if (key === 'hoje')  return { ini: hoje, fim: hoje }
  if (key === 'ontem') { const d = addDays(hoje, -1); return { ini: d, fim: d } }
  if (key === 'esta_semana') {
    const day = new Date(hoje + 'T12:00:00').getDay()
    return { ini: addDays(hoje, -(day === 0 ? 6 : day - 1)), fim: hoje }
  }
  if (key === 'semana_passada') {
    const day     = new Date(hoje + 'T12:00:00').getDay()
    const thisMon = addDays(hoje, -(day === 0 ? 6 : day - 1))
    const lastMon = addDays(thisMon, -7)
    return { ini: lastMon, fim: addDays(lastMon, 6) }
  }
  if (key === 'quinzena')  return { ini: addDays(hoje, -14), fim: hoje }
  if (key === 'este_mes')  return { ini: hoje.substring(0, 7) + '-01', fim: hoje }
  if (key === 'mes_passado') {
    const [y, m] = hoje.split('-').map(Number)
    const lm = m === 1 ? 12 : m - 1
    const ly = m === 1 ? y - 1 : y
    const first = `${ly}-${String(lm).padStart(2, '0')}-01`
    const last  = new Date(y, m - 1, 0).toLocaleDateString('en-CA')
    return { ini: first, fim: last }
  }
  return { ini: hoje, fim: hoje }
}

// ── Badge ────────────────────────────────────────────────────────────────────
const TIPO_COR: Record<string, { bg: string; c: string; b: string }> = {
  'Venda':        { bg: 'rgba(76,175,130,0.1)',  c: '#4CAF82', b: 'rgba(76,175,130,0.2)' },
  'Venda Direta': { bg: 'rgba(201,168,76,0.1)',  c: '#C9A84C', b: 'rgba(201,168,76,0.2)' },
  'Crediário':    { bg: 'rgba(96,165,250,0.1)',  c: '#60A5FA', b: 'rgba(96,165,250,0.2)' },
  'Condicional':  { bg: 'rgba(251,146,60,0.1)',  c: '#FB923C', b: 'rgba(251,146,60,0.2)' },
  'Cancelada':    { bg: 'rgba(229,88,74,0.1)',   c: '#E5584A', b: 'rgba(229,88,74,0.25)' },
}

function getBadgeTipo(v: any): string {
  if (v.origem === 'condicional')               return 'Condicional'
  if (v.situacao === 'Cancelada')               return 'Cancelada'
  if (v.situacao === 'Venda Direta')            return 'Venda Direta'
  if (v.forma_pagamento?.includes('Crediário')) return 'Crediário'
  return 'Venda'
}

function Badge({ tipo, condStatus }: { tipo: string; condStatus?: string }) {
  const s   = TIPO_COR[tipo] || TIPO_COR['Venda']
  let label = tipo.toUpperCase()
  if (tipo === 'Condicional' && condStatus === 'confirmada') label = 'CONFIRMADA'
  if (tipo === 'Condicional' && condStatus === 'devolvida')  label = 'DEVOLVIDA'
  return (
    <span style={{
      background: s.bg, color: s.c, border: `1px solid ${s.b}`,
      borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Constants ────────────────────────────────────────────────────────────────
const PERIODOS = [
  { key: 'hoje',           label: 'Hoje' },
  { key: 'ontem',          label: 'Ontem' },
  { key: 'esta_semana',    label: 'Esta semana' },
  { key: 'semana_passada', label: 'Semana passada' },
  { key: 'quinzena',       label: 'Últimos 15 dias' },
  { key: 'este_mes',       label: 'Este mês' },
  { key: 'mes_passado',    label: 'Mês passado' },
  { key: 'personalizado',  label: 'Personalizado' },
]

const TIPOS = [
  { key: '',           label: 'Todas' },
  { key: 'venda',      label: 'Venda' },
  { key: 'direta',     label: 'Venda Direta' },
  { key: 'crediario',  label: 'Crediário' },
  { key: 'condicional',label: 'Condicional' },
  { key: 'cancelada',  label: 'Cancelada' },
]

const FORMAS_PGTO = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Cheque', 'Transferência']

const LABEL_SIDEBAR: React.CSSProperties = {
  fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em',
  textTransform: 'uppercase', marginBottom: 12, display: 'block',
}

// ── Main component ───────────────────────────────────────────────────────────
export default function VendasPage() {
  const router = useRouter()

  // Period
  const [periodoKey, setPeriodoKey] = useState('este_mes')
  const [custom, setCustom]         = useState({ ini: '', fim: '' })
  const range = calcRange(periodoKey, custom)

  // List
  const [vendas,  setVendas]  = useState<any[]>([])
  const [total,   setTotal]   = useState(0)
  const [q,       setQ]       = useState('')
  const [busca,   setBusca]   = useState('')
  const [tipoFil, setTipoFil] = useState('')
  const [pagina,  setPagina]  = useState(1)
  const [loading, setLoading] = useState(true)
  const limite = 50

  // Resumo
  const [resumo,        setResumo]        = useState<any>(null)
  const [loadingResumo, setLoadingResumo] = useState(false)

  // Modal receber
  const [modalV,      setModalV]      = useState<any>(null)
  const [parcelas,    setParcelas]    = useState<any[]>([])
  const [parcelaSel,  setParcelaSel]  = useState<any>(null)
  const [loadingMdl,  setLoadingMdl]  = useState(false)
  const [formaPgto,   setFormaPgto]   = useState('Dinheiro')
  const [valorMdl,    setValorMdl]    = useState('')
  const [descontoMdl, setDescontoMdl] = useState('0')
  const [jurosMdl,    setJurosMdl]    = useState('0')
  const [dataMdl,     setDataMdl]     = useState(getToday())
  const [confirmando, setConfirmando] = useState(false)
  const [erroMdl,     setErroMdl]     = useState('')

  // ── Fetch resumo ──
  useEffect(() => {
    if (!range.ini || !range.fim) return
    setLoadingResumo(true)
    setResumo(null)
    fetch(`/api/vendas/resumo?ini=${range.ini}&fim=${range.fim}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setResumo(d); setLoadingResumo(false) })
  }, [range.ini, range.fim])

  // ── Fetch vendas ──
  const buscar = useCallback(async () => {
    if (!range.ini || !range.fim) return
    setLoading(true)
    const params = new URLSearchParams({
      q: busca, ini: range.ini, fim: range.fim,
      tipo: tipoFil, pagina: String(pagina), limite: String(limite),
    })
    const d = await fetch(`/api/vendas?${params}`, { cache: 'no-store' }).then(r => r.json())
    setVendas(d.vendas || [])
    setTotal(d.total || 0)
    setLoading(false)
  }, [busca, tipoFil, pagina, range.ini, range.fim])

  useEffect(() => { buscar() }, [buscar])
  useEffect(() => {
    const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350)
    return () => clearTimeout(t)
  }, [q])

  // ── Modal receber ──
  async function abrirModal(v: any) {
    setModalV(v)
    setLoadingMdl(true)
    setParcelaSel(null)
    setErroMdl('')
    setDescontoMdl('0')
    setJurosMdl('0')
    setDataMdl(getToday())
    setFormaPgto('Dinheiro')
    const data = await fetch(`/api/vendas/${v.id}`).then(r => r.json())
    const abertas = (data.crediario || []).filter((p: any) => !p.pago)
    setParcelas(abertas)
    if (abertas.length > 0) {
      setParcelaSel(abertas[0])
      setValorMdl(String(Number(abertas[0].saldo_devedor || abertas[0].valor).toFixed(2)))
    }
    setLoadingMdl(false)
  }

  function fecharModal() {
    setModalV(null); setParcelas([]); setParcelaSel(null)
    setValorMdl(''); setDescontoMdl('0'); setJurosMdl('0')
    setDataMdl(getToday()); setFormaPgto('Dinheiro'); setErroMdl('')
  }

  async function confirmarRecebimento() {
    if (!parcelaSel) return
    setConfirmando(true); setErroMdl('')
    try {
      const res = await fetch('/api/financeiro/receber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_conta:      parcelaSel.id,
          valor_recebido: parseFloat(valorMdl)    || 0,
          forma_pgto:     formaPgto,
          juros:          parseFloat(jurosMdl)    || 0,
          desconto:       parseFloat(descontoMdl) || 0,
          data_pgto:      dataMdl,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.erro || 'Erro ao receber')
      fecharModal()
      buscar()
    } catch (e: any) {
      setErroMdl(e.message)
    } finally {
      setConfirmando(false)
    }
  }

  const totalPaginas = Math.ceil(total / limite)

  const rowStyle = (i: number, last: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: '80px 58px 1fr 100px 120px 100px 100px 150px',
    padding: '11px 16px',
    borderBottom: !last ? '1px solid rgba(201,168,76,0.05)' : 'none',
    alignItems: 'center',
  })

  return (
    <AppLayout>

      {/* ── MODAL RECEBER ── */}
      {modalV && (
        <div
          onClick={e => { if (e.target === e.currentTarget) fecharModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
            <div style={{ padding: '22px 24px 16px' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#332F3A' }}>
                Receber Crediário
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
                {modalV.nome_cliente} — Venda #{modalV.codigo_legado || modalV.id}
              </p>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              {loadingMdl ? (
                <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando parcelas...</div>
              ) : parcelas.length === 0 ? (
                <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma parcela em aberto</div>
              ) : (
                <>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
                    <span style={LABEL_SIDEBAR}>Selecionar parcela</span>
                    {parcelas.map((p: any) => {
                      const sel     = parcelaSel?.id === p.id
                      const vencida = new Date(p.data_vencimento + 'T12:00:00') < new Date()
                      const saldo   = Number(p.saldo_devedor || p.valor)
                      return (
                        <div key={p.id}
                          onClick={() => { setParcelaSel(p); setValorMdl(saldo.toFixed(2)) }}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                            background: sel ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${sel ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                            transition: 'all 0.15s',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                              border: `2px solid ${sel ? '#C9A84C' : 'var(--border)'}`,
                              background: sel ? '#C9A84C' : 'transparent',
                            }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#332F3A' }}>{p.parcela}</div>
                              <div style={{ fontSize: 11, color: vencida ? '#E5584A' : 'var(--text-muted)' }}>
                                {fmtDiaCompleto(p.data_vencimento)}{vencida ? ' · VENCIDA' : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C', fontSize: 15 }}>
                            {BRL(saldo)}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={LABEL_SIDEBAR}>Valor (R$)</label>
                      <input className="input" type="number" step="0.01" value={valorMdl}
                        onChange={e => setValorMdl(e.target.value)} />
                    </div>
                    <div>
                      <label style={LABEL_SIDEBAR}>Desconto (R$)</label>
                      <input className="input" type="number" step="0.01" value={descontoMdl}
                        onChange={e => setDescontoMdl(e.target.value)} />
                    </div>
                    <div>
                      <label style={LABEL_SIDEBAR}>Juros (R$)</label>
                      <input className="input" type="number" step="0.01" value={jurosMdl}
                        onChange={e => setJurosMdl(e.target.value)} />
                    </div>
                    <div>
                      <label style={LABEL_SIDEBAR}>Data</label>
                      <input className="input" type="date" value={dataMdl}
                        onChange={e => setDataMdl(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={LABEL_SIDEBAR}>Forma de pagamento</label>
                    <select className="input" value={formaPgto}
                      onChange={e => setFormaPgto(e.target.value)}>
                      {FORMAS_PGTO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {erroMdl && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(229,88,74,0.08)', borderRadius: 8, border: '1px solid rgba(229,88,74,0.2)', color: '#E5584A', fontSize: 13 }}>
                      {erroMdl}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={fecharModal}>Cancelar</button>
                    <button className="btn btn-primary" style={{ flex: 2 }}
                      onClick={confirmarRecebimento}
                      disabled={confirmando || !parcelaSel || !valorMdl}>
                      {confirmando ? 'Confirmando...' : <><Check size={13} strokeWidth={2.5} /> Confirmar Recebimento</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE ── */}
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A' }}>Vendas</h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {total.toLocaleString('pt-BR')} registro{total !== 1 ? 's' : ''} no período
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push('/vendas/nova?modo=manual')} style={{ fontSize: 13 }}>+ Inserir Venda Antiga</button>
            <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')}>+ Nova Venda</button>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── LEFT SIDEBAR ── */}
          <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Period picker */}
            <div className="card" style={{ padding: '16px 16px' }}>
              <span style={LABEL_SIDEBAR}>Período</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {PERIODOS.map(p => (
                  <button key={p.key}
                    onClick={() => { setPeriodoKey(p.key); setPagina(1) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: periodoKey === p.key ? 'rgba(201,168,76,0.1)' : 'transparent',
                      border: periodoKey === p.key ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
                      borderRadius: 6, padding: '7px 10px', cursor: 'pointer', textAlign: 'left',
                      fontSize: 12, color: periodoKey === p.key ? '#C9A84C' : 'var(--text-secondary)',
                      transition: 'all 0.12s',
                    }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: periodoKey === p.key ? '#C9A84C' : 'transparent',
                      border: `2px solid ${periodoKey === p.key ? '#C9A84C' : 'rgba(201,168,76,0.25)'}`,
                      transition: 'all 0.12s',
                    }} />
                    {p.label}
                  </button>
                ))}
              </div>

              {periodoKey === 'personalizado' && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>De</label>
                    <input type="date" className="input" style={{ fontSize: 12, padding: '6px 10px' }}
                      value={custom.ini} onChange={e => setCustom(c => ({ ...c, ini: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Até</label>
                    <input type="date" className="input" style={{ fontSize: 12, padding: '6px 10px' }}
                      value={custom.fim} onChange={e => setCustom(c => ({ ...c, fim: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="card" style={{ padding: '16px 16px' }}>
              <span style={LABEL_SIDEBAR}>Resumo do período</span>
              {loadingResumo || !resumo ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Calculando...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Vendas realizadas</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#332F3A', lineHeight: 1 }}>
                      {resumo.total_vendas}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total vendido</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: '#C9A84C', lineHeight: 1.1 }}>
                      {BRL(resumo.valor_total)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Ticket médio</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: '#332F3A' }}>
                      {BRL(resumo.ticket_medio)}
                    </div>
                  </div>

                  {resumo.por_forma?.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Por forma</div>
                      {resumo.por_forma.map((pf: any) => (
                        <div key={pf.forma} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{pf.forma}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#332F3A', fontFamily: 'var(--font-display)', flexShrink: 0, marginLeft: 6 }}>{BRL(pf.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT MAIN ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Search + tipo tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}><Search size={13} strokeWidth={1.8} /></span>
                <input className="input" style={{ paddingLeft: 36 }}
                  placeholder="Buscar por cliente..." value={q}
                  onChange={e => setQ(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TIPOS.map(t => (
                  <button key={t.key}
                    onClick={() => { setTipoFil(t.key); setPagina(1) }}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.12s',
                      background: tipoFil === t.key ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.03)',
                      border: tipoFil === t.key ? '1px solid rgba(201,168,76,0.4)' : '1px solid var(--border)',
                      color: tipoFil === t.key ? '#C9A84C' : 'var(--text-secondary)',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '80px 58px 1fr 100px 120px 100px 100px 150px',
                padding: '11px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(201,168,76,0.03)',
              }}>
                {['Data', 'Nº', 'Cliente', 'Vendedora', 'Forma', 'Valor', 'Tipo', 'Ações'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
              ) : vendas.length === 0 ? (
                <div style={{ padding: '52px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.25 }}><Circle size={32} strokeWidth={1} /></div>
                  Nenhum registro encontrado no período
                </div>
              ) : vendas.map((v, i) => {
                const tipo_       = getBadgeTipo(v)
                const eCondicional = v.origem === 'condicional'
                const temCrediario = !eCondicional && v.forma_pagamento?.includes('Crediário')
                const cancelada   = v.situacao === 'Cancelada'

                return (
                  <div key={`${v.origem}-${v.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 58px 1fr 100px 120px 100px 100px 150px',
                      padding: '11px 16px',
                      borderBottom: i < vendas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                      alignItems: 'center',
                      opacity: cancelada ? 0.55 : 1,
                    }}>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDia(v.data)}</div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      #{v.codigo_legado || v.id}
                    </div>

                    <div style={{ paddingRight: 8, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.nome_cliente || '—'}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.vendedor || '—'}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {eCondicional ? '—' : (v.forma_pagamento || '—')}
                    </div>

                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: cancelada ? 'var(--text-muted)' : '#C9A84C' }}>
                      {BRL(v.valor_total)}
                    </div>

                    <div>
                      <Badge tipo={tipo_} condStatus={v.cond_status} />
                    </div>

                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => eCondicional
                          ? router.push(`/condicionais/${v.cond_id}`)
                          : router.push(`/vendas/${v.id}`)}>
                        {eCondicional ? 'Cond. →' : 'Ver'}
                      </button>
                      {temCrediario && (
                        <button
                          onClick={() => abrirModal(v)}
                          title="Receber parcela"
                          style={{
                            padding: '4px 9px', fontSize: 13, cursor: 'pointer', borderRadius: 6,
                            background: 'rgba(76,175,130,0.08)',
                            border: '1px solid rgba(76,175,130,0.25)',
                            color: '#4CAF82', transition: 'all 0.12s',
                          }}>
                          <Wallet size={13} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>‹ Anterior</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>{pagina} de {totalPaginas}</span>
                <button className="btn btn-ghost" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>Próxima <ChevronRight size={13} strokeWidth={2} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
