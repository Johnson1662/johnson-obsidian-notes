# Evaluation：语言模型评测体系、指标与偏差

> Stanford CS336 Lecture 12。评测不是“写几个 prompt、算一个 accuracy”这么机械：它把抽象的“模型好不好”转成具体指标，会反过来决定数据、训练和产品优化方向。

---

## 1. 评测究竟在测什么

### 1.1 从抽象构念到可计算指标

**Evaluation**：给定一个模型，判断它在某个明确目标上“有多好”。核心挑战是

$$
\text{abstract construct}\;\longrightarrow\;\text{concrete metric}.
$$

“好模型”可能意味着：

- benchmark 得分高；
- 质量相同但推理便宜、低延迟；
- 用户更偏好回答；
- 用户真正愿意使用并付费；
- 对某个专业任务正确、安全且可靠。

没有脱离问题的唯一总分。MMLU 的知识分数、Chatbot Arena 的偏好分数、代码单测通过率和医疗安全率测的是不同构念，不能直接排序后宣称“整体更聪明”。

### 1.2 评测的三个层次

| 层次 | 评测对象 | 典型问题 |
| --- | --- | --- |
| 方法（method） | 固定数据/训练/验证协议 | 哪个算法更有效？ |
| 模型/系统（model/system） | 允许各种训练和推理技巧的完整系统 | 用户应该选哪个模型？ |
| Agent | 语言模型 + agent scaffold（工具、记忆、规划、循环） | 整个系统能否完成任务？ |

早期机器学习多评测方法，因为 train/test split 清晰；今天的 foundation model 评测更常比较模型或系统，Agent 还必须说明 scaffold，否则“模型本身”和“外部工具”贡献无法分离。

### 1.3 评测前先写清规则

至少固定并报告：

- 模型 checkpoint、参数规模、是否使用工具/检索/代码执行；
- system prompt、用户 prompt、few-shot 示例与顺序；
- temperature、top-p/top-k、最大生成长度和停止规则；
- 是否允许多次采样、self-consistency、beam/search；
- 评分器（精确匹配、单元测试、人类、LLM judge）和答案归一化；
- 数据版本、去重、时间戳、是否可能出现在训练集；
- 随机种子、重复次数、置信区间与失败案例。

---

## 2. Perplexity：定义、推导与局限

### 2.1 语言模型概率

对 token 序列 $x_{1:T}$，自回归语言模型给出

$$
 p(x_{1:T})=\prod_{t=1}^{T}p(x_t\mid x_{<t}).
$$

测试集 $D$ 含 $|D|$ 个 token 时，平均负对数似然（natural log）为

$$
\mathcal L(D)
=-\frac{1}{|D|}\sum_{t\in D}\log p(x_t\mid x_{<t}).
$$

**困惑度（Perplexity, PPL）**是平均负 log-likelihood 的指数：

$$
\operatorname{PPL}(D)
=\exp\bigl(\mathcal L(D)\bigr)
=\exp\left(-\frac{1}{|D|}\sum_{t\in D}\log p(x_t\mid x_{<t})\right).
$$

若使用以 2 为底的交叉熵 $\mathcal L_2$，则

$$
\operatorname{PPL}=2^{\mathcal L_2}.
$$

等价地，对整段数据概率 $p(D)$：

$$
\operatorname{PPL}(D)=p(D)^{-1/|D|}.
$$

推导来自几何平均：

$$
\left(\prod_{t=1}^{|D|}p(x_t\mid x_{<t})\right)^{-1/|D|}
=\exp\left(-\frac1{|D|}\sum_t\log p_t\right).
$$

PPL 越低，表示模型在测试 token 上分配的平均概率越高。

### 2.2 与真实分布的关系

设真实 token 分布为 $t$、模型分布为 $p$。交叉熵满足

$$
H(t,p)=H(t)+D_{\mathrm{KL}}(t\|p)\ge H(t),
$$

等号当且仅当 $p=t$。因此最优可能交叉熵是 $H(t)$，最优 PPL 为 $\exp(H(t))$。如果模型真的等于真实分布，那么对任何任务都有

$$
 p(\text{solution}\mid\text{problem})
$$

并可通过条件概率回答；这解释了为什么 pretraining 研究长期把 PPL 作为核心目标。

### 2.3 经典数据集与分布

常见语言建模数据集：

- **Penn Treebank（PTB）**：以 WSJ 新闻为主；
- **WikiText-103**：Wikipedia；
- **One Billion Word Benchmark**：来自 WMT11 的 EuroParl、联合国和新闻等文本。

