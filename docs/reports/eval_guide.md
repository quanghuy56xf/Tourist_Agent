# HERA Product Evaluation Guide

Tài liệu này mô tả định nghĩa, công thức tính, cách chuẩn bị test set và cách chạy/đo 9 chỉ số Product Eval đang được dùng cho demo/pitch HERA.

Các chỉ số được hiển thị trong tab quản trị:

```text
/admin/analytics → Product Eval
```

Backend tổng hợp dữ liệu từ 2 nguồn chính:

1. **Offline eval reports** trong `docs/reports/`:
   - `docs/reports/image_eval_results.json`
   - `docs/reports/ragas_golden_70_results.json`
2. **Live analytics events** trong bảng `analytics_events`:
   - `story_first_meaningful_audio`
   - `story_completed`
   - `eval_feedback`
   - `quest_started`
   - `quest_completed`
   - `quiz_pre_submitted`
   - `quiz_post_submitted`
   - `search`
   - `chat`
   - `item_view`

---

## 1. Top-1 Image Recognition Accuracy

### Định nghĩa

Tỷ lệ ảnh test mà hệ thống nhận diện đúng hiện vật ở kết quả top-1.

Chỉ số này trả lời câu hỏi:

> Khi người dùng chụp một ảnh hiện vật, kết quả nhận diện đầu tiên của HERA có đúng hiện vật kỳ vọng không?

### Công thức

```text
Top-1 Image Recognition Accuracy = số ảnh top-1 đúng / tổng số ảnh test hợp lệ
```

Ví dụ:

```text
24 ảnh đúng / 30 ảnh test = 0.80 = 80%
```

### Logic đúng/sai

Script ưu tiên so sánh bằng `expected_item_id`.

```text
Nếu expected_item_id có giá trị:
  correct = predicted_item_id == expected_item_id

Nếu expected_item_id trống và expected_label có giá trị:
  correct = predicted_label == expected_label
```

Vì vậy nên điền cả hai trường nếu có thể:

- `expected_item_id`: chính xác hơn.
- `expected_label`: dễ đọc, dùng fallback khi chưa biết ID.

### Test set cần chuẩn bị

Tạo manifest:

```text
backend/evals/golden/images/labels.csv
```

Header:

```csv
image_id,file_path,expected_item_id,expected_label,group_id,difficulty
```

Ví dụ:

```csv
image_id,file_path,expected_item_id,expected_label,group_id,difficulty
img_001,evals/golden/images/test/img_001.jpg,,Cổng chính,2,easy
img_002,evals/golden/images/test/img_002.jpg,,Khuê Văn Các,2,medium
img_003,evals/golden/images/test/img_003.jpg,,Cổng chính,2,hard
```

Cấu trúc thư mục gợi ý:

```text
backend/
  evals/
    golden/
      images/
        labels.csv
        test/
          img_001.jpg
          img_002.jpg
          img_003.jpg
```

Khuyến nghị test set ban đầu:

```text
30 ảnh thủ công:
- 10 ảnh easy: rõ, chính diện, đủ sáng.
- 10 ảnh medium: lệch góc nhẹ, nền nhiễu nhẹ.
- 10 ảnh hard: mờ nhẹ, thiếu sáng, crop một phần, nhiều vật thể.
```

### Cách chạy CLI

Từ repo root trên Windows:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_image_eval.py --labels evals\golden\images\labels.csv
```

Chạy smoke test 5 ảnh:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_image_eval.py --labels evals\golden\images\labels.csv --limit 5
```

Output mặc định:

```text
docs/reports/image_eval_results.json
docs/reports/image_eval_report.md
```

Dashboard Product Eval đọc `docs/reports/image_eval_results.json` để lấy:

```json
{
  "total_images": 30,
  "correct": 24,
  "top1_accuracy": 0.8
}
```

---

## 2. Trustworthy Answer Rate

### Định nghĩa

Tỷ lệ câu trả lời RAG vượt ngưỡng tin cậy trên golden question dataset.

Chỉ số này trả lời câu hỏi:

> Trong bộ câu hỏi chuẩn, bao nhiêu phần trăm câu trả lời của HERA vừa bám sát ngữ cảnh vừa liên quan đúng câu hỏi?

### Công thức chuẩn

```text
Trustworthy Answer Rate = số câu pass ngưỡng tin cậy / tổng số câu được chấm đủ metric
```

Một câu được tính là pass khi:

```text
faithfulness >= target_faithfulness
AND answer_relevancy >= target_answer_relevancy
```

Target hiện tại:

```text
faithfulness >= 0.85
answer_relevancy >= 0.80
```

Ví dụ:

```text
70 câu được chấm
63 câu có faithfulness >= 0.85 và answer_relevancy >= 0.80
Trustworthy Answer Rate = 63 / 70 = 0.90 = 90%
```

### Lưu ý về cách tính hiện tại

Code đã được chỉnh để ưu tiên case-level scores:

1. Nếu report có `case_scores`, tính theo từng câu.
2. Nếu không có `case_scores`, dùng `passed_questions / total_questions`.
3. Nếu không có, dùng field `trustworthy_answer_rate` có sẵn.
4. Cuối cùng mới fallback sang cách cũ: so average metrics với target và trả 100% hoặc 0%.

Do đó, để chỉ số có giá trị chi tiết hơn, nên chạy lại RAGAS eval để report mới có `case_scores`.

### Test set cần chuẩn bị

Golden RAG dataset hiện dùng:

```text
backend/evals/golden/rag_golden_70.jsonl
```

Mỗi dòng JSONL nên có các trường chính:

```json
{"scope":"item","question":"...","item_id":1,"group_id":2,"ground_truth":"..."}
```

Hoặc cho câu hỏi cấp corpus/group:

```json
{"scope":"corpus","question":"...","group_id":2,"ground_truth":"..."}
```

Khuyến nghị test set:

```text
Tối thiểu 50-70 câu golden:
- Câu hỏi factual trực tiếp.
- Câu hỏi cần tổng hợp từ nhiều đoạn context.
- Câu hỏi dễ gây hallucination.
- Câu hỏi ngoài phạm vi để kiểm tra guardrail/fallback.
- Câu hỏi theo từng hiện vật và theo toàn khu/group.
```

### Cách chạy CLI

Từ repo root:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_ragas_golden_eval.py --dataset evals\golden\rag_golden_70.jsonl --json-output ..\docs\reports\ragas_golden_70_results.json --markdown-output ..\docs\reports\ragas_golden_70_report.md
```

Smoke test với vài câu:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_ragas_golden_eval.py --dataset evals\golden\rag_golden_70.jsonl --limit 5 --json-output ..\docs\reports\ragas_golden_70_results.json --markdown-output ..\docs\reports\ragas_golden_70_report.md
```

Output dashboard đọc:

```text
docs/reports/ragas_golden_70_results.json
```

---

## 3. Time to First Meaningful Story

### Định nghĩa

Thời gian từ lúc người dùng bắt đầu scan/chụp để nhận diện cho đến khi HERA phát/stream phần audio câu chuyện đầu tiên có ý nghĩa.

Chỉ số này trả lời câu hỏi:

> Người dùng phải chờ bao lâu trước khi bắt đầu nghe được câu chuyện đầu tiên?

### Công thức

Mỗi session/story flow ghi event:

```text
story_first_meaningful_audio.duration_ms
```

Trong frontend, duration được đo xấp xỉ:

```text
duration_ms = thời điểm nhận audio story đầu tiên - thời điểm bắt đầu scan/capture
```

Dashboard hiển thị:

```text
Average Time to First Story = trung bình duration_ms
p95 Time to First Story = percentile 95 của duration_ms
```

Công thức p95 dùng trong backend:

```text
Sắp xếp duration tăng dần.
Lấy phần tử tại vị trí ceil(n * 0.95) - 1.
```

### Cách đo cụ thể

Frontend Companion hiện log:

```text
story_scan_started
story_first_meaningful_audio
```

Payload quan trọng:

```json
{
  "event_type": "story_first_meaningful_audio",
  "duration_ms": 3200,
  "group_id": 2,
  "item_id": 10,
  "session_id": "...",
  "metadata": {"source": "companion_stream"}
}
```

### Test set / pilot cần chuẩn bị

Không cần golden dataset riêng. Cần pilot session thật:

```text
Tối thiểu 20-30 lượt scan/story:
- Nhiều thiết bị khác nhau nếu có thể.
- Wi-Fi/4G khác nhau nếu demo production.
- Mỗi lượt nên hoàn tất đến khi audio đầu tiên phát ra.
```

### Cách chạy report CLI

Sau khi có event trong database:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_latency_eval.py --days 30
```

Hoặc report tổng hợp:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_product_eval_report.py --days 30
```

Output:

```text
docs/reports/latency_eval_results.json
docs/reports/latency_eval_report.md
docs/reports/product_eval_report.json
docs/reports/product_eval_report.md
```

---

## 4. Persona & Storytelling Score

### Định nghĩa

Điểm đánh giá của người dùng/human evaluator về mức độ HERA kể chuyện đúng vai/persona và hấp dẫn.

Chỉ số này trả lời câu hỏi:

> HERA có kể chuyện đúng phong cách nhân vật/persona và đủ hấp dẫn cho khách tham quan không?

### Công thức

Mỗi feedback có 2 điểm:

```text
persona_score: 1-5
storytelling_score: 1-5
```

Điểm cho một feedback:

```text
feedback_story_score = (persona_score + storytelling_score) / 2
```

Chỉ số tổng:

```text
Persona & Storytelling Score = trung bình feedback_story_score của tất cả feedback hợp lệ
```

Ví dụ:

```text
Feedback 1: persona=4, storytelling=5 → 4.5
Feedback 2: persona=5, storytelling=5 → 5.0
Score = (4.5 + 5.0) / 2 = 4.75 / 5
```

### Cách đo cụ thể

Feedback UI hiện có ở:

```text
- Item page
- Companion chat
```

Event:

```text
eval_feedback
```

Payload:

```json
{
  "event_type": "eval_feedback",
  "metadata": {
    "persona_score": 4,
    "storytelling_score": 5,
    "voice_naturalness_score": 4,
    "replay_intent_score": 5,
    "comment": "Hay",
    "surface": "item_page"
  }
}
```

### Test set / pilot cần chuẩn bị

Không phải test set file, mà là bảng chấm human feedback.

Khuyến nghị:

```text
10-20 người dùng hoặc evaluator.
Mỗi người trải nghiệm 2-3 hiện vật.
Mỗi lượt nghe/kể chuyện submit 1 feedback.
Tổng tối thiểu 30 feedback để demo metric ổn định hơn.
```

### Cách chạy report CLI

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_human_eval_analysis.py --days 30
```

Hoặc report tổng hợp:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_product_eval_report.py --days 30
```

---

## 5. Voice Naturalness MOS

### Định nghĩa

Mean Opinion Score cho độ tự nhiên của giọng nói/audio.

Chỉ số này trả lời câu hỏi:

> Giọng nói HERA có tự nhiên, dễ nghe, phù hợp trải nghiệm bảo tàng không?

### Công thức

Mỗi feedback có:

```text
voice_naturalness_score: 1-5
```

Chỉ số tổng:

```text
Voice Naturalness MOS = trung bình voice_naturalness_score của tất cả feedback hợp lệ
```

Ví dụ:

```text
Điểm voice: 4, 5, 4, 3
Voice MOS = (4 + 5 + 4 + 3) / 4 = 4.0 / 5
```

### Cách đo cụ thể

Dùng cùng event `eval_feedback`:

```json
{
  "metadata": {
    "voice_naturalness_score": 4
  }
}
```

### Test set / pilot cần chuẩn bị

Khuyến nghị:

```text
Tối thiểu 30 lượt chấm audio.
Mỗi lượt nên nghe đủ ít nhất 1 đoạn story.
Nếu có nhiều persona/ngôn ngữ, phân tầng theo persona/language.
```

Có thể thêm rubric khi hướng dẫn evaluator:

