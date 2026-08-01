// src/app/financeiro/page.tsx
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { imprimirRecibo } from '@/lib/impressora'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const FORMAS  = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Transferência', 'Cheque']
import { hojeNoBrasil, mesAtualNoBrasil } from '@/lib/dates'
import { Check, AlertTriangle, Circle, CheckCircle2, Printer, Search } from 'lucide-react'
const dataBR  = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

// ─── MODAL RECEBIMENTO ────────────────────────────────────
function ModalReceber({ conta, onClose, onSalvo }: any) {
  const saldoAtual  = conta.parcialmente_pago ? (conta.saldo_devedor_original || conta.saldo_devedor || conta.valor) : conta.valor
  const jaRecebido  = conta.valor_pago > 0 ? conta.valor_pago : Math.max(0, conta.valor - saldoAtual)
  const isParcial   = conta.status === 'Pago Parcial'

  const [tipoPgto, setTipoPgto] = useState<'total' | 'parcial'>('total')
  const [valor, setValor]       = useState(saldoAtual)
  const [juros, setJuros]       = useState(0)
  const [desconto, setDesconto] = useState(0)
  const [forma, setForma]       = useState('Dinheiro')
  const [data, setData]         = useState(dataBR())
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const vencida      = new Date(conta.data_vencimento + 'T12:00:00') < new Date()
  const dias         = Math.floor((Date.now() - new Date(conta.data_vencimento + 'T12:00:00').getTime()) / 86400000)
  // valorFinal = o que o cliente paga de fato (base - desconto + juros)
  const valorBase    = tipoPgto === 'total' ? saldoAtual : valor
  const valorFinal   = Math.max(0, valorBase - desconto + juros)
  const ficaRestante = tipoPgto === 'total' ? 0 : Math.max(0, saldoAtual - valorBase)
  const quitaTotal   = tipoPgto === 'total' || ficaRestante < 0.01

  function handleTipo(t: 'total' | 'parcial') {
    setTipoPgto(t)
    if (t === 'total') setValor(saldoAtual)
  }

  async function salvar() {
    setSalvando(true)
    const res  = await fetch('/api/financeiro/receber', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cod_conta: conta.id, valor_recebido: valorFinal, forma_pgto: forma, juros, desconto, data_pgto: data, tipo: tipoPgto }),
    })
    const json = await res.json()
    setSalvando(false)
    setResultado({ quitado: json.quitado, valorRecebido: valorFinal, saldoRestante: json.saldo_restante || 0 })
  }

  function imprimirComprovante(vias: 1 | 2) {
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

  const overlay = { position: 'fixed' as const, inset: 0, background: 'rgba(44,36,32,0.40)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }
  const box     = { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 32px', width: 440, boxShadow: 'var(--shadow-modal)' }

  // ── Tela de sucesso com comprovante ──
  if (resultado) {
    return (
      <div style={overlay}>
        <div style={{ ...box, textAlign: 'center' }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{resultado.quitado ? <CheckCircle2 size={48} color="#4CAF82" strokeWidth={1.5} className="clay-breathe" /> : <Circle size={48} color="#C9A84C" strokeWidth={1.5} />}</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {resultado.quitado ? 'Conta Quitada!' : 'Baixa Parcial Registrada!'}
          </h3>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 4 }}>
            {BRL(resultado.valorRecebido)}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: resultado.quitado ? 20 : 8 }}>
            {conta.clientes?.nome} · {forma}
          </p>
          {!resultado.quitado && (
            <div style={{ background: 'rgba(232,148,58,0.08)', border: '1px solid rgba(232,148,58,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 20, fontSize: 12, color: 'var(--warning)' }}>
              Saldo restante: <strong>{BRL(resultado.saldoRestante)}</strong>
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Imprimir comprovante?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {([1, 2] as const).map(n => (
              <button key={n} className="btn btn-ghost" style={{ justifyContent: 'center', flexDirection: 'column', gap: 2, padding: '12px' }} onClick={() => imprimirComprovante(n)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Printer size={13} strokeWidth={1.8} /> {n} {n === 1 ? 'via' : 'vias'}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{n === 1 ? 'só cliente' : 'cliente + loja'}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={onSalvo}>
            Fechar sem imprimir
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay}>
      <div style={box}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Registrar Recebimento</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          {conta.clientes?.nome || 'Cliente'} · Parcela {conta.parcela || '—'} · Vence {fmtData(conta.data_vencimento)}
        </p>

        {/* Resumo de baixas parciais anteriores */}
        {isParcial && jaRecebido > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Total original', val: conta.valor, color: 'var(--text-muted)' },
              { label: 'Já recebido',   val: jaRecebido,  color: 'var(--success)' },
              { label: 'Saldo devedor', val: saldoAtual,  color: 'var(--accent-gold)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color }}>{BRL(val)}</div>
              </div>
            ))}
          </div>
        )}

        {vencida && (
          <div style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--danger)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} strokeWidth={2} style={{ flexShrink: 0 }} /> Conta vencida há {dias} dias. Adicione juros se houver.</span>
          </div>
        )}

        {/* Radio: Total / Parcial */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {(['total', 'parcial'] as const).map(t => (
            <button key={t} type="button" onClick={() => handleTipo(t)} style={{
              padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${tipoPgto === t ? 'rgba(201,168,76,0.45)' : 'var(--border)'}`,
              background: tipoPgto === t ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
              color: tipoPgto === t ? 'var(--accent-gold)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.4,
            }}>
              {t === 'total' ? `● Pagamento total\n${BRL(saldoAtual)}` : '○ Pagamento parcial'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tipoPgto === 'parcial' && (
            <div>
              <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                Valor recebido agora (R$)
              </label>
              <input type="number" className="input" value={valor} step={0.01} min={0.01} max={saldoAtual}
                onChange={e => setValor(parseFloat(e.target.value) || 0)} autoFocus />
            </div>
          )}

          {/* Desconto e Juros — sempre visíveis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                Desconto (R$)
              </label>
              <input type="number" className="input" value={desconto} step={0.01} min={0}
                onChange={e => setDesconto(parseFloat(e.target.value) || 0)} placeholder="0,00" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                Juros (R$)
              </label>
              <input type="number" className="input" value={juros} step={0.01} min={0}
                onChange={e => setJuros(parseFloat(e.target.value) || 0)} placeholder="0,00" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Forma de pagamento</label>
            <select className="input" value={forma} onChange={e => setForma(e.target.value)}>
              {FORMAS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Data do recebimento</label>
            <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
          </div>

          {/* Resumo em tempo real */}
          <div style={{ padding: '12px 14px', background: quitaTotal ? 'rgba(76,175,130,0.06)' : 'rgba(201,168,76,0.06)', border: `1px solid ${quitaTotal ? 'rgba(76,175,130,0.2)' : 'rgba(201,168,76,0.15)'}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Valor a receber:</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--accent-gold)' }}>{BRL(valorFinal)}</span>
            </div>
            {(desconto > 0 || juros > 0) && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {desconto > 0 && <span style={{ color: 'var(--success)' }}>-{BRL(desconto)} desconto </span>}
                {juros > 0 && <span style={{ color: 'var(--warning)' }}>+{BRL(juros)} juros</span>}
              </div>
            )}
            {!quitaTotal && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Saldo em aberto:</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--warning)' }}>{BRL(ficaRestante)}</span>
              </div>
            )}
            {quitaTotal && <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} strokeWidth={2.5} /> Conta será quitada integralmente</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-success" style={{ flex: 2, justifyContent: 'center', padding: '11px' }} onClick={salvar} disabled={salvando || valor <= 0}>
            {salvando ? 'Registrando...' : <><Check size={13} strokeWidth={2.5} /> {quitaTotal ? 'Quitar Conta' : 'Baixa Parcial'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL PAGAR ──────────────────────────────────────────
function ModalPagar({ conta, onClose, onSalvo }: any) {
  const [valor, setValor]    = useState(conta.valor || 0)
  const [juros, setJuros]    = useState(0)
  const [desconto, setDesc]  = useState(0)
  const [forma, setForma]    = useState('Dinheiro')
  const [data, setData]      = useState(dataBR())
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    await fetch('/api/financeiro/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cod_conta: conta.id, valor_pago: valor, forma_pgto: forma, juros, desconto, data_pgto: data }),
    })
    setSalvando(false)
    onSalvo()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.40)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 32px', width: 420, boxShadow: 'var(--shadow-modal)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Registrar Pagamento</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          {conta.descricao || conta.despesa} · Vence {fmtData(conta.data_vencimento)}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['Valor (R$)', valor, setValor], ['Juros (R$)', juros, setJuros], ['Desconto (R$)', desconto, setDesc]].map(([label, val, set]: any) => (
            <div key={label}>
              <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
              <input type="number" className="input" value={val} step={0.01} min={0} onChange={e => set(parseFloat(e.target.value) || 0)} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Forma de pagamento</label>
            <select className="input" value={forma} onChange={e => setForma(e.target.value)}>
              {FORMAS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Data do pagamento</label>
            <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total a pagar:</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>{BRL(valor + juros - desconto)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '11px' }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Registrando...' : <><Check size={13} strokeWidth={2.5} /> Confirmar Pagamento</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL RECEBIMENTO AVULSO ────────────────────────────
function ModalRecebimentoAvulso({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const [clienteId,   setClienteId]   = useState<number | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [queryCliente, setQueryCliente] = useState('')
  const [resultados,  setResultados]  = useState<any[]>([])
  const [dropOpen,    setDropOpen]    = useState(false)
  const [observacao,  setObservacao]  = useState('')
  const [valor,       setValor]       = useState('')
  const [desconto,    setDesconto]    = useState('0')
  const [forma,       setForma]       = useState('Dinheiro')
  const [data,        setData]        = useState(dataBR())
  const [salvando,    setSalvando]    = useState(false)
  const [erro,        setErro]        = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (queryCliente.length < 2) { setResultados([]); setDropOpen(false); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const d = await fetch(`/api/clientes?q=${encodeURIComponent(queryCliente)}&limite=8`).then(r => r.json())
      setResultados(d.clientes || [])
      setDropOpen(true)
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [queryCliente])

  function selecionarCliente(c: any) {
    setClienteId(c.id); setClienteNome(c.nome)
    setQueryCliente(c.nome); setResultados([]); setDropOpen(false)
  }

  async function salvar() {
    if (!clienteId)          return setErro('Selecione um cliente')
    if (!observacao.trim())  return setErro('Informe uma descrição')
    if (!valor || Number(valor) <= 0) return setErro('Informe um valor válido')
    setSalvando(true); setErro('')
    const res = await fetch('/api/financeiro/recebimento-avulso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cod_cliente: clienteId, nome_cliente: clienteNome, observacao, valor: Number(valor), desconto: Number(desconto), data_recebimento: data, forma_pagamento: forma }),
    })
    const json = await res.json()
    setSalvando(false)
    if (!res.ok) return setErro(json.erro || 'Erro ao salvar')
    onSalvo()
  }

  const overlay = { position: 'fixed' as const, inset: 0, background: 'rgba(44,36,32,0.40)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '20px', overflowY: 'auto' as const }
  const box     = { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: 'var(--shadow-modal)', flexShrink: 0 }
  const lbl     = { fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5, fontWeight: 700 }

  return createPortal(
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={box}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          Registrar Recebimento Avulso
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          Para parcelas fora do sistema (migração, acerto manual, etc.)
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Cliente autocomplete */}
          <div>
            <label style={lbl}>Cliente *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                value={queryCliente}
                placeholder="Digite o nome do cliente..."
                onChange={e => {
                  setQueryCliente(e.target.value)
                  if (!e.target.value) { setClienteId(null); setClienteNome('') }
                }}
                onFocus={() => resultados.length > 0 && setDropOpen(true)}
                onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                autoComplete="off"
              />
              {clienteId && (
                <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}><Check size={10} strokeWidth={2.5} /> ID #{clienteId} selecionado</div>
              )}
              {dropOpen && resultados.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 200, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(44,36,32,0.15)' }}>
                  {resultados.map((c: any) => (
                    <button key={c.id} type="button" onMouseDown={() => selecionarCliente(c)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                      <div style={{ fontWeight: 500 }}>{c.nome}</div>
                      {c.cidade && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.cidade}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label style={lbl}>Descrição / Observação *</label>
            <input className="input" value={observacao} placeholder="Ex: Parcela venda #9503 — paga em atraso"
              onChange={e => setObservacao(e.target.value)} />
          </div>

          {/* Valor + Desconto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Valor (R$) *</label>
              <input type="number" className="input" value={valor} step={0.01} min={0.01}
                placeholder="0,00" onChange={e => setValor(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Desconto (R$)</label>
              <input type="number" className="input" value={desconto} step={0.01} min={0}
                placeholder="0,00" onChange={e => setDesconto(e.target.value)} />
            </div>
          </div>

          {/* Forma + Data */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Forma de pagamento *</label>
              <select className="input" value={forma} onChange={e => setForma(e.target.value)}>
                {FORMAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Data do recebimento *</label>
              <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>

          {/* Resumo */}
          {valor && Number(valor) > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(76,175,130,0.06)', border: '1px solid rgba(76,175,130,0.15)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Valor líquido a receber:</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                {(Math.max(0, Number(valor) - Number(desconto || 0))).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          )}

          {erro && (
            <div style={{ padding: '10px 14px', background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 8, color: 'var(--danger)', fontSize: 13 }}>
              {erro}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-success" style={{ flex: 2, justifyContent: 'center', padding: '11px' }}
            onClick={salvar} disabled={salvando || !clienteId || !observacao.trim() || !valor}>
            {salvando ? 'Registrando...' : <><Check size={13} strokeWidth={2.5} /> Confirmar Recebimento</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── MODAL NOVA CONTA A PAGAR ─────────────────────────────
function ModalNovaContaPagar({ onClose, onSalvo }: any) {
  const [form, setForm] = useState({ despesa: '', descricao: '', data_vencimento: '', valor: '', parcela: '', plano_contas: '', documento: '' })
  const [salvando, setSalvando] = useState(false)
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function salvar() {
    setSalvando(true)
    await fetch('/api/financeiro/pagar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, valor: parseFloat(form.valor) || 0, data: hojeNoBrasil(), pago: false, status: 'Em aberto' }),
    })
    setSalvando(false)
    onSalvo()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.40)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 32px', width: 460, boxShadow: 'var(--shadow-modal)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Nova Conta a Pagar</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[['Despesa / Categoria', 'despesa', 'text'], ['Descrição', 'descricao', 'text'], ['Vencimento', 'data_vencimento', 'date'], ['Valor (R$)', 'valor', 'number'], ['Parcela', 'parcela', 'text'], ['Documento', 'documento', 'text'], ['Plano de Contas', 'plano_contas', 'text']].map(([label, key, type]) => (
            <div key={key} style={key === 'descricao' ? { gridColumn: '1 / span 2' } : {}}>
              <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
              <input type={type} className="input" value={(form as any)[key]} onChange={f(key)} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '11px' }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : <><Check size={13} strokeWidth={2.5} /> Salvar Conta</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FINANCEIRO PRINCIPAL ─────────────────────────────────
export default function FinanceiroPage() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const [aba, setAba]       = useState<'receber' | 'pagar' | 'fluxo'>(searchParams.get('aba') as any || 'receber')
  const [filtro, setFiltro] = useState(searchParams.get('filtro') || 'aberto')
  const [contas, setContas]  = useState<any[]>([])
  const [total, setTotal]    = useState(0)
  const [resumo, setResumo]  = useState<any>({})
  const [fluxo, setFluxo]    = useState<any>({ fluxo: [], totalCredito: 0, totalDebito: 0, saldo: 0 })
  const [q, setQ]            = useState('')
  const [busca, setBusca]    = useState('')
  const [pagina, setPagina]  = useState(1)
  const [loading, setLoading] = useState(true)
  const [mesFluxo, setMesFluxo] = useState(mesAtualNoBrasil())
  const [modalReceber,    setModalReceber]    = useState<any>(null)
  const [modalPagar,      setModalPagar]      = useState<any>(null)
  const [modalNovaPagar,  setModalNovaPagar]  = useState(false)
  const [modalAvulso,     setModalAvulso]     = useState(false)
  const [toast,           setToast]           = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }
  const limite = 30

  const carregar = useCallback(async () => {
    setLoading(true)
    if (aba === 'fluxo') {
      const res = await fetch(`/api/financeiro?aba=fluxo&mes=${mesFluxo}`, { cache: 'no-store' })
      setFluxo(await res.json())
    } else {
      const params = new URLSearchParams({ aba, filtro, q: busca, pagina: String(pagina), limite: String(limite) })
      const res = await fetch(`/api/financeiro?${params}`, { cache: 'no-store' })
      const d   = await res.json()
      setContas(d.contas || [])
      setTotal(d.total || 0)
    }
    // Resumo geral
    const r = await fetch('/api/financeiro', { cache: 'no-store' }).then(r => r.json())
    setResumo(r)
    setLoading(false)
  }, [aba, filtro, busca, pagina, mesFluxo])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPagina(1) }, [aba, filtro])

  const totalPags = Math.ceil(total / limite)

  const hoje = dataBR()

  // ─── TABS ────────────────────────────────────────────────
  const TABS = [
    { id: 'receber', label: 'Contas a Receber' },
    { id: 'pagar',   label: 'Contas a Pagar' },
    { id: 'fluxo',   label: 'Fluxo de Caixa' },
  ]

  const FILTROS_RECEBER = [
    { id: 'aberto',  label: 'Em Aberto' },
    { id: 'parcial', label: 'Parcial' },
    { id: 'vencido', label: 'Vencido' },
    { id: 'pago',    label: 'Pago' },
    { id: 'todos',   label: 'Todos' },
  ]

  return (
    <AppLayout>
      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000, background: 'var(--success)', color: '#fff', padding: '14px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 8px 32px rgba(44,36,32,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} /> {toast}
        </div>
      )}

      {/* MODAIS */}
      {modalReceber && (
        <ModalReceber conta={modalReceber} onClose={() => setModalReceber(null)} onSalvo={() => { setModalReceber(null); carregar() }} />
      )}
      {modalPagar && (
        <ModalPagar conta={modalPagar} onClose={() => setModalPagar(null)} onSalvo={() => { setModalPagar(null); carregar() }} />
      )}
      {modalNovaPagar && (
        <ModalNovaContaPagar onClose={() => setModalNovaPagar(false)} onSalvo={() => { setModalNovaPagar(false); carregar() }} />
      )}
      {modalAvulso && (
        <ModalRecebimentoAvulso onClose={() => setModalAvulso(false)} onSalvo={() => { setModalAvulso(false); carregar(); showToast('Recebimento registrado com sucesso!') }} />
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: 'var(--text-primary)' }}>Financeiro</h1>
            <p style={{ color: 'var(--accent-gold)', fontSize: 13, marginTop: 4 }}>Crediário, contas e fluxo de caixa</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setModalAvulso(true)}>
              + Recebimento Avulso
            </button>
            {aba === 'pagar' && (
              <button className="btn btn-primary" onClick={() => setModalNovaPagar(true)}>+ Nova Conta</button>
            )}
          </div>
        </div>

        {/* CARDS RESUMO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
          {[
            { label: 'A Receber',       value: resumo.a_receber,        alert: false },
            { label: 'Vencido (Receber)', value: resumo.vencido_receber, alert: true },
            { label: 'A Pagar',         value: resumo.a_pagar,          alert: false },
            { label: 'Vencido (Pagar)', value: resumo.vencido_pagar,    alert: resumo.vencido_pagar > 0 },
          ].map(card => (
            <div key={card.label} className="card" style={{ borderColor: card.alert && card.value > 0 ? 'rgba(229,88,74,0.25)' : undefined }}>
              <div style={{ fontSize: 10, color: card.alert && card.value > 0 ? 'var(--danger)' : 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: card.alert && card.value > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{BRL(card.value || 0)}</div>
            </div>
          ))}
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(44,36,32,0.06)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id as any)} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              background: aba === tab.id ? 'rgba(201,168,76,0.18)' : 'transparent',
              color: aba === tab.id ? 'var(--accent-gold)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ── ABA: CONTAS A RECEBER / PAGAR ─────────────── */}
        {(aba === 'receber' || aba === 'pagar') && (
          <>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {FILTROS_RECEBER.filter(f => aba === 'pagar' ? f.id !== 'todos' : true).map(f => (
                  <button key={f.id} onClick={() => setFiltro(f.id)} style={{
                    padding: '7px 14px', borderRadius: 8, border: `1px solid ${filtro === f.id ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                    background: filtro === f.id ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)',
                    color: filtro === f.id ? 'var(--accent-gold)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>{f.label}</button>
                ))}
              </div>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}><Search size={13} strokeWidth={1.8} /></span>
                <input className="input" style={{ paddingLeft: 34 }}
                  placeholder={aba === 'receber' ? 'Buscar por cliente...' : 'Buscar por descrição...'}
                  value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>

            {/* Tabela */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {aba === 'receber' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 120px 100px 44px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
                    {['Cliente', 'Parcela', 'Vencimento', 'Valor', 'Status', ''].map(h => (
                      <div key={h} style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                  </div>
                  {loading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
                  ) : contas.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', opacity: 0.3 }}><Circle size={28} strokeWidth={1} /></div>
                      Nenhuma conta encontrada
                    </div>
                  ) : contas.map((c: any, i: number) => {
                    const atrasado  = !c.pago && c.data_vencimento < hoje
                    const isParcial = c.status === 'Pago Parcial'
                    const diasAtraso = atrasado ? Math.floor((Date.now() - new Date(c.data_vencimento).getTime()) / 86400000) : 0
                    const saldoExibido = c.parcialmente_pago ? (c.saldo_devedor_original || c.saldo_devedor || c.valor) : c.valor
                    const statusColor = c.pago ? 'var(--success)' : isParcial ? 'var(--accent-gold)' : atrasado ? 'var(--danger)' : 'var(--warning)'
                    const statusLabel = c.pago ? 'PAGO' : isParcial ? 'PARCIAL' : atrasado ? 'VENCIDO' : 'EM ABERTO'
                    return (
                      <div key={c.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 100px 110px 130px 100px 44px',
                        padding: '13px 20px', alignItems: 'center',
                        borderBottom: i < contas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                        background: atrasado ? 'rgba(229,88,74,0.02)' : isParcial ? 'rgba(201,168,76,0.02)' : 'transparent',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer' }}
                            onClick={() => router.push(`/clientes/${c.cod_cliente}`)}>
                            {c.clientes?.nome?.split(' ').slice(0, 3).join(' ') || '—'}
                          </div>
                          {c.historico && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.historico}</div>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.parcela || '—'}</div>
                        <div style={{ fontSize: 13, color: atrasado ? 'var(--danger)' : 'var(--text-primary)', fontWeight: atrasado ? 600 : 400 }}>
                          {fmtData(c.data_vencimento)}
                          {atrasado && <div style={{ fontSize: 10, color: 'var(--danger)' }}>{diasAtraso}d atraso</div>}
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: atrasado ? 'var(--danger)' : 'var(--accent-gold)' }}>
                          {BRL(saldoExibido)}
                          {isParcial && (() => {
                            const vPago = c.valor_pago > 0 ? c.valor_pago : Math.max(0, c.valor - saldoExibido)
                            return (
                              <div>
                                <div style={{ fontSize: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 2 }}><Check size={9} strokeWidth={2.5} /> {BRL(vPago)} pago</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>de {BRL(c.valor)} total</div>
                              </div>
                            )
                          })()}
                          {c.juros > 0 && <div style={{ fontSize: 11, color: 'var(--warning)' }}>+{BRL(c.juros)} juros</div>}
                        </div>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: statusColor }}>
                            {statusLabel}
                          </span>
                        </div>
                        <div>
                          {!c.pago && (
                            <button className="btn btn-success" style={{ padding: '5px 10px', fontSize: 11 }}
                              onClick={() => setModalReceber(c)}>
                              <Check size={11} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : (
                /* CONTAS A PAGAR */
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 120px 100px 44px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
                    {['Descrição', 'Parcela', 'Vencimento', 'Valor', 'Status', ''].map(h => (
                      <div key={h} style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                  </div>
                  {loading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
                  ) : contas.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', opacity: 0.3 }}><Circle size={28} strokeWidth={1} /></div>Nenhuma conta encontrada
                    </div>
                  ) : contas.map((c: any, i: number) => {
                    const atrasado = !c.pago && c.data_vencimento < hoje
                    return (
                      <div key={c.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 100px 110px 120px 100px 44px',
                        padding: '13px 20px', alignItems: 'center',
                        borderBottom: i < contas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                        background: atrasado ? 'rgba(229,88,74,0.02)' : 'transparent',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{c.descricao || c.despesa || '—'}</div>
                          {c.plano_contas && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.plano_contas}</div>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.parcela || '—'}</div>
                        <div style={{ fontSize: 13, color: atrasado ? 'var(--danger)' : 'var(--text-primary)', fontWeight: atrasado ? 600 : 400 }}>
                          {fmtData(c.data_vencimento)}
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: atrasado ? 'var(--danger)' : 'var(--accent-gold)' }}>
                          {BRL(c.valor)}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.pago ? 'var(--success)' : atrasado ? 'var(--danger)' : 'var(--warning)' }}>
                          {c.pago ? 'PAGO' : atrasado ? 'VENCIDO' : 'EM ABERTO'}
                        </div>
                        <div>
                          {!c.pago && (
                            <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setModalPagar(c)}><Check size={11} strokeWidth={2.5} /></button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Paginação */}
            {totalPags > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>‹ Anterior</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pagina} de {totalPags} · {total} registros</span>
                <button className="btn btn-ghost" disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>Próxima ›</button>
              </div>
            )}
          </>
        )}

        {/* ── ABA: FLUXO DE CAIXA ───────────────────────── */}
        {aba === 'fluxo' && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="month" className="input" style={{ width: 160 }} value={mesFluxo}
                onChange={e => setMesFluxo(e.target.value)} />
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Entradas</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{BRL(fluxo.totalCredito)}</span>
                </div>
                <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--danger)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Saídas</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{BRL(fluxo.totalDebito)}</span>
                </div>
                <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center', borderColor: fluxo.saldo >= 0 ? 'rgba(76,175,130,0.2)' : 'rgba(229,88,74,0.25)' }}>
                  <span style={{ fontSize: 11, color: 'var(--accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Saldo</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: fluxo.saldo >= 0 ? 'var(--success)' : 'var(--danger)' }}>{BRL(fluxo.saldo)}</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 100px 100px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
                {['Data', 'Descrição', 'Forma', 'Entrada', 'Saída'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
              ) : fluxo.fluxo.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro neste mês</div>
              ) : fluxo.fluxo.map((f: any, i: number) => (
                <div key={f.id} style={{
                  display: 'grid', gridTemplateColumns: '100px 1fr 120px 100px 100px',
                  padding: '11px 20px', alignItems: 'center',
                  borderBottom: i < fluxo.fluxo.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtData(f.data)}</div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{f.descricao || f.despesa || '—'}</div>
                    {f.historico && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.historico}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.condicao || '—'}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                    {f.credito > 0 ? BRL(f.credito) : ''}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>
                    {f.debito > 0 ? BRL(f.debito) : ''}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}