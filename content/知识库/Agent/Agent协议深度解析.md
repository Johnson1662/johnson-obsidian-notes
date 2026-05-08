---
title: "大模型Agent协议深度解析：MCP、ACP、A2A与Codex，小白程序员必备收藏指南"
source: "https://blog.csdn.net/ALM_8241/article/details/160548666"
author:
  - "[[ALM_8241]]"
published: 2026-04-27
created: 2026-05-08
description: "文章浏览阅读313次，点赞10次，收藏10次。MCP 由 Anthropic 提出，是一个专注于 Agent 与外部工具/资源交互 的标准协议。📦 资源抽象: 将外部系统（数据库、API、文件系统）抽象为统一的 Resource🔧 工具调用: 标准化的工具发现、调用和响应流程🔌 传输无关: 支持 stdio、SSE、HTTP 等多种传输方式🔐 权限控制: 内置的工具执行审批机制协议版本:2025-06-18(来源: Codex。_前端ts(typescript ) ,acp接docker里的agent其中acp指的是"
tags:
  - "clippings"
---
本文深入解析了AI Agent领域的三大核心协议：MCP、ACP和A2A，以及Codex的实现方式。通过对比Google Gemini CLI和OpenAI Codex的源码，探讨了各协议的设计理念、架构差异和应用场景。文章强调了协议标准化对于解决Agent生态孤岛效应、工具集成困难等问题的价值，并展望了未来协议融合、性能优化等发展方向，为开发者提供了Agent系统架构的实践指导。

**一、协议背景：为什么需要标准化？**

##### 1.1 当前 AI Agent 生态的痛点

在协议标准化之前，AI Agent 面临以下核心挑战：

| 痛点 | 描述 | 影响 |
| --- | --- | --- |
| 孤岛效应 | 每个 Agent 使用私有协议，无法互操作 | 无法构建 Multi-Agent 系统 |
| 工具集成困难 | 每个工具需要为不同 Agent 重复开发适配器 | 开发成本高，生态碎片化 |
| 状态不可恢复 | 会话状态无法持久化或跨系统传递 | 用户体验差，无法长期任务 |
| 安全性缺失 | 缺乏统一的权限控制和审计机制 | 企业级部署存在风险 |

##### 1.2 协议标准化的价值

对比结果:

- 标准化前: 需要 N × M 个适配器 (每个 Agent 为每个 Tool 开发专用适配器)
- 标准化后: 仅需 N + M 个适配器 (Agent 实现协议 + Tool 实现协议)

---

**二、MCP (Model Context Protocol) 深度解析**

##### 2.1 MCP 协议概述

MCP 由 Anthropic 提出，是一个专注于 Agent 与外部工具/资源交互 的标准协议。

核心设计理念:

- 📦 资源抽象: 将外部系统（数据库、API、文件系统）抽象为统一的 Resource
- 🔧 工具调用: 标准化的工具发现、调用和响应流程
- 🔌 传输无关: 支持 stdio、SSE、HTTP 等多种传输方式
- 🔐 权限控制: 内置的工具执行审批机制

协议版本: `2025-06-18` (来源: Codex `mcp-types/src/lib.rs`)

##### 2.2 Gemini CLI 的 MCP 实现架构

###### 核心组件:

```cobol
// packages/core/src/tools/mcp-client.ts

exportclass McpClient {

private client: Client; // MCP SDK Client

private transport: Transport; // 传输层 (stdio/SSE/HTTP)

private status: MCPServerStatus; // 连接状态

 

async connect(): Promise<void> {

 // 1. 建立传输连接

 this.transport = createTransport(this.serverConfig);

 

 // 2. 初始化 MCP Client

 this.client = new Client({

 name: 'gemini-cli',

 version: '0.10.0'

 }, {

 capabilities: {

 roots: { listChanged: true },

 sampling: {}

 }

 });

 

 // 3. 连接到 MCP Server

 awaitthis.client.connect(this.transport);

 }

 

async discover(): Promise<void> {

 // 发现工具

 const tools = awaitthis.client.listTools();

 

 // 发现资源

 const resources = awaitthis.client.listResources();

 

 // 发现 Prompts

 const prompts = awaitthis.client.listPrompts();

 }

}
```

###### 工具调用流程:

```cobol
// packages/core/src/tools/mcp-client.ts

exportclass McpClient {

private client: Client; // MCP SDK Client

private transport: Transport; // 传输层 (stdio/SSE/HTTP)

private status: MCPServerStatus; // 连接状态

 

async connect(): Promise<void> {

 // 1. 建立传输连接

 this.transport = createTransport(this.serverConfig);

 

 // 2. 初始化 MCP Client

 this.client = new Client({

 name: 'gemini-cli',

 version: '0.10.0'

 }, {

 capabilities: {

 roots: { listChanged: true },

 sampling: {}

 }

 });

 

 // 3. 连接到 MCP Server

 awaitthis.client.connect(this.transport);

 }

 

async discover(): Promise<void> {

 // 发现工具

 const tools = awaitthis.client.listTools();

 

 // 发现资源

 const resources = awaitthis.client.listResources();

 

 // 发现 Prompts

 const prompts = awaitthis.client.listPrompts();

 }

}
```

##### 2.3 Codex 的 MCP 实现架构

###### 核心组件 (基于 Rust):

```cobol
// codex-rs/core/src/mcp_connection_manager.rs

pubstruct McpConnectionManager {

 clients: HashMap<String, AsyncManagedClient>,

 elicitation_requests: ElicitationRequestManager,

 tool_timeout: Duration,

}

 

impl McpConnectionManager {

 pubasyncfn connect_server(

 &self,

 server_name: String,

 config: McpServerConfig

 ) -> Result<()> {

 // 1. 创建 RmcpClient (Rust MCP Client)

 let client = RmcpClient::new(

 Implementation {

 name: "codex".to_string(),

 version: env!("CARGO_PKG_VERSION").to_string(),

 },

 ClientCapabilities {

 roots: Some(RootsCapability { list_changed: true }),

 sampling: Some(SamplingCapability {}),

 },

 );

 

 // 2. 建立传输连接

 let transport = match &config.transport {

 StdioTransport => create_stdio_transport(config),

 SseTransport => create_sse_transport(config),

 };

 

 await client.connect(transport)?;

 

 // 3. 列举并限定工具

 let tools = client.list_tools().await?;

 let qualified_tools = self.qualify_tools(server_name, tools);

 

 Ok(())

 }

}
```

###### 工具名称限定 (Fully Qualified Names):

```cobol
// codex-rs/core/src/mcp_connection_manager.rs

const MCP_TOOL_NAME_DELIMITER: &str = "__";

const MAX_TOOL_NAME_LENGTH: usize = 64;

 

fn qualify_tools(tools: Vec<ToolInfo>) -> HashMap<String, ToolInfo> {

 letmut qualified_tools = HashMap::new();

 

 for tool in tools {

 // 格式: mcp__<server_name>__<tool_name>

 let qualified_name = format!(

 "mcp{}{}{}{}",

 MCP_TOOL_NAME_DELIMITER,

 tool.server_name,

 MCP_TOOL_NAME_DELIMITER,

 tool.tool_name

 );

 

 // 超长则使用 SHA1 截断

 if qualified_name.len() > MAX_TOOL_NAME_LENGTH {

 let hash = sha1::Sha1::digest(qualified_name.as_bytes());

 qualified_name = format!("{}_{:x}",

 &qualified_name[..48],

 hash

 );

 }

 

 qualified_tools.insert(qualified_name, tool);

 }

 

 qualified_tools

}
```

##### 2.4 MCP 协议消息示例

###### 工具列表请求:

```cobol
{

 "jsonrpc": "2.0",

 "id": 1,

 "method": "tools/list",

 "params": {}

}
```

