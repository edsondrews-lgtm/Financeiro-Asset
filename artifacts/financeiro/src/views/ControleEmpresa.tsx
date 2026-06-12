import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Building2, Plus, Trash2, Edit2, X, ArrowUpRight, DollarSign, Percent, TrendingUp, Calendar, PieChart } from 'lucide-react';

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

      const { data: d, error: erroDespesas } = await supabase.from('empresa_despesas').select('*');
      if (erroDespesas) {
        console.error('Erro Supabase Despesas:', erroDespesas.message);
      } else if (d) {
        setDespesas(d.map(item => ({ ...item, data_vencimento: item.data_vencimento || item.data || item.vencimento || '' })));
      }

      const { data: f } = await supabase.from('empresa_controle_fechamento').select('*').order('id', { ascending: false }).limit(1);
      if (f && f[0]) {
        setFechamento({
          data_limite: f[0].data_limite || '2026-05-28',
          horario_limite: (f[0].horario_limite || '23:59').substring(0, 5),
          observacao: f[0].observacao || ''
        });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function salvarNota(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      numero_nota: novaNota.numero_nota,
      data_emissao: novaNota.data_emissao,
      tomador: novaNota.tomador || 'O tomador e o intermediário não foram identificados pelo emitente',
      servico: novaNota.servico,
      valor: parseFloat(novaNota.valor),
      aliquota_imposto: Number(mesAtivo) >= 6 ? 7.00 : 6.00
    };
    try {
      if (idEditando) {
        const { error } = await supabase.from('empresa_notas_fiscais').update(dados).eq('id', idEditando);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('empresa_notas_fiscais').insert([dados]);
        if (error) throw error;
      }
      setModalNota(false); setIdEditando(null);
      setNovaNota({ numero_nota: '', data_emissao: `${anoAtivo}-${mesAtivo}-01`, tomador: '', servico: '', valor: '' });
      buscarDados();
    } catch (err: any) { alert('Erro ao salvar nota: ' + err.message); }
  }

  async function salvarDespesa(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      tipo: novaDespesa.tipo, descricao: novaDespesa.descricao, periodicidade: novaDespesa.periodicidade,
      recorrente: novaDespesa.recorrente, valor: parseFloat(novaDespesa.valor),
      data_vencimento: novaDespesa.data_vencimento || null
    };
    try {
      if (idEditando) {
        const { error } = await supabase.from('empresa_despesas').update(dados).eq('id', idEditando);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('empresa_despesas').insert([dados]);
        if (error) throw error;
      }
      setModalDespesa(false); setIdEditando(null);
      setNovaDespesa({ tipo: 'CONTABILIDADE', descricao: '', periodicidade: 'Mensal', recorrente: 'Não', valor: '', data_vencimento: `${anoAtivo}-${mesAtivo}-01` });
      buscarDados();
    } catch (err: any) { alert('Erro ao salvar despesa: ' + err.message); }
  }

  async function atualizarFechamento(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase.from('empresa_controle_fechamento').insert([fechamento]);
      if (error) throw error;
      alert('Controle de período atualizado!');
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
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      const { error } = await supabase.from(tabela).delete().eq('id', id);
      if (error) throw error;
      buscarDados();
    } catch (err: any) { alert(err.message); }
  }

  // Helpers de data
  const obterDiaSeguinteFormatado = (dataStr: string) => {
    if (!dataStr) return '—';
    const partes = dataStr.split('-');
    if (partes.length !== 3) return dataStr;
    const data = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    data.setDate(data.getDate() + 1);
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
  };

  const formatarData = (dStr: string) => {
    if (!dStr) return '—';
    const p = dStr.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dStr;
  };

  // Filtragem
  const prefixoDataAlvo = `${anoAtivo}-${mesAtivo}`;
  const notasFiltradas = notas.filter(n => n.data_emissao && n.data_emissao.substring(0, prefixoDataAlvo.length) === prefixoDataAlvo);
  const despesasFiltradas = despesas.filter(d => {
    if (!d.data_vencimento || d.data_vencimento === '') return true;
    if (d.periodicidade === 'Anual') return true;
    return d.data_vencimento.substring(0, prefixoDataAlvo.length) === prefixoDataAlvo;
  });

  // Cálculos mensais
  const faturamentoMes = notasFiltradas.reduce((sum, n) => sum + (Number(n.valor) || 0), 0);
  const aliquotaAtual = Number(mesAtivo) >= 6 ? 0.07 : 0.06;
  const impostoEstimado = faturamentoMes * aliquotaAtual;
  const custosMensais = despesasFiltradas.reduce((sum, d) => {
    const v = Number(d.valor) || 0;
    return d.periodicidade === 'Anual' ? sum + (v / 12) : sum + v;
  }, 0);
  const lucroLiquidoMes = faturamentoMes - impostoEstimado - custosMensais;

  // Cálculos anuais
  const notasAno = notas.filter(n => n.data_emissao?.startsWith(anoAtivo));
  const faturamentoAno = notasAno.reduce((sum, n) => sum + (Number(n.valor) || 0), 0);
  const impostoAno = notasAno.reduce((sum, n) => sum + ((Number(n.valor) || 0) * (Number(n.data_emissao.split('-')[1]) >= 6 ? 0.07 : 0.06)), 0);
  const custosAnoTotal = despesas.reduce((sum, d) => {
    const v = Number(d.valor) || 0;
    if (d.periodicidade === 'Anual') return sum + v;
    return d.data_vencimento?.startsWith(anoAtivo) ? sum + v : sum;
  }, 0);
  const lucroLiquidoAno = faturamentoAno - impostoAno - custosAnoTotal;
  const mesesComMovimento = new Set(notas.filter(n => n.data_emissao?.startsWith(anoAtivo)).map(n => n.data_emissao.substring(0, 7))).size || 1;
  const projecaoAnual = (lucroLiquidoAno / mesesComMovimento) * 12;

  // Gráfico pizza SVG
  const totalPizza = faturamentoMes || 1;
  const pctLucro = Math.max(0, (lucroLiquidoMes / totalPizza) * 100);
  const pctImposto = Math.max(0, (impostoEstimado / totalPizza) * 100);
  const pctCustos = Math.max(0, (custosMensais / totalPizza) * 100);

  const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-100">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Empresa</h2>
            <p className="text-slate-500 text-xs font-semibold">Controle de Faturamento — Simples Nacional</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={mesAtivo} onChange={e => setMesAtivo(e.target.value)} className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700 shadow-sm">
            {mesesNomes.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </select>
          <select value={anoAtivo} onChange={e => setAnoAtivo(e.target.value)} className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700 shadow-sm">
            <option value="2026">2026</option><option value="2025">2025</option>
          </select>
          <button onClick={() => { setIdEditando(null); setNovaNota({ numero_nota: '', data_emissao: `${anoAtivo}-${mesAtivo}-01`, tomador: '', servico: '', valor: '' }); setModalNota(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
            <Plus size={14} /> Nova Nota
          </button>
          <button onClick={() => { setIdEditando(null); setNovaDespesa({ tipo: 'CONTABILIDADE', descricao: '', periodicidade: 'Mensal', recorrente: 'Não', valor: '', data_vencimento: `${anoAtivo}-${mesAtivo}-01` }); setModalDespesa(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm">
            <Plus size={14} /> Nova Despesa
          </button>
        </div>
      </div>

      {/* SUB-ABAS */}
      <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl w-fit">
        {['dashboard', 'notas', 'despesas', 'relatorios'].map(t => (
          <button key={t} onClick={() => setSubAba(t)} className={`px-5 py-2 rounded-lg text-xs font-bold capitalize transition-all ${subAba === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'notas' ? 'Notas Fiscais' : t}
          </button>
        ))}
      </div>

      {loading && <p className="text-xs font-bold text-blue-600 animate-pulse">Carregando dados...</p>}

      {/* DASHBOARD */}
      {subAba === 'dashboard' && (
        <div className="space-y-6">

          {/* CARDS SUPERIORES */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <span className="text-blue-600/80 font-bold text-xs uppercase tracking-wider block">Faturamento Mês</span>
              <h3 className="text-2xl font-black text-blue-900 mt-2">R$ {faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <div className="absolute right-4 bottom-4 p-2 bg-blue-600 text-white rounded-xl"><ArrowUpRight size={16} /></div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <span className="text-emerald-600/80 font-bold text-xs uppercase tracking-wider block">Faturamento Ano</span>
              <h3 className="text-2xl font-black text-emerald-900 mt-2">R$ {faturamentoAno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <div className="absolute right-4 bottom-4 p-2 bg-emerald-600 text-white rounded-xl"><TrendingUp size={16} /></div>
            </div>
            <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <span className="text-orange-600/80 font-bold text-xs uppercase tracking-wider block">Imposto Estimado</span>
              <h3 className="text-2xl font-black text-orange-900 mt-2">R$ {impostoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <div className="absolute right-4 bottom-4 p-2 bg-orange-600 text-white rounded-xl"><Percent size={14} /></div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl relative overflow-hidden shadow-sm">
              <span className="text-rose-600/80 font-bold text-xs uppercase tracking-wider block">Custos Mensais</span>
              <h3 className="text-2xl font-black text-rose-900 mt-2">R$ {custosMensais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <div className="absolute right-4 bottom-4 p-2 bg-rose-600 text-white rounded-xl"><DollarSign size={16} /></div>
            </div>
          </div>

          {/* CARDS DE LUCRO E PROJEÇÃO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-3xl flex flex-col justify-between min-h-[140px] shadow-lg shadow-emerald-100/50">
              <div>
                <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider block">Lucro Líquido Mês</span>
                <h2 className="text-3xl font-black mt-2">R$ {lucroLiquidoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
              </div>
              <span className="text-[10px] text-emerald-100/80 font-medium">Líquido pronto disponível</span>
            </div>
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white p-6 rounded-3xl flex flex-col justify-between min-h-[140px] shadow-lg shadow-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Lucro Líquido Ano</span>
                <h2 className="text-3xl font-black text-emerald-400 mt-2">R$ {lucroLiquidoAno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Acumulado {anoAtivo}</span>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-3xl flex flex-col justify-between min-h-[140px] shadow-lg shadow-blue-100/50">
              <div>
                <span className="text-xs font-bold text-blue-100 uppercase tracking-wider block">Projeção Anual Líquida</span>
                <h2 className="text-3xl font-black mt-2">R$ {projecaoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
              </div>
              <span className="text-[10px] text-blue-100/80 font-medium">Média baseada em {mesesComMovimento} mês(es) ativos</span>
            </div>
          </div>

          {/* GRÁFICO PIZZA + CONTROLE DE PERÍODO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* GRÁFICO PIZZA SVG NATIVO */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm md:col-span-1 flex flex-col justify-between">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <PieChart size={16} className="text-blue-600" /> Distribuição Mensal
              </h4>
              {faturamentoMes > 0 ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-2">
                  <div className="relative w-32 h-32">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      {/* Custos */}
                      <circle
                        cx="18" cy="18" r="15.915"
                        fill="none" stroke="#f43f5e" strokeWidth="4"
                        strokeDasharray={`${pctCustos} ${100 - pctCustos}`}
                        strokeDashoffset="0"
                      />
                      {/* Imposto */}
                      <circle
                        cx="18" cy="18" r="15.915"
                        fill="none" stroke="#f97316" strokeWidth="4"
                        strokeDasharray={`${pctImposto} ${100 - pctImposto}`}
                        strokeDashoffset={`-${pctCustos}`}
                      />
                      {/* Lucro */}
                      <circle
                        cx="18" cy="18" r="15.915"
                        fill="none" stroke="#10b981" strokeWidth="4"
                        strokeDasharray={`${pctLucro} ${100 - pctLucro}`}
                        strokeDashoffset={`-${pctCustos + pctImposto}`}
                      />
                    </svg>
                  </div>
                  <div className="w-full text-[11px] grid grid-cols-3 gap-1 font-bold text-center">
                    <div className="text-emerald-600">Lucro<br />{pctLucro.toFixed(0)}%</div>
                    <div className="text-orange-500">Imposto<br />{pctImposto.toFixed(0)}%</div>
                    <div className="text-rose-500">Custos<br />{pctCustos.toFixed(0)}%</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">Insira faturamento para gerar o gráfico.</div>
              )}
            </div>

            {/* CONTROLE DE PERÍODO */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm md:col-span-2 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Calendar size={18} className="text-amber-500" /> Controle de Período de Lançamento
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Gerencie os prazos limites para o fechamento mensal</p>
                </div>
                <div className="p-3.5 bg-amber-50/70 border border-amber-100/70 rounded-xl space-y-1">
                  <p className="text-[13px] text-slate-600 font-medium">
                    Lançamentos concluídos até: <span className="text-slate-400 font-normal">{formatarData(fechamento.data_limite)} às {fechamento.horario_limite}</span>.
                  </p>
                  <p className="text-[13px] text-amber-900 font-medium">
                    👉 Para novas notas, considere extratos{' '}
                    <span className="text-amber-950 font-black underline">
                      A PARTIR DE: {obterDiaSeguinteFormatado(fechamento.data_limite)}
                    </span>
                  </p>
                </div>
              </div>
              <form onSubmit={atualizarFechamento} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end mt-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Notas emitidas até</label>
                  <input
                    type="date"
                    value={fechamento.data_limite}
                    onChange={e => setFechamento({ ...fechamento, data_limite: e.target.value })}
                    className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-all text-slate-700 shadow-inner"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Horário limite</label>
                  <input
                    type="time"
                    value={fechamento.horario_limite}
                    onChange={e => setFechamento({ ...fechamento, horario_limite: e.target.value })}
                    className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-all text-slate-700 shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-[46px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-100 uppercase tracking-wider active:scale-[0.98]"
                >
                  Atualizar Controle
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* NOTAS FISCAIS */}
      {subAba === 'notas' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <span className="text-sm font-bold text-slate-800">Listagem de Notas do Período</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Data</th><th className="py-3.5 px-6">Nota</th><th className="py-3.5 px-6">Tomador</th><th className="py-3.5 px-6">Serviço</th><th className="py-3.5 px-6 text-right">Valor</th><th className="py-3.5 px-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {notasFiltradas.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-bold">Nenhuma nota fiscal encontrada.</td></tr>
                ) : notasFiltradas.map(nota => (
                  <tr key={nota.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-all">
                    <td className="py-4 px-6 text-slate-500">{formatarData(nota.data_emissao)}</td>
                    <td className="py-4 px-6 font-mono font-bold"><span className="bg-slate-100 px-2 py-1 rounded text-slate-600">{nota.numero_nota}</span></td>
                    <td className="py-4 px-6 text-slate-500 max-w-[220px] truncate">{nota.tomador}</td>
                    <td className="py-4 px-6 font-semibold text-slate-700">{nota.servico}</td>
                    <td className="py-4 px-6 text-right font-bold text-emerald-600">R$ {Number(nota.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-4 px-6 text-center space-x-2">
                      <button onClick={() => prepararEdicaoNota(nota)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={15} /></button>
                      <button onClick={() => deletarRegistro('empresa_notas_fiscais', nota.id)} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DESPESAS */}
      {subAba === 'despesas' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 text-sm font-bold text-slate-800 bg-slate-50/50">Listagem de Despesas e Custos</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Tipo</th><th className="py-3.5 px-6">Descrição</th><th className="py-3.5 px-6">Periodicidade</th><th className="py-3.5 px-6 text-right">Valor Bruto</th><th className="py-3.5 px-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {despesasFiltradas.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-bold">Nenhum custo registrado neste mês.</td></tr>
                ) : despesasFiltradas.map(desp => (
                  <tr key={desp.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-all">
                    <td className="py-4 px-6"><span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold text-[10px]">{desp.tipo}</span></td>
                    <td className="py-4 px-6 font-semibold text-slate-700">{desp.descricao || 'Sem descrição'}</td>
                    <td className="py-4 px-6 font-bold text-slate-600">{desp.periodicidade}</td>
                    <td className="py-4 px-6 text-right font-bold text-rose-600">R$ {Number(desp.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-4 px-6 text-center space-x-2">
                      <button onClick={() => prepararEdicaoDespesa(desp)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 size={15} /></button>
                      <button onClick={() => deletarRegistro('empresa_despesas', desp.id)} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RELATÓRIOS */}
      {subAba === 'relatorios' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 text-sm font-bold text-slate-800 bg-slate-50/50">Relatório Mensal Detalhado — {anoAtivo}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                  <th className="py-3.5 px-6">Mês</th><th className="py-3.5 px-6">Faturamento</th><th className="py-3.5 px-6">%</th><th className="py-3.5 px-6">Imposto Est.</th><th className="py-3.5 px-6">Custos</th><th className="py-3.5 px-6">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(mKey => {
                  const mNom = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(mKey)-1];
                  const nM = notas.filter(n => n.data_emissao?.startsWith(`${anoAtivo}-${mKey}`));
                  const fatM = nM.reduce((sum, n) => sum + (Number(n.valor) || 0), 0);
                  const alM = Number(mKey) >= 6 ? 0.07 : 0.06;
                  const impM = fatM * alM;
                  const custM = despesas.reduce((sum, d) => {
                    const v = Number(d.valor) || 0;
                    if (d.periodicidade === 'Anual') return sum + (v / 12);
                    return d.data_vencimento && d.data_vencimento.substring(0, 7) === `${anoAtivo}-${mKey}` ? sum + v : sum;
                  }, 0);
                  const lucM = fatM - impM - custM;
                  return (
                    <tr key={mKey} className={`border-b border-slate-50 hover:bg-slate-50/50 ${mesAtivo === mKey ? 'bg-blue-50/40 font-bold' : ''}`}>
                      <td className="py-4 px-6 text-slate-800 font-bold">{mNom}</td>
                      <td className="py-4 px-6 text-emerald-600 font-semibold">R$ {fatM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 px-6 text-slate-400">{(alM * 100).toFixed(2)}%</td>
                      <td className="py-4 px-6 text-amber-600">R$ {impM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 px-6 text-rose-600">R$ {custM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className={`py-4 px-6 font-bold ${lucM >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {lucM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL NOTA */}
      {modalNota && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">{idEditando ? 'Editar Nota Fiscal' : 'Lançar Nota Fiscal'}</h3>
              <button onClick={() => { setModalNota(false); setIdEditando(null); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={salvarNota} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required placeholder="Número Nota" value={novaNota.numero_nota} onChange={e => setNovaNota({...novaNota, numero_nota: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
                <input type="date" required value={novaNota.data_emissao} onChange={e => setNovaNota({...novaNota, data_emissao: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
              </div>
              <input type="text" placeholder="Nome do Tomador" value={novaNota.tomador} onChange={e => setNovaNota({...novaNota, tomador: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
              <input type="text" required placeholder="Serviço Prestado" value={novaNota.servico} onChange={e => setNovaNota({...novaNota, servico: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
              <input type="number" step="0.01" required placeholder="Valor Bruto (R$)" value={novaNota.valor} onChange={e => setNovaNota({...novaNota, valor: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 hover:bg-blue-700 transition-all">
                {idEditando ? 'Salvar Alterações' : 'Salvar Nota Fiscal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DESPESA */}
      {modalDespesa && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">{idEditando ? 'Editar Custo / Despesa' : 'Lançar Custo / Despesa'}</h3>
              <button onClick={() => { setModalDespesa(false); setIdEditando(null); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={salvarDespesa} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select value={novaDespesa.tipo} onChange={e => setNovaDespesa({...novaDespesa, tipo: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700">
                  <option value="CONTABILIDADE">Contabilidade</option><option value="CERTIFICADO_DIGITAL">Certificado Digital</option>
                  <option value="IMPOSTOS">Impostos</option><option value="PRO LABORE">Pró-labore</option><option value="OUTROS">Outros</option>
                </select>
                <select value={novaDespesa.periodicidade} onChange={e => setNovaDespesa({...novaDespesa, periodicidade: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700">
                  <option value="Mensal">Mensal</option><option value="Anual">Anual</option>
                </select>
              </div>
              <input type="text" required placeholder="Descrição" value={novaDespesa.descricao} onChange={e => setNovaDespesa({...novaDespesa, descricao: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" step="0.01" required placeholder="Valor (R$)" value={novaDespesa.valor} onChange={e => setNovaDespesa({...novaDespesa, valor: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
                <input type="date" value={novaDespesa.data_vencimento} onChange={e => setNovaDespesa({...novaDespesa, data_vencimento: e.target.value})} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-100 hover:bg-blue-700 transition-all">
                {idEditando ? 'Salvar Alterações' : 'Salvar Custo'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
