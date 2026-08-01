import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/instance/connectionState/${process.env.EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: process.env.EVOLUTION_API_KEY! },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      }
    )
    const data = await res.json()
    const conectado =
      data?.instance?.state === 'open' || data?.state === 'open'
    return NextResponse.json({ conectado })
  } catch {
    return NextResponse.json({ conectado: false })
  }
}
