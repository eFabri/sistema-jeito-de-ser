'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Check, ArrowLeft, ChevronRight, RotateCcw, Printer, Search, X, Trash2 } from 'lucide-react'
import ModalImpressao from '@/components/ui/ModalImpressao'
import { DadosRecibo } from '@/lib/impressora'

const BRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDataHora = (d: string) => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 12px', color: '#332F3A', fontSize: 13,
  width: '100%', boxSizing: 'border-box',
}

type StatusItem = 'pendente' | 'ficou' | 'devolvido'

export default function CondicionalDetalhe() {
  const router = useRouter()
  const params = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusItens, setStatusItens] = useState<Record<number, StatusItem>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<{ status: string; venda_id?: number; codigo_legado?: string } | null>(null)
  const [modalImprimir, setModalImprimir] = useState(false)

  // Fix 3: desconto global
  const [descontoVenda, setDescontoVenda] = useState(0)

  // Fix 4: itens extras
  const [itensExtras, setItensExtras] = useState<{ cod_produto: number | null; produto: string; quantidade: number; preco_venda: number }[]>([])
  const [buscaExtra, setBuscaExtra] = useState('')
  const [resExtra, setResExtra] = useState<any[]>([])
  const [buscandoExtra, setBuscandoExtra] = useState(false)

  useEffect(() => {
    fetch(`/api/condicionais/${params.id}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        const initial: Record<number, StatusItem> = {}
        for (const i of d.vendas_condicionais_itens || []) {
          if (i.status === 'ficou' || i.status === 'devolvido') {
            initial[i.id] = i.status
          } else {
            initial[i.id] = 'pendente'
          }
        }
        setStatusItens(initial)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  // Busca produto para extras
  useEffect(() => {
    if (!buscaExtra || buscaExtra.length < 2) { setResExtra([]); return }
    setBuscandoExtra(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/produtos?q=${encodeURIComponent(buscaExtra)}&limite=8`).then(r => r.json())
        setResExtra(r.produtos || [])
      } finally {
        setBuscandoExtra(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [buscaExtra])

  function addItemExtra(prod: any) {
    setItensExtras(prev => [...prev, {
      cod_produto: prod.id || null,
      produto: prod.descricao || prod.nome || '',
      quantidade: 1,
      preco_venda: Number(prod.preco_venda || prod.preco || 0),
    }])
    setBuscaExtra(''); setResExtra([])
  }

  function removeItemExtra(idx: number) { setItensExtras(p => p.filter((_, i) => i !== idx)) }

  function updItemExtra(idx: number, field: string, val: any) {
    setItensExtras(p => p.map((item, i) => i !== idx ? item : { ...item, [field]: val }))
  }

  function dadosCondicional(): DadosRecibo {
    const itensLista: any[] = data?.vendas_condicionais_itens || []
    const total = itensLista.reduce((s: number, i: any) => s + Number(i.preco_venda) * i.quantidade, 0)
    const dataRetorno = data.data_retorno_prevista
      ? new Date(data.data_retorno_prevista).toLocaleDateString('pt-BR')
      : '—'
    return {
      empresa: 'Jeito de Ser Ltda.',
      nomeCliente: data.nome_cliente || '—',
      codVenda: `Condicional #${data.id}`,
      data: new Date(data.data_saida || data.created_at).toLocaleDateString('pt-BR'),
      nomeVendedora: data.vendedor || undefined,
      itens: itensLista.map((i: any) => ({
        produto: i.produto,
        quantidade: i.quantidade,
        preco: Number(i.preco_venda),
        subtotal: Number(i.preco_venda) * i.quantidade,
      })),
      pagamentos: [],
      valorTotal: total,
      observacao: `Retorno previsto: ${dataRetorno}\n\nDeclaro receber as pecas acima em carater condicional e me comprometo a devolver ate ${dataRetorno} as pecas nao selecionadas.\n\nAssinatura: _______________________________`,
    }
  }

  const itens: any[] = data?.vendas_condicionais_itens || []
  const itensConfirmados = itens.filter(i => statusItens[i.id] === 'ficou')
  const totalConfirmado = itensConfirmados.reduce((s, i) => s + Number(i.preco_venda) * i.quantidade, 0)
  const totalExtras = itensExtras.reduce((s, i) => s + Number(i.preco_venda) * i.quantidade, 0)
  const totalFinal = Math.max(0, totalConfirmado + totalExtras - descontoVenda)
  const itensPendentes = itens.filter(i => statusItens[i.id] !== 'ficou' && statusItens[i.id] !== 'devolvido')
  const todosDefinidos = itensPendentes.length === 0

  function irParaPrimeiroPendente() {
    const alvo = itensPendentes[0]
    if (!alvo) return
    document.getElementById(`cond-item-${alvo.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function confirmar() {
    if (!todosDefinidos) return
    setConfirmando(true)
    try {
      const res = await fetch(`/api/condicionais/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmar: true,
          itens: itens.map(i => ({ id: i.id, status: statusItens[i.id] })),
          desc_valor: descontoVenda,
          itens_extras: itensExtras,
        }),
      })
      const result = await res.json()
      setResultado(result)
      setData((d: any) => ({ ...d, status: result.status }))
    } catch {
      alert('Erro ao confirmar. Tente novamente.')
    } finally {
      setConfirmando(false)
    }
  }

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Carregando...
      </div>
    </AppLayout>
  )

  if (!data || data.erro) return (
    <AppLayout>
      <div style={{ padding: 32, color: '#E5584A' }}>Condicional não encontrada</div>
    </AppLayout>
  )

  const fechada = data.status === 'confirmada' || data.status === 'devolvida'
  const vencida = data.status === 'aberta' && data.data_retorno_prevista && new Date(data.data_retorno_prevista) < new Date()

  return (
    <AppLayout>
      {modalImprimir && data && (
        <ModalImpressao dados={dadosCondicional()} titulo="Imprimir Condicional" onClose={() => setModalImprimir(false)} />
      )}
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => router.push('/condicionais')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
              ‹ Condicionais
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
              Condicional #{data.id}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {data.nome_cliente} · {data.vendedor || '—'} · Saída: {fmtDataHora(data.data_saida || data.created_at)}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setModalImprimir(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Printer size={13} strokeWidth={1.8} /> Imprimir
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Retorno previsto</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: vencida ? '#E5584A' : '#332F3A' }}>
                {fmtDataHora(data.data_retorno_prevista)}
              </div>
              {vencida && <div style={{ fontSize: 11, color: '#E5584A', fontWeight: 700, marginTop: 2 }}>VENCIDA</div>}
            </div>
          </div>
        </div>

        {/* RESULTADO */}
        {resultado && (
          <div className="card" style={{
            borderColor: resultado.status === 'confirmada' ? 'rgba(76,175,130,0.3)' : 'rgba(255,255,255,0.1)',
            background: resultado.status === 'confirmada' ? 'rgba(76,175,130,0.06)' : 'rgba(255,255,255,0.02)',
            textAlign: 'center', padding: 32,
          }}>
            {resultado.status === 'confirmada' ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(76,175,130,0.15)', border: '2px solid rgba(76,175,130,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Check size={28} color="#4CAF82" strokeWidth={2} /></div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#4CAF82', marginBottom: 8 }}>
                  Venda Registrada!
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                  Venda #{resultado.codigo_legado || resultado.venda_id} criada. Registre a forma de pagamento.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn-ghost" onClick={() => router.push('/condicionais')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft size={13} strokeWidth={2} /> Condicionais
                  </button>
                  <button className="btn btn-primary" onClick={() => router.push(`/vendas/${resultado.venda_id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Ver Venda <ChevronRight size={13} strokeWidth={2} /> Registrar Pagamento
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'center' }}><RotateCcw size={36} strokeWidth={1.2} /></div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', marginBottom: 8 }}>
                  Devolução Registrada
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Todos os itens foram devolvidos. Condicional encerrada.
                </p>
                <button className="btn btn-ghost" style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => router.push('/condicionais')}>
                  <ArrowLeft size={13} strokeWidth={2} /> Voltar às Condicionais
                </button>
              </>
            )}
          </div>
        )}

        {/* ITENS */}
        {!resultado && (
          <div className="card" style={{ padding: 0, overflow: 'visible' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', margin: 0 }}>
                {fechada
                  ? (data.status === 'confirmada' ? 'Itens confirmados' : 'Itens devolvidos')
                  : 'Itens da condicional'}
              </h3>
              {!fechada && !todosDefinidos && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {itens.filter(i => statusItens[i.id] === 'pendente').length} pendente(s)
                </span>
              )}
            </div>

            {itens.map(item => {
              const st = statusItens[item.id] || 'pendente'
              const pendente = !fechada && st === 'pendente'
              return (
                <div key={item.id} id={`cond-item-${item.id}`} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  gap: 12, padding: '14px 18px',
                  borderBottom: '1px solid rgba(201,168,76,0.05)',
                  borderLeft: `3px solid ${pendente ? '#C9A84C' : 'transparent'}`,
                  background: pendente ? 'rgba(201,168,76,0.07)' : 'transparent',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500 }}>
                      {item.produto}
                      {pendente && (
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          pendente
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                      {BRL(item.preco_venda)} × {item.quantidade}
                    </div>
                  </div>

                  {!fechada ? (
                    <>
                      <button
                        onClick={() => setStatusItens(s => ({ ...s, [item.id]: 'ficou' }))}
                        style={{
                          padding: '7px 16px', borderRadius: 8,
                          border: `1.5px solid ${st === 'ficou' ? '#4CAF82' : 'var(--border)'}`,
                          background: st === 'ficou' ? 'rgba(76,175,130,0.15)' : 'transparent',
                          color: st === 'ficou' ? '#4CAF82' : 'var(--text-muted)',
                          cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          transition: 'all 0.15s',
                        }}>
                        <Check size={11} strokeWidth={2.5} /> Ficou
                      </button>
                      <button
                        onClick={() => setStatusItens(s => ({ ...s, [item.id]: 'devolvido' }))}
                        style={{
                          padding: '7px 16px', borderRadius: 8,
                          border: `1.5px solid ${st === 'devolvido' ? '#E5584A' : 'var(--border)'}`,
                          background: st === 'devolvido' ? 'rgba(229,88,74,0.12)' : 'transparent',
                          color: st === 'devolvido' ? '#E5584A' : 'var(--text-muted)',
                          cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          transition: 'all 0.15s',
                        }}>
                        <RotateCcw size={11} strokeWidth={2} /> Devolvido
                      </button>
                    </>
                  ) : (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                      background: item.status === 'ficou' ? 'rgba(76,175,130,0.12)' : 'rgba(255,255,255,0.05)',
                      color: item.status === 'ficou' ? '#4CAF82' : 'var(--text-muted)',
                    }}>
                      {item.status === 'ficou' ? <><Check size={11} strokeWidth={2.5} /> Ficou</> : <><RotateCcw size={11} strokeWidth={2} /> Devolvido</>}
                    </span>
                  )}

                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C', textAlign: 'right', minWidth: 80 }}>
                    {BRL(Number(item.preco_venda) * item.quantidade)}
                  </div>
                </div>
              )
            })}

            {/* SEÇÃO DE ITENS EXTRAS */}
            {!fechada && (
              <>
                <div style={{ borderTop: '2px solid var(--border)', padding: '12px 18px 8px', background: 'rgba(201,168,76,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--gold-dim)', letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700 }}>
                    Itens adicionados
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>peças extras que não estavam na condicional</span>
                </div>

                {/* Busca produto extra */}
                <div style={{ padding: '0 18px 12px', background: 'rgba(201,168,76,0.02)', position: 'relative', zIndex: 20 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} strokeWidth={1.8} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      style={{ ...INPUT_STYLE, paddingLeft: 32 }}
                      placeholder="Buscar produto para adicionar..."
                      value={buscaExtra}
                      onChange={e => setBuscaExtra(e.target.value)}
                    />
                    {buscaExtra && (
                      <button onClick={() => { setBuscaExtra(''); setResExtra([]) }}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={13} strokeWidth={2} />
                      </button>
                    )}
                    {buscandoExtra && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8 }}>Buscando...</div>
                    )}
                    {resExtra.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999 }}>
                        {resExtra.map((p: any, i: number) => (
                          <div key={p.id || i} onClick={() => addItemExtra(p)}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < resExtra.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div>
                              <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500 }}>{p.descricao || p.nome}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {p.grupo && <span>{p.grupo}</span>}
                                {p.cor && <span> · {p.cor}</span>}
                                {p.tamanho && <span> · {p.tamanho}</span>}
                                {' · '}Estoque: <span style={{ color: p.estoque > 0 ? '#4CAF82' : '#E5584A', fontWeight: 600 }}>{p.estoque ?? 0}</span>
                              </div>
                            </div>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C', fontSize: 14, flexShrink: 0, marginLeft: 12 }}>
                              {BRL(p.preco_venda || 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lista de extras */}
                {itensExtras.length > 0 && (
                  <div style={{ background: 'rgba(201,168,76,0.02)', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
                    {itensExtras.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 90px 36px', gap: 8, padding: '10px 18px', borderBottom: '1px solid rgba(201,168,76,0.05)', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500 }}>{item.produto}</div>
                        <input
                          type="number" min="1" step="1"
                          value={item.quantidade}
                          onChange={e => updItemExtra(idx, 'quantidade', Number(e.target.value))}
                          style={{ ...INPUT_STYLE, padding: '6px 8px', textAlign: 'center' }}
                        />
                        <input
                          type="number" min="0" step="0.01"
                          value={item.preco_venda}
                          onChange={e => updItemExtra(idx, 'preco_venda', Number(e.target.value))}
                          style={{ ...INPUT_STYLE, padding: '6px 8px' }}
                        />
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#C9A84C', textAlign: 'right' }}>
                          {BRL(item.preco_venda * item.quantidade)}
                        </div>
                        <button onClick={() => removeItemExtra(idx)}
                          style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#E5584A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={12} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* RODAPÉ com desconto + total + confirmar */}
                <div style={{ padding: '16px 18px', borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, background: 'rgba(201,168,76,0.02)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {itensConfirmados.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {itensConfirmados.length} {itensConfirmados.length === 1 ? 'peça' : 'peças'} da condicional: {BRL(totalConfirmado)}
                      </div>
                    )}
                    {itensExtras.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        + {itensExtras.length} {itensExtras.length === 1 ? 'peça' : 'peças'} adicionada(s): {BRL(totalExtras)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Desconto (R$):</span>
                      <div style={{ position: 'relative', width: 110 }}>
                        <input
                          type="number" min="0" step="0.01"
                          value={descontoVenda}
                          onChange={e => setDescontoVenda(Number(e.target.value))}
                          style={{ ...INPUT_STYLE, padding: '6px 8px', width: 110 }}
                        />
                      </div>
                    </div>
                    {(itensConfirmados.length > 0 || itensExtras.length > 0) ? (
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#C9A84C', marginTop: 2 }}>
                        Total: {BRL(totalFinal)}
                        {descontoVenda > 0 && (
                          <span style={{ fontSize: 12, color: '#E5584A', fontWeight: 400, marginLeft: 8 }}>
                            − {BRL(descontoVenda)} desconto
                          </span>
                        )}
                      </div>
                    ) : todosDefinidos ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Todos os itens serão devolvidos
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 380 }}>
                    {!todosDefinidos && (
                      <div style={{
                        background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.35)',
                        borderRadius: 8, padding: '10px 12px', textAlign: 'right', width: '100%',
                      }}>
                        <div style={{ fontSize: 12, color: '#332F3A', lineHeight: 1.5 }}>
                          <strong style={{ color: '#C9A84C' }}>
                            Faltam marcar {itensPendentes.length} {itensPendentes.length === 1 ? 'peça' : 'peças'}:
                          </strong>{' '}
                          {itensPendentes.slice(0, 3).map(i => i.produto).join(', ')}
                          {itensPendentes.length > 3 && ` e mais ${itensPendentes.length - 3}`}
                        </div>
                        <button
                          onClick={irParaPrimeiroPendente}
                          style={{
                            marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            color: '#C9A84C', fontSize: 12, fontWeight: 700, textDecoration: 'underline',
                          }}>
                          Ir para o primeiro pendente ↓
                        </button>
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ opacity: todosDefinidos ? 1 : 0.45, padding: '11px 24px', fontSize: 14, whiteSpace: 'nowrap' }}
                      disabled={!todosDefinidos || confirmando}
                      onClick={confirmar}>
                      {confirmando ? 'Registrando...' : todosDefinidos ? <><Check size={13} strokeWidth={2.5} /> Confirmar</> : 'Marque todos os itens'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* OBSERVAÇÃO */}
        {data.observacao && (
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Observação</div>
            <p style={{ fontSize: 13, color: '#332F3A', margin: 0 }}>{data.observacao}</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
