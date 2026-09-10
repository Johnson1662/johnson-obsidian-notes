# Lecture 16 - Post-Training (RLVR & Reasoning Models)

> **课程主题**：可验证奖励强化学习（RLVR）与前沿长思维链推理模型（o1/DeepSeek-R1/Kimi k1.5）
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：掌握突破通用偏好对齐瓶颈的可验证奖励强化学习（RLVR）理论，深入推导群组相对策略优化（GRPO）算法及其价值网络消除机制，全面拆解 DeepSeek-R1 的四阶段训练流水线、自反思涌现机制以及小模型蒸馏方案。

---

## 1. 为什么需要可验证奖励 (RLVR)？

通用人类偏好对齐（RLHF）受制于奖励模型拟合缺陷，在训练步数增加后极易遭遇**奖励黑客（Reward Hacking）与过拟合崩溃**。

```
[ 传统 RLHF (主观偏好) ]  ──> 依赖拟合 Reward Model ──> 强行 Scale 导致奖励黑客 (辞藻华丽但胡说八道)
                   │
                   ▼
[ 现代 RLVR (客观可验证) ] ──> 基于真实规则判定 (代码通过单元测试 / 数学答案严格等价) ──> 支持无上限强化自探索
```

- **核心应用域**：数学定理证明、代码生成与 Bug 修复、形式化逻辑推理、算法竞赛等具备确定性 Ground-Truth 验证器的场景。

---

## 2. 群组相对策略优化 (Group Relative Policy Optimization, GRPO)

传统 PPO 需要维护 Actor、Critic（Value Model）、Reference Model、Reward Model 四大网络，显存开销极大且 Critic 估计极易发散。DeepSeek 提出的 **GRPO 彻底移除了 Critic / 价值函数网络**。

```
                      [ GRPO 策略优化流程 ]
  1. 针对输入问题 q，策略网络 π_θ 采样一组 G 个候选输出: {o_1, o_2, ..., o_G}
                             │
                             ▼
  2. 规则验证器计算每个输出的标量奖励: {r_1, r_2, ..., r_G} (含正确性与格式标签)
                             │
                             ▼
  3. 群组内部标准化计算优势 (Advantage): A_i = (r_i - mean(r)) / (std(r) + ε)
                             │
                             ▼
  4. 无 Critic 策略梯度更新: 执行 PPO-Clip 截断与每 Token KL 散度约束
```

### 2.1 GRPO 优势与目标函数数学公式

对于组内第 $i$ 个输出 $o_i$：
$$A_i = \frac{r_i - \frac{1}{G}\sum_{j=1}^G r_j}{\sqrt{\frac{1}{G}\sum_{j=1}^G (r_j - \bar{r})^2} + \epsilon}$$

**GRPO 策略损失函数**：
$$\mathcal{L}_{\text{GRPO}}(\theta) = -\frac{1}{G} \sum_{i=1}^G \left[ \min\left( \frac{\pi_\theta(o_i \mid q)}{\pi_{\text{old}}(o_i \mid q)} A_i, \; \text{clip}\left(\frac{\pi_\theta(o_i \mid q)}{\pi_{\text{old}}(o_i \mid q)}, 1-\epsilon, 1+\epsilon\right) A_i \right) - \beta \, \mathbb{D}_{\text{KL}}\left(\pi_\theta \parallel \pi_{\text{ref}}\right) \right]$$

### 2.2 Dr. GRPO：偏差与长度偏见修正
- **标准差偏差**：除以样本标准差 $\text{std}(r)$ 破坏了强化学习 Baseline 的无偏性，会过度放大极难或极易问题的梯度权重。
- **长度偏见**：由于长输出包含更多 Token，传统逐 Token 累加会导致模型产生病态生成冗长推理链的倾向；可通过留一法（Leave-One-Out）基准与显式长度归一化校准。

---

## 3. 经典案例剖析：DeepSeek-R1 全景架构

```
                             [ DeepSeek-R1 完整四阶段训练流水线 ]
  DeepSeek-V3 Base ──> [ 阶段 1: 少量长 CoT 冷启动 SFT (数千条) ] ──> 注入结构化思考格式 (<think>...</think>)
                                      │
                                      ▼
                      [ 阶段 2: 大规模推理 RLVR (GRPO) ]           ──> 涌现自我反思、回溯重试、验证等深度推理
                                      │
                                      ▼
                      [ 阶段 3: 拒绝采样构建 800K 高质量 SFT ]      ──> 融合 600K 复杂推理 + 200K 通用对齐数据
                                      │
                                      ▼
                      [ 阶段 4: 全功能次级强化对齐 (RLVR + RLHF) ]  ──> 兼顾极端理科推理与通用安全/文科对话
                                      │
                                      ▼
                      [ 成果交付: 蒸馏输出 Qwen/Llama 系列小模型 ] ──> 1.5B ~ 70B 全面具备 SOTA 推理能力
```

### 3.1 DeepSeek-R1-Zero：零 SFT 下的纯强化自进化
- **实验设置**：直接以 DeepSeek-V3 Base 为基座，**完全不经过任何 SFT 数据微调**，仅利用正确性奖励与 `<think>` 格式奖励执行纯 GRPO。
- **自发涌现现象**：
  1. **推理链自发变长**：随着训练步数推进，模型生成的思维链长度从数百 Token 自主扩展至上万 Token。
  2. **“顿悟”时刻 (Aha Moment)**：模型自主学会**“Wait, let me double check... / Alternatively, let's rethink...”**等自主验算、假设纠错与分支回溯行为。

### 3.2 DeepSeek-R1 生产级优化
- **冷启动（Cold-Start）SFT**：针对 R1-Zero 输出排版混乱、中英文混杂的问题，在强化前先注入数千条高质量长 CoT 样本，大幅提升可读性与训练初期的稳定性。
- **语言一致性奖励 (Language Consistency Reward)**：在奖励中引入目标语言比例约束，防止模型在推理过程中随意切换语言。
- **推理小模型蒸馏 (Distillation)**：用 R1 生成 800K 条高质量推理轨迹直接监督微调 Qwen-2.5，使 14B/32B 小模型在数学与代码基准上全面超越原始 GPT-4o。

---

## 4. 前沿推理模型横向对比

| 前沿推理模型 | 强化算法 | 奖励设计特色 | 核心创新机制 |
| :--- | :--- | :--- | :--- |
| **DeepSeek-R1** | **GRPO (无 Critic)** | 规则精确匹配 + 格式标签 + 语言一致性 | 零 SFT 探索涌现、四阶段混合退火、全尺寸开源蒸馏 |
| **Kimi k1.5** | 策略梯度 + 参考奖励 | 课程难度自适应采样 + **显式长度压缩惩罚** | 动态过滤 Best-of-8 无法解决的难题，抑制无效冗长 |
| **Qwen-3 / Next** | GRPO 变体 | 单元测试执行 + 动态 PR 交互 | **思考模式融合 (Thinking Mode Fusion)**：按需控制显式思考长度 |
