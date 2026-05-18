// src/lib/supabase/admin.ts — SERVIDOR APENAS. Usa service_role pra operações privilegiadas
// (criar/deletar usuários do Auth, bypassar RLS). Nunca importe em Client Component.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
