现在我有了足够的调研信息。让我为你写一份完整的需求分析和设计文档。

---

# 📋 PrivGuard Skill 需求分析与设计文档

## 第零章：从第一性原理出发

### 0.1 我们到底在解决什么问题？

```
根本问题：
  人类想让 AI 帮忙处理含敏感信息的任务，
  但敏感信息一旦发出去，就不可控了。

约束条件：
  1. AI 必须理解文本的语义才能帮忙（所以不能加密）
  2. 敏感信息不能离开本地（隐私红线）
  3. 这两个需求看起来矛盾

解法：
  不矛盾——AI 不需要知道"张三"是谁，只需要知道这里有"一个人"。
  把"张三"换成"[PERSON_1]"，语义保留，隐私保护。
```

### 0.2 Skill 的本质是什么？

从第一性原理看，**Skill 不是代码库，不是 API，不是工具——它是给 Agent 的"肌肉记忆"。**

```
类比人类：
  你学会了骑自行车 → 这是一个 skill
  你不需要每次骑车都看说明书
  这个 skill 内化在你的行为模式里

类比 Agent：
  Agent 学会了"遇到敏感信息先脱敏" → 这是一个 skill
  它不需要每次都被提醒
  这个 skill 内化在它的 system prompt / instruction 里
```

**所以 Skill 的最佳���态是：一段足够清晰的指令，让 Agent "学会"一个行为模式。**

### 0.3 谁是 Skill 的消费者？

```
┌─────────────────────────────────────────────────────┐
│              Skill 的两层消费者                        │
│                                                     │
│  第一层：Agent（机器）                                │
│    ├── GitHub Copilot  → 读 .github/copilot-instructions.md │
│    │                     或 .github/skills/xxx/SKILL.md     │
│    ├── Claude Code     → 读 CLAUDE.md                       │
│    ├── OpenCode        → 读 AGENTS.md                       │
│    ├── OpenClaw        → 读 AGENTS.md                       │
│    ├── Cursor          → 读 .cursorrules 或 AGENTS.md       │
│    └── 其他 Agent      → 读 AGENTS.md (通用标准)             │
│                                                     │
│  第二层：人类（开发者）                                │
│    ├── 想把 Skill 加到自己项目里的人                     │
│    ├── 想扩展自定义规则的人                              │
│    └── 想理解 Skill 做了什么的人                        │
│                                                     │
│  关键洞察：                                           │
│    同一套逻辑，必须同时让机器能精确执行、让人能轻松理解    │
│    Markdown 是唯一同时满足这两个需求的格式              │
└─────────────────────────────────────────────────────┘
```

### 0.4 2026 年 Agent 指令文件的生态现状

| 文件 | 所属 Agent | 治理方 | 地位 |
|------|-----------|--------|------|
| `AGENTS.md` | Cursor, Copilot, Codex, Windsurf, Zed, Gemini CLI, OpenCode, OpenClaw | AAIF (Agentic AI Foundation, Linux 基金会下) | **通用标准，行业共识** |
| `CLAUDE.md` | Claude Code | Anthropic | Claude 专属，可引用 AGENTS.md |
| `.github/copilot-instructions.md` | GitHub Copilot | GitHub | Copilot 专属 |
| `.github/skills/xxx/SKILL.md` | GitHub Copilot Coding Agent | GitHub | Copilot Agent 专属 |
| `.cursorrules` | Cursor | Cursor | Cursor 专属（渐被 AGENTS.md 替代） |

**关键决策：我们应该以 `AGENTS.md` 为核心标准，同时生成各 Agent 的专属文件。**

---

## 第一章：产品需求

### 1.1 核心需求

```
作为一个使用 AI Agent 写代码的开发者，
我希望 Agent 在处理含敏感信息的任务时，自动执行脱敏，
这样我就不用担心隐私泄露，也不用手动脱敏。
```

### 1.2 用户场景

