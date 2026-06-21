import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  Briefcase, Plus, X, Edit2, Trash2, TrendingUp,
  Info, AlertTriangle, ChevronLeft, ChevronRight,
  FileText, Target, Shield, BarChart2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, ReferenceLine,
} from 'recharts';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Lancamento {
  id: string;
  data: string;
  descricao: string;
  tipo: string; // DEPOSITO | RENDIMENTO | SAQUE | DISTRIBUICAO | REPOSICAO | REGULARIZACAO
  valor: number;
  saldo_total: number | null;
  origem: string;
  observacao: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtData(d: string) {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}

const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400 hover:border-slate-300 transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}

// ── config visual por tipo ────────────────────────────────────────────────────
const TIPO_CFG: Record<string, { label: string; bg: string; text: string; sinal: string }> = {
  DEPOSITO:       { label: 'Depósito',       bg: 'bg-emerald-50',  text: 'text-emerald-700', sinal: '+' },
  RENDIMENTO:     { label: 'Rendimento',     bg: 'bg-sky-50',      text: 'text-sky-700',     sinal: '+' },
  DISTRIBUICAO:   { label: 'Dist. Resultado',bg: 'bg-violet-50',   text: 'text-violet-700',  sinal: '+' },
  REPOSICAO:      { label: 'Reposição',      bg: 'bg-amber-50',    text: 'text-amber-700',   sinal: '+' },
  REGULARIZACAO:  { label: 'Regularização',  bg: 'bg-indigo-50',   text: 'text-indigo-700',  sinal: '+' },
  SAQUE:          { label: 'Saque',          bg: 'bg-rose-50',     text: 'text-rose-700',    sinal: '-' },
};

function getTipoCfg(tipo: string) {
  return TIPO_CFG[tipo] ?? { label: tipo, bg: 'bg-slate-100', text: 'text-slate-600', sinal: '+' };
}

type SubAba = 'dashboard' | 'historico';
const formInicial = { data: new Date().toISOString().split('T')[0], descricao: '', tipo: 'DEPOSITO', valor: '', saldo_total: '', observacao: '' };

