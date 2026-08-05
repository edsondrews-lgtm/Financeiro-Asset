import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { navegarMes } from '../lib/mes';

export interface ContaRecorrente {
  id: string;
  nome: string;
  categoria: string;
  valor_padrao: number;
  dia_vencimento: number;
  recorrente: boolean;
  ativo: boolean;
  observacao: string | null;
}

export interface ItemChecklist {
  conta: ContaRecorrente;
  pagamentoId: string | null;
  saidaId: string | null;
  valor: number;
  pago: boolean;
  dataPagamento: string | null;
  vencimento: string;
  atrasada: boolean;
}

interface DadosConta {
  nome: string;
  categoria: string;
  valor_padrao: number;
  dia_vencimento: number;
  recorrente: boolean;
  observacao?: string | null;
}

function mesParaData(mesYM: string): string {
  return `${mesYM}-01`;
}

// Mês em que o checklist de Contas Fixas passou a ser usado — meses anteriores
// nunca foram registrados no sistema, então não entram no histórico/gráfico
// (mostrar R$0 pra eles pareceria "não pagou nada", o que é enganoso).
export const MES_INICIO_SISTEMA = '2026-08';

export function useContasRecorrentes(mesYM: string) {
  const [contas, setContas] = useState<ContaRecorrente[]>([]);
  const [pagamentos, setPagamentos] = useState<Record<string, { id: string; valor: number; pago: boolean; data_pagamento: string | null; saida_id: string | null }>>({});
  const [historico, setHistorico] = useState<{ mes: string; total: number }[]>([]);
  const [historicoLimitado, setHistoricoLimitado] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const mesRef = mesParaData(mesYM);

    const [{ data: contasData }, { data: pagData }] = await Promise.all([
      supabase.from('contas_recorrentes').select('*').order('nome'),
      supabase.from('contas_recorrentes_pagamentos').select('id,conta_id,valor,pago,data_pagamento,saida_id').eq('mes_referencia', mesRef),
    ]);

    setContas(contasData || []);
    setPagamentos(Object.fromEntries((pagData || []).map(p => [p.conta_id, { id: p.id, valor: Number(p.valor), pago: p.pago, data_pagamento: p.data_pagamento, saida_id: p.saida_id }])));

    // últimos 6 meses de histórico (total efetivamente pago), nunca antes de MES_INICIO_SISTEMA
    let cursor = mesYM;
    const meses: string[] = [mesYM];
    for (let i = 0; i < 5; i++) { cursor = navegarMes(cursor, -1); meses.unshift(cursor); }
    const mesesComDados = meses.filter(m => m >= MES_INICIO_SISTEMA);
    setHistoricoLimitado(mesesComDados.length < meses.length);

    const primeiraData = mesParaData(mesesComDados[0] ?? mesYM);
    const { data: histData } = await supabase
      .from('contas_recorrentes_pagamentos')
      .select('mes_referencia,valor,pago')
      .gte('mes_referencia', primeiraData)
      .eq('pago', true);

    const porMes: Record<string, number> = Object.fromEntries(mesesComDados.map(m => [m, 0]));
    for (const row of histData || []) {
      const m = String(row.mes_referencia).slice(0, 7);
      if (m in porMes) porMes[m] += Number(row.valor) || 0;
    }
    setHistorico(mesesComDados.map(m => ({ mes: m, total: porMes[m] })));

    setLoading(false);
  }, [mesYM]);

  useEffect(() => { carregar(); }, [carregar]);

  const contasAtivas = useMemo(() => contas.filter(c => c.ativo), [contas]);

  const checklist: ItemChecklist[] = useMemo(() => {
    const [ano, mes] = mesYM.split('-').map(Number);
    const hoje = new Date();
    const hojeYM = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    return contasAtivas.map(conta => {
      const pag = pagamentos[conta.id];
      const diaVenc = Math.min(conta.dia_vencimento, new Date(ano, mes, 0).getDate());
      const vencimento = `${ano}-${String(mes).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`;
      const pago = pag?.pago ?? false;
      const atrasada = !pago && mesYM <= hojeYM && vencimento < hoje.toISOString().slice(0, 10);
      return {
        conta,
        pagamentoId: pag?.id ?? null,
        saidaId: pag?.saida_id ?? null,
        valor: pag?.valor ?? conta.valor_padrao,
        pago,
        dataPagamento: pag?.data_pagamento ?? null,
        vencimento,
        atrasada,
      };
    }).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [contasAtivas, pagamentos, mesYM]);

  async function togglePago(item: ItemChecklist) {
    const novoPago = !item.pago;
    const mesRef = mesParaData(mesYM);
    const hoje = new Date().toISOString().slice(0, 10);

    if (novoPago) {
      // marcar como paga também lança a saída correspondente em pessoal_saidas
      const { data: saida, error: errSaida } = await supabase.from('pessoal_saidas').insert({
        descricao: item.conta.nome, categoria: item.conta.categoria, valor: item.valor,
        data_gasto: hoje, periodicidade: item.conta.recorrente ? 'Mensal' : 'Única', cartao_id: null,
      }).select().single();
      if (errSaida || !saida) return { error: errSaida?.message ?? 'Erro ao lançar saída.' };

      if (item.pagamentoId) {
        const { error } = await supabase.from('contas_recorrentes_pagamentos')
          .update({ pago: true, data_pagamento: hoje, saida_id: saida.id })
          .eq('id', item.pagamentoId);
        if (error) return { error: error.message };
      } else {
        const { error } = await supabase.from('contas_recorrentes_pagamentos').insert({
          conta_id: item.conta.id, mes_referencia: mesRef, valor: item.valor,
          pago: true, data_pagamento: hoje, saida_id: saida.id,
        });
        if (error) return { error: error.message };
      }
    } else {
      // desmarcar remove a saída vinculada, pra não deixar lançamento órfão
      if (item.saidaId) await supabase.from('pessoal_saidas').delete().eq('id', item.saidaId);
      if (item.pagamentoId) {
        const { error } = await supabase.from('contas_recorrentes_pagamentos')
          .update({ pago: false, data_pagamento: null, saida_id: null })
          .eq('id', item.pagamentoId);
        if (error) return { error: error.message };
      }
    }
    await carregar();
    return { error: null };
  }

  async function editarValorMes(item: ItemChecklist, novoValor: number) {
    const mesRef = mesParaData(mesYM);
    if (item.pagamentoId) {
      const { error } = await supabase.from('contas_recorrentes_pagamentos').update({ valor: novoValor }).eq('id', item.pagamentoId);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from('contas_recorrentes_pagamentos').insert({
        conta_id: item.conta.id, mes_referencia: mesRef, valor: novoValor, pago: false,
      });
      if (error) return { error: error.message };
    }
    // mantém a saída já lançada em dia com o novo valor
    if (item.saidaId) await supabase.from('pessoal_saidas').update({ valor: novoValor }).eq('id', item.saidaId);
    await carregar();
    return { error: null };
  }

  async function criarConta(dados: DadosConta) {
    const { error } = await supabase.from('contas_recorrentes').insert(dados);
    if (error) return { error: error.message };
    await carregar();
    return { error: null };
  }

  async function editarConta(id: string, dados: Partial<DadosConta>) {
    const { error } = await supabase.from('contas_recorrentes').update(dados).eq('id', id);
    if (error) return { error: error.message };
    await carregar();
    return { error: null };
  }

  async function alternarAtivo(id: string, ativo: boolean) {
    const { error } = await supabase.from('contas_recorrentes').update({ ativo }).eq('id', id);
    if (error) return { error: error.message };
    await carregar();
    return { error: null };
  }

  async function excluirConta(id: string) {
    const { error } = await supabase.from('contas_recorrentes').delete().eq('id', id);
    if (error) return { error: error.message };
    await carregar();
    return { error: null };
  }

  const totalPrevisto = checklist.reduce((s, i) => s + i.valor, 0);
  const totalPago = checklist.filter(i => i.pago).reduce((s, i) => s + i.valor, 0);
  const totalPendente = totalPrevisto - totalPago;
  const qtdPagas = checklist.filter(i => i.pago).length;
  const qtdAtrasadas = checklist.filter(i => i.atrasada).length;

  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const i of checklist) acc[i.conta.categoria] = (acc[i.conta.categoria] || 0) + i.valor;
    return Object.entries(acc).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  }, [checklist]);

  const mesAntesDoInicio = mesYM < MES_INICIO_SISTEMA;

  return {
    loading, contas, checklist, historico, historicoLimitado, mesAntesDoInicio,
    totalPrevisto, totalPago, totalPendente, qtdPagas, qtdAtrasadas,
    porCategoria,
    recarregar: carregar,
    togglePago, editarValorMes, criarConta, editarConta, alternarAtivo, excluirConta,
  };
}
