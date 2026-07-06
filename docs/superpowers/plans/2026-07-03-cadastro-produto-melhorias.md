# Cadastro de Produto — Melhorias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melhorar o cadastro de produtos com código automático, cálculo de margem bidirecional, autocomplete com dados do banco em todos os campos de categoria, e validações inline.

**Architecture:** Novo componente `AutocompleteInput` reutilizável para campos com sugestões do banco + dropdown livre. Nova rota `/api/produtos/opcoes` retorna todos os dados necessários em uma única chamada. As páginas `novo/page.tsx` e `[id]/page.tsx` são atualizadas para usar esses novos recursos.

**Tech Stack:** Next.js 14 App Router, `'use client'`, Supabase, TypeScript, inline CSS (padrão do projeto — sem Tailwind, sem CSS Modules).

---

## Estado Atual (contexto para o agente)

- `src/app/api/produtos/proximo-codigo/route.ts` — já existe, mas usa `COUNT` (bug de colisão) e `padStart(3)` (deveria ser 4)
- `src/app/produtos/novo/page.tsx` — formulário em abas, mas sem chamada ao proximo-codigo, sem AutocompleteInput, sem opcoes da API
- `src/app/produtos/[id]/page.tsx` — modo edição usa inputs simples sem autocomplete
- `src/app/api/produtos/route.ts` — GET e POST existem
- `src/app/api/produtos/[id]/route.ts` — GET, PATCH, DELETE existem
- `src/components/ui/SelectCustom.tsx` — componente de select customizado para referência de estilo

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Modificar | `src/app/api/produtos/proximo-codigo/route.ts` | Corrigir padStart(4) e usar MAX+1 |
| Criar | `src/app/api/produtos/opcoes/route.ts` | Retornar grupos, cores, tamanhos, marcas, localizacoes, fornecedores |
| Criar | `src/components/ui/AutocompleteInput.tsx` | Input com dropdown filtrado + texto livre |
| Reescrever | `src/app/produtos/novo/page.tsx` | Formulário completo com todas as melhorias |
| Modificar | `src/app/produtos/[id]/page.tsx` | Edição inline com AutocompleteInput e margem bidirecional |

---

## Task 1: Corrigir `proximo-codigo` — MAX+1 e 4 dígitos

**Files:**
- Modify: `src/app/api/produtos/proximo-codigo/route.ts`

O problema atual: usa `COUNT` de registros com o prefixo. Se um produto for deletado ou o código editado, o próximo pode colidir. Correto é buscar o MAX numérico atual e somar 1.

- [ ] **Step 1: Reescrever a rota**

```typescript
// src/app/api/produtos/proximo-codigo/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseAdmin()
  const brDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const ano = brDate.substring(2, 4)   // '26'
  const mes = brDate.substring(5, 7)   // '07'
  const prefixo = `JS${ano}${mes}`     // 'JS2607'

  // Busca o maior sequencial já usado nesse mês (evita colisão por deleção)
  const { data } = await supabase
    .from('produtos')
    .select('cod_referencia')
    .like('cod_referencia', `${prefixo}%`)
    .order('cod_referencia', { ascending: false })
    .limit(1)

  let seq = 1
  if (data && data.length > 0) {
    const ultimo = data[0].cod_referencia as string
    const numStr = ultimo.substring(prefixo.length)
    const num = parseInt(numStr, 10)
    if (!isNaN(num)) seq = num + 1
  }

  const codigo = `${prefixo}${String(seq).padStart(4, '0')}`
  return NextResponse.json({ codigo })
}
```

- [ ] **Step 2: Verificar build local**

```bash
cd "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER"
npx tsc --noEmit 2>&1 | grep "proximo-codigo"
```
Esperado: nenhuma saída (sem erros).

---

## Task 2: Criar `/api/produtos/opcoes`

**Files:**
- Create: `src/app/api/produtos/opcoes/route.ts`

Retorna todos os dados de autocomplete em uma única chamada para evitar múltiplas requisições na abertura do formulário.

- [ ] **Step 1: Criar a rota**

