# Phân Tích Công Nghệ Xử Lý Ảnh – AI Heritage Guide

> Đánh giá các công nghệ của **Google** và **Meta** phù hợp cho dự án nhận diện di tích Văn Miếu – Quốc Tử Giám  
> Ràng buộc: **6 tuần** · **3 người** · **MVP** · **5 địa điểm**

---

## Tiêu Chí Đánh Giá

| # | Tiêu chí | Mô tả |
|---|----------|-------|
| 1 | **Độ phù hợp với bài toán** | Khả năng nhận diện landmark/artifact cụ thể tại Văn Miếu |
| 2 | **Thời gian tích hợp** | Effort cần thiết để tích hợp vào hệ thống (với 3 dev, 6 tuần) |
| 3 | **Chi phí vận hành** | Chi phí API/hosting cho giai đoạn MVP |
| 4 | **Hỗ trợ tiếng Việt** | Khả năng hiểu context văn hóa Việt Nam |
| 5 | **Khả năng mở rộng** | Dễ thêm địa điểm mới sau MVP |
| 6 | **Độ chính xác** | Accuracy kỳ vọng cho 5 landmarks (≥85% target) |
| 7 | **Yêu cầu hạ tầng** | GPU, server, bandwidth cần thiết |

> Thang điểm: ⭐⭐⭐⭐⭐ (Xuất sắc) → ⭐ (Không phù hợp)

---

## 🔵 Công Nghệ của GOOGLE

### 1. Google Gemini Vision API (gemini-2.5-flash / gemini-2.5-pro)

| Tiêu chí | Đánh giá | Chi tiết |
|----------|----------|---------|
| Độ phù hợp | ⭐⭐⭐⭐⭐ | Multimodal natively – nhận diện landmark bằng "reasoning" thay vì classification thuần. Có thể nhận diện Khuê Văn Các, Bia Tiến Sĩ... từ mọi góc chụp mà **không cần training dataset**. |
| Thời gian tích hợp | ⭐⭐⭐⭐⭐ | Cực nhanh – chỉ cần 1 API call duy nhất: gửi ảnh + prompt → nhận tên + confidence + mô tả. Có thể tích hợp trong **1-2 ngày**. |
| Chi phí | ⭐⭐⭐⭐ | Flash: ~$0.30/1M input tokens. Ảnh ~258 tokens → ~$0.000077/ảnh. Free tier 15 RPM. Cho MVP ~1000 lượt quét ≈ **< $1**. |
| Hỗ trợ tiếng Việt | ⭐⭐⭐⭐⭐ | Gemini hiểu tiếng Việt rất tốt, có khả năng giải thích context văn hóa Nho giáo, triều đại Lê-Trần. |
| Khả năng mở rộng | ⭐⭐⭐⭐⭐ | Thêm địa điểm mới = cập nhật prompt + knowledge base. Không cần retrain model. |
| Độ chính xác | ⭐⭐⭐⭐ | Rất cao cho landmarks nổi tiếng. Cần prompt engineering tốt cho artifacts nhỏ. Kết hợp với knowledge base cho confidence score. |
| Yêu cầu hạ tầng | ⭐⭐⭐⭐⭐ | Hoàn toàn cloud API. Chỉ cần backend gọi REST API, không cần GPU. |

> [!TIP]
> **Ưu điểm vượt trội**: Gemini Vision đồng thời làm được cả 3 việc trong PRD: **nhận diện** (FR-04) + **sinh câu chuyện** (FR-05) + **chatbot** (FR-06) chỉ với 1 API duy nhất. Tiết kiệm tối đa effort tích hợp cho team 3 người.

> [!IMPORTANT]
> **Lưu ý**: Gemini không trả về "confidence score" dạng số mặc định. Cần thiết kế prompt yêu cầu model trả về structured JSON bao gồm `{"name": "...", "confidence": 85, "description": "..."}`.

---

