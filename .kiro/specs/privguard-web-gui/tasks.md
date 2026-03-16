# 实现计划：PrivGuard Web GUI

## 概述

基于设计文档，将 Web GUI 功能拆解为一系列递进式编码任务。所有代码位于 `PrivGuardEngine/engine/src/gui/` 目录下，使用 TypeScript 实现，零外部依赖（属性测试除外使用 `fast-check`）。

## 任务列表

- [x] 1. 创建 GUI 模块基础结构和核心类型
  - 在 `engine/src/gui/` 下创建目录结构
  - 创建 `engine/src/gui/types.ts`，定义所有共享接口：`InterceptRecord`、`RecordQuery`、`ProxyStatus`、`Session`、`RuleChangeLog`、`WebServerConfig`、`WebServerHandle`
  - _需求: 3.1, 4.1, 6.2_

- [x] 2. 实现拦截记录存储模块
  - [x] 2.1 实现 `engine/src/gui/record-store.ts`
    - 实现 `RecordStore` 类，包含 `add`、`query`、`get`、`subscribe`、`cleanup` 方法
    - `query` 支持分页（page/pageSize）、PII 类型筛选、时间范围筛选，结果按 timestamp 降序排列
    - 内存存储，最多保留 1000 条记录（超出时删除最旧记录）
    - `subscribe` 返回取消订阅函数，用于 SSE 推送
    - _需求: 3.1, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 2.2 为记录存储编写属性测试
    - **Property 8: 记录查询排序正确性**
    - **Validates: Requirements 3.3**

  - [ ]* 2.3 为记录存储编写属性测试
    - **Property 9: 记录分页正确性**
    - **Validates: Requirements 3.4**

  - [ ]* 2.4 为记录存储编写属性测试
    - **Property 10: 记录类型筛选正确性**
    - **Validates: Requirements 3.5**

  - [ ]* 2.5 为记录存储编写属性测试
    - **Property 11: 记录时间筛选正确性**
    - **Validates: Requirements 3.6**

  - [ ]* 2.6 为记录存储编写属性测试
    - **Property 7: 拦截记录包含必需字段**
    - **Validates: Requirements 3.1**

- [x] 3. 实现认证模块
  - [x] 3.1 实现 `engine/src/gui/auth.ts`
    - 实现 `AuthModule`，包含 `validatePassword`、`createSession`、`validateSession`、`touchSession`、`destroySession`、`cleanupExpiredSessions` 方法
    - Session 使用 `crypto.randomUUID()` 生成 ID，存储在内存 Map 中
    - Session 最大有效期 24 小时（`SESSION_MAX_AGE = 24 * 60 * 60 * 1000`）
    - _需求: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.2 为认证模块编写属性测试
    - **Property 4: 认证往返正确性**
    - **Validates: Requirements 2.3, 2.4, 2.6**

  - [ ]* 3.3 为认证模块编写属性测试
    - **Property 5: 错误密码拒绝**
    - **Validates: Requirements 2.5**

  - [ ]* 3.4 为认证模块编写属性测试
    - **Property 6: Session 过期**
    - **Validates: Requirements 2.7**

- [x] 4. 实现规则管理模块
  - [x] 4.1 实现 `engine/src/gui/rule-manager.ts`
    - 实现 `RuleManager`，包含 `loadAll`、`saveCustomRules`、`validatePattern`、`testRule` 方法
    - `loadAll` 区分系统规则（zh-CN.yml、en-US.yml、common.yml）和自定义规则（custom.yml）
    - `saveCustomRules` 将规则序列化为 YAML 写入 `custom.yml`
    - `validatePattern` 使用 `try { new RegExp(pattern) }` 验证语法
    - `testRule` 返回所有匹配项数组
    - 实现 `onReload` 回调，规则保存后触发热重载
    - _需求: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.1, 5.2_

  - [ ]* 4.2 为规则管理编写属性测试
    - **Property 13: 正则表达式验证**
    - **Validates: Requirements 4.4**

  - [ ]* 4.3 为规则管理编写属性测试
    - **Property 14: 规则持久化往返**
    - **Validates: Requirements 4.6**

  - [ ]* 4.4 为规则管理编写属性测试
    - **Property 15: 规则删除正确性**
    - **Validates: Requirements 4.8**

  - [ ]* 4.5 为规则管理编写属性测试
    - **Property 16: 规则测试匹配正确性**
    - **Validates: Requirements 4.9**

  - [ ]* 4.6 为规则管理编写属性测试
    - **Property 17: 规则变更历史记录**
    - **Validates: Requirements 5.5**

