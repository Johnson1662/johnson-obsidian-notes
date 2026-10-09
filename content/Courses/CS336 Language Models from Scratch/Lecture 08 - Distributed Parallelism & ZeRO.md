# Lecture 08 - Distributed Parallelism & ZeRO

> **课程主题**：大规模分布式并行进阶：ZeRO 显存切分技术、序列并行、专家并行与 3D/4D 混合并行架构
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：掌握千亿/万亿参数大模型在超大规模集群上的全景分布式训练方案，深入理解 ZeRO-1/2/3（FSDP）的显存切分与通信重叠机理，掌握序列并行（SP）、专家并行（EP）、上下文并行（CP）与 3D/4D 混合并行的工程配置准则。

---

## 1. 大模型分布式网络拓扑与架构扩展

### 1.1 集群通信拓扑对比

| 硬件互联架构 | 拓扑形式 | 核心优势 | 局限性与典型场景 |
| :--- | :--- | :--- | :--- |
| **GPU 集群 (NVIDIA)** | **Fat-Tree (胖树) / All-to-All 全互联** | 任意两点通信无阻塞，极度适配非规则通信 | 交换机成本极高，单 Pod 256 卡 NVLink / InfiniBand 互联 |
| **TPU 集群 (Google)** | **3D/4D Toroidal Mesh (环形网格)** | 硬件连线极简，成本低，适合近邻规约 | 跨对角节点延迟高，强依赖规则张量并行，MoE All-to-All 较弱 |

---

## 2. 零冗余优化器 (Zero Redundancy Optimizer, ZeRO / FSDP)

传统数据并行（DDP）中，每张卡都必须保留完整的参数、梯度与优化器状态（以混合精度训练为例，每个参数需 **16 字节**静态显存）。ZeRO 的核心思想是**通过集合通信的等价替换，消除数据并行中的一切显存冗余**：

```
Standard DDP:  [ Params (2B) ][ Grads (2B) ][ Master Weights + Adam States (12B) ] (All Replicated on Every GPU)
ZeRO-Stage 1:  [ Params (2B) ][ Grads (2B) ][ Sharded Adam States (12B / N) ]
ZeRO-Stage 2:  [ Params (2B) ][ Sharded Grads (2B / N) ][ Sharded Adam States (12B / N) ]
ZeRO-Stage 3:  [ Sharded Params (2B / N) ][ Sharded Grads (2B / N) ][ Sharded Adam States (12B / N) ] (FSDP)
```

### 2.1 ZeRO 三大阶段详细对比

| ZeRO 阶段 | 切分对象 (Sharded State) | 单卡静态显存占用 (Bytes/Param) | 每步通信算子 | 额外通信开销 | 8x A100 (80GB) 最大支持参数量 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline (DDP)** | 无切分（全量复制） | $16 \text{ Bytes}$ | $1 \times \text{All-Reduce}$ | 基准 ($2 \times \text{Params}$) | $\approx 6.7 \text{ B}$ |
| **ZeRO-Stage 1 ($P_{os}$)** | **优化器状态 (Optimizer States)** | $4 + \frac{12}{N_{\text{gpu}}} \text{ Bytes}$ | $1 \times \text{Reduce-Scatter} + 1 \times \text{All-Gather}$ | **0% (完全免费，通信量同为 $2 \times \text{Params}$)** | $\approx 16.0 \text{ B}$ |
| **ZeRO-Stage 2 ($P_{os+g}$)** | **优化器状态 + 梯度 (Gradients)** | $2 + \frac{14}{N_{\text{gpu}}} \text{ Bytes}$ | 边反向边 Reduce-Scatter 梯度 $+ 1 \times \text{All-Gather}$ 参数 | **0% (通信量同为 $2 \times \text{Params}$)** | $\approx 24.6 \text{ B}$ |
| **ZeRO-Stage 3 ($P_{os+g+p}$ / FSDP)** | **优化器状态 + 梯度 + 模型参数** | $\frac{16}{N_{\text{gpu}}} \text{ Bytes}$ | 前向 $1 \times \text{All-Gather}$，反向 $1 \times \text{All-Gather} + 1 \times \text{Reduce-Scatter}$ | **+50% ($3 \times \text{Params}$)** | $\approx 53.3 \text{ B}$ |

