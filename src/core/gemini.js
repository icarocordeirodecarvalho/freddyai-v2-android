// Cliente mínimo da API Gemini (REST). A chave fica só em memória + cofre cifrado,
// vai no CABEÇALHO (nunca na URL) e nunca é escrita em log.
import { API_BASE } from "./config.js";
import { Store } from "./storage.js";

let chave = null;

export const Gemini = {
  async carregarChave() {
    chave = await Store.get("apikey", null);
    return !!chave;
  },
  async salvarChave(k) {
    chave = k.trim();
    await Store.set("apikey", chave);
  },
  async apagarChave() {
    chave = null;
    await Store.remove("apikey");
  },
  temChave: () => !!chave,

  async _post(modelo, corpo, sinal) {
    if (!chave) throw new Error("Falta a chave da API. Abra Configurações e cole sua chave do Google AI Studio.");
    const r = await fetch(`${API_BASE}/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify(corpo),
      signal: sinal,
      referrerPolicy: "no-referrer",
      credentials: "omit",
    });
    if (!r.ok) {
      let msg = "";
      try {
        msg = (await r.json())?.error?.message || "";
      } catch {}
      const e = new Error(erroAmigavel(r.status, msg));
      e.status = r.status;
      e.bruto = msg;
      throw e;
    }
    return r.json();
  },

  /** Uma chamada simples. Tenta sem "thinkingConfig" se o modelo não aceitar. */
  async gerar({ modelo, sistema, conteudos, ferramentas, pensar = "low", sinal }) {
    const corpo = { contents: conteudos };
    if (sistema) corpo.systemInstruction = { parts: [{ text: sistema }] };
    if (ferramentas?.length) corpo.tools = ferramentas;
    if (pensar) corpo.generationConfig = { thinkingConfig: { thinkingLevel: pensar } };
    try {
      return await this._post(modelo, corpo, sinal);
    } catch (e) {
      if (e.status === 400 && /thinking/i.test(e.bruto || "") && corpo.generationConfig) {
        delete corpo.generationConfig;
        return await this._post(modelo, corpo, sinal);
      }
      throw e;
    }
  },

  /** Busca na web usando o Google Search embutido do Gemini (chamada separada). */
  async pesquisar(modelo, consulta, sinal) {
    const j = await this._post(
      modelo,
      {
        systemInstruction: {
          parts: [{ text: "Pesquise na web e responda em português do Brasil, em no máximo 6 frases curtas, só com fatos verificáveis e datas quando houver." }],
        },
        contents: [{ role: "user", parts: [{ text: consulta }] }],
        tools: [{ google_search: {} }],
      },
      sinal
    );
    const c = j.candidates?.[0];
    const texto = (c?.content?.parts || []).map((p) => p.text || "").join("").trim();
    const fontes = (c?.groundingMetadata?.groundingChunks || [])
      .map((g) => g.web?.title)
      .filter(Boolean)
      .slice(0, 3);
    return { texto, fontes };
  },

  /** Transcreve um WAV (base64) em pt-BR. */
  async transcrever(modelo, wavBase64, sinal) {
    const j = await this._post(
      modelo,
      {
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "audio/wav", data: wavBase64 } },
              { text: "Transcreva fielmente este áudio em português do Brasil. Responda SOMENTE com a transcrição, sem comentários. Se não houver fala clara, responda exatamente: [silêncio]" },
            ],
          },
        ],
      },
      sinal
    );
    return textoDe(j).trim();
  },

  async testar(modelo) {
    const j = await this._post(modelo, { contents: [{ role: "user", parts: [{ text: "Responda apenas: ok" }] }] });
    return textoDe(j);
  },
};

export function textoDe(j) {
  return (j.candidates?.[0]?.content?.parts || [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}

function erroAmigavel(status, msg) {
  if (status === 400 && /API key/i.test(msg)) return "Chave de API inválida.";
  if (status === 401 || status === 403) return "A chave foi recusada (verifique se está correta e ativa).";
  if (status === 404) return "Modelo não encontrado. Troque o nome do modelo nas Configurações.";
  if (status === 429) return "Limite de uso da API atingido. Espere um pouco e tente de novo.";
  if (status >= 500) return "O servidor do Gemini está instável agora. Tente de novo.";
  return "Erro da API (" + status + ").";
}