- [x] 5. 实现工具函数
  - [x] 5.1 实现 `engine/src/gui/utils.ts`
    - 实现 `maskValue(value: string): string`：长度 > 4 时保留首尾各 2 字符，中间替换为 `****`
    - 实现 `generatePassword(): string`：生成 8 位随机字母数字密码
    - 实现 `formatTimestamp(ts: number): string`：格式化为本地时间字符串
    - _需求: 2.2, 3.8_

  - [ ]* 5.2 为工具函数编写属性测试
    - **Property 12: 敏感值掩码**
    - **Validates: Requirements 3.8**

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请告知用户。

- [x] 7. 实现 SSE 实时推送模块
  - 实现 `engine/src/gui/sse.ts`
  - 实现 `SSEManager` 类，包含 `addConnection`、`removeConnection`、`broadcast`、`sendHeartbeat` 方法
  - 连接使用 `crypto.randomUUID()` 生成 ID，存储在 Map 中
  - `broadcast` 向所有活跃连接发送 `data: {json}\n\n` 格式的 SSE 事件
  - 每 30 秒发送一次心跳事件（`event: heartbeat`）
  - 连接断开时自动从 Map 中移除
  - _需求: 3.7_

- [x] 8. 实现 REST API 路由
  - 实现 `engine/src/gui/api.ts`
  - 实现所有 API 端点的路由处理函数，接受 `IncomingMessage` 和 `ServerResponse`
  - 认证端点：`POST /api/login`、`POST /api/logout`
  - 记录端点：`GET /api/records`（支持 query 参数）、`GET /api/records/:id`
  - 规则端点：`GET /api/rules`、`POST /api/rules/custom`、`PUT /api/rules/custom/:index`、`DELETE /api/rules/custom/:index`、`POST /api/rules/test`、`POST /api/rules/reload`
  - 代理状态端点：`GET /api/proxy/status`、`POST /api/proxy/start`
  - SSE 端点：`GET /api/events`（需验证 Session）
  - 所有非登录 API 端点需验证 Session，未认证返回 401
  - _需求: 2.1, 2.4, 2.5, 3.1, 3.2, 3.4, 3.5, 3.6, 4.1, 4.3, 4.4, 4.6, 4.7, 4.8, 4.9, 5.1, 6.1, 6.2, 6.3_

- [x] 9. 实现前端静态文件
  - [x] 9.1 创建 `engine/src/gui/static/login.html`
    - 简洁的登录表单，包含密码输入框和提交按钮
    - 错误提示区域
    - 内联 CSS，无外部依赖
    - _需求: 2.1, 2.5_

  - [x] 9.2 创建 `engine/src/gui/static/style.css`
    - 全局样式：重置、字体、颜色变量
    - 布局：侧边栏导航 + 主内容区
    - 组件样式：表格、表单、按钮、徽章、模态框
    - 响应式基础布局
    - _需求: 3.1, 4.1_

  - [x] 9.3 创建 `engine/src/gui/static/index.html`
    - 主页面结构：导航栏、侧边栏（拦截记录/规则管理/代理状态）、主内容区
    - 拦截记录面板：列表表格、筛选控件、分页控件、详情展开区域
    - 规则管理面板：系统规则列表（只读）、自定义规则列表（可编辑）、添加/编辑表单、规则测试区域
    - 代理状态面板：运行状态、配置信息、启动按钮
    - _需求: 3.1, 3.2, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.9, 6.1, 6.2, 6.3, 6.4_

  - [x] 9.4 创建 `engine/src/gui/static/app.js`
    - 实现 `AppState` 管理和页面路由（无框架，原生 JS）
    - 认证流程：检查 Session、登录/登出
    - 拦截记录：加载列表、分页、筛选、展开详情、SSE 实时更新
    - 规则管理：加载规则、添加/编辑/删除自定义规则、规则测试
    - 代理状态：轮询状态、启动代理
    - SSE 连接管理：自动重连（指数退避，最大 30 秒）
    - 敏感值默认掩码显示，提供"显示原始值"切换
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.3, 6.1, 6.2, 6.3_