### 2.2 FSDP (Fully Sharded Data Parallel) 流水重叠机制
- 在前向计算第 $l$ 层前，通过异步 **All-Gather** 预取（Prefetch）该层全量权重；计算完成后立即释放该层权重，仅保留本地切片。
- 在反向计算第 $l$ 层前再次 All-Gather 权重，计算完梯度后立即执行 **Reduce-Scatter** 并释放本地梯度。
- **通信计算完全掩盖 (Overlap)**：将 All-Gather 通信时间与前一层的 GEMM 计算完全重叠，几乎不增加训练延迟。

---

## 3. 序列并行与上下文并行 (Sequence & Context Parallelism)

### 3.1 序列并行 (Sequence Parallelism, SP / Megatron-LM)
- **核心问题**：张量并行（TP）仅切分了 QKV 投影与 MLP 线性层，但 LayerNorm、Dropout 以及注意力/MLP 输入处的激活值仍是全量复制的（每层产生 $10 s b h$ 字节开销）。
- **切分机制**：将 LayerNorm 和 Dropout 在**序列维度（Sequence Dimension $s$）** 上切分给各个 TP 节点。
- **通信转换**：在前向进入线性层前调用 All-Gather 重组序列，在线性层输出后调用 Reduce-Scatter 切分序列，将激活值显存彻底压缩 $1/\text{TP}$ 倍，且不引入任何额外通信量。

### 3.2 上下文并行 (Context Parallelism, CP / Ring Attention)
- 针对 128K~1M 超长上下文，单个序列的 KV Cache 无法容纳在单卡甚至单机中。
- 将超长序列切分成多个块，各卡计算本地 Query 与本地 Key/Value 的局部注意力，并通过环状拓扑（Ring）依次传递 Key/Value 块，完成全局因果自注意力聚合。

---

## 4. 专家并行 (Expert Parallelism, EP)

针对 MoE 架构（如 Mixtral、DeepSeek）：
- **权重分布**：将全网 $E$ 个专家均匀分布在 $\text{EP}$ 张 GPU 上（每张卡持有 $E/\text{EP}$ 个专家）。
- **Token 路由分发 (Dispatch)**：门控网络计算每个 Token 的目标专家后，调用 **`All-to-All`** 算子将 Token 发送至对应专家所在的 GPU。
- **结果聚合 (Combine)**：专家执行完前向后，再次调用 **`All-to-All`** 将特征传回原始 GPU。

---

## 5. 3D / 4D 混合并行工程法则 (The 3D Parallelism Recipe)

在成千上万张 GPU 上训练超大模型时，并行维度的选择遵循以下黄金准则：

```
                      [ 3D/4D 并行配置黄金法则 ]
  1. 单机内 (Intra-Node, 8 GPUs):
     优先打满 Tensor Parallelism (TP ≤ 8) + Sequence Parallelism (SP)
     (享受 NVLink 1.8 TB/s 极速带宽)
                  │
                  ▼
  2. 跨机超大模型 (Inter-Node Scaling):
     若单机显存仍不足，开启 Pipeline Parallelism (PP) 跨机分层
     (点对点激活传输，对跨机带宽敏感度低于 TP)
                  │
                  ▼
  3. MoE 专家维度 (MoE Scaling):
     解耦 Attention (TP) 与 MLP (EP)，开启 Expert Parallelism (EP)
                  │
                  ▼
  4. 算力扩展 (Scale to Full Cluster):
     其余卡数全部用于 Data Parallelism (DP) + ZeRO-1 / FSDP
```

### 5.2 工业级前沿模型并行配置实录

| 前沿模型 | 参数规模 | TP (张量) | PP (流水线) | EP (专家) | CP (上下文) | DP (数据并行 / ZeRO) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Llama-3 405B** | 405B (Dense) | 8 (机内) | 16 (跨机) | 0 | 1 (长文本阶段扩展) | 128 (ZeRO-1) |
| **DeepSeek-V3** | 671B (37B 激活) | 1 | 16 | **64 (8机跨节点)** | 支持动态扩展 | ZeRO-1 + 1F1B A2A 重叠 |
| **Gemma-2 27B** | 27B (Dense) | 8 | 0 | 0 | 0 | 768 (ZeRO-3/FSDP) |
| **Mixtral 8x22B** | 176B (39B 激活) | 4 | 4 | 8 | 1 | 2 (ZeRO-1) |
| **Nemotron-3 Super** | 120B (MoE/长文本)| 2 | 0 | 64 | 64 | 动态扩展 |
