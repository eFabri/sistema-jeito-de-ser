// src/components/ui/KpiCard.tsx — Card de indicador (KPI) com ícone, sub e comparativo
'use client'
import React from 'react'

export type KpiTone = 'gold' | 'alert' | 'success' | 'warning' | 'info' | 'neutral'

const TONES: Record<KpiTone, { label: string; value: string; aura: string }> = {
  gold:    { label: 'var(--gold-light)', value: 'var(--text-primary)', aura: 'rgba(201,168,76,0.10)' },
  alert:   { label: 'var(--danger)',     value: 'var(--danger)',       aura: 'rgba(229,88,74,0.12)'  },
  success: { label: 'var(--success)',    value: 'var(--text-primary)', aura: 'rgba(76,175,130,0.10)' },
  warning: { label: 'var(--warning)',    value: 'var(--warning)',      aura: 'rgba(232,148,58,0.10)' },
  info:    { label: 'var(--info)',       value: 'var(--text-primary)', aura: 'rgba(77,158,204,0.10)' },
  neutral: { label: 'var(--text-muted)', value: 'var(--text-primary)', aura: 'rgba(201,168,76,0.05)' },
}

export function KpiCard({
  icon, label, value, sub, tone = 'gold', delta, onClick,
}: {
  icon?: string
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: KpiTone
  delta?: { pct: number | null; tone?: KpiTone }
  onClick?: () => void
}) {
  const t = TONES[tone]
  const dPct = delta?.pct ?? null
  const dTone = delta?.tone || (dPct != null && dPct >= 0 ? 'success' : 'alert')
  const dColor = TONES[dTone].label

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        padding: '20px 22px',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 96, height: 96,
        background: `radial-gradient(circle at 100% 0%, ${t.aura} 0%, transparent 70%)`,
        borderRadius: '0 16px 0 0',
        pointerEvents: 'none',
      }} />
      <div style={{
        fontSize: 10, color: t.label,
        letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
        marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28, fontWeight: 600,
        color: t.value, lineHeight: 1, letterSpacing: '-0.01em',
      }}>
        {value}
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
        {dPct != null && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: dColor,
            background: `${dColor}1a`,
            border: `1px solid ${dColor}33`,
            borderRadius: 6, padding: '1px 6px',
            fontFamily: 'var(--font-mono)',
          }}>
            {dPct >= 0 ? '↑' : '↓'} {Math.abs(dPct).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}