```text
1 = rất khó nghe / máy móc
2 = kém tự nhiên
3 = chấp nhận được
4 = tự nhiên, dễ nghe
5 = rất tự nhiên, phù hợp demo
```

### Cách chạy report CLI

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_human_eval_analysis.py --days 30
```

---

## 6. Quest Completion Rate

### Định nghĩa

Tỷ lệ quest được hoàn thành trên tổng số quest đã bắt đầu.

Chỉ số này trả lời câu hỏi:

> Người dùng có thực sự đi hết nhiệm vụ/trải nghiệm khám phá không?

### Công thức

```text
Quest Completion Rate = số quest_completed / số quest_started
```

Ví dụ:

```text
20 quest_started
15 quest_completed
Quest Completion Rate = 15 / 20 = 75%
```

Nếu chưa có `quest_started`, dashboard trả `null`/empty state thay vì 0% để tránh hiểu nhầm.

### Cách đo cụ thể

Frontend Companion hiện log:

```text
quest_started
quest_completed
```

Payload ví dụ:

```json
{
  "event_type": "quest_started",
  "metadata": {
    "quest_id": "q1",
    "quest_title": "Khám phá Văn Miếu",
    "quest_stop_count": 3
  }
}
```

```json
{
  "event_type": "quest_completed",
  "metadata": {
    "quest_id": "q1",
    "quest_title": "Khám phá Văn Miếu",
    "quest_stop_count": 3
  }
}
```

### Test set / pilot cần chuẩn bị

Không cần golden file. Cần pilot scenario:

```text
Tối thiểu 20 lượt bắt đầu quest.
Mỗi quest có định nghĩa rõ điểm bắt đầu và điểm hoàn thành.
Nếu có nhiều loại quest, ghi quest_id/quest_title để phân tích sau.
```

### Cách chạy report CLI

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_human_eval_analysis.py --days 30
```

Hoặc xem trực tiếp trong Product Eval tab sau khi có event.

---

## 7. Learning Gain

### Định nghĩa

Mức tăng kiến thức của người dùng sau khi trải nghiệm HERA, đo bằng pre/post quiz.

Chỉ số này trả lời câu hỏi:

> Sau khi dùng HERA, người dùng có học thêm được gì không?

### Công thức raw gain

```text
Learning Gain = post_score - pre_score
```

Dashboard hiện dùng trung bình raw gain:

```text
Average Learning Gain = trung bình(post_score - pre_score)
```

### Công thức normalized gain

```text
Normalized Learning Gain = (post_score - pre_score) / (max_score - pre_score)
```

Chỉ tính khi:

```text
max_score - pre_score > 0
```

Ví dụ:

```text
pre_score = 2
post_score = 4
max_score = 5

Raw gain = 4 - 2 = +2
Normalized gain = (4 - 2) / (5 - 2) = 2/3 = 0.667
```

### Cách đo cụ thể

Cần log cặp event cùng `session_id` và `quiz_id`:

```text
quiz_pre_submitted
quiz_post_submitted
```

Payload:

```json
{
  "event_type": "quiz_pre_submitted",
  "metadata": {
    "quiz_id": "van_mieu_basic",
    "score": 2,
    "max_score": 5
  }
}
```

```json
{
  "event_type": "quiz_post_submitted",
  "metadata": {
    "quiz_id": "van_mieu_basic",
    "score": 4,
    "max_score": 5
  }
}
```

Backend ghép cặp theo:

```text
(session_id, quiz_id)
```

### Test set cần chuẩn bị

Tạo bộ quiz ngắn:

```text
5-10 câu hỏi.
Cùng một quiz dùng trước và sau trải nghiệm.
Câu hỏi nên bao phủ nội dung chính của tour/story.
```

Ví dụ test set quiz:

```text
quiz_id: van_mieu_basic
max_score: 5
Câu 1: Khuê Văn Các biểu trưng cho điều gì?
Câu 2: Bia Tiến sĩ ghi nhận thông tin gì?
Câu 3: Nhà Thái Học liên quan đến hoạt động nào?
...
```

