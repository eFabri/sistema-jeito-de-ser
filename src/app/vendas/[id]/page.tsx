// src/app/vendas/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { DadosRecibo, DadosTalaoCrediario } from '@/lib/impressora'
import ModalImpressaoVenda from '@/components/ModalImpressaoVenda'
import { Printer, ChevronRight, Pencil } from 'lucide-react'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export default function VendaDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelando, setCancelando]       = useState(false)
  const [modalImprimir, setModalImprimir] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)

  useEffect(() => {
    fetch(`/api/vendas/${params.id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [params.id])

  async function cancelarVenda() {
    setCancelando(true)
    try {
      const res = await fetch(`/api/vendas/${params.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.erro || 'Erro ao cancelar')
      setModalCancelar(false)
      router.push('/vendas')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setCancelando(false)
    }
  }

  function dadosRecibo(): DadosRecibo {
    return {
      empresa: 'JEITO DE SER LTDA.',
      nomeCliente: data.venda.nome_cliente,
      nomeVendedora: data.venda.vendedor || undefined,
      codVenda: data.venda.codigo_legado || data.venda.id,
      data: fmtData(data.venda.data),
      itens: data.itens.map((i: any) => ({ produto: i.produto, quantidade: i.quantidade, preco: i.preco_venda, subtotal: i.sub_total })),
      pagamentos: data.pagamentos.map((p: any) => ({ forma: p.forma, valor: p.valor })),
      desconto: data.venda.desc_valor > 0 ? data.venda.desc_valor : undefined,
      valorTotal: data.venda.valor_total,
      crediario: data.crediario?.map((c: any) => ({ parcela: c.parcela, vencimento: c.data_vencimento, valor: c.valor })),
      observacao: data.venda.observacao,
      situacao: data.venda.situacao,
    }
  }

  function dadosTalao(): DadosTalaoCrediario | undefined {
    if (!data.crediario?.length) return undefined
    return {
      nomeCliente: data.venda.nome_cliente,
      cpf: data.cliente?.cpf || undefined,
      codVenda: data.venda.codigo_legado || data.venda.id,
      data: fmtData(data.venda.data),
      valorTotal: data.venda.valor_total,
      parcelas: data.crediario.map((c: any) => ({ parcela: c.parcela, vencimento: c.data_vencimento, valor: c.valor })),
    }
  }

  if (loading) return <AppLayout><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>Carregando...</div></AppLayout>

  const { venda, itens, pagamentos, crediario, cliente } = data
  const cancelada = venda.situacao === 'Cancelada'

  return (
    <AppLayout>
      {modalImprimir && data && (
        <ModalImpressaoVenda
          dadosCupom={dadosRecibo()}
          dadosTalao={dadosTalao()}
          titulo="Reimprimir Recibo"
          onClose={() => setModalImprimir(false)}
        />
      )}
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => router.push('/vendas')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>‹ Vendas</button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: cancelada ? '#E5584A' : '#332F3A', letterSpacing: '-0.01em' }}>
              Venda #{venda.codigo_legado || venda.id} — {fmtData(venda.data)} — {venda.vendedor || '—'}
              {cancelada && <span style={{ fontSize: 14, marginLeft: 12, padding: '3px 10px', background: 'rgba(229,88,74,0.12)', borderRadius: 6, border: '1px solid rgba(229,88,74,0.25)' }}>CANCELADA</span>}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {venda.situacao}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setModalImprimir(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Printer size={13} strokeWidth={1.8} /> Imprimir</button>
            {!cancelada && (
              <button className="btn btn-ghost" onClick={() => router.push(`/vendas/${venda.id}/editar`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={13} strokeWidth={1.8} /> Editar
              </button>
            )}
            {!cancelada && (
              <button className="btn btn-danger" onClick={() => setModalCancelar(true)} style={{ padding: '9px 16px' }}>
                Cancelar Venda
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* ITENS */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', gridColumn: '1 / span 2' }}>
            <div style={{ padding: '14px 20px', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', borderBottom: '1px solid var(--border)' }}>
              Itens
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              {['Produto', 'Qtd', 'Preço Unit.', 'Subtotal'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {itens.map((item: any, i: number) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', padding: '12px 20px', borderBottom: i < itens.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#332F3A' }}>{item.produto}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.quantidade}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{BRL(item.preco_venda)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{BRL(item.sub_total)}</div>
              </div>
            ))}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {venda.desc_valor > 0 && (
                <div style={{ fontSize: 13, color: '#E5584A' }}>Desconto: - {BRL(venda.desc_valor)}</div>
              )}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#C9A84C' }}>
                Total: {BRL(venda.valor_total)}
              </div>
            </div>
          </div>

          {/* PAGAMENTOS */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', marginBottom: 14 }}>Pagamentos</h3>
            {pagamentos.map((p: any, i: number) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < pagamentos.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {p.forma}
                  {p.forma === 'Cartão Crédito' && p.parcelas > 1 ? ` ${p.parcelas}x` : ''}
                  {p.operadora ? ` (${p.operadora})` : ''}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#332F3A' }}>{BRL(p.valor)}</span>
              </div>
            ))}
          </div>

          {/* CLIENTE */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', marginBottom: 14 }}>Cliente</h3>
            {cliente ? (
              <div>
                <div style={{ fontSize: 14, color: '#332F3A', fontWeight: 600, marginBottom: 4 }}>{cliente.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{cliente.celular || '—'}</div>
                <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, marginTop: 8 }} onClick={() => router.push(`/clientes/${cliente.id}`)}>
                  Ver ficha <ChevronRight size={12} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Venda avulsa (sem cliente)</p>
            )}
            {venda.observacao && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Observação</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{venda.observacao}</div>
              </div>
            )}
          </div>

          {/* CREDIÁRIO */}
          {crediario?.length > 0 && (
            <div className="card" style={{ gridColumn: '1 / span 2' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', marginBottom: 14 }}>Crediário</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {crediario.map((p: any) => {
                  const venc = new Date(p.data_vencimento)
                  const atrasado = !p.pago && venc < new Date()
                  return (
                    <div key={p.id} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: p.pago ? 'rgba(76,175,130,0.06)' : atrasado ? 'rgba(229,88,74,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${p.pago ? 'rgba(76,175,130,0.2)' : atrasado ? 'rgba(229,88,74,0.2)' : 'var(--border)'}`,
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{p.parcela}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: p.pago ? '#4CAF82' : atrasado ? '#E5584A' : '#332F3A' }}>
                        {BRL(p.valor)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fmtData(p.data_vencimento)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 6, color: p.pago ? '#4CAF82' : atrasado ? '#E5584A' : 'var(--text-muted)' }}>
                        {p.pago ? 'PAGO' : atrasado ? 'VENCIDO' : 'EM ABERTO'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CANCELAR */}
        {modalCancelar && (
          <div onClick={e => { if (e.target === e.currentTarget) setModalCancelar(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(229,88,74,0.1)', border: '2px solid rgba(229,88,74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
                ✕
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#332F3A', marginBottom: 10 }}>
                Cancelar esta venda?
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                Venda #{venda.codigo_legado || venda.id} — {venda.nome_cliente}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                O estoque dos itens será restaurado e as parcelas em aberto serão removidas. Parcelas pagas permanecem no histórico. Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalCancelar(false)} disabled={cancelando}>
                  Voltar
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={cancelarVenda} disabled={cancelando}>
                  {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          </div>
        )}
    </AppLayout>
  )
}