###### 工具列表响应:

```cobol
{

 "jsonrpc": "2.0",

"id": 1,

"result": {

 "tools": [

 {

 "name": "read_file",

 "description": "Read contents of a file",

 "inputSchema": {

 "type": "object",

 "properties": {

 "path": { "type": "string" }

 },

 "required": ["path"]

 }

 }

 ]

 }

}
```

###### 工具调用请求:

```cobol
{

 "jsonrpc": "2.0",

 "id": 2,

 "method": "tools/call",

 "params": {

 "name": "read_file",

 "arguments": {

 "path": "/etc/hosts"

 }

 }

}
```

###### 工具调用响应:

```cobol
{

 "jsonrpc": "2.0",

"id": 2,

"result": {

 "content": [

 {

 "type": "text",

 "text": "127.0.0.1 localhost/n::1 localhost"

 }

 ],

 "isError": false

 }

}
```

**三、ACP (Agent Client Protocol) 官方标准深度解析**

##### 3.1 ACP 协议概述

ACP (Agent Client Protocol) 是由 Zed Industries 在 2025 年 8 月正式发布的开放标准，旨在标准化代码编辑器/IDE 与 AI 编码代理之间的通信。

> ❝
> 
> 📖 官方资源
> 
> - 官网：https://agentclientprotocol.com/
> - GitHub：https://github.com/agentclientprotocol/agent-client-protocol
> - TypeScript SDK： `@agentclientprotocol/sdk` (npm)
> - 协议版本：Version 1 (当前)

核心定位: ACP 类似于 LSP (Language Server Protocol) 在语言服务器领域的作用，解决了 Agent-Editor 集成的 N×M 问题：

核心设计理念:

- 📝 标准化通信: 基于 JSON-RPC 2.0，使用 stdio 传输
- 🔌 即插即用: 任何支持 ACP 的编辑器都能使用任何 ACP 代理
- 🎯 代理自主性: 代理作为编辑器的子进程运行，可自主修改代码
- 🔐 权限控制: 明确的权限请求机制（文件系统、终端等）
- 🔄 会话管理: 支持会话创建、加载、状态追踪
- 📊 能力协商: 初始化时协商双方支持的功能

##### 3.2 ACP 协议架构

###### 通信模型

ACP 遵循 JSON-RPC 2.0 规范，定义了两种消息类型：

| 消息类型 | 描述 | 是否需要响应 |
| --- | --- | --- |
| Methods | 请求-响应对，期望返回结果或错误 | ✅ 是 |
| Notifications | 单向消息，用于事件通知 | ❌ 否 |

###### 角色定义

```cobol
// Agent：使用生成式 AI 自主修改代码的程序

interface Agent {

// === 基线方法（必须实现） ===

 initialize(): InitializeResult; // 初始化和能力协商

 authenticate?(): AuthResult; // 身份验证（可选）

'session/new'(): SessionId; // 创建新会话

'session/prompt'(msg: Message): void; // 接收用户提示词

 

// === 可选方法 ===

'session/load'?(id: string): Session; // 加载已有会话

'session/set_mode'?(mode: string): void; // 设置模式（如 edit/chat）

 

// === 通知 ===

'session/cancel'(): void; // 取消当前操作

}

 

// Client：提供用户界面的代码编辑器/IDE

interface Client {

// === 基线方法（必须实现） ===

'session/request_permission'(req: PermissionRequest): PermissionResult;

 

// === 可选方法（根据能力） ===

'fs/read_text_file'?(path: string): string;

'fs/write_text_file'?(path: string, content: string): void;

'terminal/create'?(cmd: string): TerminalId;

'terminal/output'?(id: TerminalId): TerminalOutput;

 

// === 通知 ===

'session/update'(update: SessionUpdate): void; // 会话状态更新

}
```

##### 3.3 ACP 核心流程

###### 1\. 初始化流程

```cobol
// Client → Agent

{

"jsonrpc": "2.0",

"id": 0,

"method": "initialize",

"params": {

 "protocolVersion": 1,

 "clientCapabilities": {

 "fs": {

 "readTextFile": true,

 "writeTextFile": true

 },

 "terminal": true

 },

 "clientInfo": {

 "name": "vscode",

 "title": "Visual Studio Code",

 "version": "1.95.0"

 }

 }

}

 

// Agent → Client

{

"jsonrpc": "2.0",

"id": 0,

"result": {

 "protocolVersion": 1,

 "agentCapabilities": {

 "loadSession": true,

 "promptCapabilities": {

 "image": true,

 "audio": false,

 "embeddedContext": true

 },

 "mcp": {

 "http": true,

 "sse": false

 }

 },

 "agentInfo": {

 "name": "claude-agent",

 "title": "Claude Code Agent",

 "version": "1.0.0"

 },

 "authMethods": []

 }

}
```

关键要求:

- 🔢 协议版本协商: Client 提供支持的最新版本，Agent 响应选定版本
- 🎛️ 能力声明: 双方明确声明支持的功能（文件系统、终端、MCP 等）
- ⚙️ 向后兼容: 未声明的能力视为不支持

###### 2\. 会话管理流程

```cobol
// 创建新会话

{

"jsonrpc": "2.0",

"id": 1,

"method": "session/new",

"params": {

 "workspaceRoot": "/Users/pojian/code/project",

 "capabilities": {

 "edit": true,

 "execute": true

 }

 }

}

 

// 响应

{

"jsonrpc": "2.0",

"id": 1,

"result": {

 "sessionId": "sess_abc123",

 "state": "ready"

 }

}
```

###### 3\. 提示词交互流程

```cobol
// 创建新会话

{

"jsonrpc": "2.0",

"id": 1,

"method": "session/new",

"params": {

 "workspaceRoot": "/Users/pojian/code/project",

 "capabilities": {

 "edit": true,

 "execute": true

 }

 }

}

 

// 响应

{

"jsonrpc": "2.0",

"id": 1,

"result": {

 "sessionId": "sess_abc123",

 "state": "ready"

 }

}
```

##### 3.4 ACP 能力系统

###### Client 能力

| 能力域 | 能力 | 描述 | 关联方法 |
| --- | --- | --- | --- |
| 文件系统 | `fs.readTextFile` | 读取文本文件 | `fs/read_text_file` |
|  | `fs.writeTextFile` | 写入文本文件 | `fs/write_text_file` |
| 终端 | `terminal` | 执行和管理 Shell 命令 | `terminal/*` 全系列方法 |

###### Agent 能力

| 能力域 | 能力 | 描述 |
| --- | --- | --- |
| 会话 | `loadSession` | 支持加载已有会话 |
| 提示词 | `image` | 支持图像输入 |
|  | `audio` | 支持音频输入 |
|  | `embeddedContext` | 支持嵌入式上下文资源 |
| MCP | `http` | 支持 HTTP 传输的 MCP 服务器 |
|  | `sse` | 支持 SSE 传输的 MCP 服务器（已弃用） |

##### 3.5 ACP 协议约定

```cobol
// 关键约定

const ACP_CONVENTIONS = {

// 1. 路径要求

 filePaths: "MUST be absolute", // 所有文件路径必须是绝对路径

 

// 2. 行号约定

 lineNumbers: "1-based", // 行号从 1 开始

 

// 3. 文本格式

 textFormat: "Markdown", // 默认使用 Markdown 格式

 

// 4. 扩展机制

 customMethods: "prefix with underscore (_method_name)",

 customData: "use _meta field",

 

// 5. 错误处理

 errorHandling: "JSON-RPC 2.0 standard (code + message)"

};
```

**四、A2A (Agent-to-Agent) 深度剖析：Multi-Agent 系统的探索**

##### 4.0 A2A 概述与设计哲学

