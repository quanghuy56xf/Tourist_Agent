"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getItem, generateContent, GroupItem, resolveImageUrl, fetchTTSAudio, chatWithAI, ChatMessage } from "@/lib/api";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = Number(params.id);

  const [item, setItem] = useState<GroupItem | null>(null);
  const [content, setContent] = useState<string>("");
  const [loadingItem, setLoadingItem] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string>("");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persona
  const [persona, setPersona] = useState("Mặc định");
  const [language, setLanguage] = useState("Tiếng Việt");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPersona(localStorage.getItem("user_persona") || "Mặc định");
      setLanguage(localStorage.getItem("user_language") || "Tiếng Việt");
    }
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!itemId || !preferencesLoaded) return;
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
          const generated = await generateContent(itemId, persona, language);
          if (!cancelled) {
            setContent(generated.content);
          }
        } catch (storyError) {
          if (!cancelled) {
            setContent(
              storyError instanceof Error
                ? storyError.message
                : "Không thể sinh nội dung lúc này"
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Không thể tải nội dung"
          );
        }
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
  }, [itemId, persona, language, preferencesLoaded]);

  useEffect(() => {
    // Auto-scroll chat
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  const handlePlayAudio = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    try {
      setLoadingAudio(true);
      const url = await fetchTTSAudio(content, language);
      setAudioUrl(url);
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => setIsPlaying(false);
      } else {
        audioRef.current.src = url;
      }
      audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      alert("Không thể tải âm thanh");
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatting) return;
    
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    const updatedHistory = [...chatHistory, userMsg];
    
    setChatHistory(updatedHistory);
    setChatInput("");
    setIsChatting(true);

    try {
      const res = await chatWithAI(itemId, userMsg.content, chatHistory, persona, language);
      setChatHistory([...updatedHistory, { role: "assistant", content: res.content }]);
    } catch (err) {
      setChatHistory([...updatedHistory, { role: "assistant", content: "Lỗi kết nối. Vui lòng thử lại sau." }]);
    } finally {
      setIsChatting(false);
    }
  };

  if (loadingItem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen p-6 bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || "Không tìm thấy vật thể"}</p>
        <button onClick={() => router.push('/scan')} className="px-4 py-2 bg-slate-200 rounded-lg">Quay lại</button>
      </div>
    );
  }

  const imgSrc = resolveImageUrl(item.main_image_url);

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      {/* Top Card */}
      <div className="bg-white rounded-b-3xl shadow-sm border-b overflow-hidden mb-6">
        <div className="relative w-full h-64 bg-slate-200">
          <button 
            onClick={() => router.push('/scan')}
            className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white backdrop-blur-md"
          >
            &larr;
          </button>
          <button className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center text-white backdrop-blur-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
          </button>
          {imgSrc ? (
            <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
          )}
        </div>
        
        <div className="p-6">
          <h1 className="text-2xl font-bold text-slate-800 uppercase mb-1">{item.name}</h1>
          <p className="text-green-600 font-medium text-sm mb-4">Độ chính xác: 96%</p>
          
          {loadingContent ? (
            <div className="flex flex-col items-center py-4">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm mt-2">AI đang soạn nội dung...</p>
            </div>
          ) : (
            <div>
              <div className="prose prose-slate text-slate-700 text-sm leading-relaxed mb-4">
                {content.split('\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <button 
                onClick={handlePlayAudio}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-medium rounded-full active:scale-95 transition-transform"
              >
                {loadingAudio ? (
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <span>⏸ Tạm dừng</span>
                ) : (
                  <span>▶ Nghe đoạn văn</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Section */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">🤖</div>
          <h2 className="font-bold text-slate-700">Hỏi đáp thêm với Trợ lý AI về hiện vật này</h2>
        </div>

        <div className="space-y-4 mb-24 px-2">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-white border text-slate-700 rounded-tl-none shadow-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isChatting && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-2xl rounded-tl-none px-4 py-3 text-slate-400 text-sm shadow-sm">
                Đang trả lời...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Chat Input Pinned Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-20 flex gap-2">
        <input 
          type="text" 
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
          placeholder="Nhập câu hỏi của bạn tại đây..." 
          className="flex-1 bg-slate-100 rounded-full px-5 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none border border-transparent focus:border-red-200"
        />
        <button 
          onClick={handleSendChat}
          disabled={!chatInput.trim() || isChatting}
          className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-full px-6 font-medium transition-colors"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}
