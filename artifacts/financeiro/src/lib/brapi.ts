// Cotações em tempo real via brapi.dev. Usado pela Carteira de Investimentos
// e pelo Painel Geral (recalcular o valor de mercado sem precisar montar a
// tela de Carteira).

const BRAPI_TOKEN = "qLEc2hpsiVZxUfoyMPzq4P";

export interface CotacaoBrapi {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent?: number;
  longName?: string;
  shortName?: string;
}

export async function buscarCotacoesBrapi(tickers: string[]): Promise<Record<string, CotacaoBrapi>> {
  if (tickers.length === 0) return {};
  // Uma requisição por ticker (múltiplos tickers causam 400 na brapi)
  const respostas = await Promise.all(
    tickers.map(t => fetch(`https://brapi.dev/api/quote/${t}?token=${BRAPI_TOKEN}`).then(r => r.json()))
  );
  const cotacoes: Record<string, CotacaoBrapi> = {};
  respostas.forEach((json: any) => {
    if (json.results) json.results.forEach((c: any) => { cotacoes[c.symbol] = c; });
  });
  return cotacoes;
}
