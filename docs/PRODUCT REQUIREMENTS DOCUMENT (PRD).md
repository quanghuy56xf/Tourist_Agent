# **PRODUCT REQUIREMENTS DOCUMENT(PRD)**

# **AI HERITAGE GUIDE PLATFORM**

**Nền tảng AI tăng cường trải nghiệm tham quan cho di tích, bảo tàng và điểm du lịch văn hóa**

* **Phiên bản:** 1.0  
* **Loại dự án:** AI Product (Computer Vision \+ Generative AI)  
* **Thời gian triển khai:** 6 Tuần  
* **Số lượng thành viên:** 3 Người  
* **Địa điểm thử nghiệm (Pilot):** Văn Miếu – Quốc Tử Giám

## **1\. EXECUTIVE SUMMARY**

### **1.1 Product Overview**

AI Heritage Guide là nền tảng hỗ trợ khách tham quan tương tác với các điểm du lịch, di tích lịch sử, bảo tàng và khu trưng bày thông qua công nghệ AI.

Người dùng chỉ cần sử dụng camera điện thoại để hướng vào công trình hoặc hiện vật. Hệ thống sẽ:

* Nhận diện đối tượng bằng AI Vision.  
* Giải thích nội dung theo ngữ cảnh.  
* Kể chuyện lịch sử phù hợp từng nhóm khách (Persona).  
* Trả lời câu hỏi bằng ngôn ngữ tự nhiên.  
* Hỗ trợ đa ngôn ngữ (Tiếng Việt và Tiếng Anh).

Sản phẩm đóng vai trò như một hướng dẫn viên số cá nhân hóa hoạt động trực tiếp trên thiết bị di động của khách hàng mà không cần cài đặt ứng dụng phức tạp.

### **1.2 Problem Statement**

Tại nhiều điểm tham quan, di tích lịch sử hiện nay:

* Thông tin chủ yếu được truyền tải bằng bảng giới thiệu tĩnh, chữ nhỏ và mờ.  
* Nội dung học thuật khô khan, khó tiếp cận với đối tượng khách hàng trẻ tuổi.  
* Thiếu tính tương tác hai chiều (khách có thắc mắc không biết hỏi ai).  
* Khách quốc tế gặp rào cản lớn về ngôn ngữ và thấu hiểu bối cảnh văn hóa.  
* Ban quản lý khó mở rộng hoặc duy trì đội ngũ hướng dẫn viên trực tiếp vào mùa cao điểm.

**Hệ quả:** Khách tham quan thường chỉ chụp ảnh check-in, đi lướt qua và không hiểu sâu về giá trị di tích. Điều này làm giảm giá trị giáo dục, văn hóa và giảm chất lượng trải nghiệm du lịch chung.

### **1.3 Proposed Solution**

Xây dựng một nền tảng Web App (PWA) ứng dụng AI cho phép:

* Nhận diện tức thì công trình hoặc hiện vật thông qua camera điện thoại.  
* Tự động sinh nội dung (Storytelling) cá nhân hóa theo độ tuổi và nhu cầu.  
* Chatbot tương tác thời gian thực giải đáp mọi thắc mắc theo bối cảnh.  
* Hỗ trợ đa ngôn ngữ linh hoạt.  
* Hệ thống dữ liệu đóng gói dạng mô-đun, dễ dàng mở rộng sang các địa điểm khác.

## **2\. BUSINESS CONTEXT**

### **2.1 Market Opportunity**

Xu hướng chuyển đổi số trong du lịch và bảo tồn di sản đang nhận được sự hỗ trợ lớn từ chính phủ và các tổ chức văn hóa. Các giải pháp hiện tại (như mã QR tĩnh liên kết link website, Audio Guide bấm số) đều là giao tiếp một chiều, chưa tạo được sự tương tác cá nhân hóa. Sự tối ưu về chi phí và tốc độ của Vision AI lẫn Large Language Models (LLM) hiện nay là cơ hội vàng để xây dựng thế hệ hướng dẫn viên số thông minh với chi phí vận hành cực thấp.

### **2.2 Stakeholders**

| Nhóm Stakeholder | Đối tượng cụ thể | Vai trò / Tác động |
| :---- | :---- | :---- |
| **Primary Users** | Khách tham quan du lịch nội địa và quốc tế | Người trực tiếp sử dụng sản phẩm để trải nghiệm di tích. |
| **Secondary Users** | Ban quản lý di tích, Bảo tàng, Đơn vị lữ hành | Chủ sở hữu không gian, đơn vị giám định và cung cấp dữ liệu gốc. |
| **Internal Stakeholders** | Nhóm phát triển sản phẩm (3 thành viên) | Chịu trách nhiệm thiết kế, lập trình, vận hành và kiểm thử hệ thống. |

### **2.3 Risks & Mitigation**

| Rủi ro (Risk) | Mức độ | Biện pháp giảm thiểu (Mitigation) |
| :---- | :---- | :---- |
| **AI nhận diện sai đối tượng** | Cao | Đặt ngưỡng tự tin (Confidence Threshold) \>=70% . Nếu thấp hơn ngưỡng này, hệ thống tự động kích hoạt tính năng Chọn thủ công (Manual Selection \- FR-08). Hiển thị cảnh báo rõ ràng cho người dùng. |
| **AI tạo nội dung không chính xác (Hallucination)** | Cao | Áp dụng kiến trúc RAG (Retrieval-Augmented Generation) để giới hạn phạm vi trả lời trong Knowledge Base đã duyệt. Mọi thông tin đầu vào phải qua kiểm duyệt của chuyên gia/BQL trước khi nạp vào hệ thống. Cài đặt sẵn Fallback Message. |
| **Chất lượng mạng (3G/4G/Wifi di tích) yếu** | Trung bình | Tối ưu dung lượng ảnh tải lên (\<= 5MB). Tiến hành tải trước (Pre-load) dữ liệu cơ bản của 5 địa điểm chính khi người dùng vừa quét QR vào App. Cài đặt bộ nhớ đệm (Cache) cho các câu hỏi phổ biến. |
| **Chi phí API tăng đột biến** | Trung bình | Thiết lập Rate Limit nghiêm ngặt (Tối đa 20 requests/user/session). Cài đặt hạn mức chi tiêu cứng (Budget Cap) và hệ thống cảnh báo tự động trên Google Cloud Console theo ngày. |
| **Dữ liệu ảnh/nội dung vi phạm bản quyền** | Thấp \- TB | Chỉ sử dụng hình ảnh tự chụp trực tiếp hoặc ảnh sử dụng giấy phép mã nguồn mở (CC BY/CC0). Làm việc chính thức với Ban quản lý Văn Miếu để tiếp nhận và sử dụng tài liệu lưu hành nội bộ chuẩn xác. |

### **2.4 Competitive Analysis**

### **Solution 1: Bảng thông tin cố định (Static Information Boards)**

**Mô tả:** Hệ thống bảng biển giới thiệu vật thể được lắp đặt trực tiếp tại các vị trí tham quan.

**Ưu điểm (Advantages):**

* Tiết kiệm ngân sách triển khai và bảo trì.  
* Người dùng tiếp nhận ngay mà không cần công cụ kỹ thuật hỗ trợ.

