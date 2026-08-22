# Lecture 15 - Post-Training (SFT & RLHF, DPO)

> **课程主题**：大模型后训练技术：指令微调（SFT）、人类反馈强化学习（RLHF）与直接偏好优化（DPO）
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：掌握大模型从基础补全到可控对齐的完整后训练技术栈，理解生成-验证鸿沟（G-V Gap）、SFT 风格与幻觉诱发机制、奖励模型（Bradley-Terry）数学原理，深入推导 DPO 的闭式解析解及其梯度动力学，并剖析奖励黑客（Reward Hacking）与模式坍塌（Mode Collapse）。

---

## 1. 后训练范式演进：从模仿到优化

预训练模型本质上是对互联网文本的条件概率拟合 $P(x_t \mid x_{<t})$，但人类期望的模型是具备**指令遵从（Instruction Following）、真实性与安全性（Helpful & Harmless）的对话助手**。

```
[ 阶段 1: 预训练 (Pre-training) ] ──> 学习通用语言与海量世界事实 (自回归预测下一 Token)
                   │
                   ▼
[ 阶段 2: 指令微调 (SFT) ]       ──> 行为克隆 / 模仿学习 (Imitation Learning: 格式对齐、风格塑造)
                   │
                   ▼
[ 阶段 3: 偏好强化对齐 (RLHF/DPO)]──> 强化学习直接优化偏好奖励 (Optimization: 激发推理、抑制幻觉与有害性)
```

### 1.1 生成-验证鸿沟 (The Generation-Verification Gap)
- **为什么仅靠 SFT 是不够的？** 对于复杂任务（如长文摘要、代码架构、数学证明），**人类或评估系统“判断哪个回答更好”（验证 Verification）的难度远远低于“亲自写出完美回答”（生成 Generation）**。
- **强化学习的本质**：直接利用成对偏好或标量奖励，在模型自身的探索采样中强化高奖励输出、惩罚低奖励输出。

---

## 2. 指令微调 (Supervised Fine-Tuning, SFT) 深度机理

### 2.1 SFT 数据集演进谱系

```
2021 (FLAN): 学术 NLP 任务提示化 ──> 2022 (Self-Instruct / Alpaca): 52K GPT-3.5 蒸馏指令
     │
2023 (OpenAssistant / ShareGPT): 真实长对话与专家领域问答 ──> 2024 (Tulu 3 / Nemotron): 融入工具调用与 Agent 轨迹
```

### 2.2 SFT 关键动力学特征
1. **表面形式假说 (LIMA / Style Effect)**：SFT 的核心作用在于**唤醒和规范模型在预训练阶段已获得的潜在能力与输出风格（如分点列出、客气语气、Markdown 排版）**，而非强行注入全新知识。
2. **微调未知事实引发幻觉 (Schulman 2023, Gekhman 2023)**：
   - 若在 SFT 阶段强行要求模型记忆预训练阶段未见过的长尾事实，模型会学会**“在不确定时编造高置信度的虚假引用与细节”**，加剧幻觉发生率。
3. **安全微调的数据高效性**：仅需 $500 \sim 1000$ 条高质量安全拒绝与合规问答样本，即可激活全模型的安全防线。
4. **中间训练 / 二阶段退火 (Mid-Training)**：在预训练最后 $10\%\sim 20\%$ 的 Token 中混入高质量 SFT 与问答数据，平滑过渡至下游对齐阶段。

---

## 3. 经典 RLHF 架构与奖励模型 (Reward Modeling)

```
                            [ 经典 RLHF 三步流水线 ]
  1. 提示词 x ──> 采样两个回答 (y_w, y_l) ──> 人工/AI 标注胜者 y_w ≻ y_l
                        │
                        ▼
  2. 训练标量奖励模型 (Reward Model): 最小化 Bradley-Terry 对数损失
                        │
                        ▼
  3. PPO 强化学习优化: Actor 模型在 Reward Model 引导下最大化期望奖励 + KL 散度约束
```

### 3.1 Bradley-Terry 偏好模型与奖励损失

假设人类对于回答 $y$ 给出的隐含标量奖励为 $r^*(x, y)$。两个回答 $y_w$（优胜者）与 $y_l$（被拒者）的偏好概率满足 Sigmoid 分布：
$$P(y_w \succ y_l \mid x) = \sigma(r(x, y_w) - r(x, y_l)) = \frac{1}{1 + e^{-(r(x, y_w) - r(x, y_l))}}$$

