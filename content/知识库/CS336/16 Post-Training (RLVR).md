# Lecture 16：推理后训练——RLVR 与 GRPO

> RLHF 在开放式偏好上容易 reward overoptimization；本讲把强化学习扩展到**可验证奖励**的领域，说明为什么数学、代码、科学问题能激发长思维链（CoT），以及 GRPO 如何用一组采样结果替代昂贵的 value model。

## 1. 从 RLHF 到 RLVR

### 1.1 动机

RLHF 的奖励通常来自人类或 LM judge，存在：

- 奖励模型与真实偏好的差距；
- 继续优化会过拟合 reward model；
- 开放式回答很难定义“绝对正确”。

而在数学、代码、形式证明、棋类等领域，可以用程序或规则直接验证结果。目标是把奖励定义为“我们真正想要的可检查属性”：

- 数学：最终答案与标准答案等价；
- 代码：通过隐藏测试、单元测试；
- 形式证明：证明器接受/拒绝；
- 格式：是否包含 `<think>...</think>`、JSON 是否可解析；
- 科学：数值/单位/方程检查器。

**RLVR（Reinforcement Learning with Verifiable Rewards）**：对模型采样的回答运行验证器得到奖励，再用 RL 更新策略。验证器可以输出二值奖励，也可以输出部分分数，但必须比开放式“好不好”更可审计。

### 1.2 本讲路线

```text
策略 π_old 采样一组答案
        ↓
验证器/奖励函数 R(q,o)
        ↓
组内归一化（GRPO advantage）
        ↓
PPO-style clipping + reference KL
        ↓
更新 πθ，重复 rollout
```

案例：DeepSeek-R1/R1-Zero、Kimi K1.5、Qwen3 都使用了不同形式的 reasoning RL；它们的共同点不是某个神奇模型组件，而是可验证任务、强数据管线、长 CoT 与大规模 rollout。

---

## 2. PPO 回顾：为什么还需要新算法

### 2.1 Policy Gradient、TRPO 与 PPO

策略梯度：

$$
\nabla_\theta\mathbb E_{z\sim p_\theta}[R(z)]
=\mathbb E_{z\sim p_\theta}
\left[R(z)\nabla_\theta\log p_\theta(z)\right].
$$

直接估计方差高；TRPO 线性化当前策略，并施加 KL 信赖域；PPO 把概率比裁剪：

$$
L^{\mathrm{CLIP}}_t(\theta)=
\min\left(
 r_t(\theta)\hat A_t,
 \operatorname{clip}(r_t(\theta),1-\epsilon,1+\epsilon)\hat A_t
\right),
$$

其中

$$
r_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}
{\pi_{\mathrm{old}}(a_t\mid s_t)}.
$$

### 2.2 语言模型中的 PPO

在 LM 中：

- state 是 prompt 与已经生成的 token；
- action 是下一个 token；
- 每个 token 都可看作动作，但 reward 通常在完整回答末尾计算；
- rollout 由旧策略生成，内层循环在这批 rollout 上多步优化。

工程上通常：

1. 采样 prompts 和完整回答；
2. reward model/验证器计算最终 reward；
3. 给每个 token 加 reference KL 惩罚，最后一个 token 加完整奖励；
4. 用 value model 计算 GAE/advantage；
5. 对同一批 rollout 运行若干个 minibatch epoch；
6. 丢弃旧 rollout，重新采样。

常见稳定性技巧是当新策略对某些序列的 log-probability 低于 reference 时裁剪 KL 惩罚，防止模型崩溃；GAE 中这里是 bandit 问题，常可取 $\gamma=\lambda=1$，此时 advantage 接近 reward-to-go 减 value。

### 2.3 PPO 的代价

- 实现复杂，rollout 与训练需要在不同框架间切换；
- value model 需要额外显存和训练调参；
- RLHF 的偏好数据天然是 pairwise，而 RLVR 的验证器往往直接给 scalar reward；
- DPO 是离线 pairwise 方法，不能直接表达“一个答案通过了 8 个测试”的非成对结构。

因此需要移除 value model、保留 PPO 稳定性的更简洁算法。

---

## 3. GRPO：Group Relative Policy Optimization

### 3.1 核心思想

GRPO 从 PPO 出发，但：

