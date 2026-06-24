// src/app/whatsapp/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'
const fmtDT = (d: string) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const VARS_INFO: Record<string, string[]> = {
  aniversario:        ['{nome}', '{nome_completo}'],
  cobranca_5d:        ['{nome}', '{parcela}', '{valor}', '{data_vencimento}', '{dias}'],
  cobranca_vencimento:['{nome}', '{parcela}', '{valor}', '{data_vencimento}'],
  cobranca_atraso:    ['{nome}', '{parcela}', '{valor}', '{data_vencimento}'],
}

const TIPO_LABELS: Record<string, string> = {
  aniversario:         '🎂 Aniversário',
  cobranca_5d:         '💰 Cobrança — 5 dias antes',
  cobranca_vencimento: '⏰ Cobrança — No vencimento',
  cobranca_atraso:     '🚨 Cobrança — Em atraso',
  manual:              '💬 Manual',
}

// ─── EDITOR DE TEMPLATE ───────────────────────────────────
function EditorTemplate({ modelo, onSalvo }: any) {
  const [msg, setMsg]     = useState(modelo.mensagem)
  const [ativo, setAtivo] = useState(modelo.ativo)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const vars = VARS_INFO[modelo.tipo] || []

  async function salvar() {
    setSalvando(true)
    await fetch('/api/whatsapp', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: modelo.id, mensagem: msg, ativo }),
    })
    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
    onSalvo({ ...modelo, mensagem: msg, ativo })
  }

  function inserirVar(v: string) {
    setMsg((m: string) => m + v)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, color: '#F2EBD9', fontWeight: 600 }}>{TIPO_LABELS[modelo.tipo] || modelo.nome}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{modelo.nome}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
            <div onClick={() => setAtivo(!ativo)} style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
              background: ativo ? 'rgba(76,175,130,0.3)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${ativo ? 'rgba(76,175,130,0.4)' : 'var(--border)'}`,
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: ativo ? '#4CAF82' : 'rgba(255,255,255,0.3)',
                position: 'absolute', top: 2,
                left: ativo ? 18 : 2,
                transition: 'all 0.2s',
              }} />
            </div>
            {ativo ? 'Ativo' : 'Inativo'}
          </label>
        </div>
      </div>

      {/* Variáveis disponíveis */}
      {vars.length > 0 && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>Inserir:</span>
          {vars.map(v => (
            <button key={v} onClick={() => inserirVar(v)} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 6,
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)',
              color: '#C9A84C', cursor: 'pointer', fontFamily: 'monospace',
            }}>{v}</button>
          ))}
        </div>
      )}

      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        rows={5}
        className="input"
        style={{ resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6 }}
      />

      {/* Preview */}
      <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(201,168,76,0.04)', borderRadius: 8, borderLeft: '3px solid rgba(201,168,76,0.25)' }}>
        <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Preview</div>
        <div style={{ fontSize: 12, color: 'rgba(242,235,217,0.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {msg.replace(/\{nome\}/g, 'Maria').replace(/\{parcela\}/g, '2/4').replace(/\{valor\}/g, 'R$ 154,00').replace(/\{data_vencimento\}/g, '25/01/2026').replace(/\{dias\}/g, '5').replace(/\{nome_completo\}/g, 'Maria da Silva')}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ padding: '8px 20px' }}>
          {salvo ? '✓ Salvo!' : salvando ? 'Salvando...' : 'Salvar Modelo'}
        </button>
      </div>
    </div>
  )
}

// ─── PAINEL DE STATUS ─────────────────────────────────────
function StatusConexao({ status, onConectar }: any) {
  const conectado = status?.state === 'open' || status?.state === 'connected'
  const cor = conectado ? '#4CAF82' : status?.state === 'sem_conexao' ? '#E5584A' : '#E8943A'
  const label = conectado ? 'Conectado' : status?.state === 'sem_conexao' ? 'Evolution API não encontrada' : 'Desconectado'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: `1px solid ${cor}30` }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor, boxShadow: `0 0 8px ${cor}60`, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: '#F2EBD9', fontWeight: 600 }}>WhatsApp Business</div>
        <div style={{ fontSize: 12, color: cor, marginTop: 2 }}>{label}</div>
      </div>
      {!conectado && (
        <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={onConectar}>
          Conectar
        </button>
      )}
      {conectado && (
        <span style={{ fontSize: 12, color: '#4CAF82', padding: '5px 12px', background: 'rgba(76,175,130,0.1)', borderRadius: 8, border: '1px solid rgba(76,175,130,0.2)' }}>
          ✓ Linha ativa
        </span>
      )}
    </div>
  )
}

