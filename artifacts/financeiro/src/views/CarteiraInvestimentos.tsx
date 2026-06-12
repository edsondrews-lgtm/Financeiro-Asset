import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { TrendingUp, TrendingDown, Plus, X, RefreshCw, Wallet, PieChart, AlertTriangle } from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Ativo {
  id: string;
  ticker: string;
  nome: string | null;
  tipo: "FII" | "Ação";
  setor: string | null;
  quantidade: number;
  preco_medio: number;
  data_compra: string;
  notas: string | null;
}

interface AtivoComCotacao extends Ativo {
  preco_atual?: number;
  variacao_dia?: number;
  valor_total?: number;
  lucro_prejuizo?: number;
  rentabilidade?: number;
  carregando_cotacao?: boolean;
  erro_cotacao?: boolean;
}

const formVazio = {
  ticker: "",
  tipo: "FII" as "FII" | "Ação",
  quantidade: "",
  preco_medio: "",
  data_compra: new Date().toISOString().split("T")[0],
  notas: "",
};

const BRAPI_TOKEN = "qLEc2hpsiVZxUfoyMPzq4P";

const CORES = [
  "#6366f1","#10b981","#f59e0b","#3b82f6","#ec4899",
  "#8b5cf6","#14b8a6","#f97316","#06b6d4","#84cc16",
];

