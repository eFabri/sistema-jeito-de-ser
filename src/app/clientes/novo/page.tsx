// src/app/clientes/novo/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'

function Field({ label, children }: any) {
  return (
    <div>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Section({ title, children, cols = 2 }: any) {
  return (
    <div className="card">
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#F2EBD9', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

export default function NovoClientePage() {
  const router = useRouter()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    // Dados Pessoais
    nome: '', data_nascimento: '', cpf: '', identidade: '', estado_civil: '',
    // Família
    conjuge: '', conjuge_telefone: '', data_casamento: '',
    filho: '', filho_telefone: '',
    filiacao_mae: '', filiacao_mae_tel: '',
    filiacao_pai: '', filiacao_pai_tel: '',
    // Contato
    celular: '', telefone: '', whatsapp: '', email: '', rede_social: '',
    // Endereço
    cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: 'MG',
    // Trabalho
    trabalho_nome: '', trabalho_cargo: '', trabalho_telefone: '', renda: '', trabalho_tempo: '',
    // Crédito & Perfil
    categoria: 'Pendente', limite_credito: '', desconto_familia: '',
    tamanho: '', tamanho2: '', tamanho3: '', perfil: '',
    // Referências
    ref_comercial: '', ref_comercial_tel: '',
    ref_pessoal1: '', ref_pessoal1_tel: '',
    ref_pessoal2: '', ref_pessoal2_tel: '',
    // Observações
    observacao: '',
  })

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  async function salvar() {
    if (!form.nome.trim()) { setErro('O nome do cliente é obrigatório'); return }
    setSalvando(true)
    setErro('')
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        limite_credito: parseFloat(form.limite_credito) || 0,
        desconto_familia: parseFloat(form.desconto_familia) || 0,
        data_casamento: form.data_casamento || null,
        whatsapp_ativo: !!form.whatsapp,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/clientes/${data.id}`)
    } else {
      const err = await res.json()
      setErro(err.erro || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  const inp = (field: string, type = 'text', placeholder = '') => (
    <input className="input" type={type} placeholder={placeholder} value={(form as any)[field]} onChange={f(field)} />
  )

  return (
    <AppLayout>
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button onClick={() => router.push('/clientes')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>
              ‹ Clientes
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#F2EBD9' }}>Novo Cliente</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => router.push('/clientes')}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </div>

        {erro && (
          <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.25)', borderRadius: 10, padding: '12px 16px', color: '#E5584A', fontSize: 13 }}>
            {erro}
          </div>
        )}

        {/* DADOS PESSOAIS */}
        <Section title="Dados Pessoais">
          <Field label="Nome completo *">
            <input className="input" placeholder="Nome da cliente" value={form.nome} onChange={f('nome')}
              style={{ borderColor: !form.nome ? 'rgba(201,168,76,0.3)' : undefined }} />
          </Field>
          <Field label="Data de nascimento">{inp('data_nascimento', 'date')}</Field>
          <Field label="CPF">{inp('cpf', 'text', '000.000.000-00')}</Field>
          <Field label="RG / Identidade">{inp('identidade')}</Field>
          <Field label="Estado civil">
            <select className="input" value={form.estado_civil} onChange={f('estado_civil')}>
              <option value="">—</option>
              {['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </Section>

        {/* FAMÍLIA */}
        <Section title="Família" cols={2}>
          <Field label="Cônjuge">{inp('conjuge')}</Field>
          <Field label="Tel. do cônjuge">{inp('conjuge_telefone', 'tel')}</Field>
          <Field label="Data do casamento">{inp('data_casamento', 'date')}</Field>
          <div />
          <Field label="Filho(a)">{inp('filho')}</Field>
          <Field label="Tel. do filho(a)">{inp('filho_telefone', 'tel')}</Field>
          <Field label="Filiação (Mãe)">{inp('filiacao_mae')}</Field>
          <Field label="Tel. da mãe">{inp('filiacao_mae_tel', 'tel')}</Field>
          <Field label="Filiação (Pai)">{inp('filiacao_pai')}</Field>
          <Field label="Tel. do pai">{inp('filiacao_pai_tel', 'tel')}</Field>
        </Section>

        {/* ENDEREÇO */}
        <Section title="Endereço" cols={3}>
          <Field label="CEP">{inp('cep', 'text', '00000-000')}</Field>
          <div style={{ gridColumn: '2 / span 2' }}>
            <Field label="Endereço">{inp('endereco', 'text', 'Rua, Avenida...')}</Field>
          </div>
          <Field label="Número">{inp('numero')}</Field>
          <Field label="Complemento">{inp('complemento')}</Field>
          <Field label="Bairro">{inp('bairro')}</Field>
          <Field label="Cidade">{inp('cidade')}</Field>
          <Field label="Estado">
            <select className="input" value={form.estado} onChange={f('estado')}>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </Field>
        </Section>

        {/* CONTATO */}
        <Section title="Contato">
          <Field label="Celular">{inp('celular', 'tel', '(31) 9 0000-0000')}</Field>
          <Field label="Telefone">{inp('telefone', 'tel')}</Field>
          <Field label="WhatsApp">{inp('whatsapp', 'tel', '(31) 9 0000-0000')}</Field>
          <Field label="Email">{inp('email', 'email')}</Field>
          <Field label="Rede social">{inp('rede_social', 'text', '@usuario')}</Field>
        </Section>

        {/* TRABALHO */}
        <Section title="Trabalho">
          <Field label="Empresa">{inp('trabalho_nome')}</Field>
          <Field label="Cargo">{inp('trabalho_cargo')}</Field>
          <Field label="Tel. do trabalho">{inp('trabalho_telefone', 'tel')}</Field>
          <Field label="Renda mensal">{inp('renda', 'text', 'Ex: R$ 2.000,00')}</Field>
          <Field label="Tempo no emprego">{inp('trabalho_tempo', 'text', 'Ex: 3 anos')}</Field>
        </Section>

        {/* CRÉDITO & PERFIL */}
        <Section title="Crédito & Perfil">
          <Field label="Categoria">
            <select className="input" value={form.categoria} onChange={f('categoria')}>
              {['Pendente', 'Crediário', 'Avista'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Limite de crédito (R$)">{inp('limite_credito', 'number', '0,00')}</Field>
          <Field label="Desconto família (%)">{inp('desconto_familia', 'number', '0')}</Field>
          <Field label="Tamanho (roupa)">{inp('tamanho', 'text', 'P, M, G, 38...')}</Field>
          <Field label="Tamanho 2">{inp('tamanho2')}</Field>
          <Field label="Tamanho 3">{inp('tamanho3')}</Field>
          <Field label="Perfil / Estilo">{inp('perfil', 'text', 'Moda jovem, clássica...')}</Field>
        </Section>

        {/* REFERÊNCIAS */}
        <Section title="Referências">
          <Field label="Ref. comercial">{inp('ref_comercial')}</Field>
          <Field label="Tel. comercial">{inp('ref_comercial_tel', 'tel')}</Field>
          <Field label="Ref. pessoal 1">{inp('ref_pessoal1')}</Field>
          <Field label="Tel. pessoal 1">{inp('ref_pessoal1_tel', 'tel')}</Field>
          <Field label="Ref. pessoal 2">{inp('ref_pessoal2')}</Field>
          <Field label="Tel. pessoal 2">{inp('ref_pessoal2_tel', 'tel')}</Field>
        </Section>

        {/* OBSERVAÇÕES */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#F2EBD9', marginBottom: 12 }}>Observações</h3>
          <textarea className="input" rows={4} placeholder="Anotações sobre a cliente..." value={form.observacao} onChange={f('observacao')} style={{ resize: 'vertical' }} />
        </div>

        {/* BOTÕES FINAIS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 32 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/clientes')}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{ padding: '10px 28px' }}>
            {salvando ? 'Salvando...' : '✓ Salvar Cliente'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