1. 对每个问题 $q$ 从旧策略采样一组 $G$ 个输出 $\{o_1,\ldots,o_G\}$；
2. 用验证器分别得到奖励 $r_i=R(q,o_i)$；
3. 用组内均值和标准差构造相对 advantage，不再训练 value model；
4. 使用 PPO clipping 和 reference KL 更新策略。

组内 z-score advantage：

$$
A_i=\frac{r_i-\operatorname{mean}(r_1,\ldots,r_G)}
{\operatorname{std}(r_1,\ldots,r_G)}.
$$

$A_i>0$ 表示答案在本组相对更好，应提高概率；$A_i<0$ 表示相对更差，应降低概率。

> 直观类比：同一题采样 8 次，不需要知道“这道题平均应该得多少分”，只需要知道哪几次比同组平均好。

### 3.2 GRPO 的目标函数

令 $o_{i,t}$ 为输出 $o_i$ 的第 $t$ 个 token，旧策略为 $\pi_{\mathrm{old}}$，reference 为 $\pi_{\mathrm{ref}}$。常见目标写作：

$$
\mathcal J_{\mathrm{GRPO}}(\theta)
=\mathbb E_{q\sim P(Q),\{o_i\}_{i=1}^{G}\sim\pi_{\mathrm{old}}(\cdot\mid q)}
\left[\frac1G\sum_{i=1}^{G}\left(
\frac1{|o_i|}\sum_{t=1}^{|o_i|}
\min\left(
\rho_{i,t}(\theta)\hat A_i,
\operatorname{clip}(\rho_{i,t}(\theta),1-\epsilon,1+\epsilon)\hat A_i
\right)
-\beta D_{\mathrm{KL}}(\pi_\theta\|\pi_{\mathrm{ref}})
\right)\right].
$$

其中下式中的 $\hat A_i$ 即上面的组内 advantage $A_i$（有些论文用无帽 $A_i$ 记号）。

$$
\rho_{i,t}(\theta)=
\frac{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}
{\pi_{\mathrm{old}}(o_{i,t}\mid q,o_{i,<t})}.
$$

DeepSeekMath/GRPO 的常见 token-level KL 近似为：

$$
D_{\mathrm{KL}}(\pi_\theta\|\pi_{\mathrm{ref}})
\approx
\frac{\pi_{\mathrm{ref}}(o_{i,t}\mid q,o_{i,<t})}
{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}
-\log\frac{\pi_{\mathrm{ref}}(o_{i,t}\mid q,o_{i,<t})}
{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}-1.
$$

有些实现将 KL 在 token 上求和或取均值，并在 batch 内带 mask；具体归一化是实现细节，但必须保持新策略不要无约束偏离 reference。

### 3.3 伪代码

```python
for q in prompts:
    outputs = [policy_old.generate(q) for _ in range(G)]
    rewards = [verifier(q, o) for o in outputs]

    rewards = np.asarray(rewards, dtype=np.float32)
    advantages = (rewards - rewards.mean()) / (rewards.std() + 1e-4)

    for o, A in zip(outputs, advantages):
        ratio = exp(logp_new(o | q) - logp_old(o | q))
        clipped = clip(ratio, 1 - eps, 1 + eps)
        loss = -mean(min(ratio * A, clipped * A)) + beta * kl_to_ref(o)
        loss.backward()
    optimizer.step()
```

GRPO 实现可以很小：计算每个 rollout 的奖励、组内均值/方差、KL 和 clipping loss，然后梯度更新。原始 GRPO 论文中，它超过了只对正确答案做强化的 RFT（reinforcement fine-tuning）；加入 process supervision 还可带来额外增益，但完整 R1 并没有依赖逐步过程奖励。

### 3.4 在线情形

如果采样后立即更新（rollout + immediate update），GRPO 在概念上接近“组归一化奖励的 policy gradient”。PPO clipping 和 KL 仍提供稳定性；批量离线更新则需要注意旧策略与当前策略比率。

---

## 4. GRPO 的偏差、长度效应与 Dr. GRPO

### 4.1 标准 baseline 与 z-score 的区别

策略梯度允许减去任意**只依赖 state、与 action 无关**的 baseline $b(q)$：

$$
\mathbb E_{o\sim\pi_\theta}
\left[(R(q,o)-b(q))\nabla_\theta\log\pi_\theta(o\mid q)\right]
$$

在理想条件下仍是无偏梯度。

