// src/app/compras/nova/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

interface Item {
  id: string                  // temp id interno
  cod_produto: number | null  // id do produto existente OU null pra produto novo
  produto: string             // descrição (pra exibir ou criar)
  cod_barras: string
  quantidade: number
  valor_unitario: number
  preco_venda: number         // sugestão de preço de venda (pode atualizar produto)
  atualiza_estoque: boolean
  atualiza_preco: boolean
}

interface Parcela {
  data_vencimento: string
  valor: number
}

function novoItem(): Item {
  return { id: `tmp-${Date.now()}-${Math.random()}`, cod_produto: null, produto: '', cod_barras: '', quantidade: 1, valor_unitario: 0, preco_venda: 0, atualiza_estoque: true, atualiza_preco: false }
}

export default function NovaCompraPage() {
  const router = useRouter()
  const hoje = new Date().toISOString().split('T')[0]

  const [data, setData] = useState(hoje)
  const [notaNumero, setNotaNumero] = useState('')
  const [grupo, setGrupo] = useState('')
  const [evento, setEvento] = useState('')
  const [documento, setDocumento] = useState('')

  // Fornecedor
  const [forn, setForn] = useState<any>(null)
  const [buscaForn, setBuscaForn] = useState('')
  const [sugestoesForn, setSugestoesForn] = useState<any[]>([])
  const [mostrarSugForn, setMostrarSugForn] = useState(false)

  // Itens
  const [itens, setItens] = useState<Item[]>([novoItem()])

  // Parcelas
  const [gerarParcelas, setGerarParcelas] = useState(false)
  const [qtdParcelas, setQtdParcelas] = useState(1)
  const [diaVencimento, setDiaVencimento] = useState(10)
  const [parcelas, setParcelas] = useState<Parcela[]>([])

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Busca de produto por item (autocomplete)
  const [buscaProd, setBuscaProd] = useState<{ [itemId: string]: string }>({})
  const [sugestoesProd, setSugestoesProd] = useState<{ [itemId: string]: any[] }>({})

  // Total
  const total = itens.reduce((s, i) => s + (i.quantidade * i.valor_unitario), 0)

  // ─── BUSCA FORNECEDOR ────────────────────────────
  useEffect(() => {
    if (buscaForn.length < 2) { setSugestoesForn([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/fornecedores?q=${encodeURIComponent(buscaForn)}&limite=8`)
      const d = await res.json()
      setSugestoesForn(d.fornecedores || [])
      setMostrarSugForn(true)
    }, 250)
    return () => clearTimeout(t)
  }, [buscaForn])

  function selecionarFornecedor(f: any) {
    setForn(f)
    setBuscaForn('')
    setSugestoesForn([])
    setMostrarSugForn(false)
  }

  // ─── BUSCA PRODUTO ───────────────────────────────
  function alterarBuscaProd(itemId: string, valor: string) {
    setBuscaProd(b => ({ ...b, [itemId]: valor }))
    setItens(its => its.map(i => i.id === itemId ? { ...i, produto: valor, cod_produto: null } : i))
  }

  useEffect(() => {
    const timers: any[] = []
    Object.entries(buscaProd).forEach(([itemId, valor]) => {
      if (valor.length < 2) { setSugestoesProd(s => ({ ...s, [itemId]: [] })); return }
      const t = setTimeout(async () => {
        const res = await fetch(`/api/produtos?q=${encodeURIComponent(valor)}&limite=6`)
        const d = await res.json()
        setSugestoesProd(s => ({ ...s, [itemId]: d.produtos || [] }))
      }, 250)
      timers.push(t)
    })
    return () => timers.forEach(clearTimeout)
  }, [buscaProd])

  function selecionarProduto(itemId: string, prod: any) {
    setItens(its => its.map(i => i.id === itemId
      ? { ...i, cod_produto: prod.id, produto: prod.descricao, cod_barras: prod.cod_barras || '', valor_unitario: i.valor_unitario || Number(prod.preco_custo || 0), preco_venda: Number(prod.preco_venda || 0) }
      : i
    ))
    setBuscaProd(b => ({ ...b, [itemId]: '' }))
    setSugestoesProd(s => ({ ...s, [itemId]: [] }))
  }

  function alterarItem<K extends keyof Item>(itemId: string, campo: K, valor: Item[K]) {
    setItens(its => its.map(i => i.id === itemId ? { ...i, [campo]: valor } : i))
  }

  function removerItem(itemId: string) {
    setItens(its => its.filter(i => i.id !== itemId))
  }

  function adicionarItem() {
    setItens(its => [...its, novoItem()])
  }

  // ─── PARCELAS ────────────────────────────────────
  function gerarParcelasAuto() {
    if (qtdParcelas < 1 || total === 0) return
    const valorParc = parseFloat((total / qtdParcelas).toFixed(2))
    const novas: Parcela[] = []
    const base = new Date(data + 'T00:00:00')
    for (let n = 0; n < qtdParcelas; n++) {
      const venc = new Date(base)
      venc.setMonth(venc.getMonth() + n + 1)
      venc.setDate(diaVencimento)
      novas.push({ data_vencimento: venc.toISOString().split('T')[0], valor: valorParc })
    }
    // ajuste de centavos na última
    const soma = novas.reduce((s, p) => s + p.valor, 0)
    const diff = parseFloat((total - soma).toFixed(2))
    if (diff !== 0) novas[novas.length - 1].valor = parseFloat((novas[novas.length - 1].valor + diff).toFixed(2))
    setParcelas(novas)
  }

  useEffect(() => { if (gerarParcelas) gerarParcelasAuto() }, [gerarParcelas, qtdParcelas, diaVencimento, total, data])

  // ─── SALVAR ──────────────────────────────────────
  async function salvar() {
    setErro('')
    if (itens.length === 0 || itens.every(i => !i.produto.trim())) {
      setErro('Adicione pelo menos um item válido')
      return
    }
    const itensValidos = itens.filter(i => i.produto.trim() && i.quantidade > 0)
    if (itensValidos.length === 0) {
      setErro('Itens precisam ter produto e quantidade > 0')
      return
    }

    setSalvando(true)
    try {
      const body: any = {
        data,
        nota_numero: notaNumero ? parseInt(notaNumero) : null,
        cod_fornecedor: forn?.id || null,
        grupo, evento, documento,
        itens: itensValidos,
      }
      if (gerarParcelas && parcelas.length > 0) body.parcelas = parcelas

      const res = await fetch('/api/compras', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.erro || 'Erro ao salvar')
      if (d.aviso) alert(d.aviso)
      router.push('/compras')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#F2EBD9' }}>
          Nova Compra
        </h1>

        {erro && (
          <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.3)', color: '#E5584A', padding: 12, borderRadius: 8, fontSize: 13 }}>
            {erro}
          </div>
        )}

        {/* CABEÇALHO */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>
            Dados da Compra
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 1fr', gap: 14 }}>
            <Campo label="Data">
              <input className="input" type="date" value={data} onChange={e => setData(e.target.value)} />
            </Campo>
            <Campo label="Fornecedor">
              <div style={{ position: 'relative' }}>
                {forn ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(201,168,76,0.06)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <span style={{ flex: 1, color: '#F2EBD9', fontSize: 13 }}>{forn.nome}</span>
                    <button type="button" onClick={() => { setForn(null); setBuscaForn('') }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      className="input"
                      placeholder="Buscar fornecedor por nome..."
                      value={buscaForn}
                      onChange={e => setBuscaForn(e.target.value)}
                      onFocus={() => setMostrarSugForn(true)}
                    />
                    {mostrarSugForn && sugestoesForn.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#080608', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 220, overflowY: 'auto' }}>
                        {sugestoesForn.map(f => (
                          <div key={f.id} onClick={() => selecionarFornecedor(f)}
                            style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: '#F2EBD9', borderBottom: '1px solid rgba(201,168,76,0.05)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div>{f.nome}</div>
                            {f.cidade && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.cidade}/{f.uf}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Campo>
            <Campo label="Nº Nota">
              <input className="input" inputMode="numeric" value={notaNumero} onChange={e => setNotaNumero(e.target.value.replace(/\D/g, ''))} />
            </Campo>
            <Campo label="Grupo / Evento">
              <input className="input" value={grupo} onChange={e => setGrupo(e.target.value)} placeholder="Verão 2026, Reposição..." />
            </Campo>
          </div>
        </div>

        {/* ITENS */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              Itens da Compra
            </h2>
            <button type="button" className="btn btn-ghost" onClick={adicionarItem} style={{ padding: '6px 12px', fontSize: 12 }}>
              + Adicionar item
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {itens.map((item, idx) => (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Item {idx + 1}
                  </span>
                  {itens.length > 1 && (
                    <button type="button" onClick={() => removerItem(item.id)}
                      style={{ background: 'none', border: 'none', color: '#E5584A', cursor: 'pointer', fontSize: 12 }}>
                      Remover
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px 130px', gap: 12 }}>
                  {/* Produto */}
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                      Produto {item.cod_produto && <span style={{ color: '#4CAF82', textTransform: 'none', letterSpacing: 0 }}>(já cadastrado)</span>}
                      {!item.cod_produto && item.produto && <span style={{ color: '#E8943A', textTransform: 'none', letterSpacing: 0 }}>(será criado se digitado um novo)</span>}
                    </label>
                    <input
                      className="input"
                      value={item.produto}
                      onChange={e => alterarBuscaProd(item.id, e.target.value)}
                      placeholder="Descrição do produto"
                    />
                    {(sugestoesProd[item.id]?.length || 0) > 0 && !item.cod_produto && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#080608', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 220, overflowY: 'auto' }}>
                        {sugestoesProd[item.id].map((p: any) => (
                          <div key={p.id} onClick={() => selecionarProduto(item.id, p)}
                            style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: '#F2EBD9', borderBottom: '1px solid rgba(201,168,76,0.05)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <div>{p.descricao}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              estoque: {p.estoque || 0} · custo: {BRL(Number(p.preco_custo || 0))} · venda: {BRL(Number(p.preco_venda || 0))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Campo label="Qtd">
                    <input className="input" type="number" min="1" value={item.quantidade}
                      onChange={e => alterarItem(item.id, 'quantidade', parseInt(e.target.value) || 0)} />
                  </Campo>
                  <Campo label="Custo unit. (R$)">
                    <input className="input" type="number" step="0.01" value={item.valor_unitario}
                      onChange={e => alterarItem(item.id, 'valor_unitario', parseFloat(e.target.value) || 0)} />
                  </Campo>
                  <Campo label="Preço venda (R$)">
                    <input className="input" type="number" step="0.01" value={item.preco_venda}
                      onChange={e => alterarItem(item.id, 'preco_venda', parseFloat(e.target.value) || 0)} />
                  </Campo>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#F2EBD9', cursor: 'pointer' }}>
                      <input type="checkbox" checked={item.atualiza_estoque}
                        onChange={e => alterarItem(item.id, 'atualiza_estoque', e.target.checked)} />
                      Atualizar estoque
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#F2EBD9', cursor: 'pointer', opacity: item.cod_produto ? 1 : 0.4 }}>
                      <input type="checkbox" checked={item.atualiza_preco} disabled={!item.cod_produto}
                        onChange={e => alterarItem(item.id, 'atualiza_preco', e.target.checked)} />
                      Atualizar preço de venda
                    </label>
                  </div>
                  <div style={{ fontSize: 14, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    Subtotal: {BRL(item.quantidade * item.valor_unitario)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PARCELAS */}
        <div className="card" style={{ padding: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#F2EBD9' }}>
            <input type="checkbox" checked={gerarParcelas} onChange={e => setGerarParcelas(e.target.checked)} />
            <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>Gerar parcelas em CONTAS A PAGAR</span>
          </label>
          {gerarParcelas && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr', gap: 14, marginTop: 14 }}>
                <Campo label="Nº Parcelas">
                  <input className="input" type="number" min="1" max="60" value={qtdParcelas} onChange={e => setQtdParcelas(parseInt(e.target.value) || 1)} />
                </Campo>
                <Campo label="Dia Vencimento">
                  <input className="input" type="number" min="1" max="31" value={diaVencimento} onChange={e => setDiaVencimento(parseInt(e.target.value) || 10)} />
                </Campo>
                <Campo label="Documento (texto p/ identificar)">
                  <input className="input" value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Ex: NF 1234 · Fornecedor X" />
                </Campo>
              </div>
              {parcelas.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {parcelas.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>Parcela {idx + 1}/{parcelas.length} — vence {new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span style={{ color: '#C9A84C' }}>{BRL(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* TOTAL + SALVAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Total da Compra</div>
            <div style={{ fontSize: 28, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              {BRL(total)}
            </div>
          </div>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ padding: '12px 28px' }}>
            {salvando ? 'Salvando...' : 'Salvar Compra'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
