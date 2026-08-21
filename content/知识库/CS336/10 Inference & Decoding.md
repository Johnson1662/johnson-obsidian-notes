# CS336 Lecture 10: 大模型推理全流程、解码策略与投机采样

训练是一次性开销，**推理是决定大模型商业落地与实际吞吐的核心生命线**。由于自回归生成天然具有“逐 Token 依赖”特性，推理与训练在硬件特征、显存占用与计算模式上存在本质差异。

---

## 1. 推理两阶段特性分析 (Prefill vs Decode)

自回归大模型的推理分为两个截然不同的计算阶段：

```
输入 Prompt: "The capital of France is"
[ Prefill 阶段 (首字生成) ] ---> 并行计算全部 Prompt Tokens (Compute-Bound, GEMM)
                                 缓存各层 Key/Value 到 KV Cache
                                      |
                                      v
                                输出: "Paris"
                                      |
[ Decode 阶段 (逐字生成) ]  ---> 每次输入 1 个 Token (Memory-Bound, GEMV)
                                读取历史全部 KV Cache 生成下一个 Token
                                      v
                                输出: "." ➔ 结束
```

| 特性维度 | **首字预填充 (Prefill / Context Phase)** | **逐字解码 (Decode / Generation Phase)** |
|---|---|---|
| **输入规模** | 一次性处理完整 Prompt ($S_{\text{prompt}}$ 个 Tokens) | 每次仅输入最新生成的 **1 个 Token** ($S = 1$) |
| **计算类型** | 矩阵乘矩阵 (**GEMM**) | 矩阵乘向量 (**GEMV**) |
| **算术强度** | 高 ($I \gg I_{\text{ridge}}$)，**Compute-bound** | 极低 ($I \ll I_{\text{ridge}}$)，**Memory-bound** |
| **核心优化目标**| **TTFT (Time-To-First-Token)**：首字响应延迟 | **ITL (Inter-Token Latency)** / 吞吐量 (Tokens/s) |
| **瓶颈所在** | Tensor Core 密集算力 | **HBM 显存带宽与 KV Cache 搬运速度** |

---

## 2. KV Cache 显存占用精确公式

在自回归解码中，为了避免每步重复计算历史所有 Token 的 $K, V$ 向量，模型在显存中开辟缓冲区存储历史 Key/Value 张量。

### 2.1 显存容量计算公式
设批大小为 $B$，当前上下文总长度为 $S$，网络层数为 $L$，KV Head 数量为 $H_{\text{kv}}$，每个 Head 维度为 $d_k$，数值精度为 16-bit (2 Bytes)：

$$
\text{KV Cache Size (Bytes)} = 2 \times 2 \times B \times S \times L \times H_{\text{kv}} \times d_k
$$
- 前面的 $2 \times 2$：第一个 2 代表 Key 和 Value 两个张量；第二个 2 代表 16 位浮点数占用 2 字节。

### 2.2 实例计算对比 (上下文 $S = 8192$, $B = 16$)
以 **Llama 3 8B** ($L = 32, H_{\text{kv}} = 8, d_k = 128$) 为例：
$$
\text{KV Cache} = 4 \times 16 \times 8192 \times 32 \times 8 \times 128 = 17,179,869,184 \text{ Bytes} = \mathbf{16.0 \text{ GB}}
$$
> **启示**：模型权重仅占 $16\text{ GB}$ 显存，但在 Batch=16 时，**KV Cache 占用的显存直接追平了模型权重本身**！长文本并发推理必须采用 GQA 或 MLA 压缩 KV 维度。

---

## 3. 解码采样算法 (Decoding Strategies)

模型最后一层输出 Logits 向量 $z \in \mathbb{R}^V$。不同采样算法决定了生成的多样性与准确性：

### 3.1 温度采样 (Temperature Scaling)
$$
P(x_i) = \frac{\exp(z_i / T)}{\sum_{j=1}^V \exp(z_j / T)}
$$
- $T \to 0$：退化为 **Greedy Search（贪心解码）**，确定性最高，适合代码与数学；
- $T = 1$：标准 Softmax 概率分布；
- $T > 1$：平滑概率分布，激发长尾发散创造力。

### 3.2 截断过滤策略 (Top-$k$, Top-$p$, Min-$p$)
- **Top-$k$**：仅保留概率最高的前 $k$ 个 Token（截断长尾），将其余概率置 0 后重新归一化。
- **Top-$p$ (Nucleus Sampling / 核采样)**：
  选出累积概率达到阈值 $p$（如 $0.9$）的最小 Token 集合 $\mathcal{V}^{(p)}$：
  $$
  \sum_{i \in \mathcal{V}^{(p)}} P(x_i) \ge p
  $$
  动态根据分布平坦度自适应调整保留的 Token 数量。
- **Min-$p$**：过滤掉概率低于最高概率 $\max_j P(x_j) \times p_{\text{base}}$ 的所有候选项（比 Top-$p$ 更自然）。

---

## 4. 投机采样 (Speculative Decoding / Lossless Acceleration)

由于大模型 Decode 受限于 HBM 带宽，单步只生成 1 个 Token 极其浪费算力。**投机采样**利用“小草稿模型快速串行生成，大目标模型单步并行验证”实现**数学完全等价的无损加速**。

```
[ 小草稿模型 Draft (如 1B) ] ---> 快速自回归生成 K 个候选 Token [x1, x2, x3, x4]
                                            |
                                            v
[ 大目标模型 Target (如 70B)] ---> 单次前向并行验证全部 K 个 Token
                                            |
                                            +---> 接受 [x1, x2, x3]，拒绝 x4
                                            +---> 采样修正 Token x4' 并输出
                                      (单步实际生成 4 个有效 Tokens!)
```

### 4.1 严格无损接受概率公式 (Leviathan et al., 2023)
设小模型给出的提议概率为 $q(x)$，大模型给出的真实概率为 $p(x)$：
1. **接受概率**：
   $$
   \alpha = \min\left(1, \; \frac{p(x)}{q(x)}\right)
   $$
2. **拒绝修正采样**：若在位置 $i$ 被拒绝，放弃后续所有 Token，并从残差分布中重新采样一个修正 Token：
   $$
   P_{\text{corrected}}(x) = \frac{\max(0, \; p(x) - q(x))}{\sum_{x'} \max(0, \; p(x') - q(x'))}
   $$
- **数学定理保证**：最终生成的序列边缘分布**严格等于完全由大目标模型自回归采样的分布**，精度无损，速度提升 **$2\times \sim 3\times$**。

---

## 5. 推理服务系统核心架构 (vLLM / SGLang)

### 5.1 连续批处理 (Continuous Batching / Iteration-level Scheduling)
传统静态 Batching 必须等待批次中最长的句子生成结束才能释放。Continuous Batching 在每个 Iteration 结束后，**立即移出已结束的请求并插入新的请求**，GPU 吞吐提升数倍。

### 5.2 PagedAttention: 显存分页管理
传统推理框架为每个请求预分配连续的最大上下文显存，造成高达 **$60\% \sim 80\%$ 的内部与外部显存碎片**。
- **vLLM PagedAttention**：借鉴操作系统的虚拟内存分页机制，将 KV Cache 切分为固定大小的 **Block（如 16 个 Token）**，通过页表（Block Table）将逻辑连续的 Token 映射到物理上不连续的显存块中，**彻底消除显存碎片，并发容量提升 $2 \sim 4$ 倍**。
