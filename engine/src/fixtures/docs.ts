/**
 * 20 realistic test documents covering diverse scenarios.
 * Each document has:
 *   - id: unique identifier
 *   - name: scenario description
 *   - content: the raw text with embedded PII
 *   - expectedDetections: what should be detected (type + value)
 *   - simulatedLLMResponse: what an LLM might return using placeholders
 *   - expectedRestoredContains: key phrases that should appear after restore
 */

export interface TestDoc {
  id: number;
  name: string;
  content: string;
  expectedDetections: Array<{ type: string; value: string }>;
  simulatedLLMResponse: string;
  expectedRestoredContains: string[];
  expectedRestoredNotContains?: string[];  // placeholders that should NOT remain
}

export const TEST_DOCS: TestDoc[] = [
  // ── 1. 中文客户信息 ──
  {
    id: 1,
    name: '中文客户信息 - 手机+邮箱',
    content: '客户张三的手机号是13812345678，邮箱是zhangsan@corp.com，请帮我写一个发送通知的函数。',
    expectedDetections: [
      { type: 'PHONE', value: '13812345678' },
      { type: 'EMAIL', value: 'zhangsan@corp.com' },
    ],
    simulatedLLMResponse: '这是发送通知的函数，会向{{PG:PHONE_1}}发送短信，向{{PG:EMAIL_1}}发送邮件。\n\n```python\ndef send_notification(phone, email):\n    send_sms(phone, "Your order is ready")\n    send_email(email, "Order notification")\n```',
    expectedRestoredContains: ['13812345678', 'zhangsan@corp.com', 'send_notification'],
    expectedRestoredNotContains: ['{{PG:PHONE_1}}', '{{PG:EMAIL_1}}'],
  },

  // ── 2. 美国 SSN + 电话 ──
  {
    id: 2,
    name: 'US SSN and phone number',
    content: 'Employee John has SSN 123-45-6789 and can be reached at (555) 234-5678.',
    expectedDetections: [
      { type: 'SSN', value: '123-45-6789' },
    ],
    simulatedLLMResponse: 'The employee record shows SSN {{PG:SSN_1}}. I recommend storing this in an encrypted vault.',
    expectedRestoredContains: ['123-45-6789', 'encrypted vault'],
  },

  // ── 3. 数据库连接串 ──
  {
    id: 3,
    name: '数据库连接串中的密码',
    content: '我们的数据库连接串是 postgres://admin:SuperSecret123@db.prod.internal:5432/myapp，帮我写一个连接池配置。',
    expectedDetections: [],  // EMAIL pattern won't match inside URL, no direct PII
    simulatedLLMResponse: '建议使用环境变量管理数据库连接：\n\n```python\nimport os\nDB_URL = os.environ["DATABASE_URL"]\n```\n\n不要在代码中硬编码连接串。',
    expectedRestoredContains: ['环境变量', 'DATABASE_URL'],
  },

  // ── 4. API Key 泄露 ──
  {
    id: 4,
    name: 'API Key in config',
    content: 'Here is my config:\nOPENAI_API_KEY=sk-abc123def456ghi789jkl012mno345pqr\nPlease help me refactor this to use env vars.',
    expectedDetections: [
      { type: 'API_KEY', value: 'sk-abc123def456ghi789jkl012mno345pqr' },
    ],
    simulatedLLMResponse: 'I detected an API key {{PG:API_KEY_1}}. Here is the refactored version:\n\n```javascript\nconst apiKey = process.env.OPENAI_API_KEY;\n```\n\nNever commit API keys to version control.',
    expectedRestoredContains: ['sk-abc123def456ghi789jkl012mno345pqr', 'process.env'],
  },

  // ── 5. 中国身份证号 ──
  {
    id: 5,
    name: '身份证号验证',
    content: '用户提交的身份证号是110101199001011237，请帮我写一个验证函数。',
    expectedDetections: [
      { type: 'IDCARD', value: '110101199001011237' },
    ],
    simulatedLLMResponse: '身份证号{{PG:IDCARD_1}}的格式正确。以下是验证函数：\n\n```python\ndef validate_idcard(id_number: str) -> bool:\n    weights = [7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2]\n    check_map = "10X98765432"\n    total = sum(int(id_number[i]) * weights[i] for i in range(17))\n    return id_number[17].upper() == check_map[total % 11]\n```',
    expectedRestoredContains: ['110101199001011237', 'validate_idcard'],
  },

  // ── 6. 混合中英文多种 PII ──
  {
    id: 6,
    name: '混合场景 - 多种敏感信息',
    content: '项目配置：\n- 管理员邮箱: admin@example.com\n- 服务器IP: 192.168.1.100\n- 管理员手机: 13999887766\n请帮我生成一个配置文件模板。',
    expectedDetections: [
      { type: 'EMAIL', value: 'admin@example.com' },
      { type: 'IPV4', value: '192.168.1.100' },
      { type: 'PHONE', value: '13999887766' },
    ],
    simulatedLLMResponse: '配置文件模板：\n\n```yaml\nadmin:\n  email: ${ADMIN_EMAIL}\n  phone: ${ADMIN_PHONE}\nserver:\n  ip: ${SERVER_IP}\n```\n\n检测到以下敏感信息已脱敏：\n- 邮箱: {{PG:EMAIL_1}}\n- IP: {{PG:IPV4_1}}\n- 手机: {{PG:PHONE_1}}',
    expectedRestoredContains: ['admin@example.com', '192.168.1.100', '13999887766', 'ADMIN_EMAIL'],
  },

  // ── 7. JWT Token ──
  {
    id: 7,
    name: 'JWT token in debug log',
    content: 'Debug: Auth token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.Sfl3hM5EKqLz0So5FIGfNE0fUJIknMA7ORoS0sQ4SRk\nPlease help me debug why auth is failing.',
    expectedDetections: [
      { type: 'JWT', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.Sfl3hM5EKqLz0So5FIGfNE0fUJIknMA7ORoS0sQ4SRk' },
    ],
    simulatedLLMResponse: 'The JWT {{PG:JWT_1}} appears to be valid structurally. The issue might be token expiration. Check the `exp` claim in the payload.',
    expectedRestoredContains: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'exp'],
  },

  // ── 8. 银行卡号 (Luhn 验证) ──
  {
    id: 8,
    name: '银行卡号 Luhn 验证',
    content: '客户的银行卡号是6222021234567890003，请帮我查询余额。',
    expectedDetections: [
      { type: 'BANKCARD', value: '6222021234567890003' },
    ],
    simulatedLLMResponse: '银行卡{{PG:BANKCARD_1}}的余额查询需要通过银行API。建议使用：\n\n```python\ndef query_balance(card_number: str) -> float:\n    return bank_api.get_balance(card_number)\n```',
    expectedRestoredContains: ['6222021234567890003', 'query_balance'],
  },

  // ── 9. IP 地址 + localhost 跳过 ──
  {
    id: 9,
    name: 'IP addresses with localhost skip',
    content: 'The app runs on 127.0.0.1:3000 in dev and 10.0.1.50 in production. Also connects to 0.0.0.0 for binding.',
    expectedDetections: [
      { type: 'IPV4', value: '10.0.1.50' },
    ],
    simulatedLLMResponse: 'Production server at {{PG:IPV4_1}} should have firewall rules configured. Localhost and 0.0.0.0 are fine for development.',
    expectedRestoredContains: ['10.0.1.50', 'firewall'],
  },

  // ── 10. 多个相同类型不同值 ──
  {
    id: 10,
    name: '多个手机号 - 幂等性测试',
    content: '联系人列表：\n- 张三: 13812345678\n- 李四: 13999887766\n- 王五: 13812345678\n请帮我去重。',
    expectedDetections: [
      { type: 'PHONE', value: '13812345678' },
      { type: 'PHONE', value: '13999887766' },
    ],
    simulatedLLMResponse: '去重后的联系人：\n- 张三/王五: {{PG:PHONE_1}}\n- 李四: {{PG:PHONE_2}}\n\n张三和王五的手机号相同。',
    expectedRestoredContains: ['13812345678', '13999887766', '张三和王五'],
  },

  // ── 11. 代码中的硬编码密码 ──
  {
    id: 11,
    name: 'Hardcoded credentials in code',
    content: `Here is my Python script:
def connect():
    url = "postgres://dbuser:MyP@ssw0rd@db.example.com:5432/production"
    email_to = "ops@example.com"
    return create_engine(url)
Please review for security issues.`,
    expectedDetections: [
      { type: 'EMAIL', value: 'ops@example.com' },
    ],
    simulatedLLMResponse: `Security issues found:
1. Hardcoded database credentials — use environment variables
2. Email {{PG:EMAIL_1}} is hardcoded

\`\`\`python
import os
def connect():
    url = os.environ["DATABASE_URL"]
    email_to = os.environ["OPS_EMAIL"]
    return create_engine(url)
\`\`\``,
    expectedRestoredContains: ['ops@example.com', 'os.environ'],
  },

  // ── 12. 日志文件分析 ──
  {
    id: 12,
    name: '服务器日志中的敏感信息',
    content: `[2024-01-15 10:23:45] INFO  User login: email=user123@gmail.com ip=203.0.113.50
[2024-01-15 10:23:46] ERROR Auth failed for 13666778899 from 203.0.113.50
[2024-01-15 10:23:47] INFO  Request from 127.0.0.1 (health check)
帮我分析这段日志的异常。`,
    expectedDetections: [
      { type: 'EMAIL', value: 'user123@gmail.com' },
      { type: 'IPV4', value: '203.0.113.50' },
      { type: 'PHONE', value: '13666778899' },
    ],
    simulatedLLMResponse: `日志分析：
1. 用户 {{PG:EMAIL_1}} 从 {{PG:IPV4_1}} 登录成功
2. 手机号 {{PG:PHONE_1}} 从同一 IP {{PG:IPV4_1}} 认证失败 — 可能是暴力破解
3. 127.0.0.1 的请求是正常的健康检查

建议：对 {{PG:IPV4_1}} 实施速率限制。`,
    expectedRestoredContains: ['user123@gmail.com', '203.0.113.50', '13666778899', '速率限制'],
  },

  // ── 13. CSV 数据处理 ──
  {
    id: 13,
    name: 'CSV data with PII',
    content: `name,phone,email,ssn
Alice,13811112222,alice@test.com,234-56-7890
Bob,13922223333,bob@test.com,345-67-8901
Help me write a script to process this CSV.`,
    expectedDetections: [
      { type: 'PHONE', value: '13811112222' },
      { type: 'PHONE', value: '13922223333' },
      { type: 'EMAIL', value: 'alice@test.com' },
      { type: 'EMAIL', value: 'bob@test.com' },
      { type: 'SSN', value: '234-56-7890' },
      { type: 'SSN', value: '345-67-8901' },
    ],
    simulatedLLMResponse: `Here's a CSV processing script. Note: I detected PII in the data.

\`\`\`python
import csv
import os

def process_csv(filepath):
    with open(filepath) as f:
        reader = csv.DictReader(f)
        for row in reader:
            process_record(row)
\`\`\`

The CSV contains phones ({{PG:PHONE_1}}, {{PG:PHONE_2}}), emails, and SSNs. Consider encrypting at rest.`,
    expectedRestoredContains: ['13811112222', '13922223333', 'csv', 'process_record'],
  },

  // ── 14. 无敏感信息的文档 ──
  {
    id: 14,
    name: 'Clean document - no PII',
    content: 'Please help me write a function that calculates the Fibonacci sequence up to n terms. Use dynamic programming for efficiency.',
    expectedDetections: [],
    simulatedLLMResponse: `Here's an efficient Fibonacci implementation:

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    dp = [0, 1]
    for i in range(2, n + 1):
        dp.append(dp[-1] + dp[-2])
    return dp[n]
\`\`\``,
    expectedRestoredContains: ['fibonacci', 'efficient'],
  },

  // ── 15. 固定电话 + 车牌号 ──
  {
    id: 15,
    name: '固定电话和车牌号',
    content: '公司前台电话010-87654321，CEO的车牌号是京A88888，请帮我更新通讯录。',
    expectedDetections: [
      { type: 'LANDLINE', value: '010-87654321' },
      { type: 'PLATE_NUMBER', value: '京A88888' },
    ],
    simulatedLLMResponse: '通讯录已更新：\n- 前台: {{PG:LANDLINE_1}}\n- CEO车牌: {{PG:PLATE_NUMBER_1}}\n\n建议将这些信息存储在加密的通讯录系统中。',
    expectedRestoredContains: ['010-87654321', '京A88888', '通讯录'],
  },

  // ── 16. 邮箱大量出现 ──
  {
    id: 16,
    name: 'Multiple emails in team roster',
    content: `Team contacts:
- Lead: lead@company.io
- Dev1: dev1@company.io
- Dev2: dev2@company.io
- QA: qa@company.io
Please set up a mailing list.`,
    expectedDetections: [
      { type: 'EMAIL', value: 'lead@company.io' },
      { type: 'EMAIL', value: 'dev1@company.io' },
      { type: 'EMAIL', value: 'dev2@company.io' },
      { type: 'EMAIL', value: 'qa@company.io' },
    ],
    simulatedLLMResponse: `Mailing list setup:

\`\`\`bash
# Create group alias
gcloud identity groups create team@company.io
gcloud identity groups memberships add --group=team@company.io --member={{PG:EMAIL_1}}
\`\`\`

Members: {{PG:EMAIL_1}}, {{PG:EMAIL_2}}, {{PG:EMAIL_3}}, {{PG:EMAIL_4}}`,
    expectedRestoredContains: ['lead@company.io', 'dev1@company.io', 'dev2@company.io', 'qa@company.io'],
  },

  // ── 17. 混合语言技术文档 ──
  {
    id: 17,
    name: 'Mixed language technical doc',
    content: `系统部署文档：
1. SSH到服务器 ssh admin@10.0.2.15
2. 配置文件中设置 API_TOKEN=token-abcdefghij1234567890klmn
3. 联系运维 devops@internal.corp 获取SSL证书
4. 绑定域名到 10.0.2.15`,
    expectedDetections: [
      { type: 'IPV4', value: '10.0.2.15' },
      { type: 'EMAIL', value: 'devops@internal.corp' },
      { type: 'API_KEY', value: 'token-abcdefghij1234567890klmn' },
    ],
    simulatedLLMResponse: `部署步骤优化建议：
1. 使用跳板机而非直接SSH到 {{PG:IPV4_1}}
2. API Token {{PG:API_KEY_1}} 应存储在 secrets manager 中
3. 联系 {{PG:EMAIL_1}} 时使用工单系统而非直接邮件
4. 考虑使用域名而非直接绑定 {{PG:IPV4_1}}`,
    expectedRestoredContains: ['10.0.2.15', 'devops@internal.corp', 'secrets manager'],
  },

  // ── 18. 边界情况 - 敏感信息紧邻 ──
  {
    id: 18,
    name: 'Adjacent PII without separators',
    content: '紧急联系：13812345678/zhangsan@test.com，备用13999001122。',
    expectedDetections: [
      { type: 'PHONE', value: '13812345678' },
      { type: 'EMAIL', value: 'zhangsan@test.com' },
      { type: 'PHONE', value: '13999001122' },
    ],
    simulatedLLMResponse: '紧急联系信息：{{PG:PHONE_1}}/{{PG:EMAIL_1}}，备用{{PG:PHONE_2}}。建议使用紧急联系人管理系统。',
    expectedRestoredContains: ['13812345678', 'zhangsan@test.com', '13999001122'],
  },

  // ── 19. 长文本中的少量 PII ──
  {
    id: 19,
    name: 'Long text with sparse PII',
    content: `这是一份项目总结报告。

本季度我们完成了以下工作：
1. 重构了用户认证模块，提升了安全性
2. 优化了数据库查询性能，平均响应时间降低40%
3. 新增了日志监控系统，支持实时告警
4. 完成了CI/CD流水线的搭建

技术栈：Node.js + PostgreSQL + Redis + Docker

项目负责人联系方式：pm@project.org
服务器监控面板：http://10.0.3.200:9090/dashboard

下季度计划：
1. 引入微服务架构
2. 实现自动扩缩容
3. 加强安全审计`,
    expectedDetections: [
      { type: 'EMAIL', value: 'pm@project.org' },
      { type: 'IPV4', value: '10.0.3.200' },
    ],
    simulatedLLMResponse: `报告总结很好。两个安全建议：
1. 联系方式 {{PG:EMAIL_1}} 不应出现在报告正文中，建议放在权限受控的通讯录
2. 监控面板 {{PG:IPV4_1}}:9090 应该加上认证，不要暴露在公网

其他内容没有安全问题。`,
    expectedRestoredContains: ['pm@project.org', '10.0.3.200', '认证'],
  },

  // ── 20. 代码审查场景 - 多种凭证 ──
  {
    id: 20,
    name: 'Code review with multiple credential types',
    content: `Review this config file:

AWS_ACCESS_KEY=akid-ABCDEFGHIJKLMNOPQRSTUVWX
DATABASE_URL=mysql://root:password123@db.internal:3306/app
ADMIN_EMAIL=admin@startup.io
JWT_SECRET=secret-abcdefghijklmnopqrstuvwxyz1234
SERVER_IP=172.16.0.100

Is this secure?`,
    expectedDetections: [
      { type: 'EMAIL', value: 'admin@startup.io' },
      { type: 'IPV4', value: '172.16.0.100' },
    ],
    simulatedLLMResponse: `This config has multiple security issues:

1. {{PG:EMAIL_1}} — admin email exposed
2. {{PG:IPV4_1}} — internal IP exposed
3. AWS key and DB password in plaintext

Recommendations:
\`\`\`bash
# Use a secrets manager
aws secretsmanager create-secret --name app/config
\`\`\`

Move all credentials to environment variables or a vault.`,
    expectedRestoredContains: ['admin@startup.io', '172.16.0.100', 'secrets manager', 'vault'],
  },
];
