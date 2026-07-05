from __future__ import annotations

import argparse
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.modules.rag.ragas_eval import run_ragas_golden_eval, write_report_files


def _resolve(path: str) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value
    return (BACKEND_DIR / value).resolve()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run RAGAS on the HERA golden RAG dataset.")
    parser.add_argument("--dataset", default="evals/golden/rag_golden_70.jsonl")
    parser.add_argument("--top-k", type=int, default=8)
    parser.add_argument("--limit", type=int, default=None, help="Optional limit for smoke runs.")
    parser.add_argument("--language", default="Tiếng Việt")
    parser.add_argument("--markdown-output", default="../docs/reports/ragas_golden_100_report.md")
    parser.add_argument("--json-output", default="../docs/reports/ragas_golden_100_results.json")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = run_ragas_golden_eval(
            db,
            _resolve(args.dataset),
            top_k=args.top_k,
            language=args.language,
            limit=args.limit,
        )
    finally:
        db.close()

    markdown_path = _resolve(args.markdown_output)
    json_path = _resolve(args.json_output)
    write_report_files(report, markdown_path=markdown_path, json_path=json_path)
    print(f"RAGAS Markdown report written to {markdown_path}")
    print(f"RAGAS JSON results written to {json_path}")
    if report.notes:
        print("Notes:")
        for note in report.notes:
            print(f"- {note}")


if __name__ == "__main__":
    main()
