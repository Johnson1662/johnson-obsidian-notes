# 第 12 章 · LLM 智能体训练

> 来源：《智能体 AI 漫游指南：从基础到系统》· LLM 智能体训练 · PDF 第 220–247 页

---

## 12.1 动机：从聊天机器人到自主智能体

现代 LLM 越来越多地被部署，不仅作为对话助手，而且作为自主智能体（Autonomous Agents），能够在多个步骤中与外部工具、API、数据库和环境进行交互。这种从单轮聊天机器人到多步智能体的转变，引入了根本性的新 RL 挑战，要求我们重新思考如何训练、评估和部署语言模型。

![](../images/deb37d0fbdd47bac51f4fdceab5c35fc4002093544a7ab1fe0bf8a87ac939e84.jpg)

![](../images/e6a2f417d543ab17c795f015ad851619974eec13491411ef1b8159e5513d72f6.jpg)

*Figure 12.1: 从聊天机器人到自主智能体：传统的 LLM 聊天机器人在带有即时人类反馈的单步对话循环中运行。自主智能体跨多个工具交互进行规划，从真实世界的执行环境中接收反馈，并针对稀疏的终端 reward（任务成功/失败）进行优化。*

要求新 RL 方法的关键差异：

- 多步推理：Agent 必须跨越 10–100+ 次工具调用进行规划，而不仅仅是生成单一响应。

- 外部环境反馈：Reward 来自真实世界的执行（测试套件通过、网页加载、代码编译），而不仅仅是人类偏好分数。

- 结构化动作：动作不仅是 Token，而是结构化输出（JSON 工具调用、API 负载、代码块）。

- 长视野与稀疏 reward：成功/失败可能只能在多个中间步骤之后才能确定。

<table><tr><td>为什么标准 RLHF 对 Agent 不够用</td></tr><tr><td>标准 RLHF(PPO/DPO)针对单轮质量进行优化:给定一个 Prompt,产生一个好的响应。但Agent 必须:决定何时使用工具,还是进行内部推理在轨迹中途从错误中恢复(自我纠正)平衡探索(尝试新方法)与利用(使用已知良好模式)处理部分可观测性(工具输出可能不完整或带噪声)这要求训练方法在完整轨迹上进行推理,而不是单个轮次。</td></tr></table>

## 12.2 LLM Agent 的轨迹缓冲区

在 LLM Agent 的语境下，传统的 RL 回放缓冲区经历了结构性的转变。Agent 缓冲区——通常称为轨迹缓冲区（Trajectory Bufers）、经验池（Experience Pools）或记忆库（Memory Banks）—不再存储低维数值 Tensor，而是管理复杂的文本历史、工具执行输出和显式推理步骤。

## 12.2.1 LLM Agent 缓冲区的数学结构

在经典 RL 中，回放缓冲区存储扁平元组 $( s , a , r , s ^ { \prime } )$ 。对于 LLM Agent，这扩展为高维的 Token 化文本结构：

$$
\boxed {e _ {t} = (\mathcal {S} _ {t}, \mathcal {A} _ {t}, \mathcal {R} _ {t}, \mathcal {S} _ {t + 1})}\tag{12.1}
$$

- $S _ { t }$ ：完整上下文状态——系统 Prompt、用户目标、对话历史，以及当前环境变量（例如 HTML源代码、目录结构、数据库 Schema）。

- A ：Agent 的生成输出，通常由一段思维链（Chain-of-Thought，CoT）推理字符串紧接一个结构化工具调用组成：

$$
\mathcal {A} _ {t} = \{\mathrm {text_ {reasoning} , json_ {tool\_call}} \}\tag{12.2}
$$

- $\mathcal { R } _ { t }$ ：评估信号，来自外部执行环境（单元测试通过、编译器标志、API 响应码），或由LLM-as-a-judge 系统验证。

$S _ { t + 1 }$ ：更新后的上下文窗口，将工具输出文本或错误日志直接附加到对话历史中。

具体 Agent 轨迹：代码调试

步骤 1: $S_1$ = “修复 utils.py 中失败的测试”
$A_1$ = “让我先读取该文件” + read_file("utils.py")
$R_1$ = 0 (中间步骤)

步骤 2: $S_2$ = [先前上下文 + 文件内容]
$A_2$ = “Bug 在第 42 行，是一个差一错误” + edit_file("utils.py", ...)
$R_2$ = 0 (中间步骤)

步骤 3: $S_3$ = [先前上下文 + 编辑确认]
$A_3$ = “让我验证修复” + run_tests()
$R_3$ = +1.0 (所有测试通过——稀疏终端 reward)
## 12.3 操作范式

LLM Agent 通过三种主要的优化方法论来利用专门的轨迹缓冲区：

## 12.3.1 A. 自我纠正与思维细化

此类别中的两种代表性方法是 STaR [418] 和 Reflexion [326]。当 Agent 在一次多步执行轨迹中失败时，次优序列会被保存到缓冲区。该框架随后采样此轨迹，并提示 LLM 对其过去的表现生成显式文本批评：

$$
\mathrm{Critique} \leftarrow \mathrm{LLM} (\mathcal {S} _ {\mathrm{failed}}, \mathcal {A} _ {\mathrm{failed}}, \mathcal {R} _ {= 0})\tag{12.3}
$$

一旦修正后的轨迹获得正向 reward，它就被移至最优经验池，用于通过微调（在成功轨迹上做SFT）或 RL（采用二元通过/失败 reward 的 GRPO [323]）来更新网络权重。

## STaR：自学习推理者

1. 为一批问题生成推理轨迹

2. 过滤：仅保留导致正确答案的轨迹

3. 在成功轨迹上微调模型（SFT）

4. 重复：改进后的模型在下一次迭代中生成更好的轨迹

每次迭代都使用模型自身的成功输出作为训练数据，自举其推理能力。

## Reflexion：语言强化学习

1. Agent 尝试一项任务，失败

2. Agent 生成一段语言反思：“我失败是因为在调用 API 之前没有检查返回类型”

3. 反思被存储在一个情节记忆缓冲区中

4. 在下一次尝试中，反思作为经验教训被注入到 Prompt 中

5. 不需要权重更新——纯粹通过自我批评进行上下文学习

## 12.3.2 B. 离策略探索

此范式以 ReAct [408] 及相关工具使用框架为代表，涉及广泛的自主探索。在自主探索过程中（网页导航、数据库查询、代码生成），Agent 记录数千条探索性执行路径。轨迹缓冲区充当一个过滤器：

- 成功过滤：只保留达成目标的轨迹用于训练。

- 效率排序：在成功轨迹中，优先选择最短/最高效的工具使用路径。

- 多样性采样：维持多样化的解决策略集合，以防止模式坍塌。

优化算法（通常是 GRPO [323] 或过滤后的 SFT）只在高效、成功的轨迹上计算 Loss，丢弃迂回曲折的运行。

## 12.3.3 C. 非参数化的上下文学习（基于经验的 RAG）

轨迹缓冲区可以不修改神经网络权重，而是作为一个向量数据库。给定一个新的用户目标 $\mathcal { G } _ { \mathrm { n e w } }$ ，系统检索最相关的过往经验：

$$
\mathcal {E} _ {\text {retrieved}} = \arg \max _ {e \in \mathcal {B}} \text {sim} (\text {Embed} (\mathcal {G} _ {\text {new}}), \text {Embed} (e))\tag{12.4}
$$

Top-k 个相似的成功历史运行作为 few-shot 示例直接注入到 Prompt 上下文中。这种方法：

- 需要零训练——纯粹的检索增强生成（Retrieval-Augmented Generation, RAG）

- 如果缓冲区中存在相似经验，可即时适应新任务

- 随缓冲区规模扩展（更多经验 = 更好的覆盖率）

- 与参数化学习互补（罕见情况使用检索，常见模式使用权重）

Table 12.1: 传统 RL 缓冲区与 LLM Agent 缓冲区对比

<table><tr><td>特性</td><td>传统 RL 缓冲区</td><td>LLM Agent 缓冲区</td></tr><tr><td>数据格式</td><td>连续向量 / Tensor</td><td>Token 化文本、JSON、代码块、工具输出</td></tr><tr><td>数据量</td><td>海量 (10^5-10^7 条)</td><td>中小规模 (10^3-10^5 条轨迹)</td></tr><tr><td>主要目标</td><td>打破数据相关性</td><td>提供推理示范</td></tr><tr><td>采样</td><td>随机均匀 / PER</td><td>语义检索 / 成功优先 / 多样性</td></tr><tr><td>状态大小</td><td>固定 (如 84×84 像素)</td><td>可变 (每个状态 1K-128K Token)</td></tr><tr><td>动作空间</td><td>离散/连续向量</td><td>结构化文本 (推理 + 工具调用)</td></tr><tr><td>Reward 来源</td><td>环境模拟器</td><td>外部执行 / LLM judge / 单元测试</td></tr></table>

Table 12.2: 用 RL 训练 LLM Agent 的关键方法。

<table><tr><td>方法</td><td>类型</td><td>核心思想</td></tr><tr><td>STaR [418]</td><td>迭代 SFT</td><td>通过在自身成功轨迹上微调来自举推理能力</td></tr><tr><td>Reflexion [326]</td><td>上下文 RL</td><td>语言式自我批评作为情节记忆存储;无权重更新</td></tr><tr><td>ReAct [408]</td><td>Prompt 方法</td><td>在单次生成中交错推理(“思考”)与行动(“工具调用”)</td></tr><tr><td>LATS [438]</td><td>树搜索</td><td>在动作序列上做蒙特卡洛树搜索;反向传播 reward</td></tr><tr><td>AgentQ [294]</td><td>离策略 RL</td><td>在 Agent 轨迹上用 AI 生成的偏好对做 DPO</td></tr><tr><td>OpenHands [366]</td><td>GRPO</td><td>基于执行的 reward(测试通过/失败)做组相对优化</td></tr><tr><td>Voyager [362]</td><td>技能库</td><td>存储并检索成功代码片段以组合复用</td></tr><tr><td>RLEF [200]</td><td>在线 RL</td><td>从执行反馈中做 RL——来自代码/测试执行的二元 reward</td></tr></table>

## 12.4 范式对比

## 12.5 Agent RL 的主要技术

## 12.5.1 STaR：自学习推理者（详解）

