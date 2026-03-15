---
name: privguard
description: >
  Detect and sanitize sensitive information (PII, secrets, credentials) in text before
  sending to LLMs or external services. Supports Chinese and US PII, API keys, JWT,
  passwords, and custom rules. Use when processing text that may contain phone numbers,
  ID cards, SSN, email addresses, IP addresses, API keys, or other sensitive data.
---

# PrivGuard — Sensitive Information Sanitizer for AI Agents

Automatically detect and replace PII, secrets, and credentials with typed placeholders
before reasoning, then restore them in the final output.

## Quick Start

PrivGuard has two execution modes. Check `.privguard/config.yml` to determine which to use:

```yaml
# .privguard/config.yml
mode: auto        # engine | instruction | auto
confirm: false    # true = confirm each new detection, false = fully automatic
```

- `engine` — Call the bundled CLI script (requires Node.js)
- `instruction` — Follow the detection rules below manually (no dependencies)
- `auto` (default) — Try engine first, fall back to instruction mode

### Mode Selection Logic

1. Read `.privguard/config.yml` if it exists
2. If `mode: engine` or `mode: auto`, check if Node.js is available: `which node`
3. If Node.js is available and mode is `engine` or `auto`, use **Engine Mode**
4. Otherwise, use **Instruction Mode**

---

## Engine Mode

Call the CLI for deterministic, high-accuracy detection:

```bash
# Sanitize text — returns JSON with sanitized text, mappings, and diff
node scripts/privguard.cjs sanitize --input "<text>" --rules-dir .privguard/rules/

# Detect only — returns JSON with detection report
node scripts/privguard.cjs detect --input "<text>" --rules-dir .privguard/rules/

# Sanitize a file
node scripts/privguard.cjs sanitize --file <path> --rules-dir .privguard/rules/

# Pipe from stdin
echo "<text>" | node scripts/privguard.cjs sanitize --rules-dir .privguard/rules/
```

### Engine Output Format

The `sanitize` command returns JSON:

```json
{
  "sanitized": "Contact {{PG:PHONE_1}}, email {{PG:EMAIL_1}}",
  "mappings": [
    { "placeholder": "{{PG:PHONE_1}}", "type": "PHONE", "originalValue": "13812345678" },
    { "placeholder": "{{PG:EMAIL_1}}", "type": "EMAIL", "originalValue": "test@example.com" }
  ],
  "report": {
    "totalDetected": 2,
    "totalSanitized": 2,
    "types": ["PHONE", "EMAIL"],
    "items": [
      { "type": "PHONE", "placeholder": "{{PG:PHONE_1}}", "masked": "138****5678", "action": "sanitize" }
    ]
  },
  "diff": "--- original\n+++ sanitized\n- Contact 13812345678, email test@example.com\n+ Contact {{PG:PHONE_1}}, email {{PG:EMAIL_1}}"
}
```

### Engine Workflow

1. Call `sanitize` on user input text
2. Use the `sanitized` text for all reasoning and code generation
3. Store `mappings` in working memory (NEVER persist or send externally)
4. Show the `diff` to the user so they can see what was replaced
5. In your final response, replace all `{{PG:TYPE_N}}` placeholders back to original values
6. Do NOT restore placeholders inside code blocks — use env vars instead

</text>

---

## Instruction Mode

When the engine is not available, follow these steps manually.

### Step 1: Load Rules

Read rule files from `.privguard/rules/`:

| File | Content | Priority |
|------|---------|----------|
| `zh-CN.yml` | Chinese PII (phone, ID card, bank card, landline, plate) | Load first |
| `en-US.yml` | US PII (SSN, ITIN, phone, passport, driver license) | Load second |
| `common.yml` | Universal (email, IP, API key, JWT, private key, password in URL) | Load third |
| `custom.yml` | Project-specific rules (user-defined) | Load last |

If `.privguard/rules/` does not exist, use the built-in rules from `references/rules/`.

### Step 2: Scan

Apply each rule's regex pattern to the input text:

- **confidence: high** — Always match. If `validate` field exists, run the validation algorithm.
- **confidence: medium** — Always match, regex only.
- **confidence: low** — Only match when `context_hint` keywords appear in surrounding text.
- If `skip_values` is defined, ignore matches in the skip list (e.g., `127.0.0.1` for IPv4).
- If `capture_group` is defined, only sanitize that capture group, not the full match.

### Step 3: Replace

Replace each detected value with a typed placeholder:

- Format: `{{PG:TYPE_N}}` — e.g., `{{PG:PHONE_1}}`, `{{PG:EMAIL_2}}`
- Same value always maps to the same placeholder (idempotent)
- Different values of the same type get incrementing N
- Preserve all surrounding text exactly

### Step 4: Show Diff

Display what was replaced in a diff-like format:

```
🛡️ PrivGuard: detected 2 sensitive item(s)

--- original
+++ sanitized
- 联系张三 13812345678，邮箱 test@example.com
+ 联系张三 {{PG:PHONE_1}}，邮箱 {{PG:EMAIL_1}}

Detections:
  [PHONE]  138****5678  → {{PG:PHONE_1}}
  [EMAIL]  tes****com   → {{PG:EMAIL_1}}
```