**Hạn chế (Limitations):**

* Nội dung hàn lâm, khó thu hút tệp khách hàng trẻ tuổi.  
* Giao tiếp một chiều, thiếu tính sinh động.  
* Khả năng chuyển ngữ đa quốc gia chưa linh hoạt.

### **Solution 2: Hệ thống QR Code liên kết Website**

**Mô tả:** Du khách sử dụng thiết bị để quét mã, truy cập vào các trang thông tin số hóa sẵn có.

**Ưu điểm (Advantages):**

* Quy trình vận hành và áp dụng đơn giản.  
* Hỗ trợ cập nhật và chỉnh sửa dữ liệu nhanh chóng.

**Hạn chế (Limitations):**

* Trải nghiệm đọc thụ động, chưa tạo được sự kết nối sâu.  
* Không có khả năng giải đáp các thắc mắc tức thời.  
* Thiếu cơ chế dẫn chuyện cá nhân hóa.

### **Solution 3: Hướng dẫn viên trực tiếp (Human Tour Guide)**

**Mô tả:** Đội ngũ nhân sự thuyết minh đồng hành trực tiếp cùng khách tham quan.

**Ưu điểm (Advantages):**

* Mức độ tương tác cá nhân rất cao.  
* Khả năng truyền cảm hứng và kể chuyện giàu cảm xúc.

**Hạn chế (Limitations):**

* Chi phí nhân sự và vận hành tốn kém.  
* Khó đáp ứng nhu cầu tăng cao trong mùa cao điểm.  
* Giới hạn theo khung thời gian làm việc cố định.

**Lợi thế cạnh tranh của AI Heritage Guide**

| Tiêu chí | Bảng thông tin | QR | Hướng dẫn viên | AI Heritage Guide |
| :---: | :---: | :---: | :---: | :---: |
| Nhận diện bằng camera | Không | Không | Có | Có |
| Cá nhân hóa nội dung | Không | Không | Hạn chế | Có |
| Hỏi đáp theo ngữ cảnh | Không | Không | Có | Có |
| Hỗ trợ đa ngôn ngữ | Hạn chế | Hạn chế | Hạn chế | Có |
| Khả năng mở rộng | Cao | Cao | Thấp | Cao |

## **3\. USER RESEARCH & PERSONAS**

### **Persona 1 – Gen Z Explorer**

* **Độ tuổi:** 18 – 30 tuổi.  
* **Đặc điểm hành vi:** Nhạy bén với công nghệ, thích tự trải nghiệm, không thích đọc các khối văn bản dài dằng dặc, có thói quen chia sẻ hình ảnh/sự kiện thú vị lên mạng xã hội.  
* **Nỗi đau (Pain Point):** *"Tôi muốn biết điều gì đặc biệt, độc đáo hoặc hoang đường nhất về nơi này trong vòng 30 giây chứ không muốn đọc một bài sớ lịch sử."*  
* **Mục tiêu:** Học hỏi nhanh, bắt được các "fun fact", có trải nghiệm công nghệ mượt mà để chia sẻ với bạn bè.  
* **Content Tone & Style:** Ngắn gọn, súc tích, ngôn ngữ trẻ trung, hiện đại, đưa các sự thật bất ngờ (Fact) lên đầu, sử dụng emoji một cách hợp lý để tăng tính trực quan.

### **Persona 2 – Family Visitor**

* **Độ tuổi:** 30 – 45 tuổi.  
* **Đặc điểm hành vi:** Đi tham quan cùng con nhỏ (độ tuổi từ 6 – 14), mong muốn chuyến đi mang lại giá trị giáo dục trực quan, không có nhiều thời gian rảnh do phải để mắt tới trẻ nhỏ.  
* **Nỗi đau (Pain Point):** *"Con tôi rất nhanh chán, cháu không thể tập trung đọc các bảng thông tin chữ nhỏ và liên tục hỏi những câu tôi không biết trả lời."*  
* **Mục tiêu:** Giúp con trẻ tiếp thu kiến thức lịch sử một cách dễ dàng, biến buổi tham quan thành một trò chơi khám phá, tạo kỷ niệm gia đình ý nghĩa.  
* **Content Tone & Style:** Dạng kể chuyện (Storytelling), sử dụng các hình ảnh ẩn dụ đơn giản, chèn thêm các câu hỏi gợi mở, tương tác để kích thích trẻ em tư duy, tuyệt đối tránh các thuật ngữ hàn lâm khó hiểu.

### **Persona 3 – International Tourist**

* **Độ tuổi:** 25 – 55 tuổi.  
* **Đặc điểm hành vi:** Khách du lịch nước ngoài, không biết tiếng Việt, lần đầu tiên tiếp xúc với văn hóa, Nho giáo và lịch sử triều đại Việt Nam. Thường đi theo cặp đôi hoặc nhóm nhỏ tự túc.  
* **Nỗi đau (Pain Point):** *"Hầu hết bảng dịch tiếng Anh ở đây đều quá ngắn hoặc dịch thô cứng theo nghĩa đen, tôi không thể hiểu được bối cảnh văn hóa sâu xa của công trình này."*  
* **Mục tiêu:** Tiếp cận thông tin bằng tiếng Anh chuẩn bản xứ, hiểu được ý nghĩa văn hóa cốt lõi, có câu chuyện sâu sắc để chia sẻ lại sau chuyến đi.  
* **Content Tone & Style:** Tiếng Anh học thuật nhưng dễ tiếp cận (Clear & Academic English), giải thích tường tận các khái niệm văn hóa đặc thù (ví dụ: "Bia Tiến Sĩ", "Khuê Văn Các"), có sự so sánh, liên hệ với các công trình kiến trúc hoặc sự kiện quốc tế tương đương để khách dễ hình dung.

## **4\. PRODUCT VISION & GOALS**

### **4.1 Product Vision**

Biến mọi công trình kiến trúc, hiện vật tĩnh và không gian trưng bày thành một "thực thể sống" có khả năng chủ động giao tiếp, kể chuyện và giải thích lịch sử một cách thông minh, cá nhân hóa cho từng khách tham quan thông qua sức mạnh của AI.

### **4.2 Product Goals**

* **Goal 1:** Tăng mức độ tương tác và thời gian trải nghiệm sâu của khách tham quan tại địa điểm (đo bằng số lượng câu hỏi đặt ra và thời gian session).  
* **Goal 2:** Nâng cao khả năng tiếp cận và bình dân hóa thông tin lịch sử \- văn hóa vốn bị coi là khô khan.  
* **Goal 3:** Cá nhân hóa tối đa nội dung truyền tải phù hợp với từng lứa tuổi và quốc tịch.  
* **Goal 4:** Hỗ trợ xóa bỏ rào cản ngôn ngữ, nâng cao hình ảnh du lịch quốc tế cho các di tích Việt Nam.

### **4.3 Product Hypotheses**  

### **4.3.1 Giả thuyết về Cá nhân hóa Nội dung**

**Giả thuyết:** Việc triển khai cơ chế dẫn chuyện tùy biến theo từng nhóm chân dung khách hàng (Persona) sẽ thúc đẩy nhu cầu tương tác hai chiều.

