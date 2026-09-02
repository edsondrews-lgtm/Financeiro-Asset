import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  TrendingUp, TrendingDown, Plus, X, RefreshCw, Wallet, PieChart, AlertTriangle,
  History, Landmark, ArrowDownCircle, ArrowUpCircle, DollarSign, Calendar, Clock, Check,
  Pencil, Trash2, Coins,
} from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { buscarCotacoesBrapi } from "../lib/brapi";

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

interface Venda {
  id: string;
  ativo_id: string | null;
  ticker: string;
  nome: string | null;
  tipo: string;
  quantidade_vendida: number;
  preco_medio_compra: number;
  data_compra: string;
  preco_venda: number;
  data_venda: string;
  destino: "corretora" | "saque";
  lucro_prejuizo: number;
}

interface MovimentoCorretora {
  id: string;
  tipo: "deposito" | "saque" | "venda" | "compra" | "provento";
  valor: number;
  descricao: string | null;
  data_movimento: string;
}

interface Provento {
  id: string;
  ativo_id: string | null;
  ticker: string;
  tipo: "dividendo" | "jcp";
  valor: number;
  data_pagamento: string;
  observacao: string | null;
}

interface DadosProvento {
  ticker: string;
  tipo: "dividendo" | "jcp";
  valor: number;
  data_pagamento: string;
  observacao: string | null;
}

