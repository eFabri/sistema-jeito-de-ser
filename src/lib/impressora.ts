// src/lib/impressora.ts
declare global {
  interface Window { qz: any }
}

let qzConectado = false

export async function carregarQZ(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (window.qz) return true
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

export async function conectarQZ(): Promise<boolean> {
  const carregou = await carregarQZ()
  if (!carregou) return false
  if (qzConectado) return true
  try {
    window.qz.security.setCertificatePromise(() => Promise.resolve())
    window.qz.security.setSignatureAlgorithm('SHA512')
    window.qz.security.setSignaturePromise(() => Promise.resolve())
    await window.qz.websocket.connect()
    qzConectado = true
    return true
  } catch (e) {
    console.warn('QZ Tray não encontrado:', e)
    return false
  }
}

export async function listarImpressoras(): Promise<string[]> {
  const ok = await conectarQZ()
  if (!ok) return []
  try { return await window.qz.printers.find() } catch { return [] }
}

// ─── INTERFACES ────────────────────────────────────────────

export interface DadosRecibo {
  empresa: string
  nomeCliente: string
  codVenda: number | string
  data: string
  hora?: string
  nomeVendedora?: string
  itens: { produto: string; codigo?: string; quantidade: number; preco: number; subtotal: number }[]
  pagamentos: { forma: string; valor: number; data?: string }[]
  desconto?: number
  valorTotal: number
  crediario?: { parcela?: string; vencimento: string; valor: number }[]
  observacao?: string
  situacao?: string
}

export interface DadosTalaoCrediario {
  nomeCliente: string
  cpf?: string
  codVenda: number | string
  data: string
  valorTotal: number
  parcelas: { parcela?: string; vencimento: string; valor: number }[]
}

// ─── HELPERS ───────────────────────────────────────────────

// 42 colunas = largura padrão para impressora 80mm
const COL = 42

function linha(char = '=', n = COL): string { return char.repeat(n) + '\n' }

function center(texto: string, n = COL): string {
  const pad = Math.max(0, Math.floor((n - texto.length) / 2))
  return ' '.repeat(pad) + texto + '\n'
}

function ponteado(esq: string, dir: string, n = COL): string {
  const dots = n - esq.length - dir.length
  return esq + '.'.repeat(Math.max(1, dots)) + dir + '\n'
}

// R$ com espaço após: "R$ 249,99"
function brl(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Remove bytes de controle ESC/POS do texto para exibição em HTML <pre>
function stripEscPos(s: string): string {
  return s
    .replace(/\x1B\x40/g, '')          // ESC @ reset
    .replace(/\x1B\x61[\s\S]/g, '')    // ESC a N align
    .replace(/\x1B\x21[\s\S]/g, '')    // ESC ! N font size
    .replace(/\x1D\x56[\s\S]/g, '')    // GS V N cut
}

// ─── CUPOM DE VENDA ────────────────────────────────────────

export function montarTextoRecibo(d: DadosRecibo, labelVia?: string): string {
  let t = ''

  t += '\x1B\x40'           // reset
  t += '\x1B\x21\x10'       // fonte dupla altura para nome da loja
  t += center('JEITO DE SER LTDA.')
  t += '\x1B\x21\x00'       // fonte normal
  t += center('Mariza de Souza Mendes, 650')
  t += center('Siderurgia - Ouro Branco')
  t += center('Fone: 31 37413668')
  if (labelVia) t += center(`*** ${labelVia} ***`)
  t += linha()

  if (d.nomeVendedora) t += `Atendente: ${d.nomeVendedora}\n`
  t += `PEDIDO N .: ${d.codVenda}\n`
  t += `Data: ${d.data}\n`
  t += linha('-')

  t += 'Produto\n'
  t += ponteado('Qtde', 'Sub Total(R$)')
  t += linha('-')

  for (const item of d.itens) {
    const nomeLinha = item.codigo
      ? `${item.produto.substring(0, 28)}...Cod.: ${item.codigo}`.substring(0, COL)
      : item.produto.substring(0, COL)
    t += nomeLinha + '\n'
    t += ponteado(String(item.quantidade), brl(item.subtotal))
    t += '\n'
  }
  t += linha('-')

  if (d.desconto && d.desconto > 0) {
    t += ponteado('Desconto(s)', ':' + brl(d.desconto))
  }
  t += '\x1B\x21\x10'
  t += ponteado('Total', ':' + brl(d.valorTotal))
  t += '\x1B\x21\x00'
  t += linha('-')

  t += `Cliente: ${d.nomeCliente}\n\n`
  for (const p of d.pagamentos) {
    const dataPart = p.data ? `${p.data}..` : ''
    t += `${p.forma}..${dataPart}${brl(p.valor)}\n`
  }

  if (d.situacao) {
    t += `\n${d.situacao}\n`
  }

  t += '\n'
  t += linha('-')
  t += center('Volte Sempre!')
  t += center('Prazo para troca: 7 dias.')
  t += linha()
  t += '\n\n'
  t += '\x1D\x56\x00'    // cortar papel

  return t
}

// Fallback: impressão via navegador usando <pre> com o mesmo texto ESC/POS,
// garantindo fonte monospace e alinhamento correto por pontos
function imprimirNavegador(dados: DadosRecibo, vias: 1 | 2 = 1) {
  function texto(labelVia?: string) {
    return stripEscPos(montarTextoRecibo(dados, labelVia))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  const conteudo = vias === 1
    ? `<pre>${texto()}</pre>`
    : `<pre>${texto('VIA DO CLIENTE')}</pre><div style="page-break-before:always"></div><pre>${texto('VIA DA LOJA')}</pre>`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Cupom #${dados.codVenda}</title>
<style>
@page { size: 80mm auto; margin: 3mm; }
body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.4; margin: 0; padding: 0; }
pre { white-space: pre; margin: 0; }
</style></head><body>${conteudo}</body></html>`

  const w = window.open('', '_blank', 'width=420,height=620')
  if (w) { w.document.write(html); w.document.close(); w.onload = () => { w.print(); w.close() } }
}

export async function imprimirRecibo(
  dados: DadosRecibo,
  nomeImpressora?: string,
  vias: 1 | 2 = 1
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const ok = await conectarQZ()
    if (!ok) { imprimirNavegador(dados, vias); return { ok: true } }

    let impressora = nomeImpressora
    if (!impressora) {
      const lista = await listarImpressoras()
      impressora = lista[0]
    }
    if (!impressora) { imprimirNavegador(dados, vias); return { ok: true } }

    const config = window.qz.configs.create(impressora, { encoding: 'Cp1252' })
    if (vias === 1) {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTextoRecibo(dados) }])
    } else {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTextoRecibo(dados, 'VIA DO CLIENTE') }])
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTextoRecibo(dados, 'VIA DA LOJA') }])
    }
    return { ok: true }
  } catch (e: any) {
    console.error('Erro impressão:', e)
    imprimirNavegador(dados, vias)
    return { ok: true }
  }
}

// ─── TALÃO DE CREDIÁRIO ────────────────────────────────────

export function montarTalaoCrediario(d: DadosTalaoCrediario, labelVia?: string): string {
  // colunas do talão
  const VCOL   = 9   // vencimento (DD/MM) + espaço
  const VALCOL = 14  // valor (R$ X.XXX,XX) + espaço
  const ALTCOL = 7   // alteração + espaço

  let t = ''

  t += '\x1B\x40'
  t += '\x1B\x21\x10'
  t += center('JEITO DE SER LTDA.')
  t += '\x1B\x21\x00'
  t += center('Talão de Crediário')
  if (labelVia) t += center(`*** ${labelVia} ***`)
  t += linha()

  t += `CLIENTE : ${d.nomeCliente}\n`
  t += `CPF     : ${d.cpf || ''}\n`
  t += `VENDA N.: ${d.codVenda}\n`
  t += `DATA    : ${d.data}\n`
  t += `VALOR   : ${brl(d.valorTotal)}\n`
  t += linha()

  t += 'Venc.'.padEnd(VCOL) + 'Valor'.padEnd(VALCOL) + 'Alter.'.padEnd(ALTCOL) + 'Receb.\n'
  t += linha('-')

  for (const p of d.parcelas) {
    const v = p.vencimento.includes('-')
      ? p.vencimento.split('-').reverse().join('/')
      : p.vencimento
    t += v.slice(0, 5).padEnd(VCOL) + brl(p.valor).padEnd(VALCOL) + '___'.padEnd(ALTCOL) + '___\n'
  }
  t += linha()

  t += 'OBSERVACOES:\n'
  t += '_'.repeat(COL) + '\n'
  t += '_'.repeat(COL) + '\n'
  t += '\n'
  t += `Assinatura:${'_'.repeat(COL - 11)}\n`
  t += linha()
  t += '\n\n'
  t += '\x1D\x56\x00'

  return t
}

function imprimirTalaoNavegador(dados: DadosTalaoCrediario, vias: 1 | 2 = 1) {
  function texto(labelVia?: string) {
    return stripEscPos(montarTalaoCrediario(dados, labelVia))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  const conteudo = vias === 1
    ? `<pre>${texto()}</pre>`
    : `<pre>${texto('VIA DO CLIENTE')}</pre><div style="page-break-before:always"></div><pre>${texto('VIA DA LOJA')}</pre>`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Talão Crediário #${dados.codVenda}</title>
<style>
@page { size: 80mm auto; margin: 3mm; }
body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.4; margin: 0; padding: 0; }
pre { white-space: pre; margin: 0; }
</style></head><body>${conteudo}</body></html>`

  const w = window.open('', '_blank', 'width=420,height=620')
  if (w) { w.document.write(html); w.document.close(); w.onload = () => { w.print(); w.close() } }
}

export async function imprimirTalaoCrediario(
  dados: DadosTalaoCrediario,
  nomeImpressora?: string,
  vias: 1 | 2 = 1
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const ok = await conectarQZ()
    if (!ok) { imprimirTalaoNavegador(dados, vias); return { ok: true } }

    let impressora = nomeImpressora
    if (!impressora) {
      const lista = await listarImpressoras()
      impressora = lista[0]
    }
    if (!impressora) { imprimirTalaoNavegador(dados, vias); return { ok: true } }

    const config = window.qz.configs.create(impressora, { encoding: 'Cp1252' })
    if (vias === 1) {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTalaoCrediario(dados) }])
    } else {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTalaoCrediario(dados, 'VIA DO CLIENTE') }])
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTalaoCrediario(dados, 'VIA DA LOJA') }])
    }
    return { ok: true }
  } catch (e: any) {
    console.error('Erro impressão talão:', e)
    imprimirTalaoNavegador(dados, vias)
    return { ok: true }
  }
}
