# 📅 Kế Hoạch SPRINT 6 Tuần – Team 3 Thành Viên (2 Devs + 1 Data Specialist)

> **Mục tiêu:** Phát triển hoàn thiện và chạy thử nghiệm (Pilot) hệ thống **AI Heritage Guide MVP** tại Văn Miếu – Quốc Tử Giám.
> **Quy mô nhân sự:** 3 thành viên:
> - **Developer A (Frontend Lead):** Kỹ năng lập trình mức trung bình.
> - **Developer B (AI & Backend Lead):** Kỹ năng lập trình mức trung bình.
> - **Member C (Data & Testing Specialist):** Chuyên trách thu thập ảnh, viết nội dung tri thức và kiểm thử người dùng.
> **Công nghệ:** React Vite PWA + Supabase (PostgreSQL, Storage, Edge Functions TS) + Gemini 2.5 Flash.

---

## 👥 Phân Vai Trò (Roles)
*   **Developer A (Frontend Lead):** Chịu trách nhiệm thiết kế giao diện (UI/UX), tích hợp camera phần cứng trên trình duyệt di động, giao diện chatbot, hiển thị streaming câu chuyện, và gọi API Supabase SDK để ghi log sự kiện.
*   **Developer B (AI & Backend Lead):** Chịu trách nhiệm thiết lập dự án Supabase, cấu hình Storage và database, viết các Supabase Edge Functions để điều phối AI (Gemini API), thiết kế prompts chống ảo giác, logic RAG, rate limiting, và bảo mật thông tin.
*   **Member C (Data & Testing Specialist):** Chịu trách nhiệm khảo sát Văn Miếu, chụp ảnh hiện vật, phân loại dữ liệu ảnh mẫu/ảnh test, biên tập nội dung tri thức thô của các di tích, tổ chức hoạt động User Testing thực tế tại di tích và quay video Demo.

---

## 🗓️ Chi Tiết 6 Sprints

### SPRINT 1: Nghiên Cứu, Thiết Kế & Thu Thập Dữ Liệu
**Mục tiêu:** Chốt tài liệu PRD, vẽ luồng người dùng (User Flow) chi tiết cho các Edge Cases, thu thập bộ dữ liệu ảnh thô và kiểm chứng tính khả thi của AI trước khi code.

| Epic | Task Chi Tiết | Người Thực Hiện | Độ Ưu Tiên | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **Nghiên cứu & Thiết kế** | Viết hoàn thiện PRD & Thiết kế luồng User Flow (Happy Path + 3 Edge Cases) | A | P0 | Todo |
| **Nghiên cứu & Thiết kế** | Vẽ Wireframe chi tiết (Welcome, Camera, Story, Chat, Manual Select) | A | P0 | Todo |
| **Thu thập dữ liệu** | Chụp ảnh thực tế 5 địa điểm Văn Miếu (~150-200 ảnh theo chỉ dẫn) | C | P0 | Todo |
| **Thu thập dữ liệu** | Phân loại ảnh (Reference, Test, UI Display, Negative) và cấu trúc thư mục | C | P0 | Todo |
| **Khảo sát & Validation** | Test prompt nhận diện ảnh thủ công trên Google AI Studio với 15 ảnh thực tế | B + C | P0 | Todo |

---

### SPRINT 2: Thiết Lập Nền Tảng (Foundation Setup)
**Mục tiêu:** Setup khung mã nguồn frontend, backend Supabase và cấu trúc dữ liệu tri thức tĩnh (JSON).

| Epic | Task Chi Tiết | Người Thực Hiện | Độ Ưu Tiên | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **Setup Frontend** | Khởi tạo dự án React + Vite PWA (TypeScript) & cấu hình Tailwind CSS | A | P0 | Todo |
| **Setup Backend** | Khởi tạo Supabase Project, thiết lập Database cho logs (`event_logs`) | B | P0 | Todo |
| **Setup Storage** | Cấu hình Supabase Storage Bucket để lưu ảnh tạm thời | B | P0 | Todo |
| **Knowledge Base** | Thiết kế cấu trúc file JSON và biên dịch dữ liệu tri thức của 5 landmarks | C | P0 | Todo |
| **Data Ops** | Upload tập ảnh reference & test lên hệ thống lưu trữ dự án | C | P1 | Todo |

---

### SPRINT 3: AI Recognition (Nhận Diện Đối Tượng)
**Mục tiêu:** Hiện thực hóa tính năng nhận diện vật thể qua camera, xử lý phân ngưỡng tự tin (Confidence Threshold).

