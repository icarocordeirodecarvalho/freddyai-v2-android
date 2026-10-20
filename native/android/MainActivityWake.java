package com.freddyai.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

/** Versão da MainActivity com o "Ei Freddy". Copiada por scripts/patch-wake.mjs. */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FreddyNativePlugin.class);
        registerPlugin(FreddyEscutaPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        FreddyEscutaPlugin.aoReceberIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        FreddyEscutaPlugin.aoReceberIntent(intent);
    }

    @Override
    public void onStart() {
        super.onStart();
        FreddyEscutaService.definirAppVisivel(true); // o microfone é do app enquanto ele está na tela
        FreddyEscutaService.cancelarAviso(this);
    }

    @Override
    public void onStop() {
        super.onStop();
        FreddyEscutaService.definirAppVisivel(false);
    }
}
