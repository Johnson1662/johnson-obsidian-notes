# CS336 Lecture 16: 推理大模型后训练、RLVR 与 GRPO 算法

2024~2025 年大模型领域最重要的范式转移是从“人类偏好对齐（RLHF）”走向“**可验证奖励强化学习 (Reinforcement Learning with Verifiable Rewards, RLVR)**”。这一突破催生了 OpenAI o1 与 DeepSeek-R1 等具备深度自我反思与长思维链推理能力的前沿模型。

---

## 1. 范式转移：主观偏好 (RLHF) ➔ 可验证奖励 (RLVR)

| 维度 | 传统 RLHF (人类主观对齐) | **RLVR (可验证奖励强化学习)** |
|---|---|---|
| **目标任务** | 开放式问答、角色扮演、文本润色 | **数学推理、竞赛编程、形式化逻辑证明** |
| **奖励来源** | 由神经网络训练的奖励模型 ($r_\psi(x, y)$) | **确定性规则与编译器/判题沙箱 ($r \in \{0, 1\}$)** |
| **致命隐患** | **奖励黑客 (Reward Hacking)**：模型学会用冗长、谄媚的套话欺骗 RM | **零奖励欺骗**：代码必须跑通单元测试，数学最终答案必须精确匹配 |
| **推理表现** | 回答长度固定，无法产生深层复杂推理 | **自主涌现长思维链 (Long CoT)、假设回溯与自我反思修正** |

---

## 2. RLVR 核心奖励函数设计

在 RLVR 流程中，完全无需训练昂贵且易被黑客的奖励模型，直接使用轻量规则判定：

$$
r_{\text{total}} = r_{\text{acc}} + \lambda_{\text{fmt}} r_{\text{fmt}}
$$

1. **准确性奖励 ($r_{\text{acc}} \in \{0, 1\}$)**：
   - **数学问题**：提取模型最终输出在 `\boxed{...}` 中的答案，与标准解析答案进行符号等价对比（SymPy 或正则匹配）；
   - **代码问题**：将模型生成的代码提交至沙箱执行，通过全部隐藏测试用例得 1，否则得 0。
2. **格式规范奖励 ($r_{\text{fmt}} \in \{0, 1\}$)**：
   - 强制模型将思考过程包裹在 `<think> ... </think>` 标签内，最终答案置于 `<answer> ... </answer>` 中。

---

## 3. 群体相对策略优化 (Group Relative Policy Optimization, GRPO)

传统 PPO 算法需要维护一个庞大的 Critic（值函数）网络来估计状态基准线，占用了近一半的训练显存。DeepSeek 提出的 **GRPO** 完全**舍弃了 Critic 模型**，采用**组内相对优势归一化**。

```
输入 Prompt q
      |
      v
[ 当前策略模型 π_θ 采样 G 个候选回答 ] ---> { o_1, o_2, ..., o_G } (如 G = 8)
                                                    |
                                                    v
[ 规则判定器 / 编译沙箱并发评分 ] -------------> { r_1, r_2, ..., r_G }
                                                    |
                                                    v
[ 组内归一化计算优势 Advantage ] --------------> A_i = (r_i - mean(r)) / std(r)
                                                    |
                                                    v
[ 计算 GRPO 梯度并更新策略 π_θ ] <------------------+ (无需 Critic 网络!)
```

### 3.1 组内相对优势 (Group Advantage) 计算
对同一 Prompt $q$，当前策略生成 $G$ 个候选回答 $\{o_1, o_2, \dots, o_G\}$，经规则验证得到评分 $\{r_1, \dots, r_G\}$：
$$
A_i = \frac{r_i - \text{mean}(\{r_1, \dots, r_G\})}{\text{std}(\{r_1, \dots, r_G\}) + \epsilon}
$$
- **直观理解**：若一个 Prompt 下所有回答都错误（全是 0 分），则组内均值为 0，方差为 0，优势均为 0（不产生无效扰动）；若只有 1 个回答正确（得分 1，其余 0），该正确路径将获得极高的正向 Advantage，强力拉升其生成概率。

### 3.2 GRPO 优化目标函数
$$
\begin{aligned}
\mathcal{L}_{\text{GRPO}}(\theta) = -\frac{1}{G}\sum_{i=1}^G \Biggl( &\min\left( \frac{\pi_\theta(o_i \mid q)}{\pi_{\text{old}}(o_i \mid q)} A_i, \; \text{clip}\left(\frac{\pi_\theta(o_i \mid q)}{\pi_{\text{old}}(o_i \mid q)}, 1-\epsilon, 1+\epsilon\right) A_i \right) \\
&- \beta D_{\text{KL}}(\pi_\theta \parallel \pi_{\text{ref}}) \Biggr)
\end{aligned}
$$

---

## 4. DeepSeek-R1-Zero: 自主推理能力的涌现

DeepSeek-R1-Zero 证明了：**无需任何人类专家编写的冷启动 SFT 思维链数据，仅凭纯基础模型 (Base Model) + RLVR (GRPO)，模型能够完全自主学会思考与探索！**

```
强化学习训练步数 (RL Steps) ^
                             |                                    / (Aha Moment: 准确率突破)
                             |                                  /
                             |                       +---------+ (自主学会中文/英文反思纠错)
                             |                      /
                             |  -------------------+ (思考长度从 500 Tokens 自动扩展到 10K+ Tokens)
                             +---------------------------------------------------->
                             0                                                    训练步数
```

### 4.1 自主涌现的三大认知行为
1. **测试时思考时间扩展 (Length Scaling)**：随着 RL 迭代，模型生成的 `<think>` 思考长度从初始的几百 Token 自动拉长至上万 Token，模型发现“想得越久、尝试分支越多，答对概率越高”。
2. **自我反思与假设回溯 (Self-Correction & Backtracking)**：模型自发产生类似人类的思维语言（*"Wait, let me rethink this step..."*, *"Let me check if this derivative is correct..."*），主动推翻错误假设并重新推导。
3. **“顿悟时刻 (Aha Moment)”**：在特定训练节点，模型突然在极难的数学奥赛题（如 AIME）上实现跨越式准确率突破，证明强化学习能够自发挖掘出超越人类直觉的搜索解题路径。
