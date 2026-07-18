// Cor de fallback pra uma categoria que não existe (mais) na tabela `categorias`
// — ex: renomeada/apagada, mas algum lançamento antigo ainda referencia o nome
// velho. Usa hash do nome (não índice de lista) pra dar sempre a mesma cor
// pro mesmo nome órfão, em qualquer lista/ordem onde ele apareça.

const FALLBACK_ROTATION = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b', '#f97316', '#06b6d4'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function corParaCategoria(nome: string, corPorNome: Record<string, string>): string {
  return corPorNome[nome] ?? FALLBACK_ROTATION[hashString(nome) % FALLBACK_ROTATION.length];
}
