// src/app/clientes/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

const BRL = (v: number) => v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? 'R$ 0,00'
const fmtData = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

function SummaryCard({ label, value, sub, alert, success }: any) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${alert ? 'rgba(239,107,77,0.25)' : success ? 'rgba(100,200,140,0.2)' : 'var(--border)'}`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10, color: alert ? '#ef6b4d' : success ? '#64c88c' : 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: alert ? '#ef6b4d' : '#f5ecd7', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function InfoRow({ label, value }: any) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(212,175,95,0.05)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 160, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#f5ecd7' }}>{value}</span>
    </div>
  )
}

function Section({ title, children }: any) {
  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#f5ecd7', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
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

  const { cliente, vendas, crediario, resumo } = data
  const c = editando ? form : cliente

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev: any) => ({ ...prev, [field]: e.target.value }))

  const vencido = crediario.filter((p: any) => new Date(p.data_vencimento) < new Date())

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
                background: 'linear-gradient(135deg, rgba(212,175,95,0.22), rgba(212,175,95,0.06))',
                border: '1px solid rgba(212,175,95,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#d4af5f',
              }}>
                {cliente.nome?.charAt(0)}
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#f5ecd7', lineHeight: 1 }}>
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
                <button className="btn btn-primary" onClick={() => setEditando(true)}>Editar</button>
              </>
            )}
          </div>
        </div>

        {/* RESUMO FINANCEIRO */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12 }}>
          <SummaryCard label="Total em Compras" value={BRL(resumo.totalCompras)} sub={`${resumo.qtdVendas} vendas`} success />
          <SummaryCard label="Em Aberto" value={BRL(resumo.totalAberto)} sub={`${crediario.length} parcelas`} />
          <SummaryCard label="Vencido" value={BRL(resumo.totalVencido)} sub={`${vencido.length} parcelas`} alert={resumo.totalVencido > 0} />
          <SummaryCard label="Limite de Crédito" value={BRL(cliente.limite_credito || 0)} />
          {cliente.credito_troca > 0 && <SummaryCard label="Crédito de Troca" value={BRL(cliente.credito_troca)} />}
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {[
            { id: 'dados', label: 'Dados Cadastrais' },
            { id: 'compras', label: `Compras (${vendas.length})` },
            { id: 'crediario', label: `Crediário (${crediario.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id as any)} style={{
              padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              background: aba === tab.id ? 'rgba(212,175,95,0.18)' : 'transparent',
              color: aba === tab.id ? '#d4af5f' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ABA: DADOS */}
        {aba === 'dados' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <Section title="Dados Pessoais">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['Nome completo', 'nome', 'text'],
                    ['Data de nascimento', 'data_nascimento', 'date'],
                    ['CPF', 'cpf', 'text'],
                    ['RG / Identidade', 'identidade', 'text'],
                    ['Naturalidade', 'naturalidade', 'text'],
                    ['Renda', 'renda', 'text'],
                  ].map(([label, field, type]) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input className="input" type={type} value={form[field] || ''} onChange={f(field)} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Estado civil</label>
                    <select className="input" value={form.estado_civil || ''} onChange={f('estado_civil')}>
                      <option value="">—</option>
                      {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow label="Nome" value={c.nome} />
                  <InfoRow label="Data de nascimento" value={c.data_nascimento ? fmtData(c.data_nascimento) : null} />
                  <InfoRow label="CPF" value={c.cpf} />
                  <InfoRow label="RG / Identidade" value={c.identidade} />
                  <InfoRow label="Estado civil" value={c.estado_civil} />
                  <InfoRow label="Cônjuge" value={c.conjuge} />
                  <InfoRow label="Naturalidade" value={c.naturalidade} />
                  <InfoRow label="Renda" value={c.renda} />
                </>
              )}
            </Section>

            <Section title="Contato">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['Celular', 'celular'], ['Telefone', 'telefone'],
                    ['WhatsApp', 'whatsapp'], ['Email', 'email'],
                    ['Rede social', 'rede_social'],
                  ].map(([label, field]) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input className="input" value={form[field] || ''} onChange={f(field)} />
                    </div>
                  ))}
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

            <Section title="Endereço">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['CEP', 'cep'], ['Endereço', 'endereco'], ['Número', 'numero'],
                    ['Complemento', 'complemento'], ['Bairro', 'bairro'],
                    ['Cidade', 'cidade'], ['Estado', 'estado'],
                  ].map(([label, field]) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input className="input" value={form[field] || ''} onChange={f(field)} />
                    </div>
                  ))}
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

            <Section title="Crédito & Perfil">
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Categoria</label>
                    <select className="input" value={form.categoria || ''} onChange={f('categoria')}>
                      <option value="">—</option>
                      {['Crediário', 'Avista', 'Pendente'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  {[
                    ['Limite de crédito (R$)', 'limite_credito'],
                    ['Desconto família (%)', 'desconto_familia'],
                    ['Tamanho', 'tamanho'], ['Tamanho 2', 'tamanho2'], ['Tamanho 3', 'tamanho3'],
                    ['Perfil', 'perfil'],
                  ].map(([label, field]) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input className="input" value={form[field] || ''} onChange={f(field)} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Observação</label>
                    <textarea className="input" rows={3} value={form.observacao || ''} onChange={f('observacao')} style={{ resize: 'vertical' }} />
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow label="Categoria" value={c.categoria} />
                  <InfoRow label="Limite de crédito" value={c.limite_credito ? BRL(c.limite_credito) : null} />
                  <InfoRow label="Desconto família" value={c.desconto_familia ? `${c.desconto_familia}%` : null} />
                  <InfoRow label="Tamanho" value={[c.tamanho, c.tamanho2, c.tamanho3].filter(Boolean).join(' / ')} />
                  <InfoRow label="Perfil" value={c.perfil} />
                  <InfoRow label="Observação" value={c.observacao} />
                </>
              )}
            </Section>

            <Section title="Trabalho">
              <InfoRow label="Empresa" value={c.trabalho_nome} />
              <InfoRow label="Cargo" value={c.trabalho_cargo} />
              <InfoRow label="Telefone" value={c.trabalho_telefone} />
              <InfoRow label="Tempo no emprego" value={c.trabalho_tempo} />
            </Section>

            <Section title="Referências">
              <InfoRow label="Ref. Comercial" value={c.ref_comercial} />
              <InfoRow label="Tel. Comercial" value={c.ref_comercial_tel} />
              <InfoRow label="Ref. Pessoal 1" value={c.ref_pessoal1} />
              <InfoRow label="Tel. Pessoal 1" value={c.ref_pessoal1_tel} />
              <InfoRow label="Ref. Pessoal 2" value={c.ref_pessoal2} />
              <InfoRow label="Filiação (Mãe)" value={c.filiacao_mae} />
              <InfoRow label="Tel. Mãe" value={c.filiacao_mae_tel} />
              <InfoRow label="Filiação (Pai)" value={c.filiacao_pai} />
              <InfoRow label="Autorizados" value={c.autorizados} />
            </Section>
          </div>
        )}

        {/* ABA: COMPRAS */}
        {aba === 'compras' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(212,175,95,0.03)' }}>
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
                  borderBottom: i < vendas.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
                  alignItems: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,95,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{v.codigo_legado || v.id}</div>
                <div style={{ fontSize: 13, color: '#f5ecd7' }}>{fmtData(v.data)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#d4af5f' }}>{BRL(v.valor_total)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.forma_pagamento || '—'}</div>
                <div style={{ fontSize: 11, color: v.situacao === 'Cancelada' ? '#ef6b4d' : '#64c88c' }}>{v.situacao}</div>
              </div>
            ))}
          </div>
        )}

        {/* ABA: CREDIÁRIO */}
        {aba === 'crediario' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(212,175,95,0.03)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 120px 120px 100px', gap: 12 }}>
                {['Parcela', 'Vencimento', 'Valor', 'Juros', 'Status'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: 'var(--gold-dim)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
            </div>
            {crediario.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma parcela em aberto</div>
            ) : crediario.map((p: any, i: number) => {
              const atrasado = new Date(p.data_vencimento) < new Date()
              return (
                <div key={p.id} style={{
                  display: 'grid', gridTemplateColumns: '80px 120px 120px 120px 100px',
                  gap: 12, padding: '13px 20px', alignItems: 'center',
                  borderBottom: i < crediario.length - 1 ? '1px solid rgba(212,175,95,0.05)' : 'none',
                  background: atrasado ? 'rgba(239,107,77,0.03)' : 'transparent',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.parcela || '—'}</div>
                  <div style={{ fontSize: 13, color: atrasado ? '#ef6b4d' : '#f5ecd7', fontWeight: atrasado ? 600 : 400 }}>
                    {fmtData(p.data_vencimento)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: atrasado ? '#ef6b4d' : '#d4af5f' }}>
                    {BRL(p.valor)}
                  </div>
                  <div style={{ fontSize: 13, color: p.juros > 0 ? '#f5a623' : 'var(--text-muted)' }}>
                    {p.juros > 0 ? BRL(p.juros) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: atrasado ? '#ef6b4d' : '#64c88c', fontWeight: 600 }}>
                    {atrasado ? 'VENCIDO' : 'EM ABERTO'}
                  </div>
                </div>
              )
            })}
            {crediario.length > 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total em aberto: <strong style={{ color: '#f5ecd7', fontFamily: 'var(--font-display)', fontSize: 15 }}>{BRL(resumo.totalAberto)}</strong>
                </span>
                {resumo.totalVencido > 0 && (
                  <span style={{ fontSize: 12, color: '#ef6b4d' }}>
                    Vencido: <strong style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{BRL(resumo.totalVencido)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
