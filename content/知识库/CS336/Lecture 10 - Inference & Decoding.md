# Lecture 10 - Inference & Decoding

> **课程主题**：大语言模型推理加速、解码算法与高性能服务系统架构
> **授课教师**：Percy Liang
> **核心目标**：从底层计算与访存特征出发，推导 Prefill 与 Decode 阶段的算术强度差异，掌握 KV Cache 压缩机制（GQA/MLA/CLA）、量化算法（GPTQ/AWQ）、投机采样（Speculative Decoding）的无偏采样数学证明，以及连续批处理（Continuous Batching）与 PagedAttention 显存分页管理架构。

---

## 1. 推理场景与核心评测指标 (Metrics)

与训练阶段可跨 Token 序列完全并行矩阵乘不同，自回归推理解码必须逐个 Token 串行生成。

| 评测指标 | 定义与计算 | 优化目标与主导阶段 |
| :--- | :--- | :--- |
| **首字时延 (Time-to-First-Token, TTFT)** | 用户发起请求到收到第一个生成 Token 的时间 | 关注交互响应速度；由 **Prefill（提示词预填充）** 阶段耗时决定 |
| **单请求逐字延迟 (Inter-Token Latency)** | 单个请求生成连续两个 Token 之间的时间间隔（秒/Token） | 关注生成流畅度（人类阅读速度 $\approx 50 \text{ ms/token}$）；由单步 **Decode** 决定 |
| **系统聚合吞吐 (System Throughput)** | 单位时间内系统成功生成的总 Token 数（Tokens/Second） | 关注服务端商业成本；通过 **Batching（增大并发批大小）** 提升 |

---

## 2. Prefill 与 Decode 的算术强度严格推导

设全局模型隐层维度为 $D$，MLP 升维为 $F = 4D$，上下文长度为 $S$，单步生成 Token 数为 $T$。

```
Prefill 阶段 (T = S):
输入全部 Prompt Tokens ──> 全序列并行矩阵乘 (GEMM) ──> 算术强度高 (Compute-Bound, S/2) ──> 算力打满

Decode 阶段 (T = 1):
每步仅输入 1 个新 Token ──> 矩阵-向量乘 (GEMV) + 读取全局权重与全量 KV Cache ──> 算术强度极低 (< 1) ──> 严重 Memory-Bound
```

### 2.1 算术强度定量推导

- **MLP 线性层**：
  - 计算量：$\text{FLOPs} = 6 B T D F$。
  - 显存访存：$\text{Bytes} \approx 6 D F + 4 B T D + 4 B T F$。
  - 算术强度：$\text{Intensity} \approx B \cdot T$。
    - **Prefill ($T = S$)**：算术强度为 $B \cdot S \gg 295$（轻松达到 **Compute-Bound**）。
    - **Decode ($T = 1$)**：算术强度退化为并发批大小 $B$（单并发 $B=1$ 时算术强度仅为 $1$，极度 **Memory-Bound**）。
- **Attention 注意力层 (FlashAttention 融合状态下)**：
  - 计算量：$4 B S T D$。
  - 显存访存：$4 B S D + 4 B T D$。
  - 算术强度：$\text{Intensity} = \frac{S \cdot T}{S + T}$。
    - **Prefill ($T = S$)**：$\text{Intensity} = \frac{S}{2} \gg 295$（长文本下为 Compute-Bound）。
    - **Decode ($T = 1$)**：$\text{Intensity} = \frac{S}{S+1} < 1.0$（**严格受限于内存带宽，且增大 Batch 无法提升注意力层的算术强度**）。

---

## 3. KV Cache 内存模型与架构压缩

### 3.1 KV Cache 显存占用计算

为避免每步重复计算前文所有 Token 的 Key 和 Value，自回归生成必须在 HBM 中缓存历史 KV 向量：
$$\text{KV Cache Size per Request} = 2 \times S \times L \times K \times H \times (\text{Bytes per element})$$
- 其中 $S$ 为序列长度，$L$ 为层数，$K$ 为 KV 头数，$H$ 为头维度（因子 2 代表 Key 与 Value）。
- 对于 LLaMA-2 70B（$L=80, K=8, H=128, \text{BF16}$），单条 4K 上下文需占用 **$1.31 \text{ GB}$**；在 256 批并发下，KV Cache 膨胀至 **$335 \text{ GB}$**，远超单卡显存上限。

### 3.2 现代 KV Cache 压缩技术对比

```
MHA (Llama 1)            GQA (Llama 3, Mistral)            MLA (DeepSeek V2/V3)
K, V: 64 heads           K, V: 8 groups (8x 压缩)         K, V: Low-Rank Latent (512-dim, 32x 压缩)
```

