import { Config, Store, Auditoria } from "./core/storage.js";
import { Gemini } from "./core/gemini.js";
import { Agente } from "./core/agent.js";
import { Memoria, Anotacoes, Lembretes } from "./core/memory.js";
import { Seguranca, Notificacoes, isNative } from "./core/native.js";
import { LIMITES } from "./core/config.js";
import { Voz } from "./voice/tts.js";
import { iniciarGravacao, pcmParaWavBase64 } from "./voice/recorder.js";
import { ImpressaoVoz, extrairVetor } from "./voice/voiceprint.js";
import { Visao } from "./vision/visao.js";
import { Rostos } from "./vision/faces.js";

const $ = (id) => document.getElementById(id);
const mostrar = (id) => $(id).classList.remove("oculto");
const esconder = (id) => $(id).classList.add("oculto");

function el(tag, cls, texto) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texto != null) e.textContent = texto; // sempre textContent: nada de innerHTML com dados
  return e;
}

// ---------------------------------------------------------------- avatar
const FRAMES = [1, 2, 3, 4].map((n) => `./icons/animation/f${n}.png`);
FRAMES.forEach((s) => (new Image().src = s));
const SEQ_IDLE = [1, 1, 2, 1, 1];
const SEQ_FALA = [1, 2, 1, 3, 4];
let seq = SEQ_IDLE,
  idx = 0,
  ultimoFrame = 0;
function animar(t) {
  const passo = Voz.falando ? 170 : 600;
  if (t - ultimoFrame > passo) {
    ultimoFrame = t;
    seq = Voz.falando ? SEQ_FALA : SEQ_IDLE;
    idx = (idx + 1) % seq.length;
    $("frame").src = FRAMES[seq[idx] - 1];
  }
  requestAnimationFrame(animar);
}
requestAnimationFrame(animar);

// ---------------------------------------------------------------- UI utilitária
let toastT = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("oculto");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("oculto"), 3800);
}
function status(txt, ativo = false) {
  $("status").textContent = txt;
  $("status").classList.toggle("ativo", ativo);
}
function msg(papel, texto) {
  const m = el("div", "msg " + papel, texto);
  $("chat").appendChild(m);
  while ($("chat").children.length > 60) $("chat").firstChild.remove();
  $("chat").scrollTop = $("chat").scrollHeight;
  return m;
}

function confirmar(titulo, detalhe) {
  return new Promise((resolve) => {
    $("modalTitulo").textContent = titulo;
    $("modalTexto").textContent = detalhe || "";
    mostrar("modal");
    const fim = (v) => {
      esconder("modal");
      $("modalSim").onclick = $("modalNao").onclick = null;
      resolve(v);
    };
    $("modalSim").onclick = () => fim(true);
    $("modalNao").onclick = () => fim(false);
  });
}

// ---------------------------------------------------------------- núcleo
const agente = new Agente({
  status: (s) => status(s.startsWith("ferramenta:") ? "agindo: " + s.slice(11) : "pensando…", true),
  confirmar,
  avisar: (m) => toast(m),
  cadastrarRosto: (nome) => visao.cadastrarRosto(nome),
});

const visao = new Visao({
  video: $("video"),
  agente,
  onEstado: (modo) => {
    document.querySelectorAll(".modo").forEach((b) => b.classList.toggle("ativo", b.dataset.modo === modo));
    $("btnCamera").classList.toggle("ativo", modo !== "off");
    $("pip").classList.toggle("oculto", modo === "off");
    $("pipModo").textContent = modo === "continuo" ? "contínua" : "atualização";
    if (modo === "off") esconder("obs");
  },
  onObservacao: (t) => {
    $("obs").textContent = "👁 " + t;
    mostrar("obs");
  },
  onComentario: (t) => falar(t),
  onAviso: (m) => toast(m),
});

function falar(texto) {
  if (!Config.valores.falarRespostas) return;
  Voz.falar(texto, { onInicio: () => status("falando", true), onFim: () => status("pronto") });
}