**场景 A：Agent 读到了含敏感信息的代码/文件**
```
用户: "帮我重构 config.py，里面有数据库连接串和 API key"
Agent 行为（有 PrivGuard Skill）:
  1. 读取 config.py
  2. 检测到 API key (sk-xxx) 和数据库密码
  3. 在内部处理时替换为 [API_KEY_1] 和 [PASSWORD_1]
  4. 用脱敏后的文本做推理
  5. 输出给用户时还原回原始值
```

**场景 B：用户 prompt 里包含敏感信息**
```
用户: "帮我写一个函数，把客户张三(手机13812345678)的订单状态改成已完成"
Agent 行为（有 PrivGuard Skill）:
  1. 检测到 PERSON (张三) 和 PHONE (13812345678)
  2. 脱敏后理解为："帮我写一个函数，把客户[PERSON_1](手机[PHONE_1])的订单状态改成已完成"
  3. 生成代码时使用参数化写法，不硬编码敏感信息
  4. 提醒用户："检测到敏感信息，已在处理中脱敏"
```

**场景 C：用户主动要求脱敏**
```
用户: "帮我把这段文本里的所有敏感信息脱敏"
Agent 行为: 直接执行检测+替换，输出脱敏结果和映射表
```

**场景 D：用户想添加自定义规则**
```
用户: "我们公司的员工号格式是 EMP 开头后面跟 6 位数字，帮我加到规则里"
Agent 行为: 在 rules 配置中添加自定义规则
```

### 1.3 功能需求清单

| ID | 需求 | 优先级 | 说明 |
|----|------|--------|------|
| F1 | 中国 PII 检测 | P0 | 手机号、身份证、银行卡、邮箱、IP |
| F2 | 美国 PII 检测 | P0 | SSN、电话、驾照、护照、ITIN |
| F3 | 通用敏感信息检测 | P0 | API Key、密码、Token、私钥 |
| F4 | 占位符替换 | P0 | 类型化编号占位符 `[TYPE_N]` |
| F5 | 占位符还原 | P0 | 回复中的占位符自动还原 |
| F6 | 自定义规则注入 | P1 | 用户可通过简单格式添加规则 |
| F7 | 多 Agent 兼容 | P0 | 同时支持 AGENTS.md / CLAUDE.md / SKILL.md |
| F8 | 可执行脚本 | P1 | 提供 bash 脚本供 Agent 调用 |
| F9 | 行为透明 | P1 | Agent 应告知用户检测到了什么、做了什么 |
| F10 | 零依赖 | P0 | 纯 Markdown + bash，不需要安装任何东西 |

### 1.4 非功能需求

| ID | 需求 | 说明 |
|----|------|------|
| NF1 | 零安装成本 | 复制文件到仓库即可使用 |
| NF2 | 100% 本地 | 检测和替换全在本地完成 |
| NF3 | 中英双语 | 指令和文档双语 |
| NF4 | 误报率 < 5% | 通过校验算法（Luhn、身份证校验码）降低误报 |
| NF5 | 不破坏语义 | 占位符保留类型信息，不影响 Agent 推理 |

---

## 第二章：架构设计

### 2.1 整体架构

