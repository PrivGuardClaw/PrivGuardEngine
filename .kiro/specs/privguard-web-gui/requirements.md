# Requirements Document

## Introduction

PrivGuard Web GUI 是 PrivGuard 隐私保护引擎的可视化管理界面。该功能允许用户通过 Web 浏览器登录并管理隐私保护系统，包括查看拦截记录、配置保护规则，并实现配置的即时生效。

GUI 进程将与现有的代理服务器（Proxy Server）集成，作为一个独立的 HTTP 服务运行，通过命令行一键启动。

## Glossary

- **Web_GUI**: 基于 HTTP 的 Web 管理界面服务，提供用户认证、记录查看和规则管理功能
- **Proxy_Server**: 现有的 PrivGuard 代理服务器，负责拦截和处理 AI Agent 与 LLM API 之间的请求
- **Intercept_Record**: 代理服务器拦截并处理的单条请求记录，包含脱敏前后的数据和时间戳
- **Protection_Rule**: YAML 格式的正则规则配置，定义如何检测和脱敏特定类型的 PII
- **Session**: 用户登录后的会话状态，用于维持认证和授权
- **Rule_Loader**: 规则加载器，负责从 YAML 文件读取和解析保护规则
- **Hot_Reload**: 热重载机制，允许规则修改后无需重启服务即可生效

## Requirements

### Requirement 1: Web 服务启动

**User Story:** As a 系统管理员, I want 通过命令行一键启动 Web GUI 服务, so that 我可以快速访问管理界面而无需复杂配置

#### Acceptance Criteria

1. WHEN 用户执行 `privguard gui` 命令, THE Web_GUI SHALL 在默认端口 19821 启动 HTTP 服务
2. WHEN 用户指定 `--port <number>` 参数, THE Web_GUI SHALL 在指定端口启动服务
3. WHEN 端口被占用, THE Web_GUI SHALL 显示错误信息并提示可用端口
4. THE Web_GUI SHALL 在启动时输出访问地址到终端（如 `http://localhost:19821`）
5. WHEN 用户按下 Ctrl+C, THE Web_GUI SHALL 优雅关闭服务并释放端口

### Requirement 2: 用户认证

**User Story:** As a 系统管理员, I want 通过登录验证访问管理界面, so that 未授权用户无法查看敏感的拦截记录

#### Acceptance Criteria

1. WHEN 用户首次访问 Web_GUI, THE Web_GUI SHALL 显示登录页面
2. WHEN 用户未设置密码且首次启动, THE Web_GUI SHALL 生成随机密码并输出到终端
3. WHEN 用户提供 `--password <string>` 参数, THE Web_GUI SHALL 使用指定密码进行认证
4. WHEN 用户输入正确密码, THE Web_GUI SHALL 创建 Session 并重定向到主界面
5. WHEN 用户输入错误密码, THE Web_GUI SHALL 显示错误提示并保持在登录页面
6. WHILE Session 有效, THE Web_GUI SHALL 允许用户访问所有管理功能
7. WHEN Session 超过 24 小时未活动, THE Web_GUI SHALL 自动注销并要求重新登录

### Requirement 3: 拦截记录查看

**User Story:** As a 系统管理员, I want 查看所有隐私保护拦截记录, so that 我可以了解系统的保护活动和效果

#### Acceptance Criteria

1. THE Web_GUI SHALL 显示拦截记录列表，包含时间戳、请求类型、检测到的 PII 类型和数量
2. WHEN 用户点击某条记录, THE Web_GUI SHALL 展开显示详细信息（脱敏前后对比、占位符映射）
3. THE Web_GUI SHALL 按时间倒序排列记录，最新记录在最前
4. WHEN 记录超过 1000 条, THE Web_GUI SHALL 提供分页功能，每页显示 50 条
5. THE Web_GUI SHALL 提供按 PII 类型筛选记录的功能
6. THE Web_GUI SHALL 提供按时间范围筛选记录的功能
7. WHEN Proxy_Server 产生新的拦截记录, THE Web_GUI SHALL 在 5 秒内更新显示（无需手动刷新）
8. IF 拦截记录包含原始敏感值, THEN THE Web_GUI SHALL 默认以掩码形式显示（如 `138****5678`）

### Requirement 4: 保护规则管理

**User Story:** As a 系统管理员, I want 查看和修改现有的保护规则, so that 我可以根据业务需求调整隐私保护策略

#### Acceptance Criteria

1. THE Web_GUI SHALL 显示所有已加载的 Protection_Rule 列表
2. THE Web_GUI SHALL 区分显示系统规则（只读）和自定义规则（可编辑）
3. WHEN 用户选择编辑自定义规则, THE Web_GUI SHALL 提供规则编辑表单（类型、名称、正则模式、置信度、验证器）
4. WHEN 用户修改规则并保存, THE Web_GUI SHALL 验证正则表达式语法有效性
5. IF 正则表达式语法无效, THEN THE Web_GUI SHALL 显示错误信息并阻止保存
6. WHEN 用户保存有效规则, THE Web_GUI SHALL 将修改写入 `custom.yml` 文件
7. THE Web_GUI SHALL 提供添加新自定义规则的功能
8. THE Web_GUI SHALL 提供删除自定义规则的功能（系统规则不可删除）
9. THE Web_GUI SHALL 提供规则测试功能，用户可输入测试文本验证规则匹配效果

### Requirement 5: 规则即时生效

**User Story:** As a 系统管理员, I want 规则修改后立即生效, so that 我无需重启服务即可应用新的保护策略

#### Acceptance Criteria

1. WHEN 用户通过 Web_GUI 保存规则修改, THE Rule_Loader SHALL 在 1 秒内重新加载规则
2. WHEN 规则重新加载完成, THE Proxy_Server SHALL 使用新规则处理后续请求
3. THE Web_GUI SHALL 显示规则生效状态（"已同步" 或 "同步中"）
4. IF 规则加载失败, THEN THE Web_GUI SHALL 显示错误信息并保持使用旧规则
5. THE Web_GUI SHALL 记录规则变更历史（时间、操作类型、操作者）

### Requirement 6: 与代理服务器集成

**User Story:** As a 系统管理员, I want Web GUI 与代理服务器协同工作, so that 我可以在一个界面管理整个隐私保护系统

#### Acceptance Criteria

1. WHEN Web_GUI 启动时, THE Web_GUI SHALL 检测 Proxy_Server 是否运行
2. THE Web_GUI SHALL 显示 Proxy_Server 的运行状态（运行中/已停止/未检测到）
3. WHEN Proxy_Server 未运行, THE Web_GUI SHALL 提供启动代理服务器的按钮
4. THE Web_GUI SHALL 显示 Proxy_Server 的配置信息（端口、上游 URL、已配置的 Agent）
5. THE Web_GUI SHALL 与 Proxy_Server 共享同一份规则配置
6. WHEN 用户通过 Web_GUI 修改规则, THE Proxy_Server SHALL 自动感知并应用变更

### Requirement 7: 使用文档

**User Story:** As a 开发者, I want 在 README 中找到 Web GUI 的使用教程, so that 我可以快速上手使用该功能

#### Acceptance Criteria

1. THE README SHALL 包含 Web GUI 功能的简介
2. THE README SHALL 包含启动命令和可用参数说明
3. THE README SHALL 包含首次登录的操作步骤
4. THE README SHALL 包含规则管理的操作指南
5. THE README SHALL 包含与代理服务器集成使用的说明
6. THE README SHALL 包含常见问题解答（FAQ）
