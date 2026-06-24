// src/lib/impressora.ts
// ============================================================
// Integração com QZ Tray para impressão térmica ESC/POS
// Instalar QZ Tray em: https://qz.io/download
// ============================================================

declare global {
  interface Window { qz: any }
}

let qzConectado = false

// Carregar o script do QZ Tray dinamicamente
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

// Conectar ao QZ Tray (precisa estar rodando no PC)
export async function conectarQZ(): Promise<boolean> {
  const carregou = await carregarQZ()
  if (!carregou) return false
  if (qzConectado) return true

  try {
    // Desabilitar verificação de certificado para dev local
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

// Listar impressoras disponíveis
export async function listarImpressoras(): Promise<string[]> {
  const ok = await conectarQZ()
  if (!ok) return []
  try {
    return await window.qz.printers.find()
  } catch { return [] }
}

// ─── MONTAR RECIBO ─────────────────────────────────────────

export interface DadosRecibo {
  empresa: string
  nomeCliente: string
  codVenda: number | string
  data: string
  hora?: string
  nomeVendedora?: string
  itens: { produto: string; quantidade: number; preco: number; subtotal: number }[]
  pagamentos: { forma: string; valor: number }[]
  desconto?: number
  valorTotal: number
  crediario?: { parcela: string; vencimento: string; valor: number }[]
  observacao?: string
}

function linha(char = '-', tamanho = 40) {
  return char.repeat(tamanho) + '\n'
}

function centralizar(texto: string, tamanho = 40) {
  const pad = Math.max(0, Math.floor((tamanho - texto.length) / 2))
  return ' '.repeat(pad) + texto + '\n'
}

function colunas(esq: string, dir: string, tamanho = 40) {
  const espaco = tamanho - esq.length - dir.length
  return esq + ' '.repeat(Math.max(1, espaco)) + dir + '\n'
}

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export function montarTextoRecibo(d: DadosRecibo): string {
  let txt = ''

  // Cabeçalho
  txt += '\x1B\x40'           // Reset impressora
  txt += '\x1B\x61\x01'       // Centralizar
  txt += '\x1B\x21\x10'       // Fonte dupla altura
  txt += d.empresa + '\n'
  txt += '\x1B\x21\x00'       // Fonte normal
  txt += 'Ouro Branco / MG\n'
  txt += '(31) 3741-3668\n'
  txt += '\n'
  txt += '\x1B\x61\x00'       // Alinhar esquerda
  txt += linha()

  // Dados da venda
  txt += `CLIENTE  : ${d.nomeCliente}\n`
  if (d.nomeVendedora) txt += `VENDEDORA: ${d.nomeVendedora}\n`
  txt += `VENDA Nº : ${d.codVenda}\n`
  txt += `DATA     : ${d.data}${d.hora ? ` ${d.hora}` : ''}\n`
  txt += linha()

  // Itens
  txt += '\x1B\x21\x01'       // Negrito
  txt += 'ITEM                    QTD    VALOR\n'
  txt += '\x1B\x21\x00'
  txt += linha()

  for (const item of d.itens) {
    const nome = item.produto.length > 22 ? item.produto.substring(0, 22) : item.produto.padEnd(22)
    const qtd = String(item.quantidade).padStart(3)
    const sub = brl(item.subtotal).padStart(9)
    txt += `${nome} ${qtd} ${sub}\n`
    if (item.preco > 0) {
      txt += `  Unitário: ${brl(item.preco)}\n`
    }
  }

  txt += linha()

  // Descontos
  if (d.desconto && d.desconto > 0) {
    txt += colunas('DESCONTO:', brl(d.desconto))
  }

  // Total
  txt += '\x1B\x21\x10'       // Negrito + dupla altura
  txt += colunas('TOTAL:', brl(d.valorTotal))
  txt += '\x1B\x21\x00'
  txt += linha()

  // Pagamentos
  txt += '\x1B\x21\x01'
  txt += 'PAGAMENTO\n'
  txt += '\x1B\x21\x00'
  for (const p of d.pagamentos) {
    txt += colunas(`  ${p.forma}:`, brl(p.valor))
  }

  // Crediário
  if (d.crediario && d.crediario.length > 0) {
    txt += '\n'
    txt += linha()
    txt += '\x1B\x21\x01'
    txt += 'PARCELAS DO CREDIÁRIO\n'
    txt += '\x1B\x21\x00'
    txt += linha('-', 40)
    txt += 'Venc.       Parcela           Valor\n'
    txt += linha('-', 40)
    for (const p of d.crediario) {
      const venc = new Date(p.vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const parc = p.parcela.padEnd(18)
      const val  = brl(p.valor).padStart(9)
      txt += `${venc}  ${parc} ${val}\n`
      txt += linha('-', 40)
    }
  }

  // Observação
  if (d.observacao) {
    txt += '\n'
    txt += `OBS: ${d.observacao}\n`
  }

  // Rodapé
  txt += '\n'
  txt += '\x1B\x61\x01'       // Centralizar
  txt += 'Obrigada pela preferencia!\n'
  txt += 'Jeito de Ser Fashion\n'
  txt += '\n\n\n'
  txt += '\x1D\x56\x00'       // Cortar papel

  return txt
}

// ─── IMPRIMIR ──────────────────────────────────────────────

export async function imprimirRecibo(dados: DadosRecibo, nomeImpressora?: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const ok = await conectarQZ()
    if (!ok) {
      // Fallback: abrir janela de impressão do navegador
      imprimirNavegador(dados)
      return { ok: true }
    }

    let impressora = nomeImpressora
    if (!impressora) {
      const impressoras = await listarImpressoras()
      impressora = impressoras[0]
    }

    if (!impressora) {
      imprimirNavegador(dados)
      return { ok: true }
    }

    const config = window.qz.configs.create(impressora, {
      encoding: 'Cp1252',
      copies: 1,
    })

    const texto = montarTextoRecibo(dados)

    await window.qz.print(config, [{
      type: 'raw',
      format: 'plain',
      data: texto,
    }])

    return { ok: true }
  } catch (e: any) {
    console.error('Erro impressão:', e)
    imprimirNavegador(dados)
    return { ok: true } // fallback sempre funciona
  }
}

// Fallback: impressão via navegador (formatação HTML)
function imprimirNavegador(dados: DadosRecibo) {
  const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Recibo #${dados.codVenda}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  body { font-family: monospace; font-size: 11px; width: 72mm; margin: 4mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 14px; font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; vertical-align: top; }
  .right { text-align: right; }
  .total { font-size: 13px; font-weight: bold; }
</style>
</head>
<body>
<div class="center bold big">${dados.empresa}</div>
<div class="center">Ouro Branco / MG</div>
<div class="center">(31) 3741-3668</div>
<hr>
<div>CLIENTE: ${dados.nomeCliente}</div>
<div>VENDA Nº: ${dados.codVenda}</div>
<div>DATA: ${dados.data}</div>
<hr>
<table>
  <tr><td class="bold">Item</td><td class="right bold">Qtd</td><td class="right bold">Total</td></tr>
  ${dados.itens.map(i => `<tr><td>${i.produto.substring(0,24)}</td><td class="right">${i.quantidade}</td><td class="right">${brl(i.subtotal)}</td></tr>`).join('')}
</table>
<hr>
${dados.desconto ? `<div>Desconto: <span class="right">${brl(dados.desconto)}</span></div>` : ''}
<div class="total">TOTAL: ${brl(dados.valorTotal)}</div>
<hr>
${dados.pagamentos.map(p => `<div>${p.forma}: <span>${brl(p.valor)}</span></div>`).join('')}
${dados.crediario?.length ? `
<hr>
<div class="bold">PARCELAS DO CREDIÁRIO</div>
${dados.crediario.map(p => `<div>${new Date(p.vencimento).toLocaleDateString('pt-BR')} — ${p.parcela} — ${brl(p.valor)}</div>`).join('')}
` : ''}
<hr>
<div class="center">Obrigada pela preferência!</div>
<div class="center bold">Jeito de Ser Fashion</div>
</body>
</html>`

  const janela = window.open('', '_blank', 'width=400,height=600')
  if (janela) {
    janela.document.write(html)
    janela.document.close()
    janela.onload = () => { janela.print(); janela.close() }
  }
}
