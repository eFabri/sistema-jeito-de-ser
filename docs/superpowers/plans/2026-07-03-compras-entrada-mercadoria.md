# Módulo de Compras — Entrada de Mercadoria em Massa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the purchase module to support mass merchandise entry via a spreadsheet-style product grid, with automatic EAN-13 barcode generation and product creation/update on finalization.

**Architecture:** The current `nova/page.tsx` is a product-search-based form (finds existing products). This replaces it with a data-entry grid where each row defines a new or existing product. The POST `/api/compras` handler is extended to upsert products, generate EAN-13 barcodes, and record the purchase. Two new endpoints handle dropdown options and barcode generation. A SQL migration adds `forma_pagamento` and `status` columns to `compras`.

**Tech Stack:** Next.js 14 App Router, `'use client'`, Supabase (server), existing `AutocompleteInput` component at `src/components/ui/AutocompleteInput.tsx` (props: `value: string`, `onChange: (v: string) => void`, `options: string[]`, `placeholder?: string`, `disabled?: boolean`).

---

## File Map

**Create:**
- `supabase/migrations/003_compras_melhorias.sql` — adds `forma_pagamento text` and `status text` to `compras`
- `src/app/api/compras/opcoes/route.ts` — GET returning all dropdown options in one call
- `src/app/api/compras/proximo-codigo-barras/route.ts` — GET returning next EAN-13 available

**Rewrite:**
- `src/app/compras/nova/page.tsx` — spreadsheet grid for mass purchase entry
- `src/app/api/compras/route.ts` — POST upserts products + assigns barcodes; GET returns aggregate item data

**Modify:**
- `src/app/compras/page.tsx` — list view with Qtd Peças, Valor Venda, Ganho Previsto, Status columns

**Unchanged:**
- `src/components/ui/AutocompleteInput.tsx` — reuse as-is
- `src/app/api/compras/[id]/route.ts` — no changes
- `src/app/api/compras/[id]/itens/route.ts` — no changes
- `src/app/compras/[id]/page.tsx` — no changes

---

### Task 1: SQL Migration + `/api/compras/opcoes`

**Files:**
- Create: `supabase/migrations/003_compras_melhorias.sql`
- Create: `src/app/api/compras/opcoes/route.ts`

- [ ] **Step 1: Create the migration SQL file**

Create `supabase/migrations/003_compras_melhorias.sql` with this exact content:

```sql
-- Adiciona forma_pagamento e status à tabela compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS status text DEFAULT 'Finalizada';
```

**⚠️ IMPORTANTE:** Esta migration deve ser executada manualmente no Supabase → SQL Editor → New query. O código que usa essas colunas só funcionará depois que a migration rodar.

- [ ] **Step 2: Create `src/app/api/compras/opcoes/route.ts`**

```typescript
// src/app/api/compras/opcoes/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const TAMANHOS_FIXOS = ['PP','P','M','G','GG','EG','XEG','34','36','38','40','42','44','46','48','50','52','54','56']
const SUBGRUPOS_BASE = ['BLUSA','BODY','BERMUDA','CALÇA','CAMISA','CARDIGAN','COLETE','CONJUNTO','CONJ CALÇA','CONJ SAIA','JAQUETA','MACACÃO','REGATA','SAIA','SHORTS','VESTIDO']

export async function GET() {
  const supabase = await createServerSupabase()
  const unique = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort()

  const [gruposRes, subGruposRes, coresRes, tamanhosRes, marcasRes, fornecedoresRes] = await Promise.all([
    supabase.from('produtos').select('grupo').not('grupo', 'is', null),
    supabase.from('produtos').select('sub_grupo').not('sub_grupo', 'is', null),
    supabase.from('produtos').select('cor').not('cor', 'is', null),
    supabase.from('produtos').select('tamanho').not('tamanho', 'is', null),
    supabase.from('produtos').select('marca').not('marca', 'is', null),
    supabase.from('fornecedores').select('id, nome').order('nome'),
  ])

  const grupos = unique((gruposRes.data || []).map((r: any) => r.grupo))
  const subgrupos = unique([...SUBGRUPOS_BASE, ...(subGruposRes.data || []).map((r: any) => r.sub_grupo)])
  const cores = unique((coresRes.data || []).map((r: any) => r.cor))
  const tamanhosBD = unique((tamanhosRes.data || []).map((r: any) => r.tamanho))
  const tamanhos = unique([...TAMANHOS_FIXOS, ...tamanhosBD])
  const marcas = unique((marcasRes.data || []).map((r: any) => r.marca))
  const fornecedores = (fornecedoresRes.data || []).map((f: any) => ({ id: f.id as number, nome: f.nome as string }))

  return NextResponse.json({ grupos, subgrupos, cores, tamanhos, marcas, fornecedores })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER"
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
cd "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER"
git add supabase/migrations/003_compras_melhorias.sql src/app/api/compras/opcoes/route.ts
git commit -m "feat(compras): migration sql + opcoes api endpoint"
```

