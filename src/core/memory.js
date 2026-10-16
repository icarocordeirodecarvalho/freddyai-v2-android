// Lembranças do Freddy sobre você. Cifradas, visíveis e apagáveis por você.
import { Store } from "./storage.js";
import { LIMITES } from "./config.js";

const CHAVE = "memorias";
let cache = null;

async function lista() {
  if (!cache) cache = await Store.get(CHAVE, []);
  return cache;
}

const limpar = (t) => String(t).replace(/\s+/g, " ").trim().slice(0, 300);

export const Memoria = {
  async todas() {
    return [...(await lista())];
  },
  async adicionar(texto, categoria = "geral") {
    const l = await lista();
    const t = limpar(texto);
    if (t.length < 3) throw new Error("Texto muito curto.");
    const igual = l.find((m) => m.texto.toLowerCase() === t.toLowerCase());
    if (igual) return igual;
    const m = { id: crypto.randomUUID().slice(0, 8), texto: t, categoria: limpar(categoria).slice(0, 30), t: Date.now() };
    l.unshift(m);
    if (l.length > LIMITES.maxMemorias) l.length = LIMITES.maxMemorias;
    await Store.set(CHAVE, l);
    return m;
  },
  async esquecer(trechoOuId) {
    const l = await lista();
    const q = String(trechoOuId).toLowerCase().trim();
    if (q.length < 3) return 0;
    const antes = l.length;
    const resto = l.filter((m) => m.id !== q && !m.texto.toLowerCase().includes(q));
    cache = resto;
    await Store.set(CHAVE, resto);
    return antes - resto.length;
  },
  async apagarTudo() {
    cache = [];
    await Store.set(CHAVE, []);
  },
  /** Bloco de texto para o prompt — sempre marcado como DADO, não instrução. */
  async paraPrompt() {
    const l = await lista();
    if (!l.length) return "(nenhuma lembrança guardada ainda)";
    return l
      .slice(0, 60)
      .map((m) => `- [${m.categoria}] ${m.texto}`)
      .join("\n");
  },
};

// Anotações rápidas ("anota aí: ...") e lembretes ficam separados das memórias.
export const Anotacoes = {
  async todas() {
    return Store.get("anotacoes", []);
  },
  async adicionar(texto) {
    const l = await this.todas();
    const n = { id: crypto.randomUUID().slice(0, 6), texto: limpar(texto), t: Date.now() };
    l.unshift(n);
    await Store.set("anotacoes", l.slice(0, 300));
    return n;
  },
  async apagar(id) {
    const l = await this.todas();
    const r = l.filter((a) => a.id !== id);
    await Store.set("anotacoes", r);
    return l.length - r.length;
  },
};

export const Lembretes = {
  async todos() {
    const l = await Store.get("lembretes", []);
    const agora = Date.now();
    return l.filter((x) => x.quando > agora - 60_000);
  },
  async adicionar(texto, quando) {
    const l = await this.todos();
    const id = Math.floor(Math.random() * 2_000_000_000) + 1;
    l.push({ id, texto: limpar(texto), quando });
    l.sort((a, b) => a.quando - b.quando);
    await Store.set("lembretes", l);
    return id;
  },
  async remover(id) {
    const l = await this.todos();
    await Store.set("lembretes", l.filter((x) => x.id !== id));
  },
};
