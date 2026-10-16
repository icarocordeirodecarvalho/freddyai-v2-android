package com.freddyai.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O plugin precisa ser registrado ANTES do super.onCreate.
        registerPlugin(FreddyNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Segurança: bloqueia captura de tela e esconde o conteúdo na tela de apps recentes.
        // O app pode desligar isso nas configurações (FreddyNative.janelaSegura).
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}
