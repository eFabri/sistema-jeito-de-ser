// src/app/api/compras/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// GET /api/compras?q=&pagina=&limite=
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '25')
  const offset = (pagina - 1) * limite

  // Join com fornecedores pra trazer o nome
  let query = supabase
    .from('compras')
    .select('id, data, nota_numero, valor_total, grupo, evento, cod_fornecedor, fornecedores(nome)', { count: 'exact' })
    .order('data', { ascending: false })
    .range(offset, offset + limite - 1)

  if (q) {
    // busca por número da nota ou nome do fornecedor (nome via filter no resultado)
    const isNum = /^\d+$/.test(q)
    if (isNum) query = query.eq('nota_numero', parseInt(q))
    else query = query.ilike('grupo', `%${q}%`)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // achata fornecedor
  const compras = (data || []).map((c: any) => ({
    ...c,
    fornecedor_nome: c.fornecedores?.nome || null,
    fornecedores: undefined,
  }))

  return NextResponse.json({ compras, total: count, pagina, limite })
}

// POST /api/compras — cria compra + itens + atualiza estoque + gera contas_a_pagar opcionais
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const body = await req.json()

  const {
    data, nota_numero, cod_fornecedor, grupo, evento, documento,
    itens,         // [{ cod_produto, produto, cod_barras, quantidade, valor_unitario, preco_venda, atualiza_estoque, atualiza_preco }]
    parcelas,      // [{ data_vencimento, valor }] (opcional — geram contas_a_pagar)
  } = body

  if (!data) return NextResponse.json({ erro: 'data é obrigatória' }, { status: 400 })
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ erro: 'pelo menos um item é obrigatório' }, { status: 400 })
  }

  const valor_total = itens.reduce((s: number, i: any) => s + (i.quantidade * i.valor_unitario), 0)

  // 1. Cria a compra
  const { data: compra, error: errCompra } = await supabase
    .from('compras')
    .insert({ data, nota_numero: nota_numero || null, cod_fornecedor: cod_fornecedor || null, grupo, evento, documento, valor_total })
    .select()
    .single()
  if (errCompra) return NextResponse.json({ erro: errCompra.message }, { status: 500 })

  // 2. Insere itens
  const itensInsert = itens.map((i: any) => ({
    cod_compra: compra.id,
    cod_produto: i.cod_produto || null,
    produto: i.produto,
    cod_barras: i.cod_barras || null,
    quantidade: i.quantidade,
    valor_unitario: i.valor_unitario,
    sub_total: i.quantidade * i.valor_unitario,
    preco_venda: i.preco_venda || null,
    atualiza_estoque: i.atualiza_estoque !== false,
    atualiza_preco: !!i.atualiza_preco,
  }))
  const { error: errItens } = await supabase.from('compras_itens').insert(itensInsert)
  if (errItens) {
    // rollback da compra
    await supabase.from('compras').delete().eq('id', compra.id)
    return NextResponse.json({ erro: errItens.message }, { status: 500 })
  }

  // 3. Atualiza estoque e preço (para itens vinculados a produto existente)
  for (const item of itens) {
    if (!item.cod_produto) continue
    if (item.atualiza_estoque === false && !item.atualiza_preco) continue

    const { data: prod } = await supabase
      .from('produtos').select('estoque').eq('id', item.cod_produto).single()
    if (!prod) continue

    const updates: any = { atualizado_em: new Date().toISOString() }
    if (item.atualiza_estoque !== false) {
      updates.estoque = (Number(prod.estoque) || 0) + Number(item.quantidade)
    }
    if (item.atualiza_preco && item.preco_venda) {
      updates.preco_venda = item.preco_venda
      updates.preco_custo = item.valor_unitario
    }
    await supabase.from('produtos').update(updates).eq('id', item.cod_produto)
  }

  // 4. Gera contas a pagar (parcelas opcionais)
  if (Array.isArray(parcelas) && parcelas.length > 0) {
    const contas = parcelas.map((p: any, idx: number) => ({
      cod_fornecedor: cod_fornecedor || null,
      documento: documento || (nota_numero ? `NF ${nota_numero}` : `Compra #${compra.id}`),
      parcela: `${idx + 1}/${parcelas.length}`,
      data_vencimento: p.data_vencimento,
      valor: p.valor,
      pago: false,
    }))
    const { error: errCar } = await supabase.from('contas_a_pagar').insert(contas)
    if (errCar) {
      console.error('Erro ao gerar contas a pagar:', errCar.message)
      // não dá rollback — compra já tá no banco. Avisa no response.
      return NextResponse.json({
        ...compra, valor_total,
        aviso: 'Compra salva mas falhou ao gerar parcelas: ' + errCar.message,
      }, { status: 201 })
    }
  }

  return NextResponse.json({ ...compra, valor_total }, { status: 201 })
}
