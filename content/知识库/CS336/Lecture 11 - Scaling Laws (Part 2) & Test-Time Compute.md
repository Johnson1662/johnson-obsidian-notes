# Lecture 11 - Scaling Laws (Part 2) & Test-Time Compute

> **课程主题**：大模型缩放法则实战：工业级 Scaling 配方、WSD 学习率调度、Muon 优化器与 $\mu\text{P}$ 最大更新参数化深度推导
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：掌握前沿开源模型（MiniCPM、DeepSeek、LLaMA-3、StepFun）的落地缩放实战技术，理解 WSD（Warmup-Stable-Decay）如何将缩放实验成本从 $\mathcal{O}(N^2)$ 压缩至 $\mathcal{O}(N)$，深入推导 $\mu\text{P}$（Maximal Update Parametrization）的数学证明与跨尺度超参数零样本迁移。

---

## 1. 工业级落地缩放配方 (Production Scaling Recipes)

在 2024-2026 年的前沿大模型实践中，工业界分化出两大主流 Scaling 配方：

```
[ 配方 A: 结构解耦型 (MiniCPM / CerebrasGPT) ]
使用 μP 参数化 ──> 保证最优 LR 与模型宽度完全解耦 ──> 结合 WSD 学习率退火 ──> 单次训练高效拟合 Chinchilla 曲线

[ 配方 B: 经验网格拟合型 (DeepSeek / Qwen / StepFun) ]
固定标准参数化 ──> 在多尺度小模型上执行 LR 与 Batch 网格扫描 ──> 拟合超参数幂律曲线外推 ──> 结合 IsoFLOP 确定模型规模
```

| 前沿模型 | 参数化与初始化 | 学习率调度 (LR Schedule) | 缩放法则拟合方法 | 核心创新与结论 |
| :--- | :--- | :--- | :--- | :--- |
| **MiniCPM (2024)** | **$\mu\text{P}$ 最大更新参数化** | **WSD (Warmup-Stable-Decay)** | Chinchilla Method 1 & 3 | 2.4B 小模型效果比肩 7B，超参数零样本跨尺度迁移 |
| **DeepSeek (2024)** | 标准参数化 | **多阶段 WSD 阶梯衰减** | **Chinchilla Method 2 (IsoFLOP)** | 验证了 LR 与 Batch 的凸优化性质，精准预测最终 Loss |
| **LLaMA-3 (2024)** | 标准参数化 | Cosine Decay (配合长文本退火) | IsoFLOP 拟合 | 确立 39:1 甚至更高比例的数据-参数过训练法则 |
| **Hunyuan-MoE (2024)**| MoE 稀疏缩放 | Cosine Decay | MoE IsoFLOP 轮廓 | 确定 **96:1 的数据与激活参数比率** 为最优配置 |

---

## 2. WSD 学习率调度：破解 Chinchilla 拟合的二次方成本

### 2.1 传统 Cosine 调度的困境

在 Chinchilla 实验中，余弦退火（Cosine Decay）的学习率曲线长度必须在训练前与总步数 $T$ 强绑定。若要测试 10 个不同的 Token 规模点，必须从头重复训练 10 次，**产生 $\mathcal{O}(N^2)$ 的巨大算力浪费**。

### 2.2 WSD (Warmup-Stable-Decay) 机制与优势

```
Learning Rate (η)
   ^
η_max|   /──────────────────────────\ (Stable Phase: 保持恒定高学习率)
     |  /                            \
     | /                              \ (Decay Phase: 仅最后 10% 步数急速退火)
   0 ┼─/───────────────────────────────\────> Training Steps
       Warmup        Stable             Decay
```

- **执行流程**：
  1. **Warmup（预热）**：前 $1\%\sim 3\%$ 步数线性提升至 $\eta_{\text{max}}$。
  2. **Stable（平稳期）**：长期维持最高学习率，模型平稳持续吸收知识。
  3. **Decay（急速退火）**：仅在最后 $10\%$ 步数内将学习率退火至 0（或使用指数/线性衰减）。
- **计算收益**：**只需跑一次漫长的 Stable 主分支**，在任意时刻保存 Checkpoint 分叉开启 10% 的 Decay，即可瞬间获得该数据量下的最优收敛损失，**以单次训练成本获得全尺度 IsoFLOP 数据点**。

---

## 3. 前沿矩阵优化器：Muon 与牛顿-舒尔茨正交化

在大模型参数规模突破千亿后，传统 AdamW 面临超参数敏感与矩阵奇异值不均匀问题。

### 3.1 Muon (Momentum Orthogonalized by Newton-schulz)
- **核心思想**：专门针对 2D 权重矩阵，将动量矩阵 $G_t$ 投影正交化为最近的正交矩阵 $U V^T$：
  $$B_t = U \Sigma V^T \implies \text{Orthogonalize}(B_t) \approx U V^T$$