---

### Task 2: `/api/compras/proximo-codigo-barras`

**Files:**
- Create: `src/app/api/compras/proximo-codigo-barras/route.ts`

EAN-13 format: prefix `789` (Brasil) + 9 sequential digits + 1 check digit.
Check digit algorithm: sum odd-position digits × 1 + even-position digits × 3, result = (10 - sum%10) % 10.

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/compras/proximo-codigo-barras/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

function calcCheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10)
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

export function buildEAN13(seq: number): string {
  const body = '789' + String(seq).padStart(9, '0') // 12 digits
  return body + calcCheckDigit(body)
}

export async function GET() {
  const supabase = await createServerSupabase()

  const { data, error } = await supabase
    .from('produtos')
    .select('cod_barras')
    .like('cod_barras', '789%')
    .order('cod_barras', { ascending: false })
    .limit(1)

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  let seq = 1
  if (data && data.length > 0) {
    const last = data[0].cod_barras
    if (typeof last === 'string' && last.length === 13) {
      const num = parseInt(last.substring(3, 12), 10) // digits 4–12 (indices 3–11)
      if (!isNaN(num)) seq = num + 1
    }
  }

  return NextResponse.json({ codigo: buildEAN13(seq) })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/compras/proximo-codigo-barras/route.ts
git commit -m "feat(compras): EAN-13 barcode generation endpoint"
```

---

### Task 3: Rewrite `/api/compras/route.ts`

**Files:**
- Rewrite: `src/app/api/compras/route.ts`

**BEFORE WRITING:** Read the current file AND the contas_a_pagar schema:

```bash
cat "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER/src/app/api/compras/route.ts"
grep -A 25 "create table contas_a_pagar" "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER/supabase/migrations/001_schema_completo.sql"
```

Use the contas_a_pagar column names from the schema (not assumed names). Adjust the INSERT in Step 6 of the new POST handler accordingly.

- [ ] **Step 1: Read current files (see command above)**

- [ ] **Step 2: Write the complete new `route.ts`**

```typescript
// src/app/api/compras/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// ── EAN-13 helpers (duplicated from proximo-codigo-barras for self-containment) ──
function calcCheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10)
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

function buildEAN13(seq: number): string {
  const body = '789' + String(seq).padStart(9, '0')
  return body + calcCheckDigit(body)
}

// ── GET — list purchases with aggregate item data ──
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '25')
  const q = searchParams.get('q') || ''
  const offset = (pagina - 1) * limite

  let query = supabase
    .from('compras')
    .select('id, data, nota_numero, grupo, evento, valor_total, forma_pagamento, status, created_at, fornecedores(nome)', { count: 'exact' })
    .order('id', { ascending: false })
    .range(offset, offset + limite - 1)

  if (q) {
    const n = parseInt(q)
    if (!isNaN(n)) query = query.eq('nota_numero', n)
    else query = query.ilike('grupo', `%${q}%`)
  }

  const { data: compras, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Fetch aggregate data from compras_itens for these purchases
  const ids = (compras || []).map((c: any) => c.id)
  const aggMap = new Map<number, { qtd: number; venda_total: number; custo_total: number }>()
  if (ids.length > 0) {
    const { data: itens } = await supabase
      .from('compras_itens')
      .select('cod_compra, quantidade, preco_venda, sub_total')
      .in('cod_compra', ids)
    for (const it of itens || []) {
      const cur = aggMap.get(it.cod_compra) || { qtd: 0, venda_total: 0, custo_total: 0 }
      cur.qtd += Number(it.quantidade || 0)
      cur.venda_total += Number(it.preco_venda || 0) * Number(it.quantidade || 0)
      cur.custo_total += Number(it.sub_total || 0)
      aggMap.set(it.cod_compra, cur)
    }
  }

  const resultado = (compras || []).map((c: any) => ({
    ...c,
    fornecedor_nome: (c.fornecedores as any)?.nome || null,
    qtd_pecas: aggMap.get(c.id)?.qtd || 0,
    valor_venda_total: aggMap.get(c.id)?.venda_total || 0,
    ganho_previsto: (aggMap.get(c.id)?.venda_total || 0) - (aggMap.get(c.id)?.custo_total || 0),
  }))

  return NextResponse.json({ compras: resultado, total: count, pagina, limite })
}