// ─── MODAL QR CODE ────────────────────────────────────────
function ModalQR({ onClose }: any) {
  const [qrData, setQrData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/whatsapp?aba=qr')
      .then(r => r.json())
      .then(d => { setQrData(d.qr); setLoading(false) })
  }, [])

  const qrBase64 = qrData?.qrcode || qrData?.base64 || null
  const qrString = qrData?.code || null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '32px', width: 380, textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#F2EBD9', marginBottom: 8 }}>Conectar WhatsApp</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Abra o WhatsApp no celular da loja → toque nos três pontinhos → <strong style={{ color: '#F2EBD9' }}>Dispositivos conectados</strong> → <strong style={{ color: '#F2EBD9' }}>Conectar dispositivo</strong> → escaneie o QR Code
        </p>

        {loading ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Gerando QR Code...</div>
        ) : qrBase64 ? (
          <img src={qrBase64} alt="QR Code" style={{ width: 220, height: 220, borderRadius: 12, margin: '0 auto', display: 'block' }} />
        ) : qrString ? (
          <div style={{ background: 'white', padding: 12, borderRadius: 12, display: 'inline-block' }}>
            <div style={{ fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', color: '#000', maxWidth: 220 }}>{qrString.substring(0, 100)}...</div>
          </div>
        ) : (
          <div style={{ padding: '20px', color: '#E5584A', fontSize: 13 }}>
            Não foi possível gerar o QR Code.<br/>Verifique se a Evolution API está online.
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>O QR Code expira em 60 segundos. Recarregue se necessário.</p>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setLoading(true); fetch('/api/whatsapp?aba=qr').then(r => r.json()).then(d => { setQrData(d.qr); setLoading(false) }) }}>
            Recarregar QR
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── WHATSAPP PRINCIPAL ───────────────────────────────────
export default function WhatsAppPage() {
  const [aba, setAba]             = useState<'conexao' | 'modelos' | 'disparos' | 'logs'>('conexao')
  const [data, setData]           = useState<any>(null)
  const [pendentes, setPendentes] = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [mostrarQR, setMostrarQR] = useState(false)
  const [enviando, setEnviando]   = useState<string | null>(null)
  const [feedback, setFeedback]   = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const [d, p] = await Promise.all([
      fetch('/api/whatsapp?aba=status').then(r => r.json()),
      fetch('/api/whatsapp?aba=pendentes').then(r => r.json()),
    ])
    setData(d)
    setPendentes(p)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function enviarIndividual(tipo: string, cliente: any) {
    const numero = cliente.whatsapp || cliente.celular
    if (!numero) { alert('Cliente sem WhatsApp cadastrado'); return }
    setEnviando(cliente.id || cliente.nome)
    const tmpl = data?.modelos?.find((m: any) => m.tipo === tipo)
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, cod_cliente: cliente.id, numero, template_id: tmpl?.id }),
    })
    setEnviando(null)
    if (res.ok) {
      setFeedback(`✓ Mensagem enviada para ${cliente.nome?.split(' ')[0]}`)
      setTimeout(() => setFeedback(''), 3000)
      carregar()
    }
  }

  async function dispararLote(tipo: string) {
    if (!confirm(`Confirma o envio em lote de mensagens de ${tipo === 'aniversario' ? 'aniversário' : 'cobrança'}?`)) return
    setEnviando(tipo)
    const res = await fetch('/api/whatsapp/send', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo }),
    })
    const d = await res.json()
    setEnviando(null)
    setFeedback(`✓ ${d.enviados} mensagens enviadas${d.erros > 0 ? ` (${d.erros} erros)` : ''}`)
    setTimeout(() => setFeedback(''), 5000)
    carregar()
  }

  const ABAS = [
    { id: 'conexao',  label: 'Conexão',    icon: '◍' },
    { id: 'modelos',  label: 'Modelos',    icon: '✏' },
    { id: 'disparos', label: 'Disparos',   icon: '▶' },
    { id: 'logs',     label: 'Histórico',  icon: '▤' },
  ]

  return (
    <AppLayout>
      {mostrarQR && <ModalQR onClose={() => { setMostrarQR(false); setTimeout(carregar, 2000) }} />}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#F2EBD9' }}>WhatsApp</h1>
          <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>Mensagens automáticas e manuais</p>
        </div>

        {feedback && (
          <div style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.25)', borderRadius: 10, padding: '12px 16px', color: '#4CAF82', fontSize: 13 }}>
            {feedback}
          </div>
        )}

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {ABAS.map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id as any)} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              background: aba === tab.id ? 'rgba(201,168,76,0.18)' : 'transparent',
              color: aba === tab.id ? '#C9A84C' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}><span>{tab.icon}</span>{tab.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>Carregando...</div>
        ) : (

          /* ── CONEXÃO ─────────────────────────────────── */
          aba === 'conexao' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
              <StatusConexao status={data?.status} onConectar={() => setMostrarQR(true)} />

              <div className="card">
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 14 }}>Como funciona</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['Todo dia às 9h', 'O sistema verifica automaticamente aniversariantes e parcelas que vencem em 5 dias e envia as mensagens configuradas'],
                    ['Disparo manual', 'Você pode enviar mensagens individualmente para cada cliente na aba Disparos'],
                    ['Modelos editáveis', 'Os textos das mensagens são editáveis na aba Modelos — use {nome}, {valor} etc. para personalizar'],
                    ['Histórico completo', 'Todos os envios ficam registrados na aba Histórico com data, destinatário e status'],
                  ].map(([titulo, desc]) => (
                    <div key={titulo} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', marginTop: 6, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, color: '#F2EBD9', fontWeight: 600 }}>{titulo}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 6 }}>Configuração do Vercel Cron</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  Para os disparos automáticos funcionarem, o arquivo <code style={{ color: '#C9A84C', background: 'rgba(201,168,76,0.08)', padding: '1px 5px', borderRadius: 4 }}>vercel.json</code> já está configurado. Adicione a variável abaixo no Vercel:
                </p>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#4CAF82' }}>
                  CRON_SECRET=<span style={{ color: '#C9A84C' }}>sua_senha_secreta_aqui</span>
                </div>
              </div>
            </div>

          /* ── MODELOS ─────────────────────────────────── */
          ) : aba === 'modelos' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 740 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Edite os textos das mensagens. Use as variáveis para personalizar automaticamente com os dados de cada cliente.
              </p>
              {data?.modelos?.map((m: any) => (
                <EditorTemplate key={m.id} modelo={m} onSalvo={(updated: any) => {
                  setData((d: any) => ({ ...d, modelos: d.modelos.map((mm: any) => mm.id === updated.id ? updated : mm) }))
                }} />
              ))}
            </div>

          /* ── DISPAROS ────────────────────────────────── */
          ) : aba === 'disparos' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Disparos em lote */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="card" style={{ borderColor: 'rgba(201,168,76,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#F2EBD9' }}>🎂 Aniversariantes Hoje</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        {pendentes?.aniversariantes?.length || 0} com WhatsApp cadastrado
                      </div>
                    </div>
                    {(pendentes?.aniversariantes?.length || 0) > 0 && (
                      <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}
                        disabled={enviando === 'aniversario'}
                        onClick={() => dispararLote('aniversario')}>
                        {enviando === 'aniversario' ? 'Enviando...' : '▶ Enviar para todos'}
                      </button>
                    )}
                  </div>
                  {pendentes?.aniversariantes?.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum aniversariante hoje</p>
                  ) : pendentes?.aniversariantes?.map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#F2EBD9' }}>{a.nome?.split(' ').slice(0, 2).join(' ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.whatsapp || a.celular}</div>
                      </div>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                        disabled={enviando === (a.id || a.nome)}
                        onClick={() => enviarIndividual('aniversario', a)}>
                        {enviando === (a.id || a.nome) ? '...' : '↗ Enviar'}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ borderColor: 'rgba(229,88,74,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#F2EBD9' }}>💰 Vencimentos em 5 dias</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        {pendentes?.vencimentos?.filter((v: any) => v.dias_para_vencer === 5).length || 0} parcelas
                      </div>
                    </div>
                    {(pendentes?.vencimentos?.filter((v: any) => v.dias_para_vencer === 5).length || 0) > 0 && (
                      <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 12 }}
                        disabled={enviando === 'cobranca_5d'}
                        onClick={() => dispararLote('cobranca_5d')}>
                        {enviando === 'cobranca_5d' ? 'Enviando...' : '▶ Enviar para todos'}
                      </button>
                    )}
                  </div>
                  {pendentes?.vencimentos?.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum vencimento em 5 dias</p>
                  ) : pendentes?.vencimentos?.filter((v: any) => v.dias_para_vencer === 5).map((v: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#F2EBD9' }}>{v.nome_cliente?.split(' ').slice(0, 2).join(' ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{BRL(v.valor)} · {fmtData(v.data_vencimento)}</div>
                      </div>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                        disabled={enviando === (v.cod_cliente)}
                        onClick={() => enviarIndividual('cobranca_5d', { id: v.cod_cliente, nome: v.nome_cliente, whatsapp: v.whatsapp })}>
                        {enviando === v.cod_cliente ? '...' : '↗ Enviar'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Todos os vencimentos dos próximos 7 dias */}
              {(pendentes?.vencimentos?.filter((v: any) => v.dias_para_vencer !== 5)?.length || 0) > 0 && (
                <div className="card">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 14 }}>
                    Outros Vencimentos (próximos 7 dias)
                  </h3>
                  {pendentes?.vencimentos?.filter((v: any) => v.dias_para_vencer !== 5).map((v: any, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px auto', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,0.05)', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#F2EBD9' }}>{v.nome_cliente?.split(' ').slice(0, 2).join(' ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Parcela {v.parcela}</div>
                      </div>
                      <div style={{ fontSize: 12, color: v.dias_para_vencer === 0 ? '#E5584A' : '#E8943A' }}>
                        {v.dias_para_vencer === 0 ? 'Hoje' : `${v.dias_para_vencer}d`}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#C9A84C' }}>{BRL(v.valor)}</div>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => enviarIndividual(v.dias_para_vencer === 0 ? 'cobranca_vencimento' : 'cobranca_5d',
                          { id: v.cod_cliente, nome: v.nome_cliente, whatsapp: v.whatsapp })}>
                        ↗ Enviar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          /* ── HISTÓRICO / LOGS ─────────────────────────── */
          ) : aba === 'logs' ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 130px 80px 80px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
                {['Data/Hora', 'Cliente / Mensagem', 'Tipo', 'Número', 'Status'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {(data?.logs?.length === 0) ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma mensagem enviada ainda</div>
              ) : data?.logs?.map((log: any, i: number) => (
                <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 130px 80px 80px', padding: '12px 20px', borderBottom: i < data.logs.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDT(log.enviado_em)}</div>
                  <div>
                    <div style={{ fontSize: 13, color: '#F2EBD9' }}>{log.clientes?.nome || 'Sem cliente'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
                      {log.mensagem?.substring(0, 60)}...
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{TIPO_LABELS[log.tipo] || log.tipo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {log.numero?.replace(/55(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3') || '—'}
                  </div>
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: log.status === 'enviado' ? '#4CAF82' : '#E5584A',
                    }}>
                      {log.status === 'enviado' ? '✓ OK' : '✕ ERRO'}
                    </span>
                    {log.erro && <div style={{ fontSize: 10, color: '#E5584A', marginTop: 2 }}>{log.erro}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : null
        )}
      </div>
    </AppLayout>
  )
}
