// src/app/page.tsx — Dashboard principal (delega ao componente client)
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/components/modules/Dashboard'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  )
}