**Lý do:** Thông tin được tinh chỉnh để trở nên gần gũi, súc tích và dễ thấu hiểu hơn đối với từng đối tượng cụ thể.

**Hệ quả mong đợi:** Gia tăng tần suất đặt câu hỏi cho chatbot AI từ phía người dùng.

**Chỉ số kiểm chứng:** Tỷ lệ phát sinh câu hỏi (Question Rate) ghi nhận mức tăng trưởng tối thiểu là 20%.

### **4.3.2 Giả thuyết về Nhận diện Tức thời**

**Giả thuyết:** Khả năng định danh công trình trực tiếp qua camera điện thoại sẽ tối ưu hóa hành trình trải nghiệm tại điểm đến.

**Lý do:** Loại bỏ hoàn toàn sự bất tiện khi phải tìm kiếm thủ công hoặc tiếp nhận dữ liệu từ các bảng giới thiệu tĩnh.

**Hệ quả mong đợi:** Giảm thiểu đáng kể thời gian chờ đợi để tiếp cận thông tin cốt lõi.

**Chỉ số kiểm chứng:** Quy trình từ lúc ghi hình đến khi hiển thị nội dung được kiểm soát dưới ngưỡng 15 giây.

### **4.3.3 Giả thuyết về Tương tác Chatbot**

**Giả thuyết:** Sự hiện diện của tính năng trò chuyện thời gian thực với AI sẽ giữ chân khách tham quan lâu hơn tại di tích.

**Lý do:** Chuyển đổi trạng thái từ tiếp nhận thụ động sang chủ động khám phá sâu các tầng lớp tri thức văn hóa.

**Hệ quả mong đợi:** Mở rộng chiều sâu trải nghiệm và gia tăng mức độ gắn kết với không gian trưng bày.

**Chỉ số kiểm chứng:** Thời gian sử dụng trung bình (Session Duration) đạt từ 3 phút trở lên cho mỗi phiên truy cập.

### **4.3.4 Giả thuyết về Rào cản Ngôn ngữ**

**Giả thuyết:** Việc tích hợp hỗ trợ ngôn ngữ Tiếng Anh chuẩn xác sẽ nâng cao vị thế du lịch quốc tế của địa điểm.

**Lý do:** Giúp khách nước ngoài thấu hiểu bối cảnh lịch sử mà không gặp trở ngại về diễn đạt hay dịch thuật thô cứng.

**Hệ quả mong đợi:** Cải thiện chỉ số cảm xúc và sự hài lòng của du khách quốc tế sau chuyến thăm.

**Chỉ số kiểm chứng:** Điểm đánh giá mức độ hài lòng trung bình từ khách ngoại quốc đạt tối thiểu 4/5 sao.

## **5\. MVP SCOPE**

### **5.1 In Scope (Tính năng triển khai trong MVP)**

* **Persona Selection:** Lựa chọn 1 trong 3 nhóm hồ sơ: Khám phá (Gen Z), Gia đình (Family), hoặc Khách quốc tế (International).  
* **Camera Recognition:** Chụp ảnh trực tiếp để nhận diện công trình, hiện vật.  
* **AI Storytelling:** Tự động biên dịch và sinh nội dung giới thiệu theo đúng Persona và ngôn ngữ đã chọn.  
* **AI Chatbot:** Hệ thống hỏi đáp chuyên sâu theo ngữ cảnh của hiện vật vừa quét.  
* **Multilingual Support:** Hỗ trợ hoàn hảo 2 ngôn ngữ hệ thống: Tiếng Việt và Tiếng Anh.  
* **Manual Selection:** Menu danh sách hỗ trợ chọn đối tượng thủ công khi camera không hoạt động hoặc nhận diện sai.

### **5.2 Out Of Scope (Không làm trong giai đoạn này)**

* Công nghệ tương tác thực tế ảo AR Overlay.  
* Hướng dẫn viên ảo dạng Avatar 3D chuyển động.  
* Tương tác bằng giọng nói (Voice Assistant / Text-to-Speech).  
* Hệ thống trò chơi hóa (Gamification) tích điểm đổi quà.  
* Gợi ý lộ trình tham quan tối ưu (Route Recommendation).  
* Các tính năng mạng xã hội, kết bạn, chia sẻ nội bộ app.

### **5.3 Feature Prioritization** 

### **P0 \- Critical (Bắt buộc hoàn thành)**

* **Access via QR:** Truy cập trực tiếp Web App qua mã quét.  
* **Persona Selection:** Phân loại nhóm hồ sơ khách tham quan.  
* **Camera Capture:** Kích hoạt ống kính ghi hình trực tiếp.  
* **AI Recognition:** Phân tích định danh công trình kiến trúc.  
* **AI Storytelling:** Tự động biên soạn nội dung dẫn chuyện.  
* **Contextual Chat:** Hỏi đáp thông minh theo ngữ cảnh.  
* **Knowledge Base:** Hệ thống dữ liệu tri thức cốt lõi.  
* **Vietnamese Support:** Tối ưu hóa ngôn ngữ Tiếng Việt.

### **P1 \- High (Nên có trong MVP)**

* **English Support:** Hỗ trợ đa ngôn ngữ cho khách quốc tế.  
* **Manual Selection:** Chế độ chọn đối tượng bằng tay.  
* **Tracked Events:** Ghi nhận hành vi và tương tác ẩn danh.  
* **Satisfaction Survey:** Đánh giá trải nghiệm người dùng cuối.

### **P2 \- Medium (Bổ sung nếu dư nguồn lực)**

* **Text-to-Speech:** Chuyển đổi nội dung thành giọng nói.  
* **Gamification:** Trò chơi hóa hoạt động khám phá.  
* **Route Planning:** Đề xuất hành trình tham quan tối ưu.

### **Future Roadmap (Giai đoạn tiếp theo)**

* **AR Overlay:** Tương tác thực tế ảo tăng cường.  
* **3D Historical Avatar:** Nhân vật lịch sử ảo mô phỏng.  
* **Voice Assistant:** Trợ lý hướng dẫn viên giọng nói AI.  
* **Multi-site Admin:** Quản trị tập trung cho nhiều điểm di sản.

## **6\. USER STORIES**

* **US-01:** Là một khách tham quan, tôi muốn đưa camera điện thoại lên quét một công trình kiến trúc để tôi có thể ngay lập tức biết tên và ý nghĩa cốt lõi của công trình đó mà không cần đi tìm bảng giới thiệu.  
* **US-02:** Là một phụ huynh dẫn theo con nhỏ, tôi muốn nội dung hiển thị dưới dạng một câu chuyện truyền thuyết dễ hiểu để con tôi hứng thú lắng nghe và ghi nhớ sâu hơn.  
* **US-03:** Là một người đam mê lịch sử, tôi muốn nhắn tin hỏi chatbot về các chi tiết hoa văn trên bia tiến sĩ để đào sâu những thắc mắc mang tính cá nhân của mình.  
* **US-04:** Là một khách du lịch nước ngoài, tôi muốn toàn bộ thông tin và câu trả lời của chatbot hiển thị bằng tiếng Anh tự nhiên để tôi không bị hiểu sai lệch về văn hóa bản địa.

