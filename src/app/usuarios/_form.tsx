// src/app/usuarios/_form.tsx — formulário compartilhado entre criar e editar
'use client'
import { useState } from 'react'

export interface DadosUsuario {
  id?: string
  email?: string
  senha?: string
  nome: string
  cargo: string
  perfil: 'admin' | 'funcionario'
  ativo: boolean
  ver_dashboard: boolean
  ver_vendas: boolean
  fazer_vendas: boolean
  ver_clientes: boolean
  editar_clientes: boolean
  ver_produtos: boolean
  editar_produtos: boolean
  ver_financeiro: boolean
  ver_compras: boolean
  ver_relatorios: boolean
  ver_whatsapp: boolean
  ver_configuracoes: boolean
}

export const PERMISSOES = [
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
] as const

export function defaultsUsuario(): DadosUsuario {
  return {
    nome: '', cargo: '', perfil: 'funcionario', ativo: true,
    ver_dashboard: true, ver_vendas: true, fazer_vendas: true,
    ver_clientes: true, editar_clientes: false,
    ver_produtos: true, editar_produtos: false,
    ver_financeiro: false, ver_compras: false,
    ver_relatorios: false, ver_whatsapp: false, ver_configuracoes: false,
  }
}

interface Props {
  inicial: DadosUsuario
  modo: 'novo' | 'editar'
  onSalvar: (dados: DadosUsuario) => Promise<void>
  onDeletar?: () => Promise<void>
}

export default function FormUsuario({ inicial, modo, onSalvar, onDeletar }: Props) {
  const [dados, setDados] = useState<DadosUsuario>(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function set<K extends keyof DadosUsuario>(k: K, v: DadosUsuario[K]) {
    setDados(d => ({ ...d, [k]: v }))
  }

  // Admin sempre tem todas as permissões
  function setPerfil(p: 'admin' | 'funcionario') {
    if (p === 'admin') {
      const todas = PERMISSOES.reduce((acc, x) => ({ ...acc, [x.key]: true }), {})
      setDados(d => ({ ...d, perfil: p, ...todas }))
    } else {
      setDados(d => ({ ...d, perfil: p }))
    }
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (modo === 'novo' && (!dados.email || !dados.senha)) {
      setErro('Email e senha são obrigatórios')
      return
    }
    setSalvando(true)
    try {
      await onSalvar(dados)
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={submeter} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {erro && (
        <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.3)', color: '#E5584A', padding: 12, borderRadius: 8, fontSize: 13 }}>
          {erro}
        </div>
      )}

      {/* DADOS BÁSICOS */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>
          Dados de Acesso
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Campo label="Email">
            <input
              className="input"
              type="email"
              value={dados.email || ''}
              onChange={e => set('email', e.target.value)}
              disabled={modo === 'editar'}
              placeholder="email@exemplo.com"
            />
          </Campo>
          <Campo label={modo === 'novo' ? 'Senha (≥ 6 caracteres)' : 'Nova senha (opcional)'}>
            <input
              className="input"
              type="password"
              value={dados.senha || ''}
              onChange={e => set('senha', e.target.value)}
              placeholder={modo === 'editar' ? 'Deixe em branco para manter' : ''}
              autoComplete="new-password"
            />
          </Campo>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>
          Identificação
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Campo label="Nome">
            <input className="input" value={dados.nome} onChange={e => set('nome', e.target.value)} required />
          </Campo>
          <Campo label="Cargo">
            <input className="input" value={dados.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Vendedora, Gerente..." />
          </Campo>
          <Campo label="Perfil">
            <select className="input" value={dados.perfil} onChange={e => setPerfil(e.target.value as any)}>
              <option value="funcionario">Funcionário(a)</option>
              <option value="admin">Administrador</option>
            </select>
          </Campo>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#F2EBD9' }}>
            <input type="checkbox" checked={dados.ativo} onChange={e => set('ativo', e.target.checked)} />
            Usuário ativo (pode fazer login)
          </label>
        </div>
      </div>

      {/* PERMISSÕES */}
      <div className="card" style={{ padding: 24, opacity: dados.perfil === 'admin' ? 0.5 : 1 }}>
        <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          Permissões
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          {dados.perfil === 'admin'
            ? 'Administradores têm acesso a tudo automaticamente.'
            : 'Marque apenas o que esse usuário pode acessar.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {PERMISSOES.map(p => (
            <label key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)',
              cursor: dados.perfil === 'admin' ? 'not-allowed' : 'pointer',
              fontSize: 12, color: '#F2EBD9',
            }}>
              <input
                type="checkbox"
                checked={dados[p.key] as boolean}
                onChange={e => set(p.key as any, e.target.checked as any)}
                disabled={dados.perfil === 'admin'}
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {/* AÇÕES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {modo === 'editar' && onDeletar ? (
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Deletar este usuário? Esta ação não pode ser desfeita.')) return
              try { await onDeletar() } catch (e: any) { setErro(e.message) }
            }}
            style={{
              background: 'rgba(229,88,74,0.08)',
              border: '1px solid rgba(229,88,74,0.3)',
              color: '#E5584A',
              padding: '10px 18px', borderRadius: 8,
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Deletar Usuário
          </button>
        ) : <div />}
        <button type="submit" className="btn btn-primary" disabled={salvando}>
          {salvando ? 'Salvando...' : modo === 'novo' ? 'Criar Usuário' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 700 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
