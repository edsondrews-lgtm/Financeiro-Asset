import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  Building2, Plus, Trash2, Edit2, X,
  ArrowUpRight, DollarSign, Percent, TrendingUp,
  Calendar, FileText, BarChart3, Receipt, Layers,
} from 'lucide-react';

interface NotaFiscal {
  id: string;
  numero_nota: string;
  data_emissao: string;
  tomador: string;
  servico: string;
  valor: number;
  aliquota_imposto?: number;
}

interface Despesa {
  id: string;
  tipo: string;
  descricao: string;
  periodicidade: string;
  recorrente: string;
  valor: number;
  data_vencimento: string;
}

interface Fechamento {
  data_limite: string;
  horario_limite: string;
  observacao: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const TIPO_CORES: Record<string, string> = {
  CONTABILIDADE: 'bg-blue-100 text-blue-700',
  CERTIFICADO_DIGITAL: 'bg-purple-100 text-purple-700',
  IMPOSTOS: 'bg-orange-100 text-orange-700',
  'PRO LABORE': 'bg-teal-100 text-teal-700',
  OUTROS: 'bg-slate-100 text-slate-600',
};

export default function ControleEmpresa() {
  const [subAba, setSubAba] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [mesAtivo, setMesAtivo] = useState('05');
  const [anoAtivo, setAnoAtivo] = useState('2026');
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [fechamento, setFechamento] = useState<Fechamento>({ data_limite: '2026-05-28', horario_limite: '23:59', observacao: '' });
  const [modalNota, setModalNota] = useState(false);
  const [modalDespesa, setModalDespesa] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [novaNota, setNovaNota] = useState({ numero_nota: '', data_emissao: '2026-05-29', tomador: '', servico: '', valor: '' });
  const [novaDespesa, setNovaDespesa] = useState({ tipo: 'CONTABILIDADE', descricao: '', periodicidade: 'Mensal', recorrente: 'Não', valor: '', data_vencimento: '2026-05-29' });

  useEffect(() => { buscarDados(); }, []);

  async function buscarDados() {
    setLoading(true);
    try {
      const { data: n } = await supabase.from('empresa_notas_fiscais').select('*').order('data_emissao', { ascending: false });
      if (n) setNotas(n);
      const { data: d } = await supabase.from('empresa_despesas').select('*');
      if (d) setDespesas(d.map(item => ({ ...item, data_vencimento: item.data_vencimento || item.data || item.vencimento || '' })));
      const { data: f } = await supabase.from('empresa_controle_fechamento').select('*').order('id', { ascending: false }).limit(1);
      if (f && f[0]) setFechamento({ data_limite: f[0].data_limite || '2026-05-28', horario_limite: (f[0].horario_limite || '23:59').substring(0, 5), observacao: f[0].observacao || '' });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function salvarNota(e: React.FormEvent) {
    e.preventDefault();
    const dados = { numero_nota: novaNota.numero_nota, data_emissao: novaNota.data_emissao, tomador: novaNota.tomador || 'O tomador e o intermediário não foram identificados pelo emitente', servico: novaNota.servico, valor: parseFloat(novaNota.valor), aliquota_imposto: Number(mesAtivo) >= 6 ? 7.00 : 6.00 };
    try {
      if (idEditando) await supabase.from('empresa_notas_fiscais').update(dados).eq('id', idEditando);
      else await supabase.from('empresa_notas_fiscais').insert([dados]);
      setModalNota(false); setIdEditando(null);
      setNovaNota({ numero_nota: '', data_emissao: `${anoAtivo}-${mesAtivo}-01`, tomador: '', servico: '', valor: '' });
      buscarDados();
    } catch (err: any) { alert('Erro ao salvar nota: ' + err.message); }
  }

  async function salvarDespesa(e: React.FormEvent) {
    e.preventDefault();
    const dados = { tipo: novaDespesa.tipo, descricao: novaDespesa.descricao, periodicidade: novaDespesa.periodicidade, recorrente: novaDespesa.recorrente, valor: parseFloat(novaDespesa.valor), data_vencimento: novaDespesa.data_vencimento || null };
    try {
      if (idEditando) await supabase.from('empresa_despesas').update(dados).eq('id', idEditando);
      else await supabase.from('empresa_despesas').insert([dados]);
      setModalDespesa(false); setIdEditando(null);
      setNovaDespesa({ tipo: 'CONTABILIDADE', descricao: '', periodicidade: 'Mensal', recorrente: 'Não', valor: '', data_vencimento: `${anoAtivo}-${mesAtivo}-01` });
      buscarDados();
    } catch (err: any) { alert('Erro ao salvar despesa: ' + err.message); }
  }

  async function atualizarFechamento(e: React.FormEvent) {
    e.preventDefault();
    try {
      await supabase.from('empresa_controle_fechamento').insert([fechamento]);
      buscarDados();
    } catch (err: any) { alert(err.message); }
  }

  function prepararEdicaoNota(nota: NotaFiscal) {
    setIdEditando(nota.id);
    setNovaNota({ numero_nota: nota.numero_nota, data_emissao: nota.data_emissao, tomador: nota.tomador, servico: nota.servico, valor: String(nota.valor) });
    setModalNota(true);
  }

  function prepararEdicaoDespesa(desp: Despesa) {
    setIdEditando(desp.id);
    setNovaDespesa({ tipo: desp.tipo, descricao: desp.descricao, periodicidade: desp.periodicidade, recorrente: desp.recorrente, valor: String(desp.valor), data_vencimento: desp.data_vencimento || '' });
    setModalDespesa(true);
  }

  async function deletarRegistro(tabela: string, id: string) {
    if (!confirm('Excluir este registro?')) return;
    try { await supabase.from(tabela).delete().eq('id', id); buscarDados(); }
    catch (err: any) { alert(err.message); }
  }

  const formatarData = (dStr: string) => {
    if (!dStr) return '—';
    const p = dStr.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dStr;
  };

  const obterDiaSeguinteFormatado = (dataStr: string) => {
    if (!dataStr) return '—';
    const p = dataStr.split('-');
    if (p.length !== 3) return dataStr;
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + 1);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const prefixoDataAlvo = `${anoAtivo}-${mesAtivo}`;
  const notasFiltradas = notas.filter(n => n.data_emissao?.substring(0, prefixoDataAlvo.length) === prefixoDataAlvo);
  const despesasFiltradas = despesas.filter(d => {
    if (!d.data_vencimento || d.periodicidade === 'Anual') return true;
    return d.data_vencimento.substring(0, prefixoDataAlvo.length) === prefixoDataAlvo;
  });

  const faturamentoMes = notasFiltradas.reduce((s, n) => s + (Number(n.valor) || 0), 0);
  const aliquotaAtual = Number(mesAtivo) >= 6 ? 0.07 : 0.06;
  const impostoEstimado = faturamentoMes * aliquotaAtual;
  const custosMensais = despesasFiltradas.reduce((s, d) => { const v = Number(d.valor)||0; return d.periodicidade === 'Anual' ? s+(v/12) : s+v; }, 0);
  const lucroLiquidoMes = faturamentoMes - impostoEstimado - custosMensais;

  const notasAno = notas.filter(n => n.data_emissao?.startsWith(anoAtivo));
  const faturamentoAno = notasAno.reduce((s, n) => s+(Number(n.valor)||0), 0);
  const impostoAno = notasAno.reduce((s, n) => s+((Number(n.valor)||0)*(Number(n.data_emissao.split('-')[1])>=6?0.07:0.06)), 0);
  const custosAnoTotal = despesas.reduce((s, d) => { const v=Number(d.valor)||0; if(d.periodicidade==='Anual') return s+v; return d.data_vencimento?.startsWith(anoAtivo)?s+v:s; }, 0);
  const lucroLiquidoAno = faturamentoAno - impostoAno - custosAnoTotal;
  const mesesComMovimento = new Set(notasAno.map(n => n.data_emissao.substring(0,7))).size || 1;
  const projecaoAnual = (lucroLiquidoAno / mesesComMovimento) * 12;

  const pctLucro  = faturamentoMes > 0 ? Math.max(0, lucroLiquidoMes / faturamentoMes * 100) : 0;
  const pctImposto= faturamentoMes > 0 ? Math.max(0, impostoEstimado / faturamentoMes * 100) : 0;
  const pctCustos = faturamentoMes > 0 ? Math.max(0, custosMensais / faturamentoMes * 100) : 0;

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={13}/> },
    { id: 'notas',     label: 'Notas Fiscais', icon: <Receipt size={13}/> },
    { id: 'despesas',  label: 'Despesas', icon: <DollarSign size={13}/> },
    { id: 'relatorios',label: 'Relatórios', icon: <Layers size={13}/> },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-7">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Empresa</h1>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Simples Nacional · Controle de Faturamento</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <Calendar size={13} className="text-slate-400" />
              <select value={mesAtivo} onChange={e => setMesAtivo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent pr-1">
                {MESES.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
              </select>
              <select value={anoAtivo} onChange={e => setAnoAtivo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent">
                <option>2026</option><option>2025</option>
              </select>
            </div>
            <button
              onClick={() => { setIdEditando(null); setNovaNota({ numero_nota:'', data_emissao:`${anoAtivo}-${mesAtivo}-01`, tomador:'', servico:'', valor:'' }); setModalNota(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-200"
            >
              <Plus size={13}/> Nova Nota
            </button>
            <button
              onClick={() => { setIdEditando(null); setNovaDespesa({ tipo:'CONTABILIDADE', descricao:'', periodicidade:'Mensal', recorrente:'Não', valor:'', data_vencimento:`${anoAtivo}-${mesAtivo}-01` }); setModalDespesa(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus size={13}/> Nova Despesa
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-2xl w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setSubAba(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${subAba === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading && <div className="flex items-center gap-2 text-xs font-bold text-blue-600"><div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/> Carregando...</div>}

        {/* ── DASHBOARD ── */}
        {subAba === 'dashboard' && (
          <div className="space-y-6">

            {/* KPIs principais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Faturamento Mês', value: faturamentoMes, color: 'blue',   icon: <ArrowUpRight size={16}/> },
                { label: 'Faturamento Ano', value: faturamentoAno, color: 'emerald', icon: <TrendingUp size={16}/> },
                { label: 'Imposto Estimado', value: impostoEstimado, color: 'amber', icon: <Percent size={16}/> },
                { label: 'Custos Mensais',  value: custosMensais,   color: 'rose',   icon: <DollarSign size={16}/> },
              ].map((card, i) => (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</span>
                    <div className={`p-1.5 rounded-lg bg-${card.color}-50 text-${card.color}-600`}>{card.icon}</div>
                  </div>
                  <p className="text-xl font-black text-slate-900 mt-3 tabular-nums">{fmt(card.value)}</p>
                </div>
              ))}
            </div>

            {/* Lucro + Projeção */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg shadow-emerald-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Lucro Líquido Mês</p>
                <p className="text-3xl font-black mt-2 tabular-nums">{fmt(lucroLiquidoMes)}</p>
                <p className="text-[10px] text-emerald-300 mt-2 font-medium">Disponível após impostos e custos</p>
              </div>
              <div className="bg-gradient-to-br from-slate-800 to-slate-950 rounded-2xl p-6 text-white shadow-lg shadow-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lucro Líquido Ano</p>
                <p className="text-3xl font-black mt-2 text-emerald-400 tabular-nums">{fmt(lucroLiquidoAno)}</p>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Acumulado {anoAtivo}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Projeção Anual Líquida</p>
                <p className="text-3xl font-black mt-2 tabular-nums">{fmt(projecaoAnual)}</p>
                <p className="text-[10px] text-blue-300 mt-2 font-medium">Baseado em {mesesComMovimento} mês(es) ativo(s)</p>
              </div>
            </div>

            {/* Distribuição + Período */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Gráfico de distribuição */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <BarChart3 size={13} className="text-blue-500"/> Distribuição do Faturamento
                </h4>
                {faturamentoMes > 0 ? (
                  <div className="space-y-3">
                    {[
                      { label: 'Lucro Líquido', pct: pctLucro,   valor: lucroLiquidoMes, bar: 'bg-emerald-500' },
                      { label: 'Custos',        pct: pctCustos,  valor: custosMensais,    bar: 'bg-rose-500' },
                      { label: 'Impostos',      pct: pctImposto, valor: impostoEstimado,  bar: 'bg-amber-500' },
                    ].map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                          <span className="text-[11px] font-black text-slate-800 tabular-nums">{item.pct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${item.bar} transition-all`} style={{ width: `${item.pct}%` }}/>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold tabular-nums">{fmt(item.valor)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-slate-300 text-xs font-bold">Sem faturamento neste mês</div>
                )}
              </div>

              {/* Controle de Período */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm lg:col-span-2">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Calendar size={13} className="text-amber-500"/> Controle de Período
                </h4>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5 space-y-1.5">
                  <p className="text-xs text-slate-700 font-semibold">
                    Lançamentos concluídos até: <span className="font-black text-slate-900">{formatarData(fechamento.data_limite)}</span> às <span className="font-black text-slate-900">{fechamento.horario_limite}</span>
                  </p>
                  <p className="text-xs text-amber-800 font-bold">
                    👉 Novas notas a partir de <span className="underline decoration-dotted">{obterDiaSeguinteFormatado(fechamento.data_limite)}</span>
                  </p>
                </div>
                <form onSubmit={atualizarFechamento} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas emitidas até</label>
                    <input type="date" value={fechamento.data_limite} onChange={e => setFechamento({...fechamento, data_limite: e.target.value})}
                      className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all text-slate-700"/>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário limite</label>
                    <input type="time" value={fechamento.horario_limite} onChange={e => setFechamento({...fechamento, horario_limite: e.target.value})}
                      className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all text-slate-700"/>
                  </div>
                  <button type="submit" className="h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-100 uppercase tracking-wider">
                    Atualizar
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* ── NOTAS FISCAIS ── */}
        {subAba === 'notas' && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <p className="text-sm font-black text-slate-900">Notas Fiscais</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{MESES[Number(mesAtivo)-1]} {anoAtivo} · {notasFiltradas.length} registro{notasFiltradas.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-emerald-50 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-black text-emerald-700 tabular-nums">{fmt(faturamentoMes)}</span>
                <span className="text-[10px] text-emerald-500 font-semibold ml-1">total</span>
              </div>
            </div>

            {notasFiltradas.length === 0 ? (
              <div className="py-20 text-center">
                <FileText size={32} className="text-slate-200 mx-auto mb-3"/>
                <p className="text-slate-400 text-sm font-bold">Nenhuma nota fiscal neste período</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {/* Header da tabela */}
                <div className="grid grid-cols-12 px-6 py-2.5 bg-slate-50">
                  <span className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</span>
                  <span className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota</span>
                  <span className="col-span-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tomador</span>
                  <span className="col-span-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</span>
                  <span className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</span>
                  <span className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</span>
                </div>
                {notasFiltradas.map(nota => (
                  <div key={nota.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50/60 transition-colors">
                    <span className="col-span-1 text-xs text-slate-500 font-semibold">{formatarData(nota.data_emissao)}</span>
                    <span className="col-span-1">
                      <span className="inline-flex items-center px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 font-mono">{nota.numero_nota}</span>
                    </span>
                    <span className="col-span-4 text-xs text-slate-600 font-medium truncate pr-4">{nota.tomador}</span>
                    <span className="col-span-4 text-xs text-slate-800 font-semibold pr-4">{nota.servico}</span>
                    <span className="col-span-1 text-xs font-black text-emerald-600 text-right tabular-nums">{fmt(Number(nota.valor))}</span>
                    <div className="col-span-1 flex items-center justify-center gap-1">
                      <button onClick={() => prepararEdicaoNota(nota)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={13}/></button>
                      <button onClick={() => deletarRegistro('empresa_notas_fiscais', nota.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DESPESAS ── */}
        {subAba === 'despesas' && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <p className="text-sm font-black text-slate-900">Despesas & Custos</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{despesasFiltradas.length} registro{despesasFiltradas.length !== 1 ? 's' : ''} no período</p>
              </div>
              <div className="bg-rose-50 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-black text-rose-700 tabular-nums">{fmt(custosMensais)}</span>
                <span className="text-[10px] text-rose-400 font-semibold ml-1">total mensal</span>
              </div>
            </div>

            {despesasFiltradas.length === 0 ? (
              <div className="py-20 text-center">
                <DollarSign size={32} className="text-slate-200 mx-auto mb-3"/>
                <p className="text-slate-400 text-sm font-bold">Nenhum custo registrado neste período</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                <div className="grid grid-cols-12 px-6 py-2.5 bg-slate-50">
                  <span className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</span>
                  <span className="col-span-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</span>
                  <span className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodicidade</span>
                  <span className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</span>
                  <span className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</span>
                </div>
                {despesasFiltradas.map(desp => (
                  <div key={desp.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50/60 transition-colors">
                    <div className="col-span-2">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${TIPO_CORES[desp.tipo] || 'bg-slate-100 text-slate-600'}`}>{desp.tipo.replace('_',' ')}</span>
                    </div>
                    <span className="col-span-5 text-xs text-slate-800 font-semibold pr-4">{desp.descricao || 'Sem descrição'}</span>
                    <span className="col-span-2">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold ${desp.periodicidade === 'Anual' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>{desp.periodicidade}</span>
                    </span>
                    <span className="col-span-2 text-xs font-black text-rose-600 text-right tabular-nums">{fmt(Number(desp.valor))}</span>
                    <div className="col-span-1 flex items-center justify-center gap-1">
                      <button onClick={() => prepararEdicaoDespesa(desp)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={13}/></button>
                      <button onClick={() => deletarRegistro('empresa_despesas', desp.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RELATÓRIOS ── */}
        {subAba === 'relatorios' && (
          <div className="space-y-4">
            {/* Totais anuais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Faturamento Anual', value: faturamentoAno, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Impostos Anuais',   value: impostoAno,    color: 'text-amber-600',   bg: 'bg-amber-50' },
                { label: 'Custos Anuais',     value: custosAnoTotal,color: 'text-rose-600',    bg: 'bg-rose-50' },
                { label: 'Lucro Anual',       value: lucroLiquidoAno,color:'text-blue-700',    bg: 'bg-blue-50' },
              ].map((c,i) => (
                <div key={i} className={`${c.bg} rounded-2xl p-5 border border-white/60`}>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{c.label}</p>
                  <p className={`text-xl font-black mt-2 tabular-nums ${c.color}`}>{fmt(c.value)}</p>
                </div>
              ))}
            </div>

            {/* Tabela mensal */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <p className="text-sm font-black text-slate-900">Relatório Mês a Mês — {anoAtivo}</p>
              </div>
              <div className="divide-y divide-slate-50">
                <div className="grid grid-cols-12 px-6 py-2.5 bg-slate-50">
                  {['Mês','Faturamento','Alíquota','Imposto Est.','Custos','Lucro Líquido','Margem'].map((h,i) => (
                    <span key={i} className={`${i===0?'col-span-2':i===6?'col-span-2':'col-span-1'} text-[10px] font-black text-slate-400 uppercase tracking-widest ${i>=5?'text-right':''}`}>{h}</span>
                  ))}
                </div>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(mKey => {
                  const nM = notas.filter(n => n.data_emissao?.startsWith(`${anoAtivo}-${mKey}`));
                  const fatM = nM.reduce((s,n) => s+(Number(n.valor)||0), 0);
                  const alM = Number(mKey) >= 6 ? 0.07 : 0.06;
                  const impM = fatM * alM;
                  const custM = despesas.reduce((s,d) => { const v=Number(d.valor)||0; if(d.periodicidade==='Anual') return s+(v/12); return d.data_vencimento?.substring(0,7)===`${anoAtivo}-${mKey}`?s+v:s; }, 0);
                  const lucM = fatM - impM - custM;
                  const margemM = fatM > 0 ? (lucM/fatM*100) : 0;
                  const isAtivo = mesAtivo === mKey;
                  const semDados = fatM === 0;

                  return (
                    <div key={mKey} className={`grid grid-cols-12 px-6 py-3.5 items-center transition-colors ${isAtivo ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'} ${semDados ? 'opacity-40' : ''}`}>
                      <div className="col-span-2 flex items-center gap-2">
                        <span className={`text-xs font-black ${isAtivo ? 'text-blue-700' : 'text-slate-700'}`}>{MESES_CURTOS[Number(mKey)-1]}</span>
                        {isAtivo && <span className="text-[9px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded-md">ATU</span>}
                      </div>
                      <span className="col-span-1 text-xs font-black text-emerald-600 tabular-nums">{fatM>0?fmt(fatM):'—'}</span>
                      <span className="col-span-1 text-xs text-slate-400 font-semibold">{(alM*100).toFixed(0)}%</span>
                      <span className="col-span-1 text-xs text-amber-600 font-semibold tabular-nums">{impM>0?fmt(impM):'—'}</span>
                      <span className="col-span-2 text-xs text-rose-600 font-semibold tabular-nums">{custM>0?fmt(custM):'—'}</span>
                      <span className={`col-span-1 text-xs font-black text-right tabular-nums ${lucM>=0?'text-slate-900':'text-rose-600'}`}>{fatM>0?fmt(lucM):'—'}</span>
                      <div className="col-span-2 flex items-center gap-2 justify-end">
                        {fatM > 0 && (
                          <>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${margemM>=50?'bg-emerald-500':margemM>=25?'bg-amber-500':'bg-rose-500'}`} style={{width:`${Math.max(0,Math.min(100,margemM))}%`}}/>
                            </div>
                            <span className={`text-[10px] font-black tabular-nums w-9 text-right ${margemM>=50?'text-emerald-600':margemM>=25?'text-amber-600':'text-rose-600'}`}>{margemM.toFixed(0)}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL NOTA ── */}
      {modalNota && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Receipt size={15}/></div>
                <h3 className="text-sm font-black text-slate-900">{idEditando ? 'Editar Nota Fiscal' : 'Lançar Nota Fiscal'}</h3>
              </div>
              <button onClick={() => { setModalNota(false); setIdEditando(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"><X size={16}/></button>
            </div>
            <form onSubmit={salvarNota} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº da Nota *</label>
                  <input type="text" required placeholder="Ex: 000123" value={novaNota.numero_nota} onChange={e => setNovaNota({...novaNota, numero_nota: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 focus:bg-white transition-all text-slate-700"/>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Emissão *</label>
                  <input type="date" required value={novaNota.data_emissao} onChange={e => setNovaNota({...novaNota, data_emissao: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 focus:bg-white transition-all text-slate-700"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tomador</label>
                <input type="text" placeholder="Nome do tomador" value={novaNota.tomador} onChange={e => setNovaNota({...novaNota, tomador: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 focus:bg-white transition-all text-slate-700"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço Prestado *</label>
                <input type="text" required placeholder="Descrição do serviço" value={novaNota.servico} onChange={e => setNovaNota({...novaNota, servico: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 focus:bg-white transition-all text-slate-700"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Bruto (R$) *</label>
                <input type="number" step="0.01" required placeholder="0,00" value={novaNota.valor} onChange={e => setNovaNota({...novaNota, valor: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 focus:bg-white transition-all text-slate-700"/>
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-100 mt-2">
                {idEditando ? 'Salvar Alterações' : 'Lançar Nota Fiscal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DESPESA ── */}
      {modalDespesa && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><DollarSign size={15}/></div>
                <h3 className="text-sm font-black text-slate-900">{idEditando ? 'Editar Despesa' : 'Lançar Despesa'}</h3>
              </div>
              <button onClick={() => { setModalDespesa(false); setIdEditando(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"><X size={16}/></button>
            </div>
            <form onSubmit={salvarDespesa} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                  <select value={novaDespesa.tipo} onChange={e => setNovaDespesa({...novaDespesa, tipo: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-400 focus:bg-white transition-all text-slate-700">
                    <option value="CONTABILIDADE">Contabilidade</option>
                    <option value="CERTIFICADO_DIGITAL">Certificado Digital</option>
                    <option value="IMPOSTOS">Impostos</option>
                    <option value="PRO LABORE">Pró-labore</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodicidade</label>
                  <select value={novaDespesa.periodicidade} onChange={e => setNovaDespesa({...novaDespesa, periodicidade: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-400 focus:bg-white transition-all text-slate-700">
                    <option value="Mensal">Mensal</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição *</label>
                <input type="text" required placeholder="Ex: Honorários contábeis mensais" value={novaDespesa.descricao} onChange={e => setNovaDespesa({...novaDespesa, descricao: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-rose-400 focus:bg-white transition-all text-slate-700"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor (R$) *</label>
                  <input type="number" step="0.01" required placeholder="0,00" value={novaDespesa.valor} onChange={e => setNovaDespesa({...novaDespesa, valor: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-rose-400 focus:bg-white transition-all text-slate-700"/>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</label>
                  <input type="date" value={novaDespesa.data_vencimento} onChange={e => setNovaDespesa({...novaDespesa, data_vencimento: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-rose-400 focus:bg-white transition-all text-slate-700"/>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-rose-100 mt-2">
                {idEditando ? 'Salvar Alterações' : 'Lançar Despesa'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
