import { fetchTTSStreamResponse, fetchTTSAudio } from "@/lib/api";
import {
  canStreamMpegAudio,
  playBlobResponse,
  playMpegStreamResponse,
} from "@/lib/ttsStreamPlayer";

let audioRef: HTMLAudioElement | null = null;
let objectUrlRef: string | null = null;
let abortRef: AbortController | null = null;
let playbackGeneration = 0;

function teardownPlaybackResources() {
  abortRef?.abort();
  abortRef = null;

  if (audioRef) {
    audioRef.pause();
    audioRef.currentTime = 0;
    audioRef.onended = null;
    audioRef.onerror = null;
    audioRef.src = "";
    audioRef = null;
  }

  if (objectUrlRef) {
    URL.revokeObjectURL(objectUrlRef);
    objectUrlRef = null;
  }
}

export function stopChatTts() {
  playbackGeneration += 1;
  teardownPlaybackResources();
}

export async function playChatTts(
  text: string,
  language: string,
  signal?: AbortSignal,
  persona?: "Companion"
): Promise<void> {
  const cleaned = text.trim();
  if (!cleaned) return;

  const generation = ++playbackGeneration;
  teardownPlaybackResources();

  const controller = new AbortController();
  abortRef = controller;
  const isActive = () => generation === playbackGeneration;

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  const hooks = {
    onAudio: (audio: HTMLAudioElement) => {
      if (isActive()) {
        audioRef = audio;
      }
    },
    onObjectUrl: (url: string) => {
      if (isActive()) {
        objectUrlRef = url;
      }
    },
  };

  try {
    try {
      const response = await fetchTTSStreamResponse(
        cleaned,
        language,
        controller.signal,
        persona
      );
      if (!isActive() || controller.signal.aborted) return;

      if (canStreamMpegAudio()) {
        await playMpegStreamResponse(response, controller.signal, hooks);
      } else {
        await playBlobResponse(response, controller.signal, hooks);
      }
      return;
    } catch {
      if (!isActive() || controller.signal.aborted) return;
    }

    const url = await fetchTTSAudio(cleaned, language, controller.signal, persona);
    if (!isActive() || controller.signal.aborted) {
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
    if (isActive()) {
      teardownPlaybackResources();
    }
  }
}
