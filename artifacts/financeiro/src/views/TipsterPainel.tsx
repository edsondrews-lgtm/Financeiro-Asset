import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell
} from "recharts";

type Resultado = "pendente" | "green" | "red" | "void";
type Tipo = "simples" | "bonus";

interface Detalhe {
  id: string;
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

const BANCA = 1000;

const COR_RESULTADO: Record<Resultado, string> = {
  pendente: "#F59E0B",
  green: "#10B981",
  red: "#EF4444",
  void: "#6B7280",
};

const LABEL_RESULTADO: Record<Resultado, string> = {
  pendente: "Pendente",
  green: "Green",
  red: "Red",
  void: "Void",
};

function calcularLucro(aposta: Aposta): number {
  if (aposta.resultado === "pendente" || aposta.resultado === "void") return 0;
  if (aposta.tipo === "bonus") {
    if (aposta.resultado === "green") return aposta.lucro_maximo ?? aposta.valor_bonus ?? 0;
    return 0;
  }
  const stake = (aposta.stake_unidades ?? 1) * (BANCA / 100);
  if (aposta.resultado === "green") return parseFloat((stake * (aposta.odd_total - 1)).toFixed(2));
  return -stake;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function TipsterPainel() {
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"simples" | "bonus" | "todas">("todas");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; resultado: Resultado } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data: apostasData } = await supabase
      .from("tipster_apostas")
      .select("*")
      .order("data", { ascending: false });

    if (!apostasData) { setLoading(false); return; }

    const { data: detalhesData } = await supabase
      .from("tipster_apostas_detalhes")
      .select("*");

    const apostasComDetalhes = apostasData.map((a: Aposta) => ({
      ...a,
      detalhes: (detalhesData ?? []).filter((d: Detalhe) => d.aposta_id === a.id),
    }));

    setApostas(apostasComDetalhes);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function salvarResultado() {
    if (!editando) return;
    setSalvando(true);

    const aposta = apostas.find(a => a.id === editando.id)!;
    const apostaCom = { ...aposta, resultado: editando.resultado };
    const lucro = calcularLucro(apostaCom);

    await supabase
      .from("tipster_apostas")
      .update({ resultado: editando.resultado, lucro_reais: lucro })
      .eq("id", editando.id);

    setSalvando(false);
    setEditando(null);
    carregar();
  }

  const filtradas = apostas.filter(a => aba === "todas" || a.tipo === aba);

  const resolvidas = filtradas.filter(a => a.resultado !== "pendente" && a.resultado !== "void");
  const greens = resolvidas.filter(a => a.resultado === "green");
  const reds = resolvidas.filter(a => a.resultado === "red");
  const taxaAcerto = resolvidas.length > 0 ? (greens.length / resolvidas.length) * 100 : 0;

  const simplesResolvidas = apostas.filter(a => a.tipo === "simples" && a.resultado !== "pendente" && a.resultado !== "void");
  const lucroSimples = simplesResolvidas.reduce((acc, a) => acc + calcularLucro(a), 0);
  const roiSimples = simplesResolvidas.length > 0 ? (lucroSimples / BANCA) * 100 : 0;

  const bonusResolvidas = apostas.filter(a => a.tipo === "bonus" && a.resultado !== "pendente");
  const lucroBonus = bonusResolvidas.reduce((acc, a) => acc + calcularLucro(a), 0);
  const totalDepositado = apostas.filter(a => a.tipo === "bonus").reduce((acc, a) => acc + (a.valor_bonus ?? 0), 0);

