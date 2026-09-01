// src/lib/whatsapp_templates.ts
// Configuração central dos templates aprovados na Meta Cloud API.
// textoPlaceholder = texto exato a ser submetido no WhatsApp Manager.
// Após aprovação pela Meta, altere só o campo `nome` se necessário —
// não alterar categoria, idioma ou lista de variáveis.

export type TemplateCategoria = 'UTILITY' | 'MARKETING'

export interface WhatsAppTemplate {
  /** Nome exato como submetido e aprovado na Meta Business Platform */
  nome: string
  /** UTILITY = cobrança/transacional (não exige opt-in); MARKETING = exige opt-in */
  categoria: TemplateCategoria
  idioma: string
  /** Descrição das variáveis posicionais {{1}}, {{2}}, ... na ordem correta */
  variaveis: string[]
  /** Texto exato para submissão no WhatsApp Manager */
  textoPlaceholder: string
}

export const TEMPLATES = {
  cobranca_5dias: {
    nome: 'cobranca_5dias',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    variaveis: ['nome do cliente', 'valor'],
    textoPlaceholder:
      'Olá, {{1}}! Esta é uma mensagem automática da *Jeito de Ser* 🌸\n\nSua parcela vence em *5 dias*, no valor de *{{2}}*.\n\nEfetue seus pagamentos em dia, mantendo seu crédito ativo e evitando juros e acréscimos.\n\n_Cuidando com verdade e transparência!_ 💛',
  },
  cobranca_vencimento: {
    nome: 'cobranca_vencimento',
    categoria: 'UTILITY',
    idioma: 'pt_BR',
    variaveis: ['nome do cliente', 'valor'],
    textoPlaceholder:
      'Olá, {{1}}, tudo bem? O vencimento da sua parcela é *hoje*, no valor de {{2}}. Não deixe de acertar em dia para evitar juros!\n\nEsta é uma mensagem automática da *Jeito de Ser* 💛',
  },
  aniversario_nascimento: {
    nome: 'aniversario_nascimento',
    categoria: 'MARKETING',
    idioma: 'pt_BR',
    variaveis: ['nome do cliente'],
    textoPlaceholder:
      'Feliz aniversário, {{1}}! 🎂\n\nToda a equipe *Jeito de Ser* deseja a você um dia repleto de alegria e realizações. Você merece tudo de bom! 💛',
  },
} satisfies Record<string, WhatsAppTemplate>

export type TemplateName = keyof typeof TEMPLATES