```typescript
// src/app/api/produtos/opcoes/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const TAMANHOS_FIXOS = ['PP', 'P', 'M', 'G', 'GG', 'EG', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56']

export async function GET() {
  const supabase = await createServerSupabase()

  // Busca todos os distintos em paralelo
  const [grupos, subGrupos, cores, tamanhosBD, marcas, localizacoes, fornecedoresProd, fornecedoresTabela] = await Promise.all([
    supabase.from('produtos').select('grupo').not('grupo', 'is', null).neq('grupo', ''),
    supabase.from('produtos').select('sub_grupo, grupo').not('sub_grupo', 'is', null).neq('sub_grupo', ''),
    supabase.from('produtos').select('cor').not('cor', 'is', null).neq('cor', ''),
    supabase.from('produtos').select('tamanho').not('tamanho', 'is', null).neq('tamanho', ''),
    supabase.from('produtos').select('marca').not('marca', 'is', null).neq('marca', ''),
    supabase.from('produtos').select('localizacao').not('localizacao', 'is', null).neq('localizacao', ''),
    supabase.from('produtos').select('fornecedor').not('fornecedor', 'is', null).neq('fornecedor', ''),
    supabase.from('fornecedores').select('nome').order('nome'),
  ])

  const unique = <T>(arr: T[]) => [...new Set(arr)].sort() as string[]

  const gruposArr   = unique((grupos.data || []).map((r: any) => r.grupo))
  const subGruposMap: Record<string, string[]> = {}
  for (const r of (subGrupos.data || []) as any[]) {
    if (!subGruposMap[r.grupo]) subGruposMap[r.grupo] = []
    if (r.sub_grupo && !subGruposMap[r.grupo].includes(r.sub_grupo)) {
      subGruposMap[r.grupo].push(r.sub_grupo)
    }
  }
  const coresArr    = unique((cores.data || []).map((r: any) => r.cor))
  const tamanhosBDArr = unique((tamanhosBD.data || []).map((r: any) => r.tamanho))
  const tamanhosMerged = unique([...TAMANHOS_FIXOS, ...tamanhosBDArr])
  const marcasArr   = unique((marcas.data || []).map((r: any) => r.marca))
  const locArr      = unique((localizacoes.data || []).map((r: any) => r.localizacao))

  // Fornecedores: prioridade para tabela fornecedores, fallback para produtos.fornecedor
  let fornArr: string[] = []
  if (fornecedoresTabela.data && fornecedoresTabela.data.length > 0) {
    fornArr = (fornecedoresTabela.data as any[]).map(r => r.nome).filter(Boolean)
  } else {
    fornArr = unique((fornecedoresProd.data || []).map((r: any) => r.fornecedor))
  }

  return NextResponse.json({
    grupos: gruposArr,
    subGrupos: subGruposMap,
    cores: coresArr,
    tamanhos: tamanhosMerged,
    marcas: marcasArr,
    localizacoes: locArr,
    fornecedores: fornArr,
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "opcoes"
```
Esperado: nenhuma saída.

---

## Task 3: Criar componente `AutocompleteInput`

**Files:**
- Create: `src/components/ui/AutocompleteInput.tsx`

Componente de input com dropdown filtrado. Aceita texto livre — se o usuário digitar algo que não está na lista, é aceito normalmente.

- [ ] **Step 1: Criar o componente**

```typescript
// src/components/ui/AutocompleteInput.tsx
'use client'
import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}

export default function AutocompleteInput({ value, onChange, options, placeholder, disabled }: Props) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState(value)
  const wrapRef             = useRef<HTMLDivElement>(null)

  // Sync interno quando valor externo muda (ex: resetar form)
  useEffect(() => { setQuery(value) }, [value])

  const filtered = options.filter(o =>
    o.toLowerCase().includes((query || '').toLowerCase())
  )

  function handleChange(val: string) {
    setQuery(val)
    onChange(val)
    setOpen(true)
  }

  function handleSelect(opt: string) {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
  }

  function handleBlur() {
    // Delay para permitir o clique na opção antes de fechar
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        className="input"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#1a1610', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => handleSelect(opt)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', background: 'none', border: 'none',
                color: opt === value ? '#C9A84C' : '#F2EBD9',
                fontSize: 13, cursor: 'pointer',
                borderBottom: '1px solid rgba(201,168,76,0.06)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "AutocompleteInput"
```
Esperado: nenhuma saída.