  const dadosGrafico = (() => {
    const porData: Record<string, number> = {};
    simplesResolvidas
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data))
      .forEach(a => {
        const d = fmtData(a.data);
        porData[d] = (porData[d] ?? 0) + calcularLucro(a);
      });
    let acum = 0;
    return Object.entries(porData).map(([data, lucro]) => {
      acum += lucro;
      return { data, lucro: parseFloat(lucro.toFixed(2)), acumulado: parseFloat(acum.toFixed(2)) };
    });
  })();

  if (loading) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
      Carregando apostas...
    </div>
  );

  return (
    <div className="p-10 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tipster Master</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Acompanhamento de apostas e desempenho</p>
        </div>
        <button
          onClick={carregar}
          className="px-4 py-2 rounded-lg text-sm transition border"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
        >
          Atualizar
        </button>
      </div>

      {/* Cards métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total de Apostas" valor={String(apostas.length)} sub={`${greens.length}G ${reds.length}R ${apostas.filter(a=>a.resultado==='pendente').length}P`} />
        <MetricCard label="Taxa de Acerto" valor={`${taxaAcerto.toFixed(1)}%`} sub={`${resolvidas.length} resolvidas`} cor={taxaAcerto >= 55 ? "#10B981" : "#EF4444"} />
        <MetricCard label="ROI (Simples)" valor={`${roiSimples.toFixed(1)}%`} sub={fmtBRL(lucroSimples)} cor={lucroSimples >= 0 ? "#10B981" : "#EF4444"} />
        <MetricCard label="Lucro Bonus" valor={fmtBRL(lucroBonus)} sub={`Depositado: ${fmtBRL(totalDepositado)}`} cor={lucroBonus >= 0 ? "#10B981" : "#EF4444"} />
      </div>

      {/* Abas */}
      <div className="flex gap-2">
        {(["todas", "simples", "bonus"] as const).map(t => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={aba === t
              ? { backgroundColor: 'var(--accent)', color: 'white' }
              : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }
            }
          >
            {t === "todas" ? "Todas" : t === "simples" ? "Simples" : "Bonus"}
          </button>
        ))}
      </div>

      {/* Gráfico lucro acumulado */}
      {(aba === "todas" || aba === "simples") && dadosGrafico.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Lucro Acumulado - Apostas Simples</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="data" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `R$${v}`} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Bar dataKey="lucro" name="Por dia" fill="#6366F1" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bonus: resumo por casa */}
      {(aba === "todas" || aba === "bonus") && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Resumo por Casa (Bonus)</h2>
          <BonusResumo apostas={apostas.filter(a => a.tipo === "bonus")} />
        </div>
      )}

      {/* Lista de apostas */}
      <div className="space-y-3">
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Apostas</h2>
        {filtradas.length === 0 && (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Nenhuma aposta encontrada.</div>
        )}
        {filtradas.map(aposta => (
          <div key={aposta.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>

            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => setExpandido(expandido === aposta.id ? null : aposta.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {fmtData(aposta.data)}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{aposta.casa_aposta}</span>
                {aposta.tipo === "bonus" && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>Bonus</span>
                )}
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {aposta.detalhes && aposta.detalhes.length > 1
                    ? `Acumulada (${aposta.detalhes.length} legs)`
                    : aposta.detalhes?.[0]?.jogo ?? "Simples"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>odd {aposta.odd_total}</span>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: COR_RESULTADO[aposta.resultado] + "22", color: COR_RESULTADO[aposta.resultado] }}
                >
                  {LABEL_RESULTADO[aposta.resultado]}
                </span>
                {aposta.resultado !== "pendente" && (
                  <span className={`text-sm font-bold ${calcularLucro(aposta) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {fmtBRL(calcularLucro(aposta))}
                  </span>
                )}
                <span style={{ color: 'var(--text-muted)' }}>{expandido === aposta.id ? "▲" : "▼"}</span>
              </div>
            </div>

            {expandido === aposta.id && (
              <div className="p-4 space-y-4" style={{ borderTop: '1px solid var(--border-color)' }}>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <InfoItem label="Tipo" valor={aposta.tipo === "bonus" ? "Bonus" : "Simples"} />
                  {aposta.tipo === "simples" && <InfoItem label="Stake" valor={`${aposta.stake_unidades ?? 1}u`} />}
                  {aposta.tipo === "bonus" && <InfoItem label="Deposito" valor={fmtBRL(aposta.valor_bonus ?? 0)} />}
                  {aposta.tipo === "bonus" && <InfoItem label="Lucro max." valor={fmtBRL(aposta.lucro_maximo ?? 0)} />}
                  <InfoItem label="Odd total" valor={String(aposta.odd_total)} />
                  {aposta.observacao && <InfoItem label="Obs." valor={aposta.observacao} />}
                </div>

                {aposta.detalhes && aposta.detalhes.length > 0 && (
                  <div>
                    <p className="text-xs uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Legs</p>
                    <div className="space-y-2">
                      {aposta.detalhes.map(d => (
                        <div key={d.id} className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{d.jogo}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.esporte} · {d.campeonato}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{d.mercado}: <span className="text-blue-500">{d.selecao}</span></p>
                          </div>
                          <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{d.odd_parcial}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Resultado:</p>
                  {editando?.id === aposta.id ? (
                    <>
                      <select
                        className="text-sm rounded-lg px-3 py-1.5"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        value={editando.resultado}
                        onChange={e => setEditando({ id: aposta.id, resultado: e.target.value as Resultado })}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="green">Green</option>
                        <option value="red">Red</option>
                        <option value="void">Void</option>
                      </select>
                      <button
                        onClick={salvarResultado}
                        disabled={salvando}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition disabled:opacity-50"
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
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
                    >
                      Editar resultado
                    </button>
                  )}
                </div>

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, valor, sub, cor }: { label: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: cor ?? 'var(--text-primary)' }}>{valor}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

function InfoItem({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{valor}</p>
    </div>
  );
}

function BonusResumo({ apostas }: { apostas: Aposta[] }) {
  const porCasa: Record<string, { depositado: number; lucro: number; apostas: number }> = {};
  apostas.forEach(a => {
    const casa = a.casa_aposta ?? "Desconhecida";
    if (!porCasa[casa]) porCasa[casa] = { depositado: 0, lucro: 0, apostas: 0 };
    porCasa[casa].depositado += a.valor_bonus ?? 0;
    porCasa[casa].apostas += 1;
    if (a.resultado === "green") porCasa[casa].lucro += a.lucro_maximo ?? a.valor_bonus ?? 0;
  });

  const dados = Object.entries(porCasa).map(([casa, v]) => ({ casa, ...v }));

  if (dados.length === 0) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma aposta bonus registrada.</p>;

  return (
    <div className="space-y-3">
      {dados.map(d => (
        <div key={d.casa} className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{d.casa}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.apostas} aposta{d.apostas !== 1 ? "s" : ""} · Depositado: {fmtBRL(d.depositado)}</p>
          </div>
          <div className="text-right">
            <p className={`font-bold ${d.lucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtBRL(d.lucro)}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>lucro real</p>
          </div>
        </div>
      ))}
    </div>
  );
}
