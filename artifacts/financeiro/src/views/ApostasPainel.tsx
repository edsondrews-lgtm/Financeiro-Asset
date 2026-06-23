import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  TrendingUp, TrendingDown, Plus, X, Edit2, Trash2,
  AlertTriangle, ChevronLeft, ChevronRight, Target,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Lancamento {
  id: string;
  data: string;
  casa: string;
  tipo: string;
  valor: number;
  observacao: string | null;
  created_at: string;
}

interface Toast {
  id: number;
  tipo: 'sucesso' | 'erro';
  msg: string;
}

const CASAS = ['Granawin', 'BetandYou', 'BetLabel'];

const CASA_CFG: Record<string, { bg: string; text: string; accent: string; border: string }> = {
  'Granawin':  { bg: 'bg-emerald-600', text: 'text-white', accent: '#059669', border: 'border-emerald-200' },
  'BetandYou': { bg: 'bg-blue-600',    text: 'text-white', accent: '#2563EB', border: 'border-blue-200'    },
  'BetLabel':  { bg: 'bg-violet-600',  text: 'text-white', accent: '#7c3aed', border: 'border-violet-200'  },
};

const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtData(d: string) {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}
function mesAtualYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function navegarMes(ym: string, dir: number) {
  const [a, m] = ym.split('-').map(Number);
  const d = new Date(a, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function labelMesYM(ym: string) {
  const [a, m] = ym.split('-').map(Number);
  if (!m || m < 1 || m > 12) return ym;
  return `${MESES_LABEL[m - 1]}/${String(a).slice(2)}`;
}

const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400 hover:border-slate-300 transition-colors';
const inputClsErr = 'w-full px-3 py-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-400 transition-colors';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
      {children}
      {error && <p className="text-[10px] font-bold text-rose-500">{error}</p>}
    </div>
  );
}

type SubAba = 'dashboard' | 'lancamentos';
const formInicial = { data: new Date().toISOString().split('T')[0], casa: 'Granawin', tipo: 'DEPOSITO', valor: '', observacao: '' };

