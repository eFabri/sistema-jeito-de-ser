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
  cancelar_vendas: boolean
  aplicar_desconto: boolean
  ver_clientes: boolean
  editar_clientes: boolean
  ver_crediario: boolean
  ver_produtos: boolean
  editar_produtos: boolean
  ver_trocas: boolean
  ver_financeiro: boolean
  ver_compras: boolean
  ver_relatorios: boolean
  ver_whatsapp: boolean
  ver_configuracoes: boolean
}

type PermKey = keyof Omit<DadosUsuario, 'id' | 'email' | 'senha' | 'nome' | 'cargo' | 'perfil' | 'ativo'>

const GRUPOS_PERMISSOES: { titulo: string; itens: { key: PermKey; label: string }[] }[] = [
  {
    titulo: 'Vendas',
    itens: [
      { key: 'ver_vendas',        label: 'Ver vendas' },
      { key: 'fazer_vendas',      label: 'Registrar venda' },
      { key: 'cancelar_vendas',   label: 'Cancelar venda' },
      { key: 'aplicar_desconto',  label: 'Aplicar desconto' },
    ],
  },
  {
    titulo: 'Clientes',
    itens: [
      { key: 'ver_clientes',    label: 'Ver clientes' },
      { key: 'editar_clientes', label: 'Cadastrar / editar clientes' },
      { key: 'ver_crediario',   label: 'Ver crediário' },
    ],
  },
  {
    titulo: 'Produtos',
    itens: [
      { key: 'ver_produtos',    label: 'Ver produtos' },
      { key: 'editar_produtos', label: 'Cadastrar / editar produtos' },
    ],
  },
  {
    titulo: 'Trocas',
    itens: [
      { key: 'ver_trocas', label: 'Registrar trocas' },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { key: 'ver_financeiro', label: 'Ver financeiro' },
      { key: 'ver_compras',    label: 'Ver compras' },
    ],
  },
  {
    titulo: 'Relatórios',
    itens: [{ key: 'ver_relatorios', label: 'Ver relatórios' }],
  },
  {
    titulo: 'WhatsApp',
    itens: [{ key: 'ver_whatsapp', label: 'Ver WhatsApp' }],
  },
  {
    titulo: 'Configurações',
    itens: [{ key: 'ver_configuracoes', label: 'Ver configurações' }],
  },
]

// Lista plana para compatibilidade com código existente
export const PERMISSOES = GRUPOS_PERMISSOES.flatMap(g => g.itens)

function todasPermissoes(valor: boolean): Partial<DadosUsuario> {
  return PERMISSOES.reduce((acc, p) => ({ ...acc, [p.key]: valor }), {})
}

export function defaultsUsuario(): DadosUsuario {
  return {
    nome: '', cargo: '', perfil: 'funcionario', ativo: true,
    ver_dashboard: true, ver_vendas: true, fazer_vendas: true,
    cancelar_vendas: true, aplicar_desconto: true,
    ver_clientes: true, editar_clientes: true, ver_crediario: true,
    ver_produtos: true, editar_produtos: true,
    ver_trocas: true,
    ver_financeiro: true, ver_compras: true,
    ver_relatorios: true, ver_whatsapp: true, ver_configuracoes: true,
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

  function setPerfil(p: 'admin' | 'funcionario') {
    if (p === 'admin') {
      setDados(d => ({ ...d, perfil: p, ...todasPermissoes(true) }))
    } else {
      setDados(d => ({ ...d, perfil: p }))
    }
  }

  function togglePerm(k: PermKey) {
    setDados(d => ({ ...d, [k]: !d[k] }))
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

  const isAdmin = dados.perfil === 'admin'

  return (
    <form onSubmit={submeter} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {erro && (
        <div style={{ background: 'rgba(229,88,74,0.1)', border: '1px solid rgba(229,88,74,0.3)', color: '#E5584A', padding: 12, borderRadius: 8, fontSize: 13 }}>
          {erro}
        </div>
      )}

      {/* DADOS DE ACESSO */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>
          Dados de Acesso
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Campo label="Email">
            <input
              className="input" type="email"
              value={dados.email || ''}
              onChange={e => set('email', e.target.value)}
              disabled={modo === 'editar'}
              placeholder="email@exemplo.com"
            />
          </Campo>
          <Campo label={modo === 'novo' ? 'Senha (≥ 6 caracteres)' : 'Nova senha (opcional)'}>
            <input
              className="input" type="password"
              value={dados.senha || ''}
              onChange={e => set('senha', e.target.value)}
              placeholder={modo === 'editar' ? 'Deixe em branco para manter' : ''}
              autoComplete="new-password"
            />
          </Campo>
        </div>
      </div>

      {/* IDENTIFICAÇÃO */}
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
      <div className="card" style={{ padding: 24, opacity: isAdmin ? 0.5 : 1, pointerEvents: isAdmin ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ fontSize: 13, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            Permissões
          </h2>
          {!isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setDados(d => ({ ...d, ...todasPermissoes(true) }))}
                style={{ fontSize: 11, color: '#4CAF82', background: 'rgba(76,175,130,0.08)', border: '1px solid rgba(76,175,130,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                Liberar tudo
              </button>
              <button type="button" onClick={() => setDados(d => ({ ...d, ...todasPermissoes(false) }))}
                style={{ fontSize: 11, color: '#E5584A', background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                Bloquear tudo
              </button>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
          {isAdmin
            ? 'Administradores têm acesso a tudo automaticamente.'
            : 'Desative os módulos que esta colaboradora não deve acessar. Por padrão tudo está liberado.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {GRUPOS_PERMISSOES.map(grupo => (
            <div key={grupo.titulo}>
              <div style={{ fontSize: 10, color: 'var(--gold-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
                {grupo.titulo}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grupo.itens.map(item => {
                  const ativo = dados[item.key] as boolean
                  return (
                    <label key={item.key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8,
                      border: `1px solid ${ativo ? 'rgba(76,175,130,0.18)' : 'rgba(229,88,74,0.15)'}`,
                      background: ativo ? 'rgba(76,175,130,0.04)' : 'rgba(229,88,74,0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                      onClick={() => togglePerm(item.key)}
                    >
                      <span style={{ fontSize: 13, color: ativo ? '#F2EBD9' : 'var(--text-muted)', userSelect: 'none' }}>
                        {item.label}
                      </span>
                      {/* Toggle switch */}
                      <div style={{
                        width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                        background: ativo ? '#4CAF82' : 'rgba(255,255,255,0.1)',
                        border: `1px solid ${ativo ? '#4CAF82' : 'rgba(255,255,255,0.15)'}`,
                        position: 'relative', transition: 'all 0.2s',
                      }}>
                        <div style={{
                          position: 'absolute', top: 2,
                          left: ativo ? 20 : 2,
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
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
              background: 'rgba(229,88,74,0.08)', border: '1px solid rgba(229,88,74,0.3)',
              color: '#E5584A', padding: '10px 18px', borderRadius: 8,
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
