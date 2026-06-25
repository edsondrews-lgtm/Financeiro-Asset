import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";

type Resultado = "pendente" | "green" | "red" | "void";
type Tipo = "simples" | "bonus";

interface Detalhe {
  id: string;
  aposta_id: string;
  esporte: string;
  campeonato: string;
  jogo: string;
  mercado: string;
  selecao: string;
  odd_parcial: number;
}

interface Aposta {
  id: string;
  data: string;
  tipo: Tipo;
  stake_unidades: number | null;
  banca_momento: number | null;
  valor_bonus: number | null;
  lucro_maximo: number | null;
  casa_aposta: string;
  odd_total: number;
  resultado: Resultado;
  lucro_reais: number | null;
  observacao: string | null;
  created_at: string;
  detalhes?: Detalhe[];
}

const BANCA_INICIAL = 1000;

function calcularLucro(a: Aposta): number {
  if (a.resultado === "pendente" || a.resultado === "void") return 0;
  if (a.tipo === "bonus") {
    return a.resultado === "green" ? (a.lucro_maximo ?? 0) : 0;
  }
  const stake = ((a.stake_unidades ?? 1) / 100) * (a.banca_momento ?? BANCA_INICIAL);
  return a.resultado === "green"
    ? parseFloat((stake * (a.odd_total - 1)).toFixed(2))
    : parseFloat((-stake).toFixed(2));
}

