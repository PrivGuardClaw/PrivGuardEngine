#!/usr/bin/env bash
# PrivGuard Sanitizer Script
# Compatible with bash 3.x (macOS default) and 4.x+
#
# Usage:
#   bash .privguard/sanitize.sh detect  --input "text with PII"
#   bash .privguard/sanitize.sh detect  --file  path/to/file.txt
#   bash .privguard/sanitize.sh sanitize --input "text with PII"
#   bash .privguard/sanitize.sh sanitize --file  path/to/file.txt
#
# Note: This script uses built-in regex patterns for core detection.
# For full YAML rule parsing with validation/context_hint support,
# use the TypeScript engine (Phase 2) or install yq.

set -euo pipefail

# ── Colors ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── Built-in patterns ──
# Using grep -oE (POSIX extended regex) for macOS compatibility.
# Format: "TYPE|PATTERN"
PATTERNS=(
  'PHONE|(1[3-9][0-9]{9})'
  'IDCARD|([1-9][0-9]{5}(19|20)[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}[0-9Xx])'
  'BANKCARD|([3-6][0-9]{15,18})'
  'SSN|([0-9]{3}-[0-9]{2}-[0-9]{4})'
  'EMAIL|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
  'IPV4|(([0-9]{1,3}\.){3}[0-9]{1,3})'
  'JWT|(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})'
)

SKIP_IPV4="127.0.0.1 0.0.0.0 255.255.255.255"

# ── State (bash 3.x compatible — parallel arrays instead of associative) ──
DETECT_TYPES=()
DETECT_VALUES=()
MAP_KEYS=()
MAP_VALS=()
COUNTER_TYPES=()
COUNTER_NUMS=()

# ── Functions ──

usage() {
  echo "Usage: $0 <detect|sanitize> --input \"text\" | --file path"
  echo ""
  echo "Commands:"
  echo "  detect    Scan text and report findings"
  echo "  sanitize  Replace sensitive values with {{PG:TYPE_N}} placeholders"
  exit 1
}

