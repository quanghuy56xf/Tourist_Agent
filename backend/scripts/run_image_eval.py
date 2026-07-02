from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import SIMILARITY_THRESHOLD, USE_AUGMENTATION
from app.core.database import SessionLocal
from app.models.item import Item
from app.modules.vision import chroma, embedding


@dataclass
class ImageEvalCaseResult:
    image_id: str
    file_path: str
    expected_item_id: int | None
    expected_label: str | None
    predicted_item_id: int | None
    predicted_label: str | None
    similarity: float | None
    correct: bool
    latency_ms: int
    difficulty: str | None = None
    error: str | None = None


def _resolve(path: str | Path, *, base: Path = BACKEND_DIR) -> Path:
    value = Path(path)
    if value.is_absolute():
        return value
    return (base / value).resolve()


def _optional_int(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _label_match(expected: str | None, predicted: str | None) -> bool:
    if not expected or not predicted:
        return False
    return expected.strip().casefold() == predicted.strip().casefold()


def run_image_eval(labels_path: Path, *, limit: int | None = None) -> dict[str, Any]:
    rows = list(csv.DictReader(labels_path.open("r", encoding="utf-8-sig")))
    if limit is not None:
        rows = rows[:limit]

    results: list[ImageEvalCaseResult] = []
    db = SessionLocal()
    try:
        for row in rows:
            started = time.perf_counter()
            image_id = row.get("image_id") or Path(row.get("file_path", "")).stem
            raw_file_path = row.get("file_path") or ""
            image_path = _resolve(raw_file_path, base=BACKEND_DIR)
            expected_item_id = _optional_int(row.get("expected_item_id"))
            expected_label = (row.get("expected_label") or "").strip() or None
            group_id = _optional_int(row.get("group_id"))
            difficulty = (row.get("difficulty") or "").strip() or None

            try:
                content = image_path.read_bytes()
                vectors = embedding.extract_vectors_augmented(content, augment=USE_AUGMENTATION)
                scoped_item_ids: list[int] | None = None
                if group_id is not None:
                    scoped_item_ids = [
                        item_id
                        for (item_id,) in db.query(Item.id).filter(Item.group_id == group_id).all()
                    ]
                matches = chroma.search_top_items(vectors, item_ids=scoped_item_ids)
                best = matches[0] if matches else None
                predicted_item_id = best.item_id if best else None
                similarity = round(float(best.similarity), 4) if best else None
                predicted_label = None
                if predicted_item_id is not None and (similarity or 0) >= SIMILARITY_THRESHOLD:
                    item = db.query(Item).filter(Item.id == predicted_item_id).first()
                    predicted_label = item.name if item else None
                else:
                    predicted_item_id = None

                correct = False
                if expected_item_id is not None:
                    correct = predicted_item_id == expected_item_id
                elif expected_label is not None:
                    correct = _label_match(expected_label, predicted_label)

                results.append(
                    ImageEvalCaseResult(
                        image_id=image_id,
                        file_path=str(image_path),
                        expected_item_id=expected_item_id,
                        expected_label=expected_label,
                        predicted_item_id=predicted_item_id,
                        predicted_label=predicted_label,
                        similarity=similarity,
                        correct=correct,
                        latency_ms=int((time.perf_counter() - started) * 1000),
                        difficulty=difficulty,
                    )
                )
            except Exception as exc:
                results.append(
                    ImageEvalCaseResult(
                        image_id=image_id,
                        file_path=str(image_path),
                        expected_item_id=expected_item_id,
                        expected_label=expected_label,
                        predicted_item_id=None,
                        predicted_label=None,
                        similarity=None,
                        correct=False,
                        latency_ms=int((time.perf_counter() - started) * 1000),
                        difficulty=difficulty,
                        error=type(exc).__name__,
                    )
                )
    finally:
        db.close()

    total = len(results)
    correct = sum(1 for result in results if result.correct)
    latencies = [result.latency_ms for result in results]
    by_difficulty: dict[str, dict[str, float | int]] = {}
    for result in results:
        key = result.difficulty or "unknown"
        bucket = by_difficulty.setdefault(key, {"total": 0, "correct": 0, "top1_accuracy": 0.0})
        bucket["total"] = int(bucket["total"]) + 1
        bucket["correct"] = int(bucket["correct"]) + (1 if result.correct else 0)
    for bucket in by_difficulty.values():
        total_bucket = int(bucket["total"])
        bucket["top1_accuracy"] = round(int(bucket["correct"]) / total_bucket, 4) if total_bucket else 0.0

    return {
        "labels_path": str(labels_path),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_images": total,
        "correct": correct,
        "top1_accuracy": round(correct / total, 4) if total else 0.0,
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
        "by_difficulty": by_difficulty,
        "failed_cases": [asdict(result) for result in results if not result.correct][:50],
        "cases": [asdict(result) for result in results],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# HERA Image Recognition Eval Report",
        "",
        f"- **Labels:** `{report['labels_path']}`",
        f"- **Generated at:** {report['generated_at']}",
        f"- **Total images:** {report['total_images']}",
        f"- **Correct:** {report['correct']}",
        f"- **Top-1 accuracy:** {report['top1_accuracy']:.1%}",
        f"- **Average latency:** {report['avg_latency_ms']:.1f} ms",
        "",
        "## Accuracy by difficulty",
        "",
        "| Difficulty | Correct | Total | Accuracy |",
        "|---|---:|---:|---:|",
    ]
    for difficulty, row in sorted(report["by_difficulty"].items()):
        lines.append(
            f"| {difficulty} | {row['correct']} | {row['total']} | {float(row['top1_accuracy']):.1%} |"
        )
    lines.extend(["", "## Failed cases", "", "| Image | Expected | Predicted | Similarity | Error |", "|---|---|---|---:|---|"])
    for row in report["failed_cases"][:30]:
        expected = row.get("expected_label") or row.get("expected_item_id") or "—"
        predicted = row.get("predicted_label") or row.get("predicted_item_id") or "—"
        similarity = row.get("similarity")
        lines.append(
            f"| {row['image_id']} | {expected} | {predicted} | {similarity if similarity is not None else '—'} | {row.get('error') or '—'} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Top-1 image recognition eval for HERA.")
    parser.add_argument("--labels", default="evals/golden/images/labels.csv")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--output-json", default="../docs/reports/image_eval_results.json")
    parser.add_argument("--output-md", default="../docs/reports/image_eval_report.md")
    args = parser.parse_args()

    labels_path = _resolve(args.labels)
    report = run_image_eval(labels_path, limit=args.limit)
    json_path = _resolve(args.output_json)
    md_path = _resolve(args.output_md)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    print(f"Image eval JSON written to {json_path}")
    print(f"Image eval Markdown written to {md_path}")


if __name__ == "__main__":
    main()