```
PrivGuardEngine 仓库
│
├── 发行物（用户复制到自己项目里的东西）
│   │
│   ├── 📄 AGENTS.md           ← 通用标准，所有 Agent 都能读
│   ├── 📄 CLAUDE.md           ← Claude Code 专属（引用 AGENTS.md）
│   ├── 📁 .github/
│   │   ├── copilot-instructions.md  ← Copilot 专属（引用 AGENTS.md）
│   │   └── skills/privguard/
│   │       └── SKILL.md       ← Copilot Coding Agent 专属
│   ├── 📁 .privguard/
│   │   ├── rules/
│   │   │   ├── zh-CN.yml      ← 中国 PII 规则
│   │   │   ├── en-US.yml      ← 美国 PII 规则
│   │   │   ├── common.yml     ← 通用敏感信息规则
│   │   │   └── custom.yml     ← 用户自定义规则（用户编辑这个）
│   │   └── sanitize.sh        ← 可执行脚本
│   │
│   └── 📄 install.sh          ← 一键安装脚本
│
├── 源码（仓库本身的内容）
│   ├── README.md
│   ├── docs/
│   │   ├── DESIGN.md           ← 本文档
│   │   ├── ROADMAP.md
│   │   └── RULES_GUIDE.md     ← 自��义规则指南
│   ├── templates/              ← 各种指令文件的模板/源码
│   ├── tests/                  ← 规则测试
│   └── scripts/
│       └── generate.sh         ← 从模板生成发行物
│
└── examples/
    └── demo-project/           ← 一个示例项目，展示集成效果
```

### 2.2 核心设计决策

#### 决策 1：以 `AGENTS.md` 为核心，其他文件引用它

```
为什么：
  AGENTS.md 是 2026 年的行业标准，被最多 Agent 支持。
  避免维护多份重复内容。

实现：
  AGENTS.md        → 包含完整指令（800-1200 行）
  CLAUDE.md        → 10 行，引用 AGENTS.md + Claude 专属补充
  copilot-instructions.md → 10 行，引用 AGENTS.md
  SKILL.md         → AGENTS.md 的精简版（适配 Copilot Agent 格式）
```

#### 决策 2：规则和指令分离

```
为什么：
  指令文件（AGENTS.md）描述"怎么做"——这是稳定的
  规则文件（.privguard/rules/*.yml）描述"检测什么"——这是可变的

  分离后：
  - 用户只需编辑 .privguard/rules/custom.yml 就能添加规则
  - 不需要碰 AGENTS.md
  - 升级时只需替换指令文件，不会覆盖用户自定义规则
```

#### 决策 3：规则用 YAML 而不是 JSON 或正则文本

```
为什么：
  - YAML 比 JSON 对人类更友好（有注释、无引号地狱）
  - YAML 比纯正则文本有结构（类型、描述、示例、验证）
  - Agent 能直接解析 YAML（所有主流 Agent 都能）
  - 用户添加自定义规则时心智负担最低
```

#### 决策 4：一键安装脚本

```
为什么：
  用户不应该手动复制 7 个文件到正确的目录。
  一个命令搞定一切。

实现：
  curl -fsSL https://raw.githubusercontent.com/PrivGuardClaw/PrivGuardEngine/main/install.sh | bash
  
  或者：
  npx privguard init
```

---

## 第三章：详细设计

### 3.1 规则文件格式

```yaml name=.privguard/rules/zh-CN.yml
# PrivGuard 中国 PII 检测规则
# 版本: 1.0
# 语言: zh-CN

rules:
  # ========== 高置信度规则（正则 + 校验） ==========

  - type: PHONE
    name: 中国大陆手机号
    pattern: '(?<!\d)(1[3-9]\d{9})(?!\d)'
    confidence: high
    validate: length_11
    examples:
      - input: "请联系13812345678"
        match: "13812345678"
      - input: "订单号2139876543210"
        match: null  # 不应匹配（前面有数字）

  - type: IDCARD
    name: 身份证号
    pattern: '(?<!\d)([1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx])(?!\d)'
    confidence: high
    validate: idcard_checksum  # 18位校验码算法
    examples:
      - input: "身份证号110101199001011234"
        match: "110101199001011234"

  - type: BANKCARD
    name: 银行卡号
    pattern: '(?<!\d)([3-6]\d{15,18})(?!\d)'
    confidence: high
    validate: luhn  # Luhn 算法
    examples:
      - input: "卡号6225880137654321"
        match: "6225880137654321"

  # ========== 中置信度规则（正则，无校验） ==========

  - type: UNIFIED_SOCIAL_CREDIT_CODE
    name: 统一社会信用代码
    pattern: '([0-9A-HJ-NP-RT-UW-Y]{2}\d{6}[0-9A-HJ-NP-RT-UW-Y]{10})'
    confidence: medium
    examples:
      - input: "信用代码91110000MA01ABCDE9"
        match: "91110000MA01ABCDE9"

  - type: LANDLINE
    name: 固定电话
    pattern: '(?<!\d)(0\d{2,3}[-\s]?\d{7,8})(?!\d)'
    confidence: medium
    examples:
      - input: "电话010-12345678"
        match: "010-12345678"

  - type: PLATE_NUMBER
    name: 车牌号
    pattern: '([京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳])'
    confidence: medium
    examples:
      - input: "车牌京A12345"
        match: "京A12345"
```

