#!/usr/bin/env bash
# ──────────────────────────────────────────────
# annieOSC — One-command install & launch
# ──────────────────────────────────────────────
#
# Usage:
#   curl -sL <url>/install.sh | bash
#   — or —
#   bash install.sh
#
# What it does:
#   1. Checks for Python 3.8+
#   2. Creates a virtual environment (if needed)
#   3. Installs dependencies
#   4. Launches annieOSC in your browser
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="venv"
REQ_FILE="requirements.txt"

# ---- Helpers ----
info()  { printf "\033[1;35m→\033[0m %s\n" "$1"; }
ok()    { printf "\033[1;32m✓\033[0m %s\n" "$1"; }
fail()  { printf "\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

# ---- Find Python 3 ----
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" >/dev/null 2>&1; then
    if "$cmd" -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
      PYTHON="$cmd"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo ""
  echo "  Python 3.8+ is required but was not found."
  echo ""
  echo "  Install Python first:"
  echo "    macOS:   brew install python"
  echo "    Ubuntu:  sudo apt install python3 python3-pip python3-venv"
  echo "    Windows: https://www.python.org/downloads/"
  echo ""
  exit 1
fi

PY_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')")

echo ""
echo "  ╭──────────────────────────────────╮"
echo "  │       annieOSC — Installer       │"
echo "  ╰──────────────────────────────────╯"
echo ""
ok "Found Python $PY_VERSION ($PYTHON)"

# ---- Create virtual environment ----
if [ ! -d "$VENV_DIR" ]; then
  info "Creating virtual environment..."
  "$PYTHON" -m venv "$VENV_DIR" || fail "Failed to create venv. On Ubuntu/Debian, try: sudo apt install python3-venv"
  ok "Virtual environment created"
else
  ok "Virtual environment already exists"
fi

# ---- Activate venv ----
if [ -f "$VENV_DIR/bin/activate" ]; then
  # shellcheck disable=SC1091
  . "$VENV_DIR/bin/activate"
elif [ -f "$VENV_DIR/Scripts/activate" ]; then
  # shellcheck disable=SC1091
  . "$VENV_DIR/Scripts/activate"
else
  fail "Could not find venv activation script"
fi
ok "Virtual environment activated"

# ---- Install dependencies ----
info "Installing dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r "$REQ_FILE"
ok "Dependencies installed"

# ---- Launch ----
echo ""
echo "  ──────────────────────────────────"
echo "  Ready! Starting annieOSC..."
echo "  Press Ctrl+C to quit."
echo "  ──────────────────────────────────"
echo ""

"$PYTHON" run.py "$@"
