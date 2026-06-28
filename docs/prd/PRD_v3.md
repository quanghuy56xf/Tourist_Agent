# **PRODUCT REQUIREMENTS DOCUMENT (PRD) - V3**

# **AI HERITAGE GUIDE PLATFORM V3**

**Nền tảng Quản trị, Trải nghiệm Tham quan AI đa địa điểm & AI Historical Companion**

* **Phiên bản:** 3.0 (AI Companion, Interactive Quests & CI/CD Pipeline)
* **Loại dự án:** AI Platform (Computer Vision + RAG + Streaming Generative AI)

## **1. EXECUTIVE SUMMARY**

### **1.1 Product Overview**

AI Heritage Guide V3 kế thừa nền tảng vững chắc của V2 (Self-hosted, Multi-tenant) và mở rộng trải nghiệm người dùng với **AI Historical Companion** (Người bạn đồng hành lịch sử AI). Nền tảng nay không chỉ cung cấp thông tin một chiều mà biến không gian di sản thành một **trải nghiệm tương tác hai chiều, sống động và liền mạch**.

Hai khối chức năng chính:
1. **Khối Khách tham quan (Visitor App)**: Trải nghiệm nhận diện ảnh (Edge AI), Dynamic Minimap định vị tức thời. Chế độ AI Companion (nhân vật Lê Quý Đôn) hỗ trợ tương tác bằng giọng nói (STT), đàm thoại thời gian thực (Streaming SSE & TTS Chunking), dẫn dắt hành trình qua các Quest (MVP) và tự động gợi ý điểm tham quan tiếp theo. Đã hoàn thiện đa ngôn ngữ (i18n) cho cả giao diện và giọng đọc.
2. **Khối Quản trị (Admin Panel)**: Tạo lập không gian, quản lý hiện vật, tài liệu RAG, và tải lên/cấu hình Dynamic Minimap dạng JSON.

### **1.2 Sự Khác Biệt Giữa V2 và V3**

| Tiêu chí | Phiên bản V2 | Phiên bản V3 |
| --- | --- | --- |
| **Giao tiếp & Kể chuyện** | AI sinh văn bản, ấn nút đọc toàn bộ (Audio tĩnh). | **AI Companion**: Trò chuyện hai chiều, nhận diện giọng nói (STT), phản hồi luồng (SSE Streaming) kết hợp âm thanh tự động chia cắt (TTS Chunking). |
| **Bản đồ (Minimap)** | Hardcode hoặc tĩnh. | **Dynamic Minimap**: Cấu hình từ Admin qua JSON, frontend tự động render và highlight đường đi. |
| **Đa ngôn ngữ (i18n)** | Chỉ hỗ trợ nội dung động từ AI. | Hỗ trợ toàn diện UI và giọng đọc (Tiếng Việt `vi-VN-NamMinhNeural` / Tiếng Anh `en-US-GuyNeural`). |
| **Tương tác & Dẫn dắt** | Khách tự do khám phá vô định. | **Quest System MVP**: Nhiệm vụ, câu đố, gợi ý mồi (bait), hệ thống gợi ý điểm tiếp theo tự động. |
| **Triển khai (Deployment)** | Thủ công trên VM. | **CI/CD Toàn diện**: GitHub Actions CI/CD; Frontend lên Railway, Backend lên GCP VM zero-downtime. |

## **2. TARGET USERS & PERSONAS**

### **2.1 Khách tham quan (Visitors)**
Giữ nguyên các nhóm khách cốt lõi (Gen Z, Family, International), nhưng nhắm mạnh hơn vào:
* **Interactive Learners & Gamers:** Nhóm người dùng trẻ thích trải nghiệm gamification (Quest, Thử thách, Giải đố) thông qua AI Companion.
* **International Tourist:** Trải nghiệm mượt mà nhờ hệ thống i18n toàn diện và giọng đọc bản xứ chuẩn xác.