```yaml name=.privguard/rules/en-US.yml
# PrivGuard US PII Detection Rules
# Version: 1.0
# Locale: en-US

rules:
  - type: SSN
    name: Social Security Number
    pattern: '(?<!\d)(\d{3}[-\s]?\d{2}[-\s]?\d{4})(?!\d)'
    confidence: high
    validate: ssn_format  # 排除 000/666/900-999 开头
    examples:
      - input: "SSN: 123-45-6789"
        match: "123-45-6789"
      - input: "SSN: 000-12-3456"
        match: null  # 无效 SSN

  - type: US_PHONE
    name: US Phone Number
    pattern: '(?<!\d)(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})(?!\d)'
    confidence: medium
    examples:
      - input: "Call (555) 123-4567"
        match: "(555) 123-4567"

  - type: US_PASSPORT
    name: US Passport Number
    pattern: '(?<![A-Z0-9])([A-Z]?\d{8,9})(?![A-Z0-9])'
    confidence: low
    context_hint: "passport"  # 只在上下文出现 passport 时检测
    examples:
      - input: "Passport: C12345678"
        match: "C12345678"

  - type: US_DRIVER_LICENSE
    name: US Driver License (common formats)
    pattern: '(?<![A-Z0-9])([A-Z]\d{7,12})(?![A-Z0-9])'
    confidence: low
    context_hint: "driver|license|DL"
    examples:
      - input: "DL: A1234567"
        match: "A1234567"

  - type: ITIN
    name: Individual Taxpayer Identification Number
    pattern: '(?<!\d)(9\d{2}[-\s]?[7-9]\d[-\s]?\d{4})(?!\d)'
    confidence: high
    examples:
      - input: "ITIN: 912-70-1234"
        match: "912-70-1234"

  - type: US_BANKCARD
    name: Credit/Debit Card Number
    pattern: '(?<!\d)((?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12}))(?!\d)'
    confidence: high
    validate: luhn
    examples:
      - input: "Card: 4111111111111111"
        match: "4111111111111111"
```

```yaml name=.privguard/rules/common.yml
# PrivGuard Common Sensitive Information Rules
# Version: 1.0
# Locale: universal

rules:
  - type: EMAIL
    name: Email Address
    pattern: '([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})'
    confidence: high
    examples:
      - input: "Email: zhangsan@example.com"
        match: "zhangsan@example.com"

  - type: IPV4
    name: IPv4 Address
    pattern: '(?<!\d)((?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3})(?!\d)'
    confidence: medium
    skip_values: ["127.0.0.1", "0.0.0.0", "255.255.255.255"]  # 常见非敏感 IP
    examples:
      - input: "Server: 192.168.1.100"
        match: "192.168.1.100"
      - input: "Localhost: 127.0.0.1"
        match: null  # 跳过

  - type: IPV6
    name: IPv6 Address
    pattern: '((?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4})'
    confidence: medium

  - type: API_KEY
    name: API Key / Secret Key
    pattern: '(?i)((?:sk|ak|key|token|secret|password|api[_-]?key)[-_]?[a-zA-Z0-9]{20,})'
    confidence: high
    examples:
      - input: "OPENAI_API_KEY=sk-abc123def456ghi789jkl012mno345"
        match: "sk-abc123def456ghi789jkl012mno345"

  - type: PRIVATE_KEY
    name: Private Key Block
    pattern: '(-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----)'
    confidence: high
    multiline: true

  - type: JWT
    name: JSON Web Token
    pattern: '(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})'
    confidence: high

  - type: PASSWORD_IN_URL
    name: Password in URL/Connection String
    pattern: '(?i)((?:mysql|postgres|mongodb|redis|amqp|ftp|https?):\/\/[^:]+:)([^@\s]+)(@)'
    confidence: high
    capture_group: 2  # 只替换密码部分

  - type: MAC_ADDRESS
    name: MAC Address
    pattern: '((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})'
    confidence: low
    context_hint: "mac|MAC|address|网卡"
```