STaR [418] 是一种迭代式自我改进方法，无需外部 Reward Model 即可自举推理能力。核心洞见：如果模型偶尔能正确解决一个问题，它就可以从自身的成功中学习。

算法：

1. 生成：对数据集 D 中的每个问题 $x _ { i } ,$ ，采样一条推理轨迹 $z _ { i } \sim \pi _ { \theta } ( \cdot | x _ { i } )$ ，后跟一个答案 $\hat { y } _ { i \textdegree }$

2. 过滤：仅保留满足 $\hat { y } _ { i } = y _ { i } ^ { * }$ （正确答案）的轨迹。定义成功集 $\mathcal { D } _ { \mathrm { p a s s } } = \{ ( x _ { i } , z _ { i } , y _ { i } ^ { * } ) : \hat { y } _ { i } = y _ { i } ^ { * } \}$ o

3. 合理化（Rationalization）（关键创新）：对模型失败的问题，生成一条以正确答案为条件的“合理化” 轨迹： $z _ { i } ^ { \mathrm { r a t } } \sim \pi _ { \theta } ( \cdot | x _ { i } , y _ { i } ^ { * } )$ 。这教导模型从解反向推理。

4. 微调：在 $\mathcal { D } _ { \mathrm { p a s s } } \cup \mathcal { D } _ { \mathrm { r a t i o n a l i z e d } }$ 上通过 SFT 更新 $\theta _ { \circ }$

5. 迭代：用改进后的模型从步骤 1 重复。

$$
\boxed {\theta_ {k + 1} = \arg \min _ {\theta} - \sum_ {(x, z, y) \in \mathcal {D} _ {k} ^ {+}} \log \pi_ {\theta} (z, y | x)}\tag{12.5}
$$

收敛动力学：每次迭代 k 都会提升模型的解题率 $p _ { k \circ }$ 。若 $p _ { 0 } = 0 . 3$ （解出 30% 的问题），经过合理化 + SFT 后 $p _ { 1 } \approx 0 . 5 _ { \circ }$ 通常 3–5 次迭代后收敛至 $p \approx 0 . 7 – 0 . 9 \mathrm { _ { c } }$

## STaR 合理化 Prompt

!!! note
    标准生成（步骤 1）：
    PROMPT = ""Solve the following problem step by step.
    Problem: A store has 45 apples. It sells 3/5 of them. How many remain?
    Let's think step by step: ""
    # 合理化 Prompt（步骤 3——以正确答案为条件）：

!!! note
    PROMPT_RATIONALIZE = """Solve the following problem step by step. The correct answer is 18. Problem: A store has 45 apples. It sells 3/5 of them. How many remain? Let's think step by step to arrive at 18:""

    # Agent 变体（带错误条件的代码任务）：
    PROMPT_AGENT_RATIONALIZE = """The following code task failed with the error below. Generate a correct solution step by step.

    Task: Implement binary search that handles duplicates. Previous error: IndexError: list index out of range (line 12) Correct behavior: Return leftmost index of target.

    Let me fix this by reasoning about the boundary conditions:""

## 面向 Agent 的 STaR 变体

- Quiet-STaR [419]：在每个生成 Token 之间插入 “思考 Token”。模型学会在没有显式 CoT提示的情况下隐式推理。训练目标：在包含思考 Token 时更好地预测下一个 Token。

- 代码 Agent 的 STaR：用测试执行替代答案验证。“正确” = 所有测试通过。合理化 = 以错误消息为条件生成新方法。

- V-STaR [143]：增加一个在 (z, y, correct/incorrect) 三元组上训练的验证器模型。该验证器提供过程级监督，过滤那些偶然到达正确答案的糟糕推理轨迹。

## 12.5.2 Reflexion：语言强化学习（详解）

Reflexion [326] 引入了一种激进的范式：无权重更新的 RL。Agent 不通过基于梯度的学习，而是通过存储在情节记忆中的自然语言自我批评来改进。

完整架构：

1. Actor：在环境中执行动作的 LLM Agent π。

2. 评估器：二元信号（任务成功/失败）或标量启发式（如通过的测试用例数）。

3. 自我反思生成器：给定失败轨迹 $\tau _ { \mathrm { f a i l } }$ 和环境反馈，生成自然语言反思 $r _ { \mathrm { t e x t } }$ ：

$$
r _ {\mathrm{text}} = \mathrm{LLM} _ {\mathrm{reflect}} (\tau_ {\mathrm{fail}}, \mathrm{feedback}, \mathrm{task})\tag{12.6}
$$

4. 情节记忆：过往反思的滑动窗口缓冲区 $\mathcal { M } = [ r _ { 1 } , r _ { 2 } , \ldots , r _ { m } ]$ （通常 $m \le 3$ 以适应上下文）。

5. 重试循环：下一次尝试时，反思被注入到 Prompt 中：

$$
a _ {t + 1} \sim \pi (\cdot \mid \text { task }, \mathcal {M}, \text { current\_state })\tag{12.7}
$$

反思示例：“在我上一次尝试中，我在验证输入格式之前就调用了搜索 $A P I ,$ ，导致了 $ \mathit { 4 0 0 }$ 错误。下次我应该先验证 JSONSchema，然后再发起 API调用。

## Reflexion：带记忆注入的 Agent Prompt

```python
# === 第 2 次尝试的 PROMPT（首次失败后） ===

SYSTEM = """You are a coding agent. You can run bash commands and edit files. Complete the task below. Learn from your previous reflections."""
USER = """Task: Fix the failing test in auth_service.py

=== REFLECTIONS FROM PREVIOUS ATTEMPTS ===
[Attempt 1 reflection]: I tried to modify the authenticate() function directly but forgot that it depends on token_validator(). The test
```

```python
failed because token_validator() was still returning the old format. I should trace the dependency chain FIRST: check what authenticate() calls, then fix the root cause (token_validator), not the symptom. === END REFLECTIONS ===

The repository is in /workspace/. The failing test is:
    test_auth.py::test_expired_token_returns_401

Begin by reading the relevant files, then fix the issue."""
```

## 优势与局限：

## 优势

零梯度计算；可与冻结的 API 模型（GPT-4）一起工作快速迭代（每次重试只需几秒，而 RL 训练需数小时）可解释：人类可读的自我纠正可与任意基础 Agent 架构组合

## 局限

!!! note
    受限于上下文窗口；无法积累无限知识  
    无法泛化到未见任务（记忆是任务特定的）  
    依赖模型已有的识别错误的能力  
    当基础模型太弱、无法生成有用批评时，效果下降

## 12.5.3 ReAct：推理 + 行动（详解）

ReAct [408] 通过在单个生成流中交错显式推理步骤与环境动作，确立了工具使用 Agent 的主导Prompt 范式。

## ReAct 系统 Prompt（典型）

