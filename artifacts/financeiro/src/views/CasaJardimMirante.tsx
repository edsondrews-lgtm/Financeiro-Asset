import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Home, Plus, X, Trash2, Edit2, Check,
  TrendingUp, Calendar, RefreshCw, ChevronDown, ChevronUp,
  DollarSign, BarChart3, Target, ArrowRight,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Casa {
  id: string
  nome: string
  endereco: string
  tipo: string
  valor_total: number
  total_pago: number
  valor_restante: number
  total_aportes: number
  progresso_pct: number
}

interface Aporte {
  id: string
  data_pagamento: string
  valor: number
  quem_pagou: string
  destinatario: string
  tipo: string
  observacao: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

const TIPOS = [
  { value: 'entrada',      label: '💎 Entrada',      color: 'bg-emerald-100 text-emerald-700' },
  { value: 'aporte',       label: '⚡ Aporte',       color: 'bg-amber-100 text-amber-700' },
  { value: 'antecipacao',  label: '🔁 Antecipação',  color: 'bg-blue-100 text-blue-700' },
]

function TipoBadge({ tipo }: { tipo: string }) {
  const t = TIPOS.find(t => t.value === tipo) ?? TIPOS[1]
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.color}`}>
      {t.label}
    </span>
  )
}

// ─── Modal: Novo / Editar Aporte ──────────────────────────────────────────────

function ModalAporte({
  aporte, onFechar, onSalvo,
}: {
  aporte?: Aporte
  onFechar: () => void
  onSalvo: () => void
}) {
  const [form, setForm] = useState({
    data_pagamento: aporte?.data_pagamento ?? new Date().toISOString().split('T')[0],
    valor: aporte?.valor.toString() ?? '',
    quem_pagou: aporte?.quem_pagou ?? '',
    destinatario: aporte?.destinatario ?? 'Rudimar Vivian',
    tipo: aporte?.tipo ?? 'aporte',
    observacao: aporte?.observacao ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setErro('Valor inválido.'); return }
    if (!form.quem_pagou) { setErro('Informe quem pagou.'); return }
    setSalvando(true); setErro(null)

    const payload = {
      data_pagamento: form.data_pagamento,
      valor,
      quem_pagou: form.quem_pagou,
      destinatario: form.destinatario,
      tipo: form.tipo,
      observacao: form.observacao || null,
    }

    const { error } = aporte
      ? await supabase.from('casa_aportes').update(payload).eq('id', aporte.id)
      : await supabase.from('casa_aportes').insert(payload)

    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              {aporte ? <Edit2 size={18} /> : <Plus size={18} />}
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {aporte ? 'Editar Aporte' : 'Novo Aporte'}
            </h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data *</label>
              <input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor R$ *</label>
              <input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                step="0.01" placeholder="0,00" required autoFocus
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(t => (
                <button key={t.value} type="button" onClick={() => setForm({ ...form, tipo: t.value })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${form.tipo === t.value ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quem Pagou *</label>
            <input type="text" value={form.quem_pagou} onChange={e => setForm({ ...form, quem_pagou: e.target.value })}
              placeholder="Ex: Edson Drews" required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Destinatário *</label>
            <input type="text" value={form.destinatario} onChange={e => setForm({ ...form, destinatario: e.target.value })}
              placeholder="Ex: Rudimar Vivian" required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observação</label>
            <textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })}
              rows={2} placeholder="Ex: Terreno - Tigrinhos"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
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

// ─── Modal: Editar Valor Total ─────────────────────────────────────────────────

function ModalEditarCasa({ casa, onFechar, onSalvo }: {
  casa: Casa
  onFechar: () => void
  onSalvo: () => void
}) {
  const [valorTotal, setValorTotal] = useState(casa.valor_total.toString())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(valorTotal)
    if (isNaN(valor) || valor <= 0) { setErro('Valor inválido.'); return }
    setSalvando(true)
    const { error } = await supabase.from('casa').update({ valor_total: valor }).eq('id', casa.id)
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Edit2 size={18} /></div>
            <h3 className="text-sm font-bold text-slate-800">Editar Valor Total</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>
        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}
        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor Total da Casa (R$)</label>
            <input type="number" value={valorTotal} onChange={e => setValorTotal(e.target.value)}
              step="0.01" required autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              <Check size={13} /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CasaJardimMirante() {
  const [casa, setCasa] = useState<Casa | null>(null)
  const [aportes, setAportes] = useState<Aporte[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalAporte, setModalAporte] = useState(false)
  const [aporteEditando, setAporteEditando] = useState<Aporte | null>(null)
  const [modalCasa, setModalCasa] = useState(false)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'aporte' | 'antecipacao'>('todos')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const porPagina = 10

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [{ data: casaData }, { data: aportesData }] = await Promise.all([
      supabase.from('casa_resumo').select('*').single(),
      supabase.from('casa_aportes').select('*').order('data_pagamento', { ascending: false }),
    ])
    if (casaData) setCasa(casaData)
    setAportes(aportesData || [])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      <div className="flex items-center gap-2">
        <RefreshCw size={16} className="animate-spin" /> Carregando...
      </div>
    </div>
  )

  if (!casa) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Nenhuma casa cadastrada.</div>
  )

  // ── Cálculos ──
  const totalPorTipo = {
    entrada:     aportes.filter(a => a.tipo === 'entrada').reduce((s, a) => s + a.valor, 0),
    aporte:      aportes.filter(a => a.tipo === 'aporte').reduce((s, a) => s + a.valor, 0),
    antecipacao: aportes.filter(a => a.tipo === 'antecipacao').reduce((s, a) => s + a.valor, 0),
  }

  const listaFiltrada = filtroTipo === 'todos' ? aportes : aportes.filter(a => a.tipo === filtroTipo)
  const totalPaginas = Math.ceil(listaFiltrada.length / porPagina)
  const listaAtual = listaFiltrada.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina)

  async function excluir(id: string) {
    if (!confirm('Excluir este aporte?')) return
    setExcluindo(id)
    await supabase.from('casa_aportes').delete().eq('id', id)
    await carregar()
    setExcluindo(null)
  }

  const progresso = casa.progresso_pct
  const quitada = casa.valor_restante <= 0

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-md shadow-emerald-100">
            <Home size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Casa Geminada</h2>
            <p className="text-slate-500 text-sm">{casa.endereco} · {casa.tipo}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setAporteEditando(null); setModalAporte(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">
            <Plus size={13} /> Novo Aporte
          </button>
          <button onClick={() => setModalCasa(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold">
            <Edit2 size={13} /> Editar Valor Total
          </button>
          <button onClick={() => carregar()}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-slate-800 p-5 rounded-2xl text-white shadow-sm space-y-1">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Investimento Total</div>
          <div className="text-2xl font-black">{fmt(casa.valor_total)}</div>
          <div className="text-xs text-slate-400">Valor da propriedade</div>
        </div>

        <div className="bg-emerald-600 p-5 rounded-2xl text-white shadow-sm space-y-1">
          <div className="text-xs text-emerald-200 font-bold uppercase tracking-wider">Já Investido</div>
          <div className="text-2xl font-black">{fmt(casa.total_pago)}</div>
          <div className="text-xs text-emerald-200">{casa.total_aportes} transações</div>
        </div>

        <div className={`p-5 rounded-2xl text-white shadow-sm space-y-1 ${quitada ? 'bg-emerald-500' : 'bg-amber-500'}`}>
          <div className="text-xs text-white/70 font-bold uppercase tracking-wider">
            {quitada ? '✓ Quitada!' : 'Restante'}
          </div>
          <div className="text-2xl font-black">{quitada ? fmt(0) : fmt(casa.valor_restante)}</div>
          <div className="text-xs text-white/70">{quitada ? 'Parabéns!' : 'a pagar'}</div>
        </div>

        <div className="bg-blue-600 p-5 rounded-2xl text-white shadow-sm space-y-1">
          <div className="text-xs text-blue-200 font-bold uppercase tracking-wider">Progresso</div>
          <div className="text-2xl font-black">{progresso.toFixed(1)}%</div>
          <div className="text-xs text-blue-200">{quitada ? 'Meta alcançada 🎉' : 'concluído'}</div>
        </div>
      </div>

      {/* ── Barra de progresso ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progresso do Pagamento</span>
          <span className="text-sm font-black text-slate-700">{progresso.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
          <div className="h-4 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, progresso)}%`,
              background: quitada
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : 'linear-gradient(90deg, #3b82f6, #6366f1)',
            }} />
        </div>
        <div className="flex justify-between text-xs text-slate-400 font-semibold">
          <span>{fmt(casa.total_pago)} pago</span>
          {!quitada && <span>Faltam {fmt(casa.valor_restante)}</span>}
          {quitada && <span className="text-emerald-600 font-black">✓ Totalmente quitada!</span>}
        </div>
      </div>

      {/* ── Breakdown por tipo ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { tipo: 'entrada',     label: '💎 Entradas',     valor: totalPorTipo.entrada,     cor: 'border-emerald-200 bg-emerald-50', texto: 'text-emerald-700' },
          { tipo: 'aporte',      label: '⚡ Aportes',      valor: totalPorTipo.aporte,      cor: 'border-amber-200 bg-amber-50',    texto: 'text-amber-700' },
          { tipo: 'antecipacao', label: '🔁 Antecipações', valor: totalPorTipo.antecipacao, cor: 'border-blue-200 bg-blue-50',      texto: 'text-blue-700' },
        ].map(item => (
          <div key={item.tipo} className={`border rounded-2xl p-5 ${item.cor} space-y-1`}>
            <div className={`text-xs font-bold uppercase tracking-wider ${item.texto}`}>{item.label}</div>
            <div className={`text-2xl font-black ${item.texto}`}>{fmt(item.valor)}</div>
            <div className={`text-xs ${item.texto} opacity-70`}>
              {aportes.filter(a => a.tipo === item.tipo).length} transações
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabela de aportes ── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">

        {/* Header da tabela */}
        <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', 'entrada', 'aporte', 'antecipacao'] as const).map(f => (
              <button key={f} onClick={() => { setFiltroTipo(f); setPaginaAtual(1) }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filtroTipo === f ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f === 'todos' ? `Todos (${aportes.length})` :
                 f === 'entrada' ? `💎 Entradas (${aportes.filter(a => a.tipo === f).length})` :
                 f === 'aporte' ? `⚡ Aportes (${aportes.filter(a => a.tipo === f).length})` :
                 `🔁 Antecipações (${aportes.filter(a => a.tipo === f).length})`}
              </button>
            ))}
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1}
                className="p-1 disabled:opacity-30"><ChevronUp size={14} /></button>
              <span>Pág. {paginaAtual}/{totalPaginas}</span>
              <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual >= totalPaginas}
                className="p-1 disabled:opacity-30"><ChevronDown size={14} /></button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-50">
                <th className="text-left px-5 py-3">Data</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Quem Pagou</th>
                <th className="text-left px-4 py-3">Destinatário</th>
                <th className="text-left px-4 py-3">Observação</th>
                <th className="text-center px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {listaAtual.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 text-xs font-bold text-slate-600">{fmtDate(a.data_pagamento)}</td>
                  <td className="px-4 py-3"><TipoBadge tipo={a.tipo} /></td>
                  <td className="px-4 py-3 text-right font-black text-emerald-600">{fmt(a.valor)}</td>
                  <td className="px-4 py-3 text-xs text-slate-700 font-semibold">{a.quem_pagou}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{a.destinatario}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 italic max-w-xs truncate">{a.observacao || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setAporteEditando(a); setModalAporte(true) }}
                        className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => excluir(a.id)} disabled={excluindo === a.id}
                        className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Total</td>
                <td className="px-4 py-3 text-right font-black text-emerald-600">{fmt(listaFiltrada.reduce((s, a) => s + a.valor, 0))}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>

          {listaAtual.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">Nenhum aporte encontrado.</div>
          )}
        </div>
      </div>

      {/* ── Modais ── */}
      {modalAporte && (
        <ModalAporte
          aporte={aporteEditando ?? undefined}
          onFechar={() => { setModalAporte(false); setAporteEditando(null) }}
          onSalvo={() => { setModalAporte(false); setAporteEditando(null); carregar() }}
        />
      )}
      {modalCasa && (
        <ModalEditarCasa
          casa={casa}
          onFechar={() => setModalCasa(false)}
          onSalvo={() => { setModalCasa(false); carregar() }}
        />
      )}
    </div>
  )
}