A2A (Agent-to-Agent Protocol) 是 Google Gemini CLI 团队提出的实验性协议，专注于解决 Multi-Agent 系统中的核心挑战：如何让不同的 Agent 无缝协作、状态同步和任务编排。

> ❝
> 
> 🎯 核心价值主张
> 
> 虽然 ACP 解决了 Editor ↔ Agent 的标准化，MCP 解决了 Agent ↔ Tools 的标准化，但 Agent ↔ Agent 的协作仍是空白地带。A2A 正是为填补这一空白而生。

###### A2A 的三大设计支柱

###### 为什么需要 A2A？

| 场景 | 传统方案的痛点 | A2A 的解决方案 |
| --- | --- | --- |
| Multi-Agent 协作 | 每个 Agent 使用私有 API，无法互操作 | 统一的 AgentCard + Task API |
| 长时间任务 | 同步调用易超时，状态无法追踪 | 异步 Task + 状态机管理 |
| 实时反馈 | 只能轮询或等待最终结果 | SSE 流式推送中间状态 |
| Agent 发现 | 硬编码 Agent 地址和能力 | AgentCard 动态发现和能力协商 |

##### 4.1 A2A 核心架构组件

###### 1\. AgentCard - Agent 身份与能力声明

```cobol
// packages/a2a-server/src/http/app.ts

const agentCard: AgentCard = {

 name: 'Gemini SDLC Agent',

 description: 'Code generation agent with streaming support',

 url: 'http://localhost:41242/',

 protocolVersion: '0.3.0',

 

 capabilities: {

 streaming: true, // 支持流式输出

 pushNotifications: false, // 不支持推送

 stateTransitionHistory: true// 支持状态历史

 },

 

 skills: [

 {

 id: 'code_generation',

 name: 'Code Generation',

 description: 'Generate code from natural language',

 tags: ['code', 'development'],

 inputModes: ['text'],

 outputModes: ['text'],

 examples: [

 'Write a Python function to calculate fibonacci',

 'Create a REST API with authentication'

 ]

 }

 ]

};
```

AgentCard 的关键字段解析:

| 字段 | 作用 | 示例值 |
| --- | --- | --- |
| `name` | Agent 的唯一标识符 | “Gemini SDLC Agent” |
| `url` | Agent 的 HTTP 端点 | “http://localhost:41242/” |
| `protocolVersion` | A2A 协议版本 | “0.3.0” |
| `capabilities.streaming` | 是否支持 SSE 流式输出 | `true` |
| `capabilities.stateTransitionHistory` | 是否保留状态历史 | `true` |
| `skills[]` | Agent 擅长的技能列表 | 代码生成、测试、重构等 |

###### 2\. 任务状态机 - 生命周期管理

```cobol
// 基于 @a2a-js/sdk 的 TaskState

type TaskState =

 | 'submitted' // 已提交

 | 'working' // 执行中

 | 'input-required'// 等待输入

 | 'completed' // 已完成

 | 'failed' // 失败

 | 'canceled'; // 取消

 

// 状态转换流程

submitted → working → input-required → working → completed

 ↓

 failed

 ↓

 canceled
```

状态转换详解:

```cobol
// packages/a2a-server/src/types.ts

interface TaskMetadata {

 id: string; // 任务唯一 ID

 contextId: string; // 所属会话 ID

 taskState: TaskState; // 当前状态

 model: string; // 使用的 LLM 模型

 mcpServers: MCPServerInfo[]; // 可用的 MCP 服务器列表

 availableTools: ToolInfo[]; // 可调用的工具列表

}

 

// 状态转换触发器

class Task {

 setTaskState(newState: TaskState) {

 const oldState = this.metadata.taskState;

 this.metadata.taskState = newState;

 

 // 记录状态历史（如果开启）

 if (this.capabilities.stateTransitionHistory) {

 this.stateHistory.push({

 from: oldState,

 to: newState,

 timestamp: Date.now(),

 reason: this.transitionReason

 });

 }

 

 // 触发状态变更事件

 this.eventBus.publish({

 kind: CoderAgentEvent.StateChangeEvent,

 taskId: this.id,

 oldState,

 newState,

 timestamp: Date.now()

 });

 }

}
```

关键状态说明:

| 状态 | 含义 | 典型持续时间 | 下一状态 |
| --- | --- | --- | --- |
| `submitted` | 任务已提交但未开始执行 | 0-50ms | `working` |
| `working` | LLM 正在生成响应或执行工具调用 | 数秒到数分钟 | `input-required` / `completed` / `failed` |
| `input-required` | 等待用户确认工具调用或提供额外输入 | 取决于用户 | `working` / `canceled` |
| `completed` | 任务成功完成 | 终态 | \- |
| `failed` | 任务执行失败 | 终态 | \- |
| `canceled` | 用户主动取消 | 终态 | \- |

###### 3\. EventBus - 事件驱动核心

A2A 的 EventBus 是整个系统的神经中枢，负责：

- 📡 解耦组件：Agent、Task、Tool 之间通过事件通信
- 🔄 流式传输：通过 SSE 实时推送事件到客户端
- 📊 状态追踪：所有状态变化都通过事件记录
```cobol
// packages/a2a-server/src/agent/executor.ts

 

// EventBus 事件类型定义

enum CoderAgentEvent {

 ToolCallConfirmationEvent = 'tool-call-confirmation', // 请求工具确认

 ToolCallUpdateEvent = 'tool-call-update', // 工具调用状态更新

 TextContentEvent = 'text-content', // LLM 生成的文本

 StateChangeEvent = 'state-change', // 任务状态变更

 ThoughtEvent = 'thought', // Agent 的思考过程

}

 

// EventBus 实现

class ExecutionEventBus {

private listeners = new Map<string, Set<EventListener>>();

private sseClients = new Set<SSEClient>();

 

// 发布事件

 publish(event: CoderAgentMessage) {

 // 1. 通知本地监听器

 const listeners = this.listeners.get(event.kind) || new Set();

 listeners.forEach(listener => listener(event));

 

 // 2. 通过 SSE 推送给客户端

 this.sseClients.forEach(client => {

 client.send({

 event: event.kind,

 data: JSON.stringify(event)

 });

 });

 

 // 3. 持久化到数据库（可选）

 if (this.persistenceEnabled) {

 this.saveEvent(event);

 }

 }

 

// 订阅事件

 subscribe(eventType: CoderAgentEvent, listener: EventListener) {

 if (!this.listeners.has(eventType)) {

 this.listeners.set(eventType, new Set());

 }

 this.listeners.get(eventType)!.add(listener);

 }

 

// 添加 SSE 客户端

 addSSEClient(client: SSEClient) {

 this.sseClients.add(client);

 

 // 发送历史事件（如果需要）

 if (client.wantsHistory) {

 this.replayEvents(client);

 }

 }

}
```

EventBus 流式工作流程:

###### 4\. 核心执行器 - 编排引擎

```cobol
// packages/a2a-server/src/agent/executor.ts

exportclass CoderAgentExecutor implements AgentExecutor {

async execute(requestContext: RequestContext, eventBus: ExecutionEventBus) {

 const { userMessage, task } = requestContext;

 

 // 1. 获取或创建任务

 let wrapper = this.tasks.get(taskId) || awaitthis.createTask(taskId);

 

 // 2. 设置状态为 working

 wrapper.task.setTaskState('working');

 eventBus.publish({

 kind: 'status-update',

 taskId,

 status: { state: 'working' },

 final: false

 });

 

 // 3. 调用 LLM

 const agentEvents = wrapper.task.geminiClient.sendMessageStream(

 userMessage.parts,

 abortSignal

 );

 

 // 4. 处理 Agent 响应

 forawait (const event of agentEvents) {

 if (event.type === 'tool_call_request') {

 // 调度工具执行

 await wrapper.task.scheduleToolCalls(event.toolCalls);

 } elseif (event.type === 'content') {

 // 发布文本内容

 eventBus.publish({

 kind: 'status-update',

 status: {

 state: 'working',

 message: { parts: [{ kind: 'text', text: event.content }] }

 }

 });

 }

 }

 

 // 5. 等待工具执行完成

 await wrapper.task.waitForPendingTools();

 

 // 6. 设置状态为 input-required

 wrapper.task.setTaskState('input-required');

 eventBus.publish({

 kind: 'status-update',

 status: { state: 'input-required' },

 final: true

 });

 }

}
```

