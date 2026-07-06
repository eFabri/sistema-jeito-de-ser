// src/app/api/produtos/opcoes/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const TAMANHOS_FIXOS = ['PP', 'P', 'M', 'G', 'GG', 'EG', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56']

export async function GET() {
  const supabase = await createServerSupabase()

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

  // Log errors but continue — partial data is better than a 500 for autocomplete
  for (const [name, result] of Object.entries({ grupos, subGrupos, cores, tamanhosBD, marcas, localizacoes, fornecedoresProd })) {
    if (result.error) console.error(`[opcoes] query ${name} failed:`, result.error.message)
  }

  const unique = (arr: string[]) => [...new Set(arr)].sort()

  const gruposArr = unique((grupos.data || []).map((r: any) => r.grupo).filter(Boolean))

  const subGruposMap: Record<string, string[]> = {}
  for (const r of (subGrupos.data || []) as any[]) {
    if (!r.grupo || !r.sub_grupo) continue
    if (!subGruposMap[r.grupo]) subGruposMap[r.grupo] = []
    if (!subGruposMap[r.grupo].includes(r.sub_grupo)) {
      subGruposMap[r.grupo].push(r.sub_grupo)
    }
  }
  for (const g of Object.keys(subGruposMap)) {
    subGruposMap[g].sort()
  }

  const coresArr = unique((cores.data || []).map((r: any) => r.cor).filter(Boolean))
  const tamanhosBDArr = unique((tamanhosBD.data || []).map((r: any) => r.tamanho).filter(Boolean))
  const tamanhosMerged = unique([...TAMANHOS_FIXOS, ...tamanhosBDArr])
  const marcasArr = unique((marcas.data || []).map((r: any) => r.marca).filter(Boolean))
  const locArr = unique((localizacoes.data || []).map((r: any) => r.localizacao).filter(Boolean))

  let fornArr: string[] = []
  if (fornecedoresTabela.data && fornecedoresTabela.data.length > 0) {
    fornArr = (fornecedoresTabela.data as any[]).map((r: any) => r.nome).filter(Boolean).sort()
  } else {
    fornArr = unique((fornecedoresProd.data || []).map((r: any) => r.fornecedor).filter(Boolean))
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
