# 🛡️ PrivGuard — AI Agent 隐私保护引擎

让 AI Agent 在处理你的代码和数据时，自动检测并脱敏敏感信息（手机号、身份证、API Key、密码等），**在敏感信息离开你的电脑之前就拦截它**。

## 核心理念

```
问题：你让 AI 帮你处理含敏感信息的任务，但信息一旦发出去就不可控了。
解法：AI 不需要知道"张三"是谁，只需要知道这里有"一个人"。
     把"张三"换成 <|PG:PERSON_1|>，语义保留，隐私保护。
```

## 工作原理

```
你的输入 → Agent CLI → PrivGuard Proxy (本地) → [脱敏] → LLM API
                                                          ↓
你看到原文 ← Agent CLI ← PrivGuard Proxy ← [还原] ← LLM 响应
```

PrivGuard 作为本地代理运行，拦截所有发往 LLM API 的请求，在请求离开你的机器之前完成脱敏。LLM 永远看不到你的真实敏感信息。

## 快速开始

### 一键安装（推荐）

```bash
# 在你的项目目录下运行
npx @privguard/engine privguard-proxy init
```

这条命令会自动：
1. 安装检测规则到 `.privguard/rules/`（20+ 种 PII 类型）
2. 生成 `AGENTS.md` 和 `CLAUDE.md`（让 Agent 在处理过程中也保持脱敏意识）
3. 检测你机器上的 Agent（Claude Code、OpenCode、OpenClaw），自动配置代理
4. 启动代理服务器

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/PrivGuardClaw/PrivGuardEngine.git

# 安装到你的项目
cd /path/to/your/project
bash /path/to/PrivGuardEngine/install.sh

# 启动代理
npx @privguard/engine privguard-proxy
```

## 使用方式

### 方式一：代理模式（推荐，真正的输入层拦截）

```bash
# 1. 启动代理（保持终端运行）
npx @privguard/engine privguard-proxy

# 2. 在另一个终端，正常使用你的 Agent
claude    # 或 opencode、openclaw
```

代理终端会实时显示脱敏情况：

```
🛡️  → REQUEST  [anthropic]
──────────────────────────────────────────────────
  138****678 → <|PG:PHONE_1|> [PHONE]
  zha****com → <|PG:EMAIL_1|> [EMAIL]
  123****789 → <|PG:SSN_1|>   [SSN]
  Total: 3 detected, 3 sanitized (PHONE, EMAIL, SSN)
```

### 方式二：Skill 模式（跨平台兼容）

不启动代理也能用。安装后 Agent 会读取 `AGENTS.md` 中的指令，在处理过程中自觉执行脱敏。这种模式不能拦截输入（prompt 已经到了模型端），但能防止 Agent 在写文件、执行命令、生成代码时泄露 PII。

Skill 作为独立项目维护，详见 [privguard-skill](https://github.com/PrivGuardClaw/privguard-skill)。

## 代理命令

```bash
privguard-proxy              # 启动代理
privguard-proxy init         # 一键安装：规则 + skill + 配置 Agent + 启动
privguard-proxy configure    # 自动配置检测到的 Agent
privguard-proxy teardown     # 还原所有 Agent 配置
privguard-proxy setup        # 查看 Agent 检测状态
```

## 支持的 Agent

| Agent | 配置方式 | 协议 |
|-------|---------|------|
| Claude Code | `~/.claude/settings.json` → `ANTHROPIC_BASE_URL` | Anthropic Messages API |
| OpenCode | `~/.config/opencode/opencode.json` → `baseURL` | OpenAI Compatible |
| OpenClaw | 配置文件 → `baseURL` | OpenAI Compatible |
| 任意 OpenAI 兼容客户端 | `OPENAI_BASE_URL` 环境变量 | OpenAI Compatible |

## 自定义规则

编辑 `.privguard/rules/custom.yml`：

```yaml
rules:
  - type: EMPLOYEE_ID
    name: 员工工号
    pattern: 'EMP\d{6}'
    confidence: high

  - type: PROJECT_CODE
    name: 项目代号
    pattern: 'PRJ-[A-Z]{2,4}-\d{4}'
    confidence: medium
