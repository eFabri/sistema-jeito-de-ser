'use client'
import { useState } from 'react'
import { Printer, AlertTriangle } from 'lucide-react'
import { DadosRecibo, DadosTalaoCrediario, imprimirRecibo, imprimirCupomETalao } from '@/lib/impressora'

interface Props {
  dadosCupom: DadosRecibo
  dadosTalao?: DadosTalaoCrediario
  titulo?: string
  onClose: () => void
}

export default function ModalImpressaoVenda({ dadosCupom, dadosTalao, titulo = 'Imprimir', onClose }: Props) {
  const [viasCupom, setViasCupom]   = useState<1 | 2>(1)
  const [viasTalao, setViasTalao]   = useState<1 | 2>(1)
  const [imprimindo, setImprimindo] = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  async function executarImpressao(vias: 1 | 2) {
    setImprimindo(true)
    setErro(null)
    const res = await imprimirRecibo(dadosCupom, undefined, vias)
    setImprimindo(false)
    if (!res.ok) {
      setErro(res.erro ?? 'Erro ao imprimir.')
      return
    }
    onClose()
  }

  async function executarImpressaoCompleta() {
    setImprimindo(true)
    setErro(null)
    const res = dadosTalao
      ? await imprimirCupomETalao(dadosCupom, dadosTalao, undefined, viasCupom, viasTalao)
      : await imprimirRecibo(dadosCupom, undefined, viasCupom)
    setImprimindo(false)
    if (!res.ok) {
      setErro(res.erro ?? 'Erro ao imprimir.')
      return
    }
    onClose()
  }

  const btnVia = (ativo: boolean, label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: 8,
        border: `1.5px solid ${ativo ? 'rgba(201,168,76,0.7)' : 'rgba(201,168,76,0.2)'}`,
        background: ativo ? 'rgba(201,168,76,0.12)' : 'transparent',
        color: ativo ? '#C9A84C' : 'var(--text-muted)',
        fontWeight: ativo ? 700 : 400,
        cursor: 'pointer',
        fontSize: 13,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(201,168,76,0.1)', border: '1.5px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Printer size={18} color="#C9A84C" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#332F3A' }}>{titulo}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pedido #{dadosCupom.codVenda}</div>
          </div>
        </div>

        {erro && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
            <AlertTriangle size={15} color="#DC2626" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: '#DC2626', lineHeight: 1.5 }}>{erro}</span>
          </div>
        )}

        {/* Modo simples: sem talão */}
        {!dadosTalao && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Quantas vias deseja imprimir?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={imprimindo}>
                Cancelar
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C' }}
                onClick={() => executarImpressao(1)}
                disabled={imprimindo}
              >
                <Printer size={13} strokeWidth={1.8} /> {imprimindo ? 'Imprimindo...' : '1 Via'}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => executarImpressao(2)}
                disabled={imprimindo}
              >
                <Printer size={13} strokeWidth={1.8} /> {imprimindo ? 'Imprimindo...' : '2 Vias'}
              </button>
            </div>
          </>
        )}

        {/* Modo complexo: com talão de crediário */}
        {dadosTalao && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Cupom de venda:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {btnVia(viasCupom === 1, '1 Via', () => setViasCupom(1))}
                  {btnVia(viasCupom === 2, '2 Vias', () => setViasCupom(2))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Talão de crediário:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {btnVia(viasTalao === 1, '1 Via', () => setViasTalao(1))}
                  {btnVia(viasTalao === 2, '2 Vias', () => setViasTalao(2))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={imprimindo}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={executarImpressaoCompleta}
                disabled={imprimindo}
              >
                <Printer size={13} strokeWidth={1.8} />
                {imprimindo ? 'Imprimindo...' : 'Imprimir'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