1. **GQA (Grouped-Query Attention)**：将 $N$ 个 Query 头分组共享 $K$ 个 KV 头，KV Cache 显存缩减至 $K/N$（如 8 倍压缩），精度几乎无损。
2. **MLA (Multi-head Latent Attention, DeepSeek)**：
   - 将 Key/Value 联合投影压缩至 512 维低秩隐向量 $c_t^{KV}$，推理时仅缓存 $c_t^{KV}$ 与解耦的 64 维 RoPE Key。
   - 实现 **93% 以上的 KV Cache 极速压缩**，大幅提升单卡并发承载量。
3. **跨层注意力共享 (Cross-Layer Attention, CLA)**：在网络相邻层间复用 KV Cache。

---

## 4. 模型量化技术 (Quantization)

通过将 FP16/BF16（2 字节）参数与激活压缩至 INT8/INT4/FP8，减少内存搬运量以成倍提升 Decode 吞吐：

- **量化感知训练 (QAT)**：训练时在前向插入伪量化算子模拟误差，成本极高。
- **训练后量化 (Post-Training Quantization, PTQ)**：
  - **GPTQ (Frantar 2022)**：利用二阶 Hessian 矩阵逐列最小化量化重构误差，支持单卡几小时内完成 70B 模型 4-bit 量化。
  - **AWQ (Activation-aware Weight Quantization, Lin 2023)**：
    - 发现仅有 $0.1\% \sim 1\%$ 的显著权重通道（Salient Channels）承载了绝大部分激活极值。
    - 根据激活分布对关键通道权重实施保护缩放，实现 **INT4 下几乎零精度损失与 3.2 倍吞吐加速**。

---

## 5. 投机采样 (Speculative Decoding) 原理与数学证明

### 5.1 核心思想：验证远快于生成

利用轻量级小模型（Draft Model $p(x)$）快速自回归生成 $K$ 个候选 Token，再利用大模型（Target Model $q(x)$）单次前向（GEMM 并行计算）对 $K$ 个 Token 进行并行打分与接受验证。

```
Step 1: Draft Model (小模型) 快速生成 K 个候选: [y_1, y_2, y_3, y_4]
Step 2: Target Model (大模型) 单步并行打分: 计算 q(y_1), q(y_2), q(y_3), q(y_4)
Step 3: 概率拒绝采样验证: 接受前 M 个 Token (M ≤ K)，若被拒则无偏重采样一个新 Token
```

### 5.2 精确无偏采样定理 (Exact Sampling Proof)

设词表中候选 Token 为 $x$，草稿分布为 $p(x)$，目标分布为 $q(x)$：
1. **接受概率**：
   $$\alpha(x) = \min\left(1, \; \frac{q(x)}{p(x)}\right)$$
2. **拒绝后残差重采样分布**：若在位置 $n$ 被拒绝，从残差分布 $q'(x)$ 中采样：
   $$q'(x) = \frac{\max(0, \; q(x) - p(x))}{\sum_z \max(0, \; q(z) - p(z))}$$
3. **边缘采样概率等价性证明**：
   $$P(\text{Sample } x) = p(x) \alpha(x) + \left(1 - \sum_z p(z)\alpha(z)\right) q'(x) \equiv q(x)$$
- **结论**：投机解码在**数学上严格保证输出分布与纯大模型自回归采样 100% 完全一致**，可带来 $2\sim 3\times$ 的无损加速。

---

## 6. 高性能推理系统架构：Continuous Batching 与 PagedAttention

### 6.1 连续批处理 (Continuous Batching / Iteration-Level Scheduling, Orca)
- **静态批处理缺陷**：由于各请求输入/输出长度极不规则，短序列必须填充（Padding）等待最长序列生成完毕，导致 GPU 大面积空转。
- **Iteration-Level 调度**：在每个 Token 解码步骤（Iteration）级别动态调度，已结束的请求立即退出释放显存，新到达的请求在下一个 Step 动态插入批次。

### 6.2 PagedAttention 显存分页管理 (vLLM)

传统系统预先为每个请求分配最大长度的连续物理显存，产生高达 $60\% \sim 80\%$ 的**内部与外部显存碎片**。

```
Logical KV Blocks (虚拟连续):    [ Block 0 ][ Block 1 ][ Block 2 ]
                                    │         │         │
Block Table 映射表:                 ▼         ▼         ▼
Physical KV Memory (物理离散):   [ Page 7 ] [ Page 2 ] [ Page 19 ] in GPU HBM
```

- **虚拟内存分页机制**：将 KV Cache 切分为固定大小的物理块（Block Size 如 16 个 Token），按需分配非连续的物理显存块。
- **前缀共享与写时复制 (Copy-on-Write, CoW)**：对于 System Prompt、Few-Shot 示例或束搜索（Beam Search），不同请求共享相同物理块指针，仅在发生写入分歧时复制，显存利用率逼近 $100\%$。