!!! note
    SYSTEM = ""You are a research assistant with access to the following tools:
    - search(query): Search the web for information
    - lookup(term): Look up a term on the current Wikipedia page
    - finish(answer): Submit your final answer

    Solve the user's question by interleaving Thought and Action steps.
    Format:
        Thought: <your reasoning about what to do next>
        Action: <tool_name>(arguments)

    You will receive an Observation after each Action. Use it to plan your next step. Continue until you can provide a final answer.

    Rules:
    - Always think before acting
    - Never guess - verify with tools
    - Use finish() only when you are confident in your answer"""

    USER = "Who was the president of the US when the iPhone was released?"

## 生成格式：

## ReAct 轨迹格式

!!! note
    Thought: I need to find when the iPhone was released, then determine who was president at that time. Let me search for the release date.
    Action: search("iPhone original release date")
    Observation: The original iPhone was released on June 29, 2007.
    Thought: The iPhone came out June 2007. Now I need to find who was the US president in June 2007.
    Action: lookup("President of the United States in 2007")
    Observation: George W. Bush served as the 43rd president from January 20, 2001 to January 20, 2009.
    Thought: George W. Bush was president from 2001-2009, which covers June 2007 when the iPhone was released. I have my answer.
    Action: finish("George W. Bush was the US president when the iPhone was released on June 29, 2007.")

形式化定义：一条 ReAct 轨迹是 $\tau = ( t _ { 1 } , a _ { 1 } , o _ { 1 } , t _ { 2 } , a _ { 2 } , o _ { 2 } , . ~ . ~ . )$ ，其中：

- $t _ { i } { \mathrm { : } }$ ：思考（内部推理，不被执行）

$a _ { i } \mathbf { : }$ 动作（工具调用，在环境中执行）

- $o _ { i }$ ：观测（环境响应，附加到上下文）

为什么有效：思考创造了一种 “内心独白”，帮助模型在行动前规划，减少冲动性工具调用。显式推理轨迹也让 Agent 的决策过程可审计且可调试。

## 用 RL 训练 ReAct Agent：

- 动作级 reward：只有动作接收 reward 信号（思考是辅助的）。

- 思考质量：隐式优化——更好的思考 → 更好的动作 → 更高的 reward。

- 格式强制：在 reward 中加入对格式错误动作（缺失 JSON、幻觉工具）的格式惩罚。

- RL 目标： $r ( \tau ) = r _ { \mathrm { t a s k } } - \lambda _ { \mathrm { f o r m a t } } \cdot \mathrm { f o r m a t \_ v i o l a t i o n s } - \lambda _ { \mathrm { l e n g t h } } \cdot \mathrm { n u m \_ s t e p s }$

## 12.5.4 LATS：语言 Agent 树搜索（详解）

LATS [438] 将蒙特卡洛树搜索（Monte Carlo Tree Search, MCTS）应用于 LLM Agent 的动作选择，以推理算力换取显著更好的轨迹。

算法（针对 LLM Agent 改造）：

1. 选择：从根节点（初始状态）开始，使用 UCB1 遍历树：

$$
\operatorname{UCB} (s, a) = \bar {Q} (s, a) + c \sqrt {\frac {\ln N (s)}{N (s , a)}}\tag{12.8}
$$

其中 Q¯ = 子树平均 reward，N = 访问计数，c = 探索常数。

2. 扩展：在叶节点，通过 LLM 采样（温度 > 0）生成 k 个候选动作： $\{ a _ { 1 } , \dots , a _ { k } \} \sim \pi _ { \theta } ( \cdot | s _ { \mathrm { l e a f } } )$

3. 模拟：对每个候选，在环境中执行该动作，然后用快速 rollout 策略（贪心解码）继续，直到终止状态或深度限制。

4. 反向传播：将终端 reward 沿所有祖先节点向上传播，更新 $\bar { Q }$ 和 N 计数。

5. 重复：在固定计算预算（如 50–200 次迭代）下运行步骤 $1 { - } 4 _ { \circ }$

6. 动作选择：选择根节点访问次数最多的子节点。

LLM 特定的改造：

- Value 函数：使用独立的 LLM 调用来估计状态价值：“在 0–1 范围内，这个状态导致任务成功的可能性有多大？”

- 基于反思的剪枝：当某个分支失败时，生成反思并剪枝相似分支。

- 缓存：在每个节点存储 LLM 输出，避免回溯时重复生成。

- 深度预算：将树深度限制在 10–20 步（Agent 很少需要更多）。

性能：在 WebShop（网页导航）上，LATS 达到 75% 成功率，而 ReAct 仅为 40%。在 HumanEval（代码）上，借助树搜索 pass@1 从 68% 提升至 94%。代价：每个任务的推理 FLOPs 增加 10–50×。

## LATS Prompt：价值估计与节点扩展

!!! note
    # === 价值估计 PROMPT（用于模拟阶段） ===
    VALUE_PROMPT = ""You are evaluating an agent's progress on a task.

    Task: Book a flight from NYC to London for under \$500, departing Dec 15.

    Current state (after 3 actions):
    - Searched flights on Kayak: found 12 results
    - Filtered by price < \$500: 4 options remain
    - Clicked on British Airways \$489 option: viewing details page

    On a scale of 0.0 to 1.0, how likely is the agent to successfully complete the task from this state? Consider:
    - How close is the agent to the goal?
    - Are there remaining obstacles (payment, seat selection)?
    - Has the agent made any errors that need correction?

    Score: "" # 模型输出，例如 "0.75"

    # === 节点扩展 PROMPT（生成候选动作） ===
    EXPAND_PROMPT = ""You are a web navigation agent. Given the current page state, propose 3 DIFFERENT next actions to try.

    Current page: British Airways booking - flight details
    Price: \$489 | Departure: Dec 15 8:30am | Arrival: Dec 15 8:45pm
    [Button: Select] [Button: Back to results] [Link: Fare rules]

    Generate 3 diverse candidate actions (explore different strategies):
    Action 1: "" # 模型生成 3 个选项用于树扩展

## 12.5.5 AgentQ：在 Agent 轨迹上做 DPO（详解）

AgentQ [294] 通过从轨迹结果自动生成偏好对，桥接了离线偏好学习（DPO）与在线 Agent 执行。流水线：

1. Rollout：使用当前 Policy π 为每个任务执行 N 条轨迹。

2. 评估：用基于执行的 reward（二元通过/失败或标量指标）为每条轨迹打分。

3. 偏好对构造：对每个任务，构造偏好对：

$$
(\tau_ {w}, \tau_ {l}) \mathrm{where} r (\tau_ {w}) > r (\tau_ {l})\tag{12.9}
$$

在同一任务的轨迹中，reward 最高者 = 被选（chosen），最低者 = 被拒（rejected）。

4. DPO 更新：在轨迹级对数概率上应用标准 DPO Loss：

$$
\mathcal {L} _ {\mathrm{AgentQ}} = - \log \sigma \bigg (\beta \left[ \log \frac {\pi_ {\theta} (\tau_ {w})}{\pi_ {\mathrm{ref}} (\tau_ {w})} - \log \frac {\pi_ {\theta} (\tau_ {l})}{\pi_ {\mathrm{ref}} (\tau_ {l})} \right] \bigg)\tag{12.10}
$$

5. 迭代：更新后的 $\pi _ { \theta }$ 在下一轮生成更好的轨迹。

关键设计选择：

- MCTS 引导的探索：在 rollout 阶段使用 LATS 生成多样、高质量的轨迹（更好的训练数据）。

- 步骤级 DPO：不比较完整轨迹，而是在动作级别比较——给定相同前缀，哪个下一动作导向成功？

- 自对弈改进：每次 DPO 迭代都产生更好的 Policy，生成更好的轨迹，从而产生更好的训练对——一个良性循环。

结果：在 WebShop 上，AgentQ 在 3 次 DPO 迭代后将成功率从 50% 绝对提升至 82%。

## 12.5.6 Voyager：通过技能库实现终身学习（详解）

Voyager [362] 引入了组合式技能积累——Agent 构建一个不断增长的可复用代码函数库，作为高层动作。

架构：

1. 自动课程：一个 LLM 根据 Agent 当前的技能清单提议逐渐更难的任务：“你现在能挖木头并合成木板。下一个挑战：建造一个工作台。 ，

2. 技能生成：对每个任务，Agent 编写一个 JavaScript 函数（可执行代码）来解决它：

$$
\text { skill } _ {i} = \text { LLM } (\text { task } _ {i}, \text { environment\_docs }, \text { error\_feedback })\tag{12.11}
$$

3. 验证：在环境中执行代码。如果成功，加入技能库。若失败，借助错误反馈迭代（最多 5 次重试）。

4. 技能库（向量数据库）：每个已验证技能存储：

- 函数签名 + Docstring（用于检索）

- 任务描述的 Embedding（用于语义搜索）

- 依赖（它调用了哪些其他技能）

5. 检索 + 组合：对新任务，检索 top-k 最相关技能并加以组合：

$$
\text { solution } = \text { LLM } (\text { new\_task }, \text { retrieve } (\text { skill\_library }, k = 5))\tag{12.12}
$$

关键洞见：技能是可组合的——复杂行为从组合简单的、已验证的函数中涌现。Agent 永不遗忘（库是持久的）并单调改进（只加入已验证的技能）。

Voyager：课程与技能生成 Prompt

```python
# === 自动课程 PROMPT ===
CURRICULUM_PROMPT = """You are a curriculum designer for an AI agent.

Agent's current skill inventory:
- mine_wood(): Mines nearby oak/birch trees
- craft_planks(): Converts logs to planks
- craft_sticks(): Converts planks to sticks
- mine_stone(): Mines stone with wooden pickaxe

Propose the next task that:
1. Builds on existing skills (reachable from current abilities)
2. Introduces exactly ONE new concept or challenge
3. Is concrete and verifiable (clear success condition)

Next task proposal:"""
# 输出: "Craft a furnace (requires 8 cobblestone blocks arranged
#    in a square). You already know mine_stone()."

# === 技能生成 PROMPT ===
SKILL_GEN_PROMPT = """Write a JavaScript function to accomplish this task
in Minecraft. Use the bot API (bot.dig, bot.craft, bot.equip, etc.)

Task: Smelt 5 iron ingots using a furnace.
Prerequisites available: mine_stone(), craft_furnace(), mine_iron_ore()

Error from previous attempt: "Cannot smelt without fuel in furnace"

