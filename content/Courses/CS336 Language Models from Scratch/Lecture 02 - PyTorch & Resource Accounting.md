# Lecture 02 - PyTorch & Resource Accounting

> **课程主题**：PyTorch 底层张量机制、爱因斯坦求和与算力/显存记账（Resource Accounting）
> **授课教师**：Percy Liang
> **核心目标**：掌握大模型训练与推理中的“餐巾纸算力估算”（Napkin Math）、显存占用精细拆解、算术强度（Arithmetic Intensity）与 Roofline 模型分析。

---

## 1. 资源核算动机与估算实战 (Napkin Math)

### 1.1 经典大模型训练时间估算

**核心问题**：在 1024 张 NVIDIA H100 上训练一个 70B 参数量、15T Tokens 的模型需要多久？

1. **总浮点运算量 (Total FLOPs)**：
   $$\text{Total FLOPs} = 6 \times N \times D = 6 \times (70 \times 10^9) \times (15 \times 10^{12}) = 6.3 \times 10^{24}\text{ FLOPs}$$
   *(其中前向传播为 $2ND$，反向传播为 $4ND$，总计 $6ND$)*
2. **集群峰值算力**：
   - 单张 H100（Dense BF16/FP16）额定峰值：$1979 \text{ TFLOP/s} / 2 \approx 989.5 \text{ TFLOP/s} \approx 10^{15} \text{ FLOP/s}$（1 PFLOP/s）。
   - 1024 张 H100 理论总算力：$1024 \times 10^{15} \text{ FLOP/s} \approx 1.024 \times 10^{18} \text{ FLOP/s}$。
3. **有效算力利用率 (Model FLOPs Utilization, MFU)**：
   - 假设工程实现达到优良水平，取 $\text{MFU} = 0.5$（50%）。
   - 实际总有效算力：$1.024 \times 10^{18} \times 0.5 \approx 5.12 \times 10^{17} \text{ FLOP/s}$。
4. **训练总时长**：
   $$\text{Training Time} = \frac{6.3 \times 10^{24}}{5.12 \times 10^{17}} \approx 1.23 \times 10^7 \text{ seconds} \approx 142.4 \text{ days} \approx 4.7 \text{ months}$$

---

## 2. 张量存储与浮点精度体系 (Precision Hierarchy)

| 精度格式           | 位数 (Bits) | 符号位 + 指数位 + 尾数位 | 动态范围 (Dynamic Range)                | 显存占用 (Bytes/elem) | 在深度学习中的典型应用                     |
| :------------- | :-------- | :-------------- | :---------------------------------- | :---------------- | :------------------------------ |
| **FP32**       | 32        | $1 + 8 + 23$    | $\sim 10^{-38} \sim 10^{38}$        | 4                 | 优化器状态（一阶/二阶动量累积）、Master 权重      |
| **FP16**       | 16        | $1 + 5 + 10$    | $\sim 10^{-5} \sim 6.5 \times 10^4$ | 2                 | 易下溢（Underflow），需 Loss Scaling   |
| **BF16**       | 16        | $1 + 8 + 7$     | $\sim 10^{-38} \sim 10^{38}$        | 2                 | **主流预训练标准**（与 FP32 动态范围相同，不易下溢） |
| **FP8 (E4M3)** | 8         | $1 + 4 + 3$     | $[-448, 448]$                       | 1                 | 前向传播激活值与权重矩阵乘（高精度尾数）            |
| **FP8 (E5M2)** | 8         | $1 + 5 + 2$     | $[-57344, 57344]$                   | 1                 | 反向传播梯度计算（大动态范围）                 |
| **NVFP4**      | 4         | 4-bit 块缩放量化     | 离散微尺度映射                             | 0.5               | 前沿超低比特训练与推理（如 Nemotron-3 Super） |

### 混合精度训练 (Mixed Precision Training)
- **参数、激活与梯度**：采用 BF16 / FP16 存储与计算（加速 GEMM 矩阵乘，节省显存带宽）。
- **优化器内部更新**：采用 FP32 维护累积状态与主权重，防止小梯度下溢被截断。

---

## 3. 基于 Einops 的张量操作规范

