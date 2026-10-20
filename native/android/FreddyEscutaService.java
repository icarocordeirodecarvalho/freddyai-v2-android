package com.freddyai.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Escuta "Ei Freddy" 100% no aparelho (Vosk, modelo pequeno de português).
 * Nada de áudio sai do celular. Só roda quando o usuário liga em Configurações e
 * enquanto o app NÃO está na tela (quando o app aparece, o microfone é liberado).
 */
public class FreddyEscutaService extends Service implements RecognitionListener {

    static final String CANAL_FIXO = "freddy_escuta";
    static final String CANAL_AVISO = "freddy_aviso";
    static final int ID_FIXO = 4711;
    static final int ID_AVISO = 4712;
    public static final String ACAO_PARAR = "com.freddyai.app.PARAR_ESCUTA";
    static final String EXTRA_ATIVAR = "freddy_ativar";

    // "ei freddy", "hey fredy", "oi fred"... (já sem acentos e em minúsculas)
    private static final Pattern GATILHO = Pattern.compile("\\b(ei|hei|hey|ae|oi|ola)\\s+fre+d");

    public static volatile boolean rodando = false;
    private static volatile boolean appVisivel = false;
    private static FreddyEscutaService instancia;

    private final Handler main = new Handler(Looper.getMainLooper());
    private Model modelo;
    private Recognizer reconhecedor;
    private SpeechService fala;
    private long ultimoGatilho = 0;

    /** Chamado pela MainActivity: com o app na tela o microfone é do app. */
    public static void definirAppVisivel(boolean visivel) {
        appVisivel = visivel;
        final FreddyEscutaService s = instancia;
        if (s != null) s.main.post(s::atualizarEscuta);
    }

    public static void cancelarAviso(Context c) {
        ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(ID_AVISO);
    }

    public static boolean modeloIncluido(Context c) {
        try {
            String[] f = c.getAssets().list("model-pt");
            return f != null && f.length > 0;
        } catch (IOException e) {
            return false;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACAO_PARAR.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        criarCanais();
        Intent abrir = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent piAbrir = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent parar = new Intent(this, FreddyEscutaService.class).setAction(ACAO_PARAR);
        PendingIntent piParar = PendingIntent.getService(this, 2, parar, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(this, CANAL_FIXO)
            .setContentTitle("FreddyAI está ouvindo")
            .setContentText("Diga \"Ei Freddy\". O áudio fica só no celular.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(piAbrir)
            .addAction(0, "Parar", piParar)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        if (Build.VERSION.SDK_INT >= 30) startForeground(ID_FIXO, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        else startForeground(ID_FIXO, n);

        instancia = this;
        rodando = true;
        if (modelo == null) carregarModeloEmSegundoPlano();
        else main.post(this::atualizarEscuta);
        return START_NOT_STICKY;
    }

    private void criarCanais() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CANAL_FIXO, "Escuta \"Ei Freddy\"", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(CANAL_AVISO, "Chamado do Freddy", NotificationManager.IMPORTANCE_HIGH));
    }

    // ---------------------------------------------------------------- modelo
    private void carregarModeloEmSegundoPlano() {
        new Thread(() -> {
            try {
                File pasta = prepararModelo();
                Model m = new Model(pasta.getAbsolutePath());
                main.post(() -> {
                    if (!rodando) { m.close(); return; }
                    modelo = m;
                    atualizarEscuta();
                });
            } catch (Throwable e) {
                main.post(this::stopSelf);
            }
        }, "freddy-modelo").start();
    }

    private File prepararModelo() throws IOException {
        File destino = new File(getFilesDir(), "model-pt");
        File marca = new File(destino, ".ok");
        if (marca.exists()) return destino;
        apagar(destino);
        copiarAsset("model-pt", destino);
        marca.createNewFile();
        return destino;
    }

    private void copiarAsset(String origem, File destino) throws IOException {
        AssetManager am = getAssets();
        String[] filhos = am.list(origem);
        if (filhos != null && filhos.length > 0) {
            destino.mkdirs();
            for (String f : filhos) copiarAsset(origem + "/" + f, new File(destino, f));
            return;
        }
        try (InputStream in = am.open(origem); OutputStream out = new FileOutputStream(destino)) {
            byte[] buf = new byte[32768];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        } catch (FileNotFoundException e) {
            destino.mkdirs(); // era uma pasta vazia
        }
    }

    private void apagar(File f) {
        File[] fs = f.listFiles();
        if (fs != null) for (File x : fs) apagar(x);
        f.delete();
    }

    // ---------------------------------------------------------------- escuta
    private void atualizarEscuta() {
        if (modelo == null || !rodando) return;
        boolean deveOuvir = !appVisivel;
        if (deveOuvir && fala == null) iniciarEscuta();
        else if (!deveOuvir && fala != null) pararEscuta();
    }

    private void iniciarEscuta() {
        try {
            reconhecedor = new Recognizer(modelo, 16000.0f);
            fala = new SpeechService(reconhecedor, 16000.0f);
            if (!fala.startListening(this)) pararEscuta();
        } catch (IOException e) {
            pararEscuta();
        }
    }

    private void pararEscuta() {
        if (fala != null) {
            fala.stop();
            fala.shutdown();
            fala = null;
        }
        if (reconhecedor != null) {
            reconhecedor.close();
            reconhecedor = null;
        }
    }

    private static String normalizar(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
    }

    private void checar(String json, String campo) {
        try {
            String texto = normalizar(new JSONObject(json).optString(campo, ""));
            if (!texto.isEmpty() && GATILHO.matcher(texto).find()) disparar();
        } catch (Exception ignorado) {}
    }

    @Override public void onPartialResult(String h) { checar(h, "partial"); }
    @Override public void onResult(String h) { checar(h, "text"); }
    @Override public void onFinalResult(String h) { checar(h, "text"); }
    @Override public void onError(Exception e) { main.post(() -> { pararEscuta(); main.postDelayed(this::atualizarEscuta, 3000); }); }
    @Override public void onTimeout() {}

    private void disparar() {
        long agora = SystemClock.elapsedRealtime();
        if (agora - ultimoGatilho < 5000) return;
        ultimoGatilho = agora;
        main.post(() -> {
            pararEscuta(); // libera o microfone para o app
            Intent i = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_ATIVAR, true);
            try { startActivity(i); } catch (Exception ignorado) {}
            // Plano B: em versões novas do Android a abertura direta pode ser bloqueada;
            // a notificação garante que um toque abra o Freddy.
            PendingIntent pi = PendingIntent.getActivity(this, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new NotificationCompat.Builder(this, CANAL_AVISO)
                .setContentTitle("Ei Freddy!")
                .setContentText("Toque para falar comigo")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setTimeoutAfter(15000)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build();
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(ID_AVISO, n);
            // se o app não subir, volta a escutar
            main.postDelayed(this::atualizarEscuta, 8000);
        });
    }

    @Override
    public void onDestroy() {
        rodando = false;
        instancia = null;
        pararEscuta();
        if (modelo != null) {
            modelo.close();
            modelo = null;
        }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
