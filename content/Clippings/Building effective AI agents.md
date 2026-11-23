---
title: "Building effective AI agents"
source: "https://www.anthropic.com/research/building-effective-agents"
author:
  - "[[Anthropic]]"
published: 2024-12-19
created: 2026-11-23
description: "Practical guidance from Anthropic on building reliable AI agents, from simple composable patterns to fully autonomous systems."
tags:
  - "clippings"
---
*Note: Much of the tooling landscape described in this post has changed since December 2024. For our current approach, see [**how we built Claude Managed Agents**](https://www.anthropic.com/engineering/managed-agents)* *and the [**Managed Agents documentation**.](https://platform.claude.com/docs/en/managed-agents/overview)*  
*注：文中描述的很多工具生态自 2024 年 12 月起已经变化。我们现在的做法见[**我们如何构建 Claude Managed Agents**](https://www.anthropic.com/engineering/managed-agents)以及[**Managed Agents 文档**](https://platform.claude.com/docs/en/managed-agents/overview)。*
<br>

Over the past year, we've worked with dozens of teams building large language model (LLM) agents across industries. Consistently, the most successful implementations weren't using complex frameworks or specialized libraries. Instead, they were building with simple, composable patterns.

过去一年，我们和几十个跨行业构建大语言模型（LLM）agent 的团队合作过。一个稳定的规律是：最成功的实现并没有用复杂框架或专用库，而是用简单、可组合的模式搭起来的。
<br>

In this post, we share what we’ve learned from working with our customers and building agents ourselves, and give practical advice for developers on building effective agents.

这篇文章分享我们从客户合作和自己构建 agent 中学到的东西，给开发者提供构建有效 agent 的实用建议。
<br>

## What are agents? / 什么是 agent？

"Agent" can be defined in several ways. Some customers define agents as fully autonomous systems that operate independently over extended periods, using various tools to accomplish complex tasks. Others use the term to describe more prescriptive implementations that follow predefined workflows. At Anthropic, we categorize all these variations as **agentic systems**, but draw an important architectural distinction between **workflows** and **agents**:

「Agent」有多种定义。有客户把 agent 定义为能在较长时间里独立运行、用各种工具完成复杂任务的完全自主系统；也有人用这个词指遵循预定义工作流的、更规范化的实现。在 Anthropic，我们把所有这些变体统称为 **agentic 系统**，但在架构上区分**工作流（workflows）**和 **agent**：
<br>

- **Workflows** are systems where LLMs and tools are orchestrated through predefined code paths.
- **Agents**, on the other hand, are systems where LLMs dynamically direct their own processes and tool usage, maintaining control over how they accomplish tasks.

- **工作流**：LLM 和工具通过预定义的代码路径被编排。
- **agent**：LLM 动态决定自己的流程和工具使用，自己掌握怎么完成任务。
<br>

Below, we will explore both types of agentic systems in detail. In Appendix 1 (“Agents in Practice”), we describe two domains where customers have found particular value in using these kinds of systems.

下面详细看这两类 agentic 系统。附录 1（「实践中的 agent」）介绍两个客户认为这类系统特别有价值的领域。
<br>

## When (and when not) to use agents / 何时（以及何时不）使用 agent

When building applications with LLMs, we recommend finding the simplest solution possible, and only increasing complexity when needed. This might mean not building agentic systems at all. Agentic systems often trade latency and cost for better task performance, and you should consider when this tradeoff makes sense.

用 LLM 构建应用时，我们建议先找最简单的解法，只在必要时才提高复杂度——有时根本不该做 agentic 系统。agentic 系统常用延迟和成本换更好的任务表现，要想清楚这笔交易何时划算。
<br>

When more complexity is warranted, workflows offer predictability and consistency for well-defined tasks, whereas agents are the better option when flexibility and model-driven decision-making are needed at scale. For many applications, however, optimizing single LLM calls with retrieval and in-context examples is usually enough.

确实需要更复杂时：定义明确的任务用工作流，可预测、稳定；需要灵活性、需要模型大规模自主决策时用 agent。但很多应用里，用检索和上下文示例优化单次 LLM 调用就够了。
<br>

## When and how to use frameworks / 何时、如何使用框架

There are many frameworks that make agentic systems easier to implement, including:

很多框架能让 agentic 系统更容易实现，例如：
<br>

- The [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview);
- [Strands Agents SDK by AWS](https://strandsagents.com/latest/);
- [Rivet](https://rivet.ironcladapp.com/), a drag and drop GUI LLM workflow builder; and
- [Vellum](https://www.vellum.ai/), another GUI tool for building and testing complex workflows.

- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)；
- [AWS 的 Strands Agents SDK](https://strandsagents.com/latest/)；
- [Rivet](https://rivet.ironcladapp.com/)，拖拽式 GUI 的 LLM 工作流搭建器；
- [Vellum](https://www.vellum.ai/)，另一个用来搭建和测试复杂工作流的 GUI 工具。
<br>

These frameworks make it easy to get started by simplifying standard low-level tasks like calling LLMs, defining and parsing tools, and chaining calls together. However, they often create extra layers of abstraction that can obscure the underlying prompts and responses, making them harder to debug. They can also make it tempting to add complexity when a simpler setup would suffice.

这些框架把调用 LLM、定义和解析工具、串联调用等标准底层工作简化了，上手容易。但它们常常引入额外的抽象层，遮住底层的提示和响应，调试更难；也容易让人在本可以更简单的时候加上复杂度。
<br>

We suggest that developers start by using LLM APIs directly: many patterns can be implemented in a few lines of code. If you do use a framework, ensure you understand the underlying code. Incorrect assumptions about what's under the hood are a common source of customer error.

我们建议开发者先用 LLM API 直接写：很多模式几行代码就能实现。真用框架，也要确保看懂底层代码——对内部机制的错误假设是客户出错的常见原因。
<br>

See our [cookbook](https://platform.claude.com/cookbook/patterns-agents-basic-workflows) for some sample implementations.

示例实现见我们的 [cookbook](https://platform.claude.com/cookbook/patterns-agents-basic-workflows)。
<br>

## Building blocks, workflows, and agents / 构建块、工作流与 agent

In this section, we’ll explore the common patterns for agentic systems we’ve seen in production. We'll start with our foundational building block—the augmented LLM—and progressively increase complexity, from simple compositional workflows to autonomous agents.

本节梳理我们在生产环境见到的 agentic 系统常用模式。从基础构建块——增强型 LLM——开始，逐步加复杂度，从简单的组合工作流到自主 agent。
<br>

### Building block: The augmented LLM / 构建块：增强型 LLM

The basic building block of agentic systems is an LLM enhanced with augmentations such as retrieval, tools, and memory. Our current models can actively use these capabilities—generating their own search queries, selecting appropriate tools, and determining what information to retain.

agentic 系统的基本构建块，是加了检索、工具、记忆等增强能力的 LLM。现在的模型能主动使用这些能力：自己生成搜索查询、挑合适的工具、决定保留哪些信息。
<br>

![](https://assets.claude.com/bba3d0e7336751fea8440726d52709047334962d.png?w=3840&q=75&fm=webp&fit=max)

The augmented LLM

增强型 LLM
<br>

We recommend focusing on two key aspects of the implementation: tailoring these capabilities to your specific use case and ensuring they provide an easy, well-documented interface for your LLM. While there are many ways to implement these augmentations, one approach is through our recently released [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol), which allows developers to integrate with a growing ecosystem of third-party tools with a simple [client implementation](https://modelcontextprotocol.io/tutorials/building-a-client#building-mcp-clients).

实现上有两点值得抓：把这些能力裁剪到你的具体场景；给 LLM 提供好用、有文档的接口。实现方式很多，其中一种是用我们最近发布的 [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)（MCP），开发者写个简单的[客户端实现](https://modelcontextprotocol.io/tutorials/building-a-client#building-mcp-clients)就能接上不断壮大的第三方工具生态。
<br>

For the remainder of this post, we'll assume each LLM call has access to these augmented capabilities.

后文默认每次 LLM 调用都能用到这些增强能力。
<br>

### Workflow: Prompt chaining / 工作流：提示链

Prompt chaining decomposes a task into a sequence of steps, where each LLM call processes the output of the previous one. You can add programmatic checks (see "gate” in the diagram below) on any intermediate steps to ensure that the process is still on track.

提示链把任务拆成一串步骤，每次 LLM 调用处理上一次的输出。可以在任意中间步骤加程序化检查（下图里的「gate」），确保流程没跑偏。
<br>

![](https://assets.claude.com/430f593e41769039c477d3e4d6222dc9ad304816.png?w=3840&q=75&fm=webp&fit=max)

The prompt chaining workflow

提示链工作流
<br>

**When to use this workflow:** This workflow is ideal for situations where the task can be easily and cleanly decomposed into fixed subtasks. The main goal is to trade off latency for higher accuracy, by making each LLM call an easier task.

**何时用：** 任务能干净地拆成固定子任务时最合适。核心是用延迟换准确率——每次调用只做更简单的事。
<br>

**Examples where prompt chaining is useful:**

**适用例子：**
<br>

- Generating Marketing copy, then translating it into a different language.
- Writing an outline of a document, checking that the outline meets certain criteria, then writing the document based on the outline.

- 先生成营销文案，再翻成另一种语言。
- 先写文档大纲，检查大纲是否满足某些标准，再按大纲写全文。
<br>

### Workflow: Routing / 工作流：路由

Routing classifies an input and directs it to a specialized followup task. This workflow allows for separation of concerns, and building more specialized prompts. Without this workflow, optimizing for one kind of input can hurt performance on other inputs.

路由先对输入分类，再交给专门的后继任务。它能分离关注点、写出更专门的提示。没有它，为某类输入优化往往会伤害其他输入上的表现。
<br>

![](https://assets.claude.com/65050af354d6cb7a930735dc3c6f6e693b9385a4.png?w=3840&q=75&fm=webp&fit=max)

The routing workflow

路由工作流
<br>

**When to use this workflow:** Routing works well for complex tasks where there are distinct categories that are better handled separately, and where classification can be handled accurately, either by an LLM or a more traditional classification model/algorithm.

**何时用：** 适合有明确类别、各类分开处理更好的复杂任务；分类要能做得准，用 LLM 或传统分类模型/算法都可以。
<br>

**Examples where routing is useful:**

**适用例子：**
<br>

- Directing different types of customer service queries (general questions, refund requests, technical support) into different downstream processes, prompts, and tools.
- Routing easy/common questions to smaller, cost-efficient models like Claude Haiku 4.5 and hard/unusual questions to more capable models like Claude Sonnet 4.5 to optimize for best performance.

- 把不同类型的客服请求（一般问题、退款、技术支持）分到不同的下游流程、提示和工具。
- 把简单常见的问题路由给更小、更省钱的模型（如 Claude Haiku 4.5），难题、少见问题给更强的模型（如 Claude Sonnet 4.5），以取得最佳表现。
<br>

### Workflow: Parallelization / 工作流：并行化

LLMs can sometimes work simultaneously on a task and have their outputs aggregated programmatically. This workflow, parallelization, manifests in two key variations:

有时可以让 LLM 同时处理一个任务，再把输出用程序汇总。这种工作流叫并行化，有两种主要形式：
<br>

- **Sectioning**: Breaking a task into independent subtasks run in parallel.
- **Voting:** Running the same task multiple times to get diverse outputs.

- **分区（Sectioning）**：把任务拆成互相独立的子任务并行跑。
- **投票（Voting）**：同一任务跑多次，得到多样输出。
<br>

![](https://assets.claude.com/1ac29508ce49cac6f58ec37dd360982dd618cbaa.png?w=3840&q=75&fm=webp&fit=max)

The parallelization workflow

并行化工作流
<br>

**When to use this workflow:** Parallelization is effective when the divided subtasks can be parallelized for speed, or when multiple perspectives or attempts are needed for higher confidence results. For complex tasks with multiple considerations, LLMs generally perform better when each consideration is handled by a separate LLM call, allowing focused attention on each specific aspect.

**何时用：** 拆开的子任务能靠并行提速时有效；需要多个视角或多次尝试来提高置信度时也有效。复杂、要考虑多个因素的任务里，把每个因素交给单独一次调用通常更好，因为注意力更集中。
<br>

**Examples where parallelization is useful:**

**适用例子：**
<br>

- **Sectioning**:
	- Implementing guardrails where one model instance processes user queries while another screens them for inappropriate content or requests. This tends to perform better than having the same LLM call handle both guardrails and the core response.
	- Automating evals for evaluating LLM performance, where each LLM call evaluates a different aspect of the model’s performance on a given prompt.
- **Voting**:
	- Reviewing a piece of code for vulnerabilities, where several different prompts review and flag the code if they find a problem.
	- Evaluating whether a given piece of content is inappropriate, with multiple prompts evaluating different aspects or requiring different vote thresholds to balance false positives and negatives.

- **分区**：
	- 做护栏：一个模型实例处理用户请求，另一个筛查其中是否有不当内容或请求。这通常比让同一次调用既做护栏又出主回答更好。
	- 自动化评测 LLM 表现：每次调用评一个不同方面。
- **投票**：
	- 审查代码漏洞：几个不同提示各自审查，发现问题就标记。
	- 判断某段内容是否不当：多个提示评不同方面，或用不同投票阈值来平衡误报和漏报。
<br>

### Workflow: Orchestrator-workers / 工作流：编排者—工作者

In the orchestrator-workers workflow, a central LLM dynamically breaks down tasks, delegates them to worker LLMs, and synthesizes their results.

在编排者—工作者工作流里，一个中央 LLM 动态拆解任务，派给工作者 LLM，再汇总结果。
<br>

![](https://assets.claude.com/c8fc5373e187c2e37ab755fac1cf82b3bf366718.png?w=3840&q=75&fm=webp&fit=max)

The orchestrator-workers workflow

编排者—工作者工作流
<br>

**When to use this workflow:** This workflow is well-suited for complex tasks where you can’t predict the subtasks needed (in coding, for example, the number of files that need to be changed and the nature of the change in each file likely depend on the task). Whereas it’s topographically similar, the key difference from parallelization is its flexibility—subtasks aren't pre-defined, but determined by the orchestrator based on the specific input.

**何时用：** 适合没法预测需要哪些子任务的复杂任务（比如写代码：要改几个文件、每个文件怎么改，通常取决于任务本身）。它跟并行化结构相似，关键区别是灵活：子任务不是预先定好的，而是由编排者按具体输入决定。
<br>

**Example where orchestrator-workers is useful:**

**适用例子：**
<br>

- Coding products that make complex changes to multiple files each time.
- Search tasks that involve gathering and analyzing information from multiple sources for possible relevant information.

- 每次都要对多个文件做复杂改动的编程产品。
- 需要从多个来源收集和分析信息、找出可能相关内容的检索任务。
<br>

### Workflow: Evaluator-optimizer / 工作流：评估者—优化者

In the evaluator-optimizer workflow, one LLM call generates a response while another provides evaluation and feedback in a loop.

在评估者—优化者工作流里，一次调用生成回答，另一次给出评估和反馈，循环往复。
<br>

![](https://assets.claude.com/4b2dd710371f70a2380356de4ee3ebbf902f319c.png?w=3840&q=75&fm=webp&fit=max)

The evaluator-optimizer workflow

评估者—优化者工作流
<br>

**When to use this workflow:** This workflow is particularly effective when we have clear evaluation criteria, and when iterative refinement provides measurable value. The two signs of good fit are, first, that LLM responses can be demonstrably improved when a human articulates their feedback; and second, that the LLM can provide such feedback. This is analogous to the iterative writing process a human writer might go through when producing a polished document.

**何时用：** 有清晰评估标准、且反复打磨能带来可测量价值时特别有效。两个适合的信号：一是人能说清反馈时 LLM 的回答能明显变好；二是 LLM 自己能给出这类反馈。这类似人类作者写定稿时的反复修改过程。
<br>

**Examples where evaluator-optimizer is useful:**

**适用例子：**
<br>

- Literary translation where there are nuances that the translator LLM might not capture initially, but where an evaluator LLM can provide useful critiques.
- Complex search tasks that require multiple rounds of searching and analysis to gather comprehensive information, where the evaluator decides whether further searches are warranted.

- 文学翻译：有些细微处译者 LLM 起初抓不住，评估 LLM 能给出有用的批评。
- 需要多轮搜索分析的复杂检索任务，由评估者判断是否值得继续搜。
<br>

### Agents / agent

Agents are emerging in production as LLMs mature in key capabilities—understanding complex inputs, engaging in reasoning and planning, using tools reliably, and recovering from errors. Agents begin their work with either a command from, or interactive discussion with, the human user. Once the task is clear, agents plan and operate independently, potentially returning to the human for further information or judgement. During execution, it's crucial for the agents to gain “ground truth” from the environment at each step (such as tool call results or code execution) to assess its progress. Agents can then pause for human feedback at checkpoints or when encountering blockers. The task often terminates upon completion, but it’s also common to include stopping conditions (such as a maximum number of iterations) to maintain control.

随着 LLM 在关键能力上成熟（理解复杂输入、推理与规划、可靠地使用工具、从错误中恢复），agent 开始进入生产。agent 从人类用户的一条指令或一次交互讨论开始；任务明确后就独立规划和执行，必要时再回来问信息或要判断。执行中，每一步都要从环境取得「真值」（比如工具调用结果、代码执行结果）来评估进度。agent 可以在检查点或遇到阻塞时暂停等人反馈。任务通常在完成时结束，但也常设停止条件（比如最大迭代次数）来保持可控。
<br>

Agents can handle sophisticated tasks, but their implementation is often straightforward. They are typically just LLMs using tools based on environmental feedback in a loop. It is therefore crucial to design toolsets and their documentation clearly and thoughtfully. We expand on best practices for tool development in Appendix 2 ("Prompt Engineering your Tools").

agent 能处理复杂任务，但实现往往很直接：本质上就是 LLM 在循环里根据环境反馈使用工具。所以工具集和文档的设计要清晰、用心。工具开发的最佳实践见附录 2（「为工具做提示工程」）。
<br>

![](https://assets.claude.com/ecba32d35b19d94e892c3c89c3bf59b130e25eb0.png?w=3840&q=75&fm=webp&fit=max)

Autonomous agent

自主 agent
<br>

**When to use agents:** Agents can be used for open-ended problems where it’s difficult or impossible to predict the required number of steps, and where you can’t hardcode a fixed path. The LLM will potentially operate for many turns, and you must have some level of trust in its decision-making. Agents' autonomy makes them ideal for scaling tasks in trusted environments.

**何时用：** 适合开放式问题——步数难以预测、没法写死固定路径。LLM 可能跑很多轮，你得对它的决策有一定信任。agent 的自主性让它在可信环境里很适合规模化处理任务。
<br>

The autonomous nature of agents means higher costs, and the potential for compounding errors. We recommend extensive testing in sandboxed environments, along with the appropriate guardrails.

自主也意味着更高成本，以及错误累积的风险。建议在沙箱环境里充分测试，并配好护栏。
<br>

**Examples where agents are useful:**

**适用例子：**
<br>

The following examples are from our own implementations:

以下例子来自我们自己的实现：
<br>

- A coding Agent to resolve [SWE-bench tasks](https://www.anthropic.com/research/swe-bench-sonnet), which involve edits to many files based on a task description;
- Our [“computer use” reference implementation](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo), where Claude uses a computer to accomplish tasks.

- 解决 [SWE-bench 任务](https://www.anthropic.com/research/swe-bench-sonnet)的编程 agent：按任务描述改动多个文件；
- 我们的[「computer use」参考实现](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo)：Claude 用电脑完成任务。
<br>

![](https://assets.claude.com/41f764808903bc7f18215b43f04e3ed4fc72e2ca.png?w=3840&q=75&fm=webp&fit=max)

High-level flow of a coding agent

编程 agent 的高层流程
<br>

## Combining and customizing these patterns / 组合与定制这些模式

These building blocks aren't prescriptive. They're common patterns that developers can shape and combine to fit different use cases. The key to success, as with any LLM features, is measuring performance and iterating on implementations. To repeat: you should consider adding complexity *only* when it demonstrably improves outcomes.

这些构建块不是硬规定，而是常见模式，开发者可以按场景裁剪、组合。和任何 LLM 功能一样，成功的关键是测量表现、反复迭代实现。再说一遍：只有在能证明改善结果时，才考虑加复杂度。
<br>

## Summary / 总结

Success in the LLM space isn't about building the most sophisticated system. It's about building the *right* system for your needs. Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short.

在 LLM 领域，成功不在于造最精巧的系统，而在于造*适合你需求*的系统。从简单提示开始，用充分评估去优化，只有在简单方案不够用时才加多步 agentic 系统。
<br>

When implementing agents, we try to follow three core principles:

实现 agent 时，我们尽量遵循三条核心原则：
<br>

1. Maintain **simplicity** in your agent's design.
2. Prioritize **transparency** by explicitly showing the agent’s planning steps.
3. Carefully craft your agent-computer interface (ACI) through thorough tool **documentation and testing**.

1. 保持设计的**简单性**。
2. 注重**透明性**：明确展示 agent 的规划步骤。
3. 通过充分的工具**文档与测试**，仔细打磨 agent—计算机接口（ACI）。
<br>

Frameworks can help you get started quickly, but don't hesitate to reduce abstraction layers and build with basic components as you move to production. By following these principles, you can create agents that are not only powerful but also reliable, maintainable, and trusted by their users.

框架能帮你快速起步，但进入生产时不要犹豫，该减少抽象层就用基础组件直接搭。遵循这些原则，你做出来的 agent 不仅强大，还可靠、可维护、被用户信任。
<br>

## Appendix 1: Agents in practice / 附录 1：实践中的 agent

Our work with customers has revealed two particularly promising applications for AI agents that demonstrate the practical value of the patterns discussed above. Both applications illustrate how agents add the most value for tasks that require both conversation and action, have clear success criteria, enable feedback loops, and integrate meaningful human oversight.

与客户的合作让我们看到两个特别有前景的 AI agent 应用方向，也印证了上面这些模式的实用价值。两者都说明：既需要对话又需要行动、有明确成功标准、能形成反馈循环、并让人类做有意义监督的任务，agent 的价值最大。
<br>

### A. Customer support / A. 客服

Customer support combines familiar chatbot interfaces with enhanced capabilities through tool integration. This is a natural fit for more open-ended agents because:

客服把熟悉的聊天界面和工具集成带来的增强能力结合起来，天然适合更开放的 agent，因为：
<br>

- Support interactions naturally follow a conversation flow while requiring access to external information and actions;
- Tools can be integrated to pull customer data, order history, and knowledge base articles;
- Actions such as issuing refunds or updating tickets can be handled programmatically; and
- Success can be clearly measured through user-defined resolutions.

- 客服交互本身就是对话，同时需要访问外部信息和执行动作；
- 可以接工具拉取客户数据、订单历史和知识库文章；
- 退款、改工单这类动作可以用程序完成；
- 成功可以用用户定义的「已解决」来清晰衡量。
<br>

Several companies have demonstrated the viability of this approach through usage-based pricing models that charge only for successful resolutions, showing confidence in their agents' effectiveness.

一些公司用只为成功解决付费的按用量计价模式证明了这条路可行，也显示了对自家 agent 效果的信心。
<br>

### B. Coding agents / B. 编程 agent

The software development space has shown remarkable potential for LLM features, with capabilities evolving from code completion to autonomous problem-solving. Agents are particularly effective because:

软件开发领域展现了 LLM 功能的巨大潜力，能力从代码补全演进到自主解决问题。agent 在这里特别有效，因为：
<br>

- Code solutions are verifiable through automated tests;
- Agents can iterate on solutions using test results as feedback;
- The problem space is well-defined and structured; and
- Output quality can be measured objectively.

- 代码方案可以用自动化测试验证；
- agent 能拿测试结果当反馈迭代方案；
- 问题空间定义清晰、结构良好；
- 输出质量可以客观衡量。
<br>

In our own implementation, agents can now solve real GitHub issues in the [SWE-bench Verified](https://www.anthropic.com/research/swe-bench-sonnet) benchmark based on the pull request description alone. However, whereas automated testing helps verify functionality, human review remains crucial for ensuring solutions align with broader system requirements.

在我们自己的实现里，agent 现在能只凭 pull request 描述解决 [SWE-bench Verified](https://www.anthropic.com/research/swe-bench-sonnet) 榜上的真实 GitHub issue。不过，自动化测试虽然能验证功能，人工审查仍然关键，用来确保方案符合更宏观的系统需求。
<br>

## Appendix 2: Prompt engineering your tools / 附录 2：为工具做提示工程

No matter which agentic system you're building, tools will likely be an important part of your agent. [Tools](https://www.anthropic.com/news/tool-use-ga) enable Claude to interact with external services and APIs by specifying their exact structure and definition in our API. When Claude responds, it will include a [tool use block](https://docs.anthropic.com/en/docs/build-with-claude/tool-use#example-api-response-with-a-tool-use-content-block) in the API response if it plans to invoke a tool. Tool definitions and specifications should be given just as much prompt engineering attention as your overall prompts. In this brief appendix, we describe how to prompt engineer your tools.

无论做哪种 agentic 系统，工具大概都是 agent 的重要部分。[工具](https://www.anthropic.com/news/tool-use-ga)让 Claude 能通过在我们的 API 里精确描述结构和定义，去与外部服务和 API 交互。Claude 打算调用工具时，会在 API 响应里带上 [tool use block](https://docs.anthropic.com/en/docs/build-with-claude/tool-use#example-api-response-with-a-tool-use-content-block)。工具定义和规格值得和整体提示同等的提示工程投入。这个简短的附录讲怎么给工具做提示工程。
<br>

There are often several ways to specify the same action. For instance, you can specify a file edit by writing a diff, or by rewriting the entire file. For structured output, you can return code inside markdown or inside JSON. In software engineering, differences like these are cosmetic and can be converted losslessly from one to the other. However, some formats are much more difficult for an LLM to write than others. Writing a diff requires knowing how many lines are changing in the chunk header before the new code is written. Writing code inside JSON (compared to markdown) requires extra escaping of newlines and quotes.

同一个动作常有好几种描述方式。比如改文件，可以写 diff，也可以重写整个文件；结构化输出可以放在 markdown 里，也可以放在 JSON 里。在软件工程里这些差别是表面的，可以无损互转。但对 LLM 来说，有些格式写起来难得多：写 diff 得在新代码之前就知道 chunk 头里要改几行；在 JSON 里写代码（相比 markdown）还得额外转义换行和引号。
<br>

Our suggestions for deciding on tool formats are the following:

选择工具格式的建议：
<br>

- Give the model enough tokens to "think" before it writes itself into a corner.
- Keep the format close to what the model has seen naturally occurring in text on the internet.
- Make sure there's no formatting "overhead" such as having to keep an accurate count of thousands of lines of code, or string-escaping any code it writes.

- 给模型留够 token 先「想」，别让它把自己逼进死角。
- 格式尽量贴近模型在互联网文本里自然见过的样子。
- 避免格式上的「开销」，比如必须精确数几千行代码，或给它写的代码做字符串转义。
<br>

One rule of thumb is to think about how much effort goes into human-computer interfaces (HCI), and plan to invest just as much effort in creating good *agent* -computer interfaces (ACI). Here are some thoughts on how to do so:

一条经验法则：想想人机界面（HCI）上投入了多少功夫，就计划在好的 *agent*—计算机接口（ACI）上投入同样多。几点做法：
<br>

- Put yourself in the model's shoes. Is it obvious how to use this tool, based on the description and parameters, or would you need to think carefully about it? If so, then it’s probably also true for the model. A good tool definition often includes example usage, edge cases, input format requirements, and clear boundaries from other tools.
- How can you change parameter names or descriptions to make things more obvious? Think of this as writing a great docstring for a junior developer on your team. This is especially important when using many similar tools.
- Test how the model uses your tools: Run many example inputs in our [workbench](https://console.anthropic.com/workbench) to see what mistakes the model makes, and iterate.
- [Poka-yoke](https://en.wikipedia.org/wiki/Poka-yoke) your tools. Change the arguments so that it is harder to make mistakes.

- 站在模型的角度：光看描述和参数，这个工具怎么用是否一目了然？如果需要仔细琢磨，模型多半也一样。好的工具定义常含示例用法、边界情况、输入格式要求，以及与其他工具的清晰边界。
- 怎么改参数名或描述让它更明显？把它当成给团队里初级开发者写的 docstring；工具很多且相似时尤其重要。
- 测试模型怎么用你的工具：在 [workbench](https://console.anthropic.com/workbench) 里跑大量示例输入，看模型犯什么错，再迭代。
- 给工具做[防呆设计（poka-yoke）](https://en.wikipedia.org/wiki/Poka-yoke)：改参数，让出错更难。
<br>

While building our agent for [SWE-bench](https://www.anthropic.com/research/swe-bench-sonnet), we actually spent more time optimizing our tools than the overall prompt. For example, we found that the model would make mistakes with tools using relative filepaths after the agent had moved out of the root directory. To fix this, we changed the tool to always require absolute filepaths—and we found that the model used this method flawlessly.

做 [SWE-bench](https://www.anthropic.com/research/swe-bench-sonnet) agent 时，我们花在优化工具上的时间其实比整体提示还多。比如我们发现，agent 离开根目录后，使用相对路径的工具会出错。我们把工具改成一律要求绝对路径后，模型用起来毫无问题。
