import React, { useState, useEffect } from 'react';
import { X, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useCategorias, type Categoria } from '../hooks/useCategorias';

const CORES_SUGERIDAS = ['#7C3AED', '#0284C7', '#059669', '#D97706', '#E11D48', '#4338CA', '#0D9488', '#DB2777', '#EA580C', '#0891B2', '#64748B'];

export default function CategoriaManager({ onFechar, onChange }: { onFechar: () => void; onChange?: () => void }) {
  const { categorias, criar, renomear, excluir } = useCategorias();
  const [uso, setUso] = useState<Record<string, number>>({});
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(CORES_SUGERIDAS[0]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<Categoria | null>(null);
  const [reatribuirPara, setReatribuirPara] = useState('Outros');
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => { carregarUso(); }, []);

  async function carregarUso() {
    const [rSaidas, rTelegram] = await Promise.all([
      supabase.from('pessoal_saidas').select('categoria'),
      supabase.from('telegram_gastos').select('categoria'),
    ]);
    const contagem: Record<string, number> = {};
    for (const row of [...(rSaidas.data || []), ...(rTelegram.data || [])]) {
      contagem[row.categoria] = (contagem[row.categoria] || 0) + 1;
    }
    setUso(contagem);
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setProcessando(true);
    const { error } = await criar(novoNome, novaCor);
    setProcessando(false);
    if (error) { setErro(error); return; }
    setNovoNome('');
    carregarUso();
  }

  function iniciarEdicao(cat: Categoria) {
    setEditandoId(cat.id);
    setNomeEdicao(cat.nome);
    setErro(null);
  }

  async function confirmarEdicao(cat: Categoria) {
    setErro(null);
    setProcessando(true);
    const { error } = await renomear(cat.id, nomeEdicao);
    setProcessando(false);
    if (error) { setErro(error); return; }
    setEditandoId(null);
    carregarUso();
  }

  async function handleExcluirDireto(cat: Categoria) {
    if ((uso[cat.nome] || 0) > 0) { setConfirmandoExclusao(cat); return; }
    if (!window.confirm(`Excluir a categoria "${cat.nome}"?`)) return;
    setErro(null);
    setProcessando(true);
    const { error } = await excluir(cat.id, cat.nome);
    setProcessando(false);
    if (error) { setErro(error); return; }
    onChange?.();
  }

  async function handleExcluirComReatribuicao() {
    if (!confirmandoExclusao) return;
    setErro(null);
    setProcessando(true);
    const { error } = await excluir(confirmandoExclusao.id, confirmandoExclusao.nome, { reatribuirPara });
    setProcessando(false);
    if (error) { setErro(error); return; }
    setConfirmandoExclusao(null);
    carregarUso();
    onChange?.();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5 max-h-[85vh] overflow-y-auto">
        <button onClick={onFechar} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} />
        </button>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Gerenciar categorias</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Crie, renomeie ou exclua categorias de gasto</p>
        </div>

        {erro && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">{erro}</div>}

        {confirmandoExclusao ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-amber-800">
              {uso[confirmandoExclusao.nome] || 0} lançamento(s) usam "{confirmandoExclusao.nome}". Reatribuir pra qual categoria antes de excluir?
            </p>
            <select
              value={reatribuirPara}
              onChange={e => setReatribuirPara(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              {categorias.filter(c => c.id !== confirmandoExclusao.id).map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmandoExclusao(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500">Cancelar</button>
              <button
                onClick={handleExcluirComReatribuicao}
                disabled={processando}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Reatribuir e excluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCriar} className="flex items-center gap-2">
            <input
              type="color"
              value={novaCor}
              onChange={e => setNovaCor(e.target.value)}
              className="w-9 h-9 rounded-lg border border-slate-200 shrink-0 cursor-pointer"
            />
            <input
              type="text"
              placeholder="Nova categoria..."
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              disabled={processando || !novoNome.trim()}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl disabled:opacity-50 shrink-0"
            >
              <Plus size={15} />
            </button>
          </form>
        )}

        <div className="space-y-1">
          {categorias.map(cat => (
            <div key={cat.id} className="flex items-center gap-2.5 py-2 border-b border-slate-50 last:border-0">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.cor }} />
              {editandoId === cat.id ? (
                <input
                  autoFocus
                  type="text"
                  value={nomeEdicao}
                  onChange={e => setNomeEdicao(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmarEdicao(cat)}
                  className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                />
              ) : (
                <span className="flex-1 text-xs font-semibold text-slate-700 truncate">{cat.nome}</span>
              )}
              <span className="text-[10px] text-slate-300 font-bold shrink-0">{uso[cat.nome] || 0}x</span>
              {editandoId === cat.id ? (
                <button onClick={() => confirmarEdicao(cat)} disabled={processando} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg shrink-0">
                  <Check size={13} />
                </button>
              ) : (
                <button onClick={() => iniciarEdicao(cat)} className="p-1.5 text-slate-300 hover:text-sky-500 hover:bg-sky-50 rounded-lg shrink-0">
                  <Pencil size={13} />
                </button>
              )}
              <button onClick={() => handleExcluirDireto(cat)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
