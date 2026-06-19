import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  TrendingUp, Plus, X, Edit2, Trash2, ChevronLeft, ChevronRight,
  AlertTriangle, Info, CheckCircle, Settings, Tag,
} from 'lucide-react';

interface Entrada {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data_entrada: string;
  recorrente: boolean;
}

const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Tipos padrão do sistema
const TIPOS_PADRAO = [
  'Pró-labore',
  'Dividendos',
  'Salário',
  'Vendas',
  'Lucro Distribuído',
  'Aluguel',
  'Freelance',
  'Outros',
];

const TIPO_CORES: Record<string, { bg: string; text: string }> = {
  'Pró-labore':       { bg: 'bg-sky-50',      text: 'text-sky-700'      },
  'Dividendos':       { bg: 'bg-emerald-50',   text: 'text-emerald-700'  },
  'Salário':          { bg: 'bg-blue-50',      text: 'text-blue-700'     },
  'Vendas':           { bg: 'bg-violet-50',    text: 'text-violet-700'   },
  'Lucro Distribuído':{ bg: 'bg-teal-50',      text: 'text-teal-700'     },
  'Aluguel':          { bg: 'bg-amber-50',     text: 'text-amber-700'    },
  'Freelance':        { bg: 'bg-indigo-50',    text: 'text-indigo-700'   },
  'Outros':           { bg: 'bg-slate-100',    text: 'text-slate-600'    },
};

function getTipoCor(tipo: string) {
  return TIPO_CORES[tipo] ?? { bg: 'bg-slate-100', text: 'text-slate-600' };
}

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

