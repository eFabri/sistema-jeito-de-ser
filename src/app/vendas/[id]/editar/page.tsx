// src/app/vendas/[id]/editar/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Check, ArrowLeft, Trash2, Plus, Search, X } from 'lucide-react'

const BRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const FORMAS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Crediário', 'Boleto', 'Transferência']
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const getToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

const LABEL: React.CSSProperties = {
  fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em',
  textTransform: 'uppercase', marginBottom: 6, display: 'block',
}
const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 12px', color: '#332F3A', fontSize: 13,
  width: '100%', boxSizing: 'border-box',
}

export default function EditarVendaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading]   = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [sucesso, setSucesso]   = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [isAdmin, setIsAdmin]   = useState(false)
  const [vendaOrig, setVendaOrig] = useState<any>(null)

  const [itens, setItens]           = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [parcelas, setParcelas]     = useState<any[]>([])
  const [parcelasPagas, setParcelasPagas] = useState<any[]>([])
  const [observacao, setObservacao] = useState('')
  const [vendedor, setVendedor]     = useState('')
  const [perfis, setPerfis]         = useState<any[]>([])

  // Busca produto
  const [buscaProd, setBuscaProd]   = useState('')
  const [resProd, setResProd]       = useState<any[]>([])
  const [buscandoProd, setBuscandoProd] = useState(false)

  // Admin check separated from data load to avoid race conditions
  useEffect(() => {
    fetch('/api/perfil')
      .then(r => r.json())
      .then(d => {
        const admin = d?.perfil === 'admin'
        setIsAdmin(admin)
        if (admin) return fetch('/api/usuarios').then(r => r.json())
      })
      .then(data => { if (data?.usuarios) setPerfis(data.usuarios) })
      .catch(() => {})
  }, [])

  // ReadOnly depends on both admin status and venda date
  useEffect(() => {
    if (!vendaOrig) return
    const sete = new Date(); sete.setDate(sete.getDate() - 7)
    const limitDate = sete.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    setReadOnly(!isAdmin && vendaOrig.data < limitDate)
  }, [isAdmin, vendaOrig])

  useEffect(() => {
    async function carregar() {
      const vendaRes = await fetch(`/api/vendas/${id}`).then(r => r.json())
      if (vendaRes.erro) { setErro(vendaRes.erro); setLoading(false); return }
      const { venda, itens: its, pagamentos: pgs, crediario } = vendaRes
      setVendaOrig(venda)
      setItens(its.map((i: any) => ({ ...i })))
      setPagamentos(pgs.map((p: any) => ({ ...p })))
      setObservacao(venda.observacao || '')
      setVendedor(venda.vendedor || '')
      const abertas = (crediario || []).filter((p: any) => !p.pago)
      const pagas   = (crediario || []).filter((p: any) => p.pago)
      setParcelas(abertas.map((p: any) => ({ ...p })))
      setParcelasPagas(pagas)
      setLoading(false)
    }
    carregar()
  }, [id])

  // Debounce busca produto
  useEffect(() => {
    if (!buscaProd || buscaProd.length < 2) { setResProd([]); return }
    setBuscandoProd(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/produtos?q=${encodeURIComponent(buscaProd)}&limite=8`).then(r => r.json())
        setResProd(r.produtos || [])
      } finally {
        setBuscandoProd(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [buscaProd])

  function addItemDoCatalogo(prod: any) {
    setItens(prev => [...prev, {
      id: undefined,
      cod_produto: prod.id || null,
      produto: prod.nome || prod.descricao || '',
      quantidade: 1,
      preco_venda: Number(prod.preco_venda || prod.preco || 0),
      sub_total:   Number(prod.preco_venda || prod.preco || 0),
    }])
    setBuscaProd(''); setResProd([])
  }

  function addItemManual() {
    setItens(prev => [...prev, { id: undefined, cod_produto: null, produto: '', quantidade: 1, preco_venda: 0, sub_total: 0 }])
  }

  function removeItem(idx: number) { setItens(p => p.filter((_, i) => i !== idx)) }
  function updItem(idx: number, field: string, val: any) {
    setItens(p => p.map((item, i) => {
      if (i !== idx) return item
      const u = { ...item, [field]: val }
      if (field === 'quantidade' || field === 'preco_venda') u.sub_total = Number(u.quantidade) * Number(u.preco_venda)
      return u
    }))
  }

  function addPagamento() { setPagamentos(p => [...p, { id: undefined, forma: 'Dinheiro', valor: 0 }]) }
  function removePagamento(idx: number) { setPagamentos(p => p.filter((_, i) => i !== idx)) }
  function updPag(idx: number, field: string, val: any) {
    setPagamentos(p => p.map((pg, i) => i !== idx ? pg : { ...pg, [field]: val }))
  }

  function addParcela() {
    const n = parcelas.length + parcelasPagas.length
    setParcelas(p => [...p, { id: undefined, parcela: `${n + 1}/${n + 1}`, data_vencimento: '', valor: 0 }])
  }
  function removeParcela(idx: number) { setParcelas(p => p.filter((_, i) => i !== idx)) }
  function updParcela(idx: number, field: string, val: any) {
    setParcelas(p => p.map((par, i) => i !== idx ? par : { ...par, [field]: val }))
  }

  const totalItens = itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.preco_venda || 0), 0)
  const totalPgto  = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0)

  async function salvar() {
    setErro('')
    setSalvando(true)
    try {
      const res = await fetch(`/api/vendas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: itens.map(i => ({
            id: i.id || undefined,
            cod_produto: i.cod_produto || null,
            produto: i.produto,
            quantidade: Number(i.quantidade),
            preco_venda: Number(i.preco_venda),
          })),
          pagamentos: pagamentos.map(p => ({
            forma: p.forma,
            valor: Number(p.valor),
            operadora: p.operadora || null,
          })),
          parcelas: parcelas.map(p => ({
            id: p.id || undefined,
            parcela: p.parcela,
            data_vencimento: p.data_vencimento,
            valor: Number(p.valor),
          })),
          valor_total: totalItens,
          observacao,
          vendedor: vendedor || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.erro || 'Erro ao salvar')
      setSucesso(true)
      setTimeout(() => router.push(`/vendas/${id}`), 1100)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>Carregando...</div>
    </AppLayout>
  )

  if (!vendaOrig) return (
    <AppLayout>
      <div style={{ padding: 32, color: '#E5584A' }}>{erro || 'Venda não encontrada'}</div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={13} strokeWidth={2} /> Voltar
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
              Editar Venda #{vendaOrig.codigo_legado || vendaOrig.id}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {vendaOrig.nome_cliente} · {fmtData(vendaOrig.data)}
            </p>
            {isAdmin && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Vendedora:</label>
                <select
                  value={vendedor}
                  onChange={e => setVendedor(e.target.value)}
                  disabled={readOnly}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: '#332F3A', fontSize: 13, minWidth: 160 }}>
                  <option value="">— Sem vendedora —</option>
                  {perfis.map((p: any) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </div>
            )}
            {!isAdmin && vendaOrig.vendedor && (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Vendedora: {vendaOrig.vendedor}</p>
            )}
          </div>
          {!readOnly && (
            <button className="btn btn-primary" onClick={salvar} disabled={salvando || sucesso}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {sucesso ? <><Check size={13} strokeWidth={2.5} /> Salvo!</> : salvando ? 'Salvando...' : <><Check size={13} strokeWidth={2.5} /> Salvar Alterações</>}
            </button>
          )}
        </div>

        {readOnly && (
          <div style={{ padding: '12px 16px', background: 'rgba(77,158,204,0.08)', border: '1px solid rgba(77,158,204,0.25)', borderRadius: 10, color: '#4D9ECC', fontSize: 13 }}>
            Apenas administradores podem editar vendas de outros dias. Visualizando em modo leitura.
          </div>
        )}

        {erro && (
          <div style={{ padding: '12px 16px', background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.25)', borderRadius: 10, color: '#E5584A', fontSize: 13 }}>
            {erro}
          </div>
        )}

        {/* ITENS */}
        <div className="card" style={{ padding: 0, overflow: 'visible' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', margin: 0 }}>Itens da Venda</h3>
            {!readOnly && (
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={addItemManual}>
                <Plus size={12} strokeWidth={2} /> Item avulso
              </button>
            )}
          </div>

          {/* Busca produto */}
          {!readOnly && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.02)', position: 'relative', zIndex: 20, overflow: 'visible' }}>
              <label style={LABEL}>Adicionar do catálogo</label>
              <div style={{ position: 'relative' }}>
                <Search size={13} strokeWidth={1.8} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  style={{ ...INPUT, paddingLeft: 32 }}
                  placeholder="Buscar por nome ou código de barras..."
                  value={buscaProd}
                  onChange={e => setBuscaProd(e.target.value)}
                />
                {buscaProd && (
                  <button onClick={() => { setBuscaProd(''); setResProd([]) }}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={13} strokeWidth={2} />
                  </button>
                )}
                {buscandoProd && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, fontSize: 11, color: 'var(--text-muted)', padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8 }}>Buscando...</div>
                )}
                {resProd.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999 }}>
                    {resProd.map((p: any, i: number) => (
                      <div key={p.id || i} onClick={() => addItemDoCatalogo(p)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < resProd.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
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
          )}

          {/* Lista itens */}
          <div style={{ padding: '0 18px' }}>
            {itens.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nenhum item</div>
            ) : itens.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 100px 36px', gap: 8, padding: '12px 0', borderBottom: idx < itens.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', alignItems: 'end' }}>
                <div>
                  {idx === 0 && <label style={LABEL}>Produto</label>}
                  {readOnly
                    ? <div style={{ fontSize: 13, color: '#332F3A', padding: '8px 0' }}>{item.produto}</div>
                    : <input style={INPUT} value={item.produto} onChange={e => updItem(idx, 'produto', e.target.value)} placeholder="Nome do produto" />
                  }
                </div>
                <div>
                  {idx === 0 && <label style={LABEL}>Qtd</label>}
                  {readOnly
                    ? <div style={{ fontSize: 13, color: '#332F3A', padding: '8px 0' }}>{item.quantidade}</div>
                    : <input style={INPUT} type="number" min="1" step="1" value={item.quantidade} onChange={e => updItem(idx, 'quantidade', e.target.value)} />
                  }
                </div>
                <div>
                  {idx === 0 && <label style={LABEL}>Preço unit.</label>}
                  {readOnly
                    ? <div style={{ fontSize: 13, color: '#332F3A', padding: '8px 0' }}>{BRL(item.preco_venda)}</div>
                    : <input style={INPUT} type="number" min="0" step="0.01" value={item.preco_venda} onChange={e => updItem(idx, 'preco_venda', e.target.value)} />
                  }
                </div>
                <div>
                  {idx === 0 && <label style={LABEL}>Subtotal</label>}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C', padding: '8px 0' }}>
                    {BRL(Number(item.quantidade) * Number(item.preco_venda))}
                  </div>
                </div>
                <div style={{ paddingTop: idx === 0 ? 22 : 0 }}>
                  {!readOnly && (
                    <button onClick={() => removeItem(idx)} style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 6, padding: 7, cursor: 'pointer', color: '#E5584A', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={12} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(201,168,76,0.02)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#C9A84C' }}>
              Total: {BRL(totalItens)}
            </div>
          </div>
        </div>

        {/* PAGAMENTOS */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', margin: 0 }}>Pagamentos</h3>
            {!readOnly && (
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={addPagamento}>
                <Plus size={12} strokeWidth={2} /> Adicionar
              </button>
            )}
          </div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagamentos.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>Nenhum pagamento registrado</div>
            )}
            {pagamentos.map((p, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 36px', gap: 8, alignItems: 'end' }}>
                <div>
                  {idx === 0 && <label style={LABEL}>Forma</label>}
                  {readOnly
                    ? <div style={{ fontSize: 13, color: '#332F3A', padding: '8px 0' }}>{p.forma}</div>
                    : <select style={INPUT} value={p.forma} onChange={e => updPag(idx, 'forma', e.target.value)}>
                        {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                  }
                </div>
                <div>
                  {idx === 0 && <label style={LABEL}>Valor (R$)</label>}
                  {readOnly
                    ? <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#332F3A', padding: '8px 0' }}>{BRL(p.valor)}</div>
                    : <input style={INPUT} type="number" min="0" step="0.01" value={p.valor} onChange={e => updPag(idx, 'valor', e.target.value)} />
                  }
                </div>
                <div style={{ paddingTop: idx === 0 ? 22 : 0 }}>
                  {!readOnly && (
                    <button onClick={() => removePagamento(idx)} style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 6, padding: 7, cursor: 'pointer', color: '#E5584A', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={12} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {pagamentos.length > 0 && (
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(201,168,76,0.02)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: Math.abs(totalPgto - totalItens) < 0.01 ? '#4CAF82' : '#E5584A' }}>
                Total pago: {BRL(totalPgto)}
                {Math.abs(totalPgto - totalItens) >= 0.01 && (
                  <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                    (diferença: {BRL(totalItens - totalPgto)})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CREDIÁRIO */}
        {(parcelas.length > 0 || parcelasPagas.length > 0 || !readOnly) && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', margin: 0 }}>
                Crediário
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                  ({parcelas.length} em aberto{parcelasPagas.length > 0 ? ` · ${parcelasPagas.length} paga(s)` : ''})
                </span>
              </h3>
              {!readOnly && (
                <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={addParcela}>
                  <Plus size={12} strokeWidth={2} /> Nova parcela
                </button>
              )}
            </div>

            {parcelasPagas.length > 0 && (
              <div style={{ padding: '12px 18px', borderBottom: parcelas.length > 0 ? '1px solid var(--border)' : 'none', background: 'rgba(76,175,130,0.02)' }}>
                <div style={{ fontSize: 10, color: '#4CAF82', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Parcelas pagas (somente leitura)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {parcelasPagas.map((p: any) => (
                    <div key={p.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(76,175,130,0.06)', border: '1px solid rgba(76,175,130,0.2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.parcela}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#4CAF82' }}>{BRL(p.valor)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmtData(p.data_vencimento)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {parcelas.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 12 }}>Nenhuma parcela em aberto</div>
              ) : parcelas.map((p, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '100px 160px 120px 36px', gap: 8, alignItems: 'end' }}>
                  <div>
                    {idx === 0 && <label style={LABEL}>Parcela</label>}
                    {readOnly
                      ? <div style={{ fontSize: 13, color: '#332F3A', padding: '8px 0' }}>{p.parcela}</div>
                      : <input style={INPUT} value={p.parcela} onChange={e => updParcela(idx, 'parcela', e.target.value)} placeholder="ex: 1/3" />
                    }
                  </div>
                  <div>
                    {idx === 0 && <label style={LABEL}>Vencimento</label>}
                    {readOnly
                      ? <div style={{ fontSize: 13, color: '#332F3A', padding: '8px 0' }}>{fmtData(p.data_vencimento)}</div>
                      : <input style={INPUT} type="date" value={p.data_vencimento} onChange={e => updParcela(idx, 'data_vencimento', e.target.value)} />
                    }
                  </div>
                  <div>
                    {idx === 0 && <label style={LABEL}>Valor (R$)</label>}
                    {readOnly
                      ? <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#332F3A', padding: '8px 0' }}>{BRL(p.valor)}</div>
                      : <input style={INPUT} type="number" min="0" step="0.01" value={p.valor} onChange={e => updParcela(idx, 'valor', e.target.value)} />
                    }
                  </div>
                  <div style={{ paddingTop: idx === 0 ? 22 : 0 }}>
                    {!readOnly && (
                      <button onClick={() => removeParcela(idx)} style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 6, padding: 7, cursor: 'pointer', color: '#E5584A', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={12} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OBSERVAÇÃO */}
        <div className="card">
          <label style={LABEL}>Observação</label>
          {readOnly
            ? <div style={{ fontSize: 13, color: '#332F3A' }}>{observacao || '—'}</div>
            : <textarea style={{ ...INPUT, minHeight: 72, resize: 'vertical' }} value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Observações internas..." />
          }
        </div>

        {/* RODAPÉ */}
        {!readOnly && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 24 }}>
            <button className="btn btn-ghost" onClick={() => router.back()}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando || sucesso}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {sucesso ? <><Check size={13} strokeWidth={2.5} /> Salvo!</> : salvando ? 'Salvando...' : <><Check size={13} strokeWidth={2.5} /> Salvar Alterações</>}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
