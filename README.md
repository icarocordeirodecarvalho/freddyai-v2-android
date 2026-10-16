# FreddyAI 2.0

Assistente pessoal com a personalidade do Glamrock Freddy, feito para virar app Android (Capacitor).

## Como gerar o APK (sem PC, só GitHub)

1. Crie um repositório no GitHub e suba **todo o conteúdo desta pasta** (Termux: `git init`, `git add .`, `git commit`, `git push`).
2. No GitHub: aba **Actions → Build APK → Run workflow** (ou é automático a cada push na `main`).
3. Quando terminar, baixe o artefato **FreddyAI-apk** (`app-debug.apk`) e instale no celular.
4. Abra o app → ⚙ → cole sua chave gratuita de https://aistudio.google.com/apikey → **Testar**.

> O workflow roda `npm install`, `vite build`, `cap add android`, aplica `scripts/patch-android.mjs` (permissões, plugin nativo, biometria) e compila com Gradle.

## O que ele faz

| Pedido | Como funciona |
|---|---|
| Rodar no celular | App Capacitor (WebView + plugin nativo próprio `FreddyNative`) |
| Personalidade do Freddy | `src/core/personality.js` + seu lore (`src/core/lore.js`, só os trechos citados entram no prompt) |
| Voz própria | TTS do Android (offline) → WAV → efeitos Web Audio (graves, anel metálico, saturação). Ajuste tom/velocidade/robô em ⚙ |
| Pesquisar na web | Google Search embutido no Gemini (ferramenta `pesquisar_web`) |
| Lembretes / notificações | `@capacitor/local-notifications` |
| Alarme / timer | Intents oficiais do relógio |
| Agenda | Abre a Agenda já preenchida; você toca em Salvar |
| Anotar | Bloco de notas cifrado |
| Ligar | Busca nos contatos → **confirmação + biometria** → liga (`ACTION_CALL`) |
| SMS | Abre o app de mensagens com o texto pronto; você envia |
| Reconhecer sua voz | Impressão de voz local (MFCC). **Conveniência, não senha** |
| Lembranças | `salvar_memoria` / `esquecer_memoria`; veja e apague em *Meus dados* |
| Ver imagens | Câmera → Gemini |
| Visão **por atualização** | Câmera liberada; ele só vê um quadro **quando você manda mensagem** |
| Visão **contínua** | Observa sozinho quando a cena muda (limite por minuto, sem ferramentas) |
| Reconhecer rostos | Local (face-api), só rostos **cadastrados**, desligado por padrão |

## Segurança (o que é imposto em código)

- Chave de API, memórias, rostos, voz e conversa: **AES-256-GCM** com chave no **Android Keystore**. Sem backup automático.
- Bloqueio biométrico ao abrir/voltar de segundo plano; `FLAG_SECURE` (sem print/miniatura).
- Ligar, SMS e cadastrar rosto: confirmação na tela **e** biometria, decididas pelo código — o modelo não consegue pular.
- Bloqueio de códigos USSD (`*#`); números curtos só abrem o discador.
- Textos de pesquisa, imagens e lembranças são tratados como **dados**, não ordens (prompt + a visão contínua não tem ferramentas).
- Câmera desliga ao sair do app e por inatividade. Mic só grava quando você toca (não há escuta contínua).
- CSP restritiva: só conecta em `generativelanguage.googleapis.com`.
- Registro de atividade (ações do Freddy) em *Meus dados*.

## Limites honestos

- **Não foi compilado nem testado em aparelho** quando foi escrito (sem Android SDK/rede no ambiente). A lógica pura (ferramentas, prompt, MFCC) foi testada em Node; o resto pode precisar de pequenos ajustes no primeiro build. Se o Actions falhar, mande o log.
- A voz **não é idêntica** à do personagem: é um TTS comum com efeitos. Para ficar mais parecido, o ponto de troca é `src/voice/tts.js` (dá para plugar um TTS neural/clonado depois).
- Reconhecimento de voz do dono é fraco contra gravações. Reconhecimento facial depende de luz e pode errar; não use como segurança.
- Plano gratuito do Gemini tem cota (a visão contínua gasta bastante) e pode usar seus dados para melhorar produtos Google.
- Lembretes exatos precisam da permissão "Alarmes e lembretes" do Android; sem ela podem atrasar alguns minutos.
- Nomes de modelo mudam: se der erro 404, troque em ⚙ (padrões: `gemini-3.6-flash` e `gemini-3.5-flash-lite`).

## Rodar no navegador (desenvolvimento)

`npm install && npm run dev` — funciona chat, voz do navegador, câmera e rostos; ligar/alarme/agenda só existem no app.

## Problemas comuns

- Reconhecimento facial não carrega: confira se `public/models` foi gerado (`npm run build` copia de `node_modules/@vladmandic/face-api/model`). Se aparecer erro de CSP, o bundle do tfjs pode exigir `'unsafe-eval'` no `index.html` (só então, e ciente do custo de segurança).
- Sem voz: instale/ative o motor Google TTS em português nas configurações do Android.
