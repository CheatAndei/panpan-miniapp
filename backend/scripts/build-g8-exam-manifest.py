#!/usr/bin/env python3
"""Build a read-only, auditable manifest for teacher-provided Guangzhou G8-S1 exams."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


SUPPORTED_SUFFIXES = {".doc", ".docx", ".pdf"}
ANSWER_RE = re.compile(r"解析版|答案|参考答案|全解全析|解答")
ORIGINAL_RE = re.compile(r"原卷|题目版|试题|试卷|真卷|考试版|练习|复习卷|模拟卷|训练卷")
ANSWER_CARD_RE = re.compile(r"答题卡")
MOCK_RE = re.compile(r"模拟|复习|培优|练习|训练卷|堂上练习")
SCHOOL_YEAR_RE = re.compile(r"(20\d{2})\s*[-~—至－]\s*(20\d{2})")
DISTRICT_RE = re.compile(
    r"广州市?(越秀区|海珠区|荔湾区|天河区|白云区|黄埔区|番禺区|花都区|南沙区|"
    r"从化区|增城区)"
)


@dataclass(frozen=True)
class Pair:
    paper: Path
    answer: Path | None
    paper_candidates: tuple[Path, ...]
    answer_candidates: tuple[Path, ...]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalized_name(path: Path) -> str:
    return re.sub(r"\s+", "", path.name)


def is_answer(path: Path) -> bool:
    name = normalized_name(path)
    return bool(ANSWER_RE.search(name) and "原卷版" not in name and "题目版" not in name)


def is_answer_card(path: Path) -> bool:
    return bool(ANSWER_CARD_RE.search(normalized_name(path)))


def is_paper(path: Path) -> bool:
    return not is_answer(path) and not is_answer_card(path) and bool(ORIGINAL_RE.search(normalized_name(path)))


def paper_score(path: Path) -> tuple[int, int, int, int, str]:
    name = normalized_name(path)
    suffix_score = {".pdf": 0, ".docx": 10, ".doc": 20}.get(path.suffix.lower(), 30)
    authority_score = 0 if re.search(r"原卷版|题目版", name) else 3
    page_score = 5 if "A3" in name else 0
    simulation_score = 3 if MOCK_RE.search(name) else 0
    return suffix_score, authority_score, page_score, simulation_score, name


def answer_score(path: Path) -> tuple[int, int, str]:
    name = normalized_name(path)
    suffix_score = {".pdf": 0, ".docx": 5, ".doc": 10}.get(path.suffix.lower(), 20)
    detail_score = 0 if re.search(r"解析版|全解全析", name) else 3
    return suffix_score, detail_score, name


def classify_group(files: list[Path]) -> Pair | None:
    papers = tuple(sorted((path for path in files if is_paper(path)), key=paper_score))
    answers = tuple(sorted((path for path in files if is_answer(path)), key=answer_score))
    if not papers:
        return None
    return Pair(paper=papers[0], answer=answers[0] if answers else None, paper_candidates=papers, answer_candidates=answers)


def exam_period(relative: str) -> str:
    if "期末" in relative:
        return "final"
    if "期中" in relative:
        return "midterm"
    return "monthly"


def period_label(period: str) -> str:
    return {"final": "期末", "midterm": "期中", "monthly": "月考"}[period]


def school_year(text: str) -> tuple[str, int | None, str]:
    match = SCHOOL_YEAR_RE.search(text)
    if not match:
        return "", None, "年份待核"
    start, end = match.groups()
    return f"{start}-{end}", int(start), f"{start[-2:]}–{end[-2:]}"


def district(text: str) -> str:
    match = DISTRICT_RE.search(text)
    return match.group(1) if match else ""


def school_name(text: str) -> str:
    normalized = (
        text.replace("精品解析：", "")
        .replace("精品解析:", "")
        .replace("广东省", "")
        .replace("广州市广州市", "广州市")
    )
    school_match = re.search(r"(?:广州市|广州)([^0-9（）()]{2,42}?(?:中学|学校|书院|教育集团|联考))", normalized)
    if school_match:
        return school_match.group(1).replace("市", "", 1).strip()
    district_name = district(normalized)
    if district_name:
        return district_name
    fallback = re.split(r"20\d{2}|八年级|数学|试题|试卷", normalized)[0]
    fallback = re.sub(r"[：:（）()_+]", "", fallback).removeprefix("广州市").removeprefix("广州").strip()
    return fallback[:32] or "广州题源"


def asset_row(path: Path) -> dict:
    stat = path.stat()
    return {
        "name": path.name,
        "sha256": sha256(path),
        "byte_size": stat.st_size,
        "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def stable_code(relative: str, period: str) -> str:
    period_code = {"final": "FIN", "midterm": "MID", "monthly": "MON"}[period]
    suffix = hashlib.sha1(relative.replace("\\", "/").encode("utf-8")).hexdigest()[:10].upper()
    return f"GZ8-{period_code}-{suffix}"


def build(source_root: Path) -> tuple[dict, dict]:
    files = sorted(
        (
            path
            for path in source_root.rglob("*")
            if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES
        ),
        key=lambda path: str(path).lower(),
    )
    groups: dict[Path, list[Path]] = {}
    for path in files:
        groups.setdefault(path.parent, []).append(path)

    papers: list[dict] = []
    exceptions: list[dict] = []
    for directory, group in sorted(groups.items(), key=lambda item: str(item[0]).lower()):
        pair = classify_group(group)
        relative_directory = directory.relative_to(source_root).as_posix()
        if pair is None:
            exceptions.append(
                {
                    "directory": relative_directory,
                    "reason": "missing_paper",
                    "files": [path.name for path in group],
                }
            )
            continue
        relative = pair.paper.relative_to(source_root).as_posix()
        period = exam_period(relative)
        context = f"{directory.name} {pair.paper.name}"
        year_label, year, year_short = school_year(context)
        source_kind = "mock_or_review" if MOCK_RE.search(context) else "guangzhou_exam"
        area = district(context)
        school = school_name(context)
        code = stable_code(relative, period)
        row = {
            "stable_code": code,
            "display_title": f"{school} · {year_short} · 八上{period_label(period)}",
            "school_name": school,
            "district": area,
            "school_year": year_label,
            "exam_year": year,
            "grade": "八年级",
            "grade_code": "g8",
            "subject_code": "math",
            "semester": "上学期",
            "semester_code": "s1",
            "exam_type": period,
            "exam_period": period,
            "source_kind": source_kind,
            "source_relative_path": relative,
            "license_status": "teacher_provided",
            "paper": asset_row(pair.paper),
            "answer": asset_row(pair.answer) if pair.answer else None,
        }
        papers.append(row)
        if pair.answer is None:
            exceptions.append(
                {
                    "stable_code": code,
                    "directory": relative_directory,
                    "reason": "missing_answer",
                    "selected_paper": pair.paper.name,
                }
            )
        if len(pair.paper_candidates) > 1 or len(pair.answer_candidates) > 1:
            exceptions.append(
                {
                    "stable_code": code,
                    "directory": relative_directory,
                    "reason": "multiple_candidates",
                    "selected_paper": pair.paper.name,
                    "selected_answer": pair.answer.name if pair.answer else None,
                    "paper_candidates": [path.name for path in pair.paper_candidates],
                    "answer_candidates": [path.name for path in pair.answer_candidates],
                }
            )
        if year is None:
            exceptions.append(
                {
                    "stable_code": code,
                    "directory": relative_directory,
                    "reason": "unknown_exam_year",
                }
            )

    papers.sort(
        key=lambda item: (
            item["exam_period"],
            -int(item["exam_year"] or 0),
            item["source_kind"],
            item["display_title"],
            item["stable_code"],
        )
    )
    source_kind_counts = Counter(item["source_kind"] for item in papers)
    period_counts = Counter(item["exam_period"] for item in papers)
    year_counts = Counter(str(item["exam_year"] or "unknown") for item in papers)
    summary = {
        "raw_files": len(files),
        "candidate_papers": len(papers),
        "paired_papers": sum(item["answer"] is not None for item in papers),
        "paper_only": sum(item["answer"] is None for item in papers),
        "source_kinds": dict(sorted(source_kind_counts.items())),
        "exam_periods": dict(sorted(period_counts.items())),
        "exam_years": dict(sorted(year_counts.items())),
        "extensions": dict(sorted(Counter(path.suffix.lower() for path in files).items())),
        "exceptions": len(exceptions),
    }
    manifest = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "source_root": str(source_root),
        "grade_code": "g8",
        "subject_code": "math",
        "semester_code": "s1",
        "summary": summary,
        "papers": papers,
    }
    review = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "summary": summary,
        "exceptions": exceptions,
    }
    return manifest, review


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--review-output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_root = args.source_root.resolve()
    if not source_root.is_dir():
        raise SystemExit(f"source root missing: {source_root}")
    manifest, review = build(source_root)
    write_json(args.output.resolve(), manifest)
    write_json(args.review_output.resolve(), review)
    print(json.dumps({"ok": True, **manifest["summary"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
