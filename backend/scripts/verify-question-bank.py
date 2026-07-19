#!/usr/bin/env python3
"""Verify generated Panpan question-bank manifests, images and split counts."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps, ImageStat


def load_manifest(root: Path) -> dict:
    path = root / "manifest.json"
    if not path.is_file():
        raise ValueError(f"manifest missing: {path}")
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict) or not isinstance(value.get("questions"), list):
        raise ValueError(f"invalid manifest: {path}")
    return value


def image_metrics(path: Path) -> tuple[int, int, float]:
    with Image.open(path) as source:
        source.verify()
    with Image.open(path) as source:
        image = source.convert("L")
        width, height = image.size
        extrema = ImageStat.Stat(image).extrema[0]
        contrast = float(extrema[1] - extrema[0])
    return width, height, contrast


def validate_image(
    root: Path,
    relative: str,
    label: str,
    errors: list[str],
    *,
    min_width: int = 180,
    min_height: int = 55,
) -> Path | None:
    normalized = str(relative or "").replace("\\", "/").lstrip("/")
    if not normalized or ".." in normalized.split("/"):
        errors.append(f"{label}: invalid image path {relative!r}")
        return None
    path = (root / normalized).resolve()
    if root.resolve() not in path.parents or not path.is_file():
        errors.append(f"{label}: image missing {normalized}")
        return None
    try:
        width, height, contrast = image_metrics(path)
    except Exception as exc:  # noqa: BLE001 - report every corrupt image
        errors.append(f"{label}: unreadable image {normalized}: {exc}")
        return None
    if width < min_width or height < min_height:
        errors.append(f"{label}: suspicious dimensions {normalized} ({width}x{height})")
    if contrast < 12:
        errors.append(f"{label}: near-blank image {normalized} (contrast={contrast:.1f})")
    return path


def verify_choice(root: Path, expected: int, recent: int) -> tuple[dict, list[Path], list[str]]:
    manifest = load_manifest(root)
    rows = manifest["questions"]
    errors: list[str] = []
    images: list[Path] = []
    if len(rows) != expected:
        errors.append(f"choice count {len(rows)} != {expected}")
    recent_count = sum(item.get("recent_bucket") == "recent" for item in rows)
    older_count = sum(item.get("recent_bucket") == "older" for item in rows)
    if recent_count != recent or older_count != expected - recent:
        errors.append(f"choice split recent={recent_count}, older={older_count}, expected={recent}/{expected-recent}")
    for field in ("source_key", "signature", "question_image"):
        values = [str(item.get(field) or "") for item in rows]
        if any(not value for value in values):
            errors.append(f"choice has empty {field}")
        if len(set(values)) != len(values):
            errors.append(f"choice has duplicate {field}")
    for index, item in enumerate(rows, start=1):
        label = f"choice[{index}] {item.get('source_key')}"
        if item.get("correct_option") not in {"A", "B", "C", "D"}:
            errors.append(f"{label}: invalid correct_option")
        options = item.get("options")
        if not isinstance(options, dict) or set(options) != {"A", "B", "C", "D"}:
            errors.append(f"{label}: options are not exact A-D")
        path = validate_image(root, item.get("question_image"), label, errors)
        if path:
            images.append(path)
    return manifest, images, errors


def verify_terminal(root: Path) -> tuple[dict, list[Path], list[str]]:
    manifest = load_manifest(root)
    rows = manifest["questions"]
    errors: list[str] = []
    images: list[Path] = []
    grouped: dict[str, dict[str, int]] = {}
    source_keys: list[str] = []
    for index, item in enumerate(rows, start=1):
        label = f"terminal[{index}] {item.get('source_key')}"
        question_type = item.get("question_type")
        if question_type not in {"fill", "subjective"}:
            errors.append(f"{label}: forbidden type {question_type!r}")
        code = str(item.get("exam_stable_code") or "")
        if not code:
            errors.append(f"{label}: missing exam_stable_code")
        counts = grouped.setdefault(code, {"fill": 0, "subjective": 0})
        if question_type in counts:
            counts[question_type] += 1
        source_keys.append(str(item.get("source_key") or ""))
        for field in ("question_image", "answer_image"):
            # A final fill-in may legitimately occupy one printed line. Keep a
            # strict width/contrast check while allowing those short crops.
            min_height = 35 if question_type == "fill" and field == "question_image" else 55
            path = validate_image(
                root,
                item.get(field),
                f"{label} {field}",
                errors,
                min_height=min_height,
            )
            if path:
                images.append(path)
    for code, counts in grouped.items():
        if counts["fill"] > 1 or counts["subjective"] > 2:
            errors.append(f"terminal {code}: fill={counts['fill']} subjective={counts['subjective']}")
    if any(not key for key in source_keys) or len(set(source_keys)) != len(source_keys):
        errors.append("terminal source_key is empty or duplicated")
    return manifest, images, errors


def evenly_sample(paths: list[Path], count: int) -> list[Path]:
    if count <= 0 or len(paths) <= count:
        return paths
    return [paths[round(index * (len(paths) - 1) / (count - 1))] for index in range(count)]


def contact_sheets(paths: list[Path], output: Path, prefix: str, sample_count: int) -> list[Path]:
    selected = evenly_sample(paths, sample_count)
    if not selected:
        return []
    output.mkdir(parents=True, exist_ok=True)
    columns, rows = 5, 5
    cell_width, cell_height, label_height = 360, 230, 38
    per_sheet = columns * rows
    generated: list[Path] = []
    for sheet_index in range(math.ceil(len(selected) / per_sheet)):
        canvas = Image.new("RGB", (columns * cell_width, rows * (cell_height + label_height)), "white")
        draw = ImageDraw.Draw(canvas)
        batch = selected[sheet_index * per_sheet : (sheet_index + 1) * per_sheet]
        for index, path in enumerate(batch):
            column, row = index % columns, index // columns
            x, y = column * cell_width, row * (cell_height + label_height)
            with Image.open(path) as source:
                thumb = ImageOps.contain(source.convert("RGB"), (cell_width - 12, cell_height - 12))
            canvas.paste(thumb, (x + (cell_width - thumb.width) // 2, y + (cell_height - thumb.height) // 2))
            draw.rectangle((x, y, x + cell_width - 1, y + cell_height + label_height - 1), outline="#B9C8C3")
            draw.text((x + 7, y + cell_height + 8), path.name[:48], fill="#183A36")
        target = output / f"{prefix}-{sheet_index + 1:02d}.jpg"
        canvas.save(target, quality=88, optimize=True)
        generated.append(target)
    return generated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--choice-root", type=Path, required=True)
    parser.add_argument("--terminal-root", type=Path, required=True)
    parser.add_argument("--contact-output", type=Path)
    parser.add_argument("--choice-count", type=int, default=1000)
    parser.add_argument("--recent-count", type=int, default=500)
    parser.add_argument("--sample-count", type=int, default=100)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    choice_manifest, choice_images, choice_errors = verify_choice(args.choice_root, args.choice_count, args.recent_count)
    terminal_manifest, terminal_images, terminal_errors = verify_terminal(args.terminal_root)
    sheets: list[Path] = []
    if args.contact_output:
        sheets.extend(contact_sheets(choice_images, args.contact_output, "choice", args.sample_count))
        sheets.extend(contact_sheets(terminal_images, args.contact_output, "terminal", args.sample_count))
    result = {
        "ok": not choice_errors and not terminal_errors,
        "choice": {
            "count": len(choice_manifest["questions"]),
            "images": len(choice_images),
            "selection": choice_manifest.get("selection"),
            "errors": choice_errors,
        },
        "terminal": {
            "count": len(terminal_manifest["questions"]),
            "images": len(terminal_images),
            "counts": terminal_manifest.get("counts"),
            "errors": terminal_errors,
        },
        "contact_sheets": [str(path) for path in sheets],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
