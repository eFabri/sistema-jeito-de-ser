// src/components/ui/ProgressBar.tsx — Barra dourada com animação
'use client'
import React, { useEffect, useState } from 'react'

export function ProgressBar({
  value, max = 100, height = 14, showPercent = true,
  tone = 'gold',
}: {
  value: number; max?: number; height?: number; showPercent?: boolean;
  tone?: 'gold' | 'success' | 'warning' | 'danger';
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const [width, setWidth] = useState(0)
  useEffect(() => {
    // anima: 0 → pct
    const t = setTimeout(() => setWidth(pct), 50)
    return () => clearTimeout(t)
  }, [pct])

  const gradients: Record<string, string> = {
    gold:    'linear-gradient(90deg, var(--gold-dark), var(--gold), var(--gold-light))',
    success: 'linear-gradient(90deg, #2e6f4e, var(--success))',
    warning: 'linear-gradient(90deg, #a3611f, var(--warning))',
    danger:  'linear-gradient(90deg, #8c2c22, var(--danger))',
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%', height,
      background: 'rgba(201,168,76,0.08)',
      borderRadius: height / 2,
      overflow: 'hidden',
      border: '1px solid rgba(201,168,76,0.10)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        width: `${width}%`,
        background: gradients[tone],
        borderRadius: 'inherit',
        transition: 'width 0.85s var(--ease-silk)',
        boxShadow: '0 0 16px rgba(201,168,76,0.32) inset, 0 0 8px rgba(201,168,76,0.18)',
      }} />
      {showPercent && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '0.06em', fontFamily: 'var(--font-mono)',
        }}>
          {pct.toFixed(1)}%
        </div>
      )}
    </div>
  )
}