- **牛顿-舒尔茨多项式迭代 (Newton-Schulz Iteration)**：在 GPU 上仅需数次 GEMM 矩阵乘即可快速逼近正交矩阵，无需昂贵的可微 SVD 分解。
- **实战效果**：在 NanoGPT 极速训练与 Kimi-K2 大规模训练中，收敛速度显著优于 AdamW。

---

## 4. 最大更新参数化 ($\mu\text{P}$) 严格数学推导

标准参数化（Standard Parametrization, SP）在网络宽度 $n \to \infty$ 时，会导致浅层特征爆炸或深层梯度消失，导致最优学习率随模型变宽而剧烈漂移。$\mu\text{P}$（Yang et al., 2022）通过重设初始化与学习率尺度，**实现超参数在任意宽度间的严格守恒**。

### 4.1 核心公理假设

设第 $l$ 层的特征向量为 $h_l = W_l h_{l-1}$（输入维度 $n_{l-1}$，输出维度 $n_l$）：
- **公理 A1（初始化不变性）**：初始化时，每个神经元激活值的方差保持 $\Theta(1)$，即 $\|h_l\|_2 = \Theta(\sqrt{n_l})$。
- **公理 A2（更新步长不变性）**：单步梯度更新后，激活值的变化量 $\|\Delta h_l\|_2$ 同样保持 $\Theta(\sqrt{n_l})$（每个神经元平均变动 $\Theta(1)$）。

### 4.2 公理 A1 的推导（权重初始化标准差）

设 $W_l \sim \mathcal{N}(0, \sigma_l^2)$。根据随机矩阵投影定理：
$$\|h_l\|_2^2 \approx \sigma_l^2 n_{l-1} \|h_{l-1}\|_2^2$$
由归纳假设 $\|h_{l-1}\|_2^2 = \Theta(n_{l-1})$，欲使 $\|h_l\|_2^2 = \Theta(n_l)$：
$$\sigma_l^2 n_{l-1} \cdot n_{l-1} \propto n_l \implies \sigma_l = \Theta\left(\frac{1}{\sqrt{n_{l-1}}}\right)$$

### 4.3 公理 A2 的推导（层级学习率配比）

对于单步 SGD 权重更新 $\Delta W_l = -\eta_l \nabla_{W_l} \mathcal{L} = -\eta_l (\nabla_{h_l} \mathcal{L}) h_{l-1}^T$：
$$\Delta h_l = W_l \Delta h_{l-1} + \Delta W_l (h_{l-1} + \Delta h_{l-1})$$
其中主导变化项为 $\Delta W_l h_{l-1} = -\eta_l (\nabla_{h_l} \mathcal{L}) \|h_{l-1}\|_2^2 = -\eta_l (\nabla_{h_l} \mathcal{L}) \cdot \Theta(n_{l-1})$。

欲使 $\|\Delta W_l h_{l-1}\|_2 = \Theta(\sqrt{n_l})$，且已知反向传播梯度 $\|\nabla_{h_l} \mathcal{L}\|_2 = \Theta(\sqrt{n_l})$：
$$\eta_l \cdot \Theta(\sqrt{n_l}) \cdot \Theta(n_{l-1}) = \Theta(\sqrt{n_l}) \implies \eta_l = \Theta\left(\frac{1}{n_{l-1}}\right)$$

### 4.4 $\mu\text{P}$ 与标准参数化 (SP) 的核心对照表

| 模型层类型 | 标准参数化 (SP) 初始化标准差 | $\mu\text{P}$ 初始化标准差 | 标准参数化 (SP) 学习率 | $\mu\text{P}$ (Adam) 学习率 |
| :--- | :--- | :--- | :--- | :--- |
| **Embedding 层** | $\mathcal{O}(1)$ | $\mathcal{O}(1)$ | $\eta$ | $\eta$ |
| **隐层权重矩阵 (Hidden Weights)** | $\mathcal{O}(1/\sqrt{n})$ | $\mathcal{O}(1/\sqrt{n})$ | $\eta$ (常数) | **$\eta \cdot \frac{1}{n}$** |
| **输出分类头 (Output / LM Head)** | $\mathcal{O}(1/\sqrt{n})$ | **$\mathcal{O}(1/n)$** | $\eta$ | **$\eta \cdot \frac{1}{n}$** |

### 4.5 $\mu\text{P}$ 的边界与失效场景
- **RMSNorm 可学习缩放参数（Gains）**：RMSNorm 内部的 $\gamma$ 权重若自由更新会破坏激活模长恒定假设（可通过去除可学习 $\gamma$ 或固定为 1 解决）。
- **过强的权重衰减 (Weight Decay > 0.1)**：高强度 $L_2$ 正则化会强行衰减大矩阵范数，削弱 $\mu\text{P}$ 外推精度。
