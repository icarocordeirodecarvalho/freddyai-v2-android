// Roda depois de `cap add android` / `cap sync`.
// Aplica: permissões, plugin nativo FreddyNative, MainActivity segura e
// dependência do BiometricPrompt. É idempotente (pode rodar várias vezes).
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const raiz = "android";
if (!existsSync(raiz)) {
  console.error("Pasta android/ não existe. Rode: npx cap add android");
  process.exit(1);
}

const pkgPath = join(raiz, "app/src/main/java/com/freddyai/app");
mkdirSync(pkgPath, { recursive: true });
copyFileSync("native/android/FreddyNativePlugin.java", join(pkgPath, "FreddyNativePlugin.java"));
copyFileSync("native/android/MainActivity.java", join(pkgPath, "MainActivity.java"));

// ---------- AndroidManifest ----------
const manPath = join(raiz, "app/src/main/AndroidManifest.xml");
let man = readFileSync(manPath, "utf8");

const permissoes = [
  "android.permission.INTERNET",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.CALL_PHONE",
  "android.permission.READ_CONTACTS",
  "com.android.alarm.permission.SET_ALARM",
  "android.permission.USE_BIOMETRIC",
];
for (const p of permissoes) {
  if (!man.includes(`"${p}"`)) {
    man = man.replace("<application", `<uses-permission android:name="${p}" />\n    <application`);
  }
}
const features = [
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
  '<uses-feature android:name="android.hardware.telephony" android:required="false" />',
];
for (const f of features) {
  const nome = f.match(/name="([^"]+)"/)[1];
  if (!man.includes(nome)) man = man.replace("<application", `${f}\n    <application`);
}
// Segurança: sem backup automático e sem tráfego sem criptografia.
if (!man.includes("android:allowBackup=")) man = man.replace("<application", '<application android:allowBackup="false"');
else man = man.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
if (!man.includes("usesCleartextTraffic")) man = man.replace("<application", '<application android:usesCleartextTraffic="false"');
writeFileSync(manPath, man);

// ---------- build.gradle do app: BiometricPrompt ----------
const gradlePath = join(raiz, "app/build.gradle");
let g = readFileSync(gradlePath, "utf8");
if (!g.includes("androidx.biometric")) {
  g = g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'");
  writeFileSync(gradlePath, g);
}
console.log("[patch-android] ok");