### Cách chạy report CLI

Sau khi có event quiz trong DB:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_human_eval_analysis.py --days 30
```

---

## 8. User Engagement / Replay Intent

### Định nghĩa

Chỉ số kết hợp giữa hành vi khám phá và ý định quay lại/trải nghiệm tiếp.

Trong dashboard hiện có 2 phần chính:

1. **Replay Intent Score**: người dùng tự chấm mức muốn trải nghiệm tiếp.
2. **Average Artifacts per Session**: số hiện vật trung bình được khám phá trong mỗi session.

Chỉ số này trả lời câu hỏi:

> Người dùng có thấy trải nghiệm đủ hấp dẫn để tiếp tục khám phá hoặc quay lại không?

### Công thức Replay Intent

Mỗi feedback có:

```text
replay_intent_score: 1-5
```

Chỉ số:

```text
Replay Intent Score = trung bình replay_intent_score của tất cả feedback hợp lệ
```

Ví dụ:

```text
5, 4, 5, 3 → 4.25 / 5
```

### Công thức Average Artifacts per Session

Backend đếm các cặp duy nhất:

```text
(session_id, item_id)
```

với event:

```text
item_view hoặc search
```

Công thức:

```text
Average Artifacts per Session = số cặp (session_id, item_id) duy nhất / số session có event
```

Ví dụ:

```text
10 session
35 cặp session-item duy nhất
Average Artifacts per Session = 3.5
```

### Cách đo cụ thể

Replay intent dùng event:

```text
eval_feedback
```

Payload:

```json
{
  "metadata": {
    "replay_intent_score": 5
  }
}
```

Artifacts/session dùng event có sẵn:

```text
item_view
search
```

### Test set / pilot cần chuẩn bị

Không cần file test set. Cần pilot session:

```text
10-20 người dùng.
Mỗi người trải nghiệm tự nhiên trong 5-10 phút.
Ghi nhận số hiện vật họ mở/xem/scan.
Cuối flow submit feedback replay intent.
```

### Cách chạy report CLI

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_human_eval_analysis.py --days 30
```

Hoặc:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_product_eval_report.py --days 30
```

---

## 9. p95 End-to-End Latency

### Định nghĩa

Độ trễ p95 cho flow end-to-end quan trọng của người dùng.

Trong MVP hiện tại, dashboard ưu tiên dùng:

```text
story_completed.duration_ms
```

Nếu chưa có `story_completed`, fallback sang:

```text
story_first_meaningful_audio.duration_ms
```

Nếu vẫn chưa có, fallback sang:

```text
chat.duration_ms
```

Chỉ số này trả lời câu hỏi:

> 95% lượt trải nghiệm hoàn tất trong bao lâu hoặc nhanh hơn?

### Công thức

```text
p95 E2E Latency = percentile 95 của danh sách duration_ms end-to-end
```

Cách tính backend:

```text
1. Lấy tất cả duration_ms hợp lệ.
2. Sắp xếp tăng dần.
3. index = ceil(n * 0.95) - 1.
4. p95 = ordered[index].
```

Ví dụ:

```text
latencies = [1000, 1200, 1600, 2400, 6400]
p95 = 6400 ms
```

### Cách đo cụ thể

Event chính:

```text
story_completed
```

Payload:

```json
{
  "event_type": "story_completed",
  "duration_ms": 6400,
  "metadata": {
    "source": "companion_stream",
    "has_audio": true
  }
}
```

Dashboard cũng hiển thị latency breakdown:

```text
p95_search_latency_ms từ search.duration_ms
p95_chat_latency_ms từ chat.duration_ms
p95_e2e_latency_ms từ story_completed/story_first_meaningful_audio/chat
```

### Test set / pilot cần chuẩn bị

Không cần golden file. Cần log latency từ session thật:

```text
Tối thiểu 30 lượt scan/story/chat.
Nên test trên mạng và thiết bị gần điều kiện demo thật.
Nên ghi nhận cả lượt thành công và lỗi để phân tích riêng.
```

### Cách chạy report CLI

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_latency_eval.py --days 30
```

