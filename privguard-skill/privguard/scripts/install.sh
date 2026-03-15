#!/usr/bin/env bash
# PrivGuard Skill Installer
# Copies rules and config to the target project.
#
# Usage:
#   bash install.sh                  Install with auto mode
#   bash install.sh --mode engine    Force engine mode
#   bash install.sh --mode instruction  Force instruction mode
#   bash install.sh --confirm        Enable confirm mode
#   bash install.sh --uninstall      Remove PrivGuard config

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${BLUE}[PrivGuard]${NC} $1"; }
ok()    { echo -e "${GREEN}[PrivGuard]${NC} ✅ $1"; }
warn()  { echo -e "${YELLOW}[PrivGuard]${NC} ⚠️  $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MODE="auto"
CONFIRM="false"
UNINSTALL=false

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) MODE="$2"; shift 2 ;;
    --confirm) CONFIRM="true"; shift ;;
    --uninstall) UNINSTALL=true; shift ;;
    *) shift ;;
  esac
done

if $UNINSTALL; then
  info "Removing PrivGuard config..."
  rm -f .privguard/config.yml
  warn ".privguard/rules/ preserved (contains your custom rules)"
  warn "To fully remove: rm -rf .privguard/"
  ok "Uninstalled"
  exit 0
fi

# Create directories
mkdir -p .privguard/rules

# Copy rules (never overwrite custom.yml)
for f in zh-CN.yml en-US.yml common.yml; do
  cp -f "$SKILL_DIR/references/rules/$f" ".privguard/rules/$f"
done

if [ ! -f .privguard/rules/custom.yml ]; then
  cp "$SKILL_DIR/references/rules/custom.yml" .privguard/rules/custom.yml
else
  warn "custom.yml exists, skipping (your rules preserved)"
fi

# Write config
cat > .privguard/config.yml << EOF
# PrivGuard Configuration
# mode: engine | instruction | auto
#   engine      — Use Node.js CLI for deterministic detection (requires node)
#   instruction — Agent follows SKILL.md rules manually (no dependencies)
#   auto        — Try engine first, fall back to instruction mode
mode: ${MODE}

# confirm: true | false
#   true  — Pause after detection, let user review and adjust
#   false — Sanitize everything automatically, no interruption
confirm: ${CONFIRM}
EOF

ok "Config written to .privguard/config.yml (mode: ${MODE}, confirm: ${CONFIRM})"

# Check Node.js availability
if command -v node &>/dev/null; then
  ok "Node.js found: $(node --version)"
  if [ "$MODE" = "auto" ] || [ "$MODE" = "engine" ]; then
    info "Engine mode available: node $SKILL_DIR/scripts/privguard.cjs"
  fi
else
  if [ "$MODE" = "engine" ]; then
    warn "Node.js not found — engine mode requires Node.js"
    warn "Install Node.js or change mode to 'auto' or 'instruction'"
  else
    info "Node.js not found — will use instruction mode"
  fi
fi

echo ""
ok "PrivGuard installed 🛡️"
echo ""
info "Test: node $SKILL_DIR/scripts/privguard.cjs detect --input 'Call 13812345678'"
info "Config: edit .privguard/config.yml"
info "Custom rules: edit .privguard/rules/custom.yml"
