// src/components/ui/Skeleton.tsx — Skeleton shimmer dourado
'use client'
import React from 'react'

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: {
  width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

export function SkeletonKpi() {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <Skeleton width={80} height={10} style={{ marginBottom: 12 }} />
      <Skeleton width={140} height={28} style={{ marginBottom: 10 }} />
      <Skeleton width={100} height={10} />
    </div>
  )
}