传统范式是在 train split 训练、在同分布 test split 测试（in-distribution）。GPT-2 以 Reddit 链接网页组成的约 40GB WebText 训练，再 zero-shot 测试这些标准数据集，属于 out-of-distribution 迁移；在较小 PTB 上 transfer 可能帮助更大，而在较大的 1BW 上不一定。

### 2.4 条件 PPL 与“PPL 不够用”

PPL 对**所有 token**都计分。例如句子 “Stanford was founded in 1885” 中，某些 token 对问题最相关，其他功能词和常见词的预测却同样进入平均值。对生成回答 $y$ 给定 prompt $x$ 时，可以计算条件困惑度：

$$
\operatorname{PPL}(y\mid x)
=\exp\left(-\frac{1}{|y|}\sum_{t=1}^{|y|}
\log p(y_t\mid x,y_{<t})\right).
$$

它更专注于 response，但仍不能直接衡量事实正确、帮助程度、风格或安全性。

### 2.5 PPL 的工程/科学局限

- **tokenizer 依赖**：同一文本被切成不同 token 数，PPL 数值不可直接跨 tokenizer 比较；应报告 tokenization 或按字节/词的归一化。
- **平均掩盖长尾**：平均损失可能隐藏少数关键事实、稀有语言和代码错误。
- **不等于下游能力**：模型可能降低 PPL 却没有提高数学、代码或对话偏好。
- **开放式质量不可见**：低 PPL 并不保证回答有帮助、简洁、无幻觉。
- **概率接口要求**：如果做 PPL leaderboard，提交的 LM 必须返回合法归一化概率（总和为 1）；不能把任意生成分数冒充 log probability。

PPL 对开发和 scaling curve 仍很有价值，但必须补充能覆盖真实使用的任务 benchmark。

---

## 3. 知识、推理与代码 Benchmark

### 3.1 考试式多选题

考试有明确科目和难度，答案通常无歧义且容易自动评分；缺点是与真实开放式使用距离较远。

| Benchmark | 任务/规模 | 主要测量 | 注意事项 |
| --- | --- | --- | --- |
| **MMLU** | 57 个学科，多选（数学、美国历史、法律、道德等） | 广泛知识与考试能力 | 名称含 Understanding，但实际更偏知识；问题来自公开来源，存在污染可能 |
| **MMLU-Pro** | 去除噪声/琐碎问题，选项从 4 扩到 10，常配合 CoT | 更难的综合知识/推理 | 模型分数通常下降约 16%–33%，不那么快饱和 |
| **GPQA** | 61 名 PhD contractor 撰写的 graduate-level “Google-proof”问题 | 专家级科学推理 | PhD 专家约 65%，非专家在可搜索 30 分钟约 34%，GPT-4 约 39%（课程示例） |
| **HLE** | 约 2500 道多模态、多学科题，多选 + 短答 | 前沿知识与推理上限 | 多阶段审查和 frontier model 过滤，并设有 $500K 奖金池；仍需防数据污染 |

多选题不等于简单：可以增加选项数、跨学科干扰项和推理链。但它无法覆盖用户提出的开放问题，也不一定存在唯一正确答案。

### 3.2 GSM8K：可验证的数学推理

**GSM8K** 是约 8.5K 道小学/初中级文字数学题，要求模型给出答案，常用 chain-of-thought 后抽取最终数值并做 exact match。它适合测：

- 多步算术和文字条件转换；
- 逐步推理与最终答案一致性；
- self-consistency、verifier、test-time compute 的收益。

报告时需区分：只比较最终答案，还是要求 reasoning trace；是否允许 calculator/tool；答案归一化是否处理逗号、单位和小数。GSM8K 容易被训练数据记忆，不能单独代表一般数学能力。

### 3.3 HumanEval：代码生成

**HumanEval** 以函数签名、docstring 和测试为输入，模型补全 Python 代码；通过隐藏单元测试算 pass@k。若单次生成 $n$ 个样本，其中 $c$ 个通过，常用无偏估计为

$$
\operatorname{pass@}k
=1-\frac{\binom{n-c}{k}}{\binom nk}.
$$

它测的是“至少一份候选能通过测试”，不是单次生成一定正确。必须报告 $k$、采样温度、测试覆盖率和是否使用外部库/执行环境。HumanEval 测试集小、函数短，可能被数据污染；SWE-Bench、LiveCodeBench 等更接近真实软件任务。

---

