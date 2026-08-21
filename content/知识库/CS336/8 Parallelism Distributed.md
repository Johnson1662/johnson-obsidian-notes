# CS336 Lecture 8: 大规模分布式训练系统 (ZeRO, FSDP, 3D 并行与序列并行)

当单模型规模突破数百亿（如 70B ~ 671B）且上下文拉长至 128K+ 时，单一并行策略已无法满足需求。本讲深入剖析大模型训练系统的显存消除技术（**ZeRO / FSDP**）、长文本并行方案（**Sequence Parallelism / Ring Attention**）以及多维混合并行（**3D/4D Parallelism**）。

---

## 1. 显存瓶颈与 ZeRO / FSDP 消除原理

标准数据并行（DDP）中，每张 GPU 都必须全量存储 **16 bytes/参数** 的静态模型状态。微软提出的 **ZeRO (Zero Redundancy Optimizer)** 与 PyTorch **FSDP (Fully Sharded Data Parallel)** 通过显存分片（Sharding）消除了这些冗余。

```
DDP (全量冗余):
GPU 0: [ Params (2B) ][ Grads (2B) ][ Opt States (12B) ]  <-- 16 bytes / param
GPU 1: [ Params (2B) ][ Grads (2B) ][ Opt States (12B) ]
GPU 2: [ Params (2B) ][ Grads (2B) ][ Opt States (12B) ]
GPU 3: [ Params (2B) ][ Grads (2B) ][ Opt States (12B) ]

ZeRO-3 / FSDP (完全分片):
GPU 0: [P0][G0][Opt0]
GPU 1: [P1][G1][Opt1]  <-- 每张卡仅存 16 / N_d bytes / param
GPU 2: [P2][G2][Opt2]
GPU 3: [P3][G3][Opt3]
```

### 1.1 ZeRO-1, ZeRO-2, ZeRO-3 数学对比

设模型参数量为 $\Phi$，混合精度采用 FP16/BF16，数据并行度为 $N_d$：

| 级别 | 分片对象 | 单卡静态显存占用 (Bytes/参数) | 通信量相比 DDP 增加 | 通信机制 |
|---|---|---|---|---|
| **DDP (Baseline)** | 无分片（全卡复制） | $2 + 2 + 12 = \mathbf{16}$ | $0\%$ (基准: $2\Phi$) | 反向传播进行 All-Reduce 梯度同步 |
| **ZeRO-1 ($P_{os}$)** | **优化器状态** 分片 | $2 + 2 + \frac{12}{N_d} = \mathbf{4 + \frac{12}{N_d}}$ | **$0\%$** | 反向传播算完梯度后，各卡仅更新自己的优化器分片，最后 All-Gather 参数 |
| **ZeRO-2 ($P_{os+g}$)**| **优化器 + 梯度** 分片 | $2 + \frac{2 + 12}{N_d} = \mathbf{2 + \frac{14}{N_d}}$ | **$0\%$** | 反向传播直接通过 **Reduce-Scatter** 归约并分片梯度，无需 All-Reduce |
| **ZeRO-3 / FSDP ($P_{os+g+p}$)** | **优化器 + 梯度 + 模型参数** 全分片 | $\frac{2 + 2 + 12}{N_d} = \mathbf{\frac{16}{N_d}}$ | **$+50\%$** (变为 $3\Phi$) | 前向时临时 All-Gather 参数，用完即释放；反向时再次 All-Gather 参数，算完后 Reduce-Scatter 梯度 |

### 1.2 FSDP (ZeRO-3) 通信时序推导
在 FSDP 的每个 Transformer Block 计算中：
1. **前向传播 (Forward)**：
   - 触发一次 **All-Gather**，从所有卡收集该层参数 $\Phi_l$（通信量 $\frac{N_d-1}{N_d} \Phi_l$）；
   - 执行局部前向计算；
   - **立即丢弃收集到的参数，显存释放**。
2. **反向传播 (Backward)**：
   - 再次触发 **All-Gather**，重新收集该层参数 $\Phi_l$（通信量 $\frac{N_d-1}{N_d} \Phi_l$）；
   - 执行反向求导计算激活值与参数梯度；
   - 丢弃参数，对参数梯度执行 **Reduce-Scatter**（通信量 $\frac{N_d-1}{N_d} \Phi_l$），各卡仅保留属于自己的局部梯度分片。
