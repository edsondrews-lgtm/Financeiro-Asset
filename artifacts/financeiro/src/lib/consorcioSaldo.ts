// Estimativa do crédito parado de um consórcio contemplado. Só a
// administradora sabe o saldo exato, então partimos do último saldo real
// informado (extrato) e compomos o CDI desde então.

import type { CdiMap } from './cdi';

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
