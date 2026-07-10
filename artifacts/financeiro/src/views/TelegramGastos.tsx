import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Send, Calendar, ChevronLeft, ChevronRight, Trash2, ShoppingBag } from 'lucide-react';

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

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function TelegramGastos() {
  const [gastos, setGastos] = useState<GastoTelegram[]>([]);
  const [carregando, setCarregando] = useState(true);
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
                const cfg = CATEGORIA_CONFIG[cat] ?? CATEGORIA_CONFIG['Outros'];
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                    </span>
                    <span className="text-xs font-semibold text-slate-700 w-28 truncate">{cat}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full" style={{ width: `${(val / maxCat) * 100}%`, background: cfg.dot }} />
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
            const cfg = CATEGORIA_CONFIG[g.categoria] ?? CATEGORIA_CONFIG['Outros'];
            return (
              <div key={g.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-start gap-3 group">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{g.descricao}</p>
                    <span className="text-sm font-black text-slate-800 tabular-nums shrink-0 privado">{fmt(Number(g.valor))}</span>
                  </div>
                  <p className={`text-[11px] font-semibold mt-0.5 ${cfg.color}`}>
                    {g.categoria} · {new Date(g.data_gasto + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {g.estabelecimento && <> · 📍 {g.estabelecimento}</>}
                  </p>
                  {g.itens && g.itens.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {g.itens.map((item, i) => {
                        const itemCfg = CATEGORIA_CONFIG[item.categoria] ?? CATEGORIA_CONFIG['Outros'];
                        return (
                          <span key={i}
                            className={`text-[10px] font-semibold ${itemCfg.color} ${itemCfg.bg} border border-slate-100 rounded-full px-2 py-0.5 flex items-center gap-1`}
                            title={item.categoria}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: itemCfg.dot }} />
                            {item.nome}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => excluir(g.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500 shrink-0"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
