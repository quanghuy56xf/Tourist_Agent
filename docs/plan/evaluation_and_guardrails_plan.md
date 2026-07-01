# Kịch Bản Đánh Giá (Evaluation) & Hệ Thống Rào Chắn (Guardrails) Cho HERA V2

Dựa trên tài liệu đào tạo chuyên sâu về "RAGAS, LLM-as-Judge & Guardrails", đây là kịch bản toàn diện được thiết kế riêng cho hệ thống RAG của dự án HERA (C2-App-060). Kịch bản này chuyển hóa trực tiếp kiến thức hàn lâm thành các bước triển khai cụ thể, sẵn sàng cho Production.

---

## 1. Mục Tiêu Tiêu Chuẩn (SLOs & Targets)

Trước khi thực hiện, hệ thống cần nhắm tới các ngưỡng chất lượng tối thiểu sau:

### 1.1. Chất lượng RAG (RAGAS Targets)
- **Faithfulness (Chống bịa đặt):** >= 0.85 (Rất quan trọng cho thông tin di tích lịch sử).
- **Answer Relevancy (Đúng trọng tâm):** >= 0.80.
- **Context Recall (Độ phủ của tài liệu):** >= 0.75.
- **Context Precision (Độ chính xác xếp hạng tìm kiếm):** >= 0.70.

### 1.2. Hiệu năng Guardrails (Latency Budget)
- **Tổng overhead:** Không vượt quá **100ms** (P95) cho mỗi request để đảm bảo trải nghiệm người dùng (UX) không bị chậm.

---

## 2. Kịch Bản CI/CD Evaluation (Chạy mỗi khi có Pull Request)

Thay vì "vibe-check" (test tay bằng mắt) tốn thời gian và rủi ro, hệ thống sẽ tự động chạy pipeline gồm 4 bước (tổng thời gian ~18 phút, chi phí ~$5/PR). Pull Request sẽ bị **Block** nếu bất kỳ bước nào thất bại.

### Bước 1: Smoke Test (L1) - 30 giây
- **Mô tả:** Chạy 10 câu hỏi vàng (Golden queries).
- **Pass Criteria:** Hệ thống không crash, trả về đúng định dạng JSON/Schema.

### Bước 2: Component Eval với RAGAS (L2) - 5 phút
- **Dataset:** 100 câu hỏi được tạo từ tài liệu (Synthetic Test Generation).
  - 50% Simple (trích xuất thông tin trực tiếp).
  - 25% Reasoning (đòi hỏi suy luận).
  - 25% Multi-context (tổng hợp từ nhiều chunk/tài liệu).
- **Pass Criteria:** Đạt toàn bộ các target RAGAS ở mục 1.1.
- **Judge Model:** `gpt-4o-mini` (nhanh, rẻ).


### Bước 3: LLM-as-Judge End-to-End (L3) - 10 phút
- **Mô tả:** Chấm điểm câu trả lời tổng thể theo phương pháp **Pairwise Comparison** (So sánh Version Mới vs Version Cũ trên Production).
- **Xử lý thiên vị (Biases Mitigation):**
  - *Position Bias:* Áp dụng **Swap-and-average** (So A với B, sau đó so B với A rồi lấy trung bình).
  - *Verbosity Bias:* Yêu cầu Judge đánh giá nội dung, phớt lờ độ dài và format (Strip formatting).
  - *Self-Enhancement:* Dùng mô hình họ khác để chấm (ví dụ: Agent dùng Claude 3.5, thì Judge dùng GPT-4o).
- **Pass Criteria:** Win rate >= 50%.

### Bước 4: Security Red Teaming (Sec) - 2 phút
- **Mô tả:** Tấn công hệ thống bằng 30 mẫu adversarial inputs (Jailbreak, DAN, Prompt Injection, Session Poisoning).
- **Pass Criteria:** Guardrails phải chặn được >= 95% các đợt tấn công này.

---

## 3. Kiến Trúc Guardrails (Defense-in-Depth 4 Lớp)

Áp dụng chiến lược 4 lớp với mục tiêu bảo vệ toàn diện (Topical, Safety, Security, Compliance).

### Lớp 1: Input Guardrails (Chạy Song Song - Budget: < 30ms)
Chặn rủi ro ngay từ tin nhắn của người dùng trước khi gửi cho LLM. Cần chạy bất đồng bộ (Async/Parallel):
1. **PII Redaction (10ms):** Dùng Regex chặn CCCD, Số điện thoại VN + Presidio NER. Replace thông tin nhạy cảm thành `[PII_REMOVED]`.
2. **Prompt Injection Check (15ms):** Dùng Meta Prompt Guard (86M params) để bắt các lệnh thao túng (DAN, bypass).
3. **Topic Scope Validator (5ms):** Dùng Embedding/Cosine Similarity hoặc Guardrails AI để đảm bảo user chỉ hỏi về văn hóa, lịch sử, hệ thống di tích.

### Lớp 2: LLM System Prompt (Budget: 0ms)
- Đóng gói các rule an toàn ngay trong `system_prompt`.
- Dùng thẻ `<user>` và `<context>` rõ ràng để chống **Indirect Injection** (Tấn công qua tài liệu/web bị nhiễm độc).

### Lớp 3: Output Guardrails (Chạy Song Song - Budget: < 50ms)
Kiểm tra câu trả lời của AI trước khi trả về cho user:
1. **Safety Classifier (30ms):** Dùng Llama Guard 3 (8B) hoặc Perspective API để chặn ngôn từ độc hại, bạo lực.
2. **Hallucination Detection / NLI (20ms):** Sử dụng `DeBERTa-v3-mnli` hoặc `Vectara HHEM` để chấm điểm Entailment (Câu trả lời có thực sự dựa trên Context không?).
   - *Score < 0.3:* **Block** ngay lập tức (Hallucination nghiêm trọng).
   - *Score 0.3 - 0.7:* **Warn** - Gắn thêm dòng chú thích "Thông tin này cần được kiểm chứng lại với nguồn".
   - *Score > 0.7:* **Allow**.

### Lớp 4: Audit Layer (Async - Không tính vào Budget)
- Ghi log 100% (User, Input, Output, Timestamp, Models, Decisions).
- **Chống Session Poisoning:** Nếu phát hiện tin nhắn trước đó độc hại, thay vì chỉ chặn output, hệ thống phải **ghi đè input trong lịch sử hội thoại** thành `[Message removed by safety filter]` để tránh việc Agent bị lừa bởi context bẩn ở các lượt hỏi (turn) tiếp theo.

---

## 4. Continuous Evaluation (Vận hành Production)

Đánh giá không phải là làm một lần rồi bỏ. Hệ thống sẽ có cơ chế:
1. **Trích xuất 1-5% Traffic:** Chạy ngầm RAGAS async.
2. **Alerting:** Nếu `Faithfulness` rớt hơn 0.05 trong 24h -> Paging/Alert cho Engineer.
3. **Failure Loop:** Bất kỳ câu trả lời lỗi nào bị người dùng report (hoặc bắt được) sẽ được fix và đưa thẳng vào **Regression Suite**. "Test set tốt nhất là test set tiến hóa từ production failures."
