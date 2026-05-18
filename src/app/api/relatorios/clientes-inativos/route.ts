// src/app/api/relatorios/clientes-inativos/route.ts
// Lista clientes que NÃO compraram nos últimos X dias (default 30).
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const dias  = parseInt(searchParams.get('dias')  || '30')
  const limit = parseInt(searchParams.get('limit') || '500')

  const corte = new Date()
  corte.setDate(corte.getDate() - dias)
  const corteStr = corte.toISOString().split('T')[0]

  // Pega cod_cliente distintos de vendas a partir do corte (clientes ATIVOS recentes)
  const { data: vendasRecentes, error: errV } = await supabase
    .from('vendas')
    .select('cod_cliente')
    .gte('data', corteStr)
    .not('cod_cliente', 'is', null)
  if (errV) return NextResponse.json({ erro: errV.message }, { status: 500 })

  const idsAtivos = new Set<number>()
  ;(vendasRecentes || []).forEach((v: any) => v.cod_cliente && idsAtivos.add(v.cod_cliente))

  // Busca todos os clientes ativos, exclui os ativos recentes (paginação manual)
  const todos: any[] = []
  let offset = 0
  const pageSize = 1000
  while (todos.length < limit + idsAtivos.size + 100) {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome, celular, whatsapp, cidade, categoria, limite_credito, data_cadastro')
      .eq('ativo', true)
      .order('nome')
      .range(offset, offset + pageSize - 1)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    todos.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  const inativos = todos
    .filter(c => !idsAtivos.has(c.id))
    .slice(0, limit)

  // Pra cada inativo, busca a data da ÚLTIMA compra (mais lenta — limito a primeiros N)
  // Faz uma única query consolidada via in()
  const ids = inativos.map(c => c.id)
  const ultimasCompras: Record<number, string> = {}
  if (ids.length > 0) {
    // Em batches de 200 pra não estourar URL
    for (let i = 0; i < ids.length; i += 200) {
      const lote = ids.slice(i, i + 200)
      const { data } = await supabase
        .from('vendas')
        .select('cod_cliente, data')
        .in('cod_cliente', lote)
        .order('data', { ascending: false })
      ;(data || []).forEach((v: any) => {
        if (v.cod_cliente && !ultimasCompras[v.cod_cliente]) {
          ultimasCompras[v.cod_cliente] = v.data
        }
      })
    }
  }

  const hoje = new Date()
  const resultado = inativos.map(c => {
    const ultima = ultimasCompras[c.id]
    let diasDesde: number | null = null
    if (ultima) {
      const u = new Date(ultima + 'T00:00:00')
      diasDesde = Math.floor((hoje.getTime() - u.getTime()) / (1000 * 60 * 60 * 24))
    }
    return { ...c, ultima_compra: ultima || null, dias_sem_comprar: diasDesde }
  })
  // Ordena: nunca comprou primeiro, depois maior dias_sem_comprar
  resultado.sort((a, b) => {
    if (a.dias_sem_comprar === null && b.dias_sem_comprar !== null) return -1
    if (b.dias_sem_comprar === null && a.dias_sem_comprar !== null) return 1
    return (b.dias_sem_comprar || 0) - (a.dias_sem_comprar || 0)
  })

  return NextResponse.json({
    total: resultado.length,
    dias_corte: dias,
    clientes: resultado,
  })
}
