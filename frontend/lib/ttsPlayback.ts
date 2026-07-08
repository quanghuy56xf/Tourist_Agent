const SILENT_MP3 =
  "data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

let sharedAudio: HTMLAudioElement | null = null;
let primed = false;

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function configurePlaybackAudio(audio: HTMLAudioElement): void {
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.preload = "auto";
}

export function getSharedTtsAudio(): HTMLAudioElement {
  if (!sharedAudio && typeof window !== "undefined") {
    sharedAudio = new Audio();
    configurePlaybackAudio(sharedAudio);
  }
  return sharedAudio!;
}

export function isSharedTtsAudio(audio: HTMLAudioElement): boolean {
  return sharedAudio === audio;
}

/** Call synchronously inside a user gesture (tap/click) before any await. */
export function primeTtsAudioPlayback(): void {
  if (typeof window === "undefined") return;
  const audio = getSharedTtsAudio();
  if (primed) return;
  audio.src = SILENT_MP3;
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
      primed = true;
    })
    .catch(() => {
      primed = true;
    });
}

function waitForAudioCanPlay(audio: HTMLAudioElement, signal?: AbortSignal): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = (fn: () => void) => {
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const onReady = () => cleanup(resolve);
    const onError = () => cleanup(() => reject(new Error("audio load failed")));
    const onAbort = () => cleanup(() => reject(new Error("aborted")));
    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    audio.load();
  });
}

function waitForAudioReady(audio: HTMLAudioElement, signal?: AbortSignal): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = (fn: () => void) => {
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const onReady = () => cleanup(resolve);
    const onError = () => cleanup(() => reject(new Error("audio load failed")));
    const onAbort = () => cleanup(() => reject(new Error("aborted")));
    audio.addEventListener("canplaythrough", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    audio.load();
  });
}

function resetAudioElement(audio: HTMLAudioElement): void {
  audio.pause();
  audio.currentTime = 0;
  audio.onended = null;
  audio.onerror = null;
  audio.removeAttribute("src");
  audio.load();
}

/** Trim trailing silence/gap when chaining TTS segments. */
export const TTS_SEGMENT_END_TRIM_SECONDS = 0.12;

async function playAudioElementImmediately(
  audio: HTMLAudioElement,
  signal?: AbortSignal,
  endTrimSeconds = 0
): Promise<void> {
  const trim = Math.max(0, endTrimSeconds);

  const waitForEnded = () =>
    new Promise<void>((resolve, reject) => {
      if (audio.ended) {
        resolve();
        return;
      }

      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("error", onError);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        cleanup();
        audio.pause();
        reject(new Error("aborted"));
      };
      const onEnded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("audio playback failed"));
      };
      const onTimeUpdate = () => {
        const duration = audio.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const threshold = trim > 0 ? duration - trim : duration - 0.1;
        if (audio.currentTime >= threshold) {
          cleanup();
          resolve();
        }
      };

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("error", onError);
      signal?.addEventListener("abort", onAbort, { once: true });
    });

  if (signal?.aborted) return;
  if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
    await waitForAudioCanPlay(audio, signal);
  }
  if (signal?.aborted) return;

  try {
    await audio.play();
  } catch {
    if (signal?.aborted) return;
    await waitForAudioCanPlay(audio, signal);
    if (signal?.aborted) return;
    await audio.play();
  }

  await waitForEnded();
}

export async function preloadAudioFromObjectUrl(
  audio: HTMLAudioElement,
  objectUrl: string,
  signal?: AbortSignal
): Promise<void> {
  configurePlaybackAudio(audio);
  audio.pause();
  audio.currentTime = 0;
  audio.src = objectUrl;
  audio.load();
  if (signal?.aborted) return;
  await waitForAudioCanPlay(audio, signal);
}

export async function playPreloadedAudio(
  audio: HTMLAudioElement,
  signal?: AbortSignal,
  endTrimSeconds = 0
): Promise<void> {
  if (signal?.aborted) return;
  await playAudioElementImmediately(audio, signal, endTrimSeconds);
}

export async function playAudioFromObjectUrl(
  audio: HTMLAudioElement,
  objectUrl: string,
  signal?: AbortSignal
): Promise<void> {
  configurePlaybackAudio(audio);

  if (isIOS()) {
    resetAudioElement(audio);
  }

  audio.src = objectUrl;
  audio.load();
  if (signal?.aborted) return;

  if (isIOS()) {
    await playAudioElementImmediately(audio, signal);
    return;
  }

  await waitForAudioReady(audio, signal);
  if (signal?.aborted) return;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio playback failed"));
    audio.play().catch(reject);
  });
}
