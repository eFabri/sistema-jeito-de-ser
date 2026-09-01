// src/app/whatsapp/optin/page.tsx
// Administração de opt-in de marketing WhatsApp.
// Permite marcar/desmarcar consentimento individual ou em lote,
// a partir do registro físico de autorização que a loja possui.
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { CheckSquare, Square, ArrowLeft, Search, Filter } from 'lucide-react'

const fmtDT = (d: string | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

interface ClienteOptin {
  id: number
  nome: string
  whatsapp: string | null
  celular: string | null
  whatsapp_marketing_optin: boolean
  whatsapp_marketing_optin_data: string | null
  categoria: string | null
}

export default function OptinAdminPage() {
  const router = useRouter()
  const [clientes, setClientes]         = useState<ClienteOptin[]>([])
  const [total, setTotal]               = useState(0)
  const [pagina, setPagina]             = useState(1)
  const [busca, setBusca]               = useState('')
  const [somenteSem, setSomenteSem]     = useState(false)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [carregando, setCarregando]     = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [feedback, setFeedback]         = useState('')
  const LIMITE = 50

  const carregar = useCallback(async () => {
    setCarregando(true)
    setSelecionados(new Set())
    const params = new URLSearchParams({
      q: busca,
      somente_sem_optin: String(somenteSem),
      pagina: String(pagina),
      limite: String(LIMITE),
    })
    const res = await fetch(`/api/whatsapp/optin?${params}`)
    const json = await res.json()
    setClientes(json.clientes || [])
    setTotal(json.total || 0)
    setCarregando(false)
  }, [busca, somenteSem, pagina])

  useEffect(() => {
    const timer = setTimeout(carregar, busca ? 350 : 0)
    return () => clearTimeout(timer)
  }, [carregar, busca])

  function toggleSelecionado(id: number) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (selecionados.size === clientes.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(clientes.map(c => c.id)))
    }
  }

  async function atualizarOptin(optin: boolean) {
    if (selecionados.size === 0) return
    setSalvando(true)
    const res = await fetch('/api/whatsapp/optin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selecionados], optin }),
    })
    const json = await res.json()
    setSalvando(false)
    if (json.ok) {
      setFeedback(`${json.atualizados} cliente(s) ${optin ? 'com opt-in ativado' : 'com opt-in removido'}`)
      setTimeout(() => setFeedback(''), 3000)
      carregar()
    } else {
      setFeedback(`Erro: ${json.erro}`)
    }
  }

  const totalPaginas = Math.ceil(total / LIMITE)

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px' }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => router.push('/whatsapp')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', margin: 0 }}>
              Opt-in de Marketing WhatsApp
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Marque o consentimento de cada cliente a partir do registro físico de autorização
            </p>
          </div>
        </div>

        {/* Aviso LGPD */}
        <div style={{
          background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 16, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#7A6828',
        }}>
          <strong>Atenção:</strong> Ative o opt-in somente para clientes que assinaram a autorização física.
          Templates de <em>cobrança (UTILITY)</em> são enviados sem opt-in. Somente mensagens de
          <em> marketing (aniversário, promoções)</em> exigem este consentimento.
        </div>

        {/* Filtros e ações */}
        <div style={{
          background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '14px 18px',
          marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={busca}
              onChange={e => { setBusca(e.target.value); setPagina(1) }}
              placeholder="Buscar por nome ou WhatsApp..."
              style={{
                width: '100%', paddingLeft: 30, paddingRight: 12, height: 36,
                border: '1px solid var(--border)', borderRadius: 10, fontSize: 13,
                background: 'transparent', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={somenteSem}
              onChange={e => { setSomenteSem(e.target.checked); setPagina(1) }}
            />
            <Filter size={12} /> Somente sem opt-in
          </label>

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              disabled={selecionados.size === 0 || salvando}
              onClick={() => atualizarOptin(true)}
              style={{
                background: selecionados.size > 0 ? '#4CAF82' : 'rgba(76,175,130,0.3)',
                color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: selecionados.size > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Ativar opt-in ({selecionados.size})
            </button>
            <button
              disabled={selecionados.size === 0 || salvando}
              onClick={() => atualizarOptin(false)}
              style={{
                background: selecionados.size > 0 ? '#E5584A' : 'rgba(229,88,74,0.3)',
                color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: selecionados.size > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Remover opt-in ({selecionados.size})
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{
            background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.3)',
            borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#2E7D5A',
          }}>
            {feedback}
          </div>
        )}

        {/* Contador */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          {total} cliente(s) com WhatsApp cadastrado
          {somenteSem ? ' — sem opt-in' : ''}
        </div>

        {/* Tabela */}
        <div style={{
          background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden',
        }}>
          {/* Cabeçalho da tabela */}
          <div style={{
            display: 'grid', gridTemplateColumns: '36px 1fr 140px 120px 170px',
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 10, color: 'var(--gold-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em',
          }}>
            <button onClick={toggleTodos} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--gold-dim)' }}>
              {selecionados.size === clientes.length && clientes.length > 0
                ? <CheckSquare size={16} />
                : <Square size={16} />}
            </button>
            <span>Cliente</span>
            <span>WhatsApp</span>
            <span>Opt-in</span>
            <span>Data do consentimento</span>
          </div>

          {carregando && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Carregando...
            </div>
          )}

          {!carregando && clientes.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum cliente encontrado
            </div>
          )}

          {!carregando && clientes.map((c, i) => (
            <div
              key={c.id}
              onClick={() => toggleSelecionado(c.id)}
              style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 140px 120px 170px',
                padding: '10px 16px', cursor: 'pointer',
                borderBottom: i < clientes.length - 1 ? '1px solid rgba(201,168,76,0.06)' : 'none',
                background: selecionados.has(c.id) ? 'rgba(201,168,76,0.06)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {selecionados.has(c.id)
                  ? <CheckSquare size={16} color="var(--gold)" />
                  : <Square size={16} color="var(--text-muted)" />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#332F3A' }}>{c.nome}</div>
                {c.categoria && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.categoria}</div>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
                {c.whatsapp || c.celular || '—'}
              </div>
              <div style={{ alignSelf: 'center' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: c.whatsapp_marketing_optin ? 'rgba(76,175,130,0.12)' : 'rgba(201,168,76,0.08)',
                  color: c.whatsapp_marketing_optin ? '#2E7D5A' : '#8A7030',
                }}>
                  {c.whatsapp_marketing_optin ? 'Ativo' : 'Pendente'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                {fmtDT(c.whatsapp_marketing_optin_data)}
              </div>
            </div>
          ))}
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
            >
              Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {pagina} / {totalPaginas}
            </span>
            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