传统 PyTorch 维度变换（如 `view`, `transpose(-2, -1)`）缺乏语义，极易引入维度错位 Bug。Einops 提供了具名且自解释的操作范式：

```python
import torch
from einops import einsum, rearrange, reduce

# 1. 批量注意力分数矩阵乘 (Attention Scores: Q @ K.T)
q = torch.ones(2, 8, 128, 64)  # [batch, heads, seq1, dim]
k = torch.ones(2, 8, 256, 64)  # [batch, heads, seq2, dim]
# 自动在 dim 维度求和，显式保留 batch, heads, seq1, seq2
attn_scores = einsum(q, k, "b h s1 d, b h s2 d -> b h s1 s2")

# 2. 张量聚合 (Reduce)
hidden = torch.ones(2, 128, 1024)
# 在 hidden 维度求和/平均
pooled = reduce(hidden, "b s h -> b s", "mean")

# 3. 多头拆分与合并 (Rearrange)
x = torch.ones(32, 128, 1024)  # [batch, seq, (heads * head_dim)]
# 拆分为多头
x_heads = rearrange(x, "b s (h d) -> b h s d", h=16)
# 合并多头回原始维度
x_merged = rearrange(x_heads, "b h s d -> b s (h d)")
```

---

## 4. 算术强度与 Roofline 性能模型

### 4.1 核心定义

- **算术强度 (Arithmetic Intensity)**：算法每从内存搬运 1 字节数据所执行的浮点运算次数：
  $$\text{Arithmetic Intensity} = \frac{\text{Total FLOPs}}{\text{Total Memory Access (Bytes)}}$$
- **硬件加速器强度 (Accelerator Intensity)**：
  $$\text{Accelerator Intensity} = \frac{\text{Peak FLOP/s}}{\text{Memory Bandwidth (Bytes/s)}}$$

以 NVIDIA H100（BF16 峰值 $989.5 \text{ TFLOP/s}$，HBM 带宽 $3.35 \text{ TB/s}$）为例：
$$\text{H100 Intensity} \approx \frac{989.5 \times 10^{12}}{3.35 \times 10^{12}} \approx 295.4 \text{ FLOPs/Byte}$$

### 4.2 典型操作的算术强度分析

| 操作类型 | 具体运算 | FLOPs 计算 | 显存读写 (Bytes, BF16) | 算术强度 (FLOPs/Byte) | 硬件瓶颈属性 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Elementwise** | $\text{ReLU}(x)$ | $N$ | $2N (\text{read}) + 2N (\text{write}) = 4N$ | $\approx 0.25$ | **极度 Memory-Bound** |
| **Elementwise** | $\text{GELU}(x)$ | $\sim 20N$ | $4N$ | $\approx 5.0$ | **Memory-Bound** |
| **Dot Product** | $x \cdot w$ ($N$维) | $2N - 1$ | $2N + 2N + 2 \approx 4N$ | $\approx 0.5$ | **Memory-Bound** |
| **GEMV (矩阵-向量)** | $y = x W$ ($N \times N$) | $2N^2$ | $2N + 2N^2 + 2N \approx 2N^2$ | $\approx 1.0$ | **Memory-Bound (自回归推理解码瓶颈)** |
| **GEMM (矩阵-矩阵)** | $Y = X W$ ($N \times N$) | $2N^3$ | $2N^2 + 2N^2 + 2N^2 = 6N^2$ | $\approx \frac{N}{3}$ | **Compute-Bound ($N > 900$ 时打满算力)** |

> **关键结论**：
> 1. $\text{ReLU}$ 虽然比 $\text{GELU}$ 少算 19 次运算，但在 GPU 上耗时几乎完全相同，因为两者的瓶颈都在 HBM 内存读写带宽上。
> 2. 大模型**预训练阶段（GEMM 批量矩阵乘）是 Compute-Bound**；大模型**自回归生成解码阶段（逐 Token 生成 GEMV）是 Memory-Bound**。

### 4.3 Roofline 模型与 MFU

$$\text{Attainable Performance (FLOP/s)} = \min\left(\text{Peak FLOP/s},\; \text{Memory Bandwidth} \times \text{Arithmetic Intensity}\right)$$
$$\text{MFU} = \min\left(1,\; \frac{\text{Arithmetic Intensity}}{\text{Accelerator Intensity}}\right)$$

