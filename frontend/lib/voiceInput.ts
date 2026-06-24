type RecordingSession = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: BlobPart[];
};

let activeSession: RecordingSession | null = null;
let audioContext: AudioContext | null = null;
let silenceTimerId: number | null = null;

const MIME_CANDIDATES = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

function selectMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function cleanupSilenceDetection(): void {
  if (silenceTimerId !== null) {
    cancelAnimationFrame(silenceTimerId);
    silenceTimerId = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}

export function isVoiceInputSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export async function startRecording(onSilenceDetected?: () => void): Promise<void> {
  if (!isVoiceInputSupported()) {
    throw new Error("Trình duyệt không hỗ trợ ghi âm.");
  }
  if (activeSession) {
    throw new Error("Micro đang ghi âm.");
  }

  // Khởi tạo AudioContext đồng bộ ngay lập tức để tránh iOS/Mobile Safari block sau khi await
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (AudioContextClass && onSilenceDetected) {
    audioContext = new AudioContextClass();
    // Đảm bảo audioContext chạy nếu đang bị suspended trên mobile
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false, // Tắt Auto Gain để điện thoại không tự khuếch đại tiếng ồn nền
    },
  });

  try {
    const mimeType = selectMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    if (audioContext && onSilenceDetected) {
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let hasSpoken = false;
      let lastSpokeTime = Date.now();
      const startTime = Date.now();
      const SILENCE_THRESHOLD = 80;
      const MAX_SILENCE_MS = 1500;
      const MAX_WAIT_MS = 5000;

      const checkSilence = () => {
        if (!activeSession) return;
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / bufferLength;

        const now = Date.now();
        if (avg > SILENCE_THRESHOLD) {
          hasSpoken = true;
          lastSpokeTime = now;
        } else {
          if (hasSpoken && now - lastSpokeTime > MAX_SILENCE_MS) {
            onSilenceDetected();
            return;
          } else if (!hasSpoken && now - startTime > MAX_WAIT_MS) {
            onSilenceDetected();
            return;
          }
        }
        silenceTimerId = requestAnimationFrame(checkSilence);
      };
      silenceTimerId = requestAnimationFrame(checkSilence);
    }

    recorder.start();
    activeSession = { recorder, stream, chunks };
  } catch (error) {
    cleanupSilenceDetection();
    stopTracks(stream);
    throw error;
  }
}

export function stopRecording(): Promise<Blob> {
  const session = activeSession;
  if (!session) {
    return Promise.reject(new Error("Micro chưa bắt đầu ghi âm."));
  }
  activeSession = null;
  cleanupSilenceDetection();

  return new Promise<Blob>((resolve, reject) => {
    session.recorder.onstop = () => {
      stopTracks(session.stream);
      const blob = new Blob(session.chunks, {
        type: session.recorder.mimeType || "audio/webm",
      });
      if (blob.size === 0) {
        reject(new Error("Không ghi nhận được âm thanh."));
        return;
      }
      resolve(blob);
    };
    session.recorder.onerror = () => {
      stopTracks(session.stream);
      reject(new Error("Ghi âm thất bại."));
    };
    session.recorder.stop();
  });
}

export function cancelRecording(): void {
  const session = activeSession;
  activeSession = null;
  cleanupSilenceDetection();
  if (!session) return;
  if (session.recorder.state !== "inactive") {
    session.recorder.stop();
  }
  stopTracks(session.stream);
}