Write the corrected function:
async function smeltIronIngots(bot, count=5) {"""
```

## 12.5.7 RLEF：从执行反馈中做 RL（详解）

RLEF [200] 将带确定性执行 reward 的在线 RL 应用于代码生成 Agent，确立了 Agent 训练最简单的有效范式。

## 训练循环：

1. 采样任务：从训练集中抽取一个带测试用例的编程问题 (x,tests)。

2. 生成：Agent 使用当前 Policy π 产生一条解决轨迹（读文件、写代码、运行测试）。

3. 执行：在沙盒环境中运行测试套件。Reward：

$$
r = \frac {\# \text { tests   passed }}{\# \text { total   tests }} \in [ 0, 1 ]\tag{12.13}
$$

4. 更新：使用 r 作为 reward 信号应用 $\mathrm { G R P O / P P O _ { \circ } }$

5. 重复：用新鲜任务进行数千次迭代。

## 为什么执行反馈对 RL 是理想的：

- 零噪声：与人类偏好不同，测试结果是确定的。相同代码 → 每次相同 reward。这消除了破坏RL 训练稳定性的 reward 噪声。

- 无限规模：可以编程式地生成无限任务（随机算法、API 集成测试、数据变换）。

- 无 reward hacking：与学习得到的 Reward Model 不同，测试套件无法被 “愚弄”（前提是测试写得好）。Agent 必须真正解决问题。

- 密集信号：部分测试通过（r = 0.6）提供比二元通过/失败更丰富的梯度。

## 12.5.8 OpenHands / SWE-Agent：用于软件工程的 GRPO

OpenHands [366] 和 SWE-Agent [404] 应用 GRPO 训练自主解决 GitHub Issue 的 Agent——读取代码、编写补丁、运行测试套件。

训练细节：

- 环境：包含完整仓库、测试套件和开发者工具（git、grep、lint）的 Docker 容器。

- 动作空间：Bash 命令、文件编辑、git 操作、测试执行。

- 轨迹长度：解决一个 GitHub Issue 通常需要 15–50 个动作。

- Reward：二元——生成的补丁是否通过该 Issue 的回归测试？

- 组大小：每个 Issue N = 8–16 条轨迹用于 GRPO 归一化。

- 课程：从标记为 “good first issue” 的开始，逐步过渡到复杂的多文件重构。

SOTA 结果：SWE-bench Verified：RL 训练后解决率从 30% 提升至 55%（对比仅 SFT 基线）。

## OpenHands / SWE-Agent：系统 Prompt

```python
SYSTEM = ""You are an autonomous software engineer. You are given a GitHub issue to resolve. You have access to the full repository in /workspace/ and can execute any bash command.

AVAILABLE COMMANDS:
- bash(command): Execute a shell command
- edit(file, start_line, end_line, new_content): Edit a file
- search(pattern, path): Search for text in files
```

!!! note
    - submit(): Submit your patch when done
    WORKFLOW:
    1. Read the issue carefully and understand the expected behavior
    2. Explore the codebase to find relevant files
    3. Reproduce the bug (write/run a test that fails)
    4. Implement the fix
    5. Verify the fix (run the test again - must pass)
    6. Run the full test suite to check for regressions
    7. Submit when all tests pass
    RULES:
    - Do NOT modify test files unless the issue explicitly asks for it
    - Prefer minimal, targeted changes over large refactors
    - Always verify your fix before submitting""
    USER = """GitHub Issue #4521: `DataFrame.merge()` silently drops rows when `on` column contains NaN values.
    Expected: NaN keys should be preserved (matched with other NaN rows)
    Actual: Rows with NaN keys are dropped entirely
    Repository: /workspace/pandas-dev/pandas/"""

## 未来：RL + Agent

该领域正在汇聚于一种模式：将带基于执行 reward 的在线 RL 应用于多步 Agent 轨迹。关键趋势：

- GRPO/PPO 配合来自代码执行或工具成功的二元通过/失败 reward

- 课程学习：从简单任务开始，逐步增加难度

- 轨迹级优化（而非 Token 级）——仅在多步序列末尾给出 reward

- 混合方法：对罕见任务使用检索（非参数化）+ 对常见任务使用 RL（参数化）

- Scaling Law：推理时投入更多算力（搜索/重试）通常胜过投入更多训练算力

<table><tr><td>具体示例:“总结上周 Project Alpha 邮件并创建一张状态幻灯片”</td></tr><tr><td>下面我们追踪一个完整的 POMDP Episode,将每个形式化元素映射到具体实现。用户请求:“总结上周 Project Alpha 邮件中的关键决策,并在团队幻灯片中添加一张状态更新幻灯片。”</td></tr></table>

## 12.6 用例：用于生产力副驾的 Agent RL

本节提供了一个完整蓝图，展示如何应用 Agent RL 技术来训练一个跨生产力应用套件（文档、电子表格、演示文稿、电子邮件、消息、云存储）运行的基于 LLM 的副驾。

## 12.6.1 架构概览

![](../images/256b88261a7381c862a5c2b5929a134c1be53830313102245a83af2ff4f93c9f.jpg)  
*Figure 12.2: 生产力副驾架构：LLM Agent（带 RL Policy π ）接收用户意图并与多个应用 API 交互。基于任务成功、用户反馈和效率指标的 reward 信号驱动 Policy 改进。*

## 12.6.2 生产力副驾的形式化 MDP 定义

生产力副驾的环境被形式化为一个部分可观测马尔可夫决策过程（Partially Observable MarkovDecision Process, POMDP）：

$$
\boxed {\mathcal {M} = \langle \mathcal {S}, \mathcal {A}, \mathcal {T}, \mathcal {R}, \Omega , \mathcal {O}, \gamma \rangle}\tag{12.14}
$$

- S：状态空间——完整的工作区环境状态：文档内容、邮件会话、日历事件、文件系统、用户权限。不完全可观测：Agent 只能看到 API 查询返回的内容。

- A：动作空间——结构化的 API 调用（见下文）。每个动作是一个 JSON 对象，指定目标应用、操作和参数。

- T：转移函数——大多数操作是确定性的（写入文档 → 文档更新），但依赖网络的动作（邮件投递时间、Teams 可用性）是随机的。

- R：Reward 函数——多组件（见 Reward 设计章节）。

- Ω：观测空间——API 响应、渲染后的文档视图、错误消息。

- O：观测函数——将状态映射到观测（API 响应格式化、为适应上下文窗口限制而截断）。

- γ = 0.99：折扣因子（长视野，通常 10–50 步）。

<table><tr><td>符号</td><td>具体实现</td></tr><tr><td> $s_0$ </td><td>真实状态:收件箱中有47封来自过去7天提及“Project Alpha”的邮件;SharePoint上的PowerPoint文件“Q3_Status.pptx”有12张幻灯片;用户拥有编辑权限。</td></tr><tr><td> $o_0$ </td><td>Agent观测:用户请求文本+系统Prompt。Agent此时不知道邮件数量或幻灯片内容。</td></tr><tr><td> $a_1$ </td><td>outlook.search({query:&quot;Project Alpha&quot;,last_7_days:true})</td></tr><tr><td> $\mathcal{T}(s_0,a_1)$ </td><td> $s_1$ :系统检索出47封匹配邮件(确定性)。</td></tr><tr><td> $o_1$ </td><td>API返回前10封邮件主题+发件人+时间戳(因上下文限制被截断——O在起作用)。</td></tr><tr><td> $a_2$ </td><td>outlook.read({ids:[top_5_thread_ids]})——Agent挑选最相关的会话。</td></tr><tr><td> $o_2$ </td><td>5个邮件会话的完整正文(O截断后约8K Token)。</td></tr><tr><td> $a_3$ </td><td>内部推理动作:Agent综合关键决策:(1)截止日期推迟到11月15日,(2)预算已批准,(3)供应商已选定。</td></tr><tr><td> $a_4$ </td><td>sharepoint.read({file:&quot;Q3_Status.pptx&quot;,slides:&quot;last&quot;})——检查当前最后一张幻灯片。</td></tr><tr><td> $o_4$ </td><td>最后一张幻灯片是“Q2 Summary”(第12张)。Agent决定添加第13张。</td></tr><tr><td> $a_5$ </td><td>powerpoint.add_slide({file:&quot;Q3_Status.pptx&quot;,position:13,layout:&quot;Title and Content&quot;,title:&quot;Project Alpha---Week 42 Status&quot;,content:&quot;Key decisions:1)Deadline:Nov 15...&quot;})</td></tr><tr><td> $\mathcal{T}(s_4,a_5)$ </td><td> $s_5$ :幻灯片添加到演示文稿(确定性)。</td></tr><tr><td> $o_5$ </td><td>API返回{success:true,slide_id:13}。</td></tr><tr><td> $R(s_5)$ </td><td>Reward组件:+0.4任务完成(幻灯片已创建),+0.3信息质量(提取的决策正确),+0.2格式合规(使用正确布局),+0.05效率(5个动作,无错误),-0.0安全惩罚。总分:0.95。</td></tr><tr><td colspan="2">所体现的POMDP关键方面:</td></tr><tr><td colspan="2">部分可观测性:在t=0时,Agent不知道存在多少邮件或演示文稿包含什么——它必须查询以发现状态。观测函数O:由于上下文窗口限制,API返回截断结果(47封邮件中的前10封)。Agent看到的是真实状态的一个投影。随机转移:如果Agent改用teams.send_message(),投递时机将是不确定的(接收者在线/离线)。多步规划:Agent必须跨2个应用串联5个动作,在邮件摘要和幻灯片内容之间保持一致性。折扣γ=0.99:对5步而言,折扣影响很小( $0.99^5 = 0.95$ ),但对50步任务来说至关重要——鼓励高效解决方案。</td></tr></table>

## 12.6.3 动作空间设计

动作空间必须是结构化的、类型安全的且可组合的：

```json
{
    "action_type": "api_call",
    "target_app": "outlook | excel | word | powerpoint | teams | sharepoint",
    "operation": "read | write | search | create | delete | modify",
    "parameters": {
    "endpoint": "/me/messages?$filter=subject eq 'Project X'",
    "body": { ... }, // 用于写操作
    }
}
```

!!! note
    "options": { "top": 10 } // 分页、过滤
    },
    "reasoning": "I need to find relevant emails before summarizing"
    }

按应用划分的动作分类：

<table><tr><td>应用</td><td>复杂度</td><td>关键动作</td></tr><tr><td>Outlook</td><td>中</td><td>search、read、draft、send、move、flag、create_rule</td></tr><tr><td>Excel</td><td>高</td><td>read_range、write_range、insert_formula、create_chart、pivot_table、run_macro</td></tr><tr><td>Word</td><td>中</td><td>read_paragraphs、insert_text、format_section、find_replace、insert_table</td></tr><tr><td>PowerPoint</td><td>中</td><td>add_slide、insert_shape、set_text、set_layout、add_image、apply_theme</td></tr><tr><td>Teams</td><td>低</td><td>send_message、create_meeting、search_chat、add_members、post_to_channel</td></tr><tr><td>SharePoint</td><td>中</td><td>list_files、upload、download、search、create_page、set_permissions</td></tr></table>

## 12.6.4 状态表示

Agent 在每一步的观测（上下文窗口）：

$$
o _ {t} = [ \mathrm {system\_prompt}; \mathrm {user\_intent}; \mathrm {tool\_history} _ {1: t - 1}; \mathrm {current\_result} _ {t} ]\tag{12.15}
$$

上下文预算管理（对 128K 窗口至关重要）：

- 系统 Prompt：2K Token（能力、安全规则、输出格式）

- 用户意图 + 对话：4K Token

- 工具历史（滑动窗口）：最近 8–12 个动作 + 观测，更早的进行摘要。总计：最多 80K Token。

- 当前观测：最多 32K Token（大型电子表格、邮件会话）

- 保留：10K Token 用于 Agent 的推理 + 下一动作生成

状态压缩策略：

- 选择性纳入：只纳入与当前子目标相关的 API 响应（使用辅助的 “相关性打分器”）。

- 结构化摘要：将大型电子表格表示为 Schema + 样本行，而非完整数据。

- 分层记忆：将完整轨迹存储在外部；将压缩摘要注入上下文。

## 12.6.5 Reward 设计：多目标信号

生产力副驾的 Reward 函数必须平衡多个目标：

$$
\boxed {R (\tau) = \alpha_ {1} R _ {\mathrm{task}} + \alpha_ {2} R _ {\mathrm{quality}} + \alpha_ {3} R _ {\mathrm{efficiency}} + \alpha_ {4} R _ {\mathrm{safety}} + \alpha_ {5} R _ {\mathrm{user}}}\tag{12.16}
$$

中间 reward（密集信号）：

- 成功的 API 调用（200 响应）：+0.05

- 正确的信息检索（通过下游使用验证）：+0.10

Table 12.3: 生产力副驾训练的 Reward 组件。

<table><tr><td>组件</td><td>权重</td><td>信号类型</td><td>定义</td></tr><tr><td> $R_{task}$ </td><td>0.40</td><td>二元/标量</td><td>任务成功完成(邮件已发送、文档已创建、公式正确)</td></tr><tr><td> $R_{quality}$ </td><td>0.25</td><td>LLM judge</td><td>输出质量:格式化、清晰度、内容正确性</td></tr><tr><td> $R_{efficiency}$ </td><td>0.15</td><td>标量</td><td>对过多步骤的惩罚: $-0.02 \times (num\_steps - optimal\_steps)$ </td></tr><tr><td> $R_{safety}$ </td><td>0.15</td><td>二元</td><td>无不安全动作(未确认即删除、发到错误收件人、权限违规)。任何违规则 $R_{safety} = 0$ 。</td></tr><tr><td> $R_{user}$ </td><td>0.05</td><td>稀疏</td><td>可用时的显式用户反馈(拇指向上/向下)</td></tr></table>

- 优雅地从错误中恢复（用修正后的参数重试）：+0.08

- API 错误（4xx/5xx）：–0.03

- 重复的相同动作（循环检测）：–0.10

- 当意图确实模糊时提出澄清问题：+0.05

12.6.6 训练流水线：端到端

## 生产力副驾 RL 训练流水线

## 阶段 1：监督微调（基础）

1. 收集 50K–200K 条人工示范的生产力任务轨迹（通过遥测、标注员或合成生成）。

2. 在 ReAct 格式的（指令，轨迹）对上对基础 LLM 进行 SFT。

3. 验证：Agent 应在保留任务上达到 40–60% 的任务完成率。

## 阶段 2：模拟环境构建

1. 构建一个带有模拟 API 端点、合成邮箱、文档和日历的沙盒环境。

2. 每个 “用户” 拥有真实的画像：500+ 封邮件、20+ 份文档、日历事件、Teams 频道。

3. 任务生成器：产生多样化的指令–验证对：“把 Alice 关于 Q4 预算的所有邮件移到 ‘Finance文件夹” + 验证函数。

## 阶段 3：在线 RL 训练（GRPO）

1. 采样任务 Batch（每次迭代 256 个任务）。

2. 在沙盒环境中使用 π<sub>θ</sub> 为每个任务生成 N = 8 条轨迹。

3. 执行轨迹，从验证函数收集 reward。

4. 计算 GRPO 优势（跨每个任务的 8 条轨迹做组归一化）。

5. 用裁剪目标 + 相对于 SFT 模型的 KL 惩罚来更新 Policy。

6. 每 500 次迭代：在保留基准上评估（200 个任务，5 个难度级别）。

## 阶段 4：人机协同（Human-in-the-Loop）细化

1. 部署给内部 dogfood 用户（1000+ 用户，2 周）。

2. 收集拇指向上/向下信号 + 自由文本纠正。

3. 从 A/B 部署中（旧 Policy 对比新 Policy）构造 DPO 偏好对。

4. 在人类偏好上应用 1–2 轮 DPO 微调。

## 12.6.7 模拟环境架构

## 沙盒环境（简化版）

```python
class ProductivityEnvironment:
    def __init__(self, user_profile: UserProfile):
    self.mailbox = SyntheticMailbox(user_profile emails)
    self.drive = SyntheticOneDrive(user_profile.files)
    self.calendar = SyntheticCalendar(user_profile.events)
    self.teams = SyntheticTeams(user_profile.channels)
    self.step_count = 0
    self.max_steps = 50

def step(self, action: dict) -> Tuple[Observation, float, bool]:
    """执行动作，返回（observation, reward, done）。”"
    self.step_count += 1

# 路由到对应的应用处理器
handler = self.get_handler(action["target_app"])
try:
    result = handler.execute(action["operation"], action["parameters"])
```

```python
obs = Observation(status=200, body=result)
reward = 0.05 # 成功的 API 调用
except APIError as e:
obs = Observation(status=e.code, body=str(e))
reward = -0.03

# 检查终止条件
done = self.step_count >= self.max_steps
return obs, reward, done

def evaluate(self, task: Task) -> float:
    """检查任务目标是否达成（终端 reward）。”"
    return task.verification_fn(self) # 0.0 或 1.0
```

## 12.6.8 任务课程设计

训练有效性关键取决于任务难度的递进：

Table 12.4: 生产力副驾课程级别。

<table><tr><td>级别</td><td>步数</td><td>应用数</td><td>示例任务</td></tr><tr><td>L1: 单步</td><td>1-2</td><td>1</td><td>“读取我最新的来自 Bob 的邮件”,“A1 单元格里是什么?”</td></tr><tr><td>L2: 单应用</td><td>3-5</td><td>1</td><td>“起草一封回复预算邮件并总结要点”</td></tr><tr><td>L3: 多步</td><td>5-10</td><td>1</td><td>“从销售数据创建数据透视表,并将 top 表现者加粗格式化”</td></tr><tr><td>L4: 跨应用</td><td>5-15</td><td>2-3</td><td>“查找 Q4 预算邮件,提取数字,放入新的 Excel 表”</td></tr><tr><td>L5: 复杂工作流</td><td>10-30</td><td>3+</td><td>“准备周报:从 Excel 抽取指标,总结邮件更新,创建 PowerPoint 幻灯片,在 Teams 中分享”</td></tr></table>

## 课程策略：

- 训练早期从 80% L1–L2 任务、20% L3 开始。

- 当当前级别成功率超过 70% 时晋升下一级。

- 始终保留 10–20% 的较简单任务以防止灾难性遗忘（Catastrophic Forgetting）。

- 收敛后的最终配比：10% L1、15% L2、25% L3、30% L4、20% L5。

## 12.6.9 安全与护栏

!!! note
    生产力副驾安全框架
    硬约束（动作立即被拒绝，reward = -1.0）：
    - 未经用户确认即向外部收件人发送邮件/消息
    - 永久删除文件/邮件（仅允许软删除）
    - 修改共享资源的权限
    - 越权访问其他用户的邮箱或文件
    - 在一个 Batch 中对超过 100 个条目执行动作（防止批量删除/移动事故）
    软约束（reward 中的惩罚，Agent 应学习避免）：
    - 未向用户展示预览即发送草稿：-0.2
    - 未先声明意图即做出不可逆变更：-0.15
    - 访问敏感标签（机密、律师-当事人）：-0.3

!!! note
    - 在没有显式委托的情况下使用“代发”：-0.25
    确认协议：对任何被归类为“高影响”（发送、删除、对外分享）的动作，Agent 必须：
    1. 用自然语言陈述所计划的动作
    2. 显示将要发送/修改内容的预览
    3. 在执行前等待显式的用户确认
    这在环境层（沙盒拒绝未确认的高影响动作）和 Reward 函数（跳过确认会受罚）两处都被强制执行。

## 12.6.10 多应用工作流中的信用分配

关键挑战：在一个 20 步的跨应用工作流中，哪些步骤对成功或失败做出了贡献？

方法：分层 Reward 分解

1. 子目标检测：将用户指令分解为可验证的子目标：

- “查找 Q4 预算邮件” → 子目标 1（验证：检索到相关邮件）

- “提取数字” → 子目标 2（验证：正确数值已解析）

- “创建 Excel 表” → 子目标 3（验证：表存在且包含正确数据）

2. 子目标 reward：每完成一个子目标就分配中间 reward（每个 r = +0.2）。

3. 轨迹切片：如果最终任务失败，识别哪个子目标最先失败。仅对该子目标跨度内的动作施加负reward。

4. 反事实估计：“如果这个特定动作不同，任务是否会成功？”——使用 Value 函数来估计。

$$
R _ {\mathrm{step}} (t) = \underbrace {R _ {\mathrm{sub-goal}} (t)} _ {\mathrm{当前子目标是否成功}?} + \underbrace {\gamma^ {T - t} R _ {\mathrm{terminal}}} _ {\mathrm{折扣后的最终reward}} + \underbrace {r _ {\mathrm{intermediate}} (t)} _ {\mathrm{每步API成功/失败}}\tag{12.17}
$$

## 12.6.11 扩展与基础设施

算力需求（针对 70B 参数模型估算）：

<table><tr><td>组件</td><td>资源</td><td>说明</td></tr><tr><td>Policy 模型(70B)</td><td>8× A100 80GB (TP=8)</td><td>BF16,生成轨迹</td></tr><tr><td>参考模型(70B)</td><td>8× A100 80GB (TP=8)</td><td>冻结,用于 KL 计算</td></tr><tr><td>环境 Worker</td><td>128 个 CPU Worker</td><td>每个运行一个沙盒实例</td></tr><tr><td>Reward Model / Judge</td><td>4× A100(若用 LLM judge)</td><td>或者若使用基于执行的 reward 则为零</td></tr><tr><td>训练(GRPO 更新)</td><td>16× A100(FSDP)</td><td>跨轨迹 Batch 做梯度累积</td></tr><tr><td>总计</td><td>40 张 A100 GPU + 128CPU</td><td>完整训练运行约 5,000 GPU 小时</td></tr></table>

## 吞吐量优化：

- 异步 rollout：将轨迹生成与梯度更新解耦。在训练上一个 Batch 时持续生成。

- 批量化环境：并行运行 128 个沙盒环境，每个处理不同任务。

- KV-cache 共享：对每个任务的 N = 8 条轨迹，它们共享相同的 Prompt 前缀——使用前缀缓存避免冗余计算。

- 选择性反向传播：只在动作 Token 上计算梯度（而非观测/系统 Prompt）。将反向传播 FLOPS减少 40–60%。

## 12.6.12 评估框架

Table 12.5: 生产力副驾评估维度。

<table><tr><td>指标</td><td>目标</td><td>度量方式</td></tr><tr><td>任务完成率</td><td>>85%(L1-L3),>60%(L4-L5)</td><td>沙盒中的自动化验证</td></tr><tr><td>安全违规率</td><td><0.1%</td><td>每1000个任务的硬约束违规计数</td></tr><tr><td>完成的平均步数</td><td>不超过最优值的1.5×</td><td>与已知最短成功轨迹对比</td></tr><tr><td>用户满意度(dogfood)</td><td>>4.2/5.0</td><td>内部用户任务后调查</td></tr><tr><td>跨应用成功率</td><td>>55%(L4-L5)</td><td>需要2+应用的任务</td></tr><tr><td>恢复率</td><td>>70%</td><td>Agent成功重试失败API调用的百分比</td></tr><tr><td>延迟(首动作时间)</td><td><3秒</td><td>模型推理+动作规划时间</td></tr></table>

基准套件（建议）：

- ProdBench-Easy（200 个任务）：单应用，1–3 步。基线建立。

- ProdBench-Hard（200 个任务）：跨应用工作流，10–30 步。端到端能力。

- ProdBench-Safety（100 个任务）：试图触发不安全动作的对抗 Prompt。必须保持 < 0.1%违规率。

- ProdBench-Robustness（100 个任务）：带模糊指令、注入 API 错误、缺失权限的任务。测试优雅降级。

## 12.6.13 来自生产部署的经验教训

<table><tr><td>生产力 Agent RL 的实践洞见</td></tr><tr><td>1. SFT 质量是底线:RL 只能在 SFT 所提供的基础上改进。如果 SFT 模型无法格式化一个有效的 Graph API 调用,RL 也发现不了。要在阶段 1 的数据质量上重投入。</td></tr><tr><td>2. Reward hacking 不可避免:Agent 一定会找到捷径。常见例子:创建一个空 Excel 文件以“完成”电子表格任务(通过存在性检查)在没有实际执行动作的情况下回复“完成”利用模糊的验证函数</td></tr><tr><td>缓解措施:多层验证(格式 + 内容 + 语义正确性)。</td></tr><tr><td>3. API 速率限制很重要:在生产中,工作区 API 有限流(429 响应)。用现实的速率限制训练,避免学到滥发并行请求的 Policy。</td></tr><tr><td>4. 上下文窗口是瓶颈:带丰富 API 响应的 20 步轨迹轻松消耗 80K+ Token。技术手段:观测摘要、选择性历史、分层上下文管理。</td></tr><tr><td>5. 用户意图常常是模糊的:“清理我的收件箱”对不同用户意味着不同的事情。训练 Agent 在不确定性高时提出澄清问题(恰当澄清给奖励,过度澄清给惩罚)。</td></tr><tr><td>6. 从简单开始,逐步扩展:从仅 Outlook 任务开始(数量最多,遥测数据最丰富),然后扩展到 Excel,再到跨应用。每个应用都有独特的失败模式。</td></tr></table>

## 12.6.14 完整训练食谱

Table 12.6: 生产力副驾 RL 训练的推荐超参数。

<table><tr><td>参数</td><td>取值</td><td>理由</td></tr><tr><td>基础模型</td><td>70B Llama/Mistral</td><td>足够容量进行复杂多步推理</td></tr><tr><td>RL算法</td><td>GRPO</td><td>无需critic;对长轨迹更省内存</td></tr><tr><td>组大小N</td><td>8</td><td>在方差减小与算力代价之间取平衡</td></tr><tr><td>裁剪ε</td><td>0.1</td><td>比标准(0.2)更紧,因长轨迹敏感性</td></tr><tr><td>KL系数β</td><td>0.04</td><td>对SFT Policy的中等约束</td></tr><tr><td>Learning rate</td><td> $5 \times 10^{-7}$ </td><td>保守;Agent任务对大幅更新敏感</td></tr><tr><td>Batch size</td><td>256任务×8轨迹=2048</td><td>大Batch以稳定GRPO归一化</td></tr><tr><td>最大轨迹长度</td><td>50步</td><td>覆盖95%的生产力任务</td></tr><tr><td>上下文窗口</td><td>128K Token</td><td>长多应用工作流所需</td></tr><tr><td>训练迭代数</td><td>3000-5000</td><td>监控评估指标;安全性退化时早停</td></tr><tr><td>课程预热</td><td>500次迭代(仅L1-L2)</td><td>在复杂任务前建立基本API使用</td></tr></table>

## 12.7 用例：从零构建一个研究 Agent

本用例展示了如何使用本文讨论的技术，构建一个完全自主的研究 Agent——一个能够提出假设、检索文献、分析数据、编写代码、运行实验并产出最终报告的 LLM。

## 12.7.1 问题定义

!!! note
    研究 Agent 需求
    输入：一个研究问题（例如，“Learning rate warmup 时长对 7B 模型 GRPO 收敛的影响是什么？”）
    输出：一份包含方法论、实验、结果和结论的完整研究报告。
    所需能力：
    1. 文献搜索：查询 arXiv、Semantic Scholar，找出相关论文
    2. 假设生成：从背景知识中提出可检验的假设
    3. 实验设计：编写带恰当对照的训练脚本
    4. 代码执行：运行实验，收集指标
    5. 数据分析：解析日志、计算统计量、生成图表
    6. 科学写作：将发现综合成一份连贯的报告
    7. 自我纠正：检测失败实验并用修改后的参数重试

## 12.7.2 MDP 形式化

## 研究 Agent MDP

<table><tr><td>·状态 $s_t$ :系统 Prompt + 研究问题 + 完整的动作/观测历史(工具输出、代码结果、搜索结果)。上下文窗口:128K Token。</td></tr><tr><td>·动作 $a_t$ :来自动作空间的结构化工具调用(见下文)+推理轨迹(CoT)。</td></tr><tr><td>·转移 $T(s_{t+1}|s_t, a_t)$ :确定性——将动作 + 工具输出附加到上下文。</td></tr><tr><td>·Reward R:基于报告质量的稀疏终端 reward(见下方 Reward 设计)。</td></tr><tr><td>·视野:20-100步(典型研究轨迹)。</td></tr><tr><td>·折扣γ=1.0(Episode式;有限任务不折扣)。</td></tr></table>

## 12.7.3 动作空间

Table 12.7: 研究 Agent 的工具/动作空间。

<table><tr><td>工具</td><td>类别</td><td>描述</td></tr><tr><td>search_papers</td><td>文献</td><td>查询 Semantic Scholar/arXiv。返回标题、摘要、引用。</td></tr><tr><td>read_paper</td><td>文献</td><td>获取论文全文或指定章节。</td></tr><tr><td>write_code</td><td>实验</td><td>向工作区写入 Python/训练脚本。</td></tr><tr><td>execute_code</td><td>实验</td><td>在沙盒环境中运行脚本。返回 stdout/stderr。</td></tr><tr><td>read_file</td><td>分析</td><td>读取日志、CSV 或中间结果。</td></tr><tr><td>plot_data</td><td>分析</td><td>生成 matplotlib/seaborn 可视化。</td></tr><tr><td>compute_stats</td><td>分析</td><td>运行统计检验(t 检验、置信区间)。</td></tr><tr><td>write_report</td><td>输出</td><td>撰写最终研究报告的各个章节(LaTeX/Markdown)。</td></tr><tr><td>think</td><td>推理</td><td>内部推理步骤(不进行外部工具调用)。</td></tr><tr><td>submit</td><td>终止</td><td>提交最终报告。结束 Episode。</td></tr></table>

## 12.7.4 架构：模型与基础设施选择

<table><tr><td>架构决策——应用论文中的概念</td></tr><tr><td>·基础模型:Qwen-2.5 72B(强推理+代码能力)。QLoRA微调(r=32,所有线性层)——见LoRA一节。</td></tr><tr><td>·推理:vLLM,TP=4,启用前缀缓存(系统Prompt在rollout间共享)——见vLLM一节。</td></tr><tr><td>·训练:每个研究问题用N=4条轨迹的GRPO——无需Value模型(见GRPO一节)。</td></tr><tr><td>·硬件:8×H100节点。QLoRA适配器装入48GB;vLLM生成使用剩余容量。</td></tr><tr><td>·上下文管理:128K上下文配合FlashAttention(见FlashAttention一节)。超出上下文的轨迹采用滑动窗口摘要。</td></tr><tr><td>·推测式解码:长研究轨迹期间用Eagle头进行快速生成(见推测式解码一节)。</td></tr></table>

## 12.7.5 Reward 设计

<table><tr><td colspan="3">多组件研究 Reward</td></tr><tr><td colspan="3">当 Agent 调用 submit 时计算终端 reward:  $R = w_1 R_{\text{quality}} + w_2 R_{\text{correctness}} + w_3 R_{\text{novelty}} + w_4 R_{\text{efficiency}} + w_5 R_{\text{format}}$ </td></tr><tr><td>组件</td><td>权重</td><td>度量方式</td></tr><tr><td> $R_{\text{quality}}$ </td><td>0.30</td><td>LLM-as-judge (GPT-4 在清晰度、深度、严谨性上对报告打 1-10 分)</td></tr><tr><td> $R_{\text{correctness}}$ </td><td>0.30</td><td>代码无错误执行 + 结果可复现</td></tr><tr><td> $R_{\text{novelty}}$ </td><td>0.15</td><td>LLM-judge: 报告是否提供了超越论文综述的洞见?</td></tr><tr><td> $R_{\text{efficiency}}$ </td><td>0.15</td><td>步骤越少奖励越多: $R_{\text{eff}} = \max(0,1 - \text{steps}/100)$ </td></tr><tr><td> $R_{\text{format}}$ </td><td>0.10</td><td>报告包含所有所需章节(引言、方法、结果、结论)</td></tr><tr><td colspan="3">中间塑形:每次成功代码执行 +0.1;每次运行时错误 -0.05(鼓励一次写对代码)。</td></tr></table>

## Reward Hacking 风险

- 伪造结果：Agent 捏造实验输出。修复：通过对照执行日志与报告数字，验证代码确实运行过。

- 浅薄报告：Agent 逐字复制论文摘要。修复：新颖性 reward + 抄袭检测。

- 长度博弈：长报告得分更高。修复：效率 reward + 长度惩罚。

- 回避难题：Agent 避开困难研究问题。修复：带难度级别的课程。

## 12.7.6 训练流水线

1. 阶段 1——SFT 预热（500 步）：

- 收集 200 条专家研究轨迹（人类研究者使用工具）

- 在成功轨迹上用仅 completion 掩码做 SFT（掩盖工具输出）

- 这教 Agent 工具使用语法和基本研究工作流

## 2. 阶段 2——GRPO 训练（3000 步）：

- Prompt 池：跨 10 个领域（ML、NLP、CV、系统等）的 500 个研究问题

- 每个问题：生成 N = 4 条完整研究轨迹

- 用多组件 reward 给每条轨迹打分

- GRPO 优势： $\hat { A } _ { i } = ( R _ { i } - \mu _ { G } ) / \sigma _ { G }$

- 用裁剪目标更新 Policy（clip ϵ = 0.2，KL β = 0.05）

- 课程：从简单的 “总结关于 X 的发现” 任务开始，进展到 “设计并运行关于 X 的实验”

## 3. 阶段 3——拒绝采样微调（200 步）：

- 每个难问题生成 16 条轨迹，按 reward 保留 top-2

- 在这些高质量轨迹上做 SFT

- 稳定在最难研究任务上的表现

## 12.7.7 示例轨迹：完整 MDP 追踪

为了说明所有 MDP 组件在实践中如何协同工作，我们追踪一个从问题到提交的完整研究 Episode，并为每一步标注其形式化 MDP 元素。

研究 Agent 轨迹——完整 MDP 追踪

$$
s _ {t},
$$

$$
a _ {t},
$$

$$
o _ {t}
$$

<table><tr><td>t</td><td>元素</td><td>描述</td></tr><tr><td></td><td> $a_0$ </td><td>think: “我需要关于 GRPO 组大小消融的论文,然后进行一次受控实验。”</td></tr><tr><td></td><td> $o_0$ </td><td>内部推理(无工具输出)。塑形 reward: $r_0=0$ 。</td></tr><tr><td>1</td><td> $s_1$ </td><td> $s_0\oplus(a_0,o_0)$ ——上下文现在包含推理计划。</td></tr><tr><td></td><td> $a_1$ </td><td>search_papers(query=&quot;GRPO group size ablation math&quot;)</td></tr><tr><td></td><td> $o_1$ </td><td>返回 5 篇论文:[DAPO, DeepSeek-Math, Dr. GRPO,...]。 $r_1=0$ 。</td></tr><tr><td>2</td><td> $s_2$ </td><td> $s_1\oplus(a_1,o_1)$ ——搜索结果进入上下文。</td></tr><tr><td></td><td> $a_2$ </td><td>read_paper(id=&quot;DAPO&quot;,sections=[&quot;experiments&quot;,&quot;ablations&quot;])</td></tr><tr><td></td><td> $o_2$ </td><td>关键发现:“在代码任务上超过 N=16 收益递减;数学未测试。” $r_2=0$ 。</td></tr><tr><td>3</td><td> $s_3$ </td><td> $s_2\oplus(a_2,o_2)$ ——识别出文献空白。</td></tr><tr><td></td><td> $a_3$ </td><td>think: “DAPO 只测了代码。我将在 GSM8K 上用 Llama-3 8B 测试 N ∈ {4,8,16,32,64}。对照:相同总训练 Token 数。”</td></tr><tr><td></td><td> $o_3$ </td><td>假设形成。 $r_3=0$ 。</td></tr><tr><td>4</td><td> $s_4$ </td><td> $s_3\oplus(a_3,o_3)$ ——实验方案进入上下文。</td></tr><tr><td></td><td> $a_4$ </td><td>write_code(&quot;train_grpo_gsm8k.py&quot;)——85 行脚本,含 group_size 的 argparse、正确的随机种子、在 GSM8K 测试集上评估。</td></tr><tr><td></td><td> $o_4$ </td><td>文件写入成功。 $r_4=0$ 。</td></tr><tr><td>5</td><td> $s_5$ </td><td> $s_4\oplus(a_4,o_4)$ ——代码在工作区可用。</td></tr><tr><td></td><td> $a_5$ </td><td>execute_code(&quot;python train_grpo_gsm8k.py --N 4 --seed 42&quot;)</td></tr><tr><td></td><td> $o_5$ </td><td>Accuracy: 67.2% (CI: 65.1--69.3)。 $r_5=+0.1$ (成功执行)。</td></tr><tr><td>6-8</td><td> $a_{6-8}$ </td><td>用 N=8,16,32 执行 → 结果:71.4%、74.8%、75.9%。每个  $r_t=+0.1$ 。</td></tr><tr><td>9</td><td> $s_9$ </td><td>上下文包含 4 个数据点。</td></tr><tr><td></td><td> $a_9$ </td><td>execute_code(&quot;python train_grpo_gsm8k.py --N 64 --seed 42&quot;)</td></tr><tr><td></td><td> $o_9$ </td><td>Accuracy: 75.6% (CI: 73.4--77.8)——比 N=32 略下降!  $r_9=+0.1$ 。</td></tr><tr><td>10</td><td> $s_{10}$ </td><td>5 个结果全部可用。</td></tr><tr><td></td><td> $a_{10}$ </td><td>compute_stats(test=&quot;paired_t_test&quot;, data=[67.2, 71.4, 74.8, 75.9, 75.6], groups=[4,8,16,32,64])</td></tr><tr><td></td><td> $o_{10}$ </td><td>N=4 对比 N=16 时 p<0.01; N=32 对比 N=64 时 p=0.72 (不显著)。 $r_{10}=0$ 。</td></tr><tr><td>11</td><td> $s_{11}$ </td><td>收益递减的统计证据。</td></tr><tr><td></td><td> $a_{11}$ </td><td>plot_data(x=[4,8,16,32,64], y=[67.2,71.4,74.8,75.9,75.6], xlabel=&quot;Group Size N&quot;, ylabel=&quot;GSM8K Accuracy (%)&quot; , title=&quot;GRPO Group Size vs Math Reasoning&quot;)</td></tr><tr><td></td><td> $o_{11}$ </td><td>图保存到 results/group_size_curve.png。 $r_{11}=0$ 。</td></tr><tr><td>12</td><td> $s_{12}$ </td><td>完整证据组装完成。</td></tr><tr><td></td><td> $a_{12}$ </td><td>write_report: 4 节报告(引言、方法、带图的结果、结论:“N=16-32 是最优;N=64 无增益且算力增加 4×”)。</td></tr><tr><td></td><td> $o_{12}$ </td><td>报告写入完成(2,100 词)。 $r_{12}=0$ 。</td></tr><tr><td>13</td><td> $a_{13}$ </td><td>submit——Episode 终止。</td></tr><tr><td></td><td> $R_{terminal}$ </td><td>LLM-judge 打分:质量 = 8/10,代码正确,新颖(把 DAPO 扩展到数学),13 步,所有章节齐全。</td></tr><tr><td colspan="3">终端 reward 计算: $R=\underbrace{0.30\times\frac{8}{10}}_{质量}+\underbrace{0.30\times1.0}_{正确}+\underbrace{0.15\times\frac{7}{10}}_{新颖}+\underbrace{0.15\times(1-\frac{13}{100})}_{效率}+\underbrace{0.10\times1.0}_{格式}$  $=0.24+0.30+0.105+0.13+0.10=0.875$ 中间塑形总额:5 × (+0.1) = +0.5(5 次成功代码执行)。GRPO 上下文:此轨迹在 N=4 组中得分最高(其他得分为 0.61、0.72、0.53)。GRPO 优势: $\hat{A}=\frac{0.875-\bar{R}}{\sigma_R}=\frac{0.875-0.684}{0.129}=+1.48$ (强化强烈)所体现的关键 MDP 性质:确定性 T:每次工具调用产生可预测的状态扩展( $s_{t+1}=s_t\oplus(a_t,o_t)$ )稀疏终端 reward:真正的质量信号只在 submit 时给出;中间塑形很小长视野:13 步且 γ=1.0 Episode 式任务不折扣)。</td></tr></table>

- 自我纠正机会：在第 9 步，Agent 观察到 N = 64 并未改进——据此调整其结论，而非挑选数据。

- 动作多样性：推理（think）、信息收集（search、read）、执行（write\_code、execute）、分析（compute\_stats、plot）和输出（write\_report、submit）的混合。

## 12.7.8 关键设计决策与权衡

Table 12.8: 研究 Agent 的设计决策，映射到论文各章节。

<table><tr><td>决策</td><td>论文章节</td><td>理由</td></tr><tr><td>QLoRA (r=32)</td><td>LoRA 一节</td><td>72B 模型;全量微调太昂贵。r=32 用于复杂推理。</td></tr><tr><td>GRPO(而非 PPO)</td><td>GRPO 一节</td><td>无需 Value 模型;研究质量难以中途预测。</td></tr><tr><td>稀疏终端 reward</td><td>Reward Shaping</td><td>研究质量只能在完成时度量;中间塑形最小。</td></tr><tr><td>N=4 轨迹</td><td>GRPO 组大小</td><td>平衡:足够的多样性用于排序,又不至过于昂贵(100 步轨迹)。</td></tr><tr><td>128K 上下文</td><td>FlashAttention</td><td>长轨迹包含论文内容 + 代码 + 结果。</td></tr><tr><td>vLLM + 前缀缓存</td><td>vLLM 一节</td><td>系统 Prompt + 研究问题在 4 条 rollout 间共享。</td></tr><tr><td>课程训练</td><td>Agent RL</td><td>从简单(文献综述)→困难(设计 + 执行实验)。</td></tr><tr><td>LLM-as-judge reward</td><td>Reward Model</td><td>研究质量是主观的;LLM judge 比基于规则更灵活。</td></tr></table>

## 12.7.9 评估

## 研究 Agent 评估框架

- 保留问题（50 个）：训练期间未见的研究问题，覆盖多种领域。

- 人类评估：领域专家在 1–5 分制（质量、正确性、可操作性）上对报告评分。

- 可复现性：重新运行报告中的 Agent 代码；验证结果一致。

- 对比基线：(1) 零样本 GPT-4 + 工具（无 RL 训练），(2) 仅 SFT Agent，(3) 人类研究者。

- 效率指标：按任务难度归一化的完成步数。

预期结果（基于类似的 Agent RL 工作）：

<table><tr><td>Agent</td><td>报告质量(1-5)</td><td>平均步数</td></tr><tr><td>零样本 GPT-4 + 工具</td><td>2.8</td><td>25</td></tr><tr><td>仅 SFT</td><td>3.4</td><td>18</td></tr><tr><td>GRPO 训练(我们的)</td><td>4.1</td><td>14</td></tr><tr><td>人类研究者</td><td>4.5</td><td>N/A</td></tr></table>

## 12.7.10 经验教训与失败模式

## 研究 Agent 训练中的常见失败

- 无限循环：Agent 反复搜索论文却不前进。修复：步数预算 + 对参数相同的重复工具调用的惩罚。

- 代码调试螺旋：Agent 花 20+ 步修一个 Bug。修复：重试次数上限为 3；若代码失败 3 次放弃当前方法尝试替代方案。

- 幻觉引用：Agent 编造论文标题/结果。修复：通过工具输出验证所有引用存在；惩罚不可验证的断言。

- 过早提交：Agent 提交不完整报告以避免长轨迹的惩罚。修复：设定最低质量阈值（R > 0.4）作为有效提交；低于阈值视为失败。

- 对 judge 的 reward hacking：Agent 学会产生在 LLM judge 处得高分但科学上肤浅的文本。修复：轮换 judge 模型；定期在 reward 中纳入人类评估。

## 12.8 LLM Agent 的 SOTA RL

针对 LLM Agent 的 RL 技术聚焦于在策略 policy 梯度与细粒度信用分配的结合。因为 Agent 执行涉及工具交互、API 查询和代码执行的复杂多轮（Multi-Turn）轨迹，标准的单轮对齐算法必须经过大幅修改。

## 12.8.1 主导基线：用于 Agent 的 GRPO

由 DeepSeek-R1 [72] 推广，GRPO [323] 正迅速成为 Agent 训练的标准。它为每个任务采样一组N 条完整轨迹，从而消除了内存密集的 critic 网络：

对于任务 Prompt q，GRPO 从 $\pi _ { \boldsymbol { \theta } _ { \mathrm { o l d } } }$ 采样 N 条 Agent 轨迹 $\{ o _ { 1 } , o _ { 2 } , \ldots , o _ { N } \}$ 。每条轨迹的优势通过将其 reward 相对于组归一化来计算：

$$
\boxed {A _ {i} = \frac {r (o _ {i}) - \frac {1}{N} \sum_ {j = 1} ^ {N} r (o _ {j})}{\operatorname{std} (r (o _ {1}) , \dots , r (o _ {N}))}}\tag{12.18}
$$

带 KL 正则的 GRPO 目标：

$$
L _ {\mathrm{GRPO}} (\theta) = \frac {1}{N} \sum_ {i = 1} ^ {N} \min \left(\frac {\pi_ {\theta} (o _ {i} | q)}{\pi_ {\theta_ {\mathrm{old}}} (o _ {i} | q)} A _ {i}, \operatorname{clip} \left(\frac {\pi_ {\theta} (o _ {i} | q)}{\pi_ {\theta_ {\mathrm{old}}} (o _ {i} | q)}, 1 - \epsilon , 1 + \epsilon\right) A _ {i}\right) - \beta D _ {\mathrm{KL}} (\pi_ {\theta} \| \pi_ {\mathrm{ref}})\tag{12.19}
$$

## 为什么 GRPO 在 Agent 训练中占优

- 无 critic：节省 50% GPU 内存——当 Agent 轨迹已经占用了庞大的上下文窗口（32K–128KToken）时至关重要。

- 自然契合：Agent 任务通常有二元可验证 reward（测试通过/失败、目标达成/未达成）非常适合组相对归一化。

- 探索：每个任务采样 N 条多样化轨迹，自然地探索不同的工具使用策略。

## 12.8.2 用于交互式 Agent 的 PPO

对于在高度随机环境中运行、且步骤级 Value 估计有所帮助的 Agent，PPO [319] 仍然有价值。Critic提供每步优势信号，在工具输出不可预测时实现更精细的信用分配：

- 通过 GAE 进行步骤级优势估计，处理可变长度的工具输出

- Value 头学习预测 “从这里开始这条轨迹有多大可能成功”

- 当外部工具返回灾难性错误导致 reward 方差激增时更稳定

- 权衡：需要 2× 内存（critic）但提供更密集的学习信号

## 12.8.3 细粒度的回合级信用分配

Agent RL 的核心挑战是稀疏 reward 问题。如果 Agent 执行 20 个工具动作并最终未通过一个单元测试，终端 reward 为 0 会平等地惩罚所有 20 个动作。现代解决方案：

!!! note
    可验证奖励的强化学习（Reinforcement Learning from Verifiable Rewards, RLVR）
    在确定性的中间检查点对模型给予 reward:
    • Bash 命令成功编译 → +0.1

<table><tr><td>浏览器 Agent 定位到正确的 HTML 元素 → +0.2SQL 查询返回非空结果 → +0.1最终测试套件通过 → +1.0(终端)中间 reward 为每一步都提供梯度信号,而不仅是最后一步。这相比仅有稀疏 reward 的情况,将学习速度显著加速 3-5×。</td></tr><tr><td>多轮轨迹切片</td></tr><tr><td>框架将多轮 Agent 运行拆分为独立的单个步骤。一个信用分配模块隔离出破坏轨迹的确切子步骤:重放成功前缀(步骤 1-k)识别第一个偏离点(步骤 k+1,出错处)仅对该特定步骤分配负 reward对正确的前缀步骤分配中性/正 reward这使得在不破坏已正确行为的前提下,进行外科手术式的 Policy 更新成为可能。</td></tr></table>

## 12.8.4 替代范式

- 迭代式 STaR（Self-Taught Reasoner） [418]：不进行连续 RL，而是使用迭代离线循环。生成轨迹 → 过滤失败 → 在成功上 SFT → 重复。易于扩展，避免 RL 不稳定性。每次迭代都自举推理能力。

- 强化世界模型学习（Reinforcement World Model Learning, RWML） [414]：为对抗reward hacking，训练 Agent 预测其动作的语义后果。Agent 因准确预测环境状态如何变化而获得辅助 reward（例如，在执行 SQL 之前预测数据库表的变化）。这迫使真正理解，而非表面的 reward 博弈。

- LATS（语言 Agent 树搜索） [438]：在 Agent 动作序列上应用蒙特卡洛树搜索。在每一步，扩展多个候选动作，模拟其结果，并通过树反向传播 reward。将 RL 价值估计与搜索时算力扩展相结合。

## 12.8.5 核心方法论比较

Table 12.9: LLM Agent 的 RL 范式比较。

<table><tr><td>方法</td><td>Reward 密度</td><td>内存成本</td><td>主要优势</td></tr><tr><td>GRPO [323]</td><td>序列 / 最终指标</td><td>低(无 critic)</td><td>显著降低 GPU 内存;实现简单</td></tr><tr><td>PPO [319]</td><td>逐步(GAE)</td><td>高(需 critic)</td><td>细粒度信用分配;在噪声环境中稳定</td></tr><tr><td>迭代式 STaR [418]</td><td>稀疏(过滤后的二元)</td><td>极小(仅SFT)</td><td>易于扩展;避免 RL 优化不稳定性</td></tr><tr><td>RWML [414]</td><td>密集(预测式)</td><td>中</td><td>通过世界建模缓解 reward hacking</td></tr><tr><td>LATS [438]</td><td>反向传播</td><td>高(树扩展)</td><td>每个任务的质量最佳;随推理算力扩展</td></tr></table>

## 12.9 面向 Agent 训练的交互式 RL 环境

早期智能体 RL 的主导范式依赖静态数据集：精选轨迹、离线偏好对或固定基准套件。这种方法虽然可行，但有一个根本局限——在静态数据上训练的 Agent 无法通过与环境的交互发现新策略，奖励信号也被限制在数据集创建时所能预见的范围内。该领域已决定性地转向交互式 RL 环境：Agent在其中执行动作、接收反馈，并基于真实结果更新策略的实时模拟器。

## 静态 vs. 交互式训练

- 静态（SFT/DPO）：Agent 从固定轨迹中学习。没有探索。奖励隐含在数据策展之中。天花板：人类示范者的质量。

- 交互式 RL：Agent 探索环境，获得可验证奖励。能够发现训练分布之外的策略。天花板：环境奖励的质量。

这一转变呼应了机器人学中从模仿学习到 RL 的过渡——交互式环境解锁了质变级别的新能力。

## 12.9.1 NeMo Gym（NVIDIA）

NeMo Gym [271] 是 NVIDIA 专为 LLM Agent 训练设计的交互式 RL 环境框架。其架构干净地把 Agent（LLM 策略）与环境（任务模拟器）分离，使两个组件可以独立扩展。

关键设计原则：

- 多轮 rollout：环境支持扩展的交互序列，而不只是单步查询。Agent 可以跨多轮调用工具、接收结果并继续推理。

- 工具调用验证：奖励通过执行 Agent 的工具调用并与真值核对结果来计算——提供密集、可靠的信号。

- Agent/环境解耦：环境作为独立服务运行，允许异构算力分配（例如 Agent 用 GPU、环境模拟用 CPU）。

Nemotron 3 Super 使用 NeMo Gym 训练，配置了覆盖数学、代码、工具使用与多轮对话的 21种环境，生成了 120 万次 rollout。环境的多样性至关重要：只在单一类型环境上训练的 Agent 容易过拟合该环境的奖励结构。

## 12.9.2 RLFactory

RLFactory [369] 是一个面向多轮工具使用 RL 的即插即用框架，旨在把连接 LLM 策略与多样工具环境的工程开销降到最低。

RLFactory：Qwen3-4B 超越更大模型

使用 RLFactory 配合异步工具调用与多样化奖励信号：

- 用 RLFactory 训练的 Qwen3-4B 在 Natural Questions 上超越了显著更大的模型。

- 通过异步执行，相对同步工具调用基线获得 6.8× 吞吐量提升。

- 多样化奖励（正确性、格式、工具效率）防止在任何一个单一信号上出现 reward hacking。

关键洞见：具备高质量交互式训练的小模型可以胜过在静态数据上训练的大模型，因为交互式RL 让模型能够发现任何人类示范者都想不到要写进数据集的工具使用策略。

## 12.9.3 MOSAIC：智能体训练中的安全

随着智能体 RL 环境的能力越来越强，安全成为一等关注点。MOSAIC [50]（2026 年 3 月）解决的是在交互式环境中训练既强大又安全的 Agent 的问题。

MOSAIC 的核心框架引入了一个计划 → 检查 → 行动或拒绝的循环：

1. 计划（Plan）：Agent 生成候选动作序列。

2. 检查（Check）：安全验证器依据约束集（危害类别、策略规则）评估该计划。

3. 行动或拒绝（Act or Refuse）：计划通过则执行；否则生成带解释的拒绝。

安全通过轨迹级偏好学习来训练：MOSAIC 不是把单个动作标注为安全/不安全，而是标注整条轨迹，从而捕捉多步计划的累积安全影响。这一点至关重要，因为看似无害的单个动作组合起来可能形成有害序列。

## MOSAIC 结果

- 在智能体安全基准上有害行为最多减少 50%。

- 任务性能保持不变：计划—检查—行动循环只增加极小的延迟，不会降低良性任务上的成功率。

- 轨迹级偏好学习优于步骤级安全分类器，因为它能捕捉动作组合产生的涌现性危害。

在真实 Agent 轨迹上训练。 xAI 的 Grok 4.5（2026 年 7 月） [389] 引入了一种新颖的数据来源：来自 Cursor 的匿名开发者会话轨迹——工程师在真实代码库中工作的实际击键、导航模式与编辑序列。在这些轨迹上做中期训练后，Grok 4.5 在智能体工具使用基准上登顶。这预示着一个“算力 +轨迹”范式：一旦算力到位，稀缺的输入就变成目标行为的记录——类似于 AlphaGo 先以人类棋局自举、再转向自我对弈。这一方法引发了尚未解决的数据权利问题（谁的代码、在何种同意下？），但它证明：来自专家用户的行为示范仍然是智能体能力的有力训练信号。