执行器的核心职责:

1. **📝 任务生命周期管理：从 submitted 到终态的完整流程控制**
2. **🔄 流式响应处理：实时处理 LLM 的 streaming output**
3. **🛠️ 工具调度编排：管理并发的工具调用请求**
4. **📡 事件发布：将所有状态变化通过 EventBus 广播**
5. **💾 状态持久化：支持任务暂停和恢复**

###### 5\. Tool Scheduling - 工具调度机制

A2A 的工具调度是其核心能力之一，支持：

- ⚡ 并发执行：多个工具可以并行调用
- 🔄 依赖管理：自动处理工具间的依赖关系
- ⏸️ 暂停/恢复：可以中断工具执行并稍后恢复
```cobol
// packages/a2a-server/src/agent/task.ts

 

class Task {

private pendingTools = new Map<string, ToolExecution>();

private toolQueue: ToolCall[] = [];

 

async scheduleToolCalls(toolCalls: ToolCall[]) {

 for (const toolCall of toolCalls) {

 const execution: ToolExecution = {

 id: toolCall.id,

 toolName: toolCall.name,

 args: toolCall.arguments,

 status: 'pending',

 startTime: null,

 endTime: null,

 result: null

 };

 

 this.pendingTools.set(toolCall.id, execution);

 

 // 检查是否需要用户确认

 if (this.shouldConfirmTool(toolCall.name)) {

 this.eventBus.publish({

 kind: CoderAgentEvent.ToolCallConfirmationEvent,

 taskId: this.id,

 toolCall: {

 id: toolCall.id,

 name: toolCall.name,

 arguments: toolCall.arguments,

 description: this.getToolDescription(toolCall.name)

 }

 });

 execution.status = 'awaiting_confirmation';

 } else {

 // 自动批准，立即执行

 this.executeToolCall(toolCall);

 }

 }

 }

 

async executeToolCall(toolCall: ToolCall) {

 const execution = this.pendingTools.get(toolCall.id)!;

 execution.status = 'running';

 execution.startTime = Date.now();

 

 // 发布开始事件

 this.eventBus.publish({

 kind: CoderAgentEvent.ToolCallUpdateEvent,

 taskId: this.id,

 toolCallId: toolCall.id,

 status: 'running'

 });

 

 try {

 // 调用 MCP 工具

 const result = awaitthis.mcpClient.callTool(

 toolCall.name,

 toolCall.arguments

 );

 

 execution.status = 'completed';

 execution.result = result;

 execution.endTime = Date.now();

 

 // 发布完成事件

 this.eventBus.publish({

 kind: CoderAgentEvent.ToolCallUpdateEvent,

 taskId: this.id,

 toolCallId: toolCall.id,

 status: 'completed',

 result: result,

 duration: execution.endTime - execution.startTime

 });

 

 // 从 pending 移除

 this.pendingTools.delete(toolCall.id);

 

 } catch (error) {

 execution.status = 'failed';

 execution.error = error.message;

 execution.endTime = Date.now();

 

 this.eventBus.publish({

 kind: CoderAgentEvent.ToolCallUpdateEvent,

 taskId: this.id,

 toolCallId: toolCall.id,

 status: 'failed',

 error: error.message

 });

 

 this.pendingTools.delete(toolCall.id);

 }

 }

 

// 等待所有待处理的工具完成

async waitForPendingTools(): Promise<void> {

 while (this.pendingTools.size > 0) {

 awaitnewPromise(resolve => setTimeout(resolve, 100));

 }

 }

}
```

工具调度流程图:

##### 4.2 A2A 与 MCP 的深度集成

A2A 并非孤立协议，它巧妙地将 MCP 整合为底层工具层，形成两层协议栈：

集成实现细节:

```cobol
// packages/a2a-server/src/agent/task.ts

 

class Task {

private mcpClients = new Map<string, McpClient>();

 

async initializeMCPServers(serverConfigs: MCPServerConfig[]) {

 for (const config of serverConfigs) {

 const client = new McpClient(config);

 

 // 连接到 MCP Server

 await client.connect();

 

 // 获取工具列表

 const tools = await client.listTools();

 

 // 注册到任务的可用工具

 for (const tool of tools) {

 const qualifiedName = \`mcp__${config.name}__${tool.name}\`;

 this.availableTools.set(qualifiedName, {

 originalName: tool.name,

 serverName: config.name,

 description: tool.description,

 parameterSchema: tool.inputSchema,

 mcpClient: client

 });

 }

 

 this.mcpClients.set(config.name, client);

 }

 

 // 通知 LLM 可用的工具列表（通过 Gemini Function Calling）

 this.geminiClient.updateTools(

 Array.from(this.availableTools.values()).map(tool => ({

 name: tool.originalName, // Gemini 看到的是原始名称

 description: tool.description,

 parameters: tool.parameterSchema

 }))

 );

 }

 

async callTool(toolName: string, args: any): Promise<any> {

 // 从qualified name 解析 server 和 tool

 const [_, serverName, originalToolName] = toolName.split('__');

 

 const toolInfo = this.availableTools.get(toolName);

 if (!toolInfo) {

 thrownewError(\`Tool ${toolName} not found\`);

 }

 

 // 调用 MCP Server

 const result = await toolInfo.mcpClient.callTool(

 originalToolName,

 args

 );

 

 return result;

 }

}
```

工具名称转换策略:

| 层级 | 工具名称 | 说明 |
| --- | --- | --- |
| MCP Server | `read_file` | MCP 原生工具名 |
| A2A 内部存储 | `mcp__filesystem__read_file` | 带命名空间的限定名 |
| Gemini LLM | `read_file` | LLM 看到的简化名（通过 description 区分） |
| 用户界面 | “读取文件 (filesystem)” | 用户友好的显示名 |

##### 4.3 A2A 实战案例：Multi-Agent 协作系统

###### 场景：AI 驱动的全栈应用开发

假设我们要开发一个包含前端、后端、数据库的完整应用。传统方式是单个 Agent 完成所有工作，但使用 A2A 可以让专业 Agent 协作：

