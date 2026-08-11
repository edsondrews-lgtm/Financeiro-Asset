import type { Cliente } from './types'

function diasEntre(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

function topComOutros(labels: string[], max: number): { labels: string[]; qtd: number[] } {
  const contagem = new Map<string, number>()
  for (const l of labels) {
    const chave = l && l.trim() ? l.trim() : 'Não informado'
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }
  const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const top = ordenado.slice(0, max)
  const outros = ordenado.slice(max).reduce((s, [, v]) => s + v, 0)
  const out = { labels: top.map((x) => x[0]), qtd: top.map((x) => x[1]) }
  if (outros > 0) {
    out.labels.push('Outros')
    out.qtd.push(outros)
  }
  return out
}

export function computeDashboardStats(clientes: Cliente[], hoje: Date) {
  // "não arquivados" = tudo que ainda está sob gestão, esteja em dia ou vencido.
  // Isso é diferente de "ativo": um cliente vencido não é arquivado, mas também não é ativo.
  const naoArquivados = clientes.filter((c) => !c.arquivado)
  const arquivados = clientes.filter((c) => c.arquivado)
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())

  const comData = naoArquivados.map((c) => ({ c, venc: new Date(c.vencimento + 'T00:00:00') }))
  const vencidos = comData.filter((x) => x.venc < hojeSemHora)
  const vencidosValor = vencidos.reduce((s, x) => s + Number(x.c.valor || 0), 0)
  const ghost = vencidos.filter((x) => diasEntre(hojeSemHora, x.venc) > 90)
  const ghostValor = ghost.reduce((s, x) => s + Number(x.c.valor || 0), 0)

  // ativo de verdade: não arquivado E em dia (vencimento hoje ou no futuro)
  const emDia = comData.filter((x) => x.venc >= hojeSemHora)
  const receitaRecorrente = emDia.reduce((s, x) => s + Number(x.c.valor || 0), 0)
  const ticketMedio = emDia.length ? receitaRecorrente / emDia.length : 0

  const venc7 = emDia.filter((x) => diasEntre(x.venc, hojeSemHora) <= 7)
  const venc30 = emDia.filter((x) => diasEntre(x.venc, hojeSemHora) <= 30)
  const venc7Valor = venc7.reduce((s, x) => s + Number(x.c.valor || 0), 0)
  const venc30Valor = venc30.reduce((s, x) => s + Number(x.c.valor || 0), 0)

  const optIn = naoArquivados.filter((c) => c.receber_mensagem)

  const kpis = {
    ativos: emDia.length,
    naoArquivados: naoArquivados.length,
    arquivados: arquivados.length,
    total: clientes.length,
    receitaRecorrente,
    ticketMedio,
    vencidosQtd: vencidos.length,
    vencidosValor,
    vencidosPct: naoArquivados.length ? (vencidos.length / naoArquivados.length) * 100 : 0,
    ghostQtd: ghost.length,
    ghostValor,
    venc7Qtd: venc7.length,
    venc7Valor,
    venc30Qtd: venc30.length,
    venc30Valor,
    optInQtd: optIn.length,
    optInPct: naoArquivados.length ? (optIn.length / naoArquivados.length) * 100 : 0,
  }

  // vencimentos por dia, proximos 30 dias
  const upcomingLabels: string[] = []
  const upcomingWeekday: string[] = []
  const upcomingQtd: number[] = []
  for (let i = 0; i < 30; i++) {
    const dia = new Date(hojeSemHora)
    dia.setDate(dia.getDate() + i)
    const qtd = comData.filter((x) => x.venc.getTime() === dia.getTime()).length
    upcomingLabels.push(dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
    upcomingWeekday.push(dia.toLocaleDateString('pt-BR', { weekday: 'short' }))
    upcomingQtd.push(qtd)
  }

  // aging de atraso
  const bucketsDef = [
    { label: '0-7d', min: 0, max: 7 },
    { label: '8-15d', min: 8, max: 15 },
    { label: '16-30d', min: 16, max: 30 },
    { label: '31-60d', min: 31, max: 60 },
    { label: '61-90d', min: 61, max: 90 },
    { label: '90d+', min: 91, max: Infinity },
  ]
  const agingQtd = bucketsDef.map(
    (b) => vencidos.filter((x) => { const d = diasEntre(hojeSemHora, x.venc); return d >= b.min && d <= b.max }).length
  )
  const agingValor = bucketsDef.map(
    (b) => vencidos
      .filter((x) => { const d = diasEntre(hojeSemHora, x.venc); return d >= b.min && d <= b.max })
      .reduce((s, x) => s + Number(x.c.valor || 0), 0)
  )

  // Tudo rotulado "ativos" abaixo usa emDia (não arquivado E em dia) — não os vencidos.
  const clientesEmDia = emDia.map((x) => x.c)
  const apps = topComOutros(clientesEmDia.map((c) => c.aplicativo ?? ''), 7)
  const servidoresBrutos = topComOutros(clientesEmDia.map((c) => c.servidor ?? ''), 6)
  const receitaPorServidor = new Map<string, number>()
  for (const c of clientesEmDia) {
    const chave = c.servidor && c.servidor.trim() ? c.servidor.trim() : 'Não informado'
    receitaPorServidor.set(chave, (receitaPorServidor.get(chave) ?? 0) + Number(c.valor || 0))
  }
  const servers = {
    ...servidoresBrutos,
    receita: servidoresBrutos.labels.map((l) => receitaPorServidor.get(l) ?? 0),
  }
  const geo = topComOutros(clientes.map((c) => c.localizacao ?? ''), 8)
  const devices = topComOutros(clientesEmDia.map((c) => c.dispositivo ?? '').filter((d) => d), 6)
  const paymentMix = topComOutros(clientes.map((c) => c.forma_pagamento ?? ''), 8)

  const referralCount = new Map<string, number>()
  for (const c of clientesEmDia) {
    if (c.indicado_por && c.indicado_por.trim()) {
      referralCount.set(c.indicado_por, (referralCount.get(c.indicado_por) ?? 0) + 1)
    }
  }
  const referrals = [...referralCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([nome, qtd]) => ({ nome, qtd }))

  return {
    kpis,
    upcoming: { labels: upcomingLabels, weekday: upcomingWeekday, qtd: upcomingQtd },
    aging: { labels: bucketsDef.map((b) => b.label), qtd: agingQtd, valor: agingValor },
    apps,
    servers,
    geo,
    devices,
    paymentMix,
    referrals,
  }
}

export type DashboardStats = ReturnType<typeof computeDashboardStats>