### Step 5: Process

Use the sanitized text for all reasoning and code generation.

- The mapping table (`{{PG:TYPE_N}}` → original value) exists ONLY in working memory
- NEVER send original sensitive values to external services
- NEVER log or persist the mapping table

### Step 6: Restore

In your final output to the user, replace all `{{PG:...}}` placeholders back to original values.

- Only restore in natural language portions of the response
- Do NOT restore inside code blocks — use environment variables or config references instead
- Example: `process.env.CUSTOMER_PHONE` instead of hardcoding the phone number

### Step 7: Report

```
🛡️ PrivGuard: detected N sensitive item(s) (types: PHONE, EMAIL, ...),
sanitized during processing.
```

---

## Confirm Mode

When `.privguard/config.yml` has `confirm: true`, pause after detection and show the user:

```
🛡️ PrivGuard detected 3 sensitive items:

  1. [PHONE]  138****5678  → sanitize
  2. [EMAIL]  tes****com   → sanitize
  3. [IPV4]   192****100   → sanitize

Options:
  - Enter number to toggle skip (e.g., "3" to skip IPV4)
  - Enter "type NUMBER NEW_TYPE" to reclassify (e.g., "type 1 ORDER_ID")
  - Enter "ok" or empty to proceed

Your choice:
```

The user can:
- Skip specific detections (the value won't be sanitized)
- Reclassify a detection (change its type, e.g., a phone number that's actually an order ID)
- Proceed with all detections as-is

When `confirm: false` (default), skip this step entirely — sanitize everything automatically.

---

## Validation Algorithms

For rules with a `validate` field, apply the corresponding check to reduce false positives:

### luhn (Bank card numbers)
1. From rightmost digit, double every second digit
2. If result > 9, subtract 9
3. Sum all digits — valid if total mod 10 == 0

### idcard_checksum (Chinese 18-digit ID)
1. Weights: `[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2]`
2. Multiply first 17 digits by weights, sum them
3. Check digit = `[1,0,X,9,8,7,6,5,4,3,2][sum % 11]`
4. Must match the 18th character

### ssn_format (US SSN)
- Area (first 3): must NOT be 000, 666, or 900-999
- Group (middle 2): must NOT be 00
- Serial (last 4): must NOT be 0000

---

## Supported PII Types

| Type | Rule File | Confidence | Validation |
|------|-----------|------------|------------|
| PHONE | zh-CN.yml | high | length_11 |
| IDCARD | zh-CN.yml | high | idcard_checksum |
| BANKCARD | zh-CN.yml | high | luhn |
| LANDLINE | zh-CN.yml | medium | — |
| PLATE_NUMBER | zh-CN.yml | medium | — |
| SSN | en-US.yml | high | ssn_format |
| ITIN | en-US.yml | high | — |
| US_PHONE | en-US.yml | medium | — |
| CREDIT_CARD | en-US.yml | high | luhn |
| US_PASSPORT | en-US.yml | low | context_hint |
| US_DRIVER_LICENSE | en-US.yml | low | context_hint |
| EMAIL | common.yml | high | — |
| IPV4 | common.yml | medium | skip_values |
| IPV6 | common.yml | medium | — |
| API_KEY | common.yml | high | — |
| JWT | common.yml | high | — |
| PRIVATE_KEY | common.yml | high | multiline |
| PASSWORD_IN_URL | common.yml | high | capture_group |
| MAC_ADDRESS | common.yml | low | context_hint |

---

## Custom Rules

Users can add project-specific rules in `.privguard/rules/custom.yml`:

```yaml
rules:
  - type: EMPLOYEE_ID
    name: Employee Number
    pattern: 'EMP\d{6}'
    confidence: high
    examples:
      - input: "ID: EMP001234"
        match: "EMP001234"
```

Rule fields:
- `type` (required): Uppercase identifier, used in placeholder `{{PG:TYPE_N}}`
- `name` (required): Human-readable name
- `pattern` (required): Regex pattern string
- `confidence` (required): `high` | `medium` | `low`
- `validate` (optional): Validation algorithm name
- `context_hint` (optional): Regex — only match when context contains this
- `skip_values` (optional): Array of values to ignore
- `capture_group` (optional): Integer — only sanitize this capture group
- `multiline` (optional): Boolean — pattern spans multiple lines
- `examples` (optional): Test cases for validation

---

## Code Generation Rules

When generating code that references detected sensitive values:

- Use environment variables: `process.env.CUSTOMER_PHONE`, `os.environ["API_KEY"]`
- Use config references: `config.get("db_password")`
- NEVER hardcode original sensitive values into generated code
- Add a comment noting the value should come from a secure source

---

## Constraints

1. NEVER send original sensitive values to external services
2. Mapping table MUST only exist in working memory — never persist
3. ALWAYS restore placeholders in final user-facing output (except inside code)
4. Use typed placeholders `{{PG:TYPE_N}}` — never generic `[REDACTED]`
5. When uncertain whether something is sensitive, err on the side of sanitizing
6. The `{{PG:...}}` format is intentionally unique to avoid collision with user content
7. `custom.yml` is user-owned — never overwrite during install or upgrade
