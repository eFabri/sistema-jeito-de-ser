// src/app/configuracoes/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { listarImpressoras } from '@/lib/impressora'

// ─── HELPERS ─────────────────────────────────────────────
function Campo({ label, children, span = 1 }: any) {
  return (
    <div style={span > 1 ? { gridColumn: `span ${span}` } : {}}>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  )
}

function Section({ title, subtitle, children }: any) {
  return (
    <div className="card">
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#f5ecd7' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const PERMISSOES = [
  { key: 'ver_dashboard',     label: 'Ver Dashboard' },
  { key: 'ver_vendas',        label: 'Ver Vendas' },
  { key: 'fazer_vendas',      label: 'Fazer Vendas (PDV)' },
  { key: 'ver_clientes',      label: 'Ver Clientes' },
  { key: 'editar_clientes',   label: 'Editar Clientes' },
  { key: 'ver_produtos',      label: 'Ver Produtos' },
  { key: 'editar_produtos',   label: 'Editar Produtos' },
  { key: 'ver_financeiro',    label: 'Ver Financeiro' },
  { key: 'ver_compras',       label: 'Ver Compras' },
  { key: 'ver_relatorios',    label: 'Ver Relatórios' },
  { key: 'ver_whatsapp',      label: 'Ver WhatsApp' },
  { key: 'ver_configuracoes', label: 'Ver Configurações' },
]

// ─── MODAL NOVO USUÁRIO ───────────────────────────────────
function ModalNovoUsuario({ onClose, onSalvo }: any) {
  const [form, setForm] = useState({ nome: '', cargo: '', email: '', senha: '', perfil: 'funcionario' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function salvar() {
    if (!form.nome || !form.email || !form.senha) { setErro('Nome, email e senha são obrigatórios'); return }
    if (form.senha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres'); return }
    setSalvando(true); setErro('')
    const res = await fetch('/api/configuracoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { onSalvo(await res.json()) }
    else { const e = await res.json(); setErro(e.erro || 'Erro ao criar usuário'); setSalvando(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#131109', border: '1px solid var(--border-strong)', borderRadius: 20, padding: '28px 32px', width: 460 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#f5ecd7', marginBottom: 20 }}>Novo Usuário</h3>

        {erro && <div style={{ background: 'rgba(239,107,77,0.1)', border: '1px solid rgba(239,107,77,0.25)', borderRadius: 8, padding: '10px 14px', color: '#ef6b4d', fontSize: 13, marginBottom: 14 }}>{erro}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            ['Nome completo', 'nome', 'text', '1 / span 2'],
            ['Cargo', 'cargo', 'text', ''],
            ['Nível de acesso', '', '', ''],
            ['Email', 'email', 'email', '1 / span 2'],
            ['Senha inicial', 'senha', 'password', '1 / span 2'],
          ].map(([label, key, type, col]) => key ? (
            <div key={key} style={col ? { gridColumn: col } : {}}>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
              <input type={type || 'text'} className="input" value={(form as any)[key]} onChange={f(key)} />
            </div>
          ) : (
            <div key={label}>
              <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
              <select className="input" value={form.perfil} onChange={f('perfil')}>
                <option value="funcionario">Funcionário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, padding: '10px 14px', background: form.perfil === 'admin' ? 'rgba(212,175,95,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${form.perfil === 'admin' ? 'rgba(212,175,95,0.2)' : 'var(--border)'}` }}>
          <div style={{ fontSize: 12, color: form.perfil === 'admin' ? '#d4af5f' : 'var(--text-muted)' }}>
            {form.perfil === 'admin'
              ? '⊛ Administrador — acesso completo a todos os módulos'
              : '◉ Funcionário — acesso básico (vendas, clientes, produtos). Admin pode personalizar depois.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '11px' }} onClick={salvar} disabled={salvando}>
            {salvando ? 'Criando...' : '✓ Criar Usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PAINEL DE PERMISSÕES ─────────────────────────────────
function PainelPermissoes({ usuario, onSalvo }: any) {
  const [perms, setPerms] = useState({ ...usuario })
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  async function salvar() {
    setSalvando(true)
    await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aba: 'usuario', id: usuario.id, ...perms }),
    })
    setSalvando(false); setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
    onSalvo(perms)
  }

  function toggleAll(val: boolean) {
    const update: any = {}
    PERMISSOES.forEach(p => { update[p.key] = val })
    setPerms((prev: any) => ({ ...prev, ...update }))
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: perms.perfil === 'admin' ? 'linear-gradient(135deg, rgba(212,175,95,0.25), rgba(212,175,95,0.06))' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${perms.perfil === 'admin' ? 'rgba(212,175,95,0.3)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700,
            color: perms.perfil === 'admin' ? '#d4af5f' : 'var(--text-secondary)', fontSize: 16,
          }}>
            {usuario.nome?.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#f5ecd7', fontWeight: 600 }}>{usuario.nome}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {usuario.email} · {usuario.cargo || '—'}
              <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: usuario.perfil === 'admin' ? 'rgba(212,175,95,0.12)' : 'rgba(255,255,255,0.05)', color: usuario.perfil === 'admin' ? '#d4af5f' : 'var(--text-muted)' }}>
                {usuario.perfil === 'admin' ? 'Admin' : 'Funcionário'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => toggleAll(true)}>Tudo</button>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => toggleAll(false)}>Nada</button>
          <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 11 }} onClick={salvar} disabled={salvando}>
            {salvo ? '✓ Salvo' : salvando ? '...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Admin sempre tem tudo */}
      {usuario.perfil === 'admin' ? (
        <div style={{ fontSize: 12, color: '#d4af5f', padding: '10px 0' }}>
          ⊛ Administrador tem acesso completo a todos os módulos automaticamente.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {PERMISSOES.map(p => (
            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '7px 10px', borderRadius: 8, background: perms[p.key] ? 'rgba(212,175,95,0.06)' : 'transparent', transition: 'background 0.15s' }}>
              <div
                onClick={() => setPerms((prev: any) => ({ ...prev, [p.key]: !prev[p.key] }))}
                style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                  background: perms[p.key] ? 'linear-gradient(135deg, #d4af5f, #a07830)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${perms[p.key] ? '#d4af5f' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                {perms[p.key] && <span style={{ fontSize: 11, color: '#0e0c09', fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: perms[p.key] ? '#f5ecd7' : 'var(--text-muted)', transition: 'color 0.15s' }}>{p.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CONFIGURAÇÕES PRINCIPAL ──────────────────────────────
export default function ConfiguracoesPage() {
  const [aba, setAba]             = useState<'empresa' | 'usuarios' | 'impressora' | 'conta'>('empresa')
  const [empresa, setEmpresa]     = useState<any>({})
  const [usuarios, setUsuarios]   = useState<any[]>([])
  const [impressoras, setImpressoras] = useState<string[]>([])
  const [impressoraSel, setImpressoraSel] = useState('')
  const [loading, setLoading]     = useState(true)
  const [salvando, setSalvando]   = useState(false)
  const [salvo, setSalvo]         = useState('')
  const [modalUsuario, setModalUsuario] = useState(false)
  const [perfil, setPerfil]       = useState<any>(null)
  const [senha, setSenha]         = useState({ atual: '', nova: '', confirma: '' })

  useEffect(() => {
    async function init() {
      const [empRes, usrRes, pRes] = await Promise.all([
        fetch('/api/configuracoes?aba=empresa').then(r => r.json()),
        fetch('/api/configuracoes?aba=usuarios').then(r => r.json()),
        fetch('/api/perfil').then(r => r.json()),
      ])
      setEmpresa(empRes.empresa || {})
      setUsuarios(usrRes.usuarios || [])
      setPerfil(pRes)
      setLoading(false)

      // Carregar impressoras em background
      listarImpressoras().then(lista => {
        setImpressoras(lista)
        const salva = localStorage.getItem('impressora_padrao')
        if (salva) setImpressoraSel(salva)
        else if (lista.length > 0) setImpressoraSel(lista[0])
      }).catch(() => {})
    }
    init()
  }, [])

  async function salvarEmpresa() {
    setSalvando(true)
    await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aba: 'empresa', ...empresa }),
    })
    setSalvando(false); setSalvo('empresa')
    setTimeout(() => setSalvo(''), 2500)
  }

  async function alterarSenha() {
    if (senha.nova !== senha.confirma) { alert('As senhas não coincidem'); return }
    if (senha.nova.length < 6) { alert('Senha deve ter pelo menos 6 caracteres'); return }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha.nova })
    if (error) { alert('Erro: ' + error.message); return }
    setSenha({ atual: '', nova: '', confirma: '' })
    setSalvo('senha')
    setTimeout(() => setSalvo(''), 2500)
  }

  function salvarImpressora() {
    localStorage.setItem('impressora_padrao', impressoraSel)
    setSalvo('impressora')
    setTimeout(() => setSalvo(''), 2500)
  }

  const fe = (k: string) => (e: any) => setEmpresa((p: any) => ({ ...p, [k]: e.target.value }))

  const ABAS = [
    { id: 'empresa',    label: 'Minha Empresa', icon: '◈' },
    { id: 'usuarios',   label: 'Usuários',      icon: '◉' },
    { id: 'impressora', label: 'Impressora',    icon: '◫' },
    { id: 'conta',      label: 'Minha Conta',   icon: '⊛' },
  ]

  return (
    <AppLayout>
      {modalUsuario && (
        <ModalNovoUsuario
          onClose={() => setModalUsuario(false)}
          onSalvo={(u: any) => { setUsuarios(prev => [...prev, u]); setModalUsuario(false) }}
        />
      )}

      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* HEADER */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#f5ecd7' }}>Configurações</h1>
          <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>Empresa, usuários e preferências</p>
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {ABAS.map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id as any)} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              background: aba === tab.id ? 'rgba(212,175,95,0.18)' : 'transparent',
              color: aba === tab.id ? '#d4af5f' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}><span>{tab.icon}</span>{tab.label}</button>
          ))}
        </div>

        {salvo && (
          <div style={{ background: 'rgba(100,200,140,0.1)', border: '1px solid rgba(100,200,140,0.25)', borderRadius: 10, padding: '12px 16px', color: '#64c88c', fontSize: 13 }}>
            ✓ {salvo === 'empresa' ? 'Dados da empresa salvos' : salvo === 'senha' ? 'Senha alterada com sucesso' : salvo === 'impressora' ? 'Impressora padrão salva' : 'Salvo'}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)' }}>Carregando...</div>
        ) : (

          /* ── EMPRESA ──────────────────────────────────── */
          aba === 'empresa' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
              <Section title="Dados da Empresa" subtitle="Informações que aparecem nos recibos e documentos">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  <Campo label="Razão Social" span={2}><input className="input" value={empresa.nome || ''} onChange={fe('nome')} /></Campo>
                  <Campo label="CNPJ"><input className="input" value={empresa.cnpj || ''} onChange={fe('cnpj')} placeholder="00.000.000/0001-00" /></Campo>
                  <Campo label="Insc. Estadual"><input className="input" value={empresa.inscricao_estadual || ''} onChange={fe('inscricao_estadual')} /></Campo>
                  <Campo label="Insc. Municipal"><input className="input" value={empresa.inscricao_municipal || ''} onChange={fe('inscricao_municipal')} /></Campo>
                  <Campo label="Telefone Comercial"><input className="input" value={empresa.fone_comercial || ''} onChange={fe('fone_comercial')} /></Campo>
                  <Campo label="Email" span={2}><input className="input" type="email" value={empresa.email || ''} onChange={fe('email')} /></Campo>
                  <Campo label="Site / Redes Sociais" span={2}><input className="input" value={empresa.site || ''} onChange={fe('site')} /></Campo>
                </div>
              </Section>

              <Section title="Endereço">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  <Campo label="CEP"><input className="input" value={empresa.cep || ''} onChange={fe('cep')} /></Campo>
                  <Campo label="Endereço" span={2}><input className="input" value={empresa.endereco || ''} onChange={fe('endereco')} /></Campo>
                  <Campo label="Número"><input className="input" value={empresa.numero || ''} onChange={fe('numero')} /></Campo>
                  <Campo label="Bairro"><input className="input" value={empresa.bairro || ''} onChange={fe('bairro')} /></Campo>
                  <Campo label="Complemento"><input className="input" value={empresa.complemento || ''} onChange={fe('complemento')} /></Campo>
                  <Campo label="Cidade"><input className="input" value={empresa.cidade || ''} onChange={fe('cidade')} /></Campo>
                  <Campo label="UF">
                    <select className="input" value={empresa.uf || ''} onChange={fe('uf')}>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf}>{uf}</option>)}
                    </select>
                  </Campo>
                </div>
              </Section>

              <Section title="Dados Bancários" subtitle="Usado em documentos e comprovantes">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  <Campo label="Banco"><input className="input" value={empresa.banco || ''} onChange={fe('banco')} /></Campo>
                  <Campo label="Agência"><input className="input" value={empresa.agencia || ''} onChange={fe('agencia')} /></Campo>
                  <Campo label="Conta Corrente"><input className="input" value={empresa.conta_corrente || ''} onChange={fe('conta_corrente')} /></Campo>
                </div>
              </Section>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={salvarEmpresa} disabled={salvando} style={{ padding: '10px 28px' }}>
                  {salvando ? 'Salvando...' : '✓ Salvar Dados'}
                </button>
              </div>
            </div>

          /* ── USUÁRIOS ────────────────────────────────── */
          ) : aba === 'usuarios' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}
                </p>
                {perfil?.perfil === 'admin' && (
                  <button className="btn btn-primary" onClick={() => setModalUsuario(true)}>+ Novo Usuário</button>
                )}
              </div>

              {perfil?.perfil !== 'admin' ? (
                <div className="card" style={{ borderColor: 'rgba(245,166,35,0.2)' }}>
                  <p style={{ color: '#f5a623', fontSize: 13 }}>⚠ Apenas administradores podem gerenciar usuários e permissões.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {usuarios.filter(u => u.ativo !== false).map(u => (
                    <PainelPermissoes key={u.id} usuario={u} onSalvo={(updated: any) => {
                      setUsuarios(prev => prev.map(uu => uu.id === u.id ? { ...uu, ...updated } : uu))
                    }} />
                  ))}
                </div>
              )}
            </div>

          /* ── IMPRESSORA ──────────────────────────────── */
          ) : aba === 'impressora' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
              <Section title="Configuração da Impressora" subtitle="Impressora térmica para recibos e comprovantes">

                <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(94,170,223,0.06)', border: '1px solid rgba(94,170,223,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, color: '#5eaadf', fontWeight: 600, marginBottom: 6 }}>ℹ Requisito: QZ Tray</div>
                  <div style={{ fontSize: 12, color: 'rgba(245,236,215,0.6)', lineHeight: 1.6 }}>
                    Para imprimir diretamente na impressora térmica, o <strong style={{ color: '#f5ecd7' }}>QZ Tray</strong> precisa estar instalado e rodando neste computador.
                    <br />
                    <a href="https://qz.io/download" target="_blank" rel="noopener noreferrer" style={{ color: '#5eaadf', marginTop: 4, display: 'inline-block' }}>
                      Baixar QZ Tray gratuitamente →
                    </a>
                  </div>
                </div>

                <Campo label="Impressora padrão">
                  {impressoras.length > 0 ? (
                    <select className="input" value={impressoraSel} onChange={e => setImpressoraSel(e.target.value)}>
                      {impressoras.map(imp => <option key={imp} value={imp}>{imp}</option>)}
                    </select>
                  ) : (
                    <div>
                      <input className="input" value={impressoraSel} onChange={e => setImpressoraSel(e.target.value)}
                        placeholder="Ex: EPSON TM-T20, Bematech MP-4200..." />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                        QZ Tray não detectado. Digite o nome exato da impressora ou instale o QZ Tray para detecção automática.
                      </div>
                    </div>
                  )}
                </Campo>

                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" onClick={async () => {
                    const lista = await listarImpressoras()
                    setImpressoras(lista)
                    if (lista.length > 0 && !impressoraSel) setImpressoraSel(lista[0])
                  }}>
                    ↺ Detectar impressoras
                  </button>
                  <button className="btn btn-primary" onClick={salvarImpressora} style={{ padding: '9px 20px' }}>
                    ✓ Salvar
                  </button>
                </div>
              </Section>

              <Section title="Teste de Impressão" subtitle="Verifique se a impressora está funcionando">
                <button className="btn btn-ghost" onClick={async () => {
                  const { imprimirRecibo } = await import('@/lib/impressora')
                  imprimirRecibo({
                    empresa: 'Jeito de Ser Ltda.',
                    nomeCliente: 'TESTE DE IMPRESSÃO',
                    codVenda: '0000',
                    data: new Date().toLocaleDateString('pt-BR'),
                    itens: [
                      { produto: 'PRODUTO TESTE', quantidade: 1, preco: 99.90, subtotal: 99.90 },
                    ],
                    pagamentos: [{ forma: 'Dinheiro', valor: 99.90 }],
                    valorTotal: 99.90,
                  }, impressoraSel || undefined)
                }}>
                  🖨 Imprimir recibo de teste
                </button>
              </Section>
            </div>

          /* ── MINHA CONTA ────────────────────────────── */
          ) : aba === 'conta' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500 }}>
              <Section title="Minha Conta" subtitle="Suas informações de acesso">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(212,175,95,0.22), rgba(212,175,95,0.06))',
                    border: '1px solid rgba(212,175,95,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#d4af5f',
                  }}>
                    {perfil?.nome?.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, color: '#f5ecd7', fontWeight: 600 }}>{perfil?.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{perfil?.email}</div>
                    <div style={{ fontSize: 11, marginTop: 3 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: perfil?.perfil === 'admin' ? 'rgba(212,175,95,0.12)' : 'rgba(255,255,255,0.05)', color: perfil?.perfil === 'admin' ? '#d4af5f' : 'var(--text-muted)' }}>
                        {perfil?.perfil === 'admin' ? 'Administrador' : 'Funcionário'}
                      </span>
                      {perfil?.cargo && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{perfil.cargo}</span>}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Alterar Senha">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    ['Nova senha', 'nova'],
                    ['Confirmar nova senha', 'confirma'],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>{label}</label>
                      <input type="password" className="input"
                        value={(senha as any)[key]}
                        onChange={e => setSenha(p => ({ ...p, [key]: e.target.value }))}
                        placeholder="••••••••"
                      />
                    </div>
                  ))}
                  <button className="btn btn-primary" onClick={alterarSenha}
                    disabled={!senha.nova || !senha.confirma}
                    style={{ alignSelf: 'flex-start', padding: '9px 22px' }}>
                    Alterar Senha
                  </button>
                </div>
              </Section>
            </div>
          ) : null
        )}
      </div>
    </AppLayout>
  )
}