```

重启代理自动加载。安装和升级不会覆盖 `custom.yml`。

## 支持的敏感信息类型

| 类型 | 规则文件 | 置信度 | 校验 |
|------|---------|--------|------|
| 中国手机号 | zh-CN.yml | high | 长度校验 |
| 身份证号 | zh-CN.yml | high | 校验码算法 |
| 银行卡号 | zh-CN.yml | high | Luhn 算法 |
| 统一社会信用代码 | zh-CN.yml | medium | — |
| 固定电话 | zh-CN.yml | medium | — |
| 车牌号 | zh-CN.yml | medium | — |
| US SSN | en-US.yml | high | 格式验证 |
| US 电话 | en-US.yml | medium | — |
| ITIN | en-US.yml | high | — |
| 信用卡号 | en-US.yml | high | Luhn 算法 |
| US 护照号 | en-US.yml | low | 需上下文 |
| US 驾照号 | en-US.yml | low | 需上下文 |
| 邮箱 | common.yml | high | — |
| IPv4 | common.yml | medium | 跳过 127.0.0.1 等 |
| IPv6 | common.yml | medium | — |
| API Key | common.yml | high | — |
| JWT | common.yml | high | — |
| 私钥 | common.yml | high | 多行匹配 |
| URL 中的密码 | common.yml | high | 仅替换密码部分 |
| MAC 地址 | common.yml | low | 需上下文 |

## TypeScript 引擎 API

引擎零依赖，可嵌入任何 Node.js 环境：

```typescript
import { PrivGuardEngine, loadRulesFromYaml } from '@privguard/engine';

const rules = loadRulesFromYaml(yamlContent);
const engine = new PrivGuardEngine({ mode: 'auto', rules, placeholderPrefix: 'PG' });

// 脱敏
const { sanitized, mappings, report } = await engine.sanitize('手机13812345678');
// sanitized: '手机<|PG:PHONE_1|>'

// 还原
const { restored } = engine.restore('用户手机是<|PG:PHONE_1|>');
// restored: '用户手机是13812345678'
```

代理也可以作为库使用：

```typescript
import { startProxy } from '@privguard/engine/proxy';

const handle = startProxy({
  port: 19820,
  rules: myRules,
  upstreamBaseUrl: 'https://api.anthropic.com',
});
```

## 项目结构

```
PrivGuardEngine/
├── engine/
│   ├── src/
│   │   ├── engine.ts        # 核心引擎（检测 + 脱敏 + 还原）
│   │   ├── matcher.ts       # 正则匹配 + 校验
│   │   ├── registry.ts      # 占位符映射表（内存级，不持久化）
│   │   ├── resolver.ts      # 决策器（auto/confirm 模式）
│   │   ├── loader.ts        # YAML 规则加载
│   │   ├── validators.ts    # Luhn、身份证校验码、SSN 格式验证
│   │   ├── cli.ts           # 引擎 CLI（detect/sanitize/restore）
│   │   └── proxy/
│   │       ├── server.ts    # HTTP 代理核心
│   │       ├── adapters.ts  # Anthropic/OpenAI 协议适配
│   │       ├── config.ts    # Agent 自动检测和配置
│   │       ├── setup.ts     # 一键安装（规则 + skill + 代理配置）
│   │       ├── display.ts   # 终端实时脱敏展示
│   │       └── cli.ts       # 代理 CLI 入口
│   └── rules/               # 内置检测规则
├── install.sh               # 传统安装脚本
└── README.md
```

## 卸载

```bash
# 还原 Agent 配置
npx @privguard/engine privguard-proxy teardown

# 删除项目中的 PrivGuard 文件（可选）
rm -rf .privguard/ AGENTS.md CLAUDE.md
```

## License

MIT
