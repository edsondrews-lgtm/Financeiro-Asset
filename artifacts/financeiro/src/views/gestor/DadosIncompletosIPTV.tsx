import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Cliente, NovoCliente } from '../../lib/gestor/types'
import { iniciais } from '../../lib/gestor/format'
import { ClienteForm } from '../../components/gestor/ClienteForm'

type Campo = 'aplicativo' | 'mac' | 'localizacao' | 'dispositivo'

const CAMPOS: { chave: Campo; label: string }[] = [
  { chave: 'aplicativo', label: 'Aplicativo' },
  { chave: 'dispositivo', label: 'Dispositivo' },
  { chave: 'mac', label: 'MAC' },
  { chave: 'localizacao', label: 'Estado' },
]

function faltando(c: Cliente, campo: Campo): boolean {
  const v = c[campo]
  return !v || !v.trim()
}

function fmtInt(v: number) {
  return v.toLocaleString('pt-BR')
}

export function DadosIncompletosIPTV() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroCampo, setFiltroCampo] = useState<Campo | ''>('')
  const [editando, setEditando] = useState<Cliente | null>(null)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.from('clientes').select('*').eq('arquivado', false)
    if (error) setErro(error.message)
    else setClientes(data as Cliente[])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const incompletos = useMemo(
    () => clientes.filter((c) => CAMPOS.some((f) => faltando(c, f.chave))),
    [clientes]
  )

  const contagemPorCampo = useMemo(() => {
    const mapa = new Map<Campo, number>()
    for (const f of CAMPOS) mapa.set(f.chave, clientes.filter((c) => faltando(c, f.chave)).length)
    return mapa
  }, [clientes])

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return incompletos.filter((c) => {
      if (filtroCampo && !faltando(c, filtroCampo)) return false
      if (termo && !`${c.nome} ${c.usuario ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [incompletos, busca, filtroCampo])

  async function handleSalvarEdicao(dados: NovoCliente) {
    if (!editando) return
    const { error } = await supabase.from('clientes').update(dados).eq('id', editando.id)
    if (error) throw error
    setEditando(null)
    await carregar()
  }

  if (erro) return <p className="form-erro">{erro}</p>
  if (carregando) return <p className="msg-vazio">Carregando…</p>

  return (
    <div className="gestor-view dados-incompletos-page">
      <p className="tabela-contagem">
        {fmtInt(incompletos.length)} de {fmtInt(clientes.length)} clientes ativos têm pelo menos um campo faltando.
      </p>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {CAMPOS.map((f) => (
          <button
            key={f.chave}
            type="button"
            className="kpi kpi-clicavel"
            onClick={() => setFiltroCampo(filtroCampo === f.chave ? '' : f.chave)}
            style={filtroCampo === f.chave ? { outline: '2px solid var(--accent)' } : undefined}
          >
            <p className="kpi-label">Sem {f.label.toLowerCase()}</p>
            <div className="kpi-value">{fmtInt(contagemPorCampo.get(f.chave) ?? 0)}</div>
          </button>
        ))}
      </div>

      {editando && (
        <ClienteForm
          valoresIniciais={editando}
          textoBotao="Salvar alterações"
          onSalvar={handleSalvarEdicao}
          onCancelar={() => setEditando(null)}
        />
      )}

      <div className="clientes-toolbar">
        <input
          className="busca"
          placeholder="Buscar por nome ou usuário…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {filtroCampo && (
          <button type="button" className="btn-link" onClick={() => setFiltroCampo('')}>Limpar filtro</button>
        )}
      </div>

      {listaFiltrada.length === 0 ? (
        <p className="msg-vazio">
          {incompletos.length === 0 ? 'Nenhum cliente com dado faltando 🎉' : 'Nenhum resultado com esse filtro.'}
        </p>
      ) : (
        <>
          <p className="tabela-contagem">{listaFiltrada.length} cliente{listaFiltrada.length === 1 ? '' : 's'}</p>
          <div className="tabela-wrap">
            <table className="tabela-clientes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Servidor</th>
                  <th>Campos faltando</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cliente-cell">
                        <span className="avatar">{iniciais(c.nome)}</span>
                        <div>
                          <div className="cliente-nome">{c.nome}</div>
                          {c.usuario && <div className="cliente-cred">{c.usuario}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{c.servidor || '—'}</td>
                    <td>
                      <div className="chip-row">
                        {CAMPOS.filter((f) => faltando(c, f.chave)).map((f) => (
                          <span key={f.chave} className="chip">{f.label}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button className="btn-renovar" title="Editar cliente" onClick={() => setEditando(c)}>✎</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