GRPO 的均值项 $\bar r$ 可以看作组 baseline；但除以组标准差并不保持无偏性，因为标准差由同一组 action/reward 共同估计，并随题目难度和结果分布变化。标准 GRPO 因此是一个带偏的、但实践上有用的梯度估计。

### 4.2 长度偏差

标准 GRPO 的 response-level 目标通常除以 $|o_i|$，会产生如下偏差：

- 对正 advantage（正确回答），短回答的每个 token 获得更大的梯度，模型偏向“正确但更短”；
- 对负 advantage（错误回答），长回答的惩罚被较多 token 分摊，错误答案反而可能更长。

此外，按组标准差归一化会给“太容易”或“太难”的问题不同权重，改变训练题目分布。

### 4.3 Dr. GRPO（GRPO Done Right）

一种修正思路：

1. 使用无偏的组 baseline
   
   $$
   \hat A_i=R(q,o_i)-\operatorname{mean}\{R(q,o_1),\ldots,R(q,o_G)\};
   $$

2. 去掉 response-level 的 $1/|o_i|$，按 token 直接累积（或使用与 token 数一致的归一化）。

示意目标：

$$
\frac1G\sum_{i=1}^{G}\sum_{t=1}^{|o_i|}
\min\left(
\rho_{i,t}\hat A_i,
\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)\hat A_i
\right).
$$

实验图中 Dr. GRPO 在相近 reward 下让正确输出长度稳定，避免标准 GRPO 对错误回答不断拉长；平均 benchmark 分数相近或更好。具体归一化方式仍需与实现和 batch mask 一起验证。

---

## 5. DeepSeek-R1：用 RL 激发推理与 CoT

### 5.1 R1-Zero

DeepSeek-R1-Zero 是一个受控实验：

- base model：DeepSeek-V3；
- 数据不完全公开；
- **accuracy reward**：最终答案是否正确；
- **format reward**：是否使用要求的思考标签；
- 算法：GRPO；
- 不使用 process supervision（不逐步标注中间推理）。

它的表现略低于 OpenAI o1，但显示出一个重要现象：仅靠可验证结果的 RL，模型会逐渐生成更长的 CoT，并在训练中表现出所谓“aha moment”（重新检查、分解问题、尝试多条路径）。

### 5.2 对“aha”现象的谨慎解释

后续分析指出：

- 输出变长可能部分是 GRPO 目标的长度偏差，而不一定是突然产生新的推理机制；
- base model 可能已经包含“aha”式模式，RL 只是提高了触发概率；
- 因此不能仅凭 CoT 变长就断言模型获得了可解释的真实思维过程。

### 5.3 R1 的两阶段改进

相对 R1-Zero，完整 R1 增加：

1. **SFT 初始化**：先用较长的数学/科学 CoT 让模型学会格式与基本推理；
2. **语言一致性奖励**：鼓励 CoT 与问题使用一致语言，减少不必要的语言切换；
3. **非可验证任务的后续阶段**：对写作、知识和一般对话等问题用 judge/偏好管线补足。

总体路线：

```text
DeepSeek-V3
  → reasoning SFT（长 CoT）
  → GRPO/RLVR（数学、代码、可验证答案）
  → SFT（约 60 万非可验证推理 + 20 万非推理）
  → RLHF/GRPO（包括非可验证任务）
```

#### Reasoning SFT 数据

从 Gemini/R1 等强模型取得约 1,000 个数学和科学问题的长 CoT，就足以作为 bootstrap；少量高质量样本比盲目扩大噪声样本更重要。

#### Distillation

让 R1 生成约 80 万条 CoT，再蒸馏到 Qwen2.5 等非 reasoning 模型，使小模型也能复现部分推理能力。R1 论文还报告了没有奏效的尝试，例如 PRM（process reward model，PRM800K、DeepSeekMath）和 MCTS；这说明更复杂的搜索并非必要条件。

### 5.4 OpenAI o1 与“多想一会儿”

课程把 o1 作为闭源对照：公开结果显示它通过 reasoning post-training 和测试时额外计算，在数学、代码等可验证任务上显著强于普通 GPT-3.5/早期聊天模型；但与开源 R1 一样，完整的训练数据、奖励构造和 rollout 配置并未公开，不能把营销图或最终 CoT 当成完整算法说明。

从 RLVR 角度可以理解其公开现象：

