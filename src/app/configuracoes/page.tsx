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
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#332F3A' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── PERMISSÕES AGRUPADAS ─────────────────────────────────
const GRUPOS_PERMISSOES = [
  {
    grupo: 'VENDAS',
    items: [
      { key: 'fazer_vendas',       label: 'Fazer Vendas (PDV)' },
      { key: 'cancelar_vendas',    label: 'Cancelar Venda' },
      { key: 'alterar_preco_pdv',  label: 'Alterar Preço no PDV' },
      { key: 'ver_vendas',         label: 'Ver Vendas' },
    ],
  },
  {
    grupo: 'CLIENTES',
    items: [
      { key: 'ver_clientes',   label: 'Ver Clientes' },
      { key: 'editar_clientes', label: 'Editar Clientes' },
      { key: 'ver_crediario',  label: 'Ver Crediário' },
    ],
  },
  {
    grupo: 'PRODUTOS',
    items: [
      { key: 'ver_produtos',    label: 'Ver Produtos' },
      { key: 'editar_produtos', label: 'Editar Produtos' },
    ],
  },
  {
    grupo: 'FINANCEIRO',
    items: [
      { key: 'ver_financeiro', label: 'Ver Financeiro' },
      { key: 'ver_compras',    label: 'Ver Compras' },
    ],
  },
  {
    grupo: 'RELATÓRIOS',
    items: [
      { key: 'ver_relatorios',         label: 'Ver Relatórios' },
      { key: 'ver_proprio_desempenho', label: 'Ver Próprio Desempenho' },
    ],
  },
  {
    grupo: 'SISTEMA',
    items: [
      { key: 'ver_dashboard',     label: 'Ver Dashboard' },
      { key: 'ver_whatsapp',      label: 'Ver WhatsApp' },
      { key: 'ver_configuracoes', label: 'Ver Configurações' },
      { key: 'fazer_trocas',      label: 'Registrar Troca' },
    ],
  },
]

// flat list for toggleAll
const TODAS_PERMISSOES = GRUPOS_PERMISSOES.flatMap(g => g.items)

