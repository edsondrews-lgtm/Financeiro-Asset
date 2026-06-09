import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CreditCard, DollarSign, TrendingUp, Plus, Pencil, Trash2, X, Calendar } from 'lucide-react';
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
  const [formSaida, setFormSaida] = useState({ descricao: '', categoria: 'Moradia', valor: '', data_gasto: new Date().toISOString().split('T')[0], cartao_id: '', periodicidade: 'Mensal' });

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
    const dados = { nome_cartao: formCartao.nome_cartao, limite_total: Number(formCartao.limite_total) || 0, dia_vencimento: Number(formCartao.dia_vencimento) || 10, dia_fechamento: Number(formCartao.dia_fechamento) || 3 };
    if (editandoItem) { await supabase.from('pessoal_cartoes').update(dados).eq('id', editandoItem.id); }
    else { await supabase.from('pessoal_cartoes').insert([dados]); }
    fecharModais(); carregarDadosGlobais();
  }

  async function handleDeletarCartao(id: string) {
    if (window.confirm('Excluir este cartão?')) { await supabase.from('pessoal_cartoes').delete().eq('id', id); carregarDadosGlobais(); }
  }

  async function handleSalvarSaida(e: React.FormEvent) {
    e.preventDefault();
    const dados = { descricao: formSaida.descricao, categoria: formSaida.categoria, valor: Number(formSaida.valor) || 0, data_gasto: formSaida.data_gasto, periodicidade: formSaida.periodicidade, cartao_id: formSaida.cartao_id === '' ? null : formSaida.cartao_id };
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

  const totalCartoes = gastos.filter(g => g.cartao_id).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const totalFixasDirect = gastos.filter(g => !g.cartao_id).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const totalGeralSaidas = totalCartoes + totalFixasDirect;

  const listaFiltrada = filtroCartao === 'pix' ? gastos.filter(g => !g.cartao_id) : filtroCartao !== 'todos' ? gastos.filter(g => g.cartao_id === filtroCartao) : gastos;

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 rounded-xl text-white shadow-md shadow-rose-100"><CreditCard size={24} /></div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Saídas & Cartões</h2>
            <p className="text-slate-500 text-sm font-medium">Controle de faturas, custos, assinaturas e investimentos</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/50">
            <Calendar size={14} className="text-slate-500" />
            <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="bg-transparent border-0 p-0 text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer" />
          </div>
          <select value={filtroCartao} onChange={e => setFiltroCartao(e.target.value)} className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/50 text-xs font-bold text-slate-700 cursor-pointer focus:ring-0">
            <option value="todos">Todos os Cartões/Contas</option>
            <option value="pix">💵 PIX / Dinheiro</option>
            {cartoes.map(c => <option key={c.id} value={c.id}>💳 {c.nome_cartao}</option>)}
          </select>
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/40">
            {['geral', 'cartoes', 'lancamentos'].map(aba => (
              <button key={aba} onClick={() => setSubAba(aba)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${subAba === aba ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {aba === 'geral' ? 'Dashboard' : aba === 'cartoes' ? 'Cartões' : 'Lançamentos'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {loading && <p className="text-xs font-bold text-rose-600 animate-pulse">Sincronizando...</p>}

      {subAba === 'geral' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Faturas Cartão', val: totalCartoes, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { title: 'Custos Diretos', val: totalFixasDirect, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { title: 'Total Geral', val: totalGeralSaidas, icon: TrendingUp, color: 'text-rose-600', bg: 'bg-rose-50' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}><item.icon size={18} /></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.title}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">R$ {item.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GraficoGastos gastos={gastos} />
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="text-sm font-bold text-slate-700 mb-4">Ranking de Gastos</h4>
              <div className="space-y-3">
                {Object.entries(gastos.reduce((acc: Record<string, number>, g) => ({ ...acc, [g.categoria]: (acc[g.categoria] || 0) + (Number(g.valor) || 0) }), {}))
                  .sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-600">{cat}</span>
                      <span className="font-bold text-rose-600">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {subAba === 'cartoes' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div><h3 className="text-lg font-bold text-slate-800">Meus Cartões</h3><p className="text-xs text-slate-400 font-medium">Gerencie limites e faturas</p></div>
            <button onClick={() => setModalCartaoAberto(true)} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"><Plus size={14} /> Novo Cartão</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cartoes.map(cartao => {
              const faturamentoCartao = gastos.filter(g => g.cartao_id === cartao.id).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
              const isSicoob = cartao.nome_cartao.toLowerCase().includes('sicoob');
              const isNubank = cartao.nome_cartao.toLowerCase().includes('nubank');
              const estiloCard = isSicoob ? 'bg-gradient-to-br from-teal-500 to-teal-700 text-white' : isNubank ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white' : 'bg-gradient-to-tr from-slate-900 to-slate-800 text-white';
              return (
                <div key={cartao.id} className={`${estiloCard} p-6 rounded-2xl relative overflow-hidden shadow-md group`}>
                  <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => abrirEdicao(cartao, 'cartao')} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-md"><Pencil size={12} /></button>
                    <button onClick={() => handleDeletarCartao(cartao.id)} className="p-1.5 bg-black/20 hover:bg-black/40 rounded-md"><Trash2 size={12} /></button>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{cartao.nome_cartao}</p>
                  <h4 className="text-2xl font-black mt-4">R$ {faturamentoCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                  <p className="text-[10px] opacity-70 font-medium mt-1">Fatura no Mês Selecionado</p>
                  <div className="flex justify-between items-center mt-6 text-[11px] border-t border-white/20 pt-4">
                    <span>Vence dia: {cartao.dia_vencimento}</span>
                    <span className="font-bold">Limite: R$ {Number(cartao.limite_total).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subAba === 'lancamentos' && (
        <div className="space-y-6">
          <ImportadorNubank cartoes={cartoes} onImportSucess={carregarDadosGlobais} />
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div><h3 className="text-lg font-bold text-slate-800">Lançamentos de Saídas</h3><p className="text-xs text-slate-400 font-medium">Registros do período selecionado</p></div>
              <button onClick={() => setModalSaidaAberto(true)} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"><Plus size={14} /> Lançar Saída</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Data</th><th className="pb-3">Descrição</th><th className="pb-3">Categoria</th><th className="pb-3">Canal</th><th className="pb-3 text-right">Valor</th><th className="pb-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-50 text-slate-600 font-medium">
                  {listaFiltrada.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-bold">Nenhum lançamento encontrado.</td></tr>
                  ) : listaFiltrada.map(gasto => {
                    const cartaoVinculado = cartoes.find(c => c.id === gasto.cartao_id);
                    return (
                      <tr key={gasto.id} className="hover:bg-slate-50/80 transition-all">
                        <td className="py-3.5 text-xs text-slate-400">{new Date(gasto.data_gasto).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                        <td className="py-3.5 text-slate-800 font-semibold">{gasto.descricao}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${gasto.categoria === 'Investimento' ? 'bg-emerald-50 text-emerald-700' : gasto.categoria === 'Assinatura' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{gasto.categoria}</span>
                        </td>
                        <td className="py-3.5 text-xs">
                          {cartaoVinculado ? <span className="text-indigo-600 font-semibold">💳 {cartaoVinculado.nome_cartao}</span> : <span className="text-emerald-600 font-semibold">💵 PIX / Dinheiro</span>}
                        </td>
                        <td className="py-3.5 text-right font-bold text-slate-900">R$ {Number(gasto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => abrirEdicao(gasto, 'saida')} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"><Pencil size={14} /></button>
                            <button onClick={() => handleDeletarSaida(gasto.id)} className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
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

      {modalCartaoAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl relative space-y-4">
            <button onClick={fecharModais} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            <h3 className="text-lg font-bold text-slate-900">{editandoItem ? 'Editar Cartão' : 'Novo Cartão'}</h3>
            <form onSubmit={handleSalvarCartao} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1"><label className="text-slate-500">Nome do Cartão</label><input required type="text" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 text-slate-800" value={formCartao.nome_cartao} onChange={e => setFormCartao({ ...formCartao, nome_cartao: e.target.value })} /></div>
              <div className="space-y-1"><label className="text-slate-500">Limite Total (R$)</label><input required type="number" step="any" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500 text-slate-800" value={formCartao.limite_total} onChange={e => setFormCartao({ ...formCartao, limite_total: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-slate-500">Dia Fechamento</label><input required type="number" min="1" max="31" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formCartao.dia_fechamento} onChange={e => setFormCartao({ ...formCartao, dia_fechamento: e.target.value })} /></div>
                <div><label className="text-slate-500">Dia Vencimento</label><input required type="number" min="1" max="31" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formCartao.dia_vencimento} onChange={e => setFormCartao({ ...formCartao, dia_vencimento: e.target.value })} /></div>
              </div>
              <button type="submit" className="w-full bg-rose-600 text-white font-bold p-3 rounded-xl shadow-md">Salvar Cartão</button>
            </form>
          </div>
        </div>
      )}

      {modalSaidaAberto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl relative space-y-4">
            <button onClick={fecharModais} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            <h3 className="text-lg font-bold text-slate-900">{editandoItem ? 'Editar Lançamento' : 'Lançar Nova Saída'}</h3>
            <form onSubmit={handleSalvarSaida} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1"><label className="text-slate-500">Descrição</label><input required type="text" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formSaida.descricao} onChange={e => setFormSaida({ ...formSaida, descricao: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-slate-500">Categoria</label>
                  <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formSaida.categoria} onChange={e => setFormSaida({ ...formSaida, categoria: e.target.value })}>
                    {['Moradia','Assinatura','Investimento','Alimentação','Supérfluos','Lazer','Transporte','Saúde','Outros'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="text-slate-500">Valor (R$)</label><input required type="number" step="any" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formSaida.valor} onChange={e => setFormSaida({ ...formSaida, valor: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><label className="text-slate-500">Forma de Pagamento</label>
                <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formSaida.cartao_id} onChange={e => setFormSaida({ ...formSaida, cartao_id: e.target.value })}>
                  <option value="">💵 PIX / Dinheiro Direto</option>
                  {cartoes.map(c => <option key={c.id} value={c.id}>💳 {c.nome_cartao}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-slate-500">Periodicidade</label>
                  <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formSaida.periodicidade} onChange={e => setFormSaida({ ...formSaida, periodicidade: e.target.value })}>
                    <option value="Mensal">Mensal</option><option value="Único">Único</option><option value="Anual">Anual</option>
                  </select>
                </div>
                <div><label className="text-slate-500">Data</label><input required type="date" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800" value={formSaida.data_gasto} onChange={e => setFormSaida({ ...formSaida, data_gasto: e.target.value })} /></div>
              </div>
              <button type="submit" className="w-full bg-rose-600 text-white font-bold p-3 rounded-xl shadow-md">Salvar Lançamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
