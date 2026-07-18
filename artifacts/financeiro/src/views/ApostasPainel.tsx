import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  TrendingUp, TrendingDown, Plus, X, Edit2, Trash2,
  AlertTriangle, ChevronLeft, ChevronRight, Target,
  CheckCircle2, AlertCircle, Eye, EyeOff, BarChart2,
  ArrowUpRight, ArrowDownRight, Wallet, Activity,
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

const CASAS = ['Granawin', 'BetandYou', 'BetLabel', 'WinWin', 'Bet365', 'BetSnipe'];

const CASA_CFG: Record<string, { bg: string; text: string; accent: string; border: string; highlight: string }> = {
  'Granawin':  { bg: 'bg-emerald-600', text: 'text-white', accent: '#059669', border: 'border-emerald-200', highlight: '#05966915' },
  'BetandYou': { bg: 'bg-blue-600',    text: 'text-white', accent: '#2563EB', border: 'border-blue-200',    highlight: '#2563EB15' },
  'BetLabel':  { bg: 'bg-violet-600',  text: 'text-white', accent: '#7c3aed', border: 'border-violet-200',  highlight: '#7c3aed15' },
  'WinWin':    { bg: 'bg-orange-600',  text: 'text-white', accent: '#EA580C', border: 'border-orange-200',  highlight: '#EA580C15' },
  'Bet365':    { bg: 'bg-sky-600',     text: 'text-white', accent: '#0284c7', border: 'border-sky-200',     highlight: '#0284c715' },
  'BetSnipe':  { bg: 'bg-rose-600',    text: 'text-white', accent: '#e11d48', border: 'border-rose-200',    highlight: '#e11d4815' },
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
  const [a, m] = ym.split('-').map(s => parseInt(s, 10));
  if (!m || m < 1 || m > 12) return ym;
  return `${MESES_LABEL[m - 1]}/${String(a).slice(2)}`;
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none transition-colors';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</label>
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

  const [mesDashboard, setMesDashboard] = useState(mesAtualYM());
  const [privado, setPrivado] = useState(false);
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setPrivado(document.documentElement.classList.contains('valores-ocultos'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setPrivado(document.documentElement.classList.contains('valores-ocultos'));
    return () => obs.disconnect();
  }, []);

  const privCls = privado ? 'privado' : '';

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

  // ── cálculos do mês selecionado no dashboard ───────────────────────────
  const lancMes    = lancamentos.filter(l => l.data.startsWith(mesDashboard));
  const depMes     = lancMes.filter(l => l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
  const saqMes     = lancMes.filter(l => l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
  const resMes     = saqMes - depMes;
  const roiMes     = depMes > 0 ? (resMes / depMes) * 100 : 0;

  // tendência: mês selecionado vs mês anterior
  const mesAnteriorDash = navegarMes(mesDashboard, -1);
  function calcResMes(ym: string) {
    const d = lancamentos.filter(l => l.data.startsWith(ym) && l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
    const s = lancamentos.filter(l => l.data.startsWith(ym) && l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
    return s - d;
  }
  const resMesAnterior  = calcResMes(mesAnteriorDash);
  const temHistorico    = lancamentos.some(l => l.data.startsWith(mesAnteriorDash));
  const tendencia       = temHistorico && resMesAnterior !== 0
    ? ((resMes - resMesAnterior) / Math.abs(resMesAnterior)) * 100
    : null;
  const tendenciaMelhorando = tendencia !== null ? resMes > resMesAnterior : null;

  // por casa — filtrado pelo mês selecionado, só exibe casas com lançamentos no mês
  const casasComLancamentos = CASAS.filter(casa => lancMes.some(l => l.casa === casa));

  const statsCasa = casasComLancamentos.map(casa => {
    const dep = lancMes.filter(l => l.casa === casa && l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
    const saq = lancMes.filter(l => l.casa === casa && l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
    const res = saq - dep;
    const r   = dep > 0 ? (res / dep) * 100 : 0;
    return { casa, dep, saq, res, roi: r };
  });

  // evolução mensal
  const evolucaoMensal = (() => {
    const agrupado: Record<string, { depositos: number; saques: number }> = {};
    for (const l of lancamentos) {
      const parts = l.data.split('-');
      const ym = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : l.data.slice(0, 7);
      if (!agrupado[ym]) agrupado[ym] = { depositos: 0, saques: 0 };
      if (l.tipo === 'DEPOSITO') agrupado[ym].depositos += Number(l.valor);
      else agrupado[ym].saques += Number(l.valor);
    }
    const chaves = Object.keys(agrupado).sort();
    return chaves.map(ym => ({
      mes: labelMesYM(ym),
      depositos: agrupado[ym].depositos,
      saques: agrupado[ym].saques,
      resultado: agrupado[ym].saques - agrupado[ym].depositos,
    }));
  })();

  // lista filtrada
  const listaFiltrada = lancamentos
    .filter(l => casaFiltro === 'TODAS' || l.casa === casaFiltro)
    .filter(l => mesFiltro === 'TODOS' || l.data.startsWith(mesFiltro));

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
      <div className="p-10 space-y-8 max-w-7xl mx-auto">

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
            <div className="p-3 rounded-2xl shadow-lg" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              <Target size={20}/>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Apostas</h1>
              <p className="text-[10px] sm:text-xs font-semibold mt-0.5 flex items-center gap-1 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                {CASAS.map((c, i) => (
                  <React.Fragment key={c}>
                    {i > 0 && <span>·</span>}
                    <span className="px-1.5 py-0.5 rounded" style={{ color: CASA_CFG[c].accent, backgroundColor: CASA_CFG[c].highlight }}>{c}</span>
                  </React.Fragment>
                ))}
                <span className="ml-1">· controle de depósitos e saques</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <div className="flex items-center rounded-xl p-1 shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              {(['dashboard','lancamentos'] as SubAba[]).map(id => (
                <button key={id} onClick={() => setSubAba(id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${subAba === id ? 'text-white shadow-sm' : 'hover:opacity-80'}`}
                  style={subAba === id ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' } : { color: 'var(--text-muted)' }}>
                  {id === 'dashboard' ? 'Dashboard' : 'Lanç.'}
                </button>
              ))}
            </div>
            <button onClick={() => { setEditId(null); setForm({ ...formInicial }); setErrosForm({}); setModal(true); }}
              className="flex items-center gap-1.5 text-xs font-bold px-3 sm:px-4 py-2 rounded-xl transition-colors shadow-sm"
              style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
              <Plus size={13}/> <span className="hidden sm:inline">Novo lançamento</span><span className="sm:hidden">Novo</span>
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }}/>
            Carregando...
          </div>
        )}

        {/* ══════════════════════ DASHBOARD ══════════════════════ */}
        {subAba === 'dashboard' && (
          <div className="space-y-5">

            {/* ── Seletor de mês (controla todo o dashboard) ── */}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                Exibindo dados de <span style={{ color: 'var(--text-primary)' }}>{labelMesYM(mesDashboard)}</span>
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setMesDashboard(m => navegarMes(m, -1))}
                  className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <ChevronLeft size={13}/>
                </button>
                <span className="text-xs font-black px-3 py-1.5 rounded-lg min-w-[72px] text-center" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  {labelMesYM(mesDashboard)}
                </span>
                <button onClick={() => setMesDashboard(m => navegarMes(m, +1))}
                  className="p-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <ChevronRight size={13}/>
                </button>
                <button onClick={() => setMesDashboard(mesAtualYM())}
                  className="ml-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--accent)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  Hoje
                </button>
              </div>
            </div>

            {lancMes.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sem lançamentos em {labelMesYM(mesDashboard)}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Navegue para outro mês ou adicione um lançamento.</p>
              </div>
            ) : (
              <>
            {/* Hero resultado do mês */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
              <div className={`px-6 py-5 ${resMes >= 0 ? 'bg-gradient-to-r from-emerald-600/10 to-teal-600/5' : 'bg-gradient-to-r from-rose-600/10 to-red-600/5'}`}
                style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${resMes >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                      <Target size={18} className={resMes >= 0 ? 'text-emerald-500' : 'text-rose-500'}/>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Resultado do Mês</p>
                      <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{labelMesYM(mesDashboard)} · Todas as casas</p>
                    </div>
                  </div>
                  {tendencia !== null && tendenciaMelhorando !== null && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold ${
                      tendenciaMelhorando ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                    }`}>
                      {tendenciaMelhorando ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                      {tendencia >= 0 ? '+' : ''}{tendencia.toFixed(1)}% vs {labelMesYM(mesAnteriorDash)}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-6">
                <p className={`text-4xl sm:text-5xl font-black tracking-tight ${privCls}`}
                  style={{ color: resMes >= 0 ? 'var(--chart-green)' : 'var(--chart-red)' }}>
                  {resMes >= 0 ? '+' : '−'} R$ {fmtBRL(Math.abs(resMes))}
                </p>
              </div>
            </div>

            {/* Stats grid do mês */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Depositado', value: depMes, icon: <ArrowDownRight size={14}/>, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                { label: 'Sacado',     value: saqMes, icon: <ArrowUpRight size={14}/>, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Resultado',  value: resMes, icon: <Activity size={14}/>, color: resMes >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: resMes >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
                { label: 'ROI',        value: null, roi: roiMes, icon: <BarChart2 size={14}/>, color: roiMes >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: roiMes >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10' },
              ].map((stat, i) => (
                <div key={i} className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                      <span className={stat.color}>{stat.icon}</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                  {stat.roi !== undefined ? (
                    <p className={`text-lg font-black ${stat.color} ${privCls}`}>{stat.roi >= 0 ? '+' : ''}{stat.roi.toFixed(1)}%</p>
                  ) : (
                    <p className={`text-lg font-black ${stat.color} ${privCls}`}>R$ {fmtBRL(Math.abs(stat.value!))}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Alerta motivacional */}
            {resMes < 0 && (
              <div className="flex gap-3 p-4 rounded-xl items-start" style={{ backgroundColor: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)' }}>
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--color-warning)' }}>Atenção ao saldo em {labelMesYM(mesDashboard)}</p>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Prejuízo de <strong className={privCls}>R$ {fmtBRL(Math.abs(resMes))}</strong> no mês.
                    {temHistorico && tendenciaMelhorando === false && ` Resultado piorou vs ${labelMesYM(mesAnteriorDash)}.`}
                  </p>
                </div>
              </div>
            )}

            {/* Cards por casa */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Por Casa</p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {statsCasa.map(s => {
                  const cfg = CASA_CFG[s.casa] ?? { accent: '#64748b', highlight: '#64748b15' };
                  const positivo = s.res >= 0;
                  return (
                    <div key={s.casa} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                      <div className="h-1" style={{ backgroundColor: cfg.accent }}/>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md" style={{ color: cfg.accent, backgroundColor: cfg.highlight }}>{s.casa}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${positivo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {positivo ? '▲ Lucro' : '▼ Prejuízo'}
                          </span>
                        </div>
                        <p className={`text-xl font-black mb-3 ${privCls}`}
                          style={{ color: positivo ? 'var(--chart-green)' : 'var(--chart-red)' }}>
                          {positivo ? '+' : '−'} R$ {fmtBRL(Math.abs(s.res))}
                        </p>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Depositado</p>
                            <p className={`text-xs font-black text-rose-500 ${privCls}`}>R$ {fmtBRL(s.dep)}</p>
                          </div>
                          <div className="w-px h-6" style={{ backgroundColor: 'var(--border-color)' }}/>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sacado</p>
                            <p className={`text-xs font-black text-emerald-500 ${privCls}`}>R$ {fmtBRL(s.saq)}</p>
                          </div>
                          <div className="w-px h-6" style={{ backgroundColor: 'var(--border-color)' }}/>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>ROI</p>
                            <p className={`text-xs font-black ${s.roi >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{s.roi >= 0 ? '+' : ''}{s.roi.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Resultado Mensal</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={evolucaoMensal} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                    <XAxis dataKey="mes" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                    <Tooltip
                      formatter={(v: number) => [`R$ ${fmtBRL(v)}`, 'Resultado']}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border-color)', boxShadow: 'none', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                    />
                    <ReferenceLine y={0} stroke="var(--border-color)"/>
                    <Bar dataKey="resultado" radius={[3,3,0,0]}>
                      {evolucaoMensal.map((entry, idx) => (
                        <Cell key={idx} fill={entry.resultado >= 0 ? 'var(--chart-green)' : 'var(--chart-red)'}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--chart-green)' }}/>Lucro
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--chart-red)' }}/>Prejuízo
                  </span>
                </div>
              </div>

              <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Depósitos vs Saques</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={evolucaoMensal} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false}/>
                    <XAxis dataKey="mes" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                    <Tooltip
                      formatter={(v: number, n: string) => [`R$ ${fmtBRL(v)}`, n === 'depositos' ? 'Depósitos' : 'Saques']}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border-color)', boxShadow: 'none', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                    />
                    <Bar dataKey="depositos" fill="var(--chart-red)" radius={[3,3,0,0]} name="depositos" opacity={0.8}/>
                    <Bar dataKey="saques"    fill="var(--chart-green)" radius={[3,3,0,0]} name="saques" opacity={0.8}/>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--chart-red)' }}/>Depósitos
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--chart-green)' }}/>Saques
                  </span>
                </div>
              </div>
            </div>
              </>
            )}

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
                    className="px-3 py-1 rounded-full text-[10px] font-bold border transition-all"
                    style={casaFiltro === c
                      ? (c === 'TODAS'
                        ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }
                        : { backgroundColor: CASA_CFG[c]?.highlight ?? 'var(--bg-elevated)', color: CASA_CFG[c]?.accent ?? 'var(--text-primary)', borderColor: CASA_CFG[c]?.accent ?? 'var(--border-color)' })
                      : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }
                    }>
                    {c === 'TODAS' ? 'Todas as casas' : c}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-xl px-2 py-1.5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <button onClick={() => setMesFiltro('TODOS')}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                  style={mesFiltro === 'TODOS'
                    ? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-muted)' }
                  }>
                  Todos
                </button>
                <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--border-color)' }}/>
                <button onClick={() => setMesFiltro(m => navegarMes(m, -1))} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <ChevronLeft size={14}/>
                </button>
                <span className="text-xs font-bold px-2 min-w-[70px] text-center" style={{ color: 'var(--text-primary)' }}>{labelMesYM(mesFiltro)}</span>
                <button onClick={() => setMesFiltro(m => navegarMes(m, 1))} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <ChevronRight size={14}/>
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Lançamentos</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>{listaFiltrada.length} registro{listaFiltrada.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {listaFiltrada.length === 0 ? (
                <p className="text-xs text-center py-10" style={{ color: 'var(--text-muted)' }}>Nenhum lançamento no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        {['Data','Casa','Tipo','Valor','Obs.',''].map((h, i) => (
                          <th key={i} className="pb-2.5 text-[10px] font-bold uppercase tracking-wider last:text-right" style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listaFiltrada.map(l => (
                        <tr key={l.id} className="transition-colors group/row" style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td className="py-3 text-[11px] font-medium pr-3" style={{ color: 'var(--text-muted)' }}>{fmtData(l.data)}</td>
                          <td className="py-3 pr-3">
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold"
                              style={{ color: CASA_CFG[l.casa]?.accent ?? '#64748b', backgroundColor: CASA_CFG[l.casa]?.highlight ?? '#64748b15' }}>
                              {l.casa}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${l.tipo === 'DEPOSITO' ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {l.tipo === 'DEPOSITO' ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                              {l.tipo === 'DEPOSITO' ? 'Depósito' : 'Saque'}
                            </span>
                          </td>
                          <td className={`py-3 text-xs font-black pr-3 ${l.tipo === 'DEPOSITO' ? 'text-rose-600' : 'text-emerald-600'} ${privCls}`}>
                            {l.tipo === 'DEPOSITO' ? '− ' : '+ '}R$ {fmtBRL(Number(l.valor))}
                          </td>
                          <td className="py-3 text-[11px] pr-3 max-w-[160px] truncate" style={{ color: 'var(--text-muted)' }}>
                            {l.observacao ?? '—'}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button onClick={() => editar(l)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><Edit2 size={12}/></button>
                              <button onClick={() => deletar(l.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={12}/></button>
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
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <button onClick={fecharModal} className="absolute right-4 top-4 p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}><X size={15}/></button>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{editId ? 'Editar lançamento' : 'Novo lançamento'}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Registre um depósito ou saque</p>
            </div>
            <form onSubmit={salvar} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data" error={errosForm.data}>
                  <input required type="date" className={inputCls} value={form.data}
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: `1px solid ${errosForm.data ? 'var(--color-danger)' : 'var(--border-color)'}`, color: 'var(--text-primary)' }}
                    onChange={e => { setForm({ ...form, data: e.target.value }); setErrosForm(p => ({ ...p, data: '' })); }}/>
                </Field>
                <Field label="Casa">
                  <select className={inputCls} value={form.casa}
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                    onChange={e => setForm({ ...form, casa: e.target.value })}>
                    {CASAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Tipo">
                <div className="grid grid-cols-2 gap-2">
                  {(['DEPOSITO','SAQUE'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, tipo: t })}
                      className="py-2.5 rounded-xl text-xs font-bold border transition-all"
                      style={form.tipo === t
                        ? t === 'DEPOSITO'
                          ? { backgroundColor: '#e11d48', color: 'white', borderColor: '#e11d48' }
                          : { backgroundColor: '#059669', color: 'white', borderColor: '#059669' }
                        : { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderColor: 'var(--border-color)' }
                      }>
                      {t === 'DEPOSITO' ? '↓ Depósito' : '↑ Saque'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Valor (R$)" error={errosForm.valor}>
                <input required type="number" step="0.01" min="0.01" className={inputCls} placeholder="0,00" value={form.valor}
                  style={{ backgroundColor: 'var(--bg-tertiary)', border: `1px solid ${errosForm.valor ? 'var(--color-danger)' : 'var(--border-color)'}`, color: 'var(--text-primary)' }}
                  onChange={e => { setForm({ ...form, valor: e.target.value }); setErrosForm(p => ({ ...p, valor: '' })); }}/>
              </Field>
              <Field label="Observação (opcional)">
                <input type="text" className={inputCls} placeholder="Ex: bônus de boas-vindas..." value={form.observacao}
                  style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  onChange={e => setForm({ ...form, observacao: e.target.value })}/>
              </Field>
              <button type="submit" disabled={saving}
                className="w-full font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
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