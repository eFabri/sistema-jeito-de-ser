'use client'
import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}

export default function SelectCustom({ value, onChange, options, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{
          width: '100%',
          background: '#1a1610',
          border: '1px solid var(--border)',
          borderColor: open ? 'var(--gold-dim)' : 'var(--border)',
          boxShadow: open ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
          borderRadius: 'var(--radius-sm)',
          color: value ? '#F2EBD9' : 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          padding: '9px 32px 9px 12px',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          transition: 'border-color 0.25s, box-shadow 0.25s',
          position: 'relative',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value || placeholder || 'Selecionar...'}
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: 'transform 0.2s', color: 'var(--gold-dim)', fontSize: 10, pointerEvents: 'none',
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#1a1610',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          zIndex: 9999,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              style={{
                display: 'block', width: '100%', padding: '9px 14px',
                background: opt === value ? 'rgba(201,168,76,0.12)' : 'transparent',
                color: opt === value ? '#C9A84C' : '#F2EBD9',
                fontFamily: 'var(--font-body)', fontSize: 13,
                textAlign: 'left', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid rgba(201,168,76,0.04)',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { if (opt !== value) { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.06)'; (e.currentTarget as HTMLElement).style.color = '#F2EBD9' } }}
              onMouseLeave={e => { if (opt !== value) { (e.currentTarget as HTMLElement).style.background = 'transparent' } }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
