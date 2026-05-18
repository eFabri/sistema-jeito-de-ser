// src/app/vendas/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { imprimirRecibo } from '@/lib/impressora'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export default function VendaDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    fetch(`/api/vendas/${params.id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [params.id])

  async function cancelarVenda() {
    if (!confirm('Confirmar cancelamento desta venda?')) return
    setCancelando(true)
    await fetch(`/api/vendas/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situacao: 'Cancelada' }),
    })
    setData((d: any) => ({ ...d, venda: { ...d.venda, situacao: 'Cancelada' } }))
    setCancelando(false)
  }

  function reimprimir() {
    if (!data) return
    imprimirRecibo({
      empresa: 'Jeito de Ser Ltda.',
      nomeCliente: data.venda.nome_cliente,
      codVenda: data.venda.codigo_legado || data.venda.id,
      data: fmtData(data.venda.data),
      itens: data.itens.map((i: any) => ({ produto: i.produto, quantidade: i.quantidade, preco: i.preco_venda, subtotal: i.sub_total })),
      pagamentos: data.pagamentos.map((p: any) => ({ forma: p.forma, valor: p.valor })),
      desconto: data.venda.desc_valor > 0 ? data.venda.desc_valor : undefined,
      valorTotal: data.venda.valor_total,
      crediario: data.crediario?.map((c: any) => ({ parcela: c.parcela, vencimento: c.data_vencimento, valor: c.valor })),
      observacao: data.venda.observacao,
    })
  }

  if (loading) return <AppLayout><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>Carregando...</div></AppLayout>

  const { venda, itens, pagamentos, crediario, cliente } = data
  const cancelada = venda.situacao === 'Cancelada'

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => router.push('/vendas')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>‹ Vendas</button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: cancelada ? '#ef6b4d' : '#f5ecd7', letterSpacing: '-0.01em' }}>
              Venda #{venda.codigo_legado || venda.id}
              {cancelada && <span style={{ fontSize: 16, marginLeft: 12, padding: '3px 10px', background: 'rgba(239,107,77,0.12)', borderRadius: 6, border: '1px solid rgba(239,107,77,0.25)' }}>CANCELADA</span>}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {fmtData(venda.data)} · {venda.vendedor || '—'} · {venda.situacao}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={reimprimir}>🖨 Imprimir</button>
            {!cancelada && (
              <button className="btn btn-danger" onClick={cancelarVenda} disabled={cancelando} style={{ padding: '9px 16px' }}>
                {cancelando ? 'Cancelando...' : 'Cancelar Venda'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* ITENS */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', gridColumn: '1 / span 2' }}>
            <div style={{ padding: '14px 20px', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#f5ecd7', borderBottom: '1px solid var(--border)' }}>
              Itens
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(212,175,95,0.03)' }}>
              {['Produto', 'Qtd', 'Preço Unit.', 'Subtotal'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {itens.map((item: any, i: number) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 100px', padding: '12px 20px', borderBottom: i < itens.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#f5ecd7' }}>{item.produto}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.quantidade}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{BRL(item.preco_venda)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#d4af5f' }}>{BRL(item.sub_total)}</div>
              </div>
            ))}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {venda.desc_valor > 0 && (
                <div style={{ fontSize: 13, color: '#ef6b4d' }}>Desconto: - {BRL(venda.desc_valor)}</div>
              )}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#d4af5f' }}>
                Total: {BRL(venda.valor_total)}
              </div>
            </div>
          </div>

          {/* PAGAMENTOS */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#f5ecd7', marginBottom: 14 }}>Pagamentos</h3>
            {pagamentos.map((p: any, i: number) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < pagamentos.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.forma}{p.operadora ? ` (${p.operadora})` : ''}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#f5ecd7' }}>{BRL(p.valor)}</span>
              </div>
            ))}
          </div>

          {/* CLIENTE */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#f5ecd7', marginBottom: 14 }}>Cliente</h3>
            {cliente ? (
              <div>
                <div style={{ fontSize: 14, color: '#f5ecd7', fontWeight: 600, marginBottom: 4 }}>{cliente.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{cliente.celular || '—'}</div>
                <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11, marginTop: 8 }} onClick={() => router.push(`/clientes/${cliente.id}`)}>
                  Ver ficha →
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
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#f5ecd7', marginBottom: 14 }}>Crediário</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {crediario.map((p: any) => {
                  const venc = new Date(p.data_vencimento)
                  const atrasado = !p.pago && venc < new Date()
                  return (
                    <div key={p.id} style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: p.pago ? 'rgba(100,200,140,0.06)' : atrasado ? 'rgba(239,107,77,0.06)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${p.pago ? 'rgba(100,200,140,0.2)' : atrasado ? 'rgba(239,107,77,0.2)' : 'var(--border)'}`,
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{p.parcela}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: p.pago ? '#64c88c' : atrasado ? '#ef6b4d' : '#f5ecd7' }}>
                        {BRL(p.valor)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fmtData(p.data_vencimento)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 6, color: p.pago ? '#64c88c' : atrasado ? '#ef6b4d' : 'var(--text-muted)' }}>
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
    </AppLayout>
  )
}
