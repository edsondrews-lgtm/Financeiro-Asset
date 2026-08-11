import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Cliente } from '../../lib/gestor/types'
import { computeDashboardStats } from '../../lib/gestor/dashboardStats'
import { calcularFaturamentoMensal, type PagamentoValor } from '../../lib/gestor/faturamento'
import { BarChart } from '../../components/gestor/charts/BarChart'
import { LineChart } from '../../components/gestor/charts/LineChart'
import { HBarList } from '../../components/gestor/charts/HBarList'

const SERIES = ['var(--gs1)', 'var(--gs2)', 'var(--gs3)', 'var(--gs4)', 'var(--gs5)', 'var(--gs6)', 'var(--gs7)', 'var(--gs8)']
const AGING_COLORS = ['#fddc7a', '#fbc94f', '#fab219', '#f18a3a', '#ec835a', '#d03b3b']

function fmtBRL(v: number, compact = false) {
  if (compact && Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtInt(v: number) {
  return v.toLocaleString('pt-BR')
}
function fmtPct(v: number, d = 1) {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d }) + '%'
}
function corDaLista(labels: string[], i: number) {
  return labels[i] === 'Outros' || labels[i] === 'Não informado' ? 'var(--text-muted)' : SERIES[i % SERIES.length]
}

export function PainelIPTV() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [pagamentos, setPagamentos] = useState<PagamentoValor[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('clientes').select('*').then(({ data, error }) => {
      if (error) setErro(error.message)
      else setClientes(data as Cliente[])
    })

    async function carregarPagamentos() {
      const PAGINA = 1000
      const todos: PagamentoValor[] = []
      for (let offset = 0; ; offset += PAGINA) {
        const { data, error } = await supabase
          .from('pagamentos')
          .select('data_pagamento, valor')
          .range(offset, offset + PAGINA - 1)
        if (error) {
          setErro((atual) => atual ?? error.message)
          return
        }
        if (!data || data.length === 0) break
        todos.push(...(data as PagamentoValor[]))
        if (data.length < PAGINA) break
      }
      setPagamentos(todos)
    }
    carregarPagamentos()
  }, [])

  const stats = useMemo(() => (clientes ? computeDashboardStats(clientes, new Date()) : null), [clientes])
  const faturamento = useMemo(() => (pagamentos ? calcularFaturamentoMensal(pagamentos) : null), [pagamentos])

  if (erro) return <p className="form-erro">{erro}</p>
  if (!stats) return <p className="msg-vazio">Carregando painel…</p>

  const { kpis } = stats
  const picoIdx = stats.upcoming.qtd.indexOf(Math.max(...stats.upcoming.qtd))

  return (
    <div className="gestor-view dashboard-page">
      <div className="alerts">
        <div className="alert critical">
          <div className="alert-icon">⚠</div>
          <div>
            <p className="alert-title">{fmtInt(kpis.vencidosQtd)} clientes vencidos ({fmtPct(kpis.vencidosPct)})</p>
            <p className="alert-body"><b>{fmtBRL(kpis.vencidosValor, true)}</b> em mensalidades vencidas — inclui {fmtInt(kpis.ghostQtd)} há mais de 90 dias.</p>
          </div>
        </div>
        <div className="alert warning">
          <div className="alert-icon">👻</div>
          <div>
            <p className="alert-title">{fmtInt(kpis.ghostQtd)} prováveis clientes fantasma</p>
            <p className="alert-body">Vencidos há 90+ dias e ainda não arquivados ({fmtBRL(kpis.ghostValor, true)}) — candidatos a arquivar.</p>
          </div>
        </div>
        <div className="alert good">
          <div className="alert-icon">📅</div>
          <div>
            <p className="alert-title">{fmtInt(kpis.venc30Qtd)} vencimentos nos próximos 30 dias</p>
            <p className="alert-body">Pico de <b>{Math.max(...stats.upcoming.qtd)} avisos</b> em {stats.upcoming.labels[picoIdx]}. {fmtPct(kpis.optInPct, 0)} da base aceita mensagem.</p>
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-icon">👥</span>
          <p className="kpi-label">Clientes ativos (em dia)</p>
          <div className="kpi-value">{fmtInt(kpis.ativos)}</div>
          <div className="kpi-sub">{fmtInt(kpis.naoArquivados)} sob gestão · {fmtInt(kpis.total)} no total</div>
        </div>
        <div className="kpi">
          <span className="kpi-icon">💰</span>
          <p className="kpi-label">Receita recorrente</p>
          <div className="kpi-value">{fmtBRL(kpis.receitaRecorrente, true)}</div>
          <div className="kpi-sub">ticket médio {fmtBRL(kpis.ticketMedio)} · só clientes em dia</div>
        </div>
        <div className="kpi">
          <span className="kpi-icon">⚠️</span>
          <p className="kpi-label">Vencidos agora</p>
          <div className="kpi-value">{fmtInt(kpis.vencidosQtd)}</div>
          <div className="kpi-sub down">{fmtPct(kpis.vencidosPct)} da base sob gestão</div>
        </div>
        <div className="kpi">
          <span className="kpi-icon">⏳</span>
          <p className="kpi-label">Vencem em 7 dias</p>
          <div className="kpi-value">{fmtInt(kpis.venc7Qtd)}</div>
          <div className="kpi-sub">{fmtBRL(kpis.venc7Valor, true)} em jogo</div>
        </div>
        <div className="kpi">
          <span className="kpi-icon">📈</span>
          <p className="kpi-label">Previsto p/ 30 dias</p>
          <div className="kpi-value">{fmtBRL(kpis.venc30Valor, true)}</div>
          <div className="kpi-sub up">{fmtInt(kpis.venc30Qtd)} vencimentos</div>
        </div>
        <div className="kpi">
          <span className="kpi-icon">💬</span>
          <p className="kpi-label">Aceitam receber aviso</p>
          <div className="kpi-value">{fmtPct(kpis.optInPct, 0)}</div>
          <div className="kpi-sub">{fmtInt(kpis.optInQtd)} de {fmtInt(kpis.naoArquivados)} sob gestão</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 className="card-title">Próximos 30 dias — vencimentos por dia</h3>
          <p className="card-caption">Quantidade de clientes ativos que vencem em cada dia</p>
          <BarChart labels={stats.upcoming.labels} values={stats.upcoming.qtd} highlightIndex={picoIdx} labelEvery={4} />
        </div>
        <div className="card">
          <h3 className="card-title">Clientes vencidos, por tempo de atraso</h3>
          <p className="card-caption">{fmtInt(kpis.vencidosQtd)} clientes · {fmtBRL(kpis.vencidosValor, true)} represados</p>
          <BarChart
            labels={stats.aging.labels} values={stats.aging.qtd}
            color={AGING_COLORS[0]}
            highlightIndex={-1}
          />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 className="card-title">Faturamento — mês a mês</h3>
          <p className="card-caption">
            {faturamento
              ? `Soma dos pagamentos recebidos por mês, desde ${faturamento.labels[0]}`
              : 'Carregando histórico de pagamentos…'}
          </p>
          {faturamento && (
            <LineChart
              labels={faturamento.labels}
              series={[{ name: 'Faturamento', color: 'var(--accent)', values: faturamento.valores }]}
              height={170}
              labelEvery={3}
              valueFmt={(v) => fmtBRL(v, true)}
            />
          )}
        </div>
        <div className="card">
          <h3 className="card-title">Forma de pagamento</h3>
          <p className="card-caption">{fmtInt(kpis.total)} clientes cadastrados</p>
          <HBarList
            labels={stats.paymentMix.labels}
            values={stats.paymentMix.qtd}
            colors={stats.paymentMix.labels.map((_, i) => corDaLista(stats.paymentMix.labels, i))}
          />
        </div>
      </div>

      <div className="grid3">
        <div className="card">
          <h3 className="card-title">Aplicativo</h3>
          <p className="card-caption">Clientes ativos por app utilizado</p>
          <HBarList
            labels={stats.apps.labels}
            values={stats.apps.qtd}
            colors={stats.apps.labels.map((_, i) => corDaLista(stats.apps.labels, i))}
          />
        </div>
        <div className="card">
          <h3 className="card-title">Servidor</h3>
          <p className="card-caption">Clientes ativos e receita mensal por servidor</p>
          <HBarList
            labels={stats.servers.labels}
            values={stats.servers.qtd}
            colors={stats.servers.labels.map((_, i) => corDaLista(stats.servers.labels, i))}
            sub={stats.servers.receita.map((v) => fmtBRL(v, true) + '/mês')}
          />
        </div>
        <div className="card">
          <h3 className="card-title">Estado</h3>
          <p className="card-caption">Todos os clientes por localização</p>
          <HBarList
            labels={stats.geo.labels}
            values={stats.geo.qtd}
            colors={stats.geo.labels.map((_, i) => corDaLista(stats.geo.labels, i))}
          />
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 className="card-title">Quem mais indica clientes</h3>
          <p className="card-caption">Ranking de clientes ativos indicados por alguém da base</p>
          <table className="dtable">
            <thead><tr><th>Cliente</th><th style={{ textAlign: 'right' }}>Indicações ativas</th></tr></thead>
            <tbody>
              {stats.referrals.map((r, i) => (
                <tr key={r.nome}>
                  <td className="strong"><span className="rank">{i + 1}</span>{r.nome}</td>
                  <td style={{ textAlign: 'right' }} className="strong">{r.qtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 className="card-title">Dispositivo mais comum</h3>
          <p className="card-caption">Clientes ativos por dispositivo</p>
          <HBarList
            labels={stats.devices.labels}
            values={stats.devices.qtd}
            colors={stats.devices.labels.map((_, i) => corDaLista(stats.devices.labels, i))}
          />
        </div>
      </div>
    </div>
  )
}
