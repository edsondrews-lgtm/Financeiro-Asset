import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CreditCard, DollarSign, TrendingUp, Plus, Pencil, Trash2, X, Calendar, ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown } from 'lucide-react';
import GraficoGastos from './GraficoGastos';
import ImportadorNubank from './ImportadorNubank';

interface Cartao {
  id: string;
  nome_cartao: string;
  limite_total: number;
  dia_vencimento: number;
  dia_fechamento: number;
}

interface Gasto {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_gasto: string;
  cartao_id: string | null;
  periodicidade: string;
}

const CATEGORIA_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  Investimento: { color: 'text-violet-700', bg: 'bg-violet-50', dot: '#7C3AED' },
  Moradia:      { color: 'text-sky-700',    bg: 'bg-sky-50',    dot: '#0284C7' },
  Lazer:        { color: 'text-emerald-700',bg: 'bg-emerald-50',dot: '#059669' },
  Vestuário:    { color: 'text-amber-700',  bg: 'bg-amber-50',  dot: '#D97706' },
  Alimentação:  { color: 'text-rose-700',   bg: 'bg-rose-50',   dot: '#E11D48' },
  Assinatura:   { color: 'text-indigo-700', bg: 'bg-indigo-50', dot: '#4338CA' },
  Mercado:      { color: 'text-teal-700',   bg: 'bg-teal-50',   dot: '#0D9488' },
  Supérfluos:   { color: 'text-pink-700',   bg: 'bg-pink-50',   dot: '#DB2777' },
  Transporte:   { color: 'text-orange-700', bg: 'bg-orange-50', dot: '#EA580C' },
  Saúde:        { color: 'text-cyan-700',   bg: 'bg-cyan-50',   dot: '#0891B2' },
  Outros:       { color: 'text-slate-600',  bg: 'bg-slate-100', dot: '#64748B' },
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function navegarMes(atual: string, direcao: number): string {
  const [ano, mes] = atual.split('-').map(Number);
  const d = new Date(ano, mes - 1 + direcao, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMesLabel(ym: string): string {
  const [ano, mes] = ym.split('-').map(Number);
  return `${MESES[mes - 1]} ${ano}`;
}

function fmtBRL(val: number): string {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// ── Pill filter ──────────────────────────────────────────────────────────────
function FilterPill({
  icon, label, active, onClick,
}: { icon?: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
        ${active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({
  title, value, delta, deltaUp, dotColor, icon: Icon,
}: {
  title: string; value: string; delta?: string; deltaUp?: boolean; dotColor: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 hover:border-slate-200 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</span>
        </div>
        <Icon size={14} className="text-slate-300" />
      </div>
      <p className="text-2xl font-black text-slate-800 tracking-tight leading-none">
        R$ {value}
      </p>
      {delta && (
        <p className={`text-[11px] font-semibold ${deltaUp ? 'text-rose-500' : 'text-emerald-500'}`}>
          {deltaUp ? '↑' : '↓'} {delta} vs mês anterior
        </p>
      )}
    </div>
  );
}

// ── Rank bar item ─────────────────────────────────────────────────────────────
function RankItem({
  pos, cat, val, max,
}: { pos: number; cat: string; val: number; max: number }) {
  const cfg = CATEGORIA_CONFIG[cat] ?? CATEGORIA_CONFIG['Outros'];
  const pct = max > 0 ? (val / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[10px] text-slate-300 font-bold w-4 text-right shrink-0">{pos}</span>
      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      </span>
      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{cat}</span>
      <div className="w-16 h-1 rounded-full bg-slate-100 shrink-0">
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: cfg.dot }} />
      </div>
      <span className="text-xs font-bold text-slate-800 w-20 text-right shrink-0">
        R$ {fmtBRL(val)}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SaidasPainel() {
  const [subAba, setSubAba] = useState('geral');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  const [modalCartaoAberto, setModalCartaoAberto] = useState(false);
  const [modalSaidaAberto, setModalSaidaAberto] = useState(false);
  const [filtroCartao, setFiltroCartao] = useState('todos');
  const [editandoItem, setEditandoItem] = useState<any>(null);
  const [formCartao, setFormCartao] = useState({ nome_cartao: '', limite_total: '', dia_vencimento: '', dia_fechamento: '' });
  const [formSaida, setFormSaida] = useState({
    descricao: '', categoria: 'Moradia', valor: '',
    data_gasto: new Date().toISOString().split('T')[0], cartao_id: '', periodicidade: 'Mensal',
  });

  useEffect(() => { carregarDadosGlobais(); }, [mesFiltro]);

  async function carregarDadosGlobais() {
    setLoading(true);
    try {
      const { data: dataC } = await supabase.from('pessoal_cartoes').select('*').order('nome_cartao');
      if (dataC) setCartoes(dataC);
      const [ano, mes] = mesFiltro.split('-');
      const primeiroDia = `${ano}-${mes}-01`;
      const ultimoDia = `${ano}-${mes}-${new Date(Number(ano), Number(mes), 0).getDate()}`;
      const { data: dataG } = await supabase.from('pessoal_saidas').select('*').gte('data_gasto', primeiroDia).lte('data_gasto', ultimoDia).order('data_gasto', { ascending: false });
      if (dataG) setGastos(dataG);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function handleSalvarCartao(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      nome_cartao: formCartao.nome_cartao,
      limite_total: Number(formCartao.limite_total) || 0,
      dia_vencimento: Number(formCartao.dia_vencimento) || 10,
      dia_fechamento: Number(formCartao.dia_fechamento) || 3,
    };
    if (editandoItem) { await supabase.from('pessoal_cartoes').update(dados).eq('id', editandoItem.id); }
    else { await supabase.from('pessoal_cartoes').insert([dados]); }
    fecharModais(); carregarDadosGlobais();
  }

  async function handleDeletarCartao(id: string) {
    if (window.confirm('Excluir este cartão?')) { await supabase.from('pessoal_cartoes').delete().eq('id', id); carregarDadosGlobais(); }
  }

  async function handleSalvarSaida(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      descricao: formSaida.descricao, categoria: formSaida.categoria,
      valor: Number(formSaida.valor) || 0, data_gasto: formSaida.data_gasto,
      periodicidade: formSaida.periodicidade,
      cartao_id: formSaida.cartao_id === '' ? null : formSaida.cartao_id,
    };
    if (editandoItem) { await supabase.from('pessoal_saidas').update(dados).eq('id', editandoItem.id); }
    else { await supabase.from('pessoal_saidas').insert([dados]); }
    fecharModais(); carregarDadosGlobais();
  }

  async function handleDeletarSaida(id: string) {
    if (window.confirm('Apagar este lançamento?')) { await supabase.from('pessoal_saidas').delete().eq('id', id); carregarDadosGlobais(); }
  }

  function abrirEdicao(item: any, tipo: string) {
    setEditandoItem(item);
    if (tipo === 'cartao') { setFormCartao({ ...item }); setModalCartaoAberto(true); }
    else { setFormSaida({ ...item, cartao_id: item.cartao_id || '' }); setModalSaidaAberto(true); }
  }

  function fecharModais() {
    setModalCartaoAberto(false); setModalSaidaAberto(false); setEditandoItem(null);
    setFormCartao({ nome_cartao: '', limite_total: '', dia_vencimento: '', dia_fechamento: '' });
    setFormSaida({ descricao: '', categoria: 'Moradia', valor: '', data_gasto: new Date().toISOString().split('T')[0], cartao_id: '', periodicidade: 'Mensal' });
  }

  const totalCartoes = gastos.filter(g => g.cartao_id).reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
  const totalFixasDirect = gastos.filter(g => !g.cartao_id).reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
  const totalGeralSaidas = totalCartoes + totalFixasDirect;

  const listaFiltrada = filtroCartao === 'pix'
    ? gastos.filter(g => !g.cartao_id)
    : filtroCartao !== 'todos'
      ? gastos.filter(g => g.cartao_id === filtroCartao)
      : gastos;

  const rankingCats = Object.entries(
    gastos.reduce((acc: Record<string, number>, g) => ({
      ...acc, [g.categoria]: (acc[g.categoria] || 0) + (Number(g.valor) || 0),
    }), {})
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = rankingCats[0]?.[1] ?? 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-rose-600 rounded-xl flex items-center justify-center shadow-sm">
              <CreditCard size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">Saídas & Cartões</h2>
              <p className="text-xs text-slate-400 font-medium">Controle de faturas, custos e assinaturas</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month navigator */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1.5">
              <button
                onClick={() => setMesFiltro(navegarMes(mesFiltro, -1))}
                className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-slate-700 px-1.5 min-w-[72px] text-center">
                {formatMesLabel(mesFiltro)}
              </span>
              <button
                onClick={() => setMesFiltro(navegarMes(mesFiltro, 1))}
                className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Account filter */}
            <div className="relative">
              <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={filtroCartao}
                onChange={e => setFiltroCartao(e.target.value)}
                className="bg-white border border-slate-200 rounded-full pl-8 pr-8 py-1.5 text-xs font-semibold text-slate-700 appearance-none cursor-pointer focus:outline-none focus:border-slate-400 hover:border-slate-300 transition-colors"
              >
                <option value="todos">Todas as contas</option>
                <option value="pix">PIX / Dinheiro</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome_cartao}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Tab nav */}
            <div className="flex items-center bg-white border border-slate-200 rounded-full p-0.5">
              {(['geral', 'cartoes', 'lancamentos'] as const).map(aba => (
                <button
                  key={aba}
                  onClick={() => setSubAba(aba)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    subAba === aba
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {aba === 'geral' ? 'Dashboard' : aba === 'cartoes' ? 'Cartões' : 'Lançamentos'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Sincronizando...
          </div>
        )}

        {/* ── Dashboard ──────────────────────────────────────────────────── */}
        {subAba === 'geral' && (
          <div className="space-y-4">
            {/* Metrics row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Faturas cartão" value={fmtBRL(totalCartoes)}
                dotColor="#7C3AED" icon={CreditCard}
              />
              <MetricCard
                title="Custos diretos" value={fmtBRL(totalFixasDirect)}
                dotColor="#0284C7" icon={DollarSign}
              />
              <MetricCard
                title="Total geral" value={fmtBRL(totalGeralSaidas)}
                dotColor="#E11D48" icon={TrendingUp}
              />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Donut + legend */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <p className="text-xs font-bold text-slate-700 mb-4">Distribuição por categoria</p>
                <GraficoGastos gastos={gastos} />
              </div>

              {/* Ranking */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <p className="text-xs font-bold text-slate-700 mb-1">Ranking de gastos</p>
                <p className="text-[10px] text-slate-400 font-medium mb-4">{rankingCats.length} categorias · {formatMesLabel(mesFiltro)}</p>
                <div>
                  {rankingCats.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Nenhum gasto no período</p>
                  ) : rankingCats.map(([cat, val], i) => (
                    <RankItem key={cat} pos={i + 1} cat={cat} val={val} max={maxCat} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Cartões ────────────────────────────────────────────────────── */}
        {subAba === 'cartoes' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Meus cartões</h3>
                <p className="text-xs text-slate-400 font-medium">Gerencie limites e faturas</p>
              </div>
              <button
                onClick={() => setModalCartaoAberto(true)}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
              >
                <Plus size={13} /> Novo cartão
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cartoes.map(cartao => {
                const fatura = gastos.filter(g => g.cartao_id === cartao.id).reduce((acc, g) => acc + (Number(g.valor) || 0), 0);
                const pctLimite = cartao.limite_total > 0 ? Math.min((fatura / cartao.limite_total) * 100, 100) : 0;
                const isSicoob = cartao.nome_cartao.toLowerCase().includes('sicoob');
                const isNubank = cartao.nome_cartao.toLowerCase().includes('nubank');
                const accent = isSicoob ? '#0D9488' : isNubank ? '#7C3AED' : '#1E293B';

                return (
                  <div key={cartao.id} className="rounded-2xl border border-slate-100 overflow-hidden group">
                    {/* Card header */}
                    <div className="p-5 relative" style={{ background: accent }}>
                      <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEdicao(cartao, 'cartao')} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"><Pencil size={11} /></button>
                        <button onClick={() => handleDeletarCartao(cartao.id)} className="p-1.5 bg-black/20 hover:bg-black/30 rounded-lg text-white transition-colors"><Trash2 size={11} /></button>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-3">{cartao.nome_cartao}</p>
                      <p className="text-2xl font-black text-white">R$ {fmtBRL(fatura)}</p>
                      <p className="text-[10px] text-white/50 font-medium mt-0.5">Fatura no período</p>
                    </div>
                    {/* Card footer */}
                    <div className="bg-white px-5 py-3 space-y-2">
                      {/* Progress bar */}
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1">
                        <span>Limite utilizado</span>
                        <span>{pctLimite.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pctLimite}%`, background: pctLimite > 80 ? '#E11D48' : accent }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-500 pt-1">
                        <span>Vence dia {cartao.dia_vencimento}</span>
                        <span className="text-slate-700">Limite R$ {Number(cartao.limite_total).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Lançamentos ────────────────────────────────────────────────── */}
        {subAba === 'lancamentos' && (
          <div className="space-y-4">
            <ImportadorNubank cartoes={cartoes} onImportSucess={carregarDadosGlobais} />

            <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Lançamentos</h3>
                  <p className="text-xs text-slate-400 font-medium">{listaFiltrada.length} registros · {formatMesLabel(mesFiltro)}</p>
                </div>
                <button
                  onClick={() => setModalSaidaAberto(true)}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
                >
                  <Plus size={13} /> Lançar saída
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Data</th>
                      <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição</th>
                      <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Categoria</th>
                      <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Canal</th>
                      <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Valor</th>
                      <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {listaFiltrada.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-xs text-slate-400 font-semibold">
                          Nenhum lançamento no período
                        </td>
                      </tr>
                    ) : listaFiltrada.map(gasto => {
                      const cartaoVinculado = cartoes.find(c => c.id === gasto.cartao_id);
                      const cfg = CATEGORIA_CONFIG[gasto.categoria] ?? CATEGORIA_CONFIG['Outros'];
                      return (
                        <tr key={gasto.id} className="hover:bg-slate-50/60 transition-colors group/row">
                          <td className="py-3 text-[11px] text-slate-400 font-medium">
                            {new Date(gasto.data_gasto).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </td>
                          <td className="py-3 text-xs text-slate-800 font-semibold">{gasto.descricao}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${cfg.bg} ${cfg.color}`}>
                              {gasto.categoria}
                            </span>
                          </td>
                          <td className="py-3 text-[11px] font-semibold">
                            {cartaoVinculado
                              ? <span className="text-violet-600">💳 {cartaoVinculado.nome_cartao}</span>
                              : <span className="text-emerald-600">PIX / Dinheiro</span>
                            }
                          </td>
                          <td className="py-3 text-right text-xs font-black text-slate-800">
                            R$ {fmtBRL(Number(gasto.valor))}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button onClick={() => abrirEdicao(gasto, 'saida')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><Pencil size={13} /></button>
                              <button onClick={() => handleDeletarSaida(gasto.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Cartão ───────────────────────────────────────────────── */}
        {modalCartaoAberto && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
              <button onClick={fecharModais} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{editandoItem ? 'Editar cartão' : 'Novo cartão'}</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Preencha os dados do cartão</p>
              </div>
              <form onSubmit={handleSalvarCartao} className="space-y-4">
                <Field label="Nome do cartão">
                  <input required type="text" className={inputCls} placeholder="Ex: Nubank, Sicoob..." value={formCartao.nome_cartao} onChange={e => setFormCartao({ ...formCartao, nome_cartao: e.target.value })} />
                </Field>
                <Field label="Limite total (R$)">
                  <input required type="number" step="any" className={inputCls} placeholder="0,00" value={formCartao.limite_total} onChange={e => setFormCartao({ ...formCartao, limite_total: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Dia de fechamento">
                    <input required type="number" min="1" max="31" className={inputCls} value={formCartao.dia_fechamento} onChange={e => setFormCartao({ ...formCartao, dia_fechamento: e.target.value })} />
                  </Field>
                  <Field label="Dia de vencimento">
                    <input required type="number" min="1" max="31" className={inputCls} value={formCartao.dia_vencimento} onChange={e => setFormCartao({ ...formCartao, dia_vencimento: e.target.value })} />
                  </Field>
                </div>
                <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                  Salvar cartão
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Saída ────────────────────────────────────────────────── */}
        {modalSaidaAberto && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
              <button onClick={fecharModais} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{editandoItem ? 'Editar lançamento' : 'Lançar nova saída'}</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Registre um gasto no período</p>
              </div>
              <form onSubmit={handleSalvarSaida} className="space-y-4">
                <Field label="Descrição">
                  <input required type="text" className={inputCls} placeholder="Ex: Aluguel, Spotify..." value={formSaida.descricao} onChange={e => setFormSaida({ ...formSaida, descricao: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Categoria">
                    <select className={inputCls} value={formSaida.categoria} onChange={e => setFormSaida({ ...formSaida, categoria: e.target.value })}>
                      {Object.keys(CATEGORIA_CONFIG).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Valor (R$)">
                    <input required type="number" step="any" className={inputCls} placeholder="0,00" value={formSaida.valor} onChange={e => setFormSaida({ ...formSaida, valor: e.target.value })} />
                  </Field>
                </div>
                <Field label="Forma de pagamento">
                  <select className={inputCls} value={formSaida.cartao_id} onChange={e => setFormSaida({ ...formSaida, cartao_id: e.target.value })}>
                    <option value="">PIX / Dinheiro direto</option>
                    {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome_cartao}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Periodicidade">
                    <select className={inputCls} value={formSaida.periodicidade} onChange={e => setFormSaida({ ...formSaida, periodicidade: e.target.value })}>
                      <option value="Mensal">Mensal</option>
                      <option value="Único">Único</option>
                      <option value="Anual">Anual</option>
                    </select>
                  </Field>
                  <Field label="Data">
                    <input required type="date" className={inputCls} value={formSaida.data_gasto} onChange={e => setFormSaida({ ...formSaida, data_gasto: e.target.value })} />
                  </Field>
                </div>
                <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                  Salvar lançamento
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-0 hover:border-slate-300 transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}