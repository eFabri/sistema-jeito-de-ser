// src/app/trocas/nova/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

interface Item {
  id: string
  cod_produto: number | null
  produto: string
  quantidade: number
  valor: number
}

function novoItem(): Item {
  return { id: `tmp-${Date.now()}-${Math.random()}`, cod_produto: null, produto: '', quantidade: 1, valor: 0 }
}

export default function NovaTrocaPage() {
  const router = useRouter()

  // Cliente
  const [cliente, setCliente] = useState<any>(null)
  const [buscaCli, setBuscaCli] = useState('')
  const [sugCli, setSugCli] = useState<any[]>([])
  const [mostrarSugCli, setMostrarSugCli] = useState(false)

  // Venda original (opcional)
  const [vendaOrigId, setVendaOrigId] = useState('')

  const [vendedor, setVendedor] = useState('')
  const [observacao, setObservacao] = useState('')

  // Itens
  const [devolvidos, setDevolvidos] = useState<Item[]>([novoItem()])
  const [novos, setNovos] = useState<Item[]>([novoItem()])

  // Busca produto
  const [buscaProd, setBuscaProd] = useState<{ [k: string]: string }>({})
  const [sugProd, setSugProd] = useState<{ [k: string]: any[] }>({})

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const totalDev = devolvidos.reduce((s, i) => s + i.quantidade * i.valor, 0)
  const totalNov = novos.reduce((s, i) => s + i.quantidade * i.valor, 0)
  const diferenca = totalNov - totalDev

  // Auto-fill vendedor
  useEffect(() => {
    fetch('/api/perfil').then(r => r.json()).then(d => { if (d?.nome) setVendedor(d.nome) }).catch(() => {})
  }, [])

  // Busca cliente
  useEffect(() => {
    if (buscaCli.length < 2) { setSugCli([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(buscaCli)}&limite=6`)
      const d = await res.json()
      setSugCli(d.clientes || [])
      setMostrarSugCli(true)
    }, 250)
    return () => clearTimeout(t)
  }, [buscaCli])

  function selecionarCliente(c: any) {
    setCliente(c); setBuscaCli(''); setSugCli([]); setMostrarSugCli(false)
  }

  // Busca produto (compartilhado entre devolvidos e novos)
  useEffect(() => {
    const timers: any[] = []
    Object.entries(buscaProd).forEach(([k, valor]) => {
      if (valor.length < 2) { setSugProd(s => ({ ...s, [k]: [] })); return }
      const t = setTimeout(async () => {
        const res = await fetch(`/api/produtos?q=${encodeURIComponent(valor)}&limite=6`)
        const d = await res.json()
        setSugProd(s => ({ ...s, [k]: d.produtos || [] }))
      }, 250)
      timers.push(t)
    })
    return () => timers.forEach(clearTimeout)
  }, [buscaProd])

  function chave(tipo: 'dev' | 'nov', itemId: string) {
    return `${tipo}:${itemId}`
  }

  function alterarBuscaProd(tipo: 'dev' | 'nov', itemId: string, valor: string) {
    setBuscaProd(b => ({ ...b, [chave(tipo, itemId)]: valor }))
    const lista = tipo === 'dev' ? devolvidos : novos
    const setLista = tipo === 'dev' ? setDevolvidos : setNovos
    setLista(lista.map(i => i.id === itemId ? { ...i, produto: valor, cod_produto: null } : i))
  }

  function selecionarProduto(tipo: 'dev' | 'nov', itemId: string, prod: any) {
    const lista = tipo === 'dev' ? devolvidos : novos
    const setLista = tipo === 'dev' ? setDevolvidos : setNovos
    setLista(lista.map(i => i.id === itemId
      ? { ...i, cod_produto: prod.id, produto: prod.descricao, valor: i.valor || Number(prod.preco_venda || 0) }
      : i
    ))
    setBuscaProd(b => ({ ...b, [chave(tipo, itemId)]: '' }))
    setSugProd(s => ({ ...s, [chave(tipo, itemId)]: [] }))
  }

  function alterarItem(tipo: 'dev' | 'nov', itemId: string, campo: keyof Item, valor: any) {
    const lista = tipo === 'dev' ? devolvidos : novos
    const setLista = tipo === 'dev' ? setDevolvidos : setNovos
    setLista(lista.map(i => i.id === itemId ? { ...i, [campo]: valor } : i))
  }

  function removerItem(tipo: 'dev' | 'nov', itemId: string) {
    const lista = tipo === 'dev' ? devolvidos : novos
    const setLista = tipo === 'dev' ? setDevolvidos : setNovos
    setLista(lista.filter(i => i.id !== itemId))
  }

  function adicionarItem(tipo: 'dev' | 'nov') {
    const setLista = tipo === 'dev' ? setDevolvidos : setNovos
    setLista(lista => [...lista, novoItem()])
  }

  async function salvar() {
    setErro('')
    if (!cliente && !buscaCli) {
      setErro('Selecione o cliente (ou digite o nome)')
      return
    }
    const devValidos = devolvidos.filter(i => i.produto.trim() && i.quantidade > 0)
    const novValidos = novos.filter(i => i.produto.trim() && i.quantidade > 0)
    if (devValidos.length === 0 && novValidos.length === 0) {
      setErro('Adicione pelo menos um item devolvido ou novo')
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/trocas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_cliente: cliente?.id || null,
          nome_cliente: cliente?.nome || buscaCli,
          cod_venda_orig: vendaOrigId ? parseInt(vendaOrigId) : null,
          vendedor, observacao,
          devolvidos: devValidos, novos: novValidos,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.erro || 'Erro ao salvar')
      router.push('/trocas')
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  function ListaItens({ tipo, lista, cor }: { tipo: 'dev' | 'nov', lista: Item[], cor: string }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map(item => (
          <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px 80px', gap: 10, alignItems: 'end' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 9, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>Produto</label>
                <input className="input" value={item.produto}
                  onChange={e => alterarBuscaProd(tipo, item.id, e.target.value)}
                  placeholder="Buscar ou digitar..."
                />
                {(sugProd[chave(tipo, item.id)]?.length || 0) > 0 && !item.cod_produto && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#0e0c09', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                    {sugProd[chave(tipo, item.id)].map((p: any) => (
                      <div key={p.id} onClick={() => selecionarProduto(tipo, item.id, p)}
                        style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12, color: '#f5ecd7', borderBottom: '1px solid rgba(212,175,95,0.05)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,95,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div>{p.descricao}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>R$ {Number(p.preco_venda || 0).toFixed(2)} · est: {p.estoque || 0}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>Qtd</label>
                <input className="input" type="number" min="1" value={item.quantidade}
                  onChange={e => alterarItem(tipo, item.id, 'quantidade', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>Valor unit. (R$)</label>
                <input className="input" type="number" step="0.01" value={item.valor}
                  onChange={e => alterarItem(tipo, item.id, 'valor', parseFloat(e.target.value) || 0)} />
              </div>
              <button type="button" onClick={() => removerItem(tipo, item.id)}
                style={{ background: 'none', border: '1px solid rgba(239,107,77,0.3)', color: '#ef6b4d', borderRadius: 8, padding: '7px 10px', fontSize: 11, cursor: 'pointer' }}>
                Remover
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, textAlign: 'right', color: cor, fontWeight: 600 }}>
              Subtotal: {BRL(item.quantidade * item.valor)}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => adicionarItem(tipo)} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
          + Adicionar item
        </button>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#f5ecd7' }}>
          Nova Troca
        </h1>

        {erro && (
          <div style={{ background: 'rgba(239,107,77,0.1)', border: '1px solid rgba(239,107,77,0.3)', color: '#ef6b4d', padding: 12, borderRadius: 8, fontSize: 13 }}>
            {erro}
          </div>
        )}

        {/* CABEÇALHO */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>
            Dados da Troca
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 140px 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Cliente</label>
              {cliente ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(212,175,95,0.06)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <span style={{ flex: 1, color: '#f5ecd7', fontSize: 13 }}>{cliente.nome}</span>
                  <button type="button" onClick={() => setCliente(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input className="input" placeholder="Buscar cliente..." value={buscaCli}
                    onChange={e => setBuscaCli(e.target.value)} onFocus={() => setMostrarSugCli(true)} />
                  {mostrarSugCli && sugCli.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#0e0c09', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                      {sugCli.map(c => (
                        <div key={c.id} onClick={() => selecionarCliente(c)}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#f5ecd7' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,95,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {c.nome}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Venda Orig. (opcional)</label>
              <input className="input" inputMode="numeric" value={vendaOrigId} onChange={e => setVendaOrigId(e.target.value.replace(/\D/g, ''))} placeholder="Nº" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Vendedor(a)</label>
              <input className="input" value={vendedor} onChange={e => setVendedor(e.target.value)} />
            </div>
          </div>
        </div>

        {/* DEVOLVIDOS */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 13, color: '#ef6b4d', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
            Itens Devolvidos (saem da loja → estoque)
          </h2>
          <ListaItens tipo="dev" lista={devolvidos} cor="#ef6b4d" />
        </div>

        {/* NOVOS */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 13, color: '#64c88c', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
            Itens Novos (cliente leva → saem do estoque)
          </h2>
          <ListaItens tipo="nov" lista={novos} cor="#64c88c" />
        </div>

        {/* OBSERVAÇÃO */}
        <div className="card" style={{ padding: 24 }}>
          <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Observação</label>
          <textarea className="input" rows={2} value={observacao} onChange={e => setObservacao(e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        {/* RESUMO + SALVAR */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 16, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: '#ef6b4d', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Total Devolvido</div>
              <div style={{ fontSize: 20, color: '#ef6b4d', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{BRL(totalDev)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#64c88c', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Total Novos</div>
              <div style={{ fontSize: 20, color: '#64c88c', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{BRL(totalNov)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                {diferenca > 0 ? 'Cliente paga +' : diferenca < 0 ? 'Crédito p/ cliente' : 'Diferença'}
              </div>
              <div style={{ fontSize: 24, color: diferenca > 0 ? '#d4af5f' : diferenca < 0 ? '#5eaadf' : '#f5ecd7', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {BRL(Math.abs(diferenca))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ padding: '12px 28px' }}>
              {salvando ? 'Salvando...' : 'Salvar Troca'}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            {diferenca > 0 && '➜ Vai criar uma conta a receber automática com a diferença.'}
            {diferenca < 0 && '➜ Vai registrar crédito como conta a pagar ao cliente.'}
            {diferenca === 0 && '➜ Troca neutra, sem movimento financeiro.'}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
