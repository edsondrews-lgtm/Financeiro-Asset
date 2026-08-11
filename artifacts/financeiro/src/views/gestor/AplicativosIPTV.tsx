import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Cliente } from '../../lib/gestor/types'
import { diasAte, statusData, formatarData, iniciais } from '../../lib/gestor/format'
import { HBarList } from '../../components/gestor/charts/HBarList'
import { RenovarAppModal } from '../../components/gestor/RenovarAppModal'

const SERIES = ['var(--gs1)', 'var(--gs2)', 'var(--gs3)', 'var(--gs4)', 'var(--gs5)', 'var(--gs6)', 'var(--gs7)', 'var(--gs8)']

function fmtInt(v: number) {
  return v.toLocaleString('pt-BR')
}

export function AplicativosIPTV() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroAplicativo, setFiltroAplicativo] = useState('')
  const [renovandoApp, setRenovandoApp] = useState<Cliente | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function carregar() {
    const { data, error } = await supabase.from('clientes').select('*').eq('arquivado', false)
    if (error) setErro(error.message)
    else setClientes(data as Cliente[])
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirmarRenovacaoApp(novoVencimento: string) {
    if (!renovandoApp) return
    const { error } = await supabase
      .from('clientes')
      .update({ vencimento_aplicativo: novoVencimento })
      .eq('id', renovandoApp.id)
    if (!error) {
      const nome = renovandoApp.nome
      setRenovandoApp(null)
      await carregar()
      setToast(`✓ App de ${nome} renovado até ${formatarData(novoVencimento)}`)
      setTimeout(() => setToast(null), 3000)
    }
  }

  // Só entra aqui quem está ativo de verdade (não arquivado E em dia com a mensalidade).
  // Um cliente vencido há meses não deve gerar aviso de "app vencendo" — ele nem é cliente ativo agora.
  const ativos = useMemo(() => (clientes ?? []).filter((c) => diasAte(c.vencimento) >= 0), [clientes])
  const totalInativos = clientes ? clientes.length - ativos.length : 0

  const stats = useMemo(() => {
    if (!clientes) return null

    const usoApps = new Map<string, number>()
    for (const c of ativos) {
      const chave = c.aplicativo && c.aplicativo.trim() ? c.aplicativo.trim() : 'Não informado'
      usoApps.set(chave, (usoApps.get(chave) ?? 0) + 1)
    }
    const usoOrdenado = [...usoApps.entries()].sort((a, b) => b[1] - a[1])
    const top = usoOrdenado.slice(0, 8)
    const outros = usoOrdenado.slice(8).reduce((s, [, v]) => s + v, 0)
    const appsLabels = top.map((x) => x[0]).concat(outros > 0 ? ['Outros'] : [])
    const appsQtd = top.map((x) => x[1]).concat(outros > 0 ? [outros] : [])

    const comControle = ativos.filter((c) => !!c.vencimento_aplicativo)
    const vencidos = comControle.filter((c) => diasAte(c.vencimento_aplicativo!) < 0)
    const venceEm7 = comControle.filter((c) => { const d = diasAte(c.vencimento_aplicativo!); return d >= 0 && d <= 7 })
    const emDia = comControle.filter((c) => diasAte(c.vencimento_aplicativo!) > 7)
    const semControle = ativos.length - comControle.length

    const lista = [...comControle].sort(
      (a, b) => Math.abs(diasAte(a.vencimento_aplicativo!)) - Math.abs(diasAte(b.vencimento_aplicativo!))
    )

    return { appsLabels, appsQtd, comControle, vencidos, venceEm7, emDia, semControle, lista }
  }, [clientes, ativos])

  const opcoesAplicativo = useMemo(() => {
    const valores = new Set<string>()
    for (const c of ativos) if (c.aplicativo?.trim()) valores.add(c.aplicativo.trim())
    return [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [ativos])

  const listaFiltrada = useMemo(() => {
    if (!stats) return []
    const termo = busca.trim().toLowerCase()
    return stats.lista.filter((c) => {
      if (filtroAplicativo && c.aplicativo !== filtroAplicativo) return false
      if (termo && !`${c.nome} ${c.usuario ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [stats, busca, filtroAplicativo])

  if (erro) return <p className="form-erro">{erro}</p>
  if (!stats) return <p className="msg-vazio">Carregando aplicativos…</p>

  return (
    <div className="gestor-view aplicativos-page">
      <p className="tabela-contagem">
        Considerando só clientes ativos (em dia com a mensalidade) — {fmtInt(totalInativos)} vencidos ou arquivados ficaram de fora.
      </p>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi">
          <p className="kpi-label">Com controle de vencimento</p>
          <div className="kpi-value">{fmtInt(stats.comControle.length)}</div>
          <div className="kpi-sub">{fmtInt(stats.semControle)} sem essa informação</div>
        </div>
        <div className="kpi">
          <p className="kpi-label">Apps vencidos</p>
          <div className="kpi-value">{fmtInt(stats.vencidos.length)}</div>
          <div className="kpi-sub down">precisam reativar</div>
        </div>
        <div className="kpi">
          <p className="kpi-label">Vencem em até 7 dias</p>
          <div className="kpi-value">{fmtInt(stats.venceEm7.length)}</div>
          <div className="kpi-sub">fique de olho</div>
        </div>
        <div className="kpi">
          <p className="kpi-label">Em dia</p>
          <div className="kpi-value">{fmtInt(stats.emDia.length)}</div>
          <div className="kpi-sub up">sem ação por agora</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 className="card-title">Aplicativos em uso</h3>
          <p className="card-caption">Clientes ativos por aplicativo</p>
          <HBarList
            labels={stats.appsLabels}
            values={stats.appsQtd}
            colors={stats.appsLabels.map((l, i) => (l === 'Outros' || l === 'Não informado' ? 'var(--text-muted)' : SERIES[i % SERIES.length]))}
          />
        </div>
        <div className="card">
          <h3 className="card-title">Situação do controle de vencimento</h3>
          <p className="card-caption">{fmtInt(stats.comControle.length)} clientes com data de expiração de app cadastrada</p>
          <HBarList
            labels={['Vencidos', 'Vencem em 7 dias', 'Em dia', 'Sem controle']}
            values={[stats.vencidos.length, stats.venceEm7.length, stats.emDia.length, stats.semControle]}
            colors={['var(--color-danger)', 'var(--color-warning)', 'var(--color-success)', 'var(--text-muted)']}
          />
        </div>
      </div>

      <div className="clientes-toolbar">
        <input
          className="busca"
          placeholder="Buscar por nome ou usuário…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select value={filtroAplicativo} onChange={(e) => setFiltroAplicativo(e.target.value)}>
          <option value="">Todos os aplicativos</option>
          {opcoesAplicativo.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {listaFiltrada.length === 0 ? (
        <p className="msg-vazio">Nenhum cliente com controle de vencimento de app encontrado.</p>
      ) : (
        <>
          <p className="tabela-contagem">{listaFiltrada.length} cliente{listaFiltrada.length === 1 ? '' : 's'} com controle de app</p>
          <div className="tabela-wrap">
            <table className="tabela-clientes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Aplicativo</th>
                  <th>Servidor</th>
                  <th>Vencimento do aplicativo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((c) => {
                  const statusMensalidade = statusData(c.vencimento, { curto: true })
                  const statusApp = statusData(c.vencimento_aplicativo!, { curto: true })
                  return (
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
                      <td><span className={`pill ${statusMensalidade.classe}`}>{statusMensalidade.texto}</span></td>
                      <td>{c.aplicativo || '—'}</td>
                      <td>{c.servidor || '—'}</td>
                      <td><span className={`pill ${statusApp.classe}`}>{statusApp.texto}</span></td>
                      <td>
                        <button className="btn-renovar" title="Renovar app" onClick={() => setRenovandoApp(c)}>↻</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {renovandoApp && (
        <RenovarAppModal cliente={renovandoApp} onConfirmar={confirmarRenovacaoApp} onCancelar={() => setRenovandoApp(null)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
