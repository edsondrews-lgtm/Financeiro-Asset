export const MENSAGEM_RECONQUISTA =
  'Oi *{{nome}}*! Notei que já faz {{dias}} dias que você não renova mais com a gente, ' +
  'e eu queria muito entender o que aconteceu. Se foi algo com o aplicativo, tela travando, ' +
  'ou qualquer outro problema, me conta — a gente pode tentar uma ferramenta diferente pra resolver. ' +
  'Quero muito continuar essa parceria com você, é só me dizer o que rolou que a gente ajeita 🙂'

export const MENSAGEM_AVISO =
  'Oi *{{nome}}*! Passando pra lembrar que seu acesso vence {{quando}} ({{data}}). ' +
  'Bora renovar pra não perder o acesso? Qualquer coisa é só me chamar 🙂'

export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto
}

interface DadosTemplate {
  nome: string
  dias?: number
  data?: string
  quando?: string
}

export function preencherTemplate(template: string, dados: DadosTemplate): string {
  let texto = template.replaceAll('{{nome}}', primeiroNome(dados.nome))
  if (dados.dias !== undefined) texto = texto.replaceAll('{{dias}}', String(dados.dias))
  if (dados.data !== undefined) texto = texto.replaceAll('{{data}}', dados.data)
  if (dados.quando !== undefined) texto = texto.replaceAll('{{quando}}', dados.quando)
  return texto
}

export function quandoVence(dias: number): string {
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}

export async function copiarParaAreaDeTransferencia(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
