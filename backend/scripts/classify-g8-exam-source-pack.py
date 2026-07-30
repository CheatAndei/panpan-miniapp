#!/usr/bin/env python3
"""Attach stable G8 scope tags and provenance to split exam questions."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


SCOPES = [
    ("g8-01-triangle-lines", "第1讲 三角形的边与重要三线", "fixed"),
    ("g8-02-triangle-angles", "第2讲 三角形的内外角性质", "fixed"),
    ("g8-03-congruence-basics", "第3讲 全等三角形的性质与判定", "fixed"),
    ("g8-04-congruence-bisector-foundation", "第4讲 全等综合及角平分线", "fixed"),
    ("g8-05-axis-symmetry", "第5讲 轴对称", "fixed"),
    ("g8-06-isosceles-equilateral", "第6讲 等腰及等边三角形", "fixed"),
    ("g8-07-powers-polynomial-products", "第7讲 幂的运算与整式的乘法", "fixed"),
    ("g8-08-identities-factorization", "第8讲 乘法公式与因式分解", "fixed"),
    ("g8-09-angle-models", "第9讲 角度模型", "fixed"),
    ("g8-10-congruence-bisector-advanced", "第10讲 全等综合及角平分线", "fixed"),
    ("g8-11-one-line-three-equal-angles", "第11讲 一线三等角模型", "fixed"),
    ("g8-12-hand-in-hand", "第12讲 手拉手模型", "fixed"),
    ("g8-13-polygons", "多边形及其内角和", "curriculum_added"),
    ("g8-14-rational-expressions", "分式", "curriculum_added"),
    ("g8-15-extension", "拓展", "extension"),
]
SCOPE_ORDER = {key: index for index, (key, _, _) in enumerate(SCOPES)}

RULES: dict[str, tuple[re.Pattern[str], ...]] = {
    "g8-01-triangle-lines": tuple(
        re.compile(value)
        for value in (
            r"三角形.{0,10}(三边关系|第三边|中线|高线|高|中位线)",
            r"(三边关系|第三边|三角形的中线|三角形的高)",
            r"两边之和|两边之差",
        )
    ),
    "g8-02-triangle-angles": tuple(
        re.compile(value)
        for value in (
            r"三角形.{0,12}(内角和|外角)",
            r"(内角和|外角).{0,12}三角形",
            r"三角形.{0,8}角度",
        )
    ),
    "g8-03-congruence-basics": tuple(
        re.compile(value)
        for value in (
            r"全等",
            r"\b(?:SSS|SAS|ASA|AAS|HL)\b",
            r"判定.{0,8}(三角形|△)",
        )
    ),
    "g8-04-congruence-bisector-foundation": tuple(
        re.compile(value)
        for value in (
            r"角平分线.{0,12}(性质|定理|判定|作图)",
            r"(到角的两边距离|角的内部).{0,12}相等",
            r"尺规作图.{0,12}角平分线",
        )
    ),
    "g8-05-axis-symmetry": tuple(
        re.compile(value)
        for value in (
            r"轴对称|对称轴|关于.{0,8}[xyXY]轴对称",
            r"垂直平分线|中垂线",
            r"最短路径|将军饮马",
        )
    ),
    "g8-06-isosceles-equilateral": tuple(
        re.compile(value)
        for value in (
            r"等腰三角形|等边三角形|正三角形",
            r"三线合一|底角",
            r"30[°º度].{0,12}直角三角形|直角三角形.{0,12}30[°º度]",
        )
    ),
    "g8-07-powers-polynomial-products": tuple(
        re.compile(value)
        for value in (
            r"同底数幂|幂的乘方|积的乘方",
            r"单项式.{0,8}(乘|多项式)|多项式.{0,8}(乘|多项式)",
            r"整式.{0,8}(乘法|运算)|合并同类项",
        )
    ),
    "g8-08-identities-factorization": tuple(
        re.compile(value)
        for value in (
            r"因式分解|分解因式",
            r"平方差|完全平方|乘法公式",
            r"公因式|提公因式",
        )
    ),
    "g8-09-angle-models": tuple(
        re.compile(value)
        for value in (
            r"八字|飞镖|燕尾|铅笔头|角度模型",
            r"余角|补角",
            r"折叠|翻折|折痕",
            r"∠1.{0,50}∠2|∠2.{0,50}∠1",
        )
    ),
    "g8-11-one-line-three-equal-angles": tuple(
        re.compile(value)
        for value in (
            r"一线三等角|三等角",
            r"三个相等的角.{0,30}(同一直线|共线)",
        )
    ),
    "g8-12-hand-in-hand": tuple(
        re.compile(value)
        for value in (
            r"手拉手|手牵手",
            r"(绕|旋转).{0,18}(等边三角形|等腰三角形)",
            r"共顶点.{0,18}(等边三角形|等腰三角形)",
        )
    ),
    "g8-13-polygons": tuple(
        re.compile(value)
        for value in (
            r"多边形|正[三四五六七八九十]+边形",
            r"[nN]边形",
            r"(内角和|外角和).{0,12}(边形|边数)",
        )
    ),
    "g8-14-rational-expressions": tuple(
        re.compile(value)
        for value in (
            r"分式|分式方程|最简分式|最简公分母",
            r"约分|通分",
            r"分母.{0,10}(不为|不能为|有意义)",
            r"负整数指数幂|零指数幂",
        )
    ),
    "g8-15-extension": tuple(
        re.compile(value)
        for value in (
            r"一次函数|二次函数|反比例函数",
            r"二次根式|勾股定理|相似三角形|圆|锐角三角函数",
            r"平面直角坐标系|方程组|一元一次方程|一元二次方程",
            r"平均数|中位数|众数|方差|概率|统计图",
        )
    ),
}


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


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def raw_manifest(path: Path) -> Path:
    target = path.with_name("manifest.raw.json")
    if not target.exists():
        shutil.copy2(path, target)
    return target


def text_for(item: dict) -> str:
    values: list[str] = [
        str(item.get("source_text") or ""),
        str(item.get("explanation") or ""),
        str(item.get("answer_text") or ""),
        str(item.get("source_label") or ""),
    ]
    source_options = item.get("source_options")
    if isinstance(source_options, dict):
        values.extend(str(value or "") for value in source_options.values())
    return re.sub(r"\s+", "", " ".join(values))


def evidence_for(scope_key: str, text: str) -> list[str]:
    evidence: list[str] = []
    for pattern in RULES.get(scope_key, ()):
        match = pattern.search(text)
        if match:
            evidence.append(match.group(0)[:80])
    return evidence


def classify(item: dict, source_kind: str) -> tuple[list[str], str, str, dict[str, list[str]]]:
    text = text_for(item)
    evidence: dict[str, list[str]] = {}
    scores: Counter[str] = Counter()
    for scope_key in RULES:
        matches = evidence_for(scope_key, text)
        if matches:
            evidence[scope_key] = matches
            scores[scope_key] += min(5, len(matches) + 2)

    question_type = str(item.get("question_type") or "choice")
    question_no = int(item.get("source_question_no") or 0)
    advanced = question_type == "subjective" and question_no >= 21
    advanced_signal = bool(re.search(r"动点|最值|探究|证明|构造|旋转|翻折|折叠|综合", text))

    if scores["g8-03-congruence-basics"] and (
        advanced or advanced_signal or scores["g8-04-congruence-bisector-foundation"]
    ):
        scores["g8-10-congruence-bisector-advanced"] += 3
        evidence.setdefault("g8-10-congruence-bisector-advanced", []).append("压轴/综合全等判定")
    if scores["g8-06-isosceles-equilateral"] and re.search(r"旋转|绕|共顶点", text):
        scores["g8-12-hand-in-hand"] += 3
        evidence.setdefault("g8-12-hand-in-hand", []).append("等边/等腰旋转或共顶点结构")
    if scores["g8-04-congruence-bisector-foundation"] and re.search(r"∠|角", text) and advanced_signal:
        scores["g8-09-angle-models"] += 2
        evidence.setdefault("g8-09-angle-models", []).append("角平分线综合角度结构")

    # Opening tests often contain prerequisite review. Exact G8 matches win;
    # otherwise the conservative range is extension so unchecked content never leaks.
    if "开学" in text and not any(scores[key] for key in SCOPE_ORDER if key != "g8-15-extension"):
        scores["g8-15-extension"] += 3
        evidence.setdefault("g8-15-extension", []).append("开学测试中的前置内容")

    if not scores:
        scores["g8-15-extension"] = 1
        evidence["g8-15-extension"] = ["未命中稳定八上范围规则，进入人工复核"]

    selected = [
        key
        for key, score in sorted(scores.items(), key=lambda pair: (-pair[1], SCOPE_ORDER[pair[0]]))
        if score >= 2
    ]
    if not selected:
        selected = ["g8-15-extension"]
    selected = selected[:4]
    primary = selected[0]
    top_score = scores[primary]
    confidence = "high" if top_score >= 4 and primary != "g8-15-extension" else "medium" if top_score >= 3 else "low"
    if primary == "g8-15-extension" and evidence[primary] == ["未命中稳定八上范围规则，进入人工复核"]:
        confidence = "low"
    return selected, primary, confidence, {key: evidence.get(key, []) for key in selected}


def difficulty(item: dict) -> int:
    question_type = str(item.get("question_type") or "choice")
    number = int(item.get("source_question_no") or 0)
    if question_type == "fill":
        return 4
    if question_type == "subjective":
        return 5
    if number and number <= 4:
        return 1
    if number and number <= 8:
        return 2
    return 3


def enrich_manifest(path: Path, exam_by_code: dict[str, dict], review: list[dict]) -> dict:
    raw_path = raw_manifest(path)
    manifest = load_json(raw_path)
    rows = manifest.get("questions")
    if not isinstance(rows, list):
        raise ValueError(f"questions missing: {raw_path}")
    for item in rows:
        code = str(item.get("exam_stable_code") or "")
        exam = exam_by_code.get(code)
        if exam is None:
            raise ValueError(f"unknown exam reference: {code}")
        source_kind = str(exam.get("source_kind") or "guangzhou_exam")
        topic_keys, primary, confidence, evidence = classify(item, source_kind)
        item["grade_code"] = "g8"
        item["subject_code"] = "math"
        item["semester_code"] = "s1"
        item["source_kind"] = source_kind
        item["topic_keys"] = topic_keys
        item["primary_topic_key"] = primary
        item["topic_match_policy"] = "all_selected"
        item["scope_confidence"] = confidence
        item["scope_evidence"] = evidence
        item["difficulty"] = difficulty(item)
        item["source_reference"] = {
            "exam_stable_code": code,
            "source_relative_path": exam.get("source_relative_path"),
            "paper_sha256": (exam.get("paper") or {}).get("sha256"),
            "answer_sha256": (exam.get("answer") or {}).get("sha256"),
        }
        if confidence == "low" or primary == "g8-15-extension" or len(topic_keys) > 2:
            review.append(
                {
                    "source_key": item.get("source_key"),
                    "exam_stable_code": code,
                    "question_type": item.get("question_type") or "choice",
                    "source_question_no": item.get("source_question_no"),
                    "topic_keys": topic_keys,
                    "scope_confidence": confidence,
                    "scope_evidence": evidence,
                    "reason": "low_confidence" if confidence == "low" else "extension_or_multi_scope",
                }
            )
    manifest["schema_version"] = 2
    manifest["classified_at"] = utc_now()
    manifest["grade_code"] = "g8"
    manifest["subject_code"] = "math"
    manifest["scope_catalog_version"] = "g8-s1-v1"
    manifest["raw_manifest_sha256"] = digest(raw_path)
    write_json(path, manifest)
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--exam-manifest", type=Path, required=True)
    parser.add_argument("--choice-manifest", type=Path, required=True)
    parser.add_argument("--terminal-manifest", type=Path, required=True)
    parser.add_argument("--scope-output", type=Path, required=True)
    parser.add_argument("--review-output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    exam_manifest = load_json(args.exam_manifest)
    papers = exam_manifest.get("papers")
    if not isinstance(papers, list):
        raise SystemExit("exam manifest papers missing")
    exam_by_code = {str(item["stable_code"]): item for item in papers}
    review: list[dict] = []
    choice = enrich_manifest(args.choice_manifest, exam_by_code, review)
    terminal = enrich_manifest(args.terminal_manifest, exam_by_code, review)
    catalog = {
        "schema_version": 1,
        "catalog_version": "g8-s1-v1",
        "generated_at": utc_now(),
        "grade_code": "g8",
        "subject_code": "math",
        "selection_semantics": "题目全部 topic_keys 均被教师勾选时，学生端才可出现",
        "selection_policy": "all_selected",
        "scopes": [
            {"key": key, "name": name, "kind": kind, "order": index + 1, "enabled_by_default": kind == "fixed"}
            for index, (key, name, kind) in enumerate(SCOPES)
        ],
    }
    write_json(args.scope_output, catalog)
    review_payload = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "items": review,
        "summary": {
            "total": len(review),
            "low_confidence": sum(item["scope_confidence"] == "low" for item in review),
            "extension": sum("g8-15-extension" in item["topic_keys"] for item in review),
            "multi_scope": sum(len(item["topic_keys"]) > 2 for item in review),
        },
    }
    write_json(args.review_output, review_payload)
    counts = Counter()
    for item in choice["questions"] + terminal["questions"]:
        counts.update(item["topic_keys"])
    print(
        json.dumps(
            {
                "ok": True,
                "choice": len(choice["questions"]),
                "terminal": len(terminal["questions"]),
                "review": review_payload["summary"],
                "scope_counts": dict(sorted(counts.items())),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
