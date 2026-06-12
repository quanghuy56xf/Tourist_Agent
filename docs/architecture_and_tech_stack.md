# 🏗️ ARCHITECTURE & TECH STACK – AI Heritage Guide MVP (Supabase Edition)

> **Phiên bản:** 1.0 (Supabase BaaS Edition)  
> **Ràng buộc:** 6 tuần · 3 người (2 devs + 1 data specialist) · 5 landmarks · Văn Miếu – Quốc Tử Giám  
> **Tài liệu tham chiếu:** PRD v1.0, Technology Decision, Data Collection Guide

---

## 1. Tổng Quan Kiến Trúc (Architecture Overview)

```
                    ┌──────────────────────────────┐
                    │     👤 KHÁCH THAM QUAN        │
                    │     (Mobile Browser)          │
                    └──────────────┬───────────────┘
                                   │ Quét QR → Mở Web App
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite PWA)               │
│                    Deployed on: Vercel                        │
│                                                              │
│  ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────┐  │
│  │  Persona   │ │  Camera   │ │  Story   │ │  Chatbot    │  │
│  │  Selection │ │  Capture  │ │  Viewer  │ │  Interface  │  │
│  │  Screen    │ │  Screen   │ │  Screen  │ │  Screen     │  │
│  │  └────────────┘ └───────────┘ └──────────┘ └─────────────┘  │
│  ┌────────────┐ ┌───────────────────────────────────────┐    │
│  │  Manual    │ │       Edge Case Screens               │    │
│  │  Selection │ │  (Error / Offline / Not Supported)    │    │
│  │  └────────────┘ └───────────────────────────────────────┘    │
│                                                              │
│  MediaDevices API (Camera) · PWA Service Worker (Cache)      │
│  Knowledge Base (Local JSON files: 5 landmarks)              │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS / REST API / Supabase SDK
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND (Supabase BaaS)                   │
│                    Deployed on: Supabase Cloud               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Supabase Edge Functions                  │  │
│  │                   (Deno Runtime)                       │  │
│  │                                                        │  │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌────────┐  │  │
│  │  │ /recognize       │ │ /story           │ │ /chat  │  │  │
│  │  │ - Gemini Vision  │ │ - Streaming Story│ │ - RAG  │  │  │
│  │  └────────┬─────────┘ └────────┬─────────┘ └───┬────┘  │  │
│  │           │                    │               │       │  │
│  │           ▼                    ▼               ▼       │  │
│  │    ┌──────────────────────────────────────────────┐    │  │
│  │    │           Prompt & Grounding Layer           │    │  │
│  │    └──────────────────────────────────────────────┘    │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼────────────────────────────┐  │
│  │                PostgreSQL (Database)                   │  │
│  │   - Table: event_logs (lưu trữ 12 events phân tích)     │  │
│  │   - Lưu trữ trực tiếp thông qua Supabase Client SDK     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                Supabase Storage (Temp)                 │  │
│  │   - Temp bucket lưu trữ ảnh chụp để Gemini phân tích    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
     ┌──────────────────┐            ┌──────────────────┐
     │  Google Gemini   │            │  Google Gemini   │
     │  2.5 Flash API   │            │  2.5 Flash API   │
     │  (Vision Model)  │            │    (LLM Model)   │
     └──────────────────┘            └──────────────────┘
```

---

## 2. Tech Stack Chi Tiết

### 2.1 Frontend

| Thành phần | Công nghệ | Phiên bản | Lý do chọn |
|------------|-----------|:---------:|------------|
| **Framework** | React | 18+ | Component-based, hệ sinh thái lớn, team quen thuộc |
| **Build Tool** | Vite | 6+ | Build nhanh, HMR tức thì, config đơn giản |
| **Ngôn ngữ** | TypeScript | 5+ | Type safety cho cả Frontend và API |
| **Styling** | Tailwind CSS | 4+ | Đẩy nhanh tốc độ code UI Responsive |
| **PWA** | vite-plugin-pwa | latest | Hỗ trợ Offline cache, installable trên mobile |
| **Camera** | MediaDevices API | Native | Trình duyệt hỗ trợ mặc định, không cần thư viện ngoài |
| **BaaS Client** | `@supabase/supabase-js` | latest | Tương tác trực tiếp với Postgres Database và Storage |
| **State** | React Context / Zustand | — | Quản lý session state (persona, language, landmark) |
| **Routing** | React Router | v6+ | Điều hướng SPA giữa các màn hình |
| **Hosting** | Vercel | Free Tier | Tự động deploy từ Github, tích hợp SSL miễn phí |

