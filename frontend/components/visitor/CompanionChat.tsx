"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { chatWithCompanionStream, ChatMessage, transcribeAudio } from "@/lib/api";
import { playChatTts, setChatTtsMuted, stopChatTts } from "@/lib/chatTts";
import {
  addVisitedItem,
  advanceCompanionQuest,
  getCompanionQuestState,
  getVisitedItemIds,
  setCompanionQuestState,
  startCompanionQuest,
  unlockCompanionQuests,
} from "@/lib/companionState";
import { rememberMinimapSuggestion, rememberMinimapItem } from "@/lib/minimapState";
import { getVisitorSessionId } from "@/lib/visitorAnalytics";
import { useGroupSlug } from "@/lib/useGroupPath";
import {
  cancelRecording,
  isVoiceInputSupported,
  startRecording,
  stopRecording,
} from "@/lib/voiceInput";
import CompanionAvatar from "./CompanionAvatar";
import CompanionDiscoveryCard, { DiscoveryImage } from "./CompanionDiscoveryCard";
import CompanionQuestCards from "./CompanionQuestCards";
import CompanionQuestProgress from "./CompanionQuestProgress";
import CompanionQuestReward from "./CompanionQuestReward";
import {
  COMPANION_QUESTS,
  CompanionQuest,
  CompanionQuestStop,
  getQuestById,
  isQuestBaitTarget,
  matchQuestStopTarget,
} from "@/lib/companionQuests";
import CameraCapture from "@/components/CameraCapture";
import ScanViewfinderFrame from "./ScanViewfinderFrame";
import { useObjectSearch } from "@/lib/useObjectSearch";
import type { SearchMatch } from "@/lib/api/search";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

interface CompanionChatProps {
  itemId?: number;
  initialNarration?: string;
  compact?: boolean;
  showIntro?: boolean;
  onCompleteIntro?: () => void;
  onSuggestNextPoint?: (itemId: number, itemName?: string) => void;
  isMuted?: boolean;
  playbackRate?: 1 | 1.5 | 2;
}

type DiscoveryState = {
  itemId: number;
  itemName: string;
  description?: string | null;
  confidence?: number | null;
  images: DiscoveryImage[];
  hook: string;
};

type ActionButton = {
  type: string;
  label: string;
  payload?: string;
  questId?: string;
  stopId?: string;
  choiceId?: "A" | "B" | "C";
};

function buildDiscoveryImages(match: SearchMatch): DiscoveryImage[] {
  const images = match.images?.length
    ? match.images.map((image) => ({
        url: image.url,
        alt: `${match.name} - ${image.angle}`,
      }))
    : [];

  if (images.length > 0) return images;
  return match.image_url ? [{ url: match.image_url, alt: match.name }] : [];
}

function buildDiscoveryHook(match: SearchMatch, fallback: string): string {
  const firstSentence = match.description
    ?.split(/[.!?。]/)[0]
    ?.replace(/\s+/g, " ")
    .trim();
  if (!firstSentence) return fallback;
  return firstSentence.length > 120 ? `${firstSentence.slice(0, 112).trim()}…` : firstSentence;
}

function makeDiscoveryState(match: SearchMatch, fallbackHook: string): DiscoveryState {
  return {
    itemId: match.item_id,
    itemName: match.name,
    description: match.description,
    confidence: match.similarity,
    images: buildDiscoveryImages(match),
    hook: buildDiscoveryHook(match, fallbackHook),
  };
}

function useStreamingText(text: string): string {
  const [length, setLength] = useState(0);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (!text) {
      setLength(0);
      prevTextRef.current = "";
      return;
    }
    
    // Reset length only if it's a completely new message
    if (!text.startsWith(prevTextRef.current)) {
      setLength(0);
    }
    prevTextRef.current = text;

    const timer = window.setInterval(() => {
      setLength((current) => {
        const next = Math.min(text.length, current + 3);
        if (next >= text.length) window.clearInterval(timer);
        return next;
      });
    }, 28);
    return () => window.clearInterval(timer);
  }, [text]);

  return text.slice(0, length);
}

