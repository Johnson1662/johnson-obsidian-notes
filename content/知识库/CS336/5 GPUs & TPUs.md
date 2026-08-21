# CS336 Lecture 5: GPU 与 TPU 体系结构、Roofline 模型与内存墙

大语言模型的扩展受制于物理硬件瓶颈。过去十年中，**计算能力增长速度远快于内存带宽与通信带宽**（称为“内存墙” Memory Wall）。本讲从底层硬件体系结构出发，解析 GPU/TPU 的存储层次、Tensor Core 计算机制与性能分析工具。

---

## 1. 现代 GPU 存储层级体系 (Memory Hierarchy)

以 NVIDIA H100 SXM5 / B200 架构为例，GPU 内部构成了严格的金字塔形多级存储结构：

| 存储层级 | 物理位置 | 容量规模 (H100) | 访问带宽 (Bandwidth) | 访问延迟 (Latency) | 共享范围 |
|---|---|---|---|---|---|
| **Register File (寄存器)** | 每个 SM 内部 | ~256 KB / SM (总计 ~33 MB) | $>30 \text{ TB/s}$ | $\sim 1 \text{ 周期}$ | 单线程私有 |
| **Shared Memory / L1 (SRAM)** | 每个 SM 内部 | 228 KB / SM (总计 ~30 MB) | $\sim 15 \text{ TB/s}$ | $\sim 20 \sim 30 \text{ 周期}$ | 单线程块 (Thread Block) 内共享 |
| **L2 Cache** | 片上 (All SMs) | 50 MB (全局) | $\sim 5 \text{ TB/s}$ | $\sim 100 \sim 200 \text{ 周期}$ | 全芯片 SM 共享 |
| **HBM3 (显存/全局内存)** | 片外封装堆叠 | 80 GB (全局) | $3.35 \text{ TB/s}$ | $\sim 400 \sim 800 \text{ 周期}$ | 全芯片共享 |
| **Host Memory (CPU 内存)** | 主机端 (DRAM) | 512 GB ~ 2 TB | 经过 PCIe 5.0 ($128 \text{ GB/s}$) | 数万周期 | 跨总线访问 |

```
[ 寄存器 Registers (单线程私有, ~30 TB/s) ]
      |
[ 共享内存 Shared Memory / SRAM (Block 共享, ~15 TB/s) ]
      |
[ L2 Cache (片上所有 SM 共享, ~5 TB/s) ]
      |
[ HBM3 全局显存 (80 GB, 3.35 TB/s) ]  <--- 核心性能瓶颈（内存墙）
      |
[ PCIe 5.0 / NVLink 主机与跨卡总线 ]
```

> **系统优化第一定律**：高性能 GPU Kernel 的核心在于**最大化 SRAM/寄存器内部数据复用，最小化对低速 HBM 的读写往返**。

---

## 2. 计算单元与 SIMT 执行模型

### 2.1 流式多处理器 (Streaming Multiprocessor, SM)
- GPU 的基本计算单元。H100 包含 132 个 SM，B200 包含 144 个 SM。
- 每个 SM 包含：Warp 调度器（Warp Schedulers）、标量算术逻辑单元（FP32/INT32 ALUs）、**Tensor Cores**、寄存器堆及可配置的 L1/Shared Memory。

### 2.2 Warp 与控制流分歧 (Warp Divergence)
- **Warp**：GPU 执行的基本调度单位，由 **32 个连续线程** 组成。
- **SIMT (Single Instruction, Multiple Threads)**：同一个 Warp 内的 32 个线程在同一时钟周期必须锁步执行相同的指令。
- **分支分歧惩罚**：
  若代码中存在条件分支 `if (condition) { Path A } else { Path B }`：
  - Warp 内满足条件 A 的线程执行 Path A 时，其余线程被迫处于**屏蔽等待（Inactive）**状态；
  - 随后执行 Path B 时，满足 A 的线程被屏蔽。
  - **结果**：两个分支的时间串行累加，硬件利用率直接腰斩。编写高性能 Kernel 时必须保证同一 Warp 内执行路径完全一致。

---

## 3. Tensor Core 硬件乘加加速机制

Tensor Core 是专为密集矩阵乘法累加（MMA: Matrix Multiply-Accumulate）设计的专用硬件电路：
$$
D = A \cdot B + C
$$
- 通用 ALU 每次执行 1 次乘法或加法；Tensor Core 在 1 个指令周期内完成两个 $16 \times 16$ 小矩阵的整块乘加运算（$16 \times 16 \times 16 = 4096$ 次乘加操作）。
- **混合精度计算**：输入矩阵 $A, B$ 使用低精度（如 FP16、BF16、FP8）以节省存储与带宽，累加器 $C, D$ 采用 FP32 保证数值稳定性。