### 2.2 Backend (Supabase BaaS)

| Thành phần | Công nghệ | Phiên bản | Lý do chọn |
|------------|-----------|:---------:|------------|
| **Serverless Engine** | Supabase Edge Functions | latest | Chạy trên Deno runtime, deploy nhanh bằng CLI, không tốn công cấu hình Docker/Cloud Run. |
| **Ngôn ngữ** | TypeScript | 5+ | Đồng nhất ngôn ngữ với Frontend, dễ bảo trì. |
| **AI SDK** | `@google/genai` | latest | Thư viện chính thức của Google cho Gemini API, chạy tốt trên Deno. |
| **Database** | PostgreSQL (Supabase) | 15+ | Lưu trữ event logs bền vững. |
| **Storage** | Supabase Storage | latest | Lưu trữ ảnh chụp tạm thời, hỗ trợ API xóa ảnh tức thì. |
| **Rate Limiting** | Custom Edge Middleware | — | Tích hợp trong Edge Functions dựa trên IP/Session ID. |
| **Hosting** | Supabase Cloud | Free Tier | Miễn phí, sẵn sàng sử dụng ngay sau khi tạo tài khoản. |

### 2.3 AI & ML

*   **Image Recognition:** Gemini 2.5 Flash Vision. Đầu vào là ảnh chụp di tích + prompt yêu cầu xuất JSON chứa `landmark_id` và `confidence`.
*   **Story Generation:** Gemini 2.5 Flash. Trực tiếp sinh văn bản kể chuyện dạng stream (Server-Sent Events) theo Persona và Ngôn ngữ.
*   **Chatbot Q&A:** Gemini 2.5 Flash. Đọc context từ JSON tri thức được truyền vào prompt để trả lời câu hỏi dưới 100 từ.
*   **Anti-hallucination:** Context Grounding + RAGPrompt. Bắt buộc AI chỉ trả lời trong tài liệu cho sẵn, trả về Fallback Message chuẩn nếu câu hỏi lạc đề.

---

## 3. Cấu Trúc Thư Mục Dự Án (Project Structure)