```yaml name=.privguard/rules/custom.yml
# PrivGuard 自定义规则
# 在这里添加你的项目/行业特有的敏感信息规则
#
# 格式示例:
#   rules:
#     - type: EMPLOYEE_ID       # 类型名（全大写，用于占位符 [EMPLOYEE_ID_1]）
#       name: 员工工号           # 可读名称
#       pattern: 'EMP\d{6}'     # 正则表达式
#       confidence: high        # high / medium / low
#       examples:               # 可选：测试用例
#         - input: "工号EMP001234"
#           match: "EMP001234"
#
# 添加规则后，Agent 会在下次运行时自动加载。

rules: []
  # 取消下面的注释来添加你的第一条自定义规则：
  #
  # - type: EMPLOYEE_ID
  #   name: 员工工号
  #   pattern: 'EMP\d{6}'
  #   confidence: high
  #
  # - type: PROJECT_CODE
  #   name: 项目代号
  #   pattern: 'PRJ-[A-Z]{2,4}-\d{4}'
  #   confidence: medium
```

### 3.2 AGENTS.md 设计（核心指令文件）

````markdown name=AGENTS.md（结构设计，此处为缩略版示意）
# PrivGuard — Sensitive Information Sanitizer

> **When any text you process might contain sensitive information (PII, secrets, credentials),
> follow the procedures below to sanitize before external transmission and restore after.**

## Activation Triggers

Apply PrivGuard procedures when ANY of these conditions are true:
- Text contains patterns matching rules in `.privguard/rules/*.yml`
- User mentions: 脱敏, sanitize, redact, protect, privacy, 隐私
- Task involves sending data to external APIs, LLMs, or services
- Processing files that might contain PII (config files, logs, databases, CSVs)

## Procedure

### Step 1: Load Rules
Read all `.yml` files from `.privguard/rules/` directory:
- `zh-CN.yml` — Chinese PII
- `en-US.yml` — US PII
- `common.yml` — Universal patterns (email, IP, API keys, etc.)
- `custom.yml` — Project-specific rules

### Step 2: Scan
Apply each rule's regex pattern to the text. For rules with `validate` field,
perform additional validation (Luhn, checksum, etc.). For rules with `context_hint`,
only match when context contains the hint keywords.

### Step 3: Replace
Replace each detected entity with `[TYPE_N]` placeholder:
- Same value �� same placeholder (idempotent)
- Different values of same type → increment N
- Preserve surrounding text exactly

### Step 4: Process
Use sanitized text for all external operations. The mapping table
(`[TYPE_N]` → original value) exists only in your working memory.

### Step 5: Restore
In final output to user, replace all placeholders back to original values.

### Step 6: Report
Briefly inform the user: "🛡️ PrivGuard: detected N sensitive items (types: ...),
sanitized during processing."

## Rules

[Full rule documentation with regex patterns, examples, and edge cases]

## Custom Rules

Users can add rules in `.privguard/rules/custom.yml`. Format: [YAML schema description]

## Important Constraints

