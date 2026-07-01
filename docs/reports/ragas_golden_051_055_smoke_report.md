# HERA RAGAS Golden Dataset Report

- **Dataset:** `D:\ai_project\C2-App-060\backend\.pytest_tmp\rag_golden_051_055.jsonl`
- **Generated at:** 2026-07-01T10:03:00.208245Z
- **Release status:** **GO for canary**
- **Total cases:** 5
- **Attempted by RAGAS:** 5
- **Scope attempted:** corpus=0, item=5
- **Errored cases:** 0 (corpus=0, item=0)
- **Gate score:** 4/4

## 1. RAGAS Metrics

| Metric | Score | Target | Gate |
|---|---:|---:|---:|
| faithfulness | 0.9033 | 0.85 | ✅ |
| answer_relevancy | 0.8702 | 0.80 | ✅ |
| context_recall | 1.0000 | 0.75 | ✅ |
| context_precision | 0.8996 | 0.70 | ✅ |

## 2. Dataset / Runtime Notes

- RAGAS evaluation completed without runtime notes.

## 3. Case Risk Summary

- Low-confidence cases: **0**
- Retrieval fallback cases: **0**
- Error cases: **0**

## 4. Case Sample

| # | Scope | Item | Group | Confidence | Fallback | Contexts | Error | Question |
|---:|---|---:|---:|---:|---:|---:|---|---|
| 1 | item | 19 | 2 | 0.950 | False | 7 | - | Bia Tiến sĩ ở Văn Miếu - Quốc Tử Giám được dùng để làm gì? |
| 2 | item | 19 | 2 | 0.950 | False | 7 | - | Tại sao Bia Tiến sĩ lại được đặt trên lưng rùa đá? |
| 3 | item | 20 | 2 | 0.950 | False | 8 | - | Chuông tại Văn Miếu có ý nghĩa gì trong các nghi lễ? |
| 4 | item | 20 | 2 | 0.950 | False | 8 | - | Chuông tại Văn Miếu được làm từ chất liệu gì? |
| 5 | item | 21 | 2 | 0.950 | False | 7 | - | Cổng chính của Văn Miếu - Quốc Tử Giám được thiết kế như thế nào? |

## 5. Next Actions

1. Replace scaffold rows with 100 human-reviewed golden questions before production sign-off.
2. Ensure judge credentials and RAGAS-compatible LLM/embedding settings are configured in the backend environment.
3. Promote every production failure into this dataset or a dedicated regression dataset.
