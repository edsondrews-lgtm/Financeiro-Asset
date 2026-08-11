const MESES_POR_PLANO: Record<string, number> = {
  'Mensal': 1,
  'Bimestral': 2,
  'Trimestral': 3,
  '4 Meses': 4,
  '5 Meses': 5,
  'Semestral': 6,
  'Anual': 12,
}

export function mesesDoPlano(plano: string): number {
  if (MESES_POR_PLANO[plano]) return MESES_POR_PLANO[plano]
  const match = plano.match(/(\d+)\s*mes/i)
  if (match) return Number(match[1])
  for (const [nome, meses] of Object.entries(MESES_POR_PLANO)) {
    if (plano.toLowerCase().includes(nome.toLowerCase())) return meses
  }
  return 1
}

function paraDate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

function paraISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Soma meses a partir do maior entre "hoje" e a data atual — quem renova adiantado
// não perde os dias que já pagou; quem está atrasado conta a partir de hoje.
export function somarMeses(baseISO: string, meses: number): string {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const atual = paraDate(baseISO)
  const base = atual > hoje ? atual : hoje
  const d = new Date(base)
  d.setMonth(d.getMonth() + meses)
  return paraISO(d)
}

export function calcularProximoVencimento(vencimentoAtual: string, plano: string): string {
  return somarMeses(vencimentoAtual, mesesDoPlano(plano))
}
