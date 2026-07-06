// src/app/produtos/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import AutocompleteInput from '@/components/ui/AutocompleteInput'

interface Opcoes {
  grupos: string[]
  subGrupos: Record<string, string[]>
  cores: string[]
  tamanhos: string[]
  marcas: string[]
  localizacoes: string[]
  fornecedores: string[]
}

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function Campo({ label, children, span = 1 }: any) {
  return (
    <div style={span > 1 ? { gridColumn: `span ${span}` } : {}}>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: any) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#F2EBD9' }}>{value}</span>
    </div>
  )
}

// Modal ajuste de estoque
function ModalAjuste({ produto, onClose, onSalvo }: any) {
  const [tipo, setTipo]   = useState<'add' | 'sub' | 'set'>('add')
  const [qtd, setQtd]     = useState(0)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const novoEstoque = tipo === 'set' ? qtd : tipo === 'add' ? produto.estoque + qtd : Math.max(0, produto.estoque - qtd)

  async function salvar() {
    if (qtd <= 0 && tipo !== 'set') return
    setSalvando(true)
    await fetch(`/api/produtos/${produto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estoque: novoEstoque }),
    })
    setSalvando(false)
    onSalvo(novoEstoque)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '28px 32px', width: 400 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#F2EBD9', marginBottom: 6 }}>Ajuste de Estoque</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          {produto.descricao} · Estoque atual: <strong style={{ color: '#F2EBD9' }}>{produto.estoque}</strong>
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[['add', '+ Entrada'], ['sub', '− Saída'], ['set', '= Definir']].map(([id, label]) => (
            <button key={id} onClick={() => setTipo(id as any)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${tipo === id ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
              background: tipo === id ? 'rgba(201,168,76,0.15)' : 'transparent',
              color: tipo === id ? '#C9A84C' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
              {tipo === 'set' ? 'Novo valor do estoque' : 'Quantidade'}
            </label>
            <input type="number" className="input" value={qtd} min={0} onChange={e => setQtd(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Motivo</label>
            <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: inventário, devolução, perda..." />
          </div>

          <div style={{ padding: '12px', background: 'rgba(201,168,76,0.05)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Estoque resultante:</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: novoEstoque <= 0 ? '#E5584A' : '#4CAF82' }}>
              {novoEstoque}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '11px' }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '✓ Confirmar Ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProdutoDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm]       = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [aba, setAba]         = useState<'info' | 'vendas' | 'compras'>('info')
  const [opcoes, setOpcoes]   = useState<Opcoes>({ grupos: [], subGrupos: {}, cores: [], tamanhos: [], marcas: [], localizacoes: [], fornecedores: [] })

  useEffect(() => {
    fetch(`/api/produtos/${params.id}`)
      .then(r => r.json())
      .then(d => { setData(d); setForm(d.produto); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (editando && opcoes.grupos.length === 0) {
      fetch('/api/produtos/opcoes')
        .then(r => r.json())
        .then(d => setOpcoes(d))
        .catch(() => {})
    }
  }, [editando])

  async function salvar() {
    setSalvando(true)
    await fetch(`/api/produtos/${params.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setData((d: any) => ({ ...d, produto: form }))
    setEditando(false)
    setSalvando(false)
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string) => {
    const val = typeof e === 'string' ? e : e.target.value
    setForm((prev: any) => {
      const next = { ...prev, [k]: val }
      if (k === 'preco_custo' || k === 'margem_lucro') {
        const custo  = parseFloat(k === 'preco_custo'  ? val : prev.preco_custo)  || 0
        const margem = parseFloat(k === 'margem_lucro' ? val : prev.margem_lucro) || 0
        if (custo > 0 && margem > 0) next.preco_venda = (custo * (1 + margem / 100)).toFixed(2)
      }
      if (k === 'preco_venda') {
        const custo = parseFloat(prev.preco_custo) || 0
        const venda = parseFloat(val) || 0
        if (custo > 0 && venda > 0) next.margem_lucro = (((venda / custo) - 1) * 100).toFixed(1)
      }
      if (k === 'grupo') next.sub_grupo = ''
      return next
    })
  }

  if (loading) return <AppLayout><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>Carregando...</div></AppLayout>

  const { produto, vendas, compras } = data
  const p = editando ? form : produto
  const estBaixo = produto.estoque <= produto.estoque_minimo

  const totalVendido  = vendas.reduce((s: number, v: any) => s + (v.quantidade || 0), 0)
  const receitaTotal  = vendas.reduce((s: number, v: any) => s + (v.sub_total || 0), 0)
  const margem        = produto.preco_custo > 0 ? ((produto.preco_venda - produto.preco_custo) / produto.preco_custo * 100) : null

  return (
    <AppLayout>
      {modalAjuste && (
        <ModalAjuste produto={produto} onClose={() => setModalAjuste(false)} onSalvo={(novoEst: number) => {
          setData((d: any) => ({ ...d, produto: { ...d.produto, estoque: novoEst } }))
          setForm((f: any) => ({ ...f, estoque: novoEst }))
          setModalAjuste(false)
        }} />
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button onClick={() => router.push('/produtos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>‹ Produtos</button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#F2EBD9', lineHeight: 1.1 }}>{produto.descricao}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {produto.grupo}{produto.sub_grupo ? ` · ${produto.sub_grupo}` : ''}{produto.marca ? ` · ${produto.marca}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setModalAjuste(true)}>Ajustar Estoque</button>
            {editando ? (
              <>
                <button className="btn btn-ghost" onClick={() => { setEditando(false); setForm(produto) }}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setEditando(true)}>Editar</button>
            )}
          </div>
        </div>

        {/* CARDS RESUMO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
          {[
            { label: 'Preço de Venda',  value: BRL(produto.preco_venda),   highlight: true },
            { label: 'Preço de Custo',  value: produto.preco_custo > 0 ? BRL(produto.preco_custo) : '—' },
            { label: 'Margem',          value: margem !== null ? `${margem.toFixed(1)}%` : '—' },
            { label: 'Estoque Atual',   value: `${produto.estoque} un.`, alert: estBaixo },
            { label: 'Total Vendido',   value: `${totalVendido} un.` },
            { label: 'Receita Total',   value: BRL(receitaTotal) },
          ].map(card => (
            <div key={card.label} className="card" style={{ borderColor: card.alert ? 'rgba(232,148,58,0.25)' : undefined }}>
              <div style={{ fontSize: 10, color: card.alert ? '#E8943A' : 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: card.alert ? '#E8943A' : card.highlight ? '#C9A84C' : '#F2EBD9' }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {[['info', 'Dados do Produto'], ['vendas', `Vendas (${vendas.length})`], ['compras', `Compras (${compras.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setAba(id as any)} style={{
              padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              background: aba === id ? 'rgba(201,168,76,0.18)' : 'transparent',
              color: aba === id ? '#C9A84C' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* ABA INFO */}
        {aba === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                Identificação
              </h3>
              {editando ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Campo label="Descrição" span={2}><input className="input" value={form.descricao || ''} onChange={f('descricao')} /></Campo>
                  <Campo label="Cód. Barras"><input className="input" value={form.cod_barras || ''} onChange={f('cod_barras')} /></Campo>
                  <Campo label="Cód. Referência"><input className="input" value={form.cod_referencia || ''} onChange={f('cod_referencia')} /></Campo>
                  <Campo label="Grupo">
                    <AutocompleteInput value={form.grupo || ''} onChange={v => f('grupo')(v)} options={opcoes.grupos} placeholder="Ex: Moda Feminina" />
                  </Campo>
                  <Campo label="Sub-Grupo">
                    <AutocompleteInput value={form.sub_grupo || ''} onChange={v => f('sub_grupo')(v)} options={(opcoes.subGrupos || {})[form.grupo] || []} placeholder="Ex: Vestido Longo" />
                  </Campo>
                  <Campo label="Marca">
                    <AutocompleteInput value={form.marca || ''} onChange={v => f('marca')(v)} options={opcoes.marcas} placeholder="Ex: Animale" />
                  </Campo>
                  <Campo label="Fornecedor">
                    <AutocompleteInput value={form.fornecedor || ''} onChange={v => f('fornecedor')(v)} options={opcoes.fornecedores} placeholder="Ex: Moda Brasil Ltda" />
                  </Campo>
                  <Campo label="Cor">
                    <AutocompleteInput value={form.cor || ''} onChange={v => f('cor')(v)} options={opcoes.cores} placeholder="Ex: PRETO" />
                  </Campo>
                  <Campo label="Tamanho">
                    <AutocompleteInput value={form.tamanho || ''} onChange={v => f('tamanho')(v)} options={opcoes.tamanhos} placeholder="PP, P, M, G..." />
                  </Campo>
                  <Campo label="Localização">
                    <AutocompleteInput value={form.localizacao || ''} onChange={v => f('localizacao')(v)} options={opcoes.localizacoes} placeholder="Araras A, Prateleira 2..." />
                  </Campo>
                </div>
              ) : (
                <>
                  <InfoRow label="Cód. de Barras"    value={p.cod_barras} />
                  <InfoRow label="Cód. Referência"   value={p.cod_referencia} />
                  <InfoRow label="Grupo"             value={p.grupo} />
                  <InfoRow label="Sub-Grupo"         value={p.sub_grupo} />
                  <InfoRow label="Marca"             value={p.marca} />
                  <InfoRow label="Fornecedor"        value={p.fornecedor} />
                  <InfoRow label="Cor"               value={p.cor} />
                  <InfoRow label="Tamanho"           value={p.tamanho} />
                  <InfoRow label="Localização"       value={p.localizacao} />
                  <InfoRow label="Última atualização" value={fmtData(p.atualizado_em)} />
                </>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                Preço & Estoque
              </h3>
              {editando ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Campo label="Preço de Venda (R$)">
                    <input type="number" className="input" step={0.01} value={form.preco_venda || ''} onChange={f('preco_venda')} />
                  </Campo>
                  <Campo label="Preço de Custo (R$)">
                    <input type="number" className="input" step={0.01} value={form.preco_custo || ''} onChange={f('preco_custo')} />
                  </Campo>
                  <Campo label="Margem de Lucro (%)">
                    <input type="number" className="input" step={0.1} value={form.margem_lucro || ''} onChange={f('margem_lucro')} />
                  </Campo>
                  <Campo label="Estoque Mínimo">
                    <input type="number" className="input" value={form.estoque_minimo || ''} onChange={f('estoque_minimo')} />
                  </Campo>
                  <Campo label="Permite Desconto">
                    <select className="input" value={form.permite_desconto ? 'true' : 'false'} onChange={e => setForm((p: any) => ({ ...p, permite_desconto: e.target.value === 'true' }))}>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  </Campo>
                </div>
              ) : (
                <>
                  <InfoRow label="Preço de Venda"  value={BRL(p.preco_venda)} />
                  <InfoRow label="Preço de Custo"  value={p.preco_custo > 0 ? BRL(p.preco_custo) : '—'} />
                  <InfoRow label="Margem de Lucro" value={margem !== null ? `${margem.toFixed(1)}%` : '—'} />
                  <InfoRow label="Estoque Atual"   value={`${p.estoque} unidades`} />
                  <InfoRow label="Estoque Mínimo"  value={`${p.estoque_minimo} unidades`} />
                  <InfoRow label="Permite Desconto" value={p.permite_desconto ? 'Sim' : 'Não'} />
                  <InfoRow label="Medida"          value={p.medida} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ABA VENDAS */}
        {aba === 'vendas' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              {['Cliente', 'Qtd', 'Preço', 'Subtotal'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {vendas.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma venda registrada</div>
            ) : vendas.map((v: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px', padding: '11px 20px', borderBottom: i < vendas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#F2EBD9' }}>{v.vendas?.nome_cliente || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtData(v.vendas?.data)}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v.quantidade}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{BRL(v.preco_venda)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{BRL(v.sub_total)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ABA COMPRAS */}
        {aba === 'compras' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 80px 120px 120px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              {['Data', 'Qtd', 'Vlr. Unit.', 'Subtotal'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {compras.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma compra registrada</div>
            ) : compras.map((c: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 80px 120px 120px', padding: '11px 20px', borderBottom: i < compras.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#F2EBD9' }}>{fmtData(c.compras?.data)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.quantidade}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{BRL(c.valor_unitario)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{BRL(c.sub_total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