function fmtBRL(v: number) {
  return "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function TipsterPainel() {
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"todas" | "simples" | "bonus">("todas");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; resultado: Resultado } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data: ap } = await supabase
      .from("tipster_apostas")
      .select("*")
      .order("data", { ascending: true })
      .order("created_at", { ascending: true });

    const { data: det } = await supabase.from("tipster_apostas_detalhes").select("*");

    const com = (ap ?? []).map((a: Aposta) => ({
      ...a,
      detalhes: (det ?? []).filter((d: Detalhe) => d.aposta_id === a.id),
    }));
    setApostas(com);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvarResultado() {
    if (!editando) return;
    setSalvando(true);
    const aposta = apostas.find(a => a.id === editando.id)!;
    const lucro = calcularLucro({ ...aposta, resultado: editando.resultado });
    await supabase
      .from("tipster_apostas")
      .update({ resultado: editando.resultado, lucro_reais: lucro })
      .eq("id", editando.id);
    setSalvando(false);
    setEditando(null);
    carregar();
  }

  const simples = apostas.filter(a => a.tipo === "simples");
  const resolvidasSimples = simples.filter(a => a.resultado !== "pendente" && a.resultado !== "void");
  const greens = resolvidasSimples.filter(a => a.resultado === "green");
  const reds = resolvidasSimples.filter(a => a.resultado === "red");
  const taxaAcerto = resolvidasSimples.length > 0 ? (greens.length / resolvidasSimples.length * 100) : 0;
  const lucroSimples = resolvidasSimples.reduce((s, a) => s + calcularLucro(a), 0);
  const bancaAtual = BANCA_INICIAL + lucroSimples;
  const yieldPct = ((bancaAtual - BANCA_INICIAL) / BANCA_INICIAL * 100);
  const oddMedia = simples.length > 0 ? simples.reduce((s, a) => s + a.odd_total, 0) / simples.length : 0;

  let sequencia = 0;
  const simplesDesc = [...simples].reverse();
  for (const a of simplesDesc) {
    if (a.resultado === "green") sequencia++;
    else if (a.resultado === "red") break;
  }

  const dadosGrafico = (() => {
    const porData: Record<string, number> = {};
    resolvidasSimples.forEach(a => {
      const d = fmtData(a.data);
      porData[d] = (porData[d] ?? 0) + calcularLucro(a);
    });
    let acum = BANCA_INICIAL;
    return Object.entries(porData).map(([data, lucro]) => {
      acum += lucro;
      return { data, banca: parseFloat(acum.toFixed(2)) };
    });
  })();

  const bonus = apostas.filter(a => a.tipo === "bonus");
  const lucroBonus = bonus.filter(a => a.resultado === "green").reduce((s, a) => s + (a.lucro_maximo ?? 0), 0);
  const pendBonus = bonus.filter(a => a.resultado === "pendente").length;

  const filtradas = [...apostas]
    .filter(a => aba === "todas" || a.tipo === aba)
    .reverse();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>Carregando apostas...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>MASTER</h1>
            {sequencia >= 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#05966920', color: '#10B981' }}>
                {sequencia} em sequencia
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Tipster tracker · banca base R$1.000</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Banca atual</p>
          <p className={`text-2xl font-semibold mt-0.5 ${bancaAtual >= BANCA_INICIAL ? 'text-emerald-500' : 'text-rose-500'}`}>
            {fmtBRL(bancaAtual)}
          </p>
          <p className={`text-xs mt-0.5 ${yieldPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {yieldPct >= 0 ? "+" : ""}{yieldPct.toFixed(1)}% desde o inicio
          </p>
        </div>
      </div>

      {/* Cards metricas */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Apostas", valor: String(apostas.length), sub: `${greens.length}G ${reds.length}R ${apostas.filter(a => a.resultado === "pendente").length}P` },
          { label: "Acerto", valor: `${taxaAcerto.toFixed(0)}%`, sub: `${resolvidasSimples.length} resolvidas`, cor: taxaAcerto >= 55 ? 'text-emerald-500' : taxaAcerto > 0 ? 'text-rose-500' : 'var(--text-primary)' },
          { label: "Yield", valor: `${yieldPct >= 0 ? "+" : ""}${yieldPct.toFixed(1)}%`, sub: `${lucroSimples >= 0 ? "+" : ""}${fmtBRL(lucroSimples)}`, cor: lucroSimples >= 0 ? 'text-emerald-500' : 'text-rose-500' },
          { label: "Sequencia", valor: `${sequencia}`, sub: "greens seguidos", cor: sequencia >= 3 ? 'text-emerald-500' : 'var(--text-primary)' },
          { label: "Odd media", valor: oddMedia.toFixed(2), sub: "apostas simples" },
          { label: "Bonus", valor: fmtBRL(lucroBonus), sub: pendBonus > 0 ? `${pendBonus} pendente${pendBonus > 1 ? "s" : ""}` : "resolvidos", cor: lucroBonus > 0 ? 'text-emerald-500' : 'var(--text-primary)' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
            <p className={`text-lg font-semibold mt-1`} style={{ color: c.cor ?? 'var(--text-primary)' }}>{c.valor}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Grafico */}
      {dadosGrafico.length > 0 && aba !== "bonus" && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Evolucao da banca</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="data" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `R$${v}`} domain={["auto", "auto"]} />
              <Tooltip
                formatter={(v: number) => [fmtBRL(v), "Banca"]}
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="banca" stroke="#3B82F6" strokeWidth={2} dot={{ fill: "#3B82F6", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bonus resumo */}
      {aba !== "simples" && bonus.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Apostas bonus</p>
          <div className="space-y-3">
            {bonus.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.casa_aposta}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Deposito: {fmtBRL(a.valor_bonus ?? 0)} · Max: {fmtBRL(a.lucro_maximo ?? 0)} · @{a.odd_total}
                  </p>
                </div>
                <div className="text-right">
                  <ResultadoBadge resultado={a.resultado} />
                  {a.resultado === "green" && <p className="text-xs text-emerald-500 mt-1">+{fmtBRL(a.lucro_maximo ?? 0)}</p>}
                  {a.resultado === "red" && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>R$0 — sem perda real</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-2">
        {(["todas", "simples", "bonus"] as const).map(t => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={aba === t
              ? { backgroundColor: 'var(--accent)', color: 'white' }
              : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }
            }
          >
            {t === "todas" ? "Todas" : t === "simples" ? "Simples" : "Bonus"}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={carregar} className="px-3 py-1.5 rounded-lg text-sm transition" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
          Atualizar
        </button>
      </div>

      {/* Lista de apostas */}
      <div className="space-y-2">
        {filtradas.length === 0 && (
          <p className="text-center text-sm py-12" style={{ color: 'var(--text-muted)' }}>Nenhuma aposta encontrada.</p>
        )}
        {filtradas.map(aposta => {
          const lucro = calcularLucro(aposta);
          const isExp = expandido === aposta.id;
          const nLegs = aposta.detalhes?.length ?? 0;
          const label = nLegs > 1
            ? `Acumulada ${nLegs}x`
            : aposta.detalhes?.[0]?.jogo ?? "—";

          return (
            <div key={aposta.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>

              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition"
                style={{ backgroundColor: isExp ? 'var(--bg-tertiary)' : 'transparent' }}
                onClick={() => setExpandido(isExp ? null : aposta.id)}
              >
                <span className="text-xs w-10 shrink-0" style={{ color: 'var(--text-muted)' }}>{fmtData(aposta.data)}</span>
                <span className="text-xs font-medium w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>{aposta.casa_aposta}</span>

                {aposta.tipo === "bonus"
                  ? <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>Bonus</span>
                  : <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{aposta.stake_unidades}u</span>
                }

                <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{label}</span>
                <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>@{aposta.odd_total}</span>

                <ResultadoBadge resultado={aposta.resultado} />

                {aposta.resultado !== "pendente" && aposta.resultado !== "void" && (
                  <span className={`text-sm font-semibold shrink-0 ${lucro >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {lucro >= 0 ? "+" : ""}{fmtBRL(lucro)}
                  </span>
                )}

                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isExp ? "▲" : "▼"}</span>
              </div>

              {isExp && (
                <div className="px-4 py-3 space-y-3" style={{ borderTop: '1px solid var(--border-color)' }}>

                  <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {aposta.tipo === "simples" && <>
                      <span>Stake: <span style={{ color: 'var(--text-primary)' }}>{aposta.stake_unidades}u</span></span>
                      <span>Banca: <span style={{ color: 'var(--text-primary)' }}>{fmtBRL(aposta.banca_momento ?? 0)}</span></span>
                      <span>Valor: <span style={{ color: 'var(--text-primary)' }}>{fmtBRL(((aposta.stake_unidades ?? 1) / 100) * (aposta.banca_momento ?? BANCA_INICIAL))}</span></span>
                    </>}
                    {aposta.tipo === "bonus" && <>
                      <span>Deposito: <span style={{ color: 'var(--text-primary)' }}>{fmtBRL(aposta.valor_bonus ?? 0)}</span></span>
                      <span>Lucro max: <span style={{ color: 'var(--text-primary)' }}>{fmtBRL(aposta.lucro_maximo ?? 0)}</span></span>
                      <span style={{ color: '#D97706' }}>Bonus — perda nao conta</span>
                    </>}
                    {aposta.observacao && <span>Obs: <span style={{ color: 'var(--text-primary)' }}>{aposta.observacao}</span></span>}
                  </div>

                  {(aposta.detalhes ?? []).length > 0 && (
                    <div className="space-y-2">
                      {aposta.detalhes!.map(d => (
                        <div key={d.id} className="rounded-lg px-3 py-2.5 flex items-start justify-between gap-3" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.jogo}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {d.esporte} · {d.campeonato}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                              {d.mercado}: <span className="text-blue-500">{d.selecao}</span>
                            </p>
                          </div>
                          <span className="text-sm font-mono shrink-0" style={{ color: 'var(--text-primary)' }}>{d.odd_parcial}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Resultado:</span>
                    {editando?.id === aposta.id ? (
                      <>
                        <select
                          value={editando.resultado}
                          onChange={e => setEditando({ id: aposta.id, resultado: e.target.value as Resultado })}
                          className="text-sm rounded-lg px-3 py-1.5"
                          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="green">Green</option>
                          <option value="red">Red</option>
                          <option value="void">Void</option>
                        </select>
                        <button
                          onClick={salvarResultado}
                          disabled={salvando}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition"
                        >
                          {salvando ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          onClick={() => setEditando(null)}
                          className="px-3 py-1.5 text-sm rounded-lg transition"
                          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditando({ id: aposta.id, resultado: aposta.resultado })}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
                      >
                        Editar
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

function ResultadoBadge({ resultado }: { resultado: Resultado }) {
  const map: Record<Resultado, { label: string; style: React.CSSProperties }> = {
    pendente: { label: "Pendente", style: { backgroundColor: '#FEF3C7', color: '#92400E' } },
    green: { label: "Green", style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
    red: { label: "Red", style: { backgroundColor: '#FEE2E2', color: '#991B1B' } },
    void: { label: "Void", style: { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' } },
  };
  const { label, style } = map[resultado];
  return (
    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0" style={style}>
      {label}
    </span>
  );
}
