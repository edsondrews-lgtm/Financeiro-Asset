import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Home,
  TrendingUp,
  Target,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Imovel {
  id: string;
  nome: string;
  descricao: string;
  valor_total: number;
  fgts_reservado: number;
  total_transacoes: number;
  total_investido: number;
  total_entradas: number;
  total_antecipacoes: number;
  total_fgts: number;
  restante: number;
  progresso_pct: number;
}

interface Transacao {
  id: string;
  imovel_id: string;
  data_transacao: string;
  tipo: "entrada" | "antecipacao" | "fgts";
  valor: number;
  origem: string | null;
  destino: string | null;
  detalhes: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const TIPO_CFG = {
  entrada: {
    label: "Entrada",
    dot: "#10B981",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    bar: "#10B981",
  },
  antecipacao: {
    label: "Antecipação",
    dot: "#F59E0B",
    bg: "bg-amber-50",
    text: "text-amber-700",
    bar: "#F59E0B",
  },
  fgts: {
    label: "FGTS",
    dot: "#6366F1",
    bg: "bg-violet-50",
    text: "text-violet-700",
    bar: "#6366F1",
  },
};

const inputCls =
  "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-400 hover:border-slate-300 transition-colors";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct }: { pct: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="#F1F5F9"
        strokeWidth="10"
      />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="url(#prog)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <defs>
        <linearGradient id="prog" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <text
        x="64"
        y="58"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill="#1E293B"
        fontFamily="inherit"
      >
        {pct.toFixed(1)}%
      </text>
      <text
        x="64"
        y="74"
        textAnchor="middle"
        fontSize="9"
        fill="#94A3B8"
        fontFamily="inherit"
        fontWeight="600"
        letterSpacing="1"
      >
        CONQUISTADO
      </text>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CasaJardimMirante() {
  const [imovel, setImovel] = useState<Imovel | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"resumo" | "cronologia">("resumo");

  // modals
  const [modalTransacao, setModalTransacao] = useState(false);
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [form, setForm] = useState({
    data_transacao: new Date().toISOString().split("T")[0],
    tipo: "entrada" as Transacao["tipo"],
    valor: "",
    origem: "",
    destino: "",
    detalhes: "",
  });

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data: resumo } = await supabase
        .from("v_casa_resumo")
        .select("*")
        .single();
      if (resumo) setImovel(resumo as Imovel);

      const { data: trans } = await supabase
        .from("pessoal_casa_transacoes")
        .select("*")
        .order("data_transacao", { ascending: false });
      if (trans) setTransacoes(trans as Transacao[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dados = {
      imovel_id: imovel?.id,
      data_transacao: form.data_transacao,
      tipo: form.tipo,
      valor: Number(form.valor) || 0,
      origem: form.origem || null,
      destino: form.destino || null,
      detalhes: form.detalhes || null,
    };
    if (editando) {
      await supabase
        .from("pessoal_casa_transacoes")
        .update(dados)
        .eq("id", editando.id);
    } else {
      await supabase.from("pessoal_casa_transacoes").insert([dados]);
    }
    fechar();
    carregar();
  }

  async function deletar(id: string) {
    if (!window.confirm("Excluir esta transação?")) return;
    await supabase.from("pessoal_casa_transacoes").delete().eq("id", id);
    carregar();
  }

  function abrirEdicao(t: Transacao) {
    setEditando(t);
    setForm({
      data_transacao: t.data_transacao,
      tipo: t.tipo,
      valor: String(t.valor),
      origem: t.origem ?? "",
      destino: t.destino ?? "",
      detalhes: t.detalhes ?? "",
    });
    setModalTransacao(true);
  }

  function fechar() {
    setModalTransacao(false);
    setEditando(null);
    setForm({
      data_transacao: new Date().toISOString().split("T")[0],
      tipo: "entrada",
      valor: "",
      origem: "",
      destino: "",
      detalhes: "",
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Carregando conquista...
        </div>
      </div>
    );
  }

  const pct = imovel?.progresso_pct ?? 0;
  const restante = imovel?.restante ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-8 md:p-10">
          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
            {/* Left: title + stats */}
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60">
                  <Home size={11} /> Imóvel
                </span>
                {pct >= 100 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                    <Sparkles size={10} /> Conquistado
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none">
                  {imovel?.nome ?? "Casa Jardim Mirante"}
                </h1>
                <p className="text-sm text-white/40 font-medium mt-1">
                  {imovel?.descricao ?? "Uma conquista extraordinária"}
                </p>
              </div>

              {/* Key numbers row */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {[
                  {
                    label: "Valor do imóvel",
                    val: fmtBRL(imovel?.valor_total ?? 0),
                    color: "text-white",
                  },
                  {
                    label: "Já investido",
                    val: fmtBRL(imovel?.total_investido ?? 0),
                    color: "text-emerald-300",
                  },
                  {
                    label: "Ainda faltam",
                    val: fmtBRL(restante > 0 ? restante : 0),
                    color: restante > 0 ? "text-amber-300" : "text-emerald-300",
                  },
                ].map(({ label, val, color }) => (
                  <div
                    key={label}
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                      {label}
                    </p>
                    <p className={`text-lg font-black ${color} leading-none`}>
                      R$ {val}
                    </p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  <span>Progresso</span>
                  <span>{pct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-1000"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: "linear-gradient(90deg, #7C3AED, #10B981)",
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/30 font-medium">
                  {imovel?.total_transacoes ?? 0} transações registradas · FGTS
                  reservado R$ {fmtBRL(imovel?.fgts_reservado ?? 0)}
                </p>
              </div>
            </div>

            {/* Right: ring */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <ProgressRing pct={pct} />
            </div>
          </div>
        </div>

        {/* ── COMPOSIÇÃO ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Entradas estratégicas",
              val: imovel?.total_entradas ?? 0,
              icon: TrendingUp,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              border: "border-emerald-100",
              dot: "#10B981",
            },
            {
              label: "Antecipações",
              val: imovel?.total_antecipacoes ?? 0,
              icon: Target,
              color: "text-amber-600",
              bg: "bg-amber-50",
              border: "border-amber-100",
              dot: "#F59E0B",
            },
            {
              label: "FGTS reservado",
              val: imovel?.fgts_reservado ?? 0,
              icon: Wallet,
              color: "text-violet-600",
              bg: "bg-violet-50",
              border: "border-violet-100",
              dot: "#7C3AED",
            },
          ].map(({ label, val, icon: Icon, color, bg, border, dot }) => (
            <div
              key={label}
              className={`bg-white rounded-2xl border ${border} p-5 flex flex-col gap-3`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}
                >
                  <Icon size={14} className={color} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </span>
              </div>
              <p className="text-2xl font-black text-slate-800 leading-none">
                R$ {fmtBRL(val)}
              </p>
              <div className="w-full h-1 bg-slate-100 rounded-full">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${(val / (imovel?.valor_total || 1)) * 100}%`,
                    background: dot,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── ABAS ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-white border border-slate-200 rounded-full p-0.5">
            {(["resumo", "cronologia"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAba(a)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  aba === a
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {a === "resumo" ? "Resumo" : "Cronologia"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setModalTransacao(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
          >
            <Plus size={13} /> Nova transação
          </button>
        </div>

        {/* ── RESUMO ──────────────────────────────────────────────────────── */}
        {aba === "resumo" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <p className="text-xs font-bold text-slate-700 mb-1">
              Últimas transações
            </p>
            <p className="text-[10px] text-slate-400 font-medium mb-5">
              {transacoes.length} registros no total
            </p>
            <div className="space-y-0 divide-y divide-slate-50">
              {transacoes.slice(0, 6).map((t) => {
                const cfg = TIPO_CFG[t.tipo];
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 py-3 group"
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0`}
                      style={{ background: cfg.dot }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}
                        >
                          {cfg.label}
                        </span>
                        {t.origem && (
                          <span className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1">
                            {t.origem}{" "}
                            <ArrowRight size={10} className="text-slate-300" />{" "}
                            {t.destino}
                          </span>
                        )}
                      </div>
                      {t.detalhes && (
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                          {t.detalhes}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-800">
                        R$ {fmtBRL(t.valor)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {fmtDate(t.data_transacao)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {transacoes.length > 6 && (
              <button
                onClick={() => setAba("cronologia")}
                className="mt-4 w-full text-center text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
              >
                Ver todas as {transacoes.length} transações →
              </button>
            )}
          </div>
        )}

        {/* ── CRONOLOGIA ──────────────────────────────────────────────────── */}
        {aba === "cronologia" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <p className="text-xs font-bold text-slate-700 mb-1">
              Cronologia das conquistas
            </p>
            <p className="text-[10px] text-slate-400 font-medium mb-5">
              {transacoes.length} transações · ordenadas por data
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    {[
                      "Data",
                      "Tipo",
                      "Valor",
                      "Transação",
                      "Detalhes",
                      "Ações",
                    ].map((h) => (
                      <th
                        key={h}
                        className="pb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 pr-4 last:text-right last:pr-0"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transacoes.map((t) => {
                    const cfg = TIPO_CFG[t.tipo];
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50/60 transition-colors group/row"
                      >
                        <td className="py-3 pr-4 text-[11px] text-slate-400 font-medium whitespace-nowrap">
                          {fmtDate(t.data_transacao)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${cfg.bg} ${cfg.text}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm font-black text-slate-800 whitespace-nowrap">
                          R$ {fmtBRL(t.valor)}
                        </td>
                        <td className="py-3 pr-4 text-[11px] font-semibold text-slate-600">
                          {t.origem && (
                            <span className="flex items-center gap-1 flex-wrap">
                              <span className="text-violet-600">
                                {t.origem}
                              </span>
                              <ArrowRight
                                size={10}
                                className="text-slate-300 shrink-0"
                              />
                              <span>{t.destino}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[11px] text-slate-400 max-w-[200px] truncate">
                          {t.detalhes ?? "—"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button
                              onClick={() => abrirEdicao(t)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => deletar(t.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={13} />
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

        {/* ── MODAL ───────────────────────────────────────────────────────── */}
        {modalTransacao && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-5">
              <button
                onClick={fechar}
                className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editando ? "Editar transação" : "Nova transação"}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Casa Jardim Mirante
                </p>
              </div>
              <form onSubmit={salvar} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data">
                    <input
                      required
                      type="date"
                      className={inputCls}
                      value={form.data_transacao}
                      onChange={(e) =>
                        setForm({ ...form, data_transacao: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Tipo">
                    <select
                      className={inputCls}
                      value={form.tipo}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tipo: e.target.value as Transacao["tipo"],
                        })
                      }
                    >
                      <option value="entrada">Entrada</option>
                      <option value="antecipacao">Antecipação</option>
                      <option value="fgts">FGTS</option>
                    </select>
                  </Field>
                </div>
                <Field label="Valor (R$)">
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="0,00"
                    className={inputCls}
                    value={form.valor}
                    onChange={(e) =>
                      setForm({ ...form, valor: e.target.value })
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Origem">
                    <input
                      type="text"
                      placeholder="Ex: Edson Drews"
                      className={inputCls}
                      value={form.origem}
                      onChange={(e) =>
                        setForm({ ...form, origem: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Destino">
                    <input
                      type="text"
                      placeholder="Ex: Rudimar Vivian"
                      className={inputCls}
                      value={form.destino}
                      onChange={(e) =>
                        setForm({ ...form, destino: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Detalhes (opcional)">
                  <input
                    type="text"
                    placeholder="Observações..."
                    className={inputCls}
                    value={form.detalhes}
                    onChange={(e) =>
                      setForm({ ...form, detalhes: e.target.value })
                    }
                  />
                </Field>
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
                >
                  Salvar transação
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
