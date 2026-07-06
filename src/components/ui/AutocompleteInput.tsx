// src/components/ui/AutocompleteInput.tsx
'use client'
import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}

export default function AutocompleteInput({ value, onChange, options, placeholder, disabled }: Props) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState(value)
  const wrapRef           = useRef<HTMLDivElement>(null)
  const timeoutRef        = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync when external value changes (e.g. form reset)
  useEffect(() => { setQuery(value) }, [value])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  const filtered = options.filter(o =>
    o.toLowerCase().includes((query || '').toLowerCase())
  )

  function handleChange(val: string) {
    setQuery(val)
    onChange(val)
    setOpen(true)
  }

  function handleSelect(opt: string) {
    setQuery(opt)
    onChange(opt)
    setOpen(false)
  }

  function handleBlur() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        className="input"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#1a1610', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => handleSelect(opt)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', background: 'none', border: 'none',
                color: opt === value ? '#C9A84C' : '#F2EBD9',
                fontSize: 13, cursor: 'pointer',
                borderBottom: '1px solid rgba(201,168,76,0.06)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
