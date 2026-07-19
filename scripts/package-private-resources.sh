#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESOURCE_ROOT="$PROJECT_ROOT/backend/resources"
OUTPUT_DIR="$PROJECT_ROOT/backend/private-resource-bundle"
KEY_FILE="${1:-}"

if [[ -z "$KEY_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "usage: $0 /absolute/path/to/resource-bundle-key" >&2
  exit 2
fi

for required in \
  "$RESOURCE_ROOT/choice-king/manifest.json" \
  "$RESOURCE_ROOT/weekly-challenges/manifest.json"; do
  if [[ ! -f "$required" ]]; then
    echo "missing private resource: $required" >&2
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

tar -C "$RESOURCE_ROOT" -czf "$WORK_DIR/panpan-private-resources.tar.gz" \
  choice-king weekly-challenges

openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 \
  -pass "file:$KEY_FILE" \
  -in "$WORK_DIR/panpan-private-resources.tar.gz" \
  -out "$WORK_DIR/panpan-private-resources.enc"

rm -f "$OUTPUT_DIR"/panpan-private-resources.enc.part-* "$OUTPUT_DIR/SHA256SUMS"
split -b 45m -d -a 3 \
  "$WORK_DIR/panpan-private-resources.enc" \
  "$OUTPUT_DIR/panpan-private-resources.enc.part-"

(
  cd "$OUTPUT_DIR"
  sha256sum panpan-private-resources.enc.part-* > SHA256SUMS
)

echo "Private resource bundle created in $OUTPUT_DIR"
