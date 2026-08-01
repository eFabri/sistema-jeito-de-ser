'use client'
import { useState, useEffect } from 'react'

type WhatsAppStatus = 'conectado' | 'desconectado' | 'verificando'

export function useWhatsAppStatus(): WhatsAppStatus {
  const [status, setStatus] = useState<WhatsAppStatus>('verificando')

  useEffect(() => {
    async function verificar() {
      try {
        const res = await fetch('/api/whatsapp/status')
        const data = await res.json()
        setStatus(data.conectado ? 'conectado' : 'desconectado')
      } catch {
        setStatus('desconectado')
      }
    }

    verificar()
    const interval = setInterval(verificar, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return status
}
