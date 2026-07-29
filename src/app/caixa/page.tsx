'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

// ─── helpers ────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}
const fmtHora = (s: string) =>
  new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

// ─── tipos ──────────────────────────────────────────────────────────────────
type Aba = 'resumo' | 'vendas' | 'receb' | 'saidas' | 'obs'
const ABAS: { id: Aba; label: string }[] = [
  { id: 'resumo',  label: 'Resumo' },
  { id: 'vendas',  label: 'Vendas' },
  { id: 'receb',   label: 'Recebimentos' },
  { id: 'saidas',  label: 'Saídas' },
  { id: 'obs',     label: 'Observações' },
]

// ─── micro-componentes ───────────────────────────────────────────────────────
function StatCard({ label, valor, sub, cor }: { label: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: cor ?? 'var(--text-primary)' }}>{valor}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</span>
      {right}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>{text}</p>
}

// ─── página ──────────────────────────────────────────────────────────────────
export default function CaixaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const idParam = searchParams.get('id')

  const [estado, setEstado] = useState<any>(null)
  const [detalhe, setDetalhe] = useState<any>(null)
  const [perfil, setPerfil]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('resumo')

  // Abertura
  const [valorAbertura, setValorAbertura] = useState('')

  // Fechamento
  const [valorContado, setValorContado] = useState('')
  const [observacoes, setObservacoes]   = useState('')

  // Movimento modal
  const [modalMov, setModalMov] = useState<'sangria' | 'suprimento' | null>(null)
  const [movValor, setMovValor] = useState('')
  const [movMotivo, setMovMotivo] = useState('')

  // Reabertura modal
  const [modalReabrir, setModalReabrir] = useState(false)
  const [motivoReabrir, setMotivoReabrir] = useState('')

  // ─── fetch ────────────────────────────────────────────────────────────────
  const buscar = useCallback(async () => {
    const url = idParam ? `/api/caixa?id=${idParam}` : '/api/caixa'
    const [est, per] = await Promise.all([
      fetch(url).then(r => r.json()),
      fetch('/api/perfil').then(r => r.ok ? r.json() : null),
    ])
    setEstado(est)
    setPerfil(per)
    setLoading(false)

    if (est?.caixa?.id) {
      fetch(`/api/caixa/detalhe?caixa_id=${est.caixa.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setDetalhe(d) })
    }
  }, [idParam])

  useEffect(() => { buscar() }, [buscar])

  const isAdmin    = perfil?.perfil === 'admin'
  const nomePerfil = perfil?.apelido || perfil?.nome?.split(' ')[0] || ''

  // ─── handlers ─────────────────────────────────────────────────────────────
  async function abrirCaixa() {
    setErro('')
    setSalvando(true)
    const r = await fetch('/api/caixa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor_abertura: Number(valorAbertura) || 0, aberto_por: nomePerfil }),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.mensagem || d.erro || 'Erro ao abrir caixa.'); return }
    setValorAbertura('')
    buscar()
  }

  async function fecharCaixa() {
    setErro('')
    if (!valorContado.trim()) { setErro('Informe o valor contado.'); return }
    setSalvando(true)
    const body: any = {
      acao:          'fechar',
      valor_contado: Number(valorContado.replace(',', '.')),
      fechado_por:   nomePerfil,
      observacoes:   observacoes || null,
    }
    if (estado?.caixa?.id) body.caixa_id = estado.caixa.id
    const r = await fetch('/api/caixa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.erro || 'Erro ao fechar caixa.'); return }
    setValorContado('')
    if (idParam) { router.push('/caixa'); return }
    buscar()
  }

  async function reabrirCaixa() {
    setErro('')
    if (!motivoReabrir.trim()) { setErro('Informe o motivo da reabertura.'); return }
    setSalvando(true)
    const body: any = { acao: 'reabrir', motivo_reabertura: motivoReabrir, aberto_por: nomePerfil, perfil: perfil?.perfil }
    if (estado?.caixa?.id) body.caixa_id = estado.caixa.id
    const r = await fetch('/api/caixa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.erro || 'Erro ao reabrir caixa.'); return }
    setModalReabrir(false)
    setMotivoReabrir('')
    buscar()
  }

  async function lancarMovimento() {
    setErro('')
    const v = Number(movValor.replace(',', '.'))
    if (!v || v <= 0) { setErro('Valor deve ser maior que zero.'); return }
    setSalvando(true)
    const r = await fetch('/api/caixa/movimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: modalMov, valor: v, motivo: movMotivo, criado_por: nomePerfil }),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.erro || 'Erro ao registrar movimento.'); return }
    setModalMov(null); setMovValor(''); setMovMotivo('')
    buscar()
  }

  // ─── estado derivado ──────────────────────────────────────────────────────
  if (loading) return (
    <AppLayout>
      <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Carregando caixa...</div>
    </AppLayout>
  )

  const {
    caixa, abertos_anteriores = [],
    valor_esperado = 0, vendas_dinheiro = 0, recebimentos_dinheiro = 0,
    suprimentos = 0, sangrias = 0, saidas_dinheiro = 0,
  } = estado ?? {}

  const contadoNum = valorContado ? Number(valorContado.replace(',', '.')) : null
  const diferenca  = contadoNum !== null ? contadoNum - valor_esperado : null
  const corDif     = diferenca === null ? 'var(--text-muted)'
    : diferenca > 0 ? '#4CAF82' : diferenca < 0 ? 'var(--danger)' : '#4CAF82'

  // ─── conteúdo de cada aba ────────────────────────────────────────────────
  function renderResumo() {
    const totalEntradas = vendas_dinheiro + recebimentos_dinheiro + suprimentos
    const totalSaidas   = sangrias + saidas_dinheiro

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* 4 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <StatCard label="Abertura"  valor={BRL(Number(caixa?.valor_abertura ?? 0))} cor="var(--text-secondary)" />
          <StatCard label="Esperado"  valor={BRL(valor_esperado)} cor="var(--accent-gold)" />
          <StatCard label="Contado"   valor={contadoNum !== null ? BRL(contadoNum) : '—'} cor="var(--text-primary)" />
          <StatCard label="Diferença" valor={diferenca !== null ? (diferenca === 0 ? '✓ Exato' : `${diferenca > 0 ? '+' : ''}${BRL(diferenca)}`) : '—'} cor={corDif} />
        </div>

        {/* Composição */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { label: 'Abertura do dia',            valor: Number(caixa?.valor_abertura ?? 0), cor: 'var(--text-secondary)' },
            { label: '+ Vendas em Dinheiro',        valor: vendas_dinheiro,          cor: '#4CAF82' },
            { label: '+ Recebimentos (Crediário)',  valor: recebimentos_dinheiro,    cor: '#4CAF82' },
            { label: '+ Suprimentos',               valor: suprimentos,              cor: '#4CAF82' },
            { label: '− Sangrias',                  valor: -sangrias,                cor: 'var(--danger)' },
            { label: '− Saídas (contas pagas)',     valor: -saidas_dinheiro,         cor: 'var(--danger)' },
          ].map(({ label, valor, cor }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: cor, fontWeight: 600 }}>{BRL(valor)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
            <span>= Esperado em caixa</span>
            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>{BRL(valor_esperado)}</span>
          </div>
        </div>

        {/* Totais resumidos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'rgba(76,175,130,0.07)', border: '1px solid rgba(76,175,130,0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#4CAF82' }}>Total entradas</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#4CAF82' }}>{BRL(totalEntradas)}</span>
          </div>
          <div style={{ background: 'rgba(220,53,69,0.06)', border: '1px solid rgba(220,53,69,0.2)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--danger)' }}>Total saídas</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{BRL(totalSaidas)}</span>
          </div>
        </div>
      </div>
    )
  }

  function renderVendas() {
    const vendas = detalhe?.vendas ?? []
    const totalVendas = vendas.reduce((s: number, v: any) => s + Number(v.valor_total), 0)
    const allPgtos: any[] = vendas.flatMap((v: any) => v.vendas_pagamento ?? [])

    const byForma: Record<string, { total: number; count: number }> = {}
    for (const p of allPgtos) {
      if (!byForma[p.forma]) byForma[p.forma] = { total: 0, count: 0 }
      byForma[p.forma].total += Number(p.valor)
      byForma[p.forma].count++
    }
    const ORDEM = ['Dinheiro', 'Crediário', 'PIX', 'Cartão', 'Boleto', 'Depósito']
    const formasOrdenadas = ORDEM.filter(f => byForma[f]).concat(
      Object.keys(byForma).filter(f => !ORDEM.includes(f))
    )

    if (!detalhe) return <EmptyState text="Carregando dados de vendas..." />

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Resumo geral */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <StatCard label="Total vendas"   valor={BRL(totalVendas)} cor="var(--accent-gold)" />
          <StatCard label="Nº de vendas"   valor={String(vendas.length)} sub={vendas.length === 1 ? '1 venda' : `${vendas.length} vendas`} />
          <StatCard label="Clientes novos" valor={String(detalhe?.clientes_novos ?? 0)} sub="cadastrados hoje" />
        </div>

        {/* Por forma de pagamento */}
        <div>
          <SectionLabel>Por forma de pagamento</SectionLabel>
          {formasOrdenadas.length === 0
            ? <EmptyState text="Nenhuma venda registrada hoje" />
            : formasOrdenadas.map(forma => {
              const g = byForma[forma]
              return (
                <div key={forma} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{forma}</span>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.count} {g.count === 1 ? 'lançamento' : 'lançamentos'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{BRL(g.total)}</span>
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* Lista de vendas (compact) */}
        {vendas.length > 0 && (
          <div>
            <SectionLabel>Vendas do dia</SectionLabel>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['#', 'Cliente', 'Forma', 'Total'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendas.map((v: any) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{v.id}</td>
                      <td style={{ padding: '7px 8px', color: 'var(--text-primary)' }}>{v.nome_cliente}</td>
                      <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{v.forma_pagamento || '—'}</td>
                      <td style={{ padding: '7px 8px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{BRL(Number(v.valor_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderReceb() {
    const receb = detalhe?.recebimentos ?? []
    const totalReceb = receb.reduce((s: number, r: any) => s + Number(r.credito), 0)

    if (!detalhe) return <EmptyState text="Carregando dados de recebimentos..." />

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard label="Total recebido" valor={BRL(totalReceb)} cor="#4CAF82" />
          <StatCard label="Nº recebimentos" valor={String(receb.length)} sub="parcelas pagas em dinheiro" />
        </div>

        <div>
          <SectionLabel>Recebimentos crediário em dinheiro</SectionLabel>
          {receb.length === 0
            ? <EmptyState text="Nenhum recebimento de crediário em dinheiro hoje" />
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Descrição / Histórico', 'Forma', 'Valor'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {receb.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 8px', color: 'var(--text-primary)' }}>{r.historico || r.descricao || '—'}</td>
                        <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{r.condicao || 'Dinheiro'}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4CAF82', whiteSpace: 'nowrap' }}>{BRL(Number(r.credito))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      </div>
    )
  }

  function renderSaidas() {
    const movimentos    = detalhe?.movimentos    ?? []
    const saidasFluxo   = detalhe?.saidas_fluxo  ?? []
    const trocas        = detalhe?.trocas         ?? []

    const sang  = movimentos.filter((m: any) => m.tipo === 'sangria')
    const supr  = movimentos.filter((m: any) => m.tipo === 'suprimento')
    const trocasReemb = trocas.filter((t: any) => Number(t.diferenca ?? 0) < 0)

    const totSang  = sang.reduce((s: number, m: any) => s + Number(m.valor), 0)
    const totSupr  = supr.reduce((s: number, m: any) => s + Number(m.valor), 0)
    const totFluxo = saidasFluxo.reduce((s: number, r: any) => s + Number(r.debito), 0)
    const totTroca = trocasReemb.reduce((s: number, t: any) => s + Math.abs(Number(t.diferenca ?? 0)), 0)

    if (!detalhe) return <EmptyState text="Carregando dados de saídas..." />

    const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 7, marginBottom: 6 } as const
    const subStyle = { fontSize: 11, color: 'var(--text-muted)' } as const

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Botões de lançamento */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setModalMov('suprimento'); setErro('') }}>+ Suprimento</button>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setModalMov('sangria'); setErro('') }}>− Sangria</button>
        </div>

        {/* Sangrias */}
        <div>
          <SectionLabel right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{BRL(totSang)}</span>}>Sangrias (retiradas)</SectionLabel>
          {sang.length === 0 ? <EmptyState text="Nenhuma sangria" /> : sang.map((m: any) => (
            <div key={m.id} style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.motivo || '—'}</div>
                <div style={subStyle}>{m.criado_por || ''}{m.criado_por && m.criado_em ? ' · ' : ''}{m.criado_em ? fmtHora(m.criado_em) : ''}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)', whiteSpace: 'nowrap' }}>− {BRL(Number(m.valor))}</span>
            </div>
          ))}
        </div>

        {/* Suprimentos */}
        <div>
          <SectionLabel right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#4CAF82' }}>{BRL(totSupr)}</span>}>Suprimentos (reforços)</SectionLabel>
          {supr.length === 0 ? <EmptyState text="Nenhum suprimento" /> : supr.map((m: any) => (
            <div key={m.id} style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{m.motivo || '—'}</div>
                <div style={subStyle}>{m.criado_por || ''}{m.criado_por && m.criado_em ? ' · ' : ''}{m.criado_em ? fmtHora(m.criado_em) : ''}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4CAF82', whiteSpace: 'nowrap' }}>+ {BRL(Number(m.valor))}</span>
            </div>
          ))}
        </div>

        {/* Saídas via fluxo_caixa */}
        {saidasFluxo.length > 0 && (
          <div>
            <SectionLabel right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{BRL(totFluxo)}</span>}>Saídas (contas pagas)</SectionLabel>
            {saidasFluxo.map((r: any) => (
              <div key={r.id} style={rowStyle}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.historico || r.descricao || r.despesa || '—'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)', whiteSpace: 'nowrap' }}>− {BRL(Number(r.debito))}</span>
              </div>
            ))}
          </div>
        )}

        {/* Devoluções com reembolso */}
        {trocasReemb.length > 0 && (
          <div>
            <SectionLabel right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{BRL(totTroca)}</span>}>Devoluções com reembolso</SectionLabel>
            {trocasReemb.map((t: any) => (
              <div key={t.id} style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t.nome_cliente || '—'}</div>
                  <div style={subStyle}>{t.status}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)', whiteSpace: 'nowrap' }}>− {BRL(Math.abs(Number(t.diferenca ?? 0)))}</span>
              </div>
            ))}
          </div>
        )}

        {sang.length === 0 && saidasFluxo.length === 0 && trocasReemb.length === 0 && (
          <EmptyState text="Nenhuma saída registrada hoje" />
        )}
      </div>
    )
  }

  function renderObs() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
          Observações do fechamento
        </label>
        <textarea
          className="input"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Anotações sobre o fechamento do dia... (ocorrências, troco restante, informações relevantes...)"
          style={{ minHeight: 140, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13 }}
        />
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Salvo junto ao fechamento e fica registrado no histórico do caixa.
        </p>
      </div>
    )
  }

  // ─── render principal ─────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Modal sangria / suprimento */}
      {modalMov && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,18,36,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModalMov(null) }}>
          <div className="card" style={{ width: 380, padding: 28, margin: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18, textTransform: 'capitalize' }}>
              {modalMov === 'sangria' ? '− Sangria' : '+ Suprimento'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Valor (R$)</label>
                <input className="input" type="number" step="0.01" min="0.01" value={movValor}
                  onChange={e => setMovValor(e.target.value)} placeholder="0,00" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Motivo</label>
                <input className="input" value={movMotivo} onChange={e => setMovMotivo(e.target.value)}
                  placeholder={modalMov === 'sangria' ? 'Ex: Pagamento fornecedor, Depósito...' : 'Ex: Troco inicial, Reforço...'}
                  onKeyDown={e => { if (e.key === 'Enter') lancarMovimento() }} />
              </div>
              {erro && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{erro}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => { setModalMov(null); setErro('') }} style={{ flex: 1 }}>Cancelar</button>
                <button className="btn btn-primary" onClick={lancarMovimento} disabled={salvando} style={{ flex: 1 }}>
                  {salvando ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal reabertura */}
      {modalReabrir && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,18,36,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setModalReabrir(false); setErro('') } }}>
          <div className="card" style={{ width: 400, padding: 28, margin: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Reabrir Caixa</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Esta ação desfaz o fechamento. O motivo será registrado no histórico.</p>
            <div>
              <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Motivo obrigatório</label>
              <input className="input" value={motivoReabrir} onChange={e => setMotivoReabrir(e.target.value)}
                placeholder="Ex: Erro no valor contado..." onKeyDown={e => { if (e.key === 'Enter') reabrirCaixa() }} autoFocus />
            </div>
            {erro && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{erro}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => { setModalReabrir(false); setErro('') }} style={{ flex: 1 }}>Cancelar</button>
              <button onClick={reabrirCaixa} disabled={salvando}
                style={{ flex: 1, padding: '10px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {salvando ? 'Reabrindo...' : 'Reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720, margin: '0 auto' }}>

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {caixa ? `Fechamento de Caixa — ${fmtData(caixa.data)}` : 'Caixa'}
              </h1>
              {idParam && caixa && (
                <span style={{ padding: '2px 10px', background: 'rgba(232,168,56,0.15)', border: '1px solid rgba(232,168,56,0.4)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#E8A838' }}>
                  ⚠ Retroativo
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {idParam && caixa
                ? `Fechando caixa de ${fmtData(caixa.data)}`
                : new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {idParam && (
              <button className="btn btn-ghost" onClick={() => router.push('/caixa')} style={{ fontSize: 12 }}>
                ← Voltar ao hoje
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => router.push('/financeiro')} style={{ fontSize: 12 }}>
              ← Financeiro
            </button>
          </div>
        </div>

        {/* ─── Aviso caixa anterior não fechado ───────────────────────────── */}
        {abertos_anteriores.length > 0 && abertos_anteriores.map((ant: any) => (
          <div key={ant.id} style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.4)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)' }}>Caixa anterior não fechado</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Caixa de {fmtData(ant.data)} está aberto sem fechamento. Feche-o antes de abrir o de hoje.
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push(`/caixa?id=${ant.id}`)}
              style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.5)', borderRadius: 8, color: 'var(--accent-gold)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Fechar caixa de {fmtData(ant.data)} →
            </button>
          </div>
        ))}

        {/* ─── Erro geral ──────────────────────────────────────────────────── */}
        {erro && !modalMov && !modalReabrir && (
          <div style={{ background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.3)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--danger)' }}>
            {erro}
          </div>
        )}

        {/* ─── SEM CAIXA: Abrir ────────────────────────────────────────────── */}
        {!caixa && (
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Abrir Caixa</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Informe o valor em dinheiro que está no caixa agora.</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Valor de abertura (R$)</label>
                <input className="input" type="number" step="0.01" min="0" value={valorAbertura}
                  onChange={e => setValorAbertura(e.target.value)} placeholder="0,00"
                  onKeyDown={e => { if (e.key === 'Enter') abrirCaixa() }} />
              </div>
              <button className="btn btn-primary" onClick={abrirCaixa} disabled={salvando} style={{ padding: '10px 24px' }}>
                {salvando ? 'Abrindo...' : 'Confirmar abertura'}
              </button>
            </div>
          </div>
        )}

        {/* ─── CAIXA ABERTO: Interface com abas ────────────────────────────── */}
        {caixa && caixa.status === 'aberto' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Tab nav */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
              {ABAS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setAba(a.id)}
                  style={{
                    padding: '12px 18px',
                    fontSize: 12,
                    fontWeight: aba === a.id ? 700 : 500,
                    color: aba === a.id ? 'var(--accent-gold)' : 'var(--text-muted)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: aba === a.id ? '2px solid var(--accent-gold)' : '2px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s, border-color 0.15s',
                    letterSpacing: '0.02em',
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Conteúdo da aba */}
            <div style={{ padding: '20px 24px', minHeight: 260, maxHeight: '52vh', overflowY: 'auto' }}>
              {aba === 'resumo' && renderResumo()}
              {aba === 'vendas' && renderVendas()}
              {aba === 'receb'  && renderReceb()}
              {aba === 'saidas' && renderSaidas()}
              {aba === 'obs'    && renderObs()}
            </div>

            {/* ─── Rodapé fixo: valor contado + confirmar ─────────────────── */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 200 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                    Valor contado *
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorContado}
                    onChange={e => setValorContado(e.target.value)}
                    placeholder="0,00"
                    style={{ height: 36, fontSize: 14, fontWeight: 600 }}
                    onKeyDown={e => { if (e.key === 'Enter' && valorContado) fecharCaixa() }}
                  />
                </div>
                {diferenca !== null && (
                  <div style={{ textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Diferença</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: corDif }}>
                      {diferenca === 0 ? '✓ Exato' : `${diferenca > 0 ? '+' : ''}${BRL(diferenca)}`}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => router.push(idParam ? '/caixa' : '/financeiro')}
                  style={{ fontSize: 12 }}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={fecharCaixa}
                  disabled={salvando || !valorContado.trim()}
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700 }}
                >
                  {salvando ? 'Fechando...' : 'Confirmar fechamento'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── CAIXA FECHADO: Resumo ───────────────────────────────────────── */}
        {caixa && caixa.status === 'fechado' && (() => {
          const det = caixa.detalhamento || {}
          const dif = Number(det.diferenca ?? 0)
          const corD = dif > 0 ? '#4CAF82' : dif < 0 ? 'var(--danger)' : '#4CAF82'
          return (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#4CAF82', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                    ✓ Caixa fechado
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    por {caixa.fechado_por || '—'} às {caixa.fechado_em ? fmtHora(caixa.fechado_em) : '—'}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => { setModalReabrir(true); setErro('') }}
                    style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.3)', borderRadius: 8, color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
                    Reabrir
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Abertura do dia',            valor: det.valor_abertura },
                  { label: '+ Vendas em Dinheiro',        valor: det.vendas_dinheiro },
                  { label: '+ Recebimentos (Crediário)',  valor: det.recebimentos_dinheiro },
                  { label: '+ Suprimentos',               valor: det.suprimentos },
                  { label: '− Sangrias',                  valor: det.sangrias,      negativo: true },
                  { label: '− Saídas (contas pagas)',     valor: det.saidas_dinheiro, negativo: true },
                ].map(({ label, valor, negativo }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: negativo ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {BRL(negativo ? -Number(valor ?? 0) : Number(valor ?? 0))}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                  <span>Esperado</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>{BRL(Number(det.valor_esperado ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                  <span>Contado</span>
                  <span style={{ fontFamily: 'var(--font-display)' }}>{BRL(Number(det.valor_contado ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                  <span>Diferença</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: corD }}>
                    {dif === 0 ? '✓ Exato' : `${dif > 0 ? 'Sobra ' : 'Falta '} ${BRL(Math.abs(dif))}`}
                  </span>
                </div>
              </div>

              {caixa.observacoes && (
                <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Observações</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{caixa.observacoes}</p>
                </div>
              )}

              {Array.isArray(caixa.historico_reabertura) && caixa.historico_reabertura.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Reabertas anteriores</div>
                  {caixa.historico_reabertura.map((r: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {r.reaberto_em ? fmtHora(r.reaberto_em) : ''} · {r.reaberto_por} — {r.motivo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

      </div>
    </AppLayout>
  )
}
