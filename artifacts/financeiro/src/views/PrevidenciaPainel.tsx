import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  Shield, Plus, X, Edit2, Trash2, TrendingUp, AlertTriangle,
  Info, FileText, Target, BarChart2, Sliders, Trophy,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, ReferenceLine, LineChart, Line, Legend,
} from 'recharts';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Aporte {
  id: string; competencia: string; valor: number;
  tipo: string; cotas: number | null; origem: string; observacao: string | null;
}
interface Rendimento {
  id: string; competencia: string; valor: number;
  saldo_final: number | null; cotas_total: number | null;
  origem: string; observacao: string | null;
}
interface IndicesBCB { [ym: string]: number } // ym -> taxa % no mês

// ── helpers ───────────────────────────────────────────────────────────────────
const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number, dec = 3) { return `${v.toFixed(dec)}%`; }
function mesAtualYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function labelMesYM(ym: string) {
  const [a, m] = ym.split('-').map(Number);
  if (!a || !m || m < 1 || m > 12) return ym;
  return `${MESES_FULL[m - 1]} ${a}`;
}
function labelCurtoYM(ym: string) {
  const parts = ym.split('-');
  const m = parseInt(parts[1], 10);
  const a = parts[0]?.slice(2);
  return `${MESES_LABEL[(m ?? 1) - 1]}/${a}`;
}
function competenciaToYM(d: string) { return d.slice(0, 7); }