```
ai-heritage-guide/
│
├── frontend/                          # React + Vite PWA (TypeScript)
│   ├── public/
│   │   ├── manifest.json              # PWA manifest
│   │   ├── sw.js                      # Service Worker
│   │   ├── icons/                     # Icons ứng dụng di động
│   │   └── images/                    # Ảnh minh họa di tích
│   │
│   ├── src/
│   │   ├── main.tsx                   # Điểm khởi đầu ứng dụng
│   │   ├── App.tsx                    # Cấu hình Routing chính
│   │   │
│   │   ├── pages/                     # Màn hình giao diện
│   │   │   ├── WelcomePage.tsx        # Màn hình chờ + Privacy Banner
│   │   │   ├── PersonaPage.tsx        # Chọn Persona & Ngôn ngữ
│   │   │   ├── CameraPage.tsx         # Chụp ảnh di tích
│   │   │   ├── ResultPage.tsx         # Hiển thị Story tự động
│   │   │   ├── ChatPage.tsx           # Hỏi đáp với Chatbot
│   │   │   ├── ManualSelectPage.tsx   # Chọn thủ công di tích
│   │   │   └── ErrorPage.tsx          # Các màn hình lỗi (Mất mạng, Timeout...)
│   │   │
│   │   ├── components/                # Reusable UI Components
│   │   │   ├── CameraViewfinder.tsx   # Giao diện camera preview
│   │   │   ├── StoryCard.tsx          # Thẻ hiển thị Story dạng stream
│   │   │   ├── ChatBubble.tsx         # Bong bóng hội thoại chat
│   │   │   ├── ChatInput.tsx          # Khung nhập tin nhắn
│   │   │   ├── LandmarkGrid.tsx       # Lưới hiển thị các địa điểm chọn tay
│   │   │   ├── ConfidencePrompt.tsx   # Popup xác nhận khi confidence 50-69%
│   │   │   ├── FeedbackButtons.tsx    # Nút Like/Dislike đánh giá AI
│   │   │   └── PrivacyNotice.tsx      # Banner xin quyền cookie/tracking
│   │   │
│   │   ├── hooks/                     # Custom React Hooks
│   │   │   ├── useCamera.ts           # Quản lý camera phần cứng
│   │   │   ├── useRecognition.ts      # Gọi API nhận diện ảnh
│   │   │   └── useChat.ts             # Quản lý lịch sử chat và gửi câu hỏi
│   │   │
│   │   ├── knowledge_base/            # Dữ liệu tri thức cốt lõi (JSON)
│   │   │   ├── khue_van_cac.json      # Tri thức chi tiết Khuê Văn Các
│   │   │   ├── bia_tien_si.json       # Tri thức chi tiết Bia Tiến Sĩ
│   │   │   ├── dai_thanh_mon.json     # Tri thức chi tiết Đại Thành Môn
│   │   │   ├── nha_thai_hoc.json      # Tri thức chi tiết Nhà Thái Học
│   │   │   └── ho_van.json            # Tri thức chi tiết Hồ Văn
│   │   │
│   │   ├── services/                  # Kết nối API bên ngoài
│   │   │   └── supabaseClient.ts      # Khởi tạo Supabase Client
│   │   │
│   │   └── utils/                     # Utilities
│   │       ├── imageCompressor.ts     # Nén ảnh di động trước khi upload
│   │       └── analytics.ts           # Trigger log 12 events lên Postgres
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── supabase/                          # Supabase Configuration & Code
│   ├── config.toml                    # Cấu hình dự án Supabase
│   │
│   ├── functions/                         # Supabase Edge Functions (Deno)
│   │   ├── recognize-and-story/       # API 1: Nhận diện ảnh & Sinh câu chuyện
│   │   │   ├── index.ts               # Code xử lý chính
│   │   │   └── prompts.ts             # Prompts cho Vision & Storytelling
│   │   │
│   │   └── chat/                      # API 2: Hỏi đáp RAG Chatbot
│   │       ├── index.ts               # Code xử lý chính
│   │       └── prompts.ts             # System Prompt + Grounding instruction
│   │
│   └── migrations/                    # Cấu trúc bảng SQL
│       └── 20260609000000_init_analytics.sql # Tạo bảng event_logs
│
└── README.md
```

---

## 4. Chi Tiết Luồng Dữ Liệu (Data Flows)

### 4.1 Flow 1 & 2: Nhận Diện & Sinh Câu Chuyện

```
┌──────┐      Chụp ảnh      ┌──────────┐    Nén ảnh     ┌───────────┐
│ User │───────────────────>│ Frontend │───────────────>│  Vercel   │
└──────┘                    └──────────┘    (≤ 5MB)     └─────┬─────┘
                                                              │
                                                        Gọi API POST /recognize-and-story
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTION                       │
│                                                                 │
│    1. Upload ảnh tạm lên Supabase Storage                       │
│    2. Gọi Gemini 2.5 Flash Vision với Prompt:                   │
│       "Nhận diện 1 trong 5 di tích..."                           │
│    3. Nhận JSON: { landmark_id: string, confidence: number }    │
│    4. Xóa ảnh tạm trên Supabase Storage để bảo mật              │
│    5. Logic phân ngưỡng:                                        │
│       - Confidence >= 70%: Đọc local JSON tương ứng, gọi tiếp   │
│         Gemini để sinh Story (Streaming Response).              │
│       - Confidence 50-69%: Trả về JSON phỏng đoán.              │
│       - Confidence < 50%: Trả về lỗi nhận diện.                 │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                          Truyền dữ liệu Stream (SSE)
                                  │
                                  ▼
                            ┌───────────┐    Hiển thị kết quả    ┌──────┐
                            │ Frontend  │───────────────────────>│ User │
                            └───────────┘                        └──────┘
```

