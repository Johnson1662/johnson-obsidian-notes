# CS336 Lecture 7: 分布式并行训练基础 (DDP, TP, PP)

当单张 GPU 显存不足以容纳模型，或者需要横向扩展算力以缩短训练周期时，必须采用分布式并行。本讲剖析集合通信原语（Collectives）及大模型训练的三大基础并行维度：**数据并行 (DP)**、**张量并行 (TP)** 与 **流水线并行 (PP)**。

---

## 1. 硬件拓扑与集合通信原语 (Collective Operations)

分布式训练中，设备间通信带宽存在显著的层级差异：
- **节点内 (Intra-Node)**：通过 NVLink / NVSwitch 直连，双向带宽高达 **$900 \text{ GB/s} \sim 1.8 \text{ TB/s}$**。
- **节点间 (Inter-Node)**：通过 InfiniBand (IB) 或 RoCE 网卡，单卡网络带宽通常为 **$50 \sim 100 \text{ GB/s}$**（比 NVLink 慢一个数量级）。

### 1.1 核心集合通信原语
设集群共有 $N$ 张 GPU（Ranks），每张卡待发送的数据块大小为 $S$ 字节：

| 集合操作 | 输入状态 (每卡) | 输出状态 (每卡) | 通信数据量 (Per GPU) | 核心应用场景 |
|---|---|---|---|---|
| **Broadcast** | Rank 0 持有数据 $S$ | 所有 Rank 均获得数据 $S$ | $S$ | 参数与配置初始化广播 |
| **Scatter** | Rank 0 持有数组 $[S_0, \dots, S_{N-1}]$ | 各 Rank $i$ 获得切片 $S_i$ | $\frac{N-1}{N} S$ | 数据分发 |
| **Gather** | 各 Rank $i$ 持有切片 $S_i$ | Rank 0 收集完整拼接数组 | $\frac{N-1}{N} S$ | 结果收集评测 |
| **All-Gather** | 各 Rank $i$ 持有切片 $S_i$ | 所有 Rank 均获得完整拼接数组 | $\frac{N-1}{N} S$ | FSDP 前向参数重建、TP 序列拼接 |
| **Reduce-Scatter**| 各 Rank 持有完整数据 $S$ | 各 Rank $i$ 获得局部归约和 $\sum S_i$ | $\frac{N-1}{N} S$ | FSDP 反向梯度归约分块 |
| **All-Reduce** | 各 Rank 持有同尺寸数据 $S$ | 所有 Rank 均获得全局归约和 $\sum S$ | **$2 \frac{N-1}{N} S$** | DDP 梯度同步、TP 输出合并 |
| **All-to-All** | 各 Rank 持有 $N$ 份发往不同卡的数据 | 各 Rank 收集来自所有卡的对应片段 | $\frac{N-1}{N} S$ | MoE 专家路由分发与回收 |

### 1.2 Ring All-Reduce 通信推导
在没有中心参数服务器的环形拓扑（Ring）中，All-Reduce 分解为两个阶段：
1. **Scatter-Reduce 阶段**：每个 GPU 将切分的数据块顺时针在环上传递 $N-1$ 次完成局部求和，每卡传输量为 $\frac{N-1}{N} S$；
2. **All-Gather 阶段**：将求和结果顺时针广播 $N-1$ 次，每卡传输量为 $\frac{N-1}{N} S$。
$$
\text{Total Communication Volume (Per GPU)} = 2 \times \frac{N-1}{N} S \approx 2 S \quad (\text{当 } N \gg 1)
$$
通信总量与 GPU 数量 $N$ 无关，具有极强的扩展性。

---

## 2. 数据并行 (Distributed Data Parallel, DDP)

```
[ GPU 0: Batch 0..B/4 ]  --> 前向计算 --> 反向梯度 g_0 --+
[ GPU 1: Batch B/4..B/2 ] --> 前向计算 --> 反向梯度 g_1 --+---> [ All-Reduce 同步 ] ---> 各卡独立 AdamW 更新
[ GPU 2: Batch B/2..3B/4] --> 前向计算 --> 反向梯度 g_2 --+       (获得全局平均梯度 g)
[ GPU 3: Batch 3B/4..B ]  --> 前向计算 --> 反向梯度 g_3 --+
```

- **机制**：每张 GPU 持有完整的模型参数与优化器状态副本，将全局 Batch 沿 Batch 维度均分给各卡；
- **通信时机**：反向传播过程中，每算出一层的梯度，立即通过异步 Bucket 触发 **All-Reduce** 同步梯度，与后续反向计算重叠（Overlap）；
- **瓶颈**：无法解决单卡显存放不下模型参数的问题（扩展上限受单卡显存硬约束）。

---

## 3. 张量并行 (Tensor Parallelism / Megatron-LM)

