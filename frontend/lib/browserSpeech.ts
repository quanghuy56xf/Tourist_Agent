const VIETNAMESE = "Tiếng Việt";

export function speechLanguageLabel(language: string): string {
  if (language === "vi" || language === VIETNAMESE) return "vi-VN";
  return "en-US";
}

export function isBrowserSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export class SpeechCancelledError extends Error {
  constructor() {
    super("SPEECH_CANCELLED");
    this.name = "SpeechCancelledError";
  }
}

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().replace(/_/g, "-");
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    }, 800);
  });
}

function scoreVoice(voice: SpeechSynthesisVoice, langCode: string): number {
  const target = normalizeLang(langCode);
  const voiceLang = normalizeLang(voice.lang);
  const prefix = target.split("-")[0];
  let score = 0;

  if (voiceLang === target) score += 100;
  else if (voiceLang.startsWith(`${prefix}-`) || voiceLang === prefix) score += 60;

  if (score === 0) return 0;

  const name = voice.name.toLowerCase();
  const viHints = ["hoaimy", "hoai my", "vietnam", "việt", "vietnamese"];
  const enHints = ["jenny", "aria", "zira", "english", "david", "samantha"];
  const hints = prefix === "vi" ? viHints : enHints;
  if (hints.some((hint) => name.includes(hint))) score += 25;
  if (voice.localService) score += 5;

  return score;
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  langCode: string
): SpeechSynthesisVoice | null {
  const ranked = voices
    .map((voice) => ({ voice, score: scoreVoice(voice, langCode) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.voice ?? null;
}

/** Chỉ dùng browser TTS khi tìm được voice khớp ngôn ngữ. */
export function findBrowserVoice(language: string): SpeechSynthesisVoice | null {
  if (!isBrowserSpeechSupported()) return null;
  const langCode = speechLanguageLabel(language);
  return pickBestVoice(window.speechSynthesis.getVoices(), langCode);
}

export async function canUseBrowserSpeech(language: string): Promise<boolean> {
  if (!isBrowserSpeechSupported()) return false;
  const voices = await waitForVoices();
  const langCode = speechLanguageLabel(language);
  return pickBestVoice(voices, langCode) !== null;
}

type ActiveSpeech = {
  reject: (error: SpeechCancelledError) => void;
};

let activeSpeech: ActiveSpeech | null = null;
let speechSessionId = 0;

export function stopBrowserSpeech(): void {
  if (!isBrowserSpeechSupported()) return;
  speechSessionId += 1;
  window.speechSynthesis.cancel();
  if (activeSpeech) {
    activeSpeech.reject(new SpeechCancelledError());
    activeSpeech = null;
  }
}

export function isSpeechCancelled(error: unknown): boolean {
  return error instanceof SpeechCancelledError;
}

export async function speakWithBrowser(
  text: string,
  language: string,
  options?: { strictVoice?: boolean }
): Promise<void> {
  if (!isBrowserSpeechSupported()) {
    throw new Error("Browser speech not supported");
  }

  const trimmed = text.trim();
  if (!trimmed) return;

  stopBrowserSpeech();
  const session = speechSessionId;

  const voices = await waitForVoices();
  if (session !== speechSessionId) {
    throw new SpeechCancelledError();
  }
  const langCode = speechLanguageLabel(language);
  const voice = pickBestVoice(voices, langCode);

  if (!voice && options?.strictVoice) {
    throw new Error("No matching browser voice for language");
  }

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = voice?.lang ?? langCode;
  if (voice) utterance.voice = voice;
  utterance.rate = 1.0;

  return new Promise((resolve, reject) => {
    activeSpeech = {
      reject: (error) => {
        activeSpeech = null;
        reject(error);
      },
    };

    utterance.onend = () => {
      activeSpeech = null;
      resolve();
    };
    utterance.onerror = () => {
      activeSpeech = null;
      reject(new Error("Speech synthesis failed"));
    };

    window.speechSynthesis.speak(utterance);
  });
}
