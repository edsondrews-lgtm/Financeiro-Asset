export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function navegarMes(atual: string, direcao: number): string {
  const [ano, mes] = atual.split('-').map(Number);
  const d = new Date(ano, mes - 1 + direcao, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMesLabel(ym: string): string {
  const [ano, mes] = ym.split('-').map(Number);
  return `${MESES[mes - 1]} ${ano}`;
}

export function primeiroEUltimoDia(ym: string): { primeiroDia: string; ultimoDia: string } {
  const [ano, mes] = ym.split('-');
  const primeiroDia = `${ano}-${mes}-01`;
  const ultimoDia = `${ano}-${mes}-${new Date(Number(ano), Number(mes), 0).getDate()}`;
  return { primeiroDia, ultimoDia };
}
