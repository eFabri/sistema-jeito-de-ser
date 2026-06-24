// src/components/ui/RankBadge.tsx — Medalha de pódio (1º, 2º, 3º)
'use client'
import React from 'react'

const MEDALS: Record<number, { bg: string; glow: string; label: string }> = {
  1: { bg: 'linear-gradient(135deg, #F5D76E, #C9A84C)', glow: 'rgba(245,215,110,0.5)', label: '1' },
  2: { bg: 'linear-gradient(135deg, #D1D1D1, #9A9A9A)', glow: 'rgba(209,209,209,0.4)', label: '2' },
  3: { bg: 'linear-gradient(135deg, #CD9B6A, #A0673B)', glow: 'rgba(205,155,106,0.4)', label: '3' },
}

export function RankBadge({ pos, size = 36 }: { pos: number; size?: number }) {
  const m = MEDALS[pos]
  if (m) {
    return (
      <div className="medal-in" style={{
        width: size, height: size, borderRadius: '50%',
        background: m.bg,
        boxShadow: `0 0 18px ${m.glow}, inset 0 -2px 0 rgba(0,0,0,0.2)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: size * 0.45, fontWeight: 700,
        color: '#1a1610', flexShrink: 0,
      }}>
        {m.label}
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(201,168,76,0.06)',
      border: '1px solid rgba(201,168,76,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, color: 'var(--gold-dim)', fontWeight: 700,
      fontFamily: 'var(--font-mono)', flexShrink: 0,
    }}>
      {pos}
    </div>
  )
}
