import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  PiggyBank, Plus, X, Edit2, Trash2, History,
  Target, TrendingUp, Calendar, Check, AlertTriangle,
  Wifi, WifiOff, RefreshCw,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Caixinha {
  id: string
  nome: string
  valor_atual: number
  meta: number | null
  prazo: string | null
  descricao: string | null
  taxa_rendimento_mensal: number
  created_at: string
}

interface Aporte {
  id: string
  caixinha_id: string
  valor_adicionado: number
  valor_anterior: number
  valor_apos: number
  data_aporte: string
  observacao: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

function diasAte(prazo: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(prazo + 'T12:00:00')
  return Math.max(0, Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000))
}

/**
 * Retorna a taxa diária como decimal.
 * O campo taxa_rendimento_mensal armazena a taxa DIÁRIA em % (ex: 0.0325).
 * i = taxa / 100 → ex: 0.0325 / 100 = 0.000325
 */
function taxaDiaria(taxaDiariaPercent: number): number {
  return taxaDiariaPercent / 100
}

// ─── API BCB — CDI histórico ───────────────────────────────────────────────────
// Série 4389 = CDI diário em % a.d. (ex: "0.0325")
// Fonte: https://dadosabertos.bcb.gov.br

type CdiMap = Map<string, number> // chave: "YYYY-MM-DD", valor: taxa %/dia

