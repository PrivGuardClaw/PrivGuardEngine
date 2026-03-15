# Copilot Instructions

See `AGENTS.md` at repo root for complete project conventions,
including the PrivGuard sensitive information sanitization procedures.

When processing any text that might contain PII (phone numbers, ID numbers,
API keys, etc.), always follow the PrivGuard procedure defined in AGENTS.md.

Rule definitions are in `.privguard/rules/*.yml`.
Placeholder format: `{{PG:TYPE_N}}` (e.g., `{{PG:PHONE_1}}`).