// ── componente principal ──────────────────────────────────────────────────────
export default function FGTSPainel() {
  const [subAba,      setSubAba]      = useState<SubAba>('dashboard');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [modal,       setModal]       = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [form,        setForm]        = useState({ ...formInicial });
  const [filtroTipo,  setFiltroTipo]  = useState('TODOS');
  const [anoFiltro,   setAnoFiltro]   = useState('TODOS');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fgts_lancamentos')
        .select('*')
        .order('data', { ascending: true });
      setLancamentos(data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const isNegativo = form.tipo === 'SAQUE';
    const dados = {
      data: form.data,
      descricao: form.descricao,
      tipo: form.tipo,
      valor: isNegativo ? -Math.abs(parseFloat(form.valor)) : Math.abs(parseFloat(form.valor)),
      saldo_total: form.saldo_total ? parseFloat(form.saldo_total) : null,
      observacao: form.observacao || null,
      origem: 'MANUAL',
      updated_at: new Date().toISOString(),
    };
    if (editId) await supabase.from('fgts_lancamentos').update(dados).eq('id', editId);
    else        await supabase.from('fgts_lancamentos').insert([dados]);
    fecharModal(); carregar();
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este lançamento?')) return;
    await supabase.from('fgts_lancamentos').delete().eq('id', id);
    carregar();
  }

  function editar(l: Lancamento) {
    setEditId(l.id);
    setForm({
      data: l.data,
      descricao: l.descricao,
      tipo: l.tipo,
      valor: String(Math.abs(l.valor)),
      saldo_total: l.saldo_total ? String(l.saldo_total) : '',
      observacao: l.observacao ?? '',
    });
    setModal(true);
  }

  function fecharModal() {
    setModal(false); setEditId(null); setForm({ ...formInicial });
  }

  // ── cálculos ──────────────────────────────────────────────────────────────
  // saldo atual = último saldo_total registrado, ou soma de todos os valores
  const saldoAtual = (() => {
    const comSaldo = [...lancamentos].reverse().find(l => l.saldo_total != null);
    if (comSaldo) return Number(comSaldo.saldo_total);
    return lancamentos.reduce((a, l) => a + Number(l.valor), 0);
  })();

  const totalDepositos    = lancamentos.filter(l => l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
  const totalRendimentos  = lancamentos.filter(l => l.tipo === 'RENDIMENTO').reduce((a, l) => a + Number(l.valor), 0);
  const totalDistribuicao = lancamentos.filter(l => l.tipo === 'DISTRIBUICAO').reduce((a, l) => a + Number(l.valor), 0);
  const totalSaques       = lancamentos.filter(l => l.tipo === 'SAQUE').reduce((a, l) => a + Number(l.valor), 0);
  const totalRendidoTotal = totalRendimentos + totalDistribuicao;

  // multa rescisória 40%
  const multaRescisoriaValor = 40179.24; // valor do extrato
  const multaRescisoriaCalc  = saldoAtual * 0.40;

  // rendimento médio mensal (últimos 12 rendimentos JAM)
  const rend12 = lancamentos.filter(l => l.tipo === 'RENDIMENTO').slice(-12);
  const rendMedioMensal = rend12.length > 0
    ? rend12.reduce((a, l) => a + Number(l.valor), 0) / rend12.length : 0;

  // evolução anual — saldo final de cada ano
  const evolucaoPorAno = (() => {
    const anos = [...new Set(lancamentos.map(l => l.data.slice(0, 4)))].sort();
    return anos.map(ano => {
      const ultimo = [...lancamentos].filter(l => l.data.startsWith(ano) && l.saldo_total != null).pop();
      const deposAno = lancamentos.filter(l => l.data.startsWith(ano) && l.tipo === 'DEPOSITO').reduce((a, l) => a + Number(l.valor), 0);
      const rendAno  = lancamentos.filter(l => l.data.startsWith(ano) && (l.tipo === 'RENDIMENTO' || l.tipo === 'DISTRIBUICAO')).reduce((a, l) => a + Number(l.valor), 0);
      return { ano, saldo: ultimo ? Number(ultimo.saldo_total) : 0, depositos: Math.round(deposAno), rendimentos: Math.round(rendAno) };
    });
  })();

  // rendimentos mensais últimos 24
  const rendUlt24 = lancamentos
    .filter(l => l.tipo === 'RENDIMENTO')
    .slice(-24)
    .map(l => ({
      mes: `${MESES_LABEL[parseInt(l.data.slice(5, 7)) - 1]}/${l.data.slice(2, 4)}`,
      valor: Number(l.valor),
    }));

  // anos disponíveis para filtro
  const anosDisponiveis = [...new Set(lancamentos.map(l => l.data.slice(0, 4)))].sort().reverse();

  // lista filtrada para histórico
  const listaFiltrada = lancamentos
    .filter(l => filtroTipo === 'TODOS' || l.tipo === filtroTipo)
    .filter(l => anoFiltro === 'TODOS' || l.data.startsWith(anoFiltro))
    .reverse();

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-lg shadow-orange-100">
              <Briefcase size={20}/>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">FGTS</h1>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">
                Fundação Universidade Oeste de SC · Admissão: 10/02/2014 · Taxa: 3% a.a + TR
              </p>
            </div>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm self-start">
            {(['dashboard','historico'] as SubAba[]).map(id => (
              <button key={id} onClick={() => setSubAba(id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${subAba === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {id === 'dashboard' ? <><BarChart2 size={12}/> Dashboard</> : <><FileText size={12}/> Histórico</>}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-orange-600 font-bold">
            <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
            Carregando...
          </div>
        )}

        {/* ══════════════════════ DASHBOARD ══════════════════════ */}
        {subAba === 'dashboard' && (
          <div className="space-y-5">

            {/* Hero */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-xl">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-2">Saldo atual · Mai/2026</p>
              <p className="text-4xl font-black tracking-tight">R$ {fmtBRL(saldoAtual)}</p>
              <div className="grid grid-cols-3 gap-4 mt-5">
                <div>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Total depositado</p>
                  <p className="text-lg font-black">R$ {fmtBRL(totalDepositos)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Total rendido</p>
                  <p className="text-lg font-black">R$ {fmtBRL(totalRendidoTotal)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Rend. médio/mês</p>
                  <p className="text-lg font-black">R$ {fmtBRL(rendMedioMensal)}</p>
                  <p className="text-[9px] opacity-50">últimos 12 meses</p>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Depósitos totais',    value: `R$ ${fmtBRL(totalDepositos)}`,     sub: `${lancamentos.filter(l=>l.tipo==='DEPOSITO').length} lançamentos`,    color: 'text-emerald-700', bg: 'bg-emerald-50', icon: <TrendingUp size={14} className="text-emerald-600"/> },
                { label: 'Rendimentos JAM',     value: `R$ ${fmtBRL(totalRendimentos)}`,   sub: 'Juros sobre saldo mensal',                                           color: 'text-sky-700',     bg: 'bg-sky-50',     icon: <BarChart2 size={14} className="text-sky-600"/> },
                { label: 'Dist. de Resultado',  value: `R$ ${fmtBRL(totalDistribuicao)}`,  sub: `${lancamentos.filter(l=>l.tipo==='DISTRIBUICAO').length} distribuições anuais`, color: 'text-violet-700',  bg: 'bg-violet-50',  icon: <Target size={14} className="text-violet-600"/> },
                { label: 'Saques registrados',  value: `R$ ${fmtBRL(Math.abs(totalSaques))}`, sub: `${lancamentos.filter(l=>l.tipo==='SAQUE').length} saque(s) no extrato`, color: 'text-rose-700', bg: 'bg-rose-50',    icon: <AlertTriangle size={14} className="text-rose-600"/> },
              ].map(k => (
                <div key={k.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className={`p-1.5 rounded-lg w-fit mb-3 ${k.bg}`}>{k.icon}</div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.label}</p>
                  <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Multa rescisória */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-rose-50 rounded-lg"><Shield size={14} className="text-rose-600"/></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor para fins rescisórios</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Em caso de demissão sem justa causa (multa de 40%)</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-1">Valor do extrato (Mai/2026)</p>
                  <p className="text-2xl font-black text-rose-700">R$ {fmtBRL(multaRescisoriaValor)}</p>
                  <p className="text-[10px] text-rose-400 mt-1">Informado pela Caixa Econômica</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cálculo estimado (40% do saldo)</p>
                  <p className="text-2xl font-black text-slate-700">R$ {fmtBRL(multaRescisoriaCalc)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">40% × R$ {fmtBRL(saldoAtual)}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                  <Info size={13} className="text-amber-600 shrink-0 mt-0.5"/>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Em caso de demissão sem justa causa, você recebe o saldo total do FGTS + multa de 40% paga pelo empregador. O valor rescisório do extrato é calculado com critérios da Caixa e pode diferir levemente do cálculo simples.
                  </p>
                </div>
              </div>
            </div>

            {/* Evolução por ano */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-orange-50 rounded-lg"><TrendingUp size={14} className="text-orange-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução do saldo — por ano</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={evolucaoPorAno} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradFGTS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F97316" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="ano" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => [`R$ ${fmtBRL(v)}`, 'Saldo']}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}/>
                  <Area type="monotone" dataKey="saldo" stroke="#F97316" strokeWidth={2.5} fill="url(#gradFGTS)" name="Saldo"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Rendimentos mensais últimos 24 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-sky-50 rounded-lg"><BarChart2 size={14} className="text-sky-600"/></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rendimento JAM mensal — últimos 24 meses</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Juros de 3% a.a + TR creditados mensalmente</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={rendUlt24} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => [`R$ ${fmtBRL(v)}`, 'Rendimento']}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}/>
                  <Bar dataKey="valor" fill="#0284C7" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Distribuições anuais de resultado */}
            {lancamentos.filter(l => l.tipo === 'DISTRIBUICAO').length > 0 && (
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-violet-50 rounded-lg"><Target size={14} className="text-violet-600"/></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribuições anuais de resultado</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Creditadas anualmente conforme lucro do FGTS</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {lancamentos.filter(l => l.tipo === 'DISTRIBUICAO').map((l, i) => (
                    <div key={l.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                      <span className="text-[10px] font-bold text-slate-300 w-4 text-right">{i+1}</span>
                      <span className="text-xs font-semibold text-slate-600 flex-1">{l.descricao}</span>
                      <span className="text-[10px] text-slate-400">{fmtData(l.data)}</span>
                      <span className="text-xs font-black text-violet-700">+ R$ {fmtBRL(Number(l.valor))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500">Total distribuído</span>
                    <span className="text-sm font-black text-violet-700">R$ {fmtBRL(totalDistribuicao)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alerta saques */}
            {lancamentos.filter(l => l.tipo === 'SAQUE').length > 0 && (
              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-sm font-black text-amber-900">Saques registrados no extrato</p>
                  <p className="text-xs text-amber-700 font-medium mt-1">
                    O extrato da Caixa registra {lancamentos.filter(l=>l.tipo==='SAQUE').length} saque(s). Se não reconhecer algum, entre em contato com a Caixa Econômica Federal ou acesse o app FGTS para verificar.
                  </p>
                  <div className="mt-2 space-y-1">
                    {lancamentos.filter(l => l.tipo === 'SAQUE').map(l => (
                      <p key={l.id} className="text-[11px] text-amber-800 font-semibold">
                        • {fmtData(l.data)} — {l.descricao} — <span className="text-rose-600">- R$ {fmtBRL(Math.abs(Number(l.valor)))}</span>
                        {l.observacao && <span className="text-amber-600 font-normal"> ({l.observacao})</span>}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ HISTÓRICO ══════════════════════ */}
        {subAba === 'historico' && (
          <div className="space-y-4">

            {/* controles */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {/* filtro tipo */}
                {['TODOS','DEPOSITO','RENDIMENTO','DISTRIBUICAO','SAQUE','REPOSICAO','REGULARIZACAO'].map(t => {
                  const cfg = TIPO_CFG[t];
                  return (
                    <button key={t} onClick={() => setFiltroTipo(t)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                        filtroTipo === t
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                      }`}>
                      {t === 'TODOS' ? 'Todos' : cfg?.label ?? t}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                {/* filtro ano */}
                <select value={anoFiltro} onChange={e => setAnoFiltro(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none">
                  <option value="TODOS">Todos os anos</option>
                  {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {/* novo lançamento */}
                <button onClick={() => { setEditId(null); setForm({ ...formInicial }); setModal(true); }}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                  <Plus size={13}/> Novo lançamento
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-sm font-black text-slate-800">Lançamentos</p>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">{listaFiltrada.length} registros</p>
                </div>
              </div>

              {listaFiltrada.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Nenhum lançamento encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Data','Tipo','Descrição','Valor','Saldo Total','Origem',''].map((h, i) => (
                          <th key={i} className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {listaFiltrada.map(l => {
                        const cfg = getTipoCfg(l.tipo);
                        const isNeg = Number(l.valor) < 0;
                        return (
                          <tr key={l.id} className="hover:bg-slate-50/60 transition-colors group/row">
                            <td className="py-2.5 text-[11px] text-slate-400 font-medium pr-3 whitespace-nowrap">{fmtData(l.data)}</td>
                            <td className="py-2.5 pr-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-2.5 text-xs text-slate-700 font-semibold pr-3 max-w-[220px] truncate">{l.descricao}</td>
                            <td className={`py-2.5 text-xs font-black pr-3 whitespace-nowrap ${isNeg ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {isNeg ? '− ' : '+ '}R$ {fmtBRL(Math.abs(Number(l.valor)))}
                            </td>
                            <td className="py-2.5 text-xs text-slate-600 font-semibold pr-3 whitespace-nowrap">
                              {l.saldo_total ? `R$ ${fmtBRL(Number(l.saldo_total))}` : '—'}
                            </td>
                            <td className="py-2.5 pr-3">
                              {l.origem === 'IMPORTADO_EXTRATO'
                                ? <span className="text-[9px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">VIA EXTRATO</span>
                                : <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">MANUAL</span>}
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <button onClick={() => editar(l)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={12}/></button>
                                <button onClick={() => deletar(l.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={12}/></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
              <p className="text-xs text-slate-400 mt-0.5">Registre um depósito, rendimento ou saque</p>
            </div>
            <form onSubmit={salvar} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data">
                  <input required type="date" className={inputCls} value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}/>
                </Field>
                <Field label="Tipo">
                  <select className={inputCls} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="DEPOSITO">Depósito mensal</option>
                    <option value="RENDIMENTO">Rendimento (JAM)</option>
                    <option value="DISTRIBUICAO">Dist. de Resultado</option>
                    <option value="SAQUE">Saque</option>
                    <option value="REPOSICAO">Reposição</option>
                    <option value="REGULARIZACAO">Regularização</option>
                  </select>
                </Field>
              </div>
              <Field label="Descrição">
                <input required type="text" className={inputCls} placeholder="Ex: 155-DEPOSITO JUNHO 2026" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}/>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor (R$)">
                  <input required type="number" step="0.01" className={inputCls} placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}/>
                </Field>
                <Field label="Saldo total após (R$)">
                  <input type="number" step="0.01" className={inputCls} placeholder="Saldo acumulado" value={form.saldo_total} onChange={e => setForm({ ...form, saldo_total: e.target.value })}/>
                </Field>
              </div>
              <Field label="Observação (opcional)">
                <input type="text" className={inputCls} placeholder="Anotação adicional..." value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })}/>
              </Field>
              {form.tipo === 'SAQUE' && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5"/>
                  <span>O valor do saque será registrado como negativo automaticamente.</span>
                </div>
              )}
              <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                {editId ? 'Salvar alterações' : 'Registrar lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}