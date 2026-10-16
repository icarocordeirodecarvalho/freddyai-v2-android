// Camada única de acesso ao Android. No navegador (desenvolvimento) cai em
// alternativas limitadas — nunca finge sucesso em ações perigosas.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNative = Capacitor.isNativePlatform();
const P = isNative ? registerPlugin("FreddyNative") : null;

const soNoApp = () => {
  throw new Error("Essa função só existe no app Android.");
};

// ---------------- armazenamento cifrado ----------------
// App: AES-256-GCM com chave no Android Keystore.
// Navegador (só desenvolvimento): AES-GCM com chave não-exportável no IndexedDB.
let dbp = null;
function abrirDB() {
  if (!dbp)
    dbp = new Promise((ok, err) => {
      const r = indexedDB.open("freddy", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("k");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => err(r.error);
    });
  return dbp;
}
async function chaveWeb() {
  const db = await abrirDB();
  const existente = await new Promise((ok) => {
    const q = db.transaction("k").objectStore("k").get("master");
    q.onsuccess = () => ok(q.result);
    q.onerror = () => ok(null);
  });
  if (existente) return existente;
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise((ok) => {
    const tx = db.transaction("k", "readwrite");
    tx.objectStore("k").put(k, "master");
    tx.oncomplete = ok;
  });
  return k;
}
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const Secure = {
  async set(key, value) {
    if (isNative) return P.secureSet({ key, value });
    const k = await chaveWeb();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(key) }, k, new TextEncoder().encode(value))
    );
    const todo = new Uint8Array(12 + ct.length);
    todo.set(iv);
    todo.set(ct, 12);
    localStorage.setItem("fz:" + key, b64(todo));
  },
  async get(key) {
    if (isNative) return (await P.secureGet({ key })).value;
    const s = localStorage.getItem("fz:" + key);
    if (!s) return null;
    try {
      const k = await chaveWeb();
      const t = unb64(s);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: t.slice(0, 12), additionalData: new TextEncoder().encode(key) }, k, t.slice(12));
      return new TextDecoder().decode(pt);
    } catch {
      return null;
    }
  },
  async remove(key) {
    if (isNative) return P.secureRemove({ key });
    localStorage.removeItem("fz:" + key);
  },
  async clear() {
    if (isNative) return P.secureClear();
    Object.keys(localStorage)
      .filter((k) => k.startsWith("fz:"))
      .forEach((k) => localStorage.removeItem(k));
  },
};

// ---------------- biometria / janela ----------------
export const Seguranca = {
  /** @returns {{disponivel:boolean, ok:boolean}} */
  async autenticar(titulo, subtitulo = "") {
    if (!isNative) return { disponivel: false, ok: false };
    return P.autenticar({ titulo, subtitulo });
  },
  async janelaSegura(ativo) {
    if (isNative) await P.janelaSegura({ ativo });
  },
};

// ---------------- voz (TTS nativo) ----------------
export const TTSNativo = {
  async vozes() {
    if (!isNative) return [];
    return (await P.listarVozes()).vozes || [];
  },
  /** devolve ArrayBuffer com um WAV */
  async sintetizar(texto, { pitch, rate, voz }) {
    if (!isNative) soNoApp();
    const { audio } = await P.falarParaArquivo({ texto, pitch, rate, voz: voz || "" });
    return unb64(audio).buffer;
  },
};

// ---------------- ações do celular ----------------
export const Celular = {
  buscarContato: (nome) => (isNative ? P.buscarContato({ nome }).then((r) => r.contatos) : soNoApp()),
  ligar: (numero) => (isNative ? P.ligar({ numero }) : soNoApp()),
  criarAlarme: (hora, minuto, rotulo) => (isNative ? P.criarAlarme({ hora, minuto, rotulo }) : soNoApp()),
  criarTimer: (segundos, rotulo) => (isNative ? P.criarTimer({ segundos, rotulo }) : soNoApp()),
  criarEvento: (o) => (isNative ? P.criarEvento(o) : soNoApp()),
  prepararSms: (numero, texto) => (isNative ? P.prepararSms({ numero, texto }) : soNoApp()),
};

// ---------------- notificações ----------------
export const Notificacoes = {
  async garantirPermissao() {
    if (!isNative) return false;
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== "granted") p = await LocalNotifications.requestPermissions();
    return p.display === "granted";
  },
  async agendar(id, titulo, texto, quando) {
    if (!(await this.garantirPermissao())) throw new Error("Permissão de notificações negada.");
    await LocalNotifications.schedule({
      notifications: [{ id, title: titulo, body: texto, schedule: { at: quando, allowWhileIdle: true } }],
    });
  },
  async cancelar(id) {
    if (isNative) await LocalNotifications.cancel({ notifications: [{ id }] });
  },
  async cancelarTodas() {
    if (!isNative) return;
    const p = await LocalNotifications.getPending();
    if (p.notifications.length) await LocalNotifications.cancel({ notifications: p.notifications });
  },
};
