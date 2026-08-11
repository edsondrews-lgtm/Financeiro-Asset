export function formatarData(iso: string | null) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function diasAte(iso: string) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(iso + 'T00:00:00')
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000)
}

export function statusData(iso: string, { curto = false } = {}): { texto: string; classe: string } {
  const dias = diasAte(iso)
  if (dias < 0) return { texto: curto ? `Vencido ${Math.abs(dias)}d` : `Vencido há ${Math.abs(dias)}d`, classe: 'status-vencido' }
  if (dias === 0) return { texto: curto ? 'Hoje' : 'Vence hoje', classe: 'status-hoje' }
  if (dias <= 7) return { texto: curto ? `${dias}d` : `Vence em ${dias}d`, classe: 'status-proximo' }
  return { texto: formatarData(iso), classe: 'status-ok' }
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

// UniTV não depende de app/dispositivo cadastrado — quem usa não conta como cadastro incompleto.
const APP_SEM_CADASTRO_NECESSARIO = 'unitv'

export function cadastroIncompleto(c: { aplicativo: string | null; dispositivo: string | null }): boolean {
  if ((c.aplicativo ?? '').trim().toLowerCase() === APP_SEM_CADASTRO_NECESSARIO) return false
  return !c.aplicativo?.trim() || !c.dispositivo?.trim()
}
