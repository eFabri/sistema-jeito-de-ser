// src/app/clientes/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const CATEGORIAS = ['Todos', 'Crediário', 'Avista', 'Pendente']

const FORMAS_OPCOES = [
  { id: 'Dinheiro',       label: 'Dinheiro' },
  { id: 'PIX',            label: 'PIX' },
  { id: 'Cartão Débito',  label: 'Cartão Débito' },
  { id: 'Cartão Crédito', label: 'Cartão Crédito' },
  { id: 'Crediário',      label: 'Crediário' },
  { id: 'Boleto',         label: 'Boleto' },
  { id: 'Transferência',  label: 'Transferência' },
]

const PERIODOS = [
  { id: '30d',   label: '30 dias' },
  { id: '90d',   label: '90 dias' },
  { id: '180d',  label: '6 meses' },
  { id: 'ano',   label: 'Este ano' },
  { id: 'custom',label: 'Personalizado' },
]

function calcDatas(id: string): { ini: string; fim: string } {
  const hoje = new Date()
  const pad  = (n: number) => String(n).padStart(2, '0')
  const fmt  = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const fim  = fmt(hoje)
  if (id === '30d')  { const d = new Date(hoje); d.setDate(d.getDate() - 30);  return { ini: fmt(d), fim } }
  if (id === '90d')  { const d = new Date(hoje); d.setDate(d.getDate() - 90);  return { ini: fmt(d), fim } }
  if (id === '180d') { const d = new Date(hoje); d.setDate(d.getDate() - 180); return { ini: fmt(d), fim } }
  if (id === 'ano')  { return { ini: `${hoje.getFullYear()}-01-01`, fim } }
  return { ini: '', fim: '' }
}