1. NEVER send original sensitive values to external services
2. Mapping table MUST only exist in local memory/context
3. ALWAYS restore placeholders in final output to user
4. Use typed placeholders `[PHONE_1]` not generic `[REDACTED]`
5. When uncertain if something is sensitive, err on the side of sanitizing
6. NEVER log or persist the mapping table
````

### 3.3 Agent 兼容层设计

````markdown name=CLAUDE.md（实际文件内容）
# Project Instructions

See `AGENTS.md` for complete project conventions and the PrivGuard skill.

## Claude-Specific Notes

- When using PrivGuard sanitization, prefer processing files through the
  `.privguard/sanitize.sh` script when available for batch operations.
- The complete rule definitions are in `.privguard/rules/*.yml` — read them
  at session start for accurate PII detection.
- For custom rule additions, guide users to edit `.privguard/rules/custom.yml`.
````

````markdown name=.github/copilot-instructions.md（实际文件内容）
# Copilot Instructions

See `AGENTS.md` at repo root for complete project conventions,
including the PrivGuard sensitive information sanitization procedures.

When processing any text that might contain PII (phone numbers, ID numbers,
API keys, etc.), always follow the PrivGuard procedure defined in AGENTS.md.

Rule definitions are in `.privguard/rules/*.yml`.
````

### 3.4 一键安装脚本设计

```bash name=install.sh
#!/usr/bin/env bash
# PrivGuard Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/PrivGuardClaw/PrivGuardEngine/main/install.sh | bash
#
# 也可以指定要安装的内容：
#   bash install.sh --all           安装所有文件
#   bash install.sh --agents-only   只安装 AGENTS.md（最小化）
#   bash install.sh --rules-only    只安装规则文件
#   bash install.sh --locale zh-CN  只安装中文规则（默认 zh-CN + en-US + common）

set -euo pipefail

REPO="PrivGuardClaw/PrivGuardEngine"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[PrivGuard]${NC} $1"; }
ok()    { echo -e "${GREEN}[PrivGuard]${NC} ✅ $1"; }
warn()  { echo -e "${YELLOW}[PrivGuard]${NC} ⚠️  $1"; }

MODE="${1:---all}"

info "Installing PrivGuard into current project..."
echo ""

# ====== 安装规则文件 ======
install_rules() {
  mkdir -p .privguard/rules

  info "Downloading detection rules..."
  curl -fsSL "${BASE_URL}/dist/.privguard/rules/zh-CN.yml"  -o .privguard/rules/zh-CN.yml
  curl -fsSL "${BASE_URL}/dist/.privguard/rules/en-US.yml"  -o .privguard/rules/en-US.yml
  curl -fsSL "${BASE_URL}/dist/.privguard/rules/common.yml" -o .privguard/rules/common.yml

  # custom.yml: 只在不存在时创建（不覆盖用户自定义规则）
  if [ ! -f .privguard/rules/custom.yml ]; then
    curl -fsSL "${BASE_URL}/dist/.privguard/rules/custom.yml" -o .privguard/rules/custom.yml
  else
    warn "custom.yml already exists, skipping (your rules are preserved)"
  fi

  curl -fsSL "${BASE_URL}/dist/.privguard/sanitize.sh" -o .privguard/sanitize.sh
  chmod +x .privguard/sanitize.sh

  ok "Rules installed to .privguard/"
}

# ====== 安装指令文件 ======
install_instructions() {
  info "Downloading agent instruction files..."

  curl -fsSL "${BASE_URL}/dist/AGENTS.md" -o AGENTS.md
  ok "AGENTS.md installed (universal standard)"

  curl -fsSL "${BASE_URL}/dist/CLAUDE.md" -o CLAUDE.md
  ok "CLAUDE.md installed (Claude Code)"

  mkdir -p .github
  curl -fsSL "${BASE_URL}/dist/.github/copilot-instructions.md" -o .github/copilot-instructions.md
  ok "copilot-instructions.md installed (GitHub Copilot)"

  mkdir -p .github/skills/privguard
  curl -fsSL "${BASE_URL}/dist/.github/skills/privguard/SKILL.md" -o .github/skills/privguard/SKILL.md
  ok "SKILL.md installed (Copilot Coding Agent)"
}

case "$MODE" in
  --all)
    install_rules
    install_instructions
    ;;
  --agents-only)
    install_instructions
    ;;
  --rules-only)
    install_rules
    ;;
  *)
    install_rules
    install_instructions
    ;;
esac

echo ""
ok "PrivGuard installed successfully! 🛡️"
echo ""
info "Files installed:"
info "  AGENTS.md                              — Universal agent instructions"
info "  CLAUDE.md                              — Claude Code instructions"
info "  .github/copilot-instructions.md        — GitHub Copilot instructions"
info "  .github/skills/privguard/SKILL.md      — Copilot Coding Agent skill"
info "  .privguard/rules/*.yml                 — Detection rules"
info "  .privguard/sanitize.sh                 — Executable sanitizer script"
echo ""
info "To add custom rules, edit: .privguard/rules/custom.yml"
info "Documentation: https://github.com/${REPO}"
```

