// Constantes e configurações padrão. Os nomes de modelo mudam com frequência:
// por isso ficam aqui E podem ser trocados nas Configurações do app.
export const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const PADRAO = {
  modeloChat: "gemini-3.6-flash",
  modeloRapido: "gemini-3.5-flash-lite", // transcrição e observação de câmera

  // voz
  falarRespostas: true,
  vozNome: "",
  vozPitch: 0.62,
  vozVelocidade: 0.92,
  vozRobo: 0.35, // 0..0.6 — quanto de efeito "animatrônico"

  // segurança
  bloqueioBiometrico: true,
  janelaSegura: true,
  somenteMinhaVoz: false, // exige voz reconhecida para ações sensíveis
  limiarVoz: 0.35,

  // privacidade
  salvarConversa: true,

  // visão
  visaoIntervaloSeg: 6,
  comentarMudancas: false,
  facesAtivo: false,
};

export const LIMITES = {
  maxHistorico: 24, // mensagens (texto) guardadas
  maxFerramentasPorTurno: 5,
  visaoPorMinuto: 6, // teto de chamadas de visão contínua
  maxMemorias: 200,
  maxAuditoria: 100,
  fotoMaxLado: 640,
  fotoQualidade: 0.7,
  inatividadeCameraMin: 5, // desliga câmera sozinha
  travarAposSeg: 60, // trava o app ao voltar do segundo plano
};
