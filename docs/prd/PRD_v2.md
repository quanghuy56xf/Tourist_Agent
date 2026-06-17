# **PRODUCT REQUIREMENTS DOCUMENT (PRD) - V2**

# **AI HERITAGE GUIDE PLATFORM V2**

**Nền tảng Quản trị & Trải nghiệm Tham quan AI đa địa điểm dành cho Di tích, Bảo tàng và Triển lãm**

* **Phiên bản:** 2.0 (Self-hosted & Multi-tenant)
* **Loại dự án:** AI Platform (Computer Vision + RAG + Generative AI)

## **1. EXECUTIVE SUMMARY**

### **1.1 Product Overview**

AI Heritage Guide V2 là bản nâng cấp toàn diện của hệ thống hướng dẫn viên AI số. Từ mô hình MVP tập trung vào một địa điểm cố định (Văn Miếu), hệ thống nay được tái cấu trúc thành một **Nền tảng (Platform)**. 
Nền tảng cung cấp hai khối chức năng chính:
1. **Khối Quản trị (Admin Panel)**: Dành cho Ban quản lý tạo lập không gian triển lãm (Groups), thêm các hiện vật (Items), tự tải lên hình ảnh huấn luyện và cập nhật tài liệu lịch sử chuyên sâu (Knowledge Base).
2. **Khối Khách tham quan (Visitor App)**: Chọn không gian tham quan, quét camera nhận diện hiện vật tức thì (bằng AI chạy cục bộ), nghe/đọc các câu chuyện lịch sử được sinh ra tự động theo ngữ cảnh (Hybrid RAG + LLM), và tương tác hỏi đáp qua Chatbot.

### **1.2 Sự Khác Biệt Giữa V1 và V2**

| Tiêu chí | Phiên bản V1 (MVP) | Phiên bản V2 (Platform) |
| --- | --- | --- |
| **Quy mô địa điểm** | Hardcode 5 địa điểm tại Văn Miếu | Không giới hạn. Hỗ trợ đa nhóm (Groups) và đa hiện vật (Items). |
| **Nhận diện hình ảnh** | Google Gemini Vision API (Tốn phí, độ trễ phụ thuộc mạng) | Model nguồn mở **DINOv2 + ChromaDB** chạy cục bộ (Tốc độ cao, miễn phí). |
| **Dữ liệu tri thức (RAG)** | File JSON tĩnh được nhúng trong code | Cơ sở dữ liệu Vector (Text Chroma) và Sparse (BM25) hỗ trợ cập nhật động qua Admin. |
| **Quản trị dữ liệu** | Lập trình viên cập nhật qua code | Giao diện Admin quản trị nội dung trực quan (CRUD). |
| **Giọng đọc (TTS)** | Chưa có / Hạn chế | Tích hợp Edge TTS hỗ trợ Audio Streaming đa ngôn ngữ. |
| **Hạ tầng (Infrastructure)** | Supabase Edge Functions (Cloud) | Tự lưu trữ (Self-hosted) bằng FastAPI + SQLite + Next.js (hỗ trợ Docker). |

## **2. TARGET USERS & PERSONAS**

### **2.1 Khách tham quan (Visitors)**
Giữ nguyên 3 nhóm Persona cốt lõi như V1, bao gồm:
* **Gen Z Explorer:** Thích thông tin ngắn gọn, fun-fact, ngôn ngữ hiện đại.
* **Family Visitor:** Đi cùng trẻ em, thích thông tin dạng kể chuyện (Storytelling), dễ hiểu, có tính giáo dục.
* **International Tourist:** Khách quốc tế, tiếp cận thông tin bằng tiếng Anh chuẩn xác, cần giải thích sâu bối cảnh văn hóa bản địa.

### **2.2 Ban quản lý / Giám tuyển (Admins / Curators)**
* **Mục tiêu:** Muốn số hóa không gian trưng bày một cách chủ động mà không cần can thiệp mã nguồn.
* **Nhu cầu:** Một giao diện trực quan để đăng ký hiện vật mới, tải lên ảnh góc cạnh của hiện vật để huấn luyện AI nhận diện, và tải lên tài liệu tham khảo để làm giàu kiến thức cho Chatbot.

