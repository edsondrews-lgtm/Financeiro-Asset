// Estimativa do crédito parado de um consórcio contemplado. Só a
// administradora sabe o saldo exato, então partimos do último saldo real
// informado (extrato) e compomos o CDI desde então. Usado pela tela do
// consórcio e pelo Painel Geral, pra os dois mostrarem o mesmo número.

import { buscarHistoricoCDI, type CdiMap } from './cdi';

export function dataLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Compõe o CDI diário (× % do CDI que a administradora paga) em cada dia útil
// publicado depois da data do saldo. O dia de hoje fica de fora — a taxa só é
// divulgada no fim do dia.
export function estimarSaldoConsorcio(
  valor: number,
  dataRef: string,
  cdiMap: CdiMap,
  percentualCdi: number,
): number {
  const hoje = dataLocalISO();
  let fator = 1;
  for (const [dia, taxa] of cdiMap) {
    if (dia > dataRef && dia < hoje) fator *= 1 + (taxa / 100) * (percentualCdi / 100);
  }
  return valor * fator;
}

interface ConsorcioRow {
  id: string;
  credito_disponivel: number | null;
  data_contemplacao: string | null;
  percentual_cdi?: number | null;
}

interface SaldoRow {
  consorcio_id: string;
  data: string;
  valor: number;
  created_at?: string;
}

// Saldo estimado de hoje por id de consórcio contemplado. A referência é o
// último saldo real (por data); sem nenhum, usa o crédito da contemplação.
export async function estimarSaldosConsorcios(
  consorcios: ConsorcioRow[],
  saldos: SaldoRow[],
): Promise<Record<string, number>> {
  const refs: { id: string; data: string; valor: number; pct: number }[] = [];
  for (const c of consorcios) {
    if (c.credito_disponivel == null) continue;
    const doConsorcio = saldos
      .filter(s => s.consorcio_id === c.id)
      .sort((a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const ultimo = doConsorcio[0];
    refs.push({
      id: c.id,
      data: ultimo ? ultimo.data : (c.data_contemplacao ?? dataLocalISO()),
      valor: ultimo ? Number(ultimo.valor) : Number(c.credito_disponivel),
      pct: Number(c.percentual_cdi ?? 100) || 100,
    });
  }
  if (refs.length === 0) return {};

  const maisAntiga = refs.reduce((min, r) => (r.data < min ? r.data : min), refs[0].data);
  const cdiMap = await buscarHistoricoCDI(new Date(maisAntiga + 'T12:00:00'));

  const resultado: Record<string, number> = {};
  for (const r of refs) resultado[r.id] = estimarSaldoConsorcio(r.valor, r.data, cdiMap, r.pct);
  return resultado;
}
