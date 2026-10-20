package com.freddyai.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Ponte JS <-> serviço de escuta "Ei Freddy". */
@CapacitorPlugin(
    name = "FreddyEscuta",
    permissions = { @Permission(alias = "mic", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class FreddyEscutaPlugin extends Plugin {

    private static FreddyEscutaPlugin instancia;
    private static volatile boolean pendente = false;

    @Override
    public void load() {
        instancia = this;
    }

    /** Chamado pela MainActivity quando o app foi aberto pelo "Ei Freddy". */
    public static void aoReceberIntent(Intent i) {
        if (i != null && i.getBooleanExtra(FreddyEscutaService.EXTRA_ATIVAR, false)) {
            i.removeExtra(FreddyEscutaService.EXTRA_ATIVAR);
            pendente = true;
            if (instancia != null) instancia.notifyListeners("ativado", new JSObject(), true);
        }
    }

    private boolean podeSobrepor() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ativo", FreddyEscutaService.rodando);
        r.put("sobreposicao", podeSobrepor());
        r.put("microfone", getPermissionState("mic") == PermissionState.GRANTED);
        r.put("modeloOk", FreddyEscutaService.modeloIncluido(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void iniciar(PluginCall call) {
        if (!FreddyEscutaService.modeloIncluido(getContext())) {
            call.reject("Esta versão do app não inclui o modelo de voz do \"Ei Freddy\".");
            return;
        }
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            requestPermissionForAlias("mic", call, "micCb");
            return;
        }
        subir(call);
    }

    @PermissionCallback
    private void micCb(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) subir(call);
        else call.reject("Permissão de microfone negada");
    }

    private void subir(PluginCall call) {
        try {
            Context c = getContext();
            ContextCompat.startForegroundService(c, new Intent(c, FreddyEscutaService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("Não consegui iniciar a escuta");
        }
    }

    @PluginMethod
    public void parar(PluginCall call) {
        Context c = getContext();
        c.stopService(new Intent(c, FreddyEscutaService.class));
        call.resolve();
    }

    @PluginMethod
    public void pedirSobreposicao(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não consegui abrir a tela de permissão");
        }
    }

    /** Devolve (e apaga) o aviso de "fui aberto pelo Ei Freddy". */
    @PluginMethod
    public void ativacaoPendente(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ativar", pendente);
        pendente = false;
        call.resolve(r);
    }
}
