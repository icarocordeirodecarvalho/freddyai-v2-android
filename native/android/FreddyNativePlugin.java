package com.freddyai.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.ContactsContract;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Base64;
import android.view.WindowManager;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Ponte nativa do FreddyAI:
 *  - armazenamento cifrado (AES-256-GCM, chave no Android Keystore)
 *  - TTS nativo -> arquivo WAV (o JS aplica o efeito "robô" e toca)
 *  - ligar / contatos / alarme / timer / agenda / SMS (sempre via Intents oficiais)
 *  - autenticação biométrica (BiometricPrompt)
 */
@CapacitorPlugin(
    name = "FreddyNative",
    permissions = {
        @Permission(alias = "call", strings = { Manifest.permission.CALL_PHONE }),
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS })
    }
)
public class FreddyNativePlugin extends Plugin {

    // ------------------------------------------------------------------
    // ARMAZENAMENTO CIFRADO
    // ------------------------------------------------------------------
    private static final String KS_ALIAS = "freddyai_master_v1";
    private static final String PREFS = "freddy_secure";

    private SecretKey chave() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(KS_ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(
                new KeyGenParameterSpec.Builder(
                    KS_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build()
            );
            return kg.generateKey();
        }
        return (SecretKey) ks.getKey(KS_ALIAS, null);
    }

