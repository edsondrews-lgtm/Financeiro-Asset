import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const analiseRouter = Router();
const client = new Anthropic(); // usa ANTHROPIC_API_KEY do ambiente automaticamente

analiseRouter.post("/analise", async (req, res) => {
  try {
    const {
      periodo,
      cubVariacao,
      cdiVariacao,
      cubVenceCDI,
      valorOriginal,
      valorAtualizado,
      totalPago,
      parcelasNormais,
      parcelasAdiantadas,
      economiaAdiantamentos,
      cubAtual,
      mesesRestantes,
      entregaPrevista,
    } = req.body;

    const prompt = `Você é um consultor financeiro especialista em mercado imobiliário brasileiro. Analise os dados abaixo de um apartamento em construção e forneça uma análise inteligente, direta e útil em português:

DADOS DO APARTAMENTO:
- Período analisado: ${periodo}
- CUB acumulou: ${cubVariacao} no período
- CDI (100%) acumulou: ${cdiVariacao} no período
- CUB supera CDI: ${cubVenceCDI ? 'SIM' : 'NÃO'}
- Valor original do contrato: ${valorOriginal}
- Valor atualizado pelo CUB hoje: ${valorAtualizado}
- Total já pago: ${totalPago}
- Parcelas pagas normalmente: ${parcelasNormais}
- Parcelas adiantadas: ${parcelasAdiantadas}
- Economia gerada pelos adiantamentos: ${economiaAdiantamentos}
- CUB atual: ${cubAtual}
- Meses até entrega: ${mesesRestantes}
- Entrega prevista: ${entregaPrevista}

Faça uma análise com 4 parágrafos curtos cobrindo:
1. Se o CUB está sendo vantajoso vs CDI (se vale a pena ter comprado via CUB vs ter deixado no CDI)
2. Se a estratégia de adiantar parcelas está sendo inteligente
3. Uma perspectiva sobre os próximos meses até a entrega
4. Uma conclusão geral sobre se o investimento está saudável

Seja direto, use linguagem simples, mencione os números relevantes. Não use markdown, só texto corrido em parágrafos separados por linha em branco.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const texto = message.content.find((b) => b.type === "text")?.text ?? "";
    res.json({ analise: texto });
  } catch (error) {
    console.error("Erro ao chamar Anthropic:", error);
    res.status(500).json({ error: "Erro ao gerar análise." });
  }
});

export default analiseRouter;