let ocupado = false;
async function enviar(texto, origem = "texto", donoVoz = null) {
  texto = texto.trim();
  if (!texto || ocupado) return;
  if (!Gemini.temChave()) {
    toast("Cole sua chave da API nas Configurações.");
    return abrirSheet("sheetConfig");
  }
  ocupado = true;
  Voz.parar();
  msg("eu", texto);
  $("avatar").classList.add("pensando");
  try {
    const v = await visao.prepararMensagem();
    const resposta = await agente.responder(texto, { origem, donoVoz, imagem: v.imagem, visao: v.visao });
    msg("freddy", resposta);
    falar(resposta);
  } catch (e) {
    msg("sistema", e.message || "Algo deu errado.");
  } finally {
    ocupado = false;
    $("avatar").classList.remove("pensando");
    if (!Voz.falando) status("pronto");
  }
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("texto").value;
  $("texto").value = "";
  enviar(t);
});

// ---------------------------------------------------------------- microfone
let gravacao = null;
$("btnMic").addEventListener("click", async () => {
  if (gravacao) return gravacao.parar();
  if (ocupado) return;
  Voz.parar();
  const mic = $("btnMic");
  try {
    gravacao = iniciarGravacao({
      onNivel: (r) => {
        const n = $("nivel");
        n.style.opacity = Math.min(1, r * 14);
        n.style.transform = `scale(${1 + Math.min(0.5, r * 6)})`;
      },
    });
    mic.classList.add("gravando");
    $("avatar").classList.add("ouvindo");
    status("ouvindo…", true);
    const r = await gravacao.resultado;
    gravacao = null;
    mic.classList.remove("gravando");
    $("avatar").classList.remove("ouvindo");
    $("nivel").style.opacity = 0;
    if (!r) return status("pronto"), toast("Não ouvi nada.");

    mic.classList.add("processando");
    status("entendendo…", true);
    const wav = pcmParaWavBase64(r.pcm, r.sampleRate);
    let donoVoz = null;
    try {
      const s = await ImpressaoVoz.comparar(r.pcm);
      if (s != null) donoVoz = s >= Config.valores.limiarVoz;
    } catch {}
    const texto = await Gemini.transcrever(Config.valores.modeloRapido, wav);
    mic.classList.remove("processando");
    if (!texto || /^\[sil[eê]ncio\]$/i.test(texto)) return status("pronto"), toast("Não entendi, tenta de novo?");
    await enviar(texto, "voz", donoVoz);
  } catch (e) {
    gravacao = null;
    mic.classList.remove("gravando", "processando");
    $("avatar").classList.remove("ouvindo");
    status("pronto");
    msg("sistema", e.message);
  }
});

// ---------------------------------------------------------------- sheets
function abrirSheet(id) {
  mostrar(id);
  if (id === "sheetDados") renderDados();
  if (id === "sheetConfig") preencherConfig();
}
document.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => esconder(b.dataset.fechar)));
$("btnConfig").onclick = () => abrirSheet("sheetConfig");
$("btnDados").onclick = () => abrirSheet("sheetDados");
$("btnCamera").onclick = () => abrirSheet("sheetVisao");
$("btnVoz").onclick = async () => {
  await Config.salvar({ falarRespostas: !Config.valores.falarRespostas });
  if (!Config.valores.falarRespostas) Voz.parar();
  $("btnVoz").classList.toggle("mudo", !Config.valores.falarRespostas);
  toast(Config.valores.falarRespostas ? "Voz ligada" : "Voz desligada");
};

document.querySelectorAll(".modo").forEach((b) =>
  b.addEventListener("click", async () => {
    try {
      await visao.definirModo(b.dataset.modo);
      esconder("sheetVisao");
    } catch (e) {
      toast(e.message);
    }
  })
);
$("btnVirar").onclick = async () => {
  if (visao.modo === "off") return toast("Ligue a câmera primeiro.");
  try {
    await visao.camera.ligar(!visao.camera.frente);
  } catch (e) {
    toast(e.message);
  }
};

