import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, X, Edit2, Trash2, TrendingUp, Calendar, Wallet } from 'lucide-react';

interface Entrada {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data_entrada: string;
  recorrente: boolean;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PRO_LABORE: { label: 'Pró-labore', bg: 'bg-blue-100', text: 'text-blue-700' },
  DIVIDENDOS: { label: 'Dividendos', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  OUTROS:     { label: 'Outros',     bg: 'bg-slate-100',  text: 'text-slate-600' },
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function EntradasPessoais() {
  const hoje = new Date();
  const [mesAtivo, setMesAtivo] = useState(String(hoje.getMonth() + 1).padStart(2, '0'));
  const [anoAtivo, setAnoAtivo] = useState(String(hoje.getFullYear()));
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [tabelaExiste, setTabelaExiste] = useState(true);
  const [form, setForm] = useState({
    descricao: '', tipo: 'PRO_LABORE', valor: '',
    data_entrada: hoje.toISOString().split('T')[0], recorrente: false,
  });

  useEffect(() => { buscarEntradas(); }, [mesAtivo, anoAtivo]);

  async function buscarEntradas() {
    setLoading(true);
    try {
      const primeiroDia = `${anoAtivo}-${mesAtivo}-01`;
      const ultimoDia   = `${anoAtivo}-${mesAtivo}-${new Date(Number(anoAtivo), Number(mesAtivo), 0).getDate()}`;
      const { data, error } = await supabase
        .from('entradas_pessoais').select('*')
        .gte('data_entrada', primeiroDia).lte('data_entrada', ultimoDia)
        .order('data_entrada', { ascending: false });
      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTabelaExiste(false);
        } else {
          console.error(error);
        }
      } else {
        setTabelaExiste(true);
        if (data) setEntradas(data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      descricao: form.descricao, tipo: form.tipo,
      valor: parseFloat(form.valor), data_entrada: form.data_entrada,
      recorrente: form.recorrente,
    };
    try {
      if (idEditando) await supabase.from('entradas_pessoais').update(dados).eq('id', idEditando);
      else await supabase.from('entradas_pessoais').insert([dados]);
      setModal(false); setIdEditando(null);
      setForm({ descricao: '', tipo: 'PRO_LABORE', valor: '', data_entrada: hoje.toISOString().split('T')[0], recorrente: false });
      buscarEntradas();
    } catch (err: any) { alert('Erro: ' + err.message); }
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este lançamento?')) return;
    await supabase.from('entradas_pessoais').delete().eq('id', id);
    buscarEntradas();
  }

  function editar(e: Entrada) {
    setIdEditando(e.id);
    setForm({ descricao: e.descricao, tipo: e.tipo, valor: String(e.valor), data_entrada: e.data_entrada, recorrente: e.recorrente });
    setModal(true);
  }

  const formatarData = (d: string) => {
    const p = d.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  };

  const totalMes = entradas.reduce((s, e) => s + (Number(e.valor) || 0), 0);
  const totalPL   = entradas.filter(e => e.tipo === 'PRO_LABORE').reduce((s, e) => s + Number(e.valor), 0);
  const totalDiv  = entradas.filter(e => e.tipo === 'DIVIDENDOS').reduce((s, e) => s + Number(e.valor), 0);

  if (!tabelaExiste) {
    return (
      <div className="min-h-screen bg-slate-50/60 flex items-center justify-center p-8">
        <div className="bg-white border border-slate-100 rounded-2xl p-8 max-w-lg text-center shadow-sm space-y-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl w-fit mx-auto"><Wallet size={24}/></div>
          <h3 className="text-lg font-black text-slate-900">Tabela ainda não criada</h3>
          <p className="text-sm text-slate-500 font-medium">Acesse o Supabase e execute o SQL abaixo para ativar este módulo:</p>
          <pre className="text-left text-[11px] bg-slate-900 text-emerald-400 rounded-xl p-4 font-mono leading-relaxed overflow-x-auto">
{`CREATE TABLE entradas_pessoais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'PRO_LABORE',
  valor numeric NOT NULL,
  data_entrada date NOT NULL,
  recorrente boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);`}
          </pre>
          <button onClick={buscarEntradas} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">Verificar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-100">
              <TrendingUp size={20}/>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Entradas Pessoais</h1>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Pró-labore, dividendos e outras receitas</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <Calendar size={13} className="text-slate-400"/>
              <select value={mesAtivo} onChange={e => setMesAtivo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent pr-1">
                {MESES.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
              </select>
              <select value={anoAtivo} onChange={e => setAnoAtivo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent">
                <option>2026</option><option>2025</option>
              </select>
            </div>
            <button onClick={() => { setIdEditando(null); setForm({ descricao:'', tipo:'PRO_LABORE', valor:'', data_entrada: hoje.toISOString().split('T')[0], recorrente:false }); setModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all">
              <Plus size={13}/> Nova Entrada
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total do Mês</p>
            <p className="text-2xl font-black text-emerald-600 mt-2 tabular-nums">{fmt(totalMes)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pró-labore</p>
            <p className="text-2xl font-black text-blue-600 mt-2 tabular-nums">{fmt(totalPL)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dividendos</p>
            <p className="text-2xl font-black text-teal-600 mt-2 tabular-nums">{fmt(totalDiv)}</p>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-sm font-black text-slate-900">Lançamentos de {MESES[Number(mesAtivo)-1]} {anoAtivo}</p>
          </div>
          {loading && <div className="py-8 text-center text-xs font-bold text-slate-400">Carregando...</div>}
          {!loading && entradas.length === 0 && (
            <div className="py-16 text-center">
              <TrendingUp size={28} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-400 text-sm font-bold">Nenhuma entrada neste mês</p>
              <p className="text-slate-300 text-xs mt-1">Clique em "Nova Entrada" para começar</p>
            </div>
          )}
          {!loading && entradas.length > 0 && (
            <div className="divide-y divide-slate-50">
              <div className="grid grid-cols-12 px-6 py-2.5 bg-slate-50">
                <span className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</span>
                <span className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</span>
                <span className="col-span-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</span>
                <span className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</span>
                <span className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</span>
              </div>
              {entradas.map(e => {
                const cfg = TIPO_CONFIG[e.tipo] || TIPO_CONFIG.OUTROS;
                return (
                  <div key={e.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50/60 transition-colors">
                    <span className="col-span-2 text-xs text-slate-500 font-semibold">{formatarData(e.data_entrada)}</span>
                    <div className="col-span-2">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </div>
                    <span className="col-span-5 text-xs text-slate-800 font-semibold">
                      {e.descricao}
                      {e.recorrente && <span className="ml-2 text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold">RECORRENTE</span>}
                    </span>
                    <span className="col-span-2 text-xs font-black text-emerald-600 text-right tabular-nums">{fmt(Number(e.valor))}</span>
                    <div className="col-span-1 flex items-center justify-center gap-1">
                      <button onClick={() => editar(e)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={13}/></button>
                      <button onClick={() => deletar(e.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={13}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><TrendingUp size={15}/></div>
                <h3 className="text-sm font-black text-slate-900">{idEditando ? 'Editar Entrada' : 'Nova Entrada'}</h3>
              </div>
              <button onClick={() => { setModal(false); setIdEditando(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X size={16}/></button>
            </div>
            <form onSubmit={salvar} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                  <input type="text" placeholder="Ex: Pró-labore, Dividendos..." value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-400 focus:bg-white transition-all text-slate-700"/>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data *</label>
                  <input type="date" required value={form.data_entrada} onChange={e => setForm({...form, data_entrada: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 text-slate-700"/>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição *</label>
                <input type="text" required placeholder="Ex: Pró-labore Junho 2026" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-400 text-slate-700"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor (R$) *</label>
                <input type="number" step="0.01" required placeholder="0,00" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-400 text-slate-700"/>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={form.recorrente} onChange={e => setForm({...form, recorrente: e.target.checked})} className="w-4 h-4 rounded accent-emerald-600"/>
                <span className="text-xs font-semibold text-slate-700">Recorrente (lançamento mensal fixo)</span>
              </label>
              <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-100 mt-2">
                {idEditando ? 'Salvar Alterações' : 'Registrar Entrada'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
