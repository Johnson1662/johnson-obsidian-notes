# Lecture 09 - Scaling Laws (Part 1)

> **课程主题**：大模型缩放法则（Scaling Laws）基础：数据缩放、模型缩放与 Kaplan vs Chinchilla 算力分配
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：掌握大模型研发中“先小规模实验拟合法则、再大尺度外推预测”（Scaling Recipe）的核心方法论，理解幂律分布（Power Laws）的统计根基，精通计算最优分配（Compute-Optimal Scaling）与推理最优过训练（Overtraining）法则。

---

## 1. 缩放法则哲学与可预测性范式 (Predictability)

面对数十万张 GPU 与数千万美元的超大模型训练预算，直接在大模型上盲目调参在经济与工程上不可承受。

```
[ 小规模算力实验 (如 1e19~1e22 FLOPs) ] ──(严密拟合)──> [ 幂律缩放法则 (Scaling Law) ] ──(零样本外推)──> [ 预测超大模型的最优架构与 Loss ]
```

- **核心价值**：**可预测性（Predictability）与最优性同等重要**。通过构建标准化的 Scaling Recipe，在小模型上确定超参数与数据配比，外推锁定大模型最优配置并精确预测最终验证损失（Loss）。

---

## 2. 幂律分布 (Power Laws) 的统计学根基

### 2.1 为什么学习曲线服从幂律？

在对数-对数坐标系（Log-Log Plot）下，模型误差与数据量/参数量呈现严格的线性关系：
$$\log(\text{Error}) = -\alpha \log(N) + C \iff \text{Error} \propto N^{-\alpha}$$

- **参数估计（均值估计基准）**：
  设 $x_1, \dots, x_n \sim \mathcal{N}(\mu, \sigma^2)$，样本均值估计误差 $\mathbb{E}[(\hat{\mu} - \mu)^2] = \frac{\sigma^2}{n}$，取对数得 $\log(\text{Error}) = -\log(n) + 2\log(\sigma)$，幂律指数 $\alpha = 1.0$。
- **非参数流形学习（Nonparametric Learning）**：
  对于 $d$ 维流形上的平滑函数逼近，样本复杂度为 $\mathcal{O}(n^{-1/d})$。语言模型学习的幂律指数 $\alpha$ 与自然语言在低维潜在流形上的**内在维度（Intrinsic Dimensionality）**密切相关。

### 2.2 数据分布偏移与数据重复法则
1. **分布偏移 (Distribution Shift)**：高质量数据与低质量数据通常具有相同的衰减斜率 $\alpha$，但具有更低的常数偏移量 $C$。
2. **数据重复衰减 (Data Repetition)**：当语料有限发生重复时，有效数据量 $D'$ 呈现边际递减效应：
   $$D' = U_d \cdot f(R_d)$$
   （其中 $U_d$ 为独立 Unique Tokens，$R_d$ 为重复轮数，重复超过 4 轮后收益急剧下降）。

---

## 3. 基于缩放法则的超参数决策

| 超参数决策 | 传统经验方法 | 基于 Scaling Laws 的科学决策 |
| :--- | :--- | :--- |
| **架构选型 (Arch)** | 昂贵的大模型单点对比 | 在小模型上拟合 Transformer vs LSTM/RNN 的截距差，验证在大规模下差距持续拉大 |
| **优化器选型** | 盲目尝试 SGD/Adam | 验证 Adam 在全尺度下均保持更陡峭的下降斜率与更低的渐近误差 |
| **临界批大小 (Critical Batch)** | 固定 Batch Size | 拟合 $B_{\text{crit}}(L) \propto \frac{1}{L^{\alpha_B}}$，Loss 越低临界 Batch 越大，在训练中后期逐步线性扩大 Batch |
| **学习率外推 ($\mu\text{P}$)** | 大模型反复扫学习率 | 采用**最大更新参数化 ($\mu\text{P}$, Yang 2022)**，使最优学习率与模型宽度彻底解耦，直接从小模型迁移至百亿/千亿模型 |