## 4. 开放式对话与整体评测

### 4.1 Chatbot Arena

真实用户在 Arena 输入 prompt，看到两个匿名模型回答，并选择更好者。根据成对比较拟合 Elo/Bradley–Terry 风格模型：

$$
P(A\text{ wins against }B)
=\frac{1}{1+10^{(\operatorname{ELO}_B-\operatorname{ELO}_A)/400}}.
$$

通过最大化所有观测 pairwise preference 的似然估计 Elo。

**优点**：

- prompt 来自真实用户，激励是真实使用而非只做题；
- 不需要把同一 prompt 发送给所有模型，适合昂贵的人类判断；
- 动态吸收新模型和新问题。

**偏差/局限**：

- 用户分布、地区、语言和 spammer 行为不受控；
- 二元偏好把正确性、风格、长度、礼貌和 sycophancy 混在一起；
- 人类可能无法判断数学/事实正确；
- 不同采样温度、系统 prompt 和服务延迟会影响选择。

### 4.2 LLM judge 与 rubric

**AlpacaEval（2023）**：约 805 条指令，使用 GPT-4 preview 作为 judge，对 baseline 的胜率为指标；LLM judge 偏好更长回答，容易被 leaderboard gaming。AlpacaEval 2.0 使用回归对长度偏差做 debias；其结果与人类 Chatbot Arena 的相关性较高，但相关不等于无偏。

**WildBench**：从约 1M 条人机对话中抽取 1024 个例子，用 GPT-4 Turbo + checklist/rubric 评判；与 Arena 相关性较高。

使用人类或 LLM judge 都建议：

- 成对比较相近答案，而不是让 judge 对绝对分数凭空打分；
- 明确 rubric（正确性、相关性、完整性、安全性、格式）；
- 随机交换 A/B 顺序，检查 position bias；
- 做 judge 一致性、人工抽查和长度分层；
- 报告多个 judge 或校准集，而不是只公布一个总分。

### 4.3 HELM：多维系统化评测

**HELM（Holistic Evaluation of Language Models）**是 Stanford 的场景化评测框架，不把一个模型压成单一 leaderboard 分数，而是在不同 scenario 中同时报告：

- accuracy / exact match / calibration；
- robustness（prompt、分布、对抗扰动）；
- fairness 与偏见；
- toxicity / safety；
- efficiency（延迟、吞吐、成本）；
- 生成质量和人类偏好。

HELM 的价值在于统一运行规则、展示指标 trade-off，并提供 MMLU、MMLU-Pro、GPQA、WildBench、安全任务等可视化；它仍受数据污染、judge 和场景选择影响。

---

## 5. Agentic Benchmark：评测“模型能做什么”

### 5.1 Agent 不是单纯 LM

Agent 可表示为

$$
\text{Agent}=\text{Language Model}+\text{Agent Scaffold},
$$

其中 scaffold 包含规划、工具选择、循环控制、记忆、文件读写、错误恢复和子 Agent 委托。评测 Agent 时必须说明是评测模型、scaffold，还是两者整体。

### 5.2 代表性基准

| Benchmark | 任务 | 评分方式/规模 |
| --- | --- | --- |
| **SWE-Bench** | 给代码库和 issue 描述，让 Agent 提交 PR | 运行单元测试；课程数据约 2294 个任务、12 个 Python 仓库；SWE-Bench Verified 是人工修订版本 |
| **Terminal-Bench** | 在真实终端环境完成系统/开发任务 | 约 229 个 crowdsourced 任务、93 位贡献者；2.0 约 89 个任务；观察成功率与人类完成时间 |
| **CyBench** | 40 个 CTF 网络安全任务 | first-solve time、成功率；既测工具使用也测安全边界 |
| **MLEBench** | 75 个 Kaggle 竞赛 | 数据处理、训练模型、提交结果的端到端完成度 |

Agent scaffold 常见增强：显式 todo/planning、层次委托、持久化文件记忆、极强的 context engineering。它们能显著扩大能力面，但也使“哪个模型更好”的归因更难。

### 5.3 纯推理与 ARC

**ARC-AGI** 试图把推理与记忆的世界知识分离：任务由网格变换组成，每题独特，理论上人类可解，记忆训练样本帮助有限。

- ARC-AGI-1（2019）是第一版；
- ARC-AGI-2（2025）增加多步推理；
- ARC-AGI-3（2026）进一步加入交互环境。

预训练 LM 在早期版本上提升有限，具备更强 test-time reasoning 的模型开始改善。它严格限定为人类式抽象推理，不代表所有“智能”或超人类能力。

