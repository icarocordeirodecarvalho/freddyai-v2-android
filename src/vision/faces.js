// Reconhecimento facial LOCAL (face-api + modelos dentro do app).
// - Só reconhece rostos que VOCÊ cadastrou; o resto é sempre "desconhecido".
// - Os descritores (vetores numéricos, não fotos) ficam cifrados no Keystore.
// - Desligado por padrão. Dados faciais são dados pessoais sensíveis (LGPD): cadastre só com consentimento.
import { Store } from "../core/storage.js";

const LIMIAR = 0.5; // menor = mais rígido
let faceapi = null;
let pronto = false;
let carregando = null;
let rostos = null; // [{id, nome, descritores:[number[]]}]

async function carregarModelos() {
  if (pronto) return;
  if (!carregando) {
    carregando = (async () => {
      const m = await import("@vladmandic/face-api");
      faceapi = m.default?.nets ? m.default : m;
      try {
        await faceapi.tf.setBackend("webgl");
      } catch {}
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("./models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
      ]);
      pronto = true;
    })().catch((e) => {
      carregando = null;
      throw e;
    });
  }
  return carregando;
}

async function lista() {
  if (!rostos) rostos = await Store.get("rostos", []);
  return rostos;
}

async function detectar(el) {
  await carregarModelos();
  return faceapi
    .detectAllFaces(el, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptors();
}

export const Rostos = {
  async preparar() {
    await carregarModelos();
  },

  async lista() {
    return (await lista()).map((r) => ({ id: r.id, nome: r.nome, amostras: r.descritores.length }));
  },

  /** @returns {Promise<{total:number, nomes:string[], desconhecidos:number}>} */
  async identificar(el) {
    const base = await lista();
    const dets = await detectar(el);
    const nomes = [];
    let desconhecidos = 0;
    for (const d of dets) {
      let melhor = { nome: null, dist: 9 };
      for (const r of base)
        for (const desc of r.descritores) {
          const dist = faceapi.euclideanDistance(d.descriptor, desc);
          if (dist < melhor.dist) melhor = { nome: r.nome, dist };
        }
      if (melhor.dist < LIMIAR) nomes.push(melhor.nome);
      else desconhecidos++;
    }
    return { total: dets.length, nomes: [...new Set(nomes)], desconhecidos };
  },

  async cadastrar(el, nome) {
    const dets = await detectar(el);
    if (dets.length === 0) return { erro: "Não vi nenhum rosto na câmera." };
    if (dets.length > 1) return { erro: "Tem mais de um rosto na imagem. Deixe só a pessoa a cadastrar." };
    const base = await lista();
    let r = base.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
    if (!r) {
      r = { id: crypto.randomUUID().slice(0, 8), nome, descritores: [] };
      base.push(r);
    }
    r.descritores.push(Array.from(dets[0].descriptor));
    if (r.descritores.length > 6) r.descritores.shift();
    await Store.set("rostos", base);
    return { ok: true, nome, amostras: r.descritores.length };
  },

  async apagar(id) {
    const base = (await lista()).filter((r) => r.id !== id);
    rostos = base;
    await Store.set("rostos", base);
  },

  async apagarTodos() {
    rostos = [];
    await Store.set("rostos", []);
  },
};

export function resumoRostos(r) {
  if (!r || r.total === 0) return "Nenhum rosto detectado localmente.";
  const partes = [];
  if (r.nomes.length) partes.push("reconhecidos (cadastrados): " + r.nomes.join(", "));
  if (r.desconhecidos) partes.push(r.desconhecidos + " desconhecido(s)");
  return `Rostos detectados localmente: ${r.total} — ${partes.join("; ")}.`;
}
