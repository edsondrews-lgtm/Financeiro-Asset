import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Upload, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface Cartao {
  id: string;
  nome_cartao: string;
}

interface LinhaPrevia {
  id_temporario: number;
  data_gasto: string;
  descricao: string;
  categoria: string;
  valor: number;
  periodicidade: string;
  foiAlteradoManualmente: boolean;
}

const categoriasDisponiveis = ['Moradia', 'Assinatura', 'Investimento', 'Alimentação', 'Lazer', 'Transporte', 'Vestuário', 'Saúde', 'Supérfluos', 'Mercado', 'Combustível', 'Farmácia', 'Pets', 'Outros'];

export default function ImportadorNubank({ cartoes, onImportSucess }: { cartoes: Cartao[]; onImportSucess: () => void }) {
  const [linhasPrevia, setLinhasPrevia] = useState<LinhaPrevia[]>([]);
  const [cartaoSelecionado, setCartaoSelecionado] = useState('');
  const [regrasBanco, setRegrasBanco] = useState<Record<string, string>>({});
  const [loadingRegras, setLoadingRegras] = useState(false);

  useEffect(() => { carregarRegrasDinamicas(); }, []);

  async function carregarRegrasDinamicas() {
    setLoadingRegras(true);
    try {
      const { data } = await supabase.from('pessoal_regras').select('termo_busca, categoria_destino');
      if (data) {
        const mapaRegras: Record<string, string> = {};
        data.forEach((r: { termo_busca: string; categoria_destino: string }) => {
          mapaRegras[r.termo_busca.toLowerCase()] = r.categoria_destino;
        });
        setRegrasBanco(mapaRegras);
      }
    } catch (error) { console.error('Erro ao carregar regras:', error); } finally { setLoadingRegras(false); }
  }

  function descobrirCategoriaInteligente(titulo: string, valor: number): string {
    const texto = titulo.toLowerCase();
    const ehPostoOuTigrinhos = texto.includes('posto') || texto.includes('tigrinhos');
    if (ehPostoOuTigrinhos && valor < 50) return 'Supérfluos';
    for (const [termo, categoria] of Object.entries(regrasBanco)) {
      if (texto.includes(termo)) return categoria;
    }
    const fallback: Record<string, string[]> = {
      'Alimentação': ['lanches', 'burger', 'gourmet', 'cantina', 'unoesc', 'crepemania', 'piratas', 'sorvete', 'restaurante'],
      'Moradia': ['auriverde', 'supermercado', 'vipi', 'limpeza', 'feira'],
      'Assinatura': ['youtube', 'premium', 'apple.com', 'spotify', 'netflix', 'google', 'paypal'],
      'Transporte': ['posto', 'maximo', 'combustivel', 'uber', '99taxis'],
      'Lazer': ['cinema', 'show', 'viagem', 'hotel'],
      'Saúde': ['farmacia', 'bem popular', 'drogaria'],
    };
    for (const [categoria, palavras] of Object.entries(fallback)) {
      if (palavras.some(p => texto.includes(p))) return categoria;
    }
    return 'Outros';
  }

  function handleProcessarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      const texto = evt.target?.result as string;
      const linhas = texto.split('\n');
      const itens: LinhaPrevia[] = [];
      for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (!linha) continue;
        const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (colunas.length >= 3) {
          const dataGasto = colunas[0].trim();
          const titulo = colunas[1].replace(/"/g, '').trim();
          const valor = parseFloat(colunas[2].trim());
          if (dataGasto && titulo && !isNaN(valor)) {
            itens.push({ id_temporario: i, data_gasto: dataGasto, descricao: titulo, categoria: descobrirCategoriaInteligente(titulo, valor), valor, periodicidade: 'Único', foiAlteradoManualmente: false });
          }
        }
      }
      setLinhasPrevia(itens);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleMudarCategoriaPrevia(idTemp: number, novaCategoria: string) {
    setLinhasPrevia(prev => prev.map(item => item.id_temporario === idTemp ? { ...item, categoria: novaCategoria, foiAlteradoManualmente: true } : item));
  }

  async function handleSalvarImportacao() {
    if (!cartaoSelecionado) { alert('Por favor, selecione o cartão!'); return; }
    const dadosParaSalvar = linhasPrevia.map(item => ({ data_gasto: item.data_gasto, descricao: item.descricao, categoria: item.categoria, valor: item.valor, periodicidade: item.periodicidade, cartao_id: cartaoSelecionado }));
    const novasRegras: { termo_busca: string; categoria_destino: string }[] = [];
    linhasPrevia.forEach(item => {
      if (item.foiAlteradoManualmente) {
        const palavraChave = item.descricao.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (palavraChave.length > 3) novasRegras.push({ termo_busca: palavraChave, categoria_destino: item.categoria });
      }
    });
    try {
      const { error } = await supabase.from('pessoal_saidas').insert(dadosParaSalvar);
      if (error) throw error;
      if (novasRegras.length > 0) await supabase.from('pessoal_regras').upsert(novasRegras, { onConflict: 'termo_busca' });
      alert(`${dadosParaSalvar.length} lançamentos importados! O sistema aprendeu ${novasRegras.length} novas regras.`);
      setLinhasPrevia([]);
      carregarRegrasDinamicas();
      if (onImportSucess) onImportSucess();
    } catch (error) { console.error(error); alert('Erro ao sincronizar dados com o Supabase.'); }
  }

  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 space-y-6 text-xs font-semibold">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-800">Importador Auto-Treinável de Faturas</h4>
            {loadingRegras && <RefreshCw size={12} className="animate-spin text-rose-500" />}
          </div>
          <p className="text-slate-400 font-medium">O sistema aprende automaticamente as categorias preferidas a cada correção.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800" value={cartaoSelecionado} onChange={e => setCartaoSelecionado(e.target.value)}>
            <option value="">Vincular ao Cartão...</option>
            {cartoes.map(c => <option key={c.id} value={c.id}>💳 {c.nome_cartao}</option>)}
          </select>
          <label className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-2">
            <Upload size={14} /> Importar Fatura CSV
            <input type="file" accept=".csv" onChange={handleProcessarCSV} className="hidden" />
          </label>
        </div>
      </div>

      {linhasPrevia.length > 0 && (
        <div className="space-y-4 border-t border-slate-200/60 pt-4">
          <div className="flex justify-between items-center bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200/50">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>Qualquer categoria que alterares abaixo servirá de lição para a próxima fatura!</span>
            </div>
            <span className="font-bold">{linhasPrevia.length} Transações</span>
          </div>
          <div className="overflow-x-auto max-h-96 border border-slate-100 rounded-xl bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="p-3">Data</th><th className="p-3">Estabelecimento</th><th className="p-3">Categoria</th><th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600 font-medium">
                {linhasPrevia.map(item => (
                  <tr key={item.id_temporario} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-400">{item.data_gasto}</td>
                    <td className="p-3 text-slate-800 font-semibold">
                      {item.descricao} {item.foiAlteradoManualmente && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-2">Corrigido</span>}
                    </td>
                    <td className="p-3">
                      <select value={item.categoria} onChange={e => handleMudarCategoriaPrevia(item.id_temporario, e.target.value)} className={`p-1.5 border-0 rounded-lg font-bold ${item.foiAlteradoManualmente ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300' : 'bg-slate-50 text-slate-700'}`}>
                        {categoriasDisponiveis.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">R$ {item.valor.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleSalvarImportacao} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold p-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm">
            <Check size={16} /> Processar Fatura e Gravar Aprendizados
          </button>
        </div>
      )}
    </div>
  );
}
