import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart2, AlertTriangle, CheckCircle, Info,
  ChevronLeft, ChevronRight, TrendingUp, CreditCard, Target,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface Entrada { id: string; valor: number; tipo: string; data_entrada: string; }
interface Saida   { id: string; valor: number; categoria: string; data_gasto: string; }

const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const CAT_COLORS: Record<string,string> = {
  Investimento:'#7C3AED', Moradia:'#0284C7', Lazer:'#059669',
  Vestuário:'#D97706', Alimentação:'#E11D48', Assinatura:'#4338CA',
  Mercado:'#0D9488', Supérfluos:'#DB2777', Transporte:'#EA580C',
  Saúde:'#0891B2', Outros:'#64748B',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const parts = ym.split('-');
  const ano = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10);
  if (isNaN(ano) || isNaN(mes) || mes < 1 || mes > 12) return ym;
  return `${MESES_FULL[mes - 1]} ${ano}`;
}

function labelCurtoYM(ym: string) {
  const parts = ym.split('-');
  const mes = parseInt(parts[1], 10);
  if (isNaN(mes) || mes < 1 || mes > 12) return ym;
  return MESES_LABEL[mes - 1];
}

function rangeFromYM(ym: string) {
  const parts = ym.split('-');
  const a = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const mm = String(m).padStart(2, '0');
  const ultimo = new Date(a, m, 0).getDate();
  return { first: `${a}-${mm}-01`, last: `${a}-${mm}-${ultimo}` };
}