---

## Task 4: Reescrever `novo/page.tsx`

**Files:**
- Modify: `src/app/produtos/novo/page.tsx`

Esta é a maior mudança. A página existente é reescrita com:
1. Chamada a `proximo-codigo` no mount → exibe no topo
2. Chamada a `/api/produtos/opcoes` no mount → popula AutocompleteInputs
3. `AutocompleteInput` em: grupo, sub_grupo, cor, tamanho, marca, fornecedor, localizacao
4. sub_grupo filtra opções pelo grupo selecionado
5. Cálculo bidirecional: custo+markup → venda, venda edited → markup
6. Validação inline por campo (descricao, preco_venda, cod_referencia)
7. Verificação de cod_referencia duplicado antes de salvar
8. Success screen com "Cadastrar outro" preservando grupo/sub_grupo

- [ ] **Step 1: Reescrever o arquivo completo**

```typescript
// src/app/produtos/novo/page.tsx
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import AutocompleteInput from '@/components/ui/AutocompleteInput'
import { createClient } from '@/lib/supabase/client'

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
  permite_desconto: 'true', colecao: '', composicao: '', lavagem: '', observacoes: '', ativo: 'true',
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

  const [form, setForm] = useState({ ...FORM_INICIAL })

  // Buscar próximo código e opções ao montar
  useEffect(() => {
    fetch('/api/produtos/proximo-codigo')
      .then(r => r.json())
      .then(d => setForm(p => ({ ...p, cod_referencia: d.codigo })))
      .catch(() => {})

    fetch('/api/produtos/opcoes')
      .then(r => r.json())
      .then(d => setOpcoes(d))
      .catch(() => {})
  }, [])

  // Sub-grupos filtrados pelo grupo atual
  const subGruposDisponiveis = opcoes.subGrupos[form.grupo] || []

  const setField = useCallback((k: string, val: string) => {
    setForm(prev => {
      const next = { ...prev, [k]: val }

      // Cálculo bidirecional de margem
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

      // Limpar sub_grupo ao trocar grupo
      if (k === 'grupo') next.sub_grupo = ''

      return next
    })
    // Limpar erro do campo ao editar
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
    } catch (err: any) {
      setErros(p => ({ ...p, foto: 'Erro ao enviar foto: ' + (err.message || 'tente novamente') }))
    } finally {
      setUploadingFoto(false)
    }
  }

  function removerFoto(idx: number) { setFotos(prev => prev.filter((_, i) => i !== idx)) }

  async function salvar() {
    // Validação inline por campo
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

    // Verificar código duplicado
    const checkRes = await fetch(`/api/produtos?q=${encodeURIComponent(form.cod_referencia)}&limite=1`)
    const checkData = await checkRes.json()
    const duplicado = (checkData.produtos || []).find((p: any) =>
      p.cod_referencia?.toLowerCase() === form.cod_referencia.toLowerCase()
    )
    if (duplicado) {
      // Gerar próximo automaticamente
      const nextRes = await fetch('/api/produtos/proximo-codigo')
      const nextData = await nextRes.json()
      setField('cod_referencia', nextData.codigo)
      setErros(p => ({ ...p, cod_referencia: `Código já existe! Gerado novo: ${nextData.codigo}` }))
      setAbaForm('id')
      return
    }

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
      setPreservar({ grupo: form.grupo, sub_grupo: form.sub_grupo })
      setSalvoId(data.id)
    } else {
      const err = await res.json()
      setErros({ geral: err.erro || 'Erro ao salvar' })
      setSalvando(false)
    }
  }

  async function resetarForm() {
    // Buscar novo código
    const nextRes = await fetch('/api/produtos/proximo-codigo')
    const nextData = await nextRes.json()

    setForm({
      ...FORM_INICIAL,
      grupo:         preservar.grupo,
      sub_grupo:     preservar.sub_grupo,
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
  const margemReal = custo > 0 ? (lucro / venda) * 100 : 0

  const tabStyle = (aba: Aba) => ({
    padding: '9px 20px', fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer', borderRadius: 8, transition: 'all 0.15s',
    background: abaForm === aba ? 'var(--gold, #C9A84C)' : 'transparent',
    color: abaForm === aba ? '#080608' : 'var(--text-muted, #888)',
  } as React.CSSProperties)

  // Tela de sucesso
  if (salvoId) {
    return (
      <AppLayout>
        <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <div className="card" style={{ textAlign: 'center', padding: '48px 40px', maxWidth: 440, borderColor: 'rgba(201,168,76,0.3)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(76,175,130,0.15)', border: '2px solid #4CAF82', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24 }}>✓</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 8 }}>Produto salvo!</h2>
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

        {/* Erro geral */}
        {erros.geral && (
          <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.25)', borderRadius: 10, padding: '12px 16px', color: '#E5584A', fontSize: 13 }}>{erros.geral}</div>
        )}

        {/* Bloco do código — destaque no topo */}
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

        {/* ABA: IDENTIFICAÇÃO */}
        {abaForm === 'id' && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Identificação do Produto</h3>
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
                <AutocompleteInput
                  value={form.grupo}
                  onChange={v => setField('grupo', v)}
                  options={opcoes.grupos}
                  placeholder="Ex: Moda Feminina"
                />
              </Campo>

              <Campo label="Sub-Grupo">
                <AutocompleteInput
                  value={form.sub_grupo}
                  onChange={v => setField('sub_grupo', v)}
                  options={subGruposDisponiveis}
                  placeholder="Ex: Vestido Longo, Calça Jeans..."
                />
              </Campo>

              <Campo label="Fornecedor" span={2}>
                <AutocompleteInput
                  value={form.fornecedor}
                  onChange={v => setField('fornecedor', v)}
                  options={opcoes.fornecedores}
                  placeholder="Ex: Moda Brasil Ltda..."
                />
              </Campo>

              <Campo label="Marca">
                <AutocompleteInput
                  value={form.marca}
                  onChange={v => setField('marca', v)}
                  options={opcoes.marcas}
                  placeholder="Ex: Animale, Renner..."
                />
              </Campo>

              <Campo label="Coleção / Temporada">
                <input className="input" placeholder="Ex: Verão 2025" value={form.colecao} onChange={f('colecao')} />
              </Campo>

              <Campo label="Cor">
                <AutocompleteInput
                  value={form.cor}
                  onChange={v => setField('cor', v)}
                  options={opcoes.cores}
                  placeholder="Ex: PRETO, AZUL MARINHO..."
                />
              </Campo>

              <Campo label="Tamanho">
                <AutocompleteInput
                  value={form.tamanho}
                  onChange={v => setField('tamanho', v)}
                  options={opcoes.tamanhos}
                  placeholder="PP, P, M, G, GG ou número..."
                />
              </Campo>

              <Campo label="Código de Barras" span={2}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" placeholder="EAN-13" value={form.cod_barras} onChange={f('cod_barras')} style={{ flex: 1 }} />
                  <button onClick={gerarCodBarras} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, color: '#C9A84C', padding: '0 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Gerar código</button>
                </div>
              </Campo>

              {/* Fotos */}
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

        {/* ABA: PREÇO & ESTOQUE */}
        {abaForm === 'preco' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Precificação</h3>
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

            {/* Preview de rentabilidade */}
            {custo > 0 && venda > 0 && (
              <div className="card" style={{ borderColor: 'rgba(76,175,130,0.25)', background: 'rgba(76,175,130,0.04)', padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Preview de Rentabilidade</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Custo</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#F2EBD9' }}>{custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Markup</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#C9A84C' }}>{parseFloat(form.margem_lucro || '0').toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Preço Venda</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#F2EBD9' }}>{venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
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
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>Estoque</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                <Campo label="Estoque Inicial">
                  <input type="number" className="input" value={form.estoque} min={0} onChange={f('estoque')} />
                </Campo>
                <Campo label="Estoque Mínimo para Alerta">
                  <input type="number" className="input" value={form.estoque_minimo} min={0} onChange={f('estoque_minimo')} />
                </Campo>
                <Campo label="Localização na Loja">
                  <AutocompleteInput
                    value={form.localizacao}
                    onChange={v => setField('localizacao', v)}
                    options={opcoes.localizacoes}
                    placeholder="Araras A, Prateleira 2..."
                  />
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
                <textarea className="input" placeholder="Anotações internas sobre o produto..." value={form.observacoes} onChange={f('observacoes')} rows={4} style={{ resize: 'vertical', lineHeight: 1.5 }} />
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

        {/* Footer */}
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
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "novo/page"
```
Esperado: nenhuma saída.