## **7\. USER FLOW & EDGE CASES**

### **7.1 Luồng chuẩn (Happy Path)**

1. Khách tham quan quét mã QR tại di tích → Hệ thống mở Web App.  
2. Khách lựa chọn Nhóm Persona & Ngôn ngữ phù hợp.  
3. Giao diện Camera mở ra →Khách bấm chụp ảnh hiện vật/công trình.  
4. Hệ thống chạy AI Vision để nhận diện đối tượng.  
5. **\[Điều kiện: Confidence Score \>= 70%\]** Hệ thống hiển thị tên đối tượng và tự động gọi AI sinh câu chuyện (Story Generation) tương ứng với Persona.  
6. Khách đọc/xem nội dung →Khách có thể nhập câu hỏi sâu hơn (Tùy chọn).  
7. Chatbot AI trả lời dựa trên Knowledge Base → Khách gửi đánh giá phản hồi (Like/Dislike).  
8. Kết thúc phiên (Session Complete) hoặc chuyển sang quét hiện vật mới.

### **7.2 Edge Case 1 – Nhận diện thất bại hoặc Độ tự tin thấp**

* Khi AI nhận diện đối tượng có độ tự tin **Confidence \< 70%** hoặc trả về kết quả không xác định:  
* Giao diện hiển thị một thông báo nhẹ nhàng: *"Hệ thống chưa nhận diện rõ góc chụp này, bạn có thể thử lại hoặc chọn nhanh từ danh sách dưới đây."*  
* Hệ thống tự động kích hoạt màn hình **Chọn thủ công (Manual Selection)** hiển thị danh sách 5 địa điểm hỗ trợ kèm hình ảnh thu nhỏ (Thumbnail).  
* Người dùng click chọn đúng tên địa điểm → Hệ thống tiếp tục chạy luồng sinh nội dung (Story Generation) như bình thường.

### **7.3 Edge Case 2 – Lỗi kết nối mạng hoặc Phản hồi chậm (Timeout)**

* Khi người dùng chụp ảnh hoặc gửi câu hỏi mà gặp lỗi mất mạng (Network Error) hoặc thời gian phản hồi từ API kéo dài **Quá 15 giây**:  
* Hệ thống ngắt tiến trình (Hạn chế treo app) và hiển thị màn hình thông báo lỗi thân thiện: *"Kết nối mạng đang bị gián đoạn. Vui lòng kiểm tra lại đường truyền."*  
* Cung cấp 3 nút tùy chọn cho khách hàng:  
  * **Option A (Retry):** Thử gửi lại yêu cầu (nếu thấy vạch mạng ổn định trở lại).  
  * **Option B (Pre-cached Content):** Xem ngay nội dung tóm tắt cơ bản của 5 địa điểm đã được tải sẵn vào bộ nhớ đệm ứng dụng từ đầu phiên.  
  * **Option C (Manual Offline Mode):** Chuyển sang giao diện đọc văn bản thuần cơ bản không cần AI tương tác.

### **7.4 Edge Case 3 – Khách chụp đối tượng nằm ngoài danh sách hỗ trợ của hệ thống**

* Người dùng cố tình hoặc vô ý chụp một đối tượng không có trong danh mục di tích (ví dụ: chụp một chiếc xe máy ngoài bãi đỗ, chụp cây cối xung quanh) và chọn thủ công cũng không thấy:  
* Hệ thống hiển thị thông báo: *"Địa điểm/Hiện vật này hiện chưa được hỗ trợ trong phiên bản thử nghiệm MVP tại Văn Miếu."*  
* Gợi ý hành động tiếp theo: Hiển thị danh sách/bản đồ chỉ đường tới 5 điểm di tích chính đang được hệ thống hỗ trợ đầy đủ để hướng dẫn khách di chuyển đến đúng vị trí.

## **8\. FUNCTIONAL REQUIREMENTS (YÊU CẦU TÍNH NĂNG)**

* **FR-01 \[Access via QR\]:** Người dùng không cần tải từ App Store/Google Play. Chỉ cần quét mã QR bằng ứng dụng Camera mặc định của điện thoại để truy cập thẳng vào đường dẫn Web App (Responsive Mobile Web).  
* **FR-02 \[Persona Selection\]:** Cung cấp màn hình khởi đầu trực quan bắt buộc người dùng chọn: Ngôn ngữ (VI/EN) và Nhóm Persona (Gen Z Explorer / Family Visitor / International Tourist). Hệ thống phải ghi nhớ lựa chọn này xuyên suốt Session.  
* **FR-03 \[Camera Capture\]:** Tích hợp giao diện camera ngay trong trình duyệt web. Hỗ trợ chụp và tải ảnh lên. Hạn mức file ảnh: Tối đa 5MB. Định dạng file hợp lệ: JPEG, PNG, WebP.  
* **FR-04 \[AI Recognition\]:** Module Vision AI nhận diện hình ảnh đầu vào. Kết quả trả về gồm: Định danh đối tượng (Object ID) và Điểm số tự tin (Confidence Score). Quy định ngưỡng xử lý logic theo điểm số này như mô tả tại Section 7.2.  
* **FR-05 \[AI Story Generation\]:** Sau khi định danh thành công, hệ thống ra lệnh cho LLM sinh đoạn văn bản giới thiệu có độ dài từ 100 \- 150 từ. Nội dung phải tùy biến linh hoạt dựa trên ma trận: \[Đối tượng\] x \[Persona\] x \[Ngôn ngữ\].

* **FR-06 \[Contextual Chat\]:** Cung cấp một khung chat nhỏ ngay bên dưới câu chuyện. Khi người dùng nhập câu hỏi, AI Chatbot phải trả lời dựa trên: Bối cảnh hiện vật, Dữ liệu từ Knowledge Base được cấu trúc sẵn và Đúng văn phong (Tone) của Persona. Nếu câu hỏi lạc đề hoặc nằm ngoài phạm vi Knowledge Base, bắt buộc trả về **Fallback Message Chuẩn**.  
* **FR-07 \[Language Support\]:** Hệ thống dịch thuật và sinh nội dung song song hoàn toàn bằng 2 ngôn ngữ Tiếng Việt và Tiếng Anh.  
* **FR-08 \[Manual Selection\]:** Cung cấp một nút bấm cố định "Chọn bằng tay" hoặc tự động kích hoạt khi nhận diện lỗi, hiển thị lưới danh sách các hạng mục di tích được Ban quản lý hỗ trợ để người dùng chọn trực tiếp.

### **Khối Fallback Message Chuẩn áp dụng cho FR-06:**

**Tiếng Việt:** "Tôi chưa có đủ thông tin xác thực để trả lời chính xác câu hỏi này. Bạn có thể đặt câu hỏi khác liên quan đến lịch sử, kiến trúc hoặc ý nghĩa văn hóa truyền thống của \[Tên địa điểm\] được không?"

**Tiếng Anh:** "I don't have enough verified information to answer this accurately. Feel free to ask another question about the history, architecture, or cultural significance of \[Location Name\]."

## **9\. NON-FUNCTIONAL REQUIREMENTS (YÊU CẦU PHI CHỨC NĂNG)**

