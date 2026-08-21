# CS336 Lecture 15: 后训练基础、SFT 与人类偏好对齐 (RLHF & DPO)

预训练模型仅是一个“续写机器（Next-token Predictor）”。要使其成为能够安全遵循指令、有问必答并拒绝有害请求的 AI 助手，必须经过**后训练（Post-Training）**。后训练主要包括两大核心阶段：**监督微调 (SFT)** 与 **偏好对齐 (Alignment)**。

---

## 1. 监督微调 (Supervised Fine-Tuning, SFT)

SFT 使用高质量的指令-回答多轮对话数据（如 Alpaca, ShareGPT）对预训练基座模型进行有监督训练。

### 1.1 数据格式与损失屏蔽 (Loss Masking)
标准对话格式（以 ChatML 为例）：
```text
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
Write a python function to compute factorial.<|im_end|>
<|im_start|>assistant
def factorial(n):
    return 1 if n <= 1 else n * factorial(n - 1)<|im_end|>
```

- **损失掩码机制 (Loss Masking)**：
  在计算自回归交叉熵损失时，**仅对 Assistant 回复的 Token 计算 Loss**，System 和 User 的 Prompt Token 对应的目标标签全部设为 `-100`（PyTorch 默认忽略）：
  $$
  \mathcal{L}_{\text{SFT}}(\theta) = -\sum_{t \in \text{Assistant Tokens}} \log P_\theta(x_t \mid x_{<t})
  $$
  防止模型过拟合人类 Prompt 的输入句式。

---

## 2. 人类偏好建模与 Bradley-Terry 模型

由于很多开放性任务（如写作、摘要）难以定义单一的标准答案，通常向标注员展示同一 Prompt $x$ 下的两个模型输出：胜者 $y_w$（Win / Preferred）与败者 $y_l$（Lose / Dispreferred）。

### 2.1 Bradley-Terry 偏好概率模型
假设存在一个潜在的标量奖励函数 $r(x, y)$，人类偏好 $y_w$ 胜过 $y_l$ 的概率服从 Sigmoid 变换：
$$
P(y_w \succ y_l \mid x) = \sigma(r(x, y_w) - r(x, y_l)) = \frac{1}{1 + e^{-(r(x, y_w) - r(x, y_l))}}
$$

---

## 3. 经典三阶段 RLHF (InstructGPT / PPO 范式)

OpenAI 在 InstructGPT 中确立的三阶段标准 RLHF 流程：

```
[ 阶段 1: 预训练 Base 模型 ] ---> SFT 监督微调 ---> 获得初始策略 π_SFT
                                                   |
[ 阶段 2: 偏好标注对 (x, yw, yl) ] ---> 训练奖励模型 (Reward Model, RM) r_ψ(x, y)
                                                   |
[ 阶段 3: 强化学习 PPO 优化 ] <--------------------+
  - Actor 模型 π_θ 生成回复 y
  - RM 模型 r_ψ 打分给出奖励
  - Reference 模型 π_ref 计算 KL 散度惩罚
  - Critic 模型 V_φ 估计状态价值
```

### 3.1 奖励模型目标函数
$$
\mathcal{L}_{\text{RM}}(\psi) = -\mathbb{E}_{(x, y_w, y_l)} \left[ \log \sigma\left( r_\psi(x, y_w) - r_\psi(x, y_l) \right) \right]
$$

### 3.2 PPO 策略优化目标
$$
\max_{\pi_\theta} \mathbb{E}_{x \sim \mathcal{D}, \; y \sim \pi_\theta(\cdot \mid x)} \left[ r_\psi(x, y) - \beta D_{\text{KL}}\left( \pi_\theta(y \mid x) \parallel \pi_{\text{ref}}(y \mid x) \right) \right]
$$
- **KL 惩罚项 ($D_{\text{KL}}$)**：严格限制微调后的策略 $\pi_\theta$ 不能偏离初始参考模型 $\pi_{\text{ref}}$ 太远，防止模型利用奖励模型的漏洞进行“**奖励黑客（Reward Hacking）**”。
- **PPO 的工程痛点**：显存开销极大（必须同时在显存中常驻 Actor、Critic、Reward Model、Ref Model 四套网络），且强化学习采样策略极其敏感脆弱、容易训练崩溃。

---

## 4. 直接偏好优化 (Direct Preference Optimization, DPO)

Rafailov et al. (NeurIPS 2023) 在数学上证明：**可以完全绕过显式的奖励模型与 PPO 强化学习采样，直接在成对偏好数据上通过闭式解析损失优化模型！**

### 4.1 隐式奖励代换推导
PPO 的带 KL 约束最优策略存在精确解析解：
$$
\pi^*(y \mid x) = \frac{1}{Z(x)} \pi_{\text{ref}}(y \mid x) \exp\left( \frac{1}{\beta} r(x, y) \right)
$$
对两边取对数可将奖励函数 $r(x, y)$ 反解为策略模型与参考模型的对数几率差（Implicit Reward）：
$$
r(x, y) = \beta \log \frac{\pi_\theta(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)
$$
将该隐式奖励直接代入 Bradley-Terry 似然目标中，配分函数 $Z(x)$ 在差值中被**精确抵消**！

### 4.2 DPO 最终损失函数
$$
\mathcal{L}_{\text{DPO}}(\pi_\theta; \pi_{\text{ref}}) = -\mathbb{E}_{(x, y_w, y_l)} \left[ \log \sigma\left( \beta \log \frac{\pi_\theta(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \beta \log \frac{\pi_\theta(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} \right) \right]
$$

### 4.3 DPO 梯度机制与工程优势

```
DPO 梯度的作用力:
  - 增大优质回答概率:  P_θ(y_w | x) ↑
  - 压低劣质回答概率:  P_θ(y_l | x) ↓
  - 动态权重系数: 当隐式奖励模型错误判断 y_l > y_w 时，给予最大的梯度惩罚
```

| 对比维度 | 传统 PPO / RLHF | 直接偏好优化 (DPO) |
|---|---|---|
| **模型常驻数量** | 4 个模型 (Actor, Critic, RM, Ref) | **2 个模型** ($\pi_\theta$ 与冻结的 $\pi_{\text{ref}}$) |
| **训练稳定性** | 极度不稳定，超参敏感，易崩盘 | **与标准 SFT 同样稳定**，收敛平滑 |
| **显存与计算开销** | 需在线前向采样 Rollout，开销巨大 | 纯离线对数概率前向计算，显存占用降低 $>60\%$ |
