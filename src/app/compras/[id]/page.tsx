// src/app/compras/[id]/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import AutocompleteInput from '@/components/ui/AutocompleteInput'
import { Check, X, Pencil, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const BRL2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PARTES_OPCOES = ['', 'TOPS', 'INTEIRO', 'BOOTONS', 'CONJUNTO']

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

interface GradeRow {
  id: string
  cod_barras: string
  sub_grupo: string
  marca: string
  produto: string
  partes: string
  tamanho: string
  cor: string
  quantidade: number
  preco_custo: number
  sub_total: number
  ganho_rs: number
  ganho_pct: number
  preco_venda: number
  atualiza_estoque: boolean
}

interface OpcoesDados { subgrupos: string[]; cores: string[]; tamanhos: string[]; marcas: string[] }
type LineStatus = { status: 'saved' } | { status: 'error'; erro: string }

let gradeSeq = 1
function novaGradeRow(): GradeRow {
  return {
    id: `g${gradeSeq++}`,
    cod_barras: '', sub_grupo: '', marca: '', produto: '', partes: '',
    tamanho: '', cor: '', quantidade: 1, preco_custo: 0,
    sub_total: 0, ganho_rs: 0, ganho_pct: 0, preco_venda: 0,
    atualiza_estoque: true,
  }
}

export default function EditarCompraPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const compraId = params.id
  const DRAFT_KEY = `compra_${compraId}_itens_rascunho`

  const [compra, setCompra] = useState<any>(null)
  const [itens, setItens] = useState<ItemEdit[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  // Modal de novo item (rápido, um de cada vez)
  const [novoOpen, setNovoOpen] = useState(false)
  const [novoBusca, setNovoBusca] = useState('')
  const [novoSug, setNovoSug] = useState<any[]>([])
  const [novoItem, setNovoItem] = useState({
    cod_produto: null as number | null, produto: '', cod_barras: '',
    quantidade: 1, valor_unitario: 0, preco_venda: 0, atualiza_estoque: true, atualiza_preco: false,
  })

  // Grade de adição em lote — lazy init lê localStorage antes do primeiro render
  // para que gradeBannerVisible seja true desde a render 1 (evita que o auto-save
  // sobrescreva o rascunho antes do usuário decidir)
  const [gradeAberta, setGradeAberta] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const rows: any[] = JSON.parse(raw)
      return rows?.some((l: any) => l.produto || l.sub_grupo || l.preco_custo > 0) ?? false
    } catch { return false }
  })
  const [gradeLinhas, setGradeLinhas] = useState<GradeRow[]>([novaGradeRow()])
  const [opcoes, setOpcoes] = useState<OpcoesDados>({ subgrupos: [], cores: [], tamanhos: [], marcas: [] })
  const [errosGrade, setErrosGrade] = useState<Record<string, string>>({})
  const [lineResults, setLineResults] = useState<Record<string, LineStatus>>({})
  const [salvandoGrade, setSalvandoGrade] = useState(false)
  const [gradeRascunho, setGradeRascunho] = useState<GradeRow[] | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return null
      const rows: GradeRow[] = JSON.parse(raw)
      const temDados = rows?.some((l: any) => l.produto || l.sub_grupo || l.preco_custo > 0)
      return temDados ? rows : null
    } catch { return null }
  })
  const [gradeBannerVisible, setGradeBannerVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const rows: any[] = JSON.parse(raw)
      return rows?.some((l: any) => l.produto || l.sub_grupo || l.preco_custo > 0) ?? false
    } catch { return false }
  })

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

  useEffect(() => {
    fetch('/api/compras/opcoes').then(r => r.json()).then(d => setOpcoes({
      subgrupos: d.subgrupos || [],
      cores: d.cores || [],
      tamanhos: d.tamanhos || [],
      marcas: d.marcas || [],
    })).catch(() => {})
  }, [])

  // Auto-save da grade (pula enquanto banner visível para não sobrescrever rascunho)
  useEffect(() => {
    if (gradeBannerVisible) return
    const temDados = gradeLinhas.some(l => l.produto || l.sub_grupo || l.preco_custo > 0)
    if (!temDados) return
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(gradeLinhas)) } catch {}
  }, [gradeLinhas, gradeBannerVisible, DRAFT_KEY])

  // Busca pro modal rápido
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
          data: compra.data, nota_numero: compra.nota_numero || null,
          cod_fornecedor: compra.cod_fornecedor || null,
          grupo: compra.grupo, evento: compra.evento, documento: compra.documento,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Erro')
      setMsg({ tipo: 'ok', texto: 'Dados da compra salvos' })
      await carregar()
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message })
    } finally { setSalvando(false) }
  }

  async function salvarItem(item: ItemEdit) {
    setMsg(null)
    try {
      const r = await fetch(`/api/compras/itens/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produto: item.produto, cod_barras: item.cod_barras,
          quantidade: item.quantidade, valor_unitario: item.valor_unitario,
          preco_venda: item.preco_venda, atualiza_estoque: item.atualiza_estoque,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erro || 'Erro')
      setMsg({ tipo: 'ok', texto: `Item "${item.produto}" atualizado` })
      await carregar()
    } catch (e: any) { setMsg({ tipo: 'erro', texto: e.message }) }
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
    } catch (e: any) { setMsg({ tipo: 'erro', texto: e.message }) }
  }

  async function adicionarItem() {
    if (!novoItem.produto.trim() || novoItem.quantidade < 1) {
      setMsg({ tipo: 'erro', texto: 'Produto e quantidade são obrigatórios' }); return
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
    } catch (e: any) { setMsg({ tipo: 'erro', texto: e.message }) }
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
    setNovoBusca(''); setNovoSug([])
  }

  // ── Grade de adição ──────────────────────────────────────────────────────
  const updateGradeLinha = useCallback((id: string, campo: keyof GradeRow, valor: string | number | boolean) => {
    setGradeLinhas(prev => prev.map(l => {
      if (l.id !== id) return l
      const next: GradeRow = { ...l, [campo]: valor }
      const custo = campo === 'preco_custo' ? Number(valor) : l.preco_custo
      const qty   = campo === 'quantidade'  ? Number(valor) : l.quantidade
      next.sub_total = qty * custo
      if (campo === 'preco_custo') {
        next.ganho_rs    = custo * (l.ganho_pct / 100)
        next.preco_venda = custo + next.ganho_rs
      } else if (campo === 'ganho_pct') {
        const pct = Number(valor)
        next.ganho_pct = pct; next.ganho_rs = custo * (pct / 100); next.preco_venda = custo + next.ganho_rs
      } else if (campo === 'ganho_rs') {
        const rs = Number(valor)
        next.ganho_rs = rs; next.ganho_pct = custo > 0 ? (rs / custo) * 100 : 0; next.preco_venda = custo + rs
      } else if (campo === 'preco_venda') {
        const venda = Number(valor)
        next.preco_venda = venda; next.ganho_rs = venda - custo
        next.ganho_pct = custo > 0 ? ((venda - custo) / custo) * 100 : 0
      }
      return next
    }))
    setErrosGrade(prev => {
      const k = `${id}-${String(campo)}`
      if (!prev[k]) return prev
      const n = { ...prev }; delete n[k]; return n
    })
    // Se a linha tinha erro de rede, limpa ao editar para que seja tentada novamente
    setLineResults(prev => {
      if (!prev[id] || prev[id].status === 'saved') return prev
      const n = { ...prev }; delete n[id]; return n
    })
  }, [])

  function adicionarGradeRow() { setGradeLinhas(prev => [...prev, novaGradeRow()]) }

  function removerGradeRow(id: string) {
    setGradeLinhas(prev => prev.length <= 1 ? [novaGradeRow()] : prev.filter(l => l.id !== id))
    setLineResults(prev => { const n = { ...prev }; delete n[id]; return n })
    setErrosGrade(prev => {
      const n = { ...prev }
      Object.keys(n).filter(k => k.startsWith(`${id}-`)).forEach(k => delete n[k])
      return n
    })
  }

  function duplicarGradeRow(id: string) {
    const novoId = `g${gradeSeq++}`
    setGradeLinhas(prev => {
      const idx = prev.findIndex(l => l.id === id)
      if (idx < 0) return prev
      const dup: GradeRow = { ...prev[idx], id: novoId, cod_barras: '', cor: '', quantidade: 1 }
      return [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)]
    })
  }

  function retormarRascunhoGrade() {
    if (!gradeRascunho) return
    const maxNum = gradeRascunho.reduce((m, l) => Math.max(m, parseInt(l.id.replace('g', '')) || 0), 0)
    gradeSeq = maxNum + 1
    setGradeLinhas(gradeRascunho)
    setGradeBannerVisible(false)
  }

  function descartarRascunhoGrade() {
    localStorage.removeItem(DRAFT_KEY)
    setGradeBannerVisible(false)
    setGradeRascunho(null)
  }

  async function salvarGradeLinhas() {
    // Só processa linhas pendentes ou com erro (não as já salvas)
    const linhasParaSalvar = gradeLinhas.filter(l => lineResults[l.id]?.status !== 'saved')
    if (linhasParaSalvar.length === 0) return

    const novosErros: Record<string, string> = {}
    for (const l of linhasParaSalvar) {
      if (!l.sub_grupo)                        novosErros[`${l.id}-sub_grupo`]    = 'Obrigatório'
      if (!l.produto)                           novosErros[`${l.id}-produto`]      = 'Obrigatório'
      if (!l.preco_custo || l.preco_custo <= 0) novosErros[`${l.id}-preco_custo`] = 'Obrigatório'
      if (Number(l.quantidade) < 1)             novosErros[`${l.id}-quantidade`]  = 'Mín 1'
    }
    if (Object.keys(novosErros).length > 0) { setErrosGrade(novosErros); return }

    setSalvandoGrade(true)
    setErrosGrade({})
    const totalLinhas = gradeLinhas.length
    const novosResultados: Record<string, LineStatus> = { ...lineResults }

    for (const linha of linhasParaSalvar) {
      try {
        const r = await fetch(`/api/compras/${compraId}/itens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cod_produto: null,
            produto: linha.produto,
            cod_barras: linha.cod_barras || null,
            quantidade: linha.quantidade,
            valor_unitario: linha.preco_custo,
            preco_venda: linha.preco_venda || null,
            atualiza_estoque: linha.atualiza_estoque,
            atualiza_preco: false,
            sub_grupo: linha.sub_grupo || null,
            partes: linha.partes || null,
            tamanho: linha.tamanho || null,
            cor: linha.cor || null,
            marca: linha.marca || null,
          }),
        })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          novosResultados[linha.id] = { status: 'error', erro: (d as any).erro || 'Erro ao salvar' }
        } else {
          novosResultados[linha.id] = { status: 'saved' }
        }
      } catch {
        novosResultados[linha.id] = { status: 'error', erro: 'Erro de conexão' }
      }
    }

    setLineResults(novosResultados)

    const savedIds = new Set(
      Object.entries(novosResultados).filter(([, v]) => v.status === 'saved').map(([k]) => k)
    )
    const todasSalvas = gradeLinhas.every(l => novosResultados[l.id]?.status === 'saved')
    const nSalvas = savedIds.size
    const nFalhas = totalLinhas - nSalvas

    await carregar()

    if (todasSalvas) {
      localStorage.removeItem(DRAFT_KEY)
      setGradeLinhas([novaGradeRow()])
      setLineResults({})
      setGradeAberta(false)
      setMsg({ tipo: 'ok', texto: `${totalLinhas} linha(s) adicionada(s) com sucesso` })
    } else {
      // Remove linhas salvas da grade (já aparecem na lista principal)
      setGradeLinhas(prev => prev.filter(l => !savedIds.has(l.id)))
      setLineResults(prev => {
        const n = { ...prev }; savedIds.forEach(id => delete n[id]); return n
      })
      const msgTexto = nSalvas > 0
        ? `${nSalvas} salva(s). ${nFalhas} falha(s) — corrija os erros e tente novamente.`
        : `${nFalhas} falha(s) ao salvar — verifique a conexão e tente novamente.`
      setMsg({ tipo: 'erro', texto: msgTexto })
    }

    setSalvandoGrade(false)
  }

  if (loading) return <AppLayout><div style={{ padding: 32, color: 'var(--text-muted)' }}>Carregando...</div></AppLayout>
  if (!compra)  return <AppLayout><div style={{ padding: 32, color: '#E5584A' }}>Compra não encontrada</div></AppLayout>

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)

  const totalGradePecas = gradeLinhas.reduce((s, l) => s + Number(l.quantidade), 0)
  const totalGradeCusto = gradeLinhas.reduce((s, l) => s + l.sub_total, 0)
  const totalGradeVenda = gradeLinhas.reduce((s, l) => s + l.preco_venda * Number(l.quantidade), 0)

  const input: React.CSSProperties = {
    background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 8px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box',
  }
  const errGradeInput = (field: string, rowId: string): React.CSSProperties =>
    errosGrade[`${rowId}-${field}`] ? { ...input, borderColor: '#E5584A' } : input
  const cell: React.CSSProperties = { padding: '3px 3px', verticalAlign: 'top' }
  const th: React.CSSProperties = {
    padding: '8px 6px', color: '#8a7a60', fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, whiteSpace: 'nowrap' as const, textAlign: 'left' as const,
  }

  const temErrosGrade = Object.keys(errosGrade).length > 0
  const temFalhas = gradeLinhas.some(l => lineResults[l.id]?.status === 'error')

  return (
    <AppLayout>
      {/* Modal: adicionar item rápido */}
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

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200 }}>

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

        {/* DADOS DA COMPRA */}
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
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div><Label>Nº Nota</Label><input className="input" inputMode="numeric" value={compra.nota_numero || ''} onChange={e => alterarCampoCompra('nota_numero', e.target.value ? parseInt(e.target.value.replace(/\D/g, '')) : null)} /></div>
            <div><Label>Grupo / Evento</Label><input className="input" value={compra.grupo || ''} onChange={e => alterarCampoCompra('grupo', e.target.value)} placeholder="Verão 2026, Reposição..." /></div>
          </div>
        </div>

        {/* ITENS EXISTENTES */}
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
            padding: '10px 20px', background: 'rgba(201,168,76,0.03)', borderBottom: '1px solid var(--border)',
          }}>
            {['Produto', 'Qtd', 'Custo Unit.', 'Subtotal', 'Atualiza estoque', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {itens.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Compra sem itens.
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'rgba(201,168,76,0.02)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total da Compra:</span>
            <span style={{ fontSize: 18, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{BRL(total)}</span>
          </div>
        </div>

        {/* GRADE DE ADIÇÃO EM LOTE */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header colapsável */}
          <div
            style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: gradeAberta ? '1px solid var(--border)' : 'none', userSelect: 'none' }}
            onClick={() => setGradeAberta(v => !v)}
          >
            <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>
              + Adicionar em grade
            </h2>
            {gradeAberta ? <ChevronUp size={16} color="var(--gold-dim)" /> : <ChevronDown size={16} color="var(--gold-dim)" />}
          </div>

          {gradeAberta && (
            <div style={{ padding: 20 }}>

              {/* Banner de rascunho */}
              {gradeBannerVisible && gradeRascunho && (() => {
                const rascPecas = gradeRascunho.reduce((s, l) => s + Number(l.quantidade), 0)
                const rascCusto = gradeRascunho.reduce((s, l) => s + Number(l.sub_total), 0)
                return (
                  <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 700, marginBottom: 3 }}>Rascunho da grade encontrado</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {gradeRascunho.length} linha(s) · {rascPecas} peças · R$ {BRL2(rascCusto)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={descartarRascunhoGrade} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(138,122,96,0.4)', borderRadius: 8, cursor: 'pointer', color: '#8a7a60', fontSize: 13 }}>Descartar</button>
                      <button onClick={retormarRascunhoGrade} style={{ padding: '8px 20px', background: '#C9A84C', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#111', fontSize: 13, fontWeight: 700 }}>Retomar</button>
                    </div>
                  </div>
                )
              })()}

              {/* Aviso de erros */}
              {(temErrosGrade || temFalhas) && (
                <div style={{ background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#E5584A', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} />
                  {temErrosGrade
                    ? 'Corrija os campos marcados em vermelho antes de salvar.'
                    : 'Algumas linhas falharam — edite e tente novamente, ou passe o mouse no ícone para ver o erro.'}
                </div>
              )}

              {/* Tabela */}
              <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1340 }}>
                  <thead>
                    <tr style={{ background: 'rgba(201,168,76,0.04)', borderBottom: '2px solid rgba(201,168,76,0.15)' }}>
                      <th style={{ ...th, minWidth: 120 }}>Cód. Barras</th>
                      <th style={{ ...th, minWidth: 148 }}>Sub-Grupo *</th>
                      <th style={{ ...th, minWidth: 130 }}>Marca</th>
                      <th style={{ ...th, minWidth: 180 }}>Produto *</th>
                      <th style={{ ...th, minWidth: 105 }}>Partes</th>
                      <th style={{ ...th, minWidth: 85 }}>Tamanho</th>
                      <th style={{ ...th, minWidth: 118 }}>Cor</th>
                      <th style={{ ...th, minWidth: 65, textAlign: 'right' }}>Qtd *</th>
                      <th style={{ ...th, minWidth: 88, textAlign: 'right' }}>Custo *</th>
                      <th style={{ ...th, minWidth: 90, textAlign: 'right' }}>Sub-Total</th>
                      <th style={{ ...th, minWidth: 88, textAlign: 'right' }}>Ganho R$</th>
                      <th style={{ ...th, minWidth: 78, textAlign: 'right' }}>Ganho %</th>
                      <th style={{ ...th, minWidth: 88, textAlign: 'right' }}>Venda</th>
                      <th style={{ ...th, minWidth: 42, textAlign: 'center' }}>Est.</th>
                      <th style={{ ...th, minWidth: 62 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeLinhas.map(l => {
                      const rowHasErr = ['sub_grupo', 'produto', 'preco_custo', 'quantidade'].some(f => errosGrade[`${l.id}-${f}`])
                      const result = lineResults[l.id]
                      const rowFalhou = result?.status === 'error'
                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid rgba(201,168,76,0.06)', background: rowHasErr || rowFalhou ? 'rgba(229,88,74,0.06)' : 'transparent' }}>
                          <td style={cell}>
                            <input value={l.cod_barras} onChange={e => updateGradeLinha(l.id, 'cod_barras', e.target.value)} placeholder="Opcional" style={{ ...input, fontFamily: 'monospace', fontSize: 11 }} />
                          </td>
                          <td style={cell} data-rowid={l.id}>
                            <AutocompleteInput value={l.sub_grupo} onChange={v => updateGradeLinha(l.id, 'sub_grupo', v)} options={opcoes.subgrupos} placeholder="Sub-grupo *" />
                            {errosGrade[`${l.id}-sub_grupo`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                          </td>
                          <td style={cell}>
                            <AutocompleteInput value={l.marca} onChange={v => updateGradeLinha(l.id, 'marca', v)} options={opcoes.marcas} placeholder="Marca" />
                          </td>
                          <td style={cell}>
                            <input value={l.produto} onChange={e => updateGradeLinha(l.id, 'produto', e.target.value)} placeholder="Descrição *" style={errGradeInput('produto', l.id)} />
                            {errosGrade[`${l.id}-produto`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                          </td>
                          <td style={cell}>
                            <select value={l.partes} onChange={e => updateGradeLinha(l.id, 'partes', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                              {PARTES_OPCOES.map(p => <option key={p} value={p}>{p || '—'}</option>)}
                            </select>
                          </td>
                          <td style={cell}>
                            <AutocompleteInput value={l.tamanho} onChange={v => updateGradeLinha(l.id, 'tamanho', v)} options={opcoes.tamanhos} placeholder="Tam." />
                          </td>
                          <td style={cell}>
                            <AutocompleteInput value={l.cor} onChange={v => updateGradeLinha(l.id, 'cor', v)} options={opcoes.cores} placeholder="Cor" />
                          </td>
                          <td style={cell}>
                            <input type="number" min={1} value={l.quantidade}
                              onChange={e => updateGradeLinha(l.id, 'quantidade', parseInt(e.target.value) || 0)}
                              style={{ ...errGradeInput('quantidade', l.id), textAlign: 'right' }} />
                            {errosGrade[`${l.id}-quantidade`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Mín 1</div>}
                          </td>
                          <td style={cell}>
                            <input type="number" min={0} step={0.01} value={l.preco_custo || ''}
                              onChange={e => updateGradeLinha(l.id, 'preco_custo', parseFloat(e.target.value) || 0)}
                              placeholder="0,00" style={{ ...errGradeInput('preco_custo', l.id), textAlign: 'right' }} />
                            {errosGrade[`${l.id}-preco_custo`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                          </td>
                          <td style={cell}>
                            <input value={BRL2(l.sub_total)} readOnly style={{ ...input, textAlign: 'right', color: '#8a7a60', cursor: 'default' }} />
                          </td>
                          <td style={cell}>
                            <input type="number" min={0} step={0.01} value={l.ganho_rs || ''}
                              onChange={e => updateGradeLinha(l.id, 'ganho_rs', parseFloat(e.target.value) || 0)}
                              placeholder="0,00" style={{ ...input, textAlign: 'right' }} />
                          </td>
                          <td style={cell}>
                            <input type="number" min={0} step={0.1}
                              value={l.ganho_pct ? parseFloat(l.ganho_pct.toFixed(1)) : ''}
                              onChange={e => updateGradeLinha(l.id, 'ganho_pct', parseFloat(e.target.value) || 0)}
                              placeholder="0,0" style={{ ...input, textAlign: 'right' }} />
                          </td>
                          <td style={cell}>
                            <input type="number" min={0} step={0.01} value={l.preco_venda || ''}
                              onChange={e => updateGradeLinha(l.id, 'preco_venda', parseFloat(e.target.value) || 0)}
                              placeholder="0,00" style={{ ...input, textAlign: 'right', color: '#C9A84C' }} />
                          </td>
                          <td style={{ ...cell, textAlign: 'center' }}>
                            <input type="checkbox" checked={l.atualiza_estoque}
                              onChange={e => updateGradeLinha(l.id, 'atualiza_estoque', e.target.checked)}
                              style={{ cursor: 'pointer', marginTop: 8 }} />
                          </td>
                          <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                            {rowFalhou ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <span
                                  title={(result as { status: 'error'; erro: string }).erro}
                                  style={{ color: '#E5584A', cursor: 'help', display: 'inline-flex', alignItems: 'center', padding: '4px 3px' }}
                                >
                                  <AlertCircle size={13} strokeWidth={2} />
                                </span>
                                <button onClick={() => removerGradeRow(l.id)} title="Remover" style={{ background: 'none', border: 'none', color: '#E5584A', cursor: 'pointer', padding: '4px 5px', display: 'inline-flex', alignItems: 'center' }}>
                                  <X size={13} strokeWidth={2.5} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => duplicarGradeRow(l.id)} title="Duplicar" style={{ background: 'none', border: 'none', color: '#8a7a60', cursor: 'pointer', fontSize: 13, padding: '4px 5px' }}>⧉</button>
                                <button onClick={() => removerGradeRow(l.id)} title="Remover" style={{ background: 'none', border: 'none', color: '#E5584A', cursor: 'pointer', padding: '4px 5px', display: 'inline-flex', alignItems: 'center' }}>
                                  <X size={13} strokeWidth={2.5} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Adicionar linha */}
              <div style={{ marginBottom: 16 }}>
                <button onClick={adicionarGradeRow} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.85)', border: '1px solid #C9A84C', color: '#C9A84C', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                  + Adicionar linha
                </button>
              </div>

              {/* Resumo */}
              <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {([
                  ['Total de peças', String(totalGradePecas)],
                  ['Custo total',    `R$ ${BRL2(totalGradeCusto)}`],
                  ['Venda total',    `R$ ${BRL2(totalGradeVenda)}`],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: '#8a7a60', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#332F3A' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Botão de salvar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                {temFalhas && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Apenas as linhas com erro serão reenviadas
                  </span>
                )}
                <button
                  onClick={salvarGradeLinhas}
                  disabled={salvandoGrade}
                  style={{ padding: '11px 28px', background: salvandoGrade ? '#444' : '#C9A84C', color: '#111', border: 'none', borderRadius: 10, cursor: salvandoGrade ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}
                >
                  {salvandoGrade ? 'Salvando...' : temFalhas ? 'Tentar novamente' : 'Salvar novas peças'}
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </AppLayout>
  )
}

function LinhaItem({ item, onChange, onSalvar, onDeletar, isLast }: {
  item: ItemEdit; onChange: (i: ItemEdit) => void; onSalvar: () => void; onDeletar: () => void; isLast: boolean
}) {
  const [editando, setEditando] = useState(false)
  function alterar(campo: keyof ItemEdit, valor: any) { onChange({ ...item, [campo]: valor }) }
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
