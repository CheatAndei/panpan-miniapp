#!/usr/bin/env python3
"""Validate the WPS-exported exam PDFs before they are bundled or imported."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from pypdf import PdfReader


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect_pdf(path: Path, replacement_glyphs_warning: bool = False) -> dict:
    result = {
        "path": str(path),
        "exists": path.is_file(),
        "bytes": path.stat().st_size if path.is_file() else 0,
        "sha256": "",
        "pages": 0,
        "text_chars": 0,
        "replacement_chars": 0,
        "empty_content_pages": 0,
        "errors": [],
        "warnings": [],
    }
    if not path.is_file():
        result["errors"].append("missing")
        return result
    with path.open("rb") as stream:
        if stream.read(5) != b"%PDF-":
            result["errors"].append("invalid_header")
            return result
    if result["bytes"] < 1024:
        result["errors"].append("too_small")
        return result
    try:
        result["sha256"] = sha256(path)
        reader = PdfReader(str(path), strict=False)
        if reader.is_encrypted:
            result["errors"].append("encrypted")
            return result
        result["pages"] = len(reader.pages)
        if not reader.pages:
            result["errors"].append("no_pages")
            return result
        for page in reader.pages:
            try:
                contents = page.get_contents()
                if contents is None:
                    result["empty_content_pages"] += 1
                text = page.extract_text() or ""
                result["text_chars"] += len(text.strip())
                result["replacement_chars"] += text.count("\ufffd")
            except Exception as exc:  # noqa: BLE001 - record every damaged page
                result["errors"].append(f"page_read:{type(exc).__name__}")
        if result["replacement_chars"]:
            target = result["warnings"] if replacement_glyphs_warning else result["errors"]
            target.append("replacement_glyphs")
        if result["empty_content_pages"]:
            result["warnings"].append("empty_content_page")
        if result["text_chars"] < 20:
            result["warnings"].append("low_extractable_text")
    except Exception as exc:  # noqa: BLE001 - batch report must continue
        result["errors"].append(f"unreadable:{type(exc).__name__}:{exc}")
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--pdf-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--strict-warnings", action="store_true")
    parser.add_argument("--replacement-glyphs-warning", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
    rows = []
    for paper in manifest.get("papers", []):
        stable_code = str(paper["stable_code"])
        for role in ("original", "answer"):
            if role == "answer" and not paper.get("answer"):
                continue
            path = args.pdf_root / role / f"{stable_code}.pdf"
            inspected = inspect_pdf(path, args.replacement_glyphs_warning)
            inspected.update({"stable_code": stable_code, "role": role})
            rows.append(inspected)
    failures = [row for row in rows if row["errors"]]
    warnings = [row for row in rows if row["warnings"]]
    report = {
        "version": "panpan-wps-pdf-audit-v1",
        "policy": {
            "replacement_glyphs": "warning" if args.replacement_glyphs_warning else "error",
        },
        "manifest": str(args.manifest.resolve()),
        "pdf_root": str(args.pdf_root.resolve()),
        "summary": {
            "expected": len(rows),
            "passed": len(rows) - len(failures),
            "failed": len(failures),
            "warnings": len(warnings),
            "pages": sum(row["pages"] for row in rows),
            "bytes": sum(row["bytes"] for row in rows),
            "replacement_chars": sum(row["replacement_chars"] for row in rows),
        },
        "failures": failures,
        "warnings": warnings,
        "files": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    return 2 if failures or (args.strict_warnings and warnings) else 0


if __name__ == "__main__":
    raise SystemExit(main())