Hoặc report tổng hợp:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_product_eval_report.py --days 30
```

---

## Quy trình chạy eval đầy đủ cho pitch/demo

### Bước 1: Chuẩn bị image labels

```text
backend/evals/golden/images/labels.csv
backend/evals/golden/images/test/*.jpg
```

Chạy:

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_image_eval.py --labels evals\golden\images\labels.csv
```

### Bước 2: Chạy RAGAS golden eval

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_ragas_golden_eval.py --dataset evals\golden\rag_golden_70.jsonl --json-output ..\docs\reports\ragas_golden_70_results.json --markdown-output ..\docs\reports\ragas_golden_70_report.md
```

### Bước 3: Thu thập pilot events

Thực hiện các flow thật:

```text
- Scan/chụp hiện vật.
- Nghe story/audio.
- Chat với companion.
- Làm quest.
- Submit feedback.
- Làm pre/post quiz nếu có.
```

Các event được ghi vào `analytics_events`.

### Bước 4: Chạy latency/human/product report

```powershell
cd backend
.venv\Scripts\python.exe scripts\run_latency_eval.py --days 30
.venv\Scripts\python.exe scripts\run_human_eval_analysis.py --days 30
.venv\Scripts\python.exe scripts\run_product_eval_report.py --days 30
```

### Bước 5: Xem dashboard

Mở admin:

```text
/admin/analytics → Product Eval
```

Kiểm tra 9 KPI:

```text
1. Top-1 Image Recognition Accuracy
2. Trustworthy Answer Rate
3. Time to First Meaningful Story
4. Persona & Storytelling Score
5. Voice Naturalness MOS
6. Quest Completion Rate
7. Learning Gain
8. User Engagement / Replay Intent
9. p95 End-to-End Latency
```

---

## Mapping nhanh giữa metric, nguồn dữ liệu và script

| # | Metric | Nguồn dữ liệu | Script/report |
|---:|---|---|---|
| 1 | Top-1 Image Recognition Accuracy | `backend/evals/golden/images/labels.csv` + ảnh test | `scripts/run_image_eval.py` |
| 2 | Trustworthy Answer Rate | `backend/evals/golden/rag_golden_70.jsonl` | `scripts/run_ragas_golden_eval.py` |
| 3 | Time to First Meaningful Story | `story_first_meaningful_audio.duration_ms` | `scripts/run_latency_eval.py` |
| 4 | Persona & Storytelling Score | `eval_feedback.metadata` | `scripts/run_human_eval_analysis.py` |
| 5 | Voice Naturalness MOS | `eval_feedback.metadata.voice_naturalness_score` | `scripts/run_human_eval_analysis.py` |
| 6 | Quest Completion Rate | `quest_started`, `quest_completed` | `scripts/run_human_eval_analysis.py` |
| 7 | Learning Gain | `quiz_pre_submitted`, `quiz_post_submitted` | `scripts/run_human_eval_analysis.py` |
| 8 | User Engagement / Replay Intent | `eval_feedback`, `item_view`, `search` | `scripts/run_human_eval_analysis.py` |
| 9 | p95 End-to-End Latency | `story_completed`, `story_first_meaningful_audio`, `chat`, `search` | `scripts/run_latency_eval.py` |

---

## Ngưỡng gợi ý cho demo/pitch

Các ngưỡng này không phải hard requirement, nhưng có thể dùng làm mục tiêu demo:

| Metric | Mục tiêu gợi ý |
|---|---:|
| Top-1 Image Recognition Accuracy | >= 80% với test set chụp thật |
| Trustworthy Answer Rate | >= 85% |
| Time to First Meaningful Story p95 | <= 8-10 giây |
| Persona & Storytelling Score | >= 4.0/5 |
| Voice Naturalness MOS | >= 4.0/5 |
| Quest Completion Rate | >= 60-70% |
| Learning Gain | raw gain dương, normalized gain >= 0.3 |
| Replay Intent Score | >= 4.0/5 |
| p95 End-to-End Latency | <= 10-15 giây tùy hạ tầng |
