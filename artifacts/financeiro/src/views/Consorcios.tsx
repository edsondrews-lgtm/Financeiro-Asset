import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  FileText, Plus, X, TrendingUp, ChevronDown, ChevronUp,
  RefreshCw, Percent, Zap, CheckCircle2, Clock, Ban,
  DollarSign, BarChart3, Edit2, Check, AlertTriangle, RotateCcw,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Consorcio {
  id: string
  descricao: string
  valor_bem: number
  prazo: number
  taxa_adm_total: number
  fundo_reserva_total: number
  valor_parcela_base: number
  fator_correcao: number
  data_inicio: string
}

interface Parcela {
  id: string
  consorcio_id: string
  numero_parcela: number
  valor_fundo_comum: number
  valor_taxa_adm: number
  valor_fundo_reserva: number
  valor_total: number
  base_fundo_comum: number
  base_taxa_adm: number
  base_fundo_reserva: number
  base_total: number
  status: 'pago' | 'pendente' | 'cancelada'
  data_vencimento: string | null
  data_pagamento: string | null
  valor_pago: number | null
  observacao: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const round2 = (v: number) => Math.round(v * 100) / 100

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function StatusBadge({ status }: { status: Parcela['status'] }) {
  if (status === 'pago')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold"><CheckCircle2 size={10} /> Pago</span>
  if (status === 'cancelada')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold"><Ban size={10} /> Cancelada</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold"><Clock size={10} /> Pendente</span>
}

// ─── Formulário: Novo Consórcio ───────────────────────────────────────────────

function NovoConsorcioForm({ onSalvo }: { onSalvo: () => void }) {
  const [form, setForm] = useState({
    descricao: '', valor_bem: '105000', prazo: '75',
    taxa_adm_total: '6.4', fundo_reserva_total: '2',
    data_inicio: new Date().toISOString().split('T')[0],
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const vb = parseFloat(form.valor_bem) || 0
  const pr = parseInt(form.prazo) || 1
  const ta = parseFloat(form.taxa_adm_total) || 0
  const fr = parseFloat(form.fundo_reserva_total) || 0
  const fc = round2(vb / pr)
  const adm = round2(vb * ta / 100 / pr)
  const res = round2(vb * fr / 100 / pr)
  const total = round2(fc + adm + res)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descricao || vb <= 0 || pr <= 0) { setErro('Preencha todos os campos.'); return }
    setSalvando(true); setErro(null)

    // 1. Insere o consórcio
    const { data: novo, error: errC } = await supabase
      .from('consorcios')
      .insert({ descricao: form.descricao, valor_bem: vb, prazo: pr, taxa_adm_total: ta,
        fundo_reserva_total: fr, valor_parcela_base: total, fator_correcao: 1.0, data_inicio: form.data_inicio })
      .select().single()

    if (errC || !novo) { setErro('Erro ao criar consórcio: ' + errC?.message); setSalvando(false); return }

    // 2. Gera as N parcelas no app e insere em lote
    const parcelas = Array.from({ length: pr }, (_, i) => ({
      consorcio_id: novo.id,
      numero_parcela: i + 1,
      valor_fundo_comum: fc, valor_taxa_adm: adm, valor_fundo_reserva: res, valor_total: total,
      base_fundo_comum: fc, base_taxa_adm: adm, base_fundo_reserva: res, base_total: total,
      status: 'pendente',
      data_vencimento: addMonths(form.data_inicio, i + 1),
    }))

    const { error: errP } = await supabase.from('parcelas_calculadas').insert(parcelas)
    if (errP) { setErro('Erro ao gerar parcelas: ' + errP.message); setSalvando(false); return }

    setSalvando(false)
    onSalvo()
  }

  return (
    <form onSubmit={salvar} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-bold text-slate-700">Novo Consórcio</h3>
      {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição *</label>
          <input type="text" placeholder="Ex: Consórcio Imóvel 105k" value={form.descricao}
            onChange={e => setForm({ ...form, descricao: e.target.value })} required
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
        </div>
        {[
          { label: 'Valor do Bem (R$)', key: 'valor_bem' },
          { label: 'Prazo (meses)', key: 'prazo' },
          { label: 'Taxa Adm. Total (%)', key: 'taxa_adm_total' },
          { label: 'Fundo de Reserva (%)', key: 'fundo_reserva_total' },
          { label: 'Data de Início', key: 'data_inicio', type: 'date' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{f.label}</label>
            <input type={f.type || 'number'} value={(form as any)[f.key]} min="0" step="any"
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
          </div>
        ))}
      </div>

      <div className="p-4 bg-violet-50 rounded-xl border border-violet-100 text-xs text-violet-800 grid grid-cols-4 gap-3">
        <div><div className="text-violet-400 font-bold uppercase mb-0.5">Fundo Comum</div><div className="font-black">{fmt(fc)}</div></div>
        <div><div className="text-violet-400 font-bold uppercase mb-0.5">Taxa Adm.</div><div className="font-black">{fmt(adm)}</div></div>
        <div><div className="text-violet-400 font-bold uppercase mb-0.5">Fundo Reserva</div><div className="font-black">{fmt(res)}</div></div>
        <div><div className="text-violet-400 font-bold uppercase mb-0.5">Parcela Total</div><div className="font-black text-violet-700">{fmt(total)}</div></div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={salvando}
          className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50">
          {salvando ? `Gerando ${pr} parcelas...` : `Criar e gerar ${pr} parcelas`}
        </button>
      </div>
    </form>
  )
}

// ─── Dashboard do Consórcio ───────────────────────────────────────────────────

function DashboardConsorcio({ consorcio, onVoltar }: { consorcio: Consorcio; onVoltar: () => void }) {
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const [modalIPCA, setModalIPCA] = useState(false)
  const [modalLance, setModalLance] = useState(false)
  const [fatorIPCA, setFatorIPCA] = useState('1.05')
  const [valorLance, setValorLance] = useState('')
  const [tipoAmort, setTipoAmort] = useState<'reduzir_parcela' | 'reduzir_prazo'>('reduzir_parcela')
  const [aplicando, setAplicando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pago' | 'pendente' | 'cancelada'>('todos')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const porPagina = 20
  const [simulacao, setSimulacao] = useState<null | {
    tipo: 'reduzir_parcela' | 'reduzir_prazo'
    lance: number
    novaParcelaMedio?: number
    reducaoPorParcela?: number
    nCancelar?: number
    parcelasCancelar?: number[]
  }>(null)
  const [lances, setLances] = useState<any[]>([])
  const [desfazendo, setDesfazendo] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [{ data: parcelaData, error }, { data: lancesData }] = await Promise.all([
      supabase.from('parcelas_calculadas').select('*')
        .eq('consorcio_id', consorcio.id)
        .order('numero_parcela', { ascending: true }),
      supabase.from('lances_consorcio').select('*')
        .eq('consorcio_id', consorcio.id)
        .order('created_at', { ascending: false }),
    ])
    if (error) { setErro('Erro: ' + error.message); setCarregando(false); return }
    setParcelas(parcelaData || [])
    setLances(lancesData || [])
    setCarregando(false)
  }, [consorcio.id])

  useEffect(() => { carregar() }, [carregar])

  const pagas = parcelas.filter(p => p.status === 'pago')
  const pendentes = parcelas.filter(p => p.status === 'pendente')
  const canceladas = parcelas.filter(p => p.status === 'cancelada')
  const ativas = parcelas.filter(p => p.status !== 'cancelada')
  const progressoPct = ativas.length > 0 ? (pagas.length / ativas.length) * 100 : 0
  const fundoComumPago = pagas.reduce((acc, p) => acc + p.valor_fundo_comum, 0)
  const saldoDevedor = Math.max(0, consorcio.valor_bem - fundoComumPago)
  const totalPago = pagas.reduce((acc, p) => acc + (p.valor_pago ?? p.valor_total), 0)
  const totalPendente = pendentes.reduce((acc, p) => acc + p.valor_total, 0)
  const custoEfetivo = totalPago + totalPendente

  function mostrarSucesso(msg: string) { setSucesso(msg); setTimeout(() => setSucesso(null), 4000) }

  async function toggleStatus(p: Parcela) {
    if (p.status === 'cancelada') return
    const novoStatus = p.status === 'pago' ? 'pendente' : 'pago'
    const { error } = await supabase.from('parcelas_calculadas').update({
      status: novoStatus,
      data_pagamento: novoStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
      valor_pago: novoStatus === 'pago' ? p.valor_total : null,
    }).eq('id', p.id)
    if (error) { setErro('Erro: ' + error.message); return }
    setParcelas(prev => prev.map(x => x.id === p.id
      ? { ...x, status: novoStatus, valor_pago: novoStatus === 'pago' ? x.valor_total : null }
      : x))
  }

  async function salvarEdicao(id: string) {
    const novo = parseFloat(editValor)
    if (isNaN(novo) || novo < 0) { setEditandoId(null); return }
    const { error } = await supabase.from('parcelas_calculadas').update({ valor_total: novo }).eq('id', id)
    if (error) { setErro('Erro: ' + error.message); setEditandoId(null); return }
    setParcelas(prev => prev.map(p => p.id === id ? { ...p, valor_total: novo } : p))
    setEditandoId(null)
    mostrarSucesso('Valor atualizado!')
  }

  async function aplicarIPCA() {
    const fator = parseFloat(fatorIPCA)
    if (isNaN(fator) || fator <= 0) { setErro('Fator inválido'); return }
    setAplicando(true)

    // Calcula os novos valores no app e atualiza em lote
    const atualizacoes = pendentes.map(p => ({
      id: p.id,
      valor_fundo_comum:   round2(p.base_fundo_comum   * fator),
      valor_taxa_adm:      round2(p.base_taxa_adm       * fator),
      valor_fundo_reserva: round2(p.base_fundo_reserva  * fator),
      valor_total:         round2(p.base_total          * fator),
    }))

    for (const upd of atualizacoes) {
      await supabase.from('parcelas_calculadas').update({
        valor_fundo_comum:   upd.valor_fundo_comum,
        valor_taxa_adm:      upd.valor_taxa_adm,
        valor_fundo_reserva: upd.valor_fundo_reserva,
        valor_total:         upd.valor_total,
      }).eq('id', upd.id)
    }

    await supabase.from('consorcios').update({ fator_correcao: fator }).eq('id', consorcio.id)

    setAplicando(false); setModalIPCA(false)
    mostrarSucesso(`IPCA de ${((fator - 1) * 100).toFixed(2)}% aplicado às parcelas pendentes!`)
    await carregar()
  }

  function simularLance() {
    const lance = parseFloat(valorLance)
    if (isNaN(lance) || lance <= 0 || pendentes.length === 0) { setErro('Valor inválido'); return }
    setErro(null)

    if (tipoAmort === 'reduzir_parcela') {
      const reducao = round2(lance / pendentes.length)
      const novaMedia = round2(Math.max(0, (pendentes[0]?.valor_total ?? 0) - reducao))
      setSimulacao({ tipo: tipoAmort, lance, novaParcelaMedio: novaMedia, reducaoPorParcela: reducao })
    } else {
      const valorRef = pendentes[0]?.valor_total ?? 0
      const nCancelar = valorRef > 0 ? Math.floor(lance / valorRef) : 0
      const aCancelar = [...pendentes].reverse().slice(0, nCancelar).map(p => p.numero_parcela)
      setSimulacao({ tipo: tipoAmort, lance, nCancelar, parcelasCancelar: aCancelar })
    }
  }

  async function aplicarLanceSimulado() {
    if (!simulacao) return
    const { lance, tipo } = simulacao
    setAplicando(true)

    if (tipo === 'reduzir_parcela') {
      const reducao = round2(lance / pendentes.length)
      for (const p of pendentes) {
        const novoTotal = round2(Math.max(0, p.valor_total - reducao))
        const ratio = p.base_total > 0 ? reducao / p.base_total : 0
        await supabase.from('parcelas_calculadas').update({
          valor_fundo_comum:   round2(Math.max(0, p.valor_fundo_comum   - p.base_fundo_comum   * ratio)),
          valor_taxa_adm:      round2(Math.max(0, p.valor_taxa_adm      - p.base_taxa_adm      * ratio)),
          valor_fundo_reserva: round2(Math.max(0, p.valor_fundo_reserva - p.base_fundo_reserva * ratio)),
          valor_total: novoTotal,
          observacao: ((p.observacao ?? '') + ` | Lance -${fmt(reducao)}`).trim(),
        }).eq('id', p.id)
      }
    } else {
      const valorRef = pendentes[0]?.valor_total ?? 0
      if (valorRef > 0) {
        const nCancelar = Math.floor(lance / valorRef)
        const aCancelar = [...pendentes].reverse().slice(0, nCancelar)
        for (const p of aCancelar) {
          await supabase.from('parcelas_calculadas').update({
            status: 'cancelada',
            observacao: `Quitada por lance ${fmt(lance)}`,
          }).eq('id', p.id)
        }
      }
    }

    await supabase.from('lances_consorcio').insert({
      consorcio_id: consorcio.id, valor_lance: lance,
      tipo_amortizacao: tipo, parcela_inicio: pendentes[0]?.numero_parcela ?? 0,
    })

    setAplicando(false); setModalLance(false); setValorLance(''); setSimulacao(null)
    mostrarSucesso(`Lance de ${fmt(lance)} aplicado com sucesso!`)
    await carregar()
  }

  async function desfazerUltimoLance() {
    const ultimo = lances[0]
    if (!ultimo) return
    setDesfazendo(true)

    if (ultimo.tipo_amortizacao === 'reduzir_parcela') {
      // Restaura parcelas pendentes para base × fator_correcao
      const fator = consorcio.fator_correcao
      const aRestaurar = parcelas.filter(p => p.status === 'pendente')
      for (const p of aRestaurar) {
        await supabase.from('parcelas_calculadas').update({
          valor_fundo_comum:   round2(p.base_fundo_comum   * fator),
          valor_taxa_adm:      round2(p.base_taxa_adm       * fator),
          valor_fundo_reserva: round2(p.base_fundo_reserva  * fator),
          valor_total:         round2(p.base_total          * fator),
          observacao: (p.observacao ?? '').replace(/\s*\|\s*Lance\s*-[R$\s\d.,]+/g, '').trim() || null,
        }).eq('id', p.id)
      }
    } else {
      // Restaura parcelas canceladas por este lance
      const valorLanceStr = fmt(ultimo.valor_lance)
      const aRestaurar = parcelas.filter(p =>
        p.status === 'cancelada' && (p.observacao ?? '').includes(`Quitada por lance ${valorLanceStr}`)
      )
      for (const p of aRestaurar) {
        await supabase.from('parcelas_calculadas').update({
          status: 'pendente', observacao: null,
        }).eq('id', p.id)
      }
    }

    await supabase.from('lances_consorcio').delete().eq('id', ultimo.id)

    setDesfazendo(false)
    mostrarSucesso('Lance desfeito com sucesso!')
    await carregar()
  }

  const parcelasFiltradas = filtroStatus === 'todos' ? parcelas : parcelas.filter(p => p.status === filtroStatus)
  const totalPaginas = Math.ceil(parcelasFiltradas.length / porPagina)
  const parcelasPagina = parcelasFiltradas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina)

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto text-slate-700">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-600 rounded-xl text-white shadow-md shadow-violet-100"><FileText size={24} /></div>
          <div>
            <button onClick={onVoltar} className="text-xs text-violet-500 hover:text-violet-700 font-bold mb-0.5 block">← Todos os consórcios</button>
            <h2 className="text-2xl font-bold text-slate-800">{consorcio.descricao}</h2>
            <p className="text-slate-400 text-xs">{fmt(consorcio.valor_bem)} · {consorcio.prazo} meses · Fator: {consorcio.fator_correcao.toFixed(4)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModalIPCA(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold">
            <Percent size={13} /> Aplicar IPCA
          </button>
          <button onClick={() => { setModalLance(true); setSimulacao(null); setValorLance('') }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold">
            <Zap size={13} /> Simular Lance
          </button>
          {lances.length > 0 && (
            <button onClick={desfazerUltimoLance} disabled={desfazendo}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
              <RotateCcw size={13} /> {desfazendo ? 'Desfazendo...' : `Desfazer lance (${fmt(lances[0]?.valor_lance)})`}
            </button>
          )}
          <button onClick={carregar} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl">
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}
      {sucesso && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs">✓ {sucesso}</div>}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Progresso</span>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><BarChart3 size={15} /></div>
          </div>
          <div className="text-2xl font-black text-slate-800">{pagas.length}/{ativas.length}</div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-violet-500 transition-all" style={{ width: `${progressoPct}%` }} />
          </div>
          <div className="text-[10px] text-slate-400">{progressoPct.toFixed(1)}% concluído</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Saldo Devedor</span>
            <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><TrendingUp size={15} /></div>
          </div>
          <div className="text-2xl font-black text-slate-800">{fmt(saldoDevedor)}</div>
          <div className="text-[10px] text-slate-400">FC pago: {fmt(fundoComumPago)}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Custo Total Efetivo</span>
            <div className="p-2 bg-amber-50 text-amber-500 rounded-lg"><DollarSign size={15} /></div>
          </div>
          <div className="text-2xl font-black text-slate-800">{fmt(custoEfetivo)}</div>
          <div className="text-[10px] text-slate-400">Pago + pendente</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Parcelas</span>
            <div className="p-2 bg-white/10 text-violet-300 rounded-lg"><FileText size={15} /></div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{pendentes.length}</div>
          <div className="text-[10px] text-slate-400">{pagas.length} pagas · {canceladas.length} canceladas</div>
        </div>
      </div>

      {/* Modal IPCA */}
      {modalIPCA && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Percent size={18} /></div>
              <h3 className="text-sm font-bold text-slate-800">Aplicar Correção IPCA</h3>
            </div>
            <p className="text-xs text-slate-500">Ex: <strong>1.05</strong> = +5% · <strong>1.0312</strong> = +3,12%</p>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Fator de Correção</label>
              <input type="number" value={fatorIPCA} onChange={e => setFatorIPCA(e.target.value)} step="0.0001" min="0.5" max="3"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
              {parseFloat(fatorIPCA) > 0 && (
                <p className="text-xs text-amber-600 mt-1">Variação: +{((parseFloat(fatorIPCA) - 1) * 100).toFixed(2)}%</p>
              )}
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700 flex gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              Apenas parcelas <strong>pendentes</strong> serão atualizadas.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModalIPCA(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
              <button onClick={aplicarIPCA} disabled={aplicando}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold disabled:opacity-50">
                {aplicando ? 'Aplicando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lance — Simulador */}
      {modalLance && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-100 text-violet-600 rounded-lg"><Zap size={18} /></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Simulador de Lance</h3>
                  <p className="text-[10px] text-slate-400">Simule antes de aplicar — nada é salvo até confirmar</p>
                </div>
              </div>
              <button onClick={() => { setModalLance(false); setSimulacao(null) }} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            {!simulacao ? (
              /* ── Etapa 1: Entrada ── */
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor do Lance (R$)</label>
                  <input type="number" value={valorLance} onChange={e => setValorLance(e.target.value)} placeholder="Ex: 20000" min="0" step="0.01" autoFocus
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de Amortização</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['reduzir_parcela', 'reduzir_prazo'] as const).map(t => (
                      <button key={t} onClick={() => setTipoAmort(t)}
                        className={`p-3 rounded-xl border text-xs text-left transition-all ${tipoAmort === t ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                        <div className="font-black">{t === 'reduzir_parcela' ? 'Reduzir Parcela' : 'Reduzir Prazo'}</div>
                        <div className="text-[10px] mt-0.5 opacity-70">
                          {t === 'reduzir_parcela' ? 'Valor mensal diminui' : 'Remove parcelas do final'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => { setModalLance(false); setSimulacao(null) }} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
                  <button onClick={simularLance}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all">
                    Simular →
                  </button>
                </div>
              </>
            ) : (
              /* ── Etapa 2: Preview da Simulação ── */
              <>
                <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-violet-700 uppercase tracking-wider">Resultado da Simulação</div>

                  {simulacao.tipo === 'reduzir_parcela' ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Lance aplicado</span>
                        <span className="font-bold text-violet-700">{fmt(simulacao.lance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Redução por parcela</span>
                        <span className="font-bold text-rose-500">-{fmt(simulacao.reducaoPorParcela ?? 0)}</span>
                      </div>
                      <div className="border-t border-violet-200 pt-2 flex justify-between">
                        <span className="text-slate-500">Parcela atual (aprox.)</span>
                        <span className="font-bold text-slate-700">{fmt(pendentes[0]?.valor_total ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">Nova parcela</span>
                        <span className="font-black text-emerald-600">{fmt(simulacao.novaParcelaMedio ?? 0)}</span>
                      </div>
                      <div className="text-[10px] text-violet-500">{pendentes.length} parcelas pendentes afetadas</div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Lance aplicado</span>
                        <span className="font-bold text-violet-700">{fmt(simulacao.lance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Parcelas a cancelar</span>
                        <span className="font-bold text-rose-500">{simulacao.nCancelar} parcelas</span>
                      </div>
                      {simulacao.parcelasCancelar && simulacao.parcelasCancelar.length > 0 && (
                        <div className="border-t border-violet-200 pt-2">
                          <div className="text-[10px] text-violet-500 mb-1">Parcelas do final que serão canceladas:</div>
                          <div className="flex flex-wrap gap-1">
                            {simulacao.parcelasCancelar.slice(0, 12).map(n => (
                              <span key={n} className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[10px] font-bold">#{n}</span>
                            ))}
                            {simulacao.parcelasCancelar.length > 12 && (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[10px]">+{simulacao.parcelasCancelar.length - 12} mais</span>
                            )}
                          </div>
                        </div>
                      )}
                      {simulacao.nCancelar === 0 && (
                        <div className="text-xs text-amber-600">Lance insuficiente para cancelar ao menos 1 parcela.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-2 text-xs text-amber-700">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>Esta ação irá modificar o banco de dados. Você pode desfazer depois clicando em <strong>"Desfazer lance"</strong>.</span>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setSimulacao(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">← Voltar</button>
                  <button onClick={aplicarLanceSimulado} disabled={aplicando || (simulacao.tipo === 'reduzir_prazo' && (simulacao.nCancelar ?? 0) === 0)}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
                    {aplicando ? 'Aplicando...' : 'Confirmar e Aplicar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', 'pendente', 'pago', 'cancelada'] as const).map(f => (
              <button key={f} onClick={() => { setFiltroStatus(f); setPaginaAtual(1) }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${filtroStatus === f ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'todos' && ` (${parcelas.length})`}
                {f === 'pendente' && ` (${pendentes.length})`}
                {f === 'pago' && ` (${pagas.length})`}
                {f === 'cancelada' && ` (${canceladas.length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1}
              className="p-1 disabled:opacity-30"><ChevronUp size={14} /></button>
            <span>Pág. {paginaAtual}/{totalPaginas || 1}</span>
            <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual >= totalPaginas}
              className="p-1 disabled:opacity-30"><ChevronDown size={14} /></button>
          </div>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-slate-400 text-sm">Carregando parcelas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-50">
                  <th className="text-left px-5 py-3">#</th>
                  <th className="text-right px-4 py-3">Fundo Comum</th>
                  <th className="text-right px-4 py-3">Taxa Adm.</th>
                  <th className="text-right px-4 py-3">F. Reserva</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Vencimento</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parcelasPagina.map(p => (
                  <tr key={p.id} className={`transition-colors hover:bg-slate-50/60 ${p.status === 'cancelada' ? 'opacity-40' : ''}`}>
                    <td className="px-5 py-3 font-bold text-slate-600 text-xs">#{p.numero_parcela}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmt(p.valor_fundo_comum)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmt(p.valor_taxa_adm)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmt(p.valor_fundo_reserva)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 text-xs">
                      {editandoId === p.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input type="number" value={editValor} onChange={e => setEditValor(e.target.value)} step="0.01"
                            className="w-24 border border-violet-300 rounded-lg px-2 py-1 text-xs focus:outline-none" autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(p.id); if (e.key === 'Escape') setEditandoId(null) }} />
                          <button onClick={() => salvarEdicao(p.id)} className="p-1 text-emerald-500"><Check size={12} /></button>
                          <button onClick={() => setEditandoId(null)} className="p-1 text-slate-400"><X size={12} /></button>
                        </div>
                      ) : fmt(p.valor_total)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {p.data_vencimento ? new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-center">
                      {p.status !== 'cancelada' && (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => toggleStatus(p)} title={p.status === 'pago' ? 'Desmarcar' : 'Marcar como pago'}
                            className={`p-1.5 rounded-lg transition-colors ${p.status === 'pago' ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                            <CheckCircle2 size={12} />
                          </button>
                          {p.status === 'pendente' && (
                            <button onClick={() => { setEditandoId(p.id); setEditValor(p.valor_total.toString()) }}
                              className="p-1.5 rounded-lg bg-violet-50 text-violet-500 hover:bg-violet-100 transition-colors">
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function Consorcios() {
  const [consorcios, setConsorcios] = useState<Consorcio[]>([])
  const [selecionado, setSelecionado] = useState<Consorcio | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('consorcios').select('*').order('created_at', { ascending: false })
    setConsorcios(data || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  if (selecionado)
    return <DashboardConsorcio consorcio={selecionado} onVoltar={() => { setSelecionado(null); carregar() }} />

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-600 rounded-xl text-white shadow-md shadow-violet-100"><FileText size={24} /></div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Consórcios</h2>
            <p className="text-slate-500 text-sm">Gestão completa com IPCA e lances</p>
          </div>
        </div>
        <button onClick={() => setMostrarForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold">
          {mostrarForm ? <><X size={13} /> Fechar</> : <><Plus size={13} /> Novo consórcio</>}
        </button>
      </div>

      {mostrarForm && <NovoConsorcioForm onSalvo={() => { setMostrarForm(false); carregar() }} />}

      {carregando ? (
        <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
      ) : consorcios.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-medium">Nenhum consórcio ainda.</p>
          <p className="text-xs mt-1 text-slate-300">Clique em "Novo consórcio" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {consorcios.map(c => (
            <button key={c.id} onClick={() => setSelecionado(c)}
              className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 text-left hover:shadow-md hover:border-violet-200 transition-all group space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-sm font-bold text-slate-800 group-hover:text-violet-700">{c.descricao}</span>
                <span className="text-[10px] text-violet-600 font-bold bg-violet-50 px-2 py-0.5 rounded-full">{c.prazo}x</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-slate-400">Valor do Bem</div><div className="font-bold text-slate-700">{fmt(c.valor_bem)}</div></div>
                <div><div className="text-slate-400">Parcela Base</div><div className="font-bold text-slate-700">{fmt(c.valor_parcela_base)}</div></div>
                <div><div className="text-slate-400">Taxa Adm.</div><div className="font-bold text-slate-700">{c.taxa_adm_total}%</div></div>
                <div><div className="text-slate-400">Fator Correção</div><div className="font-bold text-slate-700">{c.fator_correcao.toFixed(4)}</div></div>
              </div>
              <div className="text-[10px] text-violet-500 font-bold group-hover:text-violet-700">Ver detalhes →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
