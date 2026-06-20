import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import ControleEmpresa from "./views/ControleEmpresa";
import SaidasPainel from "./views/SaidasPainel";
import EntradasPessoais from "./views/EntradasPessoais";
import ResumoPessoal from "./views/ResumoPessoal";
import CasaJardimMirante from "./views/CasaJardimMirante";
import Apartamento from "./views/Apartamento";
import PasswordGate from "./components/PasswordGate";
import CarteiraInvestimentos from "./views/CarteiraInvestimentos";
import Consorcios from "./views/Consorcios";
import Caixinhas from "./views/Caixinhas";
import PrevidenciaPainel from "./views/PrevidenciaPainel";
import {
  LayoutDashboard, Building2, Home, Wallet, ChevronDown,
  PieChart, FileText, PiggyBank, TrendingUp, ArrowUpRight,
  DollarSign, CreditCard, Shield, Target, Calendar,
  ArrowRight, BedDouble, Trees, BarChart2,
} from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MESES_CURTOS    = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_COMPLETOS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CUBS_ESCRITURA_TOTAL = 29.6215;

export default function App() {
  const hoje = new Date();
  const [abaAtiva, setAbaAtiva]                     = useState("geral");
  const [subAbaInvestimento, setSubAbaInvestimento] = useState("acoes");
  const [subAbaPessoal, setSubAbaPessoal]           = useState("resumo");
  const [subAbaImovel, setSubAbaImovel]             = useState("apartamento");
  const [menuInvestimentosAberto, setMenuInvestimentosAberto] = useState(false);
  const [menuPessoalAberto, setMenuPessoalAberto]             = useState(false);
  const [menuImovelAberto, setMenuImovelAberto]               = useState(false);
  const [mesDash, setMesDash] = useState(String(hoje.getMonth() + 1).padStart(2, "0"));
  const [anoDash, setAnoDash] = useState(String(hoje.getFullYear()));
  const [loading, setLoading] = useState(false);

  // Empresa
  const [notas,    setNotas]    = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  // Pessoal
  const [entradasPF, setEntradasPF] = useState<any[]>([]);
  const [saidasPF,   setSaidasPF]   = useState<any[]>([]);
  // Investimentos / Patrimônio
  const [caixinhas,      setCaixinhas]      = useState<any[]>([]);
  const [consorcios,     setConsorcios]     = useState<any[]>([]);
  const [proximaParcela, setProximaParcela] = useState<any | null>(null);
  // ── PREVIDÊNCIA ──
  const [saldoPrevidencia,   setSaldoPrevidencia]   = useState(0);
  const [rendPrevidencia,    setRendPrevidencia]     = useState(0); // rendimento acumulado
  const [aportesPrev,        setAportesPrev]         = useState(0); // total aportado
  // Imóvel
  const [imovelPago,            setImovelPago]            = useState(0);
  const [casaPago,              setCasaPago]              = useState(0);
  const [imovelAtualizado,      setImovelAtualizado]      = useState(0);
  const [proximaParcelaImovel,  setProximaParcelaImovel]  = useState<{ valor: number; dias: number } | null>(null);
  const [escrituraPaga,         setEscriturapaga]         = useState(0);
  const [cubsRestantesEscritura,setCubsRestantesEscritura]= useState(CUBS_ESCRITURA_TOTAL);

  useEffect(() => { buscarTodos(); }, []);

  useEffect(() => {
    function fecharMenus(e: MouseEvent) {
      const alvo = e.target as HTMLElement;
      if (!alvo.closest("#menu-investimentos")) setMenuInvestimentosAberto(false);
      if (!alvo.closest("#menu-pessoal"))       setMenuPessoalAberto(false);
      if (!alvo.closest("#menu-imovel"))        setMenuImovelAberto(false);
    }
    document.addEventListener("mousedown", fecharMenus);
    return () => document.removeEventListener("mousedown", fecharMenus);
  }, []);

  async function buscarTodos() {
    setLoading(true);
    try {
      const [
        rNotas, rDespesas, rEntradas, rSaidas,
        rCaixinhas, rConsorcios, rParcela,
        rCub, rParcelasImovel, rReforcos, rImovel, rCasaAportes,
        rPrevRend, rPrevAportes,
      ] = await Promise.all([
        supabase.from("empresa_notas_fiscais").select("valor,data_emissao"),
        supabase.from("empresa_despesas").select("valor,periodicidade,data_vencimento"),
        supabase.from("entradas_pessoais").select("valor,data_entrada,tipo,descricao"),
        supabase.from("pessoal_saidas").select("valor,data_gasto,categoria"),
        supabase.from("caixinhas").select("valor_atual,nome,meta"),
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
      ]);

      if (rNotas.data)      setNotas(rNotas.data);
      if (rDespesas.data)   setDespesas(rDespesas.data);
      if (rEntradas.data)   setEntradasPF(rEntradas.data);
      if (rSaidas.data)     setSaidasPF(rSaidas.data);
      if (rCaixinhas.data)  setCaixinhas(rCaixinhas.data);
      if (rConsorcios.data) setConsorcios(rConsorcios.data);
      if (rParcela.data && rParcela.data[0]) setProximaParcela(rParcela.data[0]);

      // ── previdência: usa saldo_final do último rendimento se disponível ──
      if (rPrevRend.data && rPrevRend.data[0]) {
        const ultimo = rPrevRend.data[0];
        if (ultimo.saldo_final) {
          setSaldoPrevidencia(Number(ultimo.saldo_final));
        } else {
          // fallback: soma aportes + rendimentos
          const totalAp  = (rPrevAportes.data || []).reduce((s: number, a: any) => s + Number(a.valor), 0);
          // busca todos os rendimentos para somar
          const { data: todosRend } = await supabase.from("previdencia_rendimentos").select("valor");
          const totalRend = (todosRend || []).reduce((s: number, r: any) => s + Number(r.valor), 0);
          setSaldoPrevidencia(totalAp + totalRend);
        }
      }
      if (rPrevAportes.data) {
        const total = rPrevAportes.data.reduce((s: number, a: any) => s + Number(a.valor), 0);
        setAportesPrev(total);
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

  const totalCaixinhas  = caixinhas.reduce((s, c) => s + (Number(c.valor_atual) || 0), 0);
  const totalConsorcios = consorcios.reduce((s, c) => s + (Number(c.valor_bem)  || 0), 0);

  // ── patrimônio agora inclui previdência ──────────────────────────────────
  const patrimonioTotal = imovelPago + casaPago + totalCaixinhas + totalConsorcios + saldoPrevidencia;

  const faturamentoAno  = notas.filter(n => n.data_emissao?.startsWith(anoDash)).reduce((s, n) => s + (Number(n.valor)||0), 0);

  const rankingCats = Object.entries(
    saidasDoMes.reduce((acc: Record<string,number>, g: any) => ({
      ...acc, [g.categoria||"Outros"]: (acc[g.categoria||"Outros"]||0) + (Number(g.valor)||0),
    }), {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCat = rankingCats[0]?.[1] ?? 1;

  const progressoImovel = imovelAtualizado > 0 ? Math.min(100, (imovelPago / imovelAtualizado) * 100) : 0;

  // rentabilidade da previdência
  const rentabilidadePrev = aportesPrev > 0
    ? (((saldoPrevidencia - aportesPrev) / aportesPrev) * 100).toFixed(1)
    : "0";

  // ── nav config ────────────────────────────────────────────────────────────
  const navItems = [
    { id: "geral",   label: "Painel Geral", icon: <LayoutDashboard size={14}/> },
    { id: "empresa", label: "Empresa",      icon: <Building2 size={14}/> },
  ];

  const subItensImovel = [
    { id: "apartamento", label: "Apartamento 810",     icon: <BedDouble size={13}/> },
    { id: "casa",        label: "Casa Jardim Mirante", icon: <Trees size={13}/> },
  ];

  const subItensInvestimento = [
    { id: "acoes",       label: "Ações",       icon: <PieChart size={13}/> },
    { id: "consorcios",  label: "Consórcio",   icon: <FileText size={13}/> },
    { id: "caixinhas",   label: "Caixinhas",   icon: <PiggyBank size={13}/> },
    { id: "previdencia", label: "Previdência", icon: <Shield size={13}/> },
  ];

  const subItensPessoal = [
    { id: "resumo",   label: "Resumo",   icon: <BarChart2 size={13}/> },
    { id: "entradas", label: "Entradas", icon: <TrendingUp size={13}/> },
    { id: "saidas",   label: "Saídas",   icon: <CreditCard size={13}/> },
  ];

  function selecionarSubImovel(sub: string)       { setSubAbaImovel(sub);       setAbaAtiva("imoveis");       setMenuImovelAberto(false); }
  function selecionarSubInvestimento(sub: string) { setSubAbaInvestimento(sub); setAbaAtiva("investimentos"); setMenuInvestimentosAberto(false); }
  function selecionarSubPessoal(sub: string)      { setSubAbaPessoal(sub);      setAbaAtiva("pessoal");       setMenuPessoalAberto(false); }

  // ── Painel Geral ──────────────────────────────────────────────────────────
  const PainelGeral = () => (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <LayoutDashboard size={22}/>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Painel Geral</h1>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">
                Visão consolidada · {hoje.toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
                Atualizando...
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <Calendar size={13} className="text-slate-400"/>
              <select value={mesDash} onChange={e => setMesDash(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent pr-1">
                {MESES_COMPLETOS.map((m, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{m}</option>)}
              </select>
              <select value={anoDash} onChange={e => setAnoDash(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent">
                <option>2026</option><option>2025</option>
              </select>
            </div>
          </div>
        </div>

        {/* PATRIMÔNIO — agora com 6 itens incluindo Previdência */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patrimônio Total Estimado</p>
              <p className="text-4xl font-black tabular-nums text-white">{fmt(patrimonioTotal)}</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Imóvel + Caixinhas + Consórcio + Previdência</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-3 flex-1 lg:max-w-2xl">
              {[
                { label: "Apt 810",      valor: imovelPago,        icon: <Home size={14}/>,      cor: "text-cyan-400",    nota: "pago até hoje" },
                { label: "Caixinhas",    valor: totalCaixinhas,    icon: <PiggyBank size={14}/>, cor: "text-emerald-400", nota: `${caixinhas.length} cofrinhos` },
                { label: "Consórcio",    valor: totalConsorcios,   icon: <Shield size={14}/>,    cor: "text-violet-400",  nota: "crédito total" },
                { label: "Casa",         valor: casaPago,          icon: <Home size={14}/>,      cor: "text-emerald-400", nota: "Jardim Mirante" },
                { label: "Previdência",  valor: saldoPrevidencia,  icon: <Shield size={14}/>,    cor: "text-amber-400",   nota: `+${rentabilidadePrev}% sobre aportes` },
                { label: "Ações",        valor: 0,                 icon: <PieChart size={14}/>,  cor: "text-slate-500",   nota: "não cadastrado" },
              ].map((item, i) => (
                <div key={i}
                  className={`bg-white/5 border border-white/10 rounded-xl p-3 cursor-pointer hover:bg-white/10 transition-colors ${item.label === "Previdência" ? "border-amber-400/30" : ""}`}
                  onClick={() => item.label === "Previdência" ? selecionarSubInvestimento("previdencia") : undefined}
                >
                  <div className={`flex items-center gap-1.5 ${item.cor} mb-2`}>
                    {item.icon}
                    <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                    {item.label === "Previdência" && <span className="ml-auto text-[8px] opacity-50">↗</span>}
                  </div>
                  <p className={`text-base font-black tabular-nums ${item.valor === 0 ? "text-slate-600" : "text-white"}`}>
                    {fmt(item.valor)}
                  </p>
                  <p className="text-[9px] text-slate-500 font-semibold mt-0.5">{item.nota}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FLUXO DO MÊS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Fluxo Pessoal — {MESES_COMPLETOS[Number(mesDash)-1]} {anoDash}
            </p>
            <button
              onClick={() => selecionarSubPessoal("resumo")}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors"
            >
              Ver resumo completo <ArrowRight size={10}/>
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-50 rounded-lg"><ArrowUpRight size={14} className="text-emerald-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entradas PF</p>
              </div>
              <p className="text-2xl font-black text-emerald-600 tabular-nums">{fmt(totalEntradasMes)}</p>
              {entradasDoMes.length === 0
                ? <p className="text-[11px] text-slate-300 mt-2 font-medium">Nenhum lançamento — cadastre em Pessoal → Entradas</p>
                : <p className="text-[11px] text-slate-400 mt-2 font-semibold">{entradasDoMes.length} lançamento{entradasDoMes.length !== 1 ? "s" : ""}</p>}
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-rose-50 rounded-lg"><DollarSign size={14} className="text-rose-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saídas PF</p>
              </div>
              <p className="text-2xl font-black text-rose-600 tabular-nums">{fmt(totalSaidasMes)}</p>
              {saidasDoMes.length === 0
                ? <p className="text-[11px] text-slate-300 mt-2 font-medium">Nenhum gasto registrado</p>
                : <p className="text-[11px] text-slate-400 mt-2 font-semibold">{saidasDoMes.length} gasto{saidasDoMes.length !== 1 ? "s" : ""}</p>}
            </div>
            <div className={`rounded-2xl p-5 shadow-sm border ${saldoMes >= 0 ? "bg-emerald-500 border-emerald-400" : "bg-rose-500 border-rose-400"} text-white`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-white/20 rounded-lg"><Target size={14}/></div>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Saldo do Mês</p>
              </div>
              <p className="text-2xl font-black tabular-nums">{fmt(saldoMes)}</p>
              <p className="text-[11px] text-white/70 mt-2 font-semibold">
                {saldoMes >= 0 ? "✓ Mês positivo" : "⚠ Gastos acima das entradas"}
                {totalEntradasMes === 0 && " · cadastre entradas PF"}
              </p>
            </div>
          </div>
        </div>

        {/* CONTEXTO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Empresa */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 rounded-lg"><Building2 size={14} className="text-blue-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</p>
              </div>
              <button onClick={() => setAbaAtiva("empresa")} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1">Ver <ArrowRight size={10}/></button>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Faturamento mês", valor: faturamentoMes,  color: "text-slate-900" },
                { label: "Imposto est.",    valor: impostoMes,      color: "text-amber-600" },
                { label: "Custos",          valor: custosMes,       color: "text-rose-600"  },
                { label: "Lucro líquido",   valor: lucroEmpresaMes, color: lucroEmpresaMes >= 0 ? "text-emerald-600" : "text-rose-600" },
              ].map((row, i) => (
                <div key={i} className={`flex items-center justify-between ${i === 3 ? "pt-2 border-t border-slate-100" : ""}`}>
                  <span className="text-xs text-slate-500 font-semibold">{row.label}</span>
                  <span className={`text-xs font-black tabular-nums ${row.color}`}>{fmt(row.valor)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-50">
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                <span>Faturamento {anoDash}</span>
                <span className="font-black text-slate-700 tabular-nums">{fmt(faturamentoAno)}</span>
              </div>
            </div>
          </div>

          {/* Caixinhas */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg"><PiggyBank size={14} className="text-emerald-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caixinhas</p>
              </div>
              <button onClick={() => { setSubAbaInvestimento("caixinhas"); setAbaAtiva("investimentos"); }} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-700 flex items-center gap-1">Ver <ArrowRight size={10}/></button>
            </div>
            <p className="text-2xl font-black text-emerald-600 tabular-nums mb-3">{fmt(totalCaixinhas)}</p>
            <div className="space-y-2">
              {caixinhas.slice(0, 4).map((c: any, i: number) => {
                const pct = c.meta ? Math.min(100, (c.valor_atual / c.meta) * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[11px] font-semibold text-slate-600 truncate">{c.nome}</span>
                      {c.meta && <span className="text-[10px] font-bold text-slate-400">{pct.toFixed(0)}%</span>}
                    </div>
                    {c.meta && <div className="h-1.5 bg-slate-100 rounded-full"><div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }}/></div>}
                  </div>
                );
              })}
              {caixinhas.length === 0 && <p className="text-xs text-slate-300 font-semibold">Nenhuma caixinha cadastrada</p>}
            </div>
          </div>

          {/* Imóvel */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-50 rounded-lg"><Home size={14} className="text-cyan-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Imóvel — Apt 810</p>
              </div>
              <button onClick={() => selecionarSubImovel("apartamento")} className="text-[10px] font-bold text-cyan-500 hover:text-cyan-700 flex items-center gap-1">Ver <ArrowRight size={10}/></button>
            </div>
            <div className="mb-3 p-3 bg-cyan-50 rounded-xl">
              <p className="text-[10px] font-black text-cyan-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Home size={10}/> Financiamento
              </p>
              <div className="w-full bg-white rounded-full h-2 mb-1.5">
                <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${progressoImovel.toFixed(1)}%` }}/>
              </div>
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="text-cyan-700">{fmt(imovelPago)} pago</span>
                <span className="text-cyan-500">{progressoImovel.toFixed(1)}% · valor atual {fmt(imovelAtualizado)}</span>
              </div>
            </div>
            {cubsRestantesEscritura < CUBS_ESCRITURA_TOTAL && (
              <div className="mb-3 p-3 bg-purple-50 rounded-xl">
                <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider mb-1">🏠 Escritura</p>
                <div className="w-full bg-white rounded-full h-1.5 mb-1">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100,((CUBS_ESCRITURA_TOTAL-cubsRestantesEscritura)/CUBS_ESCRITURA_TOTAL)*100).toFixed(1)}%` }}/>
                </div>
                <div className="flex justify-between text-[10px] font-semibold">
                  <span className="text-purple-600">{fmt(escrituraPaga)} pago</span>
                  {cubsRestantesEscritura <= 0
                    ? <span className="text-emerald-600 font-black">✓ Quitada!</span>
                    : <span className="text-purple-400">{cubsRestantesEscritura.toFixed(4)} CUBs restantes</span>}
                </div>
              </div>
            )}
            {proximaParcelaImovel ? (
              <div className="p-3 bg-indigo-50 rounded-xl">
                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText size={10}/> Próxima Parcela
                </p>
                <p className="text-base font-black text-indigo-800 tabular-nums">{fmt(proximaParcelaImovel.valor)}</p>
                <p className={`text-[10px] font-bold mt-0.5 ${proximaParcelaImovel.dias <= 7 ? "text-rose-600" : "text-indigo-500"}`}>
                  {proximaParcelaImovel.dias <= 0 ? "Vencida!" : `em ${proximaParcelaImovel.dias} dia${proximaParcelaImovel.dias !== 1 ? "s" : ""}`}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-400 font-semibold">Registre parcelas no módulo Imóveis</p>
              </div>
            )}
          </div>
        </div>

        {/* GASTOS + FATURAMENTO */}
        {(rankingCats.length > 0 || notas.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-rose-50 rounded-lg"><CreditCard size={14} className="text-rose-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Gastos — {MESES_CURTOS[Number(mesDash)-1]}</p>
              </div>
              {rankingCats.length === 0
                ? <p className="text-xs text-slate-300 font-semibold py-4">Nenhum gasto registrado neste mês</p>
                : <div className="space-y-3">
                    {rankingCats.map(([cat, val], i) => (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-300 font-bold w-3">{i+1}</span>
                            <span className="text-xs font-semibold text-slate-700">{cat}</span>
                          </div>
                          <span className="text-xs font-black text-slate-800 tabular-nums">{fmt(val)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(val/maxCat)*100}%` }}/>
                        </div>
                      </div>
                    ))}
                  </div>}
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-blue-50 rounded-lg"><TrendingUp size={14} className="text-blue-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento Mês a Mês — {anoDash}</p>
              </div>
              {(() => {
                const fatPorMes = MESES_CURTOS.map((m, i) => {
                  const key = `${anoDash}-${String(i+1).padStart(2,"0")}`;
                  const v = notas.filter(n => n.data_emissao?.startsWith(key)).reduce((s: number, n: any) => s + (Number(n.valor)||0), 0);
                  return { m, v };
                });
                const maxFat = Math.max(...fatPorMes.map(f => f.v), 1);
                return (
                  <div className="flex items-end gap-1 h-28">
                    {fatPorMes.map((f, i) => {
                      const pct = (f.v / maxFat) * 100;
                      const isAtivo = String(i+1).padStart(2,"0") === mesDash;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex items-end" style={{ height: "88px" }}>
                            <div
                              className={`w-full rounded-t-sm transition-all ${isAtivo ? "bg-blue-500" : f.v > 0 ? "bg-blue-200" : "bg-slate-100"}`}
                              style={{ height: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                          <span className={`text-[8px] font-bold ${isAtivo ? "text-blue-600" : "text-slate-400"}`}>{f.m}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );

  return (
    <PasswordGate>
      <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-600">
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              FinançasHub
            </span>
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/40">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setAbaAtiva(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === item.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {item.icon} {item.label}
                </button>
              ))}
              {/* Imóveis */}
              <div id="menu-imovel" className="relative">
                <button onClick={() => setMenuImovelAberto(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === "imoveis" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  <Home size={14}/> Imóveis
                  <ChevronDown size={12} className={`transition-transform ${menuImovelAberto ? "rotate-180" : ""}`}/>
                </button>
                {menuImovelAberto && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 min-w-[170px] z-50">
                    {subItensImovel.map(sub => (
                      <button key={sub.id} onClick={() => selecionarSubImovel(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors text-left ${abaAtiva === "imoveis" && subAbaImovel === sub.id ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`}>
                        {sub.icon} {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Pessoal */}
              <div id="menu-pessoal" className="relative">
                <button onClick={() => setMenuPessoalAberto(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === "pessoal" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  <Wallet size={14}/> Pessoal
                  <ChevronDown size={12} className={`transition-transform ${menuPessoalAberto ? "rotate-180" : ""}`}/>
                </button>
                {menuPessoalAberto && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 min-w-[150px] z-50">
                    {subItensPessoal.map(sub => (
                      <button key={sub.id} onClick={() => selecionarSubPessoal(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors text-left ${abaAtiva === "pessoal" && subAbaPessoal === sub.id ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`}>
                        {sub.icon} {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Investimentos */}
              <div id="menu-investimentos" className="relative">
                <button onClick={() => setMenuInvestimentosAberto(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === "investimentos" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  <PiggyBank size={14}/> Investimentos
                  <ChevronDown size={12} className={`transition-transform ${menuInvestimentosAberto ? "rotate-180" : ""}`}/>
                </button>
                {menuInvestimentosAberto && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 min-w-[150px] z-50">
                    {subItensInvestimento.map(sub => (
                      <button key={sub.id} onClick={() => selecionarSubInvestimento(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors text-left ${abaAtiva === "investimentos" && subAbaInvestimento === sub.id ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`}>
                        {sub.icon} {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>

          {abaAtiva === "imoveis" && (
            <div className="max-w-7xl mx-auto px-6 pb-2 flex items-center gap-1">
              {subItensImovel.map(sub => (
                <button key={sub.id} onClick={() => setSubAbaImovel(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${subAbaImovel === sub.id ? "bg-cyan-100 text-cyan-700" : "text-slate-400 hover:text-slate-600"}`}>
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          )}
          {abaAtiva === "investimentos" && (
            <div className="max-w-7xl mx-auto px-6 pb-2 flex items-center gap-1">
              {subItensInvestimento.map(sub => (
                <button key={sub.id} onClick={() => setSubAbaInvestimento(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${subAbaInvestimento === sub.id ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:text-slate-600"}`}>
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          )}
          {abaAtiva === "pessoal" && (
            <div className="max-w-7xl mx-auto px-6 pb-2 flex items-center gap-1">
              {subItensPessoal.map(sub => (
                <button key={sub.id} onClick={() => setSubAbaPessoal(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${subAbaPessoal === sub.id ? "bg-teal-100 text-teal-700" : "text-slate-400 hover:text-slate-600"}`}>
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          )}
        </header>

        <main>
          {abaAtiva === "geral"   && <PainelGeral />}
          {abaAtiva === "empresa" && <ControleEmpresa />}
          {abaAtiva === "imoveis" && subAbaImovel === "apartamento" && <Apartamento />}
          {abaAtiva === "imoveis" && subAbaImovel === "casa"        && <CasaJardimMirante />}
          {abaAtiva === "pessoal" && subAbaPessoal === "resumo"     && <ResumoPessoal />}
          {abaAtiva === "pessoal" && subAbaPessoal === "entradas"   && <EntradasPessoais />}
          {abaAtiva === "pessoal" && subAbaPessoal === "saidas"     && <SaidasPainel />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "acoes"       && <CarteiraInvestimentos />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "consorcios"  && <Consorcios />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "caixinhas"   && <Caixinhas />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "previdencia" && <PrevidenciaPainel />}
        </main>
      </div>
    </PasswordGate>
  );
}