// ── POST — create purchase, upsert products, assign barcodes ──
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()

  const { cabecalho, itens } = body as {
    cabecalho: {
      fornecedor_id: number | null
      fornecedor_nome: string
      data: string
      nota_numero: string
      grupo: string
      evento: string
      forma_pagamento: string
    }
    itens: Array<{
      cod_barras: string
      sub_grupo: string
      marca: string
      produto: string
      partes: string
      tamanho: string
      cor: string
      quantidade: number
      preco_custo: number
      preco_venda: number
      ganho_rs: number
      ganho_pct: number
    }>
  }

  if (!itens || itens.length === 0)
    return NextResponse.json({ erro: 'Nenhum item informado' }, { status: 400 })

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  // 1. Get current max EAN-13 sequence to generate barcodes
  const { data: lastBarcode } = await supabase
    .from('produtos')
    .select('cod_barras')
    .like('cod_barras', '789%')
    .order('cod_barras', { ascending: false })
    .limit(1)

  let seq = 1
  if (lastBarcode && lastBarcode.length > 0) {
    const last = lastBarcode[0].cod_barras
    if (typeof last === 'string' && last.length === 13) {
      const num = parseInt(last.substring(3, 12), 10)
      if (!isNaN(num)) seq = num + 1
    }
  }

  // 2. Process each item: assign barcode, find-or-create product
  let produtos_criados = 0
  let produtos_atualizados = 0

  interface ItemProcessado {
    cod_produto: number
    cod_barras: string
    produto: string
    sub_grupo: string
    marca: string
    partes: string
    tamanho: string
    cor: string
    quantidade: number
    valor_unitario: number
    sub_total: number
    preco_venda: number
    margem_valor: number
    margem_porcent: number
  }

  const itensProcessados: ItemProcessado[] = []

  for (const item of itens) {
    // Assign or keep barcode
    let cod_barras = (item.cod_barras || '').trim()
    if (!cod_barras) {
      cod_barras = buildEAN13(seq++)
    }

    // Find existing product by barcode first, then by descricao+cor+tamanho
    let produtoId: number | null = null

    if (cod_barras) {
      const { data: byBarcode } = await supabase
        .from('produtos')
        .select('id, estoque')
        .eq('cod_barras', cod_barras)
        .maybeSingle()
      if (byBarcode) {
        produtoId = byBarcode.id
        // Update existing product
        await supabase
          .from('produtos')
          .update({
            preco_custo: item.preco_custo,
            preco_venda: item.preco_venda,
            margem_lucro: item.ganho_pct,
            estoque: Number(byBarcode.estoque || 0) + item.quantidade,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', produtoId)
        produtos_atualizados++
      }
    }

    if (!produtoId && item.produto && item.tamanho && item.cor) {
      const { data: byDesc } = await supabase
        .from('produtos')
        .select('id, estoque')
        .ilike('descricao', item.produto)
        .eq('tamanho', item.tamanho)
        .eq('cor', item.cor)
        .maybeSingle()
      if (byDesc) {
        produtoId = byDesc.id
        await supabase
          .from('produtos')
          .update({
            preco_custo: item.preco_custo,
            preco_venda: item.preco_venda,
            margem_lucro: item.ganho_pct,
            estoque: Number(byDesc.estoque || 0) + item.quantidade,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', produtoId)
        produtos_atualizados++
      }
    }

    if (!produtoId) {
      // Create new product
      const { data: novoProd, error: errProd } = await supabase
        .from('produtos')
        .insert({
          descricao: item.produto,
          sub_grupo: item.sub_grupo || null,
          marca: item.marca || null,
          partes: item.partes || null,
          tamanho: item.tamanho || null,
          cor: item.cor || null,
          cod_barras,
          preco_custo: item.preco_custo,
          preco_venda: item.preco_venda,
          margem_lucro: item.ganho_pct,
          estoque: item.quantidade,
          grupo: cabecalho.grupo || null,
          fornecedor: cabecalho.fornecedor_nome || null,
          ativo: true,
        })
        .select('id')
        .single()

      if (errProd)
        return NextResponse.json({ erro: `Erro ao criar produto "${item.produto}": ${errProd.message}` }, { status: 500 })

      produtoId = novoProd.id
      produtos_criados++
    }

    itensProcessados.push({
      cod_produto: produtoId,
      cod_barras,
      produto: item.produto,
      sub_grupo: item.sub_grupo,
      marca: item.marca,
      partes: item.partes,
      tamanho: item.tamanho,
      cor: item.cor,
      quantidade: item.quantidade,
      valor_unitario: item.preco_custo,
      sub_total: item.quantidade * item.preco_custo,
      preco_venda: item.preco_venda,
      margem_valor: item.ganho_rs,
      margem_porcent: item.ganho_pct,
    })
  }

  // 3. Compute totals
  const valor_total = itensProcessados.reduce((s, i) => s + i.sub_total, 0)
  const valor_venda_total = itensProcessados.reduce((s, i) => s + i.preco_venda * i.quantidade, 0)
  const ganho_total = valor_venda_total - valor_total
  const total_pecas = itensProcessados.reduce((s, i) => s + i.quantidade, 0)

  // 4. Create compra record
  const { data: compra, error: errCompra } = await supabase
    .from('compras')
    .insert({
      data: cabecalho.data || hoje,
      nota_numero: cabecalho.nota_numero ? parseInt(cabecalho.nota_numero) : null,
      cod_fornecedor: cabecalho.fornecedor_id || null,
      grupo: cabecalho.grupo || null,
      evento: cabecalho.evento || null,
      valor_total,
      forma_pagamento: cabecalho.forma_pagamento || null,
      status: 'Finalizada',
    })
    .select()
    .single()

  if (errCompra) return NextResponse.json({ erro: errCompra.message }, { status: 500 })

  // 5. Insert compras_itens
  const { error: errItens } = await supabase
    .from('compras_itens')
    .insert(itensProcessados.map(i => ({ ...i, cod_compra: compra.id })))
  if (errItens) console.error('Erro compras_itens:', errItens.message)

  // 6. Create contas_a_pagar if forma_pagamento requires it
  // PIX and Dinheiro are paid immediately — no accounts payable entry needed
  const fpag = cabecalho.forma_pagamento
  if (fpag && fpag !== 'PIX' && fpag !== 'Dinheiro') {
    // Boleto/Duplicata: +30 days; Cartão: purchase date
    const dataBase = cabecalho.data || hoje
    let vencimento = dataBase
    if (fpag === 'Boleto' || fpag === 'Duplicata') {
      const d = new Date(dataBase + 'T12:00:00')
      d.setDate(d.getDate() + 30)
      vencimento = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    }
    // Read contas_a_pagar schema before this task to confirm column names.
    // Typical columns based on existing handler: cod_fornecedor, cod_compra, valor,
    // data_lancamento, data_vencimento, historico, forma_pagamento, pago, status
    // Adjust the insert below if column names differ in your schema.
    const { error: errCp } = await supabase
      .from('contas_a_pagar')
      .insert({
        cod_fornecedor: cabecalho.fornecedor_id || null,
        cod_compra: compra.id,
        valor: valor_total,
        data_lancamento: dataBase,
        data_vencimento: vencimento,
        historico: `Compra #${compra.id}${cabecalho.nota_numero ? ` — NF ${cabecalho.nota_numero}` : ''}`,
        forma_pagamento: fpag,
        pago: false,
      })
    if (errCp) console.error('Erro contas_a_pagar:', errCp.message)
  }

  return NextResponse.json({
    id: compra.id,
    total_pecas,
    valor_total,
    valor_venda_total,
    ganho_total,
    produtos_criados,
    produtos_atualizados,
    itens: itensProcessados.map(i => ({
      produto: i.produto,
      cod_barras: i.cod_barras,
      quantidade: i.quantidade,
      preco_custo: i.valor_unitario,
      preco_venda: i.preco_venda,
    })),
  }, { status: 201 })
}
```

**⚠️ CRITICAL:** Before writing this file, read the current `/api/compras/route.ts` and check the actual columns of `contas_a_pagar`. If the column names in the INSERT at step 6 don't match the real schema, fix them before committing.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/compras/route.ts
git commit -m "feat(compras): POST upserts products with EAN-13; GET returns aggregates"
```

---

### Task 4: Rewrite `src/app/compras/nova/page.tsx`

**Files:**
- Rewrite: `src/app/compras/nova/page.tsx`

This is the spreadsheet grid. The AutocompleteInput component exists at `src/components/ui/AutocompleteInput.tsx` — import it directly.

- [ ] **Step 1: Read AutocompleteInput to confirm props**

```bash
head -15 "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER/src/components/ui/AutocompleteInput.tsx"
```

Confirm: `{ value: string, onChange: (v: string) => void, options: string[], placeholder?: string, disabled?: boolean }`

- [ ] **Step 2: Write the complete new `nova/page.tsx`**

```typescript
'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
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

  useEffect(() => {
    fetch('/api/compras/opcoes').then(r => r.json()).then(d => setOpcoes(d)).catch(() => {})
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
        // Keep ganho_pct, recalculate ganho_rs and preco_venda
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

  const adicionarLinha = useCallback(() => {
    const nova = novaLinha()
    setLinhas(prev => [...prev, nova])
    // Focus the sub_grupo input of the new row after render
    setTimeout(() => {
      const el = document.querySelector(`[data-rowid="${nova.id}"] input`) as HTMLInputElement | null
      el?.focus()
    }, 80)
  }, [])

  const removerLinha = useCallback((id: string) => {
    setLinhas(prev => prev.filter(l => l.id !== id))
  }, [])

  const duplicarLinha = useCallback((id: string) => {
    setLinhas(prev => {
      const idx = prev.findIndex(l => l.id === id)
      if (idx < 0) return prev
      const nova: ItemRow = { ...prev[idx], id: `r${rowSeq++}`, quantidade: 1, cor: '' }
      return [...prev.slice(0, idx + 1), nova, ...prev.slice(idx + 1)]
    })
  }, [])

  const handleTabLast = useCallback((e: React.KeyboardEvent, rowId: string) => {
    if (e.key !== 'Tab' || e.shiftKey) return
    setLinhas(current => {
      const isLast = current[current.length - 1]?.id === rowId
      if (isLast) {
        e.preventDefault()
        const nova = novaLinha()
        setTimeout(() => {
          const el = document.querySelector(`[data-rowid="${nova.id}"] input`) as HTMLInputElement | null
          el?.focus()
        }, 80)
        return [...current, nova]
      }
      return current
    })
  }, [])

  // Totals
  const totalPecas = linhas.reduce((s, l) => s + Number(l.quantidade), 0)
  const totalCusto = linhas.reduce((s, l) => s + l.sub_total, 0)
  const totalVenda = linhas.reduce((s, l) => s + l.preco_venda * Number(l.quantidade), 0)
  const totalGanho = totalVenda - totalCusto

  async function finalizar() {
    const novosErros: Record<string, string> = {}
    if (linhas.length === 0) { setErros({ geral: 'Adicione pelo menos um item.' }); return }
    for (const l of linhas) {
      if (!l.sub_grupo)                   novosErros[`${l.id}-sub_grupo`]    = 'Obrigatório'
      if (!l.produto)                      novosErros[`${l.id}-produto`]      = 'Obrigatório'
      if (!l.preco_custo || l.preco_custo <= 0) novosErros[`${l.id}-preco_custo`] = 'Obrigatório'
      if (!l.preco_venda || l.preco_venda <= 0) novosErros[`${l.id}-preco_venda`] = 'Obrigatório'
      if (Number(l.quantidade) < 1)        novosErros[`${l.id}-quantidade`]   = 'Mín 1'
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

  // ── Styles ──
  const input: React.CSSProperties = {
    background: '#111', color: '#F2EBD9', border: '1px solid #2a2418',
    borderRadius: 6, padding: '6px 8px', fontSize: 12, width: '100%', outline: 'none', boxSizing: 'border-box',
  }
  const errInput = (field: string, rowId: string): React.CSSProperties =>
    erros[`${rowId}-${field}`] ? { ...input, borderColor: '#E5584A' } : input
  const cell: React.CSSProperties = { padding: '3px 3px', verticalAlign: 'top' }
  const th: React.CSSProperties = {
    padding: '8px 6px', color: '#8a7a60', fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', textAlign: 'left',
  }

  // ── Success screen ──
  if (concluido) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px', fontFamily: 'inherit' }}>
        <style>{`@media print { .no-print { display: none !important; } }`}</style>
        <div style={{ background: '#1a1610', border: '1px solid #C9A84C', borderRadius: 12, padding: 28, marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 6, color: '#C9A84C' }}>✓</div>
          <h2 style={{ color: '#C9A84C', margin: '0 0 20px', fontSize: 20 }}>Compra Finalizada!</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {([
              ['Produtos criados',    concluido.produtos_criados],
              ['Produtos atualizados',concluido.produtos_atualizados],
              ['Total de peças',      concluido.total_pecas],
              ['Valor da compra',     `R$ ${BRL(concluido.valor_total)}`],
              ['Valor a venda',       `R$ ${BRL(concluido.valor_venda_total)}`],
              ['Ganho previsto',      `R$ ${BRL(concluido.ganho_total)}`],
            ] as [string, string | number][]).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: '#8a7a60', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 17, color: '#F2EBD9', fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Print table */}
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
          <button onClick={() => window.print()} style={{ padding: '10px 18px', background: '#222', color: '#F2EBD9', border: '1px solid #444', borderRadius: 8, cursor: 'pointer' }}>
            🖨 Imprimir relatório
          </button>
          <button onClick={resetar} style={{ padding: '10px 20px', background: '#C9A84C', color: '#111', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            + Nova Compra
          </button>
          <button onClick={() => router.push('/produtos')} style={{ padding: '10px 18px', background: '#1a1610', color: '#F2EBD9', border: '1px solid #333', borderRadius: 8, cursor: 'pointer' }}>
            Ver estoque atualizado
          </button>
        </div>
      </div>
    )
  }

  // ── Main form ──
  return (
    <div style={{ padding: '20px 16px', fontFamily: 'inherit' }}>
      <style>{`
        @media print { .no-print { display: none !important; } }
        input:focus { border-color: #C9A84C !important; box-shadow: none; }
        select:focus { border-color: #C9A84C !important; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>

      {/* Page header */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => router.push('/compras')} style={{ background: 'none', border: 'none', color: '#8a7a60', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: 20, color: '#C9A84C', fontWeight: 700 }}>Nova Compra</h1>
      </div>

      {/* Cabeçalho da compra */}
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

      {/* Error banner */}
      {erros.geral && (
        <div className="no-print" style={{ background: '#2a1010', border: '1px solid #E5584A', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#E5584A', fontSize: 13 }}>
          {erros.geral}
        </div>
      )}

      {/* Items grid */}
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

                  {/* Cód. Barras */}
                  <td style={cell}>
                    <input value={l.cod_barras} onChange={e => updateLinha(l.id, 'cod_barras', e.target.value)} placeholder="Auto (EAN-13)" style={{ ...input, fontFamily: 'monospace', fontSize: 11 }} />
                  </td>

                  {/* Sub-Grupo */}
                  <td style={cell} data-rowid={l.id}>
                    <AutocompleteInput value={l.sub_grupo} onChange={v => updateLinha(l.id, 'sub_grupo', v)} options={opcoes.subgrupos} placeholder="Sub-grupo *" />
                    {erros[`${l.id}-sub_grupo`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>

                  {/* Marca */}
                  <td style={cell}>
                    <AutocompleteInput value={l.marca} onChange={v => updateLinha(l.id, 'marca', v)} options={opcoes.marcas} placeholder="Marca" />
                  </td>

                  {/* Produto */}
                  <td style={cell}>
                    <input value={l.produto} onChange={e => updateLinha(l.id, 'produto', e.target.value)} placeholder="Descrição *" style={errInput('produto', l.id)} />
                    {erros[`${l.id}-produto`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>

                  {/* Partes */}
                  <td style={cell}>
                    <select value={l.partes} onChange={e => updateLinha(l.id, 'partes', e.target.value)} style={{ ...input, cursor: 'pointer' }}>
                      {PARTES_OPCOES.map(p => <option key={p} value={p}>{p || '—'}</option>)}
                    </select>
                  </td>

                  {/* Tamanho */}
                  <td style={cell}>
                    <AutocompleteInput value={l.tamanho} onChange={v => updateLinha(l.id, 'tamanho', v)} options={opcoes.tamanhos} placeholder="Tam." />
                  </td>

                  {/* Cor */}
                  <td style={cell}>
                    <AutocompleteInput value={l.cor} onChange={v => updateLinha(l.id, 'cor', v)} options={opcoes.cores} placeholder="Cor" />
                  </td>

                  {/* Quantidade */}
                  <td style={cell}>
                    <input type="number" min={1} value={l.quantidade}
                      onChange={e => updateLinha(l.id, 'quantidade', parseInt(e.target.value) || 0)}
                      style={{ ...errInput('quantidade', l.id), textAlign: 'right' }} />
                  </td>

                  {/* Preço Custo */}
                  <td style={cell}>
                    <input type="number" min={0} step={0.01} value={l.preco_custo || ''}
                      onChange={e => updateLinha(l.id, 'preco_custo', parseFloat(e.target.value) || 0)}
                      placeholder="0,00" style={{ ...errInput('preco_custo', l.id), textAlign: 'right' }} />
                    {erros[`${l.id}-preco_custo`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>

                  {/* Sub-Total (readonly) */}
                  <td style={cell}>
                    <input value={BRL(l.sub_total)} readOnly style={{ ...input, textAlign: 'right', color: '#8a7a60', cursor: 'default' }} />
                  </td>

                  {/* Ganho R$ */}
                  <td style={cell}>
                    <input type="number" min={0} step={0.01} value={l.ganho_rs || ''}
                      onChange={e => updateLinha(l.id, 'ganho_rs', parseFloat(e.target.value) || 0)}
                      placeholder="0,00" style={{ ...input, textAlign: 'right' }} />
                  </td>

                  {/* Ganho % */}
                  <td style={cell}>
                    <input type="number" min={0} step={0.1}
                      value={l.ganho_pct ? parseFloat(l.ganho_pct.toFixed(1)) : ''}
                      onChange={e => updateLinha(l.id, 'ganho_pct', parseFloat(e.target.value) || 0)}
                      placeholder="0,0" style={{ ...input, textAlign: 'right' }} />
                  </td>

                  {/* Preço Venda */}
                  <td style={cell}>
                    <input type="number" min={0} step={0.01} value={l.preco_venda || ''}
                      onChange={e => updateLinha(l.id, 'preco_venda', parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      style={{ ...errInput('preco_venda', l.id), textAlign: 'right', color: '#C9A84C' }}
                      onKeyDown={e => { if (isLast) handleTabLast(e, l.id) }}
                    />
                    {erros[`${l.id}-preco_venda`] && <div style={{ color: '#E5584A', fontSize: 9, marginTop: 1 }}>Obrigatório</div>}
                  </td>

                  {/* Actions */}
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

      {/* Add line */}
      <div className="no-print" style={{ marginBottom: 20 }}>
        <button onClick={adicionarLinha} style={{ padding: '8px 18px', background: '#1a1610', border: '1px solid #C9A84C', color: '#C9A84C', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          + Adicionar linha
        </button>
      </div>

      {/* Totalizador */}
      <div style={{ background: '#1a1610', border: '1px solid #2a2418', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {([
          ['Total de peças',    String(totalPecas),        false],
          ['Valor da compra',   `R$ ${BRL(totalCusto)}`,  false],
          ['Valor a venda',     `R$ ${BRL(totalVenda)}`,  false],
          ['Ganho previsto',    `R$ ${BRL(totalGanho)}`,  true ],
        ] as [string, string, boolean][]).map(([label, val, gold]) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: '#8a7a60', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: gold ? '#C9A84C' : '#F2EBD9' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Finalizar */}
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/compras/nova/page.tsx
git commit -m "feat(compras): spreadsheet grid for mass merchandise entry"
```

---

### Task 5: Update `src/app/compras/page.tsx` (list view)

**Files:**
- Modify: `src/app/compras/page.tsx`

- [ ] **Step 1: Read current file**

```bash
cat "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER/src/app/compras/page.tsx"
```

- [ ] **Step 2: Update the list view**

The GET `/api/compras` now returns `qtd_pecas`, `valor_venda_total`, `ganho_previsto`, `status` per compra (added in Task 3). Update the page to show these columns.

New column order: **Data | Fornecedor | Grupo / Evento | Qtd Peças | Valor Custo | Valor Venda | Ganho Previsto | Status**

Make these changes to the current file:
1. Add `const BRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` near the top of the component.
2. Replace the `<thead>` columns to match the new column order.
3. Replace the `<tbody>` row cells to render the new columns, using `BRL()` for monetary values and `c.status || 'Finalizada'` for status.

New header cells:
```tsx
<th>Data</th>
<th>Fornecedor</th>
<th>Grupo / Evento</th>
<th style={{ textAlign: 'right' }}>Qtd Peças</th>
<th style={{ textAlign: 'right' }}>Valor Custo</th>
<th style={{ textAlign: 'right' }}>Valor Venda</th>
<th style={{ textAlign: 'right' }}>Ganho Previsto</th>
<th>Status</th>
```

New body cells (use the same styles as existing cells in the file — preserve onClick and row styles):
```tsx
<td>{formatarData(c.data)}</td>
<td>{c.fornecedor_nome || c.fornecedores?.nome || '—'}</td>
<td>{[c.grupo, c.evento].filter(Boolean).join(' / ') || '—'}</td>
<td style={{ textAlign: 'right' }}>{c.qtd_pecas || 0} pç</td>
<td style={{ textAlign: 'right' }}>R$ {BRL(c.valor_total || 0)}</td>
<td style={{ textAlign: 'right' }}>R$ {BRL(c.valor_venda_total || 0)}</td>
<td style={{ textAlign: 'right', color: '#C9A84C' }}>R$ {BRL(c.ganho_previsto || 0)}</td>
<td>{c.status || 'Finalizada'}</td>
```

Note: read the current file to see exact existing variable names (`c.fornecedores?.nome` vs `c.fornecedor_nome`) and adjust accordingly based on what the API actually returns.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/compras/page.tsx
git commit -m "feat(compras): list view with qty, venda, ganho, status columns"
```

---

### Task 6: Build + Deploy

**Files:** None modified.

- [ ] **Step 1: Run the production build**

```bash
cd "/Users/alkmimsilva/Documents/Claude Code/SISTEMA-JEITO-DE-SER"
npm run build 2>&1
```

Expected: `✓ Compiled successfully` with zero TypeScript errors. If errors appear, read the relevant files and fix them before proceeding.

- [ ] **Step 2: Deploy to Vercel**

```bash
vercel --prod --yes
```

- [ ] **Step 3: ⚠️ Remind user to run SQL migration**

The migration `supabase/migrations/003_compras_melhorias.sql` must be run manually:
1. Go to Supabase → SQL Editor → New query
2. Paste and execute:
```sql
ALTER TABLE compras ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS status text DEFAULT 'Finalizada';
```
Without this, saving a new purchase will still work (Supabase ignores unknown columns on insert) but the `forma_pagamento` and `status` columns won't persist.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: build verified, compras module deployed"
```

---

## Self-Review

### 1. Spec coverage

| Spec Section | Task |
|---|---|
| PARTE 1 — Cabeçalho (fornecedor, data, nota, grupo, evento, forma_pagamento) | Task 4 |
| PARTE 2 — Grade com 13 colunas por linha | Task 4 |
| Sub-Total calculado automaticamente | Task 4 (updateLinha) |
| Bidirectional Ganho R$ ↔ Ganho % ↔ Preço Venda | Task 4 (updateLinha) |
| Totalizador (peças, custo, venda, ganho) | Task 4 |
| PARTE 3 — [+ Adicionar linha], Tab→nova linha, Duplicar, ✕ | Task 4 |
| PARTE 4 — Geração EAN-13 com dígito verificador | Tasks 2 + 3 |
| Barcode filled → use it; empty → generate | Task 3 POST handler |
| PARTE 5 — Produto não existe: INSERT; existe: UPDATE estoque + preços | Task 3 POST handler |
| Registrar compras_itens com todos os campos | Task 3 POST handler |
| Registrar compras com cabeçalho | Task 3 POST handler |
| Criar conta_a_pagar se forma_pagamento != PIX/Dinheiro | Task 3 POST handler |
| PARTE 6 — Tela pós-finalização: resumo + imprimir + nova compra + ver estoque | Task 4 (success screen) |
| PARTE 7 — Listagem com Qtd Peças, Valor Venda, Ganho Previsto, Status | Tasks 3 (GET) + 5 |
| PARTE 8 — GET /api/compras/opcoes | Task 1 |
| PARTE 8 — GET /api/compras/proximo-codigo-barras | Task 2 |
| PARTE 8 — POST /api/compras com upsert de produtos | Task 3 |
| Validações obrigatórias inline por campo | Task 4 |
| npm run build + vercel --prod | Task 6 |

All 20 spec requirements covered. ✅

### 2. Placeholder scan

No TBDs, no "implement later", no vague steps. All code blocks are complete and self-contained. ✅

### 3. Type consistency

- `ItemRow` defined in Task 4 with fields `ganho_rs`, `ganho_pct`, `preco_venda` — matches POST body in Task 3 (`itens: Array<{ ganho_rs, ganho_pct, preco_venda, ... }>`)
- `ResultadoCompra` in Task 4 has `valor_venda_total`, `ganho_total` — matches `{ valor_venda_total, ganho_total }` returned by POST in Task 3
- `Opcoes.subgrupos` (flat `string[]`) — matches GET response in Task 1 (`subgrupos: string[]`)
- `compras_itens` insert in Task 3 uses: `valor_unitario`, `sub_total`, `margem_valor`, `margem_porcent` — matches schema columns confirmed in investigation
- `cabecalho.fornecedor_id` used in Task 3 for `cod_fornecedor` — consistent with `compras.cod_fornecedor` FK in schema
- `aggMap` in GET handler returns `qtd_pecas`, `valor_venda_total`, `ganho_previsto` — consumed in Task 5 list view as `c.qtd_pecas`, `c.valor_venda_total`, `c.ganho_previsto` ✅
