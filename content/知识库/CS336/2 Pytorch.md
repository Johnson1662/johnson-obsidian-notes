# CS336 Lecture 2: PyTorch 语义、算力模型与显存核算 (Resource Accounting)

在大模型研发中，**资源核算（Resource Accounting）** 是系统设计与超参规划的第一前提。本讲建立大模型训练与推理的显存占用、FLOPs 算力开销、算术强度（Arithmetic Intensity）及 Roofline 性能分析模型。

---

## 1. 显存占用计算

### 1.1 数据类型与字节开销
深度学习中各数值精度的位宽与字节占用：

| 格式                  | 总位数 (Bits) | 符号位 (Sign) | 指数位 (Exponent) | 尾数位 (Mantissa) | 字节 (Bytes) | 动态范围与精度特点                                              |
| ------------------- | ---------- | ---------- | -------------- | -------------- | ---------- | ------------------------------------------------------ |
| **FP32**            | 32         | 1          | 8              | 23             | 4          | 标准单精度，数值稳定，用于优化器主权重与梯度累计                               |
| **FP16**            | 16         | 1          | 5              | 10             | 2          | 尾数精度高但动态范围极小 ($10^{-5} \sim 65504$)，易溢出，需 Loss Scaling |
| **BF16**            | 16         | 1          | 8              | 7              | 2          | 与 FP32 相同的指数范围，天然抗溢出，LLM 预训练主流格式                       |
| **FP8 (E4M3/E5M2)** | 8          | 1          | 4/5            | 3/2            | 1          | Hopper/Blackwell 架构 Tensor Core 原生支持，显存与吞吐翻倍           |

### 1.2 静态显存占用：以混合精度 AdamW 为例
设模型参数量为 $N$（以 1B 参数，即 $N = 10^9$ 为例）：

| 显存组成部分                         | 精度格式        | 字节/参数             | 1B 参数显存占用      | 备注                          |
| ------------------------------ | ----------- | ----------------- | -------------- | --------------------------- |
| **Model Parameters（参数）**       | BF16 / FP16 | 2 bytes           | 2 GB           | 前向计算与反向传播使用                 |
| **Gradients（梯度）**              | BF16 / FP16 | 2 bytes           | 2 GB           | 反向传播计算得到的参数梯度               |
| **FP32 Master Weights**        | FP32        | 4 bytes           | 4 GB           | 优化器维护的高精度主权重，防止小梯度下溢        |
| **AdamW 1st Momentum ($m_t$)** | FP32        | 4 bytes           | 4 GB           | 一阶动量（梯度的指数移动平均）             |
| **AdamW 2nd Momentum ($v_t$)** | FP32        | 4 bytes           | 4 GB           | 二阶动量（梯度平方的指数移动平均）           |
| **合计（模型静态状态）**                 | -           | **16 bytes / 参数** | **16 GB / 1B** | 若参数梯度保留 FP32 则为 18~20 bytes |

> **极简经验法则**：混合精度 AdamW 训练下，**每 10 亿参数（1B）需要至少 16 GB 显存**仅用于存放静态模型状态（尚未包含激活值与临时 Buffer）。

---

## 2. 算力模型：FLOPs 计算与训练时间预估

### 2.1 基础算子 FLOPs 统计
- **矩阵乘法 (GEMM)**：$A \in \mathbb{R}^{M \times K}, B \in \mathbb{R}^{K \times N}$，计算 $C = A \cdot B$
  - 每个输出元素需要 $K$ 次乘法与 $K$ 次加法 $\implies 2K$ FLOPs
  - 矩阵乘法总 FLOPs = $2 M K N$
- **逐元素运算 (Elementwise)**：ReLU、GELU、Add、RMSNorm
  - 每处理 1 个元素产生 $1 \sim 5$ FLOPs，计算量相比 GEMM 几乎可忽略。

### 2.2 大模型训练 6ND 经典推导
设模型参数量为 $N$，预训练总 Token 数为 $D$：
1. **前向传播 (Forward)**：网络中主要的矩阵乘法操作贡献了几乎所有计算量，每 Token 前向计算量为 $2N$ FLOPs。
   $$
   C_{\text{forward}} \approx 2 N D \quad \text{FLOPs}
   $$
2. **反向传播 (Backward)**：反向传播需要计算（1）对输入的梯度 $\frac{\partial L}{\partial X}$（用于向后传递）和（2）对权重的梯度 $\frac{\partial L}{\partial W}$（用于参数更新），每个计算量等同于一次前向 GEMM，因此反向计算量约为前向的 2 倍：
   $$
   C_{\text{backward}} \approx 4 N D \quad \text{FLOPs}
   $$
3. **单步训练总 FLOPs**：
   $$
   C_{\text{train}} = C_{\text{forward}} + C_{\text{backward}} \approx 6 N D \quad \text{FLOPs}
   $$
   *(若开启 Activation Checkpointing 全重算，前向需额外执行一次，总计约 $8ND$ FLOPs)*

### 2.3 训练耗时预测与 MFU
设硬件集群包含 $K$ 张 GPU，单卡峰值算力为 $P$（FLOP/s），**Model FLOPs Utilization (MFU)** 为实际模型计算利用率（通常在 $35\% \sim 55\%$ 之间）：
$$
\text{Training Time (seconds)} = \frac{6 N D}{K \times P \times \text{MFU}}
$$

