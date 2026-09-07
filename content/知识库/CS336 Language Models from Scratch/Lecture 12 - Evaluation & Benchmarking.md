# Lecture 12 - Evaluation & Benchmarking

> **课程主题**：大语言模型全生命周期评测体系、基准测试设计与数据污染防范
> **授课教师**：Percy Liang
> **核心目标**：构建大模型多维度评测认知框架，掌握困惑度（Perplexity）、标准化考试基准（MMLU/GPQA/HLE）、开放对话与 LLM-as-a-Judge（Chatbot Arena/AlpacaEval）、智能体基准（SWE-Bench/TerminalBench）、纯推理基准（ARC-AGI）以及训练测试数据污染（Contamination）的检测与防范。

---

## 1. 大模型评测光谱与能力维度

大模型评测并非单一维度的机械打分，而是由内至外、由理论至实际构成的**多层评测光谱**：

```
[ 底层语言建模 (Perplexity) ] ──> [ 封闭式学科考试 (MMLU/GPQA) ] ──> [ 开放式对话偏好 (Arena/AlpacaEval) ]
                                                                             │
[ 真实生态有效性 (GDPVal) ] <── [ 安全与红队对抗 (HarmBench) ] <── [ 智能体行动力 (SWE-Bench) ]
```

---

## 2. 基础指标：困惑度 (Perplexity, PPL)

### 2.1 数学定义与本质

语言模型对序列 $D = (x_1, x_2, \dots, x_N)$ 的困惑度定义为交叉熵损失的指数形式：
$$\text{PPL}(D) = \left( \prod_{i=1}^N P(x_i \mid x_{<i}) \right)^{-\frac{1}{N}} = \exp\left( -\frac{1}{N} \sum_{i=1}^N \log P(x_i \mid x_{<i}) \right) = \exp(\text{Cross-Entropy Loss})$$

- **理论极限**：若真实数据分布为 $t$，模型的最好可能困惑度为 $\exp(H(t))$，当且仅当 $p = t$ 时取得。
- **分布内 (ID) vs 分布外 (OOD) 评测**：
  - 经典范式：在同一数据集（如 Penn Treebank, WikiText-103）的 Train 上训练、Test 上测 PPL。
  - 现代范式：在万亿通用互联网数据上预训练，在特定未见测试集（如 1BW, LAMBADA）上测 Zero-Shot PPL。
- **条件困惑度 (Conditional PPL)**：在下游生成中仅惩罚目标输出序列的似然：
  $$\text{PPL}(Y \mid X) = \exp\left( -\frac{1}{|Y|} \sum_{t=1}^{|Y|} \log P(y_t \mid X, y_{<t}) \right)$$

---

## 3. 标准化考试与学科知识基准

| 基准测试 | 题目规模与学科覆盖 | 形式与难度级别 | 专家/人类 vs SOTA 模型表现 | 核心挑战与局限 |
| :--- | :--- | :--- | :--- | :--- |
| **MMLU (2021)** | 57 个学科，14,000+ 题 | 4 选 1 单选题，初高中及大学入门级 | 人类专家 $\approx 89.8\%$；GPT-4 $\approx 86\%$ | 题目趋于饱和，存在噪声与简单题 |
| **MMLU-Pro (2024)** | 12,000+ 精选高难题目 | **10 选 1 单选题**，必须使用 CoT 推理 | SOTA 模型较 MMLU 骤降 $16\% \sim 33\%$ | 极大降低随机瞎蒙概率（从 25% 降至 10%） |
| **GPQA (2023)** | 448 道前沿研究生题 | 4 选 1 单选，生物/物理/化学博士撰写 | **非专家开卷可 Google 仅 34%**，博士 65%，o1/Claude 3.7 $\approx 70\%+$ | 专家撰写成本极高，抗搜索检索（Google-Proof） |
| **Humanity's Last Exam (HLE, 2025)** | 2,500 道跨学科极端难题 | 多模态，多选 + 简答，多轮严格同行审稿 | 全球顶级学者 $500K 悬赏出题，早期模型正确率仅个位数 | 考察人类前沿学科认知极限 |

---

## 4. 开放式对话与人类偏好评测 (Open-Ended Chat)

### 4.1 Chatbot Arena (众包盲测与 Elo 积分)
- **机制**：匿名双盲 A/B 测试，真实用户输入任意真实世界 Prompt，两台随机模型生成回答，用户盲选胜者。
- **Bradley-Terry 胜率模型与 Elo 积分**：
  $$P(\text{Model A beats Model B}) = \frac{1}{1 + 10^{(\text{Elo}_B - \text{Elo}_A)/400}}$$
- **优缺点**：最贴近真实用户分布，但易受风格长度偏见（Verbosity Bias）与用户主观阿谀奉承（Sycophancy）影响。

### 4.2 LLM-as-a-Judge 与长度去偏 (AlpacaEval 2.0 & WildBench)
- **AlpacaEval 2.0**：利用 GPT-4 Turbo 对生成结果进行打分。针对裁判模型偏好冗长输出（Length Bias）的缺陷，通过多项式回归消除回复长度对胜率的干扰，输出**长度控制胜率（Length-Controlled Win Rate）**。
- **WildBench**：引入 Checklist / Rubric 细粒度评分准则，类似于 Chain-of-Thought 式的分项裁决，大幅提升自动裁判的一致性。

---

## 5. 智能体与纯推理基准 (Agentic & Pure Reasoning)

### 5.1 智能体基准 (Agentic Benchmarks)
$$\text{Agent Performance} = \text{Language Model Capability} + \text{Agent Scaffold (架构脚手架)}$$

```
Agent Loop:
Task Issue ──> Plan & Todo ──> Shell/File Tool Exec ──> Unit Test Run ──> Iterative Fix ──> Final PR
```

- **SWE-Bench / SWE-Bench Verified**：基于 GitHub 真实开源仓库 Issue，要求 Agent 浏览代码、复现 Bug、修改代码并**100% 通过真实单元测试**。
- **TerminalBench**：在沙盒化终端环境中执行真实 Linux 系统管理与网络调试任务。
- **CyBench / MLE-Bench**：针对网络安全 CTF 解题与 Kaggle 机器学习竞赛全流程的自动化评测。

### 5.2 纯推理基准：ARC-AGI (Abstraction and Reasoning Corpus)
- **核心理念**：将**纯逻辑推理**与**世界语言事实记忆**彻底解耦。每个任务都是全新且唯一的视觉网格几何变换，彻底粉碎基于预训练记忆检索的“伪推理”，成为检验 o1/o3 类推理模型的核心试金石。

---

## 6. 数据污染防范与生态有效性 (Data Contamination)

```
                       [ 评测数据污染防范四重防线 ]
  1. 统计交换性推断 (Exchangeability):
     利用 Token 困惑度在微小扰动下的异常平滑度，检测测试集是否在预训练阶段被背诵
                  │
                  ▼
  2. 报告规范与置信区间 (Reporting Norms):
     模型发布报告必须披露 N-gram 重合度与预训练数据过滤审计日志
                  │
                  ▼
  3. 动态流动基准 (Fresh / Live Evals):
     如 LiveCodeBench，实时抓取发布时间之后的最新竞赛题目，杜绝时间穿越
                  │
                  ▼
  4. 私有测试集 (Private & Canary Data):
     在测试集中埋入 Canary GUID 标识符，并保留完全离线的私有评测集
```
