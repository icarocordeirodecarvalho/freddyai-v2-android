// Gravação de fala com detecção simples de silêncio (VAD por energia).
// Só grava quando a pessoa toca no microfone — não existe escuta contínua.

export function iniciarGravacao({ maxMs = 20000, silencioMs = 1200, esperaFalaMs = 7000, onNivel } = {}) {
  let pedirParada = false;
  let pararFn = null;

  const resultado = (async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      throw new Error("Sem permissão para usar o microfone.");
    }
    const ctx = new AudioContext({ sampleRate: 16000 });
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mudo = ctx.createGain();
    mudo.gain.value = 0;
    src.connect(proc);
    proc.connect(mudo);
    mudo.connect(ctx.destination);

    const blocos = [];
    let falou = false,
      acima = 0,
      ultimoFalou = 0,
      ruido = 0;
    const inicio = performance.now();

    return new Promise((resolve) => {
      let fechado = false;
      const encerrar = (motivo) => {
        if (fechado) return;
        fechado = true;
        proc.onaudioprocess = null;
        try {
          proc.disconnect();
          src.disconnect();
        } catch {}
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        const total = blocos.reduce((s, b) => s + b.length, 0);
        const pcm = new Float32Array(total);
        let o = 0;
        for (const b of blocos) {
          pcm.set(b, o);
          o += b.length;
        }
        resolve(falou ? { pcm, sampleRate: 16000, motivo } : null);
      };
      pararFn = () => encerrar("manual");
      if (pedirParada) return encerrar("manual");

      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        blocos.push(new Float32Array(d));
        let s = 0;
        for (let i = 0; i < d.length; i++) s += d[i] * d[i];
        const rms = Math.sqrt(s / d.length);
        onNivel?.(rms);
        const t = performance.now() - inicio;
        if (t < 400) {
          ruido = Math.max(ruido, rms);
          return;
        }
        const limiar = Math.max(0.02, ruido * 2.5);
        if (rms > limiar) {
          acima++;
          if (acima >= 2) falou = true;
          ultimoFalou = t;
        } else acima = 0;
        if (falou && t - ultimoFalou > silencioMs) encerrar("silêncio");
        else if (!falou && t > esperaFalaMs) encerrar("sem fala");
        else if (t > maxMs) encerrar("tempo");
      };
    });
  })();

  return {
    resultado,
    parar() {
      pedirParada = true;
      pararFn?.();
    },
  };
}

export function pcmParaWavBase64(pcm, sampleRate = 16000) {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const u8 = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