---

## 6. Safety 与现实有效性

### 6.1 Safety benchmark

**HarmBench**：基于约 510 种违反法律或社会规范的 harmful behavior。**AIR-Bench**：依据监管框架和公司政策，将风险分成约 314 个类别、5694 个 prompts。

评测安全不应只测“模型是否拒答”，还要测：

- 是否在允许的 benign transformation 中过度拒绝；
- jailbreak、提示注入和多轮对话下是否泄漏有害内容；
- 事实错误、sycophancy、协助犯罪、隐私泄露和关键决策风险。

**GCG（Greedy Coordinate Gradient）** 可自动优化对抗 suffix 绕过拒答，并从开源 Llama 转移到闭源模型。安全结果强烈依赖国家/法律/社会规范；网络安全 Agent 具有双重用途（既能防御又能攻击）。

### 6.2 Ecological validity（生态有效性）

它衡量 benchmark 是否接近真实使用：

- GPQA 等考试题受控但离现实较远；
- Chatbot Arena 来自真实用户，但分布不可控；
- **GDPVal** 覆盖美国 GDP 主要部门的 44 个职业，任务由平均约 14 年经验的专业人士提供；
- **MedHELM** 包含 29 名临床医生提供的 121 个医疗任务，混合私有与公开数据；
- **Clio** 用模型分析真实用户数据并只分享聚合模式。

现实性与隐私往往冲突：越接近真实用户，越需要严格脱敏、访问控制和私有评测。

---

## 7. 评测偏差与有效性

### 7.1 Prompt 敏感性

同一个模型在以下改变下可能得到显著不同分数：

- 指令措辞、system prompt 和角色定义；
- few-shot 示例内容、数量、顺序和标签；
- 多选选项顺序、答案字母映射；
- 是否要求 chain-of-thought、是否只取最终答案；
- temperature/top-p、最大长度、停止 token 和随机种子；
- 对生成答案的 whitespace、大小写、数学符号归一化。

**建议报告**：

1. 预注册或固定 prompt 模板，不在测试集上挑最好模板；
2. 使用多个等价模板，报告均值、标准差和 worst-case；
3. 随机打乱 few-shot 顺序与选项，测量方差；
4. 对高方差任务做 prompt ensemble，但把额外推理成本计入；
5. 把 prompt 作为实验因素，使用 bootstrap/置信区间，而不是只报一个点估计。

### 7.2 数据污染（Data Contamination）

foundation model 从互联网训练时，benchmark 的题目、答案、解析或近重复文本可能已经出现在训练集。模型此时可能是在记忆，而不是泛化。

#### 方法一：从模型推断重叠

利用数据点的 exchangeability/可交换性：比较 benchmark 项与匹配的改写、打乱或新题的 log-likelihood、置信度和错误模式。若原题异常高概率、改写后显著下降，提示可能记忆。

#### 方法二：训练语料审计与报告规范

- 对训练语料做 exact match、n-gram overlap、MinHash/LSH、文档指纹和 URL/时间戳搜索；
- 对题目、选项、答案、解释分别检查，不能只搜题干；
- 模型提供方报告训练数据截止时间、benchmark overlap、去重规则和置信区间。

时间戳不是绝对安全：网页可能被复制、镜像或在截止日前已存在其他版本。

#### 方法三：fresh/private eval

- **Fresh eval**：在测试后新抓取的网页或新写题目上评测，如 LiveCodeBench、UncheatableEval；
- **Private eval**：企业内部代码库、个人写作、私有医疗数据或尚未公开的任务；
- 对 PPL 可直接使用不公开文本，对代码和 Agent 任务尤其有价值。

### 7.3 数据集质量与评分有效性

即使没有训练污染，benchmark 也可能有：

- 错误答案、歧义题、过时事实；
- 单元测试覆盖不足，投机程序通过；
- agent 任务过于简单，裸脚本也能完成；
- 公开解法或 prompt 泄漏。

改进方向：

- SWE-Bench → SWE-Bench Verified 的人工修订；
- 建立 Platinum 版本，重新检查答案与难度；
- 对 Agent 记录完整 trace，用 Docent 等方法检查是否真正完成任务；
- 增加隐藏测试、对抗测试和多次复现。

---

## 8. 评测方法对比表