### **9.1 Performance (Hiệu năng hệ thống)**

* **Thời gian nhận diện ảnh (Recognition Time):** \< 5 giây kể từ khi người dùng bấm nút chụp ảnh xong.  
* **Thời gian sinh văn bản kể chuyện (Story Generation Time):** \< 8 giây (Áp dụng kỹ thuật Streaming Text \- chữ ra đến đâu hiển thị đến đấy để giảm cảm giác chờ đợi của khách).  
* **Thời gian phản hồi câu hỏi Chatbot:** \< 4 giây cho mỗi câu hỏi kế tiếp.  
* **Hạn mức Timeout hệ thống:** Đặt cứng 15 giây. Sau 15 giây không nhận được phản hồi từ Server, tự động chuyển sang Error State.  
* **Rate Limit bảo vệ tài nguyên:** Cài đặt tối đa 20 API requests tổng cộng trên một người dùng trong một phiên truy cập (Session).

### **9.2 Compatibility (Độ tương thích)**

* Chạy mượt mà trên các hệ điều hành di động phổ biến: Android (từ bản 9.0 trở lên) và iOS (từ bản 14 trở lên).  
* Tương thích tốt với các trình duyệt di động mặc định: Google Chrome, Apple Safari, Samsung Internet.  
* Hệ thống bắt buộc phải hiển thị Pop-up xin quyền truy cập Camera của trình duyệt một cách hợp lệ trước khi sử dụng.

### **9.3 Security & Privacy (An toàn thông tin)**

* **Quy trình xử lý ảnh:** Hệ thống tuyệt đối không lưu trữ vĩnh viễn hình ảnh của người dùng trên máy chủ nhằm bảo vệ quyền riêng tư cá nhân. Ảnh tải lên thư mục tạm (Temp Bucket) phải được cấu trúc lệnh tự động xóa sạch (Auto-delete) trong vòng đúng 60 giây sau khi xử lý nhận diện thành công.  
* Không yêu cầu người dùng đăng nhập tài khoản, không thu thập số điện thoại, email hay bất kỳ thông tin định danh cá nhân (PII) nào trong giai đoạn MVP.

### **9.4 Availability & Cost Control (Độ sẵn sàng & Kiểm soát chi phí)**

* Cam kết đạt mức độ hoạt động ổn định 99% uptime trong suốt tuần chạy thử nghiệm Demo (Week 6).  
* **Quản lý chi phí:** Bắt buộc cấu trúc hạn mức chi tiêu trần (Budget Cap) cho tài khoản API Google Cloud. Thực hiện việc giám sát thủ công thông qua biểu đồ theo dõi chi phí (Cost Dashboard) mỗi ngày một lần vào cuối ngày trong suốt tuần số 5 và số 6\.

## **10\. TECHNICAL STACK (KIẾN TRÚC CÔNG NGHỆ)**

### **10.1 Giao diện người dùng (Frontend)**

* **Framework:** ReactJS phối hợp với công cụ đóng gói Vite hoặc sử dụng Next.js để tối ưu hóa khả năng xây dựng ứng dụng PWA (Progressive Web App) \- giúp giao diện hiển thị mượt mà như app bản xứ trên mobile, dễ dàng ghim ra màn hình chính mà không cần cài đặt qua kho ứng dụng.  
* **Giao tiếp phần cứng:** Sử dụng API mặc định của trình duyệt MediaDevices API để kích hoạt và tương tác trực tiếp với Camera của thiết bị di động.  
* **Giao diện & Style:** Sử dụng Tailwind CSS nhằm đẩy nhanh tốc độ code và đảm bảo giao diện thích ứng hoàn hảo với mọi kích thước màn hình điện thoại (Responsive-first).  
* **Triển khai ứng dụng (Deployment):** Tận dụng các nền tảng đám mây như Vercel hoặc Firebase Hosting nhờ có gói miễn phí (Free Tier) dồi dào, phù hợp cho việc chạy thử nghiệm sản phẩm MVP.

### **10.2 Hệ thống máy chủ (Backend & Storage)**

* **BaaS Engine:** Sử dụng **Supabase Edge Functions** (TypeScript/Deno) thay thế cho mô hình backend truyền thống. Lý do: Giảm thiểu 100% chi phí và thời gian thiết lập hạ tầng (Ops), đồng nhất ngôn ngữ TypeScript giữa Frontend và Backend.
* **Nền tảng lưu trữ (Hosting):** Chạy trực tiếp trên dịch vụ đám mây của Supabase Cloud (Free Tier), co giãn tự động và không cần cấu hình máy chủ.
* **Quản lý tệp tin hình ảnh:** Sử dụng **Supabase Storage** để lưu trữ hình ảnh tạm thời, tích hợp API tự động xóa ảnh khỏi bucket ngay sau khi Gemini hoàn thành nhận dạng đối tượng.

### **10.3 Mô hình Trí tuệ nhân tạo (AI & ML)**

* **Nhận diện hình ảnh (Object Recognition):** Sử dụng trực tiếp bộ giải pháp đa phương thức **Google Gemini Vision API (Mô hình gemini-1.5-flash)**. Lý do lựa chọn: Khả năng nhận diện vật thể thông qua hình ảnh cực kỳ nhạy bén, phản hồi nhanh, không mất tài nguyên và thời gian để xây dựng, dán nhãn dữ liệu và huấn luyện một mô hình học máy riêng biệt ngay trong giai đoạn MVP 6 tuần ngắn ngủi.  
* **Kể chuyện và Hệ thống Hỏi đáp (Story & Q\&A):** Tiếp tục ứng dụng mô hình ngôn ngữ lớn **Google Gemini Pro / gemini-1.5-flash**. Lý do: Có cửa sổ ngữ cảnh (Context Window) rộng lớn, khả năng thấu hiểu cấu trúc ngữ pháp và ngữ cảnh văn hóa lịch sử bằng Tiếng Việt rất tự nhiên, chi phí trên mỗi chuỗi ký tự (Token) rất rẻ.

### **10.4 Cơ sở dữ liệu & Tri thức (Database & Knowledge Base)**

* **Dữ liệu tri thức (Knowledge Base):** Lưu trữ dưới dạng các tệp cấu trúc JSON tĩnh trực tiếp trên Frontend để truy vấn tức thì không độ trễ, phục vụ cho Prompt RAG trên Edge Functions.
* **Cơ sở dữ liệu lưu log (Analytics Database):** Sử dụng bảng cơ sở dữ liệu **PostgreSQL** trên Supabase để lưu trữ 12 sự kiện hành vi người dùng ẩn danh phục vụ phân tích sản phẩm.

### **10.5 Sơ đồ kiến trúc tổng quan (Architecture Overview)**

[Thiết bị di động của Khách tham quan]  
                 ↓ Kết nối bảo mật HTTPS  
    [Giao diện Frontend: React PWA]  
                 ↓ Giao tiếp qua REST API / Supabase Client SDK  
[Hệ thống Backend: Supabase Edge Functions]  
         ↙                                            ↘  
[Google Gemini API]            [Cơ sở dữ liệu tri thức (Local JSON)]  
(Xử lý Vision & LLM)                              ↓  
                                       [Supabase Postgres Logs]

