from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.modules.analytics.rag_eval import build_rag_eval_report, render_rag_eval_markdown


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Markdown RAG Eval report.")
    parser.add_argument("--days", type=int, default=30, help="Number of days to include.")
    parser.add_argument("--limit", type=int, default=50, help="Recent trace rows to include in risk review.")
    parser.add_argument(
        "--output",
        default="../docs/reports/rag_eval_report.md",
        help="Output Markdown path, relative to the backend directory by default.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = build_rag_eval_report(db, days=args.days, limit=args.limit)
        markdown = render_rag_eval_markdown(report)
    finally:
        db.close()

    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = Path(__file__).resolve().parents[1] / output_path
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"RAG Eval report written to {output_path}")


if __name__ == "__main__":
    main()
