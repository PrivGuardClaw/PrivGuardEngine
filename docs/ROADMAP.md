# PrivGuard 路线图 / Roadmap

> PrivGuard 的目标是成为 LLM 生态中最简单、最可信的本地 PII 脱敏层。  
> PrivGuard aims to be the simplest, most trustworthy local PII sanitization layer in the LLM ecosystem.

---

## Phase 0 — Copilot Agent Skill ✅ (当前 / Current)

**目标**: 为 GitHub Copilot Agent 提供即插即用的 PII 脱敏能力。

**交付物 / Deliverables**:
- [x] `SKILL.md` — Copilot Agent 指令文件，包含检测规则、脱敏流程、还原逻辑
- [x] `sanitize.sh` — 可执行的 bash 脚本，支持 `detect` / `sanitize` / `help`
- [x] `rules.json` — 内置规则配置文件（可扩展自定义规则）
- [x] `README.md` — 项目文档（中英双语）
- [x] `docs/ROADMAP.md` — 本文件
- [x] `examples/basic-usage.md` — 使用示例

**支持的 PII 类型**: PHONE, IDCARD, BANKCARD, EMAIL, IP, USCC, API_KEY

---

## Phase 1 — TypeScript 核心库 (计划中 / Planned)

**目标**: 将脱敏逻辑封装为可在 Node.js / Deno / 浏览器中运行的 TypeScript 库。

**计划交付物**:
- [ ] `@privguard/core` npm 包
  - `sanitize(text, rules?)` → `{ sanitized, mapping }`
  - `restore(text, mapping)` → `string`
  - `detect(text, rules?)` → `Entity[]`
- [ ] 完整的 TypeScript 类型声明
- [ ] 单元测试（Jest / Vitest）
- [ ] 支持自定义规则 (`RuleSet` 接口)
- [ ] 支持 ESM + CJS 双格式输出

**设计目标**:
- 零运行时依赖
- Tree-shakeable
- 在浏览器中可用（为 Phase 2 做准备）

---

## Phase 2 — 浏览器扩展 (规划中 / Roadmap)

**目标**: 为 Chrome / Edge 提供浏览器扩展，在用户使用 ChatGPT、Claude 等网页版 AI 时自动脱敏输入。

**计划交付物**:
- [ ] Chrome / Edge Manifest V3 扩展
- [ ] 内容脚本：拦截文本框输入，脱敏后发送
- [ ] Popup UI：显示已检测到的 PII 类型和数量
- [ ] 用户自定义规则面板
- [ ] 支持主流 AI 网页端：ChatGPT、Claude、Gemini、文心一言、通义千问

**隐私保证**:
- 扩展本身不收集任何数据
- 无网络请求，完全本地运行
- 开源可审计

---

## Phase 3 — Python SDK + CLI + MCP Server (规划中 / Roadmap)

**目标**: 覆盖 Python 生态和 AI Agent 框架集成场景。

### Python SDK

- [ ] `pip install privguard`
- [ ] `from privguard import sanitize, restore, detect`
- [ ] 支持同步和异步接口
- [ ] LangChain / LlamaIndex 集成示例
- [ ] pytest 兼容的测试套件

### CLI 工具

- [ ] `privguard detect < input.txt`
- [ ] `privguard sanitize < input.txt > output.txt`
- [ ] `privguard restore --mapping mapping.json < response.txt`
- [ ] 管道友好（stdin/stdout）

### MCP Server

- [ ] 实现 Model Context Protocol (MCP) 接口
- [ ] 工具暴露：`privguard_sanitize`、`privguard_restore`、`privguard_detect`
- [ ] 支持 Claude Desktop、Cursor、Continue 等 MCP 客户端
- [ ] Docker 镜像发布

---

## 原则 / Principles (跨所有阶段)

1. **本地优先**: 映射表永远不离开本地环境
2. **零信任外部**: 不依赖任何外部服务做脱敏
3. **中文优先**: 优先覆盖中国大陆 PII 类型
4. **渐进增强**: 每个 Phase 独立可用，向前兼容

---

*欢迎通过 [Issues](https://github.com/PrivGuardClaw/PrivGuardEngine/issues) 参与讨论和贡献！*  
*Contributions and feedback are welcome via [Issues](https://github.com/PrivGuardClaw/PrivGuardEngine/issues)!*
