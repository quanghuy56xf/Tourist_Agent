from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.modules.analytics.product_eval import build_product_eval_report


def _resolve(path: str) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value
    return (BACKEND_DIR / value).resolve()


def render_markdown(data: dict) -> str:
    return "\n".join(
        [
            "# HERA Latency Eval Report",
            "",
            f"- **Range:** Last {data['range_days']} days",
            f"- **Time to first story avg:** {data.get('time_to_first_story_avg_ms') or '—'} ms",
            f"- **Time to first story p95:** {data.get('time_to_first_story_p95_ms') or '—'} ms",
            f"- **p95 search latency:** {data.get('p95_search_latency_ms') or '—'} ms",
            f"- **p95 chat latency:** {data.get('p95_chat_latency_ms') or '—'} ms",
            f"- **p95 E2E latency:** {data.get('p95_e2e_latency_ms') or '—'} ms",
            "",
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate HERA latency eval from analytics events.")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--output-json", default="../docs/reports/latency_eval_results.json")
    parser.add_argument("--output-md", default="../docs/reports/latency_eval_report.md")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = build_product_eval_report(db, days=args.days)
        data = report.model_dump()
    finally:
        db.close()

    json_path = _resolve(args.output_json)
    md_path = _resolve(args.output_md)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(render_markdown(data), encoding="utf-8")
    print(f"Latency eval JSON written to {json_path}")
    print(f"Latency eval Markdown written to {md_path}")


if __name__ == "__main__":
    main()
