import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Upload, Check, AlertCircle, RefreshCw, Send } from 'lucide-react';

interface Cartao {
  id: string;
  nome_cartao: string;
}

interface TelegramGastoPendente {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_gasto: string;
  estabelecimento: string | null;
}

interface LinhaPrevia {
  id_temporario: number;
  data_gasto: string;
  descricao: string;
  categoria: string;
  valor: number;
  periodicidade: string;
  foiAlteradoManualmente: boolean;
  matchTelegram: TelegramGastoPendente | null;
  usarMatchTelegram: boolean;
}

const JANELA_DIAS_MATCH = 3;

function diasEntre(d1: string, d2: string): number {
  const t1 = new Date(d1 + 'T12:00:00').getTime();
  const t2 = new Date(d2 + 'T12:00:00').getTime();
  return Math.abs(t1 - t2) / 86400000;
}

function encontrarMatchTelegram(
  dataGasto: string, valor: number, candidatos: TelegramGastoPendente[], jaUsados: Set<string>,
): TelegramGastoPendente | null {
  const valorAbs = Math.abs(valor);
  const validos = candidatos.filter(c =>
    !jaUsados.has(c.id) &&
    Math.abs(Number(c.valor) - valorAbs) < 0.01 &&
    diasEntre(dataGasto, c.data_gasto) <= JANELA_DIAS_MATCH,
  );
  if (validos.length === 0) return null;
  return validos.sort((a, b) => diasEntre(dataGasto, a.data_gasto) - diasEntre(dataGasto, b.data_gasto))[0];
}

const categoriasDisponiveis = ['Moradia', 'Assinatura', 'Investimento', 'Alimentação', 'Lazer', 'Transporte', 'Vestuário', 'Saúde', 'Supérfluos', 'Mercado', 'Combustível', 'Farmácia', 'Pets', 'Outros'];

