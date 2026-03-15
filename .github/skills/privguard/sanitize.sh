#!/usr/bin/env bash
# PrivGuard sanitize.sh
# Detect and redact Chinese PII from text before sending to external APIs or LLMs.
#
# Usage:
#   ./sanitize.sh detect  --input "text"
#   ./sanitize.sh sanitize --input "text"
#   ./sanitize.sh help

set -euo pipefail

# ---------------------------------------------------------------------------
# Regex patterns (POSIX ERE compatible with grep -E)
# ---------------------------------------------------------------------------
PATTERN_PHONE='(1[3-9][0-9]{9})'
PATTERN_IDCARD='([1-9][0-9]{5}(19|20)[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}[0-9Xx])'
PATTERN_EMAIL='([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})'
PATTERN_IP='(([0-9]{1,3}\.){3}[0-9]{1,3})'

# ---------------------------------------------------------------------------
# Helper: print usage
# ---------------------------------------------------------------------------
usage() {
  cat <<'EOF'
PrivGuard — Privacy sanitizer for LLM interactions

Usage:
  ./sanitize.sh <action> [options]

Actions:
  detect    Scan input text and report all detected PII entities.
  sanitize  Replace detected PII with typed placeholders and output sanitized text.
            The original→placeholder mapping is printed to stderr.
  help      Show this help message.

Options:
  --input "text"   The text to process (required for detect/sanitize).

Examples:
  ./sanitize.sh detect   --input "手机13812345678，邮箱foo@bar.com"
  ./sanitize.sh sanitize --input "客户张三(手机13812345678)的贷款逾期了"

Detection patterns (POSIX ERE):
  PHONE   : Chinese mobile number  (1[3-9][0-9]{9})
  IDCARD  : Resident ID card       (18-digit)
  EMAIL   : Email address
  IP      : IPv4 address
EOF
}

# ---------------------------------------------------------------------------
# Helper: extract matches for a single pattern, one per line
# Returns empty string if no match
# ---------------------------------------------------------------------------
extract_matches() {
  local pattern="$1"
  local text="$2"
  printf '%s' "$text" | grep -oE "$pattern" || true
}

# ---------------------------------------------------------------------------
# Action: detect
# ---------------------------------------------------------------------------
action_detect() {
  local input="$1"

  if [[ -z "$input" ]]; then
    echo "Error: --input is required for 'detect'." >&2
    exit 1
  fi

  local found=0

  local phones
  phones=$(extract_matches "$PATTERN_PHONE" "$input")
  if [[ -n "$phones" ]]; then
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      printf '[PHONE]   %s\n' "$match"
      found=1
    done <<< "$phones"
  fi

  local idcards
  idcards=$(extract_matches "$PATTERN_IDCARD" "$input")
  if [[ -n "$idcards" ]]; then
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      printf '[IDCARD]  %s\n' "$match"
      found=1
    done <<< "$idcards"
  fi

  local emails
  emails=$(extract_matches "$PATTERN_EMAIL" "$input")
  if [[ -n "$emails" ]]; then
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      printf '[EMAIL]   %s\n' "$match"
      found=1
    done <<< "$emails"
  fi

  local ips
  ips=$(extract_matches "$PATTERN_IP" "$input")
  if [[ -n "$ips" ]]; then
    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      # Skip partial sub-matches captured by the group
      [[ "$match" =~ \\.$ ]] && continue
      printf '[IP]      %s\n' "$match"
      found=1
    done <<< "$ips"
  fi

  if [[ $found -eq 0 ]]; then
    echo "No PII detected."
  fi
}

# ---------------------------------------------------------------------------
# Action: sanitize
# Outputs sanitized text to stdout, mapping table to stderr.
# ---------------------------------------------------------------------------
action_sanitize() {
  local input="$1"

  if [[ -z "$input" ]]; then
    echo "Error: --input is required for 'sanitize'." >&2
    exit 1
  fi

  local sanitized="$input"

  # Associative arrays require bash 4+
  declare -A value_to_placeholder
  declare -A counter
  counter[PHONE]=0
  counter[IDCARD]=0
  counter[EMAIL]=0
  counter[IP]=0

  # Process each pattern type in priority order (longer patterns first to avoid
  # partial replacement of a longer entity by a shorter sub-pattern)
  local types=("IDCARD" "PHONE" "EMAIL" "IP")
  declare -A patterns
  patterns[PHONE]="$PATTERN_PHONE"
  patterns[IDCARD]="$PATTERN_IDCARD"
  patterns[EMAIL]="$PATTERN_EMAIL"
  patterns[IP]="$PATTERN_IP"

  for type in "${types[@]}"; do
    local pattern="${patterns[$type]}"
    local matches
    matches=$(extract_matches "$pattern" "$sanitized")
    if [[ -z "$matches" ]]; then
      continue
    fi

    while IFS= read -r match; do
      [[ -z "$match" ]] && continue
      # For IP, skip partial sub-group matches that end with a dot
      if [[ "$type" == "IP" ]] && [[ "$match" =~ \.$ ]]; then
        continue
      fi
      # Assign a placeholder if this exact value hasn't been seen yet
      if [[ -z "${value_to_placeholder[$match]+_}" ]]; then
        counter[$type]=$(( counter[$type] + 1 ))
        local placeholder="[${type}_${counter[$type]}]"
        value_to_placeholder["$match"]="$placeholder"
        printf 'MAPPING: %s -> %s\n' "$match" "$placeholder" >&2
      fi
      local ph="${value_to_placeholder[$match]}"
      sanitized="${sanitized//"$match"/"$ph"}"
    done <<< "$matches"
  done

  printf '%s\n' "$sanitized"
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
ACTION="${1:-help}"
shift || true

INPUT_TEXT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT_TEXT="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$ACTION" in
  detect)
    action_detect "$INPUT_TEXT"
    ;;
  sanitize)
    action_sanitize "$INPUT_TEXT"
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    usage >&2
    exit 1
    ;;
esac