function fmtDataBCB(d: Date): string {
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Converte taxa CDI para % diária.
 * A BCB série 4389 retorna a taxa ANUAL (% a.a.), ex: 14.4.
 * Fórmula: i_diária = ((1 + r_anual/100)^(1/252) - 1) × 100
 * Se já vier como diária (valor < 1), mantém direto.
 */
function cdiAnualParaDiario(valorAnual: number): number {
  if (valorAnual <= 0) return 0
  if (valorAnual < 1) return valorAnual // já é diária (% a.d.)
  // Converte % a.a. → % a.d. com 252 dias úteis/ano
  return (Math.pow(1 + valorAnual / 100, 1 / 252) - 1) * 100
}

async function buscarHistoricoCDI(dataInicio: Date): Promise<CdiMap> {
  const hoje = new Date()
  const url  = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json`
            + `&dataInicial=${fmtDataBCB(dataInicio)}&dataFinal=${fmtDataBCB(hoje)}`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`BCB ${res.status}`)
  const dados = await res.json() as { data: string; valor: string }[]
  const map: CdiMap = new Map()
  for (const d of dados) {
    // BCB retorna "DD/MM/YYYY" → converte para "YYYY-MM-DD"
    const [dd, mm, yyyy] = d.data.split('/')
    const valorDiario = cdiAnualParaDiario(parseFloat(d.valor))
    map.set(`${yyyy}-${mm}-${dd}`, valorDiario)
  }
  return map
}

// ─── Componente: Botão buscar CDI (para formulários) ──────────────────────────

function BotaoCDI({ onBuscado }: { onBuscado: (taxa: number, data: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'carregando' | 'ok' | 'erro'>('idle')
  const [info, setInfo] = useState<{ valor: number; data: string } | null>(null)

  async function buscar() {
    setStatus('carregando')
    try {
      const map = await buscarHistoricoCDI(new Date())
      const entries = [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
      if (!entries.length) throw new Error('vazio')
      const [dataKey, valor] = entries[0]
      const [yyyy, mm, dd] = dataKey.split('-')
      const dataFmt = `${dd}/${mm}/${yyyy}`
      setInfo({ valor, data: dataFmt })
      setStatus('ok')
      onBuscado(valor, dataFmt)
    } catch {
      setStatus('erro')
    }
  }

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={buscar} disabled={status === 'carregando'}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all w-full justify-center
          ${status === 'ok'    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : status === 'erro'  ? 'bg-rose-50 border-rose-200 text-rose-600'
          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
        {status === 'carregando' ? <RefreshCw size={13} className="animate-spin" /> :
         status === 'ok'         ? <Wifi size={13} /> :
         status === 'erro'       ? <WifiOff size={13} /> :
                                   <Wifi size={13} />}
        {status === 'carregando' ? 'Consultando BCB...' :
         status === 'ok'         ? 'CDI atualizado!' :
         status === 'erro'       ? 'Falha — tentar novamente' :
                                   'Buscar CDI atual (Banco Central)'}
      </button>
      {status === 'ok' && info && (
        <p className="text-[10px] text-emerald-600 text-center">
          CDI = <strong>{info.valor}%/dia</strong> em {info.data} · Fonte: api.bcb.gov.br
        </p>
      )}
      {status === 'erro' && (
        <p className="text-[10px] text-rose-500 text-center">
          Não foi possível conectar à API do BCB. Use a taxa manualmente.
        </p>
      )}
    </div>
  )
}

/** Dias exatos entre uma data (string YYYY-MM-DD) e hoje */
function diasCorridos(data: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dep  = new Date(data + 'T12:00:00')
  return Math.max(0, Math.floor((hoje.getTime() - dep.getTime()) / 86400000))
}

interface LinhaRendimento {
  aporte: Aporte
  dias: number
  valorInicial: number
  rendimento: number
  valorFinal: number
}

/**
 * Processa cada aporte com juros compostos diários.
 * - Se cdiMap fornecido: usa o CDI real de cada dia útil (Banco Central).
 *   VF = P × ∏(1 + cdi[d]/100) para cada dia d desde o depósito até ontem.
 * - Fallback: VF = P × (1 + taxaFallbackPct/100)^n (taxa fixa).
 */
function calcularJurosCompostos(
  aportes: Aporte[],
  taxaFallbackPct: number,
  cdiMap: CdiMap = new Map()
): { linhas: LinhaRendimento[]; saldoProjetado: number; totalDepositado: number; totalRendimento: number } {
  const hoje    = new Date(); hoje.setHours(0, 0, 0, 0)
  const hojeStr = hoje.toISOString().split('T')[0]

  // Pré-processa CDI: log acumulado por data útil (exclui hoje pois não fechou)
  const sorted = [...cdiMap.entries()]
    .filter(([d]) => d < hojeStr)
    .sort(([a], [b]) => a.localeCompare(b))

  const cumLog: { date: string; log: number }[] = []
  let running = 0
  for (const [date, taxa] of sorted) {
    running += Math.log1p(taxa / 100)
    cumLog.push({ date, log: running })
  }
  const totalLog = running
  const usaCDI   = cumLog.length > 0

  // Retorna log acumulado estritamente antes de dateStr
  function logAntesDe(dateStr: string): number {
    let lo = 0, hi = cumLog.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumLog[mid].date < dateStr) lo = mid + 1; else hi = mid }
    return lo === 0 ? 0 : cumLog[lo - 1].log
  }

  const linhas: LinhaRendimento[] = aportes
    .filter(a => a.valor_adicionado > 0)
    .map(a => {
      const n    = diasCorridos(a.data_aporte)
      const fator = usaCDI
        ? Math.exp(totalLog - logAntesDe(a.data_aporte))
        : Math.pow(1 + taxaFallbackPct / 100, n)
      const vf        = a.valor_adicionado * fator
      const rendimento = vf - a.valor_adicionado
      return { aporte: a, dias: n, valorInicial: a.valor_adicionado, rendimento, valorFinal: vf }
    })

  const totalDepositado = linhas.reduce((s, l) => s + l.valorInicial, 0)
  const saldoProjetado  = linhas.reduce((s, l) => s + l.valorFinal, 0)
  return { linhas, saldoProjetado, totalDepositado, totalRendimento: saldoProjetado - totalDepositado }
}

// ─── Modal: Aporte ────────────────────────────────────────────────────────────

function ModalAporte({ caixinha, onFechar, onConfirmar }: {
  caixinha: Caixinha
  onFechar: () => void
  onConfirmar: (valor: number, data: string, obs: string) => Promise<void>
}) {
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor)
    if (isNaN(v) || v === 0) return
    setSalvando(true)
    await onConfirmar(v, data, obs)
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Plus size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Adicionar Valor</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="text-xs text-slate-500">
          Meta: <strong className="text-slate-700">{caixinha.nome}</strong>
        </div>

        <form onSubmit={confirmar} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor a Adicionar *</label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-400">
              <span className="px-3 text-slate-400 text-sm font-bold bg-slate-50 py-2.5 border-r border-slate-200">R$</span>
              <input type="number" value={valor} onChange={e => setValor(e.target.value)}
                step="0.01" placeholder="0,00" required autoFocus
                className="flex-1 px-3 py-2.5 text-sm text-slate-700 focus:outline-none" />
            </div>
            {parseFloat(valor) !== 0 && !isNaN(parseFloat(valor)) && (
              <p className={`text-xs mt-1 font-medium ${parseFloat(valor) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                Novo saldo: {fmt(caixinha.valor_atual + parseFloat(valor))}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observação</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ex: Bônus recebido..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 resize-none" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              <Check size={13} /> {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: Histórico ─────────────────────────────────────────────────────────

function ModalHistorico({ caixinha, aportesIniciais, cdiMap, cdiUltimo, onFechar }: {
  caixinha: Caixinha
  aportesIniciais: Aporte[]
  cdiMap: CdiMap
  cdiUltimo: number
  onFechar: () => void
}) {
  const [aportes, setAportes] = useState<Aporte[]>(aportesIniciais)
  const [aba, setAba] = useState<'lancamentos' | 'rendimento'>('rendimento')

  async function removerAporte(id: string) {
    if (!confirm('Remover este registro?')) return
    await supabase.from('caixinhas_aportes').delete().eq('id', id)
    setAportes(prev => prev.filter(a => a.id !== id))
  }

  const { linhas, saldoProjetado, totalDepositado, totalRendimento } =
    calcularJurosCompostos(aportes, cdiUltimo, cdiMap)

  const iDiaria = cdiUltimo / 100

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl space-y-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><History size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Histórico — {caixinha.nome}</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {/* Resumo de topo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Depositado</div>
            <div className="text-base font-black text-slate-700 mt-0.5">{fmt(totalDepositado)}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Rendimento Projetado</div>
            <div className="text-base font-black text-emerald-700 mt-0.5">+{fmt(totalRendimento)}</div>
            <div className="text-[10px] text-emerald-500">i = {(iDiaria * 100).toFixed(4)}%/dia</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo Projetado</div>
            <div className="text-base font-black text-white mt-0.5">{fmt(saldoProjetado)}</div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button onClick={() => setAba('rendimento')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${aba === 'rendimento' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            Juros por Aporte
          </button>
          <button onClick={() => setAba('lancamentos')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${aba === 'lancamentos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            Lançamentos
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {aportes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Nenhum aporte registrado.</div>
          ) : aba === 'rendimento' ? (
            /* ── Tabela de juros compostos diários ── */
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b-2 border-slate-100">
                  <th className="text-left py-2.5 pr-3">Data</th>
                  <th className="text-right py-2.5 pr-3">Valor Inicial</th>
                  <th className="text-right py-2.5 pr-3">Dias Corridos</th>
                  <th className="text-right py-2.5 pr-3">Rendimento</th>
                  <th className="text-right py-2.5">Valor Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {linhas.map(l => (
                  <tr key={l.aporte.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 text-slate-600 font-medium">{fmtDate(l.aporte.data_aporte)}</td>
                    <td className="py-3 pr-3 text-right text-slate-700 font-semibold">{fmt(l.valorInicial)}</td>
                    <td className="py-3 pr-3 text-right">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{l.dias}d</span>
                    </td>
                    <td className="py-3 pr-3 text-right font-bold text-emerald-600">+{fmt(l.rendimento)}</td>
                    <td className="py-3 text-right font-black text-slate-800">{fmt(l.valorFinal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 sticky bottom-0">
                <tr>
                  <td className="py-3 pr-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</td>
                  <td className="py-3 pr-3 text-right font-black text-slate-700">{fmt(totalDepositado)}</td>
                  <td className="py-3 pr-3 text-right text-slate-300">—</td>
                  <td className="py-3 pr-3 text-right font-black text-emerald-600">+{fmt(totalRendimento)}</td>
                  <td className="py-3 text-right font-black text-slate-900 text-sm">{fmt(saldoProjetado)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            /* ── Tabela de lançamentos ── */
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b-2 border-slate-100">
                  <th className="text-left py-2.5 pr-3">Data</th>
                  <th className="text-right py-2.5 pr-3">Adicionado</th>
                  <th className="text-right py-2.5 pr-3">Anterior</th>
                  <th className="text-right py-2.5 pr-3">Após</th>
                  <th className="text-left py-2.5 pr-3">Obs.</th>
                  <th className="py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...aportes].reverse().map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 text-slate-500">{fmtDate(a.data_aporte)}</td>
                    <td className={`py-3 pr-3 text-right font-bold ${a.valor_adicionado >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {a.valor_adicionado >= 0 ? '+' : ''}{fmt(a.valor_adicionado)}
                    </td>
                    <td className="py-3 pr-3 text-right text-slate-400">{fmt(a.valor_anterior)}</td>
                    <td className="py-3 pr-3 text-right font-bold text-slate-700">{fmt(a.valor_apos)}</td>
                    <td className="py-3 pr-3 text-slate-400 italic">{a.observacao || '—'}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => removerAporte(a.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button onClick={onFechar} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Editar Caixinha ───────────────────────────────────────────────────

function ModalEditar({ caixinha, onFechar, onSalvo }: {
  caixinha: Caixinha
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    nome: caixinha.nome,
    meta: caixinha.meta?.toString() ?? '',
    prazo: caixinha.prazo ?? '',
    descricao: caixinha.descricao ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    const { error } = await supabase.from('caixinhas').update({
      nome: form.nome,
      meta: form.meta ? parseFloat(form.meta) : null,
      prazo: form.prazo || null,
      descricao: form.descricao || null,
    }).eq('id', caixinha.id)
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Edit2 size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Editar Caixinha</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          {[
            { label: 'Nome *', key: 'nome', type: 'text', placeholder: 'Ex: Reserva Emergência' },
            { label: 'Meta (R$)', key: 'meta', type: 'number', placeholder: '10000' },
            { label: 'Prazo', key: 'prazo', type: 'date', placeholder: '' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                step="any" min={f.type === 'number' ? '0' : undefined}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
            <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Card da Caixinha ─────────────────────────────────────────────────────────

function CardCaixinha({ caixinha, aportes, cdiMap, cdiUltimo, onAtualizar }: {
  caixinha: Caixinha
  aportes: Aporte[]
  cdiMap: CdiMap
  cdiUltimo: number
  onAtualizar: () => void
}) {
  const [modalAporte, setModalAporte] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const meta = caixinha.meta ?? 0

  // Juros compostos com CDI histórico real (ou fallback fixo 0,0325%/dia)
  const { linhas: linhasJuros, saldoProjetado, totalDepositado, totalRendimento: rendimentoReal } =
    calcularJurosCompostos(aportes, cdiUltimo, cdiMap)

  // Progresso e "faltam" consideram saldo com rendimento, não apenas depósitos
  const saldoComRendimento = saldoProjetado
  const progressoPct = meta > 0 ? Math.min(100, (saldoComRendimento / meta) * 100) : 0
  const faltam = meta > 0 ? Math.max(0, meta - saldoComRendimento) : null
  // Taxa efetiva: CDI atual da BCB, ou fallback fixo 0,0325%/dia
  const iD = cdiUltimo / 100
  const rendimentoMensalEst = caixinha.valor_atual * (Math.pow(1 + iD, 30) - 1)
  const dias = caixinha.prazo ? diasAte(caixinha.prazo) : null
  const porDia = faltam && dias && dias > 0 ? faltam / dias : null

  const aportesPositivos = linhasJuros
  const primeiroDep = aportesPositivos.length > 0
    ? [...aportesPositivos].sort((a, b) => a.aporte.data_aporte.localeCompare(b.aporte.data_aporte))[0].aporte.data_aporte
    : null
  const diasDecorridos = primeiroDep ? diasCorridos(primeiroDep) : 0
  const iDiaria = iD

  async function confirmarAporte(valor: number, data: string, obs: string) {
    const anterior = caixinha.valor_atual
    const apos = anterior + valor
    await supabase.from('caixinhas').update({ valor_atual: apos }).eq('id', caixinha.id)
    await supabase.from('caixinhas_aportes').insert({
      caixinha_id: caixinha.id, valor_adicionado: valor,
      valor_anterior: anterior, valor_apos: apos,
      data_aporte: data, observacao: obs || null,
    })
    setModalAporte(false)
    onAtualizar()
  }

  async function excluir() {
    if (!confirm(`Excluir a caixinha "${caixinha.nome}"? Esta ação não pode ser desfeita.`)) return
    setExcluindo(true)
    await supabase.from('caixinhas').delete().eq('id', caixinha.id)
    onAtualizar()
  }

  return (
    <>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><PiggyBank size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight">{caixinha.nome}</h3>
          </div>
          {meta > 0 && (
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full whitespace-nowrap">
              Meta: {fmt(meta)}
            </span>
          )}
        </div>

        {/* Saldo corrigido — destaque principal */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo atual (c/ rendimento)</div>
          <div className="text-3xl font-black text-white">{fmt(caixinha.valor_atual)}</div>
          {totalDepositado > 0 && (
            <div className="text-xs text-slate-400">
              Depositado: <span className="text-slate-300 font-semibold">{fmt(totalDepositado)}</span>
            </div>
          )}
        </div>

        {/* Rendimento por juros compostos diários */}
        {rendimentoReal > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Rendimento acumulado</div>
              <div className="text-lg font-black text-emerald-700 mt-0.5">+{fmt(rendimentoReal)}</div>
              {primeiroDep && (
                <div className="text-[10px] text-emerald-500 mt-0.5">
                  em {diasDecorridos} dia{diasDecorridos !== 1 ? 's' : ''} · {aportesPositivos.length} aporte{aportesPositivos.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Saldo projetado</div>
              <div className="text-lg font-black text-blue-700 mt-0.5">{fmt(saldoProjetado)}</div>
              <div className="text-[10px] text-blue-400 mt-0.5">
                i = {(iDiaria * 100).toFixed(4)}%/dia · {fmt(rendimentoMensalEst)}/mês
              </div>
            </div>
          </div>
        )}

        {/* Sem aportes ainda */}
        {totalDepositado === 0 && (
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-xs text-slate-400 font-medium">Estimativa próximo mês</div>
            <div className="text-lg font-black text-emerald-600">+{fmt(rendimentoMensalEst)}</div>
            <div className="text-[10px] text-slate-400">i = {cdiUltimo.toFixed(4)}%/dia · {fmt(rendimentoMensalEst)}/mês (30d)</div>
          </div>
        )}

        {/* Barra de progresso */}
        {meta > 0 && (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${progressoPct}%`,
                  background: progressoPct >= 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-600">{progressoPct.toFixed(1)}% concluído</span>
              {faltam !== null && faltam > 0 && (
                <span className="text-slate-400">Faltam {fmt(faltam)}</span>
              )}
              {progressoPct >= 100 && (
                <span className="text-emerald-600 font-bold">✓ Meta atingida!</span>
              )}
            </div>
          </div>
        )}

        {/* Info: faltam / por dia / prazo */}
        {(faltam !== null && faltam > 0 && porDia !== null) && (
          <div className="bg-indigo-50 rounded-xl p-3 flex items-start gap-2">
            <Target size={13} className="text-indigo-500 mt-0.5 shrink-0" />
            <div className="text-xs text-indigo-700">
              <span className="font-bold">Faltam {fmt(faltam)}</span>
              {porDia > 0 && <span className="font-medium text-indigo-500"> · {fmt(porDia)}/dia para alcançar</span>}
            </div>
          </div>
        )}

        {/* Prazo e descrição */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {caixinha.prazo && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Prazo: {fmtDate(caixinha.prazo)}
              {dias !== null && dias > 0 && <span className="text-slate-300">({dias} dias)</span>}
            </span>
          )}
          {caixinha.descricao && (
            <span className="italic">{caixinha.descricao}</span>
          )}
        </div>

        {/* Alertas */}
        {caixinha.prazo && dias !== null && dias <= 30 && faltam !== null && faltam > 0 && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            {dias === 0 ? 'Prazo vencido!' : `Prazo em ${dias} dia${dias !== 1 ? 's' : ''}!`}
          </div>
        )}

        {/* Botões */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          <button onClick={() => setModalAporte(true)}
            className="flex flex-col items-center gap-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold transition-all">
            <Plus size={14} /> Adicionar
          </button>
          <button onClick={() => setModalHistorico(true)}
            className="flex flex-col items-center gap-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold transition-all">
            <History size={14} /> Histórico
          </button>
          <button onClick={() => setModalEditar(true)}
            className="flex flex-col items-center gap-1 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-[10px] font-bold transition-all">
            <Edit2 size={14} /> Editar
          </button>
          <button onClick={excluir} disabled={excluindo}
            className="flex flex-col items-center gap-1 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-[10px] font-bold transition-all disabled:opacity-50">
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      </div>

      {modalAporte && (
        <ModalAporte caixinha={caixinha} onFechar={() => setModalAporte(false)} onConfirmar={confirmarAporte} />
      )}
      {modalHistorico && (
        <ModalHistorico
          caixinha={caixinha}
          aportesIniciais={aportes}
          cdiMap={cdiMap}
          cdiUltimo={cdiUltimo}
          onFechar={() => setModalHistorico(false)}
        />
      )}
      {modalEditar && (
        <ModalEditar caixinha={caixinha} onFechar={() => setModalEditar(false)} onSalvo={() => { setModalEditar(false); onAtualizar() }} />
      )}
    </>
  )
}

// ─── Formulário: Nova Caixinha ─────────────────────────────────────────────────

function FormNovaCaixinha({ onSalvo, onFechar }: { onSalvo: () => void; onFechar: () => void }) {
  const [form, setForm] = useState({
    nome: '', meta: '', prazo: '', descricao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome) { setErro('Informe um nome.'); return }
    setSalvando(true); setErro(null)
    const { error } = await supabase.from('caixinhas').insert({
      nome: form.nome,
      valor_atual: 0,
      meta: form.meta ? parseFloat(form.meta) : null,
      prazo: form.prazo || null,
      descricao: form.descricao || null,
      taxa_rendimento_mensal: 0.0325, // mantido para compatibilidade com coluna NOT NULL; cálculos usam CDI da BCB
    })
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <form onSubmit={salvar} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-bold text-slate-700">Nova Caixinha</h3>
      {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome *</label>
          <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Viagem Europa" required
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Meta (R$)</label>
          <input type="number" value={form.meta} onChange={e => setForm({ ...form, meta: e.target.value })}
            placeholder="Ex: 15000" min="0" step="0.01"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Prazo</label>
          <input type="date" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
          <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
            placeholder="Ex: Reserva para entrada do imóvel"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
        <button type="submit" disabled={salvando}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">
          {salvando ? 'Criando...' : 'Criar Caixinha'}
        </button>
      </div>
    </form>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function Caixinhas() {
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>([])
  const [todosAportes, setTodosAportes] = useState<Aporte[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [carregando, setCarregando] = useState(true)

  // CDI histórico da API do Banco Central
  const [cdiMap, setCdiMap]       = useState<CdiMap>(new Map())
  const [cdiUltimo, setCdiUltimo] = useState<number>(0)
  const [cdiStatus, setCdiStatus] = useState<'idle' | 'carregando' | 'ok' | 'erro'>('idle')

  async function carregar() {
    setCarregando(true)
    const [{ data: cx }, { data: ap }] = await Promise.all([
      supabase.from('caixinhas').select('*').order('created_at', { ascending: true }),
      supabase.from('caixinhas_aportes').select('*').order('data_aporte', { ascending: true }),
    ])
    const caixinhasCarregadas = cx || []
    const aportesCarregados   = ap || []
    setCaixinhas(caixinhasCarregadas)
    setTodosAportes(aportesCarregados)
    setCarregando(false)

    // Busca CDI histórico a partir do primeiro aporte registrado
    const positivos = aportesCarregados.filter(a => a.valor_adicionado > 0)
    if (positivos.length === 0) return
    const maisAntigo = [...positivos].sort((a, b) => a.data_aporte.localeCompare(b.data_aporte))[0]
    const dataInicio = new Date(maisAntigo.data_aporte + 'T12:00:00')

    setCdiStatus('carregando')
    try {
      const map = await buscarHistoricoCDI(dataInicio)
      setCdiMap(map)
      // Pega o último valor útil
      const ultimo = [...map.entries()].sort(([a], [b]) => b.localeCompare(a))[0]
      if (ultimo) setCdiUltimo(ultimo[1])
      setCdiStatus('ok')
    } catch {
      setCdiStatus('erro')
    }
  }

  useEffect(() => { carregar() }, [])

  const totalGuardado = caixinhas.reduce((acc, c) => acc + c.valor_atual, 0)
  const taxaRef = cdiUltimo > 0 ? cdiUltimo : 0.0325
  // Estimativa mensal consolidada usando taxa atual do CDI
  const totalRendimentoMensal = caixinhas.reduce((acc, c) => {
    const iD = taxaRef / 100
    return acc + c.valor_atual * (Math.pow(1 + iD, 30) - 1)
  }, 0)
  // Juros compostos com CDI histórico real para todas as caixinhas
  const { totalDepositadoGlobal, totalRendimentoReal } = caixinhas.reduce((acc, c) => {
    const ap = todosAportes.filter(a => a.caixinha_id === c.id)
    const r  = calcularJurosCompostos(ap, taxaRef, cdiMap)
    return {
      totalDepositadoGlobal: acc.totalDepositadoGlobal + r.totalDepositado,
      totalRendimentoReal:   acc.totalRendimentoReal   + r.totalRendimento,
    }
  }, { totalDepositadoGlobal: 0, totalRendimentoReal: 0 })

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
            <PiggyBank size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Caixinhas</h2>
            <p className="text-slate-500 text-sm">Metas de poupança com rendimento automático</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Badge CDI */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border
            ${cdiStatus === 'ok'         ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : cdiStatus === 'erro'       ? 'bg-rose-50 border-rose-200 text-rose-500'
            : cdiStatus === 'carregando' ? 'bg-blue-50 border-blue-200 text-blue-600'
            : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
            {cdiStatus === 'carregando' ? <RefreshCw size={11} className="animate-spin" /> :
             cdiStatus === 'ok'         ? <Wifi size={11} /> :
             cdiStatus === 'erro'       ? <WifiOff size={11} /> :
                                          <Wifi size={11} />}
            {cdiStatus === 'ok'         ? `CDI ${cdiUltimo.toFixed(4)}%/dia · BCB`
            : cdiStatus === 'erro'      ? 'CDI offline — taxa fixa'
            : cdiStatus === 'carregando'? 'Buscando CDI…'
            :                            'CDI'}
          </div>
          <button onClick={() => setMostrarForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
            {mostrarForm ? <><X size={13} /> Fechar</> : <><Plus size={13} /> Nova caixinha</>}
          </button>
        </div>
      </div>

      {/* Resumo global */}
      {caixinhas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Guardado</div>
              <div className="text-2xl font-black text-slate-800 mt-1">{fmt(totalGuardado)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{caixinhas.length} caixinha{caixinhas.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><PiggyBank size={20} /></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Rendimento Mensal</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">+{fmt(totalRendimentoMensal)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">estimativa próximo mês · CDI {taxaRef.toFixed(4)}%/dia</div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <div className="bg-emerald-600 p-5 rounded-2xl text-white shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-200 font-bold uppercase tracking-wider">Já Rendeu</div>
              <div className="text-2xl font-black text-white mt-1">+{fmt(totalRendimentoReal)}</div>
              <div className="text-[10px] text-emerald-200 mt-0.5">
                {cdiStatus === 'ok' ? `CDI real · ${cdiMap.size} dias úteis` : 'taxa fixa de fallback'}
              </div>
            </div>
            <div className="p-3 bg-white/20 text-white rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Projeção Anual</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">+{fmt(totalRendimentoMensal * 12)}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">próximos 12 meses</div>
            </div>
            <div className="p-3 bg-white/10 text-emerald-400 rounded-xl"><TrendingUp size={20} /></div>
          </div>
        </div>
      )}

      {mostrarForm && (
        <FormNovaCaixinha onSalvo={() => { setMostrarForm(false); carregar() }} onFechar={() => setMostrarForm(false)} />
      )}

      {carregando ? (
        <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
      ) : caixinhas.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🐷</p>
          <p className="text-sm font-medium">Nenhuma caixinha ainda.</p>
          <p className="text-xs mt-1 text-slate-300">Clique em "Nova caixinha" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {caixinhas.map(c => (
            <CardCaixinha
              key={c.id}
              caixinha={c}
              aportes={todosAportes.filter(a => a.caixinha_id === c.id)}
              cdiMap={cdiMap}
              cdiUltimo={cdiUltimo > 0 ? cdiUltimo : 0.0325}
              onAtualizar={carregar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