# Look up a value in MAP_KEYS, return the corresponding MAP_VALS entry
map_get() {
  local key="$1"
  local i=0
  for k in "${MAP_KEYS[@]+"${MAP_KEYS[@]}"}"; do
    if [[ "$k" == "$key" ]]; then
      echo "${MAP_VALS[$i]}"
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

# Get or increment counter for a type
counter_next() {
  local type="$1"
  local i=0
  for t in "${COUNTER_TYPES[@]+"${COUNTER_TYPES[@]}"}"; do
    if [[ "$t" == "$type" ]]; then
      COUNTER_NUMS[$i]=$(( ${COUNTER_NUMS[$i]} + 1 ))
      echo "${COUNTER_NUMS[$i]}"
      return
    fi
    i=$((i + 1))
  done
  COUNTER_TYPES+=("$type")
  COUNTER_NUMS+=(1)
  echo "1"
}

get_placeholder() {
  local type="$1"
  local value="$2"

  # Check if already mapped
  local existing
  if existing=$(map_get "$value" 2>/dev/null); then
    echo "$existing"
    return
  fi

  local num
  num=$(counter_next "$type")
  local placeholder="{{PG:${type}_${num}}}"
  MAP_KEYS+=("$value")
  MAP_VALS+=("$placeholder")
  echo "$placeholder"
}

is_skipped_ip() {
  local val="$1"
  for skip in $SKIP_IPV4; do
    if [[ "$val" == "$skip" ]]; then
      return 0
    fi
  done
  return 1
}

detect_in_text() {
  local text="$1"

  for rule in "${PATTERNS[@]}"; do
    local type="${rule%%|*}"
    local pattern="${rule#*|}"

    local matches
    matches=$(echo "$text" | grep -oE "$pattern" 2>/dev/null || true)

    while IFS= read -r match; do
      [[ -z "$match" ]] && continue

      # Skip known non-sensitive IPs
      if [[ "$type" == "IPV4" ]] && is_skipped_ip "$match"; then
        continue
      fi

      # Deduplicate
      local dup=0
      local idx=0
      for v in "${DETECT_VALUES[@]+"${DETECT_VALUES[@]}"}"; do
        if [[ "$v" == "$match" && "${DETECT_TYPES[$idx]}" == "$type" ]]; then
          dup=1
          break
        fi
        idx=$((idx + 1))
      done

      if [[ $dup -eq 0 ]]; then
        DETECT_TYPES+=("$type")
        DETECT_VALUES+=("$match")
      fi
    done <<< "$matches"
  done
}

cmd_detect() {
  local text="$1"
  detect_in_text "$text"

  local count=${#DETECT_TYPES[@]}
  if [[ $count -eq 0 ]]; then
    echo -e "${GREEN}✅ No sensitive information detected.${NC}"
    return
  fi

  echo -e "${YELLOW}🛡️  PrivGuard: detected ${count} sensitive item(s):${NC}"
  echo ""

  local types_seen=""
  local i=0
  while [[ $i -lt $count ]]; do
    local type="${DETECT_TYPES[$i]}"
    local value="${DETECT_VALUES[$i]}"
    local masked
    if [[ ${#value} -gt 6 ]]; then
      masked="${value:0:3}***${value: -3}"
    else
      masked="***"
    fi
    echo -e "  ${BLUE}[$type]${NC} $masked"
    types_seen="$types_seen $type"
    i=$((i + 1))
  done

  echo ""
  local unique_types
  unique_types=$(echo "$types_seen" | tr ' ' '\n' | sort -u | tr '\n' ',' | sed 's/^,//' | sed 's/,$//')
  echo -e "Types found: ${unique_types}"
}

cmd_sanitize() {
  local text="$1"
  detect_in_text "$text"

  local count=${#DETECT_TYPES[@]}
  if [[ $count -eq 0 ]]; then
    echo "$text"
    return
  fi

  local result="$text"

  # Sort by value length (longest first) to avoid partial replacements
  # Build index array sorted by value length descending
  local indices=()
  local i=0
  while [[ $i -lt $count ]]; do
    indices+=("$i")
    i=$((i + 1))
  done

  # Simple bubble sort by value length (descending)
  local n=${#indices[@]}
  local swapped=1
  while [[ $swapped -eq 1 ]]; do
    swapped=0
    i=0
    while [[ $i -lt $((n - 1)) ]]; do
      local ai="${indices[$i]}"
      local bi="${indices[$((i + 1))]}"
      local la=${#DETECT_VALUES[$ai]}
      local lb=${#DETECT_VALUES[$bi]}
      if [[ $la -lt $lb ]]; then
        indices[$i]="$bi"
        indices[$((i + 1))]="$ai"
        swapped=1
      fi
      i=$((i + 1))
    done
  done

  for idx in "${indices[@]}"; do
    local type="${DETECT_TYPES[$idx]}"
    local value="${DETECT_VALUES[$idx]}"
    local placeholder
    placeholder=$(get_placeholder "$type" "$value")
    result="${result//$value/$placeholder}"
  done

  echo "$result"

  echo "" >&2
  echo -e "${YELLOW}🛡️  PrivGuard: replaced ${count} sensitive item(s)${NC}" >&2
  echo -e "Mapping table (local only, do NOT share):" >&2
  i=0
  while [[ $i -lt ${#MAP_KEYS[@]} ]]; do
    echo -e "  ${MAP_VALS[$i]} → [original hidden]" >&2
    i=$((i + 1))
  done
}

# ── Main ──

[[ $# -lt 2 ]] && usage

COMMAND="$1"
shift

TEXT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      TEXT="$2"
      shift 2
      ;;
    --file)
      if [[ ! -f "$2" ]]; then
        echo "Error: file not found: $2" >&2
        exit 1
      fi
      TEXT=$(cat "$2")
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

[[ -z "$TEXT" ]] && usage

case "$COMMAND" in
  detect)
    cmd_detect "$TEXT"
    ;;
  sanitize)
    cmd_sanitize "$TEXT"
    ;;
  *)
    usage
    ;;
esac