### 4.2 Flow 3: Chatbot Hỏi Đáp Ngữ Cảnh (RAG)

```
┌──────┐      Nhập câu hỏi      ┌──────────┐    Gọi API POST /chat     ┌──────────────────────┐
│ User │───────────────────────>│ Frontend │──────────────────────────>│ Supabase Edge        │
└──────┘                        └──────────┘  {landmark_id, question}  │ Function             │
                                                                       └──────────┬───────────┘
                                                                                  │
                                                                        1. Load context di tích
                                                                        2. Cấu trúc Prompt RAG
                                                                        3. Gửi Gemini 2.5 Flash
                                                                                  │
                                                                                  ▼
┌──────┐       Hiển thị Chat     ┌──────────┐      Trả về câu trả lời   ┌──────────────────────┐
│ User │<────────────────────────│ Frontend │<──────────────────────────│   Gemini 2.5 Flash   │
└──────┘                         └──────────┘         (< 100 từ)        └──────────────────────┘
```

---

## 5. API Endpoints (Supabase Edge Functions)

| HTTP Method | Endpoint | Mô tả | Đầu vào (Payload) | Đầu ra (Response) |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/functions/v1/recognize-and-story` | Nhận diện ảnh chụp và sinh câu chuyện streaming. | `multipart/form-data` chứa file ảnh, `persona`, `language` | Server-Sent Events (SSE) text stream / JSON lỗi |
| `POST` | `/functions/v1/chat` | Hỏi đáp chatbot dựa trên context di tích và lịch sử trò chuyện. | JSON: `{ landmark_id, message, chat_history, persona, language }` | JSON: `{ answer: string, is_fallback: boolean }` |

*Lưu ý: Tính năng ghi nhận sự kiện (Analytics) được Frontend thực hiện ghi trực tiếp vào bảng Postgres `event_logs` qua Client SDK, không cần đi qua Edge Function.*

---

## 6. Cấu Trúc Database Schema (PostgreSQL)

Nhóm phát triển chỉ cần khởi tạo một bảng cơ sở dữ liệu duy nhất trong Supabase để lưu logs:

```sql
-- Migration: 20260609000000_init_analytics.sql
CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,         -- Định danh phiên ẩn danh
    event_type TEXT NOT NULL,         -- Tên sự kiện (ví dụ: recognition_success)
    persona TEXT,                     -- Nhóm persona đã chọn
    language VARCHAR(5),              -- Ngôn ngữ (vi/en)
    landmark_id TEXT,                 -- Landmark liên quan (nếu có)
    meta_data JSONB,                  -- Metadata bổ sung (lỗi, độ tự tin, v.v.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index giúp truy vấn phân tích nhanh
CREATE INDEX idx_event_logs_type ON event_logs(event_type);
CREATE INDEX idx_event_logs_session ON event_logs(session_id);
```

---

## 7. Môi Trường Phát Triển Lập Trình (Local Dev)

### Yêu cầu tiên quyết (Prerequisites)
*   Node.js >= 20 LTS & npm >= 10
*   Supabase CLI (cài qua npm hoặc brew)
*   Docker Desktop (bắt buộc để chạy Supabase giả lập local)

### Quy trình chạy dưới Local
1.  **Chạy Supabase Local:**
    ```bash
    supabase start
    ```
    Lệnh này sẽ khởi tạo Postgres, Storage, và Edge Function emulator trên máy của bạn.

2.  **Chạy Edge Functions:**
    ```bash
    supabase functions serve --no-verify-jwt
    ```
    Các API backend local sẽ chạy tại: `http://localhost:54321/functions/v1/...`

3.  **Chạy Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev  # Chạy tại http://localhost:5173
    ```
