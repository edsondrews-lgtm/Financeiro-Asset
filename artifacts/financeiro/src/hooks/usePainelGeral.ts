import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { CUBS_ESCRITURA_TOTAL } from "../lib/constants";

export function usePainelGeral(mesDash: string, anoDash: string) {
  const [loading, setLoading] = useState(false);

  // Empresa
  const [notas,    setNotas]    = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  // Pessoal
  const [entradasPF, setEntradasPF] = useState<any[]>([]);
  const [saidasPF,   setSaidasPF]   = useState<any[]>([]);
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
        rNotas, rDespesas, rEntradas, rSaidas,
        rConsorcios, rParcela,
        rCub, rParcelasImovel, rReforcos, rImovel, rCasaAportes,
        rPrevRend, rPrevAportes, rAcoes, rFGTS, rBens,
        rCaixinhas,
      ] = await Promise.all([
        supabase.from("empresa_notas_fiscais").select("valor,data_emissao"),
        supabase.from("empresa_despesas").select("valor,periodicidade,data_vencimento"),
        supabase.from("entradas_pessoais").select("valor,data_entrada,tipo,descricao"),
        supabase.from("pessoal_saidas").select("valor,data_gasto,categoria"),
        supabase.from("consorcios").select("valor_bem,descricao"),
        supabase.from("parcelas_calculadas").select("valor_total,data_vencimento").eq("status","pendente").order("data_vencimento",{ascending:true}).limit(1),
        supabase.from("imovel_cub").select("valor_cub").order("data_registro",{ascending:false}).limit(1),
        supabase.from("imovel_parcelas").select("numero_parcela,valor_pago,adiantada"),
        supabase.from("imovel_reforcos").select("valor_reais,cubs_pagos,is_escritura"),
        supabase.from("imovel").select("valor_original,cub_referencia_original").limit(1).single(),
        supabase.from("casa_aportes").select("valor"),
        // ── previdência ──
        supabase.from("previdencia_rendimentos").select("valor,saldo_final").order("competencia",{ascending:false}).limit(1),
        supabase.from("previdencia_aportes").select("valor"),
        supabase.from("carteira_investimentos").select("preco_medio,quantidade"),
        supabase.from("fgts_lancamentos").select("saldo_total").order("data",{ascending:false}).limit(1),
        supabase.from("bens").select("valor_estimado"),
        supabase.from("caixinhas").select("nome,valor_atual").order("created_at", { ascending: true }),
      ]);

      if (rNotas.data)      setNotas(rNotas.data);
      if (rDespesas.data)   setDespesas(rDespesas.data);
      if (rEntradas.data)   setEntradasPF(rEntradas.data);
      if (rSaidas.data)     setSaidasPF(rSaidas.data);
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

      const totalCasa = (rCasaAportes.data || []).reduce((s: number, a: any) => s + (Number(a.valor) || 0), 0);
      setCasaPago(totalCasa);

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

  // ── cálculos do mês ──────────────────────────────────────────────────────
  const prefixoDash    = `${anoDash}-${mesDash}`;
  const notasDoMes     = notas.filter(n => n.data_emissao?.startsWith(prefixoDash));
  const faturamentoMes = notasDoMes.reduce((s, n) => s + (Number(n.valor) || 0), 0);
  const aliquotaMes    = Number(mesDash) >= 6 ? 0.07 : 0.06;
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

  const totalConsorcios = consorcios.reduce((s, c) => s + (Number(c.valor_bem)  || 0), 0);
  const totalBens = bens.reduce((s: number, b: any) => s + (Number(b.valor_estimado) || 0), 0);

  // ── patrimônio ───────────────────────────────────────────────────────────
  // totalCaixinhas já inclui rendimento CDI (vem do callback do Caixinhas.tsx)
  const patrimonioTotal = imovelPago + casaPago + totalCaixinhas + totalConsorcios + saldoPrevidencia + totalAcoes + saldoFGTS + totalBens;

  const faturamentoAno  = notas.filter(n => n.data_emissao?.startsWith(anoDash)).reduce((s, n) => s + (Number(n.valor)||0), 0);

  const rankingCats = Object.entries(
    saidasDoMes.reduce((acc: Record<string,number>, g: any) => ({
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
  };
}
