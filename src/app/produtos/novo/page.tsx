// src/app/produtos/novo/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

function Campo({ label, children, span = 1 }: any) {
  return (
    <div style={span > 1 ? { gridColumn: `span ${span}` } : {}}>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children, cols = 2 }: any) {
  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#f5ecd7', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>{children}</div>
    </div>
  )
}

export default function NovoProdutoPage() {
  const router  = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [form, setForm] = useState({
    descricao: '', grupo: '', sub_grupo: '', partes: '', medida: '',
    cod_barras: '', cod_referencia: '', marca: '', cor: '', tamanho: '', fornecedor: '',
    localizacao: '', aplicacao: '',
    estoque: '0', estoque_minimo: '1',
    preco_custo: '', margem_lucro: '', preco_venda: '',
    permite_desconto: 'true',
  })

  const f = (k: string) => (e: any) => {
    const val = e.target.value
    setForm(prev => {
      const next = { ...prev, [k]: val }
      // Auto-calcular preço de venda ao mudar custo ou margem
      if (k === 'preco_custo' || k === 'margem_lucro') {
        const custo  = parseFloat(k === 'preco_custo' ? val : prev.preco_custo) || 0
        const margem = parseFloat(k === 'margem_lucro' ? val : prev.margem_lucro) || 0
        if (custo > 0 && margem > 0) {
          next.preco_venda = (custo * (1 + margem / 100)).toFixed(2)
        }
      }
      return next
    })
  }

  async function salvar() {
    if (!form.descricao.trim()) { setErro('Descrição do produto é obrigatória'); return }
    if (!form.preco_venda || parseFloat(form.preco_venda) <= 0) { setErro('Preço de venda é obrigatório'); return }
    setSalvando(true); setErro('')
    const res = await fetch('/api/produtos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        estoque: parseFloat(form.estoque) || 0,
        estoque_minimo: parseInt(form.estoque_minimo) || 1,
        preco_custo: parseFloat(form.preco_custo) || 0,
        margem_lucro: parseFloat(form.margem_lucro) || 0,
        preco_venda: parseFloat(form.preco_venda) || 0,
        permite_desconto: form.permite_desconto === 'true',
        ativo: true,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/produtos/${data.id}`)
    } else {
      const err = await res.json()
      setErro(err.erro || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button onClick={() => router.push('/produtos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>‹ Produtos</button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#f5ecd7' }}>Novo Produto</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push('/produtos')}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Produto'}</button>
          </div>
        </div>

        {erro && (
          <div style={{ background: 'rgba(239,107,77,0.1)', border: '1px solid rgba(239,107,77,0.25)', borderRadius: 10, padding: '12px 16px', color: '#ef6b4d', fontSize: 13 }}>{erro}</div>
        )}

        <Section title="Identificação" cols={2}>
          <Campo label="Descrição / Nome *" span={2}>
            <input className="input" placeholder="Ex: VESTIDO LONGO FLORAL MANGA CURTA" value={form.descricao} onChange={f('descricao')}
              style={{ borderColor: !form.descricao ? 'rgba(212,175,95,0.3)' : undefined }} />
          </Campo>
          <Campo label="Grupo">
            <select className="input" value={form.grupo} onChange={f('grupo')}>
              <option value="">— Selecionar —</option>
              {['Moda Feminina', 'Acessórios', 'Calçados', 'Bolsas', 'Lingerie', 'Outros'].map(g => <option key={g}>{g}</option>)}
            </select>
          </Campo>
          <Campo label="Sub-Grupo"><input className="input" placeholder="Ex: VESTIDO LONGO, CALÇA JEANS..." value={form.sub_grupo} onChange={f('sub_grupo')} /></Campo>
          <Campo label="Código de Barras"><input className="input" value={form.cod_barras} onChange={f('cod_barras')} /></Campo>
          <Campo label="Código de Referência"><input className="input" value={form.cod_referencia} onChange={f('cod_referencia')} /></Campo>
          <Campo label="Marca / Fornecedor"><input className="input" value={form.marca} onChange={f('marca')} /></Campo>
          <Campo label="Fornecedor"><input className="input" value={form.fornecedor} onChange={f('fornecedor')} /></Campo>
          <Campo label="Cor"><input className="input" placeholder="Ex: PRETO, AZUL MARINHO..." value={form.cor} onChange={f('cor')} /></Campo>
          <Campo label="Tamanho"><input className="input" placeholder="Ex: P, M, G, 38, 40..." value={form.tamanho} onChange={f('tamanho')} /></Campo>
          <Campo label="Localização no estoque"><input className="input" placeholder="Ex: Piso 1, Araras A..." value={form.localizacao} onChange={f('localizacao')} /></Campo>
          <Campo label="Medida"><input className="input" placeholder="Ex: Unidade, Par..." value={form.medida} onChange={f('medida')} /></Campo>
        </Section>

        <Section title="Preço & Estoque" cols={3}>
          <Campo label="Preço de Custo (R$)">
            <input type="number" className="input" placeholder="0,00" step={0.01} min={0} value={form.preco_custo} onChange={f('preco_custo')} />
          </Campo>
          <Campo label="Margem de Lucro (%)">
            <input type="number" className="input" placeholder="0" step={0.5} min={0} value={form.margem_lucro} onChange={f('margem_lucro')} />
          </Campo>
          <Campo label="Preço de Venda (R$) *">
            <input type="number" className="input" placeholder="0,00" step={0.01} min={0} value={form.preco_venda} onChange={f('preco_venda')}
              style={{ borderColor: !form.preco_venda ? 'rgba(212,175,95,0.3)' : undefined }} />
          </Campo>
          <Campo label="Estoque Inicial">
            <input type="number" className="input" value={form.estoque} min={0} onChange={f('estoque')} />
          </Campo>
          <Campo label="Estoque Mínimo">
            <input type="number" className="input" value={form.estoque_minimo} min={0} onChange={f('estoque_minimo')} />
          </Campo>
          <Campo label="Permite Desconto">
            <select className="input" value={form.permite_desconto} onChange={f('permite_desconto')}>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </Campo>
        </Section>

        {/* Preview da margem */}
        {parseFloat(form.preco_custo) > 0 && parseFloat(form.preco_venda) > 0 && (
          <div className="card" style={{ borderColor: 'rgba(212,175,95,0.2)', padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Lucro unitário</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#64c88c', marginTop: 4 }}>
                  {(parseFloat(form.preco_venda) - parseFloat(form.preco_custo)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Margem real</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#64c88c', marginTop: 4 }}>
                  {((parseFloat(form.preco_venda) - parseFloat(form.preco_custo)) / parseFloat(form.preco_custo) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 32 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/produtos')}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ padding: '10px 28px' }}>
            {salvando ? 'Salvando...' : '✓ Salvar Produto'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
