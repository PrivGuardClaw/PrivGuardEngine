# 🛡️ PrivGuard Skill

让 AI Agent 自动检测并脱敏敏感信息（手机号、身份证、SSN、API Key、密码等），保护你的隐私。

这是一个遵循 [Agent Skills](https://agentskills.io) 开放标准的 skill，兼容 Claude Code、Kiro、OpenCode、Cursor、GitHub Copilot 等支持该标准的工具。

## 工作原理

```
用户输入 → Agent 检测敏感信息 → 替换为 {{PG:TYPE_N}} → 用脱敏文本推理
                                                              ↓
用户看到输出 ← 还原占位符 ← Agent 生成回复 ← 脱敏文本
```

## 两种执行模式

| 模式 | 依赖 | 准确度 | 适用场景 |
|------|------|--------|---------|
| Engine 模式 | Node.js | 高（正则+校验算法） | 有 Node.js 环境的开发者 |
| Instruction 模式 | 无 | 中（Agent 自行匹配） | 任何环境，零依赖 |

默认 `auto` 模式：有 Node.js 就用引擎，没有就降级到指令模式。

## 安装

### Claude Code

```bash
# 方式一：从 plugin marketplace 安装（推荐）
claude plugin add privguard

# 方式二：手动安装
git clone https://github.com/nicekid1/privguard-skill.git
cd your-project
bash /path/to/privguard-skill/privguard/scripts/install.sh
```

### Kiro

将 `privguard/` 目录复制到项目的 `.kiro/skills/` 下：

```bash
cp -r /path/to/privguard-skill/privguard .kiro/skills/privguard
```

### OpenCode / Cursor / Codex

```bash
git clone https://github.com/nicekid1/privguard-skill.git
cd your-project
bash /path/to/privguard-skill/privguard/scripts/install.sh
```

安装脚本会在你的项目中创建 `.privguard/` 目录，包含规则文件和配置。

## 配置

编辑 `.privguard/config.yml`：

```yaml
# 执行模式
mode: auto        # engine | instruction | auto

# 确认模式
confirm: false    # true = 每次检测后让用户确认, false = 全自动
```

### 安装时指定模式

```bash
bash install.sh --mode engine      # 强制引擎模式
bash install.sh --mode instruction # 强制指令模式
bash install.sh --confirm          # 开启确认模式
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

安装和升级不会覆盖 `custom.yml`。

## 快速测试

```bash
# 检测敏感信息
node privguard/scripts/privguard.cjs detect \
  --input "联系张三 13812345678，邮箱 test@example.com" \
  --rules-dir .privguard/rules/

# 脱敏替换
node privguard/scripts/privguard.cjs sanitize \
  --input "SSN: 123-45-6789, Key: sk-abc123def456ghi789jkl012mno345pqr" \
  --rules-dir .privguard/rules/
```

## 支持的敏感信息类型

| 类型 | 规则文件 | 置信度 |
|------|---------|--------|
| 中国手机号 | zh-CN.yml | high |
| 身份证号 | zh-CN.yml | high (校验码) |
| 银行卡号 | zh-CN.yml | high (Luhn) |
| 固定电话 | zh-CN.yml | medium |
| 车牌号 | zh-CN.yml | medium |
| US SSN | en-US.yml | high (格式验证) |
| ITIN | en-US.yml | high |
| 信用卡号 | en-US.yml | high (Luhn) |
| 邮箱 | common.yml | high |
| IPv4/IPv6 | common.yml | medium |
| API Key | common.yml | high |
| JWT | common.yml | high |
| 私钥 | common.yml | high |
| URL 中的密码 | common.yml | high |

## 卸载

```bash
bash privguard/scripts/install.sh --uninstall
```

## License

MIT
