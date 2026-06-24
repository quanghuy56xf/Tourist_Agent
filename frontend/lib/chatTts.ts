import { fetchTTSAudio } from "@/lib/api";

let audioRef: HTMLAudioElement | null = null;
let objectUrlRef: string | null = null;
let abortRef: AbortController | null = null;

function cleanup() {
  abortRef?.abort();
  abortRef = null;

  if (audioRef) {
    audioRef.pause();
    audioRef.currentTime = 0;
    audioRef.onended = null;
    audioRef.onerror = null;
    audioRef = null;
  }

  if (objectUrlRef) {
    URL.revokeObjectURL(objectUrlRef);
    objectUrlRef = null;
  }
}

export function stopChatTts() {
  cleanup();
}

export async function playChatTts(
  text: string,
  language: string,
  signal?: AbortSignal,
  persona?: "Companion"
): Promise<void> {
  const cleaned = text.trim();
  if (!cleaned) return;

  cleanup();

  const controller = new AbortController();
  abortRef = controller;

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const url = await fetchTTSAudio(cleaned, language, controller.signal, persona);
    if (controller.signal.aborted) {
      URL.revokeObjectURL(url);
      return;
    }

    objectUrlRef = url;
    const audio = new Audio(url);
    audioRef = audio;

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio playback failed"));
      audio.play().catch(reject);
    });
  } finally {
    signal?.removeEventListener("abort", onAbort);
    cleanup();
  }
}
