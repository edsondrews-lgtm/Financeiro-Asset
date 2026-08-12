// Histórico de CDI (Banco Central, série 4389) e cálculo de juros compostos
// sobre uma lista de aportes/retiradas com data. Usado tanto pela tela de
// Caixinhas (histórico detalhado por caixinha) quanto pelo Painel Geral
// (recalcular o total sem precisar montar a tela de Caixinhas).

export type CdiMap = Map<string, number>;

export function fmtDataBCB(d: Date): string {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function cdiAnualParaDiario(valorAnual: number): number {
  if (valorAnual <= 0) return 0;
  if (valorAnual < 1) return valorAnual;
  return (Math.pow(1 + valorAnual / 100, 1 / 252) - 1) * 100;
}

export async function buscarHistoricoCDI(dataInicio: Date): Promise<CdiMap> {
  const hoje = new Date();
  const url  = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json`
            + `&dataInicial=${fmtDataBCB(dataInicio)}&dataFinal=${fmtDataBCB(hoje)}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`BCB ${res.status}`);
  const dados = await res.json() as { data: string; valor: string }[];
  const map: CdiMap = new Map();
  for (const d of dados) {
    const [dd, mm, yyyy] = d.data.split('/');
    const valorDiario = cdiAnualParaDiario(parseFloat(d.valor));
    map.set(`${yyyy}-${mm}-${dd}`, valorDiario);
  }
  return map;
}

export function diasCorridos(data: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dep  = new Date(data + 'T12:00:00');
  return Math.max(0, Math.floor((hoje.getTime() - dep.getTime()) / 86400000));
}

export interface LancamentoCDI {
  data_aporte: string;
  valor_adicionado: number;
}

export interface LinhaRendimento<T extends LancamentoCDI = LancamentoCDI> {
  aporte: T;
  dias: number;
  valorInicial: number;
  rendimento: number;
  valorFinal: number;
}

export function calcularJurosCompostos<T extends LancamentoCDI>(
  aportes: T[],
  taxaFallbackPct: number,
  cdiMap: CdiMap = new Map()
): { linhas: LinhaRendimento<T>[]; saldoProjetado: number; totalDepositado: number; totalRendimento: number } {
  const hoje    = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().split('T')[0];

  const sorted = [...cdiMap.entries()]
    .filter(([d]) => d < hojeStr)
    .sort(([a], [b]) => a.localeCompare(b));

  const cumLog: { date: string; log: number }[] = [];
  let running = 0;
  for (const [date, taxa] of sorted) {
    running += Math.log1p(taxa / 100);
    cumLog.push({ date, log: running });
  }
  const totalLog = running;
  const usaCDI   = cumLog.length > 0;

  function logAntesDe(dateStr: string): number {
    let lo = 0, hi = cumLog.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumLog[mid].date < dateStr) lo = mid + 1; else hi = mid; }
    return lo === 0 ? 0 : cumLog[lo - 1].log;
  }

  const linhas: LinhaRendimento<T>[] = aportes
    .filter(a => a.valor_adicionado !== 0)
    .map(a => {
      const n    = diasCorridos(a.data_aporte);
      const fator = usaCDI
        ? Math.exp(totalLog - logAntesDe(a.data_aporte))
        : Math.pow(1 + taxaFallbackPct / 100, n);
      const vf        = a.valor_adicionado * fator;
      const rendimento = vf - a.valor_adicionado;
      return { aporte: a, dias: n, valorInicial: a.valor_adicionado, rendimento, valorFinal: vf };
    });

  const totalDepositado = linhas.reduce((s, l) => s + l.valorInicial, 0);
  const saldoProjetado  = linhas.reduce((s, l) => s + l.valorFinal, 0);
  return { linhas, saldoProjetado, totalDepositado, totalRendimento: saldoProjetado - totalDepositado };
}
