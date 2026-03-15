# 🛡️ PrivGuard — AI Agent 隐私保护引擎

让 AI Agent 在处理你的代码和数据时，自动检测并脱敏敏感信息（手机号、身份证、API Key、密码等），保护你的隐私。

## 兼容性

| 工具 | 支持方式 | 指令文件 |
|------|---------|---------|
| OpenCode | `.privguard/AGENTS.md` (子目录自动发现) + 根目录引用 | `AGENTS.md` |
| Claude Code | 根目录 `CLAUDE.md` 引用 | `CLAUDE.md` |
| Kiro | `.kiro/steering/privguard.md` (auto inclusion) | steering |
| Cursor | `.privguard/AGENTS.md` + 根目录引用 | `AGENTS.md` |
| Codex | 同 OpenCode | `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` | copilot |

## 安装

### 方式一：从源码安装（推荐试用）

```bash
# 1. 克隆仓库
git clone https://github.com/PrivGuardClaw/PrivGuardEngine.git
cd PrivGuardEngine

# 2. 到你的项目目录，运行安装脚本
cd /path/to/your/project
bash /path/to/PrivGuardEngine/install.sh
```

### 方式二：只安装特定 Agent

```bash
bash install.sh --kiro       # 只装 Kiro
bash install.sh --claude     # 只装 Claude Code
bash install.sh --opencode   # 只装 OpenCode/Cursor/Codex
bash install.sh --all        # 全部安装（默认）
```

### 安装后的文件结构

```
your-project/
├── AGENTS.md                    ← 你自己的（末尾追加了 PrivGuard 引用）
├── CLAUDE.md                    ← 你自己的（末尾追加了 PrivGuard 引用）
├── .kiro/
│   └── steering/
│       └── privguard.md         ← Kiro 自动加载
└── .privguard/
    ├── AGENTS.md                ← PrivGuard 完整指令（不占用你的根目录）
    ├── sanitize.sh              ← CLI 检测/脱敏工具
    └── rules/
        ├── zh-CN.yml            ← 中国 PII 规则
        ├── en-US.yml            ← 美国 PII 规则
        ├── common.yml           ← 通用规则（邮箱、IP、API Key 等）
        └── custom.yml           ← 你的自定义规则（安装不覆盖）
```

关键设计：PrivGuard 不会覆盖你的 `AGENTS.md` 或 `CLAUDE.md`，只在末尾追加一段引用标记。卸载时会干净移除。

## 快速测试

### 1. 测试 CLI 检测

```bash
# 检测敏感信息
bash .privguard/sanitize.sh detect --input "联系张三 13812345678，邮箱 test@example.com"

# 输出：
# 🛡️  PrivGuard: detected 2 sensitive item(s):
#   [PHONE] 138***678
#   [EMAIL] tes***com
```

### 2. 测试脱敏替换

```bash
# 脱敏替换
bash .privguard/sanitize.sh sanitize --input "SSN: 123-45-6789, IP: 192.168.1.100"

# 输出：
# SSN: {{PG:SSN_1}}, IP: {{PG:IPV4_1}}
```

### 3. 测试文件脱敏

```bash
# 创建一个测试文件
cat > /tmp/test_pii.txt << 'EOF'
项目配置：
- 管理员邮箱: admin@company.com
- 服务器: 10.0.1.50
- 管理员手机: 13812345678
- API Key: sk-abc123def456ghi789jkl012mno345pqr
EOF

# 检测
bash .privguard/sanitize.sh detect --file /tmp/test_pii.txt

# 脱敏
bash .privguard/sanitize.sh sanitize --file /tmp/test_pii.txt
```

### 4. 测试 Agent 集成

在你的项目里安装 PrivGuard 后，打开 Agent 工具，试试这些 prompt：

```
# Kiro / Claude Code / OpenCode 都可以试
帮我写一个函数，把客户张三（手机13812345678，邮箱zhangsan@corp.com）的订单状态改成已完成

# 期望行为：
# 1. Agent 检测到手机号和邮箱
# 2. 内部用 {{PG:PHONE_1}} 和 {{PG:EMAIL_1}} 替换
# 3. 生成的代码使用环境变量而非硬编码
# 4. 回复中告知你检测到了敏感信息
```

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

添加后 Agent 会自动加载新规则。

## 卸载

```bash
bash install.sh --uninstall
# .privguard/ 目录会保留（包含你的自定义规则）
# 完全移除：rm -rf .privguard/
```

## 工作原理

```
用户输入 → Agent 读取 PrivGuard 指令 → 检测敏感信息 → 替换为 {{PG:TYPE_N}}
                                                              ↓
用户看到输出 ← 还原占位符 ← Agent 用脱敏文本推理 ← 脱敏文本
```

- 检测基于正则 + 校验算法（Luhn、身份证校验码、SSN 格式验证）
- 三级置信度：high（正则+校验）、medium（纯正则）、low（需上下文提示）
- 占位符格式 `{{PG:TYPE_N}}` 保留类型信息，不影响 Agent 语义理解
- 同一个值始终映射到同一个占位符（幂等）

## 支持的敏感信息类型

| 类型 | 规则文件 | 置信度 |
|------|---------|--------|
| 中国手机号 | zh-CN.yml | high |
| 身份证号 | zh-CN.yml | high (校验码验证) |
| 银行卡号 | zh-CN.yml | high (Luhn 验证) |
| 固定电话 | zh-CN.yml | medium |
| 车牌号 | zh-CN.yml | medium |
| 统一社会信用代码 | zh-CN.yml | medium |
| US SSN | en-US.yml | high (格式验证) |
| US 电话 | en-US.yml | medium |
| US 护照号 | en-US.yml | low (需上下文) |
| US 驾照号 | en-US.yml | low (需上下文) |
| ITIN | en-US.yml | high |
| 信用卡号 | en-US.yml | high (Luhn 验证) |
| 邮箱 | common.yml | high |
| IPv4 | common.yml | medium |
| IPv6 | common.yml | medium |
| API Key | common.yml | high |
| JWT | common.yml | high |
| 私钥 | common.yml | high |
| URL 中的密码 | common.yml | high |
| MAC 地址 | common.yml | low (需上下文) |

## TypeScript 引擎

`engine/` 目录包含零依赖的 TypeScript 检测引擎，可嵌入任何环境：

```typescript
import { PrivGuardEngine, loadRulesFromYaml } from '@privguard/engine';

const rules = loadRulesFromYaml(yamlContent);
const engine = new PrivGuardEngine({ mode: 'auto', rules, placeholderPrefix: 'PG' });

// 脱敏
const { sanitized, report } = await engine.sanitize('手机13812345678');
// sanitized: '手机{{PG:PHONE_1}}'

// 还原
const { restored } = engine.restore('用户手机是{{PG:PHONE_1}}');
// restored: '用户手机是13812345678'
```

## License

MIT
