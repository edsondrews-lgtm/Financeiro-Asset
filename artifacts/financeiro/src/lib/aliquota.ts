// Regra padrão do Simples Nacional usada como estimativa quando não há
// override manual pro mês: 6% até maio, 7% de junho em diante. É só uma
// aproximação — a alíquota real é progressiva (depende do RBT12), por
// isso existe o override em `empresa_aliquotas`.
export function aliquotaPadrao(mesNum: number): number {
  return mesNum >= 6 ? 7 : 6;
}

// mesAno no formato 'YYYY-MM'. Retorna a alíquota em percentual (ex: 7 = 7%).
export function resolverAliquota(mesAno: string, overrides: Record<string, number>): number {
  const override = overrides[mesAno];
  if (override !== undefined) return override;
  return aliquotaPadrao(Number(mesAno.slice(5, 7)));
}
