#!/usr/bin/env python3
"""Build the Choice King image bank from WPS-exported exam PDFs.

The script is deterministic and restartable. It scans original/answer PDF pairs,
reads A-D answers from the analysis PDFs, crops the matching question regions
from the original PDFs, and writes a manifest consumed by the backend loader.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image


QUESTION_RE = re.compile(r"^\s*(\d{1,2})\s*[.．、]\s*")
ANSWER_RE = re.compile(r"【答案】\s*([A-D])(?:\b|[．。])", re.IGNORECASE)
OPTION_RE = re.compile(r"(?<![A-Za-z])([ABCD])\s*[.．、]\s*", re.IGNORECASE)
WATERMARK_RE = re.compile(r"微信[:：].*?(?:真题卷|期中期末|名校).*", re.IGNORECASE)


@dataclass(frozen=True)
class Line:
    page: int
    top: float
    bottom: float
    x0: float
    x1: float
    text: str


@dataclass
class PdfLayout:
    lines: list[Line]
    page_sizes: list[tuple[float, float]]


@dataclass
class AnswerRecord:
    number: int
    anchor_index: int
    answer_index: int
    end_index: int
    correct_option: str
    explanation: str


@dataclass
class Candidate:
    paper: dict
    question_number: int
    original_pdf: Path
    start: Line
    end: Line
    page_sizes: list[tuple[float, float]]
    question_text: str
    options: dict[str, str]
    correct_option: str
    explanation: str
    signature: str
    source_period: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_space(value: str) -> str:
    value = WATERMARK_RE.sub(" ", value or "")
    value = value.replace("\uf0b4", "×").replace("\uf02d", "−")
    return re.sub(r"\s+", " ", value).strip()


def public_text(value: str, limit: int) -> str:
    return normalize_space(value).replace("\u0000", "")[:limit]


def stable_digest(value: str) -> str:
    normalized = re.sub(r"\s+", "", normalize_space(value)).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def json_event(**payload: object) -> None:
    payload["timestamp"] = utc_now()
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), flush=True)


def extract_layout(pdf_path: Path) -> PdfLayout:
    lines: list[Line] = []
    page_sizes: list[tuple[float, float]] = []
    with pdfplumber.open(str(pdf_path)) as document:
        for page_index, page in enumerate(document.pages):
            page_sizes.append((float(page.width), float(page.height)))
            words = page.extract_words(
                use_text_flow=True,
                keep_blank_chars=False,
                x_tolerance=2,
                y_tolerance=2,
            )
            rows: list[dict] = []
            for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
                row = next(
                    (item for item in reversed(rows[-4:]) if abs(item["top"] - word["top"]) <= 3.2),
                    None,
                )
                if row is None:
                    row = {"top": float(word["top"]), "words": []}
                    rows.append(row)
                row["words"].append(word)
            for row in sorted(rows, key=lambda item: item["top"]):
                row_words = sorted(row["words"], key=lambda item: item["x0"])
                text = normalize_space(" ".join(item["text"] for item in row_words))
                if not text:
                    continue
                lines.append(
                    Line(
                        page=page_index,
                        top=min(float(item["top"]) for item in row_words),
                        bottom=max(float(item["bottom"]) for item in row_words),
                        x0=min(float(item["x0"]) for item in row_words),
                        x1=max(float(item["x1"]) for item in row_words),
                        text=text,
                    )
                )
    return PdfLayout(lines=lines, page_sizes=page_sizes)


def choice_bounds(lines: list[Line]) -> tuple[int, int] | None:
    explicit = [
        index
        for index, line in enumerate(lines)
        if re.search(r"^[一二三四五六]+、.*选择题", line.text)
    ]
    if explicit:
        start = explicit[0] + 1
    else:
        fallback = [
            index
            for index, line in enumerate(lines)
            if "选择题" in line.text and ("第一部分" in line.text or "本大题" in line.text)
        ]
        if not fallback:
            return None
        start = fallback[-1] + 1
    for index in range(start, len(lines)):
        text = lines[index].text
        if "填空题" in text or ("第二部分" in text and "非选择题" in text):
            return start, index
    return start, len(lines)


def has_option_sequence(text: str) -> bool:
    labels = [match.group(1).upper() for match in OPTION_RE.finditer(text)]
    cursor = 0
    for label in labels:
        if label == "ABCD"[cursor]:
            cursor += 1
            if cursor == 4:
                return True
    return False


def parse_options(text: str) -> dict[str, str] | None:
    matches = list(OPTION_RE.finditer(text))
    sequence: list[re.Match[str]] = []
    cursor = 0
    for match in matches:
        label = match.group(1).upper()
        if label == "ABCD"[cursor]:
            sequence.append(match)
            cursor += 1
            if cursor == 4:
                break
    if len(sequence) != 4:
        return None
    output: dict[str, str] = {}
    for index, label in enumerate("ABCD"):
        start = sequence[index].end()
        end = sequence[index + 1].start() if index < 3 else len(text)
        value = public_text(text[start:end], 240)
        if not value:
            return None
        output[label] = value
    return output


def answer_records(layout: PdfLayout) -> dict[int, AnswerRecord]:
    bounds = choice_bounds(layout.lines)
    if bounds is None:
        return {}
    start, end = bounds
    answers: list[tuple[int, int, int, str]] = []
    previous_answer = start - 1
    for answer_index in range(start, end):
        match = ANSWER_RE.search(layout.lines[answer_index].text)
        if not match:
            continue
        anchor_candidates: list[tuple[int, int]] = []
        for anchor_index in range(previous_answer + 1, answer_index):
            question = QUESTION_RE.match(layout.lines[anchor_index].text)
            if question:
                anchor_candidates.append((anchor_index, int(question.group(1))))
        if not anchor_candidates:
            continue
        # The real question heading is normally the last numbered line before
        # its immediate answer marker. Requiring A-D between them rejects most
        # numbered explanation steps.
        selected: tuple[int, int] | None = None
        for anchor_index, number in reversed(anchor_candidates):
            block = " ".join(line.text for line in layout.lines[anchor_index:answer_index])
            if has_option_sequence(block):
                selected = (anchor_index, number)
                break
        if selected is None:
            continue
        answers.append((selected[1], selected[0], answer_index, match.group(1).upper()))
        previous_answer = answer_index

    records: dict[int, AnswerRecord] = {}
    for index, (number, anchor_index, answer_index, option) in enumerate(answers):
        next_anchor = answers[index + 1][1] if index + 1 < len(answers) else end
        explanation_lines = [line.text for line in layout.lines[answer_index + 1 : next_anchor]]
        explanation = " ".join(explanation_lines)
        detail = re.search(r"【详解】\s*(.*)", explanation, re.DOTALL)
        analysis = re.search(r"【分析】\s*(.*)", explanation, re.DOTALL)
        explanation = detail.group(1) if detail else analysis.group(1) if analysis else explanation
        records[number] = AnswerRecord(
            number=number,
            anchor_index=anchor_index,
            answer_index=answer_index,
            end_index=next_anchor,
            correct_option=option,
            explanation=public_text(explanation, 1600),
        )
    return records


def original_segments(layout: PdfLayout, expected_numbers: Iterable[int]) -> dict[int, tuple[Line, Line, str, dict[str, str]]]:
    bounds = choice_bounds(layout.lines)
    if bounds is None:
        return {}
    start, end = bounds
    expected = set(expected_numbers)
    anchors: list[tuple[int, int]] = []
    next_number = 1
    for index in range(start, end):
        match = QUESTION_RE.match(layout.lines[index].text)
        if not match:
            continue
        number = int(match.group(1))
        # Bound every crop by the next question, even when that next question
        # was quarantined because its answer/options could not be verified.
        if number == next_number:
            anchors.append((index, number))
            next_number += 1
    anchors.sort(key=lambda item: item[0])
    segments: dict[int, tuple[Line, Line, str, dict[str, str]]] = {}
    for position, (anchor_index, number) in enumerate(anchors):
        if number not in expected:
            continue
        next_index = anchors[position + 1][0] if position + 1 < len(anchors) else end
        text = " ".join(line.text for line in layout.lines[anchor_index:next_index])
        options = parse_options(text)
        if options is None:
            continue
        first_option = next((match for match in OPTION_RE.finditer(text) if match.group(1).upper() == "A"), None)
        stem = public_text(text[: first_option.start()] if first_option else text, 1000)
        if len(stem) < 5:
            continue
        segments[number] = (
            layout.lines[anchor_index],
            layout.lines[next_index] if next_index < len(layout.lines) else layout.lines[-1],
            stem,
            options,
        )
    return segments


def candidate_from_paper(paper: dict, pdf_root: Path, recent_from: int) -> tuple[list[Candidate], list[dict]]:
    code = str(paper.get("stable_code") or "")
    original_pdf = pdf_root / "original" / f"{code}.pdf"
    answer_pdf = pdf_root / "answer" / f"{code}.pdf"
    review: list[dict] = []
    try:
        year = int(paper.get("exam_year") or 0)
    except (TypeError, ValueError):
        year = 0
    if year < 2000 or year > 2100:
        review.append({"stable_code": code, "reason": "unknown_exam_year"})
        return [], review
    if not original_pdf.exists() or not answer_pdf.exists():
        review.append(
            {
                "stable_code": code,
                "reason": "missing_pdf_pair",
                "original_exists": original_pdf.exists(),
                "answer_exists": answer_pdf.exists(),
            }
        )
        return [], review
    try:
        answer_layout = extract_layout(answer_pdf)
        records = answer_records(answer_layout)
        if not records:
            review.append({"stable_code": code, "reason": "no_choice_answers"})
            return [], review
        original_layout = extract_layout(original_pdf)
        segments = original_segments(original_layout, records.keys())
    except Exception as exc:  # noqa: BLE001 - review list is the quarantine boundary
        review.append({"stable_code": code, "reason": "pdf_parse_error", "error": str(exc)})
        return [], review

    candidates: list[Candidate] = []
    source_period = "recent" if year >= recent_from else "older"
    for number, record in records.items():
        if number not in segments:
            review.append({"stable_code": code, "question_number": number, "reason": "question_crop_not_found"})
            continue
        start, end, stem, options = segments[number]
        signature = stable_digest(stem + "|" + "|".join(options.values()))
        candidates.append(
            Candidate(
                paper=paper,
                question_number=number,
                original_pdf=original_pdf,
                start=start,
                end=end,
                page_sizes=original_layout.page_sizes,
                question_text=stem,
                options=options,
                correct_option=record.correct_option,
                explanation=record.explanation,
                signature=signature,
                source_period=source_period,
            )
        )
    return candidates, review


def round_robin_select(candidates: list[Candidate], target: int) -> list[Candidate]:
    by_paper: dict[str, deque[Candidate]] = defaultdict(deque)
    for candidate in sorted(candidates, key=lambda item: (item.paper["stable_code"], item.question_number)):
        by_paper[candidate.paper["stable_code"]].append(candidate)
    paper_order = sorted(
        by_paper,
        key=lambda code: hashlib.sha256(code.encode("utf-8")).hexdigest(),
    )
    selected: list[Candidate] = []
    while len(selected) < target:
        progressed = False
        for code in paper_order:
            if by_paper[code]:
                selected.append(by_paper[code].popleft())
                progressed = True
                if len(selected) >= target:
                    break
        if not progressed:
            break
    return selected


def crop_boxes(candidate: Candidate) -> list[tuple[int, float, float, float, float]]:
    start_page = candidate.start.page
    end_page = candidate.end.page
    boxes: list[tuple[int, float, float, float, float]] = []
    for page_index in range(start_page, end_page + 1):
        width, height = candidate.page_sizes[page_index]
        left = 34.0
        right = max(left + 20.0, width - 34.0)
        top = 54.0
        bottom = height - 68.0
        if page_index == start_page:
            top = max(34.0, candidate.start.top - 9.0)
        if page_index == end_page:
            bottom = min(bottom, candidate.end.top - 8.0)
        if bottom - top >= 8:
            boxes.append((page_index, left, top, right, bottom))
    return boxes


def render_question(candidate: Candidate, output_path: Path, scale: float, force: bool) -> None:
    if output_path.exists() and output_path.stat().st_size > 1024 and not force:
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    document = pdfium.PdfDocument(str(candidate.original_pdf))
    fragments: list[Image.Image] = []
    try:
        for page_index, left, top, right, bottom in crop_boxes(candidate):
            page = document[page_index]
            bitmap = page.render(scale=scale)
            image = bitmap.to_pil().convert("RGB")
            box = (
                max(0, round(left * scale)),
                max(0, round(top * scale)),
                min(image.width, round(right * scale)),
                min(image.height, round(bottom * scale)),
            )
            if box[2] > box[0] and box[3] > box[1]:
                fragments.append(image.crop(box))
            bitmap.close()
            page.close()
    finally:
        document.close()
    if not fragments:
        raise RuntimeError("no renderable crop fragments")
    width = max(fragment.width for fragment in fragments)
    gap = 12
    height = sum(fragment.height for fragment in fragments) + gap * (len(fragments) - 1)
    combined = Image.new("RGB", (width, height), "white")
    cursor = 0
    for fragment in fragments:
        combined.paste(fragment, (0, cursor))
        cursor += fragment.height + gap
    temp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    combined.save(temp_path, format="WEBP", quality=92, method=6)
    temp_path.replace(output_path)


def manifest_row(candidate: Candidate, image_relative: str) -> dict:
    code = str(candidate.paper["stable_code"])
    question_code = f"{code}-Q{candidate.question_number:02d}"
    return {
        "source_key": question_code,
        "source_year": int(candidate.paper.get("exam_year") or 0),
        "recent_bucket": candidate.source_period,
        "source_question_no": candidate.question_number,
        "question_image": image_relative,
        # The original-paper crop is authoritative for formulas and figures.
        # Keep the tap targets deliberately simple instead of showing a second,
        # potentially lossy PDF-text transcription below the image.
        "stem": "",
        "options": {label: f"选择 {label}" for label in "ABCD"},
        "source_options": candidate.options,
        "correct_option": candidate.correct_option,
        "explanation": candidate.explanation,
        "source_label": candidate.paper.get("display_title") or code,
        "exam_stable_code": code,
        "signature": candidate.signature,
        "is_active": 1,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the 1000-question Choice King image bank")
    parser.add_argument("--exam-manifest", type=Path, default=Path(__file__).resolve().parent.parent / "resources" / "exam-library-manifest.json")
    parser.add_argument("--pdf-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent.parent / "resources" / "choice-king")
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--recent-count", type=int, default=500)
    parser.add_argument("--recent-from", type=int, default=2024)
    parser.add_argument("--limit-papers", type=int, default=0)
    parser.add_argument("--render-scale", type=float, default=2.2)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.count < 1 or args.recent_count < 0 or args.recent_count > args.count:
        raise SystemExit("invalid --count/--recent-count combination")
    manifest = json.loads(args.exam_manifest.read_text(encoding="utf-8-sig"))
    papers = list(manifest.get("papers") or [])
    if args.limit_papers > 0:
        papers = papers[: args.limit_papers]
    all_candidates: list[Candidate] = []
    review: list[dict] = []
    seen_signatures: set[str] = set()
    json_event(phase="scan_start", papers=len(papers), pdf_root=str(args.pdf_root))
    for index, paper in enumerate(papers, start=1):
        candidates, issues = candidate_from_paper(paper, args.pdf_root, args.recent_from)
        review.extend(issues)
        for candidate in candidates:
            if candidate.signature in seen_signatures:
                review.append(
                    {
                        "stable_code": paper.get("stable_code"),
                        "question_number": candidate.question_number,
                        "reason": "duplicate_question",
                        "signature": candidate.signature,
                    }
                )
                continue
            seen_signatures.add(candidate.signature)
            all_candidates.append(candidate)
        if index % 10 == 0 or index == len(papers):
            json_event(phase="scan_progress", processed=index, papers=len(papers), candidates=len(all_candidates), review=len(review))

    recent = [candidate for candidate in all_candidates if candidate.source_period == "recent"]
    older = [candidate for candidate in all_candidates if candidate.source_period == "older"]
    older_target = args.count - args.recent_count
    if len(recent) < args.recent_count or len(older) < older_target:
        report = {
            "generated_at": utc_now(),
            "requested": {"total": args.count, "recent": args.recent_count, "older": older_target},
            "available": {"total": len(all_candidates), "recent": len(recent), "older": len(older)},
            "review": review,
        }
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / "build-review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise SystemExit(
            f"not enough verified questions: recent {len(recent)}/{args.recent_count}, older {len(older)}/{older_target}"
        )

    recent_pool = round_robin_select(recent, len(recent))
    older_pool = round_robin_select(older, len(older))
    selected = recent_pool[: args.recent_count] + older_pool[:older_target]
    if args.dry_run:
        json_event(phase="complete", dry_run=True, available_recent=len(recent), available_older=len(older), selected=len(selected))
        return 0

    question_dir = args.output / "questions"
    rows: list[dict] = []
    render_review: list[dict] = []
    attempted_renders = 0
    for source_period, pool, target_count in (
        ("recent", recent_pool, args.recent_count),
        ("older", older_pool, older_target),
    ):
        rendered_for_period = 0
        for candidate in pool:
            if rendered_for_period >= target_count:
                break
            attempted_renders += 1
            file_name = f"{candidate.paper['stable_code']}-Q{candidate.question_number:02d}.webp"
            target = question_dir / file_name
            try:
                render_question(candidate, target, args.render_scale, args.force)
                rows.append(manifest_row(candidate, f"questions/{file_name}"))
                rendered_for_period += 1
            except Exception as exc:  # noqa: BLE001 - quarantine failed images
                render_review.append(
                    {
                        "stable_code": candidate.paper["stable_code"],
                        "question_number": candidate.question_number,
                        "source_period": source_period,
                        "reason": "render_error",
                        "error": str(exc),
                    }
                )
            if attempted_renders % 25 == 0 or rendered_for_period == target_count:
                json_event(
                    phase="render_progress",
                    attempted=attempted_renders,
                    rendered=len(rows),
                    rendered_period=rendered_for_period,
                    target_period=target_count,
                    source_period=source_period,
                    failed=len(render_review),
                )

    review.extend(render_review)
    if len(rows) != args.count:
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / "build-review.json").write_text(json.dumps({"review": review}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise SystemExit(f"rendered {len(rows)}/{args.count} after exhausting verified reserves; failed items were quarantined")
    output = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "source": "teacher_provided_guangzhou_exam_library",
        "selection": {
            "total": args.count,
            "recent": args.recent_count,
            "older": older_target,
            "recent_from": args.recent_from,
            "available_recent": len(recent),
            "available_older": len(older),
        },
        "questions": rows,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    temp_manifest = args.output / "manifest.json.tmp"
    temp_manifest.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp_manifest.replace(args.output / "manifest.json")
    (args.output / "build-review.json").write_text(json.dumps({"generated_at": utc_now(), "review": review}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    json_event(phase="complete", rendered=len(rows), recent=args.recent_count, older=older_target, review=len(review), output=str(args.output))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        json_event(phase="interrupted")
        raise
