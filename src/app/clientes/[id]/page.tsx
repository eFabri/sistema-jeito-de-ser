// src/app/clientes/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { hojeNoBrasil } from '@/lib/dates'
import { FileText } from 'lucide-react'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function SummaryCard({ label, value, sub, alert, success }: any) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${alert ? 'rgba(229,88,74,0.25)' : success ? 'rgba(76,175,130,0.2)' : 'var(--border)'}`,
      borderRadius: 32, padding: '16px 18px', boxShadow: 'var(--shadow-clay)',
    }}>
      <div style={{ fontSize: 10, color: alert ? '#E5584A' : success ? '#4CAF82' : 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: alert ? '#E5584A' : '#332F3A', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function InfoRow({ label, value }: any) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 160, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#332F3A' }}>{value}</span>
    </div>
  )
}

function EditField({ label, children }: any) {
  return (
    <div>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }: any) {
  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#332F3A', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function ClienteDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<'dados' | 'compras' | 'crediario'>('dados')
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [salvando, setSalvando] = useState(false)
  const [modalFinanceiro, setModalFinanceiro] = useState(false)
  const [modalReceber, setModalReceber] = useState<any>(null)
  const [modalCredito, setModalCredito] = useState(false)
  const [creditoValor, setCreditoValor] = useState('')
  const [creditoJust, setCreditoJust] = useState('')
  const [salvandoCredito, setSalvandoCredito] = useState(false)

  useEffect(() => {
    fetch(`/api/clientes/${params.id}`)
      .then(r => r.json())
      .then(d => { setData(d); setForm(d.cliente); setLoading(false) })
  }, [params.id])

  async function salvar() {
    setSalvando(true)
    await fetch(`/api/clientes/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setData((prev: any) => ({ ...prev, cliente: form }))
    setEditando(false)
    setSalvando(false)
  }

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Carregando...
      </div>
    </AppLayout>
  )

  const { cliente, vendas, crediario, resumo, historico = [] } = data
  const c = editando ? form : cliente

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev: any) => ({ ...prev, [field]: e.target.value }))

  const editInp = (field: string, type = 'text', placeholder = '') => (
    <input className="input" type={type} placeholder={placeholder} value={form[field] || ''} onChange={f(field)} />
  )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _vencido = crediario.filter((p: any) => new Date(p.data_vencimento) < new Date())

  async function lancarCredito() {
    const v = parseFloat(creditoValor)
    if (!v || v <= 0) return
    setSalvandoCredito(true)
    await fetch(`/api/clientes/${params.id}/credito`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'entrada', valor: v, descricao: creditoJust || 'Crédito lançado manualmente' }),
    })
    const updated = await fetch(`/api/clientes/${params.id}`).then(r => r.json())
    setData(updated)
    setForm(updated.cliente)
    setModalCredito(false)
    setCreditoValor('')
    setCreditoJust('')
    setSalvandoCredito(false)
  }

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/clientes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, paddingTop: 6 }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.06))',
                border: '1px solid rgba(201,168,76,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#C9A84C',
              }}>
                {cliente.nome?.charAt(0)}
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#332F3A', lineHeight: 1 }}>
                  {cliente.nome}
                </h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Cliente #{cliente.codigo_legado || cliente.id}
                  {cliente.data_cadastro && ` · Desde ${fmtData(cliente.data_cadastro)}`}
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editando ? (
              <>
                <button className="btn btn-ghost" onClick={() => { setEditando(false); setForm(cliente) }}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => router.push(`/vendas/nova?cliente=${cliente.id}`)}>+ Nova Venda</button>
                <button className="btn btn-ghost" onClick={() => setModalCredito(true)}>+ Lançar Crédito</button>
                <button className="btn btn-primary" onClick={() => setEditando(true)}>Editar</button>
              </>
            )}
          </div>
        </div>

        {/* RESUMO FINANCEIRO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px,1fr))', gap: 12 }}>
          <SummaryCard label="Total em Compras" value={BRL(resumo.totalCompras)} sub={`${resumo.qtdVendas} vendas`} success />
          <SummaryCard label="Saldo Devedor" value={BRL(resumo.saldoDevedorReal)} sub={`${crediario.length} parcelas abertas`} alert={resumo.saldoDevedorReal > 0} />
          <SummaryCard label="Vencido" value={BRL(resumo.totalVencido)} sub={`de ${BRL(resumo.totalParcelas)} total`} alert={resumo.totalVencido > 0} />
          {resumo.totalPago > 0 && <SummaryCard label="Total Pago" value={BRL(resumo.totalPago)} success />}
          {resumo.qtdParciais > 0 && <SummaryCard label="Parciais" value={`${resumo.qtdParciais}`} sub="parcelas com baixa parcial" />}
          <SummaryCard label="Limite de Crédito" value={BRL(cliente.limite_credito || 0)} />
          {cliente.credito_troca > 0 && <SummaryCard label="Crédito de Troca" value={BRL(cliente.credito_troca)} />}
          {(cliente.saldo_credito || 0) > 0 && <SummaryCard label="Saldo de Crédito" value={BRL(cliente.saldo_credito || 0)} success />}
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {[
            { id: 'dados', label: 'Dados Cadastrais' },
            { id: 'compras', label: `Compras (${vendas.length})` },
            { id: 'crediario', label: `Crediário (${crediario.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id as any)} style={{
              padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              background: aba === tab.id ? 'rgba(201,168,76,0.18)' : 'transparent',
              color: aba === tab.id ? '#C9A84C' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ABA: DADOS */}
        {aba === 'dados' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* DADOS PESSOAIS */}
            <Section title="Dados Pessoais">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EditField label="Nome completo">
                    <input className="input" value={form.nome || ''} onChange={f('nome')} />
                  </EditField>
                  <EditField label="Data de nascimento">
                    {editInp('data_nascimento', 'date')}
                  </EditField>
                  <EditField label="CPF">{editInp('cpf')}</EditField>
                  <EditField label="RG / Identidade">{editInp('identidade')}</EditField>
                  <EditField label="Estado civil">
                    <select className="input" value={form.estado_civil || ''} onChange={f('estado_civil')}>
                      <option value="">—</option>
                      {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </EditField>
                </div>
              ) : (
                <>
                  <InfoRow label="Nome" value={c.nome} />
                  <InfoRow label="Data de nascimento" value={c.data_nascimento ? fmtData(c.data_nascimento) : null} />
                  <InfoRow label="CPF" value={c.cpf} />
                  <InfoRow label="RG / Identidade" value={c.identidade} />
                  <InfoRow label="Estado civil" value={c.estado_civil} />
                </>
              )}
            </Section>

            {/* FAMÍLIA */}
            <Section title="Família">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EditField label="Cônjuge">{editInp('conjuge')}</EditField>
                  <EditField label="Tel. do cônjuge">{editInp('conjuge_telefone', 'tel')}</EditField>
                  <EditField label="Data do casamento">{editInp('data_casamento', 'date')}</EditField>
                  <EditField label="Filho(a)">{editInp('filho')}</EditField>
                  <EditField label="Tel. do filho(a)">{editInp('filho_telefone', 'tel')}</EditField>
                  <EditField label="Filiação (Mãe)">{editInp('filiacao_mae')}</EditField>
                  <EditField label="Tel. da mãe">{editInp('filiacao_mae_tel', 'tel')}</EditField>
                  <EditField label="Filiação (Pai)">{editInp('filiacao_pai')}</EditField>
                  <EditField label="Tel. do pai">{editInp('filiacao_pai_tel', 'tel')}</EditField>
                </div>
              ) : (
                <>
                  <InfoRow label="Cônjuge" value={c.conjuge} />
                  <InfoRow label="Tel. cônjuge" value={c.conjuge_telefone} />
                  <InfoRow label="Data do casamento" value={c.data_casamento ? fmtData(c.data_casamento) : null} />
                  <InfoRow label="Filho(a)" value={c.filho} />
                  <InfoRow label="Tel. filho(a)" value={c.filho_telefone} />
                  <InfoRow label="Filiação (Mãe)" value={c.filiacao_mae} />
                  <InfoRow label="Tel. da mãe" value={c.filiacao_mae_tel} />
                  <InfoRow label="Filiação (Pai)" value={c.filiacao_pai} />
                  <InfoRow label="Tel. do pai" value={c.filiacao_pai_tel} />
                </>
              )}
            </Section>

            {/* ENDEREÇO */}
            <Section title="Endereço">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EditField label="CEP">{editInp('cep')}</EditField>
                  <EditField label="Endereço">{editInp('endereco')}</EditField>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <EditField label="Número">{editInp('numero')}</EditField>
                    <EditField label="Complemento">{editInp('complemento')}</EditField>
                  </div>
                  <EditField label="Bairro">{editInp('bairro')}</EditField>
                  <EditField label="Cidade">{editInp('cidade')}</EditField>
                  <EditField label="Estado">{editInp('estado')}</EditField>
                </div>
              ) : (
                <>
                  <InfoRow label="Endereço" value={[c.endereco, c.numero, c.complemento].filter(Boolean).join(', ')} />
                  <InfoRow label="Bairro" value={c.bairro} />
                  <InfoRow label="Cidade / Estado" value={[c.cidade, c.estado].filter(Boolean).join(' — ')} />
                  <InfoRow label="CEP" value={c.cep} />
                </>
              )}
            </Section>

            {/* CONTATO */}
            <Section title="Contato">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EditField label="Celular">{editInp('celular', 'tel')}</EditField>
                  <EditField label="Telefone">{editInp('telefone', 'tel')}</EditField>
                  <EditField label="WhatsApp">{editInp('whatsapp', 'tel')}</EditField>
                  <EditField label="Email">{editInp('email', 'email')}</EditField>
                  <EditField label="Rede social">{editInp('rede_social')}</EditField>
                </div>
              ) : (
                <>
                  <InfoRow label="Celular" value={c.celular} />
                  <InfoRow label="Telefone" value={c.telefone} />
                  <InfoRow label="WhatsApp" value={c.whatsapp} />
                  <InfoRow label="Email" value={c.email} />
                  <InfoRow label="Rede social" value={c.rede_social} />
                </>
              )}
            </Section>

            {/* TRABALHO */}
            <Section title="Trabalho">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EditField label="Empresa">{editInp('trabalho_nome')}</EditField>
                  <EditField label="Cargo">{editInp('trabalho_cargo')}</EditField>
                  <EditField label="Tel. do trabalho">{editInp('trabalho_telefone', 'tel')}</EditField>
                  <EditField label="Renda mensal">{editInp('renda')}</EditField>
                  <EditField label="Tempo no emprego">{editInp('trabalho_tempo')}</EditField>
                </div>
              ) : (
                <>
                  <InfoRow label="Empresa" value={c.trabalho_nome} />
                  <InfoRow label="Cargo" value={c.trabalho_cargo} />
                  <InfoRow label="Tel. do trabalho" value={c.trabalho_telefone} />
                  <InfoRow label="Renda mensal" value={c.renda} />
                  <InfoRow label="Tempo no emprego" value={c.trabalho_tempo} />
                </>
              )}
            </Section>

            {/* CRÉDITO & PERFIL */}
            <Section title="Crédito & Perfil">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <EditField label="Categoria">
                    <select className="input" value={form.categoria || ''} onChange={f('categoria')}>
                      <option value="">—</option>
                      {['Crediário', 'Avista', 'Pendente'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </EditField>
                  <EditField label="Limite de crédito (R$)">{editInp('limite_credito', 'number')}</EditField>
                  <EditField label="Desconto família (%)">{editInp('desconto_familia', 'number')}</EditField>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <EditField label="Tamanho Roupa">{editInp('tamanho')}</EditField>
                    <EditField label="Tops">{editInp('tamanho2')}</EditField>
                    <EditField label="Botons">{editInp('tamanho3')}</EditField>
                    <EditField label="Calçado">{editInp('tamanho_calcado')}</EditField>
                  </div>
                  <EditField label="Perfil / Estilo">{editInp('perfil')}</EditField>
                  <EditField label="Observação">
                    <textarea className="input" rows={3} value={form.observacao || ''} onChange={f('observacao')} style={{ resize: 'vertical' }} />
                  </EditField>
                </div>
              ) : (
                <>
                  <InfoRow label="Categoria" value={c.categoria} />
                  <InfoRow label="Limite de crédito" value={c.limite_credito ? BRL(c.limite_credito) : null} />
                  <InfoRow label="Desconto família" value={c.desconto_familia ? `${c.desconto_familia}%` : null} />
                  <InfoRow label="Tamanho Roupa" value={c.tamanho} />
                  <InfoRow label="Tops" value={c.tamanho2} />
                  <InfoRow label="Botons" value={c.tamanho3} />
                  <InfoRow label="Calçado" value={c.tamanho_calcado} />
                  <InfoRow label="Perfil / Estilo" value={c.perfil} />
                  <InfoRow label="Observação" value={c.observacao} />
                </>
              )}
            </Section>

            {/* REFERÊNCIAS */}
            <Section title="Referências">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <EditField label="Ref. comercial">{editInp('ref_comercial')}</EditField>
                    <EditField label="Tel. comercial">{editInp('ref_comercial_tel', 'tel')}</EditField>
                    <EditField label="Ref. pessoal 1">{editInp('ref_pessoal1')}</EditField>
                    <EditField label="Tel. pessoal 1">{editInp('ref_pessoal1_tel', 'tel')}</EditField>
                    <EditField label="Ref. pessoal 2">{editInp('ref_pessoal2')}</EditField>
                    <EditField label="Tel. pessoal 2">{editInp('ref_pessoal2_tel', 'tel')}</EditField>
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow label="Ref. Comercial" value={c.ref_comercial} />
                  <InfoRow label="Tel. Comercial" value={c.ref_comercial_tel} />
                  <InfoRow label="Ref. Pessoal 1" value={c.ref_pessoal1} />
                  <InfoRow label="Tel. Pessoal 1" value={c.ref_pessoal1_tel} />
                  <InfoRow label="Ref. Pessoal 2" value={c.ref_pessoal2} />
                  <InfoRow label="Tel. Pessoal 2" value={c.ref_pessoal2_tel} />
                </>
              )}
            </Section>
          </div>
        )}

        {/* ABA: COMPRAS */}
        {aba === 'compras' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 120px 100px', gap: 12 }}>
                {['Nº', 'Data', 'Valor', 'Forma', 'Situação'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
            </div>
            {vendas.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma compra registrada</div>
            ) : vendas.map((v: any, i: number) => (
              <div key={v.id} onClick={() => router.push(`/vendas/${v.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 120px 120px 100px',
                  gap: 12, padding: '13px 20px', cursor: 'pointer',
                  borderBottom: i < vendas.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                  alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{v.codigo_legado || v.id}</div>
                <div style={{ fontSize: 13, color: '#332F3A' }}>{fmtData(v.data)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{BRL(v.valor_total)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.forma_pagamento || '—'}</div>
                <div style={{ fontSize: 11, color: v.situacao === 'Cancelada' ? '#E5584A' : '#4CAF82' }}>{v.situacao}</div>
              </div>
            ))}
          </div>
        )}

        {/* ABA: CREDIÁRIO */}
        {aba === 'crediario' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Cabeçalho + resumo */}
            <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(201,168,76,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: crediario.length > 0 ? 12 : 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 160px 110px 130px 44px', gap: 12 }}>
                  {['Parcela', 'Vencimento', 'Valor / Saldo', 'Juros', 'Status', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', flexShrink: 0 }} onClick={() => setModalFinanceiro(true)}>
                  <FileText size={13} strokeWidth={1.8} />
                  Histórico Completo
                </button>
              </div>
              {/* Resumo financeiro do crediário */}
              {crediario.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Total Parcelas', val: resumo.totalParcelas, cor: 'var(--text-muted)' },
                    { label: 'Total Pago', val: resumo.totalPago, cor: '#4CAF82' },
                    { label: 'Saldo Devedor', val: resumo.saldoDevedorReal, cor: '#E5584A' },
                    { label: 'Parciais', val: null, qtd: resumo.qtdParciais, cor: '#C9A84C' },
                  ].map(({ label, val, qtd, cor }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: cor }}>
                        {val != null ? BRL(val) : `${qtd} parcelas`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {crediario.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma parcela em aberto</div>
            ) : crediario.map((p: any, i: number) => {
              const hoje2 = hojeNoBrasil()
              const atrasado = p.data_vencimento < hoje2
              const isParcial = p.parcialmente_pago && !p.pago
              const saldoExibido = isParcial ? (p.saldo_devedor || p.valor) : p.valor
              const jaPago = p.valor_pago || 0
              const statusColor = isParcial ? '#C9A84C' : atrasado ? '#E5584A' : '#E8943A'
              const statusLabel = isParcial ? 'PARCIAL' : atrasado ? 'VENCIDO' : 'EM ABERTO'
              return (
                <div key={p.id} style={{
                  display: 'grid', gridTemplateColumns: '80px 120px 160px 110px 130px 44px',
                  gap: 12, padding: '13px 20px', alignItems: 'center',
                  borderBottom: i < crediario.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none',
                  background: atrasado ? 'rgba(229,88,74,0.02)' : isParcial ? 'rgba(201,168,76,0.02)' : 'transparent',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.parcela || '—'}</div>
                  <div style={{ fontSize: 13, color: atrasado ? '#E5584A' : '#332F3A', fontWeight: atrasado ? 600 : 400 }}>
                    {fmtData(p.data_vencimento)}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: isParcial ? '#C9A84C' : atrasado ? '#E5584A' : '#C9A84C' }}>
                      {BRL(saldoExibido)}
                    </div>
                    {isParcial && jaPago > 0 && (
                      <div style={{ fontSize: 10, color: '#4CAF82' }}>✓ {BRL(jaPago)} pago de {BRL(p.valor)}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: p.juros > 0 ? '#E8943A' : 'var(--text-muted)' }}>
                    {p.juros > 0 ? BRL(p.juros) : '—'}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: statusColor }}>
                    {statusLabel}
                  </div>
                  <div>
                    <button className="btn btn-success" style={{ padding: '5px 10px', fontSize: 11 }}
                      onClick={() => router.push(`/financeiro?aba=receber&filtro=${isParcial ? 'parcial' : atrasado ? 'vencido' : 'aberto'}`)}>
                      ✓
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL: HISTÓRICO FINANCEIRO COMPLETO */}
      {modalFinanceiro && (() => {
        const hoje = hojeNoBrasil()
        const vencidas  = historico.filter((p: any) => !p.pago && p.data_vencimento < hoje && p.status !== 'Pago Parcial')
        const parciais  = historico.filter((p: any) => p.status === 'Pago Parcial')
        const abertas   = historico.filter((p: any) => !p.pago && p.data_vencimento >= hoje && p.status !== 'Pago Parcial')
        const pagas     = historico.filter((p: any) => p.pago)
        const totalVenc = vencidas.reduce((s: number, p: any) => s + (p.saldo_devedor > 0 ? p.saldo_devedor : p.valor), 0)
        const totalAbto = abertas.reduce((s: number, p: any) => s + (p.saldo_devedor > 0 ? p.saldo_devedor : p.valor), 0)
        const totalParc = parciais.reduce((s: number, p: any) => s + (p.saldo_devedor || 0), 0)
        const totalPago = pagas.reduce((s: number, p: any) => s + p.valor, 0)

        const Linha = ({ p, cor }: any) => {
          const saldo = (p.saldo_devedor > 0 && !p.pago) ? p.saldo_devedor : p.valor
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px 110px 90px', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,0.05)', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.parcela || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Venda #{p.cod_venda || '—'}</div>
              <div style={{ fontSize: 12, color: cor }}>{fmtData(p.data_vencimento)}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: cor }}>
                {BRL(saldo)}
                {p.status === 'Pago Parcial' && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>de {BRL(p.valor)}</div>}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {p.pago ? 'PAGO' : p.status === 'Pago Parcial' ? 'PARCIAL' : p.data_vencimento < hoje ? 'VENCIDO' : 'EM ABERTO'}
              </div>
            </div>
          )
        }

        const Grupo = ({ titulo, itens, cor, total }: any) => itens.length === 0 ? null : (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: cor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{titulo} ({itens.length})</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: cor }}>{BRL(total)}</div>
            </div>
            <div style={{ borderTop: `1px solid ${cor}30`, paddingTop: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px 110px 90px', gap: 10, paddingBottom: 6 }}>
                {['Parcela', 'Venda', 'Vencimento', 'Valor', 'Status'].map(h => (
                  <div key={h} style={{ fontSize: 9, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {itens.map((p: any) => <Linha key={p.id} p={p} cor={cor} />)}
            </div>
          </div>
        )

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setModalFinanceiro(false) }}>
            <div className="card" style={{ width: '100%', maxWidth: 740, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>

              {/* Header */}
              <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', margin: 0 }}>
                      Histórico Financeiro
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{cliente.nome}</p>
                  </div>
                  <button type="button" onClick={() => setModalFinanceiro(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
                  {[
                    { label: 'Vencido', val: totalVenc, cor: '#E5584A' },
                    { label: 'Parcial', val: totalParc, cor: '#C9A84C' },
                    { label: 'Em Aberto', val: totalAbto, cor: '#E8943A' },
                    { label: 'Pago', val: totalPago, cor: '#4CAF82' },
                  ].map(({ label, val, cor }) => (
                    <div key={label} style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: cor }}>{BRL(val)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                {historico.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhum registro financeiro encontrado</div>
                ) : (
                  <>
                    <Grupo titulo="Vencidas" itens={vencidas} cor="#E5584A" total={totalVenc} />
                    <Grupo titulo="Baixa Parcial" itens={parciais} cor="#C9A84C" total={totalParc} />
                    <Grupo titulo="Em Aberto" itens={abertas} cor="#E8943A" total={totalAbto} />
                    <Grupo titulo="Pagas" itens={pagas} cor="#4CAF82" total={totalPago} />
                  </>
                )}
              </div>

              <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setModalFinanceiro(false)}>Fechar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* suppress unused var warning */}
      {modalReceber && null}

      {/* MODAL LANÇAR CRÉDITO */}
      {modalCredito && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModalCredito(false) }}>
          <div style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 20, padding: '28px 32px', width: 400, boxShadow: 'var(--shadow-clay)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#332F3A', marginBottom: 6 }}>Lançar Crédito</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>{cliente.nome}</p>

            {(cliente.saldo_credito || 0) > 0 && (
              <div style={{ background: 'rgba(76,175,130,0.08)', border: '1px solid rgba(76,175,130,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#4CAF82' }}>
                Saldo atual: <strong>{BRL(cliente.saldo_credito || 0)}</strong>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Valor (R$)</label>
                <input type="number" className="input" min={0.01} step={0.01} value={creditoValor}
                  onChange={e => setCreditoValor(e.target.value)} placeholder="0,00" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>Justificativa</label>
                <input type="text" className="input" value={creditoJust}
                  onChange={e => setCreditoJust(e.target.value)} placeholder="Ex: Devolução de mercadoria" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setModalCredito(false); setCreditoValor(''); setCreditoJust('') }}>Cancelar</button>
              <button className="btn btn-success" style={{ flex: 2, justifyContent: 'center', padding: '11px' }}
                onClick={lancarCredito} disabled={salvandoCredito || !creditoValor || parseFloat(creditoValor) <= 0}>
                {salvandoCredito ? 'Salvando...' : '+ Lançar Crédito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
