// src/app/trocas/nova/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { Check, ArrowLeft, ChevronRight, AlertTriangle } from 'lucide-react'

const BRL = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cliente {
  id: number
  nome: string
  telefone?: string
  credito_troca?: number
}

interface Produto {
  id: number
  descricao: string
  grupo?: string
  tamanho?: string
  cor?: string
  preco_venda: number
  estoque: number
}

interface VendaItem {
  cod_produto: number
  produto: string
  quantidade: number
  valor: number
}

const MOTIVOS = ['Tamanho', 'Defeito', 'Não gostou', 'Outro']
const PAGAMENTOS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito']

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepPills({ step }: { step: number }) {
  const steps = [
    { n: 1, label: 'Cliente' },
    { n: 2, label: 'Devolvido' },
    { n: 3, label: 'Novo' },
    { n: 4, label: 'Confirmar' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {steps.map((s, i) => {
        const isCurrent = step === s.n
        const isDone = step > s.n
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && (
              <div style={{
                width: 28,
                height: 1,
                background: isDone ? '#4CAF82' : 'rgba(242,235,217,0.12)',
              }} />
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 14px',
              borderRadius: 24,
              border: isCurrent
                ? '1.5px solid #C9A84C'
                : isDone
                  ? '1.5px solid #4CAF82'
                  : '1.5px solid rgba(242,235,217,0.12)',
              background: isCurrent
                ? 'rgba(201,168,76,0.12)'
                : isDone
                  ? 'rgba(76,175,130,0.08)'
                  : 'transparent',
              transition: 'all 0.3s ease',
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                background: isCurrent
                  ? '#C9A84C'
                  : isDone
                    ? '#4CAF82'
                    : 'rgba(242,235,217,0.08)',
                color: isCurrent || isDone ? '#080608' : 'rgba(242,235,217,0.4)',
              }}>
                {isDone ? <Check size={14} strokeWidth={2.5} /> : s.n}
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent
                  ? '#C9A84C'
                  : isDone
                    ? '#4CAF82'
                    : 'rgba(242,235,217,0.35)',
                letterSpacing: '0.02em',
              }}>
                {s.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Label helper ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: 10,
      color: '#C9A84C',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      display: 'block',
      marginBottom: 6,
      fontWeight: 700,
      opacity: 0.8,
    }}>
      {children}
    </label>
  )
}

// ─── Client search ────────────────────────────────────────────────────────────