---

## Task 5: Atualizar edição em `[id]/page.tsx`

**Files:**
- Modify: `src/app/produtos/[id]/page.tsx`

Adicionar: importar AutocompleteInput, buscar opcoes quando entrar em modo de edição, substituir inputs simples por AutocompleteInput nos campos de categoria, e adicionar cálculo bidirecional de margem na edição.

- [ ] **Step 1: Adicionar imports e estado de opcoes**

Adicionar após as imports existentes:
```typescript
import AutocompleteInput from '@/components/ui/AutocompleteInput'
```

Adicionar ao estado do componente:
```typescript
const [opcoes, setOpcoes] = useState<{ grupos: string[]; subGrupos: Record<string,string[]>; cores: string[]; tamanhos: string[]; marcas: string[]; localizacoes: string[]; fornecedores: string[] }>({
  grupos: [], subGrupos: {}, cores: [], tamanhos: [], marcas: [], localizacoes: [], fornecedores: [],
})
```

- [ ] **Step 2: Buscar opcoes ao entrar em modo de edição**

Adicionar `useEffect` para buscar opcoes quando `editando` muda para `true`:
```typescript
useEffect(() => {
  if (editando && opcoes.grupos.length === 0) {
    fetch('/api/produtos/opcoes')
      .then(r => r.json())
      .then(d => setOpcoes(d))
      .catch(() => {})
  }
}, [editando])
```

