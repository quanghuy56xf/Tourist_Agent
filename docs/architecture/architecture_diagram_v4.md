# HERA V4 - Architecture & Production Data Flow

Tài liệu này mô tả chi tiết kiến trúc hệ thống V4, đặc biệt tập trung vào việc bổ sung các luồng đo lường Product Analytics và tối ưu hóa Production RAG với Reranker.

## 1. Sơ đồ Kiến trúc Triển khai & Analytics (Deployment & Analytics Architecture)

V4 bổ sung thêm lớp thu thập dữ liệu Analytics và hệ thống RAGAS Evaluation nội bộ chạy qua GitHub Actions.

```mermaid
graph TB
    subgraph CI_CD["GitHub Actions (CI/CD)"]
    F_CI["Frontend CI (Lint/Build)"]
    B_CI["Backend CI (Pytest with uv)"]
    B_Eval["RAGAS Golden Eval (Cron/Trigger)"]
    B_CD["Backend CD (SSH Deploy)"]
    end

    subgraph Platform_Edge["Railway (Edge Network)"]
    UI["Next.js PWA\n(Visitor UI 6-Langs & Admin UI)"]
    end

    subgraph Platform_VM["GCP VM (Docker Compose)"]
    Caddy["Caddy (Reverse Proxy & Auto SSL)"]
    API["FastAPI Backend Core"]
    
    subgraph Modules
        M_Analytics["Analytics (RAG Trace, Eval, Logs)"]
        M_RAG["Production RAG (Reranker)"]
    end
    
    DB[(SQLite & Vector DBs)]
    end

    F_CI -->|Auto Deploy| UI
    B_CI --> B_CD
    B_Eval -->|Report Generation| API
    B_CD -->|Trigger Deploy Script| Platform_VM

    Visitor((👤 Visitor)) -->|HTTPS| UI
    UI <-->|REST / SSE / WebM| Caddy
    Caddy <--> API
    API <--> Modules
    Modules <--> DB
```

---

## 2. Luồng Trải nghiệm AI Companion & RAG V4 (Streaming & RAG Flow)

Điểm khác biệt của V4 là sự xuất hiện của module Reranker và việc lưu trữ RAG Trace để Audit dữ liệu. Âm thanh đầu vào được thu bằng MediaRecorder gửi lên backend dưới dạng file (WebM).

```mermaid
sequenceDiagram
    actor Visitor
    participant UI as Companion UI (Frontend)
    participant STT as MediaRecorder STT
    participant API as Chat Router
    participant RAG as Production RAG (Reranker)
    participant Analytics as RAG Trace
    participant LLM as Gemini (Chat)
    participant TTS as TTS Workers (Edge)

    %% 1. Khách hàng nhập liệu (Giọng nói hoặc Text)
    Visitor->>UI: Nói vào Microphone (iOS/Android)
    opt Is Voice Input
        UI->>STT: Ghi âm MediaRecorder -> POST /api/stt (WebM)
        STT-->>UI: Trả về văn bản tiếng Việt (Transcript)
    end
    UI->>API: POST /api/companion/chat/stream (Max 10 history)

    %% 2. Truy xuất RAG Nâng cao
    API->>RAG: Tìm kiếm ngữ cảnh (search_K)
    RAG->>RAG: Truy xuất BM25 + Chroma
    RAG->>RAG: Heuristic Reranking (Lọc & Sắp xếp lại Chunks)
    RAG-->>API: Ngữ cảnh Tối ưu & Điểm tin cậy (Confidence Score)
    
    %% 3. Lưu Trace
    API->>Analytics: Lưu Log (RAG Trace: score, latency, chunks)

    %% 4. Streaming Response & Backend-driven UI
    API->>LLM: Gửi System Prompt (Persona, Reranked Context)
    LLM-->>API: Stream Text Chunks
    
    par Xử lý UI và Audio đồng thời
        %% UI Streaming
        API-->>UI: SSE Data (Text đa ngôn ngữ)
        
        %% Audio Chunking & Generation
        API->>API: Gom text thành Phrase
        API->>TTS: Worker 1 & 2: Sinh Audio MP3
        TTS-->>API: Audio Base64 Chunks
        API-->>UI: SSE Event: 'audio' (Base64)
    end

    %% 5. Frontend Phát Audio
    UI->>Visitor: Phát âm thanh nối tiếp
    UI->>Visitor: Hiển thị các Action Buttons
```

## 3. Hệ thống RAGAS Evaluation Pipeline

```mermaid
sequenceDiagram
    participant Admin as Dev / GitHub CI
    participant Script as Eval Script (scripts/run_ragas_golden_eval.py)
    participant API as Backend RAG Module
    participant RAGAS as RAGAS Framework

    Admin->>Script: Run Golden Dataset
    Script->>API: Fetch RAG context cho từng câu hỏi
    API-->>Script: Trả về Context & Generated Answer
    Script->>RAGAS: Gửi Context + Answer
    RAGAS-->>Script: Đánh giá Faithfulness & Answer Relevancy
    Script->>Admin: Xuất Report (JSON/MD) kèm Gate Score (VD: 4/4)
```