**奖励模型训练目标**：
$$\mathcal{L}_{\text{RM}}(\theta) = -\mathbb{E}_{(x, y_w, y_l) \sim \mathcal{D}} \left[ \log \sigma\left( r_\theta(x, y_w) - r_\theta(x, y_l) \right) \right]$$

### 3.2 PPO (Proximal Policy Optimization) 策略目标

$$\max_{\pi_\theta} \mathbb{E}_{x \sim \mathcal{D}, y \sim \pi_\theta(x)} \left[ r_\phi(x, y) \right] - \beta \, \mathbb{D}_{\text{KL}}\left(\pi_\theta(y \mid x) \parallel \pi_{\text{ref}}(y \mid x)\right)$$
- **KL 惩罚项**：防止策略网络 $\pi_\theta$ 过度偏离初始 SFT 基础模型 $\pi_{\text{ref}}$，避免策略崩溃与生成退化。
- **系统复杂性**：需在 GPU 上同时维护 Actor、Critic（Value Model）、Reference Model、Reward Model 四个巨型网络，显存与通信调度极其繁复。

---

## 4. 直接偏好优化 (Direct Preference Optimization, DPO) 数学推导

DPO（Rafailov et al., 2023）通过严格的代数变换，**彻底去除了显式奖励模型与 PPO 在线采样回路**。

### 4.1 隐含最优策略与奖励重参数化

对于带 KL 散度约束的 RL 优化问题：
$$\max_\pi \mathbb{E}_{x \sim \mathcal{D}} \left[ \mathbb{E}_{y \sim \pi} [r(x, y)] - \beta \mathbb{D}_{\text{KL}}(\pi(y \mid x) \parallel \pi_{\text{ref}}(y \mid x)) \right]$$

通过拉格朗日乘子法求解无约束极值，可知其闭式解析最优策略满足：
$$\pi_r(y \mid x) = \frac{1}{Z(x)} \pi_{\text{ref}}(y \mid x) \exp\left(\frac{r(x, y)}{\beta}\right)$$
其中归一化配分函数为 $Z(x) = \sum_y \pi_{\text{ref}}(y \mid x) \exp\left(\frac{r(x, y)}{\beta}\right)$。

两边取对数重排，即可将标量奖励 $r(x, y)$ 精确表示为策略似然比的形式：
$$r(x, y) = \beta \log \frac{\pi_r(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)$$

### 4.2 DPO 损失函数推导

将上述奖励代入 Bradley-Terry 损失中，归一化常数 $\beta \log Z(x)$ 在做差时**完全对消**：
$$r(x, y_w) - r(x, y_l) = \beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}$$

最终得到简洁优雅的 **DPO 离线监督损失**：
$$\mathcal{L}_{\text{DPO}}(\pi_\theta; \pi_{\text{ref}}) = -\mathbb{E}_{(x, y_w, y_l) \sim \mathcal{D}} \left[ \log \sigma\left( \beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} \right) \right]$$

### 4.3 DPO 梯度更新机制剖析

对参数 $\theta$ 求导：
$$\nabla_\theta \mathcal{L}_{\text{DPO}} = -\beta \, \sigma\left( \hat{r}_\theta(x, y_l) - \hat{r}_\theta(x, y_w) \right) \left[ \nabla_\theta \log \pi_\theta(y_w \mid x) - \nabla_\theta \log \pi_\theta(y_l \mid x) \right]$$

```
Gradient Dynamics:
  1. 正向梯度 (+): 提升优胜回答 y_w 的对数似然 log π_θ(y_w | x)
  2. 负向梯度 (-): 压低被拒回答 y_l 的对数似然 log π_θ(y_l | x)
  3. 动态权重系数: 由当前隐式奖励打分的错误程度 σ(r_l - r_w) 动态加权
     (当模型已经正确判断 y_w >> y_l 时，梯度自动衰减至 0，防止过拟合)
```

---

## 5. 偏好对齐的病态现象与防范 (Pitfalls)

1. **奖励黑客与过度优化 (Reward Hacking / Goodhart's Law)**：
   - 策略网络过度迎合奖励模型的拟合缺陷，生成看似辞藻华丽、实则荒谬的内容。
2. **回复长度膨胀 (Verbosity / Length Inflation)**：
   - 标注人员与裁判大模型天然偏好更长、排版更复杂的回答，导致模型输出急剧变长。可采用 **SimPO**（对序列长度进行归一化惩罚）缓解。
3. **模式坍塌与多样性丧失 (Mode Collapse)**：
   - 强对齐后模型的输出熵急剧收窄，丧失探索生成多样性与校准概率特性。
