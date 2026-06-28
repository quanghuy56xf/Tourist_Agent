# HERA V3 - Architecture & Streaming Data Flow

Tài liệu này mô tả chi tiết kiến trúc hệ thống V3, đặc biệt tập trung vào việc tách bạch hạ tầng triển khai (CI/CD) và luồng xử lý luồng thời gian thực (Real-time Streaming Data Flow) cực kỳ phức tạp của AI Companion.

## 1. Sơ đồ Kiến trúc Triển khai (Deployment Architecture)

V3 tách biệt hoàn toàn Frontend (Edge/Serverless) và Backend (Cloud VM) được điều khiển tự động qua GitHub Actions.

```mermaid
graph TB
    subgraph CI_CD["GitHub Actions (CI/CD)"]
        F_CI["Frontend CI (Lint/Build)"]
        B_CI["Backend CI (Pytest with uv)"]
        B_CD["Backend CD (SSH Deploy)"]
    end

    subgraph Platform_Edge["Railway (Edge Network)"]
        UI["Next.js PWA\n(Visitor & Admin UI)"]
    end

    subgraph Platform_VM["GCP VM (Docker Compose)"]
        Caddy["Caddy (Reverse Proxy & Auto SSL)"]
        API["FastAPI Backend Core"]
        DB[(SQLite & Vector DBs)]
    end

    F_CI -->|Auto Deploy| UI
    B_CI --> B_CD
    B_CD -->|Trigger Deploy Script| Platform_VM

    Visitor((👤 Visitor)) -->|HTTPS| UI
    UI <-->|REST / SSE / Multipart| Caddy
    Caddy <--> API
    API <--> DB
```

---

## 2. Luồng Trải nghiệm AI Companion (Streaming Data Flow)

Điểm cốt lõi của V3 là khả năng đàm thoại thời gian thực, sinh UI động từ backend (Backend-driven UI) và tối ưu độ trễ âm thanh bằng cách xé nhỏ văn bản (Chunking).

```mermaid
sequenceDiagram
    actor Visitor
    participant UI as Companion UI (Frontend)
    participant STT as STT Service (Gemini)
    participant API as Chat Router
    participant RAG as Hybrid RAG
    participant LLM as Gemini (Chat)
    participant TTS as TTS Workers (Edge)

    %% 1. Khách hàng nhập liệu (Giọng nói hoặc Text)
    Visitor->>UI: Nói vào Microphone / Nhập Text
    opt Is Voice Input
        UI->>STT: POST /api/companion/stt (WebM Audio)
        STT-->>UI: Trả về văn bản (Transcript)
    end
    UI->>API: POST /api/companion/chat/stream

    %% 2. Truy xuất RAG và Nhồi Prompt
    API->>RAG: Truy xuất thông tin Hiện vật / Group
    RAG-->>API: Context & Unvisited Items (Next Stop)
    API->>LLM: Gửi System Prompt (Persona, Context, Next Stop Rule, Q-Rule)

    %% 3. Streaming Response & Backend-driven UI
    LLM-->>API: Stream Text Chunks
    
    par Xử lý UI và Audio đồng thời
        %% UI Streaming
        API-->>UI: SSE Data (Text)
        UI->>UI: Render Text / Loại bỏ regex ||Q:...||
        UI->>UI: Cập nhật Action Buttons (Gợi ý câu hỏi/Khám phá tiếp)
        
        %% Audio Chunking & Generation
        API->>API: Gom text thành Phrase (dấu câu/xuống dòng)
        API->>TTS: Worker 1: Tạo MP3 cho Phrase 1
        API->>TTS: Worker 2: Tạo MP3 cho Phrase 2
        TTS-->>API: Audio Base64 Chunks
        API-->>UI: SSE Event: 'audio' (Base64)
    end

    %% 4. Frontend Phát Audio
    UI->>Visitor: Phát âm thanh nối tiếp (Audio Buffer Queue)
    UI->>Visitor: Hiển thị các nút Gợi ý câu hỏi (||Q:||)
```

## 3. Quản lý trạng thái Minimap Động

```mermaid
sequenceDiagram
    participant UI as Frontend (Minimap Modal)
    participant LS as Local Storage (visited_items)
    participant API as Backend (Group DB)
    
    UI->>API: GET /api/groups/{id}
    API-->>UI: Trả về minimap_config (JSON map data)
    UI->>LS: Lấy danh sách visited_item_ids
    
    UI->>UI: Parse JSON, gán tọa độ (x, y)
    UI->>UI: Highlight điểm đang đứng (active)
    UI->>UI: Làm mờ điểm đã đi (visited)
    UI->>UI: Render SVG Minimap linh hoạt
```