// ── componente ────────────────────────────────────────────────────────────────
export default function ApostasPainel() {
  const [subAba,      setSubAba]      = useState<SubAba>('dashboard');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [modal,       setModal]       = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [form,        setForm]        = useState({ ...formInicial });
  const [mesFiltro,   setMesFiltro]   = useState(mesAtualYM());
  const [casaFiltro,  setCasaFiltro]  = useState('TODAS');
  const [toast,       setToast]       = useState<Toast | null>(null);
  const [errosForm,   setErrosForm]   = useState<Record<string, string>>({});

  // toast automático
  const showToast = useCallback((tipo: Toast['tipo'], msg: string) => {
    setToast({ id: Date.now(), tipo, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('apostas_lancamentos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLancamentos(data ?? []);
    } catch (e: any) {
      console.error(e);
      showToast('erro', 'Erro ao carregar lançamentos');
    } finally { setLoading(false); }
  }

  function validarForm(): boolean {
    const errs: Record<string, string> = {};
    const v = parseFloat(form.valor);
    if (!form.valor || isNaN(v) || v <= 0) errs.valor = 'Informe um valor maior que zero';
    if (!form.data) errs.data = 'Informe a data';
    setErrosForm(errs);
    return Object.keys(errs).length === 0;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!validarForm()) return;

    setSaving(true);
    try {
      const dados = {
        data: form.data, casa: form.casa, tipo: form.tipo,
        valor: parseFloat(form.valor),
        observacao: form.observacao || null,
        updated_at: new Date().toISOString(),
      };
      let res;
      if (editId) res = await supabase.from('apostas_lancamentos').update(dados).eq('id', editId);
      else        res = await supabase.from('apostas_lancamentos').insert([dados]);

      if (res.error) throw res.error;
      showToast('sucesso', editId ? 'Lançamento atualizado' : 'Lançamento registrado');
      fecharModal();
      await carregar();
    } catch (e: any) {
      console.error(e);
      showToast('erro', e?.message ?? 'Erro ao salvar lançamento');
    } finally { setSaving(false); }
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      const { error } = await supabase.from('apostas_lancamentos').delete().eq('id', id);
      if (error) throw error;
      showToast('sucesso', 'Lançamento excluído');
      await carregar();
    } catch (e: any) {
      console.error(e);
      showToast('erro', e?.message ?? 'Erro ao excluir');
    }
  }

  function editar(l: Lancamento) {
    setEditId(l.id);
    setForm({ data: l.data, casa: l.casa, tipo: l.tipo, valor: String(l.valor), observacao: l.observacao ?? '' });
    setErrosForm({});
    setModal(true);
  }

  function fecharModal() { setModal(false); setEditId(null); setForm({ ...formInicial }); setErrosForm({}); }

  // ── cálculos globais ──────────────────────────────────────────────────────
  const totalDepositos = lancamentos.filter(l => l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
  const totalSaques    = lancamentos.filter(l => l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
  const resultado      = totalSaques - totalDepositos;
  const roi            = totalDepositos > 0 ? (resultado / totalDepositos) * 100 : 0;

  // ── tendência mês a mês ──────────────────────────────────────────────────
  const mesAtual = mesAtualYM();
  const mesAnterior = navegarMes(mesAtual, -1);

  function resultadoMes(ym: string) {
    const dep = lancamentos.filter(l => l.data.startsWith(ym) && l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
    const saq = lancamentos.filter(l => l.data.startsWith(ym) && l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
    return saq - dep;
  }

  const resMesAtual    = resultadoMes(mesAtual);
  const resMesAnterior = resultadoMes(mesAnterior);
  const temHistorico   = lancamentos.some(l => l.data.startsWith(mesAnterior));
  const tendencia      = temHistorico && resMesAnterior !== 0
    ? ((resMesAtual - resMesAnterior) / Math.abs(resMesAnterior)) * 100
    : null;
  const tendenciaMelhorando = tendencia !== null ? resMesAtual > resMesAnterior : null;

  // por casa
  const statsCasa = CASAS.map(casa => {
    const dep = lancamentos.filter(l => l.casa === casa && l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
    const saq = lancamentos.filter(l => l.casa === casa && l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
    const res = saq - dep;
    const r   = dep > 0 ? (res / dep) * 100 : 0;
    return { casa, dep, saq, res, roi: r };
  });

  // evolução mensal — últimos 12 meses (sem Math.round para manter precisão)
  const evolucaoMensal = (() => {
    const meses: { mes: string; depositos: number; saques: number; resultado: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const ym  = navegarMes(mesAtualYM(), -i);
      const dep = lancamentos.filter(l => l.data.startsWith(ym) && l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
      const saq = lancamentos.filter(l => l.data.startsWith(ym) && l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
      meses.push({ mes: labelMesYM(ym), depositos: dep, saques: saq, resultado: saq - dep });
    }
    return meses;
  })();

  // lista filtrada
  const listaFiltrada = lancamentos
    .filter(l => casaFiltro === 'TODAS' || l.casa === casaFiltro)
    .filter(l => mesFiltro === 'TODOS' || l.data.startsWith(mesFiltro));

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-bold transition-all animate-in slide-in-from-top-4 ${
            toast.tipo === 'sucesso' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}>
            {toast.tipo === 'sucesso' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800 rounded-2xl text-white shadow-lg">
              <Target size={20}/>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Apostas</h1>
              <p className="text-slate-400 text-[10px] sm:text-xs font-semibold mt-0.5">Granawin · BetandYou · controle de depósitos e saques</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              {(['dashboard','lancamentos'] as SubAba[]).map(id => (
                <button key={id} onClick={() => setSubAba(id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${subAba === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {id === 'dashboard' ? 'Dashboard' : 'Lanç.'}
                </button>
              ))}
            </div>
            <button onClick={() => { setEditId(null); setForm({ ...formInicial }); setErrosForm({}); setModal(true); }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-xl transition-colors shadow-sm">
              <Plus size={13}/> <span className="hidden sm:inline">Novo lançamento</span><span className="sm:hidden">Novo</span>
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/>
            Carregando...
          </div>
        )}

        {/* ══════════════════════ DASHBOARD ══════════════════════ */}
        {subAba === 'dashboard' && (
          <div className="space-y-5">

            {/* Hero resultado geral + tendência */}
            <div className={`rounded-2xl p-5 sm:p-6 text-white shadow-xl ${resultado >= 0 ? 'bg-gradient-to-br from-emerald-600 to-teal-600' : 'bg-gradient-to-br from-rose-600 to-red-700'}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-2">Resultado geral · todas as casas</p>
                  <p className="text-3xl sm:text-4xl font-black tracking-tight">
                    {resultado >= 0 ? '+' : '−'} R$ {fmtBRL(Math.abs(resultado))}
                  </p>
                </div>
                {/* Tendência mês a mês */}
                {tendencia !== null && tendenciaMelhorando !== null && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold self-start ${
                    tendenciaMelhorando ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'
                  }`}>
                    {tendenciaMelhorando ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                    {tendencia >= 0 ? '+' : ''}{tendencia.toFixed(1)}% vs mês anterior
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-5">
                <div>
                  <p className="text-[9px] sm:text-[10px] opacity-60 uppercase tracking-widest mb-1">Depositado</p>
                  <p className="text-base sm:text-lg font-black">R$ {fmtBRL(totalDepositos)}</p>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] opacity-60 uppercase tracking-widest mb-1">Sacado</p>
                  <p className="text-base sm:text-lg font-black">R$ {fmtBRL(totalSaques)}</p>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] opacity-60 uppercase tracking-widest mb-1">ROI geral</p>
                  <p className="text-base sm:text-lg font-black">{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Alerta motivacional */}
            {resultado < 0 && (
              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl items-start">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-sm font-black text-amber-900">Atenção ao saldo</p>
                  <p className="text-xs text-amber-700 font-medium mt-1">
                    Prejuízo acumulado de <strong>R$ {fmtBRL(Math.abs(resultado))}</strong>.
                    {temHistorico && tendenciaMelhorando === false && ' O resultado piorou frente ao mês anterior.'}
                  </p>
                </div>
              </div>
            )}

            {/* Cards por casa */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {statsCasa.map(s => {
                const cfg = CASA_CFG[s.casa];
                const positivo = s.res >= 0;
                return (
                  <div key={s.casa} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className={`${cfg.bg} px-5 py-4`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${cfg.text} opacity-70 mb-1`}>{s.casa}</p>
                      <p className={`text-2xl font-black ${cfg.text}`}>
                        {positivo ? '+' : '−'} R$ {fmtBRL(Math.abs(s.res))}
                      </p>
                      <p className={`text-[11px] ${cfg.text} opacity-60 mt-0.5`}>
                        {positivo ? '▲ Lucro' : '▼ Prejuízo'} · ROI {s.roi >= 0 ? '+' : ''}{s.roi.toFixed(1)}%
                      </p>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      <div className="px-5 py-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Depositado</p>
                        <p className="text-base font-black text-rose-600">R$ {fmtBRL(s.dep)}</p>
                      </div>
                      <div className="px-5 py-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sacado</p>
                        <p className="text-base font-black text-emerald-600">R$ {fmtBRL(s.saq)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gráfico evolução mensal — cores dinâmicas */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Resultado mensal — últimos 12 meses</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={evolucaoMensal} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip
                    formatter={(v: number) => [`R$ ${fmtBRL(v)}`, 'Resultado']}
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}
                  />
                  <ReferenceLine y={0} stroke="#e2e8f0"/>
                  <Bar dataKey="resultado" radius={[3,3,0,0]}>
                    {evolucaoMensal.map((entry, idx) => (
                      <Cell key={idx} fill={entry.resultado >= 0 ? '#10b981' : '#f43f5e'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"/>Lucro
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                  <span className="w-3 h-3 rounded bg-rose-400 inline-block"/>Prejuízo
                </span>
              </div>
            </div>

            {/* Gráfico depósitos vs saques */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Depósitos vs saques — últimos 12 meses</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={evolucaoMensal} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip
                    formatter={(v: number, n: string) => [`R$ ${fmtBRL(v)}`, n === 'depositos' ? 'Depósitos' : 'Saques']}
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}
                  />
                  <Bar dataKey="depositos" fill="#f43f5e" radius={[3,3,0,0]} name="depositos"/>
                  <Bar dataKey="saques"    fill="#10b981" radius={[3,3,0,0]} name="saques"/>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                {[['#f43f5e','Depósitos'],['#10b981','Saques']].map(([c,l]) => (
                  <span key={l} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                    <span className="w-3 h-3 rounded inline-block" style={{ background: c }}/>{l}
                  </span>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════ LANÇAMENTOS ══════════════════════ */}
        {subAba === 'lancamentos' && (
          <div className="space-y-4">

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {['TODAS', ...CASAS].map(c => (
                  <button key={c} onClick={() => setCasaFiltro(c)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      casaFiltro === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    }`}>
                    {c === 'TODAS' ? 'Todas as casas' : c}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5">
                <button onClick={() => setMesFiltro('TODOS')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    mesFiltro === 'TODOS' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}>
                  Todos
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1"/>
                <button onClick={() => setMesFiltro(m => navegarMes(m, -1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <ChevronLeft size={14}/>
                </button>
                <span className="text-xs font-bold text-slate-700 px-2 min-w-[70px] text-center">{labelMesYM(mesFiltro)}</span>
                <button onClick={() => setMesFiltro(m => navegarMes(m, 1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                  <ChevronRight size={14}/>
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm font-black text-slate-800">Lançamentos</p>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">{listaFiltrada.length} registro{listaFiltrada.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {listaFiltrada.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Nenhum lançamento no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Data','Casa','Tipo','Valor','Obs.',''].map((h, i) => (
                          <th key={i} className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {listaFiltrada.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50/60 transition-colors group/row">
                          <td className="py-3 text-[11px] text-slate-400 font-medium pr-3">{fmtData(l.data)}</td>
                          <td className="py-3 pr-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold text-white ${CASA_CFG[l.casa]?.bg ?? 'bg-slate-500'}`}>
                              {l.casa}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${l.tipo === 'DEPOSITO' ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {l.tipo === 'DEPOSITO' ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                              {l.tipo === 'DEPOSITO' ? 'Depósito' : 'Saque'}
                            </span>
                          </td>
                          <td className={`py-3 text-xs font-black pr-3 ${l.tipo === 'DEPOSITO' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {l.tipo === 'DEPOSITO' ? '− ' : '+ '}R$ {fmtBRL(Number(l.valor))}
                          </td>
                          <td className="py-3 text-[11px] text-slate-400 pr-3 max-w-[160px] truncate">
                            {l.observacao ?? '—'}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button onClick={() => editar(l)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={12}/></button>
                              <button onClick={() => deletar(l.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={12}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
            <button onClick={fecharModal} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={15}/></button>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{editId ? 'Editar lançamento' : 'Novo lançamento'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Registre um depósito ou saque</p>
            </div>
            <form onSubmit={salvar} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data" error={errosForm.data}>
                  <input required type="date" className={errosForm.data ? inputClsErr : inputCls} value={form.data} onChange={e => { setForm({ ...form, data: e.target.value }); setErrosForm(p => ({ ...p, data: '' })); }}/>
                </Field>
                <Field label="Casa">
                  <select className={inputCls} value={form.casa} onChange={e => setForm({ ...form, casa: e.target.value })}>
                    {CASAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Tipo">
                <div className="grid grid-cols-2 gap-2">
                  {(['DEPOSITO','SAQUE'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, tipo: t })}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        form.tipo === t
                          ? t === 'DEPOSITO' ? 'bg-rose-600 text-white border-rose-600' : 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400'
                      }`}>
                      {t === 'DEPOSITO' ? '↓ Depósito' : '↑ Saque'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Valor (R$)" error={errosForm.valor}>
                <input required type="number" step="0.01" min="0.01" className={errosForm.valor ? inputClsErr : inputCls} placeholder="0,00" value={form.valor}
                  onChange={e => { setForm({ ...form, valor: e.target.value }); setErrosForm(p => ({ ...p, valor: '' })); }}/>
              </Field>
              <Field label="Observação (opcional)">
                <input type="text" className={inputCls} placeholder="Ex: bônus de boas-vindas..." value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })}/>
              </Field>
              <button type="submit" disabled={saving}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                {editId ? 'Salvar alterações' : 'Registrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