| 方法 | 输入/输出 | 主要指标 | 优点 | 主要偏差 |
| --- | --- | --- | --- | --- |
| PPL | token 概率 | $\exp(\text{NLL/token})$ | 平滑、适合训练/scaling | tokenizer、平均 token、与真实效用不等价 |
| MMLU/MMLU-Pro/GPQA | 多选题 | accuracy | 易自动评分、可控难度 | 公开数据、知识记忆、prompt/选项敏感 |
| GSM8K | 数学题 | final-answer exact match | 可验证多步推理 | 题型窄、CoT/工具设置影响、污染 |
| HumanEval | 函数补全 | pass@k | 用隐藏单元测试验证代码 | 测试集小、样本数/温度影响、覆盖不全 |
| HELM | 多场景系统 | accuracy/robustness/fairness/safety/efficiency 等 | 多维、规则统一 | 仍依赖场景和数据质量，不能归结一个总分 |
| Chatbot Arena | 真实用户 pairwise 对话 | Elo/Bradley–Terry | 生态真实、动态 | 用户/风格/长度/位置偏差，正确性难判断 |
| AlpacaEval/WildBench | 指令 + LLM judge | win rate / rubric score | 便宜、可扩展 | judge 偏长、模型偏好、需与人类校验 |
| SWE-Bench/TerminalBench/MLEBench | Agent 工具环境 | 测试通过/任务成功/竞赛分数 | 接近真实工作 | scaffold、环境、测试覆盖和预算影响 |
| HarmBench/AIR-Bench | 有害 prompt/风险类别 | 安全率、拒答与过拒答 | 覆盖安全风险 | 规范文化依赖、jailbreak 分布变化 |

---

## 9. 一个严谨的评测协议

### 9.1 测试前

1. 明确问题：买模型、测原始能力、研究风险，还是指导训练？
2. 选择与问题匹配的 benchmark；不要把知识分数当作 Agent 可靠性。
3. 冻结模型 checkpoint、数据版本、prompt、解码和工具预算。
4. 做 contamination 检查，尽量加入 fresh/private set。

### 9.2 测试中

- 对每个配置重复多个 seed/采样，保留原始输出和失败 trace；
- 记录 token 数、延迟、吞吐、成本和错误类型；
- 对 LLM judge 随机化 A/B 顺序、使用 rubric、做人工抽样；
- 对 Agent 隔离模型、工具、scaffold 和环境版本。

### 9.3 报告时

至少报告平均值、标准差或 bootstrap 置信区间、样本数、分桶结果和统计显著性。对多个模型比较，不仅给 winner，还要给：

- 哪些任务/语言/难度改进；
- 哪些任务退化；
- 质量—成本—安全 trade-off；
- prompt/解码敏感性；
- fresh/private eval 与公开 benchmark 是否一致。

---

## 10. 评测的目标与规则

不同人做评测的目的不同：

1. **用户/企业采购**：模型 A 或 B 在自己的 customer service、代码库或医疗流程中谁更合适？
2. **研究者测原始能力**：尽量控制 scaffold、工具和外部知识。
3. **政策/风险分析**：理解能力收益与伤害、偏见、隐私和双重用途。
4. **模型开发者迭代**：获得可行动反馈，定位数据、架构和训练问题。

“方法评测”鼓励算法创新；“模型/系统评测”帮助下游用户选择。Nanogpt speedrun 是一个方法式例外：固定数据，比较达到某一验证 loss 的计算时间。无论目标是什么，都必须先定义规则，再解释分数。

---

## 11. 本讲总结

- 没有一个“真正的总评测”；指标必须匹配目标，并明确是在评测方法、模型/系统还是 Agent scaffold。
- PPL 的严格公式是
  $$\operatorname{PPL}(D)=\exp\left(-\frac1{|D|}\sum_t\log p(x_t\mid x_{<t})\right),$$
  它适合观察训练与 scaling，但受 tokenizer、平均化和分布偏移限制。
- MMLU、GSM8K、HumanEval、HELM、Chatbot Arena 分别覆盖知识、多步数学、代码、综合系统与开放式偏好；SWE-Bench 等把评测推进到 Agent 工作流。
- Prompt 敏感性、LLM judge 偏差、选项/长度/位置效应会改变分数；应做模板扰动、随机顺序、rubric、重复试验和置信区间。
- Data contamination 检测包括训练语料 exact/n-gram/MinHash 审计、模型侧重叠推断、fresh eval、private eval 与供应商报告规范。
- 现实有效性、数据集质量和隐私同样重要；最终报告必须包含可复现规则、失败分析、成本和安全，而不只是一个 leaderboard 数字。