### 3.5 接口设计总览

```
用户接触面（按使用频率排序）：

1. 一键安装（一次性）
   curl ... | bash
   └── 复制文件到项目，完事

2. 自动生效（零感知）
   └── Agent 自动读取 AGENTS.md，遇到敏感信息自动脱敏
   └── 用户什么都不用做

3. 自定义规则（偶尔）
   └── 编辑 .privguard/rules/custom.yml
   └── 纯 YAML，有注释示例，照葫芦画瓢

4. 手动执行（偶尔）
   └── bash .privguard/sanitize.sh detect --input "文本"
   └── bash .privguard/sanitize.sh sanitize --input "文本"

5. 升级（偶尔）
   └── 重新运行 install.sh --all
   └── 自定义规则不会被覆盖
```

---

## 第四章：用户旅程

### 4.1 安装

```
开发者 Alice 想在她的项目里使用 PrivGuard。

Step 1: 在项目根目录运行一行命令
  $ curl -fsSL https://raw.githubusercontent.com/PrivGuardClaw/PrivGuardEngine/main/install.sh | bash

  [PrivGuard] Installing PrivGuard into current project...
  [PrivGuard] Downloading detection rules...
  [PrivGuard] ✅ Rules installed to .privguard/
  [PrivGuard] Downloading agent instruction files...
  [PrivGuard] ✅ AGENTS.md installed (universal standard)
  [PrivGuard] ✅ CLAUDE.md installed (Claude Code)
  [PrivGuard] ✅ copilot-instructions.md installed (GitHub Copilot)
  [PrivGuard] ✅ SKILL.md installed (Copilot Coding Agent)
  [PrivGuard] ✅ PrivGuard installed successfully! 🛡️

Step 2: 提交到 git
  $ git add . && git commit -m "feat: add PrivGuard privacy protection"

Step 3: 完了。没有 Step 3。
```

### 4.2 日常使用（自动模式）

```
Alice 用 Claude Code 写代码：

Alice: "帮我写一个脚本处理客户数据，张三的手机号13812345678，
       邮箱 zhangsan@corp.com，API key 是 sk-abc123def456..."

Claude Code 的内部行为（Alice 看不到）:
  1. 读取 AGENTS.md → 激活 PrivGuard 流程
  2. 读取 .privguard/rules/*.yml → 加载规则
  3. 检测到: PHONE(13812345678), EMAIL(zhangsan@corp.com), API_KEY(sk-abc123...)
  4. 内部替换: [PHONE_1], [EMAIL_1], [API_KEY_1]
  5. 用脱敏文本做推理和代码生成

Claude Code 输出给 Alice:
  "🛡️ PrivGuard: 检测到 3 项敏感信息 (PHONE, EMAIL, API_KEY)，已在处理中脱敏。

  建议的脚本如下，使用环境变量而非硬编码敏感信息：

  ```python
  import os

  PHONE = os.environ.get('CUSTOMER_PHONE')
  EMAIL = os.environ.get('CUSTOMER_EMAIL')
  API_KEY = os.environ.get('API_KEY')
  ...
  ```"
```

