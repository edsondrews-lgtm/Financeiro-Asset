import { useState } from 'react';
import { Landmark, ChevronLeft, ChevronRight, Tag, Wallet, X, CreditCard, Send } from 'lucide-react';
import { useGastosGerais, type Bucket, type LancamentoDiaADia } from '../hooks/useGastosGerais';
import { useCategorias } from '../hooks/useCategorias';
import { corParaCategoria } from '../lib/categoriaFallback';
import { navegarMes, formatMesLabel } from '../lib/mes';
import { fmt } from '../lib/constants';
import GraficoGastos from './GraficoGastos';
import CategoriaManager from '../components/CategoriaManager';

function BucketRankItem({ pos, bucket, max, onClick }: { pos: number; bucket: Bucket; max: number; onClick?: () => void }) {
  const pct = max > 0 ? (bucket.valor / max) * 100 : 0;
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 ${onClick ? 'cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors' : ''}`}
    >
      <span className="text-[10px] text-slate-300 font-bold w-4 text-right shrink-0">{pos}</span>
      <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: bucket.cor + '1a' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: bucket.cor }} />
      </span>
      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{bucket.nome}</span>
      <div className="w-16 h-1 rounded-full bg-slate-100 shrink-0">
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: bucket.cor }} />
      </div>
      <span className="text-xs font-bold text-slate-800 w-24 text-right shrink-0 privado">{fmt(bucket.valor)}</span>
      {onClick && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
    </div>
  );
}

function CategoriaRankItem({ pos, categoria, valor, max, cor }: { pos: number; categoria: string; valor: number; max: number; cor: string }) {
  const pct = max > 0 ? (valor / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[10px] text-slate-300 font-bold w-4 text-right shrink-0">{pos}</span>
      <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: cor + '1a' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
      </span>
      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{categoria}</span>
      <div className="w-16 h-1 rounded-full bg-slate-100 shrink-0">
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: cor }} />
      </div>
      <span className="text-xs font-bold text-slate-800 w-24 text-right shrink-0 privado">{fmt(valor)}</span>
    </div>
  );
}

const ORIGEM_ICON: Record<LancamentoDiaADia['origem'], React.ElementType> = {
  'Cartão': CreditCard,
  'PIX/Dinheiro': Wallet,
  'Telegram': Send,
};

function LancamentosDiaADiaModal({
  lancamentos, corPorNome, mesLabel, onFechar,
}: { lancamentos: LancamentoDiaADia[]; corPorNome: Record<string, string>; mesLabel: string; onFechar: () => void }) {
  const total = lancamentos.reduce((s, l) => s + l.valor, 0);
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4 max-h-[85vh] flex flex-col">
        <button onClick={onFechar} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} />
        </button>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Dia a dia — lançamentos</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {lancamentos.length} lançamento{lancamentos.length !== 1 ? 's' : ''} · {mesLabel} · <span className="privado">{fmt(total)}</span>
          </p>
        </div>
        <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
          {lancamentos.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">Nenhum lançamento no período</p>
          ) : lancamentos.map(l => {
            const cor = corParaCategoria(l.categoria, corPorNome);
            const Icone = ORIGEM_ICON[l.origem];
            return (
              <div key={`${l.origem}-${l.id}`} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className="text-[11px] text-slate-400 font-medium w-16 shrink-0">
                  {new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-slate-800 truncate">{l.descricao}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold mt-0.5" style={{ color: cor }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                    {l.categoria}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 shrink-0" title={l.origem}>
                  <Icone size={12} />
                </span>
                <span className="text-xs font-bold text-slate-800 w-20 text-right shrink-0 privado">{fmt(l.valor)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ParaOndeVaiPainel() {
  const [mesFiltro, setMesFiltro] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);
  const [modalLancamentosAberto, setModalLancamentosAberto] = useState(false);

  const { loading, diaADiaPorCategoria, diaADiaLancamentos, buckets, maxBucket, granTotal } = useGastosGerais(mesFiltro);
  const { corPorNome, recarregar: recarregarCategorias } = useCategorias();

  const rankingCategorias = [...diaADiaPorCategoria].sort((a, b) => b.valor - a.valor);
  const maxCategoria = rankingCategorias[0]?.valor ?? 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm">
              <Landmark size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">Pra onde vai meu dinheiro</h2>
              <p className="text-xs text-slate-400 font-medium">Dia a dia + compromissos fixos, tudo num lugar só</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1.5">
              <button onClick={() => setMesFiltro(navegarMes(mesFiltro, -1))} className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-slate-700 px-1.5 min-w-[72px] text-center">{formatMesLabel(mesFiltro)}</span>
              <button onClick={() => setMesFiltro(navegarMes(mesFiltro, 1))} className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
            <button
              onClick={() => setModalCategoriasAberto(true)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-400 text-slate-500 hover:text-slate-700 text-xs font-bold px-4 py-2 rounded-full transition-colors"
            >
              <Tag size={13} /> Gerenciar categorias
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Sincronizando...
          </div>
        )}

        {/* ── Total geral ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 hover:border-slate-200 transition-colors max-w-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#0F172A' }} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total do mês</span>
            </div>
            <Wallet size={14} className="text-slate-300" />
          </div>
          <p className="text-2xl font-black text-slate-800 tracking-tight leading-none privado">{fmt(granTotal)}</p>
        </div>

        {/* ── Buckets ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-700 mb-1">Onde o dinheiro foi parar</p>
          <p className="text-[10px] text-slate-400 font-medium mb-4">{buckets.length} frentes · {formatMesLabel(mesFiltro)}</p>
          <div>
            {buckets.every(b => b.valor === 0) ? (
              <p className="text-xs text-slate-400 text-center py-8">Nenhuma saída no período</p>
            ) : buckets.map((b, i) => (
              <BucketRankItem
                key={b.id} pos={i + 1} bucket={b} max={maxBucket}
                onClick={b.id === 'dia-a-dia' ? () => setModalLancamentosAberto(true) : undefined}
              />
            ))}
          </div>
        </div>

        {/* ── Drill-down: dia a dia por categoria ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-xs font-bold text-slate-700 mb-1">Dia a dia — por categoria</p>
            <p className="text-[10px] text-slate-400 font-medium mb-4">Cartão, PIX e Telegram (inclusive gasto em dinheiro ainda não reconciliado)</p>
            <GraficoGastos gastos={diaADiaPorCategoria} corPorNome={corPorNome} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-xs font-bold text-slate-700 mb-1">Ranking de categorias</p>
            <p className="text-[10px] text-slate-400 font-medium mb-4">{rankingCategorias.length} categorias · {formatMesLabel(mesFiltro)}</p>
            <div>
              {rankingCategorias.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Nenhum gasto no período</p>
              ) : rankingCategorias.map((c, i) => (
                <CategoriaRankItem
                  key={c.categoria} pos={i + 1} categoria={c.categoria} valor={c.valor}
                  max={maxCategoria} cor={corParaCategoria(c.categoria, corPorNome)}
                />
              ))}
            </div>
          </div>
        </div>

        {modalCategoriasAberto && (
          <CategoriaManager
            onFechar={() => setModalCategoriasAberto(false)}
            onChange={recarregarCategorias}
          />
        )}

        {modalLancamentosAberto && (
          <LancamentosDiaADiaModal
            lancamentos={diaADiaLancamentos}
            corPorNome={corPorNome}
            mesLabel={formatMesLabel(mesFiltro)}
            onFechar={() => setModalLancamentosAberto(false)}
          />
        )}

      </div>
    </div>
  );
}
