// src/lib/whatsapp.ts
// ============================================================
// Integração com Evolution API
// ============================================================

const API_URL = process.env.EVOLUTION_API_URL!
const API_KEY = process.env.EVOLUTION_API_KEY!
const INSTANCE = process.env.EVOLUTION_INSTANCE!

interface SendMessageParams {
  numero: string
  mensagem: string
}

// Formata número para padrão Evolution API (55 + DDD + número)
function formatarNumero(numero: string): string {
  const limpo = numero.replace(/\D/g, '')
  if (limpo.startsWith('55')) return `${limpo}@s.whatsapp.net`
  if (limpo.length === 11) return `55${limpo}@s.whatsapp.net`
  if (limpo.length === 10) return `55${limpo}@s.whatsapp.net`
  return `55${limpo}@s.whatsapp.net`
}

// Substituir variáveis no template
export function processarTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`)
}

// Enviar mensagem de texto
export async function enviarMensagem({ numero, mensagem }: SendMessageParams) {
  const numeroFormatado = formatarNumero(numero)

  const response = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': API_KEY,
    },
    body: JSON.stringify({
      number: numeroFormatado,
      text: mensagem,
    }),
  })

  if (!response.ok) {
    const erro = await response.text()
    throw new Error(`Evolution API erro: ${response.status} — ${erro}`)
  }

  return response.json()
}

// Verificar status da instância
export async function verificarInstancia() {
  const response = await fetch(`${API_URL}/instance/connectionState/${INSTANCE}`, {
    headers: { 'apikey': API_KEY },
  })
  return response.json()
}

// Obter QR Code para conectar WhatsApp
export async function obterQRCode() {
  const response = await fetch(`${API_URL}/instance/connect/${INSTANCE}`, {
    headers: { 'apikey': API_KEY },
  })
  return response.json()
}

// Enviar mensagem de aniversário
export async function enviarMensagemAniversario(
  template: string,
  cliente: { nome: string; whatsapp: string }
) {
  const mensagem = processarTemplate(template, {
    nome: cliente.nome.split(' ')[0],
  })
  return enviarMensagem({ numero: cliente.whatsapp, mensagem })
}

// Enviar mensagem de cobrança
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
