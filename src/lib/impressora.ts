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

const POPUP_CSS = `
@page { size: 80mm auto; margin: 3mm; }
body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.4; margin: 0; padding: 0; }
pre { white-space: pre; margin: 0; }
`

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

function htmlCupom(dados: DadosRecibo, vias: 1 | 2): string {
  function texto(labelVia?: string) {
    return stripEscPos(montarTextoRecibo(dados, labelVia))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return vias === 1
    ? `<pre>${texto()}</pre>`
    : `<pre>${texto('VIA DO CLIENTE')}</pre><div style="page-break-before:always"></div><pre>${texto('VIA DA LOJA')}</pre>`
}

function abrirJanelaBrowser(htmlBody: string, titulo: string): { ok: boolean; erro?: string } {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titulo}</title><style>${POPUP_CSS}</style></head><body>${htmlBody}</body></html>`
  const w = window.open('', '_blank', 'width=420,height=620')
  if (!w) return { ok: false, erro: 'Popup bloqueado pelo navegador. Permita popups para este site e tente novamente.' }
  w.document.write(html)
  w.document.close()
  // setTimeout(0) garante que o documento foi processado antes de chamar print()
  setTimeout(() => { w.print() }, 0)
  // fecha somente após o diálogo de impressão ser descartado
  w.onafterprint = () => w.close()
  return { ok: true }
}

function imprimirNavegador(dados: DadosRecibo, vias: 1 | 2 = 1): { ok: boolean; erro?: string } {
  return abrirJanelaBrowser(htmlCupom(dados, vias), `Cupom #${dados.codVenda}`)
}

export async function imprimirRecibo(
  dados: DadosRecibo,
  nomeImpressora?: string,
  vias: 1 | 2 = 1
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const qzOk = await conectarQZ()
    if (!qzOk) return imprimirNavegador(dados, vias)

    let impressora = nomeImpressora
    if (!impressora) {
      const lista = await listarImpressoras()
      impressora = lista[0]
    }
    if (!impressora) return imprimirNavegador(dados, vias)

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
    return imprimirNavegador(dados, vias)
  }
}

// ─── TALÃO DE CREDIÁRIO ────────────────────────────────────

// Largura do talão: 48 colunas, igual ao recibo do sistema antigo
const COL_TALAO = 48

// Larguras das colunas da tabela de parcelas.
// Receb. fecha a linha, então não precisa de padding.
const T_VENC  = 8    // "25/05" + espaços
const T_VALOR = 13   // "R$1.136,94" + espaços
const T_ALTER = 10

// Conteúdo das colunas preenchidas à mão (Alter. e Receb.):
// uma linha para a vendedora escrever em cima, como no talão do sistema antigo.
const MARCA_MANUAL = '____'

// Largura da linha de anotação sob OBSERVACOES
const COL_OBS = 31

