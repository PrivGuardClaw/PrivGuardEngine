# 🛡️ PrivGuard

> **让敏感信息永远不离开你的设备。**  
> **Your sensitive data never leaves your device.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

PrivGuard 是一个隐私优先的敏感信息脱敏工具，专为 LLM 交互场景设计。它在文本发送到大模型之前自动检测并替换 PII，然后在响应返回后自动还原，全程数据不出本地。

PrivGuard is a privacy-first sensitive information sanitizer designed for LLM interactions. It automatically detects and replaces PII before text is sent to AI services, then restores the original values in the response — the mapping table never leaves your local environment.

---

## 工作原理 / How It Works

```
用户输入:   "客户张三(手机13812345678)的贷款逾期了"
               ↓  PrivGuard 脱敏 / sanitizes
LLM 接收:   "客户张三(手机[PHONE_1])的贷款逾期了"
               ↓  LLM 推理 / responds
LLM 回复:   "建议联系张三，通过[PHONE_1]沟通还款方案"
               ↓  PrivGuard 还原 / restores
用户看到:   "建议联系张三，通过13812345678沟通还款方案"
```

**敏感数据从未离开用户设备。/ Sensitive data never leaves the user's device.**

---

## 快速开始 — Copilot Agent Skill / Quick Start

将 `.github/skills/privguard/` 目录复制到你的项目中，即可让 GitHub Copilot 自动感知并执行脱敏操作：

Copy the `.github/skills/privguard/` directory into your project to enable the Copilot Agent Skill:

```bash
# 克隆本仓库或直接下载 skill 目录
git clone https://github.com/PrivGuardClaw/PrivGuardEngine.git
cp -r PrivGuardEngine/.github/skills/privguard YOUR_PROJECT/.github/skills/privguard
```

之后在与 Copilot 交互时，只需提及"脱敏"、"sanitize"或"protect privacy"，Agent 即会自动调用本 Skill。

---

## 支持的 PII 类型 / Supported PII Types

| 类型 / Type | 描述 / Description | 示例 / Example |
|------------|-------------------|----------------|
| `PHONE`    | 中国大陆手机号 / Chinese mobile number | `13812345678` |
| `IDCARD`   | 居民身份证号 / Resident ID card (18-digit) | `110101199001011234` |
| `BANKCARD` | 银行卡号 / Bank card number (16–19 digit) | `6222021001122334455` |
| `EMAIL`    | 邮箱地址 / Email address | `user@example.com` |
| `IP`       | IPv4 地址 / IPv4 address | `192.168.1.100` |
| `USCC`     | 统一社会信用代码 / Unified Social Credit Code | `91110000717526625D` |
| `API_KEY`  | API 密钥 / API key (sk-/ak-/key- prefix) | `sk-abc123...` |
| Custom     | 自定义规则 / User-defined rules via `rules.json` | `EMP-001234` |

---

## 设计原则 / Design Principles

| 原则 | 说明 |
|------|------|
| **本地优先 / Local-first** | 映射表只存在于本地内存，绝不传输或持久化 |
| **中文优先 / Chinese-first** | 优先覆盖中国大陆 PII 类型（手机号、身份证、银行卡等） |
| **零配置 / Zero-config** | 开箱即用，无需额外环境或依赖 |
| **可扩展 / Pluggable** | 通过 `rules.json` 添加自定义规则，轻松适配垂直业务场景 |

---

## 自定义规则 / Custom Rules

在项目根目录创建或修改 `rules.json`，在 `custom_rules` 数组中添加自定义规则：

```json
{
  "version": "1.0",
  "custom_rules": [
    {
      "type": "EMPLOYEE_ID",
      "pattern": "EMP-\\d{6}",
      "description": "内部员工编号"
    }
  ]
}
```

---

## 路线图 / Roadmap

- [x] **Copilot Agent Skill** — `.github/skills/privguard/`
- [ ] **TypeScript 核心库** — `@privguard/core` (npm)
- [ ] **浏览器扩展** — Chrome / Edge Extension
- [ ] **Python SDK** — `pip install privguard`
- [ ] **MCP Server** — Model Context Protocol 集成

详见 [docs/ROADMAP.md](./docs/ROADMAP.md)

---

## 贡献 / Contributing

欢迎提交 Issue 和 Pull Request！  
Contributions are welcome — please open an [issue](https://github.com/PrivGuardClaw/PrivGuardEngine/issues) or submit a PR.

---

## 许可证 / License

[MIT](./LICENSE)