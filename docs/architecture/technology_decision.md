# 🏛️ Quyết Định Công Nghệ & Kiến Trúc – MVP AI Heritage Guide

> **Kết luận từ phân tích các tài liệu**: [PRD](file:///d:/ai_project/document/PRODUCT%20REQUIREMENTS%20DOCUMENT%20(PRD).md), [Tech Analysis](file:///d:/ai_project/document/image_processing_tech_analysis.md), [Data Collection Guide](file:///d:/ai_project/document/data_collection_guide.md) và đánh giá năng lực nhóm phát triển 2 thành viên.

---

## PHẦN I: CỐT LÕI XỬ LÝ ẢNH (IMAGE PROCESSING ENGINE)

### Phương Án Được Chốt: Google Gemini 2.5 Flash

> [!IMPORTANT]
> **Kết luận:** Dùng Gemini 2.5 Flash làm engine xử lý ảnh DUY NHẤT cho MVP. Không cần train custom model. Không cần công nghệ bổ sung nào khác trong giai đoạn này.

### 1. Tại Sao Chọn Gemini 2.5 Flash?

#### 1.1 Khớp hoàn hảo với ràng buộc dự án

| Ràng buộc (từ PRD) | Gemini 2.5 Flash đáp ứng |
|---------------------|--------------------------|
| **6 tuần, 2-3 người** | Tích hợp trong 1-2 ngày, team tập trung vào UI/UX và knowledge base |
| **5 landmarks** tại Văn Miếu | Nhận diện bằng reasoning + prompt, không cần training dataset |
| **Confidence score ≥70%** | Trả về structured JSON với confidence qua prompt engineering |
| **Recognition < 5 giây** | Flash model response time ~1-3s, đạt yêu cầu |
| **Ảnh ≤ 5MB** | Hỗ trợ đầy đủ các format (JPEG/PNG/WebP), tối đa 4096×4096px |
| **Chi phí thấp** | ~$0.000077/ảnh, MVP ~1000 lượt ≈ < $1 |
| **Tiếng Việt + Tiếng Anh** | Hiểu context văn hóa Nho giáo, triều đại Lê-Trần bằng tiếng Việt rất tốt |

#### 1.2 Ưu thế "1 API xử lý 3 bài toán"

```
┌─────────────────────────────────────────────┐
│           GEMINI 2.5 FLASH                  │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Nhận diện│ │  Sinh    │ │ Chatbot    │  │
│  │ ảnh      │ │  câu     │ │ hỏi đáp    │  │
│  │ (FR-04)  │ │ chuyện   │ │ (FR-06)    │  │
│  │          │ │ (FR-05)  │ │            │  │
│  └──────────┘ └──────────┘ └────────────┘  │
│                                             │
│  1 API · 1 SDK · 1 billing account          │
└─────────────────────────────────────────────┘
```

Đây là lợi thế quyết định: thay vì phải tích hợp nhiều dịch vụ khác nhau (Vision API + LLM độc lập), team chỉ cần **1 API duy nhất** giúp giảm độ phức tạp của mã nguồn xuống mức tối thiểu.

---

## PHẦN II: HỆ THỐNG BACKEND, DATABASE & STORAGE

### Phương Án Được Chốt: Supabase BaaS (Mô Hình Hybrid)

> [!IMPORTANT]
> **Kết luận:** Thay thế FastAPI + Google Cloud Run bằng **Supabase (Backend-as-a-Service)**. Toàn bộ code Backend (API, AI Orchestration, RAG) viết bằng **Supabase Edge Functions** (TypeScript/Deno). Dữ liệu tri thức (Knowledge Base) của 5 landmarks lưu dưới dạng **file JSON tĩnh** trên Frontend. Cơ sở dữ liệu Postgres trên Supabase chỉ dùng để lưu **Event Logs (Analytics)**.

### 1. Phân Tích & So Sánh Phương Án (Đối Với Team 2 Người)

Khi quy mô nhân sự rút gọn xuống **2 thành viên có kinh nghiệm trung bình**, việc loại bỏ các tác vụ quản trị hạ tầng (Ops) và tối ưu hóa ngôn ngữ lập trình là yếu tố sống còn để kịp tiến độ 6 tuần.

| Tiêu chí | Option A: FastAPI + Cloud Run (Đề xuất cũ) | Option B: Supabase BaaS (Được Chọn) |
|----------|-------------------------------------------|-------------------------------------|
| **Thiết lập hạ tầng (Ops)** | **Phức tạp:** Cần Dockerize, cấu hình Google Cloud Run, Artifact Registry, GCS Bucket, thiết lập IAM và Secret Manager. | **Cực kỳ đơn giản:** Tạo project Supabase bằng 1 click. Database, Storage và Edge Functions có sẵn, deploy qua CLI. |
| **Sự đồng nhất ngôn ngữ** | **Phân mảnh:** Frontend dùng TypeScript (React), Backend dùng Python. Cần chuyển đổi ngữ cảnh liên tục. | **Đồng nhất:** Cả Frontend và Backend đều dùng TypeScript. Dễ dàng chia sẻ kiểu dữ liệu (Types/Interfaces) giữa các màn hình và API. |
| **Lưu trữ dữ liệu tạm (Storage)** | **Trung bình:** Dùng GCS Temp Bucket, cấu hình GCS lifecycle tự động xóa ảnh sau 60 giây. | **Đơn giản:** Dùng Supabase Storage, gọi trực tiếp từ Edge Function, tự động xóa ảnh sau khi Gemini xử lý. |
| **Lưu trữ Analytics (Event Logs)** | **Rắc rối:** Vì Cloud Run là stateless (không trạng thái), việc lưu log ra file JSON cục bộ sẽ bị mất khi container tắt. Muốn lưu bền vững phải tích hợp thêm GCS hoặc Database bên ngoài. | **Có sẵn:** Ghi thẳng logs vào bảng Postgres có sẵn trong Supabase bằng một câu lệnh JS duy nhất: `supabase.from('event_logs').insert()`. |
| **Cơ sở dữ liệu Knowledge Base** | **Đơn giản:** Dùng JSON files cục bộ. | **Đơn giản:** Giữ nguyên các file JSON tĩnh chứa tri thức đặt ngay trên Frontend để query tức thì không độ trễ. |

---

## 2. Cách Triển Khai Cụ Thể (Kiến Trúc Supabase Hybrid)

### 2.1 Luồng Xử Lý Dữ Liệu (Data Flow)

```
┌────────────────────────┐      Ảnh (Base64)      ┌───────────────────────────┐
│     FRONTEND           │───────────────────────>│  SUPABASE EDGE FUNCTION   │
│   (React Vite PWA)     │<───────────────────────│    (Deno / TypeScript)    │
│                        │      Landmark JSON     └─────────────┬─────────────┘
└───────────┬────────────┘                                      │
            │ Ghi Logs trực tiếp                                │ Gọi Gemini API
            ▼                                                   ▼
┌────────────────────────┐                        ┌───────────────────────────┐
│   SUPABASE DATABASE    │                        │     GEMINI 2.5 FLASH      │
│     (PostgreSQL)       │                        │   (Multimodal Vision/LLM) │
└────────────────────────┘                        └───────────────────────────┘
```

1. **Nhận diện & Sinh Story (Flow 1 & 2):**
   * Người dùng chụp ảnh → Frontend nén ảnh và gửi payload lên Supabase Edge Function `/recognize-and-story`.
   * Edge Function nhận ảnh, gọi Gemini 2.5 Flash API bằng thư viện JS `@google/genai`.
   * Gemini phân tích hình ảnh và trả về cấu trúc JSON gồm: `landmark_id`, `confidence`.
   * Edge Function chạy logic phân ngưỡng (Confidence Threshold Logic):
     * **$\ge 70\%$:** Đọc file tri thức JSON của landmark tương ứng, gọi tiếp Gemini để sinh Story theo Persona và Ngôn ngữ bằng cơ chế streaming.
     * **$50-69\%$:** Trả về kết quả phỏng đoán để Frontend hiển thị popup xác nhận.
     * **$<50\%$:** Trả về mã lỗi để Frontend tự động kích hoạt màn hình Chọn thủ công.
   * Edge Function tự động xóa dữ liệu ảnh tạm để bảo mật thông tin khách hàng.

2. **Hỏi đáp Contextual Chat (Flow 3):**
   * Người dùng nhắn tin hỏi chatbot → Frontend gửi câu hỏi + landmark_id + chat_history lên Edge Function `/chat`.
   * Edge Function tải context từ file JSON tri thức cục bộ của landmark đó.
   * Áp dụng prompt RAG (Context Grounding) để gọi Gemini 2.5 Flash sinh câu trả lời ngắn dưới 100 từ, đúng tone giọng của Persona đã chọn. Nếu ngoài phạm vi tri thức, trả về Fallback Message chuẩn.

3. **Ghi nhận sự kiện (Analytics):**
   * Frontend sử dụng Supabase Client SDK để tương tác trực tiếp với Database, ghi nhận 12 events ẩn danh vào bảng `event_logs` trong PostgreSQL. Không cần đi qua Edge Function trung gian.

---

## 3. Rủi Ro & Phương Án Backup (Supabase)

| Rủi ro | Mức độ | Biện pháp giảm thiểu |
|--------|:------:|----------------------|
| **Deno Edge Function timeout** | Thấp | Supabase Edge Functions cho phép chạy tối đa 150 giây, hoàn toàn đáp ứng tốt giới hạn timeout 15s của PRD. |
| **Lộ API Key Gemini** | Thấp | Không lưu API Key ở Frontend. API Key được lưu cấu hình an toàn trong Supabase Vault (Environment Variables) và chỉ gọi từ Edge Functions. |
| **Supabase Free Tier giới hạn** | Thấp | Gói miễn phí của Supabase cho phép 500K Edge Function invocations/tháng và 500MB database, dư sức đáp ứng mục tiêu test 20-30 người của MVP. |

---

## 4. Kế Hoạch Xác Minh (Validation Plan)

Trước khi tiến hành code chính thức, nhóm phát triển 2 người sẽ thực hiện các bước sau:
1. **Tuần 2 (Ngày 1-2):** Đi thực địa Văn Miếu chụp 15-20 ảnh test ở nhiều điều kiện sáng và góc độ khác nhau.
2. **Tuần 2 (Ngày 3):** Sử dụng Google AI Studio kiểm thử thủ công prompt nhận diện với các ảnh chụp trên. Xác nhận độ chính xác $\ge 85\%$ và tính nhất quán của cấu trúc JSON trả về.
3. **Tuần 2 (Ngày 4):** Viết thử nghiệm một Supabase Edge Function cục bộ kết nối Gemini API để đảm bảo luồng API chạy mượt mà trên môi trường Deno.

---

## 5. Tóm Tắt Quyết Định Công Nghệ

| Thành phần | Quyết định công nghệ chính thức (MVP) | Thay thế đã loại bỏ | Lý do chọn lựa |
|------------|--------------------------------------|---------------------|----------------|
| **Frontend Framework** | **React + Vite PWA (TypeScript)** | Next.js | Nhẹ nhàng hơn, build nhanh, DX tốt cho SPA di động. |
| **Backend & API Layer** | **Supabase Edge Functions (Deno)** | FastAPI (Python) | Loại bỏ 100% công sức setup DevOps/Docker. Đồng nhất ngôn ngữ TypeScript. |
| **Database** | **PostgreSQL (Supabase)** | JSON Logs cục bộ | Giải quyết vấn đề mất mát dữ liệu logs của serverless. Tích hợp trực tiếp qua SDK. |
| **Knowledge Base** | **JSON Files tĩnh trên Frontend** | Bảng Postgres chuyên sâu | Tiết kiệm thời gian thiết kế Schema, query tức thì và dễ cập nhật nội dung thô. |
| **Image Storage** | **Supabase Storage (Temp)** | Google Cloud Storage | Đồng bộ hệ sinh thái Supabase, dễ sử dụng qua JS SDK. |
| **AI Model Engine** | **Google Gemini 2.5 Flash** | AutoML / Custom Model | Đã chốt, không cần train dữ liệu, tiết kiệm tài nguyên. |
