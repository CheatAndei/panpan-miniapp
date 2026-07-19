#!/usr/bin/env python3
"""Build terminal-challenge crops from WPS-exported exam PDF pairs.

For every verified paper the builder keeps, at most, the final fill-in question
and the final two subjective questions.  Question images always come from the
original paper; answer images and text always come from the matching analysis
paper.  Ambiguous or incomplete records are quarantined in build-review.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageChops, ImageStat


QUESTION_RE = re.compile(r"^\s*(\d{1,2})(?:\s*[.．、](?:\s*|$)|\s+(?=\S))")
WATERMARK_RE = re.compile(r"微信[:：].*?(?:真题卷|期中期末|名校).*", re.IGNORECASE)
FILL_HEADING_RE = re.compile(r"(?:填空题|填空部分)")
SUBJECTIVE_HEADING_RE = re.compile(r"(?:解答题|计算题|应用题|证明题|综合题)")
NON_CHOICE_RE = re.compile(r"(?:非选择题|非选择部分)")
ANSWER_MARK_RE = re.compile(r"【答案】")
DETAIL_MARK_RE = re.compile(r"【(?:详解|解答|解析)】")


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


@dataclass(frozen=True)
class Section:
    kind: str
    heading_index: int
    start_index: int
    end_index: int


@dataclass(frozen=True)
class Segment:
    number: int
    start_index: int
    end_index: int
    start: Line
    end: Line
    end_before: bool
    text: str


@dataclass
class Candidate:
    paper: dict
    question_type: str
    question_number: int
    original_pdf: Path
    answer_pdf: Path
    question_layout: PdfLayout
    answer_layout: PdfLayout
    question_segment: Segment
    answer_segment: Segment
    answer_text: str
    signature: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_space(value: str) -> str:
    value = WATERMARK_RE.sub(" ", value or "")
    value = value.replace("\uf0b4", "×").replace("\uf02d", "−").replace("\u0000", "")
    return re.sub(r"\s+", " ", value).strip()


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


def heading_index(lines: list[Line], pattern: re.Pattern[str], start: int = 0) -> int:
    for index in range(start, len(lines)):
        text = lines[index].text
        if pattern.search(text) and ("本大题" in text or re.search(r"^[第\s]*[一二三四五六七八九十123456789]", text)):
            return index
    return -1


def find_sections(layout: PdfLayout) -> tuple[dict[str, Section], list[dict]]:
    lines = layout.lines
    issues: list[dict] = []
    fill_heading = heading_index(lines, FILL_HEADING_RE)
    subjective_heading = heading_index(lines, SUBJECTIVE_HEADING_RE, max(0, fill_heading + 1))
    if subjective_heading < 0:
        subjective_heading = heading_index(lines, SUBJECTIVE_HEADING_RE)
    non_choice_heading = heading_index(lines, NON_CHOICE_RE)

    sections: dict[str, Section] = {}
    if subjective_heading >= 0:
        sections["subjective"] = Section(
            kind="subjective",
            heading_index=subjective_heading,
            start_index=subjective_heading + 1,
            end_index=len(lines),
        )
    else:
        issues.append({"reason": "subjective_heading_not_found"})

    if fill_heading >= 0 and subjective_heading > fill_heading:
        sections["fill"] = Section(
            kind="fill",
            heading_index=fill_heading,
            start_index=fill_heading + 1,
            end_index=subjective_heading,
        )
    elif non_choice_heading >= 0 and subjective_heading > non_choice_heading:
        # Some WPS exports lose the fill heading.  The non-choice heading still
        # gives a safe lower bound, and the last numbered item before the first
        # subjective heading is exactly the final fill-in question.
        sections["fill"] = Section(
            kind="fill",
            heading_index=non_choice_heading,
            start_index=non_choice_heading + 1,
            end_index=subjective_heading,
        )
        issues.append({"reason": "fill_heading_missing_used_non_choice_boundary"})
    else:
        issues.append({"reason": "fill_heading_not_found"})
    return sections, issues


def question_anchors(layout: PdfLayout, section: Section) -> list[tuple[int, int]]:
    raw: list[tuple[int, int, int]] = []
    for index in range(section.start_index, section.end_index):
        line = layout.lines[index]
        match = QUESTION_RE.match(line.text)
        if not match or line.x0 > 165:
            continue
        number = int(match.group(1))
        if number < 1 or number > 50:
            continue
        punctuation = 1 if re.match(r"^\s*\d{1,2}\s*[.．、]", line.text) else 0
        raw.append((index, number, punctuation))

    # Formula lines can begin with an integer and look like a loose question
    # heading.  Top-level exam questions, however, form the longest consecutive
    # number chain inside a section (for example 17..25).  Recover that chain
    # instead of letting an equation beginning with 30 or 45 terminate parsing.
    if not raw:
        return []
    states: list[tuple[int, int, int | None]] = []
    for current, (_, number, punctuation) in enumerate(raw):
        best_length = 1
        best_punctuation = punctuation
        best_previous: int | None = None
        for previous in range(current):
            if raw[previous][1] != number - 1:
                continue
            previous_length, previous_punctuation, _ = states[previous]
            score = (previous_length + 1, previous_punctuation + punctuation)
            if score > (best_length, best_punctuation):
                best_length, best_punctuation = score
                best_previous = previous
        states.append((best_length, best_punctuation, best_previous))
    winner = max(range(len(raw)), key=lambda index: (states[index][0], states[index][1], raw[index][1]))
    chain: list[tuple[int, int]] = []
    while winner is not None:
        index, number, _ = raw[winner]
        chain.append((index, number))
        winner = states[winner][2]
    chain.reverse()
    return chain


def meaningful_line(line: Line) -> bool:
    return bool(normalize_space(line.text)) and not WATERMARK_RE.search(line.text)


def section_segments(layout: PdfLayout, section: Section) -> dict[int, Segment]:
    anchors = question_anchors(layout, section)
    output: dict[int, Segment] = {}
    for position, (start_index, number) in enumerate(anchors):
        if position + 1 < len(anchors):
            end_index = anchors[position + 1][0]
            end = layout.lines[end_index]
            end_before = True
        elif section.end_index < len(layout.lines):
            end_index = section.end_index
            end = layout.lines[end_index]
            end_before = True
        else:
            content_indices = [
                index
                for index in range(start_index, section.end_index)
                if meaningful_line(layout.lines[index])
            ]
            end_index = content_indices[-1] if content_indices else start_index
            end = layout.lines[end_index]
            end_before = False
        block_end = end_index if end_before else end_index + 1
        text = " ".join(line.text for line in layout.lines[start_index:block_end] if meaningful_line(line))
        output[number] = Segment(
            number=number,
            start_index=start_index,
            end_index=end_index,
            start=layout.lines[start_index],
            end=end,
            end_before=end_before,
            text=normalize_space(text),
        )
    return output


def answer_text(segment: Segment, layout: PdfLayout) -> str:
    block_end = segment.end_index if segment.end_before else segment.end_index + 1
    lines = [line.text for line in layout.lines[segment.start_index:block_end] if meaningful_line(line)]
    marker = next((index for index, text in enumerate(lines) if ANSWER_MARK_RE.search(text)), -1)
    if marker < 0:
        return ""
    direct = re.sub(r"^.*?【答案】\s*", "", lines[marker]).strip()
    detail_at = next((index for index, text in enumerate(lines[marker + 1 :], marker + 1) if DETAIL_MARK_RE.search(text)), -1)
    detail_lines = lines[detail_at:] if detail_at >= 0 else lines[marker + 1 :]
    detail = " ".join(detail_lines)
    detail = re.sub(r"^.*?【(?:详解|解答|解析)】\s*", "", detail).strip()
    value = "\n".join(part for part in (direct, detail) if part and part != "见解析")
    return normalize_space(value)[:2400]


def candidate_from_paper(paper: dict, pdf_root: Path) -> tuple[list[Candidate], list[dict]]:
    code = str(paper.get("stable_code") or "").strip()
    original_pdf = pdf_root / "original" / f"{code}.pdf"
    analysis_pdf = pdf_root / "answer" / f"{code}.pdf"
    review: list[dict] = []
    if not original_pdf.exists() or not analysis_pdf.exists():
        review.append(
            {
                "stable_code": code,
                "reason": "missing_pdf_pair",
                "original_exists": original_pdf.exists(),
                "answer_exists": analysis_pdf.exists(),
            }
        )
        return [], review
    try:
        original_layout = extract_layout(original_pdf)
        analysis_layout = extract_layout(analysis_pdf)
    except Exception as exc:  # noqa: BLE001 - quarantine is the failure boundary
        review.append({"stable_code": code, "reason": "pdf_parse_error", "error": str(exc)})
        return [], review

    original_sections, original_issues = find_sections(original_layout)
    analysis_sections, analysis_issues = find_sections(analysis_layout)
    review.extend({"stable_code": code, "document": "original", **issue} for issue in original_issues)
    review.extend({"stable_code": code, "document": "answer", **issue} for issue in analysis_issues)
    candidates: list[Candidate] = []

    for kind in ("fill", "subjective"):
        if kind not in original_sections or kind not in analysis_sections:
            continue
        original_segments = section_segments(original_layout, original_sections[kind])
        analysis_segments = section_segments(analysis_layout, analysis_sections[kind])
        ordered_numbers = sorted(original_segments)
        selected_numbers = ordered_numbers[-1:] if kind == "fill" else ordered_numbers[-2:]
        expected = 1 if kind == "fill" else 2
        if len(selected_numbers) < expected:
            review.append(
                {
                    "stable_code": code,
                    "question_type": kind,
                    "reason": "not_enough_top_level_questions",
                    "found": len(ordered_numbers),
                    "expected_selected": expected,
                }
            )
        for number in selected_numbers:
            question_segment = original_segments[number]
            answer_segment = analysis_segments.get(number)
            if answer_segment is None:
                review.append(
                    {
                        "stable_code": code,
                        "question_type": kind,
                        "question_number": number,
                        "reason": "matching_answer_segment_not_found",
                    }
                )
                continue
            extracted_answer = answer_text(answer_segment, analysis_layout)
            if not extracted_answer:
                review.append(
                    {
                        "stable_code": code,
                        "question_type": kind,
                        "question_number": number,
                        "reason": "answer_marker_or_text_not_found",
                    }
                )
                continue
            signature = stable_digest(question_segment.text)
            if len(question_segment.text) < 8 or not signature:
                review.append(
                    {
                        "stable_code": code,
                        "question_type": kind,
                        "question_number": number,
                        "reason": "question_text_too_short",
                    }
                )
                continue
            candidates.append(
                Candidate(
                    paper=paper,
                    question_type=kind,
                    question_number=number,
                    original_pdf=original_pdf,
                    answer_pdf=analysis_pdf,
                    question_layout=original_layout,
                    answer_layout=analysis_layout,
                    question_segment=question_segment,
                    answer_segment=answer_segment,
                    answer_text=extracted_answer,
                    signature=signature,
                )
            )
    return candidates, review


def crop_boxes(segment: Segment, page_sizes: list[tuple[float, float]]) -> list[tuple[int, float, float, float, float]]:
    boxes: list[tuple[int, float, float, float, float]] = []
    for page_index in range(segment.start.page, segment.end.page + 1):
        width, height = page_sizes[page_index]
        left = 32.0
        right = max(left + 20.0, width - 32.0)
        top = 48.0
        bottom = height - 54.0
        if page_index == segment.start.page:
            top = max(28.0, segment.start.top - 9.0)
        if page_index == segment.end.page:
            boundary = segment.end.top - 8.0 if segment.end_before else segment.end.bottom + 12.0
            bottom = min(bottom, boundary)
        if bottom - top >= 10.0:
            boxes.append((page_index, left, top, right, bottom))
    return boxes


def valid_image(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= 1024:
        return False
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except Exception:  # noqa: BLE001 - a damaged cache must be rebuilt
        return False


def render_segment(pdf_path: Path, layout: PdfLayout, segment: Segment, output_path: Path, scale: float, force: bool) -> None:
    if valid_image(output_path) and not force:
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    document = pdfium.PdfDocument(str(pdf_path))
    fragments: list[Image.Image] = []
    try:
        for page_index, left, top, right, bottom in crop_boxes(segment, layout.page_sizes):
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
    white = Image.new("RGB", combined.size, "white")
    difference = ImageChops.difference(combined, white).convert("L")
    if difference.getbbox() is None or max(ImageStat.Stat(difference).stddev) < 1.0:
        raise RuntimeError("rendered crop is blank")
    temp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    combined.save(temp_path, format="WEBP", quality=93, method=6)
    temp_path.replace(output_path)


def relative_image_path(candidate: Candidate, suffix: str) -> str:
    code = str(candidate.paper["stable_code"])
    return f"{candidate.question_type}/{code}-Q{candidate.question_number:02d}-{suffix}.webp"


def manifest_row(candidate: Candidate) -> dict:
    code = str(candidate.paper["stable_code"])
    label = candidate.paper.get("display_title") or code
    type_label = "填空压轴" if candidate.question_type == "fill" else "大题压轴"
    return {
        "source_key": f"gz7-terminal-{code}-{candidate.question_type}-Q{candidate.question_number:02d}",
        "question_type": candidate.question_type,
        "title": f"{type_label} · {label} · 第{candidate.question_number}题",
        "question_image": relative_image_path(candidate, "question"),
        "answer_image": relative_image_path(candidate, "answer"),
        "answer_text": candidate.answer_text,
        "source_label": label,
        "exam_stable_code": code,
        "source_year": int(candidate.paper.get("exam_year") or 0),
        "source_question_no": candidate.question_number,
        "source_original_pdf": f"original/{code}.pdf",
        "source_answer_pdf": f"answer/{code}.pdf",
        "signature": candidate.signature,
        "is_active": 1,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build final fill-in and final-two subjective terminal challenges")
    parser.add_argument(
        "--exam-manifest",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "resources" / "exam-library-manifest.json",
    )
    parser.add_argument("--pdf-root", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "resources" / "weekly-challenges",
    )
    parser.add_argument("--limit-papers", type=int, default=0)
    parser.add_argument("--render-scale", type=float, default=1.9)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.render_scale < 1.0 or args.render_scale > 4.0:
        raise SystemExit("--render-scale must be between 1.0 and 4.0")
    manifest = json.loads(args.exam_manifest.read_text(encoding="utf-8-sig"))
    papers = list(manifest.get("papers") or [])
    if args.limit_papers > 0:
        papers = papers[: args.limit_papers]

    candidates: list[Candidate] = []
    review: list[dict] = []
    seen_signatures: dict[str, Candidate] = {}
    json_event(phase="scan_start", papers=len(papers), pdf_root=str(args.pdf_root))
    for index, paper in enumerate(papers, start=1):
        paper_candidates, issues = candidate_from_paper(paper, args.pdf_root)
        review.extend(issues)
        for candidate in paper_candidates:
            duplicate = seen_signatures.get(candidate.signature)
            if duplicate is not None:
                review.append(
                    {
                        "stable_code": candidate.paper.get("stable_code"),
                        "question_type": candidate.question_type,
                        "question_number": candidate.question_number,
                        "reason": "duplicate_question",
                        "duplicate_of": duplicate.paper.get("stable_code"),
                        "signature": candidate.signature,
                    }
                )
                continue
            seen_signatures[candidate.signature] = candidate
            candidates.append(candidate)
        if index % 10 == 0 or index == len(papers):
            json_event(
                phase="scan_progress",
                processed=index,
                papers=len(papers),
                candidates=len(candidates),
                review=len(review),
            )

    candidates.sort(
        key=lambda item: (
            str(item.paper.get("stable_code") or ""),
            item.question_type != "fill",
            item.question_number,
        )
    )
    if args.dry_run:
        counts = {
            "fill": sum(item.question_type == "fill" for item in candidates),
            "subjective": sum(item.question_type == "subjective" for item in candidates),
        }
        json_event(phase="complete", dry_run=True, counts=counts, review=len(review))
        return 0
    if not candidates:
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / "build-review.json").write_text(
            json.dumps({"generated_at": utc_now(), "review": review}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        raise SystemExit("no verified terminal challenges were found")

    rows: list[dict] = []
    for index, candidate in enumerate(candidates, start=1):
        question_path = args.output / relative_image_path(candidate, "question")
        answer_path = args.output / relative_image_path(candidate, "answer")
        try:
            render_segment(
                candidate.original_pdf,
                candidate.question_layout,
                candidate.question_segment,
                question_path,
                args.render_scale,
                args.force,
            )
            render_segment(
                candidate.answer_pdf,
                candidate.answer_layout,
                candidate.answer_segment,
                answer_path,
                args.render_scale,
                args.force,
            )
            rows.append(manifest_row(candidate))
        except Exception as exc:  # noqa: BLE001 - quarantine failed crops
            review.append(
                {
                    "stable_code": candidate.paper.get("stable_code"),
                    "question_type": candidate.question_type,
                    "question_number": candidate.question_number,
                    "reason": "render_error",
                    "error": str(exc),
                }
            )
        if index % 20 == 0 or index == len(candidates):
            json_event(
                phase="render_progress",
                processed=index,
                selected=len(candidates),
                rendered=len(rows),
                failed=index - len(rows),
            )

    if not rows:
        raise SystemExit("all terminal challenge crops failed to render")
    counts = {
        "fill": sum(item["question_type"] == "fill" for item in rows),
        "subjective": sum(item["question_type"] == "subjective" for item in rows),
    }
    output = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "source": "teacher_provided_guangzhou_exam_library",
        "selection": {
            "rule": "last_fill_and_last_two_subjective_per_paper",
            "papers_scanned": len(papers),
            "papers_with_output": len({item["exam_stable_code"] for item in rows}),
        },
        "counts": counts,
        "questions": rows,
    }
    args.output.mkdir(parents=True, exist_ok=True)
    temporary_manifest = args.output / "manifest.json.tmp"
    temporary_manifest.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_manifest.replace(args.output / "manifest.json")
    (args.output / "build-review.json").write_text(
        json.dumps({"generated_at": utc_now(), "review": review}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    json_event(phase="complete", counts=counts, review=len(review), output=str(args.output))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        json_event(phase="interrupted")
        raise
