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