将单个矩阵乘法（GEMM）沿行（Row）或列（Column）拆分到多张 GPU 上协同计算。

### 3.1 MLP 层的 Column-Row 并行切分
设输入为 $X \in \mathbb{R}^{B \times d}$，两层 MLP 权重分别为 $W_1 \in \mathbb{R}^{d \times 4d}, W_2 \in \mathbb{R}^{4d \times d}$：
1. **第一层：列并行 (Column Parallel Linear)**
   - 将 $W_1$ 按列拆分成 $N$ 块：$W_1 = [W_{1,1} \mid W_{1,2} \mid \dots \mid W_{1,N}]$，每张卡分配 $W_{1,i} \in \mathbb{R}^{d \times \frac{4d}{N}}$。
   - 各卡独立计算：$Y_i = \text{GELU}(X W_{1,i})$。**此阶段无需任何通信！**
2. **第二层：行并行 (Row Parallel Linear)**
   - 将 $W_2$ 按行拆分成 $N$ 块：$W_2 = \begin{bmatrix} W_{2,1} \\ \hline \dots \\ \hline W_{2,N} \end{bmatrix}$，每张卡分配 $W_{2,i} \in \mathbb{R}^{\frac{4d}{N} \times d}$。
   - 各卡独立计算局部矩阵乘：$Z_i = Y_i W_{2,i}$。
   - **全局汇聚**：通过一次 **All-Reduce** 将各卡结果相加：
     $$
     Z = \sum_{i=1}^N Z_i = X W_1 W_2
     $$

```
输入 X
  |
  +-----------------------+-----------------------+
  | (复制输入 X)                                  | (复制输入 X)
  v                                               v
[ GPU 0: W_1,1 (列切分) ]                     [ GPU 1: W_1,2 (列切分) ]
  |                                               |
  v Y_1 = GELU(X * W_1,1)                         v Y_2 = GELU(X * W_1,2)
  |                                               |
[ GPU 0: W_2,1 (行切分) ]                     [ GPU 1: W_2,2 (行切分) ]
  |                                               |
  v Z_1 = Y_1 * W_2,1                             v Z_2 = Y_2 * W_2,2
  |                                               |
  +-----------------------+-----------------------+
                          |
                          v
                 [ All-Reduce 规约求和 ]
                          |
                          v 输出 Z
```

### 3.2 自注意力层 (Self-Attention) 的 TP 切分
- **$Q, K, V$ 投影**：按 Head 数量进行**列并行**拆分（每张卡分得 $H/N$ 个 Heads），独立计算局部注意力输出；
- **Output 投影 $W_O$**：按**行并行**拆分，最后通过一次 **All-Reduce** 输出最终结果。

> **通信开销定律**：每个标准 Transformer Block 在前向传播包含 **2 次 All-Reduce**（Attention 一次，MLP 一次），反向传播同样包含 **2 次 All-Reduce**。由于通信频繁，TP 必须限制在具有极高带宽的 **单节点 NVLink 内部（通常 $TP \le 8$）**。

---

## 4. 流水线并行 (Pipeline Parallelism, PP)

将 Transformer 的 $L$ 层网络沿深度切分到 $P$ 个流水线阶段（Stages），每个阶段占用 1 张 GPU。

### 4.1 朴素流水线的“气泡（Bubble）”问题
若整批数据作为一个 Batch 输入，前一个阶段计算完成前，后续 GPU 完全闲置。

### 4.2 1F1B 调度与气泡率公式
将 Batch 细分为 $m$ 个微批次（Micro-batches）：
- **1F1B 调度策略 (One Forward, One Backward)**：在预热阶段后，每张 GPU 每执行完一个 Micro-batch 的前向，立即执行一个就绪 Micro-batch 的反向，严格限制片上激活值缓存数量。

```
Stage 3:        [F0][F1][F2][F3][B0][B1][B2][B3]
Stage 2:     [F0][F1][F2][F3][B0][B1][B2][B3]
Stage 1:  [F0][F1][F2][F3][B0][B1][B2][B3]
Stage 0:[F0][F1][F2][F3][B0][B1][B2][B3]
        <-- 启动气泡 -->                      <-- 排水气泡 -->
```

- **流水线气泡率 (Bubble Fraction)**：
  $$
  F_{\text{bubble}} = \frac{P - 1}{m + P - 1} \approx \frac{P - 1}{m} \quad (\text{当 } m \gg P)
  $$
  其中 $P$ 为流水线级数，$m$ 为微批次数量。
- **工程规则**：为了使气泡率降至 $10\%$ 以下，通常要求 **$m \ge 4P \sim 8P$**。
- **优势**：PP 仅在相邻 Stage 之间传递边界激活值与梯度，通信数据量极小，**非常适合跨节点的低速网络互连**。
