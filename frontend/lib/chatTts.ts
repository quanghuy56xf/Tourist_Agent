import { fetchTTSAudio, fetchTTSStreamResponse } from "@/lib/api";
import {
  configurePlaybackAudio,
  getSharedTtsAudio,
  isIOS,
  isSharedTtsAudio,
  playAudioFromObjectUrl,
  playPreloadedAudio,
  preloadAudioFromObjectUrl,
  primeTtsAudioPlayback,
  TTS_SEGMENT_END_TRIM_SECONDS,
} from "@/lib/ttsPlayback";
import { splitTextForTtsSegments } from "@/lib/ttsSegments";
import {
  canStreamMpegAudio,
  playMpegStreamResponse,
} from "@/lib/ttsStreamPlayer";

let audioRef: HTMLAudioElement | null = null;
let objectUrlRef: string | null = null;
let abortRef: AbortController | null = null;
let playbackGeneration = 0;
let globalMuted = false;

export function setChatTtsMuted(muted: boolean) {
  globalMuted = muted;
  if (audioRef) {
    audioRef.muted = muted;
  }
}

function teardownPlaybackResources() {
  abortRef?.abort();
  abortRef = null;

  if (audioRef) {
    audioRef.pause();
    audioRef.currentTime = 0;
    audioRef.onended = null;
    audioRef.onerror = null;
    audioRef.src = "";
    if (!isSharedTtsAudio(audioRef)) {
      audioRef = null;
    }
  }

  if (objectUrlRef?.startsWith("blob:")) {
    URL.revokeObjectURL(objectUrlRef);
    objectUrlRef = null;
  }
}

export function stopChatTts() {
  playbackGeneration += 1;
  teardownPlaybackResources();
}

async function playFullTtsDownload(
  text: string,
  language: string,
  controller: AbortController,
  isActive: () => boolean,
  hooks: {
    onAudio: (audio: HTMLAudioElement) => void;
    onObjectUrl: (url: string) => void;
  },
  persona?: "Companion",
  playbackRate: 1 | 1.5 | 2 = 1
): Promise<void> {
  const url = await fetchTTSAudio(text, language, controller.signal, persona);
  if (!isActive() || controller.signal.aborted) {
    URL.revokeObjectURL(url);
    return;
  }

  hooks.onObjectUrl(url);
  const audio = isIOS() ? getSharedTtsAudio() : new Audio();
  audio.muted = globalMuted;
  audio.playbackRate = playbackRate;
  hooks.onAudio(audio);

  try {
    await playAudioFromObjectUrl(audio, url, controller.signal);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const TTS_PREFETCH_PARALLEL = 2;

function createSegmentPlayers(): HTMLAudioElement[] {
  if (!isIOS()) {
    return [new Audio()];
  }
  const primary = getSharedTtsAudio();
  const secondary = new Audio();
  configurePlaybackAudio(secondary);
  return [primary, secondary];
}

async function playSegmentedTts(
  text: string,
  language: string,
  controller: AbortController,
  isActive: () => boolean,
  hooks: {
    onAudio: (audio: HTMLAudioElement) => void;
  },
  persona?: "Companion",
  playbackRate: 1 | 1.5 | 2 = 1
): Promise<void> {
  const segments = splitTextForTtsSegments(text);
  if (segments.length === 0) return;
  if (segments.length === 1) {
    await playFullTtsDownload(
      segments[0],
      language,
      controller,
      isActive,
      { ...hooks, onObjectUrl: () => undefined },
      persona,
      playbackRate
    );
    return;
  }

  const players = createSegmentPlayers();
  const usePingPong = isIOS() && players.length === 2;
  let activePlayer = 0;
  const signal = controller.signal;

  const pending = new Map<number, Promise<string>>();

  const startFetch = (index: number) => {
    if (index < 0 || index >= segments.length || pending.has(index)) return;
    pending.set(
      index,
      fetchTTSAudio(segments[index], language, signal, persona)
    );
  };

  const prefetchWindow = (fromIndex: number) => {
    for (let offset = 0; offset < TTS_PREFETCH_PARALLEL; offset += 1) {
      startFetch(fromIndex + offset);
    }
  };

  const revokePending = () => {
    pending.forEach((fetchPromise) => {
      void fetchPromise.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
    });
    pending.clear();
  };

  prefetchWindow(0);

  for (let index = 0; index < segments.length; index += 1) {
    if (!isActive() || signal.aborted) {
      revokePending();
      return;
    }

    prefetchWindow(index);
    const fetchPromise = pending.get(index);
    if (!fetchPromise) continue;

    const url = await fetchPromise;
    pending.delete(index);

    if (!isActive() || signal.aborted) {
      URL.revokeObjectURL(url);
      revokePending();
      return;
    }

    const player = players[activePlayer];
    player.muted = globalMuted;
    player.playbackRate = playbackRate;
    hooks.onAudio(player);

    let preloadNextPromise: Promise<void> | null = null;
    if (usePingPong && index + 1 < segments.length) {
      const standbyPlayer = players[1 - activePlayer];
      preloadNextPromise = (async () => {
        prefetchWindow(index + 1);
        const nextFetch = pending.get(index + 1);
        if (!nextFetch) return;
        const nextUrl = await nextFetch;
        if (!isActive() || signal.aborted) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        standbyPlayer.muted = globalMuted;
        standbyPlayer.playbackRate = playbackRate;
        await preloadAudioFromObjectUrl(standbyPlayer, nextUrl, signal);
      })();
    }

    try {
      if (usePingPong) {
        if (index === 0) {
          await preloadAudioFromObjectUrl(player, url, signal);
        }
        await playPreloadedAudio(player, signal, TTS_SEGMENT_END_TRIM_SECONDS);
      } else {
        await playAudioFromObjectUrl(player, url, signal);
      }
    } finally {
      URL.revokeObjectURL(url);
    }

    if (preloadNextPromise) {
      await preloadNextPromise;
    }

    if (usePingPong) {
      activePlayer = 1 - activePlayer;
    }
  }
}

export async function playChatTts(
  text: string,
  language: string,
  signal?: AbortSignal,
  persona?: "Companion",
  playbackRate: 1 | 1.5 | 2 = 1
): Promise<void> {
  const cleaned = text.trim();
  if (!cleaned) return;

  primeTtsAudioPlayback();

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
        audio.muted = globalMuted;
        audio.playbackRate = playbackRate;
        audioRef = audio;
      }
    },
    onObjectUrl: (url: string) => {
      if (isActive() && url.startsWith("blob:")) {
        objectUrlRef = url;
      }
    },
  };

  try {
    if (canStreamMpegAudio()) {
      try {
        const response = await fetchTTSStreamResponse(
          cleaned,
          language,
          controller.signal,
          persona
        );
        if (!isActive() || controller.signal.aborted) return;

        await playMpegStreamResponse(response, controller.signal, hooks);
        return;
      } catch {
        if (!isActive() || controller.signal.aborted) return;
      }
    }

    if (isIOS()) {
      await playSegmentedTts(
        cleaned,
        language,
        controller,
        isActive,
        hooks,
        persona,
        playbackRate
      );
      return;
    }

    await playFullTtsDownload(
      cleaned,
      language,
      controller,
      isActive,
      hooks,
      persona,
      playbackRate
    );
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (isActive()) {
      teardownPlaybackResources();
    }
  }
}

export { primeTtsAudioPlayback } from "@/lib/ttsPlayback";
