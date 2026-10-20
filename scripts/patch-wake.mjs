// Adiciona o "Ei Freddy" ao projeto Android. Rode DEPOIS de `cap add/sync` e do
// patch-android.mjs, e ANTES do gradle. Idempotente.
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, renameSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const raiz = "android";
if (!existsSync(raiz)) {
  console.error("Pasta android/ não existe. Rode `npx cap add android` antes.");
  process.exit(1);
}

// ---------- Java ----------
const pkg = join(raiz, "app/src/main/java/com/freddyai/app");
mkdirSync(pkg, { recursive: true });
copyFileSync("native/android/FreddyEscutaService.java", join(pkg, "FreddyEscutaService.java"));
copyFileSync("native/android/FreddyEscutaPlugin.java", join(pkg, "FreddyEscutaPlugin.java"));
copyFileSync("native/android/MainActivityWake.java", join(pkg, "MainActivity.java"));

// ---------- Manifest ----------
const manPath = join(raiz, "app/src/main/AndroidManifest.xml");
let man = readFileSync(manPath, "utf8");
for (const p of ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_MICROPHONE"]) {
  if (!man.includes(`"${p}"`)) man = man.replace("<application", `<uses-permission android:name="${p}" />\n    <application`);
}
if (!man.includes("FreddyEscutaService")) {
  man = man.replace("</application>", '    <service android:name=".FreddyEscutaService" android:exported="false" android:foregroundServiceType="microphone" />\n    </application>');
}
writeFileSync(manPath, man);

// ---------- Gradle: biblioteca Vosk ----------
const gradlePath = join(raiz, "app/build.gradle");
let g = readFileSync(gradlePath, "utf8");
if (!g.includes("vosk-android")) {
  g = g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.alphacephei:vosk-android:0.3.75'\n    implementation 'net.java.dev.jna:jna:5.18.1@aar'");
  writeFileSync(gradlePath, g);
}

// ---------- Modelo de voz (pt) ----------
const assets = join(raiz, "app/src/main/assets");
const destino = join(assets, "model-pt");
if (!existsSync(join(destino, "am"))) {
  const url = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip";
  const zip = "/tmp/vosk-model-pt.zip";
  console.log("[patch-wake] baixando modelo de voz:", url);
  execSync(`curl -L -f --retry 3 -o ${zip} ${url}`, { stdio: "inherit" });
  const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");
  console.log("[patch-wake] SHA-256 do modelo:", sha);
  if (process.env.VOSK_SHA256 && process.env.VOSK_SHA256 !== sha) {
    console.error("SHA-256 diferente do esperado. Abortando.");
    process.exit(1);
  }
  mkdirSync(assets, { recursive: true });
  rmSync(destino, { recursive: true, force: true });
  rmSync("/tmp/vosk-pt", { recursive: true, force: true });
  mkdirSync("/tmp/vosk-pt", { recursive: true });
  execSync(`unzip -q -o ${zip} -d /tmp/vosk-pt`, { stdio: "inherit" });
  const pastas = readdirSync("/tmp/vosk-pt", { withFileTypes: true })
    .filter(e => e.isDirectory());
  if (pastas.length !== 1 || !existsSync(join("/tmp/vosk-pt", pastas[0].name, "am"))) {
    console.error("[patch-wake] Estrutura inesperada no modelo Vosk.");
    process.exit(1);
  }
  renameSync(join("/tmp/vosk-pt", pastas[0].name), destino);
}
console.log("[patch-wake] ok");