- [ ] **Step 3: Atualizar a função `f` para suportar cálculo bidirecional**

Substituir a função `f` existente:
```typescript
const f = (k: string) => (e: any) => {
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
```

- [ ] **Step 4: Substituir inputs simples por AutocompleteInput no modo de edição**

Na seção `{editando ? (...) : (...)}` do card "Identificação" (linha ~211-222), substituir:
```typescript
// ANTES:
<Campo label="Grupo"><input className="input" value={form.grupo || ''} onChange={f('grupo')} /></Campo>
<Campo label="Sub-Grupo"><input className="input" value={form.sub_grupo || ''} onChange={f('sub_grupo')} /></Campo>
<Campo label="Marca"><input className="input" value={form.marca || ''} onChange={f('marca')} /></Campo>
<Campo label="Fornecedor"><input className="input" value={form.fornecedor || ''} onChange={f('fornecedor')} /></Campo>
<Campo label="Cor"><input className="input" value={form.cor || ''} onChange={f('cor')} /></Campo>
<Campo label="Tamanho"><input className="input" value={form.tamanho || ''} onChange={f('tamanho')} /></Campo>
<Campo label="Localização"><input className="input" value={form.localizacao || ''} onChange={f('localizacao')} /></Campo>

// DEPOIS:
<Campo label="Grupo">
  <AutocompleteInput value={form.grupo || ''} onChange={v => f('grupo')({ target: { value: v } })} options={opcoes.grupos} placeholder="Ex: Moda Feminina" />
</Campo>
<Campo label="Sub-Grupo">
  <AutocompleteInput value={form.sub_grupo || ''} onChange={v => f('sub_grupo')({ target: { value: v } })} options={(opcoes.subGrupos || {})[form.grupo] || []} placeholder="Ex: Vestido Longo" />
</Campo>
<Campo label="Marca">
  <AutocompleteInput value={form.marca || ''} onChange={v => f('marca')({ target: { value: v } })} options={opcoes.marcas} placeholder="Ex: Animale" />
</Campo>
<Campo label="Fornecedor">
  <AutocompleteInput value={form.fornecedor || ''} onChange={v => f('fornecedor')({ target: { value: v } })} options={opcoes.fornecedores} placeholder="Ex: Moda Brasil Ltda" />
</Campo>
<Campo label="Cor">
  <AutocompleteInput value={form.cor || ''} onChange={v => f('cor')({ target: { value: v } })} options={opcoes.cores} placeholder="Ex: PRETO" />
</Campo>
<Campo label="Tamanho">
  <AutocompleteInput value={form.tamanho || ''} onChange={v => f('tamanho')({ target: { value: v } })} options={opcoes.tamanhos} placeholder="PP, P, M, G..." />
</Campo>
<Campo label="Localização">
  <AutocompleteInput value={form.localizacao || ''} onChange={v => f('localizacao')({ target: { value: v } })} options={opcoes.localizacoes} placeholder="Araras A, Prateleira 2..." />
</Campo>
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "\[id\]/page"
```
Esperado: nenhuma saída.

