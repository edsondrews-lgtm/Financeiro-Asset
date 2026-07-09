// Webhook do Telegram: recebe foto de cupom ou texto ("posto tigrinho combustível 150"),
// manda pro Gemini extrair valor/categoria/descrição, e responde no chat pedindo
// confirmação (botões inline) antes de gravar em pessoal_saidas.
//
// Deploy: já acontece junto com o resto do app no Vercel (é só um arquivo em api/).
// URL final: https://SEU-DOMINIO.vercel.app/api/telegram-webhook
//
// Variáveis de ambiente novas, que precisam ser cadastradas no Vercel
// (Project Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
// (a Service Role Key pega em Project Settings → API no Supabase; ela nunca
// deve ir para o bundle do app, por isso não tem prefixo VITE_.)
//
// URL do Supabase e chave do Gemini são reaproveitadas das VITE_* que já
// existem — o prefixo VITE_ só afeta o que o build do frontend embute no
// navegador; no backend, toda variável de ambiente fica acessível igual.

import { createClient } from "@supabase/supabase-js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY!;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CATEGORIAS = [
  "Investimento", "Moradia", "Lazer", "Vestuário", "Alimentação",
  "Assinatura", "Mercado", "Supérfluos", "Transporte", "Saúde", "Outros",
];

const PROMPT = `Você é um assistente que extrai dados de gastos pessoais em português do Brasil,
a partir de uma foto de cupom/nota fiscal ou de uma mensagem de texto curta.

Categorias válidas (escolha exatamente uma): ${CATEGORIAS.join(", ")}.
Use "Mercado" para compras de supermercado, "Transporte" para combustível/posto/uber,
"Supérfluos" para itens não essenciais de baixo valor que não se encaixem melhor em outra categoria.

Responda APENAS com um JSON, sem markdown, no formato:
{"descricao": string, "categoria": string, "valor": number, "data_gasto": "YYYY-MM-DD" ou null}

Se não conseguir identificar um valor em reais com confiança, responda:
{"erro": "motivo curto"}`;

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function telegramCall(method: string, body: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function baixarArquivoTelegram(fileId: string): Promise<Buffer> {
  const info = await telegramCall("getFile", { file_id: fileId });
  const path = info.result.file_path;
  const res = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${path}`);
  return Buffer.from(await res.arrayBuffer());
}

async function chamarGemini(parts: Record<string, unknown>[]) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, ...parts] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error("Gemini não retornou conteúdo: " + JSON.stringify(data));
  return JSON.parse(texto);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).send("method not allowed");
    return;
  }

  if (req.headers["x-telegram-bot-api-secret-token"] !== TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).send("unauthorized");
    return;
  }

  const update = req.body;

  try {
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;

      let parsed: Record<string, unknown>;
      if (msg.photo) {
        const maior = msg.photo[msg.photo.length - 1];
        const bytes = await baixarArquivoTelegram(maior.file_id);
        parsed = await chamarGemini([
          { inline_data: { mime_type: "image/jpeg", data: bytes.toString("base64") } },
        ]);
      } else if (msg.text) {
        parsed = await chamarGemini([{ text: msg.text }]);
      } else {
        await telegramCall("sendMessage", {
          chat_id: chatId,
          text: 'Manda um texto (ex: "posto tigrinho combustível 150") ou uma foto do cupom.',
        });
        res.status(200).send("ok");
        return;
      }

      if (parsed.erro) {
        await telegramCall("sendMessage", { chat_id: chatId, text: `Não entendi: ${parsed.erro}` });
        res.status(200).send("ok");
        return;
      }

      const valor = Number(parsed.valor);
      const categoria = CATEGORIAS.includes(parsed.categoria as string) ? parsed.categoria : "Outros";
      const dataGasto = (parsed.data_gasto as string) || new Date().toISOString().split("T")[0];

      const enviado = await telegramCall("sendMessage", {
        chat_id: chatId,
        text: `${parsed.descricao}\n${fmtBRL(valor)} · ${categoria} · ${dataGasto}\n\nConfirma?`,
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Confirmar", callback_data: "confirmar" },
            { text: "❌ Cancelar", callback_data: "cancelar" },
          ]],
        },
      });

      await supabase.from("telegram_pendentes").insert({
        chat_id: chatId,
        message_id: enviado.result.message_id,
        descricao: parsed.descricao,
        categoria,
        valor,
        data_gasto: dataGasto,
      });
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const messageId = cq.message.message_id;

      const { data: pendente } = await supabase
        .from("telegram_pendentes")
        .select("*")
        .eq("chat_id", chatId)
        .eq("message_id", messageId)
        .maybeSingle();

      if (pendente && cq.data === "confirmar") {
        await supabase.from("pessoal_saidas").insert({
          descricao: pendente.descricao,
          categoria: pendente.categoria,
          valor: pendente.valor,
          data_gasto: pendente.data_gasto,
          periodicidade: "Único",
          origem: "telegram",
        });
        await supabase.from("telegram_pendentes").delete().eq("id", pendente.id);
        await telegramCall("editMessageText", { chat_id: chatId, message_id: messageId, text: "✅ Registrado!" });
      } else if (pendente) {
        await supabase.from("telegram_pendentes").delete().eq("id", pendente.id);
        await telegramCall("editMessageText", { chat_id: chatId, message_id: messageId, text: "❌ Cancelado." });
      }

      await telegramCall("answerCallbackQuery", { callback_query_id: cq.id });
    }
  } catch (e) {
    console.error(e);
    const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    if (chatId) {
      const msg = e instanceof Error ? e.message : String(e);
      await telegramCall("sendMessage", { chat_id: chatId, text: `⚠️ Erro interno: ${msg}` }).catch(() => {});
    }
  }

  res.status(200).send("ok");
}
