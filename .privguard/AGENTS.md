# PrivGuard — Sensitive Information Sanitizer for AI Agents

> **When any text you process might contain sensitive information (PII, secrets, credentials),
> follow the procedures below to sanitize before reasoning and restore in final output.**

## Activation Triggers

Apply PrivGuard procedures when ANY of these conditions are true:

1. Text contains patterns matching rules in `.privguard/rules/*.yml`
2. User mentions keywords: 脱敏, sanitize, redact, protect, privacy, 隐私, PII
3. Task involves sending data to external APIs, LLMs, or services
4. Processing files that might contain PII (config files, logs, databases, CSVs, env files)

## Procedure

### Step 1: Load Rules

Read all `.yml` files from `.privguard/rules/` directory:

- `zh-CN.yml` — Chinese PII (phone, ID card, bank card, etc.)
- `en-US.yml` — US PII (SSN, phone, passport, driver license, etc.)
- `common.yml` — Universal patterns (email, IP, API keys, JWT, private keys, etc.)
- `custom.yml` — Project-specific rules (user-defined)

Each rule has: `type`, `pattern` (regex), `confidence` (high/medium/low),
and optionally `validate`, `context_hint`, `skip_values`, `capture_group`.

### Step 2: Scan

For each rule, apply its regex `pattern` to the input text:

- **confidence: high** — Always apply. If `validate` field exists, perform additional
  validation (e.g., `luhn` for card numbers, `idcard_checksum` for Chinese ID,
  `ssn_format` to reject 000/666/900-999 prefixes).
- **confidence: medium** — Always apply, no extra validation.
- **confidence: low** — Only apply when `context_hint` keywords appear in surrounding text.
- If `skip_values` is defined, ignore matches that appear in the skip list.
- If `capture_group` is defined, only sanitize that specific capture group, not the full match.

### Step 3: Replace

Replace each detected sensitive value with a typed placeholder:

- Format: `{{PG:TYPE_N}}` (e.g., `{{PG:PHONE_1}}`, `{{PG:EMAIL_2}}`)
- Same value always maps to the same placeholder (idempotent)
- Different values of the same type get incrementing N
- Preserve all surrounding text exactly as-is

### Step 4: Process

Use the sanitized text for all reasoning, code generation, and external operations.

- The mapping table (`{{PG:TYPE_N}}` → original value) exists ONLY in your local working memory.
- NEVER send original sensitive values to external services.
- NEVER log or persist the mapping table.
- When generating code that references detected sensitive values, use parameterized patterns
  (environment variables, config references) instead of hardcoding the values.

### Step 5: Restore

In your final output to the user, replace all `{{PG:...}}` placeholders back to original values.

- Only restore in the final user-facing response.
- If a placeholder appears inside generated code, keep it parameterized (do NOT restore
  sensitive values into code — use env vars or config references instead).

### Step 6: Report

Briefly inform the user what was detected:

```
🛡️ PrivGuard: detected N sensitive items (types: PHONE, EMAIL, API_KEY, ...),
sanitized during processing.
```

## Validation Algorithms

When a rule specifies a `validate` field, apply the corresponding check:

### luhn (Bank card numbers)
1. From rightmost digit, double every second digit
2. If doubling results in > 9, subtract 9
3. Sum all digits — valid if total mod 10 == 0

### idcard_checksum (Chinese 18-digit ID)
1. Weights: [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2]
2. Multiply each of first 17 digits by corresponding weight, sum them
3. Remainder = sum mod 11
4. Check digit map: [1,0,X,9,8,7,6,5,4,3,2] — must match 18th character

### ssn_format (US Social Security Number)
- First 3 digits (area): must NOT be 000, 666, or 900-999
- Middle 2 digits (group): must NOT be 00
- Last 4 digits (serial): must NOT be 0000

## Confidence Levels & Behavior

| Level | When to match | False positive rate | Example types |
|-------|--------------|-------------------|---------------|
| high | Always, with optional validation | < 1% | PHONE, IDCARD, SSN, API_KEY |
| medium | Always, regex only | < 5% | IPV4, US_PHONE, LANDLINE |
| low | Only when `context_hint` matches | < 10% | US_PASSPORT, US_DRIVER_LICENSE, MAC_ADDRESS |

## Special Rule Fields

- `skip_values`: Array of values to ignore even if pattern matches (e.g., `127.0.0.1` for IPV4)
- `context_hint`: Regex pattern — rule only activates when surrounding text matches this hint
- `capture_group`: Integer — only sanitize the specified capture group, not the full match
  (e.g., for `PASSWORD_IN_URL`, only replace the password portion of the connection string)
- `multiline`: Boolean — pattern may span multiple lines (e.g., private key blocks)

## Custom Rules

Users can add project-specific rules in `.privguard/rules/custom.yml`.

Format:
```yaml
rules:
  - type: EMPLOYEE_ID        # Uppercase, used in placeholder {{PG:EMPLOYEE_ID_1}}
    name: Employee Number     # Human-readable name
    pattern: 'EMP\d{6}'      # Regex pattern
    confidence: high          # high / medium / low
    examples:                 # Optional: test cases
      - input: "ID: EMP001234"
        match: "EMP001234"
```

## Important Constraints

1. NEVER send original sensitive values to external services
2. Mapping table MUST only exist in local working memory — never persist it
3. ALWAYS restore placeholders in final user-facing output (except inside code)
4. Use typed placeholders `{{PG:PHONE_1}}` — never use generic `[REDACTED]`
5. When uncertain whether something is sensitive, err on the side of sanitizing
6. In generated code, use environment variables or config references for sensitive values
7. The `{{PG:...}}` placeholder format is intentionally unique to avoid collision with
   user content — do not simplify it to `[TYPE_N]`
