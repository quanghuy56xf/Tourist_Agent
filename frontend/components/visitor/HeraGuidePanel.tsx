"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  canUseBrowserSpeech,
  speakWithBrowser,
  stopBrowserSpeech,
} from "@/lib/browserSpeech";
import ItemHeroSlideshow from "@/components/visitor/ItemHeroSlideshow";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

interface HeraGuidePanelProps {
  content: string;
  audioUrl: string | null;
  loading: boolean;
  language: string;
  overlay?: boolean;
  slideshowImages?: string[];
  slideshowAlt?: string;
  onIntroActiveChange?: (active: boolean) => void;
}

export type HeraGuidePanelHandle = {
  stopPlayback: () => void;
};

type SessionState = "idle" | "running" | "paused" | "finished";

const TEXT_TICK_MS = 30;
const CHARS_PER_TICK = 2;

export default forwardRef<HeraGuidePanelHandle, HeraGuidePanelProps>(function HeraGuidePanel(
  {
  content,
  audioUrl,
  loading,
  language,
  overlay = false,
  slideshowImages = [],
  slideshowAlt = "HERA",
  onIntroActiveChange,
}: HeraGuidePanelProps,
  ref
) {
  const { t } = useVisitorLocale();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const textTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentRef = useRef("");
  const introRunRef = useRef(0);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [revealedLength, setRevealedLength] = useState(0);
  const [textComplete, setTextComplete] = useState(false);
  const [browserSpeechReady, setBrowserSpeechReady] = useState(false);
  const [voicesChecked, setVoicesChecked] = useState(false);
  const [speechBlocked, setSpeechBlocked] = useState(false);

  const plainContent = content.trim();
  const canSpeak = Boolean(plainContent);
  const hasServerAudio = Boolean(audioUrl);
  const wantsSpeech = hasServerAudio || browserSpeechReady;
  contentRef.current = plainContent;

  const visibleText = plainContent.slice(0, revealedLength);
  const isRunActive = (runId: number) => runId === introRunRef.current;

  const notifyIntroActive = useCallback(
    (active: boolean) => {
      onIntroActiveChange?.(active);
    },
    [onIntroActiveChange]
  );

  const clearTextTimer = () => {
    if (textTimerRef.current) {
      clearInterval(textTimerRef.current);
      textTimerRef.current = null;
    }
  };

  const stopAllSpeech = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    stopBrowserSpeech();
    setIsSpeaking(false);
  }, []);

  const markFinished = useCallback(() => {
    clearTextTimer();
    stopAllSpeech();
    setRevealedLength(contentRef.current.length);
    setTextComplete(true);
    setSessionState("finished");
    setSpeechBlocked(false);
    notifyIntroActive(false);
  }, [notifyIntroActive, stopAllSpeech]);

  const pauseForSpeechBlock = useCallback(() => {
    clearTextTimer();
    stopAllSpeech();
    setSessionState("paused");
    setSpeechBlocked(true);
    notifyIntroActive(false);
  }, [notifyIntroActive, stopAllSpeech]);

  const startTextReveal = useCallback((fromStart: boolean) => {
    clearTextTimer();
    if (fromStart) {
      setRevealedLength(0);
      setTextComplete(false);
    }

    textTimerRef.current = setInterval(() => {
      setRevealedLength((prev) => {
        const next = Math.min(contentRef.current.length, prev + CHARS_PER_TICK);
        if (next >= contentRef.current.length) {
          clearTextTimer();
          setTextComplete(true);
        }
        return next;
      });
    }, TEXT_TICK_MS);
  }, []);

  const attachAudioHandlers = useCallback((audio: HTMLAudioElement, runId: number) => {
    audio.onended = () => {
      if (isRunActive(runId)) setIsSpeaking(false);
    };
    audio.onerror = () => {
      if (isRunActive(runId)) setIsSpeaking(false);
    };
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioUrl) return null;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(audioUrl);
      audioRef.current = audio;
      return audio;
    }
    if (audio.src !== audioUrl) {
      audio.pause();
      audio.src = audioUrl;
      audio.load();
    }
    return audio;
  }, [audioUrl]);

  useEffect(() => {
    let cancelled = false;
    setVoicesChecked(false);
    void canUseBrowserSpeech(language).then((ok) => {
      if (!cancelled) {
        setBrowserSpeechReady(ok);
        setVoicesChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const startBrowserSpeech = useCallback(
    async (text: string, runId: number): Promise<boolean> => {
      if (!text.trim() || !browserSpeechReady || !isRunActive(runId)) return false;
      try {
        setIsSpeaking(true);
        await speakWithBrowser(text, language, { strictVoice: true });
        return isRunActive(runId);
      } catch {
        return false;
      } finally {
        if (isRunActive(runId)) setIsSpeaking(false);
      }
    },
    [browserSpeechReady, language]
  );

  const playServerAudio = useCallback(
    async (restart: boolean, runId: number): Promise<boolean> => {
      if (!hasServerAudio || !isRunActive(runId)) return false;
      stopBrowserSpeech();
      const audio = ensureAudio();
      if (!audio) return false;
      attachAudioHandlers(audio, runId);
      try {
        if (restart) audio.currentTime = 0;
        await audio.play();
        if (!isRunActive(runId)) {
          audio.pause();
          return false;
        }
        setIsSpeaking(true);
        setSpeechBlocked(false);
        return true;
      } catch {
        if (isRunActive(runId)) setIsSpeaking(false);
        return false;
      }
    },
    [attachAudioHandlers, ensureAudio, hasServerAudio]
  );

  const startSpeech = useCallback(
    async (restart: boolean, offset: number, runId: number): Promise<boolean> => {
      if (!plainContent || !isRunActive(runId)) return false;
      if (!hasServerAudio && !browserSpeechReady) return true;

      stopAllSpeech();
      if (!isRunActive(runId)) return false;

      if (hasServerAudio) {
        const fullRestart = restart || offset === 0 || !plainContent.slice(restart ? 0 : offset).trim();
        return playServerAudio(fullRestart, runId);
      }

      const spokenText = plainContent.slice(restart ? 0 : offset);
      const textToSpeak = spokenText.trim() ? spokenText : plainContent;
      return startBrowserSpeech(textToSpeak, runId);
    },
    [
      browserSpeechReady,
      hasServerAudio,
      plainContent,
      playServerAudio,
      startBrowserSpeech,
      stopAllSpeech,
    ]
  );

  const startIntro = useCallback(
    async (restart: boolean) => {
      if (!plainContent) return;
      const runId = introRunRef.current;
      setSpeechBlocked(false);
      setSessionState("running");
      notifyIntroActive(true);
      startTextReveal(restart);

      if (!wantsSpeech) return;

      const speechStarted = await startSpeech(
        restart,
        restart ? 0 : revealedLength,
        runId
      );
      if (!isRunActive(runId)) return;
      if (!speechStarted) {
        pauseForSpeechBlock();
      }
    },
    [
      notifyIntroActive,
      pauseForSpeechBlock,
      plainContent,
      revealedLength,
      startSpeech,
      startTextReveal,
      wantsSpeech,
    ]
  );

  const stopIntro = useCallback(() => {
    introRunRef.current += 1;
    clearTextTimer();
    stopAllSpeech();
    setSessionState("paused");
    setSpeechBlocked(false);
    notifyIntroActive(false);
  }, [notifyIntroActive, stopAllSpeech]);

  useImperativeHandle(ref, () => ({ stopPlayback: stopIntro }), [stopIntro]);

  const resumeIntro = async () => {
    if (!plainContent) return;
    const runId = introRunRef.current;
    const speakFromStart = revealedLength >= plainContent.length;
    setSpeechBlocked(false);
    setSessionState("running");
    notifyIntroActive(true);
    if (revealedLength < plainContent.length) {
      startTextReveal(false);
    }

    if (!wantsSpeech) return;

    const speechStarted = await startSpeech(
      speakFromStart,
      speakFromStart ? 0 : revealedLength,
      runId
    );
    if (!isRunActive(runId)) return;
    if (!speechStarted) {
      pauseForSpeechBlock();
    }
  };

  useEffect(() => {
    if (sessionState !== "running") return;
    if (textComplete && !isSpeaking && !speechBlocked) {
      markFinished();
    }
  }, [isSpeaking, markFinished, sessionState, speechBlocked, textComplete]);

  useEffect(() => {
    introRunRef.current += 1;
    const runId = introRunRef.current;
    clearTextTimer();
    stopAllSpeech();
    audioRef.current = null;
    setSessionState("idle");
    setRevealedLength(0);
    setTextComplete(false);
    setSpeechBlocked(false);
    notifyIntroActive(false);

    if (loading || !plainContent || !voicesChecked) return;

    void startIntro(true);
    return () => {
      if (runId === introRunRef.current) {
        introRunRef.current += 1;
      }
      clearTextTimer();
      stopAllSpeech();
      audioRef.current = null;
      notifyIntroActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, audioUrl, loading, language, voicesChecked]);

  useEffect(() => {
    const el = textRef.current;
    if (!el || sessionState !== "running") return;
    el.scrollTop = el.scrollHeight;
  }, [revealedLength, sessionState]);

  const replayIntro = () => {
    introRunRef.current += 1;
    void startIntro(true);
  };

  const showControls = canSpeak && !loading;
  const isRunning = sessionState === "running";
  const isFinished = sessionState === "finished";

  const handlePlay = () => {
    if (speechBlocked || isFinished) {
      replayIntro();
      return;
    }
    void resumeIntro();
  };

  const playLabel = speechBlocked
    ? t.item.tapToListen
    : isFinished
      ? t.item.replay
      : t.item.resume;

  return (
    <>
      <img src="/images/mascot.gif" alt="HERA" className="hera-mascot-fixed" />

      <div
        className={`hera-guide-card overflow-hidden ${overlay ? "hera-guide-card--overlay" : "artifact-card"}`}
      >
        {overlay && slideshowImages.length > 0 && (
          <div className="hera-guide-slide-layer absolute inset-0 overflow-hidden">
            <ItemHeroSlideshow
              images={slideshowImages}
              active={overlay}
              alt={slideshowAlt}
            />
            <div className="hera-guide-slide-scrim absolute inset-0" aria-hidden />
          </div>
        )}

        <div
          className={`hera-guide-header relative z-10 flex items-center justify-between gap-3 px-4 py-3 ${overlay ? "hera-guide-header--overlay" : ""}`}
          style={
            overlay
              ? undefined
              : { borderBottom: "1px solid var(--border)", background: "var(--secondary)" }
          }
        >
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-medium">{t.productName}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {loading
                ? t.item.composing
                : speechBlocked
                  ? t.item.tapToListen
                  : t.item.chatTitle}
            </p>
          </div>
          {showControls && (
            <div className="flex shrink-0 items-center gap-2">
              {isRunning ? (
                <button
                  type="button"
                  onClick={stopIntro}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: "rgba(212,24,61,0.2)",
                    border: "1px solid rgba(212,24,61,0.45)",
                    color: "#f0e8d5",
                  }}
                >
                  ⏹ {t.item.stop}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlay}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  ▶ {playLabel}
                </button>
              )}
            </div>
          )}
        </div>

        <div className={`relative z-10 px-4 py-4 ${overlay ? "hera-guide-body--overlay" : ""}`}>
          {loading ? (
            <div className="flex flex-col items-center py-6">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
              />
            </div>
          ) : (
            <div
              ref={textRef}
              className={`hera-text-scroll ${overlay ? "hera-text-scroll--overlay" : ""}`}
            >
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${overlay ? "hera-text-body--overlay" : ""}`}
                style={{ lineHeight: 1.8 }}
              >
                {visibleText}
                {isRunning && revealedLength < plainContent.length && (
                  <span
                    className="ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle"
                    style={{ background: "var(--primary)" }}
                    aria-hidden
                  />
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
});
