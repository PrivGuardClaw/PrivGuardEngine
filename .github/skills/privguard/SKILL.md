---
name: privguard
description: Sanitize sensitive PII in text before sending to external APIs or LLMs
license: MIT
---

# PrivGuard Skill

> 在将文本发送到外部 API 或大型语言模型之前，自动检测并替换敏感的个人信息（PII）。  
> Automatically detect and replace sensitive personal information (PII) before sending text to external APIs or LLMs.

---

## When to Use This Skill

Activate PrivGuard in any of the following situations:

- User's prompt contains **Chinese PII** (手机号、身份证、银行卡号、邮箱、IP地址等)
- User asks to **"脱敏"、"sanitize"、"redact"** or **"protect privacy"**
- Code context involves **sending user data to external APIs** (HTTP requests, LLM calls, logging)
- Processing **files that may contain personal information** (CSV, JSON, logs, database exports)
- Any data pipeline where **sensitive values could be inadvertently exposed**

---

## Detection Rules — Chinese PII (zh-CN)

| Type       | Description |
|------------|-------------|
| `PHONE`    | 中国大陆手机号 (e.g., `13812345678`) |
| `IDCARD`   | 居民身份证号 (18位) |
| `BANKCARD` | 银行卡号 (16–19位，建议配合 Luhn 算法校验) |
| `EMAIL`    | 邮箱地址 |
| `IP`       | IPv4 地址 |
| `USCC`     | 统一社会信用代码 (18位) |
| `API_KEY`  | API 密钥 (以 `sk-`、`ak-`、`key-` 开头) |

Regex patterns (use these exactly when implementing detection):

```
PHONE    (?<!\d)(1[3-9]\d{9})(?!\d)
IDCARD   (?<!\d)([1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx])(?!\d)
BANKCARD (?<!\d)([3-6]\d{15,18})(?!\d)
EMAIL    ([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})
IP       (?<!\d)(\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b)(?!\d)
USCC     ([0-9A-HJ-NP-RT-UW-Y]{2}\d{6}[0-9A-HJ-NP-RT-UW-Y]{10})
API_KEY  ((?:sk|ak|key)-[A-Za-z0-9_\-]{16,})
```

> **Note on BANKCARD**: The regex is a structural filter. For production use, validate the Luhn checksum after pattern matching to reduce false positives.

---

## Step-by-Step Instructions

### Step 1 — Detect Sensitive Entities

Scan the input text using the regex patterns in the Detection Rules table above. For each match:
- Record the **matched value** and its **type** (PHONE, IDCARD, etc.)
- Track the **position** (start index, end index) for accurate replacement

### Step 2 — Build the Mapping Table (Local Only)

Create an in-memory mapping table. For each unique sensitive value found:

```
mapping = {}         # value → placeholder
reverse = {}         # placeholder → value
counters = {}        # type → count

for each match (value, type):
    if value not in mapping:
        counters[type] += 1
        placeholder = f"[{type}_{counters[type]}]"
        mapping[value] = placeholder
        reverse[placeholder] = value
```

Rules:
- **Same value appearing multiple times** → use the **same placeholder** (do not increment)
- **Multiple distinct values of the same type** → increment the counter (`[PHONE_1]`, `[PHONE_2]`, …)
- **Overlapping matches** → prefer the longer match (greedy resolution)

### Step 3 — Replace and Sanitize

Replace every occurrence of each sensitive value in the text with its assigned placeholder.

```
sanitized_text = original_text
for value, placeholder in mapping.items():
    sanitized_text = sanitized_text.replace(value, placeholder)
```

Use `sanitized_text` for **all** external API calls, LLM interactions, or logging.

### Step 4 — Restore Placeholders in Response

After receiving the response from the external service or LLM:

```
restored_text = llm_response
for placeholder, value in reverse.items():
    restored_text = restored_text.replace(placeholder, value)
```

Return `restored_text` to the user.

---

## Important Rules

