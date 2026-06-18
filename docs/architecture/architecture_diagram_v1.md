# HERA - Architecture & Data Flow Diagram

Dưới đây là sơ đồ kiến trúc tổng thể và luồng dữ liệu của hệ thống **HERA - AI Heritage Guide**, thể hiện cách các thành phần tương tác với nhau, từ người dùng, Frontend, Backend, cho tới các dịch vụ AI và hệ thống lưu trữ.

## Sơ đồ Kiến trúc (Architecture Diagram)

```mermaid
graph TD
    %% Khai báo người dùng
    UserVisitor((Khách\ntham quan))
    UserAdmin((Quản trị\nviên))

    %% Khai báo Frontend
    subgraph Frontend ["Frontend (Next.js 14)"]
        VisitorUI["Visitor UI\n(Camera, Story, Chat)"]
        AdminUI["Admin UI\n(Quản lý Hiện vật,\nTài liệu RAG)"]
    end

    %% Khai báo Backend
    subgraph Backend ["Backend (FastAPI)"]
        API["Core API Routers"]
        
        subgraph Services ["AI & Core Services"]
            VisionService["Vision Service\n(DINOv2 Embedding)"]
            RAGService["Hybrid RAG Service\n(Dense + Sparse)"]
            GenAIService["Content Generation\n(Gemini API)"]
            TTSService["TTS Service\n(Edge TTS)"]
        end
    end

    %% Các API bên ngoài
    ExternalGemini[["Google Gemini\n(LLM API)"]]
    ExternalTTS[["Microsoft Edge\n(TTS API)"]]

    %% Hệ thống lưu trữ
    subgraph Storage ["Local Storage & Databases"]
        SQLite[(SQLite DB\nMetadata, Tên, Cấu hình)]
        ChromaDB[(Chroma DB\nVector Ảnh & Văn bản)]
        BM25[(BM25 Index\nTừ khóa / Sparse)]
        FileSystem[/"Local File System\n(Ảnh Upload)"/]
    end

    %% ==========================================
    %% KẾT NỐI VÀ LUỒNG DỮ LIỆU
    %% ==========================================

    %% Tương tác người dùng
    UserVisitor -->|Quét ảnh, Chat,\nNghe thuyết minh| VisitorUI
    UserAdmin -->|Upload ảnh 3 góc,\nUpload tài liệu RAG| AdminUI

    %% Giao tiếp Frontend - Backend
    VisitorUI <-->|REST API / JSON| API
    AdminUI <-->|REST API / Multipart| API

    %% Luồng quản lý dữ liệu (Admin)
    API -.->|Lưu thông tin hiện vật| SQLite
    API -.->|Lưu ảnh gốc| FileSystem
    API --> VisionService
    API --> RAGService
    API --> GenAIService
    API --> TTSService

    VisionService -.->|1a. Embed ảnh hiện vật| ChromaDB
    RAGService -.->|1b. Chunk & Embed tài liệu| ChromaDB
    RAGService -.->|1c. Đánh chỉ mục từ khóa| BM25

    %% Luồng tra cứu & tạo nội dung (Visitor)
    VisionService ==>|2a. Tìm ảnh tương đồng\n(Cosine Similarity)| ChromaDB
    RAGService ==>|2b. Tìm ngữ cảnh tài liệu| ChromaDB
    RAGService ==>|2c. Khớp từ khóa| BM25

    GenAIService ==>|3. Gửi Prompt + RAG Context| ExternalGemini
    TTSService ==>|4. Stream Audio| ExternalTTS
```

---

## Chi tiết các luồng dữ liệu chính (Data Flows)

### 1. Luồng nhập liệu của Quản trị viên (Admin Data Ingestion)
1. **Đăng ký hiện vật:** Admin upload ảnh hiện vật từ nhiều góc. 
   - Ảnh được lưu vào **File System**.
   - Thông tin (tên, mô tả ngắn) lưu vào **SQLite**.
   - Hình ảnh được đưa qua mô hình **DINOv2 (Vision Service)** để tạo vector 384 chiều và lưu vào **ChromaDB**.
2. **Nạp tri thức (Knowledge Base):** Admin tải lên các tài liệu lịch sử, sách hướng dẫn.
   - Tài liệu được chia nhỏ (chunking).
   - Đưa vào ChromaDB để tạo **Dense Vector** (tìm kiếm theo ngữ nghĩa).
   - Đưa vào **BM25** để tạo **Sparse Index** (tìm kiếm theo từ khóa chính xác, giúp vượt qua rào cản từ khóa hiếm).

### 2. Luồng trải nghiệm của Khách tham quan (Visitor Flow)
1. **Quét hiện vật:** Khách dùng điện thoại chụp/quét hiện vật.
   - Ảnh gửi về **Vision Service**. DINOv2 trích xuất vector từ ảnh query.
   - Đối chiếu vector ảnh với **ChromaDB** để định danh (Tìm ra `item_id` với độ trễ siêu thấp).
2. **Sinh câu chuyện (Story Generation):** 
   - Sau khi có `item_id`, **RAG Service** tìm kiếm các tài liệu liên quan trong ChromaDB và BM25.
   - Gửi yêu cầu gồm: Persona (nhóm người dùng), Ngôn ngữ, Metadata của hiện vật và Ngữ cảnh RAG tới **Gemini API (GenAI Service)**.
   - Gemini sinh ra bài thuyết minh hấp dẫn, cá nhân hóa.
3. **Phát âm thanh (Audio Streaming):** 
   - Văn bản được gửi tới **Edge TTS**.
   - Âm thanh được stream trực tiếp về máy của Khách tham quan qua Frontend.

### 3. Luồng Chatbot (Contextual Chat)
- Khách đặt câu hỏi đào sâu về hiện vật đang xem.
- **Hybrid RAG** tìm kiếm ngữ cảnh phù hợp nhất với câu hỏi.
- Gemini trả lời tựa vào ngữ cảnh (tránh Hallucination), Backend trả kết quả về UI.