### 4.3 添加自定义规则

```
Alice 的公司有内部员工号格式 (EMP + 6位数字)。

Alice: "我们公司员工号格式是EMP开头后面6位数字，帮我添加到PrivGuard规则里"

Agent 读取 .privguard/rules/custom.yml，添加规则：

  rules:
    - type: EMPLOYEE_ID
      name: 员工工号
      pattern: 'EMP\d{6}'
      confidence: high

Agent: "✅ 已添加自定义规则 EMPLOYEE_ID，之后在文本中出现的 EMP+6位数字
       会被自动替换为 [EMPLOYEE_ID_1] 等占位符。"
```

---

## 第五章：实现路线图

```
Phase 0 — 当前 PR（正在进行）
  ├── 基础 SKILL.md
  ├── 基础 sanitize.sh
  └── 基础 rules.json

Phase 1 — 本文档描述的完整版（下一个 PR）
  ├── AGENTS.md（核心指令，完整版）
  ├── CLAUDE.md（引用 AGENTS.md）
  ├── .github/copilot-instructions.md（引用 AGENTS.md）
  ├── .github/skills/privguard/SKILL.md（精简版）
  ├── .privguard/rules/zh-CN.yml
  ├── .privguard/rules/en-US.yml
  ├── .privguard/rules/common.yml
  ├── .privguard/rules/custom.yml
  ├── .privguard/sanitize.sh（增强版，支持 YAML 规则）
  ├── install.sh
  └── 测试用例

Phase 2 — TypeScript 核心库
  ├── 正式的检测引擎（支持 validate 和 context_hint）
  ├── npm 包 @privguard/core
  └── 单元测试 + CI

Phase 3 — 浏览器扩展 + Python SDK + MCP Server
```

---

## 第六章：质量保障

### 6.1 规则测试框架

每条规则的 `examples` 字段既是文档也是测试用例：

```bash name=tests/test_rules.sh
#!/usr/bin/env bash
# 自动化测试：验证每条规则的 examples 是否正确匹配
# 读取 .privguard/rules/*.yml，提取 examples，用 grep 验证

PASS=0
FAIL=0

# 对每条 positive example，验证 pattern 能匹配到 expected match
# 对每条 negative example (match: null)，验证 pattern 不匹配

# ... (具体实现)

echo "Tests: $((PASS + FAIL)) total, ${PASS} passed, ${FAIL} failed"
```

### 6.2 误报控制

```
高置信度规则 (confidence: high):
  → 正则 + 校验算法（Luhn/身份证校验码/SSN 格式验证）
  → 误报率 < 1%
  → 始终启用

中置信度规则 (confidence: medium):
  → 纯正则，但模式足够独特
  → 误报率 < 5%
  → 始终启用

低置信度规则 (confidence: low):
  → 模式太通用（如美国驾照号就是"一个字母+几位数字"）
  → 仅在 context_hint 匹配时启用
  → 大幅降低误报
```

---

这就是完整的需求分析和设计文档。核心理念：

> **一个 `curl` 命令安装，零配置自动生效，YAML 一行添加自定义规则。**
> **以 `AGENTS.md` 为核心标准，自动兼容所有主流 AI coding agent。**
> **规则和指令分离，升级不覆盖用户自定义，永远向后兼容。**

你看完觉得没问题的话，我可以立刻基于这份设计开一个新的 PR，把完整版的文件推到 PrivGuardClaw/PrivGuardEngine 仓库里。🚀