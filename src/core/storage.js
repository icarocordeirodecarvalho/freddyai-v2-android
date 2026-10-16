// Tudo que é pessoal (chave de API, memórias, rostos, voz, anotações...)
// passa por aqui e é gravado cifrado.
import { Secure } from "./native.js";
import { PADRAO } from "./config.js";

export const Store = {
  async get(chave, padrao = null) {
    try {
      const v = await Secure.get(chave);
      return v == null ? padrao : JSON.parse(v);
    } catch {
      return padrao;
    }
  },
  async set(chave, valor) {
    await Secure.set(chave, JSON.stringify(valor));
  },
  async remove(chave) {
    await Secure.remove(chave);
  },
  async apagarTudo() {
    await Secure.clear();
  },
};

export const Config = {
  valores: { ...PADRAO },
  async carregar() {
    this.valores = { ...PADRAO, ...(await Store.get("config", {})) };
    return this.valores;
  },
  async salvar(parcial) {
    Object.assign(this.valores, parcial);
    await Store.set("config", this.valores);
  },
};

// Registro de tudo que o Freddy fez no seu celular (auditoria local).
export const Auditoria = {
  async registrar(acao, detalhe, resultado) {
    const lista = await Store.get("auditoria", []);
    lista.unshift({ t: Date.now(), acao, detalhe: String(detalhe).slice(0, 200), resultado: String(resultado).slice(0, 120) });
    await Store.set("auditoria", lista.slice(0, 100));
  },
  listar: () => Store.get("auditoria", []),
};
