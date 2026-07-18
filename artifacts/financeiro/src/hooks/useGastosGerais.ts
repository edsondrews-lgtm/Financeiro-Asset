import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { primeiroEUltimoDia } from '../lib/mes';

export interface Bucket {
  id: string;
  nome: string;
  valor: number;
  cor: string;
}

export interface CategoriaGasto {
  categoria: string;
  valor: number;
}

export interface LancamentoDiaADia {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  origem: 'Cartão' | 'PIX/Dinheiro' | 'Telegram';
}

export function useGastosGerais(mesYM: string) {
  const [loading, setLoading] = useState(false);
  const [diaADiaPorCategoria, setDiaADiaPorCategoria] = useState<CategoriaGasto[]>([]);
  const [diaADiaLancamentos, setDiaADiaLancamentos] = useState<LancamentoDiaADia[]>([]);
  const [apartamentoTotal, setApartamentoTotal] = useState(0);
  const [casaTotal, setCasaTotal] = useState(0);
  const [previdenciaTotal, setPrevidenciaTotal] = useState(0);
  const [consorcioTotal, setConsorcioTotal] = useState(0);

  useEffect(() => { buscar(); }, [mesYM]);

  async function buscar() {
    setLoading(true);
    try {
      const { primeiroDia, ultimoDia } = primeiroEUltimoDia(mesYM);

      const [
        rSaidas, rTelegram, rImovelParcelas, rImovelReforcos,
        rCasaAportes, rPrevidenciaAportes, rParcelasCalculadas,
      ] = await Promise.all([
        supabase.from('pessoal_saidas').select('id,descricao,categoria,valor,data_gasto,cartao_id').gte('data_gasto', primeiroDia).lte('data_gasto', ultimoDia),
        supabase.from('telegram_gastos').select('id,descricao,categoria,valor,data_gasto').eq('reconciliado', false).gte('data_gasto', primeiroDia).lte('data_gasto', ultimoDia),
        supabase.from('imovel_parcelas').select('valor_pago').gte('data_pagamento', primeiroDia).lte('data_pagamento', ultimoDia),
        supabase.from('imovel_reforcos').select('valor_reais').gte('data_pagamento', primeiroDia).lte('data_pagamento', ultimoDia),
        supabase.from('casa_aportes').select('valor').gte('data_pagamento', primeiroDia).lte('data_pagamento', ultimoDia),
        supabase.from('previdencia_aportes').select('valor').gte('competencia', primeiroDia).lte('competencia', ultimoDia),
        supabase.from('parcelas_calculadas').select('valor_pago,valor_total').eq('status', 'pago').gte('data_pagamento', primeiroDia).lte('data_pagamento', ultimoDia),
      ]);

      const lancamentos: LancamentoDiaADia[] = [
        ...(rSaidas.data || []).map((g: any): LancamentoDiaADia => ({
          id: g.id, descricao: g.descricao, categoria: g.categoria || 'Outros',
          valor: Number(g.valor) || 0, data: g.data_gasto,
          origem: g.cartao_id ? 'Cartão' : 'PIX/Dinheiro',
        })),
        ...(rTelegram.data || []).map((g: any): LancamentoDiaADia => ({
          id: g.id, descricao: g.descricao, categoria: g.categoria || 'Outros',
          valor: Number(g.valor) || 0, data: g.data_gasto,
          origem: 'Telegram',
        })),
      ].sort((a, b) => b.data.localeCompare(a.data));
      setDiaADiaLancamentos(lancamentos);

      const porCategoria = Object.entries(
        lancamentos.reduce((acc: Record<string, number>, g) => ({
          ...acc, [g.categoria]: (acc[g.categoria] || 0) + g.valor,
        }), {})
      ).map(([categoria, valor]) => ({ categoria, valor }));
      setDiaADiaPorCategoria(porCategoria);

      const apartamento =
        (rImovelParcelas.data || []).reduce((s: number, p: any) => s + (Number(p.valor_pago) || 0), 0) +
        (rImovelReforcos.data || []).reduce((s: number, r: any) => s + (Number(r.valor_reais) || 0), 0);
      setApartamentoTotal(apartamento);

      const casa = (rCasaAportes.data || []).reduce((s: number, a: any) => s + (Number(a.valor) || 0), 0);
      setCasaTotal(casa);

      const previdencia = (rPrevidenciaAportes.data || []).reduce((s: number, a: any) => s + (Number(a.valor) || 0), 0);
      setPrevidenciaTotal(previdencia);

      const consorcio = (rParcelasCalculadas.data || []).reduce(
        (s: number, p: any) => s + (Number(p.valor_pago ?? p.valor_total) || 0), 0,
      );
      setConsorcioTotal(consorcio);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const diaADiaTotal = diaADiaPorCategoria.reduce((s, c) => s + c.valor, 0);
  const granTotal = diaADiaTotal + apartamentoTotal + casaTotal + previdenciaTotal + consorcioTotal;

  const buckets: Bucket[] = [
    { id: 'dia-a-dia', nome: 'Dia a dia (cartão/PIX/Telegram)', valor: diaADiaTotal, cor: '#0EA5E9' },
    { id: 'apartamento', nome: 'Apartamento 810', valor: apartamentoTotal, cor: '#7C3AED' },
    { id: 'casa', nome: 'Casa Jardim Mirante', valor: casaTotal, cor: '#059669' },
    { id: 'previdencia', nome: 'Previdência', valor: previdenciaTotal, cor: '#F59E0B' },
    { id: 'consorcio', nome: 'Consórcio', valor: consorcioTotal, cor: '#EC4899' },
  ].sort((a, b) => b.valor - a.valor);
  const maxBucket = buckets[0]?.valor ?? 1;

  return {
    loading,
    diaADiaPorCategoria, diaADiaLancamentos, diaADiaTotal,
    apartamentoTotal, casaTotal, previdenciaTotal, consorcioTotal,
    granTotal, buckets, maxBucket,
    recarregar: buscar,
  };
}
