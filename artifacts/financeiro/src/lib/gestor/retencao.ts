import type { Cliente } from './types'
import { diasAte } from './format'

export interface SegmentoRetencao {
  chave: string
  total: number
  vencidos: number
  taxaVencidos: number
  mediaDiasAtraso: number
  valorRepresado: number
}

const MIN_AMOSTRA = 5

function montarSegmentos(grupos: Map<string, Cliente[]>): SegmentoRetencao[] {
  const resultado: SegmentoRetencao[] = []
  for (const [chave, membros] of grupos) {
    if (membros.length < MIN_AMOSTRA) continue
    const vencidosLista = membros.filter((c) => diasAte(c.vencimento) < 0)
    const somaDias = vencidosLista.reduce((s, c) => s + Math.abs(diasAte(c.vencimento)), 0)
    resultado.push({
      chave,
      total: membros.length,
      vencidos: vencidosLista.length,
      taxaVencidos: (vencidosLista.length / membros.length) * 100,
      mediaDiasAtraso: vencidosLista.length ? somaDias / vencidosLista.length : 0,
      valorRepresado: vencidosLista.reduce((s, c) => s + Number(c.valor || 0), 0),
    })
  }
  return resultado.sort((a, b) => b.taxaVencidos - a.taxaVencidos)
}

export function analisarSegmento(
  clientes: Cliente[],
  campo: 'servidor' | 'aplicativo' | 'plano' | 'localizacao'
): SegmentoRetencao[] {
  const grupos = new Map<string, Cliente[]>()
  for (const c of clientes) {
    const valor = c[campo]
    const chave = valor && valor.trim() ? valor.trim() : 'Não informado'
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(c)
  }
  return montarSegmentos(grupos)
}

export function analisarPorFaixaDeValor(clientes: Cliente[]): SegmentoRetencao[] {
  const grupos = new Map<string, Cliente[]>()
  for (const c of clientes) {
    const chave = `R$ ${Number(c.valor).toFixed(0)}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(c)
  }
  return montarSegmentos(grupos)
}
