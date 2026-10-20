// Cliente mínimo da API Gemini (REST). A chave fica só em memória + cofre cifrado,
// vai no CABEÇALHO (nunca na URL) e nunca é escrita em log.
import { API_BASE } from "./config.js";
import { Store } from "./storage.js";

const TIMEOUT_MS = 30_000;

/** Erro com "tipo": cota | rede | timeout | servidor | chave | modelo | cancelado | outro */
export function criarErro(tipo, mensagem, extra = {}) {
  const e = new Error(mensagem);
  e.tipo = tipo;
  Object.assign(e, extra);
  return e;
}
/** Falhas temporárias: vale guardar na fila / tentar o plano B. */
export const recuperavel = (e) => ["cota", "rede", "timeout", "servidor"].includes(e?.tipo);
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Faz um fetch com limite de tempo e liga o cancelamento externo. */
export async function fetchComTempo(url, init, sinal, ms = TIMEOUT_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort("timeout"), ms);
  const cancelar = () => ctl.abort("usuario");
  sinal?.addEventListener("abort", cancelar);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, referrerPolicy: "no-referrer", credentials: "omit" });
  } catch {
    if (sinal?.aborted) throw criarErro("cancelado", "Cancelado.");
    if (ctl.signal.reason === "timeout") throw criarErro("timeout", "A IA demorou demais para responder.");
    throw criarErro("rede", "Sem conexão com a internet.");
  } finally {
    clearTimeout(timer);
    sinal?.removeEventListener("abort", cancelar);
  }
}

function tipoDoStatus(status, msg) {
  if (status === 429) return "cota";
  if (status === 401 || status === 403 || (status === 400 && /API key/i.test(msg))) return "chave";
  if (status === 404) return "modelo";
  if (status >= 500) return "servidor";
  return "outro";
}

function textoErro(tipo, status) {
  return (
    {
      cota: "Limite de uso da IA atingido.",
      chave: "A chave foi recusada (verifique se está correta e ativa).",
      modelo: "Modelo não encontrado. Troque o nome do modelo nas Configurações.",
      servidor: "O servidor da IA está instável agora.",
    }[tipo] || `Erro da API (${status}).`
  );
}

/** Lê "retryDelay" (ex.: "34s") do corpo de erro do Google, ou o cabeçalho Retry-After. */
function esperaSugerida(r, corpo) {
  const h = Number(r.headers.get("retry-after"));
  if (h > 0) return Math.ceil(h);
  const d = corpo?.error?.details?.find((x) => /RetryInfo/.test(x["@type"] || ""))?.retryDelay;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(d || "");
  return m ? Math.ceil(Number(m[1])) : null;
}

// Duas chaves (de projetos diferentes do Google): principal e reserva.
// Se uma bater a cota (429), a outra assume — cada projeto tem a sua própria cota.
const chaves = [null, null];
const bloqueadaAte = [0, 0]; // timestamp até quando cada chave fica "de molho"
let ultimaUsada = 0;

export const Gemini = {
  async carregarChave() {
    chaves[0] = await Store.get("apikey", null);
    chaves[1] = await Store.get("apikey2", null);
    return !!(chaves[0] || chaves[1]);
  },
  async salvarChave(k, idx = 0) {
    chaves[idx] = k.trim();
    bloqueadaAte[idx] = 0;
    await Store.set(idx ? "apikey2" : "apikey", chaves[idx]);
  },
  async apagarChave(idx = 0) {
    chaves[idx] = null;
    await Store.remove(idx ? "apikey2" : "apikey");
  },
  temChave: (idx) => (idx == null ? !!(chaves[0] || chaves[1]) : !!chaves[idx]),
  /** 0 = principal, 1 = reserva (a que respondeu por último) */
  ultimaChave: () => ultimaUsada,

  /** Uma tentativa numa chave específica (com 1 repetição para rede/servidor). */
  async _postUma(chave, modelo, corpo, sinal) {
    for (let tentativa = 1; ; tentativa++) {
      let r;
      try {
        r = await fetchComTempo(
          `${API_BASE}/models/${encodeURIComponent(modelo)}:generateContent`,
          { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": chave }, body: JSON.stringify(corpo) },
          sinal
        );
      } catch (e) {
        if ((e.tipo === "rede" || e.tipo === "timeout") && tentativa < 2) {
          await esperar(1500);
          continue;
        }
        throw e;
      }
      if (r.ok) return r.json();
      let j = null;
      try {
        j = await r.json();
      } catch {}
      const bruto = j?.error?.message || "";
      const tipo = tipoDoStatus(r.status, bruto);
      if (tipo === "servidor" && tentativa < 2) {
        await esperar(1500);
        continue;
      }
      throw criarErro(tipo, textoErro(tipo, r.status), { status: r.status, bruto, esperaSeg: esperaSugerida(r, j) });
    }
  },

  /** Escolhe a chave: pula as que estão sem cota e passa para a reserva. */
  async _post(modelo, corpo, sinal) {
    if (!chaves[0] && !chaves[1]) throw criarErro("chave", "Falta a chave da API. Abra Configurações e cole sua chave do Google AI Studio.");
    const agora = Date.now();
    const candidatas = [0, 1].filter((i) => chaves[i] && bloqueadaAte[i] <= agora);
    if (!candidatas.length) {
      const resta = Math.min(...[0, 1].filter((i) => chaves[i]).map((i) => bloqueadaAte[i])) - agora;
      throw criarErro("cota", textoErro("cota"), { esperaSeg: Math.max(10, Math.ceil(resta / 1000)) });
    }
    // começa pela que respondeu por último (evita ficar batendo na que está sem cota)
    candidatas.sort((a, b) => (a === ultimaUsada ? -1 : b === ultimaUsada ? 1 : a - b));
    let ultimoErro = null;
    for (const i of candidatas) {
      try {
        const r = await this._postUma(chaves[i], modelo, corpo, sinal);
        ultimaUsada = i;
        return r;
      } catch (e) {
        if (e.tipo === "cota") bloqueadaAte[i] = Date.now() + Math.max(20, e.esperaSeg || 60) * 1000;
        else if (e.tipo === "chave" && candidatas.length > 1) bloqueadaAte[i] = Date.now() + 10 * 60_000;
        else throw e;
        ultimoErro = e;
      }
    }
    if (ultimoErro?.tipo === "cota") {
      const libera = Math.min(...[0, 1].filter((i) => chaves[i]).map((i) => bloqueadaAte[i]));
      ultimoErro.esperaSeg = Math.max(10, Math.ceil((libera - Date.now()) / 1000));
    }
    throw ultimoErro;
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

  /** Testa uma chave específica (0 = principal, 1 = reserva). */
  async testar(modelo, idx = 0) {
    if (!chaves[idx]) throw criarErro("chave", "Essa chave ainda não foi salva.");
    const j = await this._postUma(chaves[idx], modelo, { contents: [{ role: "user", parts: [{ text: "Responda apenas: ok" }] }] });
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