export default function ImportadorNubank({ cartoes, onImportSucess }: { cartoes: Cartao[]; onImportSucess: () => void }) {
  const [linhasPrevia, setLinhasPrevia] = useState<LinhaPrevia[]>([]);
  const [cartaoSelecionado, setCartaoSelecionado] = useState('');
  const [regrasBanco, setRegrasBanco] = useState<Record<string, string>>({});
  const [loadingRegras, setLoadingRegras] = useState(false);
  const [telegramPendentes, setTelegramPendentes] = useState<TelegramGastoPendente[]>([]);

  useEffect(() => { carregarRegrasDinamicas(); carregarTelegramPendentes(); }, []);

  async function carregarTelegramPendentes() {
    const { data } = await supabase
      .from('telegram_gastos')
      .select('id, descricao, categoria, valor, data_gasto, estabelecimento')
      .eq('reconciliado', false);
    setTelegramPendentes(data || []);
  }

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
          // suporta formato brasileiro: "19,90" ou "- 400,00"
          const valorRaw = colunas[2].replace(/"/g, '').replace(/\s/g, '').trim();
          const valorStr = valorRaw.replace(',', '.');
          const valor = parseFloat(valorStr);
          if (dataGasto && titulo && !isNaN(valor)) {
            itens.push({
              id_temporario: i, data_gasto: dataGasto, descricao: titulo,
              categoria: descobrirCategoriaInteligente(titulo, valor), valor,
              periodicidade: 'Único', foiAlteradoManualmente: false,
              matchTelegram: null, usarMatchTelegram: true,
            });
          }
        }
      }

      const jaUsados = new Set<string>();
      for (const item of itens) {
        const match = encontrarMatchTelegram(item.data_gasto, item.valor, telegramPendentes, jaUsados);
        if (match) {
          item.matchTelegram = match;
          item.categoria = match.categoria; // categoria do Telegram é mais confiável que a heurística de palavra-chave
          jaUsados.add(match.id);
        }
      }

      setLinhasPrevia(itens);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleMudarCategoriaPrevia(idTemp: number, novaCategoria: string) {
    setLinhasPrevia(prev => prev.map(item => item.id_temporario === idTemp ? { ...item, categoria: novaCategoria, foiAlteradoManualmente: true } : item));
  }

  function handleToggleMatchTelegram(idTemp: number) {
    setLinhasPrevia(prev => prev.map(item => {
      if (item.id_temporario !== idTemp || !item.matchTelegram) return item;
      const ligar = !item.usarMatchTelegram;
      return {
        ...item,
        usarMatchTelegram: ligar,
        categoria: ligar ? item.matchTelegram.categoria : descobrirCategoriaInteligente(item.descricao, item.valor),
      };
    }));
  }

  async function handleSalvarImportacao() {
    if (!cartaoSelecionado) { alert('Por favor, selecione o cartão!'); return; }
    const dadosParaSalvar = linhasPrevia.map(item => {
      const usaTelegram = item.matchTelegram && item.usarMatchTelegram;
      return {
        data_gasto: item.data_gasto,
        descricao: usaTelegram ? item.matchTelegram!.descricao : item.descricao,
        categoria: usaTelegram ? item.matchTelegram!.categoria : item.categoria,
        valor: item.valor,
        periodicidade: item.periodicidade,
        cartao_id: cartaoSelecionado,
      };
    });
    const novasRegras: { termo_busca: string; categoria_destino: string }[] = [];
    linhasPrevia.forEach(item => {
      if (item.foiAlteradoManualmente) {
        const palavraChave = item.descricao.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (palavraChave.length > 3) novasRegras.push({ termo_busca: palavraChave, categoria_destino: item.categoria });
      }
    });
    try {
      const { data: inseridos, error } = await supabase.from('pessoal_saidas').insert(dadosParaSalvar).select('id');
      if (error) throw error;

      const reconciliacoes = linhasPrevia
        .map((item, i) => ({ item, novoId: inseridos?.[i]?.id }))
        .filter(({ item }) => item.matchTelegram && item.usarMatchTelegram);
      for (const { item, novoId } of reconciliacoes) {
        await supabase.from('telegram_gastos').update({ reconciliado: true, pessoal_saida_id: novoId }).eq('id', item.matchTelegram!.id);
      }

      if (novasRegras.length > 0) await supabase.from('pessoal_regras').upsert(novasRegras, { onConflict: 'termo_busca' });
      const qtdCruzadas = reconciliacoes.length;
      alert(`${dadosParaSalvar.length} lançamentos importados!${qtdCruzadas > 0 ? ` ${qtdCruzadas} cruzados com o Telegram.` : ''} O sistema aprendeu ${novasRegras.length} novas regras.`);
      setLinhasPrevia([]);
      carregarRegrasDinamicas();
      carregarTelegramPendentes();
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
            <span className="font-bold">
              {linhasPrevia.length} Transações
              {linhasPrevia.some(i => i.matchTelegram) && (
                <span className="ml-2 text-sky-700">· {linhasPrevia.filter(i => i.matchTelegram).length} cruzadas com Telegram</span>
              )}
            </span>
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
                    <td className="p-3 text-slate-400 align-top">{item.data_gasto}</td>
                    <td className="p-3 text-slate-800 font-semibold align-top">
                      <div>
                        {item.descricao} {item.foiAlteradoManualmente && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-2">Corrigido</span>}
                      </div>
                      {item.matchTelegram && (
                        <label className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-1 cursor-pointer max-w-full">
                          <input
                            type="checkbox"
                            checked={item.usarMatchTelegram}
                            onChange={() => handleToggleMatchTelegram(item.id_temporario)}
                            className="w-3 h-3 shrink-0"
                          />
                          <Send size={10} className="shrink-0" />
                          <span className="truncate">
                            {item.matchTelegram.descricao}
                            {item.matchTelegram.estabelecimento ? ` · ${item.matchTelegram.estabelecimento}` : ''}
                          </span>
                        </label>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <select value={item.categoria} onChange={e => handleMudarCategoriaPrevia(item.id_temporario, e.target.value)} className={`p-1.5 border-0 rounded-lg font-bold ${item.matchTelegram && item.usarMatchTelegram ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-300' : item.foiAlteradoManualmente ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300' : 'bg-slate-50 text-slate-700'}`}>
                        {categoriasDisponiveis.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900 align-top">R$ {item.valor.toFixed(2)}</td>
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
