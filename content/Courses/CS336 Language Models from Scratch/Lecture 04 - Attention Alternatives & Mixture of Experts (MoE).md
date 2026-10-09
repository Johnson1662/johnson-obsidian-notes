# Lecture 04 - Attention Alternatives & Mixture of Experts (MoE)

> **课程主题**：长上下文注意力替代方案（线性注意力/SSM/GDN）与混合专家架构（MoE）
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：掌握突破自注意力二次复杂度瓶颈的前沿架构（Mamba-2、Gated DeltaNet、混合架构）以及现代超大规模稀疏模型 MoE（Mixtral、DeepSeek-V2/V3、Qwen-MoE）的核心路由、负载均衡、MLA 与工程实现。

---

## 1. 长上下文下的注意力计算困境

在标准自注意力中：
$$\text{Attn}(Q, K, V) = \text{Softmax}\left(\frac{Q K^T}{\sqrt{d_k}}\right) V$$
- **计算与显存瓶颈**：$Q K^T$ 矩阵乘法导致计算量与显存占用均随序列长度 $n$ 呈二次方增长 $\mathcal{O}(n^2 d_k)$。
- **KV Cache 瓶颈**：自回归生成时，KV Cache 占用随上下文长度线性激增，成为内存带宽的致命杀手。

---

## 2. 线性注意力与循环-并行对偶性 (Recurrent-Parallel Duality)

### 2.1 乘法结合律的妙用

若去掉 Softmax 非线性激活（或采用核函数映射 $\phi(\cdot)$）：
$$\text{Attn}_{\text{linear}}(Q, K, V) = Q (K^T V)$$
- 原始顺序 $(Q K^T) V$：复杂度为 $\mathcal{O}(n^2 d_k + n^2 d_v)$。
- 改变结合顺序 $Q (K^T V)$：先计算 $K^T V \in \mathbb{R}^{d_k \times d_v}$，再与 $Q$ 相乘，**计算复杂度骤降至 $\mathcal{O}(2 n d_k d_v)$，实现对序列长度 $n$ 的严格线性扩展**。

### 2.2 循环形式与对偶特性 (Duality)

线性注意力在自回归生成时可等价重写为递归 RNN 形式：
$$S_t = S_{t-1} + k_t v_t^T, \quad y_t = q_t^T S_t$$
- **训练阶段（并行形式）**：利用矩阵乘结合律，在 GPU 上跨时间步全并行高效训练（Compute-Bound）。
- **推理阶段（循环形式）**：状态 $S_t \in \mathbb{R}^{d_k \times d_v}$ 维度固定，无需保存历史 KV Cache，推理显存开销降为常数 $\mathcal{O}(1)$（极度节省带宽）。

---

## 3. 从线性注意力到 Mamba-2 与 Gated DeltaNet

单纯线性注意力在长程记忆与检索召回（如“大海捞针”任务）上表达能力不足。前沿工作通过**门控衰减（Gating）与选择性擦除（Selective Erasing）**大幅增强了状态空间模型（SSM）的表达力：

| 架构模型 | 隐状态递推方程 (Recurrent Update) | 输出方程 | 核心机制与突破 |
| :--- | :--- | :--- | :--- |
| **Linear Attention** | $S_t = S_{t-1} + k_t v_t^T$ | $y_t = q_t^T S_t$ | 基础无损累加，缺乏遗忘机制 |
| **RetNet / Mamba-2** | $S_t = \gamma_t S_{t-1} + k_t v_t^T, \; \gamma_t = f(x_t)$ | $y_t = q_t^T S_t + v_t^T D$ | 引入依输入动态衰减门控 $\gamma_t$，平衡历史与当前信息 |
| **Gated DeltaNet (GDN)** | $S_t = \gamma_t (I - \beta_t k_t k_t^T) S_{t-1} + \beta_t k_t v_t^T$ | $y_t = q_t^T S_t$ | 引入正交擦除项 $(I - \beta_t k_t k_t^T)$，可主动擦除指定 Key 方向的旧记忆 |

### 3.3 混合注意力架构 (Hybrid Architectures)
学术界与工业界发现，纯线性模型在部分高复杂度关联检索上仍略逊于全注意力，因而流行**混合架构（Hybrid）**：
- **MiniMax M1 / Text-01**：$7:1$ 混合（7 层线性注意力 + 1 层全注意力）。
- **Nemotron-3 / Qwen-3.5**：$3:1$ 混合（3 层 Mamba-2 / GDN + 1 层标准注意力），兼具近线性的吞吐与全注意力的精准召回。
- **DeepSeek 稀疏注意力 (DSA, v3.2 / GLM-5)**：通过极轻量级的索引网络（Indexer）在长序列中动态挑选 Top 局部块，可在密集预训练后平滑迁移。

---

