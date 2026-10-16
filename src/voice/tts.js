// Voz do Freddy: TTS nativo do Android (offline) -> WAV -> cadeia de efeitos
// (graves, presença, "anel" metálico, saturação) para soar calmo, forte e levemente robótico.
// Nada aqui usa serviço pago nem envia texto para fora do celular.
import { TTSNativo, isNative } from "../core/native.js";
import { Config } from "../core/storage.js";

let ctx = null,
  analyser = null,
  geracao = 0,
  fonteAtual = null,
  dado = null;

const curva = (() => {
  const c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 512) - 1;
    c[i] = Math.tanh(2 * x) / Math.tanh(2);
  }
  return c;
})();

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(ctx.destination);
    dado = new Uint8Array(analyser.fftSize);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function limparTexto(t) {
  return t
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/[*_`#>~|]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dividir(texto) {
  const frases = texto.split(/(?<=[.!?…])\s+/);
  const out = [];
  for (const f of frases) {
    let resto = f;
    while (resto.length > 220) {
      let corte = resto.lastIndexOf(",", 200);
      if (corte < 60) corte = resto.lastIndexOf(" ", 200);
      if (corte < 20) corte = 200;
      out.push(resto.slice(0, corte + 1).trim());
      resto = resto.slice(corte + 1);
    }
    if (resto.trim()) out.push(resto.trim());
  }
  // junta frases muito curtas
  const junto = [];
  for (const f of out) {
    if (junto.length && junto[junto.length - 1].length < 25) junto[junto.length - 1] += " " + f;
    else junto.push(f);
  }
  return junto;
}

function tocar(buffer, minhaGeracao) {
  return new Promise((resolve) => {
    const c = audio();
    const robo = Math.min(0.6, Math.max(0, Config.valores.vozRobo));
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.97;

    const graves = c.createBiquadFilter();
    graves.type = "lowshelf";
    graves.frequency.value = 200;
    graves.gain.value = 5;
    const presenca = c.createBiquadFilter();
    presenca.type = "peaking";
    presenca.frequency.value = 1800;
    presenca.Q.value = 0.9;
    presenca.gain.value = 3;
    const agudos = c.createBiquadFilter();
    agudos.type = "highshelf";
    agudos.frequency.value = 6500;
    agudos.gain.value = -5;
    src.connect(graves).connect(presenca).connect(agudos);

    const mix = c.createGain();
    // caminho seco
    const seco = c.createGain();
    seco.gain.value = 1 - robo;
    agudos.connect(seco).connect(mix);
    // modulação em anel (voz de máquina)
    const anel = c.createGain();
    anel.gain.value = 0;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 58;
    osc.connect(anel.gain);
    const umido = c.createGain();
    umido.gain.value = robo * 1.4;
    agudos.connect(anel).connect(umido).connect(mix);
    // eco metálico curtinho (caixa de som de animatrônico)
    const atraso = c.createDelay(0.05);
    atraso.delayTime.value = 0.011;
    const fb = c.createGain();
    fb.gain.value = Math.min(0.45, 0.8 * robo);
    const comb = c.createGain();
    comb.gain.value = robo * 0.9;
    agudos.connect(atraso);
    atraso.connect(fb).connect(atraso);
    atraso.connect(comb).connect(mix);

    const sat = c.createWaveShaper();
    sat.curve = curva;
    sat.oversample = "2x";
    const comp = c.createDynamicsCompressor();
    const saida = c.createGain();
    saida.gain.value = 0.95;
    mix.connect(sat).connect(comp).connect(saida).connect(analyser);

    osc.start();
    fonteAtual = src;
    src.onended = () => {
      try {
        osc.stop();
      } catch {}
      if (fonteAtual === src) fonteAtual = null;
      resolve();
    };
    if (minhaGeracao !== geracao) return resolve();
    src.start();
  });
}

async function sintetizarNativo(texto) {
  const v = Config.valores;
  const ab = await TTSNativo.sintetizar(texto, { pitch: v.vozPitch, rate: v.vozVelocidade, voz: v.vozNome });
  return audio().decodeAudioData(ab);
}

function falarWeb(texto, minhaGeracao) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    u.pitch = Math.max(0, Math.min(2, Config.valores.vozPitch));
    u.rate = Config.valores.vozVelocidade;
    u.onend = u.onerror = () => resolve();
    if (minhaGeracao !== geracao) return resolve();
    speechSynthesis.speak(u);
  });
}

export const Voz = {
  falando: false,

  async falar(texto, { onInicio, onFim } = {}) {
    this.parar();
    const minha = ++geracao;
    const limpo = limparTexto(texto);
    if (!limpo) return;
    this.falando = true;
    onInicio?.();
    try {
      const trechos = dividir(limpo);
      if (!isNative) {
        await falarWeb(limpo, minha);
      } else {
        let proximo = sintetizarNativo(trechos[0]);
        for (let i = 0; i < trechos.length; i++) {
          const buf = await proximo;
          if (minha !== geracao) break;
          proximo = i + 1 < trechos.length ? sintetizarNativo(trechos[i + 1]) : null;
          proximo?.catch(() => {});
          await tocar(buf, minha);
          if (minha !== geracao) break;
        }
      }
    } catch (e) {
      console.warn("TTS falhou:", e?.message);
      await falarWeb(limpo, minha); // último recurso
    } finally {
      if (minha === geracao) {
        this.falando = false;
        onFim?.();
      }
    }
  },

  parar() {
    geracao++;
    try {
      fonteAtual?.stop();
    } catch {}
    fonteAtual = null;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    this.falando = false;
  },

  /** 0..1 — usado para animar a boca do avatar */
  nivel() {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(dado);
    let s = 0;
    for (let i = 0; i < dado.length; i++) {
      const v = (dado[i] - 128) / 128;
      s += v * v;
    }
    return Math.min(1, Math.sqrt(s / dado.length) * 4);
  },

  listarVozes: () => TTSNativo.vozes(),
};
