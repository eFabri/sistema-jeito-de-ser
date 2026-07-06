'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AutocompleteInput from '@/components/ui/AutocompleteInput'

const BRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PARTES_OPCOES = ['', 'TOPS', 'INTEIRO', 'BOOTONS', 'CONJUNTO']
const PAGAMENTO_OPCOES = ['Boleto', 'PIX', 'Cartão', 'Duplicata', 'Dinheiro']

interface ItemRow {
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
}

interface Cabecalho {
  fornecedor_id: number | null
  fornecedor_nome: string
  data: string
  nota_numero: string
  grupo: string
  evento: string
  forma_pagamento: string
}

interface Opcoes {
  grupos: string[]
  subgrupos: string[]
  cores: string[]
  tamanhos: string[]
  marcas: string[]
  fornecedores: { id: number; nome: string }[]
}

interface ResultadoCompra {
  id: number
  total_pecas: number
  valor_total: number
  valor_venda_total: number
  ganho_total: number
  produtos_criados: number
  produtos_atualizados: number
  itens: Array<{ produto: string; cod_barras: string; quantidade: number; preco_custo: number; preco_venda: number }>
}

let rowSeq = 1
function novaLinha(): ItemRow {
  return {
    id: `r${rowSeq++}`,
    cod_barras: '', sub_grupo: '', marca: '', produto: '', partes: '',
    tamanho: '', cor: '', quantidade: 1, preco_custo: 0,
    sub_total: 0, ganho_rs: 0, ganho_pct: 0, preco_venda: 0,
  }
}

const getHoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const CAB_INICIAL: Cabecalho = {
  fornecedor_id: null, fornecedor_nome: '', data: getHoje(),
  nota_numero: '', grupo: '', evento: '', forma_pagamento: '',
}

