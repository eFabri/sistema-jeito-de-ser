export const dynamic = 'force-dynamic'
// maxDuration=120 calibrado em 27/07/2026 com base no pico
// histórico de ~25-30 envios/dia. Se o volume diário crescer
// muito além disso, reavaliar — ver query de contagem por dia
// em whatsapp_logs antes de assumir que ainda cabe.
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { enviarMensagemAniversario, enviarMensagem, processarTemplate } from '@/lib/whatsapp'
import { hojeNoBrasil, diasAFrente } from '@/lib/dates'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Parse estrutural do JSON de resposta — robusto a espaços e aninhamento variável
function isSemWhatsapp(errMsg: string): boolean {
  try {
    const jsonStart = errMsg.indexOf('{')
    if (jsonStart === -1) return false
    const body = JSON.parse(errMsg.slice(jsonStart))
    const buscar = (obj: any): boolean => {
      if (obj && typeof obj === 'object') {
        if (obj.exists === false) return true
        return Object.values(obj).some(buscar)
      }
      return false
    }
    return buscar(body)
  } catch {}
  return false
}

async function garantirConexao(): Promise<{ ok: boolean; estadoVisto: string }> {
  const base = process.env.EVOLUTION_API_URL
  const key = process.env.EVOLUTION_API_KEY!
  const inst = process.env.EVOLUTION_INSTANCE

  const verificar = async (): Promise<string> => {
    try {
      const r = await fetch(`${base}/instance/connectionState/${inst}`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(8000),
      })
      const d = await r.json()
      return d?.instance?.state ?? d?.state ?? `http_${r.status}`
    } catch (e: unknown) {
      return `erro:${e instanceof Error ? e.message : String(e)}`
    }
  }

  const estado1 = await verificar()
  if (estado1 === 'open') return { ok: true, estadoVisto: estado1 }

  // Disparar reconexão uma vez e tentar 3 vezes com backoff (5s, 15s, 30s)
  // Baileys pode levar mais que 5s para reconectar sozinho após queda breve
  await fetch(`${base}/instance/connect/${inst}`, {
    method: 'GET',
    headers: { apikey: key },
    signal: AbortSignal.timeout(8000),
  }).catch(() => {})

  const backoffs = [5000, 10000, 15000]
  const estados: string[] = [`1:${estado1}`]

  for (let i = 0; i < backoffs.length; i++) {
    await sleep(backoffs[i])
    const estado = await verificar()
    estados.push(`${i + 2}:${estado}`)
    if (estado === 'open') return { ok: true, estadoVisto: estados.join(' ') }
  }

  return { ok: false, estadoVisto: estados.join(' ') }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  // bypass=true: pula lock E verificação de conexão — erros individuais de envio ainda aparecem nos logs
  const isBypass = url.searchParams.get('bypass') === 'true'

  if (!isBypass) {
    const { ok: whatsappOk, estadoVisto } = await garantirConexao()
    if (!whatsappOk) {
      return NextResponse.json({
        ok: false,
        erro: 'WhatsApp desconectado — reconexão automática falhou. Acesse o sistema para reconectar.',
        estadoVisto,
        data: hojeNoBrasil(),
      })
    }
  }

  const supabase = createServerSupabaseAdmin()
  const hoje = hojeNoBrasil()
  const em5dias = diasAFrente(5)

  if (!isBypass) {
    // Lock atômico: INSERT com UNIQUE(nome, data) — sem race condition
    // PostgreSQL garante atomicidade: só um INSERT por (nome, data) por dia
    const { error: errHb } = await supabase
      .from('cron_execucoes')
      .insert({ nome: 'whatsapp_cron', data: hoje })

    if (errHb) {
      if (errHb.code === '23505') {
        // Unique violation = cron já rodou hoje — ignorar silenciosamente
        return NextResponse.json({ ok: true, ignorada: true, motivo: 'execucao_duplicada_ignorada' })
      }
      // Outro erro (ex: tabela não existe) — fail-open: logar e prosseguir com os envios
      console.error('[cron] Lock falhou, prosseguindo:', errHb.code, errHb.message)
      try {
        await supabase.from('whatsapp_logs').insert({
          tipo: 'cron_heartbeat', status: 'erro_interno',
          erro: `[lock_cron] ${errHb.code}: ${errHb.message}`.slice(0, 500),
        })
      } catch {}
    }
  }

  const log = {
    aniversarios: 0,
    aniversariosCasamento: 0,
    sem_whatsapp: 0,
    aviso5d: 0,
    avisoDia: 0,
    erros: 0,
    detalhes: [] as string[],
  }

  // ─── ANIVERSARIANTES ──────────────────────────────────────
  try {
    const { data: templates } = await supabase
      .from('whatsapp_modelos')
      .select('mensagem')
      .like('tipo', 'aniversario_nascimento_%')
      .eq('ativo', true)

    const template = templates?.length
      ? templates[Math.floor(Math.random() * templates.length)]
      : null

    if (template) {
      const { data: aniversariantes } = await supabase.rpc('aniversariantes_hoje', { data_ref: hoje })

      for (const cliente of aniversariantes || []) {
        const { data: jaEnviouLista } = await supabase
          .from('whatsapp_logs')
          .select('id')
          .eq('cod_cliente', cliente.id)
          .eq('tipo', 'aniversario')
          .eq('status', 'enviado')
          .gte('enviado_em', `${hoje}T00:00:00`)
          .limit(1)

        if (jaEnviouLista && jaEnviouLista.length > 0) continue

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
          await sleep(1200)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          const semWhatsapp = isSemWhatsapp(msg)
          if (semWhatsapp) {
            log.sem_whatsapp++
            await supabase.from('clientes').update({ whatsapp_ativo: false }).eq('id', cliente.id)
            await supabase.from('whatsapp_logs').insert({
              tipo: 'aniversario', cod_cliente: cliente.id, numero: cliente.whatsapp,
              mensagem: template.mensagem, status: 'sem_whatsapp',
              erro: 'Número sem WhatsApp — desativado automaticamente',
            })
          } else {
            log.erros++
            await supabase.from('whatsapp_logs').insert({
              tipo: 'aniversario', cod_cliente: cliente.id, numero: cliente.whatsapp,
              mensagem: template.mensagem, status: 'erro', erro: msg,
            })
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.erros++
    log.detalhes.push(`❌ Erro aniversários: ${msg}`)
    try {
      await supabase.from('whatsapp_logs').insert({
        tipo: 'aniversario', cod_cliente: null, numero: null,
        mensagem: null, status: 'erro_interno',
        erro: `[bloco_aniversarios] ${msg.slice(0, 500)}`,
      })
    } catch {}
  }

  // ─── ANIVERSARIANTES DE CASAMENTO ────────────────────────
  try {
    const { data: tplCasamento } = await supabase
      .from('whatsapp_modelos')
      .select('mensagem')
      .eq('tipo', 'aniversario_casamento')
      .eq('ativo', true)
      .single()

    if (tplCasamento) {
      const { data: casamentos } = await supabase.rpc('aniversariantes_casamento_hoje', { data_ref: hoje })

      for (const cliente of casamentos || []) {
        const { data: jaEnviouLista } = await supabase
          .from('whatsapp_logs')
          .select('id')
          .eq('cod_cliente', cliente.id)
          .eq('tipo', 'aniversario_casamento')
          .eq('status', 'enviado')
          .gte('enviado_em', `${hoje}T00:00:00`)
          .limit(1)

        if (jaEnviouLista && jaEnviouLista.length > 0) continue

        try {
          await enviarMensagemAniversario(tplCasamento.mensagem, {
            nome: cliente.nome,
            whatsapp: cliente.whatsapp,
          })
          await supabase.from('whatsapp_logs').insert({
            tipo: 'aniversario_casamento',
            cod_cliente: cliente.id,
            numero: cliente.whatsapp,
            mensagem: tplCasamento.mensagem,
            status: 'enviado',
          })
          log.aniversariosCasamento++
          log.detalhes.push(`💍 Aniversário casamento: ${cliente.nome}`)
          await sleep(1200)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          const semWhatsapp = isSemWhatsapp(msg)
          if (semWhatsapp) {
            log.sem_whatsapp++
            await supabase.from('clientes').update({ whatsapp_ativo: false }).eq('id', cliente.id)
            await supabase.from('whatsapp_logs').insert({
              tipo: 'aniversario_casamento', cod_cliente: cliente.id, numero: cliente.whatsapp,
              mensagem: tplCasamento.mensagem, status: 'sem_whatsapp',
              erro: 'Número sem WhatsApp — desativado automaticamente',
            })
          } else {
            log.erros++
            await supabase.from('whatsapp_logs').insert({
              tipo: 'aniversario_casamento', cod_cliente: cliente.id, numero: cliente.whatsapp,
              mensagem: tplCasamento.mensagem, status: 'erro', erro: msg,
            })
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.erros++
    log.detalhes.push(`❌ Erro aniversário casamento: ${msg}`)
    try {
      await supabase.from('whatsapp_logs').insert({
        tipo: 'aniversario_casamento', cod_cliente: null, numero: null,
        mensagem: null, status: 'erro_interno',
        erro: `[bloco_casamento] ${msg.slice(0, 500)}`,
      })
    } catch {}
  }

  // ─── AVISO 5 DIAS ANTES ───────────────────────────────────
  try {
    const { data: tpl5d } = await supabase
      .from('whatsapp_modelos')
      .select('mensagem')
      .eq('tipo', 'cobranca_5d')
      .eq('ativo', true)
      .single()

    if (tpl5d) {
      const { data: parcelas5d } = await supabase
        .from('contas_a_receber')
        .select('id, parcela, data_vencimento, valor, clientes!cod_cliente(id, nome, whatsapp, whatsapp_ativo)')
        .eq('pago', false)
        .eq('msg_5d_enviada', false)
        .eq('data_vencimento', em5dias)
        .or('inadimplente.is.null,inadimplente.eq.false')

      for (const p of parcelas5d || []) {
        const cli = (p as any).clientes
        if (!cli?.whatsapp || cli?.whatsapp_ativo === false) continue

        const valorFmt = Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const dataFmt = (p.data_vencimento as string).split('-').reverse().join('/')
        const mensagem = processarTemplate(tpl5d.mensagem, {
          nome: cli.nome.split(' ')[0].toUpperCase(),
          valor: valorFmt,
          data_vencimento: dataFmt,
        })

        try {
          await enviarMensagem({ numero: cli.whatsapp, mensagem })

          await supabase
            .from('contas_a_receber')
            .update({ msg_5d_enviada: true, msg_5d_enviada_em: new Date().toISOString() })
            .eq('id', p.id)

          await supabase.from('whatsapp_logs').insert({
            tipo: 'cobranca_5d',
            cod_cliente: cli.id,
            numero: cli.whatsapp,
            mensagem,
            status: 'enviado',
          })

          log.aviso5d++
          log.detalhes.push(`💰 Aviso 5d: ${cli.nome} — ${valorFmt}`)
          await sleep(1200)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          const semWhatsapp = isSemWhatsapp(msg)
          if (semWhatsapp) {
            log.sem_whatsapp++
            await supabase.from('clientes').update({ whatsapp_ativo: false }).eq('id', cli.id)
            await supabase.from('whatsapp_logs').insert({
              tipo: 'cobranca_5d', cod_cliente: cli.id, numero: cli.whatsapp,
              mensagem, status: 'sem_whatsapp',
              erro: 'Número sem WhatsApp — desativado automaticamente',
            })
          } else {
            log.erros++
            await supabase.from('whatsapp_logs').insert({
              tipo: 'cobranca_5d', cod_cliente: cli.id, numero: cli.whatsapp,
              mensagem, status: 'erro', erro: msg,
            })
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.erros++
    log.detalhes.push(`❌ Erro aviso 5d: ${msg}`)
    try {
      await supabase.from('whatsapp_logs').insert({
        tipo: 'cobranca_5d', cod_cliente: null, numero: null,
        mensagem: null, status: 'erro_interno',
        erro: `[bloco_cobranca_5d] ${msg.slice(0, 500)}`,
      })
    } catch {}
  }

  // ─── LEMBRETE NO DIA DO VENCIMENTO ───────────────────────
  try {
    const { data: tplDia } = await supabase
      .from('whatsapp_modelos')
      .select('mensagem')
      .eq('tipo', 'cobranca_dia')
      .eq('ativo', true)
      .single()

    if (tplDia) {
      const { data: parcelasDia } = await supabase
        .from('contas_a_receber')
        .select('id, parcela, data_vencimento, valor, clientes!cod_cliente(id, nome, whatsapp, whatsapp_ativo)')
        .eq('pago', false)
        .eq('msg_dia_enviada', false)
        .eq('data_vencimento', hoje)
        .or('inadimplente.is.null,inadimplente.eq.false')

      for (const p of parcelasDia || []) {
        const cli = (p as any).clientes
        if (!cli?.whatsapp || cli?.whatsapp_ativo === false) continue

        const valorFmt = Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const mensagem = processarTemplate(tplDia.mensagem, {
          nome: cli.nome.split(' ')[0].toUpperCase(),
          valor: valorFmt,
        })

        try {
          await enviarMensagem({ numero: cli.whatsapp, mensagem })

          await supabase
            .from('contas_a_receber')
            .update({ msg_dia_enviada: true, msg_dia_enviada_em: new Date().toISOString() })
            .eq('id', p.id)

          await supabase.from('whatsapp_logs').insert({
            tipo: 'cobranca_dia',
            cod_cliente: cli.id,
            numero: cli.whatsapp,
            mensagem,
            status: 'enviado',
          })

          log.avisoDia++
          log.detalhes.push(`⏰ Aviso dia: ${cli.nome} — ${valorFmt}`)
          await sleep(1200)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          const semWhatsapp = isSemWhatsapp(msg)
          if (semWhatsapp) {
            log.sem_whatsapp++
            await supabase.from('clientes').update({ whatsapp_ativo: false }).eq('id', cli.id)
            await supabase.from('whatsapp_logs').insert({
              tipo: 'cobranca_dia', cod_cliente: cli.id, numero: cli.whatsapp,
              mensagem, status: 'sem_whatsapp',
              erro: 'Número sem WhatsApp — desativado automaticamente',
            })
          } else {
            log.erros++
            await supabase.from('whatsapp_logs').insert({
              tipo: 'cobranca_dia', cod_cliente: cli.id, numero: cli.whatsapp,
              mensagem, status: 'erro', erro: msg,
            })
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.erros++
    log.detalhes.push(`❌ Erro aviso dia: ${msg}`)
    try {
      await supabase.from('whatsapp_logs').insert({
        tipo: 'cobranca_dia', cod_cliente: null, numero: null,
        mensagem: null, status: 'erro_interno',
        erro: `[bloco_cobranca_dia] ${msg.slice(0, 500)}`,
      })
    } catch {}
  }

  // ─── RESUMO DIÁRIO ────────────────────────────────────────
  const resumo = `Cron ${hoje} | Nascimento: ${log.aniversarios} | Casamento: ${log.aniversariosCasamento} | 5d: ${log.aviso5d} | Dia: ${log.avisoDia} | Sem WPP: ${log.sem_whatsapp} | Erros: ${log.erros}`
  try {
    await supabase.from('whatsapp_logs').insert({
      tipo: 'cron_resumo', cod_cliente: null, numero: null,
      mensagem: resumo, status: 'enviado',
    })
  } catch {}
  if (process.env.WHATSAPP_ADMIN) {
    try { await enviarMensagem({ numero: process.env.WHATSAPP_ADMIN, mensagem: resumo }) } catch {}
  }

  return NextResponse.json({
    ok: true,
    data: hoje,
    aniversarios: log.aniversarios,
    aniversariosCasamento: log.aniversariosCasamento,
    sem_whatsapp: log.sem_whatsapp,
    aviso5d: log.aviso5d,
    avisoDia: log.avisoDia,
    erros: log.erros,
    detalhes: log.detalhes,
  })
}