function Badge({ text, type }: any) {
  const cores: any = {
    'Crediário': { bg: 'rgba(76,175,130,0.1)', c: '#4CAF82', b: 'rgba(76,175,130,0.2)' },
    'Avista':    { bg: 'rgba(77,158,204,0.1)',  c: '#4D9ECC', b: 'rgba(77,158,204,0.2)' },
    'Pendente':  { bg: 'rgba(232,148,58,0.1)',  c: '#E8943A', b: 'rgba(232,148,58,0.2)' },
  }
  const s = cores[text] || { bg: 'rgba(201,168,76,0.1)', c: '#C9A84C', b: 'rgba(201,168,76,0.2)' }
  return (
    <span style={{
      background: s.bg, color: s.c, border: `1px solid ${s.b}`,
      borderRadius: 6, padding: '2px 8px', fontSize: 10,
      fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>{text}</span>
  )
}

export default function ClientesPage() {
  const router = useRouter()

  // Busca simples
  const [q,        setQ]        = useState('')
  const [busca,    setBusca]    = useState('')
  const [categoria,setCategoria]= useState('Todos')
  const [pagina,   setPagina]   = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [clientes, setClientes] = useState<any[]>([])
  const [total,    setTotal]    = useState(0)
  const limite = 25

  // Filtros avançados
  const [avancado,    setAvancado]    = useState(false)
  const [periodo,     setPeriodo]     = useState('30d')
  const [iniCustom,   setIniCustom]   = useState('')
  const [fimCustom,   setFimCustom]   = useState('')
  const [formasSel,   setFormasSel]   = useState<string[]>([])
  const [ticketMin,   setTicketMin]   = useState('')
  const [ticketMax,   setTicketMax]   = useState('')

  const filtrosAtivos = avancado && (formasSel.length > 0 || ticketMin || ticketMax || periodo !== '30d' || iniCustom || fimCustom)

  function toggleForma(id: string) {
    setFormasSel(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
    setPagina(1)
  }

  function limparFiltros() {
    setFormasSel([]); setTicketMin(''); setTicketMax('')
    setPeriodo('30d'); setIniCustom(''); setFimCustom('')
    setPagina(1)
  }

  const buscar = useCallback(async () => {
    setLoading(true)

    if (avancado) {
      // Modo filtro avançado — usa endpoint separado
      const { ini, fim } = periodo === 'custom'
        ? { ini: iniCustom, fim: fimCustom }
        : calcDatas(periodo)

      if (periodo === 'custom' && (!iniCustom || !fimCustom)) { setLoading(false); return }

      const params = new URLSearchParams({
        pagina: String(pagina), limite: String(limite),
        ...(ini && { ini }),
        ...(fim && { fim }),
        ...(formasSel.length > 0 && { formas: formasSel.join(',') }),
        ...(ticketMin && { ticket_min: ticketMin }),
        ...(ticketMax && { ticket_max: ticketMax }),
        ...(busca && { q: busca }),
      })
      const res  = await fetch(`/api/clientes/filtro-compras?${params}`)
      const data = await res.json()
      setClientes(data.clientes || [])
      setTotal(data.total || 0)
    } else {
      // Modo simples
      const params = new URLSearchParams({
        q: busca, pagina: String(pagina), limite: String(limite),
        ...(categoria !== 'Todos' && { categoria }),
      })
      const res  = await fetch(`/api/clientes?${params}`)
      const data = await res.json()
      setClientes(data.clientes || [])
      setTotal(data.total || 0)
    }

    setLoading(false)
  }, [busca, pagina, categoria, avancado, periodo, iniCustom, fimCustom, formasSel, ticketMin, ticketMax])

  useEffect(() => { buscar() }, [buscar])

  // Debounce busca
  useEffect(() => {
    const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350)
    return () => clearTimeout(t)
  }, [q])

  const totalPaginas = Math.ceil(total / limite)

  const { ini: iniAtivo, fim: fimAtivo } = periodo === 'custom'
    ? { ini: iniCustom, fim: fimCustom }
    : calcDatas(periodo)

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
              Clientes
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {avancado
                ? `${total.toLocaleString('pt-BR')} encontrado(s) com os filtros`
                : `${total.toLocaleString('pt-BR')} clientes cadastrados`}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/clientes/novo')}>
            + Novo Cliente
          </button>
        </div>

        {/* BUSCA + TOGGLE FILTROS */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>⊙</span>
            <input
              className="input"
              style={{ paddingLeft: 34 }}
              placeholder="Buscar por nome, WhatsApp ou telefone..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          {/* Filtro de categoria (só no modo simples) */}
          {!avancado && (
            <div style={{ display: 'flex', gap: 5 }}>
              {CATEGORIAS.map(cat => (
                <button key={cat} onClick={() => { setCategoria(cat); setPagina(1) }}
                  style={{
                    padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
                    background: categoria === cat ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)',
                    color: categoria === cat ? '#C9A84C' : 'var(--text-muted)',
                    border: `1px solid ${categoria === cat ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Toggle filtros avançados */}
          <button
            onClick={() => { setAvancado(a => !a); setPagina(1) }}
            style={{
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700,
              background: avancado ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)',
              color: avancado ? '#C9A84C' : 'var(--text-muted)',
              border: `1px solid ${avancado ? 'rgba(201,168,76,0.35)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            ◎ Filtrar por compras {avancado ? '▲' : '▼'}
          </button>
        </div>

        {/* PAINEL DE FILTROS AVANÇADOS */}
        {avancado && (
          <div className="card" style={{ borderColor: 'rgba(201,168,76,0.2)', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Filtros de compra
              </span>
              <button onClick={limparFiltros} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Limpar filtros
              </button>
            </div>

            {/* Período */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Período de compra</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {PERIODOS.map(p => (
                  <button key={p.id} onClick={() => { setPeriodo(p.id); setPagina(1) }} style={{
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${periodo === p.id ? 'rgba(201,168,76,0.35)' : 'var(--border)'}`,
                    background: periodo === p.id ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.02)',
                    color: periodo === p.id ? '#C9A84C' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: 600,
                  }}>{p.label}</button>
                ))}
                {periodo === 'custom' && (
                  <>
                    <input type="date" className="input" style={{ width: 148 }} value={iniCustom} onChange={e => { setIniCustom(e.target.value); setPagina(1) }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>até</span>
                    <input type="date" className="input" style={{ width: 148 }} value={fimCustom} onChange={e => { setFimCustom(e.target.value); setPagina(1) }} />
                  </>
                )}
              </div>
            </div>

            {/* Forma de pagamento */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Forma de pagamento (pode escolher várias)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FORMAS_OPCOES.map(f => {
                  const ativo = formasSel.includes(f.id)
                  return (
                    <button key={f.id} onClick={() => toggleForma(f.id)} style={{
                      padding: '6px 13px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${ativo ? 'rgba(201,168,76,0.4)' : 'var(--border)'}`,
                      background: ativo ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.02)',
                      color: ativo ? '#C9A84C' : 'var(--text-muted)',
                      fontSize: 12, fontWeight: ativo ? 700 : 400,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      {ativo && <span style={{ fontSize: 10 }}>✓</span>}
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ticket */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Ticket por compra (R$)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="number" className="input" style={{ width: 130 }} placeholder="Mínimo"
                  value={ticketMin} onChange={e => { setTicketMin(e.target.value); setPagina(1) }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>até</span>
                <input
                  type="number" className="input" style={{ width: 130 }} placeholder="Máximo"
                  value={ticketMax} onChange={e => { setTicketMax(e.target.value); setPagina(1) }}
                />
              </div>
            </div>

            {/* Resumo ativo */}
            {(iniAtivo || formasSel.length > 0 || ticketMin || ticketMax) && (
              <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {iniAtivo && <span>📅 {fmtData(iniAtivo)} a {fmtData(fimAtivo)} &nbsp;</span>}
                {formasSel.length > 0 && <span>💳 {formasSel.join(', ')} &nbsp;</span>}
                {ticketMin && <span>↑ min R${ticketMin} &nbsp;</span>}
                {ticketMax && <span>↓ max R${ticketMax}</span>}
              </div>
            )}
          </div>
        )}

        {/* TABELA */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Cabeçalho */}
          {avancado ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 110px 110px 110px 44px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              {['Cliente', 'WhatsApp', 'Cidade', 'Compras', 'Total comprado', 'Última compra', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 110px 130px 44px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              {['Cliente', 'Telefone', 'Cidade', 'Categoria', 'Limite', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : clientes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◉</div>
              Nenhum cliente encontrado com esses filtros
            </div>
          ) : clientes.map((c, i) => (
            <div
              key={c.id}
              onClick={() => router.push(`/clientes/${c.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: avancado
                  ? '1fr 150px 150px 110px 110px 110px 44px'
                  : '1fr 140px 140px 110px 130px 44px',
                padding: '13px 20px',
                borderBottom: i < clientes.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Nome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.05))',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, color: '#C9A84C', fontSize: 15,
                }}>
                  {c.nome?.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nome}
                  </div>
                  {avancado && c.formas_usadas && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.formas_usadas}
                    </div>
                  )}
                  {!avancado && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {c.cpf ? `CPF ${c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}` : '—'}
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp / Telefone */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {c.whatsapp || c.celular || '—'}
              </div>

              {/* Cidade */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.cidade || '—'}
              </div>

              {avancado ? (
                <>
                  {/* Qtd compras */}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {c.qtd_compras} compra{c.qtd_compras !== 1 ? 's' : ''}
                  </div>
                  {/* Total comprado */}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>
                    {BRL(c.total_comprado)}
                  </div>
                  {/* Última compra */}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {c.ultima_compra ? fmtData(c.ultima_compra) : '—'}
                  </div>
                </>
              ) : (
                <>
                  <div>{c.categoria ? <Badge text={c.categoria} /> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: c.limite_credito > 0 ? '#C9A84C' : 'var(--text-muted)' }}>
                    {c.limite_credito > 0 ? BRL(c.limite_credito) : '—'}
                  </div>
                </>
              )}

              <div style={{ color: 'var(--text-muted)', fontSize: 16, textAlign: 'right' }}>›</div>
            </div>
          ))}
        </div>

        {/* PAGINAÇÃO */}
        {totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>‹ Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>{pagina} de {totalPaginas}</span>
            <button className="btn btn-ghost" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>Próxima ›</button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
