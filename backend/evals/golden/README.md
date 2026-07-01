# HERA RAG Golden-100 Dataset

`rag_golden_100.jsonl` is the production golden dataset used by `backend/scripts/run_ragas_golden_eval.py`.

Current status: **scaffold only**. The file contains 100 placeholder rows so the pipeline has a stable contract. Replace every `[TODO human-review]` row with curated questions and references before treating RAGAS scores as production evidence.

## Required JSONL fields

Each line is one case:

```json
{
  "id": "golden-001",
  "split": "simple|reasoning|multi_context|no_answer|security",
  "question": "Đại Thành Điện thờ ai?",
  "item_id": 1,
  "group_id": 1,
  "ground_truth": "Câu trả lời chuẩn do người review từ tài liệu xác thực.",
  "expected_document_ids": [1],
  "expected_terms": ["Đại Thành Điện", "Khổng Tử"],
  "expect_no_data": false,
  "notes": "Nguồn/tài liệu dùng để review"
}
```

## Recommended composition

- 50 simple extraction cases
- 25 reasoning cases
- 25 multi-context cases
- Add at least 30 no-answer/abstention cases before production sign-off, either by replacing some rows or maintaining a separate regression dataset.

## Run

From repo root:

```powershell
& "backend\\.venv\\Scripts\\python.exe" "backend\\scripts\\run_ragas_golden_eval.py" --dataset "evals/golden/rag_golden_100.jsonl"
```

Outputs:

- `docs/reports/ragas_golden_100_report.md`
- `docs/reports/ragas_golden_100_results.json`
