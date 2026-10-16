// Copia os modelos de reconhecimento facial (que vêm dentro do pacote npm)
// para public/models, para rodarem 100% offline dentro do app.
import { cpSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const origem = join("node_modules", "@vladmandic", "face-api", "model");
const destino = join("public", "models");
const prefixos = [
  "tiny_face_detector_model",
  "face_landmark_68_tiny_model",
  "face_recognition_model",
];

if (!existsSync(origem)) {
  console.warn("[copy-models] face-api ainda não instalado; pulando.");
  process.exit(0);
}

mkdirSync(destino, { recursive: true });
let n = 0;
for (const arq of readdirSync(origem)) {
  if (prefixos.some((p) => arq.startsWith(p))) {
    cpSync(join(origem, arq), join(destino, arq));
    n++;
  }
}
console.log(`[copy-models] ${n} arquivos de modelo copiados.`);
if (n < 6) console.warn("[copy-models] ATENÇÃO: esperava pelo menos 6 arquivos (3 .json + 3 .bin).");