## **11\. DETAILED AI & DATA REQUIREMENTS**

### **11.1 Ma trận Đầu vào/Đầu ra (AI Use Cases)**

| Tên Use Case | Dữ liệu đầu vào (Input) | Dữ liệu đầu ra mong muốn (Output) |
| :---- | :---- | :---- |
| **Nhận diện kiến trúc di tích** | Hình ảnh chụp công trình từ Camera | Tên chính xác của công trình, Điểm số tự tin (0 \- 100%) |
| **Nhận diện cổ vật trưng bày** | Hình ảnh chụp hiện vật cận cảnh | Tên chính xác của cổ vật, Điểm số tự tin (0 \- 100%) |
| **Sinh câu chuyện cá nhân hóa** | Tên vật thể \+ Hồ sơ Persona \+ Ngôn ngữ cấu hình \+ Tri thức nền | Đoạn văn bản kể chuyện sáng tạo có độ dài chuẩn từ 100 \- 150 từ. |
| **Hỏi đáp chuyên sâu theo ngữ cảnh** | Câu hỏi của khách \+ Tên vật thể \+ Lịch sử cuộc trò chuyện \+ Văn bản tri thức nền | Câu trả lời chính xác, ngắn gọn dưới 100 từ, hành văn đúng với nhóm tuổi người dùng. |

### 

### **11.2 Logic xử lý ngưỡng tự tin (Confidence Threshold Logic)**

Hệ thống Backend sau khi nhận kết quả phân tích hình ảnh từ Gemini Vision API sẽ thực hiện phân tách luồng xử lý theo quy định nghiêm ngặt sau:

* **Ngưỡng 1: Điểm số \>= 70%:** Hệ thống xác định kết quả hoàn toàn chính xác. Lập tức điều hướng ứng dụng chạy thẳng vào Luồng sinh câu chuyện tự động (Proceed to Story Generation).  
* **Ngưỡng 2: Điểm số từ 50% \- 69%:** Hệ thống nhận diện có sự mơ hồ. Giao diện sẽ hiển thị kết quả phỏng đoán kèm theo dòng lưu ý nhỏ: *"Hệ thống đoán đây là \[Tên địa điểm\], có đúng không? Bạn có thể xác nhận hoặc chọn lại địa điểm chính xác từ danh sách nhé."*

* **Ngưỡng 3: Điểm số \< 50%:** Hệ thống xác định không thể nhận diện được hình ảnh. Lập tức kích hoạt ngầm tính năng Chọn thủ công (Manual Selection) và hiển thị bảng danh sách các điểm di tích cho người dùng tự bấm chọn, tuyệt đối không hiển thị kết quả phỏng đoán sai của AI lên màn hình để tránh làm giảm trải nghiệm người dùng.

### **11.3 Chiến lược chống ảo giác thông tin (Hallucination Mitigation)**

Để đảm bảo các kiến thức lịch sử, thông tin văn hóa truyền thống được truyền tải một cách chính xác, trang trọng và không bị AI tự bịa đặt, hệ thống áp dụng triệt để 4 quy tắc kỹ thuật sau:

1. **Kiến trúc RAG (Retrieval-Augmented Generation):** Khi người dùng đặt câu hỏi, hệ thống sẽ thực hiện truy vấn và bốc tách các đoạn văn bản chứa thông tin cốt lõi từ Cơ sở dữ liệu tri thức (Knowledge Base) đã được kiểm duyệt trước. Đóng gói đoạn thông tin này làm "nguyên liệu độc nhất" và gửi kèm vào Prompt chỉ định cho mô hình LLM.  
2. **Kỹ thuật Context Grounding:** Trong cấu trúc Prompt gửi tới Gemini API, nhóm luôn chèn một câu lệnh điều khiển tối cao: *"Bạn chỉ được phép sử dụng thông tin nằm trong khối dữ liệu được cung cấp dưới đây để biên soạn câu trả lời. Tuyệt đối không được sử dụng bất kỳ kiến thức bên ngoài nào khác nằm ngoài tài liệu này để suy diễn."*  
3. **Sử dụng Fallback Message cứng:** Cài đặt logic: Nếu hệ thống đối chiếu từ khóa câu hỏi của người dùng với Cơ sở dữ liệu tri thức mà không tìm thấy dữ liệu liên quan phù hợp → Không gửi câu hỏi sang cho AI xử lý mà gọi thẳng dòng thông báo lỗi chuẩn đã chuẩn bị sẵn ở mục Section 8\.  
4. **Kiểm duyệt con người (Human-in-the-loop):** Toàn bộ các thông tin lưu trữ trong tệp JSON cấu trúc của Cơ sở dữ liệu tri thức phải được toàn bộ thành viên trong nhóm và đại diện có chuyên môn rà soát, đối chiếu với sách lịch sử chính thống trước khi chính thức đưa vào hệ thống chạy bản thử nghiệm Week 6\.

## 

## 

## **12\. DATA REQUIREMENTS & LEGAL (YÊU CẦU DỮ LIỆU & PHÁP LÝ)**

### **12.1 Kế hoạch thu thập dữ liệu hình ảnh (Dataset Requirements)**

Để đảm bảo thuật toán Vision AI nhận diện chính xác các địa điểm chính tại di tích Văn Miếu dưới nhiều điều kiện ngoại cảnh phức tạp, nhóm đặt ra chỉ tiêu thu thập kho dữ liệu ảnh mồi như sau:

| Tên Hạng mục di tích cụ thể | Số lượng ảnh tối thiểu | Tiêu chuẩn kỹ thuật yêu cầu |
| :---- | :---- | :---- |
| **Khuê Văn Các** | 120 tấm ảnh | Chụp từ nhiều góc (Chính diện, góc nghiêng 45 độ, chụp từ xa qua hồ Thiên Quang). Đa dạng thời gian (Sáng sớm, trưa nắng gắt, chiều tối, ngày trời âm u). |
| **Bia Tiến Sĩ (Khu nhà bia)** | 150 tấm ảnh | Thu thập ảnh chụp toàn cảnh dãy nhà bia, ảnh chụp tầm trung góc nghiêng và các bức ảnh chụp cận cảnh (Close-up) chi tiết cụ thể hoa văn rùa đá và chữ khắc trên bia. |
| **Đại Thành Môn** | 100 tấm ảnh | Chụp góc toàn cảnh, chi tiết kiến trúc mái ngói, góc nghiêng cửa gỗ ra vào, ảnh có sự xuất hiện của dòng người qua lại để kiểm tra độ nhiễu. |
| **Nhà Thái Học** | 120 tấm ảnh | Thu thập toàn bộ hình ảnh không gian ngoại thất sân nhà Thái Học và các góc chụp chi tiết cấu trúc đồ gỗ nội thất trưng bày bên trong. |
| **Hồ Văn (Khu vực hồ đối diện)** | 100 tấm ảnh | Ảnh chụp toàn cảnh từ bờ hồ, hướng chụp ra gò Kim Châu giữa hồ dưới các điều kiện thời tiết khác nhau. |
| **TỔNG CỘNG TOÀN BỘ SỐ ẢNH** | **\~590 \- 600 tấm ảnh** | Kho ảnh này dùng làm dữ liệu tham chiếu (Reference Set) để kiểm thử thuật toán Vision. |

