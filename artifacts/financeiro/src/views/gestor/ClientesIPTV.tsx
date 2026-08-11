import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Cliente, NovoCliente } from '../../lib/gestor/types'
import { ClienteForm } from '../../components/gestor/ClienteForm'
import { RenovarModal } from '../../components/gestor/RenovarModal'
import { ClienteDetalhesModal } from '../../components/gestor/ClienteDetalhesModal'
import { formatarData, diasAte, statusData as statusVencimento, iniciais } from '../../lib/gestor/format'
import { registrarPagamento } from '../../lib/gestor/pagamentos'

function opcoesDe(clientes: Cliente[], campo: 'servidor' | 'aplicativo' | 'plano' | 'localizacao') {
  const valores = new Set<string>()
  for (const c of clientes) {
    const v = c[campo]
    if (v && v.trim()) valores.add(v.trim())
  }
  return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

type FiltroVencimento = 'todos' | 'vencido' | 'hoje' | 'proximo7' | 'emdia'

const FILTROS_VENCIMENTO: { valor: FiltroVencimento; label: string }[] = [
  { valor: 'todos', label: 'Qualquer vencimento' },
  { valor: 'vencido', label: 'Vencidos' },
  { valor: 'hoje', label: 'Vence hoje' },
  { valor: 'proximo7', label: 'Vence em até 7 dias' },
  { valor: 'emdia', label: 'Em dia' },
]

export function ClientesIPTV() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busca, setBusca] = useState('')
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [filtroVencimento, setFiltroVencimento] = useState<FiltroVencimento>('todos')
  const [filtroServidor, setFiltroServidor] = useState('')
  const [filtroAplicativo, setFiltroAplicativo] = useState('')
  const [filtroPlano, setFiltroPlano] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [renovando, setRenovando] = useState<Cliente | null>(null)
  const [detalhando, setDetalhando] = useState<Cliente | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('arquivado', mostrarArquivados)
      .order('vencimento', { ascending: true })

    if (error) setErro(error.message)
    else setClientes(data as Cliente[])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarArquivados])

  async function handleSalvar(novo: NovoCliente) {
    const { error } = await supabase.from('clientes').insert(novo)
    if (error) throw error
    setMostrarForm(false)
    await carregar()
  }

  async function handleSalvarEdicao(dados: NovoCliente) {
    if (!editando) return
    const { error } = await supabase.from('clientes').update(dados).eq('id', editando.id)
    if (error) throw error
    setEditando(null)
    await carregar()
  }

  async function alternarArquivado(cliente: Cliente) {
    const arquivar = !cliente.arquivado
    const { error } = await supabase
      .from('clientes')
      .update({ arquivado: arquivar, arquivado_em: arquivar ? new Date().toISOString() : null })
      .eq('id', cliente.id)
    if (!error) await carregar()
  }

  async function confirmarRenovacao(novoVencimento: string) {
    if (!renovando) return
    const { error } = await supabase
      .from('clientes')
      .update({ vencimento: novoVencimento })
      .eq('id', renovando.id)
    if (!error) {
      const nome = renovando.nome
      await registrarPagamento(renovando).catch((e) => console.error('Falha ao registrar pagamento:', e))
      setRenovando(null)
      await carregar()
      setToast(`✓ ${nome} renovado até ${formatarData(novoVencimento)}`)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const opcoesServidor = useMemo(() => opcoesDe(clientes, 'servidor'), [clientes])
  const opcoesAplicativo = useMemo(() => opcoesDe(clientes, 'aplicativo'), [clientes])
  const opcoesPlano = useMemo(() => opcoesDe(clientes, 'plano'), [clientes])
  const opcoesEstado = useMemo(() => opcoesDe(clientes, 'localizacao'), [clientes])

  const filtrosAtivos =
    filtroVencimento !== 'todos' || !!filtroServidor || !!filtroAplicativo || !!filtroPlano || !!filtroEstado

  function limparFiltros() {
    setFiltroVencimento('todos')
    setFiltroServidor('')
    setFiltroAplicativo('')
    setFiltroPlano('')
    setFiltroEstado('')
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return clientes.filter((c) => {
      if (termo) {
        const bate = [c.nome, c.telefone, c.usuario, c.servidor, c.aplicativo, c.localizacao]
          .filter(Boolean)
          .some((campo) => campo!.toLowerCase().includes(termo))
        if (!bate) return false
      }
      if (filtroVencimento !== 'todos') {
        const dias = diasAte(c.vencimento)
        if (filtroVencimento === 'vencido' && !(dias < 0)) return false
        if (filtroVencimento === 'hoje' && dias !== 0) return false
        if (filtroVencimento === 'proximo7' && !(dias >= 0 && dias <= 7)) return false
        if (filtroVencimento === 'emdia' && !(dias >= 0)) return false
      }
      if (filtroServidor && c.servidor !== filtroServidor) return false
      if (filtroAplicativo && c.aplicativo !== filtroAplicativo) return false
      if (filtroPlano && c.plano !== filtroPlano) return false
      if (filtroEstado && c.localizacao !== filtroEstado) return false
      return true
    }).sort((a, b) => Math.abs(diasAte(a.vencimento)) - Math.abs(diasAte(b.vencimento)))
  }, [clientes, busca, filtroVencimento, filtroServidor, filtroAplicativo, filtroPlano, filtroEstado])

  return (
    <div className="gestor-view clientes-page">
      <div className="clientes-toolbar">
        <input
          className="busca"
          placeholder="Buscar por nome, telefone, usuário, servidor, estado…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="checkbox-label toggle-arquivados">
          <input
            type="checkbox"
            checked={mostrarArquivados}
            onChange={(e) => setMostrarArquivados(e.target.checked)}
          />
          Ver arquivados
        </label>
        <button onClick={() => { setEditando(null); setMostrarForm((v) => !v) }}>
          {mostrarForm ? 'Fechar' : '+ Adicionar cliente'}
        </button>
      </div>

      <div className="filtros-bar">
        <select value={filtroVencimento} onChange={(e) => setFiltroVencimento(e.target.value as FiltroVencimento)}>
          {FILTROS_VENCIMENTO.map((f) => (
            <option key={f.valor} value={f.valor}>{f.label}</option>
          ))}
        </select>
        <select value={filtroServidor} onChange={(e) => setFiltroServidor(e.target.value)}>
          <option value="">Todos os servidores</option>
          {opcoesServidor.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtroAplicativo} onChange={(e) => setFiltroAplicativo(e.target.value)}>
          <option value="">Todos os aplicativos</option>
          {opcoesAplicativo.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtroPlano} onChange={(e) => setFiltroPlano(e.target.value)}>
          <option value="">Todos os planos</option>
          {opcoesPlano.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos os estados</option>
          {opcoesEstado.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        {filtrosAtivos && (
          <button type="button" className="btn-link" onClick={limparFiltros}>Limpar filtros</button>
        )}
      </div>

      {mostrarForm && (
        <ClienteForm onSalvar={handleSalvar} onCancelar={() => setMostrarForm(false)} />
      )}

      {editando && (
        <ClienteForm
          valoresIniciais={editando}
          textoBotao="Salvar alterações"
          onSalvar={handleSalvarEdicao}
          onCancelar={() => setEditando(null)}
        />
      )}

      {erro && <p className="form-erro">{erro}</p>}

      {carregando ? (
        <p className="msg-vazio">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="msg-vazio">Nenhum cliente encontrado.</p>
      ) : (
        <>
          <p className="tabela-contagem">{filtrados.length} cliente{filtrados.length === 1 ? '' : 's'}</p>
          <div className="tabela-wrap">
            <table className="tabela-clientes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Plano</th>
                  <th className="col-num">Valor</th>
                  <th className="col-num">Telas</th>
                  <th>Servidor</th>
                  <th>Aplicativo</th>
                  <th>Dispositivo</th>
                  <th>MAC</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const status = statusVencimento(c.vencimento)
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="cliente-cell">
                          <span className="avatar">{iniciais(c.nome)}</span>
                          <div>
                            <div className="cliente-nome">{c.nome}</div>
                            {(c.usuario || c.senha) && (
                              <div className="cliente-cred">
                                {c.usuario ?? '—'} {c.senha ? `· ${c.senha}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="venc-cell">
                          <span className={`pill ${status.classe}`}>{status.texto}</span>
                          {!c.arquivado && (
                            <button
                              className="btn-renovar"
                              title="Renovar"
                              onClick={() => setRenovando(c)}
                            >
                              ↻
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{c.plano}</td>
                      <td className="col-num">{c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="col-num">{c.telas}</td>
                      <td>{c.servidor || '—'}</td>
                      <td>{c.aplicativo || '—'}</td>
                      <td>{c.dispositivo || '—'}</td>
                      <td className="cliente-cred">{c.mac || '—'}</td>
                      <td>{c.localizacao || '—'}</td>
                      <td>
                        <div className="acoes-cell">
                          <button
                            className="btn-renovar btn-icon-mudo"
                            title="Editar cliente"
                            onClick={() => { setMostrarForm(false); setEditando(c) }}
                          >
                            ✎
                          </button>
                          <button className="btn-renovar btn-icon-mudo" title="Ver todos os dados" onClick={() => setDetalhando(c)}>
                            ⋯
                          </button>
                          <button className="btn-link btn-link-mudo" onClick={() => alternarArquivado(c)}>
                            {c.arquivado ? 'Reativar' : 'Arquivar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {renovando && (
        <RenovarModal
          cliente={renovando}
          onConfirmar={confirmarRenovacao}
          onCancelar={() => setRenovando(null)}
        />
      )}

      {detalhando && (
        <ClienteDetalhesModal cliente={detalhando} onFechar={() => setDetalhando(null)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
