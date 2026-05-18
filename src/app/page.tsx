// src/app/page.tsx — Dashboard principal
import { createServerSupabase } from '@/lib/supabase'
import AppLayout from '@/components/layout/AppLayout'
import Dashboard from '@/components/modules/Dashboard'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const hoje = new Date().toISOString().split('T')[0]

  // Buscar resumo do dia via função SQL
  const { data: resumo } = await supabase.rpc('resumo_dia', { data_ref: hoje })

  // Últimas 8 vendas
  const { data: vendasRecentes } = await supabase
    .from('vendas')
    .select('id, codigo_legado, vendedor, data, nome_cliente, valor_total, situacao, forma_pagamento, created_at')
    .order('id', { ascending: false })
    .limit(8)

  // Próximos vencimentos (10)
  const { data: vencimentos } = await supabase
    .rpc('vencimentos_proximos', { dias: 15 })
    .limit(10)

  // Aniversariantes hoje
  const { data: aniversariantes } = await supabase
    .rpc('aniversariantes_hoje')

  // Produtos com estoque baixo
  const { data: estoqueBaixo } = await supabase
    .from('produtos')
    .select('id, descricao, estoque, estoque_minimo, grupo')
    .lte('estoque', supabase.rpc) // workaround — filtra no componente
    .order('estoque', { ascending: true })
    .limit(5)

  // Buscar estoque baixo corretamente
  const { data: produtosBaixos } = await supabase
    .from('produtos')
    .select('id, descricao, estoque, estoque_minimo, grupo')
    .filter('estoque', 'lte', 'estoque_minimo')
    .eq('ativo', true)
    .order('estoque', { ascending: true })
    .limit(5)

  return (
    <AppLayout>
      <Dashboard
        resumo={resumo}
        vendasRecentes={vendasRecentes || []}
        vencimentos={vencimentos || []}
        aniversariantes={aniversariantes || []}
        produtosBaixos={produtosBaixos || []}
      />
    </AppLayout>
  )
}