| Rule | Description |
|------|-------------|
| 🔒 **Never send originals** | Original sensitive values MUST NEVER be sent to external services |
| 🗂️ **Local mapping only** | The mapping table must ONLY exist in local memory or context — never persist to disk, never log, never transmit |
| ♻️ **Always restore** | Always restore placeholders in the final output shown to the user |
| 🏷️ **Typed placeholders** | Use typed placeholders (`[PHONE_1]`, `[EMAIL_1]`) not generic ones (`[REDACTED]`) to preserve semantic meaning for the LLM |
| 🔁 **Idempotent detection** | Running detection on already-sanitized text should produce no new replacements |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Same value appears 3 times | All 3 occurrences → same placeholder (e.g., `[PHONE_1]`) |
| Two different phone numbers | First → `[PHONE_1]`, Second → `[PHONE_2]` |
| Phone embedded in ID card | Prefer the longer match (ID card pattern wins) |
| Value spans two patterns | Apply longest-match rule; do not double-replace |
| No PII found | Pass text through unmodified; skip restoration step |
| LLM modifies placeholder (e.g., `[PHONE1]`) | Log a warning; return the partially-restored text with a note |

---

## Custom Rules

You can extend the built-in rules by providing a `rules.json` file in your project:

```json
{
  "version": "1.0",
  "custom_rules": [
    {
      "type": "EMPLOYEE_ID",
      "pattern": "EMP-\\d{6}",
      "description": "Internal employee ID"
    },
    {
      "type": "PROJECT_CODE",
      "pattern": "PROJ-[A-Z]{3}-\\d{4}",
      "description": "Internal project code"
    }
  ]
}
```

Custom rules are applied **after** built-in rules. If a custom rule's type matches a built-in type name, it will **override** the built-in pattern for that type.

---

## Examples

### Example 1 — Single PII type

**Input:**
```
客户张三的手机号是13812345678，请帮我发送提醒短信。
```

**After sanitization (sent to LLM):**
```
客户张三的手机号是[PHONE_1]，请帮我发送提醒短信。
```

**LLM response:**
```
好的，已向[PHONE_1]发送还款提醒短信。
```

**After restoration (shown to user):**
```
好的，已向13812345678发送还款提醒短信。
```

---

### Example 2 — Mixed PII (phone + ID card + email)

**Input:**
```
客户张三(手机13812345678，身份证110101199001011234，邮箱zhangsan@example.com)的贷款逾期了，请分析风险。
```

**Mapping table (local only):**
```
13812345678        → [PHONE_1]
110101199001011234 → [IDCARD_1]
zhangsan@example.com → [EMAIL_1]
```

**After sanitization (sent to LLM):**
```
客户张三(手机[PHONE_1]，身份证[IDCARD_1]，邮箱[EMAIL_1])的贷款逾期了，请分析风险。
```

**LLM response:**
```
建议通过[EMAIL_1]发送逾期通知，并致电[PHONE_1]跟进。请核实[IDCARD_1]对应的征信记录。
```

**After restoration (shown to user):**
```
建议通过zhangsan@example.com发送逾期通知，并致电13812345678跟进。请核实110101199001011234对应的征信记录。
```

---

### Example 3 — Repeated value

**Input:**
```
联系人：13812345678。紧急联系：13812345678。备用联系：13987654321。
```

**Mapping table:**
```
13812345678 → [PHONE_1]
13987654321 → [PHONE_2]
```

**After sanitization:**
```
联系人：[PHONE_1]。紧急联系：[PHONE_1]。备用联系：[PHONE_2]。
```

---

### Example 4 — API key in code context

**Input:**
```python
client = OpenAI(api_key="sk-abcdefghijklmnopqrstuvwx1234567890")
response = client.chat.completions.create(...)
```

**After sanitization:**
```python
client = OpenAI(api_key="[API_KEY_1]")
response = client.chat.completions.create(...)
```

> ⚠️ API keys should **never** be shared in prompts. PrivGuard catches them as a safety net, but avoid hardcoding secrets in the first place.