// ─── MODAL NOVO USUÁRIO ───────────────────────────────────
function ModalNovoUsuario({ onClose, onSalvo }: any) {
  const [form, setForm] = useState({ nome: '', apelido: '', cargo: '', email: '', senha: '', perfil: 'funcionario', avatar_url: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleAvatarUpload(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const path = `avatares/${form.email || 'novo'}-${Date.now()}`
      const { error } = await supabase.storage.from('avatares').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatares').getPublicUrl(path)
      setForm(p => ({ ...p, avatar_url: data.publicUrl }))
    } catch (err: any) {
      setErro('Erro ao fazer upload da foto: ' + err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

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

  const labelStyle = { fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 5, fontWeight: 700 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 20, padding: '28px 32px', width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#332F3A', marginBottom: 20 }}>Novo Usuário</h3>

        {erro && <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.25)', borderRadius: 8, padding: '10px 14px', color: '#E5584A', fontSize: 13, marginBottom: 14 }}>{erro}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Nome completo */}
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={labelStyle}>Nome completo</label>
            <input type="text" className="input" value={form.nome} onChange={f('nome')} />
          </div>

          {/* Apelido */}
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={labelStyle}>Apelido (como quer ser chamada no sistema)</label>
            <input type="text" className="input" value={form.apelido} onChange={f('apelido')} placeholder="Ex: Mari, Ju, Duda..." />
          </div>

          {/* Cargo */}
          <div>
            <label style={labelStyle}>Cargo</label>
            <input type="text" className="input" value={form.cargo} onChange={f('cargo')} />
          </div>

          {/* Nível de acesso */}
          <div>
            <label style={labelStyle}>Nível de acesso</label>
            <select className="input" value={form.perfil} onChange={f('perfil')}>
              <option value="funcionario">Colaboradora</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {/* Email */}
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={labelStyle}>Email</label>
            <input type="email" className="input" value={form.email} onChange={f('email')} />
          </div>

          {/* Senha */}
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={labelStyle}>Senha inicial</label>
            <input type="password" className="input" value={form.senha} onChange={f('senha')} />
          </div>

          {/* Foto */}
          <div style={{ gridColumn: '1 / span 2' }}>
            <label style={labelStyle}>Foto (opcional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Avatar" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,76,0.3)' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.06))', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontWeight: 700, fontSize: 18 }}>
                  {form.nome?.charAt(0) || '?'}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} id="avatar-upload-modal" />
                <label htmlFor="avatar-upload-modal" className="btn btn-ghost" style={{ cursor: 'pointer', fontSize: 12, padding: '7px 14px', display: 'inline-block' }}>
                  {uploadingAvatar ? 'Enviando...' : 'Escolher foto'}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: '10px 14px', background: form.perfil === 'admin' ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${form.perfil === 'admin' ? 'rgba(201,168,76,0.2)' : 'var(--border)'}` }}>
          <div style={{ fontSize: 12, color: form.perfil === 'admin' ? '#C9A84C' : 'var(--text-muted)' }}>
            {form.perfil === 'admin'
              ? '⊛ Administrador — acesso completo a todos os módulos'
              : '◉ Colaboradora — acesso básico (vendas, clientes, produtos). Admin pode personalizar depois.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '11px' }} onClick={salvar} disabled={salvando || uploadingAvatar}>
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
  const [editando, setEditando] = useState(false)

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
    setEditando(false)
  }

  async function desativarAtivar() {
    const novoAtivo = !usuario.ativo
    await fetch(`/api/usuarios/${usuario.id || usuario.user_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: novoAtivo }),
    })
    onSalvo({ ...perms, ativo: novoAtivo })
  }

  function redefinirSenha() {
    alert('Feature em breve')
  }

  function toggleAll(val: boolean) {
    const update: any = {}
    TODAS_PERMISSOES.forEach(p => { update[p.key] = val })
    setPerms((prev: any) => ({ ...prev, ...update }))
  }

  const inicialNome = usuario.nome?.charAt(0) || '?'
  const isAdmin = perms.perfil === 'admin'
  const isAtivo = usuario.ativo !== false

  function formatUltimoAcesso(val: any) {
    if (!val) return 'nunca'
    try {
      return new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return 'nunca' }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', opacity: isAtivo ? 1 : 0.5 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: editando ? 16 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          {usuario.avatar_url ? (
            <img src={usuario.avatar_url} alt={usuario.nome} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${isAdmin ? 'rgba(201,168,76,0.4)' : 'var(--border)'}` }} />
          ) : (
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: isAdmin ? 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.06))' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isAdmin ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700,
              color: isAdmin ? '#C9A84C' : 'var(--text-secondary)', fontSize: 17, flexShrink: 0,
            }}>
              {inicialNome}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#332F3A', fontWeight: 600 }}>{usuario.nome}</span>
              <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: isAdmin ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.05)', color: isAdmin ? '#C9A84C' : 'var(--text-muted)' }}>
                {isAdmin ? 'Admin' : 'Colaboradora'}
              </span>
              {!isAtivo && <span style={{ padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(229,88,74,0.1)', color: '#E5584A' }}>Inativa</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {usuario.email} {usuario.cargo ? `· ${usuario.cargo}` : ''}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Último acesso: {formatUltimoAcesso(usuario.ultimo_acesso)}
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setEditando(e => !e)}>
            {editando ? '✕ Fechar' : 'Editar permissões'}
          </button>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={redefinirSenha}>
            Redefinir senha
          </button>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11, color: isAtivo ? '#E5584A' : '#4CAF82', borderColor: isAtivo ? 'rgba(229,88,74,0.25)' : 'rgba(76,175,130,0.25)' }} onClick={desativarAtivar}>
            {isAtivo ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>

      {/* Permissões — só mostra quando editando */}
      {editando && (
        <div style={{ marginTop: 4 }}>
          {isAdmin ? (
            <div style={{ fontSize: 12, color: '#C9A84C', padding: '10px 0' }}>
              ⊛ Administrador tem acesso completo a todos os módulos automaticamente.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => toggleAll(true)}>Tudo</button>
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => toggleAll(false)}>Nada</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {GRUPOS_PERMISSOES.map(grupo => (
                  <div key={grupo.grupo}>
                    <div style={{ fontSize: 9, color: 'var(--gold-dim)', letterSpacing: '0.12em', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                      {grupo.grupo}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                      {grupo.items.map(p => (
                        <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '7px 10px', borderRadius: 8, background: perms[p.key] ? 'rgba(201,168,76,0.06)' : 'transparent', transition: 'background 0.15s' }}>
                          <div
                            onClick={() => setPerms((prev: any) => ({ ...prev, [p.key]: !prev[p.key] }))}
                            style={{
                              width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                              background: perms[p.key] ? 'linear-gradient(135deg, #C9A84C, #a07830)' : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${perms[p.key] ? '#C9A84C' : 'var(--border)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}>
                            {perms[p.key] && <span style={{ fontSize: 11, color: '#080608', fontWeight: 900 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 12, color: perms[p.key] ? '#332F3A' : 'var(--text-muted)', transition: 'color 0.15s' }}>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button className="btn btn-primary" style={{ padding: '7px 20px', fontSize: 12 }} onClick={salvar} disabled={salvando}>
                  {salvo ? '✓ Salvo' : salvando ? '...' : 'Salvar permissões'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ABA METAS ────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function AbaMetas({ usuarios }: { usuarios: any[] }) {
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(hoje.getMonth() + 1)
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear())
  const [metas, setMetas] = useState<Record<string, number>>({})
  const [salvando, setSalvando] = useState<Record<string, boolean>>({})
  const [salvo, setSalvo] = useState<Record<string, boolean>>({})
  const [historico, setHistorico] = useState<any[]>([])

  // Navegar mês
  function navMes(dir: number) {
    let m = mesAtual + dir
    let a = anoAtual
    if (m < 1) { m = 12; a-- }
    if (m > 12) { m = 1; a++ }
    setMesAtual(m)
    setAnoAtual(a)
  }

  // Carregar metas do mês atual
  const carregarMetas = useCallback(async () => {
    try {
      const res = await fetch(`/api/metas?tipo=all&mes=${mesAtual}&ano=${anoAtual}`)
      if (!res.ok) return
      const data = await res.json()
      const map: Record<string, number> = {}
      if (Array.isArray(data.metas)) {
        data.metas.forEach((m: any) => {
          const key = m.tipo === 'global' ? 'global' : String(m.user_id)
          map[key] = Number(m.valor) || 0
        })
      }
      setMetas(map)
    } catch {}
  }, [mesAtual, anoAtual])

  // Carregar histórico (3 meses anteriores)
  const carregarHistorico = useCallback(async () => {
    const meses3: { mes: number; ano: number }[] = []
    let m = mesAtual - 1
    let a = anoAtual
    for (let i = 0; i < 3; i++) {
      if (m < 1) { m = 12; a-- }
      meses3.push({ mes: m, ano: a })
      m--
    }
    try {
      const results = await Promise.all(
        meses3.map(async ({ mes, ano }) => {
          const res = await fetch(`/api/metas?tipo=all&mes=${mes}&ano=${ano}`)
          if (!res.ok) return { mes, ano, metas: [] }
          const data = await res.json()
          return { mes, ano, metas: data.metas || [] }
        })
      )
      setHistorico(results)
    } catch {}
  }, [mesAtual, anoAtual])

  useEffect(() => {
    carregarMetas()
    carregarHistorico()
  }, [carregarMetas, carregarHistorico])

  async function salvarMeta(key: string, tipo: 'global' | 'individual', user_id: string | null) {
    setSalvando(p => ({ ...p, [key]: true }))
    try {
      await fetch('/api/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, user_id, mes: mesAtual, ano: anoAtual, valor: metas[key] || 0 }),
      })
      setSalvo(p => ({ ...p, [key]: true }))
      setTimeout(() => setSalvo(p => ({ ...p, [key]: false })), 2000)
    } catch {}
    setSalvando(p => ({ ...p, [key]: false }))
  }

  function formatBRL(val: number) {
    return val ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'
  }

  const inputMeta = (key: string) => (
    <input
      type="number"
      className="input"
      placeholder="0,00"
      value={metas[key] || ''}
      onChange={e => setMetas(p => ({ ...p, [key]: Number(e.target.value) }))}
      style={{ maxWidth: 180 }}
    />
  )

  const colaboradores = usuarios.filter(u => u.ativo !== false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>

      {/* Navegação mês/ano */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => navMes(-1)}>←</button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#332F3A', minWidth: 180, textAlign: 'center' }}>
          {MESES[mesAtual - 1]} {anoAtual}
        </span>
        <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => navMes(1)}>→</button>
      </div>

      {/* Meta Global */}
      <Section title="Meta Global do Mês" subtitle="Objetivo total de vendas da equipe">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <Campo label="Valor R$">
            {inputMeta('global')}
          </Campo>
          <button
            className="btn btn-primary"
            style={{ padding: '9px 20px', alignSelf: 'flex-end' }}
            onClick={() => salvarMeta('global', 'global', null)}
            disabled={salvando['global']}
          >
            {salvo['global'] ? '✓ Salvo' : salvando['global'] ? 'Salvando...' : 'Salvar Meta Global'}
          </button>
        </div>
      </Section>

      {/* Metas Individuais */}
      <Section title="Metas Individuais" subtitle="Objetivo de vendas por colaboradora">
        {colaboradores.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhuma colaboradora cadastrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {colaboradores.map(u => {
              const uid = String(u.user_id || u.id)
              return (
                <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  {/* Avatar */}
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.nome} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,76,0.2)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.06))', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#C9A84C', fontSize: 16, flexShrink: 0 }}>
                      {u.nome?.charAt(0)}
                    </div>
                  )}

                  {/* Nome e cargo */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#332F3A', fontWeight: 600 }}>{u.apelido || u.nome}</div>
                    {u.cargo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{u.cargo}</div>}
                  </div>

                  {/* Input + botão */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>R$</span>
                    <input
                      type="number"
                      className="input"
                      placeholder="0,00"
                      value={metas[uid] || ''}
                      onChange={e => setMetas(p => ({ ...p, [uid]: Number(e.target.value) }))}
                      style={{ width: 140 }}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '7px 16px', fontSize: 12 }}
                      onClick={() => salvarMeta(uid, 'individual', uid)}
                      disabled={salvando[uid]}
                    >
                      {salvo[uid] ? '✓' : salvando[uid] ? '...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Histórico */}
      {historico.length > 0 && (
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--gold-dim)', marginBottom: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Histórico — Últimos 3 meses
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {historico.map(({ mes, ano, metas: metasList }) => {
              const global = metasList.find((m: any) => m.tipo === 'global')
              const individuais = metasList.filter((m: any) => m.tipo === 'individual')
              return (
                <div key={`${mes}-${ano}`} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#332F3A', marginBottom: 10 }}>{MESES[mes - 1]} {ano}</div>
                  {global && (
                    <div style={{ fontSize: 12, color: '#C9A84C', marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Global: </span>
                      R$ {formatBRL(Number(global.valor))}
                    </div>
                  )}
                  {individuais.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {individuais.map((m: any) => {
                        const u = usuarios.find(uu => String(uu.user_id || uu.id) === String(m.user_id))
                        return (
                          <div key={m.user_id} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {u?.apelido || u?.nome || 'Colaboradora'}: R$ {formatBRL(Number(m.valor))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!global && individuais.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sem metas registradas</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CONFIGURAÇÕES PRINCIPAL ──────────────────────────────
export default function ConfiguracoesPage() {
  const [aba, setAba]             = useState<'empresa' | 'usuarios' | 'metas' | 'impressora' | 'conta'>('empresa')
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
  const [apelido, setApelido]     = useState('')

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
      setApelido(pRes?.apelido || '')
      setLoading(false)

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

  async function salvarApelido() {
    await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aba: 'conta', apelido }),
    })
    setSalvo('apelido')
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
    { id: 'metas',      label: 'Metas',         icon: '◎' },
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#332F3A' }}>Configurações</h1>
          <p style={{ color: 'var(--gold-dim)', fontSize: 13, marginTop: 4 }}>Empresa, usuários e preferências</p>
        </div>

        {/* ABAS */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {ABAS.map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id as any)} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              background: aba === tab.id ? 'rgba(201,168,76,0.18)' : 'transparent',
              color: aba === tab.id ? '#C9A84C' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}><span>{tab.icon}</span>{tab.label}</button>
          ))}
        </div>

        {salvo && (
          <div style={{ background: 'rgba(76,175,130,0.1)', border: '1px solid rgba(76,175,130,0.25)', borderRadius: 10, padding: '12px 16px', color: '#4CAF82', fontSize: 13 }}>
            ✓ {salvo === 'empresa' ? 'Dados da empresa salvos' : salvo === 'senha' ? 'Senha alterada com sucesso' : salvo === 'impressora' ? 'Impressora padrão salva' : salvo === 'apelido' ? 'Apelido salvo' : 'Salvo'}
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
                <div className="card" style={{ borderColor: 'rgba(232,148,58,0.2)' }}>
                  <p style={{ color: '#E8943A', fontSize: 13 }}>⚠ Apenas administradores podem gerenciar usuários e permissões.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {usuarios.filter(u => u.ativo !== false).map(u => (
                    <PainelPermissoes key={u.id || u.user_id} usuario={u} onSalvo={(updated: any) => {
                      setUsuarios(prev => prev.map(uu => (uu.id === u.id || uu.user_id === u.user_id) ? { ...uu, ...updated } : uu))
                    }} />
                  ))}
                  {/* Inativos */}
                  {usuarios.filter(u => u.ativo === false).length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Inativas</div>
                      {usuarios.filter(u => u.ativo === false).map(u => (
                        <PainelPermissoes key={u.id || u.user_id} usuario={u} onSalvo={(updated: any) => {
                          setUsuarios(prev => prev.map(uu => (uu.id === u.id || uu.user_id === u.user_id) ? { ...uu, ...updated } : uu))
                        }} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

          /* ── METAS ───────────────────────────────────── */
          ) : aba === 'metas' ? (
            <AbaMetas usuarios={usuarios} />

          /* ── IMPRESSORA ──────────────────────────────── */
          ) : aba === 'impressora' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
              <Section title="Configuração da Impressora" subtitle="Impressora térmica para recibos e comprovantes">

                <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(77,158,204,0.06)', border: '1px solid rgba(77,158,204,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, color: '#4D9ECC', fontWeight: 600, marginBottom: 6 }}>ℹ Requisito: QZ Tray</div>
                  <div style={{ fontSize: 12, color: 'rgba(242,235,217,0.6)', lineHeight: 1.6 }}>
                    Para imprimir diretamente na impressora térmica, o <strong style={{ color: '#332F3A' }}>QZ Tray</strong> precisa estar instalado e rodando neste computador.
                    <br />
                    <a href="https://qz.io/download" target="_blank" rel="noopener noreferrer" style={{ color: '#4D9ECC', marginTop: 4, display: 'inline-block' }}>
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
                  {perfil?.avatar_url ? (
                    <img src={perfil.avatar_url} alt={perfil?.nome} style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', border: '1px solid rgba(201,168,76,0.2)' }} />
                  ) : (
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: 'linear-gradient(135deg, rgba(201,168,76,0.22), rgba(201,168,76,0.06))',
                      border: '1px solid rgba(201,168,76,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#C9A84C',
                    }}>
                      {perfil?.nome?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 16, color: '#332F3A', fontWeight: 600 }}>{perfil?.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{perfil?.email}</div>
                    <div style={{ fontSize: 11, marginTop: 3 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: perfil?.perfil === 'admin' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.05)', color: perfil?.perfil === 'admin' ? '#C9A84C' : 'var(--text-muted)' }}>
                        {perfil?.perfil === 'admin' ? 'Administrador' : 'Colaboradora'}
                      </span>
                      {perfil?.cargo && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{perfil.cargo}</span>}
                    </div>
                  </div>
                </div>

                {/* Apelido */}
                <div style={{ marginTop: 4 }}>
                  <Campo label="Como quer ser chamada no sistema">
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text"
                        className="input"
                        value={apelido}
                        onChange={e => setApelido(e.target.value)}
                        placeholder="Ex: Mari, Ju, Duda..."
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-primary" style={{ padding: '9px 18px', flexShrink: 0 }} onClick={salvarApelido}>
                        Salvar
                      </button>
                    </div>
                  </Campo>
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