function lista(containerId, itens, vazio, render) {
  const c = $(containerId);
  c.replaceChildren();
  if (!itens.length) return c.appendChild(el("div", "vazio", vazio));
  for (const it of itens) c.appendChild(render(it));
}
function item(titulo, sub, aoApagar) {
  const d = el("div", "item");
  const t = el("div");
  t.appendChild(document.createTextNode(titulo));
  if (sub) t.appendChild(el("small", null, sub));
  d.appendChild(t);
  if (aoApagar) {
    const b = el("button", null, "🗑");
    b.setAttribute("aria-label", "Apagar");
    b.onclick = aoApagar;
    d.appendChild(b);
  }
  return d;
}

async function renderDados() {
  const mem = await Memoria.todas();
  lista("listaMem", mem, "Nenhuma lembrança ainda.", (m) =>
    item(m.texto, m.categoria, async () => {
      await Memoria.esquecer(m.id);
      renderDados();
    })
  );
  const lem = await Lembretes.todos();
  lista("listaLemb", lem, "Nenhum lembrete.", (l) =>
    item(l.texto, new Date(l.quando).toLocaleString("pt-BR"), async () => {
      await Notificacoes.cancelar(l.id);
      await Lembretes.remover(l.id);
      renderDados();
    })
  );
  const notas = await Anotacoes.todas();
  lista("listaNotas", notas, "Nenhuma anotação.", (n) =>
    item(n.texto, new Date(n.t).toLocaleDateString("pt-BR"), async () => {
      await Anotacoes.apagar(n.id);
      renderDados();
    })
  );
  const aud = await Auditoria.listar();
  lista("listaAud", aud.slice(0, 30), "Nada ainda.", (a) => item(`${a.acao} — ${a.resultado}`, new Date(a.t).toLocaleString("pt-BR")));
}
$("btnAddMem").onclick = async () => {
  const t = $("novaMem").value.trim();
  if (t.length < 3) return;
  await Memoria.adicionar(t, "manual");
  $("novaMem").value = "";
  renderDados();
};

// ---------------------------------------------------------------- configurações
async function preencherConfig() {
  const c = Config.valores;
  $("modeloChat").value = c.modeloChat;
  $("modeloRapido").value = c.modeloRapido;
  $("cfgFalar").checked = c.falarRespostas;
  $("cfgPitch").value = c.vozPitch;
  $("cfgVel").value = c.vozVelocidade;
  $("cfgRobo").value = c.vozRobo;
  $("cfgBio").checked = c.bloqueioBiometrico;
  $("cfgJanela").checked = c.janelaSegura;
  $("cfgSoVoz").checked = c.somenteMinhaVoz;
  $("cfgSalvar").checked = c.salvarConversa;
  $("cfgInt").value = c.visaoIntervaloSeg;
  $("rotInt").textContent = c.visaoIntervaloSeg;
  $("cfgComentar").checked = c.comentarMudancas;
  $("cfgFaces").checked = c.facesAtivo;
  $("chave").value = Gemini.temChave() ? "••••••••••••" : "";
  $("vozStatus").textContent = (await ImpressaoVoz.existe()) ? "Voz cadastrada neste aparelho." : "Nenhuma voz cadastrada.";

  const sel = $("cfgVoz");
  sel.replaceChildren(new Option("Padrão do aparelho", ""));
  try {
    for (const v of await Voz.listarVozes()) sel.add(new Option(`${v.nome}${v.offline ? "" : " (online)"}`, v.nome));
  } catch {}
  sel.value = c.vozNome;
  renderRostos();
}

const ligar = (id, chave, tipo = "checked", conv = (v) => v) =>
  $(id).addEventListener("change", async () => {
    await Config.salvar({ [chave]: conv($(id)[tipo]) });
    if (chave === "janelaSegura") Seguranca.janelaSegura(Config.valores.janelaSegura);
  });