### 

### 

### **12.2 Nguồn dữ liệu & Các ràng buộc Pháp lý (Data Source & Legal)**

| Nguồn cung cấp dữ liệu | Loại hình dữ liệu thu thập | Yêu cầu và Giải pháp tuân thủ Pháp lý |
| :---- | :---- | :---- |
| **Nhóm tự chụp tại di tích** | Hình ảnh phục vụ nhận diện | Tuân thủ quy định tham quan. Trong trường hợp cần thực hiện chụp ảnh số lượng lớn bằng thiết bị chuyên dụng (Tripod, máy cơ) phục vụ chạy mô hình thử nghiệm, nhóm cần chủ động nộp đơn xin phép ngắn hạn với Ban quản lý di tích Văn Miếu trước ngày triển khai Tuần 2\. |
| **Nền tảng Wikimedia Commons** | Hình ảnh bổ trợ góc chụp khó | Lọc và chỉ chọn các tệp ảnh có gắn nhãn giấy phép mã nguồn mở Creative Commons (CC BY, CC0). Thực hiện đầy đủ nghĩa vụ ghi nhận nguồn tác giả (Attribution) tại mục thông tin ứng dụng. |
| **Wikipedia / Cổng thông tin Di sản** | Dữ liệu chữ (Text) làm tri thức | Chỉ sử dụng làm tài liệu tham khảo thô. Nhóm bắt buộc phải thực hiện viết lại (Paraphrase) và hệ thống hóa lại nội dung, tuyệt đối không sao chép nguyên văn bản (Copy-paste) để tránh vi phạm bản quyền nội dung. |
| **Tài liệu từ Ban quản lý di tích** | Nội dung biên niên sử chính thức | Đây là nguồn dữ liệu có giá trị cao nhất. Nhóm cần liên hệ, đặt vấn đề khoa học để xin tài liệu sách hướng dẫn chính thức. Trường hợp dự án phát triển thương mại sau MVP, bắt buộc phải thực hiện ký kết Biên bản hợp tác sử dụng tài sản trí tuệ (MOU) một cách hợp pháp. |

⚠️ **HÀNH ĐỘNG KHẨN CẤP TRONG TUẦN 2:** Toàn bộ thành viên nhóm có nghĩa vụ liên hệ với văn phòng Ban quản lý di tích Văn Miếu – Quốc Tử Giám để tiến hành ba việc: (1) Xin văn bản đồng ý cho phép chụp ảnh nghiên cứu khoa học, (2) Đề xuất xin tài liệu thuyết minh chính thống, (3) Thảo luận mở về khả năng chạy thử nghiệm thực tế với khách tham quan tại Tuần 6\.

## **13\. ANALYTICS & PRIVACY (PHÂN TÍCH HÀNH VI)**

### **13.1 Các sự kiện cần theo dõi (Tracked Events)**

Để đo lường hiệu quả hoạt động và cải tiến chất lượng thuật toán AI, hệ thống backend và frontend phối hợp tự động ghi nhận các sự kiện ẩn danh sau:

* persona\_selected: Kích hoạt ngay khi người dùng chọn xong nhóm Persona và Ngôn ngữ.  
* camera\_opened: Ghi nhận khi người dùng cấp quyền và màn hình camera bật lên thành công.  
* scan\_started: Ghi nhận khi người dùng bấm nút chụp hình ảnh.  
* scan\_completed: Hình ảnh đã truyền tải thành công lên máy chủ xử lý.  
* recognition\_success: AI trả về kết quả định danh chính xác với điểm số $\\ge 70\\%$.  
* recognition\_failed: AI trả về kết quả nhận diện thất bại hoặc điểm số $\< 70\\%$.  
* manual\_selection\_used: Người dùng chủ động hoặc bị động bấm chọn địa điểm bằng tay từ danh sách.  
* story\_viewed: Nội dung văn bản câu chuyện AI sinh ra đã hiển thị trọn vẹn trên màn hình khách.  
* question\_sent: Người dùng bấm nút gửi một nội dung câu hỏi tin nhắn vào ô chat.  
* response\_generated: AI hoàn thành việc sinh câu trả lời và hiển thị lên màn hình chat cho khách.  
* fallback\_triggered: Hệ thống kích hoạt dòng thông báo lỗi chuẩn do câu hỏi nằm ngoài phạm vi tri thức.  
* feedback\_submitted: Người dùng thực hiện tương tác bấm nút Thích (Like) hoặc Không thích (Dislike) đối với câu trả lời của AI.  
* session\_completed: Khách đóng trình duyệt hoặc không phát sinh tương tác mới sau thời gian 15 phút.

### **13.2 Chính sách bảo mật quyền riêng tư (Privacy Policy)**

* Hệ thống phân tích hành vi chỉ thực hiện thu thập dữ liệu số lượng tương tác thuần túy, tuyệt đối không thu thập dữ liệu định danh cá nhân (PII), không lưu trữ tệp ảnh gốc của khách, không lưu trữ lịch sử câu hỏi gắn liền với danh tính cụ thể sau khi phiên làm việc kết thúc.  
* Ở màn hình khởi động đầu tiên, hệ thống bắt buộc hiển thị một dòng thông báo ngắn (Cookies/Privacy Notice) xin phép người dùng thu thập dữ liệu hành vi ẩn danh phục vụ mục đích nghiên cứu nâng cao chất lượng sản phẩm và chỉ tiến hành theo dõi khi người dùng bấm nút "Đồng ý và Tiếp tục".  
  


## **14\. SUCCESS METRICS (TIÊU CHÍ ĐO LƯỜNG THÀNH CÔNG)**

### **14.1 Chỉ số cốt lõi (North Star Metric)**

**Average Meaningful Interactions Per Visitor (Số lượng tương tác có giá trị trung bình trên một khách tham quan)**

