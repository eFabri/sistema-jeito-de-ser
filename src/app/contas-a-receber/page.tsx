// src/app/contas-a-receber/page.tsx
'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { imprimirRecibo } from '@/lib/impressora'
import { Check, AlertTriangle, Circle, CheckCircle2, Printer, Search } from 'lucide-react'

const BRL   = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDt = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const FORMAS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Transferência', 'Cheque']
const dataHj = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

// ─── MODAL RECEBIMENTO ────────────────────────────────────
function ModalReceber({ conta, onClose, onSalvo, isAdmin = true }: { conta: any; onClose: () => void; onSalvo: () => void; isAdmin?: boolean }) {
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
  const [saldoCredito, setSaldoCredito] = useState(0)
  const [creditoAplicado, setCreditoAplicado] = useState(0)

  useEffect(() => {
    if (conta.cod_cliente) {
      fetch(`/api/clientes/${conta.cod_cliente}/credito`)
        .then(r => r.json())
        .then(d => setSaldoCredito(d.saldo_atual || 0))
        .catch(() => {})
    }
  }, [conta.cod_cliente])

  const hoje         = dataHj()
  const vencida      = conta.data_vencimento < hoje
  const dias         = vencida ? Math.floor((Date.now() - new Date(conta.data_vencimento + 'T12:00:00').getTime()) / 86400000) : 0
  const valorBase    = tipo === 'total' ? saldoAtual : valor
  const valorFinal   = Math.max(0, valorBase - desconto + juros)
  const ficaRestante = tipo === 'total' ? 0 : Math.max(0, saldoAtual - valorBase)
  const quitaTotal   = tipo === 'total' || ficaRestante < 0.01
  const jurosAuto    = dias > 10 ? Math.round(saldoAtual * 0.0016 * dias * 100) / 100 : 0

  // Preencher juros automático ao abrir
  useEffect(() => {
    if (jurosAuto > 0) setJuros(jurosAuto)
  }, [])

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
    if (creditoAplicado > 0 && conta.cod_cliente) {
      await fetch(`/api/clientes/${conta.cod_cliente}/credito`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'uso', valor: creditoAplicado, descricao: `Usado no crediário parcela ${conta.parcela || conta.id}` }),
      }).catch(() => {})
    }
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

  const ov  = { position: 'fixed' as const, inset: 0, background: 'rgba(30,27,75,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }
  const box = { background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 20, padding: '28px 32px', width: 440, boxShadow: 'var(--shadow-clay)' }

  if (resultado) {
    return (
      <div style={ov}>
        <div style={{ ...box, textAlign: 'center' }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{resultado.quitado ? <CheckCircle2 size={46} color="#4CAF82" strokeWidth={1.5} className="clay-breathe" /> : <Circle size={46} color="#C9A84C" strokeWidth={1.5} />}</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', marginBottom: 4 }}>
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Printer size={13} strokeWidth={1.8} /> {n} {n === 1 ? 'via' : 'vias'}</span>
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
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', marginBottom: 6 }}>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} strokeWidth={2} style={{ flexShrink: 0 }} /> Conta vencida há {dias} dia{dias !== 1 ? 's' : ''}. Adicione juros se houver.</span>
          </div>
        )}

        {saldoCredito > 0 && (
          <div style={{ background: 'rgba(76,175,130,0.08)', border: '1px solid rgba(76,175,130,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#4CAF82' }}>Crédito disponível: <strong>{BRL(saldoCredito)}</strong></span>
            <button type="button" onClick={() => { const v = Math.min(saldoCredito, saldoAtual); setCreditoAplicado(v); setDesconto(v) }}
              style={{ background: 'rgba(76,175,130,0.15)', border: '1px solid rgba(76,175,130,0.3)', borderRadius: 7, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#4CAF82', cursor: 'pointer' }}>
              Usar crédito
            </button>
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
              {t === 'total' ? `● Pagamento total\n${BRL(saldoAtual)}` : '○ Pagamento parcial'}
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

          {jurosAuto > 0 && (
            <div style={{ background: 'rgba(232,148,58,0.08)', border: '1px solid rgba(232,148,58,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#C97B1A' }}>
              ⚠ Juros calculados: 0,16% ao dia × {dias} dias = <strong>R$ {jurosAuto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              {!isAdmin && <span style={{ display: 'block', marginTop: 2, fontWeight: 700 }}>Somente administrador pode alterar o valor de juros.</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Desconto (R$)</label>
              <input type="number" className="input" value={desconto} step={0.01} min={0} onChange={e => setDesconto(parseFloat(e.target.value) || 0)} placeholder="0,00" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                Juros (R$){!isAdmin && dias > 10 ? ' 🔒' : ''}
              </label>
              <input type="number" className="input" value={juros} step={0.01} min={0}
                onChange={e => setJuros(parseFloat(e.target.value) || 0)} placeholder="0,00"
                readOnly={!isAdmin && dias > 10}
                style={!isAdmin && dias > 10 ? { opacity: 0.6, cursor: 'not-allowed' } : undefined} />
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
              ? <div style={{ fontSize: 12, color: '#4CAF82', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} strokeWidth={2.5} /> Conta será quitada integralmente</div>
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
            onClick={salvar} disabled={salvando || valorFinal <= 0 || (!isAdmin && dias > 10 && juros === 0)}>
            {salvando ? 'Registrando...' : <><Check size={13} strokeWidth={2.5} /> {quitaTotal ? 'Quitar Conta' : 'Baixa Parcial'}</>}
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
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: alert ? '#E5584A' : '#332F3A' }}>{BRL(valor)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{count} parcela{count !== 1 ? 's' : ''}</div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────
const ABAS = [
  { id: 'aberto',        label: 'Em aberto' },
  { id: 'vencido',       label: 'Vencidas' },
  { id: 'pago',          label: 'Pagas' },
  { id: 'inadimplente',  label: 'Inadimplentes' },
]

const SUB_FILTROS = [
  { id: 'todos_abertos',   label: 'Todos' },
  { id: 'parcial',         label: 'Parciais' },
  { id: 'vence_hoje',      label: 'Vence hoje' },
  { id: 'proximos_7_dias', label: 'Próximos 7 dias' },
]

const SUB_FILTROS_VENCIDO = [
  { id: 'vencido',           label: 'Todas vencidas' },
  { id: 'vencido_mes_atual', label: 'Vencidas + Mês atual' },
  { id: 'mes_atual',         label: 'Mês atual' },
]

const GRID = '110px 1fr 70px 120px 110px 120px 90px 170px'
const HDRS = ['Vencimento', 'Cliente', 'Parcela', 'Valor Original', 'Já Pago', 'Saldo Devedor', 'Status', 'Ações']

export default function ContasReceberPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(true)
  const [aba, setAba]         = useState('aberto')
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

  // Crediário avulso
  const [modalCrediario, setModalCrediario]           = useState(false)
  const [clienteCrediario, setClienteCrediario]       = useState<any>(null)
  const [buscaCliCrediario, setBuscaCliCrediario]     = useState('')
  const [sugestoesCrCli, setSugestoesCrCli]           = useState<any[]>([])
  const [crAvulso, setCrAvulso]                       = useState({ referencia: '', dataOriginal: dataHj(), parcela: '1/1', dataVencimento: dataHj(), valor: '' })
  const [salvandoCrediario, setSalvandoCrediario]     = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  useEffect(() => {
    fetch('/api/perfil').then(r => r.json()).then(d => setIsAdmin(d.perfil === 'admin'))
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ aba: 'receber', filtro, q: busca, pagina: String(pagina), limite: String(limite) })
    const [res, res2] = await Promise.all([
      fetch(`/api/financeiro?${params}`, { cache: 'no-store' }),
      fetch('/api/financeiro?aba=resumo_receber', { cache: 'no-store' }),
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

  // Busca cliente para crediário avulso
  useEffect(() => {
    if (buscaCliCrediario.length < 2) { setSugestoesCrCli([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(buscaCliCrediario)}&limite=6`)
      const data = await res.json()
      setSugestoesCrCli(data.clientes || [])
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliCrediario])

  function trocarAba(novaAba: string) {
    setAba(novaAba)
    setPagina(1)
    setQ('')
    if (novaAba === 'aberto')       setFiltro('todos_abertos')
    if (novaAba === 'vencido')      setFiltro('vencido')
    if (novaAba === 'pago')         setFiltro('pago')
    if (novaAba === 'inadimplente') setFiltro('inadimplente')
  }

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
      showToast('Recebimento registrado')
    } else {
      showToast(`Pagamento parcial registrado. Saldo: ${BRL(saldo)}`)
    }
    carregar()
  }

  async function enviarInadimplencia(id: number) {
    await fetch('/api/contas-a-receber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, inadimplente: true }),
    })
    showToast('Parcela enviada para inadimplência.')
    setContas(prev => prev.filter((c: any) => c.id !== id))
    setTotal(prev => prev - 1)
  }

  async function reativar(id: number) {
    await fetch('/api/contas-a-receber', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, inadimplente: false }),
    })
    showToast('Parcela reativada.')
    carregar()
  }

  async function salvarCrediarioAvulso() {
    if (!clienteCrediario) { showToast('Selecione um cliente.'); return }
    const valorNum = parseFloat(crAvulso.valor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) { showToast('Informe um valor válido.'); return }
    setSalvandoCrediario(true)
    const res = await fetch('/api/contas-a-receber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cod_cliente:     clienteCrediario.id,
        parcela:         crAvulso.parcela || '1/1',
        data_lancamento: crAvulso.dataOriginal,
        data_vencimento: crAvulso.dataVencimento,
        valor:           valorNum,
        historico:       crAvulso.referencia || null,
      }),
    })
    setSalvandoCrediario(false)
    if (res.ok) {
      setModalCrediario(false)
      setClienteCrediario(null)
      setBuscaCliCrediario('')
      setCrAvulso({ referencia: '', dataOriginal: dataHj(), parcela: '1/1', dataVencimento: dataHj(), valor: '' })
      showToast('Parcela inserida com sucesso!')
      carregar()
    } else {
      const e = await res.json()
      showToast('Erro: ' + (e.erro || 'falha ao inserir'))
    }
  }

  return (
    <AppLayout>
      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: 'rgba(76,175,130,0.12)', border: '1px solid rgba(76,175,130,0.3)', borderRadius: 10, padding: '12px 18px', color: '#4CAF82', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(8px)', animation: 'silkFade 0.3s ease forwards' }}>
          {toast}
        </div>
      )}

      {/* MODAL RECEBER */}
      {modal && (
        <ModalReceber
          conta={modal}
          isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSalvo={() => { carregar(); setModal(null); showToast(modal._saldoAtual ? `Pagamento parcial registrado. Saldo: ${BRL(modal._saldoAtual)}` : 'Recebimento registrado') }}
        />
      )}

      {/* MODAL CREDIÁRIO AVULSO */}
      {modalCrediario && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalCrediario(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 28 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#332F3A', marginBottom: 20 }}>
              + Crediário Avulso
            </h3>

            {/* Cliente autocomplete */}
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Cliente *</label>
              {clienteCrediario ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: '#332F3A', flex: 1 }}>{clienteCrediario.nome}</span>
                  <button onClick={() => { setClienteCrediario(null); setBuscaCliCrediario('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input className="input" placeholder="Buscar cliente..." value={buscaCliCrediario}
                    onChange={e => setBuscaCliCrediario(e.target.value)} autoFocus />
                  {sugestoesCrCli.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 4 }}>
                      {sugestoesCrCli.map((c: any) => (
                        <div key={c.id} onClick={() => { setClienteCrediario(c); setBuscaCliCrediario(''); setSugestoesCrCli([]) }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.05)', fontSize: 13, color: '#332F3A' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {c.nome} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.celular || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Referência</label>
                <input className="input" placeholder="ex: Compra de roupas..." value={crAvulso.referencia}
                  onChange={e => setCrAvulso(p => ({ ...p, referencia: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Parcela</label>
                <input className="input" placeholder="ex: 1/3" value={crAvulso.parcela}
                  onChange={e => setCrAvulso(p => ({ ...p, parcela: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Data Original</label>
                <input className="input" type="date" value={crAvulso.dataOriginal}
                  onChange={e => setCrAvulso(p => ({ ...p, dataOriginal: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Data Vencimento</label>
                <input className="input" type="date" value={crAvulso.dataVencimento}
                  onChange={e => setCrAvulso(p => ({ ...p, dataVencimento: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / span 2' }}>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Valor (R$) *</label>
                <input className="input" type="number" step={0.01} min={0.01} placeholder="0,00" value={crAvulso.valor}
                  onChange={e => setCrAvulso(p => ({ ...p, valor: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalCrediario(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}
                onClick={salvarCrediarioAvulso} disabled={salvandoCrediario}>
                {salvandoCrediario ? 'Inserindo...' : 'Inserir Parcela'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
              Contas a Receber
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              Parcelas do crediário · ordenadas por vencimento
            </p>
          </div>
          <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setModalCrediario(true)}>
            + Crediário Avulso
          </button>
        </div>

        {/* 4 CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 12 }}>
          <SummaryCard label="Em Aberto"     valor={resumo.aberto?.valor   || 0} count={resumo.aberto?.count   || 0} />
          <SummaryCard label="Vencido"       valor={resumo.vencido?.valor  || 0} count={resumo.vencido?.count  || 0} alert={(resumo.vencido?.count || 0) > 0} />
          <SummaryCard label="Vence Hoje"    valor={resumo.vence_hoje?.valor || 0} count={resumo.vence_hoje?.count || 0} />
          <SummaryCard label="Próx. 7 Dias"  valor={resumo.proximos_7?.valor || 0} count={resumo.proximos_7?.count || 0} />
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => trocarAba(a.id)} style={{
              padding: '9px 20px',
              background: aba === a.id ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)',
              color: aba === a.id ? '#C9A84C' : 'var(--text-muted)',
              border: 'none', borderRight: '1px solid var(--border)',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{a.label}</button>
          ))}
        </div>

        {/* Sub-filtros + Busca */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {aba === 'aberto' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {SUB_FILTROS.map(f => (
                <button key={f.id} onClick={() => { setFiltro(f.id); setPagina(1) }} style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${filtro === f.id ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                  background: filtro === f.id ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.02)',
                  color: filtro === f.id ? '#C9A84C' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>{f.label}</button>
              ))}
            </div>
          )}
          {aba === 'vencido' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {SUB_FILTROS_VENCIDO.map(f => (
                <button key={f.id} onClick={() => { setFiltro(f.id); setPagina(1) }} style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${filtro === f.id ? 'rgba(229,88,74,0.3)' : 'var(--border)'}`,
                  background: filtro === f.id ? 'rgba(229,88,74,0.1)' : 'rgba(255,255,255,0.02)',
                  color: filtro === f.id ? '#E5584A' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>{f.label}</button>
              ))}
            </div>
          )}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}><Search size={13} strokeWidth={1.8} /></span>
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
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.3 }}><Circle size={32} strokeWidth={1} /></div>
              Nenhuma parcela encontrada para este filtro
            </div>
          ) : contas.map((c: any, i: number) => {
            const status    = getStatus(c)
            const saldo     = getSaldo(c)
            const jaPago    = Number(c.valor_pago || 0)
            const atrasado = !c.pago && (
              status === 'vencido' ||
              (status === 'parcial' && c.data_vencimento && c.data_vencimento < hoje) ||
              (c.status && ['vencido', 'atrasado', 'atrasada'].includes(c.status.toLowerCase()))
            )
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
                  <div style={{ fontSize: 13, color: atrasado ? '#E5584A' : '#332F3A', fontWeight: atrasado ? 600 : 400 }}>{fmtDt(c.data_vencimento)}</div>
                  {atrasado && <div style={{ fontSize: 10, color: '#E5584A' }}>{dias}d atraso</div>}
                </div>

                {/* Cliente */}
                <div>
                  <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
                <div>
                  {aba === 'inadimplente'
                    ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#E5584A', background: 'rgba(229,88,74,0.12)', border: '1px solid rgba(229,88,74,0.3)', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' as const }}>INADIMPLENTE</span>
                    : <StatusBadge status={status} />
                  }
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  {aba === 'inadimplente' ? (
                    <button style={{ padding: '5px 10px', fontSize: 10, background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.3)', borderRadius: 6, cursor: 'pointer', color: '#4CAF82', fontWeight: 700 }}
                      onClick={() => reativar(c.id)}>
                      Reativar
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-success" style={{ padding: '5px 10px', fontSize: 11, minWidth: 34 }}
                        onClick={() => setModal(c)}>
                        <Check size={11} strokeWidth={2.5} />
                      </button>
                      {atrasado && (
                        <button style={{ padding: '4px 7px', fontSize: 10, background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.3)', borderRadius: 6, cursor: 'pointer', color: '#E5584A', fontWeight: 700, whiteSpace: 'nowrap' as const }}
                          title="Enviar para Inadimplência"
                          onClick={() => { if (confirm(`Enviar parcela de ${c.clientes?.nome || 'cliente'} para inadimplência?`)) enviarInadimplencia(c.id) }}>
                          ⚠ Inad.
                        </button>
                      )}
                    </>
                  )}
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