3. **总通信量**：
   $$
   \text{FSDP Communication} = 3 \times \frac{N_d - 1}{N_d} \Phi \approx 3 \Phi
   $$
   相比传统 DDP（$2\Phi$），**FSDP 仅增加了 $50\%$ 的通信开销，却换取了 $N_d$ 倍的显存缩减**。

---

## 2. 序列并行 (Sequence Parallelism, SP) 与上下文并行 (Context Parallelism, CP)

当长文本训练的序列长度达到 $32\text{K} \sim 1\text{M}$ 时，即使使用 Activation Checkpointing，单层激活值显存也将打爆 GPU。

### 2.1 Megatron-LM Sequence Parallelism (TP + SP)
- 在标准 TP 中，LayerNorm 和 Dropout 依然在每张卡上全量复制输入 $X \in \mathbb{R}^{B \times S \times d}$；
- **Megatron-SP**：将 LayerNorm 和 Dropout 沿**序列维度 $S$** 切分为 $S / N_{\text{tp}}$，利用 TP 的通信算子顺带完成维度变换：
  - 进入 Column Parallel 前：执行 **All-Gather**（将 $S/N_{\text{tp}}$ 拼接回 $S$）；
  - 走出 Row Parallel 后：执行 **Reduce-Scatter**（将求和结果直接分散为 $S/N_{\text{tp}}$）。
- **收益**：**完全不增加任何额外的通信量**，同时将 LayerNorm/Dropout 的激活值显存降为原来的 $1 / N_{\text{tp}}$。

### 2.2 环形注意力 (Ring Attention / Context Parallelism)
针对单卡无法容纳单个样本超长注意力的场景（如 $1\text{M}$ 上下文）：
- 将长度为 $S$ 的序列均分给 $N_{\text{cp}}$ 张卡，每张卡持有 $S / N_{\text{cp}}$ 的 $Q, K, V$ 分块；
- **环形流水线**：每张卡在本地计算当前 $Q$ 与局部 $K, V$ 的注意力；随后将 $K, V$ 在 GPU 环上传递给相邻卡，连续传递 $N_{\text{cp}}-1$ 步；
- **通信与计算完美重叠 (Overlap)**：传递下一块 $K, V$ 的网络时间被当前块的 FlashAttention 计算时间完全掩盖。

---

## 3. 3D / 4D 混合并行架构 (Hybrid Parallelism)

在训练千亿级别模型时，必须将多种并行策略正交组合：

$$
\text{Total GPUs} = N_{\text{world}} = N_{\text{TP}} \times N_{\text{PP}} \times N_{\text{DP}} \times N_{\text{EP}}
$$

```
+-----------------------------------------------------------------------+
| 集群拓扑物理映射规则                                                     |
|                                                                       |
| 1. Tensor Parallel (TP)    --> 限制在单节点内 (8 卡 NVLink, ~900 GB/s)  |
| 2. Sequence Parallel (SP)  --> 绑定 TP 所在节点内                      |
| 3. Pipeline Parallel (PP)  --> 跨节点放置 (点对点通信量小, 适合 IB 网络) |
| 4. Data Parallel (DP/FSDP) --> 跨节点最外层 (梯度/参数分片异步通信)     |
| 5. Expert Parallel (EP)    --> 跨节点 MoE 通信 (结合 NVLink/NVSwitch)   |
+-----------------------------------------------------------------------+
```

### 3.1 经典模型配置实战示例

| 模型 | 总参数量 | GPU 集群 | 并行配置方案 ($TP \times PP \times DP$) |
|---|---|---|---|
| **GPT-3 (175B)** | 175B | 1,024 卡 A100 | $TP = 8, \; PP = 16, \; DP = 8$ |
| **Llama 3 (70B)** | 70B | 1,024 卡 H100 | $TP = 8, \; PP = 1, \; DP = 128 \text{ (FSDP / ZeRO-1)}$ |
| **Llama 3 (405B)**| 405B | 16,384 卡 H100 | $TP = 8, \; PP = 16, \; DP = 128 \text{ (FSDP / CP)}$ |
| **DeepSeek-V3** | 671B (37B 激活) | 2,048 卡 H800 | $TP = 4, \; PP = 8, \; EP = 64, \; DP = 64$ ( DualPipe 极低气泡流水线 ) |
