import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";

type Resultado = "pendente" | "green" | "red" | "void";
type Tipo = "simples" | "bonus";
type Aba = "resumo" | "simples" | "duplas" | "triplas" | "combinadas" | "bonus";

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

function calcularLucro(a: Aposta, bancaBase?: number): number {
  if (a.resultado === "pendente" || a.resultado === "void") return 0;
  if (a.tipo === "bonus") {
    return a.resultado === "green" ? (a.lucro_maximo ?? 0) : 0;
  }
  // Usa banca acumulada passada como parâmetro; NÃO usa banca_momento do BD
  const banca = bancaBase ?? BANCA_INICIAL;
  const stake = ((a.stake_unidades ?? 1) / 100) * banca;
  return a.resultado === "green"
    ? parseFloat((stake * (a.odd_total - 1)).toFixed(2))
    : parseFloat((-stake).toFixed(2));
}

function fmtBRL(v: number) {
  return "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDataCurta(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDataLonga(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDiaSemana(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

/** Retorna o label correto baseado no nº de legs */
function labelTipo(nLegs: number): string {
  if (nLegs <= 1) return "Simples";
  if (nLegs === 2) return "Dupla";
  if (nLegs === 3) return "Tripla";
  return "Combinada";
}

export default function TipsterPainel() {
  const [apostas, setApostas] = useState<Aposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>("resumo");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; resultado: Resultado } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalRelatorio, setModalRelatorio] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [textoRelatorio, setTextoRelatorio] = useState("");
  const bancaMomentoRef = useRef<Record<string, number>>({});

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
    const bancaBase = bancaMomentoRef.current[aposta.id] ?? BANCA_INICIAL;
    const lucro = calcularLucro({ ...aposta, resultado: editando.resultado }, bancaBase);
    await supabase
      .from("tipster_apostas")
      .update({ resultado: editando.resultado, lucro_reais: lucro })
      .eq("id", editando.id);
    setSalvando(false);
    setEditando(null);
    carregar();
  }

  // ── Separação por tipo de bilhete ──
  const simples = apostas.filter(a => a.tipo === "simples");
  const bonus = apostas.filter(a => a.tipo === "bonus");

  // Categorias por nº de legs
  const simplesUm   = simples.filter(a => (a.detalhes?.length ?? 0) <= 1);
  const simplesDupla = simples.filter(a => (a.detalhes?.length ?? 0) === 2);
  const simplesTripla = simples.filter(a => (a.detalhes?.length ?? 0) === 3);
  const simplesCombinada = simples.filter(a => (a.detalhes?.length ?? 0) >= 4);

  // ── Cálculo de banca acumulada (sempre parte de 1000) ──
  // Processa apostas simples em ordem cronológica, acumulando a banca
  const simplesOrdenadas = [...simples].sort((a, b) =>
    a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at)
  );

  // Mapa aposta.id -> banca no momento da aposta (calculada por acúmulo)
  const bancaMomentoCalc: Record<string, number> = {};
  let bancaAcum = BANCA_INICIAL;
  for (const a of simplesOrdenadas) {
    bancaMomentoCalc[a.id] = bancaAcum;
    if (a.resultado !== "pendente" && a.resultado !== "void") {
      bancaAcum = parseFloat((bancaAcum + calcularLucro(a, bancaAcum)).toFixed(2));
    }
  }
  const bancaAtual = bancaAcum;
  bancaMomentoRef.current = bancaMomentoCalc;

  // Helper: lucro com banca calculada
  function lucroCalc(a: Aposta): number {
    return calcularLucro(a, bancaMomentoCalc[a.id]);
  }

  const resolvidasSimples = simples.filter(a => a.resultado !== "pendente" && a.resultado !== "void");
  const greens = resolvidasSimples.filter(a => a.resultado === "green");
  const reds = resolvidasSimples.filter(a => a.resultado === "red");
  const pendentes = apostas.filter(a => a.resultado === "pendente");
  const taxaAcerto = resolvidasSimples.length > 0 ? (greens.length / resolvidasSimples.length * 100) : 0;
  const lucroSimples = resolvidasSimples.reduce((s, a) => s + lucroCalc(a), 0);
  const yieldPct = ((bancaAtual - BANCA_INICIAL) / BANCA_INICIAL * 100);
  const oddMedia = simples.length > 0 ? simples.reduce((s, a) => s + a.odd_total, 0) / simples.length : 0;

  // ROI em unidades
  const unidadesInvestidas = resolvidasSimples.reduce((s, a) => s + (a.stake_unidades ?? 0), 0);
  const unidadesLucro = resolvidasSimples.reduce((s, a) => {
    const stake = a.stake_unidades ?? 1;
    if (a.resultado === "green") return s + stake * (a.odd_total - 1);
    return s - stake;
  }, 0);
  const roiUnidades = unidadesInvestidas > 0 ? (unidadesLucro / unidadesInvestidas * 100) : 0;

  // Sequência atual
  let sequencia = 0;
  let tipoSeq: "green" | "red" | null = null;
  const simplesDesc = [...simplesOrdenadas].reverse();
  for (const a of simplesDesc) {
    if (a.resultado === "pendente" || a.resultado === "void") continue;
    if (tipoSeq === null) tipoSeq = a.resultado as "green" | "red";
    if (a.resultado === tipoSeq) sequencia++;
    else break;
  }

  // Melhor sequência de greens
  let melhorSeq = 0, seqTemp = 0;
  for (const a of simplesOrdenadas) {
    if (a.resultado === "green") { seqTemp++; melhorSeq = Math.max(melhorSeq, seqTemp); }
    else if (a.resultado === "red") seqTemp = 0;
  }

  // Drawdown máximo
  let peakBanca2 = BANCA_INICIAL, maxDrawdown = 0;
  let acumDD = BANCA_INICIAL;
  for (const a of resolvidasSimples) {
    acumDD = parseFloat((acumDD + lucroCalc(a)).toFixed(2));
    if (acumDD > peakBanca2) peakBanca2 = acumDD;
    const dd = ((peakBanca2 - acumDD) / peakBanca2) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Lucro por casa
  const lucroPorCasa: Record<string, { lucro: number; count: number; greens: number }> = {};
  resolvidasSimples.forEach(a => {
    const casa = a.casa_aposta;
    if (!lucroPorCasa[casa]) lucroPorCasa[casa] = { lucro: 0, count: 0, greens: 0 };
    lucroPorCasa[casa].lucro += lucroCalc(a);
    lucroPorCasa[casa].count++;
    if (a.resultado === "green") lucroPorCasa[casa].greens++;
  });
  const topCasas = Object.entries(lucroPorCasa)
    .sort((a, b) => b[1].lucro - a[1].lucro)
    .slice(0, 4);

  // ── Gráfico ──
  const dadosGrafico = (() => {
    if (simplesOrdenadas.length === 0) return [];
    const primeiraData = simplesOrdenadas[0].data;
    const porData: Record<string, number> = {};
    resolvidasSimples.forEach(a => {
      porData[a.data] = (porData[a.data] ?? 0) + lucroCalc(a);
    });
    const resultado: { data: string; banca: number; lucro: number }[] = [];
    let acum = BANCA_INICIAL;
    resultado.push({ data: fmtDataCurta(primeiraData), banca: acum, lucro: 0 });
    const datasUnicas = Object.keys(porData).sort();
    for (const d of datasUnicas) {
      const l = porData[d];
      acum = parseFloat((acum + l).toFixed(2));
      resultado.push({ data: fmtDataCurta(d), banca: acum, lucro: l });
    }
    return resultado;
  })();

  // ── Métricas bônus ──
  const lucroBonus = bonus.filter(a => a.resultado === "green").reduce((s, a) => s + (a.lucro_maximo ?? 0), 0);
  const pendBonus = bonus.filter(a => a.resultado === "pendente").length;
  const greenBonus = bonus.filter(a => a.resultado === "green").length;
  const redBonus = bonus.filter(a => a.resultado === "red").length;

  // ── Listas ──
  const listaSimples = [...simplesOrdenadas].reverse();
  const listaBonus = [...bonus].reverse();
  const isLucroPos = bancaAtual >= BANCA_INICIAL;

  // ── Gerar relatório Gemini ──
  async function gerarRelatorio() {
    setGerandoRelatorio(true);
    setTextoRelatorio("");
    setModalRelatorio(true);

    const dadosParaAPI = {
      dataInicio: simplesOrdenadas[0]?.data ?? null,
      dataAtual: new Date().toISOString().split("T")[0],
      bancaInicial: BANCA_INICIAL,
      bancaAtual,
      yieldPct: yieldPct.toFixed(2),
      roiUnidades: roiUnidades.toFixed(1),
      totalApostas: apostas.length,
      totalSimples: simples.length,
      resolvidasSimples: resolvidasSimples.length,
      greens: greens.length,
      reds: reds.length,
      pendentes: pendentes.length,
      taxaAcerto: taxaAcerto.toFixed(1),
      oddMedia: oddMedia.toFixed(2),
      melhorSequencia: melhorSeq,
      sequenciaAtual: sequencia,
      tipoSequenciaAtual: tipoSeq,
      maxDrawdown: maxDrawdown.toFixed(1),
      totalBonus: bonus.length,
      greenBonus,
      redBonus,
      pendBonus,
      lucroBonus: lucroBonus.toFixed(2),
      casasBonus: [...new Set(bonus.map(a => a.casa_aposta))],
      lucroPorCasa: topCasas.map(([casa, d]) => ({
        casa, lucro: d.lucro.toFixed(2), apostas: d.count, greens: d.greens,
        acerto: d.count > 0 ? ((d.greens / d.count) * 100).toFixed(1) : "0"
      })),
      distribuicaoPorTipo: {
        simples: simplesUm.length,
        duplas: simplesDupla.length,
        triplas: simplesTripla.length,
        combinadas: simplesCombinada.length,
      }
    };

    const prompt = `Você é um analista especializado em apostas esportivas.
Gere um relatório narrativo profissional em português brasileiro
sobre o desempenho do tipster Master com base nos dados abaixo.

DADOS:
${JSON.stringify(dadosParaAPI, null, 2)}

ESTRUTURA (blocos separados por linha em branco):

INÍCIO DO ACOMPANHAMENTO: Quando foi iniciado, banca inicial,
período coberto até hoje.

DESEMPENHO GERAL: Total de apostas, taxa de acerto, yield%,
ROI em unidades, lucro na banca. Tom analítico e preciso.

GESTÃO DE RISCO: Drawdown máximo e o que significa, sequência
atual, melhor sequência histórica. Se a banca está segura.

BÔNUS CAPTURADOS: Quantos tentados, em quais casas, convertidos
vs perdidos, valor capturado. Explicar que bônus perdido não é
perda real pois o capital é da casa.

PERFORMANCE POR CASA: Qual casa performou melhor, acerto e
lucro por casa.

DISTRIBUIÇÃO DE APOSTAS: Quantas simples, duplas, triplas,
combinadas. Comentar estratégia do tipster.

CONCLUSÃO: Avaliação geral. Se vale continuar seguindo,
pontos de atenção, perspectivas para os próximos períodos.

REGRAS:
- Sem asteriscos, sem markdown, texto corrido com parágrafos
- Cada bloco começa com título em MAIÚSCULAS seguido de dois pontos
- Use os números reais dos dados
- Se dataInicio for null, dizer que o histórico está sendo construído
- Tom profissional mas acessível, como comentarista esportivo analítico`;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setTextoRelatorio("Chave da API Gemini nao configurada. Adicione VITE_GEMINI_API_KEY no arquivo .env e reinicie o servidor.");
        setGerandoRelatorio(false);
        return;
      }

      const body = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error?.message || `Erro HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
      setTextoRelatorio(texto || "Nenhum texto retornado pela API.");
    } catch (err: any) {
      console.error(err);
      setTextoRelatorio(`Erro ao gerar relatorio: ${err.message || "Verifique sua chave Gemini no .env"}`);
    } finally {
      setGerandoRelatorio(false);
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--border-color)", borderTopColor: "#3B82F6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando apostas...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── HERO HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)",
        borderRadius: 22, padding: "32px 36px", marginBottom: 22,
        border: "1px solid #1E293B", position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 260, height: 260, borderRadius: "50%",
          background: isLucroPos
            ? "radial-gradient(circle, #10B98135, transparent 70%)"
            : "radial-gradient(circle, #F4363635, transparent 70%)",
          pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute", bottom: -60, left: 100,
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, #3B82F615, transparent 70%)",
          pointerEvents: "none"
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: "#475569", textTransform: "uppercase" }}>Tipster</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#334155" }} />
              <span style={{ fontSize: 11, color: "#475569" }}>banca base {fmtBRL(BANCA_INICIAL)}</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: "#F1F5F9", letterSpacing: -1, margin: "0 0 4px" }}>
              Master Tipster
            </h1>
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
              {apostas.length} bilhetes registrados · {resolvidasSimples.length} resolvidos
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {sequencia >= 2 && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 14px", borderRadius: 100,
                  background: tipoSeq === "green" ? "#10B98115" : "#F4363615",
                  border: `1px solid ${tipoSeq === "green" ? "#10B98140" : "#F4363640"}`
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: tipoSeq === "green" ? "#10B981" : "#F43636", boxShadow: `0 0 6px ${tipoSeq === "green" ? "#10B981" : "#F43636"}` }} />
                  <span style={{ fontSize: 12, color: tipoSeq === "green" ? "#10B981" : "#F43636", fontWeight: 700 }}>
                    {sequencia} {tipoSeq === "green" ? "greens" : "reds"} seguidos
                  </span>
                </div>
              )}
              {maxDrawdown > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 100, background: "#F8717115", border: "1px solid #F8717130" }}>
                  <span style={{ fontSize: 12, color: "#F87171", fontWeight: 600 }}>Drawdown máx: {maxDrawdown.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Banca atual</p>
            <p style={{ fontSize: 42, fontWeight: 800, margin: 0, color: isLucroPos ? "#10B981" : "#F87171", letterSpacing: -2 }}>
              {fmtBRL(bancaAtual)}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <span style={{
                fontSize: 13, fontWeight: 700, padding: "4px 14px", borderRadius: 100,
                background: isLucroPos ? "#10B98120" : "#F4363620",
                color: isLucroPos ? "#10B981" : "#F87171",
                border: `1px solid ${isLucroPos ? "#10B98140" : "#F4363640"}`
              }}>
                {yieldPct >= 0 ? "+" : ""}{yieldPct.toFixed(2)}% yield
              </span>
              <span style={{ fontSize: 13, padding: "4px 14px", borderRadius: 100, background: "#1E293B", color: "#64748B", border: "1px solid #334155" }}>
                ROI {roiUnidades >= 0 ? "+" : ""}{roiUnidades.toFixed(1)}u
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARDS MÉTRICAS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 }}>
        {[
          { label: "Apostas", valor: String(apostas.length), detalhe: `${greens.length}G · ${reds.length}R · ${pendentes.length}P`, cor: "var(--text-primary)" },
          { label: "Taxa de acerto", valor: `${taxaAcerto.toFixed(1)}%`, detalhe: `${resolvidasSimples.length} resolvidas`, cor: taxaAcerto >= 55 ? "#10B981" : taxaAcerto > 0 ? "#F87171" : "var(--text-primary)" },
          { label: "Yield total", valor: `${yieldPct >= 0 ? "+" : ""}${yieldPct.toFixed(1)}%`, detalhe: `${lucroSimples >= 0 ? "+" : ""}${fmtBRL(lucroSimples)}`, cor: lucroSimples >= 0 ? "#10B981" : "#F87171" },
          { label: "Odd média", valor: oddMedia.toFixed(2), detalhe: "apostas simples", cor: "var(--text-primary)" },
          { label: "Melhor sequência", valor: `${melhorSeq}G`, detalhe: "greens consecutivos", cor: melhorSeq >= 5 ? "#F59E0B" : "var(--text-primary)" },
          { label: "Max drawdown", valor: `${maxDrawdown.toFixed(1)}%`, detalhe: "maior queda da banca", cor: maxDrawdown > 10 ? "#F87171" : "var(--text-primary)" },
          { label: "Bônus capturado", valor: fmtBRL(lucroBonus), detalhe: pendBonus > 0 ? `${pendBonus} pendente${pendBonus > 1 ? "s" : ""}` : `${greenBonus}G · ${redBonus}R`, cor: lucroBonus > 0 ? "#10B981" : "var(--text-primary)" },
        ].map(c => (
          <div key={c.label} style={{ borderRadius: 16, padding: "16px 18px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-muted)", margin: "0 0 10px" }}>{c.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: c.cor, margin: "0 0 4px", letterSpacing: -0.5 }}>{c.valor}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{c.detalhe}</p>
          </div>
        ))}
      </div>

      {/* ── ABAS ── */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border-color)", marginBottom: 20, flexWrap: "wrap" }}>
        {([
          { key: "resumo",     label: "Resumo" },
          { key: "simples",    label: `Simples (${simplesUm.length})` },
          { key: "duplas",     label: `Duplas (${simplesDupla.length})` },
          { key: "triplas",    label: `Triplas (${simplesTripla.length})` },
          { key: "combinadas", label: `Combinadas (${simplesCombinada.length})` },
          { key: "bonus",      label: `Bônus (${bonus.length})` },
        ] as { key: Aba; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setAba(t.key)} style={{
            padding: "10px 16px", fontSize: 13, fontWeight: 700, border: "none",
            background: "transparent", cursor: "pointer",
            borderBottom: aba === t.key ? "2px solid #3B82F6" : "2px solid transparent",
            color: aba === t.key ? "#3B82F6" : "var(--text-muted)",
            transition: "all 0.15s", marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8, alignSelf: "center" }}>
          <button onClick={gerarRelatorio} style={{
            padding: "7px 16px", fontSize: 12, borderRadius: 8, cursor: "pointer",
            backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)",
            border: "1px solid var(--border-color)", fontWeight: 600
          }}>
            Gerar Relatorio
          </button>
          <button onClick={carregar} style={{
            padding: "7px 16px", fontSize: 12, borderRadius: 8, cursor: "pointer",
            backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)",
            border: "1px solid var(--border-color)", fontWeight: 600
          }}>
            Atualizar
          </button>
        </div>
      </div>

      {/* ── ABA RESUMO ── */}
      {aba === "resumo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Gráfico */}
          {dadosGrafico.length > 1 && (
            <div style={{ borderRadius: 18, padding: "22px 18px 14px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-muted)", margin: "0 0 18px" }}>Evolução da banca</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dadosGrafico}>
                  <defs>
                    <linearGradient id="bancaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isLucroPos ? "#10B981" : "#F87171"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={isLucroPos ? "#10B981" : "#F87171"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="data" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={v => `R$${v}`} domain={["auto", "auto"]} axisLine={false} tickLine={false} width={76} />
                  <ReferenceLine y={BANCA_INICIAL} stroke="#334155" strokeDasharray="4 4" label={{ value: "Início", fill: "#475569", fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: number) => [fmtBRL(v), "Banca"]}
                    contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="banca" stroke={isLucroPos ? "#10B981" : "#F87171"} strokeWidth={2.5} fill="url(#bancaGrad)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 2 colunas: distribuição + performance por casa */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Distribuição */}
            <div style={{ borderRadius: 18, padding: "20px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-muted)", margin: "0 0 16px" }}>Distribuição (simples)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Green", count: greens.length, total: resolvidasSimples.length, cor: "#10B981" },
                  { label: "Red", count: reds.length, total: resolvidasSimples.length, cor: "#F87171" },
                  { label: "Pendente", count: simples.filter(a => a.resultado === "pendente").length, total: simples.length, cor: "#F59E0B" },
                ].map(r => {
                  const pct = r.total > 0 ? (r.count / r.total * 100) : 0;
                  return (
                    <div key={r.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{r.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: r.cor }}>{r.count} · {pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, backgroundColor: "var(--border-color)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, backgroundColor: r.cor, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance por casa */}
            <div style={{ borderRadius: 18, padding: "20px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-muted)", margin: "0 0 16px" }}>Performance por casa</p>
              {topCasas.length === 0
                ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sem dados ainda.</p>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {topCasas.map(([casa, d]) => (
                      <div key={casa} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{casa}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{d.count} apostas · {d.count > 0 ? ((d.greens / d.count) * 100).toFixed(0) : 0}% acerto</p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: d.lucro >= 0 ? "#10B981" : "#F87171" }}>
                          {d.lucro >= 0 ? "+" : ""}{fmtBRL(d.lucro)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          {/* Bônus resumo + últimas apostas */}
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
            <div style={{ borderRadius: 18, padding: "20px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-muted)", margin: "0 0 16px" }}>Bônus</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Lucro total", valor: fmtBRL(lucroBonus), cor: lucroBonus > 0 ? "#10B981" : "var(--text-primary)" },
                  { label: "Convertidos", valor: `${greenBonus}`, cor: "#10B981" },
                  { label: "Perdidos (sem risco)", valor: `${redBonus}`, cor: "#F87171" },
                  { label: "Pendentes", valor: `${pendBonus}`, cor: "#F59E0B" },
                ].map(i => (
                  <div key={i.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{i.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: i.cor }}>{i.valor}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: 18, padding: "20px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-muted)", margin: "0 0 14px" }}>Últimas apostas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {listaSimples.slice(0, 6).map(a => {
                  const lucro = lucroCalc(a);
                  const nLegs = a.detalhes?.length ?? 0;
                  const label = nLegs > 1 ? `${labelTipo(nLegs)} · ${a.detalhes![0]?.jogo}...` : a.detalhes?.[0]?.jogo ?? "—";
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, backgroundColor: "var(--bg-tertiary, #0F172A10)", border: "1px solid var(--border-color)" }}>
                      <div style={{ textAlign: "center", minWidth: 40 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{fmtDataCurta(a.data)}</p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{fmtDiaSemana(a.data)}</p>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{a.casa_aposta} · @{a.odd_total}</p>
                      </div>
                      <ResultadoBadge resultado={a.resultado} />
                      {a.resultado !== "pendente" && a.resultado !== "void" && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: lucro >= 0 ? "#10B981" : "#F87171", minWidth: 72, textAlign: "right" }}>
                          {lucro >= 0 ? "+" : ""}{fmtBRL(lucro)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ABAS DE BILHETES ── */}
      {(["simples", "duplas", "triplas", "combinadas"] as Aba[]).includes(aba) && (() => {
        const mapa: Record<string, Aposta[]> = {
          simples:    [...simplesUm].reverse(),
          duplas:     [...simplesDupla].reverse(),
          triplas:    [...simplesTripla].reverse(),
          combinadas: [...simplesCombinada].reverse(),
        };
        const lista = mapa[aba] ?? [];
        const nomeSingular: Record<string, string> = { simples: "simples", duplas: "dupla", triplas: "tripla", combinadas: "combinada" };
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lista.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px 0", fontSize: 14 }}>
                Nenhuma aposta {nomeSingular[aba]} ainda.
              </p>
            )}
            {lista.map(aposta => (
              <CardAposta key={aposta.id} aposta={aposta} bancaMomentoCalc={bancaMomentoCalc}
                expandido={expandido} setExpandido={setExpandido}
                editando={editando} setEditando={setEditando} salvarResultado={salvarResultado} salvando={salvando} />
            ))}
          </div>
        );
      })()}

      {/* ── ABA BÔNUS ── */}
      {aba === "bonus" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {listaBonus.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px 0", fontSize: 14 }}>Nenhuma aposta bônus ainda.</p>
          )}
          {listaBonus.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 6 }}>
              {[
                { label: "Total", valor: String(bonus.length), cor: "var(--text-primary)" },
                { label: "Convertidos", valor: String(greenBonus), cor: "#10B981" },
                { label: "Perdidos", valor: String(redBonus), cor: "#F87171" },
                { label: "Lucro total", valor: fmtBRL(lucroBonus), cor: lucroBonus > 0 ? "#10B981" : "var(--text-primary)" },
              ].map(c => (
                <div key={c.label} style={{ borderRadius: 14, padding: "14px 16px", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text-muted)", margin: "0 0 6px" }}>{c.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: c.cor, margin: 0 }}>{c.valor}</p>
                </div>
              ))}
            </div>
          )}
          {listaBonus.map(aposta => (
            <CardAposta key={aposta.id} aposta={aposta} bancaMomentoCalc={{}}
              expandido={expandido} setExpandido={setExpandido}
              editando={editando} setEditando={setEditando} salvarResultado={salvarResultado} salvando={salvando} />
          ))}
        </div>
      )}

    </div>
  );
}

// ── Card individual ──
function CardAposta({ aposta, bancaMomentoCalc, expandido, setExpandido, editando, setEditando, salvarResultado, salvando }: {
  aposta: Aposta;
  bancaMomentoCalc?: Record<string, number>;
  expandido: string | null;
  setExpandido: (id: string | null) => void;
  editando: { id: string; resultado: Resultado } | null;
  setEditando: (v: { id: string; resultado: Resultado } | null) => void;
  salvarResultado: () => void;
  salvando: boolean;
}) {
  const lucro = calcularLucro(aposta, bancaMomentoCalc?.[aposta.id]);
  const isExp = expandido === aposta.id;
  const nLegs = aposta.detalhes?.length ?? 0;
  const tipoLabel = labelTipo(nLegs);
  // Label principal: nome do jogo (simples/dupla) ou "Dupla · Jogo1 + Jogo2" etc
  const labelPrincipal = nLegs <= 1
    ? (aposta.detalhes?.[0]?.jogo ?? "—")
    : nLegs === 2
      ? `${aposta.detalhes![0]?.jogo} + ${aposta.detalhes![1]?.jogo}`
      : `${tipoLabel} ${nLegs} jogos`;

  const isBonus = aposta.tipo === "bonus";
  const stakeValor = isBonus
    ? (aposta.valor_bonus ?? 0)
    : ((aposta.stake_unidades ?? 1) / 100) * (aposta.banca_momento ?? BANCA_INICIAL);

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
      {/* Linha principal */}
      <div
        onClick={() => setExpandido(isExp ? null : aposta.id)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer", backgroundColor: isExp ? "var(--bg-tertiary, #1E293B18)" : "transparent" }}
      >
        {/* Data + dia */}
        <div style={{ textAlign: "center", minWidth: 42, flexShrink: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{fmtDataCurta(aposta.data)}</p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{fmtDiaSemana(aposta.data)}</p>
        </div>

        <div style={{ width: 1, height: 34, backgroundColor: "var(--border-color)", flexShrink: 0 }} />

        {/* Casa + tipo de bilhete */}
        <div style={{ flexShrink: 0, minWidth: 80 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{aposta.casa_aposta}</p>
          {isBonus ? (
            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, backgroundColor: "#FEF3C720", color: "#F59E0B", fontWeight: 700 }}>BÔNUS</span>
          ) : (
            <span style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 4, fontWeight: 700,
              backgroundColor: nLegs === 1 ? "#3B82F615" : nLegs === 2 ? "#8B5CF615" : nLegs === 3 ? "#EC489915" : "#F59E0B15",
              color: nLegs === 1 ? "#60A5FA" : nLegs === 2 ? "#A78BFA" : nLegs === 3 ? "#F472B6" : "#F59E0B",
            }}>
              {tipoLabel}
            </span>
          )}
        </div>

        {/* Jogo / label */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{labelPrincipal}</p>
          {nLegs > 2 && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {aposta.detalhes?.map(d => d.selecao).join(" · ")}
            </p>
          )}
        </div>

        {/* Stake (só simples) */}
        {!isBonus && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{aposta.stake_unidades}u</span>
        )}

        {/* Odd */}
        <span style={{ fontSize: 14, fontFamily: "monospace", color: "#3B82F6", fontWeight: 700, flexShrink: 0 }}>@{aposta.odd_total}</span>

        <ResultadoBadge resultado={aposta.resultado} />

        {aposta.resultado !== "pendente" && aposta.resultado !== "void" && (
          <span style={{ fontSize: 14, fontWeight: 800, flexShrink: 0, minWidth: 80, textAlign: "right", color: lucro >= 0 ? "#10B981" : "#F87171" }}>
            {lucro >= 0 ? "+" : ""}{fmtBRL(lucro)}
          </span>
        )}

        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{isExp ? "▲" : "▼"}</span>
      </div>

      {/* Expandido */}
      {isExp && (
        <div style={{ padding: "16px 18px 18px", borderTop: "1px solid var(--border-color)" }}>

          {/* Chips de info */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Data", valor: fmtDataLonga(aposta.data) },
              isBonus
                ? { label: "Depósito bônus", valor: fmtBRL(aposta.valor_bonus ?? 0) }
                : { label: "Valor apostado", valor: fmtBRL(stakeValor) },
              isBonus
                ? { label: "Lucro máximo", valor: fmtBRL(aposta.lucro_maximo ?? 0) }
                : { label: "Stake", valor: `${aposta.stake_unidades}u` },
              ...(aposta.observacao ? [{ label: "Obs", valor: aposta.observacao }] : []),
            ].map((item, i) => (
              <div key={i} style={{ padding: "6px 14px", borderRadius: 9, backgroundColor: "var(--bg-tertiary, #0F172A15)", border: "1px solid var(--border-color)" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 1 }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.valor}</span>
              </div>
            ))}
            {isBonus && (
              <div style={{ padding: "6px 14px", borderRadius: 9, backgroundColor: "#FEF3C710", border: "1px solid #F59E0B30" }}>
                <span style={{ fontSize: 10, color: "#F59E0B", display: "block", marginBottom: 1 }}>Risco</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>Sem risco real</span>
              </div>
            )}
          </div>

          {/* Legs */}
          {(aposta.detalhes ?? []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
              {aposta.detalhes!.map((d, i) => (
                <div key={d.id} style={{
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                  padding: "11px 15px", borderRadius: 11,
                  backgroundColor: "var(--bg-tertiary, #0F172A12)", border: "1px solid var(--border-color)"
                }}>
                  <div style={{ flex: 1 }}>
                    {nLegs > 1 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>
                        Leg {i + 1} · {d.esporte}
                      </span>
                    )}
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 3px" }}>{d.jogo}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{d.campeonato}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                      {d.mercado}: <span style={{ color: "#60A5FA", fontWeight: 700 }}>{d.selecao}</span>
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 800, color: "#3B82F6" }}>@{d.odd_parcial}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Editar resultado */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Resultado:</span>
            {editando?.id === aposta.id ? (
              <>
                <select
                  value={editando.resultado}
                  onChange={e => setEditando({ id: aposta.id, resultado: e.target.value as Resultado })}
                  style={{ fontSize: 13, borderRadius: 8, padding: "7px 12px", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", outline: "none" }}
                >
                  <option value="pendente">Pendente</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="void">Void</option>
                </select>
                <button onClick={salvarResultado} disabled={salvando} style={{ padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: "#10B981", color: "white", fontSize: 13, fontWeight: 700, opacity: salvando ? 0.6 : 1 }}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
                <button onClick={() => setEditando(null)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-color)", cursor: "pointer", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: 13 }}>
                  Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setEditando({ id: aposta.id, resultado: aposta.resultado })} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: "#3B82F6", color: "white", fontSize: 13, fontWeight: 700 }}>
                Editar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL RELATÓRIO ── */}
      {modalRelatorio && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          padding: 20
        }} onClick={() => !gerandoRelatorio && setModalRelatorio(false)}>
          <div style={{
            backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)",
            borderRadius: 18, width: "100%", maxWidth: 700, maxHeight: "85vh",
            display: "flex", flexDirection: "column", overflow: "hidden"
          }} onClick={e => e.stopPropagation()}>
            {/* Header do modal */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "20px 24px", borderBottom: "1px solid var(--border-color)"
            }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                  Relatorio Master Tipster
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                  Gerado em {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
              <button onClick={() => !gerandoRelatorio && setModalRelatorio(false)} style={{
                background: "none", border: "none", cursor: "pointer", padding: 4,
                color: "var(--text-muted)", fontSize: 20
              }}>
                X
              </button>
            </div>

            {/* Conteudo */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {gerandoRelatorio ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60 }}>
                  <div style={{
                    width: 40, height: 40, border: "3px solid var(--border-color)",
                    borderTopColor: "#3B82F6", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite", marginBottom: 16
                  }} />
                  <p style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 600 }}>
                    Gerando analise...
                  </p>
                </div>
              ) : (
                <div style={{
                  fontSize: 14, lineHeight: 1.8, color: "var(--text-primary)",
                  whiteSpace: "pre-wrap"
                }}>
                  {textoRelatorio}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: "flex", justifyContent: "flex-end", gap: 10,
              padding: "16px 24px", borderTop: "1px solid var(--border-color)"
            }}>
              {textoRelatorio && !gerandoRelatorio && (
                <button onClick={() => navigator.clipboard.writeText(textoRelatorio)} style={{
                  padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border-color)",
                  cursor: "pointer", backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)",
                  fontSize: 13, fontWeight: 700
                }}>
                  Copiar
                </button>
              )}
              <button onClick={() => setModalRelatorio(false)} style={{
                padding: "10px 20px", borderRadius: 10, border: "none",
                cursor: "pointer", backgroundColor: "#3B82F6", color: "white",
                fontSize: 13, fontWeight: 700
              }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultadoBadge({ resultado }: { resultado: Resultado }) {
  const map: Record<Resultado, { label: string; bg: string; color: string }> = {
    pendente: { label: "Pendente", bg: "#FEF3C720", color: "#F59E0B" },
    green:    { label: "Green",    bg: "#10B98120", color: "#10B981" },
    red:      { label: "Red",      bg: "#F8717120", color: "#F87171" },
    void:     { label: "Void",     bg: "var(--border-color)", color: "var(--text-muted)" },
  };
  const { label, bg, color } = map[resultado];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 100, flexShrink: 0, backgroundColor: bg, color, border: `1px solid ${color}35` }}>
      {label}
    </span>
  );
}