// src/app/crediario/[id]/page.tsx — Detalhe do crediário de UM cliente
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

export default function CrediarioDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<'pecas' | 'compras' | 'parcelas'>('pecas')

  useEffect(() => {
    fetch(`/api/crediario/${params.id}`)
      .then(r => r.json())
      .then(d => { if (d.erro) setErro(d.erro); else setData(d) })
  }, [params.id])

  if (erro) return <AppLayout><div style={{ color: '#ef6b4d', padding: 24 }}>{erro}</div></AppLayout>
  if (!data) return <AppLayout><div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando...</div></AppLayout>

  const { cliente, totais, vendas, parcelas, pecas_top } = data
  const hoje = new Date().toISOString().split('T')[0]

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1100 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#f5ecd7' }}>
              {cliente.nome}
            </h1>
            <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
              {cliente.celular || cliente.whatsapp || '—'}
              {cliente.cidade ? ` · ${cliente.cidade}` : ''}
              {cliente.categoria ? ` · ${cliente.categoria}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push(`/clientes/${cliente.id}`)}>
              Ver Cliente
            </button>
            <button className="btn btn-primary" onClick={() => router.push(`/vendas/nova?cliente=${cliente.id}`)}>
              + Nova Venda
            </button>
          </div>
        </div>

        {/* MÉTRICAS DO CLIENTE */}
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <Metrica label="Em aberto" valor={BRL(totais.em_aberto || 0)} cor="#d4af5f" destaque />
          <Metrica label="Em atraso" valor={BRL(totais.em_atraso || 0)} cor={totais.em_atraso > 0 ? '#ef6b4d' : 'var(--text-muted)'} />
          <Metrica label="Já pago" valor={BRL(totais.pago || 0)} cor="#64c88c" />
          <Metrica label="Compras totais" valor={String(totais.total_compras)} cor="#5eaadf" />
          <Metrica
            label="Próxima parcela"
            valor={totais.proxima_parcela ? fmtData(totais.proxima_parcela.data_vencimento) : '—'}
            sub={totais.proxima_parcela ? BRL(Number(totais.proxima_parcela.valor)) : undefined}
            cor={totais.proxima_parcela?.data_vencimento < hoje ? '#ef6b4d' : '#f5ecd7'}
          />
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {([['pecas', '👗 Peças Compradas'], ['compras', '◈ Histórico de Compras'], ['parcelas', '◎ Parcelas']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)} style={{
              padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              background: aba === id ? 'rgba(212,175,95,0.18)' : 'transparent',
              color: aba === id ? '#d4af5f' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {/* PEÇAS */}
        {aba === 'pecas' && (
          pecas_top.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Sem compras registradas.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 130px',
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
                background: 'rgba(212,175,95,0.03)',
              }}>
                {['Peça / Produto', 'Quantidade', 'Total Gasto'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {pecas_top.map((p: any, i: number) => (
                <div
                  key={i}
                  onClick={() => p.cod_produto && router.push(`/produtos/${p.cod_produto}`)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 100px 130px',
                    padding: '13px 20px', alignItems: 'center',
                    borderBottom: i < pecas_top.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
                    cursor: p.cod_produto ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (p.cod_produto) e.currentTarget.style.background = 'rgba(212,175,95,0.03)' }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>👗</span>
                    <span style={{ fontSize: 13, color: '#f5ecd7' }}>{p.produto}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#f5ecd7', fontWeight: 600 }}>{p.qtd} un.</div>
                  <div style={{ fontSize: 13, color: '#d4af5f', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{BRL(p.valor)}</div>
                </div>
              ))}
            </div>
          )
        )}

        {/* COMPRAS */}
        {aba === 'compras' && (
          vendas.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Sem compras registradas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vendas.map((v: any) => (
                <div key={v.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#d4af5f', letterSpacing: '0.08em', fontWeight: 700 }}>VENDA #{v.codigo_legado || v.id}</span>
                        {v.situacao && <span className="badge badge-gold" style={{ fontSize: 9 }}>{v.situacao}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        {fmtData(v.data)}{v.vendedor ? ` · vendido por ${v.vendedor}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d4af5f' }}>
                        {BRL(Number(v.valor_total))}
                      </div>
                    </div>
                  </div>
                  {v.itens && v.itens.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(212,175,95,0.05)', paddingTop: 10 }}>
                      {v.itens.map((it: any) => (
                        <div key={it.cod_venda + '-' + it.produto} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px', gap: 12, padding: '4px 0', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{it.produto}</span>
                          <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{it.quantidade}x</span>
                          <span style={{ color: '#f5ecd7', textAlign: 'right', fontWeight: 600 }}>{BRL(Number(it.sub_total))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* PARCELAS */}
        {aba === 'parcelas' && (
          parcelas.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              Sem parcelas registradas.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 130px 130px 130px',
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
                background: 'rgba(212,175,95,0.03)',
              }}>
                {['Parcela', 'Vencimento', 'Valor', 'Pago em', 'Status'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {parcelas.map((p: any, i: number) => {
                const atrasada = !p.pago && p.data_vencimento && p.data_vencimento < hoje
                const status = p.pago ? 'Pago' : atrasada ? 'Atrasada' : 'Aberta'
                const cor = p.pago ? '#64c88c' : atrasada ? '#ef6b4d' : '#f5a623'
                return (
                  <div key={p.id} style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 130px 130px 130px',
                    padding: '12px 20px', alignItems: 'center',
                    borderBottom: i < parcelas.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
                  }}>
                    <div style={{ fontSize: 12, color: '#f5ecd7' }}>{p.parcela || '—'}</div>
                    <div style={{ fontSize: 13, color: '#f5ecd7' }}>{fmtData(p.data_vencimento)}</div>
                    <div style={{ fontSize: 13, color: '#d4af5f', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{BRL(Number(p.valor))}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.pago ? fmtData(p.data_pagamento) : '—'}</div>
                    <div>
                      <span style={{
                        background: `${cor}22`, color: cor, border: `1px solid ${cor}55`,
                        borderRadius: 6, padding: '2px 10px', fontSize: 10,
                        fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                      }}>{status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </AppLayout>
  )
}

function Metrica({ label, valor, sub, cor, destaque }: { label: string; valor: string; sub?: string; cor: string; destaque?: boolean }) {
  return (
    <div className="card">
      <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: destaque ? 24 : 18, fontWeight: 700, color: cor, lineHeight: 1 }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}