function ClienteSearch({
  onSelect,
}: {
  onSelect: (c: Cliente) => void
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Cliente[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clientes?q=${encodeURIComponent(query)}&limite=6`)
        const d = await res.json()
        setSuggestions(d.clientes || [])
        setOpen(true)
      } catch { /* silent */ }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder="Buscar por nome ou telefone..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#0e0b10', border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 10, zIndex: 50, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {suggestions.map(c => (
            <div
              key={c.id}
              onClick={() => { onSelect(c); setQuery(''); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500 }}>{c.nome}</div>
              {c.telefone && (
                <div style={{ fontSize: 11, color: 'rgba(242,235,217,0.4)', marginTop: 2 }}>{c.telefone}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Product search ──────────────────────────────────────────────────────────

function ProdutoSearch({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (p: Produto) => void
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<Produto[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/produtos?q=${encodeURIComponent(value)}&limite=8`)
        const d = await res.json()
        setSuggestions(d.produtos || [])
        setOpen(true)
      } catch { /* silent */ }
    }, 250)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder={placeholder || 'Buscar produto...'}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#0e0b10', border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: 10, zIndex: 50, maxHeight: 260, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {suggestions.map(p => (
            <div
              key={p.id}
              onClick={() => { onSelect(p); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(201,168,76,0.06)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500 }}>{p.descricao}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                {p.grupo && <span style={{ fontSize: 10, color: 'rgba(242,235,217,0.35)' }}>{p.grupo}</span>}
                {p.tamanho && <span style={{ fontSize: 10, color: 'rgba(242,235,217,0.35)' }}>T: {p.tamanho}</span>}
                {p.cor && <span style={{ fontSize: 10, color: 'rgba(242,235,217,0.35)' }}>{p.cor}</span>}
                <span style={{ fontSize: 10, color: '#C9A84C', marginLeft: 'auto' }}>{BRL(Number(p.preco_venda))}</span>
                <span style={{
                  fontSize: 10,
                  color: p.estoque === 0 ? '#E5584A' : 'rgba(242,235,217,0.35)',
                }}>
                  Est: {p.estoque}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function NovaTrocaPage() {
  const router = useRouter()

  // ── Global state ──
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [vendedorNome, setVendedorNome] = useState('')
  const [success, setSuccess] = useState(false)
  const [trocaId, setTrocaId] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // ── Passo 1 — Cliente ──
  const [cliente, setCliente] = useState<Cliente | null>(null)

  // ── Passo 2 — Produto Devolvido ──
  const [vendaOrigId, setVendaOrigId] = useState('')
  const [vendaItems, setVendaItems] = useState<VendaItem[]>([])
  const [vendaLoading, setVendaLoading] = useState(false)
  const [vendaErro, setVendaErro] = useState('')
  const [prodDevQuery, setProdDevQuery] = useState('')
  const [prodDevolvido, setProdDevolvido] = useState<Produto | VendaItem | null>(null)
  const [qtdDev, setQtdDev] = useState(1)
  const [valorDev, setValorDev] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [motivoOutro, setMotivoOutro] = useState('')

  // ── Passo 3 — Produto Novo ──
  const [prodNovQuery, setProdNovQuery] = useState('')
  const [prodNovo, setProdNovo] = useState<Produto | null>(null)
  const [qtdNov, setQtdNov] = useState(1)
  const [valorNov, setValorNov] = useState(0)
  const [pagamentoForma, setPagamentoForma] = useState('')

  // ── Derived ──
  const valorDevolvido = qtdDev * valorDev
  const valorNovo = qtdNov * valorNov
  const diferenca = valorNovo - valorDevolvido
  const motivoFinal = motivo === 'Outro' ? motivoOutro : motivo

  // Auto-fill vendedor on mount
  useEffect(() => {
    fetch('/api/perfil')
      .then(r => r.json())
      .then(d => { if (d?.nome) setVendedorNome(d.nome) })
      .catch(() => {})
  }, [])

  // ── Buscar venda original ──
  async function buscarVenda() {
    if (!vendaOrigId.trim()) return
    setVendaLoading(true)
    setVendaErro('')
    setVendaItems([])
    try {
      const res = await fetch(`/api/vendas/${vendaOrigId.trim()}`)
      if (!res.ok) throw new Error('Venda não encontrada')
      const d = await res.json()
      const items: VendaItem[] = d.itens || d.items || []
      if (items.length === 0) throw new Error('Venda sem itens')
      setVendaItems(items)
    } catch (e: any) {
      setVendaErro(e.message)
    } finally {
      setVendaLoading(false)
    }
  }

  function selecionarItemVenda(item: VendaItem) {
    setProdDevolvido(item)
    setQtdDev(1)
    setValorDev(item.valor)
    setProdDevQuery(item.produto)
  }

  function selecionarProdutoDev(p: Produto) {
    setProdDevolvido(p)
    setValorDev(Number(p.preco_venda) || 0)
    setProdDevQuery(p.descricao)
    setVendaItems([])
  }

  function selecionarProdutoNov(p: Produto) {
    setProdNovo(p)
    setValorNov(Number(p.preco_venda) || 0)
    setProdNovQuery(p.descricao)
  }

  // ── Navigation ──
  function irPasso2() {
    if (!cliente) { setErro('Selecione um cliente.'); return }
    setErro(''); setStep(2)
  }

  function irPasso3() {
    if (!prodDevolvido) { setErro('Selecione o produto devolvido.'); return }
    if (!motivo) { setErro('Selecione o motivo da troca.'); return }
    if (motivo === 'Outro' && !motivoOutro.trim()) { setErro('Descreva o motivo da troca.'); return }
    if (qtdDev < 1) { setErro('Quantidade inválida.'); return }
    setErro(''); setStep(3)
  }

  function irPasso4() {
    if (!prodNovo) { setErro('Selecione o produto novo.'); return }
    if (qtdNov < 1) { setErro('Quantidade inválida.'); return }
    if (diferenca > 0 && !pagamentoForma) { setErro('Selecione a forma de pagamento.'); return }
    setErro(''); setStep(4)
  }

  // ── Submit ──
  async function confirmar() {
    setSalvando(true)
    setErro('')
    try {
      const devProdId = 'cod_produto' in (prodDevolvido as any)
        ? (prodDevolvido as VendaItem).cod_produto
        : (prodDevolvido as Produto).id
      const devProdNome = 'produto' in (prodDevolvido as any)
        ? (prodDevolvido as VendaItem).produto
        : (prodDevolvido as Produto).descricao

      const body = {
        cod_cliente: cliente!.id,
        nome_cliente: cliente!.nome,
        cod_venda_orig: vendaOrigId ? parseInt(vendaOrigId) : null,
        vendedor: vendedorNome,
        observacao: motivoFinal + (pagamentoForma ? ` | Pgto: ${pagamentoForma}` : ''),
        devolvidos: [{
          cod_produto: devProdId,
          produto: devProdNome,
          quantidade: qtdDev,
          valor: valorDev,
        }],
        novos: [{
          cod_produto: prodNovo!.id,
          produto: prodNovo!.descricao,
          quantidade: qtdNov,
          valor: valorNov,
        }],
      }

      const res = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.erro || 'Erro ao registrar troca')
      setTrocaId(d.id || null)
      setSuccess(true)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (success) {
    return (
      <AppLayout>
        <div className="animate-in" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 32, maxWidth: 560, margin: '40px auto', padding: '0 16px',
        }}>
          {/* Checkmark */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: '2px solid #4CAF82',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#4CAF82',
          }}>
            <Check size={36} strokeWidth={2} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#332F3A', marginBottom: 8 }}>
              Troca registrada!
            </div>
            {trocaId && (
              <div style={{ fontSize: 13, color: 'rgba(242,235,217,0.45)' }}>
                Troca #{trocaId}
              </div>
            )}
          </div>

          {/* Summary compact */}
          <div className="card" style={{ padding: 24, width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(242,235,217,0.5)' }}>Cliente</span>
                <span style={{ color: '#332F3A', fontWeight: 600 }}>{cliente?.nome}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(242,235,217,0.5)' }}>Devolvido</span>
                <span style={{ color: '#E5584A' }}>
                  {'produto' in (prodDevolvido as any) ? (prodDevolvido as VendaItem).produto : (prodDevolvido as Produto).descricao} ×{qtdDev} = {BRL(valorDevolvido)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(242,235,217,0.5)' }}>Novo</span>
                <span style={{ color: '#4CAF82' }}>{prodNovo?.descricao} ×{qtdNov} = {BRL(valorNovo)}</span>
              </div>
              <div style={{ height: 1, background: 'rgba(201,168,76,0.1)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(242,235,217,0.5)' }}>Resultado</span>
                <span style={{
                  fontWeight: 700,
                  color: diferenca > 0 ? '#C9A84C' : diferenca < 0 ? '#4D9ECC' : '#4CAF82',
                }}>
                  {diferenca > 0
                    ? `Cliente pagou ${BRL(diferenca)}`
                    : diferenca < 0
                      ? `Crédito ${BRL(Math.abs(diferenca))}`
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Troca direta <Check size={13} strokeWidth={2.5} /></span>}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn btn-ghost"
              onClick={() => window.print()}
              style={{ padding: '10px 22px' }}
            >
              Imprimir comprovante
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSuccess(false); setStep(1)
                setCliente(null); setProdDevolvido(null); setProdNovo(null)
                setVendaOrigId(''); setVendaItems([]); setMotivo(''); setMotivoOutro('')
                setProdDevQuery(''); setProdNovQuery(''); setQtdDev(1); setQtdNov(1)
                setValorDev(0); setValorNov(0); setPagamentoForma('')
              }}
              style={{ padding: '10px 22px' }}
            >
              Nova Troca
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => router.push(`/clientes/${cliente?.id}`)}
              style={{ padding: '10px 22px' }}
            >
              Ver Cliente
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── MAIN FLOW ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>

        {/* Header */}
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
            color: '#332F3A', marginBottom: 16,
          }}>
            Nova Troca
          </h1>
          <StepPills step={step} />
        </div>

        {/* Error */}
        {erro && (
          <div style={{
            background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.3)',
            color: '#E5584A', padding: '12px 16px', borderRadius: 10, fontSize: 13,
          }}>
            {erro}
          </div>
        )}

        {/* ──────────────────────────────────────────────── */}
        {/* PASSO 1 — CLIENTE                               */}
        {/* ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="card animate-in" style={{ padding: 28 }}>
            <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
              Identificar Cliente
            </div>

            {cliente ? (
              <div style={{
                background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
                borderRadius: 12, padding: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#332F3A', marginBottom: 4 }}>
                      {cliente.nome}
                    </div>
                    {cliente.telefone && (
                      <div style={{ fontSize: 13, color: 'rgba(242,235,217,0.5)', marginBottom: 8 }}>
                        {cliente.telefone}
                      </div>
                    )}
                    {(cliente.credito_troca ?? 0) > 0 && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'rgba(77,158,204,0.12)', border: '1px solid rgba(77,158,204,0.25)',
                        color: '#4D9ECC', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600,
                      }}>
                        Crédito disponível: {BRL(cliente.credito_troca ?? 0)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCliente(null)}
                    style={{
                      background: 'none', border: '1px solid rgba(242,235,217,0.12)',
                      color: 'rgba(242,235,217,0.4)', borderRadius: 8, padding: '4px 10px',
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Trocar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 480 }}>
                <FieldLabel>Buscar Cliente</FieldLabel>
                <ClienteSearch onSelect={c => { setCliente(c); setErro('') }} />
                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(242,235,217,0.3)' }}>
                  Digite ao menos 2 caracteres para buscar
                </div>
              </div>
            )}

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={irPasso2}
                disabled={!cliente}
                style={{ padding: '11px 28px', opacity: cliente ? 1 : 0.4, cursor: cliente ? 'pointer' : 'not-allowed' }}
              >
                Próximo <ChevronRight size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────── */}
        {/* PASSO 2 — PRODUTO DEVOLVIDO                     */}
        {/* ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="card animate-in" style={{ padding: 28 }}>
            <div style={{ fontSize: 13, color: '#E5584A', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
              Produto Devolvido
            </div>

            {/* Option A: buscar por número de venda */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(242,235,217,0.07)',
              borderRadius: 12, padding: 18, marginBottom: 18,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(242,235,217,0.5)', marginBottom: 12, fontWeight: 600 }}>
                Opção A — Buscar pela venda original (opcional)
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Número da venda original</FieldLabel>
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="Ex: 1234"
                    value={vendaOrigId}
                    onChange={e => {
                      setVendaOrigId(e.target.value.replace(/\D/g, ''))
                      setVendaItems([])
                      setVendaErro('')
                    }}
                  />
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={buscarVenda}
                  disabled={vendaLoading || !vendaOrigId.trim()}
                  style={{ padding: '10px 18px', fontSize: 13, flexShrink: 0 }}
                >
                  {vendaLoading ? '...' : 'Buscar'}
                </button>
              </div>
              {vendaErro && (
                <div style={{ fontSize: 12, color: '#E5584A', marginTop: 8 }}>{vendaErro}</div>
              )}
              {vendaItems.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(242,235,217,0.4)', marginBottom: 8 }}>
                    Selecione o item que está sendo devolvido:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {vendaItems.map((item, i) => {
                      const sel = prodDevolvido
                        && 'produto' in prodDevolvido
                        && (prodDevolvido as VendaItem).produto === item.produto
                        && (prodDevolvido as VendaItem).valor === item.valor
                      return (
                        <div
                          key={i}
                          onClick={() => selecionarItemVenda(item)}
                          style={{
                            padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                            border: `1px solid ${sel ? '#C9A84C' : 'rgba(242,235,217,0.08)'}`,
                            background: sel ? 'rgba(201,168,76,0.08)' : 'transparent',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: '#332F3A' }}>{item.produto}</span>
                            <span style={{ fontSize: 13, color: '#C9A84C', fontWeight: 600 }}>
                              {BRL(item.valor)} × {item.quantidade}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Option B: buscar no catálogo */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(242,235,217,0.07)',
              borderRadius: 12, padding: 18, marginBottom: 24,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(242,235,217,0.5)', marginBottom: 12, fontWeight: 600 }}>
                Opção B — Buscar produto no catálogo
              </div>
              <FieldLabel>Produto devolvido</FieldLabel>
              <ProdutoSearch
                value={prodDevQuery}
                onChange={v => {
                  setProdDevQuery(v)
                  if (!v) setProdDevolvido(null)
                }}
                onSelect={selecionarProdutoDev}
                placeholder="Buscar produto devolvido..."
              />
              {prodDevolvido && !vendaItems.find(vi => vi.produto === ('produto' in prodDevolvido ? prodDevolvido.produto : prodDevolvido.descricao)) && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', background: 'rgba(201,168,76,0.06)',
                  border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, fontSize: 12, color: '#C9A84C',
                }}>
                  {'descricao' in prodDevolvido ? prodDevolvido.descricao : ''} selecionado
                </div>
              )}
            </div>

            {/* Qty, Valor, Motivo */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 14, marginBottom: 18 }}>
              <div>
                <FieldLabel>Quantidade devolvida</FieldLabel>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={qtdDev}
                  onChange={e => setQtdDev(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <FieldLabel>Valor original (unit.)</FieldLabel>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorDev}
                  onChange={e => setValorDev(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <FieldLabel>Motivo da troca</FieldLabel>
              <select
                className="input"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="">Selecionar motivo...</option>
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {motivo === 'Outro' && (
              <div style={{ marginBottom: 18 }}>
                <FieldLabel>Descreva o motivo</FieldLabel>
                <input
                  className="input"
                  placeholder="Ex: Produto com costura aberta..."
                  value={motivoOutro}
                  onChange={e => setMotivoOutro(e.target.value)}
                />
              </div>
            )}

            {/* Crédito preview */}
            {prodDevolvido && valorDev > 0 && (
              <div style={{
                padding: '12px 16px', background: 'rgba(229,88,74,0.06)',
                border: '1px solid rgba(229,88,74,0.2)', borderRadius: 10, marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, color: 'rgba(242,235,217,0.5)' }}>Valor a creditar: </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#E5584A' }}>{BRL(valorDevolvido)}</span>
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => { setStep(1); setErro('') }} style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={13} strokeWidth={2} /> Voltar
              </button>
              <button className="btn btn-primary" onClick={irPasso3} style={{ padding: '11px 28px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Próximo <ChevronRight size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────── */}
        {/* PASSO 3 — PRODUTO NOVO                          */}
        {/* ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="card animate-in" style={{ padding: 28 }}>
            <div style={{ fontSize: 13, color: '#4CAF82', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
              Produto Novo
            </div>

            <div style={{ marginBottom: 20 }}>
              <FieldLabel>Buscar produto novo</FieldLabel>
              <ProdutoSearch
                value={prodNovQuery}
                onChange={v => {
                  setProdNovQuery(v)
                  if (!v) setProdNovo(null)
                }}
                onSelect={selecionarProdutoNov}
                placeholder="Buscar produto novo..."
              />
            </div>

            {/* Product card */}
            {prodNovo && (
              <div style={{
                background: 'rgba(76,175,130,0.05)', border: '1px solid rgba(76,175,130,0.2)',
                borderRadius: 12, padding: 16, marginBottom: 20,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#332F3A', marginBottom: 6 }}>
                  {prodNovo.descricao}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {prodNovo.grupo && (
                    <span style={{ fontSize: 11, color: 'rgba(242,235,217,0.4)' }}>Grupo: {prodNovo.grupo}</span>
                  )}
                  {prodNovo.tamanho && (
                    <span style={{ fontSize: 11, color: 'rgba(242,235,217,0.4)' }}>Tam: {prodNovo.tamanho}</span>
                  )}
                  {prodNovo.cor && (
                    <span style={{ fontSize: 11, color: 'rgba(242,235,217,0.4)' }}>Cor: {prodNovo.cor}</span>
                  )}
                  <span style={{ fontSize: 11, color: '#C9A84C', fontWeight: 600 }}>
                    {BRL(Number(prodNovo.preco_venda))}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: prodNovo.estoque === 0 ? '#E5584A' : '#4CAF82',
                  }}>
                    {prodNovo.estoque === 0
                      ? <><AlertTriangle size={11} strokeWidth={2} style={{ flexShrink: 0 }} /> Sem estoque</>
                      : `Estoque: ${prodNovo.estoque}`}
                  </span>
                </div>
                {prodNovo.estoque === 0 && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', background: 'rgba(229,88,74,0.07)',
                    border: '1px solid rgba(229,88,74,0.2)', borderRadius: 8, fontSize: 12, color: '#E5584A',
                  }}>
                    Produto sem estoque — a troca pode ser registrada, mas verifique com a loja.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <FieldLabel>Quantidade</FieldLabel>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={qtdNov}
                  onChange={e => setQtdNov(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <FieldLabel>Valor (unit.)</FieldLabel>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorNov}
                  onChange={e => setValorNov(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Diferença panel */}
            {prodDevolvido && prodNovo && (
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(242,235,217,0.08)',
                borderRadius: 12, padding: 18, marginBottom: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'rgba(242,235,217,0.4)' }}>Valor devolvido</span>
                  <span style={{ fontSize: 14, color: '#E5584A', fontWeight: 600 }}>{BRL(valorDevolvido)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: 'rgba(242,235,217,0.4)' }}>Valor do novo</span>
                  <span style={{ fontSize: 14, color: '#4CAF82', fontWeight: 600 }}>{BRL(valorNovo)}</span>
                </div>
                <div style={{ height: 1, background: 'rgba(201,168,76,0.12)', marginBottom: 14 }} />

                {diferenca > 0 && (
                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginBottom: 16,
                    }}>
                      <span style={{ fontSize: 14, color: '#332F3A', fontWeight: 600 }}>Cliente paga</span>
                      <span style={{ fontSize: 22, color: '#C9A84C', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                        {BRL(diferenca)}
                      </span>
                    </div>
                    <div>
                      <FieldLabel>Forma de pagamento</FieldLabel>
                      <select
                        className="input"
                        value={pagamentoForma}
                        onChange={e => setPagamentoForma(e.target.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="">Selecionar...</option>
                        {PAGAMENTOS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {diferenca < 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#4D9ECC', fontWeight: 600 }}>Crédito para a cliente</span>
                    <span style={{ fontSize: 22, color: '#4D9ECC', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                      {BRL(Math.abs(diferenca))}
                    </span>
                  </div>
                )}

                {diferenca === 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, color: '#4CAF82', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Troca direta <Check size={16} strokeWidth={2.5} /></span>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 8, display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => { setStep(2); setErro('') }} style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArrowLeft size={13} strokeWidth={2} /> Voltar
              </button>
              <button className="btn btn-primary" onClick={irPasso4} style={{ padding: '11px 28px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Próximo <ChevronRight size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────── */}
        {/* PASSO 4 — CONFIRMAÇÃO                           */}
        {/* ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="card animate-in" style={{ padding: 28 }}>
            <div style={{ fontSize: 13, color: '#C9A84C', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>
              Confirmar Troca
            </div>

            {/* Summary */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.12)',
              borderRadius: 14, padding: 22, marginBottom: 28,
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>

              {/* Client */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(242,235,217,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Cliente
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#332F3A' }}>{cliente?.nome}</span>
              </div>

              <div style={{ height: 1, background: 'rgba(242,235,217,0.06)' }} />

              {/* Devolvido */}
              <div>
                <div style={{ fontSize: 11, color: '#E5584A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Devolvido
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#332F3A', fontWeight: 500 }}>
                      {'produto' in (prodDevolvido as any)
                        ? (prodDevolvido as VendaItem).produto
                        : (prodDevolvido as Produto).descricao
                      } × {qtdDev}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(242,235,217,0.4)', marginTop: 3 }}>
                      Motivo: {motivoFinal}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#E5584A' }}>{BRL(valorDevolvido)}</span>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(242,235,217,0.06)' }} />

              {/* Novo */}
              <div>
                <div style={{ fontSize: 11, color: '#4CAF82', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Novo
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, color: '#332F3A', fontWeight: 500 }}>
                    {prodNovo?.descricao} × {qtdNov}
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#4CAF82' }}>{BRL(valorNovo)}</span>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(201,168,76,0.15)' }} />

              {/* Diferença */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(242,235,217,0.6)', fontWeight: 600 }}>
                    {diferenca > 0 ? 'Cliente paga' : diferenca < 0 ? 'Crédito para a cliente' : 'Troca direta'}
                  </div>
                  {diferenca > 0 && pagamentoForma && (
                    <div style={{ fontSize: 11, color: 'rgba(242,235,217,0.35)', marginTop: 2 }}>
                      Via {pagamentoForma}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)',
                  color: diferenca > 0 ? '#C9A84C' : diferenca < 0 ? '#4D9ECC' : '#4CAF82',
                }}>
                  {diferenca === 0 ? <Check size={24} strokeWidth={2.5} /> : BRL(Math.abs(diferenca))}
                </span>
              </div>

              {vendaOrigId && (
                <div style={{ fontSize: 11, color: 'rgba(242,235,217,0.3)', textAlign: 'right' }}>
                  Venda original: #{vendaOrigId}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setStep(3); setErro('') }}
                style={{ padding: '11px 24px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                disabled={salvando}
              >
                <ArrowLeft size={13} strokeWidth={2} /> Corrigir
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmar}
                disabled={salvando}
                style={{ padding: '12px 36px', fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {salvando ? 'Registrando...' : <><Check size={13} strokeWidth={2.5} /> Confirmar Troca</>}
              </button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}
