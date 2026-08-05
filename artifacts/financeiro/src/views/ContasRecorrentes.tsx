import React, { useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  ListChecks, Plus, ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle,
  Pencil, Trash2, X, Repeat, Settings2, Wallet, TrendingDown, TrendingUp, Check, EyeOff, Eye,
} from 'lucide-react';
import { useContasRecorrentes, MES_INICIO_SISTEMA, type ItemChecklist, type ContaRecorrente } from '../hooks/useContasRecorrentes';
import { useCategorias } from '../hooks/useCategorias';
import { corParaCategoria } from '../lib/categoriaFallback';
import { navegarMes, formatMesLabel } from '../lib/mes';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function hojeYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Card de métrica ─────────────────────────────────────────────────────────
function MetricCard({
  title, value, icon: Icon, tone,
}: { title: string; value: string; icon: React.ElementType; tone: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</span>
        <div className={`p-2 rounded-lg ${tones[tone]}`}><Icon size={15} /></div>
      </div>
      <p className="text-2xl font-black text-slate-800 privado">{value}</p>
    </div>
  );
}

// ── Formulário: nova / editar conta ─────────────────────────────────────────
function ContaFormModal({
  conta, categorias, onSalvar, onFechar,
}: {
  conta: ContaRecorrente | null;
  categorias: { nome: string }[];
  onSalvar: (dados: { nome: string; categoria: string; valor_padrao: number; dia_vencimento: number; recorrente: boolean }) => Promise<{ error: string | null }>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(conta?.nome ?? '');
  const [categoria, setCategoria] = useState(conta?.categoria ?? categorias[0]?.nome ?? 'Outros');
  const [valor, setValor] = useState(String(conta?.valor_padrao ?? ''));
  const [diaVencimento, setDiaVencimento] = useState(String(conta?.dia_vencimento ?? '10'));
  const [recorrente, setRecorrente] = useState(conta?.recorrente ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor.replace(',', '.'));
    const dia = parseInt(diaVencimento);
    if (!nome.trim()) { setErro('Informe um nome.'); return; }
    if (isNaN(v) || v < 0) { setErro('Valor inválido.'); return; }
    if (isNaN(dia) || dia < 1 || dia > 31) { setErro('Dia de vencimento deve ser entre 1 e 31.'); return; }
    setSalvando(true); setErro(null);
    const { error } = await onSalvar({ nome: nome.trim(), categoria, valor_padrao: v, dia_vencimento: dia, recorrente });
    setSalvando(false);
    if (error) { setErro(error); return; }
    onFechar();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">{conta ? 'Editar conta' : 'Nova conta'}</h3>
          <button type="button" onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nome</label>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Aluguel, Fatura Nubank, Financiamento" autoFocus
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white">
              {categorias.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dia vencimento</label>
            <input type="number" min="1" max="31" value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor padrão (R$)</label>
          <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
        </div>

        <button type="button" onClick={() => setRecorrente(v => !v)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${recorrente ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
          <div className={`p-1.5 rounded-lg ${recorrente ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Repeat size={13} /></div>
          <div>
            <div className="text-xs font-bold text-slate-700">{recorrente ? 'Conta recorrente' : 'Conta avulsa (este mês)'}</div>
            <div className="text-[10px] text-slate-400">{recorrente ? 'Aparece todo mês no checklist' : 'Você desativa manualmente depois de pagar'}</div>
          </div>
        </button>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Modal: gerenciar contas cadastradas ─────────────────────────────────────
function GerenciarContasModal({
  contas, onEditar, onAlternarAtivo, onExcluir, onFechar,
}: {
  contas: ContaRecorrente[];
  onEditar: (c: ContaRecorrente) => void;
  onAlternarAtivo: (id: string, ativo: boolean) => void;
  onExcluir: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Gerenciar contas cadastradas</h3>
          <button onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto space-y-2">
          {contas.length === 0 && <p className="text-xs text-slate-400 text-center py-8">Nenhuma conta cadastrada ainda.</p>}
          {contas.map(c => (
            <div key={c.id} className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${c.ativo ? 'border-slate-100' : 'border-slate-100 opacity-50'}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700 truncate">{c.nome}</span>
                  {c.recorrente && <Repeat size={10} className="text-blue-400 shrink-0" />}
                </div>
                <div className="text-[10px] text-slate-400">{c.categoria} · dia {c.dia_vencimento} · {fmt(c.valor_padrao)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEditar(c)} title="Editar" className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100"><Pencil size={12} /></button>
                <button onClick={() => onAlternarAtivo(c.id, !c.ativo)} title={c.ativo ? 'Desativar' : 'Reativar'}
                  className={`p-1.5 rounded-lg ${c.ativo ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                  {c.ativo ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                <button onClick={() => { if (window.confirm(`Excluir "${c.nome}"? Isso remove o cadastro e o histórico de pagamentos desta conta.`)) onExcluir(c.id); }}
                  title="Excluir" className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ContasRecorrentes() {
  const [mes, setMes] = useState(hojeYM());
  const {
    loading, contas, checklist, historico, historicoLimitado, mesAntesDoInicio,
    totalPrevisto, totalPago, totalPendente, qtdPagas, qtdAtrasadas, porCategoria,
    togglePago, editarValorMes, criarConta, editarConta, alternarAtivo, excluirConta,
  } = useContasRecorrentes(mes);
  const { categorias, corPorNome } = useCategorias();

  const [modalForm, setModalForm] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaRecorrente | null>(null);
  const [modalGerenciar, setModalGerenciar] = useState(false);
  const [editandoValor, setEditandoValor] = useState<string | null>(null);
  const [valorEdicao, setValorEdicao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function abrirNovaConta() { setContaEditando(null); setModalForm(true); }
  function abrirEdicaoConta(c: ContaRecorrente) { setContaEditando(c); setModalGerenciar(false); setModalForm(true); }

  async function salvarConta(dados: { nome: string; categoria: string; valor_padrao: number; dia_vencimento: number; recorrente: boolean }) {
    const res = contaEditando ? await editarConta(contaEditando.id, dados) : await criarConta(dados);
    if (res.error) setErro(res.error);
    return res;
  }

  async function iniciarEdicaoValor(item: ItemChecklist) {
    setEditandoValor(item.conta.id);
    setValorEdicao(item.valor.toString());
  }

  async function confirmarValor(item: ItemChecklist) {
    const novo = parseFloat(valorEdicao.replace(',', '.'));
    setEditandoValor(null);
    if (isNaN(novo) || novo < 0 || novo === item.valor) return;
    const res = await editarValorMes(item, novo);
    if (res.error) setErro(res.error);
  }

  const progressoPct = checklist.length > 0 ? (qtdPagas / checklist.length) * 100 : 0;
  const dadosCategoria = porCategoria.map(c => ({ name: c.categoria, value: c.valor }));
  const dadosHistorico = historico.map(h => ({ mes: formatMesLabel(h.mes), total: h.total }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <ListChecks size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">Contas Fixas</h2>
              <p className="text-xs text-slate-400 font-medium">Checklist de aluguel, faturas, financiamentos e afins</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1.5">
              <button onClick={() => setMes(navegarMes(mes, -1))} className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-slate-700 px-1.5 min-w-[72px] text-center">{formatMesLabel(mes)}</span>
              <button onClick={() => setMes(navegarMes(mes, 1))} className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
            <button onClick={() => setModalGerenciar(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all">
              <Settings2 size={13} /> Gerenciar
            </button>
            <button onClick={abrirNovaConta}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
              <Plus size={13} /> Nova conta
            </button>
          </div>
        </div>

        {erro && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
            {erro} <button onClick={() => setErro(null)}><X size={13} /></button>
          </div>
        )}

        {mesAntesDoInicio && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs">
            ⚠️ O checklist de Contas Fixas passou a ser usado a partir de <strong>{formatMesLabel(MES_INICIO_SISTEMA)}</strong>. Este mês é anterior a isso — nada foi registrado no sistema nesse período.
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Previsto no mês" value={fmt(totalPrevisto)} icon={Wallet} tone="slate" />
          <MetricCard title="Pago" value={fmt(totalPago)} icon={TrendingUp} tone="emerald" />
          <MetricCard title="Pendente" value={fmt(totalPendente)} icon={TrendingDown} tone="amber" />
          <MetricCard title="Atrasadas" value={String(qtdAtrasadas)} icon={AlertTriangle} tone="rose" />
        </div>

        {/* Progresso */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Progresso do mês</span>
            <span className="text-xs font-bold text-slate-700">{qtdPagas}/{checklist.length} pagas</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div className="h-2.5 rounded-full bg-blue-500 transition-all" style={{ width: `${progressoPct}%` }} />
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-72">
            <h4 className="text-sm font-bold text-slate-700 mb-2">Por categoria neste mês</h4>
            {dadosCategoria.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-300">Sem contas cadastradas</div>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={dadosCategoria} innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value">
                    {dadosCategoria.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={corParaCategoria(entry.name, corPorNome)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-72 flex flex-col">
            <h4 className="text-sm font-bold text-slate-700 mb-2 shrink-0">Evolução (últimos meses pagos)</h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosHistorico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" width={60} tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {historicoLimitado && (
              <p className="text-[10px] text-slate-400 mt-1.5 shrink-0">Histórico começa em {formatMesLabel(MES_INICIO_SISTEMA)} — o sistema ainda não existia antes disso.</p>
            )}
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-50">
            <h4 className="text-sm font-bold text-slate-700">Checklist de {formatMesLabel(mes)}</h4>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Carregando...</div>
          ) : checklist.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-sm font-medium">Nenhuma conta cadastrada ainda.</p>
              <p className="text-xs mt-1 text-slate-300">Clique em "Nova conta" para começar seu checklist mensal.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-50">
                    <th className="text-left px-5 py-3">Conta</th>
                    <th className="text-left px-4 py-3">Categoria</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-right px-4 py-3">Valor</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {checklist.map(item => (
                    <tr key={item.conta.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-700 text-xs">{item.conta.nome}</span>
                          {item.conta.recorrente && <Repeat size={10} className="text-blue-400" aria-label="Recorrente" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: corParaCategoria(item.conta.categoria, corPorNome) + '20', color: corParaCategoria(item.conta.categoria, corPorNome) }}>
                          {item.conta.categoria}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs ${item.atrasada ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                        {new Date(item.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 text-xs">
                        {editandoValor === item.conta.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input type="number" value={valorEdicao} onChange={e => setValorEdicao(e.target.value)} step="0.01" autoFocus
                              className="w-24 border border-blue-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
                              onKeyDown={e => { if (e.key === 'Enter') confirmarValor(item); if (e.key === 'Escape') setEditandoValor(null); }} />
                            <button onClick={() => confirmarValor(item)} className="p-1 text-emerald-500"><Check size={12} /></button>
                            <button onClick={() => setEditandoValor(null)} className="p-1 text-slate-400"><X size={12} /></button>
                          </div>
                        ) : (
                          <button onClick={() => iniciarEdicaoValor(item)} title="Editar valor deste mês (não altera o valor padrão da conta)"
                            className="privado inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors group">
                            {fmt(item.valor)}
                            <Pencil size={10} className="text-slate-300 group-hover:text-blue-400" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.pago ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold"><CheckCircle2 size={10} /> Pago</span>
                        ) : item.atrasada ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold"><AlertTriangle size={10} /> Atrasada</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold"><Clock size={10} /> Pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => togglePago(item)} title={item.pago ? 'Marcar como pendente' : 'Marcar como pago'}
                            className={`p-1.5 rounded-lg transition-colors ${item.pago ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                            <CheckCircle2 size={12} />
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Excluir "${item.conta.nome}"? Isso remove o cadastro e o histórico de pagamentos desta conta.`)) return;
                              const r = await excluirConta(item.conta.id);
                              if (r.error) setErro(r.error);
                            }}
                            title="Excluir conta"
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors">
                            <Trash2 size={12} />
                          </button>
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

      {modalForm && (
        <ContaFormModal
          conta={contaEditando}
          categorias={categorias.length > 0 ? categorias : [{ nome: 'Outros' }]}
          onSalvar={salvarConta}
          onFechar={() => setModalForm(false)}
        />
      )}

      {modalGerenciar && (
        <GerenciarContasModal
          contas={contas}
          onEditar={abrirEdicaoConta}
          onAlternarAtivo={(id, ativo) => alternarAtivo(id, ativo)}
          onExcluir={(id) => excluirConta(id)}
          onFechar={() => setModalGerenciar(false)}
        />
      )}
    </div>
  );
}