function formatarData(d: string) {
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
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

function AlertaCard({ type, children }: { type: 'warn'|'ok'|'info'; children: React.ReactNode }) {
  const map = {
    warn: { cls: 'bg-amber-50 border border-amber-200 text-amber-800', Icon: AlertTriangle },
    ok:   { cls: 'bg-emerald-50 border border-emerald-200 text-emerald-800', Icon: CheckCircle },
    info: { cls: 'bg-sky-50 border border-sky-200 text-sky-800', Icon: Info },
  };
  const { cls, Icon } = map[type];
  return (
    <div className={`flex gap-2.5 items-start px-4 py-3 rounded-xl text-xs font-medium ${cls}`}>
      <Icon size={13} className="mt-0.5 shrink-0"/>
      <span>{children}</span>
    </div>
  );
}

const formInicial = {
  descricao: '', tipo: 'Pró-labore', valor: '',
  data_entrada: new Date().toISOString().split('T')[0], recorrente: false,
};

export default function EntradasPessoais() {
  const [mes,       setMes]       = useState(mesAtualYM);
  const [entradas,  setEntradas]  = useState<Entrada[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [modal,     setModal]     = useState(false);
  const [modalCat,  setModalCat]  = useState(false);   // modal de categorias
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form,      setForm]      = useState({ ...formInicial });
  const [tabelaExiste, setTabelaExiste] = useState(true);

  // categorias customizadas (localStorage simples)
  const [tiposCustom, setTiposCustom] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('entradas_tipos_custom') || '[]'); }
    catch { return []; }
  });
  const [novoTipo, setNovoTipo] = useState('');

  const todosOsTipos = [...TIPOS_PADRAO, ...tiposCustom.filter(t => !TIPOS_PADRAO.includes(t))];

  useEffect(() => { buscar(); }, [mes]);

  async function buscar() {
    setLoading(true);
    try {
      const [a, m] = mes.split('-').map(Number);
      const mm    = String(m).padStart(2, '0');
      const first = `${a}-${mm}-01`;
      const last  = `${a}-${mm}-${new Date(a, m, 0).getDate()}`;
      const { data, error } = await supabase
        .from('entradas_pessoais').select('*')
        .gte('data_entrada', first).lte('data_entrada', last)
        .order('data_entrada', { ascending: false });
      if (error) {
        if (error.code === '42P01') setTabelaExiste(false);
        else console.error(error);
      } else {
        setTabelaExiste(true);
        setEntradas(data ?? []);
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
    if (editId) await supabase.from('entradas_pessoais').update(dados).eq('id', editId);
    else        await supabase.from('entradas_pessoais').insert([dados]);
    fecharModal(); buscar();
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este lançamento?')) return;
    await supabase.from('entradas_pessoais').delete().eq('id', id);
    buscar();
  }

  function editar(e: Entrada) {
    setEditId(e.id);
    setForm({ descricao: e.descricao, tipo: e.tipo, valor: String(e.valor), data_entrada: e.data_entrada, recorrente: e.recorrente });
    setModal(true);
  }

  function fecharModal() {
    setModal(false); setEditId(null); setForm({ ...formInicial });
  }

  function adicionarTipo() {
    const t = novoTipo.trim();
    if (!t || todosOsTipos.includes(t)) return;
    const novos = [...tiposCustom, t];
    setTiposCustom(novos);
    localStorage.setItem('entradas_tipos_custom', JSON.stringify(novos));
    setNovoTipo('');
  }

  function removerTipo(t: string) {
    const novos = tiposCustom.filter(x => x !== t);
    setTiposCustom(novos);
    localStorage.setItem('entradas_tipos_custom', JSON.stringify(novos));
  }

  // totais
  const total    = entradas.reduce((a, e) => a + Number(e.valor), 0);
  const totalPL  = entradas.filter(e => e.tipo === 'Pró-labore').reduce((a, e) => a + Number(e.valor), 0);
  const totalDiv = entradas.filter(e => e.tipo === 'Dividendos').reduce((a, e) => a + Number(e.valor), 0);

  // ranking por tipo
  const rankingTipos = Object.entries(
    entradas.reduce<Record<string,number>>((acc, e) => ({
      ...acc, [e.tipo]: (acc[e.tipo] ?? 0) + Number(e.valor),
    }), {})
  ).sort((a, b) => b[1] - a[1]);

  const alertas: { type: 'warn'|'ok'|'info'; msg: string }[] = [];
  if (totalDiv === 0 && total > 0)
    alertas.push({ type: 'info', msg: 'Nenhum dividendo registrado. Cadastre rendimentos de investimentos para acompanhar sua renda passiva.' });
  if (total > 0 && (totalPL / total) > 0.9)
    alertas.push({ type: 'warn', msg: 'Mais de 90% da renda vem de uma única fonte. Diversificar reduz risco financeiro.' });
  if (total > 20000)
    alertas.push({ type: 'ok', msg: `Boa receita em ${labelMesYM(mes)}! Lembre de alocar pelo menos 20–30% em investimentos.` });

  if (!tabelaExiste) return (
    <div className="min-h-screen bg-slate-50/60 flex items-center justify-center p-8">
      <div className="bg-white border border-slate-100 rounded-2xl p-8 max-w-lg text-center space-y-4 shadow-sm">
        <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl w-fit mx-auto"><AlertTriangle size={22}/></div>
        <h3 className="text-sm font-bold text-slate-900">Tabela não encontrada</h3>
        <p className="text-xs text-slate-500">Execute o SQL abaixo no Supabase para ativar este módulo:</p>
        <pre className="text-left text-[11px] bg-slate-900 text-emerald-400 rounded-xl p-4 font-mono leading-relaxed overflow-x-auto">
{`CREATE TABLE entradas_pessoais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'Pró-labore',
  valor numeric NOT NULL,
  data_entrada date NOT NULL,
  recorrente boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);`}
        </pre>
        <button onClick={buscar} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold">Verificar novamente</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">

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
          <div className="flex items-center gap-2 self-start flex-wrap">
            {/* nav mês */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 shadow-sm">
              <button onClick={() => setMes(m => navegarMes(m, -1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><ChevronLeft size={14}/></button>
              <span className="text-xs font-bold text-slate-700 px-2 min-w-[120px] text-center">{labelMesYM(mes)}</span>
              <button onClick={() => setMes(m => navegarMes(m, 1))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><ChevronRight size={14}/></button>
            </div>
            {/* gerenciar categorias */}
            <button
              onClick={() => setModalCat(true)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Tag size={13}/> Categorias
            </button>
            {/* nova entrada */}
            <button
              onClick={() => { setEditId(null); setForm({ ...formInicial }); setModal(true); }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm shadow-emerald-100"
            >
              <Plus size={13}/> Nova entrada
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
            <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"/>
            Carregando...
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total do mês</p>
            <p className="text-2xl font-black text-emerald-600 tabular-nums">R$ {fmtBRL(total)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pró-labore</p>
            <p className="text-2xl font-black text-sky-700 tabular-nums">R$ {fmtBRL(totalPL)}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Dividendos</p>
            <p className={`text-2xl font-black tabular-nums ${totalDiv > 0 ? 'text-teal-700' : 'text-slate-300'}`}>
              R$ {fmtBRL(totalDiv)}
            </p>
          </div>
        </div>

        {/* Alertas */}
        {!loading && alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a, i) => <AlertaCard key={i} type={a.type}>{a.msg}</AlertaCard>)}
          </div>
        )}

        {/* Concentração por tipo */}
        {rankingTipos.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-sky-50 rounded-lg"><TrendingUp size={14} className="text-sky-600"/></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concentração de renda por tipo</p>
            </div>
            {/* barra empilhada */}
            <div className="w-full h-2.5 rounded-full overflow-hidden flex mb-4">
              {rankingTipos.map(([tipo, val], i) => {
                const cores = ['#0284C7','#059669','#7C3AED','#D97706','#0D9488','#4338CA','#E11D48','#64748B'];
                return (
                  <div key={tipo} style={{ width: `${(val/total)*100}%`, background: cores[i % cores.length] }}
                    title={`${tipo}: R$ ${fmtBRL(val)}`}/>
                );
              })}
            </div>
            <div className="space-y-2.5">
              {rankingTipos.map(([tipo, val], i) => {
                const pct  = Math.round((val / total) * 100);
                const cores = ['#0284C7','#059669','#7C3AED','#D97706','#0D9488','#4338CA','#E11D48','#64748B'];
                const cor  = cores[i % cores.length];
                return (
                  <div key={tipo}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }}/>
                        <span className="font-semibold text-slate-700">{tipo}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{pct}%</span>
                        <span className="font-black text-slate-800 w-24 text-right">R$ {fmtBRL(val)}</span>
                      </div>
                    </div>
                    <div className="w-full h-1 rounded-full bg-slate-100">
                      <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: cor }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabela de lançamentos */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <div>
              <p className="text-sm font-black text-slate-800">Lançamentos</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{entradas.length} registro{entradas.length !== 1 ? 's' : ''} · {labelMesYM(mes)}</p>
            </div>
          </div>

          {!loading && entradas.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp size={24} className="text-slate-200 mx-auto mb-3"/>
              <p className="text-xs font-semibold text-slate-400">Nenhuma entrada em {labelMesYM(mes)}</p>
              <p className="text-[10px] text-slate-300 mt-1">Clique em "Nova entrada" para registrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Data</th>
                    <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo</th>
                    <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição</th>
                    <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400"></th>
                    <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Valor</th>
                    <th className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {entradas.map(e => {
                    const ts = getTipoCor(e.tipo);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors group/row">
                        <td className="py-3 text-[11px] text-slate-400 font-medium pr-3">{formatarData(e.data_entrada)}</td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold ${ts.bg} ${ts.text}`}>{e.tipo}</span>
                        </td>
                        <td className="py-3 text-xs text-slate-800 font-semibold">{e.descricao}</td>
                        <td className="py-3 pr-3">
                          {e.recorrente && <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Fixo</span>}
                        </td>
                        <td className="py-3 text-xs font-black text-emerald-600 text-right pr-3">+ R$ {fmtBRL(Number(e.valor))}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button onClick={() => editar(e)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={12}/></button>
                            <button onClick={() => deletar(e.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={12}/></button>
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

      {/* ── Modal: Nova / Editar entrada ────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
            <button onClick={fecharModal} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15}/>
            </button>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{editId ? 'Editar entrada' : 'Nova entrada'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Registre uma receita no período</p>
            </div>
            <form onSubmit={salvar} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de receita">
                  <select className={inputCls} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    {todosOsTipos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Data">
                  <input required type="date" className={inputCls} value={form.data_entrada} onChange={e => setForm({ ...form, data_entrada: e.target.value })}/>
                </Field>
              </div>
              <Field label="Descrição">
                <input required type="text" className={inputCls} placeholder="Ex: Pró-labore Junho 2026" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}/>
              </Field>
              <Field label="Valor (R$)">
                <input required type="number" step="0.01" className={inputCls} placeholder="0,00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}/>
              </Field>
              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <input type="checkbox" checked={form.recorrente} onChange={e => setForm({ ...form, recorrente: e.target.checked })} className="w-4 h-4 rounded accent-emerald-600"/>
                <span className="text-xs font-semibold text-slate-700">Recorrente (lançamento mensal fixo)</span>
              </label>
              {/* atalho para criar categoria */}
              <button type="button" onClick={() => { fecharModal(); setModalCat(true); }}
                className="w-full py-2 border border-dashed border-slate-300 hover:border-slate-400 text-slate-400 hover:text-slate-600 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                <Tag size={12}/> Criar novo tipo de receita
              </button>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                {editId ? 'Salvar alterações' : 'Registrar entrada'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Gerenciar categorias ──────────────────────────────────── */}
      {modalCat && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
            <button onClick={() => setModalCat(false)} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15}/>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 rounded-xl"><Tag size={16} className="text-emerald-600"/></div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tipos de receita</h3>
                <p className="text-xs text-slate-400 mt-0.5">Gerencie as categorias do seu sistema</p>
              </div>
            </div>

            {/* padrões */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tipos padrão</p>
              <div className="flex flex-wrap gap-2">
                {TIPOS_PADRAO.map(t => {
                  const ts = getTipoCor(t);
                  return (
                    <span key={t} className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${ts.bg} ${ts.text}`}>{t}</span>
                  );
                })}
              </div>
            </div>

            {/* customizados */}
            {tiposCustom.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tipos personalizados</p>
                <div className="space-y-1.5">
                  {tiposCustom.map(t => (
                    <div key={t} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                      <span className="text-xs font-semibold text-slate-700">{t}</span>
                      <button onClick={() => removerTipo(t)} className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* adicionar novo */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Adicionar novo tipo</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  className={inputCls + ' flex-1'}
                  placeholder="Ex: Rendimento CDB, Aluguel..."
                  value={novoTipo}
                  onChange={e => setNovoTipo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarTipo())}
                />
                <button
                  onClick={adicionarTipo}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
                >
                  <Plus size={13}/>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Pressione Enter ou clique + para adicionar</p>
            </div>

            <button onClick={() => setModalCat(false)} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}