// src/app/vendas/nova/page.tsx
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { imprimirRecibo } from '@/lib/impressora'

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

  // Modal de cadastro rápido de cliente (obrigatório se cliente não existe)
  const [mostrarModalCli, setMostrarModalCli] = useState(false)
  const [novoCli, setNovoCli] = useState({ nome: '', celular: '', cpf: '', categoria: 'Avista' })
  const [salvandoCli, setSalvandoCli] = useState(false)
  const [erroCli, setErroCli] = useState('')

  // Estado dos produtos / carrinho
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [buscaProduto, setBuscaProduto] = useState('')
  const [sugestoesProd, setSugestoesProd] = useState<any[]>([])
  const [mostrarSugestoesProd, setMostrarSugestoesProd] = useState(false)
  const [descontoGlobal, setDescontoGlobal] = useState(0) // %

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

  const isAdmin = perfilUsuario?.perfil === 'admin'
  const podeAlterarDesconto = isAdmin || perfilUsuario?.alterar_preco_pdv

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
    if (buscaProduto.length < 2) { setSugestoesProd([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/produtos?q=${encodeURIComponent(buscaProduto)}&limite=8`)
      const data = await res.json()
      setSugestoesProd(data.produtos || [])
      setMostrarSugestoesProd(true)
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
  const descontoValor = descontoGlobal > 0 ? subtotalBruto * (descontoGlobal / 100) : 0
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
    const hoje = new Date()

    for (let i = 0; i < qtdParcelas; i++) {
      const venc = new Date(hoje)
      venc.setMonth(venc.getMonth() + i + 1)
      venc.setDate(diaVencimento)
      parcelas.push({
        parcela: `${i + 1}/${qtdParcelas}`,
        data_vencimento: venc.toISOString().split('T')[0],
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

  // ─── CADASTRO RÁPIDO DE CLIENTE ───────────────────────────
  async function criarClienteRapido() {
    setErroCli('')
    if (!novoCli.nome.trim()) { setErroCli('Nome é obrigatório'); return }
    if (!novoCli.celular.trim()) { setErroCli('Celular é obrigatório para contato/WhatsApp'); return }
    setSalvandoCli(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novoCli.nome.trim(),
          celular: novoCli.celular.replace(/\D/g, ''),
          whatsapp: novoCli.celular.replace(/\D/g, ''),
          cpf: novoCli.cpf.replace(/\D/g, '') || null,
          categoria: novoCli.categoria,
          ativo: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro || 'Erro ao cadastrar cliente')
      // Seleciona o cliente recém-criado
      setCliente(data)
      setMostrarModalCli(false)
      setNovoCli({ nome: '', celular: '', cpf: '', categoria: 'Avista' })
    } catch (e: any) {
      setErroCli(e.message)
    } finally {
      setSalvandoCli(false)
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
      desc_porcentagem: descontoGlobal / 100,
      desc_valor: descontoValor,
      valor_total: totalFinal,
      situacao: 'Venda',
      observacao: observacao || null,
    }

    const res = await fetch('/api/vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

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

  async function imprimirVendaAtual() {
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
    })
  }

  function resetarPDV() {
    setCarrinho([]); setCliente(null); setBuscaCliente(''); setDescontoGlobal(0)
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
            <div style={{ background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '32px', width: 380, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖨</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 8 }}>Imprimir recibo?</h3>
              {troco > 0 && (
                <div style={{ margin: '12px 0', padding: '12px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#C9A84C', fontWeight: 700 }}>Troco: {BRL(troco)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalImprimir(false)}>Não imprimir</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => { await imprimirVendaAtual(); setModalImprimir(false) }}>Imprimir</button>
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
            <button className="btn btn-ghost" onClick={imprimirVendaAtual}>🖨 Reimprimir</button>
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
      {/* MODAL CADASTRO RÁPIDO DE CLIENTE */}
      {mostrarModalCli && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'silkFade 0.25s ease forwards',
        }} onClick={(e) => { if (e.target === e.currentTarget) setMostrarModalCli(false) }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 28, margin: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 6 }}>
              Cadastrar cliente
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
              Cadastro rápido para esta venda. Você pode completar os dados depois em <strong>Clientes</strong>.
            </p>
            {erroCli && (
              <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.3)', color: '#E5584A', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                {erroCli}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                  Nome *
                </label>
                <input className="input" value={novoCli.nome}
                  onChange={e => setNovoCli(c => ({ ...c, nome: e.target.value }))}
                  autoFocus required />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                  Celular / WhatsApp *
                </label>
                <input className="input" inputMode="numeric" value={novoCli.celular}
                  onChange={e => setNovoCli(c => ({ ...c, celular: e.target.value }))}
                  placeholder="(31) 99999-9999" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                    CPF (opcional)
                  </label>
                  <input className="input" inputMode="numeric" value={novoCli.cpf}
                    onChange={e => setNovoCli(c => ({ ...c, cpf: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
                    Categoria
                  </label>
                  <select className="input" value={novoCli.categoria}
                    onChange={e => setNovoCli(c => ({ ...c, categoria: e.target.value }))}>
                    <option value="Avista">Avista</option>
                    <option value="Crediário">Crediário</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
              <button className="btn btn-ghost" onClick={() => { setMostrarModalCli(false); setErroCli('') }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={criarClienteRapido} disabled={salvandoCli}>
                {salvandoCli ? 'Salvando...' : 'Cadastrar e Usar'}
              </button>
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
                  <div style={{ position: 'relative' }}>
                    <input className="input" placeholder="Buscar cliente por nome, CPF ou telefone..." value={buscaCliente}
                      onChange={e => setBuscaCliente(e.target.value)}
                      onFocus={() => sugestoesCli.length > 0 && setMostrarSugestoesCli(true)}
                    />
                    {mostrarSugestoesCli && sugestoesCli.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1a1610', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-dropdown)', marginTop: 4 }}>
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
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9' }}>Adicionar Produto</h3>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>F2 para focar · Enter no cód. barras</span>
                </div>
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
                  {mostrarSugestoesProd && sugestoesProd.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1a1610', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-dropdown)', marginTop: 4 }}>
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
                </div>
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

                  {podeAlterarDesconto && (
                    <div>
                      <Campo label="Desconto (%)">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="number" className="input" style={{ width: 80 }} value={descontoGlobal} min={0} max={100} step={0.5}
                            onChange={e => setDescontoGlobal(parseFloat(e.target.value) || 0)} />
                          {descontoValor > 0 && (
                            <span style={{ fontSize: 12, color: '#E5584A' }}>- {BRL(descontoValor)}</span>
                          )}
                        </div>
                      </Campo>
                    </div>
                  )}

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
                      <select className="input" value={pg.forma} onChange={e => updPagamento(idx, 'forma', e.target.value)}>
                        {FORMAS.map(f => <option key={f}>{f}</option>)}
                      </select>
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
                      <span>Desconto ({descontoGlobal}%)</span>
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