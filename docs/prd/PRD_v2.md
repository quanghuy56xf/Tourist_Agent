# **PRODUCT REQUIREMENTS DOCUMENT (PRD) - V2**

# **AI HERITAGE GUIDE PLATFORM**

**Nền tảng AI tăng cường trải nghiệm tham quan cho di tích, bảo tàng và điểm du lịch văn hóa**

* **Phiên bản:** 2.0 (Cập nhật dựa trên kiến trúc và luồng thực tế)
* **Loại dự án:** AI Product (Computer Vision + Generative AI)
* **Thời gian triển khai:** 6 Tuần
* **Địa điểm thử nghiệm (Pilot):** Văn Miếu – Quốc Tử Giám

## **1. EXECUTIVE SUMMARY**

### **1.1 Product Overview**

AI Heritage Guide là nền tảng Web App hỗ trợ khách tham quan tương tác với các điểm du lịch, di tích lịch sử và bảo tàng thông qua công nghệ AI, không cần cài đặt ứng dụng.

Người dùng sử dụng camera điện thoại hướng vào hiện vật hoặc công trình để quét. Hệ thống sẽ:
* Nhận diện đa góc nhìn đối tượng bằng AI Vision nội bộ (DINOv2).
* Gợi ý top các hiện vật phù hợp nhất.
* Cung cấp nội dung tự động sinh (Storytelling) phù hợp từng Persona bằng mô hình LLM (Google Gemini).
* Cho phép tương tác qua Chatbot thông minh tích hợp Hybrid RAG (Retrieval-Augmented Generation).
* Hỗ trợ đọc văn bản tự động (Text-to-Speech) đa ngôn ngữ.

### **1.2 Problem Statement**

Khách tham quan thường bỏ qua các bảng thông tin tĩnh do chữ nhỏ, học thuật và khô khan. Khách quốc tế gặp trở ngại lớn về ngôn ngữ và bối cảnh. Hệ quả là trải nghiệm thiếu chiều sâu, ban quản lý thiếu tương tác 2 chiều và tốn kém chi phí duy trì nhân sự hướng dẫn viên tại điểm.

### **1.3 Proposed Solution**

Hệ thống Next.js + FastAPI tích hợp AI:
* Camera scan trực tiếp vật thể và tìm kiếm thông qua không gian Vector (Chroma) không phụ thuộc API trả phí.
* Sinh nội dung (Storytelling) cá nhân hóa cho từng tệp khách.
* Tích hợp Text-To-Speech (gTTS) để khách nghe trực tiếp như Audio Guide truyền thống nhưng thông minh hơn.
* Hệ thống Admin đăng ký hiện vật (Quản lý đa góc ảnh, metadata, đồng bộ RAG tự động) giúp BQL chủ động mở rộng dữ liệu.

## **2. BUSINESS CONTEXT & COMPETITIVE ADVANTAGES**

So với các giải pháp truyền thống (Bảng thông tin, QR tĩnh, Hướng dẫn viên trực tiếp), giải pháp AI cung cấp năng lực:
* **Nhận diện bằng camera:** Định danh qua mô hình DINOv2 có khả năng augmentation chống nhiễu ảnh.
* **Cá nhân hóa:** Kể chuyện dựa theo thiết lập độ tuổi/ngôn ngữ.
* **Tương tác:** Hỏi đáp sâu bằng Gemini với bối cảnh từ RAG.
* **Tối ưu chi phí:** Lưu trữ và xử lý Vision Vector được thực hiện hoàn toàn local/tự host thay vì trả phí trên mỗi ảnh qua các API thương mại.

## **3. USER RESEARCH & PERSONAS**

1. **Gen Z Explorer (18–30 tuổi):** Cần thông tin súc tích, sự thật thú vị, hành văn trẻ trung, tránh hàn lâm.
2. **Family Visitor (30–45 tuổi):** Cần câu chuyện dễ hiểu, giải thích đơn giản và kích thích tò mò cho trẻ con cùng đi.
3. **International Tourist:** Cần tiếng Anh tự nhiên, học thuật nhưng có liên hệ rõ ràng với văn hóa phổ quát.

## **4. PRODUCT VISION & GOALS**

* **Goal 1:** Tăng mức độ tương tác và thời gian trải nghiệm (session duration) bằng mô hình RAG chat & Storytelling.
* **Goal 2:** Nâng cao trải nghiệm tiện lợi thông qua Audio Guide (TTS) giúp khách vừa nghe vừa tham quan.
* **Goal 3:** Hoàn thiện công cụ quản trị (Admin) để ban quản lý có thể tự số hóa các hiện vật (Chụp 3 góc ảnh, nhập mô tả -> Tự động nạp vào AI).

## **5. SCOPE OF IMPLEMENTATION (V2)**

### **5.1 In Scope**
* **Camera Recognition (Search):** Quét ảnh hiện vật và tìm kiếm trả về Top 3 vật thể khớp nhất dựa trên mô hình DINOv2.
* **Persona & Language Selection:** Phân loại tệp khách (GenZ, Family, International) và 2 ngôn ngữ (VI/EN).
* **AI Storytelling (Gemini):** Sinh văn bản theo cấu trúc ngữ cảnh hiện vật.
* **AI Chatbot (Gemini + Hybrid RAG):** Trả lời câu hỏi đúng chuyên môn.
* **Text-To-Speech (TTS):** Chuyển đổi văn bản phản hồi thành giọng đọc (gTTS).
* **Admin Management:** Đăng ký hiện vật, quản lý ảnh (front/side/back), quản lý nhóm di tích có xác thực (Basic Auth).

