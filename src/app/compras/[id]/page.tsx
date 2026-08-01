// src/app/compras/[id]/page.tsx — Editor da compra (header + itens individuais)
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Check, X, Pencil, Trash2 } from 'lucide-react'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'

interface ItemEdit {
  id: number
  cod_produto: number | null
  produto: string
  cod_barras: string | null
  quantidade: number
  valor_unitario: number
  sub_total: number
  preco_venda: number | null
  atualiza_estoque: boolean
}

export default function EditarCompraPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const compraId = params.id

  const [compra, setCompra] = useState<any>(null)
  const [itens, setItens] = useState<ItemEdit[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Modal de novo item
  const [novoOpen, setNovoOpen] = useState(false)
  const [novoBusca, setNovoBusca] = useState('')
  const [novoSug, setNovoSug] = useState<any[]>([])
  const [novoItem, setNovoItem] = useState({ cod_produto: null as number | null, produto: '', cod_barras: '', quantidade: 1, valor_unitario: 0, preco_venda: 0, atualiza_estoque: true, atualiza_preco: false })

  const carregar = useCallback(async () => {
    setLoading(true)
    const [c, f] = await Promise.all([
      fetch(`/api/compras/${compraId}`).then(r => r.json()),
      fetch(`/api/fornecedores?limite=500`).then(r => r.json()),
    ])
    if (c.erro) { setMsg({ tipo: 'erro', texto: c.erro }); setLoading(false); return }
    setCompra(c)
    setItens((c.compras_itens || []).map((i: any) => ({
      id: i.id, cod_produto: i.cod_produto, produto: i.produto,
      cod_barras: i.cod_barras, quantidade: Number(i.quantidade),
      valor_unitario: Number(i.valor_unitario), sub_total: Number(i.sub_total),
      preco_venda: i.preco_venda ? Number(i.preco_venda) : null,
      atualiza_estoque: i.atualiza_estoque !== false,
    })))
    setFornecedores(f.fornecedores || [])
    setLoading(false)
  }, [compraId])

  useEffect(() => { carregar() }, [carregar])

  // Busca de produto pro modal "adicionar"
  useEffect(() => {
    if (novoBusca.length < 2) { setNovoSug([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/produtos?q=${encodeURIComponent(novoBusca)}&limite=6`)
      const d = await r.json()
      setNovoSug(d.produtos || [])
    }, 250)
    return () => clearTimeout(t)
  }, [novoBusca])

  function alterarCampoCompra<K extends keyof any>(campo: K, valor: any) {
    setCompra((c: any) => ({ ...c, [campo]: valor }))
  }

  async function salvarCompra() {
    setSalvando(true); setMsg(null)
    try {
      const r = await fetch(`/api/compras/${compraId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: compra.data,
          nota_numero: compra.nota_numero || null,
          cod_fornecedor: compra.cod_fornecedor || null,
          grupo: compra.grupo,
          evento: compra.evento,
          documento: compra.documento,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Erro')
      setMsg({ tipo: 'ok', texto: 'Dados da compra salvos' })
      await carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message })
    } finally {
      setSalvando(false)
    }
  }

  async function salvarItem(item: ItemEdit) {
    setMsg(null)
    try {
      const r = await fetch(`/api/compras/itens/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: item.produto,
          cod_barras: item.cod_barras,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          preco_venda: item.preco_venda,
          atualiza_estoque: item.atualiza_estoque,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Erro')
      setMsg({ tipo: 'ok', texto: `Item "${item.produto}" atualizado` })
      await carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message })
    }
  }

  async function deletarItem(item: ItemEdit) {
    if (!confirm(`Remover item "${item.produto}"? O estoque será revertido se aplicável.`)) return
    setMsg(null)
    try {
      const r = await fetch(`/api/compras/itens/${item.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Erro')
      setMsg({ tipo: 'ok', texto: 'Item removido' })
      await carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message })
    }
  }

  async function adicionarItem() {
    if (!novoItem.produto.trim() || novoItem.quantidade < 1) {
      setMsg({ tipo: 'erro', texto: 'Produto e quantidade são obrigatórios' })
      return
    }
    setMsg(null)
    try {
      const r = await fetch(`/api/compras/${compraId}/itens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoItem),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Erro')
      setMsg({ tipo: 'ok', texto: `Item "${novoItem.produto}" adicionado` })
      setNovoOpen(false)
      setNovoItem({ cod_produto: null, produto: '', cod_barras: '', quantidade: 1, valor_unitario: 0, preco_venda: 0, atualiza_estoque: true, atualiza_preco: false })
      setNovoBusca('')
      await carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message })
    }
  }

  async function excluirCompra() {
    if (!confirm('Excluir esta compra inteira? O estoque será revertido (subtraído).')) return
    const r = await fetch(`/api/compras/${compraId}`, { method: 'DELETE' })
    if (r.ok) router.push('/compras')
    else { const d = await r.json(); alert(d.erro || 'Erro') }
  }

  function selecionarProdutoModal(p: any) {
    setNovoItem(n => ({
      ...n, cod_produto: p.id, produto: p.descricao,
      cod_barras: p.cod_barras || '',
      valor_unitario: n.valor_unitario || Number(p.preco_custo || 0),
      preco_venda: Number(p.preco_venda || 0),
    }))
    setNovoBusca('')
    setNovoSug([])
  }

  if (loading) return <AppLayout><div style={{ padding: 32, color: 'var(--text-muted)' }}>Carregando...</div></AppLayout>
  if (!compra) return <AppLayout><div style={{ padding: 32, color: '#E5584A' }}>Compra não encontrada</div></AppLayout>

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)

  return (
    <AppLayout>
      {/* Modal: adicionar item */}
      {novoOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(30,27,75,0.45)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={e => { if (e.target === e.currentTarget) setNovoOpen(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: 600, padding: 28 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', marginBottom: 18 }}>
              + Adicionar item
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Label>Produto {novoItem.cod_produto && <span style={{ color: '#4CAF82', textTransform: 'none' }}>(vinculado)</span>}</Label>
                <input className="input" value={novoItem.produto || novoBusca}
                  onChange={e => { setNovoBusca(e.target.value); setNovoItem(n => ({ ...n, produto: e.target.value, cod_produto: null })) }}
                  placeholder="Buscar ou digitar..." autoFocus />
                {novoSug.length > 0 && !novoItem.cod_produto && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#080608', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 220, overflowY: 'auto' }}>
                    {novoSug.map(p => (
                      <div key={p.id} onClick={() => selecionarProdutoModal(p)}
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: '#332F3A', borderBottom: '1px solid rgba(201,168,76,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div>{p.descricao}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>estoque: {p.estoque || 0} · venda: {BRL(Number(p.preco_venda || 0))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 140px 140px', gap: 10 }}>
                <div><Label>Qtd</Label><input className="input" type="number" min="1" value={novoItem.quantidade}
                  onChange={e => setNovoItem(n => ({ ...n, quantidade: parseInt(e.target.value) || 1 }))} /></div>
                <div><Label>Custo unit (R$)</Label><input className="input" type="number" step="0.01" value={novoItem.valor_unitario}
                  onChange={e => setNovoItem(n => ({ ...n, valor_unitario: parseFloat(e.target.value) || 0 }))} /></div>
                <div><Label>Preço venda (R$)</Label><input className="input" type="number" step="0.01" value={novoItem.preco_venda}
                  onChange={e => setNovoItem(n => ({ ...n, preco_venda: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#332F3A', cursor: 'pointer' }}>
                <input type="checkbox" checked={novoItem.atualiza_estoque}
                  onChange={e => setNovoItem(n => ({ ...n, atualiza_estoque: e.target.checked }))} />
                Atualizar estoque ao adicionar
              </label>
              <div style={{ fontSize: 13, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Subtotal: {BRL(novoItem.quantidade * novoItem.valor_unitario)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setNovoOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={adicionarItem}>Adicionar</button>
            </div>
          </div>
        </div>
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#332F3A' }}>
              Compra #{compra.codigo_legado || compra.id}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {compra.fornecedores?.nome || 'Sem fornecedor'} · {itens.length} item(ns)
            </p>
          </div>
          <button onClick={excluirCompra} style={{
            background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.3)',
            color: '#E5584A', padding: '10px 18px', borderRadius: 8,
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Excluir Compra
          </button>
        </div>

        {msg && (
          <div style={{
            background: msg.tipo === 'ok' ? 'rgba(76,175,130,0.1)' : 'rgba(229,88,74,0.1)',
            border: `1px solid ${msg.tipo === 'ok' ? 'rgba(76,175,130,0.3)' : 'rgba(229,88,74,0.3)'}`,
            color: msg.tipo === 'ok' ? '#4CAF82' : '#E5584A',
            padding: 12, borderRadius: 8, fontSize: 13,
          }}>
            {msg.texto}
          </div>
        )}

        {/* DADOS DA COMPRA (editáveis) */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              Dados da Compra
            </h2>
            <button className="btn btn-primary" onClick={salvarCompra} disabled={salvando} style={{ padding: '6px 14px', fontSize: 12 }}>
              {salvando ? 'Salvando...' : 'Salvar dados'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 1fr', gap: 14 }}>
            <div><Label>Data</Label><input className="input" type="date" value={compra.data || ''} onChange={e => alterarCampoCompra('data', e.target.value)} /></div>
            <div>
              <Label>Fornecedor</Label>
              <select className="input" value={compra.cod_fornecedor || ''} onChange={e => alterarCampoCompra('cod_fornecedor', e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">— sem fornecedor —</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div><Label>Nº Nota</Label><input className="input" inputMode="numeric" value={compra.nota_numero || ''} onChange={e => alterarCampoCompra('nota_numero', e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) : null)} /></div>
            <div><Label>Grupo / Evento</Label><input className="input" value={compra.grupo || ''} onChange={e => alterarCampoCompra('grupo', e.target.value)} placeholder="Verão 2026, Reposição..." /></div>
          </div>
        </div>

        {/* ITENS (editáveis inline) */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              {itens.length} itens
            </h2>
            <button className="btn btn-primary" onClick={() => setNovoOpen(true)} style={{ padding: '6px 14px', fontSize: 12 }}>
              + Adicionar item
            </button>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 130px 130px 120px 80px',
            padding: '10px 20px', background: 'rgba(201,168,76,0.03)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Produto', 'Qtd', 'Custo Unit.', 'Subtotal', 'Atualiza estoque', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {itens.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Compra sem itens. Clique em "+ Adicionar item".
            </div>
          ) : itens.map((item, idx) => (
            <LinhaItem
              key={item.id} item={item}
              onChange={novo => setItens(its => its.map(i => i.id === novo.id ? novo : i))}
              onSalvar={() => salvarItem(item)}
              onDeletar={() => deletarItem(item)}
              isLast={idx === itens.length - 1}
            />
          ))}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 16,
            padding: '14px 20px', borderTop: '1px solid var(--border)',
            background: 'rgba(201,168,76,0.02)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total da Compra:</span>
            <span style={{ fontSize: 18, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{BRL(total)}</span>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}

function LinhaItem({ item, onChange, onSalvar, onDeletar, isLast }: {
  item: ItemEdit; onChange: (i: ItemEdit) => void; onSalvar: () => void; onDeletar: () => void; isLast: boolean
}) {
  const [editando, setEditando] = useState(false)
  function alterar(campo: keyof ItemEdit, valor: any) {
    onChange({ ...item, [campo]: valor })
  }
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 130px 130px 120px 80px', gap: 8,
      padding: '12px 20px', alignItems: 'center',
      borderBottom: isLast ? 'none' : '1px solid rgba(201,168,76,0.05)',
      background: editando ? 'rgba(201,168,76,0.04)' : 'transparent',
      transition: 'background 0.2s',
    }}>
      {editando ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input className="input" value={item.produto} onChange={e => alterar('produto', e.target.value)} style={{ fontSize: 12 }} placeholder="Produto" />
            <input className="input" value={item.cod_barras || ''} onChange={e => alterar('cod_barras', e.target.value)} style={{ fontSize: 11, fontFamily: 'monospace' }} placeholder="Código" />
          </div>
          <input className="input" type="number" min="1" value={item.quantidade} onChange={e => alterar('quantidade', parseInt(e.target.value) || 1)} style={{ fontSize: 12 }} />
          <input className="input" type="number" step="0.01" value={item.valor_unitario} onChange={e => alterar('valor_unitario', parseFloat(e.target.value) || 0)} style={{ fontSize: 12 }} />
          <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 700 }}>R$ {(item.quantidade * item.valor_unitario).toFixed(2).replace('.', ',')}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#332F3A', cursor: 'pointer' }}>
            <input type="checkbox" checked={item.atualiza_estoque} onChange={e => alterar('atualiza_estoque', e.target.checked)} />
            estoque
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => { onSalvar(); setEditando(false) }}
              style={{ background: 'rgba(76,175,130,0.12)', border: '1px solid rgba(76,175,130,0.3)', color: '#4CAF82', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <Check size={11} strokeWidth={2.5} />
            </button>
            <button onClick={() => setEditando(false)}
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <X size={11} strokeWidth={2.5} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, color: '#332F3A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.produto}</div>
            {item.cod_barras && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>#{item.cod_barras}</div>}
          </div>
          <div style={{ fontSize: 13, color: '#332F3A' }}>{item.quantidade}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>R$ {item.valor_unitario.toFixed(2).replace('.', ',')}</div>
          <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 700 }}>R$ {(item.quantidade * item.valor_unitario).toFixed(2).replace('.', ',')}</div>
          <div style={{ fontSize: 11, color: item.atualiza_estoque ? '#4CAF82' : 'var(--text-muted)' }}>
            {item.atualiza_estoque ? <><Check size={10} strokeWidth={2.5} /> sim</> : '— não'}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setEditando(true)} title="Editar"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid var(--border)', color: '#C9A84C', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <Pencil size={11} strokeWidth={2} />
            </button>
            <button onClick={onDeletar} title="Excluir"
              style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.3)', color: '#E5584A', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
              <Trash2 size={11} strokeWidth={2} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
      {children}
    </label>
  )
}