## **3. PRODUCT SCOPE & FUNCTIONAL REQUIREMENTS**

### **3.1 Khối Khách Tham Quan (Visitor Flow)**
* **FR-V01 [Group Discovery]:** Truy cập trang chủ `http://localhost:3000/`, hiển thị danh sách tất cả các Khu di tích/Nhóm triển lãm (Groups) đang mở công khai (Public).
* **FR-V02 [Persona Selection]:** Lựa chọn Nhóm Persona và Ngôn ngữ (Vietnamese / English) trước khi bắt đầu hành trình.
* **FR-V03 [Object Search via Camera]:** Mở giao diện Camera, quét hiện vật. Ứng dụng nén ảnh, gửi về Backend. DINOv2 trích xuất đặc trưng và tìm kiếm trong ChromaDB để định danh hiện vật với độ trễ thấp nhất.
* **FR-V04 [AI Storytelling & TTS]:** Sau khi định danh, hệ thống tự động sinh câu chuyện giới thiệu có độ dài từ 100 - 150 từ (tùy biến theo Persona và Ngôn ngữ), đồng thời phát giọng đọc (Streaming TTS).
* **FR-V05 [Contextual Chatbot]:** Cung cấp khung chat để người dùng hỏi đáp sâu hơn. Câu trả lời được kiểm soát chặt chẽ bằng thuật toán **Hybrid RAG** (kết hợp Chroma Dense và BM25) đảm bảo độ chính xác cao nhất từ tài liệu do Admin cung cấp.

### **3.2 Khối Quản Trị (Admin Flow)**
* **FR-A01 [Admin Authentication]:** Các tính năng thêm/sửa/xóa yêu cầu xác thực HTTP Basic Auth.
* **FR-A02 [Group Management]:** Tạo, sửa, xóa các khu trưng bày (Groups). Chuyển đổi trạng thái Public (hiển thị cho khách) hoặc Draft (nháp).
* **FR-A03 [Item Management]:** Thêm hiện vật (Items) vào trong một Group.
* **FR-A04 [Image Training]:** Tải lên các góc ảnh của hiện vật. Hệ thống tự động mã hóa và nhúng vào CSDL Vector ảnh (DINOv2 ChromaDB).
* **FR-A05 [Knowledge Base Upload]:** Thêm tài liệu tham khảo (văn bản) cho từng Group/Item. Hệ thống tự động phân tách (chunking) và lập chỉ mục vào CSDL RAG.

## **4. NON-FUNCTIONAL REQUIREMENTS**

* **Performance:** 
  * Nhận diện hình ảnh cục bộ qua DINOv2 phải hoàn thành dưới 2 giây.
  * Sinh văn bản bằng LLM phải hỗ trợ Streaming để giảm độ trễ trải nghiệm.
* **Scalability:** Kiến trúc CSDL Vector và SQLite hỗ trợ tách biệt dữ liệu theo Group, có khả năng mở rộng lên hàng ngàn hiện vật.
* **Cost Efficiency:** Bằng việc chuyển nhận diện hình ảnh từ Gemini Vision (tốn phí) sang mô hình mã nguồn mở DINOv2 (miễn phí), chi phí vận hành nền tảng giảm thiểu đáng kể, chỉ còn tốn chi phí cho LLM xử lý ngôn ngữ.
* **Deployment:** Dễ dàng đóng gói bằng Docker và triển khai lên các máy chủ cục bộ hoặc đám mây (Self-hosted).

## **5. ROADMAP & FUTURE WORK**

* **Giai đoạn V2 (Hiện tại):** Ổn định nền tảng đa địa điểm, hệ thống Hybrid RAG tự chủ, và nhận diện DINOv2.
* **Giai đoạn V3:** 
  * Bổ sung trang Dashboard thống kê (Analytics) cho Ban quản lý (theo dõi số lượt quét, câu hỏi phổ biến).
  * Hỗ trợ định vị GPS (Geolocation) để lọc các Group/Khu di tích gần du khách nhất.
  * Tích hợp cơ chế Cache tiên tiến hơn cho nội dung câu chuyện AI để tiết kiệm thêm token.
