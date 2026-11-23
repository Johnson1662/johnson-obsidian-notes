---
title: "Scaling Managed Agents with stable interfaces"
source: "https://www.anthropic.com/research/managed-agents"
author:
  - "[[Anthropic]]"
published: 2026-04-08
created: 2026-11-23
description: "Harnesses encode assumptions that go stale as models improve. See how Managed Agents is built around interfaces that stay stable as harnesses change."
tags:
  - "clippings"
---
*Get started with Claude Managed Agents by following our [docs](https://platform.claude.com/docs/en/managed-agents/overview).*  
*想开始用 Claude Managed Agents，请按[文档](https://platform.claude.com/docs/en/managed-agents/overview)操作。*  
<br>

A running topic on the Engineering Blog is how to [build effective agents](https://www.anthropic.com/engineering/building-effective-agents) and [design harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) for [long-running work](https://www.anthropic.com/engineering/harness-design-long-running-apps). A common thread across this work is that harnesses encode assumptions about what Claude can’t do on its own. However, those assumptions need to be frequently questioned because they can [go stale](http://www.incompleteideas.net/IncIdeas/BitterLesson.html) as models improve.

工程博客一直在讨论如何[构建有效的 agent](https://www.anthropic.com/engineering/building-effective-agents)、如何为[长周期任务](https://www.anthropic.com/engineering/harness-design-long-running-apps)[设计 harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)。这些工作有个共同点：harness 都编码了「Claude 自己做不到什么」的假设。但这些假设必须经常被质疑，因为模型变强后它们会[过时](http://www.incompleteideas.net/IncIdeas/BitterLesson.html)。
<br>

As just one example, in prior work [we found](https://www.anthropic.com/engineering/harness-design-long-running-apps) that Claude Sonnet 4.5 would wrap up tasks prematurely as it sensed its context limit approaching—a behavior sometimes called “context anxiety.” We addressed this by adding context resets to the harness. But when we used the same harness on Claude Opus 4.5, we found that the behavior was gone. The resets had become dead weight.

举个例子：之前我们[发现](https://www.anthropic.com/engineering/harness-design-long-running-apps)，Claude Sonnet 4.5 感觉到上下文快满时会提前结束任务，这被称为「上下文焦虑」。我们在 harness 里加了上下文重置来解决它。但把同一个 harness 用到 Claude Opus 4.5 上时，这个行为已经不存在了——重置成了多余的负担。
<br>

We expect harnesses to continue evolving. So we built Managed Agents: a hosted service in the Claude Platform that runs long-horizon agents on your behalf through a small set of interfaces meant to outlast any particular implementation—including the ones we run today.

harness 会继续演化。所以我们做了 Managed Agents：Claude 平台上的托管服务，用一小组接口替你跑长周期 agent。这些接口的设计目标是活得比任何具体实现都久，包括我们今天在用的实现。
<br>

Building Managed Agents meant solving an old problem in computing: how to design a system for “[programs as yet unthought of](http://www.catb.org/esr/writings/taoup/html/ch03s01.html).” Decades ago, operating systems solved this problem by virtualizing hardware into abstractions—*process, file*—general enough for programs that didn't exist yet. The abstractions outlasted the hardware. The `read()` command is agnostic as to whether it’s accessing a disk pack from the 1970s or a modern SSD. The abstractions on top stayed stable while the implementations underneath changed freely.

做 Managed Agents 要解决一个古老的计算机问题：如何为「尚未被想到的程序」设计系统。几十年前，操作系统通过把硬件虚拟化成抽象——*进程、文件*——来解决它，这些抽象足够通用，能容纳当时还不存在的程序。抽象比硬件活得久。`read()` 命令并不关心读的是 1970 年代的磁盘组还是现代 SSD。上层抽象保持稳定，下层实现可以自由更换。
<br>

Managed Agents follow the same pattern. We virtualized the components of an agent: a session (the append-only log of everything that happened), a harness (the loop that calls Claude and routes Claude’s tool calls to the relevant infrastructure), and a sandbox (an execution environment where Claude can run code and edit files). This allows the implementation of each to be swapped without disturbing the others. We're opinionated about the shape of these interfaces, not about what runs behind them.

Managed Agents 遵循同样的模式。我们把 agent 的组件虚拟化：会话（记录一切发生的只追加日志）、harness（调用 Claude、把 Claude 的工具调用路由到对应基础设施的循环）、沙箱（Claude 运行代码、编辑文件的执行环境）。这样每个组件的实现都能在不干扰其他组件的前提下替换。我们对这些接口的形状有明确主张，但对它们背后跑什么不做规定。
<br>

![](https://assets.claude.com/903b624ada206b10753a24c6a1367e74a869165d.png?w=3840&q=75&fm=webp&fit=max)

## Don’t adopt a pet / 别养宠物

We started by placing all agent components into a single container, which meant the session, agent harness, and sandbox all shared an environment. There were benefits to this approach, including that file edits are direct syscalls, and there were no service boundaries to design.

起初我们把所有 agent 组件放进一个容器，会话、harness、沙箱共享同一环境。这有好处：文件编辑是直接的系统调用，也不需要设计服务边界。
<br>

But by coupling everything into one container, we ran into an old infrastructure problem: we’d adopted a [*pet*](https://cloudscaling.com/blog/cloud-computing/the-history-of-pets-vs-cattle/). In the pets-vs-cattle analogy, a pet is a named, hand-tended individual you can’t afford to lose, while cattle are interchangeable. In our case, the server became that pet; if a container failed, the session was lost. If a container was unresponsive, we had to nurse it back to health.

但把所有东西耦合成一个容器，撞上了一个老的基础设施问题：我们养了只[*宠物*](https://cloudscaling.com/blog/cloud-computing/the-history-of-pets-vs-cattle/)。在「宠物 vs 牲畜」的比喻里，宠物是有名字、要亲手照料、丢不起的个体；牲畜则彼此可替换。我们的服务器成了那只宠物：容器挂了，会话就丢了；容器无响应，就得把它养回来。
<br>

Nursing containers meant debugging unresponsive stuck sessions. Our only window in was the WebSocket event stream, but that couldn’t tell us *where* failures arose, which meant that a bug in the harness, a packet drop in the event stream, or a container going offline all presented the same. To figure out what went wrong, an engineer had to open a shell inside the container, but because that container often also held user data, that approach essentially meant we lacked the ability to debug.

养容器意味着要调试卡死无响应的会话。我们唯一的观察窗口是 WebSocket 事件流，但它看不出故障发生在*哪里*——harness 的 bug、事件流的丢包、容器掉线，表现完全一样。要查原因，工程师得进容器开 shell，可那容器里往往还有用户数据，这条路基本等于没法调试。
<br>

A second issue was that the harness assumed that whatever Claude worked on lived in the container with it. When customers asked us to connect Claude to their virtual private cloud, they had to either peer their network with ours, or run our harness in their own environment. An assumption baked into the harness became a problem when we wanted to connect it to different infrastructure.

第二个问题：harness 假设 Claude 处理的东西就住在它那个容器里。客户要求把 Claude 接到自己的私有云时，只能把网络和我们的对等打通，或者在我们的环境里跑他们的 harness。这个写进 harness 的假设，在需要接不同基础设施时就成了麻烦。
<br>

## Decouple the brain from the hands / 把大脑和手解耦

The solution we arrived at was to decouple what we thought of as the “brain” (Claude and its harness) from both the “hands” (sandboxes and tools that perform actions) and the “session” (the log of session events). Each became an interface that made few assumptions about the others, and each could fail or be replaced independently.

我们的解法是把「大脑」（Claude 和它的 harness）与「手」（执行动作的沙箱和工具）、以及「会话」（会话事件日志）解耦。三者各自变成一个接口，对彼此几乎不做假设，能独立失败、独立替换。
<br>

**The harness leaves the container.** Decoupling the brain from the hands meant the harness no longer lived inside the container. It called the container the way it called any other tool: `execute(name, input) → string`. The container became cattle. If the container died, the harness caught the failure as a tool-call error and passed it back to Claude. If Claude decided to retry, a new container could be reinitialized with a standard recipe: `provision({resources})`. We no longer had to nurse failed containers back to health.

**harness 离开容器。** 大脑与手解耦后，harness 不再住在容器里，而是像调用其他工具一样调用容器：`execute(name, input) → string`。容器变成牲畜：挂了，harness 把失败当作工具调用错误捕获并回传给 Claude；Claude 要重试，就用标准配方 `provision({resources})` 初始化一个新容器。不用再养容器了。
<br>

**Recovering from harness failure.** The harness also became cattle. Because the session log sits outside the harness, nothing in the harness needs to survive a crash. When one fails, a new one can be rebooted with `wake(sessionId)`, use `getSession(id)` to get back the event log, and resume from the last event. During the agent loop, the harness writes to the session with `emitEvent(id, event)` in order to keep a durable record of events.

**harness 失败后的恢复。** harness 也成了牲畜。因为会话日志在 harness 外面，harness 里没有任何东西需要熬过崩溃。它挂了，新的 harness 用 `wake(sessionId)` 重启，用 `getSession(id)` 取回事件日志，从最后一个事件续上。agent 循环过程中，harness 用 `emitEvent(id, event)` 写会话，留下持久记录。
<br>

![](https://assets.claude.com/7e932a72d45541a6a8a7585181f10efbf018d5c8.png?w=3840&q=75&fm=webp&fit=max)

**The security boundary.** In the coupled design, any untrusted code that Claude generated was run in the same container as credentials—so a prompt injection only had to convince Claude to read its own environment. Once an attacker has those tokens, they can spawn fresh, unrestricted sessions and delegate work to them. Narrow scoping is an obvious mitigation, but this encodes an assumption about what Claude can't do with a limited token—and Claude is getting increasingly smart. The structural fix was to make sure the tokens are never reachable from the sandbox where Claude’s generated code runs.

**安全边界。** 在耦合设计里，Claude 生成的不可信代码和凭证跑在同一个容器里——提示注入只要说服 Claude 读自己的环境就够了。攻击者拿到这些令牌，就能开新的、无限制的会话并派活。缩小权限范围是显而易见的缓解手段，但这又编码了「Claude 拿受限令牌做不了什么」的假设——而 Claude 越来越聪明。结构性的修法是：让令牌永远无法从运行 Claude 生成代码的沙箱里够到。
<br>

We used two patterns to ensure this. Auth can be bundled with a resource or held in a vault outside the sandbox. For Git, we use each repository’s access token to clone the repo during sandbox initialization and wire it into the local git remote. Git `push` and `pull` work from inside the sandbox without the agent ever handling the token itself. For custom tools, we support MCP and store OAuth tokens in a secure vault. Claude calls MCP tools via a dedicated proxy; this proxy takes in a token associated with the session. The proxy can then fetch the corresponding credentials from the vault and make the call to the external service. The harness is never made aware of any credentials.

我们用了两种模式。认证可以随资源一起打包，也可以放在沙箱外的保险库。对 Git，我们用每个仓库的访问令牌在沙箱初始化时克隆仓库，并写进本地 git remote；`push` 和 `pull` 在沙箱内正常工作，agent 全程不碰令牌。对自定义工具，我们支持 MCP，把 OAuth 令牌存进安全保险库；Claude 通过专用代理调用 MCP 工具，代理拿到与会话关联的令牌，从保险库取对应凭证再去调外部服务。harness 完全不知道任何凭证。
<br>

## The session is not Claude’s context window / 会话不是 Claude 的上下文窗口

Long-horizon tasks often exceed the length of Claude’s context window, and the standard ways to address this all involve irreversible decisions about what to keep. We’ve explored these techniques in [prior work](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) on context engineering. For example, compaction lets Claude save a summary of its context window and the memory tool lets Claude write context to files, enabling learning across sessions. This can be paired with context trimming, which selectively removes tokens such as old tool results or thinking blocks.

长周期任务常常超出 Claude 上下文窗口的长度，标准做法都涉及「保留什么」的不可逆决定。我们在[先前工作](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)里探索过这些技术。比如压缩（compaction）让 Claude 存一份上下文窗口的摘要，记忆工具让 Claude 把上下文写进文件、跨会话学习；还可以配合上下文裁剪，选择性移除旧的工具结果或思考块等 token。
<br>

But irreversible decisions to selectively retain or discard context can lead to failures. It is difficult to know which tokens the future turns will need. If messages are transformed by a compaction step, the harness removes compacted messages from Claude’s context window, and these are recoverable only if they are stored. Prior work [has explored](https://arxiv.org/pdf/2512.24601) ways to address this by storing context as an object that lives *outside* the context window. For example, context can be an object in a REPL that the LLM programmatically accesses by writing code to filter or slice it.

但选择保留或丢弃上下文是不可逆的，可能导致失败：很难知道未来的回合需要哪些 token。如果消息被压缩步骤改写，harness 会把压缩过的消息从上下文窗口移除，只有存下来才能恢复。先前工作[探索过](https://arxiv.org/pdf/2512.24601)把上下文存成活在上下文窗口*外面*的对象，比如 REPL 里的一个对象，由 LLM 写代码来过滤或切片访问。
<br>

![](https://assets.claude.com/62203b5b91fee236b0e2752e96ff564044bcbc2a.png?w=3840&q=75&fm=webp&fit=max)

In Managed Agents, the session provides this same benefit, serving as a context object that lives outside Claude’s context window. But rather than be stored within the sandbox or REPL, context is durably stored in the session log. The interface, `getEvents(),` allows the brain to interrogate context by selecting positional slices of the event stream. The interface can be used flexibly, allowing the brain to pick up from wherever it last stopped reading, rewinding a few events before a specific moment to see the lead up, or rereading context before a specific action.

在 Managed Agents 里，会话提供同样的好处：它是活在 Claude 上下文窗口外的上下文对象。但上下文不是存在沙箱或 REPL 里，而是持久存在会话日志中。接口 `getEvents()` 让大脑按位置切片查询事件流：从上次读到的地方接着读，回到某个时刻之前几个事件看前因，或在某个动作前重读上下文。
<br>

Any fetched events can also be transformed in the harness before being passed to Claude’s context window. These transformations can be whatever the harness encodes, including context organization to achieve a high prompt cache hit rate and context engineering. We separated the concerns of recoverable context storage in the session and arbitrary context management in the harness because we can’t predict what specific context engineering will be required in future models. The interfaces push that context management into the harness, and only guarantee that the session is durable and available for interrogation.

取到的事件还可以在 harness 里变换后再送进 Claude 的上下文窗口。变换内容由 harness 决定，包括组织上下文以提高提示缓存命中率、以及上下文工程。我们把「可恢复的上下文存储」（会话）和「任意的上下文管理」（harness）分开，因为无法预测未来模型需要什么样的上下文工程。接口把上下文管理推给 harness，只保证会话持久、可查询。
<br>

## Many brains, many hands / 多个大脑，多只手

**Many brains.** Decoupling the brain from the hands solved one of our earliest customer complaints. When teams wanted Claude to work against resources in their own VPC, the only path was to peer their network with ours, because the container holding the harness assumed every resource sat next to it. Once the harness was no longer in the container, that assumption went away. The same change had a performance payoff. When we initially put the brain in a container, it meant that many brains required as many containers. For each brain, no inference could happen until that container was provisioned; every session paid the full container setup cost up front. Every session, even ones that would never touch the sandbox, had to clone the repo, boot the process, fetch pending events from our servers.

**多个大脑。** 大脑与手解耦解决了最早的客户抱怨之一。团队想让 Claude 对自己 VPC 里的资源干活时，原本只能把网络和我们对等打通，因为装 harness 的容器假设所有资源都在旁边。harness 不再住在容器里后，这个假设消失了。同一个改动还带来性能收益：最初把大脑放进容器，意味着多少大脑就要多少容器，每个大脑都得等自己的容器就绪才能推理，每个会话都要先付完整的容器启动成本——哪怕这个会话根本不碰沙箱，也得克隆仓库、启动进程、从服务器拉取待处理事件。
<br>

That dead time is expressed in time-to-first-token (TTFT), which measures how long a session waits between accepting work and producing its first response token. TTFT is the latency the user most acutely *feels*.

这段空等体现在首 token 延迟（TTFT）上：会话从接受任务到产出第一个 token 要等多久。TTFT 是用户感受最直接的延迟。
<br>

Decoupling the brain from the hands means that containers are provisioned by the brain via a tool call `(execute(name, input) → string)` only if they are needed. So a session that didn't need a container right away didn't wait for one. Inference could start as soon as the orchestration layer pulled pending events from the session log. Using this architecture, our p50 TTFT dropped roughly 60% and p95 dropped over 90%. Scaling to many brains just meant starting many stateless harnesses, and connecting them to hands only if needed.

解耦后，容器由大脑通过工具调用 `(execute(name, input) → string)` 按需创建。暂时不需要容器的会话就不必等容器；编排层从会话日志拉出待处理事件后，推理立刻开始。用这套架构，我们的 p50 TTFT 降了约 60%，p95 降了 90% 以上。扩展到多个大脑，只需启动多个无状态 harness，需要时才接上手。
<br>

**Many hands.** We also wanted the ability to connect each brain to many hands. In practice, this means Claude must reason about many execution environments and decide where to send work—a harder cognitive task than operating in a single shell. We started with the brain in a single container because earlier models weren't capable of this. As intelligence scaled, the single container became the limitation instead: when that container failed, we lost state for every hand that the brain was reaching into.

**多只手。** 我们还希望每个大脑能接多只手。这意味着 Claude 要推理多个执行环境、决定把活派到哪——这比在单一 shell 里操作更难。我们一开始把大脑放在单容器里，是因为早期模型做不到这件事。智能提升后，单容器反而成了限制：容器一挂，大脑伸向的每只手的状态全丢。
<br>

Decoupling the brain from the hands makes each hand a tool, `execute(name, input) → string`: a name and input go in, and a string is returned. That interface supports any custom tool, any MCP server, and our own tools. The harness doesn’t know whether the sandbox is a container, a phone, or a Pokémon emulator. And because no hand is coupled to any brain, brains can pass hands to one another.

解耦让每只手都成为一个工具 `execute(name, input) → string`：输入名字和参数，返回字符串。这个接口支持任何自定义工具、任何 MCP 服务器、以及我们自己的工具。harness 不知道沙箱是容器、手机还是宝可梦模拟器。又因为手不绑定任何大脑，大脑之间可以互相传递手。
<br>

![](https://assets.claude.com/1dff25b906f1c276cfb27c2a36638b1128dc4d2a.png?w=3840&q=75&fm=webp&fit=max)

## Conclusion / 结语

The challenge we faced is an old one: how to design a system for “programs as yet unthought of.” Operating systems have lasted decades by virtualizing the hardware into abstractions general enough for programs that didn't exist yet. With Managed Agents, we aimed to design a system that accommodates future harnesses, sandboxes, or other components around Claude.

我们面对的挑战很老：如何为「尚未被想到的程序」设计系统。操作系统靠把硬件虚拟化成足够通用的抽象，活了几十年。Managed Agents 想做的是同样的系统：能容纳未来围绕 Claude 的 harness、沙箱或其他组件。
<br>

Managed Agents is a meta-harness in the same spirit, unopinionated about the *specific* harness that Claude will need in the future. Rather, it is a system with general interfaces that allow many different harnesses. For example, Claude Code is an excellent harness that we use widely across tasks. We’ve also shown that task-specific agent harnesses excel in narrow domains. Managed Agents can accommodate any of these, matching Claude’s intelligence over time.

Managed Agents 就是一个同样精神的「元 harness」：对 Claude 未来需要*哪种* harness 不做规定，而是提供通用接口，容纳多种 harness。比如 Claude Code 是个出色的 harness，我们在各类任务里广泛使用；我们也展示了任务专用 harness 在窄领域里很擅长。Managed Agents 能容纳其中任何一种，随时间匹配 Claude 的智能水平。
<br>

Meta-harness design means being opinionated about the interfaces around Claude: we expect that Claude will need the ability to manipulate state (the session) and perform computation (the sandbox). We also expect that Claude will require the ability to scale to many brains and many hands. We designed the interfaces so that these can be run reliably and securely over long time horizons. But we make no assumptions about the number or location of brains or hands that Claude will need.

元 harness 设计意味着对 Claude 周围的接口有明确主张：我们认定 Claude 需要操作状态（会话）和执行计算（沙箱）的能力，也需要扩展到多大脑、多只手的能力。我们设计接口，让这些能在长周期里可靠、安全地运行。但对 Claude 需要多少大脑、多少只手、放在哪里，不做任何假设。
<br>

## Authors & acknowledgements / 作者与致谢

### Acknowledgements / 致谢

Written by Lance Martin, Gabe Cemaj, and Michael Cohen. Thanks to N.T.A. and Jeremy Fox for helpful conversations on these topics. Special thanks to the Agents API team and Jake Eaton for their contributions.

作者：Lance Martin、Gabe Cemaj、Michael Cohen。感谢 N.T.A. 和 Jeremy Fox 就这些话题的讨论，特别感谢 Agents API 团队和 Jake Eaton 的贡献。