```typescript
import { createAgent, AgentOrchestrator } from'@a2a-js/sdk';

 

// 1. 定义专业 Agent 团队

const agents = {

// 前端专家

 frontendAgent: await createAgent({

 name: 'Frontend Specialist',

 agentUrl: 'http://localhost:8001/api',

 skills: ['react', 'typescript', 'css', 'ui-design']

 }),

 

// 后端专家

 backendAgent: await createAgent({

 name: 'Backend Specialist',

 agentUrl: 'http://localhost:8002/api',

 skills: ['nodejs', 'express', 'api-design', 'authentication']

 }),

 

// 数据库专家

 databaseAgent: await createAgent({

 name: 'Database Specialist',

 agentUrl: 'http://localhost:8003/api',

 skills: ['postgresql', 'schema-design', 'migrations', 'optimization']

 }),

 

// 测试专家

 testAgent: await createAgent({

 name: 'QA Specialist',

 agentUrl: 'http://localhost:8004/api',

 skills: ['jest', 'e2e-testing', 'test-strategy']

 })

};

 

// 2. 创建编排器

const orchestrator = new AgentOrchestrator(agents);

 

// 3. 定义工作流

const workflow = orchestrator.defineWorkflow({

 name: 'Build E-Commerce App',

 

 steps: [

 {

 id: 'design-schema',

 agent: 'databaseAgent',

 task: '设计电商应用的数据库 schema，包括用户、产品、订单表',

 dependencies: []

 },

 {

 id: 'create-migrations',

 agent: 'databaseAgent',

 task: '创建数据库迁移文件',

 dependencies: ['design-schema']

 },

 {

 id: 'build-api',

 agent: 'backendAgent',

 task: '基于数据库 schema 构建 REST API，包括 CRUD 和认证',

 dependencies: ['design-schema'],

 inputs: {

 schema: '{{ steps.design-schema.result.schema }}'

 }

 },

 {

 id: 'build-frontend',

 agent: 'frontendAgent',

 task: '构建 React 前端，连接到 API',

 dependencies: ['build-api'],

 inputs: {

 apiSpec: '{{ steps.build-api.result.openapi }}'

 }

 },

 {

 id: 'write-tests',

 agent: 'testAgent',

 task: '编写端到端测试',

 dependencies: ['build-frontend', 'build-api']

 }

 ]

});

 

// 4. 执行工作流（支持流式监控）

const execution = await orchestrator.execute(workflow);

 

// 5. 订阅事件，实时监控进度

execution.on('step-started', ({ stepId, agent }) => {

console.log(\`✨ ${agent} 开始工作: ${stepId}\`);

});

 

execution.on('step-progress', ({ stepId, progress }) => {

console.log(\`⏳ ${stepId}: ${progress.message}\`);

});

 

execution.on('step-completed', ({ stepId, result, duration }) => {

console.log(\`✅ ${stepId} 完成 (耗时: ${duration}ms)\`);

console.log(\` 输出: ${result.summary}\`);

});

 

execution.on('error', ({ stepId, error }) => {

console.error(\`❌ ${stepId} 失败: ${error.message}\`);

});

 

// 等待完成

const finalResult = await execution.complete();

 

console.log('🎉 全栈应用开发完成！');

console.log(\`总耗时: ${finalResult.totalDuration}ms\`);

console.log(\`创建的文件数: ${finalResult.filesCreated}\`);
```

##### 4.4 A2A 的核心优势

与其他协议相比，A2A 在以下方面具有独特优势：

| 优势 | 具体表现 | 对比 ACP/MCP |
| --- | --- | --- |
| 🔄 真正的流式体验 | 通过 SSE 实时推送 LLM 生成的每个 token | ACP 也支持流式，MCP 不支持 |
| 📊 完整状态管理 | 6 种状态 + 状态转换历史 | ACP 有会话状态，MCP 无状态 |
| 🔌 Multi-Agent 支持 | 原生支持 Agent 发现和协作 | ACP 专注 Editor-Agent，MCP 无此概念 |
| 🛠️ MCP 集成 | 无缝复用整个 MCP 生态的工具 | ACP 也支持 MCP，但未深度集成 |
| ⚡ 并发工具调用 | 可同时执行多个工具，大幅提升效率 | MCP 也支持，但需要自行实现并发控制 |
| 💾 任务持久化 | 支持暂停任务，稍后从断点恢复 | ACP 支持 session 加载，MCP 无此能力 |
| 🎯 事件驱动架构 | EventBus 解耦组件，易于扩展 | ACP 使用通知，但没有统一 EventBus |

A2A 的适用场景:

✅ 推荐使用 A2A:

- 需要多个 Agent 协作完成复杂任务
- 任务执行时间较长（>30秒），需要中间状态反馈
- 需要支持任务暂停和恢复
- 需要完整的审计日志和状态历史
- 希望复用 MCP 生态的工具

❌ 不推荐使用 A2A:

- 简单的单 Agent 场景（用 ACP 更轻量）
- 对性能要求极高的场景（Rust 实现的 Codex 更快）
- 只需要工具调用，不需要 Agent 协作（直接用 MCP）
- 低延迟要求（<100ms）的实时场景

---

##### 4.5 Codex 的 SQ/EQ 协议设计

> ❝
> 
> ⚠️ 注意: Codex 的实现与 ACP 官方标准也不同，采用了独特的 SQ/EQ (Submission Queue / Event Queue) 模式。

Codex 的协议设计：

```cobol
// codex-rs/protocol/src/protocol.rs

 

/// Submission Queue - 用户提交的操作

#[derive(Debug, Clone, Serialize, Deserialize)]

pubstruct Submission {

 pub id: String,

 pub op: Op,

}

 

#[derive(Debug, Clone, Serialize, Deserialize)]

#[serde(tag = "type", rename_all = "snake_case")]

pubenum Op {

 /// 用户输入

 UserTurn {

 items: Vec<UserInput>,

 cwd: PathBuf,

 approval_policy: AskForApproval,

 sandbox_policy: SandboxPolicy,

 model: String,

 },

 

 /// 中断当前任务

 Interrupt,

 

 /// 批准工具执行

 ExecApproval {

 id: String,

 decision: ReviewDecision,

 },

 

 /// 批准代码补丁

 PatchApproval {

 id: String,

 decision: ReviewDecision,

 },

 

 /// 解决 MCP 授权请求

 ResolveElicitation {

 server_name: String,

 request_id: RequestId,

 decision: ElicitationAction,

 },

}

 

/// Event Queue - Agent 发出的事件

#[derive(Debug, Clone, Serialize, Deserialize)]

pubstruct Event {

 pub id: String,

 pub msg: EventMsg,

}

 

#[derive(Debug, Clone, Serialize, Deserialize)]

#[serde(tag = "type", rename_all = "snake_case")]

pubenum EventMsg {

 /// Agent 消息

 AgentMessage(AgentMessageEvent),

 

 /// 工具调用请求

 ToolCall(ToolCallEvent),

 

 /// 需要批准执行

 ExecApprovalRequest(ExecApprovalRequestEvent),

 

 /// 需要批准补丁

 ApplyPatchApprovalRequest(ApplyPatchApprovalRequestEvent),

 

 /// Turn 完成

 TurnComplete(TurnCompleteEvent),

 

 /// Turn 中止

 TurnAborted(TurnAbortedEvent),

}
```

##### 4.3 协议关系梳理：ACP vs A2A vs Codex

为避免混淆，这里明确三者的定位和关系：

| 协议/实现 | 定位 | 标准化状态 | 主要用途 | 实现方 |
| --- | --- | --- | --- | --- |
| ACP (Agent Client Protocol) | 官方标准协议 | ✅ 开放标准 | Editor ↔ Agent 通信 | Zed Industries (2025-08) |
| A2A (Agent-to-Agent) | 实验性实现 | 🔬 非标准 | Agent ↔ Agent 协作 | Google Gemini CLI |
| Codex SQ/EQ | 实验性实现 | 🔬 非标准 | User ↔ Agent 交互 | OpenAI/社区 |

###### 关键区别

为什么会有这种现象？

1. **ACP 发布时间线：ACP 在 2025 年 8 月才正式发布，而 Gemini CLI 和 Codex 的开发更早，当时还没有统一标准**
2. **不同的关注点：**
- ACP 关注 编辑器集成（类似 LSP）
- A2A 关注 Agent 编排（Multi-Agent 系统）
- Codex SQ/EQ 关注 用户体验（审批流程和安全）
3. **演进方向：预计未来这些实现可能会向 ACP 标准靠拢或互补**

对开发者的建议：

- ✅ 如果开发编辑器插件，优先使用 ACP 官方标准
- 🔬 如果研究 Multi-Agent 系统，可以参考 A2A 的设计思路
- 🔐 如果注重安全审批，可以借鉴 Codex 的 Approval 机制

---

**五、核心差异对比：ACP vs MCP vs 各家实现**

##### 5.1 协议定位对比

##### 5.2 详细对比表