### **2.2 Ban quản lý / Giám tuyển (Admins / Curators)**
* **Nhu cầu mới:** Muốn tùy chỉnh không gian vật lý thông qua bản đồ số (Dynamic Minimap) mà không cần lập trình viên can thiệp vào code gốc.

## **3. PRODUCT SCOPE & FUNCTIONAL REQUIREMENTS**

### **3.1 Khối Khách Tham Quan (Visitor Flow)**
* **FR-V01 [Group Discovery & Minimap]:** Khám phá không gian triển lãm. Xem trước bản đồ tổng thể bằng Minimap động (render từ JSON).
* **FR-V02 [AI Companion Mode]:** Mở giao diện chat với avatar nhân vật lịch sử (Lê Quý Đôn).
  * Avatar thu gọn thông minh (Collapsible) để nhường chỗ cho bản đồ/camera.
  * Nhận diện giọng nói qua STT để gửi tin nhắn.
* **FR-V03 [Real-time Streaming Interaction]:** AI trả về kết quả theo luồng.
  * Tự động sinh ra các **Câu hỏi gợi ý mồi (Suggested Questions)** dạng nút bấm dưới khung chat (Backend-driven UI).
  * Backend tự động phân rã câu trả lời thành từng cụm từ (phrase chunking) và render TTS song song, giúp giảm độ trễ giọng nói xuống mức thấp nhất.
* **FR-V04 [Quest & Gamification MVP]:** 
  * Smart Idle Timer: Nếu khách đứng yên quá lâu, AI đưa ra câu gợi ý mồi hoặc nhiệm vụ.
  * Quét hiện vật theo tiến trình nhiệm vụ (Onboarding, 2 Quests) với Compact HUD dưới avatar. Đưa ra câu đố liên quan đến hiện vật vừa quét.
* **FR-V05 [Next Stop Suggestion]:** Sau mỗi hiện vật, AI tự động gợi ý điểm đến tiếp theo chưa ghé thăm, hiển thị nút Action điều hướng khách mở bản đồ.

### **3.2 Khối Quản Trị (Admin Flow)**
* **FR-A01 [Minimap Configuration]:** Upload cấu hình `minimap_config.json` theo từng Group, chứa danh sách tọa độ và `itemNames` để map động với DB.
* **FR-A02 [Core Management]:** Vẫn duy trì các chức năng quản lý Group, Item, DINOv2 Vector Upload, Knowledge Base RAG Upload.

## **4. NON-FUNCTIONAL REQUIREMENTS**

* **Low-Latency Streaming:** 
  * TTS Chunking: Đọc câu đầu tiên trong vòng <1.5s nhờ thiết kế 2 workers luân phiên sinh audio song song với text stream.
* **UI/UX Excellence:** 
  * Áp dụng phong cách thiết kế Glassmorphism (dropdown, backdrop-blur) mang lại cảm giác hiện đại, cao cấp.
  * Hạn chế Layout Shift trên Mobile (sử dụng Wrapper `100dvh` và Fixed Overlay).
* **Automated CI/CD & Reliability:** 
  * Tự động Lint, Build, Test (Pytest) trên GitHub Actions.
  * Frontend tách biệt hoàn toàn chạy trên Edge/Serverless (Railway). Backend chạy trên Cloud VM. Đảm bảo Zero-downtime deployment.

## **5. ROADMAP & FUTURE WORK**

* **Giai đoạn V3 (Hiện tại):** Tích hợp AI Companion, Streaming Pipeline, Quest MVP và CI/CD tự động hóa.
* **Giai đoạn V3.5 (Tiếp theo):**
  * **Quest Phase 2 - Hidden Gems**: Tích hợp Quest vào luồng tham quan tự do (thay vì luồng ép buộc tuyến tính), biến các nhiệm vụ thành "điểm bí mật" thưởng ngầm.
  * Analytics Dashboard cho Ban quản lý.
