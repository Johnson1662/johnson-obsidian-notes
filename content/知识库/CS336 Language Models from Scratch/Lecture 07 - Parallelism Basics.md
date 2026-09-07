# Lecture 07 - Parallelism Basics

> **课程主题**：分布式并行基础：硬件拓扑、集合通信原语与三大基础并行范式（DP/TP/PP）
> **授课教师**：Percy Liang
> **核心目标**：掌握数据中心多卡/多机网络拓扑（NVLink、NVSwitch、RDMA、NCCL），深入理解集合通信原语（All-Reduce、Reduce-Scatter、All-to-All），掌握数据并行（DDP）、张量并行（TP）与流水线并行（PP）的数学切分与通信开销。

---

## 1. 分布式硬件拓扑与互联网络 (Interconnects)

在超大规模集群中，通信带宽呈现出鲜明的**分级金字塔结构**：

```
[ GPU 0 ] <=== NVLink 5.0 (1.8 TB/s) ===> [ GPU 1..7 ] (单机 8 卡内部，NVSwitch 全互联)
   │
 PCIe Gen5 (64 GB/s)
   │
[ InfiniBand NIC / HCA ] <=== InfiniBand (50 GB/s / 400 Gbps) ===> [ 跨机 Pod / Cluster ]
```

- **NVLink & NVSwitch**：机内 GPU 专用高速通道，带宽接近 HBM 内存带宽（单卡双向高达 1.8 TB/s）。
- **PCIe 总线**：连接 CPU、GPU 与网卡，是传统数据搬运的瓶颈。
- **RDMA (Remote Direct Memory Access)**：
  - 传统 Ethernet 通信需经过 CPU 内存复制、内核协议栈打包，产生高延迟与 CPU 抢占。
  - **RDMA 允许一张 GPU 通过网卡直接读写远程机器 GPU 的显存，完全绕过 CPU**。
  - 工业方案：**InfiniBand**（原生低延迟，昂贵）与 **RoCE (RDMA over Converged Ethernet)**（基于标准以太网，高性价比，Meta/开源广泛采用）。
- **NCCL (NVIDIA Collective Communications Library)**：NVIDIA 官方集合通信库，自动探测硬件拓扑（NVLink/PCIe/网卡），将高阶集合操作转化为高度优化的底层通信内核。

---

## 2. 集合通信原语 (Collective Operations)

集合通信是所有分布式并行算法的构建基石（以 4 卡为例）：

```
Broadcast:     Rank 0 [A]           ──> Rank 0 [A], Rank 1 [A], Rank 2 [A], Rank 3 [A]
Scatter:       Rank 0 [A, B, C, D]  ──> Rank 0 [A], Rank 1 [B], Rank 2 [C], Rank 3 [D]
Gather:        Rank 0..3 [A], [B].. ──> Rank 0 [A, B, C, D]
All-Gather:    Rank 0..3 [A], [B].. ──> All Ranks [A, B, C, D]
Reduce:        Rank 0..3 [A], [B].. ──> Rank 0 [A + B + C + D]
Reduce-Scatter:Rank 0..3 [A0..A3]   ──> Rank 0 [ΣA0], Rank 1 [ΣA1], Rank 2 [ΣA2], Rank 3 [ΣA3]
All-Reduce:    Rank 0..3 [A0..A3]   ──> All Ranks [ΣA0, ΣA1, ΣA2, ΣA3]
All-to-All:    Rank 0..3 [A0..A3]   ──> Rank 0 [A0, B0, C0, D0], Rank 1 [A1, B1, C1, D1]...
```

| 集合通信算子 | 核心行为 | 数据传输总量 (Bytes) | 典型应用场景 |
| :--- | :--- | :--- | :--- |
| **Broadcast** | 单卡向所有卡广播相同数据 | $S$ | 模型初始参数权重同步 |
| **All-Gather** | 每张卡收集所有其他卡的分片 | $\frac{W-1}{W} S$ | ZeRO-3 前向恢复参数、张量并行激活合并 |
| **Reduce-Scatter** | 规约各卡分片并在各卡分散保存 | $\frac{W-1}{W} S$ | ZeRO-2/3 梯度反向规约分片 |
| **All-Reduce** | **Reduce-Scatter + All-Gather** | $2 \times \frac{W-1}{W} S$ | **传统数据并行 (DDP) 梯度全卡同步** |
| **All-to-All** | 全卡对全卡矩阵转置式交换 | $\frac{W-1}{W} S$ | **MoE 专家路由分发与结果聚合** |