1. **训练时**在可验证推理题上优化“答案是否正确/是否满足约束”，而不只是偏好语言风格；
2. **行为上**学会在最终回答前生成更长的内部推理、检查和回溯轨迹；
3. **推理时**允许用户用更多 token/时间换取更高的 pass@k，属于 test-time compute scaling；
4. **产品输出**可能只展示经过筛选的简短答案，内部思维链不等于可公开的解释，也不应假定其中每一步都真实、完整或安全。

因此，o1 与 R1 的共同机制是“可验证奖励 + 更长推理预算”这一范式，而 R1 的价值在于公开了 GRPO、R1-Zero、SFT 初始化和蒸馏等更多可复现实验细节。

---

## 6. Kimi K1.5：长 CoT、参考策略奖励与长度控制

Kimi K1.5 与 R1 同期发布，也通过 RL 达到超过 o1 的表现。其关键步骤：难度筛选的数据、长 CoT SFT、自己的 policy gradient loss。

### 6.1 数据与 SFT

- 平衡不同数学主题；
- 排除选择题/判断题，减少偶然猜对的 false positive；
- 只选择模型 best-of-8 仍容易失败的问题；
- SFT 部分公开细节较少，可能包含 prompt engineering/蒸馏。

### 6.2 参考策略正则化目标

对数据中的正确答案 $y^*$ 与当前策略采样的 $(y,z)$：

$$
\max_\theta\mathbb E_{(x,y^*)\sim\mathcal D}
\left[
\mathbb E_{(y,z)\sim\pi_\theta}
[r(x,y,y^*)]
-\tau D_{\mathrm{KL}}\left(\pi_\theta(\cdot\mid x)\|\pi_{\theta_i}(\cdot\mid x)\right)
\right].
$$

非参数最优解给出：

$$
 r(x,y,y^*)-\tau\log Z
=\tau\log\frac{\pi^*(y,z\mid x)}{\pi_{\theta_i}(y,z\mid x)}.
$$

于是可以用平方损失拟合隐含奖励：

$$
\mathcal L(\theta)=
\mathbb E_{(x,y^*)\sim\mathcal D}
\left[
\mathbb E_{(y,z)\sim\pi_{\theta_i}}
\left(
 r(x,y,y^*)-\tau\log Z
-\tau\log\frac{\pi_\theta(y,z\mid x)}{\pi_{\theta_i}(y,z\mid x)}
\right)^2
\right].
$$

相应的 policy-gradient + regularization 形式近似为：

$$
\frac1k\sum_{j=1}^{k}
\left[
\nabla_\theta\log\pi_\theta(y_j,z_j\mid x)\,(r(x,y_j,y^*)-\bar r)
-\frac\tau2\nabla_\theta
\left(\log\frac{\pi_\theta(y_j,z_j\mid x)}
{\pi_{\theta_i}(y_j,z_j\mid x)}\right)^2
\right].
$$

这与 DPO 的“非参数假设 + 解出隐含奖励”有相似推导，但 Kimi 直接使用参考策略奖励与平方 surrogate。

### 6.3 长度奖励

Kimi 希望最终压缩 CoT。对同一 batch 的第 $i$ 条输出：

$$
\operatorname{len\_reward}(i)=
\begin{cases}
\lambda,&r(x,y_i,y^*)=1,\\
\min(0,\lambda),&r(x,y_i,y^*)=0,
\end{cases}
$$

其中

$$
\lambda=0.5-\frac{\operatorname{len}(i)-\operatorname{min\_len}}
{\operatorname{max\_len}-\operatorname{min\_len}}.
$$

因此：

- 正确答案越短，奖励越大；
- 错误答案也被鼓励比本组长度中心更短；
- 该奖励通常在训练后期才启用，避免过早压缩导致能力下降。

### 6.4 课程学习与验证器

- 给数据集打难度标签，由易到难；
- 按 $(1-\operatorname{success\_rate})$ 采样，减少重复已经解决的问题；
- 代码任务：从有 ground-truth 的问题生成新测试用例；
- 数学任务：用约 80 万样本训练 CoT reward model 检查答案等价性。

### 6.5 RL 基础设施

RLVR 的吞吐难以做高：

- on-policy 必须反复 rollout，推理慢；
- 训练与 rollout 往往使用不同框架，切换代价高；
- 长 CoT 使 batch 中序列长度差异巨大，padding 与 GPU 利用率下降。

Kimi 的系统设计强调 rollout/训练并行、长度分桶、动态 batch 和验证器吞吐；大规模 RL 的系统工程与算法同样重要。

---

