'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Check, ArrowLeft, ChevronRight, RotateCcw, Printer } from 'lucide-react'
import ModalImpressao from '@/components/ui/ModalImpressao'
import { DadosRecibo } from '@/lib/impressora'

const BRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDataHora = (d: string) => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

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
  const todosDefinidos = itens.every(i => statusItens[i.id] === 'ficou' || statusItens[i.id] === 'devolvido')

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
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', margin: 0 }}>
                {fechada
                  ? (data.status === 'confirmada' ? 'Itens confirmados' : 'Itens devolvidos')
                  : 'Marque o status de cada peça'}
              </h3>
              {!fechada && !todosDefinidos && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {itens.filter(i => statusItens[i.id] === 'pendente').length} pendente(s)
                </span>
              )}
            </div>

            {itens.map(item => {
              const st = statusItens[item.id] || 'pendente'
              return (
                <div key={item.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  gap: 12, padding: '14px 18px',
                  borderBottom: '1px solid rgba(201,168,76,0.05)',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500 }}>{item.produto}</div>
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

            {/* RODAPÉ */}
            {!fechada && (
              <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'rgba(201,168,76,0.02)' }}>
                <div>
                  {itensConfirmados.length > 0 ? (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {itensConfirmados.length} {itensConfirmados.length === 1 ? 'item ficou' : 'itens ficaram'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#C9A84C', marginTop: 2 }}>
                        {BRL(totalConfirmado)}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {todosDefinidos ? 'Todos os itens serão devolvidos' : 'Marque cada item acima'}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ opacity: todosDefinidos ? 1 : 0.45, padding: '11px 24px', fontSize: 14 }}
                  disabled={!todosDefinidos || confirmando}
                  onClick={confirmar}>
                  {confirmando ? 'Registrando...' : todosDefinidos ? <><Check size={13} strokeWidth={2.5} /> Confirmar</> : 'Marque todos os itens'}
                </button>
              </div>
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