| 维度 | MCP | ACP (官方) | A2A (Gemini) | Codex SQ/EQ |
| --- | --- | --- | --- | --- |
| 协议目标 | Agent ↔ 工具/资源 | Editor ↔ Agent | Agent ↔ Agent | 用户 ↔ Agent |
| 发布方 | Anthropic | Zed Industries | Google | OpenAI (社区) |
| 协议版本 | 2025-06-18 | Version 1 (2025-08) | 0.3.0 | v0.2.0-alpha |
| 通信模式 | Request/Response | Request/Response + Notifications | Event-Driven (SSE) | Queue-Based |
| 状态管理 | 无状态 | 有状态 (会话) | 有状态 (任务) | 有状态 (会话) |
| 传输方式 | stdio, SSE, HTTP | stdio (JSON-RPC) | HTTP + SSE | In-Process Channels |
| 权限模型 | Elicitation | Permission Request | Confirmation | Approval |
| 流式支持 | ❌ 不支持 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| 语言绑定 | TS, Rust, Python | TS, Go, Rust, Python | TypeScript | Rust + TS SDK |
| 标准化程度 | ✅ 官方标准 | ✅ 官方标准 | 🔬 实验性实现 | 🔬 实验性实现 |

**六、实际应用场景**

##### 6.1 MCP 典型场景

###### 场景 1: 统一的开发工具接入

```perl
// 配置文件: ~/.gemini/settings.json

{

"mcpServers": {

 "github": {

 "command": "npx",

 "args": ["-y", "@modelcontextprotocol/server-github"],

 "env": {

 "GITHUB_TOKEN": "${GITHUB_TOKEN}"

 }

 },

 "postgres": {

 "command": "uvx",

 "args": ["mcp-server-postgres"],

 "env": {

 "DATABASE_URL": "postgresql://..."

 }

 },

 "filesystem": {

 "command": "npx",

 "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]

 }

 }

}
```

使用:

```cobol
$ gemini

> @github List my open pull requests

> @postgres Run query: SELECT * FROM users WHERE active = true

> @filesystem Read file package.json
```

###### 场景 2: 企业内部工具集成

```php
// 自定义 MCP Server

import { Server } from'@modelcontextprotocol/sdk/server';

 

const server = new Server({

 name: 'company-internal-tools',

 version: '1.0.0'

});

 

server.setRequestHandler(ListToolsRequestSchema, async () => ({

 tools: [

 {

 name: 'query_jira',

 description: 'Query JIRA tickets',

 inputSchema: {

 type: 'object',

 properties: {

 jql: { type: 'string' }

 }

 }

 },

 {

 name: 'deploy_to_k8s',

 description: 'Deploy application to Kubernetes',

 inputSchema: {

 type: 'object',

 properties: {

 namespace: { type: 'string' },

 image: { type: 'string' }

 }

 }

 }

 ]

}));
```

##### 6.2 ACP 典型场景（官方标准）

###### 场景 1: Multi-Agent 协作工作流

```typescript
import { createAgent } from'@a2a-js/sdk';

 

// Agent 1: 代码生成专家

const codeGenAgent = await createAgent({

 agentUrl: 'http://gemini-a2a:41242'

});

 

// Agent 2: 代码审查专家

const codeReviewAgent = await createAgent({

 agentUrl: 'http://claude-a2a:3000'

});

 

// 工作流编排

asyncfunction developFeature(requirement: string) {

// Step 1: 生成代码

const codeTask = await codeGenAgent.createTask({

 message: {

 parts: [{ kind: 'text', text: \`实现功能: ${requirement}\` }]

 }

 });

 

const code = await codeTask.waitForCompletion();

 

// Step 2: 审查代码

const reviewTask = await codeReviewAgent.createTask({

 message: {

 parts: [{

 kind: 'text',

 text: \`审查以下代码并提供改进建议:/n${code}\`

 }]

 }

 });

 

const review = await reviewTask.waitForCompletion();

 

// Step 3: 根据审查意见改进

const improvedCodeTask = await codeGenAgent.createTask({

 message: {

 parts: [{

 kind: 'text',

 text: \`根据审查意见改进代码:/n审查意见: ${review}/n原代码: ${code}\`

 }]

 }

 });

 

returnawait improvedCodeTask.waitForCompletion();

}
```

###### 场景 2: Agent 服务化部署

```cobol
// 将 Gemini CLI 部署为 A2A 服务

import { A2AExpressApp } from'@a2a-js/sdk/server/express';

import express from'express';

 

const app = express();

const a2aApp = new A2AExpressApp(requestHandler);

 

'/api'

app.listen(41242, () => {

console.log('Gemini A2A Server running on http://localhost:41242');

});

 

// 现在其他 Agent 可以调用

const geminiAgent = await createAgent({

 agentUrl: 'http://localhost:41242/api'

});
```

##### 6.3 Codex SQ/EQ 典型场景

###### 场景 1: 细粒度的审批控制

```cobol
// 将 Gemini CLI 部署为 A2A 服务

import { A2AExpressApp } from'@a2a-js/sdk/server/express';

import express from'express';

 

const app = express();

const a2aApp = new A2AExpressApp(requestHandler);

 

'/api'

app.listen(41242, () => {

console.log('Gemini A2A Server running on http://localhost:41242');

});

 

// 现在其他 Agent 可以调用

const geminiAgent = await createAgent({

 agentUrl: 'http://localhost:41242/api'

});
```

###### 场景 2: 会话恢复

```cobol
// 保存会话状态

let conversation_id = ConversationId::new();

conversation_manager.save_state(conversation_id, &state).await?;

 

// 稍后恢复

let restored_state = conversation_manager.load_state(conversation_id).await?;

let conversation = CodexConversation::from_state(restored_state)?;
```

---

**七、技术挑战与解决方案**

##### 7.1 工具命名冲突

问题: 多个 MCP Server 可能提供同名工具

Gemini CLI 解决方案:

```cobol
// 使用 server_name 作为 namespace

const toolName = \`${serverName}.${originalToolName}\`;

// 例如: "github.create_issue", "gitlab.create_issue"
```

Codex 解决方案:

```cobol
// 使用双下划线分隔符 + SHA1 截断

const DELIMITER = "__";

let qualified_name = format!(

 "mcp{}{}{}{}",

 DELIMITER, server_name, DELIMITER, tool_name

);

 

if qualified_name.len() > 64 {

 let hash = sha1::Sha1::digest(qualified_name);

 qualified_name = format!("{}_{:x}", &qualified_name[..48], hash);

}

// 例如: "mcp__github__create_issue"
```

##### 7.2 流式输出的挑战

问题: LLM 生成是流式的，但工具调用是同步的

A2A 解决方案:

```php
// 使用 EventBus 解耦

for await (const chunk of llmStream) {

 eventBus.publish({

 kind: 'status-update',

 status: {

 message: { parts: [{ kind: 'text', text: chunk }] }

 },

 final: false // 非最终状态，继续接收

 });

}
```

Codex 解决方案:

```cobol
// 使用 AsyncIterator

pubfn send_message_stream(

 &self,

 items: Vec<UserInput>

) -> impl Stream<Item = Result<Event>> {

 async_stream::stream! {

 let response = self.llm_client.chat(items).await?;

 forawait chunk in response.stream {

 yieldOk(Event {

 msg: EventMsg::AgentMessage(chunk)

 });

 }

 }

}
```

##### 7.3 安全性和沙箱

Codex 的多层沙箱方案:

```cobol
// 1. Execpolicy - 命令级别的策略

pubstruct ExecPolicy {

 auto_approve: Vec<String>, // 自动批准的命令

 always_deny: Vec<String>, // 始终拒绝的命令

 require_confirm: Vec<String>, // 需要确认的命令

}

 

// 2. Platform Sandbox - 操作系统级别的隔离

#[cfg(target_os = "macos")]

fn apply_seatbelt_sandbox(cmd: &str) -> Result<()> {

 let profile = "(version 1) (deny default) (allow network*) (allow file-read* /usr/bin)";

 sandbox_exec(cmd, profile)

}

 

#[cfg(target_os = "linux")]

fn apply_landlock_sandbox(cmd: &str) -> Result<()> {

 landlock::Ruleset::new()

 .allow_read("/usr/bin")

 .allow_execute("/usr/bin")

 .restrict_self()?;

 execute(cmd)

}

 

// 3. Network Isolation

if sandbox_policy == SandboxPolicy::Strict {

 env::set_var("CODEX_SANDBOX_NETWORK_DISABLED", "1");

}
```

**八、性能对比**

##### 8.1 连接建立时间

| 实现 | 传输方式 | 平均耗时 | 备注 |
| --- | --- | --- | --- |
| Gemini MCP (TypeScript) | stdio | ~150ms | Node.js 子进程启动 |
| Gemini MCP (TypeScript) | SSE | ~80ms | HTTP 连接 |
| Codex MCP (Rust) | stdio | ~50ms | 原生进程启动 |
| Codex MCP (Rust) | SSE | ~40ms | Tokio HTTP Client |

##### 8.2 工具调用延迟

| 场景 | Gemini CLI | Codex CLI |
| --- | --- | --- |
| 简单工具 (read\_file) | ~100ms | ~30ms |
| 复杂工具 (database query) | ~500ms | ~200ms |
| 批量工具调用 (10个) | ~1.5s | ~600ms |

性能差异原因:

- Rust 的零成本抽象和编译优化
- Tokio 异步运行时的高效调度
- 无 GC (Garbage Collection) 的确定性延迟

##### 8.3 内存占用

| 实现 | 空闲内存 | 单会话内存 | 10会话内存 |
| --- | --- | --- | --- |
| Gemini CLI (Node.js) | ~80MB | ~150MB | ~500MB |
| Codex CLI (Rust) | ~5MB | ~15MB | ~80MB |

---

**九、未来发展方向**

##### 9.1 协议融合趋势

##### 9.2 关键演进方向

###### 1\. 标准化组织推动

```
# 可能的标准化路径

-W3CWebAgentWorkingGroup

-定义Web-nativeAgentProtocol

-浏览器原生支持Agent通信

 

-IETFRFC提案

-AgentCommunicationProtocol(ACP)RFC

-类似HTTP/2,gRPC的标准化进程

 

-LinuxFoundationAI&Data

-MCPFoundation(类似CNCF)

-开源参考实现和认证体系
```

###### 2\. 性能优化

```cobol
// 使用 gRPC 替代 JSON-RPC

service AgentService {

 rpc ExecuteTask(TaskRequest) returns (stream TaskEvent);

 rpc CallTool(ToolCallRequest) returns (ToolCallResponse);

}

 

// 使用 Protocol Buffers 替代 JSON

message TaskEvent {

 string task_id = 1;

 TaskState state = 2;

 oneof payload {

 AgentMessage message = 3;

 ToolCall tool_call = 4;

 }

}

 

// 性能提升预期

// - 序列化速度: 5-10x

// - 传输体积: 30-50% 减少

// - 类型安全: 编译时检查
```

###### 3\. 安全性增强

```
# Zero Trust Agent Network

-端到端加密(E2EE)

-Agent间通信默认加密

-密钥轮换机制

 

-细粒度访问控制(FGAC)

-基于RBAC的工具权限

-基于ABAC的资源访问

 

-审计与合规

-完整的调用链追踪

-符合SOC2/ISO27001

 

-沙箱增强

-WebAssembly(WASI)沙箱

-容器级别隔离(Firecracker)
```

###### 4\. 可观测性

```cobol
// OpenTelemetry 集成

import { trace, context } from'@opentelemetry/api';

 

class InstrumentedAgent {

async executeTask(task: Task) {

 const span = trace.getTracer('agent').startSpan('execute_task', {

 attributes: {

 'task.id': task.id,

 'agent.name': this.name,

 'agent.version': this.version

 }

 });

 

 try {

 const result = awaitthis.executor.execute(task);

 span.setStatus({ code: SpanStatusCode.OK });

 return result;

 } catch (error) {

 span.recordException(error);

 span.setStatus({ code: SpanStatusCode.ERROR });

 throw error;

 } finally {

 span.end();

 }

 }

}

 

// 分布式追踪

001

 → MCP Tool 1 (trace_id: abc123, span_id: 002)

003

 → MCP Tool 2 (trace_id: abc123, span_id: 004)
```

##### 9.3 应用场景展望

###### 场景 1: 企业级 AI Mesh

```
# Agent 服务网格

apiVersion:v1

kind:AgentMesh

metadata:

name:company-ai-mesh

spec:

agents:

 -name:code-gen-agent

 provider:gemini

 replicas:3

 tools:

 -github

 -gitlab

 -jira

 

 -name:code-review-agent

 provider:claude

 replicas:2

 tools:

 -sonarqube

 -codecov

 

 -name:security-scan-agent

 provider:codex

 replicas:1

 tools:

 -snyk

 -trivy

 

routing:

 -match:code_generation

 route:code-gen-agent

 -match:code_review

 route:code-review-agent

 -match:security_scan

 route:security-scan-agent
```

###### 场景 2: Personal AI Assistant Ecosystem

```php
// 个人 AI 助手编排

const personalAI = new AgentOrchestrator({

 agents: {

 calendar: await createAgent({ url: 'http://calendar-agent:8080' }),

 email: await createAgent({ url: 'http://email-agent:8081' }),

 task: await createAgent({ url: 'http://task-agent:8082' }),

 research: await createAgent({ url: 'http://research-agent:8083' })

 }

});

 

// 复杂任务编排

await personalAI.execute({

 task: "准备下周的产品发布会",

 steps: [

 {

 agent: 'calendar',

 action: '检查下周日程并预定会议室'

 },

 {

 agent: 'task',

 action: '创建发布会任务清单'

 },

 {

 agent: 'research',

 action: '调研竞品最新动态',

 depends_on: ['task']

 },

 {

 agent: 'email',

 action: '发送会议邀请给相关人员',

 depends_on: ['calendar', 'research']

 }

 ]

});
```

---

**十、给开发者的建议**

##### 10.1 选择 MCP 还是 ACP？

| 如果你需要… | 推荐协议 | 理由 |
| --- | --- | --- |
| 为 Agent 添加外部工具能力 | MCP | 成熟的工具发现和调用机制 |
| 构建多 Agent 协作系统 | ACP/A2A | 原生的 Agent 间通信支持 |
| 企业级合规和审计 | Codex SQ/EQ | 完整的审批流程和状态追踪 |
| 快速原型开发 | MCP | 丰富的社区工具和示例 |
| 高性能生产环境 | Codex (Rust) | 低延迟、低内存占用 |

##### 10.2 最佳实践

###### 1\. MCP Server 开发

```php
// ✅ 好的实践

import { Server } from'@modelcontextprotocol/sdk/server';

 

const server = new Server({

 name: 'my-tool-server',

 version: '1.0.0'

});

 

// 提供详细的工具描述

server.setRequestHandler(ListToolsRequestSchema, async () => ({

 tools: [{

 name: 'search_documents',

 description: '在文档库中搜索相关内容。支持全文搜索和语义搜索。',

 inputSchema: {

 type: 'object',

 properties: {

 query: {

 type: 'string',

 description: '搜索关键词或自然语言问题'

 },

 mode: {

 type: 'string',

 enum: ['fulltext', 'semantic'],

 default: 'semantic',

 description: '搜索模式'

 }

 },

 required: ['query']

 }

 }]

}));

 

// ❌ 不好的实践

const badTools = [{

 name: 'search', // 名称过于泛化

 description: '搜索', // 描述不清晰

 inputSchema: {

 type: 'object',

 properties: {

 q: { type: 'string' } // 参数名不明确

 }

 }

}];
```