---

## Task 6: Build e deploy

**Files:** nenhum novo

- [ ] **Step 1: Rodar build completo**

```bash
cd "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER"
npm run build 2>&1 | tail -20
```
Esperado: `✓ Compiled successfully` — nenhum erro de TypeScript ou build.

- [ ] **Step 2: Testar no dev server (verificação manual)**

```bash
npm run dev
```
Abrir `http://localhost:3001/produtos/novo` e verificar:
- [ ] Código JS2607xxxx aparece no topo ao abrir
- [ ] Campos Grupo, Cor, Tamanho mostram dropdown ao clicar
- [ ] Digitar filtra as opções
- [ ] Texto livre (não existente na lista) é aceito
- [ ] Preencher Custo + Markup calcula o preço de venda
- [ ] Editar Preço de Venda atualiza o Markup
- [ ] Tentar salvar sem Descrição → erro inline no campo
- [ ] Salvo com sucesso → botões "Ver produto" e "+ Cadastrar outro"
- [ ] "+ Cadastrar outro" mantém Grupo e Sub-Grupo, gera novo código

- [ ] **Step 3: Deploy**

```bash
vercel --prod
```
Aguardar conclusão e verificar URL de produção.

---

## Self-Review — Cobertura do Spec

| Requisito | Task |
|-----------|------|
| Código automático JS + ano + mês + 4 dígitos | Task 1 |
| Mostrar código no topo em destaque | Task 4 |
| Código vai para cod_referencia | Task 4 |
| Código editável mas não pode ficar vazio | Task 4 (validação) |
| Verificar duplicidade antes de salvar | Task 4 (salvar()) |
| Custo + Markup → calcula preco_venda | Task 4 + Task 5 |
| Editar preco_venda → atualiza markup | Task 4 + Task 5 |
| Preview rentabilidade (4 colunas) | Task 4 |
| Salvar preco_custo, margem_lucro, preco_venda | Task 4 (payload já inclui os 3) |
| Fornecedor com autocomplete da tabela fornecedores | Task 2 + Task 4 |
| Grupo com opções do banco | Task 2 + Task 4 |
| Sub-grupo filtrado pelo grupo | Task 4 (subGruposDisponiveis) |
| Cor com opções do banco | Task 2 + Task 4 |
| Tamanho: lista fixa + do banco | Task 2 (TAMANHOS_FIXOS merged) + Task 4 |
| Marca com opções do banco | Task 2 + Task 4 |
| Localização com opções do banco | Task 2 + Task 4 |
| AutocompleteInput reutilizável com props spec | Task 3 |
| API /api/produtos/opcoes em uma chamada | Task 2 |
| Validação: descrição vazia | Task 4 |
| Validação: preco_venda zero | Task 4 |
| Validação: cod_referencia vazio | Task 4 |
| Erros inline por campo | Task 4 (erros[campo]) |
| Após salvar: dois botões | Task 4 (tela de sucesso) |
| Cadastrar outro: preserva grupo/sub_grupo | Task 4 (resetarForm) |
| Cadastrar outro: gera novo código | Task 4 (resetarForm chama proximo-codigo) |
| Cadastrar outro: foca no campo descrição | Task 4 (descRef.current?.focus()) |
| Edição em [id]/page.tsx com AutocompleteInput | Task 5 |
| Margem bidirecional na edição | Task 5 (f() atualizado) |
| Build sem erros | Task 6 |
| Deploy vercel --prod | Task 6 |
