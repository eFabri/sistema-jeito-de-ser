// src/app/crediario/[id]/page.tsx — Detalhe do crediário de UM cliente
'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { hojeNoBrasil } from '@/lib/dates'
import { imprimirRecibo } from '@/lib/impressora'

const BRL    = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
const FORMAS  = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Transferência', 'Cheque']

// ─── MODAL RECEBIMENTO ────────────────────────────────────
function ModalReceber({ conta, onClose, onSalvo }: any) {
  const saldoAtual  = conta.parcialmente_pago
    ? Number(conta.saldo_devedor_original || conta.saldo_devedor || conta.valor)
    : Number(conta.valor)
  const jaRecebido  = Number(conta.valor_pago || 0)
  const isParcial   = conta.parcialmente_pago

  const [tipoPgto, setTipoPgto] = useState<'total' | 'parcial'>('total')
  const [valor, setValor]       = useState(saldoAtual)
  const [juros, setJuros]       = useState(0)
  const [desconto, setDesconto] = useState(0)
  const [forma, setForma]       = useState('Dinheiro')
  const [data, setData]         = useState(hojeNoBrasil())
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const vencida      = new Date(conta.data_vencimento + 'T12:00:00') < new Date()
  const dias         = Math.floor((Date.now() - new Date(conta.data_vencimento + 'T12:00:00').getTime()) / 86400000)
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

  const overlay = { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }
  const box     = { background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '28px 32px', width: 440, boxShadow: 'var(--shadow-dropdown)' }

  if (resultado) {
    return createPortal(
      <div style={overlay}>
        <div style={{ ...box, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{resultado.quitado ? '✅' : '◉'}</div>
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
              <button key={n} className="btn btn-ghost" style={{ justifyContent: 'center', flexDirection: 'column', gap: 2, padding: '12px' }} onClick={() => imprimirComprovante(n)}>
                <span>🖨 {n} {n === 1 ? 'via' : 'vias'}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{n === 1 ? 'só cliente' : 'cliente + loja'}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={onSalvo}>
            Fechar sem imprimir
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div style={overlay}>
      <div style={box}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 6 }}>Registrar Recebimento</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          {conta.clientes?.nome || 'Cliente'} · Parcela {conta.parcela || '—'} · Vence {fmtData(conta.data_vencimento)}
        </p>

        {isParcial && jaRecebido > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Total original', val: conta.valor, color: 'var(--text-muted)' },
              { label: 'Já recebido',   val: jaRecebido,  color: '#4CAF82' },
              { label: 'Saldo devedor', val: saldoAtual,  color: '#C9A84C' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color }}>{BRL(Number(val))}</div>
              </div>
            ))}
          </div>
        )}

        {vencida && (
          <div style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#E5584A' }}>
            ⚠ Conta vencida há {dias} dia(s). Adicione juros se houver.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {(['total', 'parcial'] as const).map(t => (
            <button key={t} type="button" onClick={() => handleTipo(t)} style={{
              padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${tipoPgto === t ? 'rgba(201,168,76,0.45)' : 'var(--border)'}`,
              background: tipoPgto === t ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
              color: tipoPgto === t ? '#C9A84C' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.4,
            }}>
              {t === 'total' ? `◉ Pagamento total\n${BRL(saldoAtual)}` : '◎ Pagamento parcial'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tipoPgto === 'parcial' && (
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                Valor recebido agora (R$)
              </label>
              <input type="number" className="input" value={valor} step={0.01} min={0.01} max={saldoAtual}
                onChange={e => setValor(parseFloat(e.target.value) || 0)} autoFocus />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Desconto (R$)</label>
              <input type="number" className="input" value={desconto} step={0.01} min={0}
                onChange={e => setDesconto(parseFloat(e.target.value) || 0)} placeholder="0,00" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Juros (R$)</label>
              <input type="number" className="input" value={juros} step={0.01} min={0}
                onChange={e => setJuros(parseFloat(e.target.value) || 0)} placeholder="0,00" />
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

          <div style={{ padding: '12px 14px', background: quitaTotal ? 'rgba(76,175,130,0.06)' : 'rgba(201,168,76,0.06)', border: `1px solid ${quitaTotal ? 'rgba(76,175,130,0.2)' : 'rgba(201,168,76,0.15)'}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Valor a receber:</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>{BRL(valorFinal)}</span>
            </div>
            {(desconto > 0 || juros > 0) && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {desconto > 0 && <span style={{ color: '#4CAF82' }}>-{BRL(desconto)} desconto </span>}
                {juros > 0 && <span style={{ color: '#E8943A' }}>+{BRL(juros)} juros</span>}
              </div>
            )}
            {!quitaTotal && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Saldo em aberto:</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#E8943A' }}>{BRL(ficaRestante)}</span>
              </div>
            )}
            {quitaTotal && <div style={{ fontSize: 12, color: '#4CAF82', fontWeight: 600 }}>✓ Conta será quitada integralmente</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-success" style={{ flex: 2, justifyContent: 'center', padding: '11px' }} onClick={salvar} disabled={salvando || valorFinal <= 0}>
            {salvando ? 'Registrando...' : quitaTotal ? '✓ Quitar Conta' : '✓ Baixa Parcial'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────
export default function CrediarioDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<'pecas' | 'compras' | 'parcelas'>('pecas')
  const [parcelaModal, setParcelaModal] = useState<any>(null)

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/crediario/${params.id}`)
    const d = await r.json()
    if (d.erro) setErro(d.erro); else setData(d)
  }, [params.id])

  useEffect(() => { carregar() }, [carregar])

  if (erro) return <AppLayout><div style={{ color: '#E5584A', padding: 24 }}>{erro}</div></AppLayout>
  if (!data) return <AppLayout><div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando...</div></AppLayout>

  const { cliente, totais, vendas, parcelas, pecas_top } = data
  const hoje = hojeNoBrasil()

  return (
    <AppLayout>
      {parcelaModal && (
        <ModalReceber
          conta={{ ...parcelaModal, clientes: { nome: cliente.nome } }}
          onClose={() => setParcelaModal(null)}
          onSalvo={() => { setParcelaModal(null); carregar() }}
        />
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1100 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#F2EBD9' }}>
              {cliente.nome}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {cliente.celular || cliente.whatsapp || '—'}
              {cliente.cidade ? ` · ${cliente.cidade}` : ''}
              {cliente.categoria ? ` · ${cliente.categoria}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push(`/clientes/${cliente.id}`)}>
              Ver Cliente
            </button>
            <button className="btn btn-primary" onClick={() => router.push(`/vendas/nova?cliente=${cliente.id}`)}>
              + Nova Venda
            </button>
          </div>
        </div>

        {/* MÉTRICAS DO CLIENTE */}
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <Metrica label="Em aberto" valor={BRL(totais.em_aberto || 0)} cor="#C9A84C" destaque />
          <Metrica label="Em atraso" valor={BRL(totais.em_atraso || 0)} cor={totais.em_atraso > 0 ? '#E5584A' : 'var(--text-muted)'} />
          <Metrica label="Já pago" valor={BRL(totais.pago || 0)} cor="#4CAF82" />
          <Metrica label="Compras totais" valor={String(totais.total_compras)} cor="#4D9ECC" />
          <Metrica
            label="Próxima parcela"
            valor={totais.proxima_parcela ? fmtData(totais.proxima_parcela.data_vencimento) : '—'}
            sub={totais.proxima_parcela ? BRL(totais.proxima_parcela.parcialmente_pago ? Number(totais.proxima_parcela.saldo_devedor_original || totais.proxima_parcela.saldo_devedor || totais.proxima_parcela.valor) : Number(totais.proxima_parcela.valor)) : undefined}
            cor={totais.proxima_parcela?.data_vencimento < hoje ? '#E5584A' : '#F2EBD9'}
          />
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {([['pecas', '👗 Peças Compradas'], ['compras', '◈ Histórico de Compras'], ['parcelas', '◎ Parcelas']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)} style={{
              padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              background: aba === id ? 'rgba(201,168,76,0.18)' : 'transparent',
              color: aba === id ? '#C9A84C' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {/* PEÇAS */}
        {aba === 'pecas' && (
          pecas_top.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Sem compras registradas.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 130px',
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
                background: 'rgba(201,168,76,0.03)',
              }}>
                {['Peça / Produto', 'Quantidade', 'Total Gasto'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {pecas_top.map((p: any, i: number) => (
                <div
                  key={i}
                  onClick={() => p.cod_produto && router.push(`/produtos/${p.cod_produto}`)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 100px 130px',
                    padding: '13px 20px', alignItems: 'center',
                    borderBottom: i < pecas_top.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                    cursor: p.cod_produto ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (p.cod_produto) e.currentTarget.style.background = 'rgba(201,168,76,0.03)' }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>👗</span>
                    <span style={{ fontSize: 13, color: '#F2EBD9' }}>{p.produto}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 600 }}>{p.qtd} un.</div>
                  <div style={{ fontSize: 13, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{BRL(p.valor)}</div>
                </div>
              ))}
            </div>
          )
        )}

        {/* COMPRAS */}
        {aba === 'compras' && (
          vendas.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Sem compras registradas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vendas.map((v: any) => (
                <div key={v.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#C9A84C', letterSpacing: '0.08em', fontWeight: 700 }}>VENDA #{v.codigo_legado || v.id}</span>
                        {v.situacao && <span className="badge badge-gold" style={{ fontSize: 9 }}>{v.situacao}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        {fmtData(v.data)}{v.vendedor ? ` · vendido por ${v.vendedor}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C' }}>
                        {BRL(Number(v.valor_total))}
                      </div>
                    </div>
                  </div>
                  {v.itens && v.itens.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(201,168,76,0.05)', paddingTop: 10 }}>
                      {v.itens.map((it: any) => (
                        <div key={it.cod_venda + '-' + it.produto} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px', gap: 12, padding: '4px 0', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{it.produto}</span>
                          <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{it.quantidade}x</span>
                          <span style={{ color: '#F2EBD9', textAlign: 'right', fontWeight: 600 }}>{BRL(Number(it.sub_total))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* PARCELAS */}
        {aba === 'parcelas' && (
          parcelas.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Sem parcelas registradas.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 160px 130px 120px 110px',
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
                background: 'rgba(201,168,76,0.03)',
              }}>
                {['Parcela', 'Vencimento', 'Valor / Saldo', 'Pago em', 'Status', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {parcelas.map((p: any, i: number) => {
                const atrasada   = !p.pago && p.data_vencimento && p.data_vencimento < hoje
                const isParcial  = !p.pago && p.parcialmente_pago
                const saldoExib  = isParcial ? Number(p.saldo_devedor_original || p.saldo_devedor || p.valor) : Number(p.valor)
                const jaPago     = Number(p.valor_pago || 0)
                const status     = p.pago ? 'Pago' : isParcial ? 'Parcial' : atrasada ? 'Atrasada' : 'Aberta'
                const cor        = p.pago ? '#4CAF82' : isParcial ? '#C9A84C' : atrasada ? '#E5584A' : '#E8943A'
                return (
                  <div key={p.id} style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 160px 130px 120px 110px',
                    padding: '12px 20px', alignItems: 'center',
                    borderBottom: i < parcelas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                    background: isParcial ? 'rgba(201,168,76,0.02)' : atrasada ? 'rgba(229,88,74,0.02)' : 'transparent',
                  }}>
                    <div style={{ fontSize: 12, color: '#F2EBD9' }}>{p.parcela || '—'}</div>
                    <div style={{ fontSize: 13, color: atrasada && !isParcial ? '#E5584A' : '#F2EBD9' }}>{fmtData(p.data_vencimento)}</div>
                    <div>
                      <div style={{ fontSize: 13, color: cor, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                        {BRL(saldoExib)}
                      </div>
                      {isParcial && jaPago > 0 && (
                        <div style={{ fontSize: 10, color: '#4CAF82' }}>✓ {BRL(jaPago)} pago de {BRL(Number(p.valor))}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.pago ? fmtData(p.data_cobranca) : '—'}</div>
                    <div>
                      <span style={{
                        background: `${cor}22`, color: cor, border: `1px solid ${cor}55`,
                        borderRadius: 6, padding: '2px 10px', fontSize: 10,
                        fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                      }}>{status}</span>
                    </div>
                    <div>
                      {!p.pago && (
                        <button
                          onClick={() => setParcelaModal(p)}
                          style={{
                            padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                            border: '1px solid rgba(76,175,130,0.4)',
                            background: 'rgba(76,175,130,0.08)', color: '#4CAF82',
                            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-body)',
                          }}
                        >
                          ✓ Receber
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </AppLayout>
  )
}

function Metrica({ label, valor, sub, cor, destaque }: { label: string; valor: string; sub?: string; cor: string; destaque?: boolean }) {
  return (
    <div className="card">
      <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: destaque ? 24 : 18, fontWeight: 700, color: cor, lineHeight: 1 }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}
