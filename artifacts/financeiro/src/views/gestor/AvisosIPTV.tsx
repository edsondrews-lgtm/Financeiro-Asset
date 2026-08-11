import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Cliente } from '../../lib/gestor/types'
import { diasAte, formatarData, iniciais } from '../../lib/gestor/format'
import { MENSAGEM_AVISO, preencherTemplate, quandoVence, copiarParaAreaDeTransferencia } from '../../lib/gestor/mensagens'
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

const JANELA_DIAS = 7

export function AvisosIPTV() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
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
  }, [])

  const proximos = useMemo(() => {
    return (clientes ?? [])
      .filter((c) => c.receber_mensagem)
      .map((c) => ({ c, dias: diasAte(c.vencimento) }))
      .filter((x) => x.dias >= 0 && x.dias <= JANELA_DIAS)
      .sort((a, b) => a.dias - b.dias)
  }, [clientes])

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return proximos.filter(({ c }) => !termo || `${c.nome} ${c.usuario ?? ''} ${c.servidor ?? ''}`.toLowerCase().includes(termo))
  }, [proximos, busca])

  const valorEmJogo = proximos.reduce((s, { c }) => s + Number(c.valor || 0), 0)
  const hojeCount = proximos.filter((x) => x.dias === 0).length

  async function handleCopiarMensagem(cliente: Cliente, dias: number) {
    const mensagem = preencherTemplate(MENSAGEM_AVISO, {
      nome: cliente.nome,
      quando: quandoVence(dias),
      data: formatarData(cliente.vencimento),
    })
    const ok = await copiarParaAreaDeTransferencia(mensagem)
    setToast(ok ? '✓ Mensagem copiada! Cole no WhatsApp.' : 'Não consegui copiar — copia manualmente.')
    setTimeout(() => setToast(null), 3000)
  }

  async function handleMarcarAvisado(cliente: Cliente) {
    const jaAvisado = !!cliente.aviso_enviado_em
    const { error } = await supabase
      .from('clientes')
      .update({ aviso_enviado_em: jaAvisado ? null : new Date().toISOString() })
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
  if (!clientes) return <p className="msg-vazio">Carregando…</p>

  return (
    <div className="gestor-view avisos-page">
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi">
          <span className="kpi-icon">📅</span>
          <p className="kpi-label">Vencem nos próximos {JANELA_DIAS} dias</p>
          <div className="kpi-value">{fmtInt(proximos.length)}</div>
          <div className="kpi-sub">{fmtBRL(valorEmJogo, true)} em jogo</div>
        </div>
        <div className="kpi">
          <span className="kpi-icon">⏰</span>
          <p className="kpi-label">Vencem hoje</p>
          <div className="kpi-value">{fmtInt(hojeCount)}</div>
          <div className="kpi-sub down">prioridade máxima</div>
        </div>
        <div className="kpi">
          <span className="kpi-icon">💬</span>
          <p className="kpi-label">Aceitam receber aviso</p>
          <div className="kpi-value">{fmtInt(proximos.length)}</div>
          <div className="kpi-sub">de quem vence no período</div>
        </div>
      </div>

      <div className="clientes-toolbar">
        <input
          className="busca"
          placeholder="Buscar por nome, usuário ou servidor…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {listaFiltrada.length === 0 ? (
        <p className="msg-vazio">Ninguém vencendo nos próximos {JANELA_DIAS} dias. 🎉</p>
      ) : (
        <>
          <p className="tabela-contagem">{listaFiltrada.length} cliente{listaFiltrada.length === 1 ? '' : 's'} — mais urgente primeiro</p>
          <div className="tabela-wrap">
            <table className="tabela-clientes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vence</th>
                  <th>Servidor</th>
                  <th>Plano</th>
                  <th className="col-num">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map(({ c, dias }) => (
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
                      <span className={`pill ${dias === 0 ? 'status-hoje' : 'status-proximo'}`}>
                        {dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias}d`}
                      </span>
                      {c.aviso_enviado_em && <div className="tentativa-nota">🕓 avisado {formatarData(c.aviso_enviado_em.slice(0, 10))}</div>}
                    </td>
                    <td>{c.servidor || '—'}</td>
                    <td>{c.plano}</td>
                    <td className="col-num">{fmtBRL(c.valor)}</td>
                    <td>
                      <div className="acoes-cell">
                        <button className="btn-whatsapp" title="Copiar mensagem de aviso" onClick={() => handleCopiarMensagem(c, dias)}>
                          💬 Copiar
                        </button>
                        <button
                          className={`btn-renovar ${c.aviso_enviado_em ? '' : 'btn-icon-mudo'}`}
                          title={c.aviso_enviado_em ? 'Desmarcar aviso' : 'Marcar como avisado'}
                          onClick={() => handleMarcarAvisado(c)}
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
        </>
      )}

      {renovando && (
        <RenovarModal cliente={renovando} onConfirmar={confirmarRenovacao} onCancelar={() => setRenovando(null)} />
      )}
      {detalhando && <ClienteDetalhesModal cliente={detalhando} onFechar={() => setDetalhando(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
