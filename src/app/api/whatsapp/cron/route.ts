// src/app/api/whatsapp/cron/route.ts
// ============================================================
// Rota chamada diariamente para disparar mensagens automáticas
// Configurar no Vercel Cron: todo dia às 9h
// vercel.json → { "crons": [{ "path": "/api/whatsapp/cron", "schedule": "0 9 * * *" }] }
// ============================================================

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { enviarMensagemAniversario, enviarMensagemCobranca } from '@/lib/whatsapp'
import { hojeNoBrasil } from '@/lib/dates'

export async function GET(request: Request) {
  // Verificar autenticação da cron (Vercel envia header especial)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = await createServerSupabase()
  const log = { aniversarios: 0, cobrancas: 0, erros: 0, detalhes: [] as string[] }

  // ─── ANIVERSARIANTES ──────────────────────────────────────
  try {
    // Sortear uma das 5 variações de aniversário
    const { data: templates } = await supabase
      .from('whatsapp_modelos')
      .select('mensagem')
      .like('tipo', 'aniversario_%')
      .eq('ativo', true)

    const template = templates?.length
      ? templates[Math.floor(Math.random() * templates.length)]
      : null

    if (template) {
      const { data: aniversariantes } = await supabase
        .rpc('aniversariantes_hoje')

      for (const cliente of aniversariantes || []) {
        // Verificar se já enviou hoje
        const hoje = hojeNoBrasil()
        const { data: jaEnviou } = await supabase
          .from('whatsapp_logs')
          .select('id')
          .eq('cod_cliente', cliente.id)
          .eq('tipo', 'aniversario')
          .gte('enviado_em', `${hoje}T00:00:00`)
          .single()

        if (jaEnviou) continue

        try {
          await enviarMensagemAniversario(template.mensagem, {
            nome: cliente.nome,
            whatsapp: cliente.whatsapp,
          })

          await supabase.from('whatsapp_logs').insert({
            tipo: 'aniversario',
            cod_cliente: cliente.id,
            numero: cliente.whatsapp,
            mensagem: template.mensagem,
            status: 'enviado',
          })

          log.aniversarios++
          log.detalhes.push(`🎂 Aniversário: ${cliente.nome}`)
        } catch (err: any) {
          log.erros++
          await supabase.from('whatsapp_logs').insert({
            tipo: 'aniversario',
            cod_cliente: cliente.id,
            numero: cliente.whatsapp,
            mensagem: template.mensagem,
            status: 'erro',
            erro: err.message,
          })
        }
      }
    }
  } catch (err: any) {
    log.detalhes.push(`❌ Erro aniversários: ${err.message}`)
  }

  // ─── COBRANÇAS — 5 DIAS ANTES ─────────────────────────────
  try {
    const { data: template } = await supabase
      .from('whatsapp_modelos')
      .select('mensagem')
      .eq('tipo', 'cobranca_5d')
      .eq('ativo', true)
      .single()

    if (template) {
      const { data: vencimentos } = await supabase
        .rpc('vencimentos_proximos', { dias: 5 })

      for (const item of vencimentos || []) {
        if (item.dias_para_vencer !== 5) continue // apenas exatamente 5 dias

        // Verificar se já enviou para esta parcela
        const { data: jaEnviou } = await supabase
          .from('contas_a_receber')
          .select('msg_enviada_5d')
          .eq('id', item.id)
          .single()

        if (jaEnviou?.msg_enviada_5d) continue

        try {
          await enviarMensagemCobranca(template.mensagem, {
            nome: item.nome_cliente,
            whatsapp: item.whatsapp,
            parcela: item.parcela,
            valor: item.valor,
            data_vencimento: item.data_vencimento,
            dias: 5,
          })

          // Marcar como enviado
          await supabase
            .from('contas_a_receber')
            .update({ msg_enviada_5d: true, msg_enviada_5d_em: new Date().toISOString() })
            .eq('id', item.id)

          await supabase.from('whatsapp_logs').insert({
            tipo: 'cobranca_5d',
            cod_cliente: item.cod_cliente,
            numero: item.whatsapp,
            mensagem: template.mensagem,
            status: 'enviado',
          })

          log.cobrancas++
          log.detalhes.push(`💰 Cobrança 5d: ${item.nome_cliente} — R$ ${item.valor}`)
        } catch (err: any) {
          log.erros++
          await supabase.from('whatsapp_logs').insert({
            tipo: 'cobranca_5d',
            cod_cliente: item.cod_cliente,
            numero: item.whatsapp,
            mensagem: template.mensagem,
            status: 'erro',
            erro: err.message,
          })
        }
      }
    }
  } catch (err: any) {
    log.detalhes.push(`❌ Erro cobranças: ${err.message}`)
  }

  return NextResponse.json({
    ok: true,
    data: new Date().toLocaleDateString('pt-BR'),
    ...log,
  })
}
