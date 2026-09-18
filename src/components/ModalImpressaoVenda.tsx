'use client'
import { useState } from 'react'
import { Printer, AlertTriangle } from 'lucide-react'
import { DadosRecibo, DadosTalaoCrediario, OpcaoImpressao, imprimirSeletivo } from '@/lib/impressora'

interface Props {
  dadosCupom: DadosRecibo
  dadosTalao?: DadosTalaoCrediario
  titulo?: string
  onClose: () => void
}

export default function ModalImpressaoVenda({ dadosCupom, dadosTalao, titulo = 'Imprimir', onClose }: Props) {
  const [opcoes, setOpcoes] = useState<OpcaoImpressao>({
    notaFiscal:       true,
    canhotoVenda:     true,
    canhotoCrediario: !!dadosTalao,
  })
  const [imprimindo, setImprimindo] = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const nenhumMarcado = !opcoes.notaFiscal && !opcoes.canhotoVenda && !(opcoes.canhotoCrediario && !!dadosTalao)

  function toggle(campo: keyof OpcaoImpressao) {
    setOpcoes(prev => ({ ...prev, [campo]: !prev[campo] }))
  }

  async function executarImpressao() {
    setImprimindo(true)
    setErro(null)
    const res = await imprimirSeletivo(dadosCupom, dadosTalao, opcoes)
    setImprimindo(false)
    if (!res.ok) {
      setErro(res.erro ?? 'Erro ao imprimir.')
      return
    }
    onClose()
  }

  function CheckItem({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
    return (
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: disabled ? 'default' : 'pointer',
        padding: '10px 14px', borderRadius: 8,
        border: `1.5px solid ${checked && !disabled ? 'rgba(201,168,76,0.4)' : 'rgba(0,0,0,0.08)'}`,
        background: checked && !disabled ? 'rgba(201,168,76,0.06)' : 'transparent',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
        userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          style={{ width: 16, height: 16, accentColor: '#C9A84C', cursor: disabled ? 'default' : 'pointer', flexShrink: 0 }}
        />
        <span style={{
          fontSize: 13,
          color: checked && !disabled ? '#C9A84C' : 'var(--text-secondary)',
          fontWeight: checked && !disabled ? 600 : 400,
        }}>
          {label}
        </span>
      </label>
    )
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <CheckItem
            label="Nota fiscal / Recibo"
            checked={opcoes.notaFiscal}
            onChange={() => toggle('notaFiscal')}
          />
          <CheckItem
            label="Canhoto de venda (via cliente)"
            checked={opcoes.canhotoVenda}
            onChange={() => toggle('canhotoVenda')}
          />
          <CheckItem
            label="Canhoto de crediário"
            checked={opcoes.canhotoCrediario}
            onChange={() => toggle('canhotoCrediario')}
            disabled={!dadosTalao}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={imprimindo}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={executarImpressao}
            disabled={imprimindo || nenhumMarcado}
          >
            <Printer size={13} strokeWidth={1.8} />
            {imprimindo ? 'Imprimindo...' : 'Imprimir'}
          </button>
        </div>
      </div>
    </div>
  )
}