---

## 4. 计算最优算力分配：Kaplan vs Chinchilla

在固定总算力预算 $C \approx 6 N D$（其中 $N$ 为非嵌入参数量，$D$ 为训练 Token 数）下，如何将算力分配给模型大小 $N$ 与训练数据量 $D$？

### 4.1 两大经典定律对比

```
Kaplan (2020, OpenAI):     N_opt ∝ C^0.73,  D_opt ∝ C^0.27  ──> 优先扩大模型参数，轻视训练 Token 数 (D ≈ 2~4 N)
Chinchilla (2022, DeepMind): N_opt ∝ C^0.50,  D_opt ∝ C^0.50  ──> 模型大小与 Token 数等比例同等扩张 (D ≈ 20 N)
```

| 特性维度 | Kaplan Scaling Law (2020) | Chinchilla Scaling Law (2022) |
| :--- | :--- | :--- |
| **参数缩放指数** | $N_{\text{opt}} \propto C^{0.73}$ | **$N_{\text{opt}} \propto C^{0.50}$** |
| **数据缩放指数** | $D_{\text{opt}} \propto C^{0.27}$ | **$D_{\text{opt}} \propto C^{0.50}$** |
| **最优比例法则** | 严重低估数据需求 ($D \approx 2 \sim 4 N$) | **$D \approx 20 N$ (如 70B 模型需 1.4T Tokens)** |
| **代表模型设计** | GPT-3 (175B, 仅 300B Tokens - 严重欠训练) | Chinchilla (70B, 1.4T Tokens - 效果全面超越 Gopher 280B) |

### 4.2 Chinchilla 三大拟合方法
1. **训练曲线包络线法 (Minimum over Runs)**：在海量不同 $(N, D)$ 实验曲线的外包络极小值上拟合幂律。
2. **等算力轮廓法 (IsoFLOP Profiles)**：固定算力 $C_i$，扫描不同 $N$，损失曲线呈现抛物线凹凸性，提取顶点拟合最优轨迹。
3. **参数化联合拟合 (Joint Parametric Fitting)**：
   $$L(N, D) = E + \frac{A}{N^\alpha} + \frac{B}{D^\beta}$$
   （其中 $E$ 为不可约熵，通过非线性最小二乘法求解最佳指数 $\alpha \approx 0.34, \beta \approx 0.28$）。

### 4.3 为什么 Kaplan 会得出错误结论？
- **学习率衰减陷阱**：Kaplan 实验中采用固定步数的余弦衰减，在小算力下 Warmup 比例过长，导致小模型学习率未充分退火。
- **嵌入层参数干扰**：未将词表 Embedding 参数从总参数量中剔除。

---

## 5. 训练最优 vs 推理最优：过训练现象 (Overtraining)

Chinchilla 给出的是**训练阶段单次计算最优解（Training-Compute Optimal）**。但在现实工业部署中：
$$\text{Total Lifecycle Cost} = \text{Training Compute} + (\text{Query Volume} \times \text{Inference Compute per Token})$$

```
Token-to-Parameter Ratio 演进:
GPT-3 (2020)       : 2 Tokens / Param   (严重欠训练)
Chinchilla (2022)  : 20 Tokens / Param  (训练计算最优理论基准)
LLaMA-1 (2023)     : 22 Tokens / Param
LLaMA-2 (2023)     : 29 Tokens / Param
Mistral-7B (2023)  : 110 Tokens / Param (过训练)
LLaMA-3 70B (2024) : 215 Tokens / Param (15T Tokens / 70B Params = 极致过训练)
```

> **核心结论**：当模型预期服务海量下游查询时，在预训练阶段对小模型投入远超 Chinchilla 理论值（$100\sim 200 \times N$）的 Token 进行**过训练（Overtraining）**，可以在推理解码时持续享受极低显存占用与极致吞吐红利。
