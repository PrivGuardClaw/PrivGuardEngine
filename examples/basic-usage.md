# PrivGuard 使用示例 / Basic Usage Examples

本文件展示 PrivGuard 的典型使用场景，帮助你快速理解脱敏→LLM→还原的完整流程。

---

## 场景一：单一 PII 类型（手机号） / Scenario 1: Single PII Type (Phone Number)

### 输入 / Input

```
用户: 帮我给13812345678发一条催款提醒短信，内容是贷款已逾期30天。
```

### 脱敏后发送给 LLM / After sanitization (sent to LLM)

```
用户: 帮我给[PHONE_1]发一条催款提醒短信，内容是贷款已逾期30天。
```

### 脱敏映射表（仅本地）/ Mapping table (local only)

```json
{
  "[PHONE_1]": "13812345678"
}
```

### LLM 回复 / LLM response

```
好的，已向[PHONE_1]发送以下短信：
"您好，您的贷款账户已逾期30天，请尽快联系我们处理还款事宜。如有疑问，请回复本短信。"
```

### 还原后展示给用户 / After restoration (shown to user)

```
好的，已向13812345678发送以下短信：
"您好，您的贷款账户已逾期30天，请尽快联系我们处理还款事宜。如有疑问，请回复本短信。"
```

### Shell 操作示例 / Shell example

```bash
# 检测
./sanitize.sh detect --input "帮我给13812345678发一条催款提醒"
# 输出: [PHONE]   13812345678

# 脱敏
./sanitize.sh sanitize --input "帮我给13812345678发一条催款提醒"
# stderr: MAPPING: 13812345678 -> [PHONE_1]
# stdout: 帮我给[PHONE_1]发一条催款提醒
```

---

## 场景二：混合 PII（段落文本）/ Scenario 2: Mixed PII in a Paragraph

### 输入 / Input

```
客户张三(手机13812345678，身份证110101199001011234，邮箱zhangsan@example.com)
的贷款本金50万元，已逾期3期。请分析风险并给出建议。
```

### 检测到的 PII / Detected PII

| 原始值 / Original | 类型 / Type | 占位符 / Placeholder |
|------------------|------------|---------------------|
| `13812345678` | PHONE | `[PHONE_1]` |
| `110101199001011234` | IDCARD | `[IDCARD_1]` |
| `zhangsan@example.com` | EMAIL | `[EMAIL_1]` |

### 脱敏后发送给 LLM / After sanitization

```
客户张三(手机[PHONE_1]，身份证[IDCARD_1]，邮箱[EMAIL_1])
的贷款本金50万元，已逾期3期。请分析风险并给出建议。
```

> 注意：`张三` 是姓名，当前版本不做检测（姓名识别需要 NER，将在 Phase 1 中支持）。

### LLM 回复 / LLM response

```
根据您提供的信息，该客户贷款逾期情况如下：

风险评估：中高风险
- 逾期期数：3期，已触发不良贷款预警线
- 建议措施：
  1. 优先通过[EMAIL_1]发送正式催收通知
  2. 致电[PHONE_1]进行电话沟通
  3. 核实[IDCARD_1]对应的征信记录，评估是否需要法律手段

请在3个工作日内完成初步联系。
```

### 还原后展示给用户 / After restoration

```
根据您提供的信息，该客户贷款逾期情况如下：

风险评估：中高风险
- 逾期期数：3期，已触发不良贷款预警线
- 建议措施：
  1. 优先通过zhangsan@example.com发送正式催收通知
  2. 致电13812345678进行电话沟通
  3. 核实110101199001011234对应的征信记录，评估是否需要法律手段

请在3个工作日内完成初步联系。
```

---

## 场景三：自定义规则（内部员工编号）/ Scenario 3: Custom Rules for Internal IDs

### 背景 / Context

某公司内部 ID 格式为 `EMP-XXXXXX`（6位数字），需要在提交给 LLM 时脱敏。

### 添加自定义规则 / Add custom rule to `rules.json`

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

### 输入 / Input

```
员工EMP-001234的绩效考核结果为B级，请起草晋升建议书。
```

### 脱敏后发送给 LLM / After sanitization

```
员工[EMPLOYEE_ID_1]的绩效考核结果为B级，请起草晋升建议书。
```

### LLM 回复 / LLM response

```
关于[EMPLOYEE_ID_1]的晋升建议书：

尊敬的人力资源委员会，

[EMPLOYEE_ID_1]在本考核周期内表现突出，绩效评级B级...
（建议书正文）
```

### 还原后展示给用户 / After restoration

```
关于EMP-001234的晋升建议书：

尊敬的人力资源委员会，

EMP-001234在本考核周期内表现突出，绩效评级B级...
（建议书正文）
```

---

## 关键要点回顾 / Key Takeaways

1. **相同值，相同占位符**: 同一个手机号在文中出现多次，始终使用同一个 `[PHONE_1]`
2. **不同值，递增编号**: 同一类型的不同值使用 `[PHONE_1]`、`[PHONE_2]`……
3. **语义保留**: LLM 通过类型化占位符（`[PHONE_1]` vs `[EMAIL_1]`）理解数据类型，生成更准确的回复
4. **映射表本地**: 无论何时，原始值→占位符的映射只存在于本地内存，不出设备