export default function CompanionChat({
  itemId,
  initialNarration = "",
  compact = false,
  showIntro = false,
  onCompleteIntro,
  onSuggestNextPoint,
  isMuted = false,
  playbackRate = 1,
}: CompanionChatProps) {
  const groupSlug = useGroupSlug();
  const { t, language } = useVisitorLocale();
  const [history, setHistory] = useState<ChatMessage[]>(
    initialNarration
      ? [{ role: "assistant", content: initialNarration }]
      : []
  );
  
  // Add keyframes for the sound wave effect
  useEffect(() => {
    if (typeof document !== "undefined") {
      const styleId = "companion-chat-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          @keyframes sound-wave-1 { 0%, 100% { height: 8px; opacity: 0.5; } 50% { height: 16px; opacity: 1; } }
          @keyframes sound-wave-2 { 0%, 100% { height: 10px; opacity: 0.6; } 50% { height: 24px; opacity: 1; } }
          @keyframes sound-wave-3 { 0%, 100% { height: 13px; opacity: 0.7; } 50% { height: 32px; opacity: 1; } }
          @keyframes sound-wave-4 { 0%, 100% { height: 12px; opacity: 0.6; } 50% { height: 21px; opacity: 1; } }
          @keyframes sound-wave-5 { 0%, 100% { height: 9px; opacity: 0.5; } 50% { height: 13px; opacity: 1; } }
          .companion-chat-scroll::-webkit-scrollbar { width: 6px; }
          .companion-chat-scroll::-webkit-scrollbar-track { background: transparent; }
          .companion-chat-scroll::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.2); border-radius: 10px; }
          .companion-chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(251, 191, 36, 0.4); }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = async (text: string) => {
    setIsSpeaking(true);
    try {
      await playChatTts(text, language, undefined, "Companion", playbackRateRef.current);
    } catch {
      // ignore
    } finally {
      setIsSpeaking(false);
    }
  };
  const [isLoading, setIsLoading] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const { searchImage } = useObjectSearch();
  const [showInlineCamera, setShowInlineCamera] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [scanPhase, setScanPhase] = useState<"idle" | "scanning" | "found">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
  const [fallbackSuggestions, setFallbackSuggestions] = useState<SearchMatch[] | null>(null);
  const [suggestedNextPoint, setSuggestedNextPoint] = useState<{ id: number; name: string } | null>(null);
  const [actionButtons, setActionButtons] = useState<ActionButton[]>([]);
  const [cameraMode, setCameraMode] = useState<"normal" | "bait" | "quest">("normal");
  const [showQuestCards, setShowQuestCards] = useState(false);
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const [activeQuestStopIndex, setActiveQuestStopIndex] = useState(0);
  const [completedQuestId, setCompletedQuestId] = useState<string | null>(null);
  const [questDetailExpanded, setQuestDetailExpanded] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryState | null>(null);
  const [lastScannedDiscovery, setLastScannedDiscovery] = useState<DiscoveryState | null>(null);
  const [awaitingQuizAnswer, setAwaitingQuizAnswer] = useState(false);
  const [activeItemId, setActiveItemId] = useState<number | null>(itemId || null);
  useEffect(() => {
    if (itemId !== undefined) setActiveItemId(itemId || null);
  }, [itemId]);

  useEffect(() => {
    if (isLoading || isSpeaking || isRecording || isTranscribing || showInlineCamera || discovery || scanPhase !== "idle" || history.length === 0 || suggestedNextPoint !== null || actionButtons.length > 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActionButtons(current => {
        if (current.length > 0) return current;
        return [{ type: "open_camera", label: `📸 ${t.companion.scanMore}` }];
      });
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [isLoading, isSpeaking, isRecording, isTranscribing, showInlineCamera, discovery, scanPhase, history.length, suggestedNextPoint, actionButtons.length, t.companion.scanMore]);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const stopProgress = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const startProgress = () => {
    stopProgress();
    setScanProgress(0);
    progressTimer.current = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 8 + 4;
      });
    }, 80);
  };

  const openInlineCamera = (mode: "normal" | "bait" | "quest" = "normal") => {
    setCameraMode(mode);
    setFrozen(false);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setScanPhase("idle");
    setScanProgress(0);
    setScanErrorMsg(null);
    setFallbackSuggestions(null);
    setShowInlineCamera(true);
  };

  useEffect(() => () => stopProgress(), []);

  const endRef = useRef<HTMLDivElement>(null);
  const latestAssistant = useMemo(
    () => [...history].reverse().find((entry) => entry.role === "assistant")?.content ?? "",
    [history]
  );
  const streamedAssistant = useStreamingText(latestAssistant);
  const micSupported = isVoiceInputSupported();
  const activeQuest = getQuestById(activeQuestId ?? undefined);
  const activeQuestStop = activeQuest?.stops[activeQuestStopIndex] ?? null;
  const completedQuest = getQuestById(completedQuestId ?? undefined);

  useEffect(() => {
    if (!questDetailExpanded || !activeQuest) return;
    const timer = window.setTimeout(() => setQuestDetailExpanded(false), 5000);
    return () => window.clearTimeout(timer);
  }, [questDetailExpanded, activeQuestId, activeQuestStopIndex, activeQuest]);

  useEffect(() => {
    if (!initialNarration.trim()) return;
    setHistory((current) => {
      if (current.some(
        (entry) =>
          entry.role === "assistant" && entry.content === initialNarration
      )) {
        return current;
      }
      return [{ role: "assistant", content: initialNarration }, ...current];
    });
  }, [initialNarration]);


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isLoading]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const persistentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRateRef = useRef(playbackRate);
  const appOpenedFired = useRef(false);

  useEffect(() => {
    persistentAudioRef.current = new Audio();
  }, []);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (persistentAudioRef.current) {
      persistentAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    setChatTtsMuted(isMuted);
    if (persistentAudioRef.current) {
      persistentAudioRef.current.muted = isMuted;
    }
    return () => {
      setChatTtsMuted(false);
    };
  }, [isMuted]);

  const stopAllAudio = () => {
    if (speakingGraceTimer.current) {
      window.clearTimeout(speakingGraceTimer.current);
      speakingGraceTimer.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    audioQueue.current = [];
    isPlayingAudio.current = false;
    streamDoneRef.current = true;
    setIsSpeaking(false);
    stopChatTts();
  };

  useEffect(() => {
    return () => {
      cancelRecording();
      stopAllAudio();
    };
  }, []);

  const isPlayingAudio = useRef(false);
  const audioQueue = useRef<string[]>([]);
  const streamDoneRef = useRef(true);
  const speakingGraceTimer = useRef<number | null>(null);

  const processAudioQueue = async () => {
    if (isPlayingAudio.current) return;
    if (speakingGraceTimer.current) {
      window.clearTimeout(speakingGraceTimer.current);
      speakingGraceTimer.current = null;
    }
    isPlayingAudio.current = true;
    while (audioQueue.current.length > 0) {
      const url = audioQueue.current.shift();
      if (url) {
        setIsSpeaking(true);
        try {
          await new Promise<void>((resolve) => {
            const audio = persistentAudioRef.current;
            if (!audio) {
              URL.revokeObjectURL(url);
              resolve();
              return;
            }
            audio.src = url;
            audio.defaultPlaybackRate = playbackRateRef.current;
            audio.playbackRate = playbackRateRef.current;
            currentAudioRef.current = audio;
            audio.onplay = () => {
              audio.playbackRate = playbackRateRef.current;
            };
            audio.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              resolve(); // Continue on error
            };
            audio.play().catch(() => {
              URL.revokeObjectURL(url);
              resolve();
            });
          });
        } finally {
          currentAudioRef.current = null;
        }
      }
    }
    isPlayingAudio.current = false;
    if (!streamDoneRef.current) {
      speakingGraceTimer.current = window.setTimeout(() => {
        speakingGraceTimer.current = null;
        if (!isPlayingAudio.current && audioQueue.current.length === 0) {
          setIsSpeaking(false);
        }
      }, 400);
    } else {
      setIsSpeaking(false);
    }
  };

  const enqueueAudioBlob = (url: string) => {
    audioQueue.current.push(url);
    processAudioQueue();
  };

  const send = async (message = input, isSystemEvent = false, requestSuggestNext = false, overrideItemId?: number) => {
    const cleaned = message.trim();
    if (!cleaned || isLoading) return;
    
    audioQueue.current = [];
    stopAllAudio();
    streamDoneRef.current = false;

    if (!isSystemEvent) {
      setSuggestedNextPoint(null);
      setActionButtons([]);
    }
    
    const userMessage: ChatMessage = { role: "user", content: cleaned };
    const previous = history.slice(-10);
    setHistory((current) => [...current, userMessage]);
    setHistory((current) => [...current, { role: "assistant", content: "" }]);

    if (!isSystemEvent) {
      setInput("");
    }
    setIsLoading(true);

    try {
      const stream = chatWithCompanionStream(
        overrideItemId ?? activeItemId,
        cleaned,
        previous,
        getVisitedItemIds(window.localStorage),
        getVisitorSessionId(),
        requestSuggestNext,
        language
      );
      
      let fullContent = "";
      let lastSpokenIndex = 0;
      let nextItemId = null;
      let nextItemName = null;
      const isMiniChallengeRequest = cleaned.includes("[SYSTEM_EVENT]: MINI_CHALLENGE");

      for await (const chunk of stream) {
        if (chunk.type === "metadata") {
          nextItemId = chunk.data.next_item_id;
          nextItemName = chunk.data.next_item_name;
        } else if (chunk.type === "actions") {
          setActionButtons((prev) => [...prev, ...(chunk.data.buttons || [])]);
        } else if (chunk.type === "chunk") {
          fullContent += chunk.data.text;
          
          let displayContent = fullContent;
          const questions: { type: string; label: string; payload: string }[] = [];
          
          const regex = /\|\|Q:\s*(.+?)\|\|/g;
          let match;
          while ((match = regex.exec(fullContent)) !== null) {
            questions.push({
              type: "text",
              label: match[1].trim(),
              payload: match[1].trim()
            });
          }
          
          displayContent = fullContent.replace(/\|\|Q:\s*(.+?)\|\|/g, "").trim();
          
          setHistory((current) => {
            const newHistory = [...current];
            newHistory[newHistory.length - 1] = { role: "assistant", content: displayContent };
            return newHistory;
          });

          if (questions.length > 0) {
            setActionButtons((prev) => {
              if (isMiniChallengeRequest) return questions;
              const nonTextButtons = prev.filter((b) => b.type !== "text");
              return [...nonTextButtons, ...questions];
            });
          }
        } else if (chunk.type === "audio") {
          const audioBase64 = chunk.data.audio_base64;
          if (audioBase64) {
            const bytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'audio/mpeg' });
            enqueueAudioBlob(URL.createObjectURL(blob));
          }
        }
      }
      streamDoneRef.current = true;
      processAudioQueue();

      if (nextItemId !== null && nextItemName && onSuggestNextPoint) {
        setSuggestedNextPoint({ id: nextItemId, name: nextItemName });
      } else {
        setSuggestedNextPoint(null);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setHistory((current) => {
        const newHistory = [...current];
        const lastMsg = newHistory[newHistory.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          if (lastMsg.content.trim()) {
            newHistory[newHistory.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + `\n\n*(${t.companion.errorPrefix}${errMsg})*`,
            };
          } else {
            newHistory[newHistory.length - 1] = {
              ...lastMsg,
              content: `${t.companion.errorPrefix}${errMsg}`,
            };
          }
        }
        return newHistory;
      });
    } finally {
      streamDoneRef.current = true;
      processAudioQueue();
      setIsLoading(false);
    }
  };

  const processAudioRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    processAudioRef.current = async () => {
      if (!isRecording) return;
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        const audioBlob = await stopRecording();
        const transcript = await transcribeAudio(audioBlob);
        setInput(transcript);
        await send(transcript);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t.companion.micErrorRecognize;
        alert(message);
      } finally {
        setIsTranscribing(false);
      }
    };
  });

  const unlockQuestCards = () => {
    setShowQuestCards(true);
    setActiveQuestId(null);
    setQuestDetailExpanded(false);
    setCompletedQuestId(null);
    setSuggestedNextPoint(null);
    setActionButtons([]);
    unlockCompanionQuests(window.localStorage);
  };

  const handleNormalTour = () => {
    setShowQuestCards(false);
    setActiveQuestId(null);
    setQuestDetailExpanded(false);
    setCompletedQuestId(null);
    setActionButtons([]);
    void send(t.companion.questNormalTourPrompt);
  };

  const showQuestStepPrompt = (quest: CompanionQuest, stopIndex: number) => {
    const stop = quest.stops[stopIndex];
    if (!stop) return;
    const text = `${t.companion.questSelected.replace("{name}", quest.title)}\n\nĐiểm ${stopIndex + 1}/${quest.stops.length}: ${stop.title}. ${stop.hint}`;
    setHistory((current) => [...current, { role: "assistant", content: text }]);
    setActionButtons([]);
    setQuestDetailExpanded(true);
    void speak(text);
  };

  const handleSelectQuest = (quest: CompanionQuest) => {
    setShowQuestCards(false);
    setCompletedQuestId(null);
    startCompanionQuest(window.localStorage, quest.id);
    setActiveQuestId(quest.id);
    setActiveQuestStopIndex(0);
    setSuggestedNextPoint(null);
    showQuestStepPrompt(quest, 0);
  };

  const showQuestCardsAgain = () => {
    setShowQuestCards(true);
    setActiveQuestId(null);
    setQuestDetailExpanded(false);
    setCompletedQuestId(null);
    setActionButtons([]);
    unlockCompanionQuests(window.localStorage);
  };

  const completeQuest = (quest: CompanionQuest, finalLine: string) => {
    setActiveQuestId(null);
    setQuestDetailExpanded(false);
    setCompletedQuestId(quest.id);
    setActionButtons([]);
    const text = `${finalLine}\n\nBạn đã hoàn thành ${quest.title}! Thẻ Lưu Niệm độc quyền của bạn là: ${quest.reward}.`;
    setHistory((current) => [...current, { role: "assistant", content: text }]);
    setCompanionQuestState(window.localStorage, {
      status: "quest_completed",
      selectedQuestId: quest.id,
      currentStopIndex: quest.stops.length,
      completedStopIds: quest.stops.map((stop) => stop.id),
      answeredStopIds: quest.stops.map((stop) => stop.id),
    });
    void speak(text);
  };

  const advanceQuestAfterAnswer = (quest: CompanionQuest, stop: CompanionQuestStop, choiceId?: "A" | "B" | "C") => {
    const isCorrect = choiceId === stop.correctChoiceId;
    const nextState = advanceCompanionQuest(window.localStorage, stop.id, quest.stops.length);
    const prefix = isCorrect ? t.companion.questCorrectAnswer : t.companion.questWrongAnswer;
    const nextStop = quest.stops[nextState.currentStopIndex ?? quest.stops.length];

    if (!nextStop) {
      completeQuest(quest, `${prefix} ${stop.successLine}\n\n${stop.explanation}`);
      return;
    }

    setActiveQuestId(quest.id);
    setActiveQuestStopIndex(nextState.currentStopIndex ?? 0);
    const text = `${prefix} ${stop.successLine}\n\n${stop.explanation}\n\n${t.companion.questNextStop}: ${nextStop.title}. ${nextStop.hint}`;
    setHistory((current) => [...current, { role: "assistant", content: text }]);
    setActionButtons([]);
    setQuestDetailExpanded(true);
    void speak(text);
  };

  const showQuestRiddle = (quest: CompanionQuest, stop: CompanionQuestStop) => {
    const text = `${t.companion.questFoundTarget.replace("{name}", stop.title)}\n\n${stop.riddle}`;
    setHistory((current) => [...current, { role: "assistant", content: text }]);
    setActionButtons(
      stop.choices.map((choice) => ({
        type: "quest_answer",
        label: choice.label,
        questId: quest.id,
        stopId: stop.id,
        choiceId: choice.id,
      }))
    );
    void speak(text);
  };

  const handleCapture = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const previousCapturedUrl = capturedUrl;
    setCapturedUrl(url);
    if (previousCapturedUrl) URL.revokeObjectURL(previousCapturedUrl);
    setFrozen(true);
    setScanPhase("scanning");
    setScanErrorMsg(null);
    startProgress();

    try {
      const response = await searchImage(blob);
      stopProgress();
      setScanProgress(100);

      if (response.found && response.results.length > 0) {
        setScanPhase("found");
        const bestMatch = response.results[0];

        addVisitedItem(window.localStorage, bestMatch.item_id);
        rememberMinimapItem(groupSlug, bestMatch.item_id);

        if (cameraMode === "bait") {
          if (!isQuestBaitTarget(bestMatch.name)) {
            setTimeout(() => {
              setFrozen(false);
              URL.revokeObjectURL(url);
              setCapturedUrl(null);
              setScanPhase("idle");
              setScanProgress(0);
              setScanErrorMsg(t.companion.questBaitWrongTarget.replace("{name}", bestMatch.name));
            }, 700);
            return;
          }

          setTimeout(() => {
            setShowInlineCamera(false);
            setCameraMode("normal");
            setActiveItemId(bestMatch.item_id);
            const text = t.companion.questBaitSuccess;
            setHistory((current) => [...current, { role: "assistant", content: text }]);
            unlockQuestCards();
            void speak(text);
          }, 900);
          return;
        }

        if (cameraMode === "quest") {
          const quest = activeQuest;
          const stop = activeQuestStop;
          if (!quest || !stop) {
            setCameraMode("normal");
            setShowInlineCamera(false);
            return;
          }

          if (!matchQuestStopTarget(bestMatch.name, stop)) {
            setTimeout(() => {
              setFrozen(false);
              URL.revokeObjectURL(url);
              setCapturedUrl(null);
              setScanPhase("idle");
              setScanProgress(0);
              setScanErrorMsg(
                t.companion.questWrongTarget
                  .replace("{name}", bestMatch.name)
                  .replace("{target}", stop.title)
              );
              setActionButtons([
                { type: "quest_scan_stop", label: t.companion.questScanStop, questId: quest.id, stopId: stop.id },
                { type: "tell_story", label: t.companion.discoveryTellStory },
              ]);
              setLastScannedDiscovery(makeDiscoveryState(bestMatch, t.companion.discoveryDefaultHook));
            }, 700);
            return;
          }

          setTimeout(() => {
            setShowInlineCamera(false);
            setCameraMode("normal");
            setActiveItemId(bestMatch.item_id);
            showQuestRiddle(quest, stop);
          }, 900);
          return;
        }

        setTimeout(() => {
          const nextDiscovery = makeDiscoveryState(bestMatch, t.companion.discoveryDefaultHook);
          setShowInlineCamera(false);
          setActiveItemId(bestMatch.item_id);
          setLastScannedDiscovery(nextDiscovery);
          setDiscovery(nextDiscovery);
        }, 900);
        return;
      }

      if (!response.found && response.results && response.results.length > 0) {
        const topMatches = response.results.slice(0, 3);
        setFallbackSuggestions(topMatches);
        setScanPhase("idle");
        
        const name1 = topMatches[0]?.name;
        const name2 = topMatches[1]?.name;
        let text = t.companion.uncertainAngle;
        if (topMatches.length >= 2) {
          text += `**${name1}**${t.companion.or}**${name2}**${t.companion.not}`;
        } else {
          text += `**${name1}**${t.companion.not}`;
        }
        text += t.companion.pickOne;
        
        setHistory((current) => [...current, { role: "assistant", content: text }]);
        void speak(text);
        
        stopProgress();
        setScanProgress(0);
        return;
      }

      setScanErrorMsg(response.message || t.companion.scanErrorNone);
      setFrozen(false);
      setScanPhase("idle");
      stopProgress();
      setScanProgress(0);
    } catch {
      setScanErrorMsg(t.companion.scanErrorGeneral);
      setFrozen(false);
      setScanPhase("idle");
      stopProgress();
      setScanProgress(0);
    }
  };

  const handleUploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || scanPhase !== "idle") return;
    void handleCapture(file);
  };

  const handleSuggestionSelect = (match: SearchMatch) => {
    setFallbackSuggestions(null);
    setScanPhase("found");
    
    addVisitedItem(window.localStorage, match.item_id);
    rememberMinimapItem(groupSlug, match.item_id);
    
    setTimeout(() => {
      const nextDiscovery = makeDiscoveryState(match, t.companion.discoveryDefaultHook);
      setShowInlineCamera(false);
      setActiveItemId(match.item_id);
      setLastScannedDiscovery(nextDiscovery);
      setDiscovery(nextDiscovery);
    }, 900);
  };

  const tellStoryForDiscovery = (currentDiscovery: DiscoveryState) => {
    setAwaitingQuizAnswer(false);
    setActionButtons([]);
    setDiscovery(null);
    setActiveItemId(currentDiscovery.itemId);
    const scanMessage = `[SYSTEM_EVENT]: SCAN_SUCCESS\nHiện vật vừa nhận diện: ${currentDiscovery.itemName}. Hãy chào mừng thật ngắn gọn, kể điểm thú vị nhất, rồi mời khách hỏi tiếp.`;
    void send(scanMessage, true, true, currentDiscovery.itemId);
  };

  const handleTellStoryFromDiscovery = () => {
    if (!discovery) return;
    tellStoryForDiscovery(discovery);
  };

  const handleStartChallengeFromDiscovery = () => {
    if (!discovery) return;
    const currentDiscovery = discovery;
    setDiscovery(null);
    setActiveItemId(currentDiscovery.itemId);
    setSuggestedNextPoint(null);
    setActionButtons([]);
    setAwaitingQuizAnswer(true);
    const challengeMessage = `[SYSTEM_EVENT]: MINI_CHALLENGE\nHiện vật vừa nhận diện: ${currentDiscovery.itemName}. Hãy tạo một câu đố trắc nghiệm ngắn có đúng 3 lựa chọn, liên quan trực tiếp đến hiện vật. Không tiết lộ đáp án. Kết thúc bằng đúng 3 nút lựa chọn theo định dạng ||Q: A. ...|| ||Q: B. ...|| ||Q: C. ...||.`;
    void send(challengeMessage, true, false, currentDiscovery.itemId);
  };

  const handleAppOpened = () => {
    if (onCompleteIntro) onCompleteIntro();
    
    // Unlock Audio Context on iOS/Safari by playing a silent sound on first user interaction
    try {
      const audio = persistentAudioRef.current;
      if (audio) {
        audio.src = "data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
        audio.play().catch(() => {});
      }
    } catch (e) {}

    if (history.length === 0 && !appOpenedFired.current) {
      if ((window as any).__companionAppOpenedFired) return;
      (window as any).__companionAppOpenedFired = true;
      appOpenedFired.current = true;

      const questState = getCompanionQuestState(window.localStorage);
      if (questState.status === "quests_unlocked") {
        setShowQuestCards(true);
        return;
      }
      if (questState.status === "quest_active" && questState.selectedQuestId) {
        const quest = getQuestById(questState.selectedQuestId);
        if (quest) {
          const stopIndex = Math.min(questState.currentStopIndex ?? 0, quest.stops.length - 1);
          setActiveQuestId(quest.id);
          setActiveQuestStopIndex(stopIndex);
          setShowQuestCards(false);
          showQuestStepPrompt(quest, stopIndex);
          return;
        }
      }
      if (questState.status === "quest_completed" && questState.selectedQuestId) {
        setCompletedQuestId(questState.selectedQuestId);
        return;
      }

      const text = t.companion.questIntroText;
      setHistory([{ role: "assistant", content: text }]);
      setActionButtons([
        { type: "quest_open_camera", label: t.companion.questOpenCamera },
        { type: "normal_tour", label: t.companion.questNormalTour },
      ]);
      setCompanionQuestState(window.localStorage, { status: "bait_prompted" });
      void speak(text);
    }
  };

  const toggleMic = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      if (processAudioRef.current) await processAudioRef.current();
      return;
    }

    stopAllAudio();
    setIsSpeaking(false);
    try {
      await startRecording(() => {
        if (processAudioRef.current) void processAudioRef.current();
      });
      setIsRecording(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.companion.micErrorNone;
      alert(
        `${message}\n\n${t.companion.micErrorPermission}`
      );
    }
  };

  const avatarCollapsed = !compact && !isSpeaking && !isLoading && history.length > 0 && !isManuallyExpanded;

  useEffect(() => {
    if (avatarCollapsed) {
      const timer = setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [avatarCollapsed]);

  // Calculate the exact gap created by the clip-path so the chat UI can sit perfectly below the curve
  const gapMargin = (!compact && !showIntro && !avatarCollapsed && !activeQuest) ? "max(-13.5%, -54px)" : "0px";

  return (
    <section className="flex min-h-0 flex-1 flex-col relative">
      <div 
        className={`w-full shrink-0 flex ${compact ? "justify-center mt-2 mb-2" : "justify-center"} ${compact || showIntro ? "" : "companion-avatar-wrapper"} ${!compact && !showIntro && !avatarCollapsed ? "companion-avatar-wrapper--curved companion-avatar-wrapper--expanded" : ""} ${!compact && !showIntro && avatarCollapsed ? "companion-avatar-wrapper--collapsed" : ""}`}
        onClick={() => {
          if (!compact && !showIntro) {
            if (avatarCollapsed) setIsManuallyExpanded(true);
            else if (isManuallyExpanded) setIsManuallyExpanded(false);
          }
        }}
        style={{ cursor: (!compact && !showIntro && (avatarCollapsed || isManuallyExpanded)) ? 'pointer' : 'default' }}
      >
        <CompanionAvatar isSpeaking={isSpeaking} size={compact ? "sm" : "lg"} collapsed={avatarCollapsed} introMode={showIntro} onIntroComplete={handleAppOpened} />
        {!compact && !showIntro && !avatarCollapsed && (
          <div 
            className="absolute inset-0 pointer-events-none z-20" 
            style={{
              background: "radial-gradient(ellipse 100% 100% at 50% -18%, transparent 88%, rgba(34, 56, 104, 0.8) 100%)"
            }}
          />
        )}
      </div>

      {!showIntro && activeQuest && (
        <CompanionQuestProgress
          quest={activeQuest}
          stop={activeQuestStop}
          currentStopIndex={activeQuestStopIndex}
          expanded={questDetailExpanded}
          scanLabel={t.companion.questScanStop}
          switchLabel={t.companion.questChooseAnother}
          onToggleExpanded={() => setQuestDetailExpanded((current) => !current)}
          onScanStop={() => openInlineCamera("quest")}
          onShowCards={showQuestCardsAgain}
        />
      )}

      <div className="relative min-h-0 flex-1 flex flex-col z-10" style={{ marginTop: gapMargin }}>
        {/* Intro Text Overlay */}
        <div className={`absolute left-0 right-0 flex flex-col items-center justify-start px-6 text-center transition-opacity duration-1000 z-20 ${showIntro ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ top: "-90px" }}>
          <h1 className="font-serif text-[28px] sm:text-3xl text-amber-100 drop-shadow-md">{t.companion.introTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-100/80 max-w-[280px] sm:max-w-sm drop-shadow">
            {t.companion.introSubtitle}
          </p>
          <button
            type="button"
            onClick={handleAppOpened}
            className="mt-6 px-6 py-3 rounded-full bg-amber-500 text-black font-bold uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
          >
            {t.companion.introStart}
          </button>
        </div>

        {/* Chat UI */}
        <div className={`absolute inset-0 flex flex-col transition-opacity duration-1000 ${showIntro ? "opacity-0 pointer-events-none" : "opacity-100 delay-500"}`}>
          <div className="min-h-0 flex-1 flex flex-col px-4 pb-4 pt-2 relative">
            <div 
              className="flex-1 overflow-y-auto space-y-3 companion-chat-scroll relative z-10"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, black 40px)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40px)"
              }}
            >
              <div className="pt-10" />
              {history.map((message, index) => {
                if (message.content.startsWith("[SYSTEM_EVENT]")) return null;
                const isLatestAssistant =
                  message.role === "assistant" &&
                  message.content === latestAssistant &&
                  index === history.map((entry) => entry.content).lastIndexOf(latestAssistant);

                if (message.role === "user") {
                  return (
                    <div key={`${message.role}-${index}`} className="flex justify-end">
                      <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 bg-amber-500 text-black">
                        {message.content}
                      </div>
                    </div>
                  );
                }

                // Assistant messages: split by \n\n to create separate bubbles
                const parts = message.content.split(/\n\n+/).filter(Boolean);
                const streamedContent = isLatestAssistant ? streamedAssistant : message.content;
                // We must use the full streamed content so far and split it
                const streamedParts = streamedContent.split(/\n\n+/).filter(Boolean);

                return (
                  <div key={`${message.role}-${index}`} className="flex flex-col gap-3">
                    {streamedParts.map((partText, partIndex) => (
                      <div key={partIndex} className="flex justify-start">
                        <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 border border-amber-200/15 bg-white/[0.06] text-amber-50">
                          {/* Parse markdown bold **text** for simplicity, or just plain text since React doesn't auto-parse md without a library. The previous code just rendered {content} directly. Let's keep it direct. */}
                          {partText}
                          {/* Show speaker icon only on the last part of the completed message */}
                          {!isLatestAssistant && partIndex === parts.length - 1 && (
                            <button
                              type="button"
                              onClick={() => void speak(message.content)}
                              className="ml-2 text-amber-300"
                              aria-label={t.companion.micLabelRead}
                            >
                              🔊
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}



              {isLoading && <p className="text-sm text-amber-200/60">{t.companion.thinking}</p>}
              
              {/* Proactive Action Buttons */}
              {!isLoading && ((!awaitingQuizAnswer && suggestedNextPoint) || actionButtons.length > 0) && (
                <div className="flex flex-wrap gap-2 mt-4 animate-in slide-in-from-bottom-4 duration-500 pb-2">
                  {actionButtons.map((btn, idx) => {
                    if (btn.type === "open_camera") {
                      if (suggestedNextPoint) return null;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => openInlineCamera("normal")}
                          className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 px-3 py-1.5 rounded-full transition-colors text-emerald-100 text-sm font-medium shadow-sm"
                        >
                          <span className="text-emerald-400">📸</span>
                          <span>{btn.label.replace("📸 ", "")}</span>
                        </button>
                      );
                    } else if (btn.type === "quest_open_camera") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActionButtons([]);
                            openInlineCamera("bait");
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-base font-black text-black shadow-[0_0_28px_rgba(245,158,11,0.55)] ring-2 ring-amber-200/40 transition-all hover:scale-[1.02] active:scale-95 animate-pulse"
                        >
                          <span>📸</span>
                          <span>{btn.label.replace("📸 ", "")}</span>
                        </button>
                      );
                    } else if (btn.type === "normal_tour") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={handleNormalTour}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-amber-100/80 transition-colors hover:bg-white/[0.1]"
                        >
                          {btn.label}
                        </button>
                      );
                    } else if (btn.type === "restart_tour") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            window.localStorage.removeItem("visited_item_ids");
                            window.location.reload();
                          }}
                          className="inline-flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 px-3 py-1.5 rounded-full transition-colors text-blue-100 text-sm font-medium shadow-sm"
                        >
                          <span className="text-blue-400">🔄</span>
                          <span>{btn.label.replace("🔄 ", "")}</span>
                        </button>
                      );
                    } else if (btn.type === "rate_experience") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            alert(t.companion.msgFeedbackThanks);
                            setActionButtons(current => current.filter(b => b.type !== "rate_experience"));
                          }}
                          className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 px-3 py-1.5 rounded-full transition-colors text-amber-100 text-sm font-medium shadow-sm"
                        >
                          <span className="text-amber-500">🌟</span>
                          <span>{t.companion.btnFeedback}</span>
                        </button>
                      );
                    } else if (btn.type === "quest_scan_stop") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActionButtons([]);
                            openInlineCamera("quest");
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-transform hover:scale-[1.01] active:scale-95"
                        >
                          <span>📸</span>
                          <span>{btn.label.replace("📸 ", "")}</span>
                        </button>
                      );
                    } else if (btn.type === "quest_show_cards") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={showQuestCardsAgain}
                          className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-amber-100/75 transition-colors hover:bg-white/[0.1]"
                        >
                          {btn.label}
                        </button>
                      );
                    } else if (btn.type === "quest_answer") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const quest = getQuestById(btn.questId);
                            const stop = quest?.stops.find((entry) => entry.id === btn.stopId);
                            if (!quest || !stop) return;
                            setActionButtons([]);
                            advanceQuestAfterAnswer(quest, stop, btn.choiceId);
                          }}
                          className="inline-flex w-full items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-500/20"
                        >
                          <span className="text-amber-400">✦</span>
                          <span>{btn.label}</span>
                        </button>
                      );
                    } else if (btn.type === "tell_story") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const target = lastScannedDiscovery;
                            if (target) tellStoryForDiscovery(target);
                          }}
                          className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 px-3 py-1.5 rounded-full transition-colors text-amber-100 text-sm font-medium shadow-sm"
                        >
                          <span className="text-amber-400">🎧</span>
                          <span>{btn.label}</span>
                        </button>
                      );
                    } else if (btn.type === "text") {
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const payload = btn.payload || btn.label;
                            setActionButtons([]);
                            if (awaitingQuizAnswer) {
                              setAwaitingQuizAnswer(false);
                              void (async () => {
                                await send(
                                  `[SYSTEM_EVENT]: QUIZ_ANSWER\nKhách chọn: ${payload}. Hãy phản hồi đúng/sai dựa trên câu đố vừa hỏi, giải thích trong 1-2 câu rồi mời khách nghe câu chuyện đầy đủ.`,
                                  true,
                                  false,
                                  activeItemId ?? undefined
                                );
                                setActionButtons([{ type: "tell_story", label: t.companion.discoveryTellStory }]);
                              })();
                              return;
                            }
                            void send(payload);
                          }}
                          className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-3 py-1.5 rounded-full transition-colors text-amber-100 text-sm font-medium shadow-sm"
                        >
                          <span className="text-amber-500">💬</span>
                          <span>{btn.label}</span>
                        </button>
                      );
                    }
                    return null;
                  })}
                  
                  {suggestedNextPoint && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestedNextPoint(null);
                          void send(t.companion.askMoreDetail);
                        }}
                        className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-3 py-1.5 rounded-full transition-colors text-amber-100 text-sm font-medium shadow-sm"
                      >
                        <span className="text-amber-500">❓</span>
                        {t.companion.askMore}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSuggestNextPoint) {
                            onSuggestNextPoint(suggestedNextPoint.id, suggestedNextPoint.name);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/40 hover:bg-blue-500/25 px-3 py-1.5 rounded-full transition-colors text-blue-100 text-sm font-medium shadow-sm"
                      >
                        <span className="text-blue-400">🗺️</span>
                        {t.companion.exploreNext.replace("{name}", suggestedNextPoint.name)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openInlineCamera("normal");
                        }}
                        className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 px-3 py-1.5 rounded-full transition-colors text-emerald-100 text-sm font-medium shadow-sm"
                      >
                        <span className="text-emerald-400">📸</span>
                        <span>{t.companion.scanMore}</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {showQuestCards && (
                <CompanionQuestCards
                  title={t.companion.questUnlockedTitle}
                  startLabel={t.companion.questStart}
                  quests={COMPANION_QUESTS}
                  onSelectQuest={handleSelectQuest}
                />
              )}


              {completedQuest && (
                <CompanionQuestReward
                  quest={completedQuest}
                  chooseAnotherLabel={t.companion.questChooseAnother}
                  continueLabel={t.companion.questContinueTour}
                  onChooseAnother={showQuestCardsAgain}
                  onContinueTour={handleNormalTour}
                />
              )}

              {history.length === 0 && (
                <p className="rounded-xl border border-amber-300/15 bg-white/[0.04] p-4 text-center text-sm text-amber-100/70">
                  {t.companion.chatEmptyState}
                </p>
              )}
              <div ref={endRef} />
            </div>

            {/* Large Glowing Mic Section */}
            {micSupported && !compact && (
              <div className="mt-2 flex flex-col items-center justify-center py-2 shrink-0">
                <div className="flex items-center justify-center gap-6">
                  {/* The Mic */}
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    {/* Outer dashed ring */}
                    <div className={`absolute inset-0 m-auto h-16 w-16 rounded-full border-2 border-dashed border-blue-400/40 ${isRecording ? "animate-[spin_4s_linear_infinite]" : ""}`} />

                    {/* Pulsing rings when listening */}
                    {isRecording && (
                      <>
                        <div className="absolute inset-0 m-auto h-14 w-14 animate-ping rounded-full bg-blue-500/40" />
                        <div className="absolute inset-0 m-auto h-20 w-20 animate-pulse rounded-full bg-blue-400/20" />
                      </>
                    )}

                    {/* Main Button */}
                    <button
                      type="button"
                      onClick={() => void toggleMic()}
                      disabled={isTranscribing}
                      className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all duration-300 disabled:opacity-50 ${isRecording ? "scale-110 shadow-[0_0_30px_rgba(59,130,246,0.8)]" : "hover:scale-105"}`}
                      aria-label={isRecording ? t.companion.micLabelStop : t.companion.micLabelSpeak}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-6 w-6 text-white"
                      >
                        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 0 1-2 0 3 3 0 0 1-6 0 1 1 0 0 1-2 0 5 5 0 0 0 4 4.9V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-3.1A5 5 0 0 0 17 11z" />
                      </svg>
                    </button>
                  </div>

                  {/* The Waveform Effect (Right side) */}
                  {isRecording && (
                    <div className="flex items-center justify-center gap-[2px] h-12 w-32 pl-2">
                      {[...Array(30)].map((_, i) => {
                        const colors = ["bg-teal-400", "bg-cyan-400", "bg-blue-500", "bg-indigo-500", "bg-purple-500"];
                        const colorClass = colors[Math.floor((i / 30) * colors.length)];
                        const animationType = (i % 5) + 1;
                        const delay = (i % 4) * 0.15;
                        const duration = 0.8 + (i % 3) * 0.2;
                        return (
                          <div
                            key={i}
                            className={`w-1 ${colorClass} rounded-full`}
                            style={{ animation: `sound-wave-${animationType} ${duration}s ease-in-out infinite ${delay}s` }}
                          ></div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {isRecording && (
                  <span className="mt-6 text-sm font-medium text-blue-300 animate-pulse drop-shadow-md tracking-wide">{t.companion.listening}</span>
                )}
                {isTranscribing && (
                  <span className="mt-6 text-sm font-medium text-blue-200/50 tracking-wide">{t.companion.processingAudio}</span>
                )}
              </div>
            )}
          </div>

          {/* Floating UI */}
          {!showTextInput && (
            <div className="absolute bottom-4 right-4 flex flex-col gap-3 z-50">
              {micSupported && compact && (
                <button
                  type="button"
                  onClick={() => void toggleMic()}
                  disabled={isTranscribing}
                  aria-label={isRecording ? t.companion.micLabelStop : t.companion.micLabelSpeak}
                  className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all ${
                    isRecording
                      ? "bg-blue-600 text-white animate-pulse scale-110 shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                      : "bg-blue-500 text-white hover:scale-105"
                  }`}
                >
                  {isRecording ? (
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400/50 animate-ping"></div>
                  ) : null}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 z-10">
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 0 1-2 0 3 3 0 0 1-6 0 1 1 0 0 1-2 0 5 5 0 0 0 4 4.9V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-3.1A5 5 0 0 0 17 11z" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  openInlineCamera("normal");
                }}
                className="flex h-10 w-10 mx-auto shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all hover:scale-105 active:scale-95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                aria-label={t.companion.openCameraLabel}
              >
                📸
              </button>
              <button
                type="button"
                onClick={() => setShowTextInput(true)}
                aria-label={t.companion.openKeyboardLabel}
                className="flex items-center justify-center transition-all hover:scale-105 active:scale-95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36" fill="currentColor" className="w-[36px] h-[18px] text-amber-200/90 hover:text-amber-100">
                  <rect x="2" y="2" width="68" height="32" rx="6" fill="#0b1328" stroke="currentColor" strokeWidth="2" />
                  {/* Top row */}
                  <rect x="6" y="6" width="6" height="4" rx="1" />
                  <rect x="14" y="6" width="6" height="4" rx="1" />
                  <rect x="22" y="6" width="6" height="4" rx="1" />
                  <rect x="30" y="6" width="6" height="4" rx="1" />
                  <rect x="38" y="6" width="6" height="4" rx="1" />
                  <rect x="46" y="6" width="6" height="4" rx="1" />
                  <rect x="54" y="6" width="12" height="4" rx="1" />
                  {/* Middle row */}
                  <rect x="6" y="14" width="10" height="5" rx="1" />
                  <rect x="18" y="14" width="6" height="5" rx="1" />
                  <rect x="26" y="14" width="6" height="5" rx="1" />
                  <rect x="34" y="14" width="6" height="5" rx="1" />
                  <rect x="42" y="14" width="6" height="5" rx="1" />
                  <rect x="50" y="14" width="6" height="5" rx="1" />
                  <rect x="58" y="14" width="8" height="5" rx="1" />
                  {/* Bottom row */}
                  <rect x="6" y="23" width="8" height="5" rx="1" />
                  <rect x="16" y="23" width="6" height="5" rx="1" />
                  <rect x="24" y="23" width="24" height="5" rx="1" /> {/* Spacebar */}
                  <rect x="50" y="23" width="6" height="5" rx="1" />
                  <rect x="58" y="23" width="8" height="5" rx="1" />
                </svg>
              </button>
            </div>
          )}

          {showTextInput && (
            <div className="flex items-center gap-2 border-t border-amber-200/15 bg-black/20 p-3 shrink-0 relative z-50">
              <button
                type="button"
                onClick={() => setShowTextInput(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-amber-100/70 hover:bg-white/[0.1] hover:text-amber-100 transition-colors"
                aria-label={t.companion.closeKeyboardLabel}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* If not compact, we still show the inline mic button just in case, or we rely on the large mic. Actually the previous code had inline mic only for compact. Since we removed inline mic for compact (replaced by floating), we don't need it here. */}
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void send();
                }}
                placeholder={t.companion.chatPlaceholder}
                disabled={isTranscribing || isRecording}
                className="min-w-0 flex-1 rounded-full border border-amber-200/15 bg-white/[0.06] px-4 py-2 text-base outline-none disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!input.trim() || isLoading}
                onClick={() => void send()}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40 transition-transform active:scale-95"
              >
                {t.companion.btnSend}
              </button>
            </div>
          )}
        </div>
      </div>

      {discovery && (
        <CompanionDiscoveryCard
          open={Boolean(discovery)}
          itemName={discovery.itemName}
          confidence={discovery.confidence}
          description={discovery.description}
          images={discovery.images}
          hook={discovery.hook}
          labels={{
            found: t.companion.discoveryFound,
            confidenceHigh: t.companion.discoveryConfidenceHigh,
            confidenceMedium: t.companion.discoveryConfidenceMedium,
            tellStory: t.companion.discoveryTellStory,
            challenge: t.companion.discoveryChallenge,
            slideshow: t.companion.discoverySlideshow,
            showMap: t.companion.discoveryShowMap,
            close: t.common.close,
            imageAlt: t.companion.discoveryImageAlt,
          }}
          onTellStory={handleTellStoryFromDiscovery}
          onStartChallenge={handleStartChallengeFromDiscovery}
          onShowMap={() => {
            const currentDiscovery = discovery;
            setDiscovery(null);
            if (onSuggestNextPoint) {
              onSuggestNextPoint(currentDiscovery.itemId, currentDiscovery.itemName);
            }
          }}
          onClose={() => setDiscovery(null)}
        />
      )}

      {showInlineCamera && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          {!fallbackSuggestions ? (
            <div className="mb-4 flex flex-col items-center gap-3 px-4 text-center">
              <p className="text-sm font-bold text-amber-100">
                {cameraMode === "bait"
                  ? t.companion.questBaitHint
                  : cameraMode === "quest" && activeQuestStop
                  ? activeQuestStop.hint
                  : t.companion.cameraInstruction}
              </p>
              {cameraMode === "bait" && (
                <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 shadow-[0_0_22px_rgba(245,158,11,0.18)]">
                  <div className="mx-auto mb-2 flex h-16 w-24 items-end justify-center rounded-t-full border-4 border-amber-200/60 border-b-0 bg-black/35 opacity-70 shadow-inner">
                    <div className="mb-0 h-8 w-9 rounded-t-full border-2 border-amber-100/70 border-b-0" />
                  </div>
                  <p className="text-xs font-medium text-amber-100/80">{t.companion.questBaitSilhouette}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-amber-100 font-bold mb-4 text-center text-sm px-4 animate-pulse">
              🤔 {t.companion.uncertain}
            </p>
          )}
          <div className="w-full max-w-[320px] aspect-[3/4] max-h-[60vh] relative">
            <ScanViewfinderFrame
              scanning={scanPhase === "scanning"}
              scanProgress={scanProgress}
              found={scanPhase === "found"}
            >
              <CameraCapture
                layout="inline"
                onCapture={handleCapture}
                frozen={frozen}
                capturedUrl={capturedUrl}
              />
            </ScanViewfinderFrame>
            
            {fallbackSuggestions && (
              <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/90 via-black/80 to-transparent p-4 flex flex-col justify-end z-20">
                <div className="space-y-2 animate-in slide-in-from-bottom-8 duration-500">
                  {fallbackSuggestions.map((match) => (
                    <button
                      key={match.item_id}
                      type="button"
                      onClick={() => handleSuggestionSelect(match)}
                      className="w-full text-left bg-black/60 backdrop-blur-md border border-amber-500/50 hover:border-amber-400 hover:bg-black/80 p-3 rounded-xl flex items-center gap-3 transition-colors shadow-lg"
                    >
                      {match.image_url && (
                        <img src={match.image_url} alt={match.name} className="w-12 h-12 object-cover rounded-md shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-50 font-semibold truncate text-sm">{match.name}</p>
                        <p className="text-amber-200/60 text-xs truncate">{t.companion.pickThis}</p>
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setFallbackSuggestions(null);
                      setFrozen(false);
                      setCapturedUrl(null);
                    }}
                    className="w-full py-3 mt-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors text-sm"
                  >
                    {t.companion.retakeAngle}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {scanErrorMsg && !fallbackSuggestions && (
            <p className="text-red-400 mt-4 text-xs text-center px-4 bg-red-950/50 py-2 rounded-lg">{scanErrorMsg}</p>
          )}
          
          {!fallbackSuggestions && (
            <div className="mt-8 flex w-full max-w-[260px] flex-col gap-3">
              <button
                type="button"
                onClick={() => document.getElementById("camera-capture-btn")?.click()}
                disabled={scanPhase !== "idle"}
                className="w-full py-4 rounded-full bg-amber-500 text-black font-bold text-lg disabled:opacity-50 transition-transform active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
              >
                {scanPhase === "scanning" ? t.companion.scanning : scanPhase === "found" ? t.companion.identified : t.companion.captureNow}
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadImage}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={scanPhase !== "idle"}
                className="w-full rounded-full border border-amber-300/35 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-amber-100 transition-colors hover:bg-white/[0.1] disabled:opacity-50"
              >
                🖼️ {t.companion.uploadImage}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowInlineCamera(false);
              setCameraMode("normal");
              setScanPhase("idle");
              setFallbackSuggestions(null);
              setFrozen(false);
              setCapturedUrl(null);
            }}
            className="mt-6 text-amber-200/50 text-sm underline"
          >
            {t.companion.closeCamera}
          </button>
        </div>
      )}
    </section>
  );
}
