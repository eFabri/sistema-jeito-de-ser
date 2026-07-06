// Helpers de data no fuso de Brasília (America/Sao_Paulo, UTC-3).
// Sempre use estas funções — nunca new Date().toISOString() para datas de negócio.

export function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  // retorna 'YYYY-MM-DD' no fuso Brasília
}

export function mesAtualNoBrasil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).substring(0, 7)
  // retorna 'YYYY-MM'
}

export function anosAtrasNoBrasil(anos: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - anos)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function diasAtrasNoBrasil(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function diasAFrente(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function inicioDeMes(anoMes?: string): string {
  // anoMes = 'YYYY-MM', padrão = mês atual no Brasil
  if (anoMes) return `${anoMes}-01`
  return mesAtualNoBrasil() + '-01'
}