function AlertaCard({ type, children }: { type: 'warn'|'ok'|'info'; children: React.ReactNode }) {
  const map = {
    warn: { cls: 'bg-amber-50 border border-amber-200 text-amber-800', Icon: AlertTriangle },
    ok:   { cls: 'bg-emerald-50 border border-emerald-200 text-emerald-800', Icon: CheckCircle },
    info: { cls: 'bg-sky-50 border border-sky-200 text-sky-800', Icon: Info },
  };
  const { cls, Icon } = map[type];
  return (
    <div className={`flex gap-2.5 items-start px-4 py-3 rounded-xl text-xs font-medium ${cls}`}>
      <Icon size={13} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function ResumoPessoal() {
  const [mes, setMes]         = useState(mesAtualYM);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [saidas,   setSaidas]   = useState<Saida[]>([]);
  const [historico, setHistorico] = useState<{ mes: string; ent: number; sai: number }[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { carregar(); }, [mes]);

  async function carregar() {
    setLoading(true);
    try {
      const { first, last } = rangeFromYM(mes);
      const [{ data: dataE }, { data: dataS }] = await Promise.all([
        supabase.from('entradas_pessoais').select('*').gte('data_entrada', first).lte('data_entrada', last),
        supabase.from('pessoal_saidas').select('*').gte('data_gasto', first).lte('data_gasto', last),
      ]);
      setEntradas(dataE ?? []);
      setSaidas(dataS ?? []);

      // histórico 6 meses
      const hist: { mes: string; ent: number; sai: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const ym = navegarMes(mes, -i);
        const { first: f, last: l } = rangeFromYM(ym);
        const [eR, sR] = await Promise.all([
          supabase.from('entradas_pessoais').select('valor').gte('data_entrada', f).lte('data_entrada', l),
          supabase.from('pessoal_saidas').select('valor').gte('data_gasto', f).lte('data_gasto', l),
        ]);
        hist.push({
          mes: labelCurtoYM(ym),
          ent: (eR.data ?? []).reduce((a, r) => a + Number(r.valor), 0),
          sai: (sR.data ?? []).reduce((a, r) => a + Number(r.valor), 0),
        });
      }
      setHistorico(hist);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const totalEntradas = entradas.reduce((a, e) => a + Number(e.valor), 0);
  const totalSaidas   = saidas.reduce((a, s) => a + Number(s.valor), 0);
  const saldo         = totalEntradas - totalSaidas;
  const taxa          = totalEntradas > 0 ? Math.round((saldo / totalEntradas) * 100) : 0;
  const positivo      = saldo >= 0;

  const ranking = Object.entries(
    saidas.reduce<Record<string,number>>((acc, s) => ({
      ...acc, [s.categoria]: (acc[s.categoria] ?? 0) + Number(s.valor),
    }), {})
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = ranking[0]?.[1] ?? 1;

  const alertas: { type: 'warn'|'ok'|'info'; msg: string }[] = [];
  if (totalEntradas === 0 && totalSaidas > 0)
    alertas.push({ type: 'warn', msg: 'Nenhuma entrada registrada neste mês. Cadastre suas receitas em Pessoal → Entradas.' });
  else if (taxa < 20 && totalEntradas > 0)
    alertas.push({ type: 'warn', msg: `Taxa de poupança em ${taxa}% — abaixo do recomendado (20%). Revise os gastos variáveis.` });
  else if (taxa >= 30)
    alertas.push({ type: 'ok', msg: `Ótimo! Taxa de poupança em ${taxa}%. Você está guardando bem.` });
  if (totalEntradas > 0 && totalSaidas / totalEntradas > 0.7)
    alertas.push({ type: 'warn', msg: `Mais de ${Math.round((totalSaidas/totalEntradas)*100)}% da renda comprometida com saídas este mês.` });

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {/* Header — mesmo padrão do sistema */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-600 rounded-2xl text-white shadow-lg shadow-teal-100">
              <BarChart2 size={20}/>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Resumo Pessoal</h1>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Visão consolidada entradas × saídas</p>
            </div>
          </div>

          {/* Navegador de mês */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm self-start">
            <button
              onClick={() => setMes(m => navegarMes(m, -1))}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ChevronLeft size={14}/>
            </button>
            <span className="text-xs font-bold text-slate-700 px-2 min-w-[120px] text-center">
              {labelMesYM(mes)}
            </span>
            <button
              onClick={() => setMes(m => navegarMes(m, 1))}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <ChevronRight size={14}/>
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-teal-600 font-bold">
            <div className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"/>
            Carregando...
          </div>
        )}

        {/* Hero saldo — mesma linguagem visual do sistema */}
        <div className={`rounded-2xl p-6 shadow-sm ${positivo ? 'bg-emerald-500' : 'bg-rose-600'} text-white`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Saldo do mês · {labelMesYM(mes)}</p>
          <p className="text-4xl font-black tracking-tight privado">
            {positivo ? '' : '− '}R$ {fmtBRL(Math.abs(saldo))}
          </p>
          <div className="flex justify-between mt-5">
            <div>
              <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Entradas</p>
              <p className="text-lg font-black privado">R$ {fmtBRL(totalEntradas)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-60 uppercase tracking-widest mb-1">Saídas</p>
              <p className="text-lg font-black privado">R$ {fmtBRL(totalSaidas)}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-[10px] opacity-70 mb-1.5">
              <span>Taxa de poupança</span>
              <span className="font-black">{taxa}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/20">
              <div className="h-1.5 rounded-full bg-white transition-all" style={{ width: `${Math.max(0, Math.min(100, taxa))}%` }}/>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {!loading && alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a, i) => <AlertaCard key={i} type={a.type}>{a.msg}</AlertaCard>)}
          </div>
        )}

        {/* KPIs — mesma linguagem visual do PainelGeral */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-rose-50 rounded-lg"><CreditCard size={14} className="text-rose-600"/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comprometido</p>
            </div>
            <p className={`text-2xl font-black tabular-nums ${totalEntradas > 0 && totalSaidas/totalEntradas > 0.7 ? 'text-rose-600' : 'text-slate-800'}`}>
              {totalEntradas > 0 ? Math.round((totalSaidas / totalEntradas) * 100) : 0}%
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">da renda em saídas</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-emerald-50 rounded-lg"><TrendingUp size={14} className="text-emerald-600"/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poupado</p>
            </div>
            <p className={`text-2xl font-black tabular-nums ${saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'} privado`}>
              R$ {fmtBRL(Math.abs(saldo))}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">{saldo >= 0 ? 'disponível / investir' : 'déficit no mês'}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-indigo-50 rounded-lg"><Target size={14} className="text-indigo-600"/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lançamentos</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-slate-800">{entradas.length + saidas.length}</p>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">registros no mês</p>
          </div>
        </div>

        {/* Evolução 6 meses */}
        {historico.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-blue-50 rounded-lg"><TrendingUp size={14} className="text-blue-600"/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução — últimos 6 meses</p>
            </div>
            <p className="text-xs text-slate-400 font-semibold mb-4 ml-8">Entradas e saídas mensais</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={historico} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `R$${Math.round(v/1000)}k`}/>
                <Tooltip
                  formatter={(v: number) => [`R$ ${fmtBRL(v)}`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: 'none' }}
                />
                <Line type="monotone" dataKey="ent" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669' }} name="Entradas"/>
                <Line type="monotone" dataKey="sai" stroke="#E11D48" strokeWidth={2} dot={{ r: 3, fill: '#E11D48' }} strokeDasharray="5 3" name="Saídas"/>
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3">
              {[['#059669','Entradas'],['#E11D48','Saídas']].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold">
                  <span className="w-4 h-0.5 rounded inline-block" style={{ background: c }}/>{l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ranking de gastos */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-rose-50 rounded-lg"><CreditCard size={14} className="text-rose-600"/></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Onde o dinheiro foi</p>
          </div>
          <p className="text-xs text-slate-400 font-semibold mb-4 ml-8">{ranking.length} categorias · {labelMesYM(mes)}</p>
          {ranking.length === 0
            ? <p className="text-xs text-slate-300 font-semibold py-6 text-center">Nenhuma saída registrada neste mês</p>
            : ranking.map(([cat, val], i) => {
                const pct    = maxCat > 0 ? (val / maxCat) * 100 : 0;
                const pctTot = totalSaidas > 0 ? Math.round((val / totalSaidas) * 100) : 0;
                const color  = CAT_COLORS[cat] ?? '#64748B';
                return (
                  <div key={cat} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                    <span className="text-[10px] text-slate-300 font-bold w-4 shrink-0 text-right">{i+1}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }}/>
                    <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{cat}</span>
                    <div className="w-20 h-1.5 rounded-full bg-slate-100 shrink-0">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                    </div>
                    <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">{pctTot}%</span>
                    <span className="text-xs font-black text-slate-800 w-24 text-right shrink-0 privado">R$ {fmtBRL(val)}</span>
                  </div>
                );
              })
          }
        </div>

      </div>
    </div>
  );
}