**实例计算**：使用 1024 张 H100 SXM5（BF16 密集算力 $P = 989.5 \text{ TFLOP/s}$），以 $\text{MFU} = 50\%$ 训练 Llama 3 70B 模型 ($N = 70 \times 10^9$) 消耗 $D = 15 \times 10^{12}$ Tokens：
$$
\text{Total FLOPs} = 6 \times 70 \times 10^9 \times 15 \times 10^{12} = 6.3 \times 10^{24} \text{ FLOPs}
$$
$$
\text{Cluster Effective Throughput} = 1024 \times (989.5 \times 10^{12}) \times 0.5 \approx 5.066 \times 10^{17} \text{ FLOP/s}
$$
$$
\text{Time} = \frac{6.3 \times 10^{24}}{5.066 \times 10^{17}} \approx 12,435,846 \text{ 秒} \approx 143.9 \text{ 天}
$$

---

## 3. 算术强度与 Roofline 分析 (Compute-bound vs Memory-bound)

### 3.1 算术强度（Arithmetic Intensity）
衡量一段计算每从 HBM（显存）搬运 1 字节数据，能进行多少次浮点运算：
$$
I = \frac{\text{FLOPs}}{\text{Memory Access (Bytes)}} \quad (\text{FLOP/Byte})
$$

### 3.2 硬件性能拐点 (Machine Ridge Point)
以 NVIDIA H100 SXM5 为例：
- BF16 Tensor Core 算力 $P_{\text{peak}} \approx 989.5 \text{ TFLOP/s}$
- HBM3 显存带宽 $B_{\text{mem}} \approx 3.35 \text{ TB/s}$
- 硬件平衡拐点：
  $$
  I_{\text{ridge}} = \frac{P_{\text{peak}}}{B_{\text{mem}}} = \frac{989.5 \times 10^{12}}{3.35 \times 10^{12}} \approx 295.4 \text{ FLOP/Byte}
  $$

```
   Achieved
   Performance
   (TFLOP/s) ^
             |                   Compute-Bound (受限于 Tensor Core 算力)
   P_peak ---+------------------+-----------------------------
             |                 /
             |                /
             |               /   Memory-Bound (受限于 HBM 带宽)
             |              /
             |             /
             |            /
             +-----------+------------------------------------>
             0        I_ridge (295 FLOP/Byte)     Arithmetic Intensity (FLOP/Byte)
```

- **Compute-bound ($I > I_{\text{ridge}}$)**：如 Batch 较大时的 GEMM 矩阵乘法。算术强度高，瓶颈在 Tensor Core 计算单元，应优化矩阵分块（Tiling）与指令级并行。
- **Memory-bound ($I < I_{\text{ridge}}$)**：如 LayerNorm、GELU、Softmax、以及 Decode 阶段单步生成。算术强度极低（通常 $< 5$ FLOP/Byte），计算单元绝大部分时间在等待数据从 HBM 加载，必须采用**算子融合 (Operator Fusion)** 减少反复读写 HBM。

---

## 4. 显存优化关键技术：梯度累积与重计算

### 4.1 梯度累积 (Gradient Accumulation)
当显存不足以容纳目标 Batch Size 的激活值时，将一个大 Batch 拆分为 $K$ 个微批次（Micro-batch）：
- 前向与反向时 `loss = loss / K; loss.backward()`，梯度在参数的 `.grad` 原地累加。
- 仅在累积 $K$ 次后调用 `optimizer.step()` 与 `optimizer.zero_grad()`。
- **显存收益**：激活值显存占用由 $B$ 降低至 $B / K$。

### 4.2 激活重计算 (Activation Checkpointing / Gradient Checkpointing)
- **标准反向传播**：前向过程中必须在显存中缓存每一层的中间激活值 $A$，用于反向求导，激活显存随层数 $L$ 与序列长度 $T$ 线性增长。
- **重计算策略**：前向传播只保存 Transformer Block 输入处的边界张量，丢弃 Block 内部各层（Attention、MLP）的临时激活值；在反向传播执行到该 Block 时，重新执行一次局部前向传播计算出激活值。
- **代价与收益**：以额外 **$33\%$ 的前向重算 FLOPs** 为代价，将**激活值显存开销从 $O(L \cdot T)$ 骤降为 $O(\sqrt{L} \cdot T)$ 或 $O(T)$**。

---

## 5. Tensor 操纵规范：einops 实践

在编写大模型多头注意力（MHA/GQA）及转置逻辑时，原生 `view` / `transpose` 极易引入难以察觉的维度对应 bug。推荐全面使用 `einops`：

```python
import torch
from einops import rearrange, reduce, einsum

B, S, H, D = 4, 1024, 32, 64  # Batch, Seq_len, Num_heads, Head_dim

# 1. 拆分 Head：从 [B, S, H*D] 转换为 [B, H, S, D]
qkv = torch.randn(B, S, H * D)
q = rearrange(qkv, 'b s (h d) -> b h s d', h=H, d=D)

# 2. 合并 Head：注意力输出从 [B, H, S, D] 还原回 [B, S, H*D]
out = rearrange(q, 'b h s d -> b s (h d)')

# 3. 批量矩阵乘法 (BMM) 求解 Attention Score: Q * K^T
# Q: [B, H, S_q, D], K: [B, H, S_k, D] -> Scores: [B, H, S_q, S_k]
k = torch.randn(B, H, S, D)
scores = einsum(q, k, 'b h i d, b h j d -> b h i j') / (D ** 0.5)

# 4. 平均池化 (Mean Pooling)
seq_rep = reduce(out, 'b s d -> b d', 'mean')
```
