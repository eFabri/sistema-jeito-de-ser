// src/app/produtos/importar/page.tsx
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import * as XLSX from 'xlsx'

interface ProdutoRow {
  descricao: string
  grupo: string
  sub_grupo: string
  marca: string
  cor: string
  tamanho: string
  cod_barras: string
  cod_referencia: string
  preco_custo: number
  margem_lucro: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
  localizacao: string
  permite_desconto: boolean
  ativo: boolean
}

interface RowInvalida extends ProdutoRow {
  linha: number
  erros: string[]
}

const HEADERS = [
  'Descrição', 'Grupo', 'Sub-Grupo', 'Marca', 'Cor', 'Tamanho',
  'Cód.Barras', 'Cód.Referência', 'Preço Custo', 'Margem%', 'Preço Venda',
  'Estoque', 'Estoque Mínimo', 'Localização', 'Permite Desconto',
]

const EXAMPLE_ROW = [
  'VESTIDO LONGO FLORAL', 'Moda Feminina', 'VESTIDO', 'Marca X', 'PRETO', 'M',
  '7891234567890', 'REF001', '50,00', '100', '99,90', '5', '2', 'Araras A', 'Sim',
]

function downloadModelo() {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE_ROW])
  ws['!cols'] = HEADERS.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos')
  XLSX.writeFile(wb, 'modelo-importacao-produtos.xlsx')
}

