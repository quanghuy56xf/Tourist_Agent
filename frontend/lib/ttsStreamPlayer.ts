function waitForSourceBuffer(sourceBuffer: SourceBuffer): Promise<void> {
  if (!sourceBuffer.updating) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    sourceBuffer.addEventListener("updateend", () => resolve(), { once: true });
  });
}

async function appendToSourceBuffer(
  sourceBuffer: SourceBuffer,
  chunk: Uint8Array
): Promise<void> {
  await waitForSourceBuffer(sourceBuffer);
  await new Promise<void>((resolve, reject) => {
    const onUpdateEnd = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("sourcebuffer append failed"));
    };
    const cleanup = () => {
      sourceBuffer.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.removeEventListener("error", onError);
    };
    sourceBuffer.addEventListener("updateend", onUpdateEnd);
    sourceBuffer.addEventListener("error", onError);
    sourceBuffer.appendBuffer(chunk);
  });
}

export function canStreamMpegAudio(): boolean {
  return (
    typeof MediaSource !== "undefined" &&
    typeof MediaSource.isTypeSupported === "function" &&
    MediaSource.isTypeSupported("audio/mpeg")
  );
}

export async function playMpegStreamResponse(
  response: Response,
  signal: AbortSignal,
  hooks?: {
    onAudio?: (audio: HTMLAudioElement) => void;
    onObjectUrl?: (url: string) => void;
  }
): Promise<void> {
  if (!response.body) {
    throw new Error("stream body missing");
  }

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  hooks?.onObjectUrl?.(objectUrl);

  const audio = new Audio(objectUrl);
  hooks?.onAudio?.(audio);

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = response.body.getReader();
  let sourceBuffer: SourceBuffer | null = null;
  let playbackStarted = false;

  const abortReader = () => {
    void reader?.cancel().catch(() => undefined);
    reader = null;
  };

  const onAbort = () => abortReader();
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: unknown) => {
        abortReader();
        reject(error instanceof Error ? error : new Error("stream playback failed"));
      };

      mediaSource.addEventListener(
        "sourceopen",
        () => {
          void (async () => {
            try {
              sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
              while (reader && !signal.aborted) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value?.length) continue;
                await appendToSourceBuffer(sourceBuffer, value);
                if (!playbackStarted) {
                  playbackStarted = true;
                  await audio.play();
                }
              }
              if (signal.aborted) {
                resolve();
                return;
              }
              await waitForSourceBuffer(sourceBuffer);
              if (mediaSource.readyState === "open") {
                mediaSource.endOfStream();
              }
            } catch (error) {
              fail(error);
            }
          })();
        },
        { once: true }
      );

      mediaSource.addEventListener("error", () => fail(new Error("mediasource error")), {
        once: true,
      });
      audio.onended = () => resolve();
      audio.onerror = () => fail(new Error("audio playback failed"));
    });
  } finally {
    signal.removeEventListener("abort", onAbort);
    abortReader();
    audio.pause();
    audio.src = "";
    if (mediaSource.readyState === "open") {
      try {
        mediaSource.endOfStream();
      } catch {
        /* ignore */
      }
    }
    URL.revokeObjectURL(objectUrl);
  }
}

export async function playBlobResponse(
  response: Response,
  signal: AbortSignal,
  hooks?: {
    onAudio?: (audio: HTMLAudioElement) => void;
    onObjectUrl?: (url: string) => void;
  }
): Promise<void> {
  const blob = await response.blob();
  if (signal.aborted) return;

  const objectUrl = URL.createObjectURL(blob);
  hooks?.onObjectUrl?.(objectUrl);
  const audio = new Audio(objectUrl);
  hooks?.onAudio?.(audio);

  try {
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio playback failed"));
      audio.play().catch(reject);
    });
  } finally {
    audio.pause();
    audio.src = "";
    URL.revokeObjectURL(objectUrl);
  }
}
