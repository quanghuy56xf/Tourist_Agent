"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import ChatAssistantBubble from "@/components/visitor/ChatAssistantBubble";
import HeraGuidePanel, { HeraGuidePanelHandle } from "@/components/visitor/HeraGuidePanel";
import ItemHeroSlideshow from "@/components/visitor/ItemHeroSlideshow";
import { stopBrowserSpeech } from "@/lib/browserSpeech";
import {
  getItem,
  getItemContent,
  GroupItem,
  resolveImageUrl,
  chatWithAI,
  ChatMessage,
} from "@/lib/api";
import { getItemImageUrls } from "@/lib/itemImages";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, locale, t, ready: localeReady } = useVisitorLocale();
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
  const [loadingItem, setLoadingItem] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState("");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const heraPanelRef = useRef<HeraGuidePanelHandle>(null);
  const [persona, setPersona] = useState("Mặc định");
  const [introActive, setIntroActive] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const stopGuidePlayback = () => {
    heraPanelRef.current?.stopPlayback();
    stopBrowserSpeech();
    stopChatTts();
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPersona(localStorage.getItem("user_persona") || "Mặc định");
      setAutoSpeak(localStorage.getItem("chat_auto_speak") === "true");
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    return () => {
      stopChatTts();
    };
  }, []);

  useEffect(() => {
    if (!itemId || !preferencesLoaded || !localeReady) return;
    let cancelled = false;

    async function loadItemAndStory() {
      try {
        setError("");
        setLoadingItem(true);
        setLoadingContent(true);
        const data = await getItem(itemId);
        if (cancelled) return;
        setItem(data);
        setLoadingItem(false);
        try {
          const itemContent = await getItemContent(itemId, persona, language);
          if (!cancelled) {
            setContent(itemContent.content);
            setAudioUrl(
              itemContent.has_audio && itemContent.audio_url
                ? resolveImageUrl(itemContent.audio_url)
                : null
            );
          }
        } catch {
          if (!cancelled) setContent(t.item.contentError);
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
  }, [itemId, persona, language, localeReady, preferencesLoaded, t.item.contentError, t.item.loadError]);

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
      const res = await chatWithAI(itemId, userMsg.content, chatHistory, persona, language);
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
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="mb-4" style={{ color: "var(--primary)" }}>
          {error || t.item.notFound}
        </p>
        <BackButton onClick={() => router.push("/scan")} label={t.common.back} />
      </div>
    );
  }

  const imgSrc = resolveImageUrl(item.main_image_url);
  const slideshowImages = getItemImageUrls(item);

  return (
    <div className="artifact-shell mx-auto flex min-h-screen max-w-phone flex-col overflow-hidden pb-24">
      <div className="relative h-44 shrink-0 overflow-hidden">
        <ItemHeroSlideshow
          images={slideshowImages.length > 0 ? slideshowImages : imgSrc ? [imgSrc] : []}
          active={!introActive}
          alt={item.name}
          fallbackLabel={t.common.noImage}
        />
        <div className="absolute inset-0 item-hero-scrim" />
        <BackButton
          onClick={() =>
            router.push(inTour ? `/tour/${tourId}/play` : "/scan")
          }
          label={t.common.back}
          variant="dark"
          className="absolute left-4 top-4 z-10"
        />
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
          <h1 className="font-display text-xl" lang={locale}>
            {item.name}
          </h1>
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-4">
        <div className="hera-guide-sticky-wrap">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
            <span className="artifact-section-label px-2">{t.item.guideSection}</span>
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>

          <HeraGuidePanel
            ref={heraPanelRef}
            content={content}
            audioUrl={audioUrl}
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
        className="fixed bottom-0 left-0 right-0 z-20 p-4"
        style={{ background: "rgba(14,11,7,0.95)", borderTop: "1px solid var(--border)" }}
      >
        <div className="mx-auto max-w-phone space-y-2">
          {inTour && (
            <button
              type="button"
              onClick={() => router.push(`/tour/${tourId}/play`)}
              className="artifact-btn-primary w-full py-3 text-sm"
            >
              {t.item.continueTour} →
            </button>
          )}
          <div className="flex gap-2">
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
    </div>
  );
}
