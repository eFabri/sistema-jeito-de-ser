// src/app/produtos/novo/page.tsx
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'

type Aba = 'id' | 'preco' | 'detalhes'

function Campo({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={span > 1 ? { gridColumn: `span ${span}` } : {}}>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

const GRUPOS = ['Moda Feminina', 'Acessórios', 'Calçados', 'Bolsas', 'Lingerie', 'Fitness', 'Outros']
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'EG', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56']

export default function NovoProdutoPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvoId, setSalvoId] = useState<string | null>(null)
  const [abaForm, setAbaForm] = useState<Aba>('id')
  const [novoGrupo, setNovoGrupo] = useState(false)
  const [tamanhoCustom, setTamanhoCustom] = useState(false)
  const [fotos, setFotos] = useState<string[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)

  const [form, setForm] = useState({
    descricao: '', grupo: '', sub_grupo: '', cod_barras: '', cod_referencia: '',
    marca: '', cor: '', tamanho: '', fornecedor: '', localizacao: '',
    estoque: '0', estoque_minimo: '1', preco_custo: '', margem_lucro: '', preco_venda: '',
    permite_desconto: 'true',
    colecao: '',
    composicao: '',
    lavagem: '',
    observacoes: '',
    ativo: 'true',
  })

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.value
    setForm(prev => {
      const next = { ...prev, [k]: val }
      if (k === 'preco_custo' || k === 'margem_lucro') {
        const custo  = parseFloat(k === 'preco_custo'  ? val : prev.preco_custo)  || 0
        const margem = parseFloat(k === 'margem_lucro' ? val : prev.margem_lucro) || 0
        if (custo > 0 && margem > 0) {
          next.preco_venda = (custo * (1 + margem / 100)).toFixed(2)
        }
      }
      return next
    })
  }

  function gerarCodBarras() {
    const cod = String(Math.floor(Math.random() * 9000000000000) + 1000000000000)
    setForm(prev => ({ ...prev, cod_barras: cod }))
  }

  async function uploadFoto(file: File) {
    if (fotos.length >= 3) return
    setUploadingFoto(true)
    try {
      const supabase = createClient()
      const path = `produtos/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('produtos').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('produtos').getPublicUrl(path)
      setFotos(prev => [...prev, data.publicUrl])
    } catch (err: any) {
      setErro('Erro ao enviar foto: ' + (err.message || 'tente novamente'))
    } finally {
      setUploadingFoto(false)
    }
  }

  function removerFoto(idx: number) {
    setFotos(prev => prev.filter((_, i) => i !== idx))
  }

  async function salvar() {
    if (!form.descricao.trim()) { setErro('Descrição do produto é obrigatória'); setAbaForm('id'); return }
    if (!form.preco_venda || parseFloat(form.preco_venda) <= 0) { setErro('Preço de venda é obrigatório'); setAbaForm('preco'); return }
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
        ativo: form.ativo === 'true',
        fotos,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setSalvoId(data.id)
    } else {
      const err = await res.json()
      setErro(err.erro || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  function resetarForm() {
    setForm({
      descricao: '', grupo: '', sub_grupo: '', cod_barras: '', cod_referencia: '',
      marca: '', cor: '', tamanho: '', fornecedor: '', localizacao: '',
      estoque: '0', estoque_minimo: '1', preco_custo: '', margem_lucro: '', preco_venda: '',
      permite_desconto: 'true', colecao: '', composicao: '', lavagem: '', observacoes: '', ativo: 'true',
    })
    setFotos([])
    setSalvoId(null)
    setSalvando(false)
    setAbaForm('id')
  }

  const custo = parseFloat(form.preco_custo) || 0
  const venda = parseFloat(form.preco_venda) || 0
  const lucro = venda - custo
  const margemReal = custo > 0 ? (lucro / custo) * 100 : 0

  const tabStyle = (aba: Aba) => ({
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    borderRadius: 8,
    transition: 'all 0.15s',
    background: abaForm === aba ? 'var(--gold, #C9A84C)' : 'transparent',
    color: abaForm === aba ? '#080608' : 'var(--text-muted, #888)',
  } as React.CSSProperties)

  // Success overlay
  if (salvoId) {
    return (
      <AppLayout>
        <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div className="card" style={{ textAlign: 'center', padding: '48px 40px', maxWidth: 440, borderColor: 'rgba(201,168,76,0.3)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(76,175,130,0.15)', border: '2px solid #4CAF82', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>✓</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 8 }}>Produto salvo!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>O produto foi cadastrado com sucesso no sistema.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={resetarForm}>Cadastrar outro</button>
              <button className="btn btn-primary" onClick={() => router.push(`/produtos/${salvoId}`)}>Ver produto</button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button onClick={() => router.push('/produtos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6, padding: 0 }}>‹ Produtos</button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#F2EBD9', margin: 0 }}>Novo Produto</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push('/produtos')}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Produto'}</button>
          </div>
        </div>

        {/* Error */}
        {erro && (
          <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.25)', borderRadius: 10, padding: '12px 16px', color: '#E5584A', fontSize: 13 }}>{erro}</div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          <button style={tabStyle('id')} onClick={() => setAbaForm('id')}>Identificação</button>
          <button style={tabStyle('preco')} onClick={() => setAbaForm('preco')}>Preço &amp; Estoque</button>
          <button style={tabStyle('detalhes')} onClick={() => setAbaForm('detalhes')}>Detalhes</button>
        </div>

        {/* ABA: IDENTIFICAÇÃO */}
        {abaForm === 'id' && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Identificação do Produto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>

              <Campo label="Descrição / Nome *" span={2}>
                <input className="input" placeholder="Ex: VESTIDO LONGO FLORAL MANGA CURTA" value={form.descricao} onChange={f('descricao')}
                  style={{ borderColor: !form.descricao ? 'rgba(201,168,76,0.3)' : undefined }} />
              </Campo>

              <Campo label="Grupo">
                {novoGrupo ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="input" placeholder="Nome do novo grupo" value={form.grupo} onChange={f('grupo')} style={{ flex: 1 }} />
                    <button onClick={() => setNovoGrupo(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                ) : (
                  <select className="input" value={form.grupo} onChange={e => { if (e.target.value === '__novo__') { setNovoGrupo(true); setForm(p => ({ ...p, grupo: '' })) } else { f('grupo')(e) } }}>
                    <option value="">— Selecionar —</option>
                    {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
                    <option value="__novo__">+ Novo grupo</option>
                  </select>
                )}
              </Campo>

              <Campo label="Sub-Grupo">
                <input className="input" placeholder="Ex: VESTIDO LONGO, CALÇA JEANS..." value={form.sub_grupo} onChange={f('sub_grupo')} />
              </Campo>

              <Campo label="Marca / Fornecedor" span={2}>
                <input className="input" placeholder="Ex: Animale, Renner..." value={form.marca} onChange={f('marca')} />
              </Campo>

              <Campo label="Coleção / Temporada">
                <input className="input" placeholder="Ex: Verão 2025" value={form.colecao} onChange={f('colecao')} />
              </Campo>

              <Campo label="Cor">
                <input className="input" placeholder="Ex: PRETO, AZUL MARINHO..." value={form.cor} onChange={f('cor')} />
              </Campo>

              <Campo label="Tamanho">
                {tamanhoCustom ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="input" placeholder="Digite o tamanho..." value={form.tamanho} onChange={f('tamanho')} style={{ flex: 1 }} />
                    <button onClick={() => { setTamanhoCustom(false); setForm(p => ({ ...p, tamanho: '' })) }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '0 10px', cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                ) : (
                  <select className="input" value={form.tamanho} onChange={e => { if (e.target.value === '__custom__') { setTamanhoCustom(true); setForm(p => ({ ...p, tamanho: '' })) } else { f('tamanho')(e) } }}>
                    <option value="">— Selecionar —</option>
                    {TAMANHOS.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="__custom__">Digitar...</option>
                  </select>
                )}
              </Campo>

              <Campo label="Código de Barras">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" placeholder="EAN-13" value={form.cod_barras} onChange={f('cod_barras')} style={{ flex: 1 }} />
                  <button onClick={gerarCodBarras} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, color: '#C9A84C', padding: '0 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Gerar código</button>
                </div>
              </Campo>

              <Campo label="Código de Referência">
                <input className="input" placeholder="Ex: REF001" value={form.cod_referencia} onChange={f('cod_referencia')} />
              </Campo>

              {/* Fotos */}
              <Campo label="Fotos do Produto (máx. 3)" span={2}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {fotos.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={url} alt={`Foto ${idx + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                      <button onClick={() => removerFoto(idx)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#E5584A', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                  {fotos.length < 3 && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingFoto}
                      style={{ width: 80, height: 80, border: '2px dashed rgba(201,168,76,0.3)', borderRadius: 8, background: 'rgba(201,168,76,0.04)', color: 'var(--text-muted)', cursor: uploadingFoto ? 'wait' : 'pointer', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
                      <span>{uploadingFoto ? '...' : 'Foto'}</span>
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async e => { const file = e.target.files?.[0]; if (file) { await uploadFoto(file) } e.target.value = '' }}
                  />
                </div>
              </Campo>

            </div>
          </div>
        )}

        {/* ABA: PREÇO & ESTOQUE */}
        {abaForm === 'preco' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Precificação</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <Campo label="Preço de Custo (R$)">
                  <input type="number" className="input" placeholder="0,00" step={0.01} min={0} value={form.preco_custo} onChange={f('preco_custo')} />
                </Campo>
                <Campo label="Margem de Lucro (%)">
                  <input type="number" className="input" placeholder="0" step={0.5} min={0} value={form.margem_lucro} onChange={f('margem_lucro')} />
                </Campo>
                <Campo label="Preço de Venda (R$) *">
                  <input type="number" className="input" placeholder="0,00" step={0.01} min={0} value={form.preco_venda} onChange={f('preco_venda')}
                    style={{ borderColor: !form.preco_venda ? 'rgba(201,168,76,0.3)' : undefined }} />
                </Campo>
              </div>
            </div>

            {/* Profit preview */}
            {custo > 0 && venda > 0 && (
              <div className="card" style={{ borderColor: 'rgba(76,175,130,0.25)', background: 'rgba(76,175,130,0.04)', padding: '14px 18px' }}>
                <div style={{ fontSize: 10, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10 }}>Preview de Rentabilidade</div>
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Lucro por peça</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: lucro >= 0 ? '#4CAF82' : '#E5584A' }}>
                      {lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Margem real</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: margemReal >= 0 ? '#4CAF82' : '#E5584A' }}>
                      {margemReal.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Estoque</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <Campo label="Estoque Inicial">
                  <input type="number" className="input" value={form.estoque} min={0} onChange={f('estoque')} />
                </Campo>
                <Campo label="Estoque Mínimo para Alerta">
                  <input type="number" className="input" value={form.estoque_minimo} min={0} onChange={f('estoque_minimo')} />
                </Campo>
                <Campo label="Localização na loja">
                  <input className="input" placeholder="Araras A, Prateleira 2..." value={form.localizacao} onChange={f('localizacao')} />
                </Campo>
                <Campo label="Permite Desconto">
                  <select className="input" value={form.permite_desconto} onChange={f('permite_desconto')}>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </Campo>
              </div>
            </div>
          </div>
        )}

        {/* ABA: DETALHES */}
        {abaForm === 'detalhes' && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Detalhes Adicionais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>

              <Campo label="Composição do Tecido">
                <input className="input" placeholder="Ex: 100% Poliéster" value={form.composicao} onChange={f('composicao')} />
              </Campo>

              <Campo label="Instruções de Lavagem">
                <input className="input" placeholder="Ex: Lavar à mão, não torcer" value={form.lavagem} onChange={f('lavagem')} />
              </Campo>

              <Campo label="Observações Internas" span={2}>
                <textarea
                  className="input"
                  placeholder="Anotações internas sobre o produto..."
                  value={form.observacoes}
                  onChange={f('observacoes')}
                  rows={4}
                  style={{ resize: 'vertical', lineHeight: 1.5 }}
                />
              </Campo>

              <Campo label="Produto Ativo">
                <select className="input" value={form.ativo} onChange={f('ativo')}>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </Campo>

            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {abaForm !== 'id' && (
              <button className="btn btn-ghost" onClick={() => setAbaForm(abaForm === 'detalhes' ? 'preco' : 'id')}>← Anterior</button>
            )}
            {abaForm !== 'detalhes' && (
              <button className="btn btn-ghost" onClick={() => setAbaForm(abaForm === 'id' ? 'preco' : 'detalhes')}>Próximo →</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push('/produtos')}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ padding: '10px 28px' }}>
              {salvando ? 'Salvando...' : '✓ Salvar Produto'}
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
