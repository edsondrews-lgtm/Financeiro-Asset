import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Building2, Plus, Trash2, Edit2, X, ArrowUpRight, DollarSign,
  Percent, TrendingUp, Calendar, Lock, CheckCircle2, Info,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NotaFiscal {
  id: string
  numero_nota: string
  data_emissao: string
  tomador: string
  servico: string
  valor: number
  aliquota_imposto: number
}

interface Despesa {
  id: string
  tipo: string
  descricao: string
  periodicidade: string
  recorrente: string
  valor: number
  data_vencimento: string
}

interface Fechamento {
  id: number
  data_limite: string
  horario_limite: string
  observacao: string
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) => {
  if (!d) return '—'
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const TIPO_LABEL: Record<string, string> = {
  CONTABILIDADE: 'Contabilidade',
  CERTIFICADO_DIGITAL: 'Certificado Digital',
  IMPOSTOS: 'Impostos',
  'PRO LABORE': 'Pró-labore',
  OUTROS: 'Outros',
}

// ─── Tooltip customizado ──────────────────────────────────────────────────────

function TooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.fill || p.stroke }}>{p.name}</span>
          <span className="font-bold text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ControleEmpresa() {
  const [subAba, setSubAba] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [mesAtivo, setMesAtivo] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [anoAtivo, setAnoAtivo] = useState('2026')

  const [notas, setNotas]         = useState<NotaFiscal[]>([])
  const [despesas, setDespesas]   = useState<Despesa[]>([])
  const [fechamento, setFechamento] = useState<Fechamento | null>(null)

  const [modalNota, setModalNota]         = useState(false)
  const [modalDespesa, setModalDespesa]   = useState(false)
  const [modalFechamento, setModalFechamento] = useState(false)
  const [idEditando, setIdEditando]       = useState<string | null>(null)
  const [salvandoFechamento, setSalvandoFechamento] = useState(false)

  const [novaNota, setNovaNota] = useState({
    numero_nota: '', data_emissao: '', tomador: '', servico: '', valor: '',
  })
  const [novaDespesa, setNovaDespesa] = useState({
    tipo: 'CONTABILIDADE', descricao: '', periodicidade: 'Mensal',
    recorrente: 'Não', valor: '', data_vencimento: '',
  })
  const [formFechamento, setFormFechamento] = useState({
    data_limite: '', horario_limite: '23:59', observacao: '',
  })

  useEffect(() => { buscarDados() }, [])

  async function buscarDados() {
    setLoading(true)
    try {
      const [{ data: n }, { data: d }, { data: f }] = await Promise.all([
        supabase.from('empresa_notas_fiscais').select('*').order('data_emissao', { ascending: false }),
        supabase.from('empresa_despesas').select('*').order('data_vencimento', { ascending: true }),
        supabase.from('empresa_controle_fechamento').select('*').order('id', { ascending: false }).limit(1),
      ])
      if (n) setNotas(n)
      if (d) setDespesas(d)
      if (f && f.length > 0) setFechamento(f[0])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // ── CRUD Notas ──────────────────────────────────────────────────────────────

  async function salvarNota(e: React.FormEvent) {
    e.preventDefault()
    const aliquota = Number(novaNota.data_emissao.split('-')[1]) >= 6 ? 7.00 : 6.00
    const dados = {
      numero_nota: novaNota.numero_nota,
      data_emissao: novaNota.data_emissao,
      tomador: novaNota.tomador || 'Tomador não identificado',
      servico: novaNota.servico,
      valor: parseFloat(novaNota.valor),
      aliquota_imposto: aliquota,
    }
    if (idEditando) {
      await supabase.from('empresa_notas_fiscais').update(dados).eq('id', idEditando)
    } else {
      await supabase.from('empresa_notas_fiscais').insert([dados])
    }
    setModalNota(false); setIdEditando(null)
    setNovaNota({ numero_nota: '', data_emissao: '', tomador: '', servico: '', valor: '' })
    buscarDados()
  }

  function abrirEditarNota(nota: NotaFiscal) {
    setIdEditando(nota.id)
    setNovaNota({ numero_nota: nota.numero_nota, data_emissao: nota.data_emissao, tomador: nota.tomador, servico: nota.servico, valor: String(nota.valor) })
    setModalNota(true)
  }

  // ── CRUD Despesas ───────────────────────────────────────────────────────────

  async function salvarDespesa(e: React.FormEvent) {
    e.preventDefault()
    const dados = {
      tipo: novaDespesa.tipo, descricao: novaDespesa.descricao,
      periodicidade: novaDespesa.periodicidade, recorrente: novaDespesa.recorrente,
      valor: parseFloat(novaDespesa.valor),
      data_vencimento: novaDespesa.data_vencimento || null,
    }
    if (idEditando) {
      await supabase.from('empresa_despesas').update(dados).eq('id', idEditando)
    } else {
      await supabase.from('empresa_despesas').insert([dados])
    }
    setModalDespesa(false); setIdEditando(null)
    setNovaDespesa({ tipo: 'CONTABILIDADE', descricao: '', periodicidade: 'Mensal', recorrente: 'Não', valor: '', data_vencimento: '' })
    buscarDados()
  }

  function abrirEditarDespesa(desp: Despesa) {
    setIdEditando(desp.id)
    setNovaDespesa({ tipo: desp.tipo, descricao: desp.descricao, periodicidade: desp.periodicidade, recorrente: desp.recorrente, valor: String(desp.valor), data_vencimento: desp.data_vencimento || '' })
    setModalDespesa(true)
  }

  async function deletar(tabela: string, id: string) {
    if (!confirm('Confirma exclusão?')) return
    await supabase.from(tabela).delete().eq('id', id)
    buscarDados()
  }

  // ── CRUD Fechamento ─────────────────────────────────────────────────────────

  function abrirFechamento() {
    if (fechamento) {
      setFormFechamento({
        data_limite: fechamento.data_limite,
        horario_limite: fechamento.horario_limite?.slice(0, 5) || '23:59',
        observacao: fechamento.observacao || '',
      })
    } else {
      setFormFechamento({ data_limite: '', horario_limite: '23:59', observacao: '' })
    }
    setModalFechamento(true)
  }

  async function salvarFechamento(e: React.FormEvent) {
    e.preventDefault()
    setSalvandoFechamento(true)
    const dados = {
      data_limite: formFechamento.data_limite,
      horario_limite: formFechamento.horario_limite + ':00',
      observacao: formFechamento.observacao,
    }
    if (fechamento) {
      await supabase.from('empresa_controle_fechamento').update(dados).eq('id', fechamento.id)
    } else {
      await supabase.from('empresa_controle_fechamento').insert([dados])
    }
    setSalvandoFechamento(false)
    setModalFechamento(false)
    buscarDados()
  }

  // ── Cálculos mensais ────────────────────────────────────────────────────────

  const prefixo = `${anoAtivo}-${mesAtivo}`
  const notasMes = notas.filter(n => n.data_emissao?.startsWith(prefixo))
  const despesasMes = despesas.filter(d => {
    if (!d.data_vencimento) return true
    if (d.periodicidade === 'Anual') return true
    return d.data_vencimento.startsWith(prefixo)
  })

  const faturamentoMes  = notasMes.reduce((s, n) => s + Number(n.valor), 0)
  const aliquotaMes     = Number(mesAtivo) >= 6 ? 0.07 : 0.06
  const impostoMes      = faturamentoMes * aliquotaMes
  const custosMes       = despesasMes.reduce((s, d) => {
    const v = Number(d.valor)
    return d.periodicidade === 'Anual' ? s + v / 12 : s + v
  }, 0)
  const lucroMes        = faturamentoMes - impostoMes - custosMes

  const notasAno        = notas.filter(n => n.data_emissao?.startsWith(anoAtivo))
  const faturamentoAno  = notasAno.reduce((s, n) => s + Number(n.valor), 0)
  const impostoAno      = notasAno.reduce((s, n) => s + Number(n.valor) * (Number(n.data_emissao.split('-')[1]) >= 6 ? 0.07 : 0.06), 0)
  const custosAno       = despesas.reduce((s, d) => {
    const v = Number(d.valor)
    if (d.periodicidade === 'Anual') return s + v
    return d.data_vencimento?.startsWith(anoAtivo) ? s + v : s
  }, 0)
  const lucroAno        = faturamentoAno - impostoAno - custosAno

  const mesesComMov = new Set(notasAno.map(n => n.data_emissao.substring(0, 7))).size || 1
  const projecaoAnual = (lucroAno / mesesComMov) * 12

  // Dados para o gráfico (12 meses)
  const dadosGrafico = MESES_ABREV.map((mes, i) => {
    const mKey = String(i + 1).padStart(2, '0')
    const pref = `${anoAtivo}-${mKey}`
    const nM   = notas.filter(n => n.data_emissao?.startsWith(pref))
    const fat  = nM.reduce((s, n) => s + Number(n.valor), 0)
    const al   = i >= 5 ? 0.07 : 0.06
    const imp  = fat * al
    const cust = despesas.reduce((s, d) => {
      const v = Number(d.valor)
      if (d.periodicidade === 'Anual') return s + v / 12
      return d.data_vencimento?.startsWith(pref) ? s + v : s
    }, 0)
    return { mes, Faturamento: fat, Custos: cust + imp, Lucro: Math.max(0, fat - imp - cust) }
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto text-slate-700">

      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-100">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Empresa</h2>
            <p className="text-slate-400 text-xs font-semibold">Controle de Faturamento — Simples Nacional</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={mesAtivo} onChange={e => setMesAtivo(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700 shadow-sm">
            {MESES_FULL.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </select>
          <select value={anoAtivo} onChange={e => setAnoAtivo(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700 shadow-sm">
            <option value="2026">2026</option><option value="2025">2025</option>
          </select>
          <button onClick={() => { setIdEditando(null); setNovaNota({ numero_nota: '', data_emissao: `${anoAtivo}-${mesAtivo}-01`, tomador: '', servico: '', valor: '' }); setModalNota(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
            <Plus size={13} /> Nova Nota
          </button>
          <button onClick={() => { setIdEditando(null); setNovaDespesa({ tipo: 'CONTABILIDADE', descricao: '', periodicidade: 'Mensal', recorrente: 'Não', valor: '', data_vencimento: `${anoAtivo}-${mesAtivo}-01` }); setModalDespesa(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm">
            <Plus size={13} /> Nova Despesa
          </button>
        </div>
      </div>

      {/* Banner de fechamento de competência */}
      {fechamento ? (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <Lock size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800">Controle de Competência</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Notas lançadas até <strong>{fmtData(fechamento.data_limite)}</strong> às <strong>{fechamento.horario_limite?.slice(0,5)}</strong>.
              {fechamento.observacao && <> &nbsp;·&nbsp; {fechamento.observacao}</>}
            </p>
          </div>
          <button onClick={abrirFechamento}
            className="shrink-0 text-[10px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 border border-amber-300 bg-white rounded-lg px-2.5 py-1.5 transition-all">
            <Edit2 size={11} /> Editar
          </button>
        </div>
      ) : (
        <button onClick={abrirFechamento}
          className="flex items-center gap-2 w-full text-left bg-slate-50 border border-dashed border-slate-300 rounded-2xl px-5 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-all">
          <Calendar size={14} />
          Definir controle de competência (data de fechamento das notas)
        </button>
      )}

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'notas',     label: 'Notas Fiscais' },
          { key: 'despesas',  label: 'Despesas' },
          { key: 'relatorios',label: 'Relatórios' },
        ].map(t => (
          <button key={t.key} onClick={() => setSubAba(t.key)}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${subAba === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-xs font-bold text-blue-500 animate-pulse">Carregando...</p>}

      {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
      {subAba === 'dashboard' && (
        <div className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Faturamento Mês',  value: faturamentoMes, icon: <ArrowUpRight size={15} />, bg: 'bg-blue-50',   border: 'border-blue-100',   txt: 'text-blue-800',   ibg: 'bg-blue-600' },
              { label: 'Faturamento Ano',  value: faturamentoAno, icon: <TrendingUp size={15} />,   bg: 'bg-emerald-50', border: 'border-emerald-100', txt: 'text-emerald-800',ibg: 'bg-emerald-600' },
              { label: 'Imposto Est. Mês', value: impostoMes,     icon: <Percent size={13} />,      bg: 'bg-orange-50',  border: 'border-orange-100',  txt: 'text-orange-800', ibg: 'bg-orange-500' },
              { label: 'Custos Mês',       value: custosMes,      icon: <DollarSign size={15} />,   bg: 'bg-rose-50',    border: 'border-rose-100',    txt: 'text-rose-800',   ibg: 'bg-rose-600' },
            ].map((c, i) => (
              <div key={i} className={`${c.bg} border ${c.border} p-5 rounded-2xl relative overflow-hidden`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</p>
                <p className={`text-xl font-black ${c.txt} mt-1.5`}>{fmt(c.value)}</p>
                <div className={`absolute right-4 bottom-4 p-2 ${c.ibg} text-white rounded-xl shadow-sm`}>{c.icon}</div>
              </div>
            ))}
          </div>

          {/* Lucro resumido */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Lucro Líquido Mês</p>
              <p className={`text-3xl font-black mt-2 ${lucroMes < 0 ? 'text-red-200' : ''}`}>{fmt(lucroMes)}</p>
              <p className="text-[10px] text-emerald-100/70 mt-1">Faturamento − Imposto − Custos</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lucro Líquido Ano</p>
              <p className="text-3xl font-black text-emerald-400 mt-2">{fmt(lucroAno)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Acumulado {anoAtivo}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-2xl shadow-sm">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">Projeção Anual Líquida</p>
              <p className="text-3xl font-black mt-2">{fmt(projecaoAnual)}</p>
              <p className="text-[10px] text-blue-200/70 mt-1">Média dos meses com movimento × 12</p>
            </div>
          </div>

          {/* Gráfico mês a mês */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Evolução Mensal — {anoAtivo}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Faturamento, custos totais e lucro líquido por mês</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dadosGrafico} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<TooltipCustom />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="Faturamento" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="Custos"      fill="#f87171" radius={[4,4,0,0]} />
                <Bar dataKey="Lucro"       fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── NOTAS FISCAIS ─────────────────────────────────────────────────── */}
      {subAba === 'notas' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Notas Fiscais</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {notasMes.length} nota{notasMes.length !== 1 ? 's' : ''} em {MESES_FULL[Number(mesAtivo)-1]}/{anoAtivo}
                &nbsp;·&nbsp; Total: <span className="font-bold text-emerald-600">{fmt(faturamentoMes)}</span>
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tomador</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Imposto</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {notasMes.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm font-semibold">
                    Nenhuma nota fiscal neste período.
                  </td></tr>
                ) : notasMes.map(nota => (
                  <tr key={nota.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5 text-slate-500 text-xs font-semibold whitespace-nowrap">{fmtData(nota.data_emissao)}</td>
                    <td className="py-3.5 px-5">
                      <span className="bg-blue-50 text-blue-700 font-black text-[11px] px-2 py-0.5 rounded-lg font-mono tracking-wide">
                        #{nota.numero_nota}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 text-xs max-w-[200px] truncate font-medium">
                      {nota.tomador === 'O tomador e o intermediário não foram identificados pelo emitente' || nota.tomador === 'Tomador e Intermediário não identificados'
                        ? <span className="text-slate-400 italic">Não identificado</span>
                        : nota.tomador}
                    </td>
                    <td className="py-3.5 px-5 text-slate-700 text-xs max-w-[240px] truncate">{nota.servico}</td>
                    <td className="py-3.5 px-5 text-right font-black text-emerald-600 text-sm whitespace-nowrap">{fmt(Number(nota.valor))}</td>
                    <td className="py-3.5 px-5 text-right text-xs text-slate-400 whitespace-nowrap">
                      {fmt(Number(nota.valor) * (Number(nota.aliquota_imposto) / 100))}
                      <span className="ml-1 text-[10px] text-slate-300">({nota.aliquota_imposto}%)</span>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => abrirEditarNota(nota)}
                          className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deletar('empresa_notas_fiscais', nota.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {notasMes.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-100 bg-slate-50/80">
                    <td colSpan={4} className="py-3 px-5 text-xs font-black text-slate-500 uppercase tracking-wider">Total do Período</td>
                    <td className="py-3 px-5 text-right font-black text-emerald-700">{fmt(faturamentoMes)}</td>
                    <td className="py-3 px-5 text-right font-bold text-amber-600 text-xs">{fmt(impostoMes)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── DESPESAS ──────────────────────────────────────────────────────── */}
      {subAba === 'despesas' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Despesas e Custos</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {despesasMes.length} registro{despesasMes.length !== 1 ? 's' : ''}
                &nbsp;·&nbsp; Total: <span className="font-bold text-rose-600">{fmt(custosMes)}</span>
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodicidade</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                  <th className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {despesasMes.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm font-semibold">
                    Nenhuma despesa neste período.
                  </td></tr>
                ) : despesasMes.map(desp => (
                  <tr key={desp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2.5 py-1 rounded-lg uppercase tracking-wide">
                        {TIPO_LABEL[desp.tipo] || desp.tipo}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-700 text-xs font-semibold">{desp.descricao || '—'}</td>
                    <td className="py-3.5 px-5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${desp.periodicidade === 'Anual' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {desp.periodicidade}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-xs font-medium">{fmtData(desp.data_vencimento)}</td>
                    <td className="py-3.5 px-5 text-right font-black text-rose-600 text-sm whitespace-nowrap">
                      {fmt(Number(desp.valor))}
                      {desp.periodicidade === 'Anual' && (
                        <span className="ml-1 text-[10px] text-slate-400 font-normal">({fmt(Number(desp.valor)/12)}/mês)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => abrirEditarDespesa(desp)}
                          className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deletar('empresa_despesas', desp.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {despesasMes.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-100 bg-slate-50/80">
                    <td colSpan={4} className="py-3 px-5 text-xs font-black text-slate-500 uppercase tracking-wider">Total do Período</td>
                    <td className="py-3 px-5 text-right font-black text-rose-700">{fmt(custosMes)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── RELATÓRIOS ────────────────────────────────────────────────────── */}
      {subAba === 'relatorios' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-sm font-extrabold text-slate-800">Relatório Mensal — {anoAtivo}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Consolidado mês a mês: faturamento, impostos, custos e lucro líquido</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Mês','Faturamento','Alíquota','Imposto Est.','Custos','Lucro Líquido'].map(h => (
                      <th key={h} className="py-3 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {MESES_ABREV.map((mes, i) => {
                    const mKey = String(i + 1).padStart(2, '0')
                    const pref = `${anoAtivo}-${mKey}`
                    const nM   = notas.filter(n => n.data_emissao?.startsWith(pref))
                    const fat  = nM.reduce((s, n) => s + Number(n.valor), 0)
                    const al   = i >= 5 ? 0.07 : 0.06
                    const imp  = fat * al
                    const cust = despesas.reduce((s, d) => {
                      const v = Number(d.valor)
                      if (d.periodicidade === 'Anual') return s + v / 12
                      return d.data_vencimento?.startsWith(pref) ? s + v : s
                    }, 0)
                    const luc  = fat - imp - cust
                    const ativo = mesAtivo === mKey
                    return (
                      <tr key={mKey} className={`transition-colors ${ativo ? 'bg-blue-50/60' : 'hover:bg-slate-50/40'}`}>
                        <td className="py-3.5 px-5 font-black text-slate-800 text-xs">
                          {mes}
                          {ativo && <span className="ml-2 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">atual</span>}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-emerald-600 text-xs">{fat > 0 ? fmt(fat) : <span className="text-slate-300">—</span>}</td>
                        <td className="py-3.5 px-5 text-right text-slate-400 text-xs">{(al * 100).toFixed(0)}%</td>
                        <td className="py-3.5 px-5 text-right text-amber-600 text-xs font-semibold">{fat > 0 ? fmt(imp) : <span className="text-slate-300">—</span>}</td>
                        <td className="py-3.5 px-5 text-right text-rose-600 text-xs font-semibold">{cust > 0 ? fmt(cust) : <span className="text-slate-300">—</span>}</td>
                        <td className={`py-3.5 px-5 text-right font-black text-sm ${fat === 0 ? 'text-slate-300' : luc >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {fat > 0 || cust > 0 ? fmt(luc) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="py-3.5 px-5 text-xs font-black text-slate-600 uppercase tracking-wider">Total</td>
                    <td className="py-3.5 px-5 text-right font-black text-emerald-700">{fmt(faturamentoAno)}</td>
                    <td className="py-3.5 px-5 text-right text-slate-400 text-xs">—</td>
                    <td className="py-3.5 px-5 text-right font-black text-amber-700">{fmt(impostoAno)}</td>
                    <td className="py-3.5 px-5 text-right font-black text-rose-700">{fmt(custosAno)}</td>
                    <td className={`py-3.5 px-5 text-right font-black text-base ${lucroAno >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmt(lucroAno)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mini gráfico no relatório */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-800 mb-4">Faturamento vs. Lucro — {anoAtivo}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dadosGrafico} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="Faturamento" fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="Lucro"       fill="#10b981" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── MODAL: Nova/Editar Nota ───────────────────────────────────────── */}
      {modalNota && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800">{idEditando ? 'Editar Nota Fiscal' : 'Lançar Nota Fiscal'}</h3>
              <button onClick={() => { setModalNota(false); setIdEditando(null) }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <form onSubmit={salvarNota} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Número</label>
                  <input type="text" required placeholder="001" value={novaNota.numero_nota} onChange={e => setNovaNota({...novaNota, numero_nota: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Data de Emissão</label>
                  <input type="date" required value={novaNota.data_emissao} onChange={e => setNovaNota({...novaNota, data_emissao: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tomador</label>
                <input type="text" placeholder="Nome do tomador (opcional)" value={novaNota.tomador} onChange={e => setNovaNota({...novaNota, tomador: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Serviço</label>
                <input type="text" required placeholder="Descrição do serviço prestado" value={novaNota.servico} onChange={e => setNovaNota({...novaNota, servico: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Valor Bruto (R$)</label>
                <input type="number" step="0.01" required placeholder="0,00" value={novaNota.valor} onChange={e => setNovaNota({...novaNota, valor: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
              </div>
              {novaNota.data_emissao && (
                <p className="text-[10px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                  <Info size={10} className="inline mr-1" />
                  Alíquota aplicada: <strong>{Number(novaNota.data_emissao.split('-')[1]) >= 6 ? '7,00%' : '6,00%'}</strong> (Simples Nacional)
                </p>
              )}
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm">
                {idEditando ? 'Salvar Alterações' : 'Lançar Nota Fiscal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Nova/Editar Despesa ────────────────────────────────────── */}
      {modalDespesa && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800">{idEditando ? 'Editar Despesa' : 'Lançar Despesa'}</h3>
              <button onClick={() => { setModalDespesa(false); setIdEditando(null) }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <form onSubmit={salvarDespesa} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tipo</label>
                  <select value={novaDespesa.tipo} onChange={e => setNovaDespesa({...novaDespesa, tipo: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 text-slate-700">
                    <option value="CONTABILIDADE">Contabilidade</option>
                    <option value="CERTIFICADO_DIGITAL">Certificado Digital</option>
                    <option value="IMPOSTOS">Impostos</option>
                    <option value="PRO LABORE">Pró-labore</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Periodicidade</label>
                  <select value={novaDespesa.periodicidade} onChange={e => setNovaDespesa({...novaDespesa, periodicidade: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 text-slate-700">
                    <option value="Mensal">Mensal</option><option value="Anual">Anual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Descrição</label>
                <input type="text" required placeholder="Ex: Honorários contábeis" value={novaDespesa.descricao} onChange={e => setNovaDespesa({...novaDespesa, descricao: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" required placeholder="0,00" value={novaDespesa.valor} onChange={e => setNovaDespesa({...novaDespesa, valor: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vencimento</label>
                  <input type="date" value={novaDespesa.data_vencimento} onChange={e => setNovaDespesa({...novaDespesa, data_vencimento: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400" />
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm">
                {idEditando ? 'Salvar Alterações' : 'Lançar Despesa'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Controle de Fechamento ─────────────────────────────────── */}
      {modalFechamento && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800">Controle de Competência</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Data de fechamento das notas fiscais</p>
              </div>
              <button onClick={() => setModalFechamento(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <form onSubmit={salvarFechamento} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Notas lançadas até a data</label>
                <input type="date" required value={formFechamento.data_limite} onChange={e => setFormFechamento({...formFechamento, data_limite: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Horário limite</label>
                <input type="time" value={formFechamento.horario_limite} onChange={e => setFormFechamento({...formFechamento, horario_limite: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Observação</label>
                <input type="text" placeholder="Ex: Para novas notas, considere a partir de 01/06/2026" value={formFechamento.observacao} onChange={e => setFormFechamento({...formFechamento, observacao: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-400" />
              </div>
              <button type="submit" disabled={salvandoFechamento}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-60">
                {salvandoFechamento ? 'Salvando...' : 'Salvar Controle'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
