# **PRODUCT REQUIREMENTS DOCUMENT (PRD) - V4**

# **AI HERITAGE GUIDE PLATFORM V4**

**Nền tảng Quản trị, Trải nghiệm Tham quan AI đa địa điểm & Tối ưu hóa Production RAG**

* **Phiên bản:** 4.0 (Production-Ready RAG, Product Evaluation, 6-Language i18n & STT)
* **Loại dự án:** AI Platform (Computer Vision + Hybrid RAG + Streaming Generative AI + Analytics)

## **1. EXECUTIVE SUMMARY**

### **1.1 Product Overview**

AI Heritage Guide V4 là bản nâng cấp toàn diện hướng tới môi trường Production thực tế. Ngoài trải nghiệm tương tác với **AI Historical Companion** đã có từ V3, V4 tập trung giải quyết các bài toán về **Chất lượng dữ liệu (Data Quality)**, **Đo lường sản phẩm (Product Evaluation)**, **Truy xuất ngữ cảnh RAG nâng cao (Reranker)** và mở rộng trải nghiệm **Đa ngôn ngữ toàn diện (6 ngôn ngữ)**.

Khối lượng tính năng cốt lõi:
1. **Khối Khách tham quan (Visitor App)**: 
   - Tối ưu UX/UI trên Mobile (Fix layout shift `100dvh`).
   - Mở rộng hỗ trợ 6 ngôn ngữ (vi, en, ko, ja, zh, fr) cho toàn bộ UI và tương tác.
   - Nhận diện giọng nói STT (MediaRecorder + Gemini) cải thiện thay thế cho Web Speech API cũ.
   - Thu thập phản hồi nhanh (Đánh giá sao, feedback popup).
2. **Khối Quản trị (Admin Panel)**: 
   - Dashboard Analytics mới để theo dõi Product Eval (9 KPIs).
   - Module kiểm tra sức khỏe Index, chuẩn hóa văn bản, và bảo mật dữ liệu RAG (RAG Trace & Confidence score).

### **1.2 Sự Khác Biệt Giữa V3 và V4**

| Tiêu chí | Phiên bản V3 | Phiên bản V4 |
| --- | --- | --- |
| **Pipeline RAG** | Hybrid RAG (Dense + BM25) cơ bản. | **Production RAG**: Bổ sung Heuristic Reranker, Tinh chỉnh tham số k/search_K, RAG Trace (lưu log ngữ cảnh), Confidence Score & Normalization. |
| **Đo lường (Evaluation)** | Đánh giá thủ công hoặc qua script nội bộ. | **Product Eval Dashboard**: 9 KPI tự động hóa (Image accuracy, Time-to-first-story, Quest completion, P95 latency, RAGAS metrics...). |
| **Đa ngôn ngữ (i18n)** | Giới hạn ở Tiếng Việt và Tiếng Anh. | **6 Ngôn ngữ**: Hỗ trợ đầy đủ tiếng Việt, Anh, Hàn, Nhật, Trung, Pháp trên mọi thông báo UI và popup. |
| **Voice Input (STT)** | Dùng Web Speech API (hay lỗi trên iOS). | **MediaRecorder + Gemini STT**: Xử lý mượt mà trên đa nền tảng, gửi file WebM để chuyển text. |
| **UX/UI** | Các tính năng tải ảnh, quét, help rời rạc. | Gom luồng **Scan/Upload** chung, Fix layout shift mobile, Popup Help đồng bộ đa ngôn ngữ. |

## **2. TARGET USERS & PERSONAS**

### **2.1 Khách tham quan (Visitors)**
* Mở rộng mạnh nhóm **International Tourist (Khách quốc tế):** Bằng việc phủ sóng 6 ngôn ngữ phổ biến nhất, đảm bảo khách nước ngoài có thể tận hưởng mọi tính năng mà không gặp rào cản từ UI hay dữ liệu RAG.

### **2.2 Ban quản lý / Giám tuyển (Admins / Curators)**
* **Data & Product Manager:** Có công cụ đo lường minh bạch (Product Eval) để đánh giá tỷ lệ trả lời đúng của AI, độ tin cậy (Trustworthy Answer Rate) và trải nghiệm người dùng thực tế.

## **3. PRODUCT SCOPE & FUNCTIONAL REQUIREMENTS**

### **3.1 Khối Khách Tham Quan (Visitor Flow)**
* **FR-V01 [Mobile UX Optimization]:** Cấu trúc layout Flexbox toàn cục `100dvh` chống hiện tượng xê dịch màn hình trên iOS/Android Safari. Gom các tuỳ chọn tải ảnh/chụp ảnh vào chung giao diện Scan.
* **FR-V02 [6-Language i18n Interface]:** Toàn bộ thẻ, menu, hướng dẫn popup, đánh giá trải nghiệm (feedback) hỗ trợ động 6 ngôn ngữ.
* **FR-V03 [Stable Voice Input]:** Hệ thống nhận dạng giọng nói bằng MediaRecorder gửi lên backend xử lý STT, loại bỏ lỗi abort của trình duyệt.
* **FR-V04 [Instant Feedback Mechanism]:** Tích hợp Đánh giá sao nhanh (Quick Star Rating) và Bottom Sheet feedback.

### **3.2 Khối Quản Trị & Backend Core (Admin & AI Flow)**
* **FR-A01 [Production RAG Pipeline]:** 
  - Tính điểm chất lượng tài liệu (Quality score, hash).
  - Tự động chuẩn hoá (Normalization) Unicode và line-endings.
  - Sử dụng Heuristic Reranker và mở rộng tham số `search_K`.
* **FR-A02 [Product Analytics & RAGAS Eval]:** 
  - Lưu RAG Trace (bao gồm các chunks được fetch, score, latency).
  - Khai báo và đo lường 9 KPIs. RAGAS eval pipeline với `faithfulness` và `answer_relevancy`.
* **FR-A03 [Governance & Security]:** 
  - Chỉ mục đánh giá tài liệu nháp (`draft`). Tài liệu nháp bị loại khỏi query trả lời.

## **4. NON-FUNCTIONAL REQUIREMENTS**

* **Tính chính xác của AI (AI Accuracy):** Gate score cho RAGAS Eval đạt điểm tuyệt đối 4/4 cho các Golden Datasets. Trustworthy Answer Rate đạt ngưỡng cao.
* **Độ ổn định (Resilience):** Xử lý an toàn khi thiếu dữ liệu âm thanh (tránh lỗi UI). Tránh lặp vô tận (cross-loop) trong test và CI/CD.
* **Bảo mật RAG:** Chống Prompt Injection, giới hạn lịch sử chat gửi lên LLM (tối đa 10 tin nhắn) để tránh tràn token.

## **5. ROADMAP & FUTURE WORK**

* **Giai đoạn V4 (Hiện tại):** Tối ưu hoá Production RAG, Product Eval, 6-Language, UX Mobile.
* **Giai đoạn V4.5 (Tiếp theo):**
  - Xây dựng Admin Dashboard trực quan hiển thị RAG Trace và Index Health.
  - Tự động chạy toàn bộ RAGAS Eval suite trong CI/CD.
  - Nâng cấp DLP/PII detector trong Governance để rà soát dữ liệu riêng tư.