### 2. Google Cloud Vision API (Legacy)

| Tiêu chí | Đánh giá | Chi tiết |
|----------|----------|---------|
| Độ phù hợp | ⭐⭐⭐ | Có tính năng **Landmark Detection** chuyên biệt. Tuy nhiên chủ yếu nhận diện landmarks quốc tế nổi tiếng. Khả năng nhận diện chi tiết di tích Việt Nam (Bia Tiến Sĩ, Nhà Thái Học) **rất hạn chế**. |
| Thời gian tích hợp | ⭐⭐⭐⭐ | API đơn giản, tích hợp nhanh trong 1-2 ngày. Nhưng cần thêm logic bổ sung cho các landmark không được recognize. |
| Chi phí | ⭐⭐⭐⭐ | ~$1.50/1000 ảnh cho Landmark Detection. Free 1000 units/tháng. |
| Hỗ trợ tiếng Việt | ⭐⭐ | Trả kết quả bằng tiếng Anh. Tên landmark tiếng Việt có thể bị romanize sai hoặc thiếu. |
| Khả năng mở rộng | ⭐⭐ | Bị giới hạn bởi database landmarks sẵn có của Google. Không thể thêm custom landmarks. |
| Độ chính xác | ⭐⭐ | Có thể nhận diện "Văn Miếu" tổng thể nhưng khó phân biệt được 5 địa điểm cụ thể bên trong quần thể. |
| Yêu cầu hạ tầng | ⭐⭐⭐⭐⭐ | Cloud API thuần, không cần GPU. |

> [!WARNING]
> **Không khuyến nghị dùng độc lập** cho dự án này vì database landmark của Google chủ yếu tập trung vào các địa điểm du lịch quốc tế lớn. Khả năng phân biệt 5 công trình cụ thể bên trong Văn Miếu rất thấp.

---

### 3. Google MediaPipe (On-device ML)

| Tiêu chí | Đánh giá | Chi tiết |
|----------|----------|---------|
| Độ phù hợp | ⭐⭐⭐ | Framework ML on-device mạnh mẽ. Hỗ trợ Image Classification có thể custom với **Model Maker**. Phù hợp nếu muốn chạy offline. |
| Thời gian tích hợp | ⭐⭐ | Cần: (1) Thu thập 600 ảnh, (2) Label, (3) Train custom model với Model Maker, (4) Export TFLite, (5) Tích hợp vào web. **Ước tính: 2-3 tuần** – chiếm gần nửa timeline. |
| Chi phí | ⭐⭐⭐⭐⭐ | $0 chi phí API – chạy hoàn toàn trên thiết bị người dùng. |
| Hỗ trợ tiếng Việt | ⭐ | Chỉ là classifier – trả về label. Không hiểu ngữ nghĩa tiếng Việt. Cần kết hợp riêng với LLM cho storytelling. |
| Khả năng mở rộng | ⭐⭐ | Thêm địa điểm = thu thập ảnh mới + retrain model + redeploy. Tốn effort đáng kể. |
| Độ chính xác | ⭐⭐⭐ | Phụ thuộc hoàn toàn vào chất lượng và số lượng training data. 120 ảnh/class là tối thiểu. |
| Yêu cầu hạ tầng | ⭐⭐⭐⭐ | On-device, nhưng cần GPU/Colab để train model. Web deployment qua WASM có thể gặp vấn đề performance. |

> [!NOTE]
> **Kịch bản sử dụng**: MediaPipe phù hợp hơn cho giai đoạn 2-3 khi muốn tối ưu chi phí API ở quy mô lớn hoặc cần hoạt động offline. **Không phù hợp cho MVP 6 tuần** do overhead training quá lớn.

---

### 4. Google Vertex AI AutoML Vision