    private String cifrar(String nome, String texto) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, chave());
        c.updateAAD(nome.getBytes(StandardCharsets.UTF_8)); // amarra o dado ao nome da chave
        byte[] iv = c.getIV();
        byte[] ct = c.doFinal(texto.getBytes(StandardCharsets.UTF_8));
        byte[] tudo = new byte[iv.length + ct.length];
        System.arraycopy(iv, 0, tudo, 0, iv.length);
        System.arraycopy(ct, 0, tudo, iv.length, ct.length);
        return Base64.encodeToString(tudo, Base64.NO_WRAP);
    }

    private String decifrar(String nome, String b64) throws Exception {
        byte[] tudo = Base64.decode(b64, Base64.NO_WRAP);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, chave(), new GCMParameterSpec(128, tudo, 0, 12));
        c.updateAAD(nome.getBytes(StandardCharsets.UTF_8));
        return new String(c.doFinal(tudo, 12, tudo.length - 12), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void secureSet(PluginCall call) {
        String k = call.getString("key");
        String v = call.getString("value");
        if (k == null || v == null) { call.reject("key/value obrigatórios"); return; }
        try {
            getContext().getSharedPreferences(PREFS, 0).edit().putString(k, cifrar(k, v)).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Falha ao cifrar");
        }
    }

    @PluginMethod
    public void secureGet(PluginCall call) {
        String k = call.getString("key");
        if (k == null) { call.reject("key obrigatória"); return; }
        String b64 = getContext().getSharedPreferences(PREFS, 0).getString(k, null);
        JSObject r = new JSObject();
        if (b64 == null) { r.put("value", JSObject.NULL); call.resolve(r); return; }
        try {
            r.put("value", decifrar(k, b64));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Falha ao decifrar");
        }
    }

    @PluginMethod
    public void secureRemove(PluginCall call) {
        String k = call.getString("key");
        if (k != null) getContext().getSharedPreferences(PREFS, 0).edit().remove(k).apply();
        call.resolve();
    }

    @PluginMethod
    public void secureClear(PluginCall call) {
        getContext().getSharedPreferences(PREFS, 0).edit().clear().apply();
        call.resolve();
    }

    // ------------------------------------------------------------------
    // JANELA SEGURA (anti-print)
    // ------------------------------------------------------------------
    @PluginMethod
    public void janelaSegura(PluginCall call) {
        final boolean ativo = call.getBoolean("ativo", true);
        getActivity().runOnUiThread(() -> {
            if (ativo) getActivity().getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    // ------------------------------------------------------------------
    // BIOMETRIA
    // ------------------------------------------------------------------
    private int autenticadores() {
        return Build.VERSION.SDK_INT >= 30
            ? (BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            : (BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
    }

    @PluginMethod
    public void autenticar(PluginCall call) {
        final String titulo = call.getString("titulo", "Confirmar");
        final String subtitulo = call.getString("subtitulo", "");
        getActivity().runOnUiThread(() -> {
            JSObject r = new JSObject();
            int auth = autenticadores();
            int can = BiometricManager.from(getContext()).canAuthenticate(auth);
            if (can != BiometricManager.BIOMETRIC_SUCCESS) {
                r.put("disponivel", false);
                r.put("ok", false);
                r.put("codigo", can);
                call.resolve(r);
                return;
            }
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(titulo)
                .setSubtitle(subtitulo)
                .setAllowedAuthenticators(auth)
                .build();
            BiometricPrompt prompt = new BiometricPrompt(
                (FragmentActivity) getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        r.put("disponivel", true);
                        r.put("ok", true);
                        call.resolve(r);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        r.put("disponivel", true);
                        r.put("ok", false);
                        r.put("erro", String.valueOf(errString));
                        call.resolve(r);
                    }
                }
            );
            prompt.authenticate(info);
        });
    }

    // ------------------------------------------------------------------
    // TTS NATIVO -> WAV
    // ------------------------------------------------------------------
    private TextToSpeech tts;
    private boolean ttsPronto = false;
    private final List<Runnable> filaTts = new ArrayList<>();
    private final Map<String, Object[]> pendentes = new ConcurrentHashMap<>();

    private void garantirTts(Runnable quandoPronto) {
        if (tts != null && ttsPronto) { quandoPronto.run(); return; }
        filaTts.add(quandoPronto);
        if (tts == null) {
            tts = new TextToSpeech(getContext(), status -> {
                ttsPronto = (status == TextToSpeech.SUCCESS);
                if (ttsPronto) {
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String id) {}

                        @Override
                        public void onDone(String id) {
                            Object[] p = pendentes.remove(id);
                            if (p == null) return;
                            PluginCall c = (PluginCall) p[0];
                            File f = (File) p[1];
                            try {
                                FileInputStream in = new FileInputStream(f);
                                ByteArrayOutputStream out = new ByteArrayOutputStream();
                                byte[] buf = new byte[16384];
                                int n;
                                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                                in.close();
                                JSObject r = new JSObject();
                                r.put("audio", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                                c.resolve(r);
                            } catch (Exception e) {
                                c.reject("Falha ao ler áudio do TTS");
                            } finally {
                                f.delete();
                            }
                        }

                        @Override
                        public void onError(String id) {
                            Object[] p = pendentes.remove(id);
                            if (p == null) return;
                            ((PluginCall) p[0]).reject("Erro no TTS");
                            ((File) p[1]).delete();
                        }
                    });
                }
                List<Runnable> copia = new ArrayList<>(filaTts);
                filaTts.clear();
                for (Runnable r : copia) r.run();
            });
        }
    }

    @PluginMethod
    public void listarVozes(PluginCall call) {
        garantirTts(() -> {
            if (!ttsPronto) { call.reject("TTS indisponível"); return; }
            JSArray lista = new JSArray();
            try {
                for (Voice v : tts.getVoices()) {
                    if (!"pt".equalsIgnoreCase(v.getLocale().getLanguage())) continue;
                    JSObject o = new JSObject();
                    o.put("nome", v.getName());
                    o.put("local", v.getLocale().toLanguageTag());
                    o.put("offline", !v.isNetworkConnectionRequired());
                    lista.put(o);
                }
            } catch (Exception ignorado) {}
            JSObject r = new JSObject();
            r.put("vozes", lista);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void falarParaArquivo(PluginCall call) {
        final String texto = call.getString("texto", "");
        final float pitch = call.getFloat("pitch", 0.7f);
        final float rate = call.getFloat("rate", 0.95f);
        final String voz = call.getString("voz", "");
        if (texto.trim().isEmpty()) { call.reject("texto vazio"); return; }
        garantirTts(() -> {
            if (!ttsPronto) { call.reject("TTS indisponível"); return; }
            try {
                tts.setLanguage(Locale.forLanguageTag("pt-BR"));
                if (!voz.isEmpty()) {
                    for (Voice v : tts.getVoices()) {
                        if (v.getName().equals(voz)) { tts.setVoice(v); break; }
                    }
                }
                tts.setPitch(pitch);
                tts.setSpeechRate(rate);
                File f = File.createTempFile("tts", ".wav", getContext().getCacheDir());
                String id = UUID.randomUUID().toString();
                pendentes.put(id, new Object[] { call, f });
                int r = tts.synthesizeToFile(texto, new Bundle(), f, id);
                if (r != TextToSpeech.SUCCESS) {
                    pendentes.remove(id);
                    f.delete();
                    call.reject("Falha ao sintetizar");
                }
            } catch (Exception e) {
                call.reject("Falha no TTS");
            }
        });
    }

    // ------------------------------------------------------------------
    // CONTATOS / LIGAÇÃO
    // ------------------------------------------------------------------
    private static String normalizar(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "")
            .toLowerCase(Locale.ROOT)
            .trim();
    }

    private static String soDigitos(String s) {
        return s == null ? "" : s.replaceAll("[^0-9+]", "");
    }

    @PluginMethod
    public void buscarContato(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contatosCb");
            return;
        }
        fazerBuscaContato(call);
    }

    @PermissionCallback
    private void contatosCb(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) fazerBuscaContato(call);
        else call.reject("Permissão de contatos negada");
    }

    private void fazerBuscaContato(PluginCall call) {
        String q = normalizar(call.getString("nome", ""));
        if (q.isEmpty()) { call.reject("nome vazio"); return; }
        JSArray res = new JSArray();
        Set<String> vistos = new HashSet<>();
        ContentResolver cr = getContext().getContentResolver();
        Cursor c = null;
        try {
            c = cr.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[] {
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                },
                null, null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
            );
            while (c != null && c.moveToNext() && res.length() < 6) {
                String nome = c.getString(0);
                String num = c.getString(1);
                if (nome != null && normalizar(nome).contains(q)) {
                    if (vistos.add(normalizar(nome) + "|" + soDigitos(num))) {
                        JSObject o = new JSObject();
                        o.put("nome", nome);
                        o.put("numero", num);
                        res.put(o);
                    }
                }
            }
        } catch (Exception e) {
            call.reject("Falha ao ler contatos");
            return;
        } finally {
            if (c != null) c.close();
        }
        JSObject r = new JSObject();
        r.put("contatos", res);
        call.resolve(r);
    }

    @PluginMethod
    public void ligar(PluginCall call) {
        String num = soDigitos(call.getString("numero", ""));
        String bruto = call.getString("numero", "");
        // Bloqueia códigos USSD / MMI (*#...) — são um vetor clássico de abuso.
        if (bruto.contains("*") || bruto.contains("#") || num.length() < 3) {
            call.reject("Número inválido");
            return;
        }
        // Números curtos (emergência etc.) só abrem o discador: a pessoa aperta o botão.
        if (num.length() <= 4 || getPermissionState("call") == PermissionState.GRANTED) {
            iniciarLigacao(call, num, num.length() > 4);
        } else {
            requestPermissionForAlias("call", call, "ligacaoCb");
        }
    }

    @PermissionCallback
    private void ligacaoCb(PluginCall call) {
        String num = soDigitos(call.getString("numero", ""));
        iniciarLigacao(call, num, getPermissionState("call") == PermissionState.GRANTED);
    }

    private void iniciarLigacao(PluginCall call, String num, boolean direta) {
        try {
            Intent i = new Intent(direta ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(num)));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject r = new JSObject();
            r.put("modo", direta ? "direta" : "discador");
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Não consegui iniciar a ligação");
        }
    }

    // ------------------------------------------------------------------
    // ALARME / TIMER / AGENDA / SMS  (Intents oficiais do Android)
    // ------------------------------------------------------------------
    @PluginMethod
    public void criarAlarme(PluginCall call) {
        int h = call.getData().optInt("hora", -1);
        int m = call.getData().optInt("minuto", -1);
        if (h < 0 || h > 23 || m < 0 || m > 59) { call.reject("Horário inválido"); return; }
        try {
            Intent i = new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, h)
                .putExtra(AlarmClock.EXTRA_MINUTES, m)
                .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("rotulo", "FreddyAI"))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Nenhum app de relógio disponível");
        }
    }

    @PluginMethod
    public void criarTimer(PluginCall call) {
        int s = call.getData().optInt("segundos", -1);
        if (s < 1 || s > 86400) { call.reject("Duração inválida"); return; }
        try {
            Intent i = new Intent(AlarmClock.ACTION_SET_TIMER)
                .putExtra(AlarmClock.EXTRA_LENGTH, s)
                .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("rotulo", "FreddyAI"))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Nenhum app de relógio disponível");
        }
    }

    @PluginMethod
    public void criarEvento(PluginCall call) {
        long ini = call.getData().optLong("inicio", 0);
        long fim = call.getData().optLong("fim", 0);
        if (ini <= 0) { call.reject("Data inválida"); return; }
        if (fim <= ini) fim = ini + 3600_000L;
        try {
            // Abre a agenda já preenchida; a pessoa só toca em "Salvar" (nada é gravado sem ela ver).
            Intent i = new Intent(Intent.ACTION_INSERT)
                .setData(CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, call.getString("titulo", "Evento"))
                .putExtra(CalendarContract.Events.EVENT_LOCATION, call.getString("local", ""))
                .putExtra(CalendarContract.Events.DESCRIPTION, call.getString("descricao", ""))
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, ini)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, fim)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Nenhum app de agenda disponível");
        }
    }

    @PluginMethod
    public void prepararSms(PluginCall call) {
        String num = soDigitos(call.getString("numero", ""));
        if (num.length() < 3) { call.reject("Número inválido"); return; }
        try {
            // Abre o app de mensagens com o texto pronto; quem envia é a pessoa.
            Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(num)))
                .putExtra("sms_body", call.getString("texto", ""))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Nenhum app de mensagens disponível");
        }
    }
}
