// src/lib/whatsapp.ts
// ============================================================
// Integração com WhatsApp Cloud API (Meta)
// ============================================================

const GRAPH_URL  = 'https://graph.facebook.com/v20.0'
const META_TOKEN = process.env.META_CLOUD_API_TOKEN!
const PHONE_ID   = process.env.META_PHONE_NUMBER_ID!

interface SendMessageParams {
  numero: string
  mensagem: string
}

// Formata número para padrão Cloud API (55 + DDD + número, sem espaços ou traços)
function formatarNumero(numero: string): string {
  let limpo = numero.replace(/\D/g, '')
  if (limpo.startsWith('0')) limpo = limpo.slice(1)
  if (!limpo.startsWith('55')) limpo = `55${limpo}`
  return limpo
}

// Substituir variáveis no template interno (uso local, não confundir com templates Meta)
export function processarTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`)
}

// Enviar mensagem de texto livre (funciona dentro da janela de 24h de atendimento)
export async function enviarMensagem({ numero, mensagem }: SendMessageParams) {
  const numeroFormatado = formatarNumero(numero)

  const response = await fetch(`${GRAPH_URL}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${META_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numeroFormatado,
      type: 'text',
      text: { body: mensagem },
    }),
  })

  if (!response.ok) {
    const erro = await response.text()
    throw new Error(`Meta Cloud API erro: ${response.status} — ${erro}`)
  }

  return response.json()
}

// Enviar mensagem via template aprovado pela Meta
// variaveis = array posicional correspondendo a {{1}}, {{2}}, {{3}}...
export async function enviarTemplate({
  numero,
  templateName,
  variaveis,
}: {
  numero: string
  templateName: string
  variaveis: string[]
}) {
  const numeroFormatado = formatarNumero(numero)

  const response = await fetch(`${GRAPH_URL}/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${META_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numeroFormatado,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: variaveis.map(v => ({ type: 'text', text: v })),
          },
        ],
      },
    }),
  })

  if (!response.ok) {
    const erro = await response.text()
    throw new Error(`Meta Cloud API template erro: ${response.status} — ${erro}`)
  }

  return response.json()
}

// Verificar status do número na Cloud API (sem enviar mensagem)
export async function verificarInstancia() {
  const response = await fetch(
    `${GRAPH_URL}/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,status`,
    { headers: { 'Authorization': `Bearer ${META_TOKEN}` } }
  )
  return response.json()
}

// Wrappers de alto nível (mantidos para compatibilidade com código existente)

export async function enviarMensagemAniversario(
  template: string,
  cliente: { nome: string; whatsapp: string }
) {
  const mensagem = processarTemplate(template, {
    nome: cliente.nome.split(' ')[0],
  })
  return enviarMensagem({ numero: cliente.whatsapp, mensagem })
}

export async function enviarMensagemCobranca(
  template: string,
  dados: {
    nome: string
    whatsapp: string
    parcela: string
    valor: number
    data_vencimento: string
    dias?: number
  }
) {
  const mensagem = processarTemplate(template, {
    nome: dados.nome.split(' ')[0],
    parcela: dados.parcela || '1/1',
    valor: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dados.valor),
    data_vencimento: new Date(dados.data_vencimento).toLocaleDateString('pt-BR'),
    dias: String(dados.dias || ''),
  })
  return enviarMensagem({ numero: dados.whatsapp, mensagem })
}