function parsePlanilha(file: File): Promise<{ validas: ProdutoRow[]; invalidas: RowInvalida[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]

      const validas: ProdutoRow[] = []
      const invalidas: RowInvalida[] = []

      json.forEach((row, i) => {
        const descricao = String(row['Descrição'] || row['Descricao'] || '').trim()
        const preco_venda =
          parseFloat(String(row['Preço Venda'] || row['Preco Venda'] || '0').replace(',', '.')) || 0
        const erros: string[] = []
        if (!descricao) erros.push('Descrição obrigatória')
        if (preco_venda <= 0) erros.push('Preço de venda inválido')

        const produto: ProdutoRow = {
          descricao,
          grupo: String(row['Grupo'] || '').trim() || 'Outros',
          sub_grupo: String(row['Sub-Grupo'] || '').trim(),
          marca: String(row['Marca'] || '').trim(),
          cor: String(row['Cor'] || '').trim(),
          tamanho: String(row['Tamanho'] || '').trim(),
          cod_barras: String(row['Cód.Barras'] || '').trim(),
          cod_referencia: String(row['Cód.Referência'] || '').trim(),
          preco_custo: parseFloat(String(row['Preço Custo'] || '0').replace(',', '.')) || 0,
          margem_lucro: parseFloat(String(row['Margem%'] || '0').replace(',', '.')) || 0,
          preco_venda,
          estoque: parseInt(String(row['Estoque'] || '0')) || 0,
          estoque_minimo: parseInt(String(row['Estoque Mínimo'] || '1')) || 1,
          localizacao: String(row['Localização'] || '').trim(),
          permite_desconto: String(row['Permite Desconto'] || '').toLowerCase() !== 'não',
          ativo: true,
        }

        if (erros.length > 0) {
          invalidas.push({ ...produto, linha: i + 2, erros })
        } else {
          validas.push(produto)
        }
      })

      resolve({ validas, invalidas })
    }
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportarProdutosPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [validas, setValidas] = useState<ProdutoRow[]>([])
  const [invalidas, setInvalidas] = useState<RowInvalida[]>([])
  const [parsed, setParsed] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [resultado, setResultado] = useState<{ sucesso: number; erros: number } | null>(null)

  async function handleFile(file: File) {
    setFileName(file.name)
    const { validas: v, invalidas: inv } = await parsePlanilha(file)
    setValidas(v)
    setInvalidas(inv)
    setParsed(true)
    setResultado(null)
  }

  async function importar() {
    if (validas.length === 0) return
    setImporting(true)
    setTotal(validas.length)
    setProgress(0)
    let sucesso = 0
    let erros = 0

    for (let i = 0; i < validas.length; i++) {
      try {
        const res = await fetch('/api/produtos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validas[i]),
        })
        if (res.ok) { sucesso++ } else { erros++ }
      } catch {
        erros++
      }
      setProgress(i + 1)
    }

    setImporting(false)
    setResultado({ sucesso, erros })
  }

  function resetar() {
    setFileName('')
    setValidas([])
    setInvalidas([])
    setParsed(false)
    setResultado(null)
    setProgress(0)
    setTotal(0)
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '24px 28px',
  }

  const stepLabelStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'rgba(201,168,76,0.15)',
    border: '1px solid rgba(201,168,76,0.3)',
    color: '#C9A84C',
    fontSize: 11,
    fontWeight: 700,
    marginRight: 10,
    flexShrink: 0,
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

        {/* Header */}
        <div>
          <button onClick={() => router.push('/produtos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6, padding: 0 }}>‹ Produtos</button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#F2EBD9', margin: 0 }}>Importar Produtos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Cadastre múltiplos produtos de uma vez via planilha Excel ou CSV.</p>
        </div>

        {/* STEP 1: Download modelo */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={stepLabelStyle}>1</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', margin: 0 }}>Baixe o modelo de planilha</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
            Use o modelo oficial para garantir que os dados sejam importados corretamente.
            Preencha os campos conforme o exemplo incluído na planilha.
          </p>
          <button className="btn btn-ghost" onClick={downloadModelo} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span>↓</span> Download Modelo (.xlsx)
          </button>
        </div>

        {/* STEP 2: Upload */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={stepLabelStyle}>2</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', margin: 0 }}>Selecione sua planilha preenchida</h3>
          </div>

          <div
            onClick={() => !importing && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
            style={{
              border: `2px dashed ${dragging ? '#C9A84C' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 12,
              padding: '32px 24px',
              textAlign: 'center',
              cursor: importing ? 'default' : 'pointer',
              background: dragging ? 'rgba(201,168,76,0.05)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
            {fileName ? (
              <>
                <div style={{ color: '#F2EBD9', fontWeight: 600, marginBottom: 4 }}>{fileName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Clique para trocar o arquivo</div>
              </>
            ) : (
              <>
                <div style={{ color: '#F2EBD9', fontWeight: 600, marginBottom: 4 }}>Arraste o arquivo aqui ou clique para selecionar</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Aceita .xlsx e .csv</div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
        </div>

        {/* STEP 3: Preview + Import */}
        {parsed && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={stepLabelStyle}>3</span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', margin: 0 }}>Revisar e importar</h3>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.2)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#4CAF82' }}>{validas.length}</div>
                <div style={{ fontSize: 11, color: '#4CAF82', marginTop: 2 }}>Itens válidos</div>
              </div>
              {invalidas.length > 0 && (
                <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.2)' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#E5584A' }}>{invalidas.length}</div>
                  <div style={{ fontSize: 11, color: '#E5584A', marginTop: 2 }}>Com erro</div>
                </div>
              )}
            </div>

            {/* Preview table — first 10 valid rows */}
            {validas.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
                  Prévia — primeiros {Math.min(validas.length, 10)} itens válidos
                </div>
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Descrição', 'Grupo', 'Marca', 'Cor', 'Tamanho', 'Preço Venda', 'Estoque'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--gold-dim, #8a7040)', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validas.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '7px 10px', color: '#F2EBD9', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.grupo}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.marca}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.cor}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.tamanho}</td>
                          <td style={{ padding: '7px 10px', color: '#4CAF82', fontWeight: 600 }}>
                            {r.preco_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.estoque}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validas.length > 10 && (
                    <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                      + {validas.length - 10} mais itens válidos
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Error details */}
            {invalidas.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
                  Linhas com erro (não serão importadas)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {invalidas.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 12px', borderRadius: 8, background: 'rgba(229,88,74,0.07)', border: '1px solid rgba(229,88,74,0.15)', fontSize: 12 }}>
                      <span style={{ color: '#E5584A', fontWeight: 700, whiteSpace: 'nowrap' }}>Linha {r.linha}</span>
                      <span style={{ color: '#F2EBD9', fontWeight: 500 }}>{r.descricao || '(sem descrição)'}</span>
                      <span style={{ color: '#E5584A' }}>{r.erros.join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Import progress */}
            {importing && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  <span>Importando produtos...</span>
                  <span>{progress} / {total}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #C9A84C, #F2EBD9)', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            {/* Result */}
            {resultado && (
              <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 10, background: 'rgba(76,175,130,0.08)', border: '1px solid rgba(76,175,130,0.2)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#F2EBD9', marginBottom: 4 }}>Importação concluída</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <span style={{ color: '#4CAF82', fontWeight: 600 }}>{resultado.sucesso} importados com sucesso</span>
                  {resultado.erros > 0 && <span> · <span style={{ color: '#E5584A', fontWeight: 600 }}>{resultado.erros} com erro</span></span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-ghost" onClick={resetar}>Nova importação</button>
                  <button className="btn btn-primary" onClick={() => router.push('/produtos')}>Ver produtos</button>
                </div>
              </div>
            )}

            {/* Import button */}
            {!importing && !resultado && validas.length > 0 && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={importar} style={{ padding: '10px 24px' }}>
                  ↑ Importar {validas.length} produto{validas.length !== 1 ? 's' : ''} válido{validas.length !== 1 ? 's' : ''}
                </button>
                <button className="btn btn-ghost" onClick={resetar}>Cancelar</button>
              </div>
            )}

            {validas.length === 0 && (
              <div style={{ padding: '16px 20px', borderRadius: 10, background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.15)', color: '#E5584A', fontSize: 13 }}>
                Nenhum produto válido encontrado na planilha. Verifique os erros acima e corrija o arquivo.
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  )
}
