type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string } }>;
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

let recognitionInstance: SpeechRecognitionLike | null = null;
let isRecognizing = false;

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  if (recognitionInstance) return recognitionInstance;

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Constructor) return null;

  recognitionInstance = new Constructor();
  recognitionInstance.lang = "vi-VN";
  recognitionInstance.interimResults = false;
  recognitionInstance.continuous = false;
  return recognitionInstance;
}

export function isVoiceInputSupported(): boolean {
  return getRecognition() !== null;
}

export function startListening(
  onResult: (text: string) => void,
  onError: (errorEvent?: any) => void,
  onEnd?: () => void
): void {
  const recognition = getRecognition();
  if (!recognition) {
    onError(new Error("Trình duyệt không hỗ trợ nhận diện giọng nói."));
    return;
  }

  if (isRecognizing) {
    recognition.stop();
  }

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript) onResult(transcript);
  };

  recognition.onerror = (event) => {
    isRecognizing = false;
    // Bỏ qua lỗi 'no-speech' (người dùng không nói gì) hoặc báo lỗi rõ ràng hơn
    if (event.error === 'no-speech') {
       onEnd?.();
       return;
    }
    // Gửi lỗi lên UI
    onError(event);
  };

  recognition.onend = () => {
    isRecognizing = false;
    onEnd?.();
  };

  try {
    recognition.start();
    isRecognizing = true;
  } catch (e) {
    // Nếu gọi start() khi đang chạy, catch lỗi và bỏ qua
    console.error("Speech recognition start error:", e);
    onError(e);
  }
}

export function stopListening(): void {
  if (isRecognizing && recognitionInstance) {
    recognitionInstance.stop();
    isRecognizing = false;
  }
}
