// src/app/produtos/page.tsx
'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'

const GRUPOS = ['Todos', 'Moda Feminina', 'Acessórios', 'Calçados', 'Bolsas', 'Lingerie', 'Outros']

function EstoqueBadge({ estoque, minimo }: { estoque: number; minimo: number }) {
  if (estoque <= 0)           return <span className="badge badge-red">Sem estoque</span>
  if (estoque <= minimo)      return <span className="badge" style={{ background: 'rgba(232,148,58,0.1)', color: '#E8943A', border: '1px solid rgba(232,148,58,0.2)' }}>Estoque baixo</span>
  return <span className="badge badge-green">OK</span>
}

export default function ProdutosPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [produtos, setProdutos]   = useState<any[]>([])
  const [total, setTotal]         = useState(0)
  const [q, setQ]                 = useState('')
  const [busca, setBusca]         = useState('')
  const [grupo, setGrupo]         = useState('Todos')
  const [filtroBaixo, setFiltroBaixo] = useState(searchParams.get('filtro') === 'baixo')
  const [pagina, setPagina]       = useState(1)
  const [loading, setLoading]     = useState(true)
  const [vista, setVista]         = useState<'tabela' | 'grade'>('tabela')
  const limite = 30

  const buscar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      q: busca, pagina: String(pagina), limite: String(limite),
      ...(grupo !== 'Todos' && { grupo }),
    })
    const res  = await fetch(`/api/produtos?${params}`)
    const data = await res.json()
    let prods  = data.produtos || []
    if (filtroBaixo) prods = prods.filter((p: any) => p.estoque <= p.estoque_minimo)
    setProdutos(prods)
    setTotal(filtroBaixo ? prods.length : (data.total || 0))
    setLoading(false)
  }, [busca, pagina, grupo, filtroBaixo])

  useEffect(() => { buscar() }, [buscar])
  useEffect(() => { const t = setTimeout(() => { setBusca(q); setPagina(1) }, 350); return () => clearTimeout(t) }, [q])

  const totalPags = Math.ceil(total / limite)

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#F2EBD9' }}>Produtos</h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>{total.toLocaleString('pt-BR')} produtos</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setVista(v => v === 'tabela' ? 'grade' : 'tabela')} style={{ padding: '9px 12px' }}>
              {vista === 'tabela' ? '⊞' : '▤'}
            </button>
            <button className="btn btn-ghost" onClick={() => router.push('/produtos/importar')}>↑ Importar</button>
            <button className="btn btn-primary" onClick={() => router.push('/produtos/novo')}>+ Novo Produto</button>
          </div>
        </div>

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>⊙</span>
            <input className="input" style={{ paddingLeft: 34 }}
              placeholder="Buscar por nome, cód. barras ou referência..."
              value={q} onChange={e => setQ(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GRUPOS.map(g => (
              <button key={g} onClick={() => { setGrupo(g); setPagina(1) }} style={{
                padding: '7px 12px', borderRadius: 8, border: `1px solid ${grupo === g ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                background: grupo === g ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)',
                color: grupo === g ? '#C9A84C' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{g}</button>
            ))}
          </div>

          <button onClick={() => { setFiltroBaixo(!filtroBaixo); setPagina(1) }} style={{
            padding: '7px 14px', borderRadius: 8, border: `1px solid ${filtroBaixo ? 'rgba(232,148,58,0.3)' : 'var(--border)'}`,
            background: filtroBaixo ? 'rgba(232,148,58,0.12)' : 'rgba(255,255,255,0.03)',
            color: filtroBaixo ? '#E8943A' : 'var(--text-muted)',
            fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>⚠ Estoque baixo</button>
        </div>

        {/* VISTA TABELA */}
        {vista === 'tabela' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 100px 110px 120px 100px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              {['Ref.', 'Produto', 'Grupo', 'Tamanho / Cor', 'Estoque', 'Preço Venda', 'Status'].map(h => (
                <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
            ) : produtos.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 10 }}>◫</div>
                Nenhum produto encontrado
              </div>
            ) : produtos.map((p, i) => (
              <div key={p.id}
                onClick={() => router.push(`/produtos/${p.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 120px 100px 110px 120px 100px',
                  padding: '12px 20px', alignItems: 'center', cursor: 'pointer',
                  borderBottom: i < produtos.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.cod_referencia || p.cod_barras?.substring(0, 8) || `#${p.id}`}</div>
                <div>
                  <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{p.descricao}</div>
                  {p.marca && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.marca}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {p.grupo}{p.sub_grupo ? ` · ${p.sub_grupo}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {[p.tamanho, p.cor].filter(Boolean).join(' / ') || '—'}
                </div>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: p.estoque <= 0 ? '#E5584A' : p.estoque <= p.estoque_minimo ? '#E8943A' : '#4CAF82' }}>
                  {p.estoque}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>un.</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>
                  {BRL(p.preco_venda)}
                </div>
                <EstoqueBadge estoque={p.estoque} minimo={p.estoque_minimo} />
              </div>
            ))}
          </div>
        )}

        {/* VISTA GRADE */}
        {vista === 'grade' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {loading ? (
              <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
            ) : produtos.map(p => (
              <div key={p.id} onClick={() => router.push(`/produtos/${p.id}`)} className="card"
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {/* Foto do produto */}
                {p.fotos?.[0] ? (
                  <img src={p.fotos[0]} alt={p.descricao}
                    style={{ width: '100%', aspectRatio: '1', borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }} />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: '1', borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.02))',
                    border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                    fontFamily: 'var(--font-display)', color: 'rgba(201,168,76,0.3)',
                  }}>
                    <span style={{ fontSize: 24 }}>◫</span>
                    <span style={{ fontSize: 11, letterSpacing: '0.06em' }}>{(p.grupo || 'PRODUTO').charAt(0)}</span>
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#F2EBD9', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {p.descricao}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#C9A84C' }}>{BRL(p.preco_venda)}</span>
                  <span style={{ fontSize: 11, color: p.estoque <= p.estoque_minimo ? '#E8943A' : '#4CAF82' }}>Est: {p.estoque}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINAÇÃO */}
        {totalPags > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>‹ Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pagina} de {totalPags}</span>
            <button className="btn btn-ghost" disabled={pagina === totalPags} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>Próxima ›</button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}