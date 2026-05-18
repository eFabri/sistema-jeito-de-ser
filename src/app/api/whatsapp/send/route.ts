// src/app/api/whatsapp/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { enviarMensagem, processarTemplate } from '@/lib/whatsapp'

// POST — enviar mensagem individual ou em lote
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { tipo, cod_cliente, numero, template_id, mensagem_custom } = await req.json()

  // Buscar template se necessário
  let mensagemFinal = mensagem_custom || ''
  if (template_id && !mensagem_custom) {
    const { data: tmpl } = await supabase
      .from('whatsapp_modelos').select('mensagem').eq('id', template_id).single()
    if (tmpl) mensagemFinal = tmpl.mensagem
  }

  // Buscar dados do cliente para substituir variáveis
  if (cod_cliente) {
    const { data: cli } = await supabase
      .from('clientes').select('*').eq('id', cod_cliente).single()
    const { data: car } = cod_cliente ? await supabase
      .from('contas_a_receber')
      .select('*').eq('cod_cliente', cod_cliente).eq('pago', false)
      .order('data_vencimento').limit(1).single() : { data: null }

    if (cli) {
      mensagemFinal = processarTemplate(mensagemFinal, {
        nome: cli.nome?.split(' ')[0] || '',
        nome_completo: cli.nome || '',
        parcela: car?.parcela || '—',
        valor: car ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(car.valor) : '—',
        data_vencimento: car ? new Date(car.data_vencimento).toLocaleDateString('pt-BR') : '—',
        dias: '—',
      })
    }
  }

  const numeroEnvio = numero
  if (!numeroEnvio || !mensagemFinal) {
    return NextResponse.json({ erro: 'Número e mensagem são obrigatórios' }, { status: 400 })
  }

  try {
    await enviarMensagem({ numero: numeroEnvio, mensagem: mensagemFinal })

    // Registrar log
    await supabase.from('whatsapp_logs').insert({
      tipo: tipo || 'manual',
      cod_cliente: cod_cliente || null,
      numero: numeroEnvio,
      mensagem: mensagemFinal,
      status: 'enviado',
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    await supabase.from('whatsapp_logs').insert({
      tipo: tipo || 'manual',
      cod_cliente: cod_cliente || null,
      numero: numeroEnvio,
      mensagem: mensagemFinal,
      status: 'erro',
      erro: e.message,
    })
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}

// POST /api/whatsapp/send/lote — disparar para todos aniversariantes ou vencimentos
export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { tipo } = await req.json() // 'aniversario' | 'cobranca_5d'

  let tmpl: any = null
  if (tipo === 'aniversario') {
    // Sortear uma das 5 variações
    const { data: templates } = await supabase
      .from('whatsapp_modelos')
      .select('*')
      .like('tipo', 'aniversario_%')
      .eq('ativo', true)
    if (templates?.length) {
      tmpl = templates[Math.floor(Math.random() * templates.length)]
    }
  } else {
    const { data } = await supabase
      .from('whatsapp_modelos').select('*').eq('tipo', tipo).eq('ativo', true).single()
    tmpl = data
  }
  if (!tmpl) return NextResponse.json({ erro: 'Template não encontrado ou inativo' }, { status: 404 })

  let lista: any[] = []
  const hoje = new Date().toISOString().split('T')[0]

  if (tipo === 'aniversario') {
    const { data } = await supabase.rpc('aniversariantes_hoje')
    lista = (data || []).filter((c: any) => c.whatsapp)
  } else if (tipo === 'cobranca_5d') {
    const { data } = await supabase.rpc('vencimentos_proximos', { dias: 5 })
    lista = (data || []).filter((v: any) => v.dias_para_vencer === 5 && v.whatsapp)
  }

  let enviados = 0; let erros = 0
  for (const item of lista) {
    const vars: Record<string, string> = {
      nome: (item.nome || item.nome_cliente || '')?.split(' ')[0],
      parcela: item.parcela || '—',
      valor: item.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor) : '—',
      data_vencimento: item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '—',
      dias: String(item.dias_para_vencer || ''),
    }
    const msg = processarTemplate(tmpl.mensagem, vars)
    try {
      await enviarMensagem({ numero: item.whatsapp, mensagem: msg })
      await supabase.from('whatsapp_logs').insert({
        tipo, cod_cliente: item.id || item.cod_cliente,
        numero: item.whatsapp, mensagem: msg, status: 'enviado',
      })
      enviados++
    } catch (e: any) {
      await supabase.from('whatsapp_logs').insert({
        tipo, cod_cliente: item.id || item.cod_cliente,
        numero: item.whatsapp, mensagem: msg, status: 'erro', erro: e.message,
      })
      erros++
    }
    // Pausa entre envios para evitar bloqueio do WhatsApp
    await new Promise(r => setTimeout(r, 1200))
  }

  return NextResponse.json({ ok: true, enviados, erros, total: lista.length })
}
