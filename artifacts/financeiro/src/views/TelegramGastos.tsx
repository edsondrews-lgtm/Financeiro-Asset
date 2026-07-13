import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, Calendar, ChevronLeft, ChevronRight, Trash2, ShoppingBag, Pencil, X, Tag } from 'lucide-react';
import CategoriaManager from '../components/CategoriaManager';
import { useCategorias, type Categoria } from '../hooks/useCategorias';
import { corParaCategoria } from '../lib/categoriaFallback';
import { navegarMes, formatMesLabel } from '../lib/mes';
import { fmt } from '../lib/constants';

interface ItemGasto {
  nome: string;
  categoria: string;
}

interface GastoTelegram {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_gasto: string;
  estabelecimento: string | null;
  itens: ItemGasto[] | null;
  created_at: string;
}

function ModalEditarGasto({ gasto, categorias, onFechar, onSalvo, onGerenciarCategorias }: {
  gasto: GastoTelegram;
  categorias: Categoria[];
  onFechar: () => void;
  onSalvo: () => void;
  onGerenciarCategorias: () => void;
}) {
  const [form, setForm] = useState({
    descricao: gasto.descricao,
    categoria: gasto.categoria,
    valor: String(gasto.valor),
    data_gasto: gasto.data_gasto,
    estabelecimento: gasto.estabelecimento ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const valorNum = parseFloat(form.valor.replace(',', '.'));
    if (!form.descricao.trim()) { setErro('Informe uma descrição.'); return; }
    if (!valorNum || valorNum <= 0) { setErro('Informe um valor válido.'); return; }

    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from('telegram_gastos').update({
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      valor: valorNum,
      data_gasto: form.data_gasto,
      estabelecimento: form.estabelecimento.trim() || null,
    }).eq('id', gasto.id);
    setSalvando(false);

    if (error) { setErro('Erro: ' + error.message); return; }
    onSalvo();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-100 text-sky-600 rounded-lg">
              <Pencil size={16} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Editar lançamento</h3>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {erro && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">{erro}</div>}

        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
            <input type="text" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
              required autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
                <button type="button" onClick={onGerenciarCategorias} className="text-slate-300 hover:text-sky-500" title="Gerenciar categorias">
                  <Tag size={13} />
                </button>
              </div>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400">
                {!categorias.some(c => c.nome === form.categoria) && form.categoria && (
                  <option value={form.categoria}>{form.categoria} (removida)</option>
                )}
                {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
              <input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data</label>
              <input type="date" value={form.data_gasto} onChange={e => setForm({ ...form, data_gasto: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Estabelecimento</label>
              <input type="text" value={form.estabelecimento} onChange={e => setForm({ ...form, estabelecimento: e.target.value })}
                placeholder="Opcional"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400" />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TelegramGastos() {
  const { categorias, corPorNome, recarregar: recarregarCategorias } = useCategorias();
  const [gastos, setGastos] = useState<GastoTelegram[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<GastoTelegram | null>(null);
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => { buscar(); }, []);

  async function buscar() {
    setCarregando(true);
    const { data } = await supabase
      .from('telegram_gastos')
      .select('*')
      .eq('reconciliado', false)
      .order('data_gasto', { ascending: false })
      .order('created_at', { ascending: false });
    setGastos(data || []);
    setCarregando(false);
  }

  async function excluir(id: string) {
    await supabase.from('telegram_gastos').delete().eq('id', id);
    setGastos(g => g.filter(x => x.id !== id));
  }

  const doMes = gastos.filter(g => g.data_gasto?.startsWith(mesFiltro));
  const total = doMes.reduce((s, g) => s + Number(g.valor), 0);

  const porCategoria = Object.entries(
    doMes.reduce((acc: Record<string, number>, g) => ({
      ...acc, [g.categoria]: (acc[g.categoria] || 0) + Number(g.valor),
    }), {})
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = porCategoria[0]?.[1] ?? 1;

  return (
    <div className="p-10 space-y-8 max-w-5xl mx-auto text-slate-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500 rounded-xl text-white shadow-md shadow-sky-100">
            <Send size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Gastos via Telegram</h1>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">
              Lançamentos confirmados pelo bot — separado das saídas de cartão, pra não duplicar
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <Calendar size={13} className="text-slate-400" />
          <button onClick={() => setMesFiltro(m => navegarMes(m, -1))} className="text-slate-400 hover:text-slate-700">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-slate-700 w-20 text-center">{formatMesLabel(mesFiltro)}</span>
          <button onClick={() => setMesFiltro(m => navegarMes(m, 1))} className="text-slate-400 hover:text-slate-700">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total do mês</p>
          <p className="text-2xl font-black text-slate-800 tabular-nums privado">{fmt(total)}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-semibold">{doMes.length} lançamento{doMes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Por categoria</p>
          {porCategoria.length === 0 ? (
            <p className="text-xs text-slate-300 font-semibold py-2">Nenhum gasto neste mês</p>
          ) : (
            <div className="space-y-2">
              {porCategoria.map(([cat, val]) => {
                const cor = corParaCategoria(cat, corPorNome);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: cor + '1a' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                    </span>
                    <span className="text-xs font-semibold text-slate-700 w-28 truncate">{cat}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${(val / maxCat) * 100}%`, background: cor }} />
                    </div>
                    <span className="text-xs font-black text-slate-800 tabular-nums w-24 text-right privado">{fmt(val)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {carregando ? (
          <p className="text-xs text-slate-300 font-semibold py-6 text-center">Carregando...</p>
        ) : doMes.length === 0 ? (
          <div className="text-center py-12 text-slate-300">
            <ShoppingBag size={28} className="mx-auto mb-2" />
            <p className="text-xs font-semibold">Nenhum lançamento neste mês ainda</p>
          </div>
        ) : (
          doMes.map(g => {
            const cor = corParaCategoria(g.categoria, corPorNome);
            return (
              <div key={g.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-start gap-3 group">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cor + '1a' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: cor }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{g.descricao}</p>
                    <span className="text-sm font-black text-slate-800 tabular-nums shrink-0 privado">{fmt(Number(g.valor))}</span>
                  </div>
                  <p className="text-[11px] font-semibold mt-0.5" style={{ color: cor }}>
                    {g.categoria} · {new Date(g.data_gasto + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {g.estabelecimento && <> · 📍 {g.estabelecimento}</>}
                  </p>
                  {g.itens && g.itens.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {g.itens.map((item, i) => {
                        const corItem = corParaCategoria(item.categoria, corPorNome);
                        return (
                          <span key={i}
                            className="text-[10px] font-semibold border border-slate-100 rounded-full px-2 py-0.5 flex items-center gap-1"
                            style={{ color: corItem, background: corItem + '1a' }}
                            title={item.categoria}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: corItem }} />
                            {item.nome}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => setEditando(g)}
                    className="text-slate-300 hover:text-sky-500"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => excluir(g.id)}
                    className="text-slate-300 hover:text-rose-500"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editando && (
        <ModalEditarGasto
          gasto={editando}
          categorias={categorias}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); buscar(); }}
          onGerenciarCategorias={() => setModalCategoriasAberto(true)}
        />
      )}

      {modalCategoriasAberto && (
        <CategoriaManager
          onFechar={() => setModalCategoriasAberto(false)}
          onChange={recarregarCategorias}
        />
      )}
    </div>
  );
}