// "R$1.136,94" — sem espaço após o R$, como sai no talão impresso
function brlCompacto(v: number): string {
  return 'R$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 248 -> "000248"
function numVenda(v: number | string): string {
  const digitos = String(v).replace(/\D/g, '')
  return digitos.padStart(6, '0')
}

// "2017-06-15" -> "15/06"   |   "15/06/2017" -> "15/06"
function vencCurto(s: string): string {
  if (s.includes('-')) {
    const [, mes, dia] = s.split('T')[0].split('-')
    return `${dia}/${mes}`
  }
  return s.slice(0, 5)
}

// "CLIENTE    : Fulana"
function campoTalao(label: string, valor: string): string {
  return label.padEnd(11) + ': ' + valor + '\n'
}

export function montarTalaoCrediario(d: DadosTalaoCrediario, labelVia?: string): string {
  const sep = '-'.repeat(COL_TALAO) + '\n'
  let t = ''

  t += '\x1B\x40'
  t += '\x1B\x21\x10'                          // corpo maior (altura dupla)
  t += center('JEITO DE SER LTDA', COL_TALAO)
  t += '\x1B\x21\x00'                          // volta ao corpo normal
  if (labelVia) t += center(`*** ${labelVia} ***`, COL_TALAO)
  t += '\n'

  t += campoTalao('CLIENTE',     d.nomeCliente)
  t += campoTalao('VENDA N.',    numVenda(d.codVenda))
  t += campoTalao('DATA',        d.data)
  t += campoTalao('VALOR TOTAL', brl(d.valorTotal))
  t += '\n'

  t += sep
  t += 'Venc.'.padEnd(T_VENC) + 'Valor'.padEnd(T_VALOR) + 'Alter.'.padEnd(T_ALTER) + 'Receb.\n'
  t += sep

  for (const p of d.parcelas) {
    const linhaParcela =
      vencCurto(p.vencimento).padEnd(T_VENC) +
      brlCompacto(p.valor).padEnd(T_VALOR) +
      MARCA_MANUAL.padEnd(T_ALTER) +
      MARCA_MANUAL
    t += linhaParcela.replace(/\s+$/, '') + '\n'
  }
  t += sep
  t += '\n'

  t += 'OBSERVACOES:\n'
  t += '_'.repeat(COL_OBS) + '\n'
  t += '_'.repeat(COL_OBS) + '\n'

  t += '\n\n'
  t += '\x1D\x56\x00'

  return t
}

function htmlTalao(dados: DadosTalaoCrediario, vias: 1 | 2): string {
  function texto(labelVia?: string) {
    return stripEscPos(montarTalaoCrediario(dados, labelVia))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  return vias === 1
    ? `<pre>${texto()}</pre>`
    : `<pre>${texto('VIA DO CLIENTE')}</pre><div style="page-break-before:always"></div><pre>${texto('VIA DA LOJA')}</pre>`
}

function imprimirTalaoNavegador(dados: DadosTalaoCrediario, vias: 1 | 2 = 1): { ok: boolean; erro?: string } {
  return abrirJanelaBrowser(htmlTalao(dados, vias), `Talão Crediário #${dados.codVenda}`)
}

export async function imprimirTalaoCrediario(
  dados: DadosTalaoCrediario,
  nomeImpressora?: string,
  vias: 1 | 2 = 1
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const qzOk = await conectarQZ()
    if (!qzOk) return imprimirTalaoNavegador(dados, vias)

    let impressora = nomeImpressora
    if (!impressora) {
      const lista = await listarImpressoras()
      impressora = lista[0]
    }
    if (!impressora) return imprimirTalaoNavegador(dados, vias)

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
    return imprimirTalaoNavegador(dados, vias)
  }
}

// ─── CUPOM + TALÃO UNIFICADOS ──────────────────────────────

// Abre UMA janela com cupom e talão separados por page-break,
// eliminando a corrida entre duas janelas e dois diálogos de impressão.
export async function imprimirCupomETalao(
  cupom: DadosRecibo,
  talao: DadosTalaoCrediario,
  nomeImpressora?: string,
  viasCupom: 1 | 2 = 1,
  viasTalao: 1 | 2 = 1
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const qzOk = await conectarQZ()
    if (!qzOk) {
      const corpo = htmlCupom(cupom, viasCupom) +
        `<div style="page-break-before:always"></div>` +
        htmlTalao(talao, viasTalao)
      return abrirJanelaBrowser(corpo, `Cupom + Talão #${cupom.codVenda}`)
    }

    let impressora = nomeImpressora
    if (!impressora) {
      const lista = await listarImpressoras()
      impressora = lista[0]
    }
    if (!impressora) {
      const corpo = htmlCupom(cupom, viasCupom) +
        `<div style="page-break-before:always"></div>` +
        htmlTalao(talao, viasTalao)
      return abrirJanelaBrowser(corpo, `Cupom + Talão #${cupom.codVenda}`)
    }

    const config = window.qz.configs.create(impressora, { encoding: 'Cp1252' })
    if (viasCupom === 1) {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTextoRecibo(cupom) }])
    } else {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTextoRecibo(cupom, 'VIA DO CLIENTE') }])
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTextoRecibo(cupom, 'VIA DA LOJA') }])
    }
    if (viasTalao === 1) {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTalaoCrediario(talao) }])
    } else {
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTalaoCrediario(talao, 'VIA DO CLIENTE') }])
      await window.qz.print(config, [{ type: 'raw', format: 'plain', data: montarTalaoCrediario(talao, 'VIA DA LOJA') }])
    }
    return { ok: true }
  } catch (e: any) {
    console.error('Erro impressão cupom+talão:', e)
    const corpo = htmlCupom(cupom, viasCupom) +
      `<div style="page-break-before:always"></div>` +
      htmlTalao(talao, viasTalao)
    return abrirJanelaBrowser(corpo, `Cupom + Talão #${cupom.codVenda}`)
  }
}