```
Performance (FLOP/s)
    ^
Peak|--------------------/ (Compute-Bound Zone)
    |                   /
    |                  /  (Memory-Bound Zone: Slope = Memory Bandwidth)
    |                 /
    |                /
    +---------------+-------------------> Arithmetic Intensity (FLOPs/Byte)
                Kink (Accelerator Intensity ≈ 295 FLOPs/Byte on H100)
```

---

## 5. 训练阶段的算力与显存全面核算

### 5.1 运算量拆解 (Forward vs Backward)

对于全连接层 $Y = X W$（输入 $X \in \mathbb{R}^{B \times D_\text{in}}$，权重 $W \in \mathbb{R}^{D_\text{in} \times D_\text{out}}$）：
1. **前向传播**：$Y = X W \implies 2 B D_\text{in} D_\text{out} \text{ FLOPs}$。
2. **反向传播**（需计算两个梯度）：
   - $\nabla_X \mathcal{L} = (\nabla_Y \mathcal{L}) W^T \implies 2 B D_\text{out} D_\text{in} \text{ FLOPs}$
   - $\nabla_W \mathcal{L} = X^T (\nabla_Y \mathcal{L}) \implies 2 D_\text{in} B D_\text{out} \text{ FLOPs}$
   - 反向传播总计 $= 4 B D_\text{in} D_\text{out} \text{ FLOPs}$。
3. **结论**：**反向传播计算量恰好是前向传播的 2 倍**；单步训练总 FLOPs 为 $6 \times \text{Batch} \times \text{Params}$。

### 5.2 训练显存占用全景分解 (Memory Breakdown)

训练一个参数量为 $N$、层数为 $L$、隐藏层维度为 $D$、批大小为 $B$、序列长度为 $S$ 的模型：

| 显存构成项 | 存储精度 | 每参数/元素字节数 | 显存占用计算公式 | 70B 模型典型值 (Bytes) |
| :--- | :--- | :--- | :--- | :--- |
| **模型参数 (Weights)** | BF16 | 2 Bytes | $2N$ | 140 GB |
| **梯度 (Gradients)** | BF16 | 2 Bytes | $2N$ | 140 GB |
| **优化器状态 (AdamW)** | FP32 | 12 Bytes | $4N (\text{fp32 weight}) + 4N (\text{1st moment}) + 4N (\text{2nd moment}) = 12N$ | 840 GB |
| **激活值 (Activations)** | BF16 | 2 Bytes | $\mathcal{O}(B \cdot S \cdot D \cdot L)$ | 随 Batch Size 与 Context 显著缩放 |

> **静态显存汇总**：仅存储参数、梯度与 AdamW 优化器状态，每个参数需要 **$2 + 2 + 12 = 16 \text{ Bytes}$**。对于 70B 模型，静态显存开销即高达 **$1120 \text{ GB}$**（需至少 14 张 80GB GPU 分片存储）。

---

## 6. 显存优化关键技术

### 6.1 梯度累积 (Gradient Accumulation)
- **原理**：将大 Batch 拆分为 $K$ 个微批次（Micro-batches），前向+反向累加梯度而不清零，每 $K$ 步执行一次 `optimizer.step()`。
- **收益**：激活值显存峰值降低为原来的 $1/K$，使在有限显存下模拟超大有效 Batch Size 成为可能。

### 6.2 激活重计算 / 检查点 (Activation Checkpointing)
- **原理**：在前向传播时不保存每一层的完整中间激活值，仅在部分检查点（Checkpoints）保存少量激活；在反向传播计算到对应层时，从最近的检查点重新执行局部前向计算。
- **复杂度折中**：
  - **全量保存**：激活显存 $\mathcal{O}(L)$，额外计算量 $0$。
  - **完全不保存**：激活显存 $\mathcal{O}(1)$，额外计算量 $\mathcal{O}(L^2)$。
  - **每隔 $\sqrt{L}$ 层保存一次**：激活显存降至 $\mathcal{O}(\sqrt{L})$，额外计算量仅增加 $1 \times \text{Forward} \approx 33\%$ 总训练时间。
