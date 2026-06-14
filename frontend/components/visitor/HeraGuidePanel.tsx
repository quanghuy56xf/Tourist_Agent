"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ItemHeroSlideshow from "@/components/visitor/ItemHeroSlideshow";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import {
  AudioPreparationState,
  getAudioControlState,
  shouldRetryAudioPlay,
  shouldRestartAudio,
  syncAudioSource,
} from "@/lib/audioPlayback";

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
  const [speechBlocked, setSpeechBlocked] = useState(false);
  const [audioState, setAudioState] = useState<AudioPreparationState>("idle");

  const plainContent = content.trim();
  const canSpeak = Boolean(plainContent);
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

  const pauseAudio = useCallback((reset = false) => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (reset) audio.currentTime = 0;
    }
    setIsSpeaking(false);
  }, []);

  const markFinished = useCallback(() => {
    clearTextTimer();
    pauseAudio();
    setRevealedLength(contentRef.current.length);
    setTextComplete(true);
    setSessionState("finished");
    setSpeechBlocked(false);
    notifyIntroActive(false);
  }, [notifyIntroActive, pauseAudio]);

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
      if (isRunActive(runId)) {
        setAudioState("error");
        setIsSpeaking(false);
        setSpeechBlocked(false);
      }
    };
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioUrl) return null;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.src = audioUrl;
      audioRef.current = audio;
      return audio;
    }
    syncAudioSource(audio, audioUrl);
    return audio;
  }, [audioUrl]);

  const playServerAudio = useCallback(
    async (restart: boolean, runId: number): Promise<boolean> => {
      if (!audioUrl || !isRunActive(runId)) return false;
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
        setAudioState("ready");
        return true;
      } catch {
        if (isRunActive(runId)) {
          setIsSpeaking(false);
          if (shouldRetryAudioPlay(audio.readyState, Boolean(audio.error))) {
            setAudioState("loading");
            setSpeechBlocked(false);
          } else if (audio.error) {
            setAudioState("error");
            setSpeechBlocked(false);
          } else {
            setAudioState("ready");
            setSpeechBlocked(true);
          }
        }
        return false;
      }
    },
    [attachAudioHandlers, audioUrl, ensureAudio]
  );

  const prepareAndPlayAudio = useCallback(
    (runId: number) => {
      const audio = ensureAudio();
      if (!audio || !isRunActive(runId)) {
        setAudioState("error");
        return;
      }

      setAudioState("loading");
      setSpeechBlocked(false);
      attachAudioHandlers(audio, runId);
      audio.oncanplay = () => {
        if (!isRunActive(runId)) return;
        audio.oncanplay = null;
        void playServerAudio(shouldRestartAudio("autoplay"), runId);
      };
      audio.load();
      void playServerAudio(shouldRestartAudio("autoplay"), runId);
    },
    [attachAudioHandlers, ensureAudio, playServerAudio]
  );

  const startIntro = useCallback(
    (restart: boolean) => {
      if (!plainContent) return;
      const runId = introRunRef.current;
      setSpeechBlocked(false);
      setSessionState("running");
      notifyIntroActive(true);
      startTextReveal(restart);
      prepareAndPlayAudio(runId);
    },
    [
      notifyIntroActive,
      plainContent,
      prepareAndPlayAudio,
      startTextReveal,
    ]
  );

  const stopIntro = useCallback(() => {
    clearTextTimer();
    pauseAudio();
    setSessionState("paused");
    setSpeechBlocked(false);
    notifyIntroActive(false);
  }, [notifyIntroActive, pauseAudio]);

  useImperativeHandle(ref, () => ({ stopPlayback: stopIntro }), [stopIntro]);

  const resumeIntro = async () => {
    if (!plainContent) return;
    const runId = introRunRef.current;
    const trigger = sessionState === "finished" ? "replay" : "resume";
    setSpeechBlocked(false);
    setSessionState("running");
    notifyIntroActive(true);
    if (revealedLength < plainContent.length) {
      startTextReveal(false);
    }
    await playServerAudio(shouldRestartAudio(trigger), runId);
  };

  useEffect(() => {
    if (sessionState !== "running") return;
    if (
      textComplete &&
      !isSpeaking &&
      !speechBlocked &&
      audioState !== "loading"
    ) {
      markFinished();
    }
  }, [
    audioState,
    isSpeaking,
    markFinished,
    sessionState,
    speechBlocked,
    textComplete,
  ]);

  useEffect(() => {
    introRunRef.current += 1;
    const runId = introRunRef.current;
    clearTextTimer();
    pauseAudio(true);
    audioRef.current = null;
    setAudioState("idle");
    setSessionState("idle");
    setRevealedLength(0);
    setTextComplete(false);
    setSpeechBlocked(false);
    notifyIntroActive(false);

    if (loading || !plainContent) return;

    startIntro(true);
    return () => {
      if (runId === introRunRef.current) {
        introRunRef.current += 1;
      }
      clearTextTimer();
      pauseAudio(true);
      audioRef.current = null;
      notifyIntroActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, audioUrl, loading, language]);

  useEffect(() => {
    const el = textRef.current;
    if (!el || sessionState !== "running") return;
    el.scrollTop = el.scrollHeight;
  }, [revealedLength, sessionState]);

  const replayIntro = () => {
    introRunRef.current += 1;
    startIntro(true);
  };

  const showControls = canSpeak && !loading;
  const controlState = getAudioControlState(
    audioState,
    sessionState,
    isSpeaking
  );

  const handlePlay = () => {
    if (sessionState === "finished") {
      replayIntro();
      return;
    }
    void resumeIntro();
  };

  const controlLabel =
    controlState.label === "preparing"
      ? t.item.preparingAudio
      : controlState.label === "error"
        ? t.item.audioError
        : controlState.label === "stop"
          ? t.item.stop
          : controlState.label === "replay"
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
                : audioState === "loading"
                  ? t.item.preparingAudio
                  : audioState === "error"
                    ? t.item.audioError
                : speechBlocked
                  ? t.item.tapToListen
                  : t.item.chatTitle}
            </p>
          </div>
          {showControls && (
            <div className="flex shrink-0 items-center gap-2">
              {controlState.action === "stop" ? (
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
                  ⏹ {controlLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlay}
                  disabled={controlState.disabled}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    opacity: controlState.disabled ? 0.65 : 1,
                  }}
                >
                  {audioState === "loading" ? "…" : "▶"} {controlLabel}
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
                {sessionState === "running" && revealedLength < plainContent.length && (
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