| Tiêu chí | Đánh giá | Chi tiết |
|----------|----------|---------|
| Độ phù hợp | ⭐⭐⭐⭐ | Nền tảng train custom image classifier không cần code ML. Upload ảnh + label → train → deploy endpoint. |
| Thời gian tích hợp | ⭐⭐⭐ | Upload ảnh + label: 2-3 ngày. Train: vài giờ. Deploy: tự động. Tổng: **~1 tuần**. |
| Chi phí | ⭐⭐ | Training: ~$3.15/node hour. Prediction: ~$0.0567/node hour. Hosting endpoint 24/7 cho MVP ≈ **$40-80/tuần**. Đắt cho MVP. |
| Hỗ trợ tiếng Việt | ⭐⭐ | Chỉ classification – trả về label. Không có khả năng ngôn ngữ. |
| Khả năng mở rộng | ⭐⭐⭐ | Thêm class = thêm ảnh + retrain. Quy trình tương đối nhanh nhờ AutoML. |
| Độ chính xác | ⭐⭐⭐⭐ | AutoML thường cho accuracy cao (>90%) với dataset ≥100 ảnh/class được label tốt. |
| Yêu cầu hạ tầng | ⭐⭐⭐ | Google Cloud quản lý hoàn toàn. Nhưng cần duy trì prediction endpoint. |

> [!WARNING]
> **Vấn đề chi phí**: Chi phí hosting endpoint liên tục là rào cản lớn cho MVP. Phù hợp hơn nếu có budget doanh nghiệp.

---

## 🟣 Công Nghệ của META

### 5. Meta Llama 4 Vision (Scout / Maverick)

| Tiêu chí | Đánh giá | Chi tiết |
|----------|----------|---------|
| Độ phù hợp | ⭐⭐⭐⭐ | Multimodal LLM tương tự Gemini – có thể nhận diện landmark từ ảnh + sinh text mô tả. Open-weight cho phép self-host. |
| Thời gian tích hợp | ⭐⭐⭐ | API qua Together AI/Fireworks: 1-2 ngày. Self-host: 1-2 tuần setup (cần DevOps kinh nghiệm). |
| Chi phí | ⭐⭐⭐⭐ | API: Scout ~$0.18/1M input tokens, Maverick ~$0.22/1M. Rẻ hơn Gemini Pro nhưng đắt hơn Gemini Flash. Self-host chỉ hiệu quả khi volume lớn (>$5000/tháng). |
| Hỗ trợ tiếng Việt | ⭐⭐⭐ | Llama 4 hỗ trợ tiếng Việt nhưng **yếu hơn Gemini** về ngữ cảnh văn hóa Việt Nam. Training data tiếng Việt ít hơn. |
| Khả năng mở rộng | ⭐⭐⭐⭐ | Tương tự Gemini – update prompt + knowledge base. Lợi thế: có thể fine-tune nếu cần. |
| Độ chính xác | ⭐⭐⭐ | Tốt cho landmarks quốc tế. Chưa được benchmark kỹ cho di tích Việt Nam. Cần testing thực tế. |
| Yêu cầu hạ tầng | ⭐⭐⭐ | API: không cần GPU. Self-host: cần GPU H100 (rất đắt cho MVP). |

> [!NOTE]
> **Lợi thế chính**: Open-weight → có thể fine-tune nếu Gemini không đạt accuracy yêu cầu. Nhưng fine-tune cần GPU + thời gian vượt quá 6 tuần MVP.

---

### 6. Meta DINOv2 (Self-supervised Vision Backbone)

