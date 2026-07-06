'use client'
import { useState, useEffect } from 'react'
import { imprimirRecibo, DadosRecibo } from '@/lib/impressora'

interface Props {
  dados: DadosRecibo
  titulo?: string
  onClose: () => void
}

export default function ModalImpressao({ dados, titulo = 'Imprimir Recibo', onClose }: Props) {
  const [preferencia, setPreferencia] = useState<1 | 2>(1)

  useEffect(() => {
    const saved = localStorage.getItem('preferencia_vias')
    if (saved === '2') setPreferencia(2)
  }, [])

  function imprimir(vias: 1 | 2) {
    localStorage.setItem('preferencia_vias', String(vias))
    imprimirRecibo(dados, undefined, vias)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20,
        padding: '32px', width: 380, boxShadow: 'var(--shadow-dropdown)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🖨</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#F2EBD9', marginBottom: 6 }}>
          {titulo}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 22 }}>
          Quantas vias deseja imprimir?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {([1, 2] as const).map(n => (
            <button key={n} onClick={() => { setPreferencia(n); imprimir(n) }} style={{
              padding: '16px 12px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${preferencia === n ? 'rgba(201,168,76,0.5)' : 'var(--border)'}`,
              background: preferencia === n ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
              color: preferencia === n ? '#C9A84C' : '#F2EBD9',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 26 }}>🖨</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
                {n} {n === 1 ? 'via' : 'vias'}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-muted)', fontWeight: 400, letterSpacing: '0.04em' }}>
                {n === 1 ? 'só cliente' : 'cliente + loja'}
              </span>
            </button>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          Não imprimir
        </button>
      </div>
    </div>
  )
}
