#!/bin/sh
# Point git at repo hooks so every commit runs the golden CV suite.
set -e
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
echo "Git hooks installed (.githooks/pre-commit → npm test)"
