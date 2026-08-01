// src/app/produtos/novo/page.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import AutocompleteInput from '@/components/ui/AutocompleteInput'
import { createClient } from '@/lib/supabase/client'

const RASCUNHO_KEY = 'produto_rascunho'

type Aba = 'id' | 'preco' | 'detalhes'

interface Opcoes {
  grupos: string[]
  subGrupos: Record<string, string[]>
  cores: string[]
  tamanhos: string[]
  marcas: string[]
  localizacoes: string[]
  fornecedores: string[]
}

function Campo({ label, children, span = 1, erro }: { label: string; children: React.ReactNode; span?: number; erro?: string }) {
  return (
    <div style={span > 1 ? { gridColumn: `span ${span}` } : {}}>
      <label style={{ fontSize: 10, color: erro ? '#E5584A' : 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
        {label}
      </label>
      {children}
      {erro && <p style={{ fontSize: 11, color: '#E5584A', marginTop: 4 }}>{erro}</p>}
    </div>
  )
}

const FORM_INICIAL = {
  descricao: '', grupo: '', sub_grupo: '', cod_barras: '', cod_referencia: '',
  marca: '', cor: '', tamanho: '', fornecedor: '', localizacao: '',
  estoque: '0', estoque_minimo: '1', preco_custo: '', margem_lucro: '', preco_venda: '',
  permite_desconto: 'true', colecao: '', composicao: '', lavagem: '', observacoes_internas: '', ativo: 'true',
}

export default function NovoProdutoPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)

  const [salvando, setSalvando]     = useState(false)
  const [salvoId, setSalvoId]       = useState<string | null>(null)
  const [abaForm, setAbaForm]       = useState<Aba>('id')
  const [fotos, setFotos]           = useState<string[]>([])
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [erros, setErros]           = useState<Record<string, string>>({})
  const [opcoes, setOpcoes]         = useState<Opcoes>({ grupos: [], subGrupos: {}, cores: [], tamanhos: [], marcas: [], localizacoes: [], fornecedores: [] })
  const [preservar, setPreservar]   = useState({ grupo: '', sub_grupo: '' })
  const [rascunhoBanner, setRascunhoBanner] = useState(false)

  const [form, setForm] = useState({ ...FORM_INICIAL })

  useEffect(() => {
    fetch('/api/produtos/proximo-codigo')
      .then(r => r.json())
      .then(d => setForm(p => ({ ...p, cod_referencia: d.codigo })))
      .catch(() => {})

    fetch('/api/produtos/opcoes')
      .then(r => r.json())
      .then(d => setOpcoes(d))
      .catch(() => {})

    // Verifica rascunho salvo
    try {
      const saved = localStorage.getItem(RASCUNHO_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.descricao || parsed.preco_venda) setRascunhoBanner(true)
      }
    } catch {}
  }, [])

  // Auto-save do rascunho sempre que o form mudar
  useEffect(() => {
    if (form.descricao || form.preco_venda || form.cod_barras) {
      localStorage.setItem(RASCUNHO_KEY, JSON.stringify(form))
    }
  }, [form])

  function restaurarRascunho() {
    try {
      const saved = localStorage.getItem(RASCUNHO_KEY)
      if (saved) setForm(JSON.parse(saved))
    } catch {}
    setRascunhoBanner(false)
  }

  function descartarRascunho() {
    localStorage.removeItem(RASCUNHO_KEY)
    setRascunhoBanner(false)
  }

  const subGruposDisponiveis = opcoes.subGrupos[form.grupo] || []

  const setField = useCallback((k: string, val: string) => {
    setForm(prev => {
      const next = { ...prev, [k]: val }

      if (k === 'preco_custo' || k === 'margem_lucro') {
        const custo  = parseFloat(k === 'preco_custo'  ? val : prev.preco_custo)  || 0
        const margem = parseFloat(k === 'margem_lucro' ? val : prev.margem_lucro) || 0
        if (custo > 0 && margem > 0) {
          next.preco_venda = (custo * (1 + margem / 100)).toFixed(2)
        }
      }
      if (k === 'preco_venda') {
        const custo = parseFloat(prev.preco_custo) || 0
        const venda = parseFloat(val) || 0
        if (custo > 0 && venda > 0) {
          next.margem_lucro = (((venda / custo) - 1) * 100).toFixed(1)
        }
      }
      if (k === 'grupo') next.sub_grupo = ''
      return next
    })
    if (erros[k]) setErros(p => { const n = { ...p }; delete n[k]; return n })
  }, [erros])

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setField(k, e.target.value)

  function gerarCodBarras() {
    setField('cod_barras', String(Math.floor(Math.random() * 9000000000000) + 1000000000000))
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'tente novamente'
      setErros(p => ({ ...p, foto: 'Erro ao enviar foto: ' + message }))
    } finally {
      setUploadingFoto(false)
    }
  }

  function removerFoto(idx: number) { setFotos(prev => prev.filter((_, i) => i !== idx)) }

  async function salvar() {
    const novosErros: Record<string, string> = {}
    if (!form.descricao.trim()) novosErros.descricao = 'Descrição é obrigatória'
    if (!form.preco_venda || parseFloat(form.preco_venda) <= 0) novosErros.preco_venda = 'Preço de venda é obrigatório'
    if (!form.cod_referencia.trim()) novosErros.cod_referencia = 'Código do produto é obrigatório'

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      if (novosErros.descricao || novosErros.cod_referencia) setAbaForm('id')
      else if (novosErros.preco_venda) setAbaForm('preco')
      return
    }

    const checkRes = await fetch(`/api/produtos?q=${encodeURIComponent(form.cod_referencia)}&limite=5`)
    const checkData = await checkRes.json()
    const duplicado = (checkData.produtos || []).find((p: { cod_referencia?: string }) =>
      p.cod_referencia?.toLowerCase() === form.cod_referencia.toLowerCase()
    )
    if (duplicado) {
      const nextRes = await fetch('/api/produtos/proximo-codigo')
      const nextData = await nextRes.json()
      setField('cod_referencia', nextData.codigo)
      setErros(p => ({ ...p, cod_referencia: `Código já existe! Gerado novo: ${nextData.codigo}` }))
      setAbaForm('id')
      return
    }

    try {
      setSalvando(true)
      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estoque:          parseFloat(form.estoque) || 0,
          estoque_minimo:   parseInt(form.estoque_minimo) || 1,
          preco_custo:      parseFloat(form.preco_custo) || 0,
          margem_lucro:     parseFloat(form.margem_lucro) || 0,
          preco_venda:      parseFloat(form.preco_venda) || 0,
          permite_desconto: form.permite_desconto === 'true',
          ativo:            form.ativo === 'true',
          fotos,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.removeItem(RASCUNHO_KEY)
        setPreservar({ grupo: form.grupo, sub_grupo: form.sub_grupo })
        setSalvoId(data.id)
      } else {
        const err = await res.json()
        setErros({ geral: err.erro || 'Erro ao salvar' })
      }
    } catch {
      setErros(p => ({ ...p, geral: 'Erro de conexão. Verifique sua internet e tente novamente.' }))
    } finally {
      setSalvando(false)
    }
  }

  async function resetarForm() {
    const nextRes = await fetch('/api/produtos/proximo-codigo')
    const nextData = await nextRes.json()

    localStorage.removeItem(RASCUNHO_KEY)
    setForm({
      ...FORM_INICIAL,
      grupo:          preservar.grupo,
      sub_grupo:      preservar.sub_grupo,
      cod_referencia: nextData.codigo,
    })
    setFotos([])
    setErros({})
    setSalvoId(null)
    setSalvando(false)
    setAbaForm('id')
    setTimeout(() => descRef.current?.focus(), 100)
  }

  const custo      = parseFloat(form.preco_custo) || 0
  const venda      = parseFloat(form.preco_venda) || 0
  const lucro      = venda - custo
  const margemReal = venda > 0 ? (lucro / venda) * 100 : 0

  const tabStyle = (aba: Aba) => ({
    padding: '9px 20px', fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer', borderRadius: 8, transition: 'all 0.15s',
    background: abaForm === aba ? 'var(--gold, #C9A84C)' : 'transparent',
    color: abaForm === aba ? '#080608' : 'var(--text-muted, #888)',
  } as React.CSSProperties)

  if (salvoId) {
    return (
      <AppLayout>
        <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div className="card" style={{ textAlign: 'center', padding: '48px 40px', maxWidth: 440, borderColor: 'rgba(201,168,76,0.3)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(76,175,130,0.15)', border: '2px solid #4CAF82', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>✓</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', marginBottom: 8 }}>Produto salvo!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>O produto foi cadastrado com sucesso.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={resetarForm}>+ Cadastrar outro</button>
              <button className="btn btn-primary" onClick={() => router.push(`/produtos/${salvoId}`)}>✓ Ver produto cadastrado</button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 880 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button onClick={() => router.push('/produtos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6, padding: 0 }}>‹ Produtos</button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#332F3A', margin: 0 }}>Novo Produto</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push('/produtos')}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Produto'}</button>
          </div>
        </div>

        {rascunhoBanner && (
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#332F3A' }}>Você tem um cadastro incompleto salvo. Deseja continuar de onde parou?</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={descartarRascunho} style={{ background: 'none', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, color: 'var(--text-muted)', padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>Descartar</button>
              <button onClick={restaurarRascunho} style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 8, color: '#C9A84C', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Retomar cadastro</button>
            </div>
          </div>
        )}

        {erros.geral && (
          <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.25)', borderRadius: 10, padding: '12px 16px', color: '#E5584A', fontSize: 13 }}>{erros.geral}</div>
        )}

        {/* Código do produto — destaque no topo */}
        <div className="card" style={{ borderColor: 'rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.04)' }}>
          <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Código do Produto</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input
              className="input"
              value={form.cod_referencia}
              onChange={f('cod_referencia')}
              style={{
                fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
                letterSpacing: '0.05em', color: '#C9A84C', textAlign: 'center',
                maxWidth: 220, borderColor: erros.cod_referencia ? '#E5584A' : 'rgba(201,168,76,0.3)',
                background: 'rgba(201,168,76,0.06)',
              }}
            />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gerado automaticamente · Editável</div>
              {erros.cod_referencia && <div style={{ fontSize: 11, color: '#E5584A', marginTop: 4 }}>{erros.cod_referencia}</div>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          <button style={tabStyle('id')} onClick={() => setAbaForm('id')}>Identificação</button>
          <button style={tabStyle('preco')} onClick={() => setAbaForm('preco')}>Preço &amp; Estoque</button>
          <button style={tabStyle('detalhes')} onClick={() => setAbaForm('detalhes')}>Detalhes</button>
        </div>

        {abaForm === 'id' && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Identificação do Produto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>

              <Campo label="Descrição / Nome *" span={2} erro={erros.descricao}>
                <input
                  ref={descRef}
                  className="input"
                  placeholder="Ex: VESTIDO LONGO FLORAL MANGA CURTA"
                  value={form.descricao}
                  onChange={f('descricao')}
                  style={{ borderColor: erros.descricao ? '#E5584A' : undefined }}
                />
              </Campo>

              <Campo label="Grupo">
                <AutocompleteInput value={form.grupo} onChange={v => setField('grupo', v)} options={opcoes.grupos} placeholder="Ex: Moda Feminina" />
              </Campo>

              <Campo label="Sub-Grupo">
                <AutocompleteInput value={form.sub_grupo} onChange={v => setField('sub_grupo', v)} options={subGruposDisponiveis} placeholder="Ex: Vestido Longo, Calça Jeans..." />
              </Campo>

              <Campo label="Fornecedor" span={2}>
                <AutocompleteInput value={form.fornecedor} onChange={v => setField('fornecedor', v)} options={opcoes.fornecedores} placeholder="Ex: Moda Brasil Ltda..." />
              </Campo>

              <Campo label="Marca">
                <AutocompleteInput value={form.marca} onChange={v => setField('marca', v)} options={opcoes.marcas} placeholder="Ex: Animale, Renner..." />
              </Campo>

              <Campo label="Coleção / Temporada">
                <input className="input" placeholder="Ex: Verão 2025" value={form.colecao} onChange={f('colecao')} />
              </Campo>

              <Campo label="Cor">
                <AutocompleteInput value={form.cor} onChange={v => setField('cor', v)} options={opcoes.cores} placeholder="Ex: PRETO, AZUL MARINHO..." />
              </Campo>

              <Campo label="Tamanho">
                <AutocompleteInput value={form.tamanho} onChange={v => setField('tamanho', v)} options={opcoes.tamanhos} placeholder="PP, P, M, G, GG ou número..." />
              </Campo>

              <Campo label="Código de Barras" span={2}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" placeholder="EAN-13" value={form.cod_barras} onChange={f('cod_barras')} style={{ flex: 1 }} />
                  <button onClick={gerarCodBarras} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, color: '#C9A84C', padding: '0 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Gerar código</button>
                </div>
              </Campo>

              <Campo label="Fotos do Produto (máx. 3)" span={2} erro={erros.foto}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {fotos.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={url} alt={`Foto ${idx + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                      <button onClick={() => removerFoto(idx)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#E5584A', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                  {fotos.length < 3 && (
                    <button onClick={() => fileRef.current?.click()} disabled={uploadingFoto} style={{ width: 80, height: 80, border: '2px dashed rgba(201,168,76,0.3)', borderRadius: 8, background: 'rgba(201,168,76,0.04)', color: 'var(--text-muted)', cursor: uploadingFoto ? 'wait' : 'pointer', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
                      <span>{uploadingFoto ? '...' : 'Foto'}</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { const file = e.target.files?.[0]; if (file) await uploadFoto(file); e.target.value = '' }} />
                </div>
              </Campo>

            </div>
          </div>
        )}

        {abaForm === 'preco' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Precificação</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <Campo label="Preço de Custo (R$)">
                  <input type="number" className="input" placeholder="0,00" step={0.01} min={0} value={form.preco_custo} onChange={f('preco_custo')} />
                </Campo>
                <Campo label="Markup sobre o Custo (%)">
                  <input type="number" className="input" placeholder="80" step={0.5} min={0} value={form.margem_lucro} onChange={f('margem_lucro')} />
                </Campo>
                <Campo label="Preço de Venda (R$) *" erro={erros.preco_venda}>
                  <input type="number" className="input" placeholder="0,00" step={0.01} min={0} value={form.preco_venda} onChange={f('preco_venda')}
                    style={{ borderColor: erros.preco_venda ? '#E5584A' : undefined }} />
                </Campo>
              </div>
            </div>

            {custo > 0 && venda > 0 && (
              <div className="card" style={{ borderColor: 'rgba(76,175,130,0.25)', background: 'rgba(76,175,130,0.04)', padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Preview de Rentabilidade</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Custo</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#332F3A' }}>{custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Markup</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#C9A84C' }}>{parseFloat(form.margem_lucro || '0').toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Preço Venda</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#332F3A' }}>{venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Lucro/peça · Margem</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: lucro >= 0 ? '#4CAF82' : '#E5584A' }}>
                      {lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <span style={{ fontSize: 12 }}>({margemReal.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Estoque</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <Campo label="Estoque Inicial">
                  <input type="number" className="input" value={form.estoque} min={0} onChange={f('estoque')} />
                </Campo>
                <Campo label="Estoque Mínimo para Alerta">
                  <input type="number" className="input" value={form.estoque_minimo} min={0} onChange={f('estoque_minimo')} />
                </Campo>
                <Campo label="Localização na Loja">
                  <AutocompleteInput value={form.localizacao} onChange={v => setField('localizacao', v)} options={opcoes.localizacoes} placeholder="Araras A, Prateleira 2..." />
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

        {abaForm === 'detalhes' && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#332F3A', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Detalhes Adicionais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <Campo label="Composição do Tecido">
                <input className="input" placeholder="Ex: 100% Poliéster" value={form.composicao} onChange={f('composicao')} />
              </Campo>
              <Campo label="Instruções de Lavagem">
                <input className="input" placeholder="Ex: Lavar à mão, não torcer" value={form.lavagem} onChange={f('lavagem')} />
              </Campo>
              <Campo label="Observações Internas" span={2}>
                <textarea className="input" placeholder="Anotações internas sobre o produto..." value={form.observacoes_internas} onChange={f('observacoes_internas')} rows={4} style={{ resize: 'vertical', lineHeight: 1.5 }} />
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {abaForm !== 'id' && <button className="btn btn-ghost" onClick={() => setAbaForm(abaForm === 'detalhes' ? 'preco' : 'id')}>← Anterior</button>}
            {abaForm !== 'detalhes' && <button className="btn btn-ghost" onClick={() => setAbaForm(abaForm === 'id' ? 'preco' : 'detalhes')}>Próximo →</button>}
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
