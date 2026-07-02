from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import SessionLocal
from app.modules.analytics.product_eval import build_product_eval_report


def _resolve(path: str, *, base: Path = BACKEND_DIR) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value
    return (base / value).resolve()


def _percent(value: float | None) -> str:
    return "—" if value is None else f"{value:.1%}"


def _score(value: float | None) -> str:
    return "—" if value is None else f"{value:.2f}"


def _ms(value: int | None) -> str:
    if value is None:
        return "—"
    if value < 1000:
        return f"{value} ms"
    return f"{value / 1000:.1f}s"


def render_markdown(data: dict) -> str:
    rows = [
        ("Top-1 Image Recognition Accuracy", _percent(data.get("top1_image_accuracy")), "Image golden set"),
        ("Trustworthy Answer Rate", _percent(data.get("trustworthy_answer_rate")), "RAG golden set"),
        ("Time to First Meaningful Story p95", _ms(data.get("time_to_first_story_p95_ms")), "Visitor event logs"),
        ("Persona & Storytelling Score", f"{_score(data.get('persona_storytelling_score'))}/5", "Human feedback"),
        ("Voice Naturalness MOS", f"{_score(data.get('voice_mos'))}/5", "Human feedback"),
        ("Quest Completion Rate", _percent(data.get("quest_completion_rate")), f"{data.get('quest_completed_count', 0)}/{data.get('quest_started_count', 0)}"),
        ("Learning Gain", _score(data.get("learning_gain_avg")), "Pre/post quiz"),
        ("Replay Intent", f"{_score(data.get('replay_intent_score'))}/5", "Human feedback"),
        ("p95 End-to-End Latency", _ms(data.get("p95_e2e_latency_ms")), "Analytics events"),
    ]
    lines = [
        "# HERA Product Eval Report",
        "",
        f"- **Range:** Last {data['range_days']} days",
        f"- **Sessions:** {data.get('session_count', 0)}",
        f"- **Feedback count:** {data.get('feedback_count', 0)}",
        "",
        "## Pitch/Demo Metrics",
        "",
        "| Metric | Value | Source |",
        "|---|---:|---|",
    ]
    lines.extend(f"| {name} | {value} | {source} |" for name, value, source in rows)
    lines.extend(["", "## Report Sources", "", "| Path | Status |", "|---|---|"])
    for source in data.get("report_sources", []):
        lines.append(f"| `{source['path']}` | {'found' if source['exists'] else 'missing'} |")
    lines.extend(["", "## Notes", ""])
    notes = data.get("notes", [])
    if notes:
        lines.extend(f"- {note}" for note in notes)
    else:
        lines.append("- No missing-data notes.")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a pitch-ready HERA Product Eval report.")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--image-report", default="../docs/reports/image_eval_results.json")
    parser.add_argument("--ragas-report", default="../docs/reports/ragas_golden_70_results.json")
    parser.add_argument("--output-json", default="../docs/reports/product_eval_report.json")
    parser.add_argument("--output-md", default="../docs/reports/product_eval_report.md")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = build_product_eval_report(
            db,
            days=args.days,
            image_report_path=_resolve(args.image_report),
            ragas_report_path=_resolve(args.ragas_report),
        )
        data = report.model_dump()
    finally:
        db.close()

    json_path = _resolve(args.output_json)
    md_path = _resolve(args.output_md)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(render_markdown(data), encoding="utf-8")
    print(f"Product eval JSON written to {json_path}")
    print(f"Product eval Markdown written to {md_path}")


if __name__ == "__main__":
    main()
