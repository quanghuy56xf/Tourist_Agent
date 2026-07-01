# HERA RAGAS Golden Dataset Report

- **Dataset:** `D:\ai_project\C2-App-060\backend\evals\golden\rag_golden_70.jsonl`
- **Generated at:** 2026-07-01T10:17:21.483608Z
- **Release status:** **GO for canary**
- **Total cases:** 70
- **Attempted by RAGAS:** 70
- **Scope attempted:** corpus=50, item=20
- **Errored cases:** 0 (corpus=0, item=0)
- **Gate score:** 4/4

## 1. RAGAS Metrics

| Metric | Score | Target | Gate |
|---|---:|---:|---:|
| faithfulness | 0.8918 | 0.85 | ✅ |
| answer_relevancy | 0.8439 | 0.80 | ✅ |
| context_recall | 0.9762 | 0.75 | ✅ |
| context_precision | 0.8277 | 0.70 | ✅ |

## 2. Dataset / Runtime Notes

- RAGAS evaluation completed without runtime notes.

## 3. Case Risk Summary

- Low-confidence cases: **0**
- Retrieval fallback cases: **1**
- Error cases: **0**

## 4. Case Sample

| # | Scope | Item | Group | Confidence | Fallback | Contexts | Error | Question |
|---:|---|---:|---:|---:|---:|---:|---|---|
| 1 | corpus | - | 2 | 0.700 | False | 8 | - | Thi Hội là kỳ thi dành cho những ai? |
| 2 | corpus | - | 2 | 0.700 | False | 8 | - | Thi Hội thời Nguyễn thường kéo dài khoảng bao lâu? |
| 3 | corpus | - | 2 | 0.700 | False | 8 | - | Tên gọi Thi Hội xuất hiện vào năm nào và dưới thời ai? |
| 4 | corpus | - | 2 | 0.700 | False | 8 | - | Vì sao Thi Hội còn được gọi là Xuân Hội hoặc Xuân Vi? |
| 5 | corpus | - | 2 | 0.700 | False | 8 | - | Thi Hội thường được tổ chức ở đâu? |
| 6 | corpus | - | 2 | 0.700 | False | 8 | - | Nhà Lý tổ chức bao nhiêu kỳ thi lớn được nhắc tới trong tài liệu? |
| 7 | corpus | - | 2 | 0.700 | False | 8 | - | Khoa thi Thái Học Sinh năm 1232 dưới nhà Trần có điểm mới gì? |
| 8 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1247 thi Đại tỉ lấy những danh vị cao nhất nào? |
| 9 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1396 Hồ Quý Ly quy định trình tự thi Hương, thi Hội, thi Đình như thế nào? |
| 10 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1466 nhà Lê định lệ Thi Hội vào những năm nào? |
| 11 | corpus | - | 2 | 0.700 | False | 8 | - | Thi Hội và thi Đình thời Lê có năm nào chỉ cách nhau một ngày? |
| 12 | corpus | - | 2 | 0.700 | False | 8 | - | Lúc đầu nước ta đã phân biệt Thi Hội với Thi Đình chưa? |
| 13 | corpus | - | 2 | 0.700 | False | 8 | - | Mục đích của thi Đình là gì? |
| 14 | corpus | - | 2 | 0.700 | False | 8 | - | Vì sao Thi Hội không cần dựng trường thi ở địa phương như thi Hương? |
| 15 | corpus | - | 2 | 0.700 | False | 8 | - | Sĩ tử ở xa gặp những khó khăn gì khi đi Thi Hội? |
| 16 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1246 nhà Trần định lệ Đại tỉ như thế nào? |
| 17 | corpus | - | 2 | 0.700 | False | 8 | - | Lệ lấy đỗ hai Trạng nguyên Kinh và Trại xuất hiện để làm gì? |
| 18 | corpus | - | 2 | 0.700 | False | 8 | - | Lệ lấy đỗ hai Trạng nguyên Kinh và Trại bị bỏ vào thời điểm nào? |
| 19 | corpus | - | 2 | 0.700 | False | 8 | - | Phép thi Thái Học Sinh năm 1304/1305 có mấy kỳ? |
| 20 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1370 phép thi được định lại như thế nào? |
| 21 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1374 Duệ Tông mở khoa thi gì và lấy những hạng đỗ nào? |
| 22 | corpus | - | 2 | 0.700 | False | 8 | - | Phép thi năm 1396 theo nhà Nguyên gồm những trường nào? |
| 23 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1404 Hán Thương định lệ thi cử như thế nào? |
| 24 | corpus | - | 2 | 0.700 | False | 8 | - | Nhà Hồ tổ chức thi theo chu kỳ mấy năm một khoa? |
| 25 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1429 Lê Thái Tổ mở khoa Minh kinh cho đối tượng nào? |
| 26 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1433 nhà Lê định lệ khoa thi như thế nào? |
| 27 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1438 nhà Lê định phép thi mấy trường? |
| 28 | corpus | - | 2 | 0.700 | False | 8 | - | Khoa Nhâm Tuất 1442 có ý nghĩa gì trong tài liệu? |
| 29 | corpus | - | 2 | 0.700 | False | 8 | - | Năm 1448 nhà Lê chia bảng đỗ ra sao? |
| 30 | corpus | - | 2 | 0.700 | False | 8 | - | Lịch thi năm 1463 diễn ra như thế nào? |

## 5. Next Actions

1. Keep RAGAS judge credentials and compatible LLM/embedding settings configured before every release eval run.
2. Inspect the 1 retrieval fallback case from this 70-case run and decide whether retriever tuning, source data fixes, or dataset adjustment is needed.
3. Promote future production RAG failures into this golden dataset or a dedicated regression dataset.