* *Công thức tính:*  
  Chỉ số \= (Tổng số Câu chuyện đã xem \+ Tổng số Câu hỏi đã đặt \+ Tổng số lượt Nhận          diện thành công) **/** (Tổng số lượng Khách truy cập vào Web App)

### **14.2 Các chỉ số hỗ trợ đo lường (Supporting Metrics)**

| Tên Chỉ số Đo lường | Mục tiêu cụ thể cần đạt cho bản MVP |
| :---- | :---- |
| **Độ chính xác nhận diện (Recognition Accuracy)** | Đạt tỷ lệ \>= 85% số lượng ảnh chụp thực tế tại hiện trường được AI nhận diện đúng tên di tích. |
| **Tỷ lệ đặt câu hỏi (Question Rate)** | Đạt tỷ lệ \>= 40% trên tổng số khách truy cập thực hiện đặt ít nhất 1 câu hỏi cho Chatbot AI. |
| **Số lượng câu hỏi trung bình (Avg Questions/Session)** | Khách hàng phát sinh trung bình \>= 2 câu hỏi thảo luận trong một phiên trò chuyện. |
| **Thời gian sử dụng trung bình (Session Duration)** | Thời gian trải nghiệm, tương tác liên tục trên ứng dụng của một khách đạt \>= 3 phút. |
| **Độ hài lòng của người dùng (User Satisfaction)** | Đạt điểm số đánh giá trung bình \>= 4/5 sao thông qua khảo sát nhanh tại Tuần 6\. |
| **Tỷ lệ phải chọn thủ công (Manual Selection Rate)** | Giữ ở mức thấp \<= 20% tổng số lượt tương tác (Đây là chỉ số dùng để kiểm định chất lượng camera và thuật toán). |
| **Tỷ lệ kích hoạt lỗi (Fallback Trigger Rate)** | Giữ ở mức thấp \<= 15 tổng số câu hỏi (Chỉ số đo lường độ phủ và chất lượng của Cơ sơ dữ liệu tri thức). |

## 

## **15\. MVP IMPLEMENTATION DETAILS** 

### **15.1 Chi tiết triển khai**

* **Vị trí triển khai thực địa (Pilot Location):** Khu di tích văn hóa lịch sử Văn Miếu – Quốc Tử Giám, Hà Nội.  
* **Danh sách 5 địa điểm/vật thể hỗ trợ:** Khuê Văn Các, Bia Tiến Sĩ, Đại Thành Môn, Nhà Thái Học, Hồ Văn.  
* **Ngôn ngữ ứng dụng cấu hình:** Tiếng Việt (Vietnamese) và Tiếng Anh (English).  
* **Quy mô kho dữ liệu mồi:** Thu thập khoảng 600 hình ảnh thực tế đa góc cạnh phục vụ việc đối chiếu kết quả.  
* **Kế hoạch kiểm thử thực tế (User Testing):** Tiến hành mời ngẫu nhiên từ 20 – 30 khách tham quan thực tế tại Văn Miếu (bao gồm cả khách trẻ tuổi Việt Nam và khách nước ngoài) trực tiếp cầm thiết bị trải nghiệm sản phẩm dưới sự giám sát của nhóm vào giai đoạn Tuần 6\.

### **15.2 Tiêu chí đánh giá thành công MVP**

Phiên bản thử nghiệm (MVP) được ghi nhận là thành công khi thỏa mãn các nhóm tiêu chí định lượng sau đây:

### **a. Các chỉ số kỹ thuật**

* **Recognition Accuracy:** Hiệu suất nhận diện vật thể đạt tỷ lệ trên 85%.  
* **Content Generation Rate:** Khả năng sinh câu chuyện tự động đạt độ ổn định \>= 95%.  
* **Chatbot Success Rate:** Phản hồi tương tác hỏi đáp đạt tỷ lệ thành công tối thiểu 90%.

### **b. Trải nghiệm người dùng cuối**

* **User Participation:** Huy động ít nhất 20 khách tham gia Pilot tại thực địa.  
* **Question Rate:** Tỷ lệ người dùng đặt câu hỏi cho AI đạt ngưỡng 40% trở lên.  
* **Session Duration:** Thời gian sử dụng trung bình ghi nhận đạt từ 3 phút trở lên.  
* **Satisfaction Score:** Điểm đánh giá trải nghiệm đạt từ 4/5 sao trở lên.

### **b. Giá trị cốt lõi của giải pháp**

Tối thiểu 70% đối tượng thử nghiệm xác nhận đồng ý với khảo sát:

*"Nền tảng AI giúp việc thấu hiểu kiến trúc và di vật sâu sắc hơn hẳn phương thức tiếp cận bảng tin truyền thống."*

Đây là thước đo then chốt nhằm khẳng định giá trị thực tiễn mà sản phẩm mang lại cho cộng đồng du lịch.

## **16\. PRODUCT ROADMAP (LỘ TRÌNH PHÁT TRIỂN)**

* **Giai đoạn 1 (MVP \- Hiện tại):** Tập trung xây dựng, tối ưu lõi công nghệ AI Nhận diện và Kể chuyện tại 1 địa điểm duy nhất là Văn Miếu – Quốc Tử Giám trong thời gian 6 tuần.  
* **Giai đoạn 2 (Mở rộng ngắn hạn):** Nâng cấp hệ thống, tối ưu thuật toán và mở rộng tích hợp cơ sở dữ liệu sang các điểm di tích lớn lân cận tại Hà Nội như: Hoàng Thành Thăng Long, Di tích Nhà tù Hỏa Lò, Bảo tàng Dân tộc học Việt Nam.  
* **Giai đoạn 3 (Thương mại hóa dài hạn):** Phát triển nền tảng thành một giải pháp SaaS chuyển đổi số du lịch toàn quốc. Cho phép bất kỳ Ban quản lý bảo tàng, công viên di sản hay điểm du lịch nào trên cả nước cũng có thể tự đăng ký tài khoản, tự tải lên hình ảnh và tự xây dựng Cơ sở dữ liệu tri thức riêng cho địa điểm của mình.

## **17\. RELEASE PLAN & SPRINT GOALS (KẾ HOẠCH TRIỂN KHAI 6 TUẦN)**

* **Tuần 1 \[Research & Planning\]:** Nghiên cứu sâu hành vi người dùng, hoàn thiện tài liệu PRD bản 1.0. Thực hiện thiết kế cấu trúc giao diện Wireframe trên công cụ Figma. Tiến hành viết đơn và liên hệ thiết lập mối quan hệ với Ban quản lý Văn Miếu.  
* **Tuần 2 \[Foundation Setup\]:** Xây dựng bộ khung mã nguồn Frontend (React PWA) và hệ thống Backend Supabase (Edge Functions, database logs, temp storage). Hoàn thiện bản thiết kế mẫu thử nghiệm tương tác Clickable Prototype trên Figma để kiểm thử luồng di chuyển của người dùng.  
* **Tuần 3 \[AI Core Integration\]:** Tích hợp thành công cấu trúc lệnh gọi API Vision của Gemini để hoàn thiện bản mẫu nhận diện vật thể. Hoàn thành việc biên soạn và đóng gói Cơ sở dữ liệu tri thức phiên bản v1 cho 5 địa điểm bằng cả 2 ngôn ngữ.  
* **Tuần 4 \[Features Engineering\]:** Lập trình hoàn thiện Công cụ điều phối sinh câu chuyện (Storytelling Engine), tích hợp khung cửa sổ nhắn tin Chatbot. Phát triển hoàn thành tính năng chọn thủ công (Manual Selection) và các màn hình Edge Cases.  
* **Tuần 5 \[QA & Optimization\]:** Tiến hành rà soát sửa lỗi toàn diện (Bug Fixes). Thực hiện tối ưu hóa tốc độ tải trang, nén dung lượng hệ thống đảm bảo đạt toàn bộ các chỉ tiêu phi chức năng (NFR). Đội ngũ nội bộ tiến hành tự thử nghiệm thực địa.  
* **Tuần 6 \[Launch & Presentation\]:** Tổ chức hoạt động User Testing trực tiếp mời khách tham quan trải nghiệm tại Văn Miếu thu thập số liệu. Tổng hợp dữ liệu thành công, chuẩn bị kịch bản Demo và tham gia ngày hội báo cáo hoàn thành dự án (Demo Day).

