import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { CUBS_ESCRITURA_TOTAL } from "../lib/constants";
import { resolverAliquota } from "../lib/aliquota";
import { buscarHistoricoCDI, calcularJurosCompostos } from "../lib/cdi";
import { buscarCotacoesBrapi } from "../lib/brapi";

export function usePainelGeral(mesDash: string, anoDash: string) {
  const [loading, setLoading] = useState(false);
  const [atualizandoMercado, setAtualizandoMercado] = useState(false);

  // Empresa
  const [notas,    setNotas]    = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [aliquotasOverride, setAliquotasOverride] = useState<Record<string, number>>({});
  // Pessoal
  const [entradasPF, setEntradasPF] = useState<any[]>([]);
  const [saidasPF,   setSaidasPF]   = useState<any[]>([]);
  const [telegramPF, setTelegramPF] = useState<any[]>([]);
  // Investimentos / Patrimônio
  const [totalCaixinhas,  setTotalCaixinhas]  = useState(0); // vem via callback do Caixinhas.tsx (c/ rendimento CDI)
  const [listaCaixinhas,  setListaCaixinhas]  = useState<{ nome: string; valor_atual: number }[]>([]);
  const [consorcios,      setConsorcios]      = useState<any[]>([]);
  const [proximaParcela,  setProximaParcela]  = useState<any | null>(null);
  // ── PREVIDÊNCIA ──
  const [saldoPrevidencia,   setSaldoPrevidencia]   = useState(0);
  const [aportesPrev,        setAportesPrev]         = useState(0);
  const [totalAcoes,         setTotalAcoes]          = useState(0);
  // FGTS
  const [saldoFGTS,          setSaldoFGTS]           = useState(0);
  // Bens
  const [bens,               setBens]                = useState<any[]>([]);
  // Imóvel
  const [imovelPago,            setImovelPago]            = useState(0);
  const [casaPago,              setCasaPago]              = useState(0);
  const [imovelAtualizado,      setImovelAtualizado]      = useState(0);
  const [proximaParcelaImovel,  setProximaParcelaImovel]  = useState<{ valor: number; dias: number } | null>(null);
  const [escrituraPaga,         setEscriturapaga]         = useState(0);
  const [cubsRestantesEscritura,setCubsRestantesEscritura]= useState(CUBS_ESCRITURA_TOTAL);

  useEffect(() => { buscarTodos(); }, []);

  async function buscarTodos() {
    setLoading(true);
    try {
      const [
        rNotas, rDespesas, rEntradas, rSaidas, rTelegram,
        rConsorcios, rParcela,
        rCub, rParcelasImovel, rReforcos, rImovel, rCasaResumo,
        rPrevRend, rPrevAportes, rAcoes, rFGTS, rBens,
        rCaixinhas, rAliquotas,
      ] = await Promise.all([
        supabase.from("empresa_notas_fiscais").select("valor,data_emissao"),
        supabase.from("empresa_despesas").select("valor,periodicidade,data_vencimento"),
        supabase.from("entradas_pessoais").select("valor,data_entrada,tipo,descricao"),
        supabase.from("pessoal_saidas").select("valor,data_gasto,categoria"),
        supabase.from("telegram_gastos").select("valor,data_gasto,categoria").eq("reconciliado", false),
        supabase.from("consorcios").select("valor_bem,descricao,credito_disponivel,data_contemplacao"),
        supabase.from("parcelas_calculadas").select("valor_total,data_vencimento").eq("status","pendente").order("data_vencimento",{ascending:true}).limit(1),
        supabase.from("imovel_cub").select("valor_cub").order("data_registro",{ascending:false}).limit(1),
        supabase.from("imovel_parcelas").select("numero_parcela,valor_pago,adiantada"),
        supabase.from("imovel_reforcos").select("valor_reais,cubs_pagos,is_escritura"),
        supabase.from("imovel").select("valor_original,cub_referencia_original").limit(1).single(),
        supabase.from("casa_resumo").select("total_pago").single(),
        // ── previdência ──
        supabase.from("previdencia_rendimentos").select("valor,saldo_final").order("competencia",{ascending:false}).limit(1),
        supabase.from("previdencia_aportes").select("valor"),
        supabase.from("carteira_investimentos").select("preco_medio,quantidade"),
        supabase.from("fgts_lancamentos").select("saldo_total").order("data",{ascending:false}).limit(1),
        supabase.from("bens").select("valor_estimado"),
        supabase.from("caixinhas").select("nome,valor_atual").order("created_at", { ascending: true }),
        supabase.from("empresa_aliquotas").select("mes_ano,aliquota"),
      ]);

      if (rNotas.data)      setNotas(rNotas.data);
      if (rDespesas.data)   setDespesas(rDespesas.data);
      if (rAliquotas.data) {
        const mapa: Record<string, number> = {};
        for (const a of rAliquotas.data) mapa[a.mes_ano] = Number(a.aliquota);
        setAliquotasOverride(mapa);
      }
      if (rEntradas.data)   setEntradasPF(rEntradas.data);
      if (rSaidas.data)     setSaidasPF(rSaidas.data);
      if (rTelegram.data)   setTelegramPF(rTelegram.data);
      if (rConsorcios.data) setConsorcios(rConsorcios.data);
      if (rParcela.data && rParcela.data[0]) setProximaParcela(rParcela.data[0]);
      if (rCaixinhas.data && rCaixinhas.data.length > 0) {
        const lista = rCaixinhas.data.map((c: any) => ({ nome: c.nome, valor_atual: Number(c.valor_atual) }));
        setListaCaixinhas(lista);
        const total = lista.reduce((s: number, c: { valor_atual: number }) => s + c.valor_atual, 0);
        setTotalCaixinhas(total);
      }
      // ── previdência ──
      if (rPrevRend.data && rPrevRend.data[0]) {
        const ultimo = rPrevRend.data[0];
        if (ultimo.saldo_final) {
          setSaldoPrevidencia(Number(ultimo.saldo_final));
        } else {
          const totalAp  = (rPrevAportes.data || []).reduce((s: number, a: any) => s + Number(a.valor), 0);
          const { data: todosRend } = await supabase.from("previdencia_rendimentos").select("valor");
          const totalRend = (todosRend || []).reduce((s: number, r: any) => s + Number(r.valor), 0);
          setSaldoPrevidencia(totalAp + totalRend);
        }
      }
      if (rPrevAportes.data) {
        const total = rPrevAportes.data.reduce((s: number, a: any) => s + Number(a.valor), 0);
        setAportesPrev(total);
      }
      if (rAcoes.data) {
        const total = rAcoes.data.reduce((s: number, a: any) => s + Number(a.preco_medio) * Number(a.quantidade), 0);
        setTotalAcoes(total);
      }
      if (rFGTS.data && rFGTS.data[0]?.saldo_total) {
        setSaldoFGTS(Number(rFGTS.data[0].saldo_total));
      }
      if (rBens.data) {
        setBens(rBens.data);
      }

      // Mesma fonte que a tela da Casa usa (view casa_resumo) — evita
      // recalcular com uma lógica diferente e destoar do valor mostrado lá.
      setCasaPago(Number(rCasaResumo.data?.total_pago) || 0);

      const reforcos       = rReforcos.data || [];
      const parcelasImovel = rParcelasImovel.data || [];
      const totalParc = parcelasImovel.reduce((s: number, p: any) => s + (Number(p.valor_pago) || 0), 0);
      const totalRef  = reforcos.reduce((s: number, r: any) => s + (Number(r.valor_reais) || 0), 0);
      setImovelPago(totalParc + totalRef);

      const cubsPagosEsc = reforcos.filter((r: any) => r.is_escritura).reduce((s: number, r: any) => s + (Number(r.cubs_pagos) || 0), 0);
      const escrituraR   = reforcos.filter((r: any) => r.is_escritura).reduce((s: number, r: any) => s + (Number(r.valor_reais) || 0), 0);
      setEscriturapaga(escrituraR);
      setCubsRestantesEscritura(parseFloat((CUBS_ESCRITURA_TOTAL - cubsPagosEsc).toFixed(4)));

      if (rCub.data && rCub.data[0] && rImovel.data) {
        const cubAtualVal = Number(rCub.data[0].valor_cub);
        const { valor_original, cub_referencia_original } = rImovel.data;
        const totalCubs = Number(valor_original) / Number(cub_referencia_original);
        setImovelAtualizado(totalCubs * cubAtualVal);

        const CUBS_PARCELA = 0.8582;
        const valorProxima = parseFloat((CUBS_PARCELA * cubAtualVal).toFixed(2));
        const parcelasNormais = parcelasImovel.filter((p: any) => !p.adiantada);
        const proximaNum = parcelasNormais.length > 0
          ? Math.max(...parcelasNormais.map((p: any) => p.numero_parcela)) + 1 : 1;
        const dataInicio = new Date("2022-12-10T12:00:00");
        dataInicio.setMonth(dataInicio.getMonth() + proximaNum - 1);
        const hoje2 = new Date(); hoje2.setHours(0,0,0,0);
        const dias = Math.ceil((dataInicio.getTime() - hoje2.getTime()) / 86400000);
        setProximaParcelaImovel({ valor: valorProxima, dias });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Recalcula Caixinhas (c/ rendimento CDI real) e Ações/FIIs (c/ cotação
  // atual via brapi) direto do Painel Geral, sem precisar montar aquelas
  // telas — que é quando esses valores normalmente são atualizados.
  async function atualizarValoresMercado() {
    setAtualizandoMercado(true);
    await Promise.all([atualizarCaixinhasComRendimento(), atualizarAcoesComCotacao()]);
    setAtualizandoMercado(false);
  }

  async function atualizarCaixinhasComRendimento() {
    try {
      const [{ data: cx }, { data: ap }] = await Promise.all([
        supabase.from("caixinhas").select("id,nome,valor_atual"),
        supabase.from("caixinhas_aportes").select("caixinha_id,valor_adicionado,data_aporte"),
      ]);
      const caixinhasList = cx || [];
      const aportesList   = ap || [];
      if (caixinhasList.length === 0) return;

      const positivos = aportesList.filter((a: any) => a.valor_adicionado > 0);
      let cdiMap = new Map<string, number>();
      if (positivos.length > 0) {
        const maisAntigo = [...positivos].sort((a: any, b: any) => a.data_aporte.localeCompare(b.data_aporte))[0];
        try { cdiMap = await buscarHistoricoCDI(new Date(maisAntigo.data_aporte + "T12:00:00")); }
        catch { /* segue sem CDI, cai no fallback fixo abaixo */ }
      }
      const ultimoCDI = [...cdiMap.entries()].sort(([a], [b]) => b.localeCompare(a))[0];
      const taxaRef = ultimoCDI ? ultimoCDI[1] : 0.0325;

      let totalGeral = 0;
      for (const c of caixinhasList) {
        const aportesDaCaixinha = aportesList.filter((a: any) => a.caixinha_id === c.id);
        const { totalDepositado, totalRendimento } = calcularJurosCompostos(aportesDaCaixinha, taxaRef, cdiMap);
        const total = totalDepositado + totalRendimento;
        totalGeral += total > 0 ? total : Number(c.valor_atual);
      }
      setTotalCaixinhas(totalGeral);
      setListaCaixinhas(caixinhasList.map((c: any) => ({ nome: c.nome, valor_atual: Number(c.valor_atual) })));
    } catch (e) { console.error(e); }
  }

  async function atualizarAcoesComCotacao() {
    try {
      const { data } = await supabase.from("carteira_investimentos").select("ticker,quantidade,preco_medio");
      const lista = data || [];
      if (lista.length === 0) { setTotalAcoes(0); return; }
      const tickers = [...new Set(lista.map((a: any) => a.ticker))];
      const cotacoes = await buscarCotacoesBrapi(tickers);
      const total = lista.reduce((s: number, a: any) => {
        const preco = cotacoes[a.ticker]?.regularMarketPrice;
        const precoUsado = preco !== undefined ? preco : Number(a.preco_medio);
        return s + precoUsado * Number(a.quantidade);
      }, 0);
      setTotalAcoes(total);
    } catch (e) { console.error(e); }
  }

  // ── cálculos do mês ──────────────────────────────────────────────────────
  const prefixoDash    = `${anoDash}-${mesDash}`;
  const notasDoMes     = notas.filter(n => n.data_emissao?.startsWith(prefixoDash));
  const faturamentoMes = notasDoMes.reduce((s, n) => s + (Number(n.valor) || 0), 0);
  const aliquotaMes    = resolverAliquota(prefixoDash, aliquotasOverride) / 100;
  const impostoMes     = faturamentoMes * aliquotaMes;
  const custosMes      = despesas.reduce((s, d) => {
    const v = Number(d.valor) || 0;
    if (d.periodicidade === "Anual") return s + v / 12;
    return d.data_vencimento?.startsWith(prefixoDash) ? s + v : s;
  }, 0);
  const lucroEmpresaMes  = faturamentoMes - impostoMes - custosMes;
  const entradasDoMes    = entradasPF.filter(e => e.data_entrada?.startsWith(prefixoDash));
  const totalEntradasMes = entradasDoMes.reduce((s, e) => s + (Number(e.valor) || 0), 0);
  const saidasDoMes      = saidasPF.filter(s => s.data_gasto?.startsWith(prefixoDash));
  const totalSaidasMes   = saidasDoMes.reduce((s, g) => s + (Number(g.valor) || 0), 0);
  const saldoMes         = totalEntradasMes - totalSaidasMes;
  // telegramPF já vem filtrado por reconciliado=false; aqui só recorta pro mês.
  // Entra no ranking de categorias (visual/apresentacional) mas não em
  // totalSaidasMes/saldoMes, que ficam de fora dessa correção por ora.
  const telegramDoMes    = telegramPF.filter(t => t.data_gasto?.startsWith(prefixoDash));

  // Um consórcio já contemplado (crédito sacável, ainda não usado) conta pelo
  // crédito disponível real informado pelo administrador, não pelo valor do
  // bem original — que era só uma expectativa até a contemplação acontecer.
  const totalConsorcios = consorcios.reduce((s, c) => s + (Number(c.credito_disponivel ?? c.valor_bem) || 0), 0);
  const totalBens = bens.reduce((s: number, b: any) => s + (Number(b.valor_estimado) || 0), 0);

  // ── patrimônio ───────────────────────────────────────────────────────────
  // totalCaixinhas já inclui rendimento CDI (vem do callback do Caixinhas.tsx)
  const patrimonioTotal = imovelPago + casaPago + totalCaixinhas + totalConsorcios + saldoPrevidencia + totalAcoes + saldoFGTS + totalBens;

  const faturamentoAno  = notas.filter(n => n.data_emissao?.startsWith(anoDash)).reduce((s, n) => s + (Number(n.valor)||0), 0);

  const rankingCats = Object.entries(
    [...saidasDoMes, ...telegramDoMes].reduce((acc: Record<string,number>, g: any) => ({
      ...acc, [g.categoria||"Outros"]: (acc[g.categoria||"Outros"]||0) + (Number(g.valor)||0),
    }), {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCat = rankingCats[0]?.[1] ?? 1;

  const progressoImovel = imovelAtualizado > 0 ? Math.min(100, (imovelPago / imovelAtualizado) * 100) : 0;

  return {
    loading,
    notas, proximaParcela, aportesPrev,
    totalCaixinhas, setTotalCaixinhas, listaCaixinhas,
    imovelPago, casaPago, totalConsorcios, saldoPrevidencia, totalAcoes, saldoFGTS, totalBens,
    faturamentoMes, impostoMes, custosMes, lucroEmpresaMes, faturamentoAno,
    entradasDoMes, totalEntradasMes, saidasDoMes, totalSaidasMes, saldoMes,
    patrimonioTotal,
    rankingCats, maxCat,
    progressoImovel, imovelAtualizado,
    escrituraPaga, cubsRestantesEscritura,
    proximaParcelaImovel,
    atualizandoMercado, atualizarValoresMercado,
  };
}
