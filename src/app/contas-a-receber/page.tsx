// src/app/contas-a-receber/page.tsx
'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { imprimirRecibo } from '@/lib/impressora'

const BRL   = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDt = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const FORMAS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Transferência', 'Cheque']
const dataHj = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

// ─── MODAL RECEBIMENTO ────────────────────────────────────
function ModalReceber({ conta, onClose, onSalvo }: { conta: any; onClose: () => void; onSalvo: () => void }) {
  const saldoAtual = conta.parcialmente_pago
    ? Number(conta.saldo_devedor_original || conta.saldo_devedor || conta.valor)
    : Number(conta.valor || 0)
  const jaPago    = Number(conta.valor_pago || 0)
  const isParcial = conta.parcialmente_pago

  const [tipo, setTipo]         = useState<'total' | 'parcial'>('total')
  const [valor, setValor]       = useState(saldoAtual)
  const [juros, setJuros]       = useState(0)
  const [desconto, setDesconto] = useState(0)
  const [forma, setForma]       = useState('Dinheiro')
  const [data, setData]         = useState(dataHj())
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<{ quitado: boolean; valorRecebido: number; saldoRestante: number } | null>(null)

  const hoje         = dataHj()
  const vencida      = conta.data_vencimento < hoje
  const dias         = vencida ? Math.floor((Date.now() - new Date(conta.data_vencimento + 'T12:00:00').getTime()) / 86400000) : 0
  const valorBase    = tipo === 'total' ? saldoAtual : valor
  const valorFinal   = Math.max(0, valorBase - desconto + juros)
  const ficaRestante = tipo === 'total' ? 0 : Math.max(0, saldoAtual - valorBase)
  const quitaTotal   = tipo === 'total' || ficaRestante < 0.01

  function handleTipo(t: 'total' | 'parcial') {
    setTipo(t)
    if (t === 'total') setValor(saldoAtual)
  }

  async function salvar() {
    setSalvando(true)
    const res  = await fetch('/api/financeiro/receber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cod_conta: conta.id, valor_recebido: valorFinal, forma_pgto: forma, juros, desconto, data_pgto: data, tipo }),
    })
    const json = await res.json()
    setSalvando(false)
    setResultado({ quitado: json.quitado, valorRecebido: valorFinal, saldoRestante: json.saldo_restante || 0 })
  }

  function imprimirComp(vias: 1 | 2) {
    if (!resultado) return
    imprimirRecibo({
      empresa: 'Jeito de Ser Ltda.',
      nomeCliente: conta.clientes?.nome || 'Cliente',
      codVenda: `Crediário #${conta.id}`,
      data: new Date().toLocaleDateString('pt-BR'),
      itens: [{ produto: `Parcela ${conta.parcela || '—'} — Crediário`, quantidade: 1, preco: resultado.valorRecebido, subtotal: resultado.valorRecebido }],
      pagamentos: [{ forma, valor: resultado.valorRecebido }],
      valorTotal: resultado.valorRecebido,
      observacao: resultado.quitado ? 'Conta quitada integralmente' : `Baixa parcial — Saldo: ${BRL(resultado.saldoRestante)}`,
    }, undefined, vias)
    onSalvo()
  }

  const ov  = { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }
  const box = { background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '28px 32px', width: 440, boxShadow: 'var(--shadow-dropdown)' }

  if (resultado) {
    return (
      <div style={ov}>
        <div style={{ ...box, textAlign: 'center' }}>
          <div style={{ fontSize: 46, marginBottom: 8 }}>{resultado.quitado ? '✅' : '◉'}</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 4 }}>
            {resultado.quitado ? 'Conta Quitada!' : 'Baixa Parcial Registrada!'}
          </h3>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#C9A84C', marginBottom: 4 }}>
            {BRL(resultado.valorRecebido)}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: resultado.quitado ? 20 : 8 }}>
            {conta.clientes?.nome} · {forma}
          </p>
          {!resultado.quitado && (
            <div style={{ background: 'rgba(232,148,58,0.08)', border: '1px solid rgba(232,148,58,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 20, fontSize: 12, color: '#E8943A' }}>
              Saldo restante: <strong>{BRL(resultado.saldoRestante)}</strong>
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Imprimir comprovante?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {([1, 2] as const).map(n => (
              <button key={n} className="btn btn-ghost" style={{ justifyContent: 'center', flexDirection: 'column', gap: 2, padding: '12px' }} onClick={() => imprimirComp(n)}>
                <span>🖨 {n} {n === 1 ? 'via' : 'vias'}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{n === 1 ? 'só cliente' : 'cliente + loja'}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={onSalvo}>Fechar sem imprimir</button>
        </div>
      </div>
    )
  }

  return (
    <div style={ov}>
      <div style={box}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 6 }}>
          Registrar Recebimento
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          {conta.clientes?.nome || 'Cliente'} · Parcela {conta.parcela || '—'} · Vence {fmtDt(conta.data_vencimento)}
        </p>

        {/* Resumo parciais anteriores */}
        {isParcial && jaPago > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Total original', val: conta.valor,   color: 'var(--text-muted)' },
              { label: 'Já recebido',   val: jaPago,         color: '#4CAF82' },
              { label: 'Saldo devedor', val: saldoAtual,     color: '#C9A84C' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color }}>{BRL(val)}</div>
              </div>
            ))}
          </div>
        )}

        {vencida && (
          <div style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#E5584A' }}>
            ⚠ Conta vencida há {dias} dia{dias !== 1 ? 's' : ''}. Adicione juros se houver.
          </div>
        )}

        {/* Toggle Total / Parcial */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {(['total', 'parcial'] as const).map(t => (
            <button key={t} type="button" onClick={() => handleTipo(t)} style={{
              padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${tipo === t ? 'rgba(201,168,76,0.45)' : 'var(--border)'}`,
              background: tipo === t ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
              color: tipo === t ? '#C9A84C' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              whiteSpace: 'pre-line',
            }}>
              {t === 'total' ? `◉ Pagamento total\n${BRL(saldoAtual)}` : '◎ Pagamento parcial'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tipo === 'parcial' && (
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                Valor recebido agora (R$)
              </label>
              <input type="number" className="input" value={valor} step={0.01} min={0.01} max={saldoAtual}
                onChange={e => setValor(parseFloat(e.target.value) || 0)} autoFocus />
              {ficaRestante > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Saldo após esse pagamento: <span style={{ color: '#E8943A', fontWeight: 700 }}>{BRL(ficaRestante)}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Desconto (R$)</label>
              <input type="number" className="input" value={desconto} step={0.01} min={0} onChange={e => setDesconto(parseFloat(e.target.value) || 0)} placeholder="0,00" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Juros (R$)</label>
              <input type="number" className="input" value={juros} step={0.01} min={0} onChange={e => setJuros(parseFloat(e.target.value) || 0)} placeholder="0,00" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Forma de pagamento</label>
            <select className="input" value={forma} onChange={e => setForma(e.target.value)}>
              {FORMAS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Data do recebimento</label>
            <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
          </div>

          {/* Preview em tempo real */}
          <div style={{ padding: '12px 14px', background: quitaTotal ? 'rgba(76,175,130,0.06)' : 'rgba(201,168,76,0.06)', border: `1px solid ${quitaTotal ? 'rgba(76,175,130,0.2)' : 'rgba(201,168,76,0.15)'}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total a receber:</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>{BRL(valorFinal)}</span>
            </div>
            {(desconto > 0 || juros > 0) && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {desconto > 0 && <span style={{ color: '#4CAF82' }}>-{BRL(desconto)} desconto </span>}
                {juros > 0   && <span style={{ color: '#E8943A' }}>+{BRL(juros)} juros</span>}
              </div>
            )}
            {quitaTotal
              ? <div style={{ fontSize: 12, color: '#4CAF82', fontWeight: 600 }}>✓ Conta será quitada integralmente</div>
              : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Saldo em aberto:</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#E8943A' }}>{BRL(ficaRestante)}</span>
                </div>
              )
            }
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-success" style={{ flex: 2, justifyContent: 'center', padding: '11px' }}
            onClick={salvar} disabled={salvando || valorFinal <= 0}>
            {salvando ? 'Registrando...' : quitaTotal ? '✓ Quitar Conta' : '✓ Baixa Parcial'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── STATUS BADGE ──────────────────────────────────────────
function StatusBadge({ status }: { status: 'vencido' | 'parcial' | 'aberto' }) {
  const cfg = {
    vencido: { bg: 'rgba(229,88,74,0.12)',  border: 'rgba(229,88,74,0.3)',  color: '#E5584A', label: 'VENCIDO' },
    parcial: { bg: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.3)', color: '#C9A84C', label: 'PARCIAL' },
    aberto:  { bg: 'rgba(76,175,130,0.10)', border: 'rgba(76,175,130,0.25)',color: '#4CAF82', label: 'EM ABERTO' },
  }[status]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' as const }}>
      {cfg.label}
    </span>
  )
}

// ─── SUMMARY CARD ─────────────────────────────────────────
function SummaryCard({ label, valor, count, alert }: { label: string; valor: number; count: number; alert?: boolean }) {
  return (
    <div className="card" style={{ borderColor: alert ? 'rgba(229,88,74,0.2)' : undefined }}>
      <div style={{ fontSize: 10, color: alert ? '#E5584A' : 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: alert ? '#E5584A' : '#F2EBD9' }}>{BRL(valor)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{count} parcela{count !== 1 ? 's' : ''}</div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────
const FILTROS = [
  { id: 'todos_abertos',  label: 'Todos em aberto' },
  { id: 'vencido',        label: 'Vencidos' },
  { id: 'parcial',        label: 'Parciais' },
  { id: 'vence_hoje',     label: 'Vence hoje' },
  { id: 'proximos_7_dias', label: 'Próximos 7 dias' },
]

const GRID = '110px 1fr 70px 120px 110px 120px 90px 44px'
const HDRS = ['Vencimento', 'Cliente', 'Parcela', 'Valor Original', 'Já Pago', 'Saldo Devedor', 'Status', '']

export default function ContasReceberPage() {
  const router = useRouter()
  const [filtro, setFiltro]   = useState('todos_abertos')
  const [contas, setContas]   = useState<any[]>([])
  const [total, setTotal]     = useState(0)
  const [resumo, setResumo]   = useState<any>({})
  const [q, setQ]             = useState('')
  const [busca, setBusca]     = useState('')
  const [pagina, setPagina]   = useState(1)
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<any>(null)
  const [toast, setToast]     = useState('')
  const hoje = dataHj()
  const limite = 50

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const carregar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ aba: 'receber', filtro, q: busca, pagina: String(pagina), limite: String(limite) })
    const [res, res2] = await Promise.all([
      fetch(`/api/financeiro?${params}`),
      fetch('/api/financeiro?aba=resumo_receber'),
    ])
    const d  = await res.json()
    const r  = await res2.json()
    setContas(d.contas || [])
    setTotal(d.total || 0)
    setResumo(r)
    setLoading(false)
  }, [filtro, busca, pagina])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPagina(1) }, [filtro])

  const totalPags = Math.ceil(total / limite)

  function getSaldo(c: any) {
    return c.parcialmente_pago
      ? Number(c.saldo_devedor_original || c.saldo_devedor || c.valor)
      : Number(c.valor || 0)
  }

  function getStatus(c: any): 'vencido' | 'parcial' | 'aberto' {
    if (c.parcialmente_pago) return 'parcial'
    if (c.data_vencimento < hoje) return 'vencido'
    return 'aberto'
  }

  function onBaixaFeita(conta: any, quitado: boolean, saldo: number) {
    setModal(null)
    if (quitado) {
      showToast('✓ Recebimento registrado')
    } else {
      showToast(`Pagamento parcial registrado. Saldo: ${BRL(saldo)}`)
    }
    carregar()
  }

  return (
    <AppLayout>
      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: 'rgba(76,175,130,0.12)', border: '1px solid rgba(76,175,130,0.3)', borderRadius: 10, padding: '12px 18px', color: '#4CAF82', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(8px)', animation: 'silkFade 0.3s ease forwards' }}>
          {toast}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <ModalReceber
          conta={modal}
          onClose={() => setModal(null)}
          onSalvo={() => { carregar(); setModal(null); showToast(modal._saldoAtual ? `Pagamento parcial registrado. Saldo: ${BRL(modal._saldoAtual)}` : '✓ Recebimento registrado') }}
        />
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#F2EBD9', letterSpacing: '-0.01em' }}>
            Contas a Receber
          </h1>
          <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
            Parcelas do crediário em aberto · ordenadas por vencimento
          </p>
        </div>

        {/* 4 CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 12 }}>
          <SummaryCard label="Em Aberto"     valor={resumo.aberto?.valor   || 0} count={resumo.aberto?.count   || 0} />
          <SummaryCard label="Vencido"       valor={resumo.vencido?.valor  || 0} count={resumo.vencido?.count  || 0} alert={(resumo.vencido?.count || 0) > 0} />
          <SummaryCard label="Vence Hoje"    valor={resumo.vence_hoje?.valor || 0} count={resumo.vence_hoje?.count || 0} />
          <SummaryCard label="Próx. 7 Dias"  valor={resumo.proximos_7?.valor || 0} count={resumo.proximos_7?.count || 0} />
        </div>

        {/* FILTROS + BUSCA */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.id} onClick={() => setFiltro(f.id)} style={{
                padding: '7px 14px', borderRadius: 8,
                border: `1px solid ${filtro === f.id ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                background: filtro === f.id ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)',
                color: filtro === f.id ? '#C9A84C' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{f.label}</button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>⊙</span>
            <input className="input" style={{ paddingLeft: 34 }}
              placeholder="Buscar por nome do cliente..."
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>

        {/* TABELA */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
            {HDRS.map(h => (
              <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : contas.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◎</div>
              Nenhuma parcela encontrada para este filtro
            </div>
          ) : contas.map((c: any, i: number) => {
            const status    = getStatus(c)
            const saldo     = getSaldo(c)
            const jaPago    = Number(c.valor_pago || 0)
            const atrasado  = status === 'vencido'
            const dias      = atrasado ? Math.floor((Date.now() - new Date(c.data_vencimento + 'T12:00:00').getTime()) / 86400000) : 0
            return (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: GRID,
                padding: '13px 20px', alignItems: 'center',
                borderBottom: i < contas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                background: atrasado ? 'rgba(229,88,74,0.015)' : status === 'parcial' ? 'rgba(201,168,76,0.015)' : 'transparent',
              }}>
                {/* Vencimento */}
                <div>
                  <div style={{ fontSize: 13, color: atrasado ? '#E5584A' : '#F2EBD9', fontWeight: atrasado ? 600 : 400 }}>{fmtDt(c.data_vencimento)}</div>
                  {atrasado && <div style={{ fontSize: 10, color: '#E5584A' }}>{dias}d atraso</div>}
                </div>

                {/* Cliente */}
                <div>
                  <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 500, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={() => router.push(`/clientes/${c.cod_cliente}`)}>
                    {c.clientes?.nome || '—'}
                  </div>
                  {c.clientes?.celular && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.clientes.celular}</div>}
                </div>

                {/* Parcela */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.parcela || '—'}</div>

                {/* Valor Original */}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{BRL(Number(c.valor || 0))}</div>

                {/* Já Pago */}
                <div style={{ fontSize: 12, color: jaPago > 0 ? '#4CAF82' : 'var(--text-muted)', textAlign: 'right', fontWeight: jaPago > 0 ? 600 : 400 }}>
                  {jaPago > 0 ? BRL(jaPago) : '—'}
                </div>

                {/* Saldo Devedor */}
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: atrasado ? '#E5584A' : '#C9A84C', textAlign: 'right' }}>
                  {BRL(saldo)}
                </div>

                {/* Status */}
                <div><StatusBadge status={status} /></div>

                {/* Ação */}
                <div>
                  <button className="btn btn-success" style={{ padding: '5px 10px', fontSize: 11, minWidth: 36 }}
                    onClick={() => setModal(c)}>
                    ✓
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Contador e Paginação */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {total} parcela{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
          </span>
          {totalPags > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>‹ Anterior</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pagina} de {totalPags}</span>
              <button className="btn btn-ghost" disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>Próxima ›</button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