- [x] 10. 实现 Web 服务器主模块
  - 实现 `engine/src/gui/web-server.ts`
  - 使用 `node:http` 创建 HTTP 服务器，处理所有请求
  - 静态文件服务：将 `static/` 目录下的文件内联为字符串常量（避免运行时文件路径问题）
  - 请求路由：`/api/*` 转发到 API 处理器，`/api/events` 转发到 SSE，其余返回静态文件
  - 未认证的非 API 请求重定向到 `/login.html`
  - 启动时输出 `http://localhost:{port}` 到终端
  - 实现 `startWebServer(config: WebServerConfig): WebServerHandle`
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 3.7_

  - [ ]* 10.1 为 Web 服务器编写属性测试
    - **Property 1: 端口配置正确性**
    - **Validates: Requirements 1.2**

  - [ ]* 10.2 为 Web 服务器编写属性测试
    - **Property 2: 启动输出包含访问地址**
    - **Validates: Requirements 1.4**

  - [ ]* 10.3 为 Web 服务器编写属性测试
    - **Property 3: 未认证请求重定向**
    - **Validates: Requirements 2.1**

  - [ ]* 10.4 为 Web 服务器编写属性测试
    - **Property 18: 规则配置共享**
    - **Validates: Requirements 6.5**

- [x] 11. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请告知用户。

- [x] 12. 集成：修改代理服务器以记录拦截事件
  - 修改 `engine/src/proxy/server.ts`，在 `handleRequest` 中调用 `RecordStore.add()` 记录每次拦截事件
  - 在 `startProxy` 中接受可选的 `recordStore` 参数，注入到请求处理流程
  - 构造 `InterceptRecord` 时使用 `maskValue` 处理敏感值
  - _需求: 3.1, 3.7, 6.5, 6.6_

- [x] 13. 集成：创建 GUI CLI 入口
  - 创建 `engine/src/gui-cli.ts`，作为 `privguard-gui` 命令的入口
  - 解析 `--port`、`--password`、`--rules-dir` 参数
  - 若未提供密码，调用 `generatePassword()` 生成随机密码并输出到终端
  - 同时启动 Proxy Server（端口 19820）和 Web Server（端口 19821）
  - 输出启动横幅：代理地址、GUI 地址、密码提示
  - 监听 `SIGINT`/`SIGTERM`，优雅关闭两个服务器
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 6.1_

- [x] 14. 更新构建配置
  - 修改 `engine/package.json`，添加 `gui-cli` 的 esbuild 打包脚本
  - 在 `sync:skill` 脚本中包含 GUI CLI 的打包和同步步骤
  - 确保静态文件（HTML/CSS/JS）被内联到打包产物中（使用 esbuild `--bundle` 或手动内联）
  - _需求: 1.1_

- [x] 15. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，运行 `npm run sync:skill` 验证构建，如有问题请告知用户。

## 备注

- 标有 `*` 的子任务为可选项，可跳过以加快 MVP 交付
- 每个任务引用了具体的需求条目以保证可追溯性
- 属性测试使用 `fast-check` 库，每个属性至少运行 100 次迭代
- 静态文件内联到打包产物中，确保零运行时文件依赖
- 所有代码修改后需运行 `npm run sync:skill` 同步到 `privguard-skill`
