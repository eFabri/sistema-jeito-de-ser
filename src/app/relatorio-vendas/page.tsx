'use client'
import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { FileSpreadsheet, Search } from 'lucide-react'
import * as XLSX from 'xlsx'

const BRL     = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function hoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export default function RelatorioVendasPage() {
  const hj = hoje()
  const [inicio, setInicio] = useState(hj.substring(0, 7) + '-01')
  const [fim, setFim]       = useState(hj)
  const [rows, setRows]     = useState<any[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [gerado, setGerado]   = useState(false)
  const [erro, setErro]       = useState<string | null>(null)

  async function gerar() {
    setLoading(true)
    setGerado(false)
    setErro(null)
    try {
      const res = await fetch(`/api/relatorio-vendas?inicio=${inicio}&fim=${fim}`, { cache: 'no-store' })
      const d   = await res.json()
      if (d.erro) { setErro(d.erro); return }
      setRows(d.rows || [])
      setTotal(d.total || 0)
      setGerado(true)
    } catch {
      setErro('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      'Nome do Cliente':    r.nomeCliente,
      'Telefone':           r.telefone,
      'Data da Venda':      fmtData(r.data),
      'Valor Total (R$)':   r.valorTotal,
      'Forma de Pagamento': r.formasPagamento,
    })))
    // Ajusta largura das colunas
    ws['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 28 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas')
    XLSX.writeFile(wb, `relatorio-vendas-${inicio}-a-${fim}.xlsx`)
  }

  const totalGeral = rows.reduce((s, r) => s + r.valorTotal, 0)

  const COLS_GRID = '1fr 140px 110px 140px 1fr'
  const HDRS      = ['Nome do Cliente', 'Telefone', 'Data', 'Valor Total', 'Forma de Pagamento']

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A', letterSpacing: '-0.01em' }}>
            Relatório de Vendas
          </h1>
          <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>
            Listagem detalhada por período · exportável em Excel
          </p>
        </div>

        {/* Filtros */}
        <div className="card" style={{ padding: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Data início
            </label>
            <input type="date" className="input" value={inicio} onChange={e => setInicio(e.target.value)} style={{ width: 160 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Data fim
            </label>
            <input type="date" className="input" value={fim} onChange={e => setFim(e.target.value)} style={{ width: 160 }} />
          </div>
          <button className="btn btn-primary" onClick={gerar} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Search size={14} strokeWidth={2} />
            {loading ? 'Gerando...' : 'Gerar relatório'}
          </button>
          {gerado && rows.length > 0 && (
            <button className="btn btn-ghost" onClick={exportarExcel}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: 'rgba(76,175,130,0.4)', color: '#4CAF82' }}>
              <FileSpreadsheet size={14} strokeWidth={2} />
              Exportar Excel
            </button>
          )}
        </div>

        {erro && (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '12px 16px', color: '#DC2626', fontSize: 13 }}>
            {erro}
          </div>
        )}

        {gerado && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {total} venda{total !== 1 ? 's' : ''} no período
              </span>
              {rows.length > 0 && (
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#C9A84C' }}>
                  Total: {BRL(totalGeral)}
                </span>
              )}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: COLS_GRID, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
                {HDRS.map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>

              {rows.length === 0 ? (
                <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma venda no período selecionado
                </div>
              ) : rows.map((r, i) => (
                <div key={r.id} style={{
                  display: 'grid', gridTemplateColumns: COLS_GRID,
                  padding: '12px 20px', alignItems: 'center',
                  borderBottom: i < rows.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                }}>
                  <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nomeCliente}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.telefone}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtData(r.data)}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{BRL(r.valorTotal)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.formasPagamento}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
