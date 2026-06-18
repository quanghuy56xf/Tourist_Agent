# HERA - Architecture & Data Flow Diagrams

Tài liệu này mô tả chi tiết kiến trúc hệ thống, các thành phần (Components) và luồng dữ liệu (Data Flow) của **HERA - AI Heritage Guide**.

## 1. Sơ đồ Kiến trúc Tổng thể (System Architecture)

Sơ đồ dưới đây thể hiện các thành phần chính của hệ thống, bao gồm Frontend, Backend, các dịch vụ AI nội bộ (Local Services), hệ thống lưu trữ và các API bên ngoài.

```mermaid
graph TB
    subgraph Clients["Clients (Next.js 14)"]
        VUI["📱 Visitor UI\n(PWA / Mobile Web)"]
        AUI["💻 Admin UI\n(Web Dashboard)"]
    end

    subgraph Backend["Backend Core (FastAPI)"]
        API["Core API Gateway / Routers"]
        
        subgraph Services["AI & Core Services"]
            VS["👁️ Vision Service\n(DINOv2)"]
            RS["🧠 Hybrid RAG Service\n(Chroma + BM25)"]
            GS["💬 GenAI Service\n(Gemini Integration)"]
            TS["🔊 TTS Service\n(Edge TTS)"]
        end
        
        API <--> VS
        API <--> RS
        API <--> GS
        API <--> TS
    end

    subgraph Storage["Data & Storage"]
        SQL[(SQLite\nMetadata & Config)]
        VDB[(Chroma DB\nVector Storage)]
        BM[(BM25\nSparse Index)]
        FS[/"File System\n(Images/Docs)"/]
    end

    subgraph External["External APIs"]
        GEM["✨ Google Gemini API\n(LLM Content Gen)"]
        EDGE["🎙️ MS Edge TTS\n(Audio Streaming)"]
    end

    %% Client to Backend
    VUI <-->|REST API| API
    AUI <-->|REST / Multipart| API

    %% Services to Storage
    VS -->|Read/Write Image Vectors| VDB
    RS -->|Read/Write Doc Vectors| VDB
    RS -->|Read/Write Keywords| BM
    API -->|Read/Write Data| SQL
    API -->|Save/Load Media| FS

    %% Services to External
    GS <-->|Prompt & Context / Text Response| GEM
    TS <-->|Text Input / Audio Stream| EDGE

    %% Styling
    classDef client fill:#e0f7fa,stroke:#006064,stroke-width:2px;
    classDef backend fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef service fill:#f3e5f5,stroke:#4a148c,stroke-width:1px;
    classDef storage fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px;
    classDef external fill:#ffebee,stroke:#b71c1c,stroke-width:2px;

    class VUI,AUI client;
    class Backend backend;
    class VS,RS,GS,TS service;
    class SQL,VDB,BM,FS storage;
    class GEM,EDGE external;
```

---

## 2. Luồng Quản trị (Admin Ingestion Data Flow)

Sơ đồ trình tự (Sequence Diagram) mô tả cách quản trị viên đưa dữ liệu hiện vật và tri thức vào hệ thống, quá trình tạo vector (embedding) để phục vụ cho nhận diện và RAG.

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin UI
    participant API as API Router
    participant DB as SQLite / File System
    participant Vision as Vision Service (DINOv2)
    participant RAG as RAG Service
    participant VectorDB as ChromaDB / BM25

    %% Luồng thêm hiện vật
    rect rgb(240, 248, 255)
        note right of Admin: Luồng 1: Đăng ký Hiện vật & Hình ảnh
        Admin->>UI: Thêm Hiện vật (Nhập thông tin + Ảnh 3 góc)
        UI->>API: POST /api/items (Data + Images)
        API->>DB: Lưu Metadata (SQLite) & Ảnh gốc (FS)
        API->>Vision: Gửi ảnh để trích xuất đặc trưng
        Vision->>Vision: Chạy DINOv2 Embedding
        Vision->>VectorDB: Lưu Image Vectors vào ChromaDB
        VectorDB-->>Vision: Xác nhận
        Vision-->>API: Hoàn tất
        API-->>UI: Trả về Item ID & Thành công
    end
    
    %% Luồng nạp tri thức
    rect rgb(255, 250, 240)
        note right of Admin: Luồng 2: Nạp tri thức & Tài liệu RAG
        Admin->>UI: Tải lên Tài liệu lịch sử (PDF/TXT)
        UI->>API: POST /api/knowledge
        API->>RAG: Phân tích & Xử lý tài liệu
        RAG->>RAG: Phân mảnh (Chunking) văn bản
        RAG->>VectorDB: Nhúng (Embed) & Lưu Dense Vector (ChromaDB)
        RAG->>VectorDB: Tạo & Cập nhật Sparse Index (BM25)
        VectorDB-->>RAG: Xác nhận
        RAG-->>API: Hoàn tất
        API-->>UI: Thành công
    end
```

---

## 3. Luồng Trải nghiệm Khách tham quan (Visitor Experience Data Flow)

Sơ đồ trình tự mô tả cách một khách tham quan quét hiện vật bằng điện thoại, hệ thống nhận diện và sinh ra câu chuyện thuyết minh được cá nhân hóa qua giọng nói.

```mermaid
sequenceDiagram
    actor Visitor
    participant UI as Visitor UI
    participant API as API Router
    participant Vision as Vision Service
    participant RAG as RAG Service
    participant LLM as GenAI Service (Gemini)
    participant TTS as TTS Service (Edge TTS)

    Visitor->>UI: Chụp/Quét hình ảnh hiện vật
    UI->>API: POST /api/recognize (Gửi Image)
    
    %% Nhận diện
    API->>Vision: Yêu cầu nhận diện
    Vision->>Vision: Trích xuất Vector ảnh bằng DINOv2
    Vision->>Vision: So khớp Cosine Similarity (ChromaDB)
    Vision-->>API: Trả về item_id & Độ tin cậy (Confidence)
    
    %% Truy xuất ngữ cảnh
    API->>RAG: Lấy dữ liệu Hiện vật & Ngữ cảnh
    RAG->>RAG: Truy xuất Metadata (SQLite)
    RAG->>RAG: Hybrid Search tài liệu liên quan (ChromaDB + BM25)
    RAG-->>API: Trả về RAG Context text
    
    %% Sinh nội dung
    API->>LLM: Gửi Prompt (Context + Persona + Language)
    LLM-->>API: Trả về nội dung Thuyết minh (Text)
    
    %% Text to Speech
    par Phát âm thanh & Hiển thị chữ
        API->>TTS: Chuyển nội dung Text sang Speech
        TTS-->>API: Audio Stream (MP3)
        API-->>UI: Trả về Text & Audio Stream
        UI-->>Visitor: Hiển thị chữ trên màn hình
        UI-->>Visitor: Phát âm thanh thuyết minh
    end
```
