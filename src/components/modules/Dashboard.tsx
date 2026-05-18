// src/components/modules/Dashboard.tsx
'use client'
import { useRouter } from 'next/navigation'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'

type Resumo = {
  vendas_hoje: { total: number; quantidade: number }
  a_receber_total: { total: number; quantidade: number }
  vencendo_hoje: { total: number; quantidade: number }
  vencendo_5_dias: { total: number; quantidade: number }
  inadimplentes: { total: number; quantidade: number }
  a_pagar_hoje: { total: number; quantidade: number }
  estoque_baixo: number
  aniversariantes_hoje: number
}

// ─── STAT CARD ───────────────────────────────────────────────
function StatCard({ label, value, sub, alert, info, icon, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${alert ? 'rgba(239,107,77,0.3)' : info ? 'rgba(94,170,223,0.25)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)', padding: '20px 22px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: alert
          ? 'radial-gradient(circle at 100% 0%, rgba(239,107,77,0.1) 0%, transparent 70%)'
          : info
          ? 'radial-gradient(circle at 100% 0%, rgba(94,170,223,0.08) 0%, transparent 70%)'
          : 'radial-gradient(circle at 100% 0%, rgba(212,175,95,0.08) 0%, transparent 70%)',
        borderRadius: '0 16px 0 0',
      }} />
      <div style={{ fontSize: 10, color: alert ? '#ef6b4d' : info ? '#5eaadf' : '#d4af5f', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
        {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#f5ecd7', lineHeight: 1, letterSpacing: '-0.01em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ─── BADGE ───────────────────────────────────────────────────
function Badge({ text, type }: any) {
  const t: any = {
    verde:   { bg: 'rgba(100,200,140,0.1)',  c: '#64c88c', b: 'rgba(100,200,140,0.2)' },
    ouro:    { bg: 'rgba(212,175,95,0.1)',   c: '#d4af5f', b: 'rgba(212,175,95,0.2)' },
    vermelho:{ bg: 'rgba(239,107,77,0.1)',   c: '#ef6b4d', b: 'rgba(239,107,77,0.25)' },
    azul:    { bg: 'rgba(94,170,223,0.1)',   c: '#5eaadf', b: 'rgba(94,170,223,0.2)' },
  }
  const s = t[type] || t.ouro
  return (
    <span style={{
      background: s.bg, color: s.c, border: `1px solid ${s.b}`,
      borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>{text}</span>
  )
}

// ─── SECTION HEADER ──────────────────────────────────────────
function SectionHeader({ title, action, onAction }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: '#f5ecd7' }}>{title}</h3>
      {action && <button onClick={onAction} style={{ fontSize: 11, color: '#d4af5f', background: 'none', border: 'none', cursor: 'pointer' }}>{action} →</button>}
    </div>
  )
}

// ─── DASHBOARD ───────────────────────────────────────────────
export default function Dashboard({ resumo, vendasRecentes, vencimentos, aniversariantes, produtosBaixos }: {
  resumo: Resumo | null
  vendasRecentes: any[]
  vencimentos: any[]
  aniversariantes: any[]
  produtosBaixos: any[]
}) {
  const router = useRouter()
  const r = resumo || {} as any

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#f5ecd7', letterSpacing: '-0.01em', lineHeight: 1 }}>
            Visão Geral
          </h1>
          <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 5, textTransform: 'capitalize' }}>{hoje}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => router.push('/vendas/nova')}>
            + Nova Venda
          </button>
          <button className="btn btn-ghost" onClick={() => router.push('/relatorios')}>
            Relatórios
          </button>
        </div>
      </div>

      {/* ALERTAS */}
      {((r.aniversariantes_hoje > 0) || (r.vencendo_hoje?.quantidade > 0)) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {r.aniversariantes_hoje > 0 && (
            <div style={{
              background: 'rgba(212,175,95,0.06)', border: '1px solid rgba(212,175,95,0.2)',
              borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span>🎂</span>
              <span style={{ fontSize: 13, color: '#f5ecd7' }}>
                <strong>{r.aniversariantes_hoje}</strong> aniversariante{r.aniversariantes_hoje > 1 ? 's' : ''} hoje
              </span>
              <button onClick={() => router.push('/whatsapp')} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                Enviar mensagem
              </button>
            </div>
          )}
          {r.vencendo_hoje?.quantidade > 0 && (
            <div style={{
              background: 'rgba(239,107,77,0.06)', border: '1px solid rgba(239,107,77,0.2)',
              borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span>⚠️</span>
              <span style={{ fontSize: 13, color: '#f5ecd7' }}>
                <strong>{r.vencendo_hoje.quantidade}</strong> parcela{r.vencendo_hoje.quantidade > 1 ? 's' : ''} vencendo hoje · {BRL(r.vencendo_hoje.total)}
              </span>
              <button onClick={() => router.push('/financeiro')} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                Ver cobranças
              </button>
            </div>
          )}
        </div>
      )}

      {/* CARDS DE INDICADORES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <StatCard
          label="Vendas Hoje" icon="◈"
          value={BRL(r.vendas_hoje?.total || 0)}
          sub={`${r.vendas_hoje?.quantidade || 0} vendas`}
          onClick={() => router.push('/vendas')}
        />
        <StatCard
          label="A Receber" icon="◎"
          value={BRL(r.a_receber_total?.total || 0)}
          sub={`${r.a_receber_total?.quantidade || 0} parcelas em aberto`}
          onClick={() => router.push('/financeiro')}
        />
        <StatCard
          label="Vence em 5 dias" icon="◑"
          value={BRL(r.vencendo_5_dias?.total || 0)}
          sub={`${r.vencendo_5_dias?.quantidade || 0} parcelas`}
          alert={r.vencendo_5_dias?.quantidade > 0}
          onClick={() => router.push('/financeiro')}
        />
        <StatCard
          label="Inadimplentes" icon="⚠"
          value={BRL(r.inadimplentes?.total || 0)}
          sub={`${r.inadimplentes?.quantidade || 0} parcelas em atraso`}
          alert={r.inadimplentes?.quantidade > 0}
          onClick={() => router.push('/financeiro?filtro=vencido')}
        />
        <StatCard
          label="A Pagar Hoje" icon="◐"
          value={BRL(r.a_pagar_hoje?.total || 0)}
          sub={`${r.a_pagar_hoje?.quantidade || 0} contas`}
          info
          onClick={() => router.push('/financeiro?aba=pagar')}
        />
        <StatCard
          label="Estoque Baixo" icon="◫"
          value={r.estoque_baixo || 0}
          sub="produtos abaixo do mínimo"
          alert={r.estoque_baixo > 0}
          onClick={() => router.push('/produtos?filtro=baixo')}
        />
      </div>

      {/* GRID INFERIOR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ÚLTIMAS VENDAS */}
        <div className="card">
          <SectionHeader title="Últimas Vendas" action="Ver todas" onAction={() => router.push('/vendas')} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {vendasRecentes.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma venda registrada</p>
            )}
            {vendasRecentes.map((v, i) => (
              <div key={v.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr auto',
                alignItems: 'center', gap: 12, padding: '11px 0',
                borderBottom: i < vendasRecentes.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
              }} onClick={() => router.push(`/vendas/${v.id}`)}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(212,175,95,0.18), rgba(212,175,95,0.05))',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d4af5f', fontSize: 14,
                }}>
                  {v.nome_cliente?.charAt(0) || '?'}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#f5ecd7', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {v.nome_cliente?.split(' ').slice(0, 2).join(' ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    #{v.codigo_legado || v.id} · {v.vendedor || '—'} · {v.forma_pagamento || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#d4af5f' }}>
                    {BRL(v.valor_total)}
                  </div>
                  <Badge
                    text={v.situacao === 'Venda Direta' ? 'Direto' : v.situacao === 'Cancelada' ? 'Cancelada' : 'Crediário'}
                    type={v.situacao === 'Cancelada' ? 'vermelho' : v.situacao === 'Venda Direta' ? 'ouro' : 'verde'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VENCIMENTOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1 }}>
            <SectionHeader title="Próximos Vencimentos" action="Ver todos" onAction={() => router.push('/financeiro')} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {vencimentos.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sem vencimentos próximos</p>
              )}
              {vencimentos.slice(0, 6).map((v: any, i: number) => {
                const atrasado = v.dias_para_vencer < 0
                const hoje = v.dias_para_vencer === 0
                return (
                  <div key={v.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    alignItems: 'center', gap: 10, padding: '10px 0',
                    borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: atrasado ? '#ef6b4d' : '#f5ecd7', fontWeight: 500 }}>
                        {v.nome_cliente?.split(' ').slice(0, 2).join(' ')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Parcela {v.parcela || '—'}</div>
                    </div>
                    <Badge
                      text={atrasado ? `${Math.abs(v.dias_para_vencer)}d atraso` : hoje ? 'Hoje' : `${v.dias_para_vencer}d`}
                      type={atrasado ? 'vermelho' : hoje ? 'vermelho' : 'ouro'}
                    />
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: atrasado ? '#ef6b4d' : '#f5ecd7' }}>
                      {BRL(v.valor)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ANIVERSARIANTES */}
          {aniversariantes.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(212,175,95,0.2)' }}>
              <SectionHeader title="🎂 Aniversários Hoje" action="WhatsApp" onAction={() => router.push('/whatsapp')} />
              {aniversariantes.slice(0, 3).map((a: any, i: number) => (
                <div key={a.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: i < aniversariantes.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontSize: 13, color: '#f5ecd7' }}>{a.nome?.split(' ').slice(0, 2).join(' ')}</div>
                  <div style={{ fontSize: 11, color: '#d4af5f' }}>{a.whatsapp || a.celular}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
