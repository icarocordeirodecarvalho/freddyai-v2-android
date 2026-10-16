// Câmera: abre o stream, captura quadros em JPEG reduzido e miniaturas para detectar mudança.
import { LIMITES } from "../core/config.js";

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.frente = false;
    this.c = document.createElement("canvas");
    this.mini = document.createElement("canvas");
    this.mini.width = 32;
    this.mini.height = 24;
  }

  ativa() {
    return !!this.stream;
  }

  async ligar(frente = this.frente) {
    this.desligar();
    this.frente = frente;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: frente ? "user" : "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      throw new Error("Sem permissão para usar a câmera.");
    }
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  desligar() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  pronta() {
    return this.stream && this.video.videoWidth > 0 && this.video.readyState >= 2;
  }

  /** @returns {string|null} JPEG em base64 (sem prefixo) */
  capturar(maxLado = LIMITES.fotoMaxLado, qualidade = LIMITES.fotoQualidade) {
    if (!this.pronta()) return null;
    const { videoWidth: w, videoHeight: h } = this.video;
    const esc = Math.min(1, maxLado / Math.max(w, h));
    this.c.width = Math.round(w * esc);
    this.c.height = Math.round(h * esc);
    this.c.getContext("2d").drawImage(this.video, 0, 0, this.c.width, this.c.height);
    return this.c.toDataURL("image/jpeg", qualidade).split(",")[1];
  }

  /** elemento já desenhado com o último quadro (para detecção de rostos) */
  quadro() {
    return this.pronta() ? this.video : null;
  }

  /** miniatura 32x24 em tons de cinza */
  miniatura() {
    if (!this.pronta()) return null;
    const g = this.mini.getContext("2d", { willReadFrequently: true });
    g.drawImage(this.video, 0, 0, 32, 24);
    const d = g.getImageData(0, 0, 32, 24).data;
    const out = new Uint8Array(32 * 24);
    for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0;
    return out;
  }
}

/** diferença média normalizada (0..1) entre duas miniaturas */
export function diferenca(a, b) {
  if (!a || !b) return 1;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length / 255;
}