| Tiêu chí | Đánh giá | Chi tiết |
|----------|----------|---------|
| Độ phù hợp | ⭐⭐⭐ | Vision backbone cực mạnh cho feature extraction. Trích xuất visual embedding chất lượng cao → dùng cho image similarity/classification. |
| Thời gian tích hợp | ⭐⭐ | Cần: (1) Extract features cho 600 ảnh reference, (2) Build classifier head hoặc similarity search, (3) Deploy inference pipeline. **Ước tính: 1.5-2 tuần.** |
| Chi phí | ⭐⭐⭐⭐⭐ | Hoàn toàn miễn phí (open-source). Chi phí chỉ là GPU để chạy inference. |
| Hỗ trợ tiếng Việt | ⭐ | Thuần vision model – không có khả năng ngôn ngữ. Cần kết hợp LLM riêng. |
| Khả năng mở rộng | ⭐⭐⭐ | Thêm landmark = thêm reference images + extract embeddings. Không cần retrain backbone. |
| Độ chính xác | ⭐⭐⭐⭐ | DINOv2 cho features rất tốt. Với 120+ ảnh/class, accuracy kỳ vọng >90% cho 5 classes. |
| Yêu cầu hạ tầng | ⭐⭐ | Cần GPU server cho inference (ViT-Large ~300M params). Không chạy được on-device mobile. |

> [!IMPORTANT]
> **Kịch bản phối hợp hay**: DINOv2 extract features → FAISS similarity search → xác định landmark → Gemini/Llama sinh câu chuyện. Cho accuracy cao hơn nhưng **tăng complexity đáng kể** – không phù hợp timeline 6 tuần.

---

### 7. Meta SAM 2 (Segment Anything Model 2)

| Tiêu chí | Đánh giá | Chi tiết |
|----------|----------|---------|
| Độ phù hợp | ⭐⭐ | SAM 2 chuyên về **segmentation** (phân vùng pixel), không phải **recognition** (nhận diện). Có thể segment ra phần công trình khỏi background nhưng không biết tên là gì. |
| Thời gian tích hợp | ⭐⭐ | Cần setup inference server + tích hợp vào pipeline. ~1 tuần nhưng không giải quyết bài toán chính. |
| Chi phí | ⭐⭐⭐⭐⭐ | Open-source, miễn phí. |
| Hỗ trợ tiếng Việt | N/A | Không liên quan – model thuần vision. |
| Khả năng mở rộng | ⭐⭐⭐⭐ | Zero-shot segmentation – hoạt động trên mọi đối tượng mới. |
| Độ chính xác | ⭐⭐⭐⭐⭐ | State-of-the-art segmentation. Nhưng segmentation ≠ recognition. |
| Yêu cầu hạ tầng | ⭐⭐ | Cần GPU server. Model ~300MB. |

> [!WARNING]
> **Không phù hợp cho bài toán này.** SAM 2 giải quyết câu hỏi "ĐÂU là đối tượng trong ảnh?" chứ không phải "ĐÂY là đối tượng GÌ?". Chỉ hữu ích nếu muốn crop ảnh trước khi gửi đến recognition model – nhưng thêm complexity không cần thiết cho MVP.

---

## 📊 Bảng So Sánh Tổng Hợp

| Công nghệ | Phù hợp bài toán | Tốc độ tích hợp | Chi phí MVP | Tiếng Việt | Accuracy | **Điểm tổng** |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| 🥇 **Gemini Vision API** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **28/35** |
| 🥈 **Llama 4 Vision** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **21/35** |
| 🥉 **Vertex AI AutoML** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | **19/35** |
| 4. **DINOv2** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ | **19/35** |
| 5. **Cloud Vision API** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | **19/35** |
| 6. **MediaPipe** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ | **18/35** |
| 7. **SAM 2** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | N/A | ⭐⭐⭐⭐⭐ | **Không phù hợp** |

---

## 🏆 Đề Xuất Kiến Trúc Tối Ưu

### Phương án A – **Khuyến nghị cho MVP 6 tuần** ✅

```
┌─────────────────────────────────────────────────┐
│              GEMINI VISION API                   │
│         (gemini-2.5-flash / 2.5-pro)             │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Recognition│  │Storytelling│  │  Chatbot Q&A  │  │
│  │  (FR-04)  │  │  (FR-05)  │  │   (FR-06)    │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│                                                   │
│  1 API · 1 SDK · 1 billing account                │
└─────────────────────────────────────────────────┘
```

