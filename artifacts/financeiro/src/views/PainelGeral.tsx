import {
  LayoutDashboard, Home, PiggyBank, TrendingUp, ArrowUpRight,
  DollarSign, CreditCard, Building2, Target, Calendar,
  ArrowRight, FileText, Flame,
} from "lucide-react";
import { fmt, MESES_CURTOS, MESES_COMPLETOS, CUBS_ESCRITURA_TOTAL } from "../lib/constants";
import { usePainelGeral } from "../hooks/usePainelGeral";

interface Props {
  mesDash: string;
  anoDash: string;
  setMesDash: (v: string) => void;
  setAnoDash: (v: string) => void;
  setAbaAtiva: (v: string) => void;
  selecionarSubImovel: (sub: string) => void;
  selecionarSubInvestimento: (sub: string) => void;
  selecionarSubPessoal: (sub: string) => void;
  painel: ReturnType<typeof usePainelGeral>;
}

export default function PainelGeral({
  mesDash, anoDash, setMesDash, setAnoDash,
  setAbaAtiva, selecionarSubImovel, selecionarSubInvestimento, selecionarSubPessoal,
  painel,
}: Props) {
  const hoje = new Date();
  const {
    loading,
    notas, totalCaixinhas, listaCaixinhas,
    imovelPago, casaPago, totalConsorcios, saldoPrevidencia, totalAcoes, saldoFGTS, totalBens,
    faturamentoMes, impostoMes, custosMes, lucroEmpresaMes, faturamentoAno,
    entradasDoMes, totalEntradasMes, saidasDoMes, totalSaidasMes, saldoMes,
    patrimonioTotal,
    rankingCats, maxCat,
    progressoImovel, imovelAtualizado,
    escrituraPaga, cubsRestantesEscritura,
    proximaParcelaImovel,
    streakMesesPositivo, streakTotalGuardado,
  } = painel;

  const mensagemStreak =
    streakMesesPositivo === 0 ? "Comece hoje! Feche esse mês no positivo e inicie sua sequência." :
    streakMesesPositivo === 1 ? "Primeiro mês guardando dinheiro! Continue assim pra criar o hábito." :
    streakMesesPositivo <= 3  ? "Você está criando o hábito. Não quebra a sequência!" :
    streakMesesPositivo <= 6  ? "Consistência é tudo — você já provou que consegue." :
    streakMesesPositivo <= 11 ? "Isso já é um estilo de vida. Continue assim!" :
                                 "Mais de um ano guardando dinheiro todo mês. Impressionante!";

  return (
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

        {/* SEQUÊNCIA DE MESES GUARDANDO DINHEIRO */}
        <div className={`rounded-2xl p-5 shadow-sm flex items-center gap-4 ${
          streakMesesPositivo > 0
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
            : "bg-white border border-slate-100 text-slate-700"
        }`}>
          <div className={`p-3 rounded-2xl shrink-0 ${streakMesesPositivo > 0 ? "bg-white/20" : "bg-emerald-50"}`}>
            <Flame size={26} className={streakMesesPositivo > 0 ? "text-white" : "text-emerald-400"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black tabular-nums">{streakMesesPositivo}</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${streakMesesPositivo > 0 ? "text-white/80" : "text-slate-400"}`}>
                {streakMesesPositivo === 1 ? "mês seguido guardando dinheiro" : "meses seguidos guardando dinheiro"}
              </span>
            </div>
            <p className={`text-xs font-semibold mt-0.5 ${streakMesesPositivo > 0 ? "text-white/90" : "text-slate-500"}`}>
              {mensagemStreak}
            </p>
          </div>
          {streakTotalGuardado > 0 && (
            <div className="text-right shrink-0 hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Guardado na sequência</p>
              <p className="text-lg font-black tabular-nums privado">{fmt(streakTotalGuardado)}</p>
            </div>
          )}
        </div>

        {/* PATRIMÔNIO */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 pt-6 pb-5 border-b border-white/5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Patrimônio Total Estimado</p>
            <p className="text-3xl sm:text-4xl md:text-5xl font-black tabular-nums text-white tracking-tight privado">{fmt(patrimonioTotal)}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            {[
              { label: "Apt 810",     valor: imovelPago,       cor: "text-cyan-400",    acao: () => selecionarSubImovel("apartamento") },
              { label: "Casa",        valor: casaPago,         cor: "text-teal-400",    acao: () => selecionarSubImovel("casa") },
              { label: "Consórcio",   valor: totalConsorcios,  cor: "text-violet-400",  acao: () => selecionarSubInvestimento("consorcios") },
              { label: "Caixinhas",   valor: totalCaixinhas,   cor: "text-emerald-400", acao: () => selecionarSubInvestimento("caixinhas") },
              { label: "Previdência", valor: saldoPrevidencia, cor: "text-amber-400",   acao: () => selecionarSubInvestimento("previdencia") },
              { label: "Ações/FIIs",  valor: totalAcoes,       cor: "text-indigo-400",  acao: () => selecionarSubInvestimento("acoes") },
              { label: "FGTS",        valor: saldoFGTS,        cor: "text-orange-400",  acao: () => selecionarSubInvestimento("fgts") },
              { label: "Bens",        valor: totalBens,        cor: "text-rose-400",    acao: () => setAbaAtiva("bens") },
            ].map((item, i) => (
              <button key={i}
                onClick={item.acao}
                className={`group flex flex-col gap-1.5 px-4 py-4 border-r border-white/5 last:border-r-0 text-left transition-colors ${item.acao ? "hover:bg-white/5 cursor-pointer" : "cursor-default"} ${i >= 4 ? "border-t border-white/5" : ""}`}
              >
                <span className={`text-[10px] font-black uppercase tracking-widest ${item.cor} flex items-center gap-1`}>
                  {item.label}
                  {item.acao && <span className="opacity-0 group-hover:opacity-60 transition-opacity text-[8px]">↗</span>}
                </span>
                <span className={`text-sm font-black tabular-nums ${item.valor === 0 ? "text-slate-600" : "text-white"} privado`}>
                  {fmt(item.valor)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* FLUXO DO MÊS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Fluxo Pessoal · {MESES_COMPLETOS[Number(mesDash)-1]} {anoDash}
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entradas</p>
              </div>
              <p className="text-2xl font-black text-emerald-600 tabular-nums privado">{fmt(totalEntradasMes)}</p>
              {entradasDoMes.length === 0
                ? <p className="text-[11px] text-slate-300 mt-2 font-medium">Nenhum lançamento — cadastre em Pessoal → Entradas</p>
                : <p className="text-[11px] text-slate-400 mt-2 font-semibold">{entradasDoMes.length} lançamento{entradasDoMes.length !== 1 ? "s" : ""}</p>}
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-rose-50 rounded-lg"><DollarSign size={14} className="text-rose-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saídas</p>
              </div>
              <p className="text-2xl font-black text-rose-600 tabular-nums privado">{fmt(totalSaidasMes)}</p>
              {saidasDoMes.length === 0
                ? <p className="text-[11px] text-slate-300 mt-2 font-medium">Nenhum gasto registrado</p>
                : <p className="text-[11px] text-slate-400 mt-2 font-semibold">{saidasDoMes.length} gasto{saidasDoMes.length !== 1 ? "s" : ""}</p>}
            </div>
            <div className={`rounded-2xl p-5 shadow-sm border ${saldoMes >= 0 ? "bg-emerald-500 border-emerald-400" : "bg-rose-500 border-rose-400"} text-white`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-white/20 rounded-lg"><Target size={14}/></div>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Saldo do Mês</p>
              </div>
              <p className="text-2xl font-black tabular-nums privado">{fmt(saldoMes)}</p>
              <p className="text-[11px] text-white/70 mt-2 font-semibold">
                {saldoMes >= 0 ? "✓ Mês positivo" : "⚠ Gastos acima das entradas"}
                {totalEntradasMes === 0 && " · cadastre entradas em Pessoal"}
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
                  <span className={`text-xs font-black tabular-nums ${row.color} privado`}>{fmt(row.valor)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-50">
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                <span>Faturamento {anoDash}</span>
                <span className="font-black text-slate-700 tabular-nums privado">{fmt(faturamentoAno)}</span>
              </div>
            </div>
          </div>

          {/* Caixinhas — card simplificado, valor vem do callback com CDI */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg"><PiggyBank size={14} className="text-emerald-600"/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caixinhas</p>
              </div>
              <button onClick={() => selecionarSubInvestimento("caixinhas")} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-700 flex items-center gap-1">Ver <ArrowRight size={10}/></button>
            </div>
            <p className="text-2xl font-black text-emerald-600 tabular-nums privado mb-3">{fmt(totalCaixinhas)}</p>
            {listaCaixinhas.length > 0 ? (
              <div className="space-y-2 border-t border-slate-50 pt-3">
                {(() => {
                  const maxVal = Math.max(...listaCaixinhas.map(c => c.valor_atual), 1);
                  return listaCaixinhas.map((c, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-300 font-bold w-3">{i+1}</span>
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{c.nome}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800 tabular-nums privado">{fmt(c.valor_atual)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full ml-[18px]">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(c.valor_atual / maxVal) * 100}%` }}/>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 font-semibold">Saldo total c/ rendimento CDI</p>
            )}
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
                <span className="text-cyan-700 privado">{fmt(imovelPago)} pago</span>
                <span className="text-cyan-500">{progressoImovel.toFixed(1)}% · valor atual <span className="privado">{fmt(imovelAtualizado)}</span></span>
              </div>
            </div>
            {cubsRestantesEscritura < CUBS_ESCRITURA_TOTAL && (
              <div className="mb-3 p-3 bg-purple-50 rounded-xl">
                <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider mb-1">🏠 Escritura</p>
                <div className="w-full bg-white rounded-full h-1.5 mb-1">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100,((CUBS_ESCRITURA_TOTAL-cubsRestantesEscritura)/CUBS_ESCRITURA_TOTAL)*100).toFixed(1)}%` }}/>
                </div>
                <div className="flex justify-between text-[10px] font-semibold">
                  <span className="text-purple-600 privado">{fmt(escrituraPaga)} pago</span>
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
                <p className="text-base font-black text-indigo-800 tabular-nums privado">{fmt(proximaParcelaImovel.valor)}</p>
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
                          <span className="text-xs font-black text-slate-800 tabular-nums privado">{fmt(val)}</span>
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
}