function diasEntre(dataInicio: string, dataFim: string): number {
  const ms = new Date(dataFim + "T00:00:00").getTime() - new Date(dataInicio + "T00:00:00").getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

interface Alocacao {
  debito: MovimentoCorretora;
  credito: MovimentoCorretora;
  valor: number;
}

// Rastreia de onde veio o dinheiro de cada compra/saque, sem precisar de nota
// manual: percorre os lançamentos em ordem cronológica e consome primeiro o
// dinheiro mais antigo ainda disponível (FIFO) — o mesmo critério que a
// Receita usa pra apurar custo médio, então também serve de referência pra IR.
function calcularAlocacoesFIFO(movimentos: MovimentoCorretora[]): Alocacao[] {
  const ordenados = [...movimentos].sort((a, b) =>
    a.data_movimento.localeCompare(b.data_movimento) || a.id.localeCompare(b.id));
  const creditos = ordenados.filter(m => Number(m.valor) > 0).map(m => ({ mov: m, restante: Number(m.valor) }));
  const alocacoes: Alocacao[] = [];

  for (const deb of ordenados) {
    if (Number(deb.valor) >= 0) continue;
    let restanteDebito = Math.abs(Number(deb.valor));
    for (const cred of creditos) {
      if (restanteDebito <= 0.005) break;
      if (cred.restante <= 0.005) continue;
      const usado = Math.min(cred.restante, restanteDebito);
      alocacoes.push({ debito: deb, credito: cred.mov, valor: parseFloat(usado.toFixed(2)) });
      cred.restante -= usado;
      restanteDebito -= usado;
    }
  }
  return alocacoes;
}

const formVazio = {
  ticker: "",
  tipo: "FII" as "FII" | "Ação",
  quantidade: "",
  preco_medio: "",
  data_compra: new Date().toISOString().split("T")[0],
  notas: "",
  origem: "novo" as "novo" | "corretora",
};

const CORES = [
  "#6366f1","#10b981","#f59e0b","#3b82f6","#ec4899",
  "#8b5cf6","#14b8a6","#f97316","#06b6d4","#84cc16",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const fmtData = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

// ─── Modal: Vender ativo ───────────────────────────────────────────────────

function ModalVender({ ativo, onFechar, onSalvo }: {
  ativo: AtivoComCotacao;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [quantidade, setQuantidade] = useState(ativo.quantidade.toString());
  const [precoVenda, setPrecoVenda] = useState((ativo.preco_atual ?? ativo.preco_medio).toString());
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split("T")[0]);
  const [destino, setDestino] = useState<"corretora" | "saque">("corretora");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const qtd = parseFloat(quantidade) || 0;
  const preco = parseFloat(precoVenda) || 0;
  const valorTotal = preco * qtd;
  const lucro = (preco - ativo.preco_medio) * qtd;
  const rentabilidade = ativo.preco_medio > 0 ? ((preco - ativo.preco_medio) / ativo.preco_medio) * 100 : 0;

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (qtd <= 0 || qtd > ativo.quantidade) { setErro(`Quantidade deve ser entre 1 e ${ativo.quantidade}.`); return; }
    if (preco <= 0) { setErro("Informe o preço de venda."); return; }
    setSalvando(true); setErro(null);

    const { data: venda, error: errV } = await supabase.from("carteira_vendas").insert({
      ativo_id: ativo.id, ticker: ativo.ticker, nome: ativo.nome, tipo: ativo.tipo,
      quantidade_vendida: qtd, preco_medio_compra: ativo.preco_medio, data_compra: ativo.data_compra,
      preco_venda: preco, data_venda: dataVenda, destino, lucro_prejuizo: parseFloat(lucro.toFixed(2)),
    }).select().single();
    if (errV || !venda) { setErro("Erro ao registrar venda: " + errV?.message); setSalvando(false); return; }

    if (destino === "corretora") {
      const { error: errM } = await supabase.from("carteira_corretora_movimentos").insert({
        tipo: "venda", valor: parseFloat(valorTotal.toFixed(2)), venda_id: venda.id, data_movimento: dataVenda,
        descricao: `Venda de ${qtd} ${ativo.ticker}`,
      });
      if (errM) { setErro("Venda registrada, mas falhou ao creditar na corretora: " + errM.message); setSalvando(false); return; }
    }

    const restante = parseFloat((ativo.quantidade - qtd).toFixed(8));
    if (restante <= 0) {
      await supabase.from("carteira_investimentos").delete().eq("id", ativo.id);
    } else {
      await supabase.from("carteira_investimentos").update({ quantidade: restante }).eq("id", ativo.id);
    }

    setSalvando(false);
    onSalvo();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={confirmar} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Vender {ativo.ticker}</h3>
            <p className="text-xs text-slate-400">Você tem {ativo.quantidade.toLocaleString("pt-BR")} un. · P. médio {fmt(ativo.preco_medio)}</p>
          </div>
          <button type="button" onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quantidade</label>
            <input type="number" min="0" max={ativo.quantidade} step="any" value={quantidade}
              onChange={e => setQuantidade(e.target.value)} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Preço de venda (R$)</label>
            <input type="number" min="0" step="0.01" value={precoVenda}
              onChange={e => setPrecoVenda(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data da venda</label>
          <input type="date" value={dataVenda} onChange={e => setDataVenda(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Esse dinheiro vai...</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDestino("corretora")}
              className={`p-3 rounded-xl border text-left transition-all ${destino === "corretora" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Landmark size={13} /> Ficar na corretora</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Fica guardado pra próxima compra</div>
            </button>
            <button type="button" onClick={() => setDestino("saque")}
              className={`p-3 rounded-xl border text-left transition-all ${destino === "saque" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><ArrowUpCircle size={13} /> Vou sacar</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Sai da carteira, sem lançar em Entradas</div>
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-slate-500">Valor total da venda</span><span className="font-bold text-slate-700">{fmt(valorTotal)}</span></div>
          <div className="flex justify-between">
            <span className="text-slate-500">Lucro/Prejuízo</span>
            <span className={`font-black ${lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(lucro)} ({fmtPct(rentabilidade)})</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
            {salvando ? "Registrando..." : "Confirmar venda"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal: Depositar / Sacar da corretora ─────────────────────────────────

function ModalMovimentoCorretora({ tipo, saldoAtual, onFechar, onSalvo }: {
  tipo: "deposito" | "saque";
  saldoAtual: number;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor);
    if (isNaN(v) || v <= 0) { setErro("Informe um valor válido."); return; }
    if (tipo === "saque" && v > saldoAtual) { setErro(`Saldo insuficiente (disponível: ${fmt(saldoAtual)}).`); return; }
    setSalvando(true); setErro(null);
    const { error } = await supabase.from("carteira_corretora_movimentos").insert({
      tipo, valor: tipo === "saque" ? -v : v, descricao: descricao || null,
    });
    setSalvando(false);
    if (error) { setErro("Erro: " + error.message); return; }
    onSalvo();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">{tipo === "deposito" ? "Depositar na corretora" : "Sacar da corretora"}</h3>
          <button type="button" onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-400">Saldo atual: <span className="font-bold text-slate-600">{fmt(saldoAtual)}</span></p>
        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
          <input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} autoFocus
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição (opcional)</label>
          <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder={tipo === "deposito" ? "Ex: aporte mensal" : "Ex: retirada pra reforma"}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
            {salvando ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal: Detalhe da venda ────────────────────────────────────────────────

function ModalDetalheVenda({ venda, onFechar }: { venda: Venda; onFechar: () => void }) {
  const dias = diasEntre(venda.data_compra, venda.data_venda);
  const valorInvestido = venda.preco_medio_compra * venda.quantidade_vendida;
  const valorVendido = venda.preco_venda * venda.quantidade_vendida;
  const rentabilidade = valorInvestido > 0 ? (venda.lucro_prejuizo / valorInvestido) * 100 : 0;
  const rendimentoDiario = venda.lucro_prejuizo / dias;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-800">{venda.ticker}</h3>
            <p className="text-xs text-slate-400">{venda.nome || venda.tipo} · {venda.quantidade_vendida.toLocaleString("pt-BR")} un.</p>
          </div>
          <button onClick={onFechar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1"><Calendar size={10} /> Compra</div>
            <div className="font-bold text-slate-700 mt-1">{fmtData(venda.data_compra)}</div>
            <div className="text-slate-500 mt-0.5">{fmt(venda.preco_medio_compra)}/un · {fmt(valorInvestido)}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1"><Calendar size={10} /> Venda</div>
            <div className="font-bold text-slate-700 mt-1">{fmtData(venda.data_venda)}</div>
            <div className="text-slate-500 mt-0.5">{fmt(venda.preco_venda)}/un · {fmt(valorVendido)}</div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl text-xs flex items-center gap-2">
          <Clock size={13} className="text-slate-400" />
          <span className="text-slate-500">Ficou <span className="font-bold text-slate-700">{dias} dia{dias !== 1 ? "s" : ""}</span> na carteira</span>
        </div>

        <div className={`p-4 rounded-xl text-center ${venda.lucro_prejuizo >= 0 ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
          <div className={`text-[10px] font-black uppercase tracking-wider ${venda.lucro_prejuizo >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {venda.lucro_prejuizo >= 0 ? "Lucro" : "Prejuízo"} realizado
          </div>
          <div className={`text-2xl font-black ${venda.lucro_prejuizo >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(venda.lucro_prejuizo)}</div>
          <div className="text-xs text-slate-500 mt-1">{fmtPct(rentabilidade)} · média de {fmt(rendimentoDiario)}/dia</div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          {venda.destino === "corretora"
            ? <><Landmark size={12} /> Valor ficou na corretora</>
            : <><ArrowUpCircle size={12} /> Valor foi sacado</>}
        </div>

        <div className="flex justify-end">
          <button onClick={onFechar} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Aba: Histórico de Vendas ────────────────────────────────────────────────

function AbaHistorico({ vendas, onSelecionar }: { vendas: Venda[]; onSelecionar: (v: Venda) => void }) {
  const totalRealizado = vendas.reduce((s, v) => s + v.lucro_prejuizo, 0);
  const vendasLucro = vendas.filter(v => v.lucro_prejuizo >= 0).length;

  if (vendas.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm text-center py-16 text-slate-400">
        <History size={36} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm font-medium">Nenhuma venda registrada ainda.</p>
        <p className="text-xs mt-1 text-slate-300">Quando você vender um ativo, o histórico aparece aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Vendas registradas</span>
          <h3 className="text-2xl font-black text-slate-800 mt-2">{vendas.length}</h3>
          <span className="text-[10px] text-slate-500 font-medium">{vendasLucro} com lucro · {vendas.length - vendasLucro} com prejuízo</span>
        </div>
        <div className={`bg-white p-6 rounded-2xl border shadow-sm ${totalRealizado >= 0 ? "border-emerald-100" : "border-red-100"}`}>
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Resultado realizado</span>
          <h3 className={`text-2xl font-black mt-2 privado ${totalRealizado >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(totalRealizado)}</h3>
          <span className="text-[10px] text-slate-500 font-medium">Soma de todas as vendas</span>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="text-left px-6 py-4">Ativo</th>
                <th className="text-right px-4 py-4">Qtd</th>
                <th className="text-left px-4 py-4">Compra</th>
                <th className="text-left px-4 py-4">Venda</th>
                <th className="text-right px-4 py-4">Lucro/Prej.</th>
                <th className="text-center px-4 py-4">Destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {vendas.map(v => (
                <tr key={v.id} onClick={() => onSelecionar(v)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="font-black text-slate-800">{v.ticker}</div>
                    {v.nome && <div className="text-xs text-slate-400 truncate max-w-[140px]">{v.nome}</div>}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-600 font-medium">{v.quantidade_vendida.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-4 text-xs text-slate-400">{fmtData(v.data_compra)}</td>
                  <td className="px-4 py-4 text-xs text-slate-400">{fmtData(v.data_venda)}</td>
                  <td className="px-4 py-4 text-right">
                    <span className={`font-bold privado ${v.lucro_prejuizo >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(v.lucro_prejuizo)}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {v.destino === "corretora"
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold"><Landmark size={10} /> Corretora</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold"><ArrowUpCircle size={10} /> Sacado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Aba: Origem do Capital ──────────────────────────────────────────────────

function AbaOrigemCapital({ movimentos, onEditar, onExcluir }: {
  movimentos: MovimentoCorretora[];
  onEditar: (m: MovimentoCorretora) => void;
  onExcluir: (m: MovimentoCorretora) => void;
}) {
  const alocacoes = calcularAlocacoesFIFO(movimentos);
  const debitos = movimentos
    .filter(m => Number(m.valor) < 0)
    .sort((a, b) => b.data_movimento.localeCompare(a.data_movimento));

  if (debitos.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm text-center py-16 text-slate-400">
        <Landmark size={36} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm font-medium">Nenhuma compra ou saque usando o saldo da corretora ainda.</p>
        <p className="text-xs mt-1 text-slate-300">Quando você comprar um ativo com o saldo, ou sacar, o rastreio da origem aparece aqui — automático, sem precisar anotar nada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        Calculado automaticamente pela ordem cronológica dos lançamentos: o dinheiro mais antigo parado na corretora é sempre o primeiro a ser usado (FIFO).
      </div>
      {debitos.map(deb => {
        const origens = alocacoes.filter(a => a.debito.id === deb.id);
        const totalDebito = Math.abs(Number(deb.valor));
        return (
          <div key={deb.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${deb.tipo === "compra" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}>
                  {deb.tipo === "compra" ? <Wallet size={14} /> : <ArrowUpCircle size={14} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{deb.descricao || (deb.tipo === "compra" ? "Compra" : "Saque")}</div>
                  <div className="text-[10px] text-slate-400">{fmtData(deb.data_movimento)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-black text-slate-700 privado">{fmt(totalDebito)}</div>
                <button onClick={() => onEditar(deb)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100"><Pencil size={12} /></button>
                <button onClick={() => onExcluir(deb)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"><Trash2 size={12} /></button>
              </div>
            </div>
            {origens.length === 0 ? (
              <p className="text-xs text-slate-300 pl-2">Não foi possível rastrear a origem (saldo de antes do controle começar).</p>
            ) : (
              <div className="space-y-1.5 pl-2 border-l-2 border-slate-100 ml-4">
                {origens.map((o, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      {o.credito.tipo === "venda"
                        ? <DollarSign size={11} className="text-emerald-500 shrink-0" />
                        : <ArrowDownCircle size={11} className="text-blue-400 shrink-0" />}
                      <span>{o.credito.descricao || (o.credito.tipo === "venda" ? "Venda de ativo" : "Depósito")}</span>
                      <span className="text-slate-300">· {fmtData(o.credito.data_movimento)}</span>
                    </div>
                    <span className="font-bold text-slate-600 privado shrink-0">{fmt(o.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal: Editar lançamento (compra/saque) do saldo da corretora ─────────

function ModalEditarMovimento({ movimento, onFechar, onSalvar }: {
  movimento: MovimentoCorretora;
  onFechar: () => void;
  onSalvar: (dados: { valor: number; data_movimento: string; descricao: string | null }) => Promise<{ error: string | null }>;
}) {
  const [valor, setValor] = useState(Math.abs(Number(movimento.valor)).toString());
  const [data, setData] = useState(movimento.data_movimento);
  const [descricao, setDescricao] = useState(movimento.descricao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor);
    if (isNaN(v) || v <= 0) { setErro("Valor inválido."); return; }
    setSalvando(true); setErro(null);
    const res = await onSalvar({ valor: v, data_movimento: data, descricao: descricao.trim() || null });
    setSalvando(false);
    if (res.error) { setErro(res.error); return; }
    onFechar();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Editar {movimento.tipo === "compra" ? "compra" : "saque"}</h3>
          <button type="button" onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-700">
          Isso corrige só o lançamento no saldo da corretora — não altera a posição do ativo em si.
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$)</label>
          <input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)} autoFocus
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
          <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal: Novo / Editar provento ──────────────────────────────────────────

function ModalProvento({ provento, tickers, onFechar, onSalvar }: {
  provento: Provento | null;
  tickers: string[];
  onFechar: () => void;
  onSalvar: (dados: DadosProvento) => Promise<{ error: string | null }>;
}) {
  const [ticker, setTicker] = useState(provento?.ticker ?? "");
  const [tipo, setTipo] = useState<"dividendo" | "jcp">(provento?.tipo ?? "dividendo");
  const [valor, setValor] = useState(provento?.valor.toString() ?? "");
  const [dataPagamento, setDataPagamento] = useState(provento?.data_pagamento ?? new Date().toISOString().split("T")[0]);
  const [observacao, setObservacao] = useState(provento?.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(valor);
    if (!ticker.trim()) { setErro("Informe o ticker."); return; }
    if (isNaN(v) || v <= 0) { setErro("Valor inválido."); return; }
    setSalvando(true); setErro(null);
    const res = await onSalvar({ ticker: ticker.toUpperCase().trim(), tipo, valor: v, data_pagamento: dataPagamento, observacao: observacao.trim() || null });
    setSalvando(false);
    if (res.error) { setErro(res.error); return; }
    onFechar();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={salvar} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">{provento ? "Editar provento" : "Novo provento"}</h3>
          <button type="button" onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">{erro}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Ticker *</label>
            <input type="text" list="tickers-proventos" placeholder="Ex: MXRF11" value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())} autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            <datalist id="tickers-proventos">
              {tickers.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as "dividendo" | "jcp")}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 bg-white">
              <option value="dividendo">Dividendo</option>
              <option value="jcp">JCP</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Valor (R$) *</label>
            <input type="number" min="0" step="0.01" value={valor} onChange={e => setValor(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data pagamento</label>
            <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Observação</label>
          <input type="text" placeholder="Opcional" value={observacao} onChange={e => setObservacao(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-700">
          Esse valor entra automaticamente no Saldo da Corretora.
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Aba: Dividendos e JCP ───────────────────────────────────────────────────

function AbaProventos({ proventos, onNovo, onEditar, onExcluir }: {
  proventos: Provento[];
  onNovo: () => void;
  onEditar: (p: Provento) => void;
  onExcluir: (p: Provento) => void;
}) {
  const totalRecebido = proventos.reduce((s, p) => s + Number(p.valor), 0);
  const totalDividendo = proventos.filter(p => p.tipo === "dividendo").reduce((s, p) => s + Number(p.valor), 0);
  const totalJcp = proventos.filter(p => p.tipo === "jcp").reduce((s, p) => s + Number(p.valor), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onNovo}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-100">
          <Plus size={13} /> Novo provento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Total recebido</span>
          <h3 className="text-2xl font-black text-emerald-600 mt-2 privado">{fmt(totalRecebido)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Dividendos</span>
          <h3 className="text-2xl font-black text-slate-800 mt-2 privado">{fmt(totalDividendo)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">JCP</span>
          <h3 className="text-2xl font-black text-slate-800 mt-2 privado">{fmt(totalJcp)}</h3>
        </div>
      </div>

      {proventos.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm text-center py-16 text-slate-400">
          <Coins size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-medium">Nenhum provento lançado ainda.</p>
          <p className="text-xs mt-1 text-slate-300">Clique em "Novo provento" pra registrar um dividendo ou JCP recebido.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="text-left px-6 py-4">Ativo</th>
                  <th className="text-left px-4 py-4">Tipo</th>
                  <th className="text-left px-4 py-4">Data</th>
                  <th className="text-right px-4 py-4">Valor</th>
                  <th className="text-left px-4 py-4">Observação</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {proventos.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800">{p.ticker}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${p.tipo === "dividendo" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                        {p.tipo === "dividendo" ? "Dividendo" : "JCP"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">{fmtData(p.data_pagamento)}</td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-600 privado">{fmt(p.valor)}</td>
                    <td className="px-4 py-4 text-xs text-slate-400 truncate max-w-[160px]">{p.observacao || "—"}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onEditar(p)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100"><Pencil size={12} /></button>
                        <button onClick={() => onExcluir(p)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CarteiraInvestimentos() {
  const [aba, setAba] = useState<"carteira" | "historico" | "origem" | "proventos">("carteira");
  const [ativos, setAtivos] = useState<AtivoComCotacao[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoCorretora[]>([]);
  const [proventos, setProventos] = useState<Provento[]>([]);
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [buscandoCotacoes, setBuscandoCotacoes] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"Todos" | "FII" | "Ação">("Todos");
  const [ativoVendendo, setAtivoVendendo] = useState<AtivoComCotacao | null>(null);
  const [modalCorretora, setModalCorretora] = useState<"deposito" | "saque" | null>(null);
  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null);
  const [modalProventoAberto, setModalProventoAberto] = useState(false);
  const [proventoEditando, setProventoEditando] = useState<Provento | null>(null);
  const [movimentoEditando, setMovimentoEditando] = useState<MovimentoCorretora | null>(null);

  async function carregarAtivos() {
    const { data, error } = await supabase
      .from("carteira_investimentos")
      .select("*")
      .order("tipo", { ascending: true })
      .order("ticker", { ascending: true });
    if (error) { setErro("Erro ao carregar: " + error.message); return; }
    setAtivos(data || []);
  }

  async function carregarVendas() {
    const { data } = await supabase.from("carteira_vendas").select("*").order("data_venda", { ascending: false });
    setVendas(data || []);
  }

  async function carregarMovimentos() {
    const { data } = await supabase.from("carteira_corretora_movimentos").select("*").order("data_movimento", { ascending: false });
    setMovimentos(data || []);
  }

  async function carregarProventos() {
    const { data } = await supabase.from("carteira_proventos").select("*").order("data_pagamento", { ascending: false });
    setProventos(data || []);
  }

  async function buscarCotacoes(lista: AtivoComCotacao[]) {
    if (lista.length === 0) return;
    setBuscandoCotacoes(true);
    setErro(null);
    setAtivos(prev => prev.map(a => ({ ...a, carregando_cotacao: true, erro_cotacao: false })));

    try {
      const cotacoes = await buscarCotacoesBrapi(lista.map(a => a.ticker));
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

  useEffect(() => { carregarAtivos(); carregarVendas(); carregarMovimentos(); carregarProventos(); }, []);
  useEffect(() => {
    if (ativos.length > 0 && ativos[0].preco_atual === undefined) buscarCotacoes(ativos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativos.length]);

  const saldoCorretora = movimentos.reduce((s, m) => s + Number(m.valor), 0);

  async function salvarAtivo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setSucesso(null);
    if (!form.ticker || !form.quantidade || !form.preco_medio || !form.data_compra) {
      setErro("Preencha todos os campos obrigatórios."); return;
    }
    const custoTotal = parseFloat(form.quantidade) * parseFloat(form.preco_medio);
    if (form.origem === "corretora" && custoTotal > saldoCorretora) {
      setErro(`Saldo da corretora insuficiente (disponível: ${fmt(saldoCorretora)}, necessário: ${fmt(custoTotal)}).`);
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("carteira_investimentos").insert({
      ticker: form.ticker.toUpperCase().trim(), tipo: form.tipo,
      quantidade: parseFloat(form.quantidade), preco_medio: parseFloat(form.preco_medio),
      data_compra: form.data_compra, notas: form.notas || null,
    });
    if (error) { setErro("Erro ao salvar: " + error.message); setSalvando(false); return; }

    if (form.origem === "corretora") {
      await supabase.from("carteira_corretora_movimentos").insert({
        tipo: "compra", valor: -parseFloat(custoTotal.toFixed(2)),
        descricao: `Compra de ${form.quantidade} ${form.ticker.toUpperCase()}`, data_movimento: form.data_compra,
      });
      await carregarMovimentos();
    }

    setSalvando(false);
    setSucesso(`${form.ticker.toUpperCase()} cadastrado com sucesso!`);
    setForm(formVazio); setMostrarForm(false);
    await carregarAtivos();
    setTimeout(() => setSucesso(null), 4000);
  }

  async function removerAtivo(id: string, ticker: string) {
    if (!confirm(`Remover ${ticker} da carteira sem registrar venda?`)) return;
    setRemovendo(id);
    const { error } = await supabase.from("carteira_investimentos").delete().eq("id", id);
    setRemovendo(null);
    if (error) { setErro("Erro ao remover: " + error.message); return; }
    setAtivos(prev => prev.filter(a => a.id !== id));
  }

  async function aoVender() {
    setAtivoVendendo(null);
    await Promise.all([carregarAtivos(), carregarVendas(), carregarMovimentos()]);
    setSucesso("Venda registrada com sucesso!");
    setTimeout(() => setSucesso(null), 4000);
  }

  async function aoMovimentarCorretora() {
    setModalCorretora(null);
    await carregarMovimentos();
  }

  function abrirNovoProvento() { setProventoEditando(null); setModalProventoAberto(true); }
  function abrirEdicaoProvento(p: Provento) { setProventoEditando(p); setModalProventoAberto(true); }

  async function salvarProvento(dados: DadosProvento): Promise<{ error: string | null }> {
    const descricao = `${dados.tipo === "dividendo" ? "Dividendo" : "JCP"} de ${dados.ticker}`;

    if (proventoEditando) {
      const { error } = await supabase.from("carteira_proventos").update(dados).eq("id", proventoEditando.id);
      if (error) return { error: "Erro ao salvar: " + error.message };
      await supabase.from("carteira_corretora_movimentos")
        .update({ valor: dados.valor, data_movimento: dados.data_pagamento, descricao })
        .eq("provento_id", proventoEditando.id);
    } else {
      const { data: novo, error } = await supabase.from("carteira_proventos").insert(dados).select().single();
      if (error || !novo) return { error: "Erro ao salvar: " + error?.message };
      const { error: errM } = await supabase.from("carteira_corretora_movimentos").insert({
        tipo: "provento", valor: dados.valor, provento_id: novo.id, data_movimento: dados.data_pagamento, descricao,
      });
      if (errM) return { error: "Provento salvo, mas falhou ao creditar na corretora: " + errM.message };
    }

    await Promise.all([carregarProventos(), carregarMovimentos()]);
    setSucesso("Provento registrado com sucesso!");
    setTimeout(() => setSucesso(null), 4000);
    return { error: null };
  }

  async function excluirProvento(p: Provento) {
    if (!confirm(`Excluir provento de ${fmt(p.valor)} (${p.ticker})? Isso também remove o valor do saldo da corretora.`)) return;
    await supabase.from("carteira_corretora_movimentos").delete().eq("provento_id", p.id);
    const { error } = await supabase.from("carteira_proventos").delete().eq("id", p.id);
    if (error) { setErro("Erro ao excluir: " + error.message); return; }
    await Promise.all([carregarProventos(), carregarMovimentos()]);
  }

  async function salvarEdicaoMovimento(dados: { valor: number; data_movimento: string; descricao: string | null }): Promise<{ error: string | null }> {
    if (!movimentoEditando) return { error: "Nada selecionado." };
    const valorFinal = Number(movimentoEditando.valor) < 0 ? -dados.valor : dados.valor;
    const { error } = await supabase.from("carteira_corretora_movimentos")
      .update({ valor: valorFinal, data_movimento: dados.data_movimento, descricao: dados.descricao })
      .eq("id", movimentoEditando.id);
    if (error) return { error: error.message };
    await carregarMovimentos();
    return { error: null };
  }

  async function excluirMovimento(m: MovimentoCorretora) {
    if (!confirm(`Excluir este lançamento de ${fmt(Math.abs(Number(m.valor)))}? Isso só ajusta o saldo da corretora, não mexe na posição do ativo.`)) return;
    const { error } = await supabase.from("carteira_corretora_movimentos").delete().eq("id", m.id);
    if (error) { setErro("Erro ao excluir: " + error.message); return; }
    await carregarMovimentos();
  }

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

      {/* Saldo na corretora */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl"><Landmark size={18} /></div>
          <div>
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Saldo na Corretora</span>
            <span className="text-xl font-black text-slate-800 privado">{fmt(saldoCorretora)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalCorretora("deposito")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all">
            <ArrowDownCircle size={13} /> Depositar
          </button>
          <button onClick={() => setModalCorretora("saque")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all">
            <ArrowUpCircle size={13} /> Sacar
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2">
        <button onClick={() => setAba("carteira")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${aba === "carteira" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
          <Wallet size={12} /> Carteira
        </button>
        <button onClick={() => setAba("historico")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${aba === "historico" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
          <History size={12} /> Histórico de Vendas {vendas.length > 0 && `(${vendas.length})`}
        </button>
        <button onClick={() => setAba("origem")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${aba === "origem" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
          <Landmark size={12} /> Origem do Capital
        </button>
        <button onClick={() => setAba("proventos")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${aba === "proventos" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
          <Coins size={12} /> Dividendos e JCP {proventos.length > 0 && `(${proventos.length})`}
        </button>
      </div>

      {/* Alertas de sistema */}
      {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">{erro}</div>}
      {sucesso && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium">✓ {sucesso}</div>}

      {aba === "historico" ? (
        <AbaHistorico vendas={vendas} onSelecionar={setVendaSelecionada} />
      ) : aba === "origem" ? (
        <AbaOrigemCapital movimentos={movimentos} onEditar={setMovimentoEditando} onExcluir={excluirMovimento} />
      ) : aba === "proventos" ? (
        <AbaProventos proventos={proventos} onNovo={abrirNovoProvento} onEditar={abrirEdicaoProvento} onExcluir={excluirProvento} />
      ) : (
      <>
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
                <input type="number" placeholder="10.5000" min="0" step="0.0001" value={form.preco_medio}
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

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">De onde vem o dinheiro?</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm({ ...form, origem: "novo" })}
                  className={`p-3 rounded-xl border text-left transition-all ${form.origem === "novo" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
                  <div className="text-xs font-bold text-slate-700">Dinheiro novo</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">De fora da corretora, sem mexer no saldo</div>
                </button>
                <button type="button" onClick={() => setForm({ ...form, origem: "corretora" })}
                  className={`p-3 rounded-xl border text-left transition-all ${form.origem === "corretora" ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}>
                  <div className="text-xs font-bold text-slate-700">Saldo da corretora</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Disponível: {fmt(saldoCorretora)}</div>
                </button>
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
              <h3 className="text-2xl font-black text-slate-800 privado">{fmt(totalInvestido)}</h3>
              <span className="text-[10px] text-slate-500 font-medium">Custo de aquisição</span>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Wallet size={20} /></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Valor Atual</span>
              <h3 className="text-2xl font-black text-slate-800 privado">{fmt(totalAtual)}</h3>
              <span className="text-[10px] text-slate-500 font-medium">Posição a mercado</span>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><TrendingUp size={20} /></div>
          </div>
          <div className={`bg-white p-6 rounded-2xl border shadow-sm flex items-center justify-between ${totalLucro >= 0 ? "border-emerald-100" : "border-red-100"}`}>
            <div className="space-y-2">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Lucro / Prejuízo</span>
              <h3 className={`text-2xl font-black ${totalLucro >= 0 ? "text-emerald-600" : "text-red-500"} privado`}>{fmt(totalLucro)}</h3>
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
                    <tr key={ativo.id} className="hover:bg-slate-50 transition-colors">
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
                      <td className="px-4 py-4 text-right text-slate-600 privado">{fmt(ativo.preco_medio)}</td>
                      <td className="px-4 py-4 text-right">
                        {ativo.carregando_cotacao ? <span className="text-slate-300 text-xs">carregando…</span>
                          : ativo.erro_cotacao ? <span className="text-red-400 text-xs">erro</span>
                          : ativo.preco_atual !== undefined ? <span className="font-bold text-slate-800 privado">{fmt(ativo.preco_atual)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {ativo.variacao_dia !== undefined && !ativo.carregando_cotacao
                          ? <span className={`text-xs font-bold ${ativo.variacao_dia >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmtPct(ativo.variacao_dia)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600 font-medium privado">
                        {ativo.valor_total !== undefined ? fmt(ativo.valor_total) : fmt(ativo.preco_medio * ativo.quantidade)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {ativo.lucro_prejuizo !== undefined
                          ? <span className={`font-bold ${ativo.lucro_prejuizo >= 0 ? "text-emerald-600" : "text-red-500"} privado`}>{fmt(ativo.lucro_prejuizo)}</span>
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
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setAtivoVendendo(ativo)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold transition-colors">
                            <DollarSign size={11} /> Vender
                          </button>
                          <button onClick={() => removerAtivo(ativo.id, ativo.ticker)} disabled={removendo === ativo.id}
                            title="Excluir sem registrar venda"
                            className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40">
                            {removendo === ativo.id ? "…" : <X size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {ativoVendendo && (
        <ModalVender ativo={ativoVendendo} onFechar={() => setAtivoVendendo(null)} onSalvo={aoVender} />
      )}
      {modalCorretora && (
        <ModalMovimentoCorretora tipo={modalCorretora} saldoAtual={saldoCorretora}
          onFechar={() => setModalCorretora(null)} onSalvo={aoMovimentarCorretora} />
      )}
      {vendaSelecionada && (
        <ModalDetalheVenda venda={vendaSelecionada} onFechar={() => setVendaSelecionada(null)} />
      )}
      {modalProventoAberto && (
        <ModalProvento provento={proventoEditando} tickers={ativos.map(a => a.ticker)}
          onFechar={() => setModalProventoAberto(false)} onSalvar={salvarProvento} />
      )}
      {movimentoEditando && (
        <ModalEditarMovimento movimento={movimentoEditando}
          onFechar={() => setMovimentoEditando(null)} onSalvar={salvarEdicaoMovimento} />
      )}
    </div>
  );
}