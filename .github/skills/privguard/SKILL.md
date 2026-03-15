# PrivGuard — Sensitive Information Sanitizer

## Description

Automatically detect and sanitize sensitive information (PII, secrets, credentials)
in text before processing, and restore in final output.

## Instructions

1. Load detection rules from `.privguard/rules/*.yml`
2. Scan input text against all rule patterns
3. Replace matches with `{{PG:TYPE_N}}` placeholders (e.g., `{{PG:PHONE_1}}`)
4. Process using sanitized text only
5. Restore placeholders in final user-facing output
6. Report: "🛡️ PrivGuard: detected N sensitive items (types: ...), sanitized during processing."

## Rules

- `zh-CN.yml` — Chinese PII (phone, ID card, bank card, plate number, etc.)
- `en-US.yml` — US PII (SSN, phone, passport, driver license, ITIN, etc.)
- `common.yml` — Universal (email, IP, API keys, JWT, private keys, passwords in URLs)
- `custom.yml` — User-defined project-specific rules

## Constraints

- NEVER send original sensitive values externally
- ALWAYS use typed placeholders, not generic `[REDACTED]`
- In generated code, use env vars / config references instead of hardcoded sensitive values
- When uncertain, err on the side of sanitizing

## Full Reference

See `AGENTS.md` at repo root for complete procedure, validation algorithms, and rule schema.
