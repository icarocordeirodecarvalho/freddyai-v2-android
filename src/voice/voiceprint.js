// "Impressão de voz" leve, 100% local (estatísticas de MFCC).
// IMPORTANTE: isto é uma conveniência de personalização, NÃO uma autenticação forte —
// uma gravação da sua voz pode enganar. Ações sensíveis exigem também biometria do celular.
import { Store } from "../core/storage.js";

const SR = 16000,
  NFFT = 512,
  FRAME = 400,
  HOP = 160,
  NMEL = 26,
  NMFCC = 13;

const hamming = new Float32Array(FRAME).map((_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
const mel = (h) => 2595 * Math.log10(1 + h / 700);
const hz = (m) => 700 * (10 ** (m / 2595) - 1);

const banco = (() => {
  const pts = Array.from({ length: NMEL + 2 }, (_, i) => hz(mel(100) + ((mel(7000) - mel(100)) * i) / (NMEL + 1)));
  const bins = pts.map((f) => Math.floor(((NFFT + 1) * f) / SR));
  const fb = [];
  for (let m = 1; m <= NMEL; m++) {
    const f = new Float32Array(NFFT / 2 + 1);
    for (let k = bins[m - 1]; k < bins[m]; k++) f[k] = (k - bins[m - 1]) / Math.max(1, bins[m] - bins[m - 1]);
    for (let k = bins[m]; k < bins[m + 1]; k++) f[k] = (bins[m + 1] - k) / Math.max(1, bins[m + 1] - bins[m]);
    fb.push(f);
  }
  return fb;
})();

const dct = Array.from({ length: NMFCC }, (_, n) => Float32Array.from({ length: NMEL }, (_, m) => Math.cos((Math.PI * n * (m + 0.5)) / NMEL)));

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang),
      wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k,
          b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** @param {Float32Array} pcm 16 kHz mono @returns {number[]|null} vetor de 24 dimensões */
export function extrairVetor(pcm) {
  if (pcm.length < SR * 0.8) return null;
  const x = new Float32Array(pcm.length);
  x[0] = pcm[0];
  for (let i = 1; i < pcm.length; i++) x[i] = pcm[i] - 0.97 * pcm[i - 1];

  const quadros = [];
  const re = new Float32Array(NFFT),
    im = new Float32Array(NFFT);
  for (let s = 0; s + FRAME <= x.length; s += HOP) {
    re.fill(0);
    im.fill(0);
    let en = 0;
    for (let i = 0; i < FRAME; i++) {
      re[i] = x[s + i] * hamming[i];
      en += re[i] * re[i];
    }
    fft(re, im);
    const mfcc = new Float32Array(NMFCC);
    const logs = new Float32Array(NMEL);
    for (let m = 0; m < NMEL; m++) {
      let e = 0;
      const f = banco[m];
      for (let k = 0; k <= NFFT / 2; k++) e += f[k] * (re[k] * re[k] + im[k] * im[k]);
      logs[m] = Math.log(e + 1e-10);
    }
    for (let n = 0; n < NMFCC; n++) {
      let v = 0;
      for (let m = 0; m < NMEL; m++) v += dct[n][m] * logs[m];
      mfcc[n] = v;
    }
    quadros.push({ en, mfcc });
  }
  const ordenados = quadros.map((q) => q.en).sort((a, b) => a - b);
  const corte = ordenados[Math.floor(ordenados.length * 0.45)];
  const vozeados = quadros.filter((q) => q.en > corte).map((q) => q.mfcc);
  if (vozeados.length < 60) return null;

  const media = new Array(NMFCC - 1).fill(0);
  const desvio = new Array(NMFCC - 1).fill(0);
  for (const q of vozeados) for (let i = 1; i < NMFCC; i++) media[i - 1] += q[i] / vozeados.length;
  for (const q of vozeados) for (let i = 1; i < NMFCC; i++) desvio[i - 1] += (q[i] - media[i - 1]) ** 2 / vozeados.length;
  return [...media, ...desvio.map(Math.sqrt)];
}

export function pontuar(modelo, v) {
  let soma = 0;
  for (let i = 0; i < v.length; i++) {
    const sigma = modelo.sigma[i];
    soma += ((v[i] - modelo.centro[i]) / sigma) ** 2;
  }
  return Math.exp(-0.5 * (soma / v.length));
}

export function criarModelo(vetores) {
  const n = vetores[0].length;
  const centro = new Array(n).fill(0);
  for (const v of vetores) for (let i = 0; i < n; i++) centro[i] += v[i] / vetores.length;
  const sigma = centro.map((c, i) => {
    const varianca = vetores.reduce((s, v) => s + (v[i] - c) ** 2, 0) / vetores.length;
    return Math.sqrt(varianca + (0.15 * Math.max(Math.abs(c), 1) + 0.3) ** 2);
  });
  return { centro, sigma, amostras: vetores.length };
}

export const ImpressaoVoz = {
  async existe() {
    return !!(await Store.get("voiceprint", null));
  },
  async cadastrar(vetores) {
    await Store.set("voiceprint", criarModelo(vetores));
  },
  async apagar() {
    await Store.remove("voiceprint");
  },
  /** @returns {number|null} 0..1, ou null se não há voz cadastrada / áudio curto */
  async comparar(pcm) {
    const m = await Store.get("voiceprint", null);
    const v = extrairVetor(pcm);
    if (!m || !v) return null;
    return pontuar(m, v);
  },
};