###### 2\. Agent 安全设计

```
// ✅ 好的实践: 最小权限原则

const agentConfig = {

 mcpServers: {

 filesystem: {

 command: 'npx',

 args: ['-y', '@mcp/server-filesystem', '/workspace/project'],

 // 仅允许访问项目目录

 env: {

 ALLOWED_PATHS: '/workspace/project'

 }

 }

 },

 execPolicy: {

 autoApprove: [

 'npm install',

 'git status',

 'git diff'

 ],

 alwaysDeny: [

 'rm -rf /',

 'sudo *',

 'chmod 777 *'

 ]

 }

};

 

// ❌ 不好的实践: 过度权限

const badConfig = {

 mcpServers: {

 filesystem: {

 args: ['/'], // 允许访问整个文件系统

 }

 },

 execPolicy: {

 autoApprove: ['*'] // 自动批准所有命令

 }

};
```

###### 3\. 错误处理和重试

```cobol
// ✅ 好的实践: 指数退避重试

asyncfunction callToolWithRetry(

 tool: string,

 params: any,

 maxRetries = 3

): Promise<any> {

for (let attempt = 0; attempt < maxRetries; attempt++) {

 try {

 returnawait mcpClient.callTool(tool, params);

 } catch (error) {

 if (attempt === maxRetries - 1) throw error;

 

 if (isRetryable(error)) {

 const backoff = Math.pow(2, attempt) * 1000;

 await sleep(backoff);

 continue;

 }

 

 throw error;

 }

 }

}

 

function isRetryable(error: Error): boolean {

// 网络错误、超时等可重试

return error.message.includes('ETIMEDOUT') ||

 error.message.includes('ECONNREFUSED');

}
```

---

**十一、总结**

##### 11.1 核心洞察

1. **MCP 专注于 Agent ↔ 工具/资源 的标准化，由 Anthropic 主导**
2. **ACP 是 Editor ↔ Agent 的官方标准，由 Zed Industries 发布，类似于 LSP 在语言服务器领域的作用**
3. **A2A (Gemini 实现) 专注于 Agent ↔ Agent 的互操作，是构建 Multi-Agent 系统的探索**
4. **Codex SQ/EQ 提供了一个完整的 用户 ↔ Agent 交互模型，强调安全性和可控性**

##### 11.2 给未来的思考

> ❝
> 
> —— 未来的 AI 不仅仅是更智能的模型，而是模型之间更智能的协作。

协议标准化是 AI Agent 从 工具 向 基础设施 演进的关键一步。就像 HTTP 成就了互联网，Docker 成就了云原生，MCP 和 ACP 正在成就 AI Agent 的生态系统。

\## 最后

近期科技圈传来重磅消息：行业巨头英特尔宣布大规模裁员2万人，传统技术岗位持续萎缩的同时，另一番景象却在AI领域上演—— **AI相关技术岗正开启“疯狂扩招”模式** ！据行业招聘数据显示，具备3-5年大模型相关经验的开发者，在大厂就能拿到 **50K×20薪** 的高薪待遇，薪资差距肉眼可见！

![图片](https://i-blog.csdnimg.cn/img_convert/26a94ff0e9b41a3c8483c5f921a65983.jpeg)

**业内资深HR预判：不出1年，“具备AI项目实战经验”将正式成为技术岗投递的硬性门槛** 。在行业迭代加速的当下，“温水煮青蛙”式的等待只会让自己逐渐被淘汰，与其被动应对，不如主动出击，抢先掌握 **AI大模型核心原理+落地应用技术+项目实操经验** ，借行业风口实现职业翻盘！

深知技术人入门大模型时容易走弯路，我特意整理了一套 **全网最全最细的大模型零基础学习礼包** ，涵盖入门思维导图、经典书籍手册、从入门到进阶的实战视频、可直接运行的项目源码等核心内容。这份资料无需付费，免费分享给所有想入局AI大模型的朋友！

👇👇扫码免费领取全部内容👇👇

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/ec83a7fcb6b94243bcab543290fb6bd9.png)

### 部分资料展示

##### 1、 AI大模型学习路线图

![img](https://i-blog.csdnimg.cn/direct/b3e31603ac324ad98ad7db90e2c1a3f4.jpeg#pic_center)

##### 2、 全套AI大模型应用开发视频教程

从入门到进阶这里都有，跟着老师学习事半功倍。

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3ed38b8d2083413e9d4345a0419824df.png)

##### 3、 大模型学习书籍&文档

##### 4、 AI大模型最新行业报告

2025最新行业报告，针对 **不同行业的现状、趋势、问题、机会** 等进行系统地调研和评估，以了解哪些行业更适合引入大模型的技术和应用，以及在哪些方面可以发挥大模型的优势。

![img](https://i-blog.csdnimg.cn/img_convert/321829d5cb17558fa20823004e2878bb.gif)

##### 5、大模型大厂面试真题

整理了百度、阿里、字节等企业近三年的AI大模型岗位面试题，涵盖基础理论、技术实操、项目经验等维度，每道题都配有详细解析和答题思路，帮你针对性提升面试竞争力。

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/8bf82c6dfe8a449e9be0ca6a8d35c1af.png)

##### 6、大模型项目实战&配套源码

**学以致用** ，在 **项目实战中检验和巩固你所学到的知识** ，同时为你找工作就业和职业发展打下坚实的基础。

![img](https://i-blog.csdnimg.cn/img_convert/91d8dc1a6f2e7231de586317805af9aa.gif)

#### 👉学会后的收获：👈

• 基于大模型全栈工程实现（前端、后端、产品经理、设计、数据分析等），通过这门课可获得不同能力；

• 能够利用大模型解决相关实际项目需求： 大数据时代，越来越多的企业和机构需要处理海量数据，利用大模型技术可以更好地处理这些数据，提高数据分析和决策的准确性。因此，掌握大模型应用开发技能，可以让程序员更好地应对实际项目需求；

• 基于大模型和企业数据AI应用开发，实现大模型理论、掌握GPU算力、硬件、LangChain开发框架和项目实战技能， 学会Fine-tuning垂直训练大模型（数据准备、数据蒸馏、大模型部署）一站式掌握；

• 能够完成时下热门大模型垂直领域模型训练能力，提高程序员的编码能力： 大模型应用开发需要掌握机器学习算法、深度学习框架等技术，这些技术的掌握可以提高程序员的编码能力和分析能力，让程序员更加熟练地编写高质量的代码。

- 👇👇扫码免费领取全部内容👇👇

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/ceacc697f5c243488ffd44a8fcb85a25.png)

### 这些资料真的有用吗？

这份资料由我和鲁为民博士(北京清华大学学士和美国加州理工学院博士)共同整理，现任上海殷泊信息科技CEO，其创立的MoPaaS云平台获Forrester全球’强劲表现者’认证，服务航天科工、国家电网等1000+企业，以第一作者在IEEE Transactions **发表论文50+篇** ，获NASA JPL火星探测系统强化学习专利等35项中美专利。 **本套AI大模型课程由清华大学-加州理工双料博士、吴文俊人工智能奖得主鲁为民教授领衔研发。**

资料内容涵盖了从入门到进阶的各类视频教程和实战项目，无论你是 **小白** 还是 **有些技术基础** 的技术人员，这份资料都绝对能帮助你提升薪资待遇，转行大模型岗位。  
  

这份完整版的大模型 AI 学习资料已经上传CSDN，朋友们如果需要可以微信扫描下方CSDN官方认证二维码免费领取【 `保证100%免费` 】