# CS336 Lecture 9: 模型缩放定律 (Scaling Laws Part 1)

大模型预训练单次消耗数百万至数千万美元算力。在千亿规模下进行网格超参调优在工程上是不可承受的。**Scaling Laws（模型缩放定律）** 的核心目标是：**在小算力规模（$10^{21} \sim 10^{24}$ FLOPs）下拟合幂律曲线，精确外推并指导大算力规模（$10^{25} \sim 10^{26}$ FLOPs）下的模型尺寸、数据量与超参配比**。

---

## 1. 经典 Scaling Laws: Kaplan vs Chinchilla

语言模型预训练测试集 Cross-Entropy Loss $L$ 与参数量 $N$、数据量 $D$ 和算力预算 $C$ 之间遵循极其精准的**幂律衰减规律（Power Law）**。

```
Loss L(N, D)
   ^
   |  \
   |    \   Kaplan (2020): 优先增大参数量 N，数据量 D 次之 (D ∝ C^0.27)
   |      \
   |        \  Chinchilla (2022): 参数量与数据量同比例同等缩放 (D ∝ C^0.50, D ≈ 20 N)
   |          \
   +------------------------------------------------------------>
                                                    Compute Budget C = 6ND
```

### 1.1 Kaplan 拟合公式 (OpenAI 2020)
早期 OpenAI 论文将参数量 $N$ 与数据量 $D$ 分别进行单变量拟合：
$$
L(N) = \left(\frac{N_c}{N}\right)^{\alpha_N}, \quad L(D) = \left(\frac{D_c}{D}\right)^{\alpha_D}
$$
- **结论与偏差**：Kaplan 认为算力增加时应主要扩大模型参数量（$N \propto C^{0.73}$），数据量只需轻微增长（$D \propto C^{0.27}$）。这导致早期大模型（如 175B 的 GPT-3 仅训练 300B Tokens）处于**严重欠训练（Under-trained）**状态。

### 1.2 Chinchilla 计算最优模型 (Hoffmann et al., DeepMind 2022)
DeepMind 指出单变量拟合忽略了学习率衰减未充分收敛的偏差，提出了二元联合参数化损失函数：

$$
L(N, D) = E + \frac{A}{N^\alpha} + \frac{B}{D^\beta}
$$

- $E$：不可约损失（Irreducible Loss，自然语言的固有熵极限，约 $1.69$）。
- $\frac{A}{N^\alpha}$：模型容量有限带来的表征误差（$\alpha \approx 0.34, A \approx 406.4$）。
- $\frac{B}{D^\beta}$：训练数据有限带来的统计采样误差（$\beta \approx 0.28, B \approx 410.7$）。

#### 拉格朗日乘子法求解最优配比
在固定总算力预算约束 $C = 6 N D$ 下，最小化损失函数 $L(N, D)$：
$$
\min_{N, D} \left( E + \frac{A}{N^\alpha} + \frac{B}{D^\beta} \right) \quad \text{s.t.} \quad 6 N D = C
$$
求解偏导极值可得最优分配指数：
$$
N_{\text{opt}} = G \cdot \left(\frac{C}{6}\right)^a, \quad D_{\text{opt}} = G^{-1} \cdot \left(\frac{C}{6}\right)^b
$$
其中：
$$
a = \frac{\beta}{\alpha + \beta} \approx \frac{0.28}{0.34 + 0.28} \approx 0.45, \quad b = \frac{\alpha}{\alpha + \beta} \approx \frac{0.34}{0.34 + 0.28} \approx 0.55
$$
- **Chinchilla 黄金准则**：参数量与数据量应当**以接近 $1:1$ 的同等比例共同增长**。
- **经验最优比例**：
  $$
  D \approx 20 \times N \quad (\text{每 } 10\text{ 亿参数至少对应 } 200\text{ 亿 Tokens})
  $$

---

## 2. 算力最优与推理最优的经济学冲突 (Over-training)

Chinchilla 准则仅从**训练阶段算力最小化**角度出发，但在实际工业部署中，**推理是持续进行的长期成本**。

| 模型 | 参数量 $N$ | 预训练 Token 数 $D$ | Token/参数比 | 策略类型 | 商业逻辑 |
|---|---|---|---|---|---|
| **Chinchilla** | 70B | 1.4T Tokens | $20 : 1$ | 训练算力最优 (Compute-Optimal) | 仅在一次性学术基准中性价比最高 |
| **Llama 1** | 65B | 1.4T Tokens | $21.5 : 1$ | 接近 Chinchilla | 开源大模型探索阶段 |
| **Llama 2** | 70B | 2.0T Tokens | $28.6 : 1$ | 轻度过训练 | 提升开源易用性 |
| **Llama 3** | 8B | **15.0T Tokens** | **$1875 : 1$** | **深度过训练 (Over-training)** | 单卡即可运行，极致压低推理与服务部署成本 |
| **DeepSeek-V3** | 37B (激活) | **14.8T Tokens** | **$400 : 1$** | 稀疏过训练 | 小激活参数承受海量 Token，推理吞吐最大化 |

> **过训练法则 (Over-training Principle)**：
> 训练成本是一次性支付的（One-time Cost），而推理成本随用户请求量无限线性累加（Recurring Cost）。
> **宁可在预训练阶段将小模型“过度训练”数十倍 Token，换取极小的参数量与极低的单步推理显存/延迟。**

---

## 3. 拟合 Scaling Law 的工程闭环 (Assignment 3 核心)

在实际工程中，拟合 Scaling Law 的严密流程如下：

```
[ 步骤 1: 小规模实验网格 ] 
在 C = 10^21, 10^22, 10^23 FLOPs 上训练不同架构的微型模型，记录收敛 Loss

[ 步骤 2: 消除学习率偏置 ] 
使用 Cosine 调度器衰减至 0，或使用 WSD 调度器确保每个小模型均完全收敛

[ 步骤 3: 最小二乘/非线性拟合 ] 
通过 scipy.optimize.curve_fit 拟合三参数 L(N, D) = E + A/N^α + B/D^β

[ 步骤 4: 外推大模型超参 ] 
输入目标算力 C_target = 10^26，反解出最优 N_target, D_target 以及学习率 lr_target
```