export default function CarteiraInvestimentos() {
  const [ativos, setAtivos] = useState<AtivoComCotacao[]>([]);
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [buscandoCotacoes, setBuscandoCotacoes] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"Todos" | "FII" | "Ação">("Todos");

  async function carregarAtivos() {
    const { data, error } = await supabase
      .from("carteira_investimentos")
      .select("*")
      .order("tipo", { ascending: true })
      .order("ticker", { ascending: true });
    if (error) { setErro("Erro ao carregar: " + error.message); return; }
    setAtivos(data || []);
  }

  async function buscarCotacoes(lista: AtivoComCotacao[]) {
    if (lista.length === 0) return;
    setBuscandoCotacoes(true);
    setErro(null);
    setAtivos(prev => prev.map(a => ({ ...a, carregando_cotacao: true, erro_cotacao: false })));

    try {
      // Uma requisição por ticker (múltiplos tickers causam 400 na brapi)
      const respostas = await Promise.all(
        lista.map(a => fetch(`https://brapi.dev/api/quote/${a.ticker}?token=${BRAPI_TOKEN}`).then(r => r.json()))
      );
      const cotacoes: Record<string, any> = {};
      respostas.forEach((json: any) => {
        if (json.results) json.results.forEach((c: any) => { cotacoes[c.symbol] = c; });
      });
      setAtivos(prev => prev.map(ativo => {
        const c = cotacoes[ativo.ticker];
        if (!c) return { ...ativo, carregando_cotacao: false, erro_cotacao: true };
        const preco_atual = c.regularMarketPrice;
        const valor_total = preco_atual * ativo.quantidade;
        const custo_total = ativo.preco_medio * ativo.quantidade;
        const lucro_prejuizo = valor_total - custo_total;
        const rentabilidade = custo_total > 0 ? (lucro_prejuizo / custo_total) * 100 : 0;
        return {
          ...ativo, preco_atual,
          variacao_dia: c.regularMarketChangePercent,
          valor_total, lucro_prejuizo, rentabilidade,
          nome: ativo.nome || c.longName || c.shortName || ativo.ticker,
          carregando_cotacao: false, erro_cotacao: false,
        };
      }));
    } catch (e) {
      setAtivos(prev => prev.map(a => ({ ...a, carregando_cotacao: false, erro_cotacao: true })));
      setErro("Erro ao buscar cotações. Verifique sua conexão.");
    } finally {
      setBuscandoCotacoes(false);
    }
  }

  useEffect(() => { carregarAtivos(); }, []);
  useEffect(() => {
    if (ativos.length > 0 && ativos[0].preco_atual === undefined) buscarCotacoes(ativos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos.length]);

  async function salvarAtivo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setSucesso(null);
    if (!form.ticker || !form.quantidade || !form.preco_medio || !form.data_compra) {
      setErro("Preencha todos os campos obrigatórios."); return;
    }
    setSalvando(true);
    const { error } = await supabase.from("carteira_investimentos").insert({
      ticker: form.ticker.toUpperCase().trim(), tipo: form.tipo,
      quantidade: parseFloat(form.quantidade), preco_medio: parseFloat(form.preco_medio),
      data_compra: form.data_compra, notas: form.notas || null,
    });
    setSalvando(false);
    if (error) { setErro("Erro ao salvar: " + error.message); return; }
    setSucesso(`${form.ticker.toUpperCase()} cadastrado com sucesso!`);
    setForm(formVazio); setMostrarForm(false);
    await carregarAtivos();
    setTimeout(() => setSucesso(null), 4000);
  }

  async function removerAtivo(id: string, ticker: string) {
    if (!confirm(`Remover ${ticker} da carteira?`)) return;
    setRemovendo(id);
    const { error } = await supabase.from("carteira_investimentos").delete().eq("id", id);
    setRemovendo(null);
    if (error) { setErro("Erro ao remover: " + error.message); return; }
    setAtivos(prev => prev.filter(a => a.id !== id));
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  const ativosFiltrados = ativos.filter(a => filtroTipo === "Todos" || a.tipo === filtroTipo);
  const totalInvestido = ativos.reduce((acc, a) => acc + a.preco_medio * a.quantidade, 0);
  const totalAtual = ativos.reduce((acc, a) => acc + (a.valor_total ?? a.preco_medio * a.quantidade), 0);
  const totalLucro = totalAtual - totalInvestido;
  const rentabilidadeTotal = totalInvestido > 0 ? (totalLucro / totalInvestido) * 100 : 0;

  const dadosDistribuicao = ativos
    .filter(a => a.valor_total && a.valor_total > 0)
    .map(a => ({ name: a.ticker, value: parseFloat(a.valor_total!.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  const totalFII = ativos.filter(a => a.tipo === "FII").reduce((acc, a) => acc + (a.valor_total ?? a.preco_medio * a.quantidade), 0);
  const totalAcao = ativos.filter(a => a.tipo === "Ação").reduce((acc, a) => acc + (a.valor_total ?? a.preco_medio * a.quantidade), 0);
  const dadosTipo = [
    { name: "FIIs", value: parseFloat(totalFII.toFixed(2)) },
    { name: "Ações", value: parseFloat(totalAcao.toFixed(2)) },
  ].filter(d => d.value > 0);

  const alertas: string[] = [];
  ativos.forEach(a => {
    if (a.valor_total && totalAtual > 0) {
      const peso = (a.valor_total / totalAtual) * 100;
      if (peso > 30) alertas.push(`${a.ticker} representa ${peso.toFixed(1)}% da carteira — considere diversificar.`);
    }
    if (a.rentabilidade !== undefined && a.rentabilidade < -15)
      alertas.push(`${a.ticker} está com ${fmtPct(a.rentabilidade)} — avalie sua posição.`);
  });
  if (dadosTipo.length === 1)
    alertas.push(`Carteira 100% em ${dadosTipo[0].name}. Considere diversificar entre FIIs e Ações.`);

  return (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-md shadow-emerald-100">
            <Wallet size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Carteira de Investimentos</h2>
            <p className="text-slate-500 text-sm font-medium">Ações e FIIs · cotações em tempo real via brapi.dev</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => buscarCotacoes(ativos)} disabled={buscandoCotacoes || ativos.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40">
            <RefreshCw size={13} className={buscandoCotacoes ? "animate-spin" : ""} />
            Atualizar cotações
          </button>
          <button onClick={() => { setMostrarForm(!mostrarForm); setErro(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-100">
            {mostrarForm ? <><X size={13} /> Fechar</> : <><Plus size={13} /> Adicionar ativo</>}
          </button>
        </div>
      </div>

      {/* Alertas de sistema */}
      {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">{erro}</div>}
      {sucesso && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium">✓ {sucesso}</div>}

      {/* Alertas de investimento */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              {a}
            </div>
          ))}
        </div>
      )}

      {/* Formulário */}
      {mostrarForm && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Novo ativo</h3>
          <form onSubmit={salvarAtivo}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Ticker *</label>
                <input type="text" placeholder="Ex: MXRF11" value={form.ticker}
                  onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as "FII" | "Ação" })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 bg-white">
                  <option value="FII">FII</option>
                  <option value="Ação">Ação</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quantidade *</label>
                <input type="number" placeholder="100" min="0" step="1" value={form.quantidade}
                  onChange={e => setForm({ ...form, quantidade: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Preço médio (R$) *</label>
                <input type="number" placeholder="10.50" min="0" step="0.01" value={form.preco_medio}
                  onChange={e => setForm({ ...form, preco_medio: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data da compra *</label>
                <input type="date" value={form.data_compra}
                  onChange={e => setForm({ ...form, data_compra: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notas</label>
                <input type="text" placeholder="Observações (opcional)" value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={salvando}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                {salvando ? "Salvando..." : "Salvar ativo"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cards resumo */}
      {ativos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Total Investido</span>
              <h3 className="text-2xl font-black text-slate-800">{fmt(totalInvestido)}</h3>
              <span className="text-[10px] text-slate-500 font-medium">Custo de aquisição</span>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Wallet size={20} /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Valor Atual</span>
              <h3 className="text-2xl font-black text-slate-800">{fmt(totalAtual)}</h3>
              <span className="text-[10px] text-slate-500 font-medium">Posição a mercado</span>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <div className={`bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between ${totalLucro >= 0 ? "border-emerald-100" : "border-red-100"}`}>
            <div className="space-y-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Lucro / Prejuízo</span>
              <h3 className={`text-2xl font-black ${totalLucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(totalLucro)}</h3>
              <span className="text-[10px] text-slate-500 font-medium">Resultado acumulado</span>
            </div>
            <div className={`p-3 rounded-xl ${totalLucro >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
              {totalLucro >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Rentabilidade</span>
              <h3 className={`text-2xl font-black ${rentabilidadeTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {fmtPct(rentabilidadeTotal)}
              </h3>
              <span className="text-[10px] text-slate-300 font-medium">Retorno total da carteira</span>
            </div>
            <div className="p-3 bg-white/10 text-emerald-400 rounded-xl"><TrendingUp size={20} /></div>
          </div>
        </div>
      )}

      {/* Gráficos */}
      {ativos.length > 0 && dadosDistribuicao.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><PieChart size={16} /></div>
              <h3 className="text-sm font-bold text-slate-700">Distribuição por Ativo</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <RechartsPie>
                <Pie data={dadosDistribuicao} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {dadosDistribuicao.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-600 font-medium">{v}</span>} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><PieChart size={16} /></div>
              <h3 className="text-sm font-bold text-slate-700">FIIs vs Ações</h3>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <RechartsPie>
                <Pie data={dadosTipo} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={4} dataKey="value">
                  <Cell fill="#6366f1" />
                  <Cell fill="#10b981" />
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconType="circle" iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-600 font-medium">{v}</span>} />
              </RechartsPie>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {ativos
                .filter(a => a.valor_total && a.valor_total > 0)
                .sort((a, b) => (b.valor_total ?? 0) - (a.valor_total ?? 0))
                .map((a, i) => {
                  const peso = totalAtual > 0 ? ((a.valor_total ?? 0) / totalAtual) * 100 : 0;
                  return (
                    <div key={a.id} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CORES[i % CORES.length] }} />
                      <span className="text-xs text-slate-500 w-16 font-bold">{a.ticker}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${peso}%`, backgroundColor: CORES[i % CORES.length] }} />
                      </div>
                      <span className="text-xs text-slate-500 font-medium w-10 text-right">{peso.toFixed(1)}%</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      {ativos.length > 0 && (
        <div className="flex gap-2">
          {(["Todos", "FII", "Ação"] as const).map(f => (
            <button key={f} onClick={() => setFiltroTipo(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filtroTipo === f ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}>{f}</button>
          ))}
        </div>
      )}

      {/* Tabela */}
      {ativosFiltrados.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">📈</p>
          <p className="text-sm font-medium">Nenhum ativo cadastrado ainda.</p>
          <p className="text-xs mt-1 text-slate-300">Clique em "Adicionar ativo" para começar.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="text-left px-6 py-4">Ativo</th>
                  <th className="text-left px-4 py-4">Tipo</th>
                  <th className="text-right px-4 py-4">Qtd</th>
                  <th className="text-right px-4 py-4">P. Médio</th>
                  <th className="text-right px-4 py-4">P. Atual</th>
                  <th className="text-right px-4 py-4">Dia</th>
                  <th className="text-right px-4 py-4">Valor Total</th>
                  <th className="text-right px-4 py-4">Lucro/Prej.</th>
                  <th className="text-right px-4 py-4">Rent.</th>
                  <th className="text-right px-4 py-4">Peso</th>
                  <th className="text-right px-4 py-4">Compra</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ativosFiltrados.map((ativo, i) => {
                  const peso = totalAtual > 0 ? ((ativo.valor_total ?? ativo.preco_medio * ativo.quantidade) / totalAtual) * 100 : 0;
                  return (
                    <tr key={ativo.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CORES[i % CORES.length] }} />
                          <div>
                            <div className="font-black text-slate-800">{ativo.ticker}</div>
                            {ativo.nome && <div className="text-xs text-slate-400 truncate max-w-[140px]">{ativo.nome}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${ativo.tipo === "FII" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                          {ativo.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600 font-medium">{ativo.quantidade.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{fmt(ativo.preco_medio)}</td>
                      <td className="px-4 py-4 text-right">
                        {ativo.carregando_cotacao ? <span className="text-slate-300 text-xs">carregando…</span>
                          : ativo.erro_cotacao ? <span className="text-red-400 text-xs">erro</span>
                          : ativo.preco_atual !== undefined ? <span className="font-bold text-slate-800">{fmt(ativo.preco_atual)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {ativo.variacao_dia !== undefined && !ativo.carregando_cotacao
                          ? <span className={`text-xs font-bold ${ativo.variacao_dia >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtPct(ativo.variacao_dia)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600 font-medium">
                        {ativo.valor_total !== undefined ? fmt(ativo.valor_total) : fmt(ativo.preco_medio * ativo.quantidade)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {ativo.lucro_prejuizo !== undefined
                          ? <span className={`font-bold ${ativo.lucro_prejuizo >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(ativo.lucro_prejuizo)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {ativo.rentabilidade !== undefined
                          ? <span className={`text-xs font-bold ${ativo.rentabilidade >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtPct(ativo.rentabilidade)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`text-xs font-bold ${peso > 30 ? "text-amber-500" : "text-slate-500"}`}>{peso.toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-4 text-right text-slate-400 text-xs">
                        {new Date(ativo.data_compra + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button onClick={() => removerAtivo(ativo.id, ativo.ticker)} disabled={removendo === ativo.id}
                          className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40">
                          {removendo === ativo.id ? "…" : <X size={14} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}