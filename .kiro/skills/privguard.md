---
inclusion: auto
---

# PrivGuard — Sensitive Information Sanitizer

> Automatically detect and sanitize PII, secrets, and credentials before processing.

## When to Activate

Apply this skill when ANY of these conditions are true:

- Text contains phone numbers, ID numbers, email addresses, IP addresses, API keys, tokens, passwords, or other PII
- User mentions: 脱敏, sanitize, redact, protect, privacy, 隐私, PII
- Task involves processing config files, logs, CSVs, env files, or database content
- Task involves sending data to external APIs or services

## Detection Rules

### Chinese PII (high confidence)
- Phone: `1[3-9]\d{9}` (11 digits starting with 13-19)
- ID Card: 18-digit number with date pattern, validate with checksum algorithm
- Bank Card: 16-19 digits starting with 3-6, validate with Luhn algorithm

### Chinese PII (medium confidence)
- Landline: `0\d{2,3}[-\s]?\d{7,8}`
- License Plate: Chinese province char + letter + 5-6 alphanumeric
- Unified Social Credit Code: 18-char alphanumeric

### US PII (high confidence)
- SSN: `\d{3}-\d{2}-\d{4}` (reject 000/666/900+ prefix, 00 group, 0000 serial)
- ITIN: `9\d{2}-[7-9]\d-\d{4}`
- Credit Card: Visa/MC/Amex/Discover patterns, validate with Luhn

### US PII (medium confidence)
- Phone: `\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}`

### US PII (low confidence — only match when context hints present)
- Passport: `[A-Z]?\d{8,9}` (only when "passport" in context)
- Driver License: `[A-Z]\d{7,12}` (only when "driver/license/DL" in context)

### Universal (high confidence)
- Email: standard email pattern
- API Key: `(?i)(sk|ak|key|token|secret|password|api[_-]?key)[-_][a-zA-Z0-9_-]{20,}`
- JWT: `eyJ...` three base64url segments
- Private Key: `-----BEGIN ... PRIVATE KEY-----` blocks

### Universal (medium confidence)
- IPv4: standard dotted quad (skip 127.0.0.1, 0.0.0.0, 255.255.255.255)
- IPv6: eight colon-separated hex groups

### Universal (low confidence)
- MAC Address: six colon/dash-separated hex pairs (only when "mac/MAC/address/网卡" in context)

## Procedure

### Step 1: Scan
Apply detection rules to all input text. For high-confidence rules with validation (Luhn, ID checksum, SSN format), run the validation to reduce false positives. For low-confidence rules, only match when context_hint keywords appear nearby.

### Step 2: Replace
Replace each detected value with a typed placeholder:
- Format: `{{PG:TYPE_N}}` (e.g., `{{PG:PHONE_1}}`, `{{PG:EMAIL_2}}`)
- Same value → same placeholder (idempotent)
- Different values of same type → increment N
- Preserve surrounding text exactly

### Step 3: Process
Use sanitized text for all reasoning and code generation.
- Mapping table lives ONLY in working memory
- NEVER send original values externally
- NEVER log or persist the mapping table

### Step 4: Restore
In final output to user, replace `{{PG:...}}` placeholders back to original values.
- Do NOT restore inside code blocks — use env vars or config references instead
- Only restore in natural language portions of the response

### Step 5: Report
Tell the user what was detected:
```
🛡️ PrivGuard: detected N sensitive items (types: PHONE, EMAIL, ...), sanitized during processing.
```

## Code Generation Rules

When generating code that would reference detected sensitive values:
- Use environment variables: `os.environ["CUSTOMER_PHONE"]`, `process.env.API_KEY`
- Use config references: `config.get("db_password")`
- NEVER hardcode the original sensitive value into generated code
- Add a comment noting the value should come from a secure source

## Custom Rules

If the project has `.privguard/rules/custom.yml`, load additional rules from there.
Format:
```yaml
rules:
  - type: EMPLOYEE_ID
    name: Employee Number
    pattern: 'EMP\d{6}'
    confidence: high
```

## Validation Algorithms

### Luhn (bank cards)
Double every second digit from right, subtract 9 if >9, sum all — valid if mod 10 == 0.

### ID Card Checksum (Chinese 18-digit)
Weights: [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2]. Sum weighted first 17 digits. Check digit = [1,0,X,9,8,7,6,5,4,3,2][sum % 11].

### SSN Format (US)
Area (first 3) must not be 000, 666, or 900-999. Group (middle 2) must not be 00. Serial (last 4) must not be 0000.

## Constraints

1. NEVER send original sensitive values to external services
2. Mapping table MUST only exist in working memory — never persist
3. ALWAYS restore placeholders in final user-facing output (except inside code)
4. Use typed placeholders `{{PG:TYPE_N}}` — never generic `[REDACTED]`
5. When uncertain, err on the side of sanitizing
6. The `{{PG:...}}` format is intentionally unique to avoid collision with user content