export default function NovaCompraPage() {
  const router = useRouter()
  const [cab, setCab] = useState<Cabecalho>(CAB_INICIAL)
  const [linhas, setLinhas] = useState<ItemRow[]>([novaLinha()])
  const [opcoes, setOpcoes] = useState<Opcoes>({ grupos: [], subgrupos: [], cores: [], tamanhos: [], marcas: [], fornecedores: [] })
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [concluido, setConcluido] = useState<ResultadoCompra | null>(null)

  // Tracks how many barcodes have been generated this session so each new line gets a unique code
  const barcodeOffsetRef = useRef(0)
  // Stable ref to linhas so async handlers can read current state without stale closures
  const linhasRef = useRef(linhas)
  useEffect(() => { linhasRef.current = linhas }, [linhas])

  useEffect(() => {
    fetch('/api/compras/opcoes').then(r => r.json()).then(d => setOpcoes(d)).catch(() => {})
  }, [])

  // Pre-fill barcode for the first row on mount
  useEffect(() => {
    const id = linhas[0]?.id
    if (!id) return
    fetch('/api/compras/proximo-codigo-barras?offset=0')
      .then(r => r.json())
      .then(d => {
        if (d.codigo) {
          barcodeOffsetRef.current = 1
          setLinhas(p => p.map(l => l.id === id ? { ...l, cod_barras: d.codigo } : l))
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gerarCodBarras = useCallback(async (): Promise<string> => {
    const off = barcodeOffsetRef.current
    barcodeOffsetRef.current += 1
    try {
      const res = await fetch(`/api/compras/proximo-codigo-barras?offset=${off}`)
      const d   = await res.json()
      return d.codigo || ''
    } catch { return '' }
  }, [])

  const setCab2 = (k: keyof Cabecalho, v: string | number | null) =>
    setCab(prev => ({ ...prev, [k]: v }))

  const updateLinha = useCallback((id: string, campo: keyof ItemRow, valor: string | number) => {
    setLinhas(prev => prev.map(l => {
      if (l.id !== id) return l
      const next: ItemRow = { ...l, [campo]: valor }

      const custo = campo === 'preco_custo' ? Number(valor) : l.preco_custo
      const qty   = campo === 'quantidade'  ? Number(valor) : l.quantidade
      next.sub_total = qty * custo

      if (campo === 'preco_custo') {
        next.ganho_rs    = custo * (l.ganho_pct / 100)
        next.preco_venda = custo + next.ganho_rs
      } else if (campo === 'ganho_pct') {
        const pct = Number(valor)
        next.ganho_pct   = pct
        next.ganho_rs    = custo * (pct / 100)
        next.preco_venda = custo + next.ganho_rs
      } else if (campo === 'ganho_rs') {
        const rs = Number(valor)
        next.ganho_rs    = rs
        next.ganho_pct   = custo > 0 ? (rs / custo) * 100 : 0
        next.preco_venda = custo + rs
      } else if (campo === 'preco_venda') {
        const venda = Number(valor)
        next.preco_venda = venda
        next.ganho_rs    = venda - custo
        next.ganho_pct   = custo > 0 ? ((venda - custo) / custo) * 100 : 0
      }

      return next
    }))
    setErros(prev => {
      if (!prev[`${id}-${campo}`]) return prev
      const n = { ...prev }; delete n[`${id}-${campo}`]; return n
    })
  }, [])

  const adicionarLinha = useCallback(async () => {
    const nova = novaLinha()
    setLinhas(prev => [...prev, nova])
    setTimeout(() => {
      const el = document.querySelector(`[data-rowid="${nova.id}"] input`) as HTMLInputElement | null
      el?.focus()
    }, 80)
    const bc = await gerarCodBarras()
    if (bc) setLinhas(prev => prev.map(l => l.id === nova.id ? { ...l, cod_barras: bc } : l))
  }, [gerarCodBarras])

  const removerLinha = useCallback((id: string) => {
    setLinhas(prev => prev.filter(l => l.id !== id))
  }, [])

  const duplicarLinha = useCallback(async (id: string) => {
    const novaId = `r${rowSeq++}`
    setLinhas(prev => {
      const idx = prev.findIndex(l => l.id === id)
      if (idx < 0) return prev
      const dup: ItemRow = { ...prev[idx], id: novaId, cod_barras: '', quantidade: 1, cor: '' }
      return [...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)]
    })
    const bc = await gerarCodBarras()
    if (bc) setLinhas(prev => prev.map(l => l.id === novaId ? { ...l, cod_barras: bc } : l))
  }, [gerarCodBarras])

  const handleTabLast = useCallback(async (e: React.KeyboardEvent, rowId: string) => {
    if (e.key !== 'Tab' || e.shiftKey) return
    if (linhasRef.current[linhasRef.current.length - 1]?.id !== rowId) return
    e.preventDefault()
    const nova = novaLinha()
    setLinhas(prev => [...prev, nova])
    setTimeout(() => {
      const el = document.querySelector(`[data-rowid="${nova.id}"] input`) as HTMLInputElement | null
      el?.focus()
    }, 80)
    const bc = await gerarCodBarras()
    if (bc) setLinhas(prev => prev.map(l => l.id === nova.id ? { ...l, cod_barras: bc } : l))
  }, [gerarCodBarras])

  const totalPecas = linhas.reduce((s, l) => s + Number(l.quantidade), 0)
  const totalCusto = linhas.reduce((s, l) => s + l.sub_total, 0)
  const totalVenda = linhas.reduce((s, l) => s + l.preco_venda * Number(l.quantidade), 0)
  const totalGanho = totalVenda - totalCusto

  async function finalizar() {
    const novosErros: Record<string, string> = {}
    if (linhas.length === 0) { setErros({ geral: 'Adicione pelo menos um item.' }); return }
    for (const l of linhas) {
      if (!l.sub_grupo)                        novosErros[`${l.id}-sub_grupo`]    = 'Obrigatório'
      if (!l.produto)                           novosErros[`${l.id}-produto`]      = 'Obrigatório'
      if (!l.preco_custo || l.preco_custo <= 0) novosErros[`${l.id}-preco_custo`] = 'Obrigatório'
      if (!l.preco_venda || l.preco_venda <= 0) novosErros[`${l.id}-preco_venda`] = 'Obrigatório'
      if (Number(l.quantidade) < 1)             novosErros[`${l.id}-quantidade`]  = 'Mín 1'
    }
    if (Object.keys(novosErros).length > 0) { setErros(novosErros); return }

    setSalvando(true)
    setErros({})
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cabecalho: cab, itens: linhas }),
      })
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        setErros({ geral: 'Sessão expirada. Recarregue e faça login novamente.' })
        return
      }
      const data = await res.json()
      if (!res.ok) { setErros({ geral: data.erro || 'Erro ao salvar compra.' }); return }
      setConcluido(data)
    } catch {
      setErros({ geral: 'Erro de conexão. Verifique sua internet.' })
    } finally {
      setSalvando(false)
    }
  }

  function resetar() {
    setCab({ ...CAB_INICIAL, data: getHoje() })
    setLinhas([novaLinha()])
    setErros({})
    setConcluido(null)
  }

  const input: React.CSSProperties = {
    background: '#111', color: '#F2EBD9', border: '1px solid #2a2418',
    borderRadius: 6, padding: '6px 8px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box',
  }
  const errInput = (field: string, rowId: string): React.CSSProperties =>
    erros[`${rowId}-${field}`] ? { ...input, borderColor: '#E5584A' } : input
  const cell: React.CSSProperties = { padding: '3px 3px', verticalAlign: 'top' }
  const th: React.CSSProperties = {
    padding: '8px 6px', color: '#8a7a60', fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, whiteSpace: 'nowrap' as const, textAlign: 'left' as const,
  }

  if (concluido) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px', fontFamily: 'inherit' }}>
        <style>{`@media print { .no-print { display: none !important; } }`}</style>
        <div style={{ background: '#1a1610', border: '1px solid #C9A84C', borderRadius: 12, padding: 28, marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 6, color: '#C9A84C' }}>✓</div>
          <h2 style={{ color: '#C9A84C', margin: '0 0 20px', fontSize: 20 }}>Compra Finalizada!</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {([
              ['Produtos criados',     concluido.produtos_criados],
              ['Produtos atualizados', concluido.produtos_atualizados],
              ['Total de peças',       concluido.total_pecas],
              ['Valor da compra',      `R$ ${BRL(concluido.valor_total)}`],
              ['Valor a venda',        `R$ ${BRL(concluido.valor_venda_total)}`],
              ['Ganho previsto',       `R$ ${BRL(concluido.ganho_total)}`],
            ] as [string, string | number][]).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: '#8a7a60', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 17, color: '#F2EBD9', fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#111', borderRadius: 8, overflow: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1a1610' }}>
                {['Produto','Cód. Barras','Qtd','Custo (R$)','Venda (R$)'].map(h => (
                  <th key={h} style={{ ...th, borderBottom: '1px solid #2a2418' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {concluido.itens.map((it, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1a1610' }}>
                  <td style={{ padding: '6px 6px', color: '#F2EBD9' }}>{it.produto}</td>
                  <td style={{ padding: '6px 6px', color: '#8a7a60', fontFamily: 'monospace', fontSize: 11 }}>{it.cod_barras}</td>
                  <td style={{ padding: '6px 6px', color: '#F2EBD9', textAlign: 'right' }}>{it.quantidade}</td>
                  <td style={{ padding: '6px 6px', color: '#F2EBD9', textAlign: 'right' }}>{BRL(it.preco_custo)}</td>
                  <td style={{ padding: '6px 6px', color: '#C9A84C', textAlign: 'right', fontWeight: 600 }}>{BRL(it.preco_venda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} style={{ padding: '10px 18px', background: '#222', color: '#F2EBD9', border: '1px solid #444', borderRadius: 8, cursor: 'pointer' }}>🖨 Imprimir relatório</button>
          <button onClick={resetar} style={{ padding: '10px 20px', background: '#C9A84C', color: '#111', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>+ Nova Compra</button>
          <button onClick={() => router.push('/produtos')} style={{ padding: '10px 18px', background: '#1a1610', color: '#F2EBD9', border: '1px solid #333', borderRadius: 8, cursor: 'pointer' }}>Ver estoque atualizado</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px', fontFamily: 'inherit' }}>
      <style>{`
        @media print { .no-print { display: none !important; } }
        input:focus { border-color: #C9A84C !important; box-shadow: none; }
        select:focus { border-color: #C9A84C !important; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>

      <div className="no-print" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => router.push('/compras')} style={{ background: 'none', border: 'none', color: '#8a7a60', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, color: '#C9A84C', fontWeight: 700 }}>Nova Compra</h1>
      </div>

      <div className="no-print" style={{ background: '#1a1610', border: '1px solid #2a2418', borderRadius: 10, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          <div>
            <label style={{ display: 'block', color: '#8a7a60', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fornecedor</label>
            <AutocompleteInput
              value={cab.fornecedor_nome}
              onChange={v => {
                const found = opcoes.fornecedores.find(f => f.nome.toLowerCase() === v.toLowerCase())
                setCab2('fornecedor_nome', v)
                setCab2('fornecedor_id', found ? found.id : null)
              }}
              options={opcoes.fornecedores.map(f => f.nome)}
              placeholder="Buscar fornecedor..."
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#8a7a60', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Data</label>
            <input type="date" value={cab.data} onChange={e => setCab2('data', e.target.value)} style={input} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#8a7a60', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nº Nota Fiscal</label>
            <input type="text" value={cab.nota_numero} onChange={e => setCab2('nota_numero', e.target.value)} placeholder="Ex: 001234" style={input} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#8a7a60', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Grupo</label>
            <AutocompleteInput value={cab.grupo} onChange={v => setCab2('grupo', v)} options={opcoes.grupos} placeholder="Ex: Moda Feminina" />
          </div>
          <div>
            <label style={{ display: 'block', color: '#8a7a60', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Evento / Coleção</label>
            <input type="text" value={cab.evento} onChange={e => setCab2('evento', e.target.value)} placeholder="Ex: Inverno 26" style={input} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#8a7a60', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Forma de Pagamento</label>
            <select value={cab.forma_pagamento} onChange={e => setCab2('forma_pagamento', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
              <option value="">Selecionar...</option>
              {PAGAMENTO_OPCOES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {erros.geral && (
        <div className="no-print" style={{ background: '#2a1010', border: '1px solid #E5584A', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#E5584A', fontSize: 13 }}>
          {erros.geral}
        </div>
      )}

      <div style={{ overflowX: 'auto', marginBottom: 14 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1280 }}>
          <thead>
            <tr style={{ background: '#111', borderBottom: '2px solid #2a2418' }}>
              <th style={{ ...th, minWidth: 130 }}>Cód. Barras</th>
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
              <th style={{ ...th, minWidth: 88, textAlign: 'right' }}>Venda *</th>
              <th style={{ ...th, minWidth: 62 }}></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => {
              const rowHasErr = ['sub_grupo','produto','preco_custo','preco_venda','quantidade'].some(f => erros[`${l.id}-${f}`])
              const isLast = idx === linhas.length - 1
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid #1a1610', background: rowHasErr ? 'rgba(229,88,74,0.06)' : 'transparent' }}>
                  <td style={cell}>
                    <input value={l.cod_barras} onChange={e => updateLinha(l.id, 'cod_barras', e.target.value)} placeholder="Automático" style={{ ...input, fontFamily: 'monospace', fontSize: 11 }} />
                  </td>
                  <td style={cell} data-rowid={l.id}>
                    <AutocompleteInput value={l.sub_grupo} onChange={v => updateLinha(l.id, 'sub_grupo', v)} options={opcoes.subgrupos} placeholder="Sub-grupo *" />
                    {erros[`${l.id}-sub_grupo`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>
                  <td style={cell}>
                    <AutocompleteInput value={l.marca} onChange={v => updateLinha(l.id, 'marca', v)} options={opcoes.marcas} placeholder="Marca" />
                  </td>
                  <td style={cell}>
                    <input value={l.produto} onChange={e => updateLinha(l.id, 'produto', e.target.value)} placeholder="Descrição *" style={errInput('produto', l.id)} />
                    {erros[`${l.id}-produto`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>
                  <td style={cell}>
                    <select value={l.partes} onChange={e => updateLinha(l.id, 'partes', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                      {PARTES_OPCOES.map(p => <option key={p} value={p}>{p || '—'}</option>)}
                    </select>
                  </td>
                  <td style={cell}>
                    <AutocompleteInput value={l.tamanho} onChange={v => updateLinha(l.id, 'tamanho', v)} options={opcoes.tamanhos} placeholder="Tam." />
                  </td>
                  <td style={cell}>
                    <AutocompleteInput value={l.cor} onChange={v => updateLinha(l.id, 'cor', v)} options={opcoes.cores} placeholder="Cor" />
                  </td>
                  <td style={cell}>
                    <input type="number" min={1} value={l.quantidade}
                      onChange={e => updateLinha(l.id, 'quantidade', parseInt(e.target.value) || 0)}
                      style={{ ...errInput('quantidade', l.id), textAlign: 'right' }} />
                    {erros[`${l.id}-quantidade`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Mín 1</div>}
                  </td>
                  <td style={cell}>
                    <input type="number" min={0} step={0.01} value={l.preco_custo || ''}
                      onChange={e => updateLinha(l.id, 'preco_custo', parseFloat(e.target.value) || 0)}
                      placeholder="0,00" style={{ ...errInput('preco_custo', l.id), textAlign: 'right' }} />
                    {erros[`${l.id}-preco_custo`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>
                  <td style={cell}>
                    <input value={BRL(l.sub_total)} readOnly style={{ ...input, textAlign: 'right', color: '#8a7a60', cursor: 'default' }} />
                  </td>
                  <td style={cell}>
                    <input type="number" min={0} step={0.01} value={l.ganho_rs || ''}
                      onChange={e => updateLinha(l.id, 'ganho_rs', parseFloat(e.target.value) || 0)}
                      placeholder="0,00" style={{ ...input, textAlign: 'right' }} />
                  </td>
                  <td style={cell}>
                    <input type="number" min={0} step={0.1}
                      value={l.ganho_pct ? parseFloat(l.ganho_pct.toFixed(1)) : ''}
                      onChange={e => updateLinha(l.id, 'ganho_pct', parseFloat(e.target.value) || 0)}
                      placeholder="0,0" style={{ ...input, textAlign: 'right' }} />
                  </td>
                  <td style={cell}>
                    <input type="number" min={0} step={0.01} value={l.preco_venda || ''}
                      onChange={e => updateLinha(l.id, 'preco_venda', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      style={{ ...errInput('preco_venda', l.id), textAlign: 'right', color: '#C9A84C' }}
                      onKeyDown={e => { if (isLast) handleTabLast(e, l.id) }}
                    />
                    {erros[`${l.id}-preco_venda`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <button onClick={() => duplicarLinha(l.id)} title="Duplicar" style={{ background: 'none', border: 'none', color: '#8a7a60', cursor: 'pointer', fontSize: 13, padding: '4px 5px' }}>⧉</button>
                    <button onClick={() => removerLinha(l.id)} title="Remover" style={{ background: 'none', border: 'none', color: '#E5584A', cursor: 'pointer', fontSize: 13, padding: '4px 5px' }}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="no-print" style={{ marginBottom: 20 }}>
        <button onClick={adicionarLinha} style={{ padding: '8px 18px', background: '#1a1610', border: '1px solid #C9A84C', color: '#C9A84C', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          + Adicionar linha
        </button>
      </div>

      <div style={{ background: '#1a1610', border: '1px solid #2a2418', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {([
          ['Total de peças',  String(totalPecas),       false],
          ['Valor da compra', `R$ ${BRL(totalCusto)}`,  false],
          ['Valor a venda',   `R$ ${BRL(totalVenda)}`,  false],
          ['Ganho previsto',  `R$ ${BRL(totalGanho)}`,  true ],
        ] as [string, string, boolean][]).map(([label, val, gold]) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: '#8a7a60', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: gold ? '#C9A84C' : '#F2EBD9' }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={finalizar}
          disabled={salvando}
          style={{ padding: '12px 36px', background: salvando ? '#444' : '#C9A84C', color: '#111', border: 'none', borderRadius: 10, cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 16 }}
        >
          {salvando ? 'Salvando...' : '✓ Finalizar Compra'}
        </button>
      </div>
    </div>
  )
}
