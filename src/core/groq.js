// Plano B: Groq (API compatível com OpenAI). Só é chamado quando o Gemini falha
// por motivo temporário. Não vê imagens e não pesquisa na web.
import { Store } from "./storage.js";
import { criarErro, fetchComTempo, esperar } from "./gemini.js";

const BASE = "https://api.groq.com/openai/v1";
let chave = null;

function tipoDoStatus(s) {
  if (s === 429) return "cota";
  if (s === 401 || s === 403) return "chave";
  if (s === 404) return "modelo";
  if (s >= 500) return "servidor";
  return "outro";
}

async function chamar(caminho, init, sinal) {
  if (!chave) throw criarErro("chave", "Falta a chave do Groq.");
  for (let t = 1; ; t++) {
    let r;
    try {
      r = await fetchComTempo(BASE + caminho, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${chave}` } }, sinal, 25_000);
    } catch (e) {
      if ((e.tipo === "rede" || e.tipo === "timeout") && t < 2) {
        await esperar(1200);
        continue;
      }
      throw e;
    }
    if (r.ok) return r.json();
    let j = null;
    try {
      j = await r.json();
    } catch {}
    const tipo = tipoDoStatus(r.status);
    if (tipo === "servidor" && t < 2) {
      await esperar(1200);
      continue;
    }
    const seg = Number(r.headers.get("retry-after")) || null;
    throw criarErro(tipo, `Groq: ${j?.error?.message?.slice(0, 120) || "erro " + r.status}`, { status: r.status, bruto: j?.error?.message || "", esperaSeg: seg });
  }
}

/** Converte o esquema do Gemini (tipos em MAIÚSCULAS) para o formato OpenAI. */
function minusculo(s) {
  if (Array.isArray(s)) return s.map(minusculo);
  if (s && typeof s === "object") {
    const o = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === "required" && Array.isArray(v) && !v.length) continue;
      o[k] = k === "type" && typeof v === "string" ? v.toLowerCase() : minusculo(v);
    }
    return o;
  }
  return s;
}
export const paraFerramentasOpenAI = (lista) =>
  lista.map((f) => ({ type: "function", function: { name: f.nome, description: f.descricao, parameters: minusculo(f.parametros) } }));

export const Groq = {
  async carregarChave() {
    chave = await Store.get("groqkey", null);
    return !!chave;
  },
  async salvarChave(k) {
    chave = k.trim();
    await Store.set("groqkey", chave);
  },
  async apagarChave() {
    chave = null;
    await Store.remove("groqkey");
  },
  temChave: () => !!chave,

  async chat({ modelo, mensagens, ferramentas, sinal }) {
    const corpo = { model: modelo, messages: mensagens, reasoning_effort: "low" };
    if (ferramentas?.length) {
      corpo.tools = ferramentas;
      corpo.tool_choice = "auto";
    }
    const init = () => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    try {
      return await chamar("/chat/completions", init(), sinal);
    } catch (e) {
      if (e.status === 400 && /reasoning/i.test(e.bruto || "")) {
        delete corpo.reasoning_effort; // modelo sem esse parâmetro
        return await chamar("/chat/completions", init(), sinal);
      }
      throw e;
    }
  },

  async transcrever(modelo, wavBase64, sinal) {
    const bin = Uint8Array.from(atob(wavBase64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new Blob([bin], { type: "audio/wav" }), "fala.wav");
    form.append("model", modelo);
    form.append("language", "pt");
    form.append("response_format", "json");
    const j = await chamar("/audio/transcriptions", { method: "POST", body: form }, sinal);
    return (j.text || "").trim();
  },

  async testar(modelo) {
    const j = await this.chat({ modelo, mensagens: [{ role: "user", content: "Responda apenas: ok" }] });
    return j.choices?.[0]?.message?.content || "";
  },
};