> **Ring All-Reduce 通信量法则**：设全量数据大小为 $S$ 字节，集群卡数为 $W$。Ring All-Reduce 分为 Reduce-Scatter 和 All-Gather 两个阶段，每个阶段每张卡发送和接收的数据量均为 $\frac{W-1}{W} S$。总发送通信量为 **$2 \frac{W-1}{W} S \approx 2S$**，**通信耗时与 GPU 卡数 $W$ 几乎无关**。

---

## 3. 数据并行 (Distributed Data Parallel, DDP)

### 3.1 核心机制
- **数据切分**：全局 Batch Size 为 $B$，分配给每张卡 Local Batch 为 $B / W$。
- **权重复制**：每张卡持有完整的模型参数 $W$ 与完整的优化器状态。
- **执行流程**：
  1. 各卡独立读取本地微批次数据，执行本地前向计算与 Loss。
  2. 执行反向传播计算本地梯度 $\nabla W_{\text{local}}$。
  3. 调用 **`dist.all_reduce(param.grad, op=dist.ReduceOp.AVG)`** 同步全卡平均梯度。
  4. 各卡优化器独立执行 `optimizer.step()` 更新参数，保持各卡参数全局严格一致。

```python
# DDP 训练循环核心精髓
loss.backward()
for param in model.parameters():
    if param.grad is not None:
        dist.all_reduce(param.grad.data, op=dist.ReduceOp.AVG)
optimizer.step()
```

---

## 4. 张量并行 (Tensor Parallelism, TP / Megatron-LM)

当单层模型参数（如巨型注意力层或 MLP）无法放入单张 GPU 显存时，需将权重矩阵在单个算子内部切分：

```
Column Parallel (MLP 升维):         Row Parallel (MLP 降维):
     X ──> [ W_1 ] ──> Y_1                [ X_1 ] ──> [ W_1 ] ──┐
     X ──> [ W_2 ] ──> Y_2                [ X_2 ] ──> [ W_2 ] ──┼──(All-Reduce Sum)──> Y
```

### 4.1 MLP 层的列并行与行并行配对
1. **第一层升维矩阵 $W_{\text{gate/up}}$（列切分 Column Parallel）**：
   - 将权重沿列切分为 $W = [W_1, W_2, \dots, W_k]$。
   - 输入 $X$ 复制给各卡，各卡计算 $Y_i = \text{GeLU}(X W_i)$。**无需通信**！
2. **第二层降维矩阵 $W_{\text{down}}$（行切分 Row Parallel）**：
   - 将权重沿行切分为 $W = [W_1^T, W_2^T, \dots, W_k^T]^T$。
   - 各卡计算局部部分和 $Z_i = Y_i W_i$。
   - 调用一次 **All-Reduce (Sum)**：$Z = \sum Z_i = X W_{\text{up}} W_{\text{down}}$。
3. **通信代价**：整个 MLP 模块仅在前向与反向各需要 **1 次 All-Reduce**。

---

## 5. 流水线并行 (Pipeline Parallelism, PP / GPipe)

### 5.1 核心机制与微批次切分 (Micro-batching)
- **层切分**：将模型深度的 $L$ 个 Transformer Block 依次切分给 $P$ 个 GPU 阶段（Stage）。
- **微批次切分**：若直接传入整批数据，下游 GPU 必须等待上游算完，产生巨大的空转闲置。GPipe 将 Batch 划分为 $M$ 个 Micro-batches，让各 GPU 流水线交替运转。

```
GPipe Pipeline Schedule:
GPU 3:             [F0][F1][F2][F3][B3][B2][B1][B0]
GPU 2:         [F0][F1][F2][F3]        [B3][B2][B1][B0]
GPU 1:     [F0][F1][F2][F3]                [B3][B2][B1][B0]
GPU 0: [F0][F1][F2][F3]                        [B3][B2][B1][B0]
       |<----------- Pipeline Bubble ---------->|
```

### 5.2 流水线气泡比率 (Bubble Ratio)

$$F_{\text{bubble}} = \frac{P - 1}{M + P - 1}$$
- 其中 $P$ 为流水线阶段数（GPU 数），$M$ 为微批次数。
- 当 $M \gg P$ 时（如 $M = 4P$），气泡比例可压低至 $\approx 20\%$ 以下。
- 进阶调度：**1F1B (One Forward, One Backward)** 调度交错执行前向与反向，能够显著降低暂存激活值的显存峰值。
