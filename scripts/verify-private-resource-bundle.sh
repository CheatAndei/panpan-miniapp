#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLE_DIR="$PROJECT_ROOT/backend/private-resource-bundle"
KEY_FILE="${1:-}"

if [[ -z "$KEY_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "usage: $0 /absolute/path/to/resource-bundle-key" >&2
  exit 2
fi

(
  cd "$BUNDLE_DIR"
  sha256sum -c SHA256SUMS
)

VERIFY_DIR="$(mktemp -d)"
trap 'rm -rf "$VERIFY_DIR"' EXIT

cat "$BUNDLE_DIR"/panpan-private-resources.enc.part-* \
  | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
      -pass "file:$KEY_FILE" \
  | tar -xzf - -C "$VERIFY_DIR"

python3 - "$VERIFY_DIR" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
choice = json.loads((root / "choice-king/manifest.json").read_text(encoding="utf-8"))
terminal = json.loads((root / "weekly-challenges/manifest.json").read_text(encoding="utf-8"))
choice_questions = choice.get("questions", choice) if isinstance(choice, dict) else choice
terminal_questions = terminal.get("questions", terminal) if isinstance(terminal, dict) else terminal
assert len(choice_questions) == 1000, len(choice_questions)
assert len(terminal_questions) == 710, len(terminal_questions)
assert sum(item.get("recent_bucket") == "recent" for item in choice_questions) == 500
assert sum(item.get("recent_bucket") == "older" for item in choice_questions) == 500
print({
    "choice": len(choice_questions),
    "terminal": len(terminal_questions),
    "choice_images": len(list((root / "choice-king/questions").glob("*"))),
    "terminal_webp": len(list((root / "weekly-challenges").rglob("*.webp"))),
})
PY
