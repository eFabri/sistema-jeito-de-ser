// src/lib/whatsapp_templates.ts
// Configuração central dos templates aprovados na Meta Cloud API.
//
// IMPORTANTE: os campos `textoPlaceholder` abaixo são marcadores temporários.
// Cole o texto EXATO aprovado pela Meta assim que disponível — sem alterar
// nome, categoria, idioma ou lista de variáveis.

export type TemplateCategoria = 'UTILITY' | 'MARKETING'

export interface WhatsAppTemplate {
  /** Nome exato como submetido e aprovado na Meta Business Platform */
  nome: string
  /** UTILITY = cobrança/transacional (não exige opt-in); MARKETING = exige opt-in */
  categoria: TemplateCategoria
  idioma: string
  /** Descrição das variáveis posicionais {{1}}, {{2}}, ... na ordem correta */
  variaveis: string[]
  /** TODO: substituir pelo texto real após aprovação Meta — não alterar o restante */
  textoPlaceholder: string
}

export const TEMPLATES = {
  cobranca_5dias: {
    nome: 'cobranca_5dias',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    variaveis: ['nome do cliente', 'valor'],
    textoPlaceholder: 'TEXTO_PENDENTE_COBRANCA_5DIAS',
  },
  cobranca_vencimento: {
    nome: 'cobranca_vencimento',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    variaveis: ['nome do cliente', 'valor'],
    textoPlaceholder: 'TEXTO_PENDENTE_COBRANCA_VENCIMENTO',
  },
  aniversario_nascimento: {
    nome: 'aniversario_nascimento',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    variaveis: ['nome do cliente'],
    textoPlaceholder: 'TEXTO_PENDENTE_ANIVERSARIO',
  },
} satisfies Record<string, WhatsAppTemplate>

export type TemplateName = keyof typeof TEMPLATES