## 7. Qwen3：低数据 RLVR 与思考模式控制

Qwen3 在时间上较新，也在多个指标上超过 o1/R1。其整体图景是：

```text
预训练/中训练
  → 难度过滤与 reasoning SFT
  → GRPO（仅约 3995 个高质量例子）
  → RLHF
  → 蒸馏与专家模型
```

### 7.1 数据过滤

- 用 best-of-$n$ 评估难度；
- 删除无需 CoT 就能解决的问题；
- 删除与验证集过于相似的样本；
- 人工过滤“猜对而非真正推导”的 CoT；
- 只在约 3995 个筛选后的样本上做 GRPO。

### 7.2 Thinking mode fusion

Qwen3 将“思考”和“非思考”数据混合，用标签控制模式：

1. 同一模型同时学习带 `<think>` 的长推理和直接回答；
2. 使用特殊字符串进行 early-stop termination；
3. 推理时可在质量与延迟之间选择模式，并通过 test-time scaling 采样更多候选。

一般能力 RLHF 后，数学/STEM 分数可能略有下降，说明不同阶段需要隔离数据、检查灾难性遗忘。

### 7.3 Agentic RL 与 Qwen3 Coder Next

Qwen3 Coder Next 基于 Qwen3 Next，专门后训练 agent 能力：

- GitHub 长上下文仓库数据（拼接文件约 6,000 亿 tokens）；
- 带 RAG 检索的 Pull Request 与仓库状态；
- Common Crawl 的文本+代码文档与 LM HTML 解析；
- 面向 coding 的网页 QA、运行 coding agent 的轨迹、fill-in-the-middle 和 instruction-following；
- 分别训练 web-dev、UX、单轮 QA、SWE 等专家模型，再蒸馏/组合。

Agent 环境构造可自动生成约 80 万个 SWE-bench 风格任务；web-dev 专家在可执行检查、VLM 与 agent 动作上做 SFT，UX 专家学习多种工具格式。

---

## 8. RLVR 的训练与评测要点

### 8.1 验证器设计

验证器必须比策略更难“钻空子”：

- 代码使用隐藏测试、随机测试和资源限制，防止硬编码；
- 数学检查最终答案的等价形式（分数、单位、变量重命名）；
- 格式奖励只能约束结构，不能替代正确性奖励；
- 多步证明可用证明器或独立 judge，不能只检查模型自报“正确”。

### 8.2 奖励构成

常见组合：

$$
R=R_{\mathrm{accuracy}}
+\alpha R_{\mathrm{format}}
+\eta R_{\mathrm{language}}
-\beta D_{\mathrm{KL}}(\pi_\theta\|\pi_{\mathrm{ref}}).
$$

要避免格式奖励压过答案正确性，也要避免 KL 太强导致模型不探索。

### 8.3 CoT 是能力还是界面

RL 让模型生成更长 CoT，可能是：

1. 真正增加了分解、验证和回溯行为；
2. 只是模型学会延长输出以获得更多尝试机会；
3. 由于 GRPO 长度偏差，错误答案也被拉长；
4. base model 已有 latent reasoning，RL 只提高触发率。

因此评测应包括：最终正确率、过程可验证性、不同长度下的 pass@k、简洁度、对抗题和隐藏测试，而不应把“展示的 CoT”直接当成内部真实思维。

---

## 9. 本讲总结

1. RLHF 的开放式 reward 容易过优化；RLVR 在数学、代码和形式任务中使用可验证奖励，把优化目标与真实正确性更紧密地连接起来。
2. GRPO 用同一题的一组 rollout 做组内均值/标准差归一化，移除昂贵的 value model，同时保留 PPO clipping 与 KL 正则。
3. 标准 GRPO 的 z-score 与长度归一化存在偏差：正确答案偏短，错误答案偏长；Dr. GRPO 用无偏 baseline 与 token 级累积缓解。
4. R1-Zero 展示了 accuracy/format reward 可以激发长 CoT；完整 R1 再用 reasoning SFT、语言一致性和一般任务后训练补足。
5. Kimi K1.5 强调难度过滤、长 CoT、参考策略平方 surrogate 与后期长度奖励；Qwen3 展示低数据 RLVR、thinking-mode fusion 和 agentic RL。
6. RLVR 的瓶颈不只在算法：rollout 推理、验证器、长序列 batch、训练/推理框架切换和奖励漏洞都决定最终效果。