// Busca série do BCB (SGS) — API pública sem chave
async function buscarSerieBCB(serie: number, inicio: string, fim: string): Promise<IndicesBCB> {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${inicio}&dataFinal=${fim}`;
    const res  = await fetch(url);
    const data = await res.json();
    const map: IndicesBCB = {};
    for (const item of data) {
      // data vem como "dd/MM/yyyy"
      const [d, m, a] = item.data.split('/');
      const ym = `${a}-${m}`;
      map[ym] = parseFloat(item.valor);
    }
    return map;
  } catch { return {}; }
}

type SubAba = 'dashboard' | 'analise' | 'simulador' | 'aportes' | 'rendimentos';

const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400 hover:border-slate-300 transition-colors';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const SALDO_ATUAL = 51082.49; // saldo confirmado Mai/2026

// ── componente principal ──────────────────────────────────────────────────────
const formAp0  = { competencia: mesAtualYM(), valor: '', tipo: 'BASICA', cotas: '', observacao: '' };
const formRnd0 = { competencia: mesAtualYM(), valor: '', saldo_final: '', cotas_total: '', observacao: '' };

export default function PrevidenciaPainel() {
  const [subAba,      setSubAba]      = useState<SubAba>('dashboard');
  const [aportes,     setAportes]     = useState<Aporte[]>([]);
  const [rendimentos, setRendimentos] = useState<Rendimento[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingBCB,  setLoadingBCB]  = useState(false);
  const [cdi,  setCdi]  = useState<IndicesBCB>({});
  const [ipca, setIpca] = useState<IndicesBCB>({});

  // modais
  const [modalAp,  setModalAp]  = useState(false);
  const [modalRnd, setModalRnd] = useState(false);
  const [editIdA,  setEditIdA]  = useState<string | null>(null);
  const [editIdR,  setEditIdR]  = useState<string | null>(null);
  const [formA,    setFormA]    = useState({ ...formAp0 });
  const [formR,    setFormR]    = useState({ ...formRnd0 });

  // simulador
  const [simMeta,       setSimMeta]       = useState('1000000');
  const [simAporteExtra,setSimAporteExtra]= useState('0');
  const [simAnos,       setSimAnos]       = useState('');
  const [simModo,       setSimModo]       = useState<'meta'|'aporte'>('meta');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [{ data: dA }, { data: dR }] = await Promise.all([
        supabase.from('previdencia_aportes').select('*').order('competencia'),
        supabase.from('previdencia_rendimentos').select('*').order('competencia'),
      ]);
      setAportes(dA ?? []);
      setRendimentos(dR ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Busca CDI (série 4389) e IPCA (série 433) do BCB
  async function carregarBCB() {
    if (Object.keys(cdi).length > 0) return; // já carregou
    setLoadingBCB(true);
    const [cdiData, ipcaData] = await Promise.all([
      buscarSerieBCB(4389, '01/06/2011', '31/05/2026'),
      buscarSerieBCB(433,  '01/06/2011', '31/05/2026'),
    ]);
    setCdi(cdiData);
    setIpca(ipcaData);
    setLoadingBCB(false);
  }

  useEffect(() => {
    if (subAba === 'analise') carregarBCB();
  }, [subAba]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async function salvarAporte(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      competencia: formA.competencia + '-01', valor: parseFloat(formA.valor),
      tipo: formA.tipo, cotas: formA.cotas ? parseFloat(formA.cotas) : null,
      observacao: formA.observacao || null, origem: 'MANUAL',
      updated_at: new Date().toISOString(),
    };
    if (editIdA) await supabase.from('previdencia_aportes').update(dados).eq('id', editIdA);
    else         await supabase.from('previdencia_aportes').insert([dados]);
    setModalAp(false); setEditIdA(null); setFormA({ ...formAp0 }); carregar();
  }
  async function deletarAporte(id: string) {
    if (!confirm('Excluir este aporte?')) return;
    await supabase.from('previdencia_aportes').delete().eq('id', id); carregar();
  }
  function editarAporte(a: Aporte) {
    setEditIdA(a.id);
    setFormA({ competencia: competenciaToYM(a.competencia), valor: String(a.valor),
      tipo: a.tipo, cotas: a.cotas ? String(a.cotas) : '', observacao: a.observacao ?? '' });
    setModalAp(true);
  }
  async function salvarRend(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      competencia: formR.competencia + '-01', valor: parseFloat(formR.valor),
      saldo_final: formR.saldo_final ? parseFloat(formR.saldo_final) : null,
      cotas_total: formR.cotas_total ? parseFloat(formR.cotas_total) : null,
      observacao: formR.observacao || null, origem: 'MANUAL',
      updated_at: new Date().toISOString(),
    };
    if (editIdR) await supabase.from('previdencia_rendimentos').update(dados).eq('id', editIdR);
    else         await supabase.from('previdencia_rendimentos').insert([dados]);
    setModalRnd(false); setEditIdR(null); setFormR({ ...formRnd0 }); carregar();
  }
  async function deletarRend(id: string) {
    if (!confirm('Excluir este rendimento?')) return;
    await supabase.from('previdencia_rendimentos').delete().eq('id', id); carregar();
  }
  function editarRend(r: Rendimento) {
    setEditIdR(r.id);
    setFormR({ competencia: competenciaToYM(r.competencia), valor: String(r.valor),
      saldo_final: r.saldo_final ? String(r.saldo_final) : '',
      cotas_total: r.cotas_total ? String(r.cotas_total) : '',
      observacao: r.observacao ?? '' });
    setModalRnd(true);
  }

  // ── cálculos base ─────────────────────────────────────────────────────────
  const totalAportado = aportes.reduce((a, r) => a + Number(r.valor), 0);
  const totalRendido  = rendimentos.reduce((a, r) => a + Number(r.valor), 0);
  const aporteAtual   = aportes.length > 0 ? Number(aportes[aportes.length - 1].valor) : 263.62;

  const rend12 = rendimentos.slice(-12);
  const rendMedio = rend12.length > 0
    ? rend12.reduce((a, r) => a + Number(r.valor), 0) / rend12.length : 0;
  const taxaMensalEst = SALDO_ATUAL > 0 ? rendMedio / SALDO_ATUAL : 0.008;

  // marco: mês em que rendimento passou a superar o aporte
  let marcoMes = '';
  let saldoAcum = 0;
  const aportesMap: Record<string, number> = {};
  for (const a of aportes) {
    const ym = competenciaToYM(a.competencia);
    aportesMap[ym] = (aportesMap[ym] ?? 0) + Number(a.valor);
  }
  for (const r of rendimentos) {
    saldoAcum += Number(r.valor);
    const ym = competenciaToYM(r.competencia);
    const ap = aportesMap[ym] ?? 0;
    if (!marcoMes && ap > 0 && Number(r.valor) > ap) marcoMes = ym;
  }

  // projeção
  function projetarSaldo(saldo: number, aporteMensal: number, aporteAnualExtra: number, taxa: number, meses: number) {
    const pts: { mes: number; saldo: number }[] = [{ mes: 0, saldo }];
    for (let i = 1; i <= meses; i++) {
      saldo = saldo * (1 + taxa) + aporteMensal + (i % 12 === 0 ? aporteAnualExtra : 0);
      if (i % 12 === 0 || i === meses) pts.push({ mes: i, saldo });
    }
    return pts;
  }

  // meses para meta sem extra
  function mesesParaMeta(saldo: number, aporteMensal: number, aporteAnualExtra: number, taxa: number, meta: number) {
    let s = saldo; let m = 0;
    while (s < meta && m < 1200) {
      s = s * (1 + taxa) + aporteMensal + (m % 12 === 0 && m > 0 ? aporteAnualExtra : 0);
      m++;
    }
    return m;
  }

  // ── dados gráfico evolução anual ──────────────────────────────────────────
  const evolucaoPorAno = (() => {
    const anos = new Set([
      ...aportes.map(a => a.competencia.slice(0, 4)),
      ...rendimentos.map(r => r.competencia.slice(0, 4)),
    ]);
    let acumAp = 0, acumRend = 0;
    return Array.from(anos).sort().map(ano => {
      const apAno  = aportes.filter(a => a.competencia.startsWith(ano)).reduce((s, a) => s + Number(a.valor), 0);
      const rndAno = rendimentos.filter(r => r.competencia.startsWith(ano)).reduce((s, r) => s + Number(r.valor), 0);
      acumAp += apAno; acumRend += rndAno;
      return { ano, aportes: Math.round(acumAp), rendimentos: Math.round(acumRend), total: Math.round(acumAp + acumRend) };
    });
  })();

  const rendUlt24 = rendimentos.slice(-24).map(r => ({
    mes: labelCurtoYM(competenciaToYM(r.competencia)),
    valor: Number(r.valor),
  }));

  // ── simulador ─────────────────────────────────────────────────────────────
  const meta      = parseFloat(simMeta) || 1000000;
  const extraAnual= parseFloat(simAporteExtra) || 0;
  const anosAlvo  = parseFloat(simAnos) || 0;

  const mesesSemExtra = mesesParaMeta(SALDO_ATUAL, aporteAtual, 0, taxaMensalEst, meta);
  const mesesComExtra = mesesParaMeta(SALDO_ATUAL, aporteAtual, extraAnual, taxaMensalEst, meta);
  const diferencaMeses = mesesSemExtra - mesesComExtra;

  // quanto extra por ano pra chegar em X anos
  function extraNecessario(anos: number) {
    if (!anos) return 0;
    const mesesAlvo = anos * 12;
    let extra = 0;
    for (let tentativa = 0; tentativa <= 100000; tentativa += 100) {
      if (mesesParaMeta(SALDO_ATUAL, aporteAtual, tentativa, taxaMensalEst, meta) <= mesesAlvo) {
        extra = tentativa; break;
      }
    }
    return extra;
  }
  const extraNec = anosAlvo > 0 ? extraNecessario(anosAlvo) : 0;

  // projeções para o gráfico do simulador
  const projSemExtra   = projetarSaldo(SALDO_ATUAL, aporteAtual, 0,           taxaMensalEst, Math.min(mesesSemExtra + 12, 600));
  const projComExtra   = extraAnual > 0
    ? projetarSaldo(SALDO_ATUAL, aporteAtual, extraAnual, taxaMensalEst, Math.min(mesesSemExtra + 12, 600))
    : [];
  const projOtimista   = projetarSaldo(SALDO_ATUAL, aporteAtual, 0, taxaMensalEst * 1.3, Math.min(mesesSemExtra + 12, 600));
  const projPessimista = projetarSaldo(SALDO_ATUAL, aporteAtual, 0, taxaMensalEst * 0.7, Math.min(mesesSemExtra + 12, 600));

  // mescla os cenários num array para o gráfico
  const maxLen = Math.max(projSemExtra.length, projOtimista.length, projPessimista.length);
  const dadosSim = Array.from({ length: maxLen }, (_, i) => ({
    mes: (projSemExtra[i]?.mes ?? projOtimista[i]?.mes ?? 0),
    realista:   projSemExtra[i]?.saldo   ?? null,
    otimista:   projOtimista[i]?.saldo   ?? null,
    pessimista: projPessimista[i]?.saldo ?? null,
    comExtra:   projComExtra[i]?.saldo   ?? null,
  }));

  // ── análise CDI/IPCA ──────────────────────────────────────────────────────
  const dadosComparativo = (() => {
    if (rendimentos.length === 0) return [];
    // monta array com taxa implícita do fundo vs CDI vs IPCA
    let saldoFundo = 0;
    let saldoCDI   = 0;
    let saldoIPCA  = 0;
    const pts: any[] = [];

    for (const r of rendimentos) {
      const ym  = competenciaToYM(r.competencia);
      const apMes = aportesMap[ym] ?? 0;
      saldoFundo += apMes + Number(r.valor);

      const cdiMes  = (cdi[ym]  ?? 0) / 100;
      const ipcaMes = (ipca[ym] ?? 0) / 100;

      saldoCDI  = saldoCDI  * (1 + cdiMes)  + apMes;
      saldoIPCA = saldoIPCA * (1 + ipcaMes) + apMes;

      // taxa implícita do fundo naquele mês
      const base = saldoFundo - Number(r.valor) - apMes;
      const taxaFundo = base > 0 ? (Number(r.valor) / base) * 100 : 0;

      pts.push({
        mes:        labelCurtoYM(ym),
        fundo:      parseFloat(taxaFundo.toFixed(4)),
        cdi:        parseFloat((cdiMes * 100).toFixed(4)),
        ipca:       parseFloat((ipcaMes * 100).toFixed(4)),
        saldoFundo: Math.round(saldoFundo),
        saldoCDI:   Math.round(saldoCDI),
        saldoIPCA:  Math.round(saldoIPCA),
      });
    }
    return pts;
  })();

  const ultComp = dadosComparativo[dadosComparativo.length - 1];
  const ganhoVsCDI  = ultComp ? SALDO_ATUAL - ultComp.saldoCDI  : 0;
  const ganhoVsIPCA = ultComp ? SALDO_ATUAL - ultComp.saldoIPCA : 0;

  // ranking anos por rendimento
  const rankingAnos = (() => {
    const map: Record<string, number> = {};
    for (const r of rendimentos) {
      const ano = r.competencia.slice(0, 4);
      map[ano] = (map[ano] ?? 0) + Number(r.valor);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  })();

  // ── render ─────────────────────────────────────────────────────────────────
  const subAbas: [SubAba, string, React.ReactNode][] = [
    ['dashboard',   'Dashboard',   <Shield size={12}/>],
    ['analise',     'Análise',     <BarChart2 size={12}/>],
    ['simulador',   'Simulador',   <Sliders size={12}/>],
    ['aportes',     'Aportes',     <FileText size={12}/>],
    ['rendimentos', 'Rendimentos', <TrendingUp size={12}/>],
  ];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-600 rounded-2xl text-white shadow-lg shadow-violet-100">
              <Shield size={20}/>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Previdência Privada</h1>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Sicoob Previ · PGBL Multi-Instituído · Perfil Conservador</p>
            </div>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm self-start flex-wrap gap-0.5">
            {subAbas.map(([id, label, icon]) => (
              <button key={id} onClick={() => setSubAba(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subAba === id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-violet-600 font-bold">
            <div className="w-3 h-3 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"/>
            Carregando...
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DASHBOARD
        ══════════════════════════════════════════════════════════════════ */}
        {subAba === 'dashboard' && (
          <div className="space-y-5">
            {/* hero */}
            <div className="bg-gradient-to-br from-violet-700 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-2">Saldo atual · Maio 2026</p>
              <p className="text-4xl font-black tracking-tight">R$ {fmtBRL(SALDO_ATUAL)}</p>
              <div className="grid grid-cols-3 gap-4 mt-5">
                <div>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Total aportado</p>
                  <p className="text-lg font-black">R$ {fmtBRL(totalAportado)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Total rendido</p>
                  <p className="text-lg font-black">R$ {fmtBRL(totalRendido)}</p>
                </div>
                <div>
                  <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Rendimento/dia</p>
                  <p className="text-lg font-black">R$ {fmtBRL(rendMedio / 30)}</p>
                  <p className="text-[9px] opacity-50">sem trabalhar</p>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Aporte mensal atual', value: `R$ ${fmtBRL(aporteAtual)}`,            sub: 'contribuição mensal',      color: 'text-violet-700', bg: 'bg-violet-50',  icon: <Shield size={14} className="text-violet-600"/> },
                { label: 'Rend. médio/mês',     value: `R$ ${fmtBRL(rendMedio)}`,              sub: 'média últimos 12 meses',   color: 'text-emerald-700',bg: 'bg-emerald-50', icon: <TrendingUp size={14} className="text-emerald-600"/> },
                { label: 'Taxa estimada/mês',   value: fmtPct(taxaMensalEst * 100),            sub: 'rendimento sobre saldo',   color: 'text-sky-700',    bg: 'bg-sky-50',     icon: <Target size={14} className="text-sky-600"/> },
                { label: 'Anos investindo',     value: '15 anos',                              sub: 'desde Junho 2011',         color: 'text-amber-700',  bg: 'bg-amber-50',   icon: <Trophy size={14} className="text-amber-600"/> },
              ].map(k => (
                <div key={k.label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <div className={`p-1.5 rounded-lg w-fit mb-3 ${k.bg}`}>{k.icon}</div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.label}</p>
                  <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Marco */}
            {marcoMes && (
              <div className="flex gap-3 items-center p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <Trophy size={22} className="text-amber-500 shrink-0"/>
                <div>
                  <p className="text-sm font-black text-amber-900">Marco atingido 🎉</p>
                  <p className="text-xs text-amber-700 font-medium mt-0.5">
                    Desde <strong>{labelMesYM(marcoMes)}</strong> seu rendimento mensal supera o valor que você deposita.
                    O dinheiro trabalha mais do que você contribui.
                  </p>
                </div>
              </div>
            )}

            {/* progresso R$1M */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caminho até R$ 1.000.000</p>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Mantendo R$ {fmtBRL(aporteAtual)}/mês e taxa de {fmtPct(taxaMensalEst * 100)}/mês
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-violet-600">
                    {Math.floor(mesesSemExtra / 12)}a {mesesSemExtra % 12}m
                  </p>
                  <p className="text-[10px] text-slate-400">estimativa</p>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                <div className="h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all"
                  style={{ width: `${Math.min(100, (SALDO_ATUAL / 1000000) * 100)}%` }}/>
              </div>
              <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                <span>R$ {fmtBRL(SALDO_ATUAL)} hoje</span>
                <span>{((SALDO_ATUAL / 1000000) * 100).toFixed(1)}% da meta</span>
                <span>R$ 1.000.000</span>
              </div>
            </div>

            {/* Evolução histórica */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-indigo-50 rounded-lg"><FileText size={14} className="text-indigo-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução histórica — aportes acumulados vs rendimentos</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={evolucaoPorAno} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gAp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4338CA" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#4338CA" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gRnd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#059669" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="ano" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number, n: string) => [`R$ ${fmtBRL(v)}`, n === 'aportes' ? 'Aportes acum.' : 'Rendimentos acum.']}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}/>
                  <Area type="monotone" dataKey="aportes"     stroke="#4338CA" strokeWidth={2} fill="url(#gAp)"  name="aportes"/>
                  <Area type="monotone" dataKey="rendimentos" stroke="#059669" strokeWidth={2} fill="url(#gRnd)" name="rendimentos"/>
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                {[['#4338CA','Aportes acumulados'],['#059669','Rendimentos acumulados']].map(([c,l]) => (
                  <span key={l} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                    <span className="w-4 h-0.5 rounded inline-block" style={{ background: c }}/>{l}
                  </span>
                ))}
              </div>
            </div>

            {/* rendimentos últimos 24m */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-emerald-50 rounded-lg"><TrendingUp size={14} className="text-emerald-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rendimento mensal — últimos 24 meses</p>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={rendUlt24} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => [`R$ ${fmtBRL(v)}`, 'Rendimento']}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}/>
                  <ReferenceLine y={0} stroke="#e2e8f0"/>
                  <Bar dataKey="valor" radius={[3,3,0,0]}
                    fill="#059669"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ANÁLISE — CDI / IPCA / Ranking
        ══════════════════════════════════════════════════════════════════ */}
        {subAba === 'analise' && (
          <div className="space-y-5">

            {loadingBCB && (
              <div className="flex items-center gap-2 p-4 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-700 font-semibold">
                <div className="w-3 h-3 border-2 border-sky-600 border-t-transparent rounded-full animate-spin shrink-0"/>
                Buscando dados do Banco Central (CDI e IPCA) — API pública BCB/SGS...
              </div>
            )}

            {/* comparativo saldo acumulado */}
            {dadosComparativo.length > 0 && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Seu fundo (real)</p>
                    <p className="text-2xl font-black text-violet-700">R$ {fmtBRL(SALDO_ATUAL)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">saldo atual confirmado</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Se tivesse no CDI</p>
                    <p className={`text-2xl font-black ${ganhoVsCDI >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {fmtBRL(ultComp?.saldoCDI ?? 0)}
                    </p>
                    <p className={`text-[11px] font-bold mt-1 ${ganhoVsCDI >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {ganhoVsCDI >= 0 ? '▲' : '▼'} R$ {fmtBRL(Math.abs(ganhoVsCDI))} vs CDI
                    </p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Se tivesse no IPCA</p>
                    <p className={`text-2xl font-black ${ganhoVsIPCA >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {fmtBRL(ultComp?.saldoIPCA ?? 0)}
                    </p>
                    <p className={`text-[11px] font-bold mt-1 ${ganhoVsIPCA >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {ganhoVsIPCA >= 0 ? '▲' : '▼'} R$ {fmtBRL(Math.abs(ganhoVsIPCA))} vs IPCA
                    </p>
                  </div>
                </div>

                {/* explicação */}
                <div className="flex gap-2.5 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
                  <Info size={13} className="shrink-0 mt-0.5"/>
                  <span>
                    Essa comparação simula quanto você teria hoje se tivesse aplicado os <strong>mesmos aportes</strong> mês a mês no CDI ou no IPCA, em vez do fundo da Sicoob. Diferenças positivas significam que seu fundo <strong>superou</strong> o índice.
                  </span>
                </div>

                {/* gráfico saldo acumulado comparativo */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo acumulado — Fundo vs CDI vs IPCA</p>
                  <p className="text-xs text-slate-400 font-semibold mb-4">Com os mesmos aportes mensais desde Jun/2011</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dadosComparativo.filter((_, i) => i % 3 === 0)} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                      <Tooltip formatter={(v: number, n: string) => [`R$ ${fmtBRL(v)}`, n]}
                        contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}/>
                      <Line type="monotone" dataKey="saldoFundo" stroke="#7C3AED" strokeWidth={2.5} dot={false} name="Seu fundo"/>
                      <Line type="monotone" dataKey="saldoCDI"   stroke="#0284C7" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="CDI"/>
                      <Line type="monotone" dataKey="saldoIPCA"  stroke="#D97706" strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="IPCA"/>
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2">
                    {[['#7C3AED','Seu fundo'],['#0284C7','CDI'],['#D97706','IPCA']].map(([c,l]) => (
                      <span key={l} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                        <span className="w-4 h-0.5 rounded inline-block" style={{ background: c }}/>{l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* taxa mensal fundo vs CDI */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Taxa mensal do fundo vs CDI vs IPCA (%)</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={dadosComparativo.filter((_, i) => i % 2 === 0)} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                      <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                      <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`, '']}
                        contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}/>
                      <ReferenceLine y={0} stroke="#e2e8f0"/>
                      <Line type="monotone" dataKey="fundo" stroke="#7C3AED" strokeWidth={1.5} dot={false} name="Fundo"/>
                      <Line type="monotone" dataKey="cdi"   stroke="#0284C7" strokeWidth={1}   dot={false} strokeDasharray="4 2" name="CDI"/>
                      <Line type="monotone" dataKey="ipca"  stroke="#D97706" strokeWidth={1}   dot={false} strokeDasharray="2 2" name="IPCA"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {!loadingBCB && dadosComparativo.length === 0 && (
              <div className="flex gap-2.5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <AlertTriangle size={13} className="shrink-0 mt-0.5"/>
                <span>Aguardando dados do Banco Central. Verifique sua conexão ou tente novamente.</span>
              </div>
            )}

            {/* ranking por ano */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-amber-50 rounded-lg"><Trophy size={14} className="text-amber-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ranking — rendimento total por ano</p>
              </div>
              <div className="space-y-2">
                {rankingAnos.map(([ano, val], i) => {
                  const max = rankingAnos[0][1];
                  const cores = ['#7C3AED','#4338CA','#0284C7','#059669','#D97706'];
                  const cor = i < 3 ? cores[i] : '#94a3b8';
                  return (
                    <div key={ano} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-300 w-4 text-right">{i+1}</span>
                      <span className="text-xs font-bold text-slate-700 w-10">{ano}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${(val/max)*100}%`, background: cor }}/>
                      </div>
                      <span className="text-xs font-black text-slate-800 w-24 text-right">R$ {fmtBRL(val)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SIMULADOR
        ══════════════════════════════════════════════════════════════════ */}
        {subAba === 'simulador' && (
          <div className="space-y-5">

            {/* controles */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configure a simulação</p>

              <div className="flex gap-2 mb-2">
                {(['meta','aporte'] as const).map(m => (
                  <button key={m} onClick={() => setSimModo(m)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${simModo === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                    {m === 'meta' ? 'Quero atingir uma meta' : 'Vou aportar um extra anual'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Meta de patrimônio (R$)">
                  <input type="number" className={inputCls} value={simMeta}
                    onChange={e => setSimMeta(e.target.value)} placeholder="1000000"/>
                </Field>
                {simModo === 'aporte' && (
                  <Field label="Aporte extra anual (R$)">
                    <input type="number" className={inputCls} value={simAporteExtra}
                      onChange={e => setSimAporteExtra(e.target.value)} placeholder="10000"/>
                  </Field>
                )}
                {simModo === 'meta' && (
                  <Field label="Quero chegar em quantos anos?">
                    <input type="number" className={inputCls} value={simAnos}
                      onChange={e => setSimAnos(e.target.value)} placeholder="ex: 15"/>
                  </Field>
                )}
              </div>
            </div>

            {/* resultados */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-violet-600 text-white rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-2">Sem aporte extra</p>
                <p className="text-2xl font-black">{Math.floor(mesesSemExtra/12)}a {mesesSemExtra%12}m</p>
                <p className="text-[11px] opacity-70 mt-1">apenas R$ {fmtBRL(aporteAtual)}/mês</p>
              </div>

              {simModo === 'aporte' && extraAnual > 0 && (
                <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-sm">
                  <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-2">Com R$ {fmtBRL(extraAnual)}/ano extra</p>
                  <p className="text-2xl font-black">{Math.floor(mesesComExtra/12)}a {mesesComExtra%12}m</p>
                  <p className="text-[11px] opacity-70 mt-1">
                    {diferencaMeses > 0 ? `▲ ${Math.floor(diferencaMeses/12)}a ${diferencaMeses%12}m mais rápido` : 'sem diferença'}
                  </p>
                </div>
              )}

              {simModo === 'meta' && anosAlvo > 0 && (
                <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-sm">
                  <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-2">Para chegar em {anosAlvo} anos</p>
                  <p className="text-2xl font-black">R$ {fmtBRL(extraNec)}/ano</p>
                  <p className="text-[11px] opacity-70 mt-1">aporte extra anual necessário</p>
                </div>
              )}

              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Renda passiva ao atingir a meta</p>
                <p className="text-2xl font-black text-violet-700">R$ {fmtBRL(meta * taxaMensalEst)}/mês</p>
                <p className="text-[10px] text-slate-400 mt-1">rendimento mensal estimado sobre R$ {fmtBRL(meta)}</p>
              </div>
            </div>

            {/* explicação dos cenários */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pessimista',  cor: '#EF4444', desc: `Taxa ${fmtPct(taxaMensalEst * 70)}/mês — fundo rende 30% menos que a média`, m: mesesParaMeta(SALDO_ATUAL, aporteAtual, 0, taxaMensalEst * 0.7, meta) },
                { label: 'Realista',    cor: '#7C3AED', desc: `Taxa ${fmtPct(taxaMensalEst * 100)}/mês — baseada nos últimos 12 meses reais`, m: mesesSemExtra },
                { label: 'Otimista',   cor: '#10B981', desc: `Taxa ${fmtPct(taxaMensalEst * 130)}/mês — fundo rende 30% acima da média`, m: mesesParaMeta(SALDO_ATUAL, aporteAtual, 0, taxaMensalEst * 1.3, meta) },
              ].map(c => (
                <div key={c.label} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.cor }}/>
                    <span className="text-xs font-black text-slate-700">{c.label}</span>
                  </div>
                  <p className="text-lg font-black" style={{ color: c.cor }}>{Math.floor(c.m/12)}a {c.m%12}m</p>
                  <p className="text-[10px] text-slate-400 mt-1">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* gráfico projeção 3 cenários */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Projeção — 3 cenários + extra anual</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dadosSim} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="mes" tickFormatter={v => v === 0 ? 'Hoje' : `+${Math.floor(v/12)}a`}
                    tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`}
                    tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v: number) => v ? [`R$ ${fmtBRL(v)}`, ''] : ['-','']}
                    contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}/>
                  <ReferenceLine y={meta} stroke="#D97706" strokeDasharray="6 3"
                    label={{ value: `Meta R$${(meta/1000).toFixed(0)}k`, fontSize: 10, fill: '#D97706', position: 'insideTopRight' }}/>
                  <Line type="monotone" dataKey="pessimista" stroke="#EF4444" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Pessimista" connectNulls/>
                  <Line type="monotone" dataKey="realista"   stroke="#7C3AED" strokeWidth={2.5} dot={false} name="Realista" connectNulls/>
                  <Line type="monotone" dataKey="otimista"   stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="Otimista" connectNulls/>
                  {extraAnual > 0 && <Line type="monotone" dataKey="comExtra" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="6 2" name="Com extra" connectNulls/>}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {[['#EF4444','Pessimista'],['#7C3AED','Realista'],['#10B981','Otimista'],
                  ...(extraAnual > 0 ? [['#F59E0B',`Com R$${fmtBRL(extraAnual)}/ano extra`]] : [])
                ].map(([c,l]) => (
                  <span key={l} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                    <span className="w-4 h-0.5 rounded inline-block" style={{ background: c }}/>{l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            APORTES
        ══════════════════════════════════════════════════════════════════ */}
        {subAba === 'aportes' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-800">Aportes / Contribuições</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">{aportes.length} registros · Total: R$ {fmtBRL(totalAportado)}</p>
              </div>
              <button onClick={() => { setEditIdA(null); setFormA({ ...formAp0 }); setModalAp(true); }}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                <Plus size={13}/> Novo aporte
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Competência','Tipo','Valor','Cotas','Origem',''].map((h,i) => (
                      <th key={i} className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...aportes].reverse().map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors group/row">
                      <td className="py-3 text-[11px] text-slate-500 font-semibold">{labelMesYM(competenciaToYM(a.competencia))}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold ${a.tipo === 'BASICA' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
                          {a.tipo === 'BASICA' ? 'Básica' : 'Eventual'}
                        </span>
                      </td>
                      <td className="py-3 text-xs font-black text-slate-800">R$ {fmtBRL(Number(a.valor))}</td>
                      <td className="py-3 text-[11px] text-slate-400">{a.cotas ? Number(a.cotas).toFixed(6) : '—'}</td>
                      <td className="py-3">
                        {a.origem === 'IMPORTADO_EXTRATO'
                          ? <span className="text-[9px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">VIA EXTRATO</span>
                          : <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">MANUAL</span>}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => editarAporte(a)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={12}/></button>
                          <button onClick={() => deletarAporte(a.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            RENDIMENTOS
        ══════════════════════════════════════════════════════════════════ */}
        {subAba === 'rendimentos' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-800">Rendimentos Mensais</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">{rendimentos.length} registros · Total: R$ {fmtBRL(totalRendido)}</p>
              </div>
              <button onClick={() => { setEditIdR(null); setFormR({ ...formRnd0 }); setModalRnd(true); }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                <Plus size={13}/> Lançar rendimento
              </button>
            </div>
            <div className="flex gap-2 p-3 bg-sky-50 border border-sky-100 rounded-xl">
              <Info size={13} className="text-sky-600 mt-0.5 shrink-0"/>
              <p className="text-[11px] text-sky-800 font-medium">
                Todo mês após o fechamento contábil da Sicoob Previ, lance aqui o rendimento real. Você pode editar o valor depois se o extrato for retificado.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Competência','Rendimento','Saldo final','Cotas','Origem',''].map((h,i) => (
                      <th key={i} className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...rendimentos].reverse().map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors group/row">
                      <td className="py-3 text-[11px] text-slate-500 font-semibold">{labelMesYM(competenciaToYM(r.competencia))}</td>
                      <td className={`py-3 text-xs font-black ${Number(r.valor) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {Number(r.valor) >= 0 ? '+' : ''} R$ {fmtBRL(Number(r.valor))}
                      </td>
                      <td className="py-3 text-xs text-slate-600 font-semibold">
                        {r.saldo_final ? `R$ ${fmtBRL(Number(r.saldo_final))}` : '—'}
                      </td>
                      <td className="py-3 text-[11px] text-slate-400">
                        {r.cotas_total ? Number(r.cotas_total).toFixed(2) : '—'}
                      </td>
                      <td className="py-3">
                        {r.origem === 'IMPORTADO_EXTRATO'
                          ? <span className="text-[9px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded font-bold">VIA EXTRATO</span>
                          : <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">MANUAL</span>}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => editarRend(r)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={12}/></button>
                          <button onClick={() => deletarRend(r.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Aporte ──────────────────────────────────────────────────── */}
      {modalAp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
            <button onClick={() => { setModalAp(false); setEditIdA(null); }} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={15}/></button>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{editIdA ? 'Editar aporte' : 'Novo aporte'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Registre uma contribuição à previdência</p>
            </div>
            <form onSubmit={salvarAporte} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Competência">
                  <input required type="month" className={inputCls} value={formA.competencia} onChange={e => setFormA({ ...formA, competencia: e.target.value })}/>
                </Field>
                <Field label="Tipo">
                  <select className={inputCls} value={formA.tipo} onChange={e => setFormA({ ...formA, tipo: e.target.value })}>
                    <option value="BASICA">Básica (mensal)</option>
                    <option value="EVENTUAL">Eventual (extra)</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor (R$)">
                  <input required type="number" step="0.01" className={inputCls} placeholder="0,00" value={formA.valor} onChange={e => setFormA({ ...formA, valor: e.target.value })}/>
                </Field>
                <Field label="Cotas (opcional)">
                  <input type="number" step="0.000001" className={inputCls} placeholder="0,000000" value={formA.cotas} onChange={e => setFormA({ ...formA, cotas: e.target.value })}/>
                </Field>
              </div>
              <Field label="Observação (opcional)">
                <input type="text" className={inputCls} placeholder="Ex: 13º salário..." value={formA.observacao} onChange={e => setFormA({ ...formA, observacao: e.target.value })}/>
              </Field>
              <button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                {editIdA ? 'Salvar alterações' : 'Registrar aporte'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Rendimento ──────────────────────────────────────────────── */}
      {modalRnd && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
            <button onClick={() => { setModalRnd(false); setEditIdR(null); }} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={15}/></button>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{editIdR ? 'Editar rendimento' : 'Lançar rendimento mensal'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Informe o rendimento real do fechamento mensal</p>
            </div>
            <form onSubmit={salvarRend} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Competência">
                  <input required type="month" className={inputCls} value={formR.competencia} onChange={e => setFormR({ ...formR, competencia: e.target.value })}/>
                </Field>
                <Field label="Rendimento (R$)">
                  <input required type="number" step="0.01" className={inputCls} placeholder="0,00" value={formR.valor} onChange={e => setFormR({ ...formR, valor: e.target.value })}/>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Saldo final (R$)">
                  <input type="number" step="0.01" className={inputCls} placeholder="Saldo do extrato" value={formR.saldo_final} onChange={e => setFormR({ ...formR, saldo_final: e.target.value })}/>
                </Field>
                <Field label="Total de cotas">
                  <input type="number" step="0.000001" className={inputCls} placeholder="9012,536497" value={formR.cotas_total} onChange={e => setFormR({ ...formR, cotas_total: e.target.value })}/>
                </Field>
              </div>
              <Field label="Observação (opcional)">
                <input type="text" className={inputCls} placeholder="Ex: mês com volatilidade..." value={formR.observacao} onChange={e => setFormR({ ...formR, observacao: e.target.value })}/>
              </Field>
              <div className="flex gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800">
                <AlertTriangle size={12} className="shrink-0 mt-0.5"/>
                <span>Você pode editar este valor após o extrato definitivo da Sicoob ser emitido.</span>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                {editIdR ? 'Salvar alterações' : 'Lançar rendimento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}