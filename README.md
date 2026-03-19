# 🛡️ PrivGuard

> **Your AI assistant should work for you — not expose your secrets.**

**[English](#english) | [中文](#中文)**

---

<a name="english"></a>
## English

### What is PrivGuard?

PrivGuard is a **privacy protection layer for AI assistants**. It sits silently between your tools and the LLM API, automatically detecting and sanitizing sensitive information — phone numbers, ID cards, API keys, passwords, and more — **before your data ever leaves your machine**.

No config changes to your workflow. No data sent in plaintext. Just private by default.

---

### The Problem

Every time you send a prompt to an AI assistant:

- Your message — including any sensitive data — is transmitted to remote LLM APIs
- Once sent, **you lose control** over that data
- Even with a trusted provider, breaches happen

You shouldn't have to choose between productivity and privacy.

---

### The Solution

PrivGuard intercepts API requests locally and swaps sensitive values for semantic placeholders — invisible to you, opaque to the LLM:

```
Your input:    "My phone is 13812345678, email test@example.com"
What LLM sees: "My phone is <|PG:PHONE_1|>, email <|PG:EMAIL_1|>"
What you see:  "My phone is 13812345678, email test@example.com"  ✓ restored
```

The LLM reasons over structure, not your secrets.

---

### How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Your Input │ ──▶ │ PrivGuard Proxy  │ ──▶ │   LLM API    │
│  (with PII) │     │   (sanitize)     │     │ (placeholders│
└─────────────┘     └──────────────────┘     │    only)     │
                                              └──────────────┘
                                                     │
┌─────────────┐     ┌──────────────────┐            │
│  You see    │ ◀── │ PrivGuard Proxy  │ ◀──────────┘
│  (restored) │     │   (restore)      │
└─────────────┘     └──────────────────┘
```

---

### Supported Clients

| Client | Configuration | Protocol |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | Anthropic Messages API |
| OpenCode | `~/.config/opencode/opencode.json` | OpenAI Compatible |
| Cursor | Environment variable | OpenAI Compatible |
| Any OpenAI-compatible client | `OPENAI_BASE_URL` | OpenAI Compatible |

---

### Quick Start

**Prerequisites:** Node.js 18+ — verify with `node -v`. Run from your project root.

```bash
# One-click setup (recommended)
npx -y @privguard/engine setup

# Check detection & configuration status
privguard status
```

This single command will:
1. Install detection rules to `.privguard/rules/`
2. Generate `AGENTS.md` to keep your AI assistant privacy-aware
3. Generate `CLAUDE.md` reference file (if needed)
4. Auto-configure detected clients to route through the proxy
5. Start the proxy server

---

### Manual Installation

```bash
npm install -g @privguard/engine
privguard setup
```

---

### Commands

| Command | Description |
|---|---|
| `privguard setup` | One-click setup |
| `privguard start` | Start proxy server only |
| `privguard status` | Show detection status |
| `privguard gui` | Launch Web GUI |
| `privguard teardown` | Remove all configurations |
| `privguard --help` | Show help |

---

### Web GUI

PrivGuard includes a real-time web dashboard for monitoring intercepts and managing rules.

```bash
privguard gui                          # Start GUI (proxy auto-starts)
privguard gui --port 8080              # Custom GUI port
privguard gui --proxy-port 19830       # Custom proxy port
privguard gui --password mypassword    # Set a fixed password
privguard gui --no-proxy               # GUI only, no proxy
```

On first launch, a random password is printed to your terminal. Open `http://localhost:19821` and log in.

**Dashboard features:**
- Real-time intercept log with PII type filtering
- Custom rule editor with live regex testing
- Proxy server health monitoring
- Rule changes apply instantly — no restart needed

---

### Supported PII Types

| Type | Rule File | Confidence | Validation |
|---|---|---|---|
| Chinese Phone | `zh-CN.yml` | High | Length check |
| Chinese ID Card | `zh-CN.yml` | High | Checksum algorithm |
| Bank Card | `zh-CN.yml` | High | Luhn algorithm |
| US SSN | `en-US.yml` | High | Format validation |
| Credit Card | `en-US.yml` | High | Luhn algorithm |
| Email | `common.yml` | High | — |
| API Key | `common.yml` | High | — |
| JWT | `common.yml` | High | — |
| Private Key | `common.yml` | High | Multiline |

---

### Custom Rules

Add your own patterns by editing `.privguard/rules/custom.yml`:

```yaml
rules:
  - type: EMPLOYEE_ID
    name: Employee ID
    pattern: 'EMP\d{6}'
    confidence: high
```

---

### TypeScript API

```typescript
import { PrivGuardEngine, loadRulesFromYaml } from '@privguard/engine';

const engine = new PrivGuardEngine({
  mode: 'auto',
  rules: loadRulesFromYaml(yamlContent),
  placeholderPrefix: 'PG',
});

// Sanitize
const { sanitized } = await engine.sanitize('Phone: 13812345678');
// → 'Phone: <|PG:PHONE_1|>'

// Restore
const { restored } = engine.restore('Your phone is <|PG:PHONE_1|>');
// → 'Your phone is 13812345678'
```

---

### Uninstall

```bash
privguard teardown
rm -rf .privguard/ AGENTS.md CLAUDE.md
```

---

<a name="中文"></a>
## 中文

### PrivGuard 是什么？

PrivGuard 是 **AI 助手的隐私保护层**。它静默运行在你的工具与 LLM API 之间，在数据离开你的电脑之前，自动检测并脱敏敏感信息——手机号、身份证、API Key、密码等。

无需改变工作流。无明文传输。默认私密。

---

### 问题背景

每次向 AI 助手发送提示词时：

- 包含敏感数据的消息会被传输到远程 LLM API
- 数据一旦发出，**你就失去了控制权**
- 即使你信任服务商，数据泄露依然可能发生

你不该被迫在效率与隐私之间二选一。

---

### 解决方案

PrivGuard 在本地拦截 API 请求，将敏感值替换为语义占位符——对你透明，对 LLM 不可见：

```
你的输入：    "我的手机号是13812345678，邮箱test@example.com"
LLM 看到的：  "我的手机号是<|PG:PHONE_1|>，邮箱<|PG:EMAIL_1|>"
你看到的：    "我的手机号是13812345678，邮箱test@example.com"  ✓ 已还原
```

LLM 处理的是结构语义，而不是你的隐私数据。

---

### 工作原理

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   你的输入   │ ──▶ │  PrivGuard 代理  │ ──▶ │   LLM API    │
│  （含敏感信息）│     │     （脱敏）     │     │（只看到占位符）│
└─────────────┘     └──────────────────┘     └──────────────┘
                                                     │
┌─────────────┐     ┌──────────────────┐            │
│   你看到的   │ ◀── │  PrivGuard 代理  │ ◀──────────┘
│  （已还原）  │     │     （还原）     │
└─────────────┘     └──────────────────┘
```

### 支持的 Agent

| 客户端 | 配置方式 | 协议 |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | Anthropic Messages API |
| OpenCode | `~/.config/opencode/opencode.json` | OpenAI 兼容 |
| Cursor | 环境变量 | OpenAI 兼容 |
| 任意 OpenAI 兼容客户端 | `OPENAI_BASE_URL` | OpenAI 兼容 |

---

### 快速开始

**前置条件：** Node.js 18+，运行 `node -v` 验证。请在项目根目录执行以下命令。

```bash
# 一键安装（推荐）
npx -y @privguard/engine setup

# 验证 Agent 检测/配置状态
privguard status
```

这条命令会自动完成：
1. 安装检测规则到 `.privguard/rules/`
2. 生成 `AGENTS.md`，让 AI 助手保持隐私保护意识
3. 按需生成 `CLAUDE.md` 引用文件
4. 自动配置检测到的客户端使用代理
5. 启动代理服务器

---

### 手动安装

```bash
npm install -g @privguard/engine
privguard setup
```

---

### 命令说明

| 命令 | 说明 |
|---|---|
| `privguard setup` | 一键安装 |
| `privguard start` | 仅启动代理服务器 |
| `privguard status` | 查看检测状态 |
| `privguard gui` | 启动 Web 管理界面 |
| `privguard teardown` | 移除所有配置 |
| `privguard --help` | 显示帮助 |

---

### Web 管理界面

PrivGuard 内置实时 Web 仪表板，可视化监控拦截记录、管理保护规则。

```bash
privguard gui                          # 启动 GUI（自动启动代理）
privguard gui --port 8080              # 自定义 GUI 端口
privguard gui --proxy-port 19830       # 自定义代理端口
privguard gui --password mypassword    # 设置固定密码
privguard gui --no-proxy               # 仅启动 GUI，不启动代理
```

首次启动时，终端会自动打印访问地址和随机密码：

```
🛡️  PrivGuard GUI v0.1.0
────────────────────────────────────────
  管理界面:  http://localhost:19821
  代理地址:  http://localhost:19820
  访问密码:  Ab3xK9mP  (自动生成，请妥善保存)
────────────────────────────────────────
```

**主要功能：**
- 实时拦截记录，支持按 PII 类型筛选
- 自定义规则编辑器，支持正则实时测试
- 代理服务器状态监控
- 规则修改即时生效，无需重启

**快速上手：**
1. 运行 `privguard gui`，记录终端显示的密码
2. 浏览器打开 `http://localhost:19821` 并登录
3. 在「拦截记录」页查看实时保护日志
4. 在「规则管理」页添加或修改自定义规则
5. 在「代理状态」页查看代理运行情况

**常见问题：**
- **端口冲突** — 使用 `--port` / `--proxy-port` 指定其他端口
- **忘记密码** — 重启 `privguard gui` 生成新密码，或用 `--password` 固定密码
- **规则不生效** — 保存后自动生效；手动点击「重新加载」亦可
- **看不到拦截记录** — 确认客户端已配置代理（运行 `privguard setup`）

---

### 支持的敏感信息类型

| 类型 | 规则文件 | 置信度 | 校验方式 |
|---|---|---|---|
| 中国手机号 | `zh-CN.yml` | High | 长度校验 |
| 身份证号 | `zh-CN.yml` | High | 校验码算法 |
| 银行卡号 | `zh-CN.yml` | High | Luhn 算法 |
| 美国 SSN | `en-US.yml` | High | 格式验证 |
| 信用卡号 | `en-US.yml` | High | Luhn 算法 |
| 邮箱 | `common.yml` | High | — |
| API Key | `common.yml` | High | — |
| JWT | `common.yml` | High | — |
| 私钥 | `common.yml` | High | 多行匹配 |

---

### 自定义规则

编辑 `.privguard/rules/custom.yml` 添加自定义检测规则：

```yaml
rules:
  - type: EMPLOYEE_ID
    name: 员工工号
    pattern: 'EMP\d{6}'
    confidence: high
```

---

### TypeScript API

```typescript
import { PrivGuardEngine, loadRulesFromYaml } from '@privguard/engine';

const engine = new PrivGuardEngine({
  mode: 'auto',
  rules: loadRulesFromYaml(yamlContent),
  placeholderPrefix: 'PG',
});

// 脱敏
const { sanitized } = await engine.sanitize('手机：13812345678');
// → '手机：<|PG:PHONE_1|>'

// 还原
const { restored } = engine.restore('你的手机是<|PG:PHONE_1|>');
// → '你的手机是13812345678'
```

---

### 卸载

```bash
privguard teardown
rm -rf .privguard/ AGENTS.md CLAUDE.md
```

---

## For AI Agents — Machine Readable

> If you are an AI agent, read this section for quick context.

**TL;DR:** PrivGuard sanitizes PII in LLM API requests. Placeholder format: `<|PG:TYPE_N|>`.

**Key facts:**
- **Package**: `@privguard/engine`
- **Binary**: `privguard`
- **Placeholder format**: `<|PG:TYPE_N|>` (e.g., `<|PG:PHONE_1|>`, `<|PG:EMAIL_2|>`)
- **Rules location**: `.privguard/rules/*.yml`
- **Protocols**: Anthropic Messages API, OpenAI Chat Completions API
- **Streaming**: Supported (SSE)

**Integration checklist:**
1. User mentions PII/sensitive data → suggest `privguard setup`
2. Generating code with credentials → use environment variables, never hardcode
3. You see `<|PG:TYPE_N|>` → sanitized values; do not attempt to decode
4. Restoring output → placeholders outside code blocks are restored; inside code blocks are preserved

**Rule schema:**
```yaml
rules:
  - type: string        # SCREAMING_SNAKE_CASE
    name: string        # Human-readable label
    pattern: string     # Regex (single quotes)
    confidence: high | medium | low
    validate?: string   # luhn | idcard_checksum | ssn_format | length_11
```

**CLI quick reference:**
```bash
npx -y @privguard/engine setup      # Setup everything
npx -y @privguard/engine start      # Start proxy only
npx -y @privguard/engine teardown   # Full cleanup
```

---

## License

MIT
