// src/app/trocas/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { ChevronRight } from 'lucide-react'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const formatarData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

export default function TrocasPage() {
  const router = useRouter()
  const [trocas, setTrocas] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const limite = 25

  useEffect(() => {
    setLoading(true)
    fetch(`/api/trocas?pagina=${pagina}&limite=${limite}`)
      .then(r => r.json())
      .then(d => { setTrocas(d.trocas || []); setTotal(d.total || 0); setLoading(false) })
  }, [pagina])

  const totalPaginas = Math.ceil(total / limite)

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
              Trocas
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {total.toLocaleString('pt-BR')} trocas registradas
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/trocas/nova')}>
            + Nova Troca
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 130px 130px 130px 130px 44px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(201,168,76,0.03)',
          }}>
            {['Data', 'Cliente', 'Venda Orig.', 'Devolvido', 'Novo', 'Diferença', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : trocas.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>⇄</div>
              Nenhuma troca registrada
            </div>
          ) : trocas.map((t, i) => {
            const diff = Number(t.diferenca || 0)
            return (
              <div
                key={t.id}
                onClick={() => router.push(`/trocas/${t.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 130px 130px 130px 130px 44px',
                  padding: '13px 20px',
                  borderBottom: i < trocas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                  cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 12, color: '#332F3A' }}>{formatarData(t.data)}</div>
                <div style={{ fontSize: 13, color: '#332F3A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.nome_cliente || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.cod_venda_orig ? `#${t.cod_venda_orig}` : '—'}</div>
                <div style={{ fontSize: 12, color: '#E5584A' }}>{BRL(Number(t.valor_original || 0))}</div>
                <div style={{ fontSize: 12, color: '#4CAF82' }}>{BRL(Number(t.valor_troca || 0))}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: diff > 0 ? '#C9A84C' : diff < 0 ? '#4D9ECC' : 'var(--text-muted)' }}>
                  {diff > 0 ? '+' : ''}{BRL(diff)}
                </div>
                <div style={{ color: 'var(--text-muted)', textAlign: 'right' }}><ChevronRight size={16} strokeWidth={1.5} /></div>
              </div>
            )
          })}
        </div>

        {totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button className="btn btn-ghost" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} style={{ padding: '7px 14px' }}>
              ‹ Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 8px' }}>{pagina} de {totalPaginas}</span>
            <button className="btn btn-ghost" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)} style={{ padding: '7px 14px' }}>
              Próxima <ChevronRight size={13} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