**Tại sao chọn phương án này:**
- **1 API duy nhất** xử lý cả 3 use cases chính → giảm complexity cực mạnh cho team 3 người
- **Không cần training data** → tiết kiệm 2-3 tuần thu thập + label ảnh
- **Tiếng Việt xuất sắc** → đáp ứng Persona 1 (Gen Z) và Persona 2 (Family)
- **Chi phí gần $0** cho giai đoạn MVP (~1000 lượt sử dụng)
- **Tích hợp 1-2 ngày** → team có 5 tuần còn lại cho frontend, UX, testing

**Cách triển khai Confidence Score:**
```python
# Prompt engineering để Gemini trả về structured response
prompt = """Analyze this image of a heritage site at Van Mieu - Quoc Tu Giam, Hanoi.
Return ONLY a JSON object:
{
  "identified": true/false,
  "name_vi": "Tên tiếng Việt",
  "name_en": "English name", 
  "confidence": 0-100,
  "brief_description": "..."
}
Known landmarks: Khuê Văn Các, Bia Tiến Sĩ, Đại Thành Môn, Nhà Thái Học, Hồ Văn.
If the image does not match any known landmark, set identified=false."""
```

---

### Phương án B – **Hybrid nếu Gemini accuracy không đạt** (Backup)

```
┌─────────────┐     ┌──────────────────────┐
│  DINOv2      │────▶│ FAISS Similarity     │──── Landmark ID
│  (Feature    │     │ Search               │
│   Extraction)│     └──────────────────────┘
└─────────────┘              │
                              ▼
                    ┌──────────────────────┐
                    │ Gemini API           │──── Story + Chat
                    │ (Storytelling + Q&A) │
                    └──────────────────────┘
```

**Khi nào cần Phương án B:**
- Gemini Vision không đạt ≥85% accuracy cho 5 landmarks sau testing
- Cần phân biệt chính xác các chi tiết nhỏ (hoa văn bia, từng tấm bia cụ thể)

**Trade-off:**
- Accuracy cao hơn (+5-10%)
- Nhưng cần GPU server cho DINOv2 inference (~$50-100/tháng)
- Thêm 1-2 tuần development

---

### Phương án C – **Dùng Llama 4 thay Gemini** (Alternative)

**Khi nào cần:**
- Muốn tránh vendor lock-in với Google
- Có plan fine-tune model cho domain di tích Việt Nam sau MVP
- Team có kinh nghiệm với Hugging Face / PyTorch ecosystem

**Trade-off:**
- Tiếng Việt yếu hơn Gemini
- Cần thêm effort prompt engineering
- Chi phí tương đương qua API providers (Together AI, Fireworks)

---

## 📋 Kết Luận

| Câu hỏi | Trả lời |
|----------|---------|
| Công nghệ tối ưu nhất cho MVP 6 tuần? | **Google Gemini Vision API (2.5-flash)** |
| Có cần train custom model? | **Không** – Gemini nhận diện bằng reasoning, không cần training |
| Có cần dùng công nghệ Meta? | **Chưa cần cho MVP** – DINOv2/Llama 4 phù hợp hơn cho giai đoạn mở rộng |
| SAM 2 có cần thiết? | **Không** – segmentation không phải bài toán chính |
| Backup nếu accuracy thấp? | **DINOv2 + FAISS** cho recognition, Gemini cho storytelling |
| Chi phí ước tính MVP? | **< $5/tháng** với Gemini Flash free tier + pay-as-you-go |

> [!IMPORTANT]
> **Hành động tiếp theo quan trọng**: Trước khi commit vào kiến trúc, nhóm nên dành **1 buổi (2-3 giờ)** test Gemini Vision trên Google AI Studio với 10-15 ảnh thực tế chụp tại Văn Miếu để validate accuracy. Nếu đạt ≥85%, chốt Phương án A. Nếu không, pivot sang Phương án B.
