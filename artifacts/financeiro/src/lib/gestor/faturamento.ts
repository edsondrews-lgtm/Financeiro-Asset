const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface PagamentoValor {
  data_pagamento: string
  valor: number | null
}

// Faturamento realizado por mês, desde o primeiro pagamento registrado até hoje.
export function calcularFaturamentoMensal(pagamentos: PagamentoValor[]) {
  const somaPorMes = new Map<string, number>()
  const qtdPorMes = new Map<string, number>()

  for (const p of pagamentos) {
    const d = new Date(p.data_pagamento + 'T00:00:00')
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    somaPorMes.set(chave, (somaPorMes.get(chave) ?? 0) + Number(p.valor ?? 0))
    qtdPorMes.set(chave, (qtdPorMes.get(chave) ?? 0) + 1)
  }

  const chaves = [...somaPorMes.keys()].sort()
  const labels = chaves.map((k) => {
    const [ano, mes] = k.split('-').map(Number)
    return `${MESES_PT[mes - 1]}/${String(ano).slice(2)}`
  })
  const valores = chaves.map((k) => somaPorMes.get(k) ?? 0)
  const quantidades = chaves.map((k) => qtdPorMes.get(k) ?? 0)

  return { labels, valores, quantidades }
}
