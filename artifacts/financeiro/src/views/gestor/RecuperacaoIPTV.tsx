import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Cliente } from '../../lib/gestor/types'
import { diasAte, formatarData, iniciais } from '../../lib/gestor/format'
import { analisarSegmento, analisarPorFaixaDeValor, type SegmentoRetencao } from '../../lib/gestor/retencao'
import { MENSAGEM_RECONQUISTA, preencherTemplate, copiarParaAreaDeTransferencia } from '../../lib/gestor/mensagens'
import { registrarPagamento } from '../../lib/gestor/pagamentos'
import { RenovarModal } from '../../components/gestor/RenovarModal'
import { ClienteDetalhesModal } from '../../components/gestor/ClienteDetalhesModal'

function fmtInt(v: number) {
  return v.toLocaleString('pt-BR')
}
function fmtBRL(v: number, compact = false) {
  if (compact && Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtPct(v: number) {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '%'
}

function TabelaSegmento({ titulo, caption, dados }: { titulo: string; caption: string; dados: SegmentoRetencao[] }) {
  return (
    <div className="card">
      <h3 className="card-title">{titulo}</h3>
      <p className="card-caption">{caption}</p>
      {dados.length === 0 ? (
        <p className="msg-vazio">Amostra pequena demais pra comparar.</p>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th>{titulo}</th>
              <th style={{ textAlign: 'right' }}>Vencidos</th>
              <th style={{ textAlign: 'right' }}>Taxa</th>
            </tr>
          </thead>
          <tbody>
            {dados.slice(0, 8).map((s, i) => (
              <tr key={s.chave}>
                <td className={i === 0 ? 'strong' : ''}>{s.chave}</td>
                <td style={{ textAlign: 'right' }}>{s.vencidos}/{s.total}</td>
                <td style={{ textAlign: 'right' }} className={i === 0 ? 'strong' : ''}>{fmtPct(s.taxaVencidos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function RecuperacaoIPTV() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [diasMin, setDiasMin] = useState('')
  const [diasMax, setDiasMax] = useState('')
  const [renovando, setRenovando] = useState<Cliente | null>(null)
  const [detalhando, setDetalhando] = useState<Cliente | null>(null)
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

  const vencidos = useMemo(() => (clientes ?? []).filter((c) => diasAte(c.vencimento) < 0), [clientes])

  const stats = useMemo(() => {
    if (!clientes) return null
    const valorRepresado = vencidos.reduce((s, c) => s + Number(c.valor || 0), 0)
    const recentes = vencidos.filter((c) => Math.abs(diasAte(c.vencimento)) <= 30)
    const perdidos = vencidos.filter((c) => Math.abs(diasAte(c.vencimento)) > 90)

    return {
      totalVencidos: vencidos.length,
      valorRepresado,
      recentesQtd: recentes.length,
      perdidosQtd: perdidos.length,
      porServidor: analisarSegmento(clientes, 'servidor'),
      porValor: analisarPorFaixaDeValor(clientes),
    }
  }, [clientes, vencidos])

  const filtrosAtivos = !!busca || !!diasMin || !!diasMax

  function limparFiltros() {
    setBusca('')
    setDiasMin('')
    setDiasMax('')
  }

  const listaReconquista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const min = diasMin ? Number(diasMin) : null
    const max = diasMax ? Number(diasMax) : null
    return [...vencidos]
      .filter((c) => {
        if (termo && !`${c.nome} ${c.usuario ?? ''} ${c.servidor ?? ''}`.toLowerCase().includes(termo)) return false
        const dias = Math.abs(diasAte(c.vencimento))
        if (min !== null && dias < min) return false
        if (max !== null && dias > max) return false
        return true
      })
      .sort((a, b) => Math.abs(diasAte(a.vencimento)) - Math.abs(diasAte(b.vencimento)))
  }, [vencidos, busca, diasMin, diasMax])

  async function handleCopiarMensagem(cliente: Cliente) {
    const dias = Math.abs(diasAte(cliente.vencimento))
    const mensagem = preencherTemplate(MENSAGEM_RECONQUISTA, { nome: cliente.nome, dias })
    const ok = await copiarParaAreaDeTransferencia(mensagem)
    setToast(ok ? '✓ Mensagem copiada! Cole no WhatsApp.' : 'Não consegui copiar — copia manualmente.')
    setTimeout(() => setToast(null), 3000)
  }

  async function handleMarcarTentativa(cliente: Cliente) {
    const jaTentado = !!cliente.reconquista_tentada_em
    const { error } = await supabase
      .from('clientes')
      .update({ reconquista_tentada_em: jaTentado ? null : new Date().toISOString() })
      .eq('id', cliente.id)
    if (!error) await carregar()
  }

  async function confirmarRenovacao(novoVencimento: string) {
    if (!renovando) return
    const { error } = await supabase.from('clientes').update({ vencimento: novoVencimento }).eq('id', renovando.id)
    if (!error) {
      const nome = renovando.nome
      await registrarPagamento(renovando).catch((e) => console.error('Falha ao registrar pagamento:', e))
      setRenovando(null)
      await carregar()
      setToast(`✓ ${nome} renovado até ${formatarData(novoVencimento)}`)
      setTimeout(() => setToast(null), 3000)
    }
  }

  if (erro) return <p className="form-erro">{erro}</p>
  if (!stats) return <p className="msg-vazio">Carregando…</p>

  return (
    <div className="gestor-view recuperacao-page">
      <div className="kpis">
        <div className="kpi">
          <p className="kpi-label">Total vencidos</p>
          <div className="kpi-value">{fmtInt(stats.totalVencidos)}</div>
          <div className="kpi-sub down">{fmtBRL(stats.valorRepresado, true)} represados</div>
        </div>
        <div className="kpi">
          <p className="kpi-label">Fáceis de reconquistar</p>
          <div className="kpi-value">{fmtInt(stats.recentesQtd)}</div>
          <div className="kpi-sub up">vencidos há até 30 dias</div>
        </div>
        <div className="kpi">
          <p className="kpi-label">Prováveis perdidos</p>
          <div className="kpi-value">{fmtInt(stats.perdidosQtd)}</div>
          <div className="kpi-sub down">vencidos há mais de 90 dias</div>
        </div>
      </div>

      <div className="section-title">Onde a taxa de vencidos é maior</div>
      <p className="card-caption" style={{ margin: '-6px 0 12px' }}>
        Só considera grupos com pelo menos 5 clientes, pra não distorcer com amostra pequena. Ordenado do pior pro melhor.
      </p>
      <div className="grid2">
        <TabelaSegmento titulo="Servidor" caption="Taxa de vencidos por servidor" dados={stats.porServidor} />
        <TabelaSegmento titulo="Valor cobrado" caption="Taxa de vencidos por faixa de preço" dados={stats.porValor} />
      </div>

      <div className="section-title">Lista de reconquista</div>
      <div className="clientes-toolbar">
        <input
          className="busca"
          placeholder="Buscar por nome, usuário ou servidor…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <div className="filtros-bar">
        <label className="checkbox-label">
          Vencido há pelo menos
          <input
            type="number"
            min="0"
            placeholder="0"
            value={diasMin}
            onChange={(e) => setDiasMin(e.target.value)}
            style={{ width: 70 }}
          />
          dias
        </label>
        <label className="checkbox-label">
          e no máximo
          <input
            type="number"
            min="0"
            placeholder="sem limite"
            value={diasMax}
            onChange={(e) => setDiasMax(e.target.value)}
            style={{ width: 90 }}
          />
          dias
        </label>
        {filtrosAtivos && (
          <button type="button" className="btn-link" onClick={limparFiltros}>Limpar filtros</button>
        )}
      </div>
      <p className="tabela-contagem">{listaReconquista.length} cliente{listaReconquista.length === 1 ? '' : 's'} vencido{listaReconquista.length === 1 ? '' : 's'} — mais fáceis primeiro</p>
      <div className="tabela-wrap">
        <table className="tabela-clientes">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Atraso</th>
              <th>Servidor</th>
              <th>Plano</th>
              <th className="col-num">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {listaReconquista.map((c) => (
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
                <td>
                  <span className="pill status-vencido">{Math.abs(diasAte(c.vencimento))}d</span>
                  {c.reconquista_tentada_em && (
                    <div className="tentativa-nota">🕓 tentado {formatarData(c.reconquista_tentada_em.slice(0, 10))}</div>
                  )}
                </td>
                <td>{c.servidor || '—'}</td>
                <td>{c.plano}</td>
                <td className="col-num">{fmtBRL(c.valor)}</td>
                <td>
                  <div className="acoes-cell">
                    <button className="btn-whatsapp" title="Copiar mensagem de reconquista" onClick={() => handleCopiarMensagem(c)}>
                      💬 Copiar
                    </button>
                    <button
                      className={`btn-renovar ${c.reconquista_tentada_em ? '' : 'btn-icon-mudo'}`}
                      title={c.reconquista_tentada_em ? 'Desmarcar tentativa' : 'Marcar como tentado'}
                      onClick={() => handleMarcarTentativa(c)}
                    >
                      ✓
                    </button>
                    <button className="btn-renovar" title="Renovar" onClick={() => setRenovando(c)}>↻</button>
                    <button className="btn-renovar btn-icon-mudo" title="Ver todos os dados" onClick={() => setDetalhando(c)}>⋯</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renovando && (
        <RenovarModal cliente={renovando} onConfirmar={confirmarRenovacao} onCancelar={() => setRenovando(null)} />
      )}
      {detalhando && <ClienteDetalhesModal cliente={detalhando} onFechar={() => setDetalhando(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
