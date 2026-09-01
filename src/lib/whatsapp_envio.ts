// src/lib/whatsapp_envio.ts
// Envio de templates Meta Cloud API com checagem de opt-in e log estruturado.
// Não lança exceção para manter fluxo de lote intacto — retorna ResultadoEnvio.

import { createAdminClient } from '@/lib/supabase/admin'
import { enviarTemplate } from '@/lib/whatsapp'
import { TEMPLATES, type TemplateName } from '@/lib/whatsapp_templates'

export interface ResultadoEnvio {
  ok: boolean
  status: 'enviado' | 'bloqueado' | 'erro'
  motivo?: string
}

export async function enviarTemplateWhatsApp(
  clienteId: number,
  nomeTemplate: TemplateName,
  variaveis: string[]
): Promise<ResultadoEnvio> {
  const supabase = createAdminClient()
  const template = TEMPLATES[nomeTemplate]

  const { data: cliente, error: errCliente } = await supabase
    .from('clientes')
    .select('id, nome, whatsapp, whatsapp_marketing_optin')
    .eq('id', clienteId)
    .single()

  if (errCliente || !cliente) {
    const motivo = `Cliente ${clienteId} não encontrado`
    await registrarLog(supabase, { clienteId, template: nomeTemplate, status: 'erro', motivo, numero: null, variaveis })
    return { ok: false, status: 'erro', motivo }
  }

  if (!cliente.whatsapp) {
    const motivo = 'Cliente sem número de WhatsApp cadastrado'
    await registrarLog(supabase, { clienteId, template: nomeTemplate, status: 'erro', motivo, numero: null, variaveis })
    return { ok: false, status: 'erro', motivo }
  }

  // Templates MARKETING exigem opt-in explícito; UTILITY (cobrança) não exige.
  if (template.categoria === 'MARKETING' && !cliente.whatsapp_marketing_optin) {
    const motivo = 'Envio bloqueado: cliente sem opt-in de marketing'
    await registrarLog(supabase, { clienteId, template: nomeTemplate, status: 'bloqueado', motivo, numero: cliente.whatsapp, variaveis })
    return { ok: false, status: 'bloqueado', motivo }
  }

  try {
    const resultado = await enviarTemplate({
      numero: cliente.whatsapp,
      templateName: template.nome,
      variaveis,
    })

    const metaMessageId = resultado?.messages?.[0]?.id
    await registrarLog(supabase, {
      clienteId,
      template: nomeTemplate,
      status: 'enviado',
      numero: cliente.whatsapp,
      variaveis,
      metaMessageId,
    })
    return { ok: true, status: 'enviado' }
  } catch (e: any) {
    const motivo = e.message
    await registrarLog(supabase, { clienteId, template: nomeTemplate, status: 'erro', motivo, numero: cliente.whatsapp, variaveis })
    return { ok: false, status: 'erro', motivo }
  }
}

async function registrarLog(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    clienteId: number
    template: string
    status: 'enviado' | 'bloqueado' | 'erro'
    motivo?: string
    numero: string | null
    variaveis: string[]
    metaMessageId?: string
  }
) {
  await supabase.from('whatsapp_envios_log').insert({
    cliente_id:      params.clienteId,
    template:        params.template,
    status:          params.status,
    motivo:          params.motivo ?? null,
    numero:          params.numero,
    variaveis:       params.variaveis,
    meta_message_id: params.metaMessageId ?? null,
  })
}
