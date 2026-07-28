'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}
const fmtHora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

type Estado = {
  caixa: any | null
  abertos_anteriores: any[]
  valor_abertura: number
  vendas_dinheiro: number
  recebimentos_dinheiro: number
  suprimentos: number
  sangrias: number
  saidas_dinheiro: number
  valor_esperado: number
  movimentos: any[]
}

export default function CaixaPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Abertura
  const [valorAbertura, setValorAbertura] = useState('')

  // Fechamento
  const [valorContado, setValorContado] = useState('')

  // Movimento
  const [modalMov, setModalMov] = useState<'sangria' | 'suprimento' | null>(null)
  const [movValor, setMovValor] = useState('')
  const [movMotivo, setMovMotivo] = useState('')

  // Reabertura
  const [modalReabrir, setModalReabrir] = useState(false)
  const [motivoReabrir, setMotivoReabrir] = useState('')

  const buscar = useCallback(async () => {
    const [est, per] = await Promise.all([
      fetch('/api/caixa').then(r => r.json()),
      fetch('/api/perfil').then(r => r.ok ? r.json() : null),
    ])
    setEstado(est)
    setPerfil(per)
    setLoading(false)
  }, [])

  useEffect(() => { buscar() }, [buscar])

  const isAdmin = perfil?.perfil === 'admin'
  const nomePerfil = perfil?.apelido || perfil?.nome?.split(' ')[0] || ''

  async function abrirCaixa() {
    setErro('')
    setSalvando(true)
    const r = await fetch('/api/caixa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor_abertura: Number(valorAbertura) || 0, aberto_por: nomePerfil }),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.mensagem || d.erro || 'Erro ao abrir caixa.'); return }
    setValorAbertura('')
    buscar()
  }

  async function fecharCaixa() {
    setErro('')
    if (!valorContado.trim()) { setErro('Informe o valor contado.'); return }
    setSalvando(true)
    const r = await fetch('/api/caixa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'fechar', valor_contado: Number(valorContado.replace(',', '.')), fechado_por: nomePerfil }),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.erro || 'Erro ao fechar caixa.'); return }
    setValorContado('')
    buscar()
  }

  async function reabrirCaixa() {
    setErro('')
    if (!motivoReabrir.trim()) { setErro('Informe o motivo da reabertura.'); return }
    setSalvando(true)
    const r = await fetch('/api/caixa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'reabrir', motivo_reabertura: motivoReabrir, aberto_por: nomePerfil, perfil: perfil?.perfil }),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.erro || 'Erro ao reabrir caixa.'); return }
    setModalReabrir(false)
    setMotivoReabrir('')
    buscar()
  }

  async function lancarMovimento() {
    setErro('')
    const v = Number(movValor.replace(',', '.'))
    if (!v || v <= 0) { setErro('Valor deve ser maior que zero.'); return }
    setSalvando(true)
    const r = await fetch('/api/caixa/movimentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: modalMov, valor: v, motivo: movMotivo, criado_por: nomePerfil }),
    })
    const d = await r.json()
    setSalvando(false)
    if (!r.ok) { setErro(d.erro || 'Erro ao registrar movimento.'); return }
    setModalMov(null); setMovValor(''); setMovMotivo('')
    buscar()
  }

  if (loading) return (
    <AppLayout>
      <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Carregando caixa...</div>
    </AppLayout>
  )

  const { caixa, abertos_anteriores = [], valor_esperado = 0, vendas_dinheiro = 0,
          recebimentos_dinheiro = 0, suprimentos = 0, sangrias = 0, saidas_dinheiro = 0, movimentos = [] } = estado ?? {}

  const diferenca = valorContado ? (Number(valorContado.replace(',', '.')) - valor_esperado) : null

  const corDiferenca = diferenca === null ? 'var(--text-muted)'
    : diferenca > 0 ? '#4CAF82' : diferenca < 0 ? 'var(--danger)' : '#4CAF82'

  return (
    <AppLayout>
      {/* Modal sangria / suprimento */}
      {modalMov && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,18,36,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModalMov(null) }}>
          <div className="card" style={{ width: 380, padding: 28, margin: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18, textTransform: 'capitalize' }}>
              {modalMov === 'sangria' ? '− Sangria' : '+ Suprimento'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Valor (R$)</label>
                <input className="input" type="number" step="0.01" min="0.01" value={movValor}
                  onChange={e => setMovValor(e.target.value)} placeholder="0,00" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Motivo</label>
                <input className="input" value={movMotivo} onChange={e => setMovMotivo(e.target.value)}
                  placeholder={modalMov === 'sangria' ? 'Ex: Pagamento fornecedor, Depósito...' : 'Ex: Troco inicial, Reforço...'}
                  onKeyDown={e => { if (e.key === 'Enter') lancarMovimento() }} />
              </div>
              {erro && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{erro}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => { setModalMov(null); setErro('') }} style={{ flex: 1 }}>Cancelar</button>
                <button className="btn btn-primary" onClick={lancarMovimento} disabled={salvando} style={{ flex: 1 }}>
                  {salvando ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal reabertura */}
      {modalReabrir && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,18,36,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setModalReabrir(false); setErro('') } }}>
          <div className="card" style={{ width: 400, padding: 28, margin: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>Reabrir Caixa</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Esta ação desfaz o fechamento. O motivo será registrado no histórico.</p>
            <div>
              <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Motivo obrigatório</label>
              <input className="input" value={motivoReabrir} onChange={e => setMotivoReabrir(e.target.value)}
                placeholder="Ex: Erro no valor contado..."
                onKeyDown={e => { if (e.key === 'Enter') reabrirCaixa() }} autoFocus />
            </div>
            {erro && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{erro}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => { setModalReabrir(false); setErro('') }} style={{ flex: 1 }}>Cancelar</button>
              <button onClick={reabrirCaixa} disabled={salvando}
                style={{ flex: 1, padding: '10px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {salvando ? 'Reabrindo...' : 'Reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Caixa
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => router.push('/financeiro')} style={{ fontSize: 12 }}>
            ← Financeiro
          </button>
        </div>

        {/* Aviso caixa anterior esquecido */}
        {abertos_anteriores.length > 0 && (
          <div style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.4)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)' }}>Caixa anterior não fechado</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Caixa de {abertos_anteriores.map(a => fmtData(a.data)).join(', ')} está aberto sem fechamento registrado.
              </div>
            </div>
          </div>
        )}

        {erro && !modalMov && !modalReabrir && (
          <div style={{ background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.3)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--danger)' }}>
            {erro}
          </div>
        )}

        {/* ─── SEM CAIXA ABERTO ─── */}
        {!caixa && (
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Abrir Caixa</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Informe o valor em dinheiro que está no caixa agora.</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Valor de abertura (R$)</label>
                <input className="input" type="number" step="0.01" min="0" value={valorAbertura}
                  onChange={e => setValorAbertura(e.target.value)}
                  placeholder="0,00"
                  onKeyDown={e => { if (e.key === 'Enter') abrirCaixa() }} />
              </div>
              <button className="btn btn-primary" onClick={abrirCaixa} disabled={salvando} style={{ padding: '10px 24px' }}>
                {salvando ? 'Abrindo...' : 'Confirmar abertura'}
              </button>
            </div>
          </div>
        )}

        {/* ─── CAIXA ABERTO ─── */}
        {caixa && caixa.status === 'aberto' && (
          <>
            {/* Resumo atual */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                    Caixa aberto
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    por {caixa.aberto_por || '—'} às {fmtHora(caixa.aberto_em)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setModalMov('suprimento'); setErro('') }}>
                    + Suprimento
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setModalMov('sangria'); setErro('') }}>
                    − Sangria
                  </button>
                </div>
              </div>

              {/* Composição */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[
                  { label: 'Abertura do dia',              valor: caixa.valor_abertura,    cor: 'var(--text-secondary)' },
                  { label: '+ Vendas em Dinheiro',         valor: vendas_dinheiro,          cor: '#4CAF82' },
                  { label: '+ Recebimentos (Crediário)',   valor: recebimentos_dinheiro,    cor: '#4CAF82' },
                  { label: '+ Suprimentos',                valor: suprimentos,              cor: '#4CAF82' },
                  { label: '− Sangrias',                   valor: -sangrias,                cor: 'var(--danger)' },
                  { label: '− Saídas (Contas pagas)',      valor: -saidas_dinheiro,         cor: 'var(--danger)' },
                ].map(({ label, valor, cor }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: cor, fontWeight: 600 }}>
                      {BRL(valor)}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-primary)' }}>= Esperado em caixa</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>{BRL(valor_esperado)}</span>
                </div>
              </div>
            </div>

            {/* Movimentos do dia */}
            {movimentos.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Movimentos do dia
                </div>
                {movimentos.map((m: any, i: number) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: i < movimentos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{m.tipo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.motivo || '—'} · {m.criado_por || ''} {m.criado_em ? fmtHora(m.criado_em) : ''}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: m.tipo === 'suprimento' ? '#4CAF82' : 'var(--danger)' }}>
                      {m.tipo === 'suprimento' ? '+' : '−'} {BRL(Number(m.valor))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Fechamento */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Fechar Caixa</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    Valor contado (dinheiro físico no caixa)
                  </label>
                  <input className="input" type="number" step="0.01" min="0" value={valorContado}
                    onChange={e => setValorContado(e.target.value)} placeholder="0,00" />
                </div>

                {/* Diferença em tempo real */}
                {valorContado && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {diferenca! > 0 ? 'Sobra' : diferenca! < 0 ? 'Falta' : 'Caixa exato'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: corDiferenca }}>
                      {diferenca! !== 0 ? BRL(Math.abs(diferenca!)) : '✓'}
                    </span>
                  </div>
                )}

                <button className="btn btn-primary" onClick={fecharCaixa} disabled={salvando} style={{ padding: '12px', justifyContent: 'center' }}>
                  {salvando ? 'Fechando...' : 'Confirmar fechamento'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ─── CAIXA FECHADO ─── */}
        {caixa && caixa.status === 'fechado' && (() => {
          const det = caixa.detalhamento || {}
          const dif = Number(det.diferenca ?? 0)
          const corDif = dif > 0 ? '#4CAF82' : dif < 0 ? 'var(--danger)' : '#4CAF82'
          return (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#4CAF82', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                    ✓ Caixa fechado
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    por {caixa.fechado_por || '—'} às {caixa.fechado_em ? fmtHora(caixa.fechado_em) : '—'}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => { setModalReabrir(true); setErro('') }}
                    style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.3)', borderRadius: 8, color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>
                    Reabrir
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Abertura do dia',              valor: det.valor_abertura },
                  { label: '+ Vendas em Dinheiro',         valor: det.vendas_dinheiro },
                  { label: '+ Recebimentos (Crediário)',   valor: det.recebimentos_dinheiro },
                  { label: '+ Suprimentos',                valor: det.suprimentos },
                  { label: '− Sangrias',                   valor: det.sangrias, negativo: true },
                  { label: '− Saídas (Contas pagas)',      valor: det.saidas_dinheiro, negativo: true },
                ].map(({ label, valor, negativo }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: negativo ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {BRL(negativo ? -Number(valor ?? 0) : Number(valor ?? 0))}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-primary)' }}>Esperado</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>{BRL(Number(det.valor_esperado ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-primary)' }}>Contado</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{BRL(Number(det.valor_contado ?? 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-primary)' }}>Diferença</span>
                  <span style={{ fontFamily: 'var(--font-display)', color: corDif }}>
                    {dif === 0 ? '✓ Exato' : `${dif > 0 ? 'Sobra ' : 'Falta '} ${BRL(Math.abs(dif))}`}
                  </span>
                </div>
              </div>

              {/* Histórico de reabertura */}
              {Array.isArray(caixa.historico_reabertura) && caixa.historico_reabertura.length > 0 && (
                <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Reabertas anteriores</div>
                  {caixa.historico_reabertura.map((r: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {fmtHora(r.reaberto_em)} · {r.reaberto_por} — {r.motivo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </AppLayout>
  )
}