ligar("cfgFalar", "falarRespostas");
ligar("cfgPitch", "vozPitch", "value", Number);
ligar("cfgVel", "vozVelocidade", "value", Number);
ligar("cfgRobo", "vozRobo", "value", Number);
ligar("cfgVoz", "vozNome", "value");
ligar("cfgBio", "bloqueioBiometrico");
ligar("cfgJanela", "janelaSegura");
ligar("cfgSoVoz", "somenteMinhaVoz");
ligar("cfgSalvar", "salvarConversa");
ligar("cfgComentar", "comentarMudancas");
ligar("cfgInt", "visaoIntervaloSeg", "value", Number);
$("cfgInt").addEventListener("input", () => ($("rotInt").textContent = $("cfgInt").value));
$("cfgFaces").addEventListener("change", async () => {
  if ($("cfgFaces").checked) {
    const ok = await confirmar("Ligar reconhecimento facial?", "Dados faciais são sensíveis. Use só com consentimento das pessoas cadastradas. Tudo fica cifrado e local.");
    if (!ok) return ($("cfgFaces").checked = false);
  }
  await Config.salvar({ facesAtivo: $("cfgFaces").checked });
});
$("cfgSoVoz").addEventListener("change", async () => {
  if ($("cfgSoVoz").checked && !(await ImpressaoVoz.existe())) toast("Cadastre sua voz para isso funcionar.");
});
$("modeloChat").addEventListener("change", () => Config.salvar({ modeloChat: $("modeloChat").value.trim() }));
$("modeloRapido").addEventListener("change", () => Config.salvar({ modeloRapido: $("modeloRapido").value.trim() }));

$("btnSalvarChave").onclick = async () => {
  const k = $("chave").value.trim();
  if (!k || k.startsWith("•")) return toast("Cole a chave primeiro.");
  await Gemini.salvarChave(k);
  $("chave").value = "••••••••••••";
  toast("Chave salva (cifrada).");
};
$("btnTestar").onclick = async () => {
  try {
    toast("Testando…");
    await Gemini.testar(Config.valores.modeloChat);
    toast("Conexão OK ✔");
  } catch (e) {
    toast(e.message);
  }
};
$("btnTesteVoz").onclick = () => Voz.falar("Fala, amigo! Eu sou o Freddy. Pronto para o show?");
$("btnLimparConversa").onclick = async () => {
  await agente.limpar();
  $("chat").replaceChildren();
  toast("Conversa apagada.");
};

async function renderRostos() {
  const l = await Rostos.lista().catch(() => []);
  lista("listaRostos", l, "Nenhum rosto cadastrado.", (r) =>
    item(r.nome, r.amostras + " amostra(s)", async () => {
      await Rostos.apagar(r.id);
      renderRostos();
    })
  );
}
$("btnCadRosto").onclick = async () => {
  const nome = $("nomeRosto").value.trim();
  if (!nome) return toast("Digite o nome.");
  if (!Config.valores.facesAtivo) return toast("Ligue o reconhecimento facial antes.");
  const ok = await confirmar(`Cadastrar rosto como "${nome}"?`, "Só com o consentimento da pessoa.");
  if (!ok) return;
  toast("Olhando…");
  const r = await visao.cadastrarRosto(nome).catch((e) => ({ erro: e.message }));
  toast(r.ok ? `Rosto de ${nome} cadastrado.` : r.erro);
  $("nomeRosto").value = "";
  renderRostos();
};