| Epic | Task Chi Tiết | Người Thực Hiện | Độ Ưu Tiên | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **Frontend Camera** | Tích hợp Camera di động thông qua API trình duyệt (MediaDevices API) | A | P0 | Todo |
| **Frontend Camera** | Tính năng chụp ảnh, nén ảnh ($\le 5MB$) và gửi API payload lên backend | A | P0 | Todo |
| **Backend AI** | Viết Edge Function `/recognize` tích hợp Gemini 2.5 Flash Vision API | B | P0 | Todo |
| **Backend AI** | Hiện thực hóa logic xử lý phân ngưỡng tự tin ($\ge 70\%$, $50-69\%$, $<50\%$) | B | P0 | Todo |
| **UI/UX Edge Case** | Làm popup xác nhận (khi độ tự tin 50-69%) và màn hình Chọn thủ công | A | P0 | Todo |
| **Privacy Compliance**| Tích hợp cơ chế tự động xóa ảnh tạm khỏi Storage ngay sau khi nhận diện | B | P0 | Todo |
| **Testing** | Chạy Script kiểm thử nhận diện tự động trên tập ảnh Test (yêu cầu $\ge 85\%$) | B + C | P0 | Todo |

---

### SPRINT 4: AI Storytelling & Contextual Chat (Giới Thiệu & Hỏi Đáp)
**Mục tiêu:** Phát triển tính năng sinh câu chuyện cá nhân hóa theo Persona/Ngôn ngữ và chatbot RAG tương tác.

| Epic | Task Chi Tiết | Người Thực Hiện | Độ Ưu Tiên | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **Backend AI** | Thiết kế Prompt System chuyên sâu cho 3 Persona × 2 Ngôn ngữ | B | P0 | Todo |
| **Backend AI** | Viết Edge Function `/story` sinh truyện hỗ trợ Streaming Response | B | P0 | Todo |
| **Frontend Story** | Giao diện hiển thị câu chuyện với hiệu ứng Streaming text (SSE) | A | P0 | Todo |
| **Backend AI** | Viết Edge Function `/chat` hỏi đáp RAG dựa trên context của JSON file | B | P0 | Todo |
| **Backend AI** | Cài đặt logic chống ảo giác (Grounding) và Fallback Message chuẩn | B | P0 | Todo |
| **Frontend Chat** | Xây dựng màn hình Chatbot tương tác thời gian thực | A | P0 | Todo |
| **Knowledge Base** | Hoàn thiện biên soạn và kiểm duyệt nội dung chữ chi tiết của 5 di tích | C | P0 | Todo |

---

### SPRINT 5: Triển Khai & Kiểm Thử Tích Hợp (Deployment & Testing)
**Mục tiêu:** Deploy sản phẩm lên môi trường production, tích hợp logging theo dõi hành vi và chạy thử nghiệm thực tế với người dùng.

| Epic | Task Chi Tiết | Người Thực Hiện | Độ Ưu Tiên | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **DevOps** | Deploy Frontend tĩnh lên Vercel và cấu hình Domain HTTPS | A | P0 | Todo |
| **DevOps** | Deploy hoàn thiện Supabase Edge Functions lên Supabase Cloud | B | P0 | Todo |
| **Security & Limits** | Cấu hình Secrets (Gemini API Key), CORS, và Rate Limit bảo vệ tài nguyên | B | P0 | Todo |
| **Analytics** | Tích hợp Supabase Client SDK ở Frontend để log 12 events ẩn danh | A | P1 | Todo |
| **UI/UX Survey** | Xây dựng Feedback Form (Like/Dislike) và Khảo sát độ hài lòng cuối phiên | A | P1 | Todo |
| **User Testing** | Tổ chức chạy thử nghiệm thực tế với 20-30 khách tại Văn Miếu | C | P0 | Todo |
| **Bug Fix** | Tổng hợp feedback, fix bug giao diện và logic phản hồi AI | A + B | P0 | Todo |

---

### SPRINT 6: Nghiệm Thu & Demo
**Mục tiêu:** Chốt sản phẩm hoạt động ổn định, quay video minh họa và tổng hợp báo cáo kết thúc MVP.

| Epic | Task Chi Tiết | Người Thực Hiện | Độ Ưu Tiên | Trạng Thái |
| :--- | :--- | :---: | :---: | :---: |
| **Demo Preparation** | Soạn thảo kịch bản Demo (Demo Script) chi tiết | A | P0 | Todo |
| **Demo Preparation** | Quay video Demo trực quan các luồng tính năng thực tế tại Văn Miếu | C | P1 | Todo |
| **Demo Preparation** | Thiết kế slide thuyết trình nghiệm thu sản phẩm | A | P0 | Todo |
| **Monitoring** | Kiểm tra độ ổn định (Target Uptime 99%) và giám sát chi phí API (Gemini) | B | P0 | Todo |
| **Project Closeout** | Tổng hợp báo cáo kết quả dự án và các đề xuất mở rộng (Future Roadmap) | A + B | P0 | Todo |
