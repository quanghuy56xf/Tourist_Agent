"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import ChatAssistantBubble from "@/components/visitor/ChatAssistantBubble";
import HeraGuidePanel, { HeraGuidePanelHandle } from "@/components/visitor/HeraGuidePanel";
import ItemHeroSlideshow from "@/components/visitor/ItemHeroSlideshow";
import { stopBrowserSpeech } from "@/lib/browserSpeech";
import { playChatTts, stopChatTts } from "@/lib/chatTts";
import {
  getItem,
  getItemContent,
  GroupItem,
  resolveImageUrl,
  chatWithAI,
  ChatMessage,
} from "@/lib/api";
import { getItemImageUrls } from "@/lib/itemImages";
import { rememberMinimapItem } from "@/lib/minimapState";
import { addVisitedItem } from "@/lib/companionState";
import { groupPath } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import {
  getActiveSearchSessionId,
  getVisitorSessionId,
  readStoredGroupId,
  trackVisitorEvent,
} from "@/lib/visitorAnalytics";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useVisitorPersona } from "@/components/VisitorPersonaProvider";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupSlug = useGroupSlug();
  const scanPath = useGroupPath("/scan");
  const { language, locale, t, ready: localeReady } = useVisitorLocale();
  const { persona, ready: personaReady } = useVisitorPersona();
  const itemId = Number(params.id);
  const similarityParam = searchParams.get("similarity");
  const similarity = Number(similarityParam);
  const confidence =
    similarityParam !== null &&
    Number.isFinite(similarity) &&
    similarity >= 0 &&
    similarity <= 1
      ? `${(similarity * 100).toFixed(1)}%`
      : null;
  const tourId = searchParams.get("tour");
  const inTour = Boolean(tourId);

  const [item, setItem] = useState<GroupItem | null>(null);
  const [content, setContent] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [loadingItem, setLoadingItem] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const heraPanelRef = useRef<HeraGuidePanelHandle>(null);
  const [introActive, setIntroActive] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const stopGuidePlayback = () => {
    heraPanelRef.current?.stopPlayback();
    stopBrowserSpeech();
    stopChatTts();
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAutoSpeak(localStorage.getItem("chat_auto_speak") === "true");
    }
  }, []);


  useEffect(() => {
    return () => {
      stopChatTts();
    };
  }, []);

  useEffect(() => {
    if (!itemId || !personaReady || !localeReady) return;
    let cancelled = false;

    async function loadItemAndStory() {
      try {
        setError("");
        setLoadingItem(true);
        setLoadingContent(true);
        const data = await getItem(itemId);
        if (cancelled) return;
        rememberMinimapItem(groupSlug, itemId);
        addVisitedItem(window.localStorage, itemId);
        setItem(data);
        setLoadingItem(false);
        try {
          const itemContent = await getItemContent(itemId, persona, language);
          if (!cancelled) {
            setContent(itemContent.content);
            setAudioUrl(
              itemContent.audio_url
                ? resolveImageUrl(itemContent.audio_url)
                : null
            );
            setAudioReady(itemContent.has_audio);
          }
        } catch {
          if (!cancelled) {
            setContent(t.item.contentError);
            setAudioUrl(null);
            setAudioReady(false);
          }
        }
      } catch {
        if (!cancelled) setError(t.item.loadError);
      } finally {
        if (!cancelled) {
          setLoadingItem(false);
          setLoadingContent(false);
        }
      }
    }

    loadItemAndStory();
    return () => {
      cancelled = true;
    };
  }, [groupSlug, itemId, persona, language, localeReady, personaReady, t.item.contentError, t.item.loadError]);

  useEffect(() => {
    if (!itemId || !personaReady || !localeReady) return;
    void trackVisitorEvent("item_view", {
      groupId: readStoredGroupId() ?? undefined,
      itemId,
      searchSessionId: getActiveSearchSessionId(),
      metadata: { persona, language },
    });
  }, [itemId, language, localeReady, persona, personaReady]);

  useEffect(() => {
    setChatHistory([]);
    setChatInput("");
  }, [language]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isChatting]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatting) return;
    stopGuidePlayback();
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setChatInput("");
    setIsChatting(true);
    try {
      const res = await chatWithAI(itemId, userMsg.content, chatHistory.slice(-10), persona, language, {
        sessionId: getVisitorSessionId(),
        searchSessionId: getActiveSearchSessionId(),
      });
      const assistantContent = res.content;
      setChatHistory([...updatedHistory, { role: "assistant", content: assistantContent }]);
      if (autoSpeak && assistantContent.trim()) {
        void playChatTts(assistantContent, language).catch(() => {
          /* ignore playback errors */
        });
      }
    } catch {
      setChatHistory([
        ...updatedHistory,
        { role: "assistant", content: t.item.chatConnectionError },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  if (loadingItem) {
    return (
      <div className="flex flex-1 min-h-[100dvh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-1 min-h-[100dvh] flex-col items-center justify-center p-6">
        <p className="mb-4" style={{ color: "var(--primary)" }}>
          {error || t.item.notFound}
        </p>
        <BackButton onClick={() => router.push(scanPath)} label={t.common.back} />
      </div>
    );
  }

  const imgSrc = resolveImageUrl(item.main_image_url);
  const slideshowImages = getItemImageUrls(item);

  return (
    <main className="flex flex-1 flex-col w-full overflow-hidden pb-24 relative">
      <div className="relative h-44 shrink-0 overflow-hidden">
        <ItemHeroSlideshow
          images={slideshowImages.length > 0 ? slideshowImages : imgSrc ? [imgSrc] : []}
          active={!introActive}
          alt={item.name}
          fallbackLabel={t.common.noImage}
        />
        <div className="absolute inset-0 item-hero-scrim" />
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
          <HomeButton />
          <BackButton
            onClick={() =>
              router.push(
                inTour
                  ? groupPath(groupSlug, `/tour/${tourId}/play`)
                  : groupPath(groupSlug, "/method")
              )
            }
            label={t.common.back}
            variant="dark"
          />
          {!inTour && (
            <button
              type="button"
              onClick={() => router.push(scanPath)}
              className="artifact-btn-secondary"
            >
              <span aria-hidden="true" className="text-sm">📸</span>
              <span className="text-xs font-medium">Chụp tiếp</span>
            </button>
          )}
        </div>
        {confidence && (
          <span
            className="absolute right-4 top-4 z-10 rounded-full px-2.5 py-1 text-xs"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {t.item.confidence}: {confidence}
          </span>
        )}
        <div className="absolute bottom-3 left-4 right-4 z-10">
          <p className="artifact-section-label mb-1">{t.item.objectLabel}</p>
          <h1 className="font-display break-words text-xl" lang={locale}>
            {item.name}
          </h1>
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4 overflow-y-auto">
        <div className="flex flex-col hera-guide-sticky-wrap">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
            <span className="artifact-section-label px-2">{t.item.guideSection}</span>
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>

          <HeraGuidePanel
            ref={heraPanelRef}
            content={content}
            audioUrl={audioUrl}
            audioReady={audioReady}
            loading={loadingContent}
            language={language}
            overlay={introActive}
            slideshowImages={
              slideshowImages.length > 0 ? slideshowImages : imgSrc ? [imgSrc] : []
            }
            slideshowAlt={item.name}
            onIntroActiveChange={setIntroActive}
          />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          <span className="artifact-section-label px-2">{t.item.qaSection}</span>
          <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>

        <div className="space-y-3">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div
                  className="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {msg.content}
                </div>
              ) : (
                <ChatAssistantBubble
                  content={msg.content}
                  language={language}
                  speakLabel={t.item.speakAnswer}
                  onBeforeSpeak={stopGuidePlayback}
                />
              )}
            </div>
          ))}
          {isChatting && (
            <div className="flex justify-start">
              <div
                className="artifact-card px-4 py-3 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t.item.answering}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </section>

      <div
        className="artifact-fixed-bar"
        style={{ background: "rgba(14,11,7,0.95)", borderTop: "1px solid var(--border)" }}
      >
        <div className="space-y-2">
          {inTour && (
            <button
              type="button"
              onClick={() => router.push(groupPath(groupSlug, `/tour/${tourId}/play`))}
              className="artifact-btn-primary w-full py-3 text-sm"
            >
              {t.item.continueTour} →
            </button>
          )}
          <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !autoSpeak;
              setAutoSpeak(next);
              if (typeof window !== "undefined") {
                localStorage.setItem("chat_auto_speak", String(next));
              }
              if (!next) {
                stopChatTts();
              }
            }}
            aria-label={autoSpeak ? t.item.autoSpeakOn : t.item.autoSpeakOff}
            title={autoSpeak ? t.item.autoSpeakOn : t.item.autoSpeakOff}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg"
            style={{
              background: "var(--secondary)",
              border: `1px solid ${autoSpeak ? "var(--primary)" : "var(--border)"}`,
              color: autoSpeak ? "var(--primary)" : "var(--muted-foreground)",
            }}
          >
            {autoSpeak ? "🔊" : "🔇"}
          </button>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => {
              setChatInput(e.target.value);
              if (e.target.value.trim()) stopGuidePlayback();
            }}
            onFocus={stopGuidePlayback}
            onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
            placeholder={t.item.chatPlaceholder}
            className="flex-1 rounded-full px-5 py-3 text-sm outline-none"
            style={{
              background: "var(--secondary)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="button"
            onClick={handleSendChat}
            disabled={!chatInput.trim() || isChatting}
            className="artifact-btn-primary shrink-0 px-5 py-3 text-sm disabled:opacity-50"
          >
            {t.item.send}
          </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
        <button 
          onClick={() => router.push(groupPath(groupSlug, "/companion"))}
          className="relative block h-16 w-16 rounded-full border-2 border-amber-400/50 overflow-hidden shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-transform hover:scale-105 active:scale-95 bg-[#1a2333] pointer-events-auto animate-pulse"
        >
          <img src="/images/companion/companion-idle.png" alt="Lê Quý Đôn" className="h-[130%] w-[130%] max-w-none object-cover object-top -ml-[15%]" />
        </button>
      </div>
    </main>
  );
}