## 4. 混合专家模型 (Mixture of Experts, MoE) 原理

### 4.1 核心设计思想

大模型的参数容量（World Knowledge）与计算开销（FLOPs）在 Dense 模型中强行绑定。MoE 将 FFN 前馈层替换为多个专家网络（Experts）和一个路由门控网络（Router）：
$$y = \sum_{i \in \text{TopK}} g_i(x) \text{FFN}_i(x)$$
- **优势**：在**激活算力（Active FLOPs）完全不变**的前提下，模型总参数量扩展数倍至数十倍，显著提升模型容量与下游性能，并实现更快的预训练收敛。

### 4.2 主流 MoE 路由机制对比

```
Token-Choice Top-K Routing:
Input Token x ──> Router (Linear + Softmax) ──> Top-K Gates [g_1, g_2] ──> FFN_1(x) & FFN_2(x) ──(Weighted Sum)──> Output
```

| 模型名称 | 总专家数 (Total) | 激活专家数 (Active) | 共享专家数 (Shared) | 细粒度切分比例 | 路由策略 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Switch Transformer** | 64 | 1 | 0 | 1 | Top-1 Hard Routing |
| **GShard / Grok / Mixtral**| 8 | 2 | 0 | 1 | Top-2 Gating |
| **DBRX** | 16 | 4 | 0 | 1/2 | Top-4 Gating |
| **Qwen-1.5 / 2.5 MoE** | 60 | 4 | 4 (Always-on) | 1/8 | 细粒度专家 + 共享专家 |
| **DeepSeek-V3** | **256** | **8** | **1 (Always-on)** | **1/14** | **超细粒度 + 无辅助损失均衡** |
| **LLaMA-4 (Maverick)** | 128 | 1 | 1 | 1/2 | 极速单专家路由 |

---

## 5. MoE 训练挑战与解决方案

### 5.1 专家负载均衡 (Load Balancing)
若门控网络倾向于总是选择少数几个“明星专家”，会导致：
1. 其他专家退化未充分训练（Expert Starvation）。
2. 在分布式并行中，某些 GPU 计算过载引发严重掉队（Straggler Problem）。

- **经典辅助损失 (Auxiliary Load Balancing Loss)**：
  $$\mathcal{L}_{\text{aux}} = \alpha N \sum_{i=1}^N f_i \cdot P_i$$
  其中 $f_i$ 为分配给专家 $i$ 的 Token 比例，$P_i$ 为路由网络赋予专家 $i$ 的平均概率。若某专家被过度分配，损失升高迫使其概率下降。
- **DeepSeek-V3 无辅助损失均衡 (Aux-loss-free Balancing)**：
  在路由器 Logits 上为每个专家引入动态可学习偏置 $b_i$：
  $$s_i = \text{Gate}(x)_i + b_i$$
  根据每个批次各专家的负载实时用在线梯度调整 $b_i$，不将辅助损失混入反向传播主梯度，彻底消除了辅助损失对语言建模主目标的干扰。

### 5.2 路由数值稳定性与 MoE Upcycling
- **Router 稳定性**：路由器计算建议采用 **FP32 精度**，并引入 Router $z$-loss 防止 Softmax 极大值数值溢出。
- **MoE 升级初始化 (Upcycling)**：直接复制成熟的 Dense 模型 MLP 权重初始化多个专家（如 MiniCPM-MoE、Qwen-MoE），仅需少量预训练数据（如 500B Tokens）即可快速退火成强大的 MoE 模型。

---

## 6. DeepSeek-V3 核心架构三位一体

```
                       DeepSeek-V3 Block
                      ┌─────────────────┐
                      │    RMSNorm      │
                      └────────┬────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
     Multi-Head Latent Attention        DeepSeek-MoE
         (MLA: Low-rank KV)       (1 Shared + 8/256 Routed)
               │                               │
               └───────────────┬───────────────┘
                               ▼
                       Residual Add
```

### 6.1 多头潜在注意力 (Multi-Head Latent Attention, MLA)
- 将 $K$ 和 $V$ 联合低秩投影压缩为一个极低维潜在向量 $c_t^{KV} \in \mathbb{R}^{d_c}$（如 512 维）。
- **KV Cache 仅需保存 $c_t^{KV}$**，解压矩阵 $W_U^K$ 可在推理时融合到 Query 投影中。
- **解耦 RoPE 机制**：将位置编码从潜在向量中剥离，单列几维独立进行 RoPE 旋转，完美化解 RoPE 与低秩解压的代数冲突。

### 6.2 多 Token 预测目标 (Multi-Token Prediction, MTP)
- 在主模型之上叠加轻量级辅助预测头，单步前向同时预测未来第 $t+1, t+2$ 个 Token。
- 在训练时提供更强的监督信号，在推理时可直接用作原生投机采样的草稿头（Draft Head）。
