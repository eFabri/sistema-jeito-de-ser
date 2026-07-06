// src/app/vendas/nova/page.tsx
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef, useCallback } from 'react'
import SelectCustom from '@/components/ui/SelectCustom'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { imprimirRecibo } from '@/lib/impressora'
import { hojeNoBrasil } from '@/lib/dates'

// ─── TIPOS ────────────────────────────────────────────────
interface ItemCarrinho {
  id: string // temp id
  cod_produto: number | null
  produto: string
  preco_venda: number
  quantidade: number
  sub_total: number
  desconto_valor: number
  desconto_pct: number
}

interface Pagamento {
  forma: string
  operadora: string
  valor: number
  conta_a_receber: boolean
}

interface ParcelaCrediario {
  parcela: string
  data_vencimento: string
  valor: number
}

const BRL = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`
const FORMAS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Crediário', 'Boleto', 'Transferência']

// ─── SUBCOMPONENTES ───────────────────────────────────────

function Campo({ label, children }: any) {
  return (
    <div>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── PDV PRINCIPAL ────────────────────────────────────────
export default function NovaVendaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientePreId = searchParams.get('cliente')

  // Estado do cliente
  const [cliente, setCliente] = useState<any>(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [sugestoesCli, setSugestoesCli] = useState<any[]>([])
  const [mostrarSugestoesCli, setMostrarSugestoesCli] = useState(false)

  // Modal de cadastro de cliente (completo)
  const [mostrarModalCli, setMostrarModalCli] = useState(false)
  const [novoCli, setNovoCli] = useState({
    nome: '', data_nascimento: '', cpf: '', identidade: '', estado_civil: '',
    conjuge: '', conjuge_telefone: '', data_casamento: '',
    filho: '', filho_telefone: '',
    filiacao_mae: '', filiacao_mae_tel: '',
    filiacao_pai: '', filiacao_pai_tel: '',
    celular: '', telefone: '', whatsapp: '', email: '', rede_social: '',
    cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: 'MG',
    trabalho_nome: '', trabalho_cargo: '', trabalho_telefone: '', renda: '', trabalho_tempo: '',
    categoria: 'Avista', limite_credito: '', desconto_familia: '',
    tamanho: '', tamanho2: '', tamanho3: '', perfil: '',
    ref_comercial: '', ref_comercial_tel: '',
    ref_pessoal1: '', ref_pessoal1_tel: '',
    ref_pessoal2: '', ref_pessoal2_tel: '',
    observacao: '',
  })
  const [abaCli, setAbaCli] = useState<'pessoal' | 'familia' | 'contato' | 'endereco' | 'trabalho' | 'credito' | 'refs'>('pessoal')
  const [salvandoCli, setSalvandoCli] = useState(false)
  const [erroCli, setErroCli] = useState('')

  // Estado dos produtos / carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [buscaProduto, setBuscaProduto] = useState('')
  const [sugestoesProd, setSugestoesProd] = useState<any[]>([])
  const [mostrarSugestoesProd, setMostrarSugestoesProd] = useState(false)
  const [descontoRs, setDescontoRs]   = useState(0)
  const [descontoPct, setDescontoPct] = useState(0)

  // Estado do pagamento
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([{ forma: 'Dinheiro', operadora: '', valor: 0, conta_a_receber: false }])
  const [parcelasCrediario, setParcelasCrediario] = useState<ParcelaCrediario[]>([])
  const [qtdParcelas, setQtdParcelas] = useState(1)
  const [diaVencimento, setDiaVencimento] = useState(10)

  // Estado geral
  const [vendedor, setVendedor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState<'carrinho' | 'pagamento' | 'confirmado'>('carrinho')
  const [vendaFinalizada, setVendaFinalizada] = useState<any>(null)
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null)
  const [vendedoras, setVendedoras] = useState<any[]>([])
  const [impressoraStatus, setImpressoraStatus] = useState<'conectada' | 'offline' | 'verificando'>('verificando')
  const [modalImprimir, setModalImprimir] = useState(false)
  const inputProdRef = useRef<HTMLInputElement>(null)

  // Cadastro rápido de produto
  const [buscandoProd, setBuscandoProd] = useState(false)
  const [semResultadosProd, setSemResultadosProd] = useState(false)
  const [mostrarModalProd, setMostrarModalProd] = useState(false)
  const [novoProd, setNovoProd] = useState<any>({ cod_referencia: '', descricao: '', grupo: '', preco_venda: '', estoque_inicial: 0, cor: '', tamanho: '', marca: '', preco_custo: '' })
  const [maisDetalhesProd, setMaisDetalhesProd] = useState(false)
  const [salvandoProd, setSalvandoProd] = useState(false)
  const [toastPDV, setToastPDV] = useState('')

  const isAdmin = perfilUsuario?.perfil === 'admin'
  const podeAlterarDesconto = isAdmin || perfilUsuario?.alterar_preco_pdv

  function handleDescontoRs(v: number) {
    const sub = carrinho.reduce((s, i) => s + i.quantidade * i.preco_venda, 0)
    const val  = Math.min(Math.max(0, v), sub)
    setDescontoRs(val)
    setDescontoPct(sub > 0 ? parseFloat(((val / sub) * 100).toFixed(4)) : 0)
  }
  function handleDescontoPct(v: number) {
    const sub = carrinho.reduce((s, i) => s + i.quantidade * i.preco_venda, 0)
    const pct  = Math.min(Math.max(0, v), 100)
    setDescontoPct(pct)
    setDescontoRs(parseFloat((sub * (pct / 100)).toFixed(2)))
  }

  // Pré-carregar cliente da URL e perfil
  useEffect(() => {
    if (clientePreId) {
      fetch(`/api/clientes/${clientePreId}`)
        .then(r => r.json())
        .then(d => { if (d.cliente) setCliente(d.cliente) })
    }
    fetch('/api/perfil').then(r => r.json()).then(d => {
      setPerfilUsuario(d)
      if (d?.nome) setVendedor(d.apelido || d.nome)
    }).catch(() => {})

    // Verificar QZ Tray
    import('@/lib/impressora').then(({ listarImpressoras }) => {
      listarImpressoras().then(lista => {
        setImpressoraStatus(lista.length > 0 ? 'conectada' : 'offline')
      }).catch(() => setImpressoraStatus('offline'))
    })

    // F2 para focar campo produto
    const handleF2 = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); inputProdRef.current?.focus() }
    }
    window.addEventListener('keydown', handleF2)
    return () => window.removeEventListener('keydown', handleF2)
  }, [clientePreId])

  // Carregar lista de vendedoras (para admin selecionar)
  useEffect(() => {
    if (isAdmin) {
      fetch('/api/configuracoes?aba=usuarios')
        .then(r => r.json())
        .then(d => setVendedoras((d.usuarios || []).filter((u: any) => u.ativo !== false)))
        .catch(() => {})
    }
  }, [isAdmin])

  // ─── BUSCA CLIENTE ──────────────────────────────────────
  useEffect(() => {
    if (buscaCliente.length < 2) { setSugestoesCli([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(buscaCliente)}&limite=6`)
      const data = await res.json()
      setSugestoesCli(data.clientes || [])
      setMostrarSugestoesCli(true)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente])

  // ─── BUSCA PRODUTO ──────────────────────────────────────
  useEffect(() => {
    if (buscaProduto.length < 2) {
      setSugestoesProd([])
      setSemResultadosProd(false)
      setBuscandoProd(false)
      return
    }
    setSemResultadosProd(false)
    setBuscandoProd(true)
    const t = setTimeout(async () => {
      const res = await fetch(`/api/produtos?q=${encodeURIComponent(buscaProduto)}&limite=8`)
      const data = await res.json()
      const prods = data.produtos || []
      setSugestoesProd(prods)
      setMostrarSugestoesProd(prods.length > 0)
      setSemResultadosProd(prods.length === 0)
      setBuscandoProd(false)
    }, 200)
    return () => clearTimeout(t)
  }, [buscaProduto])

  // ─── CARRINHO ───────────────────────────────────────────
  function adicionarProduto(prod: any) {
    const existe = carrinho.find(i => i.cod_produto === prod.id)
    if (existe) {
      setCarrinho(c => c.map(i => i.cod_produto === prod.id
        ? { ...i, quantidade: i.quantidade + 1, sub_total: (i.quantidade + 1) * i.preco_venda }
        : i
      ))
    } else {
      setCarrinho(c => [...c, {
        id: `tmp-${Date.now()}`,
        cod_produto: prod.id,
        produto: prod.descricao,
        preco_venda: prod.preco_venda,
        quantidade: 1,
        sub_total: prod.preco_venda,
        desconto_valor: 0,
        desconto_pct: 0,
      }])
    }
    setBuscaProduto('')
    setSugestoesProd([])
    setMostrarSugestoesProd(false)
    setTimeout(() => inputProdRef.current?.focus(), 50)
  }

  function removerItem(id: string) {
    setCarrinho(c => c.filter(i => i.id !== id))
  }

  function alterarQtd(id: string, qtd: number) {
    if (qtd <= 0) { removerItem(id); return }
    setCarrinho(c => c.map(i => i.id === id
      ? { ...i, quantidade: qtd, sub_total: qtd * i.preco_venda - i.desconto_valor }
      : i
    ))
  }

  function alterarPreco(id: string, preco: number) {
    setCarrinho(c => c.map(i => i.id === id
      ? { ...i, preco_venda: preco, sub_total: i.quantidade * preco - i.desconto_valor }
      : i
    ))
  }

  // ─── TOTAIS ─────────────────────────────────────────────
  const subtotalBruto = carrinho.reduce((s, i) => s + i.quantidade * i.preco_venda, 0)
  const descontoValor = descontoRs
  const totalFinal    = subtotalBruto - descontoValor

  // ─── PAGAMENTO ──────────────────────────────────────────
  const totalPago = pagamentos.reduce((s, p) => s + (p.valor || 0), 0)
  const troco     = Math.max(0, totalPago - totalFinal)
  const falta     = Math.max(0, totalFinal - totalPago)
  const temCrediario = pagamentos.some(p => p.forma === 'Crediário')

  function addPagamento() {
    setPagamentos(p => [...p, { forma: 'Dinheiro', operadora: '', valor: 0, conta_a_receber: false }])
  }

  function updPagamento(idx: number, field: string, value: any) {
    setPagamentos(p => p.map((pg, i) => i === idx ? { ...pg, [field]: value } : pg))
  }

  function remPagamento(idx: number) {
    setPagamentos(p => p.filter((_, i) => i !== idx))
  }

  // Gerar parcelas do crediário
  function gerarParcelas() {
    if (!temCrediario) return
    const valorCrediario = pagamentos.find(p => p.forma === 'Crediário')?.valor || totalFinal
    const valorParcela = valorCrediario / qtdParcelas
    const parcelas: ParcelaCrediario[] = []
    // Usar data Brasília como base para não deslocar 1 dia após 21h
    const [anoBase, mesBase, diaBase] = hojeNoBrasil().split('-').map(Number)
    const hoje = new Date(anoBase, mesBase - 1, diaBase)

    for (let i = 0; i < qtdParcelas; i++) {
      const venc = new Date(hoje)
      venc.setMonth(venc.getMonth() + i + 1)
      venc.setDate(diaVencimento)
      const ano = venc.getFullYear()
      const mes = String(venc.getMonth() + 1).padStart(2, '0')
      const dia = String(venc.getDate()).padStart(2, '0')
      parcelas.push({
        parcela: `${i + 1}/${qtdParcelas}`,
        data_vencimento: `${ano}-${mes}-${dia}`,
        valor: parseFloat(valorParcela.toFixed(2)),
      })
    }
    // Ajuste centavos na última parcela
    const soma = parcelas.reduce((s, p) => s + p.valor, 0)
    const diff = parseFloat((valorCrediario - soma).toFixed(2))
    if (parcelas.length > 0) parcelas[parcelas.length - 1].valor += diff

    setParcelasCrediario(parcelas)
  }

  useEffect(() => { if (temCrediario) gerarParcelas() }, [qtdParcelas, diaVencimento, pagamentos])

  // ─── CADASTRO DE CLIENTE ────────────────────────────────
  const fcli = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setNovoCli(c => ({ ...c, [field]: e.target.value }))

  async function criarClienteRapido() {
    setErroCli('')
    if (!novoCli.nome.trim()) { setErroCli('Nome é obrigatório'); setAbaCli('pessoal'); return }
    if (!novoCli.celular.trim()) { setErroCli('Celular é obrigatório'); setAbaCli('contato'); return }
    setSalvandoCli(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novoCli,
          celular: novoCli.celular.replace(/\D/g, '') || null,
          whatsapp: novoCli.whatsapp.replace(/\D/g, '') || novoCli.celular.replace(/\D/g, '') || null,
          cpf: novoCli.cpf.replace(/\D/g, '') || null,
          limite_credito: parseFloat(novoCli.limite_credito) || 0,
          desconto_familia: parseFloat(novoCli.desconto_familia) || 0,
          data_casamento: novoCli.data_casamento || null,
          whatsapp_ativo: !!(novoCli.whatsapp || novoCli.celular),
          ativo: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao cadastrar cliente')
      setCliente(data)
      setMostrarModalCli(false)
      setAbaCli('pessoal')
    } catch (e: any) {
      setErroCli(e.message)
    } finally {
      setSalvandoCli(false)
    }
  }

  // ─── CADASTRO RÁPIDO DE PRODUTO ──────────────────────────
  async function abrirModalProduto() {
    const res = await fetch('/api/produtos/proximo-codigo')
    const data = await res.json()
    setNovoProd({
      cod_referencia: data.codigo || '',
      descricao: buscaProduto,
      grupo: '',
      preco_venda: '',
      estoque_inicial: 0,
      cor: '',
      tamanho: '',
      marca: '',
      preco_custo: '',
    })
    setMaisDetalhesProd(false)
    setMostrarModalProd(true)
  }

  async function salvarProdutoRapido() {
    if (!novoProd.descricao.trim()) return
    setSalvandoProd(true)
    try {
      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cod_referencia: novoProd.cod_referencia,
          descricao: novoProd.descricao.trim(),
          grupo: novoProd.grupo.trim() || 'Geral',
          preco_venda: parseFloat(novoProd.preco_venda) || 0,
          preco_custo: parseFloat(novoProd.preco_custo) || 0,
          estoque: parseInt(novoProd.estoque_inicial) || 0,
          cor: novoProd.cor || null,
          tamanho: novoProd.tamanho || null,
          marca: novoProd.marca || null,
          ativo: true,
          cadastrado_no_pdv: true,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.erro || 'Erro ao cadastrar produto')
      }
      const prod = await res.json()
      adicionarProduto(prod)
      setMostrarModalProd(false)
      setBuscaProduto('')
      setSemResultadosProd(false)
      setToastPDV('Produto cadastrado e adicionado à venda!')
      setTimeout(() => setToastPDV(''), 3500)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSalvandoProd(false)
    }
  }

  // ─── BUSCA POR CÓDIGO DE BARRAS EXATO ────────────────────
  async function buscarPorCodigoBarras(codigo: string) {
    if (!codigo.trim()) return
    const res = await fetch(`/api/produtos?q=${encodeURIComponent(codigo)}&limite=1`)
    const data = await res.json()
    const prod = (data.produtos || [])[0]
    if (prod && (prod.cod_barras === codigo || prod.cod_referencia === codigo)) {
      adicionarProduto(prod)
    }
  }

  // ─── FINALIZAR VENDA ────────────────────────────────────
  async function finalizarVenda() {
    if (!cliente) {
      setErro('Cadastro do cliente é obrigatório. Selecione um cliente existente ou cadastre um novo.')
      return
    }
    if (carrinho.length === 0) { setErro('Adicione pelo menos um produto'); return }
    if (falta > 0.01) { setErro(`Falta ${BRL(falta)} para cobrir o total`); return }
    if (!vendedor.trim()) { setErro('Informe o nome do vendedor'); return }

    setSalvando(true)
    setErro('')

    const payload = {
      vendedor,
      cod_cliente: cliente.id,
      nome_cliente: cliente.nome,
      itens: carrinho.map(i => ({
        cod_produto: i.cod_produto,
        produto: i.produto,
        preco_venda: i.preco_venda,
        quantidade: i.quantidade,
        sub_total: i.sub_total,
        desconto_valor: i.desconto_valor,
        desconto_pct: i.desconto_pct,
      })),
      pagamentos: pagamentos.map(p => ({
        forma: p.forma,
        operadora: p.operadora || null,
        conta: null,
        valor: p.valor,
        parcela: null,
        conta_a_receber: p.forma === 'Crediário',
      })),
      crediario: temCrediario ? parcelasCrediario : [],
      desc_porcentagem: descontoPct / 100,
      desc_valor: descontoValor,
      valor_total: totalFinal,
      situacao: 'Venda',
      observacao: observacao || null,
    }

    let res: Response
    try {
      res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      setErro('Sem conexão com o servidor. Verifique a internet e tente novamente.')
      setSalvando(false)
      return
    }

    // Sessão expirada: middleware redireciona para /auth/login e retorna HTML
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      setErro('Sessão expirada. Recarregue a página e faça login novamente antes de finalizar a venda.')
      setSalvando(false)
      return
    }

    if (!res.ok) {
      const err = await res.json()
      setErro(err.erro || 'Erro ao registrar venda')
      setSalvando(false)
      return
    }

    const venda = await res.json()
    setVendaFinalizada(venda)
    setEtapa('confirmado')
    setSalvando(false)
    setModalImprimir(true)
  }

  async function imprimirVendaAtual(vias: 1 | 2 = 1) {
    if (!vendaFinalizada) return
    await imprimirRecibo({
      empresa: 'Jeito de Ser — (31) 3741-3668',
      nomeCliente: cliente?.nome || 'Cliente',
      nomeVendedora: vendedor,
      codVenda: vendaFinalizada.codigo_legado || vendaFinalizada.id,
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      itens: carrinho.map(i => ({ produto: i.produto, quantidade: i.quantidade, preco: i.preco_venda, subtotal: i.sub_total })),
      pagamentos: pagamentos.map(p => ({ forma: p.forma, valor: p.valor })),
      desconto: descontoValor > 0 ? descontoValor : undefined,
      valorTotal: totalFinal,
      crediario: temCrediario ? parcelasCrediario.map(p => ({ parcela: p.parcela, vencimento: p.data_vencimento, valor: p.valor })) : undefined,
      observacao: observacao || undefined,
    }, undefined, vias)
  }

  function resetarPDV() {
    setCarrinho([]); setCliente(null); setBuscaCliente(''); setDescontoRs(0); setDescontoPct(0)
    setPagamentos([{ forma: 'Dinheiro', operadora: '', valor: 0, conta_a_receber: false }])
    setParcelasCrediario([]); setObservacao(''); setEtapa('carrinho'); setVendaFinalizada(null)
    setModalImprimir(false)
  }

  // ─── RENDER: CONFIRMADO ─────────────────────────────────
  if (etapa === 'confirmado') {
    return (
      <AppLayout>
        {/* MODAL: Deseja imprimir? */}
        {modalImprimir && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '32px', width: 400, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖨</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 8 }}>Imprimir recibo?</h3>
              {troco > 0 && (
                <div style={{ margin: '12px 0', padding: '12px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#C9A84C', fontWeight: 700 }}>Troco: {BRL(troco)}</span>
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Quantas vias deseja imprimir?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalImprimir(false)}>
                  Não imprimir
                </button>
                <button className="btn btn-ghost" style={{ flex: 1, borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C' }}
                  onClick={async () => { localStorage.setItem('preferencia_vias','1'); await imprimirVendaAtual(1); setModalImprimir(false) }}>
                  🖨 1 via
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }}
                  onClick={async () => { localStorage.setItem('preferencia_vias','2'); await imprimirVendaAtual(2); setModalImprimir(false) }}>
                  🖨 2 vias
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, rgba(76,175,130,0.2), rgba(76,175,130,0.05))', border: '2px solid rgba(76,175,130,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>✓</div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: '#4CAF82' }}>Venda Registrada!</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              Venda #{vendaFinalizada?.codigo_legado || vendaFinalizada?.id} · {BRL(totalFinal)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => imprimirVendaAtual(1)}>🖨 1 via</button>
            <button className="btn btn-ghost" onClick={() => imprimirVendaAtual(2)}>🖨 2 vias</button>
            <button className="btn btn-ghost" onClick={() => router.push(`/clientes/${cliente?.id}`)}>Ver Cliente</button>
            <button className="btn btn-primary" onClick={resetarPDV}>+ Nova Venda</button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ─── RENDER PRINCIPAL ───────────────────────────────────
  return (
    <AppLayout>
      {/* TOAST PRODUTO CADASTRADO */}
      {toastPDV && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: 'rgba(76,175,130,0.15)', border: '1px solid rgba(76,175,130,0.35)', borderRadius: 10, padding: '12px 18px', color: '#4CAF82', fontSize: 13, fontWeight: 600, backdropFilter: 'blur(8px)', animation: 'silkFade 0.3s ease forwards' }}>
          ✓ {toastPDV}
        </div>
      )}

      {/* MODAL CADASTRO RÁPIDO DE PRODUTO */}
      {mostrarModalProd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'silkFade 0.25s ease forwards' }}
          onClick={e => { if (e.target === e.currentTarget) setMostrarModalProd(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 28, margin: 16, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 4 }}>
              Cadastrar Produto
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              Cadastro rápido feito no PDV. O produto será adicionado ao carrinho automaticamente.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {/* Código gerado automaticamente */}
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Código (gerado)</label>
                <input className="input" value={novoProd.cod_referencia} readOnly
                  style={{ opacity: 0.65, cursor: 'default', fontFamily: 'monospace', letterSpacing: '0.05em' }} />
              </div>

              {/* Descrição */}
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Descrição *</label>
                <input className="input" autoFocus value={novoProd.descricao}
                  onChange={e => setNovoProd((p: any) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: Blusa floral manga longa" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {/* Grupo */}
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Grupo</label>
                  <input className="input" value={novoProd.grupo} list="grupos-lista"
                    onChange={e => setNovoProd((p: any) => ({ ...p, grupo: e.target.value }))}
                    placeholder="Ex: Blusas" />
                  <datalist id="grupos-lista">
                    {['Blusas','Vestidos','Calças','Saias','Casacos','Acessórios','Calçados','Lingerie','Moda Praia','Camisetas','Conjuntos','Jaquetas','Shorts'].map(g => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>
                {/* Preço */}
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Preço venda (R$)</label>
                  <input className="input" type="number" min={0} step={0.01} value={novoProd.preco_venda}
                    onChange={e => setNovoProd((p: any) => ({ ...p, preco_venda: e.target.value }))}
                    placeholder="0,00" />
                </div>
                {/* Estoque inicial */}
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Estoque inicial</label>
                  <input className="input" type="number" min={0} value={novoProd.estoque_inicial}
                    onChange={e => setNovoProd((p: any) => ({ ...p, estoque_inicial: e.target.value }))} />
                </div>
              </div>

              {/* Mais detalhes colapsável */}
              <button type="button" onClick={() => setMaisDetalhesProd(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold-dim)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'left', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                {maisDetalhesProd ? '▾' : '▸'} + Mais detalhes (Cor, Tamanho, Marca, Custo)
              </button>

              {maisDetalhesProd && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  {[
                    ['Cor', 'cor', 'Azul, Rosa...'],
                    ['Tamanho', 'tamanho', 'P, M, G, 38...'],
                    ['Marca', 'marca', ''],
                    ['Preço de custo (R$)', 'preco_custo', '0,00'],
                  ].map(([label, field, placeholder]) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
                      <input className="input" value={novoProd[field]}
                        placeholder={placeholder}
                        onChange={e => setNovoProd((p: any) => ({ ...p, [field]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
              <button className="btn btn-ghost" onClick={() => setMostrarModalProd(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarProdutoRapido} disabled={salvandoProd || !novoProd.descricao.trim()}>
                {salvandoProd ? 'Salvando...' : '✓ Cadastrar e Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO DE CLIENTE */}
      {mostrarModalCli && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          animation: 'silkFade 0.25s ease forwards',
        }} onClick={(e) => { if (e.target === e.currentTarget) { setMostrarModalCli(false); setErroCli('') } }}>
          <div className="card" style={{ width: '100%', maxWidth: 720, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

            {/* Header */}
            <div style={{ padding: '22px 28px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', margin: 0 }}>
                    Cadastrar Cliente
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Preencha os dados e o cliente será vinculado a esta venda.
                  </p>
                </div>
                <button type="button" onClick={() => { setMostrarModalCli(false); setErroCli('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
              </div>

              {erroCli && (
                <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.3)', color: '#E5584A', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                  {erroCli}
                </div>
              )}

              {/* Abas */}
              <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
                {([
                  ['pessoal', 'Pessoal'],
                  ['familia', 'Família'],
                  ['contato', 'Contato'],
                  ['endereco', 'Endereço'],
                  ['trabalho', 'Trabalho'],
                  ['credito', 'Crédito'],
                  ['refs', 'Referências'],
                ] as [typeof abaCli, string][]).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setAbaCli(id)}
                    style={{
                      padding: '7px 14px', borderRadius: '8px 8px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
                      fontSize: 12, fontWeight: 600,
                      background: abaCli === id ? 'rgba(201,168,76,0.15)' : 'transparent',
                      color: abaCli === id ? '#C9A84C' : 'var(--text-muted)',
                      border: `1px solid ${abaCli === id ? 'rgba(201,168,76,0.3)' : 'transparent'}`,
                      borderBottom: 'none',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ borderBottom: '1px solid rgba(201,168,76,0.2)' }} />
            </div>

            {/* Conteúdo rolável */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

              {/* PESSOAL */}
              {abaCli === 'pessoal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: '1 / span 2' }}>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Nome completo *</label>
                    <input className="input" autoFocus value={novoCli.nome} onChange={fcli('nome')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Data de nascimento</label>
                    <input className="input" type="date" value={novoCli.data_nascimento} onChange={fcli('data_nascimento')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>CPF</label>
                    <input className="input" placeholder="000.000.000-00" value={novoCli.cpf} onChange={fcli('cpf')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>RG / Identidade</label>
                    <input className="input" value={novoCli.identidade} onChange={fcli('identidade')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Estado civil</label>
                    <select className="input" value={novoCli.estado_civil} onChange={fcli('estado_civil')}>
                      <option value="">—</option>
                      {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* FAMÍLIA */}
              {abaCli === 'familia' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {([
                    { label: 'Cônjuge', field: 'conjuge' },
                    { label: 'Tel. do cônjuge', field: 'conjuge_telefone', type: 'tel' },
                    { label: 'Data do casamento', field: 'data_casamento', type: 'date' },
                    null,
                    { label: 'Filho(a)', field: 'filho' },
                    { label: 'Tel. do filho(a)', field: 'filho_telefone', type: 'tel' },
                    { label: 'Filiação (Mãe)', field: 'filiacao_mae' },
                    { label: 'Tel. da mãe', field: 'filiacao_mae_tel', type: 'tel' },
                    { label: 'Filiação (Pai)', field: 'filiacao_pai' },
                    { label: 'Tel. do pai', field: 'filiacao_pai_tel', type: 'tel' },
                  ] as any[]).map((item, i) => item ? (
                    <div key={item.field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{item.label}</label>
                      <input className="input" type={item.type || 'text'} value={(novoCli as any)[item.field]} onChange={fcli(item.field)} />
                    </div>
                  ) : <div key={i} />)}
                </div>
              )}

              {/* CONTATO */}
              {abaCli === 'contato' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {([
                    { label: 'Celular *', field: 'celular', placeholder: '(31) 9 0000-0000' },
                    { label: 'Telefone', field: 'telefone' },
                    { label: 'WhatsApp', field: 'whatsapp', placeholder: '(31) 9 0000-0000' },
                    { label: 'Email', field: 'email', type: 'email' },
                    { label: 'Rede social', field: 'rede_social', placeholder: '@usuario' },
                  ] as any[]).map(({ label, field, type, placeholder }: any) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
                      <input className="input" type={type || 'tel'} placeholder={placeholder} value={(novoCli as any)[field]} onChange={fcli(field)} />
                    </div>
                  ))}
                </div>
              )}

              {/* ENDEREÇO */}
              {abaCli === 'endereco' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>CEP</label>
                    <input className="input" placeholder="00000-000" value={novoCli.cep} onChange={fcli('cep')} />
                  </div>
                  <div style={{ gridColumn: '2 / span 2' }}>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Endereço</label>
                    <input className="input" placeholder="Rua, Avenida..." value={novoCli.endereco} onChange={fcli('endereco')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Número</label>
                    <input className="input" value={novoCli.numero} onChange={fcli('numero')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Complemento</label>
                    <input className="input" value={novoCli.complemento} onChange={fcli('complemento')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Bairro</label>
                    <input className="input" value={novoCli.bairro} onChange={fcli('bairro')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Cidade</label>
                    <input className="input" value={novoCli.cidade} onChange={fcli('cidade')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Estado</label>
                    <select className="input" value={novoCli.estado} onChange={fcli('estado')}>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                        <option key={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* TRABALHO */}
              {abaCli === 'trabalho' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {([
                    { label: 'Empresa', field: 'trabalho_nome' },
                    { label: 'Cargo', field: 'trabalho_cargo' },
                    { label: 'Tel. do trabalho', field: 'trabalho_telefone', type: 'tel' },
                    { label: 'Renda mensal', field: 'renda', placeholder: 'Ex: R$ 2.000,00' },
                    { label: 'Tempo no emprego', field: 'trabalho_tempo', placeholder: 'Ex: 3 anos' },
                  ] as any[]).map(({ label, field, type, placeholder }: any) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
                      <input className="input" type={type || 'text'} placeholder={placeholder} value={(novoCli as any)[field]} onChange={fcli(field)} />
                    </div>
                  ))}
                </div>
              )}

              {/* CRÉDITO & PERFIL */}
              {abaCli === 'credito' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Categoria</label>
                    <select className="input" value={novoCli.categoria} onChange={fcli('categoria')}>
                      {['Avista', 'Crediário', 'Pendente'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  {([
                    { label: 'Limite de crédito (R$)', field: 'limite_credito', type: 'number', placeholder: '0,00' },
                    { label: 'Desconto família (%)', field: 'desconto_familia', type: 'number', placeholder: '0' },
                    { label: 'Tamanho (roupa)', field: 'tamanho', placeholder: 'P, M, G, 38...' },
                    { label: 'Tamanho 2', field: 'tamanho2' },
                    { label: 'Tamanho 3', field: 'tamanho3' },
                    { label: 'Perfil / Estilo', field: 'perfil', placeholder: 'Moda jovem, clássica...' },
                  ] as any[]).map(({ label, field, type, placeholder }: any) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
                      <input className="input" type={type || 'text'} placeholder={placeholder} value={(novoCli as any)[field]} onChange={fcli(field)} />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / span 2' }}>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Observação</label>
                    <textarea className="input" rows={3} placeholder="Anotações sobre a cliente..." value={novoCli.observacao} onChange={fcli('observacao')} style={{ resize: 'vertical' }} />
                  </div>
                </div>
              )}

              {/* REFERÊNCIAS */}
              {abaCli === 'refs' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {([
                    { label: 'Ref. comercial', field: 'ref_comercial' },
                    { label: 'Tel. comercial', field: 'ref_comercial_tel', type: 'tel' },
                    { label: 'Ref. pessoal 1', field: 'ref_pessoal1' },
                    { label: 'Tel. pessoal 1', field: 'ref_pessoal1_tel', type: 'tel' },
                    { label: 'Ref. pessoal 2', field: 'ref_pessoal2' },
                    { label: 'Tel. pessoal 2', field: 'ref_pessoal2_tel', type: 'tel' },
                  ] as any[]).map(({ label, field, type }: any) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
                      <input className="input" type={type || 'text'} value={(novoCli as any)[field]} onChange={fcli(field)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['pessoal','familia','contato','endereco','trabalho','credito','refs'] as const).map(tab => (
                  <div key={tab} onClick={() => setAbaCli(tab)} style={{ width: 8, height: 8, borderRadius: '50%', background: abaCli === tab ? '#C9A84C' : 'var(--border)', cursor: 'pointer' }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" type="button" onClick={() => { setMostrarModalCli(false); setErroCli('') }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" type="button" onClick={criarClienteRapido} disabled={salvandoCli}>
                  {salvandoCli ? 'Salvando...' : '✓ Cadastrar e Usar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button onClick={() => router.push('/vendas')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>‹ Vendas</button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#F2EBD9' }}>Nova Venda</h1>
          </div>
          {/* Status impressora */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: impressoraStatus === 'conectada' ? '#4CAF82' : impressoraStatus === 'offline' ? '#E5584A' : 'var(--text-muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: impressoraStatus === 'conectada' ? '#4CAF82' : impressoraStatus === 'offline' ? '#E5584A' : 'var(--text-muted)', display: 'inline-block' }} />
            {impressoraStatus === 'conectada' ? 'Impressora conectada' : impressoraStatus === 'offline' ? 'Impressora offline' : 'Verificando...'}
          </div>
          {/* Abas de etapa */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[['carrinho', 'Carrinho'], ['pagamento', 'Pagamento']].map(([id, label]) => (
              <button key={id} onClick={() => { if (id === 'pagamento' && carrinho.length === 0) return; setEtapa(id as any) }}
                style={{
                  padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                  background: etapa === id ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.03)',
                  color: etapa === id ? '#C9A84C' : 'var(--text-muted)',
                  border: `1px solid ${etapa === id ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {erro && (
          <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.25)', borderRadius: 10, padding: '12px 16px', color: '#E5584A', fontSize: 13 }}>
            ⚠ {erro}
          </div>
        )}

        {/* ETAPA: CARRINHO */}
        {etapa === 'carrinho' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

            {/* COLUNA ESQUERDA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* CLIENTE — obrigatório */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9' }}>
                    Cliente <span style={{ color: '#E5584A', fontSize: 12 }}>*</span>
                  </h3>
                  {!cliente && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Obrigatório
                    </span>
                  )}
                </div>
                {cliente ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.05))', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C', fontSize: 16 }}>{cliente.nome?.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#F2EBD9', fontWeight: 600 }}>{cliente.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cliente.celular || cliente.whatsapp || '—'} · {cliente.categoria || '—'}</div>
                    </div>
                    <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => { setCliente(null); setBuscaCliente('') }}>✕ Trocar</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative', overflow: 'visible' }}>
                    <input className="input" placeholder="Buscar cliente por nome, CPF ou telefone..." value={buscaCliente}
                      onChange={e => setBuscaCliente(e.target.value)}
                      onFocus={() => sugestoesCli.length > 0 && setMostrarSugestoesCli(true)}
                    />
                    {mostrarSugestoesCli && sugestoesCli.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: '#1a1610', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-dropdown)', marginTop: 4 }}>
                        {sugestoesCli.map(c => (
                          <div key={c.id} onClick={() => { setCliente(c); setBuscaCliente(''); setMostrarSugestoesCli(false) }}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 500 }}>{c.nome}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.celular || c.cpf || '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        // Se já está digitando algo, usa como nome inicial
                        setNovoCli(c => ({ ...c, nome: buscaCliente || c.nome }))
                        setMostrarModalCli(true)
                      }}
                      className="btn btn-ghost"
                      style={{ marginTop: 10, padding: '8px 14px', fontSize: 12, width: '100%', justifyContent: 'center' }}
                    >
                      + Cadastrar novo cliente
                    </button>
                  </div>
                )}
              </div>

              {/* BUSCA PRODUTO */}
              <div className="card" style={{ overflow: 'visible', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9' }}>Adicionar Produto</h3>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>F2 para focar · Enter no cód. barras</span>
                </div>
                {/* position:relative contém TODOS os elementos flutuantes — dropdown e "nenhum resultado" */}
                <div style={{ position: 'relative' }}>
                  <input ref={inputProdRef} className="input"
                    placeholder="Buscar por nome, código de barras ou referência..."
                    value={buscaProduto}
                    onChange={e => setBuscaProduto(e.target.value)}
                    onFocus={() => sugestoesProd.length > 0 && setMostrarSugestoesProd(true)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { setMostrarSugestoesProd(false); setBuscaProduto('') }
                      if (e.key === 'Enter') { setMostrarSugestoesProd(false); buscarPorCodigoBarras(buscaProduto) }
                    }}
                    autoFocus
                  />

                  {/* DROPDOWN DE SUGESTÕES — absolute, filho direto do div relative */}
                  {mostrarSugestoesProd && sugestoesProd.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: '#1a1610', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', marginTop: 4, maxHeight: 320, overflowY: 'auto' }}>
                      {sugestoesProd.map(p => (
                        <div key={p.id} onClick={() => adicionarProduto(p)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)', display: 'grid', gridTemplateColumns: '1fr auto auto' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div>
                            <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 500 }}>{p.descricao}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.grupo}{p.cor ? ` · ${p.cor}` : ''}{p.tamanho ? ` · ${p.tamanho}` : ''}</div>
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#C9A84C', padding: '0 12px', alignSelf: 'center' }}>
                            {BRL(p.preco_venda)}
                          </div>
                          <div style={{ fontSize: 11, color: p.estoque > 0 ? '#4CAF82' : '#E5584A', alignSelf: 'center', fontWeight: p.estoque <= 0 ? 700 : 400 }}>
                            {p.estoque <= 0 ? '⚠ Sem estoque' : `Estoque: ${p.estoque}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* NENHUM RESULTADO — absolute, filho direto do div relative, nunca no fluxo normal */}
                  {semResultadosProd && !buscandoProd && buscaProduto.length >= 2 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4, padding: '12px 14px', background: '#1a1610', border: '1px dashed rgba(201,168,76,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                        Nenhum produto para <strong style={{ color: '#F2EBD9' }}>"{buscaProduto}"</strong>
                      </p>
                      <button type="button" onClick={abrirModalProduto}
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        + Cadastrar este produto agora
                      </button>
                    </div>
                  )}
                </div>
                {/* NADA MAIS DENTRO DESTE CARD após o div position:relative */}
              </div>

              {/* CARRINHO */}
              {carrinho.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 90px 120px 44px', gap: 8, background: 'rgba(201,168,76,0.03)' }}>
                    {['Produto', 'Qtd', 'Preço unit.', ''].map(h => (
                      <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                  </div>
                  {carrinho.map((item, i) => (
                    <div key={item.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 90px 120px 44px',
                      gap: 8, padding: '11px 18px', alignItems: 'center',
                      borderBottom: i < carrinho.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 500 }}>{item.produto}</div>
                        <div style={{ fontSize: 12, color: '#C9A84C', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                          {BRL(item.sub_total)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => alterarQtd(item.id, item.quantidade - 1)}
                          style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', cursor: 'pointer', color: '#F2EBD9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1 }}>−</button>
                        <span style={{ fontSize: 14, color: '#F2EBD9', fontWeight: 600, minWidth: 22, textAlign: 'center' }}>{item.quantidade}</span>
                        <button onClick={() => alterarQtd(item.id, item.quantidade + 1)}
                          style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', cursor: 'pointer', color: '#F2EBD9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1 }}>+</button>
                      </div>
                      <input type="number" className="input" style={{ padding: '5px 8px', fontSize: 13 }}
                        value={item.preco_venda} min={0} step={0.01}
                        onChange={e => alterarPreco(item.id, parseFloat(e.target.value) || 0)}
                      />
                      <button onClick={() => removerItem(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: 0, textAlign: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* VENDEDOR E OBSERVAÇÃO */}
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Campo label="Vendedor(a) *">
                    {isAdmin && vendedoras.length > 0 ? (
                      <select className="input" value={vendedor} onChange={e => setVendedor(e.target.value)}>
                        <option value="">Selecionar vendedora...</option>
                        {vendedoras.map((v: any) => (
                          <option key={v.id} value={v.nome}>{v.apelido || v.nome}</option>
                        ))}
                      </select>
                    ) : (
                      <input className="input" value={vendedor} readOnly={!isAdmin} onChange={e => isAdmin && setVendedor(e.target.value)} placeholder="Nome da vendedora" />
                    )}
                  </Campo>
                  <Campo label="Observação">
                    <input className="input" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional..." />
                  </Campo>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA — RESUMO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 20 }}>
              <div className="card" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#F2EBD9', marginBottom: 16 }}>Resumo</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>{carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'} · {carrinho.reduce((s, i) => s + i.quantidade, 0)} un.</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{BRL(subtotalBruto)}</span>
                  </div>

                  <div style={{ background: 'rgba(229,88,74,0.04)', border: '1px solid rgba(229,88,74,0.12)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Desconto</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--gold-dim)', display: 'block', marginBottom: 4, fontWeight: 600 }}>R$</label>
                        <input type="number" className="input" min={0} step={0.01}
                          value={descontoRs || ''}
                          onChange={e => handleDescontoRs(parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--gold-dim)', display: 'block', marginBottom: 4, fontWeight: 600 }}>%</label>
                        <input type="number" className="input" min={0} max={100} step={0.5}
                          value={descontoPct ? parseFloat(descontoPct.toFixed(2)) : ''}
                          onChange={e => handleDescontoPct(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {descontoRs > 0 && (
                      <div style={{ fontSize: 11, color: '#E5584A', marginTop: 5, textAlign: 'right' }}>- {BRL(descontoRs)} no total</div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#C9A84C' }}>{BRL(totalFinal)}</span>
                  </div>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16, padding: '13px', fontSize: 15, justifyContent: 'center' }}
                  disabled={carrinho.length === 0}
                  onClick={() => { if (carrinho.length > 0) setEtapa('pagamento') }}>
                  Ir para Pagamento →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA: PAGAMENTO */}
        {etapa === 'pagamento' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

            {/* FORMAS DE PAGAMENTO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#F2EBD9' }}>Formas de Pagamento</h3>
                  <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={addPagamento}>+ Adicionar</button>
                </div>

                {pagamentos.map((pg, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 12, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <Campo label="Forma">
                      <SelectCustom
                        value={pg.forma}
                        onChange={v => updPagamento(idx, 'forma', v)}
                        options={FORMAS}
                      />
                    </Campo>
                    <Campo label="Valor (R$)">
                      <input type="number" className="input" value={pg.valor} min={0} step={0.01}
                        onChange={e => updPagamento(idx, 'valor', parseFloat(e.target.value) || 0)} />
                    </Campo>
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                      {pagamentos.length > 1 && (
                        <button onClick={() => remPagamento(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>✕</button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Atalho: distribuir valor total */}
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 12px' }}
                  onClick={() => setPagamentos(p => p.map((pg, i) => i === 0 ? { ...pg, valor: totalFinal } : pg))}>
                  Distribuir total no 1º pagamento
                </button>
              </div>

              {/* CREDIÁRIO — configuração de parcelas */}
              {temCrediario && (
                <div className="card" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#F2EBD9', marginBottom: 16 }}>Configurar Crediário</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <Campo label="Nº de parcelas">
                      <select className="input" value={qtdParcelas} onChange={e => setQtdParcelas(parseInt(e.target.value))}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </Campo>
                    <Campo label="Dia do vencimento">
                      <select className="input" value={diaVencimento} onChange={e => setDiaVencimento(parseInt(e.target.value))}>
                        {[1,5,10,15,20,25,30].map(d => <option key={d} value={d}>Dia {d}</option>)}
                      </select>
                    </Campo>
                  </div>

                  {parcelasCrediario.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
                        Parcelas geradas
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {parcelasCrediario.map((p, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px', gap: 12, padding: '9px 0', borderBottom: i < parcelasCrediario.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.parcela}</span>
                            <span style={{ fontSize: 12, color: '#F2EBD9' }}>{new Date(p.data_vencimento).toLocaleDateString('pt-BR')}</span>
                            <input type="number" className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                              value={p.valor} step={0.01}
                              onChange={e => setParcelasCrediario(prev => prev.map((pp, ii) => ii === i ? { ...pp, valor: parseFloat(e.target.value) || 0 } : pp))}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* RESUMO FINAL */}
            <div style={{ position: 'sticky', top: 20 }}>
              <div className="card" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#F2EBD9', marginBottom: 16 }}>Resumo da Venda</h3>

                {/* Itens resumidos */}
                <div style={{ marginBottom: 16, maxHeight: 160, overflowY: 'auto' }}>
                  {carrinho.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
                      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{item.produto} x{item.quantidade}</span>
                      <span style={{ color: '#F2EBD9', flexShrink: 0 }}>{BRL(item.sub_total)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {descontoValor > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#E5584A' }}>
                      <span>Desconto ({descontoPct > 0 ? `${parseFloat(descontoPct.toFixed(1))}%` : BRL(descontoValor)})</span>
                      <span>- {BRL(descontoValor)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#C9A84C', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <span>Total</span><span>{BRL(totalFinal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: totalPago >= totalFinal ? '#4CAF82' : '#E5584A' }}>
                    <span>Pago</span><span>{BRL(totalPago)}</span>
                  </div>
                  {troco > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#4CAF82' }}>
                      <span>Troco</span><span>{BRL(troco)}</span>
                    </div>
                  )}
                  {falta > 0.01 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#E5584A' }}>
                      <span>Falta</span><span>{BRL(falta)}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEtapa('carrinho')}>‹ Voltar</button>
                  <button className="btn btn-primary"
                    style={{ flex: 2, justifyContent: 'center', padding: '13px', fontSize: 15, opacity: (falta > 0.01 || salvando) ? 0.5 : 1 }}
                    disabled={falta > 0.01 || salvando}
                    onClick={finalizarVenda}>
                    {salvando ? 'Finalizando...' : '✓ Finalizar Venda'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}