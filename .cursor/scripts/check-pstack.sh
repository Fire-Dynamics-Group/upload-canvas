#!/usr/bin/env bash
# Fail unless this repo's vendored pstack layout and grok-4.6 pin are in place.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FAILS=0

fail() {
  echo "FAIL: $*"
  FAILS=$((FAILS + 1))
}

ok() {
  echo "OK: $*"
}

SKILL="$ROOT/.cursor/skills/poteto-mode/SKILL.md"
if [[ -f "$SKILL" ]]; then
  ok ".cursor/skills/poteto-mode/SKILL.md exists"
else
  fail ".cursor/skills/poteto-mode/SKILL.md exists"
fi

SETTINGS="$ROOT/.cursor/settings.json"
if [[ ! -f "$SETTINGS" ]]; then
  fail ".cursor/settings.json is valid JSON with plugins.pstack.enabled=true (missing file)"
else
  if python3 - "$SETTINGS" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except json.JSONDecodeError as e:
    print(f"invalid JSON: {e}")
    sys.exit(2)
except OSError as e:
    print(f"unreadable: {e}")
    sys.exit(2)
enabled = (
    isinstance(data, dict)
    and isinstance(data.get("plugins"), dict)
    and isinstance(data["plugins"].get("pstack"), dict)
    and data["plugins"]["pstack"].get("enabled") is True
)
sys.exit(0 if enabled else 1)
PY
  then
    ok ".cursor/settings.json is valid JSON with plugins.pstack.enabled=true"
  else
    status=$?
    if [[ $status -eq 2 ]]; then
      fail ".cursor/settings.json is valid JSON with plugins.pstack.enabled=true (invalid JSON)"
    else
      fail ".cursor/settings.json is valid JSON with plugins.pstack.enabled=true (pstack not enabled)"
    fi
  fi
fi

RULE="$ROOT/.cursor/rules/pstack-models.mdc"
if [[ ! -f "$RULE" ]]; then
  fail ".cursor/rules/pstack-models.mdc exists with grok-4.6-only active model settings (missing file)"
else
  if python3 - "$RULE" <<'PY'
import re, sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8")
if text.startswith("---"):
    end = text.find("\n---", 3)
    if end != -1:
        text = text[end + 4 :]

active_lines = []
for line in text.splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        continue
    active_lines.append(stripped)

active_text = "\n".join(active_lines)
slugs = re.findall(
    r"\b(?:cursor-)?(?:grok|claude|gpt|composer|muse|gemini)[A-Za-z0-9._-]*",
    active_text,
)
bad = [slug for slug in slugs if slug != "grok-4.6"]
if not slugs:
    print("no grok-4.6 active setting found")
    sys.exit(1)
if bad:
    print("non-grok-4.6 active model slugs: " + ", ".join(bad))
    sys.exit(1)
sys.exit(0)
PY
  then
    ok ".cursor/rules/pstack-models.mdc exists with grok-4.6-only active model settings"
  else
    fail ".cursor/rules/pstack-models.mdc exists with grok-4.6-only active model settings"
  fi
fi

if [[ "$FAILS" -ne 0 ]]; then
  echo "check-pstack: $FAILS check(s) failed"
  exit 1
fi

echo "check-pstack: all checks passed"
exit 0
