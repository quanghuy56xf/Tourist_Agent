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


def _score(value: float | None) -> str:
    return "—" if value is None else f"{value:.2f}"


def _percent(value: float | None) -> str:
    return "—" if value is None else f"{value:.1%}"


def render_markdown(data: dict) -> str:
    return "\n".join(
        [
            "# HERA Human Eval & Learning Report",
            "",
            f"- **Range:** Last {data['range_days']} days",
            f"- **Feedback count:** {data['feedback_count']}",
            f"- **Persona & Storytelling:** {_score(data.get('persona_storytelling_score'))}/5",
            f"- **Voice MOS:** {_score(data.get('voice_mos'))}/5",
            f"- **Replay intent:** {_score(data.get('replay_intent_score'))}/5",
            f"- **Quest completion:** {_percent(data.get('quest_completion_rate'))} ({data['quest_completed_count']}/{data['quest_started_count']})",
            f"- **Learning gain:** {_score(data.get('learning_gain_avg'))}",
            f"- **Normalized learning gain:** {_score(data.get('normalized_learning_gain_avg'))}",
            "",
            "## Notes",
            "",
            *(f"- {note}" for note in data.get("notes", [])),
            "",
        ]
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate HERA human feedback and learning eval report.")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--output-json", default="../docs/reports/human_eval_results.json")
    parser.add_argument("--output-md", default="../docs/reports/human_eval_report.md")
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
    print(f"Human eval JSON written to {json_path}")
    print(f"Human eval Markdown written to {md_path}")


if __name__ == "__main__":
    main()