// cadastro de voz
const FRASES = [
  "Hoje o dia está bonito e eu estou pronto para o show.",
  "Meu amigo Freddy sempre me ajuda a lembrar das coisas importantes.",
  "Quero ouvir uma música animada antes de dormir esta noite.",
  "Amanhã cedo preciso acordar para resolver várias tarefas.",
  "Quem fala comigo agora é o dono deste celular.",
];
let vetoresVoz = [];
function mostrarFraseVoz() {
  $("fraseVoz").textContent = FRASES[vetoresVoz.length];
  $("progVoz").textContent = `Frase ${vetoresVoz.length + 1} de ${FRASES.length}`;
}
$("btnCadVoz").onclick = () => {
  vetoresVoz = [];
  mostrarFraseVoz();
  mostrar("sheetVoz");
};
$("btnApagarVoz").onclick = async () => {
  await ImpressaoVoz.apagar();
  toast("Voz apagada.");
  preencherConfig();
};
$("btnGravarVoz").onclick = async () => {
  const b = $("btnGravarVoz");
  if (gravacao) return gravacao.parar();
  try {
    b.textContent = "Gravando… (toque para parar)";
    gravacao = iniciarGravacao({ silencioMs: 1500, maxMs: 12000 });
    const r = await gravacao.resultado;
    gravacao = null;
    b.textContent = "Gravar";
    const v = r && extrairVetor(r.pcm);
    if (!v) return toast("Não consegui captar bem. Fale mais perto e mais tempo.");
    vetoresVoz.push(v);
    if (vetoresVoz.length < FRASES.length) return mostrarFraseVoz();
    await ImpressaoVoz.cadastrar(vetoresVoz);
    esconder("sheetVoz");
    toast("Voz cadastrada!");
    preencherConfig();
  } catch (e) {
    gravacao = null;
    b.textContent = "Gravar";
    toast(e.message);
  }
};

$("btnApagarTudo").onclick = async () => {
  if (!(await confirmar("Apagar TUDO?", "Chave, lembranças, rostos, voz, anotações, lembretes e conversa. Não dá para desfazer."))) return;
  if (Config.valores.bloqueioBiometrico) {
    const r = await Seguranca.autenticar("Apagar todos os dados");
    if (r.disponivel && !r.ok) return;
  }
  await visao.definirModo("off");
  await Notificacoes.cancelarTodas().catch(() => {});
  await Store.apagarTudo();
  localStorage.clear();
  location.reload();
};

// ---------------------------------------------------------------- trava
let saiuEm = 0;
async function destravar() {
  if (!Config.valores.bloqueioBiometrico || !isNative) return esconder("trava");
  const r = await Seguranca.autenticar("Desbloquear FreddyAI");
  if (!r.disponivel || r.ok) esconder("trava"); // sem tela de bloqueio no aparelho: não há como autenticar
}
function travar() {
  if (Config.valores.bloqueioBiometrico && isNative) mostrar("trava");
}
$("btnTravar").onclick = () => {
  Voz.parar();
  travar();
};
$("btnDestravar").onclick = destravar;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    saiuEm = Date.now();
    Voz.parar();
  } else if (saiuEm && Date.now() - saiuEm > LIMITES.travarAposSeg * 1000) {
    travar();
    destravar();
  }
});

// ---------------------------------------------------------------- boot
(async function iniciar() {
  await Config.carregar();
  await Gemini.carregarChave();
  await agente.carregar();
  Seguranca.janelaSegura(Config.valores.janelaSegura).catch(() => {});
  $("btnVoz").classList.toggle("mudo", !Config.valores.falarRespostas);
  if (Config.valores.bloqueioBiometrico && isNative) {
    mostrar("trava");
    await destravar();
  }
  for (const m of agente.historico.slice(-6)) msg(m.role === "user" ? "eu" : "freddy", m.texto);
  if (!Gemini.temChave()) {
    msg("freddy", "Fala, amigo! Antes do show, preciso da sua chave da API do Google AI Studio. Abra as configurações (⚙) e cole ela lá.");
    abrirSheet("sheetConfig");
  } else if (!agente.historico.length) {
    msg("freddy", "Fala, amigo! Toque no microfone ou escreva. Estou pronto para ajudar.");
  }
  status("pronto");
})();
