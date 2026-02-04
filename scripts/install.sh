#!/usr/bin/env bash
set -euo pipefail

PACKAGE="@0xraduan/granola-cli"

if command -v bun >/dev/null 2>&1; then
  bun install -g "$PACKAGE"
  exit 0
fi

if command -v npm >/dev/null 2>&1; then
  npm install -g "$PACKAGE"
  exit 0
fi

echo "Neither bun nor npm found. Install one of them first."
exit 1