### **5.2 Out Of Scope (Tương lai)**
* Trải nghiệm AR (Augmented Reality).
* Avatar 3D hoạt ảnh.
* Đề xuất cung đường di chuyển qua GPS (Route Planning).

## **6. USER & ADMIN FLOW**

### **6.1 User Flow (Tham quan)**
1. Mở Web App trên điện thoại. Chọn Persona và Ngôn ngữ.
2. Bấm nút Quét (Camera) -> Chụp hình hiện vật.
3. Hệ thống dùng DINOv2 phân tích và tìm kiếm (Search), hiển thị tối đa **Top 3 kết quả**.
4. Khách chọn hiện vật đúng nhất -> Hệ thống gọi Gemini sinh Câu chuyện giới thiệu.
5. Khách đọc đoạn giới thiệu hoặc nhấn nút Nghe (TTS).
6. Khách trò chuyện với Chatbot để hiểu thêm chi tiết.

### **6.2 Admin Flow (Quản trị dữ liệu)**
1. Admin gọi API (hoặc giao diện Admin) truyền Basic Auth credential.
2. Tạo Nhóm Hiện vật (Group).
3. Đăng ký Hiện vật (Item): Nhập tên, mô tả chuẩn và Tải lên từ 1 đến 3 ảnh (Front, Side, Back).
4. Hệ thống trích xuất vector cho 3 ảnh (+ảnh lật/crop) và tự động đồng bộ mô tả vào Hybrid RAG. 
5. Vật thể chính thức có thể được scan bởi khách tham quan.

## **7. FUNCTIONAL REQUIREMENTS**

* **FR-01 [Web Access]:** Responsive UI trên Next.js cho thiết bị di động, không yêu cầu cài đặt native app.
* **FR-02 [Object Recognition]:** Tìm kiếm ảnh qua API `/api/search`. Sử dụng thuật toán DINOv2 so sánh Cosine Similarity trên Chroma. Trả về thông tin tên, mô tả và điểm tương đồng.
* **FR-03 [AI Story Generation]:** API `/api/generate` dùng Gemini xây dựng câu chuyện 100-150 từ theo Persona và Ngôn ngữ hiện hành.
* **FR-04 [Contextual Chat]:** API `/api/chat` kết hợp luồng Hybrid RAG (BM25 + Chroma Text) để truy xuất dữ liệu mô tả và file `chunks.pkl` trước khi cho LLM phản hồi.
* **FR-05 [Text-to-Speech]:** Tích hợp công nghệ đọc văn bản qua API `/api/tts` trả về luồng Audio cho client.
* **FR-06 [Admin Items Registration]:** Cho phép định danh `item_id`, upload file nhiều ảnh. Tự động bảo vệ tính toàn vẹn (rollback nếu lỗi pipeline).

## **8. NON-FUNCTIONAL REQUIREMENTS**

### **8.1 Performance**
* Quá trình Search (Nhận diện DINOv2): Tối ưu dưới 5 giây.
* Thời gian sinh văn bản (Gemini): Tối ưu streaming hoặc dưới 8 giây.
* Trải nghiệm quét ảnh thực tế mượt mà trên trình duyệt (MediaDevices API).

### **8.2 Security & Data Privacy**
* Mật khẩu Admin bảo vệ bằng Basic Auth (`ADMIN_AUTH_ENABLED=true`).
* Ảnh query tìm kiếm của người dùng chỉ được xử lý tạm thời (hoặc cấu hình tự xóa), không lưu vào dataset gốc.
* Ảnh Admin upload được lưu tại thư mục `uploads/` trên host nội bộ, không phân phối qua bên thứ 3.

## **9. TECHNICAL STACK (V2)**

Sơ đồ tổng thể chuyển sang mô hình Monolithic tự host nhằm dễ kiểm soát và giảm chi phí:

* **Frontend:** Next.js 14 App Router, Tailwind CSS, TypeScript.
* **Backend:** FastAPI (Python), SQLAlchemy.
* **Database & Storage:** 
   - SQLite (Metadata: Groups, Items).
   - Thư mục nội bộ (Lưu file ảnh gốc từ Admin).
* **AI & Machine Learning:**
   - **Computer Vision:** Mô hình DINOv2 (`facebook/dinov2-small`) trích xuất vector 384 chiều, kết hợp Chroma DB làm Vector DB truy vấn.
   - **GenAI (LLM):** Google Gemini Pro / Flash cho Text Generation.
   - **Hybrid RAG:** Tích hợp Chroma Text (Bi-encoder) và BM25 đảm bảo độ chính xác ngữ liệu.
   - **TTS Engine:** gTTS cho sinh Audio (Tiếng Việt & Anh).
* **Triển khai:** Hỗ trợ Dockerized.

## **10. KẾ HOẠCH BÀN GIAO & VẬN HÀNH DỮ LIỆU**

* **Cấu hình dữ liệu gốc (Ingest):** Hệ thống có các script mẫu (`ingest_van_mieu.py`) hỗ trợ quét hàng loạt các folder ảnh di tích đã chuẩn bị (ví dụ: Khuê Văn Các, Bia Tiến Sĩ...) để tự động nạp vector và chuẩn bị cho triển khai thực tế.
* **Ngưỡng nhạy bén (Similarity Threshold):** Cấu hình linh hoạt qua biến môi trường (Ví dụ `SIMILARITY_THRESHOLD=0.75`), có thể hạ/tăng tùy theo ánh sáng thực địa nhằm đạt hiệu năng nhận diện tốt nhất.
