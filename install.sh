#!/usr/bin/env bash
# PrivGuard Installer
# Installs PrivGuard into your project without overwriting existing config files.
#
# Usage:
#   bash install.sh              Install for all supported agents
#   bash install.sh --kiro       Install for Kiro only
#   bash install.sh --claude     Install for Claude Code only
#   bash install.sh --opencode   Install for OpenCode/Cursor/Codex only
#   bash install.sh --uninstall  Remove PrivGuard from this project

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${BLUE}[PrivGuard]${NC} $1"; }
ok()    { echo -e "${GREEN}[PrivGuard]${NC} ✅ $1"; }
warn()  { echo -e "${YELLOW}[PrivGuard]${NC} ⚠️  $1"; }
err()   { echo -e "${RED}[PrivGuard]${NC} ❌ $1"; }

PRIVGUARD_MARKER="# >>> PrivGuard >>>"
PRIVGUARD_END="# <<< PrivGuard <<<"

# ── Core: install rules + engine instructions ──
install_core() {
  mkdir -p .privguard/rules

  # Copy rule files (never overwrite custom.yml)
  for f in zh-CN.yml en-US.yml common.yml; do
    cp -f "$(dirname "$0")/.privguard/rules/$f" ".privguard/rules/$f"
  done

  if [ ! -f .privguard/rules/custom.yml ]; then
    cp "$(dirname "$0")/.privguard/rules/custom.yml" .privguard/rules/custom.yml
  else
    warn "custom.yml exists, skipping (your rules preserved)"
  fi

  # Copy AGENTS.md into .privguard/ (not root!)
  cp -f "$(dirname "$0")/.privguard/AGENTS.md" .privguard/AGENTS.md

  # Copy sanitize.sh
  cp -f "$(dirname "$0")/.privguard/sanitize.sh" .privguard/sanitize.sh
  chmod +x .privguard/sanitize.sh

  ok "Core files installed to .privguard/"
}

# ── Append a reference block to a file (idempotent) ──
append_reference() {
  local file="$1"
  local content="$2"

  # If marker already exists, skip
  if [ -f "$file" ] && grep -q "$PRIVGUARD_MARKER" "$file" 2>/dev/null; then
    warn "$file already has PrivGuard reference, skipping"
    return
  fi

  # If file doesn't exist, create it
  if [ ! -f "$file" ]; then
    echo "" > "$file"
  fi

  # Append reference block
  {
    echo ""
    echo "$PRIVGUARD_MARKER"
    echo "$content"
    echo "$PRIVGUARD_END"
  } >> "$file"

  ok "Reference added to $file"
}

# ── Remove reference block from a file ──
remove_reference() {
  local file="$1"
  if [ ! -f "$file" ]; then return; fi
  if ! grep -q "$PRIVGUARD_MARKER" "$file" 2>/dev/null; then return; fi

  # Remove everything between markers (inclusive)
  sed -i.bak "/$PRIVGUARD_MARKER/,/$PRIVGUARD_END/d" "$file"
  rm -f "${file}.bak"
  ok "Reference removed from $file"
}

# ── Agent-specific installers ──

install_opencode() {
  # OpenCode / Cursor / Codex read AGENTS.md recursively from subdirectories.
  # .privguard/AGENTS.md will be auto-discovered.
  # But for agents that only read root AGENTS.md, add a reference.
  append_reference "AGENTS.md" \
"# PrivGuard: Sensitive Information Sanitizer
# See .privguard/AGENTS.md for full PII detection and sanitization instructions.
# Rules: .privguard/rules/*.yml | Custom: .privguard/rules/custom.yml"
  ok "OpenCode / Cursor / Codex configured"
}

install_claude() {
  append_reference "CLAUDE.md" \
"# PrivGuard: Sensitive Information Sanitizer
# See .privguard/AGENTS.md for full PII detection and sanitization instructions.
# Rules: .privguard/rules/*.yml | Custom: .privguard/rules/custom.yml"
  ok "Claude Code configured"
}

install_kiro() {
  mkdir -p .kiro/steering
  cp -f "$(dirname "$0")/.kiro/skills/privguard.md" .kiro/steering/privguard.md
  ok "Kiro configured (.kiro/steering/privguard.md)"
}

# ── Uninstall ──

do_uninstall() {
  info "Removing PrivGuard..."
  remove_reference "AGENTS.md"
  remove_reference "CLAUDE.md"
  rm -f .kiro/steering/privguard.md
  # Don't remove .privguard/ — user might have custom rules
  warn ".privguard/ directory preserved (contains your custom rules)"
  warn "To fully remove, run: rm -rf .privguard/"
  ok "PrivGuard uninstalled"
}

# ── Main ──

MODE="${1:---all}"

echo ""
info "PrivGuard Installer v0.1.0"
echo ""

case "$MODE" in
  --uninstall)
    do_uninstall
    ;;
  --kiro)
    install_core
    install_kiro
    ;;
  --claude)
    install_core
    install_claude
    ;;
  --opencode)
    install_core
    install_opencode
    ;;
  --all|*)
    install_core
    install_opencode
    install_claude
    install_kiro
    ;;
esac

echo ""
ok "Done! 🛡️"
echo ""
info "Quick test:"
info "  bash .privguard/sanitize.sh detect --input \"Call 13812345678 or email test@example.com\""
echo ""
info "Add custom rules:  edit .privguard/rules/custom.yml"
info "Uninstall:         bash install.sh --uninstall"
