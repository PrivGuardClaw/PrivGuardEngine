# PrivGuard — Sensitive Information Sanitizer

> When any text you process might contain sensitive information (PII, secrets, credentials),
> follow the procedures below to sanitize before external transmission and restore after.

## Activation Triggers

Apply PrivGuard procedures when ANY of these conditions are true:
- Text contains patterns matching rules in `.privguard/rules/*.yml`
- User mentions: 脱敏, sanitize, redact, protect, privacy, 隐私
- Task involves sending data to external APIs, LLMs, or services
- Processing files that might contain PII (config files, logs, databases, CSVs)

## Procedure

### Step 1: Load Rules
Read all `.yml` files from `.privguard/rules/` directory.

### Step 2: Scan
Apply each rule's regex pattern to the text. For rules with `validate` field,
perform additional validation (Luhn, checksum, etc.).

### Step 3: Replace
Replace each detected entity with `<|PG:TYPE_N|>` placeholder:
- Same value → same placeholder (idempotent)
- Different values of same type → increment N

### Step 4: Process
Use sanitized text for all external operations. The mapping table exists only in working memory.

### Step 5: Restore
In final output to user, replace all placeholders back to original values.
Exception: code blocks — use environment variables instead.

### Step 6: Report
Inform the user: "🛡️ PrivGuard: detected N sensitive items, sanitized during processing."

## Constraints

1. NEVER send original sensitive values to external services
2. Mapping table MUST only exist in local memory
3. ALWAYS restore placeholders in final output (except code blocks)
4. Use `<|PG:TYPE_N|>` format, not `[REDACTED]` or `{{...}}`
5. When uncertain, err on the side of sanitizing
6. NEVER overwrite `.privguard/rules/custom.yml` during upgrades