| 精度格式 | H100 SXM5 峰值吞吐 (Dense) | 相比 FP32 ALU 提升倍数 | 适用场景 |
|---|---|---|---|
| **FP32 (Standard ALU)** | 67 TFLOP/s | $1.0\times$ (基准) | 优化器状态、损失函数 |
| **TF32 (Tensor Core)** | 494.7 TFLOP/s | $\sim 7.4\times$ | 传统 DL 训练无缝加速 |
| **FP16 / BF16 (Tensor Core)**| 989.5 TFLOP/s | $\sim 14.8\times$ | 现代大模型预训练与推理 |
| **FP8 (Tensor Core)** | 1978.9 TFLOP/s | $\sim 29.5\times$ | 前沿超大模型训练与低延迟推理 |

---

## 4. Roofline 性能分析模型

Roofline 模型定量刻画了算子性能受限于**计算能力**还是**内存带宽**：

$$
P = \min\left( P_{\text{peak}}, \; I \times B_{\text{mem}} \right)
$$
- $P$：算子实际可达到的计算吞吐（FLOP/s）。
- $P_{\text{peak}}$：硬件峰值算力（FLOP/s）。
- $B_{\text{mem}}$：硬件全局内存带宽（Bytes/s）。
- $I = \frac{\text{FLOPs}}{\text{Bytes}}$：算子的算术强度（Arithmetic Intensity）。

### 硬件平衡拐点 (Ridge Point)
$$
I_{\text{ridge}} = \frac{P_{\text{peak}}}{B_{\text{mem}}}
$$
- **H100 SXM5 (BF16)**：$I_{\text{ridge}} = \frac{989.5 \times 10^{12}}{3.35 \times 10^{12}} \approx 295 \text{ FLOP/Byte}$
- **结论**：
  - **Memory-bound 算子 ($I < 295$)**：如 Softmax、LayerNorm、RMSNorm、GELU、单步自回归 Decode。瓶颈在 HBM 带宽，优化重点是**算子融合（Fusion）**以减少 HBM 访存。
  - **Compute-bound 算子 ($I > 295$)**：大 Batch 矩阵乘法（GEMM）。优化重点是**提高 Tensor Core 占空比、利用 SRAM 进行矩阵分块（Tiling）**。

---

## 5. GPU 核心优化技术

### 5.1 内存合并访问 (Memory Coalescing)
- 一个 Warp（32 线程）在向 HBM 发起加载指令时，若 32 个线程访问的地址连续且对齐（例如连续的 128 字节），硬件将其合并为**一次 DRAM 事务**。
- 若访问跨步（Strided）或随机乱序，硬件必须触发多达 32 次独立的内存事务，有效带宽跌至不足 $5\%$。

### 5.2 共享内存 Bank 冲突 (Shared Memory Bank Conflicts)
- Shared Memory 被划分为 32 个独立的内存池（Banks），每个 Bank 宽度为 32 位（4 字节）。
- 若同一个 Warp 内的多个线程同时访问同一个 Bank 中的不同地址，硬件只能**串行化**依次读取，造成严重延迟。
- **解决手段**：调整数据排列填充（Padding），让相邻线程访问交错的 Bank。

### 5.3 算子融合与分块 (Fusion & Tiling)
- **朴素实现**：LayerNorm ➔ HBM ➔ GEMM ➔ HBM ➔ GELU ➔ HBM（反复产生多次大带宽读写）。
- **融合实现**：在 SM 内部将数据一次性加载到寄存器与 SRAM 中，连续完成 Norm、GEMM 与激活计算，最后一次写回 HBM，大幅降低带宽消耗。

---

## 6. TPU 体系结构对比 (Google TPU v4/v5)

| 架构维度 | NVIDIA GPU (Hopper / Blackwell) | Google TPU (v4 / v5e / v5p) |
|---|---|---|
| **核心计算模式** | SIMT + 多 SM 独立指令流 | **脉动阵列 (Systolic Array / MXU)** |
| **矩阵乘法机制** | 线程块由 Tensor Core 指令驱动 | 数据在二维乘加单元网格中流水线“流动”，无中间寄存器读写 |
| **控制复杂度** | 高（通用指令集、硬件分支调度） | 极低（专为 XLA 编译器静态编译优化） |
| **互连拓扑** | NVLink / NVSwitch + RoCE/InfiniBand | 原生 **3D Torus** 光互连（ICI 网络），节点级直连 |
