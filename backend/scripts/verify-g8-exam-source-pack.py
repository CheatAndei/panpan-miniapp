#!/usr/bin/env python3
"""Verify G8 source-pack counts, images, scopes and provenance."""

from __future__ import annotations

import argparse
import importlib.util
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"invalid object: {path}")
    return value


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_base_verifier():
    path = Path(__file__).with_name("verify-question-bank.py")
    spec = importlib.util.spec_from_file_location("panpan_question_bank_verifier", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load verifier: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_metadata(
    rows: list[dict],
    *,
    row_kind: str,
    scope_keys: set[str],
    exam_by_code: dict[str, dict],
) -> list[str]:
    errors: list[str] = []
    for index, item in enumerate(rows, start=1):
        label = f"{row_kind}[{index}] {item.get('source_key')}"
        if item.get("grade_code") != "g8" or item.get("subject_code") != "math":
            errors.append(f"{label}: wrong grade/subject")
        topics = item.get("topic_keys")
        if not isinstance(topics, list) or not topics:
            errors.append(f"{label}: topic_keys missing")
        elif any(key not in scope_keys for key in topics):
            errors.append(f"{label}: unknown topic key")
        if item.get("topic_match_policy") != "all_selected":
            errors.append(f"{label}: topic match policy must be all_selected")
        code = str(item.get("exam_stable_code") or "")
        exam = exam_by_code.get(code)
        if exam is None:
            errors.append(f"{label}: unknown exam {code}")
        elif exam.get("answer") is None:
            errors.append(f"{label}: extracted from paper without verified answer")
        if row_kind == "choice" and not str(item.get("source_key") or "").startswith("GZ8-"):
            errors.append(f"{label}: choice source key is not GZ8")
        if row_kind == "terminal" and not str(item.get("source_key") or "").startswith("gz8-terminal-"):
            errors.append(f"{label}: terminal source key is not gz8-terminal")
        for field in (
            "source_original_page_start",
            "source_original_page_end",
            "source_answer_page_start",
            "source_answer_page_end",
        ):
            if int(item.get(field) or 0) < 1:
                errors.append(f"{label}: invalid {field}")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exam-manifest", type=Path, required=True)
    parser.add_argument("--choice-root", type=Path, required=True)
    parser.add_argument("--terminal-root", type=Path, required=True)
    parser.add_argument("--scope-catalog", type=Path, required=True)
    parser.add_argument("--classification-review", type=Path, required=True)
    parser.add_argument("--audit-output", type=Path, required=True)
    parser.add_argument("--contact-output", type=Path, required=True)
    parser.add_argument("--choice-count", type=int, default=1000)
    parser.add_argument("--recent-count", type=int, default=500)
    parser.add_argument("--sample-count", type=int, default=125)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    verifier = load_base_verifier()
    choice_manifest, choice_images, choice_errors = verifier.verify_choice(
        args.choice_root, args.choice_count, args.recent_count
    )
    terminal_manifest, terminal_images, terminal_errors = verifier.verify_terminal(args.terminal_root)
    sheets = []
    sheets.extend(
        verifier.contact_sheets(choice_images, args.contact_output, "g8-choice", args.sample_count)
    )
    sheets.extend(
        verifier.contact_sheets(terminal_images, args.contact_output, "g8-terminal", args.sample_count)
    )

    exam_manifest = load_json(args.exam_manifest)
    catalog = load_json(args.scope_catalog)
    classification_review = load_json(args.classification_review)
    papers = exam_manifest.get("papers") or []
    exam_by_code = {str(item["stable_code"]): item for item in papers}
    scope_keys = {str(item["key"]) for item in catalog.get("scopes") or []}
    metadata_errors = validate_metadata(
        choice_manifest["questions"],
        row_kind="choice",
        scope_keys=scope_keys,
        exam_by_code=exam_by_code,
    )
    metadata_errors.extend(
        validate_metadata(
            terminal_manifest["questions"],
            row_kind="terminal",
            scope_keys=scope_keys,
            exam_by_code=exam_by_code,
        )
    )

    all_rows = choice_manifest["questions"] + terminal_manifest["questions"]
    scope_counts: Counter[str] = Counter()
    primary_scope_counts: Counter[str] = Counter()
    source_kind_counts: Counter[str] = Counter()
    confidence_counts: Counter[str] = Counter()
    exam_period_counts: Counter[str] = Counter()
    source_exam_counts: Counter[str] = Counter()
    for item in all_rows:
        scope_counts.update(item.get("topic_keys") or [])
        primary_scope_counts.update([str(item.get("primary_topic_key") or "")])
        source_kind_counts.update([str(item.get("source_kind") or "")])
        confidence_counts.update([str(item.get("scope_confidence") or "")])
        code = str(item.get("exam_stable_code") or "")
        source_exam_counts.update([code])
        exam_period_counts.update([str(exam_by_code.get(code, {}).get("exam_period") or "")])

    source_summary = exam_manifest.get("summary") or {}
    if int(source_summary.get("candidate_papers") or 0) < 1:
        metadata_errors.append("exam manifest has no candidate papers")
    if int(source_summary.get("paired_papers") or 0) < 1:
        metadata_errors.append("exam manifest has no paired papers")
    if catalog.get("selection_policy") != "all_selected":
        metadata_errors.append("scope catalog selection_policy must be all_selected")

    errors = choice_errors + terminal_errors + metadata_errors
    audit = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "ok": not errors,
        "source": source_summary,
        "choice": {
            "count": len(choice_manifest["questions"]),
            "images": len(choice_images),
            "selection": choice_manifest.get("selection"),
        },
        "terminal": {
            "count": len(terminal_manifest["questions"]),
            "images": len(terminal_images),
            "counts": terminal_manifest.get("counts"),
            "papers_with_output": len({item["exam_stable_code"] for item in terminal_manifest["questions"]}),
        },
        "classification": {
            "scope_counts": dict(sorted(scope_counts.items())),
            "primary_scope_counts": dict(sorted(primary_scope_counts.items())),
            "source_kind_counts": dict(sorted(source_kind_counts.items())),
            "confidence_counts": dict(sorted(confidence_counts.items())),
            "exam_period_counts": dict(sorted(exam_period_counts.items())),
            "review_summary": classification_review.get("summary") or {},
        },
        "provenance": {
            "source_exams_used": len(source_exam_counts),
            "questions_by_exam_min": min(source_exam_counts.values()) if source_exam_counts else 0,
            "questions_by_exam_max": max(source_exam_counts.values()) if source_exam_counts else 0,
        },
        "contact_sheets": [str(path) for path in sheets],
        "errors": errors,
    }
    write_json(args.audit_output, audit)
    print(json.dumps(audit, ensure_ascii=False, indent=2))
    return 0 if audit["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
