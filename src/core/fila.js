// Fila de mensagens: se a IA estiver sem cota ou sem internet, a mensagem fica
// guardada (cifrada) e é enviada sozinha quando der. Só funciona com o app aberto.
import { Store } from "./storage.js";

const CHAVE = "fila";
const MAX = 5;

export const Fila = {
  itens: [],

  async carregar() {
    this.itens = await Store.get(CHAVE, []);
  },
  async _salvar() {
    await Store.set(CHAVE, this.itens);
  },
  async adicionar({ texto, imagens, visao, origem, donoVoz, espera }) {
    if (this.itens.length >= MAX) throw new Error(`A fila está cheia (${MAX} mensagens). Espere a IA voltar.`);
    const it = {
      id: crypto.randomUUID().slice(0, 8),
      t: Date.now(),
      tentativas: 0,
      proxima: Date.now() + Math.max(15, espera || 30) * 1000,
      texto,
      imagens: imagens || [],
      visao: visao || null,
      origem: origem || "texto",
      donoVoz: donoVoz ?? null,
    };
    this.itens.push(it);
    await this._salvar();
    return it;
  },
  async remover(id) {
    this.itens = this.itens.filter((i) => i.id !== id);
    await this._salvar();
  },
  async adiar(id, segundos) {
    const it = this.itens.find((i) => i.id === id);
    if (!it) return;
    it.tentativas++;
    it.proxima = Date.now() + segundos * 1000;
    await this._salvar();
  },
};
