// src/app/clientes/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'

const CATEGORIAS = ['Todos', 'Crediário', 'Avista', 'Pendente']

function Badge({ text, type }: any) {
  const cores: any = {
    'Crediário': { bg: 'rgba(100,200,140,0.1)', c: '#64c88c', b: 'rgba(100,200,140,0.2)' },
    'Avista':    { bg: 'rgba(94,170,223,0.1)',  c: '#5eaadf', b: 'rgba(94,170,223,0.2)' },
    'Pendente':  { bg: 'rgba(245,166,35,0.1)',  c: '#f5a623', b: 'rgba(245,166,35,0.2)' },
  }
  const s = cores[text] || { bg: 'rgba(212,175,95,0.1)', c: '#d4af5f', b: 'rgba(212,175,95,0.2)' }
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
  const [clientes, setClientes] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const limite = 25

  const buscar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      q: busca, pagina: String(pagina), limite: String(limite),
      ...(categoria !== 'Todos' && { categoria }),
    })
    const res = await fetch(`/api/clientes?${params}`)
    const data = await res.json()
    setClientes(data.clientes || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [busca, pagina, categoria])

  useEffect(() => { buscar() }, [buscar])

  // debounce busca
  useEffect(() => {
    const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350)
    return () => clearTimeout(t)
  }, [q])

  const totalPaginas = Math.ceil(total / limite)

  function calcIdade(dataNasc: string) {
    if (!dataNasc) return null
    const nasc = new Date(dataNasc)
    const idade = Math.floor((Date.now() - nasc.getTime()) / (365.25 * 24 * 3600 * 1000))
    return isNaN(idade) ? null : idade
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#f5ecd7', letterSpacing: '-0.01em' }}>
              Clientes
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {total.toLocaleString('pt-BR')} clientes cadastrados
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/clientes/novo')}>
            + Novo Cliente
          </button>
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Busca */}
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>⊙</span>
            <input
              className="input"
              style={{ paddingLeft: 34 }}
              placeholder="Buscar por nome, CPF ou telefone..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          {/* Filtro categoria */}
          <div style={{ display: 'flex', gap: 6 }}>
            {CATEGORIAS.map(cat => (
              <button key={cat} onClick={() => { setCategoria(cat); setPagina(1) }}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
                  background: categoria === cat ? 'rgba(212,175,95,0.18)' : 'rgba(255,255,255,0.03)',
                  color: categoria === cat ? '#d4af5f' : 'var(--text-muted)',
                  border: `1px solid ${categoria === cat ? 'rgba(212,175,95,0.3)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* TABELA */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Cabeçalho da tabela */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 140px 110px 130px 44px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(212,175,95,0.03)',
          }}>
            {['Cliente', 'Telefone', 'Cidade', 'Categoria', 'Limite', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Linhas */}
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Carregando...
            </div>
          ) : clientes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◉</div>
              Nenhum cliente encontrado
            </div>
          ) : clientes.map((c, i) => (
            <div
              key={c.id}
              onClick={() => router.push(`/clientes/${c.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 140px 110px 130px 44px',
                padding: '13px 20px',
                borderBottom: i < clientes.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.1s',
                alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,95,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Nome + info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(212,175,95,0.18), rgba(212,175,95,0.05))',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d4af5f', fontSize: 15,
                }}>
                  {c.nome?.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#f5ecd7', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nome}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {c.cpf ? `CPF ${c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}` : '—'}
                    {c.data_nascimento && calcIdade(c.data_nascimento) ? ` · ${calcIdade(c.data_nascimento)} anos` : ''}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {c.celular || c.whatsapp || '—'}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.cidade || '—'}
              </div>

              <div>
                {c.categoria ? <Badge text={c.categoria} /> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
              </div>

              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: c.limite_credito > 0 ? '#d4af5f' : 'var(--text-muted)' }}>
                {c.limite_credito > 0 ? BRL(c.limite_credito) : '—'}
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: 16, textAlign: 'right' }}>›</div>
            </div>
          ))}
        </div>

        {/* PAGINAÇÃO */}
        {totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}
              style={{ padding: '7px 14px' }}>
              ‹ Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>
              {pagina} de {totalPaginas}
            </span>
            <button className="btn btn-ghost" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}
              style={{ padding: '7px 14px' }}>
              Próxima ›
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
