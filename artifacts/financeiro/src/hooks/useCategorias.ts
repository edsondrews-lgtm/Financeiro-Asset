import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface Categoria {
  id: string;
  nome: string;
  cor: string;
}

interface Resultado {
  error: string | null;
}

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('categorias').select('*').order('nome');
    setCategorias(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const corPorNome = useMemo(
    () => Object.fromEntries(categorias.map(c => [c.nome, c.cor])),
    [categorias],
  );

  async function criar(nome: string, cor: string): Promise<Resultado> {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return { error: 'Informe um nome.' };
    const { error } = await supabase.from('categorias').insert({ nome: nomeLimpo, cor });
    if (error) return { error: error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message };
    await recarregar();
    return { error: null };
  }

  async function renomear(id: string, novoNome: string, novaCor?: string): Promise<Resultado> {
    const atual = categorias.find(c => c.id === id);
    if (!atual) return { error: 'Categoria não encontrada.' };
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo) return { error: 'Informe um nome.' };

    const dados: Partial<Categoria> = { nome: nomeLimpo };
    if (novaCor) dados.cor = novaCor;
    const { error } = await supabase.from('categorias').update(dados).eq('id', id);
    if (error) return { error: error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message };

    if (nomeLimpo !== atual.nome) {
      const [rSaidas, rTelegram] = await Promise.all([
        supabase.from('pessoal_saidas').update({ categoria: nomeLimpo }).eq('categoria', atual.nome),
        supabase.from('telegram_gastos').update({ categoria: nomeLimpo }).eq('categoria', atual.nome),
      ]);
      if (rSaidas.error || rTelegram.error) {
        await recarregar();
        return { error: 'Categoria renomeada, mas falha ao atualizar lançamentos existentes. Tente renomear de novo pra reprocessar.' };
      }
    }
    await recarregar();
    return { error: null };
  }

  async function contarUso(nome: string): Promise<{ pessoal: number; telegram: number }> {
    const [rSaidas, rTelegram] = await Promise.all([
      supabase.from('pessoal_saidas').select('id', { count: 'exact', head: true }).eq('categoria', nome),
      supabase.from('telegram_gastos').select('id', { count: 'exact', head: true }).eq('categoria', nome),
    ]);
    return { pessoal: rSaidas.count ?? 0, telegram: rTelegram.count ?? 0 };
  }

  async function excluir(id: string, nome: string, opts?: { reatribuirPara?: string }): Promise<Resultado> {
    if (opts?.reatribuirPara) {
      const [rSaidas, rTelegram] = await Promise.all([
        supabase.from('pessoal_saidas').update({ categoria: opts.reatribuirPara }).eq('categoria', nome),
        supabase.from('telegram_gastos').update({ categoria: opts.reatribuirPara }).eq('categoria', nome),
      ]);
      if (rSaidas.error || rTelegram.error) {
        return { error: 'Falha ao reatribuir lançamentos. Categoria não foi excluída.' };
      }
    } else {
      const uso = await contarUso(nome);
      if (uso.pessoal + uso.telegram > 0) {
        return { error: `Categoria em uso por ${uso.pessoal + uso.telegram} lançamento(s). Reatribua antes de excluir.` };
      }
    }
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) return { error: error.message };
    await recarregar();
    return { error: null };
  }

  return { categorias, corPorNome, loading, recarregar, criar, renomear, excluir, contarUso };
}
