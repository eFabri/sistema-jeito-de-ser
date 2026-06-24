// src/components/ui/Card.tsx — Card premium reutilizável
'use client'
import React from 'react'

export function Card({ children, premium, padding = 22, style, ...rest }: {
  children: React.ReactNode; premium?: boolean; padding?: number; style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={premium ? 'card-premium' : 'card'}
      style={{ padding, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
