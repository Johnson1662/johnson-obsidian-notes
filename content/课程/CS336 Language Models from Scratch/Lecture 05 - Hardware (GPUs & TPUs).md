# Lecture 05 - Hardware (GPUs & TPUs)

> **课程主题**：硬件体系结构：GPU/TPU 内部机制、显存层次与算子加速原理
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：打破对 GPU/TPU 的黑盒认知，深入理解 SIMT 执行模型、显存分级体系、内存墙（Memory Wall）、加速 GPU 负载的六大核心技巧，并彻底掌握 FlashAttention 的底层分块（Tiling）与在线 Softmax 实现原理。

---

## 1. 硬件扩展背景与内存墙 (The Memory Wall)

### 1.1 登纳德缩放定律失效与并行计算崛起
- **登纳德缩放定律 (Dennard Scaling) 终结**：2000 年代初，单核 CPU 时钟频率达到功耗上限（Thermal Wall）。
- **GPU 吞吐扩展**：通过堆叠成千上万个轻量级计算核心，近 10 年 GPU 并行算力增长超 1000 倍。
- **内存墙 (Memory Wall)**：**算力（FLOPs）增长速度远超内存带宽（Bandwidth）增长速度**。大模型优化的本质就是**减少数据在慢速显存与快速计算单元之间的往返搬运**。

---

## 2. GPU 架构体系与执行模型

### 2.1 CPU vs GPU 架构哲学

| 硬件特性 | CPU (中央处理器) | GPU (图形/通用加速器) |
| :--- | :--- | :--- |
| **设计目标** | **优化延迟 (Low Latency)** | **优化吞吐 (High Throughput)** |
| **核心特点** | 少量强大核心，高时钟频率，庞大缓存与复杂分支预测 | 大量轻量核心（ALUs），极简化控制逻辑，海量并发线程 |
| **执行模式** | 多线程乱序执行 (MIMD) | **单指令多线程 (SIMT: Single Instruction Multiple Threads)** |

### 2.2 GPU 计算单元层级
- **Grid（网格）**：启动一个 Kernel 时的全量任务集合。
- **Thread Block（线程块）**：运行在同一个 **SM（流式多处理器，Streaming Multiprocessor）** 上的线程组，共享该 SM 上的片上共享内存（Shared Memory / SRAM）。
- **Warp（线程束，32 线程）**：**GPU 硬件调度的最小原子单位**。同一个 Warp 内的 32 个连续线程在同一时钟周期内严格执行完全相同的指令。
  - **分支分化 (Branch / Control Divergence)**：若 Warp 内部出现 `if-else` 分支，32 个线程将串行执行不同分支路径（未执行分支的线程处于 Mask 闲置状态），导致硬件利用率大幅下跌。

### 2.3 GPU 显存金字塔 (Memory Hierarchy)

```
       [ Registers (寄存器) ]       ~ 0 cycles, 极大带宽, 私属于每个线程
                 │
      [ Shared Memory (SRAM) ]     ~ 10-30 cycles, ~10-20 TB/s, SM 内部共享 (几十~200 KB)
                 │
           [ L2 Cache ]            ~ 100-200 cycles, ~5 TB/s, 片上全局共享 (数十 MB)
                 │
    [ Global Memory (HBM/DRAM) ]   ~ 400-800 cycles, 2-8 TB/s, 板载显存 (80-192 GB)
```

- **SRAM vs HBM**：SRAM 单位容量成本比 HBM 昂贵约 100 倍，但访存速度快 8~10 倍且延迟极低。

### 2.4 GPU vs TPU 架构差异
- **GPU (NVIDIA)**：由数十到上百个 SM 组成，包含通用 CUDA Core 与专用 Tensor Core，调度粒度细（Warp 机制）。
- **TPU (Google)**：拥有更少但规模更大的矩阵乘法单元（Matrix Multiply Units, MXU / Systolic Arrays 脉动阵列），采用确定性控制，无 Warp 调度，依赖高速专有光纤互联拓扑（ICI）。

---

## 3. GPU 性能加速的六大核心技巧

| 优化技术 | 核心原理 | 针对的系统瓶颈 | 典型应用场景 |
| :--- | :--- | :--- | :--- |
| **1. 避免分支分化** | 保持 Warp 内 32 线程执行路径一致 | 指令吞吐下降 | 条件分支对齐、无分支算子 |
| **2. 低精度计算** | 采用 FP16/BF16/FP8/NVFP4 减少数据位宽 | 显存带宽 + Tensor Core 算力 | 混合精度训练、FP8 矩阵乘 |
| **3. 算子融合 (Fusion)** | 将多个连续 Elementwise 算子合并至单个 Kernel | HBM 显存读写往返开销 | BiasAdd + GELU, RMSNorm |
| **4. 激活重计算** | 丢弃中间轻量级激活，反向时重新计算 | 显存容量不足 | Gradient Checkpointing |
| **5. 内存对齐与合并 (Coalescing)** | Warp 内 32 线程连续访问连续对齐的显存地址 | DRAM Burst 突发传输碎片化 | 行优先连续访问、矩阵 Padding |
| **6. 块状分块 (Tiling)** | 将大矩阵切分成 Tile 加载到 SRAM 中复用 | 减少全局 HBM 访问次数（降低 $T$ 倍） | 快速矩阵乘 (GEMM)、FlashAttention |

---

## 4. 矩阵计算的硬件异常现象 (Performance Mysteries)

在实际矩阵乘（GEMM）基准测试中，矩阵尺寸微小变化可能导致性能大幅阶跃：

1. **内存对齐与 Padding**：
   - DRAM 读取以 32/64/128 字节的突发（Burst Mode）进行。若矩阵维度不是 8/16 的倍数，将产生跨 Burst 访问与碎片读写。
2. **波次量化 (Wave Quantization / Tail Effect)**：
   - 设 GPU 拥有 108 个 SM，每个 SM 每次处理 1 个 Tile。
   - 当矩阵尺寸为 $1792$ 时，划分出 $7 \times 14 = 98$ 个 Tile，1 波次（Wave）即可全部填满并并发执行完毕。
   - 当尺寸仅增加 1 至 $1793$ 时，产生 $8 \times 15 = 120$ 个 Tile。此时 108 个 SM 执行完第一波后，剩余 12 个 Tile 需要开启第 2 波次，导致 96 个 SM 闲置空转，Wall-clock 耗时激增近一倍。

---

## 5. 经典案例剖析：FlashAttention 核心机制

### 5.1 传统注意力的访存瓶颈

标准自注意力：$S = Q K^T \in \mathbb{R}^{N \times N}, \; P = \text{Softmax}(S), \; O = P V$。
- 在传统实现中，需将 $N \times N$ 的巨大注意力分数矩阵 $S$ 和 $P$ 完整写回慢速 HBM，再读取回 SRAM 进行矩阵乘，**显存读写量高达 $\mathcal{O}(N^2)$**。

### 5.2 FlashAttention 的两大支柱

```
FlashAttention Tiling in SRAM:
Input Q (in SRAM Tile) ──┐
                         ├──> Compute Q_i @ K_j^T ──> Online Softmax Update (m, l) ──> Multiply V_j ──> Accumulate O_i in SRAM
Input K, V (loaded into) ┘
```

1. **分块计算 (Tiling)**：
   - 将 $Q$ 按行切块（$B_r$），$K, V$ 按列切块（$B_c$），分别加载至片上 SRAM 中执行矩阵乘，在 SRAM 内部完成局部聚合，**仅将最终输出 $O$ 写回 HBM，全局显存读写复杂度降至 $\mathcal{O}(N)$**。
2. **在线 Softmax (Online Softmax, Milakov & Gimelshein 2018)**：
   - 传统 Softmax 需全局所有元素参与求 Max 和归一化分母 $\sum e^{x_i}$。
   - 在线 Softmax 通过递推公式维护局部最大值 $m^{(j)}$ 与局部求和 $l^{(j)}$：
     $$m^{(j)} = \max(m^{(j-1)}, \tilde{m}^{(j)}), \quad l^{(j)} = e^{m^{(j-1)} - m^{(j)}} l^{(j-1)} + \tilde{l}^{(j)}$$
   - 遇到新分块时，利用伸缩因子 $e^{m^{(j-1)} - m^{(j)}}$ 动态校准历史累加和与输出 $O^{(j)}$，无需保留全局中间矩阵。
3. **反向传播激活值重计算**：
   - 前向传播不保存 $N \times N$ 注意力矩阵，反向传播时直接根据 SRAM 中的 $Q, K, V$ 分块即时重算 Softmax 权重，以极少量 FLOPs 换取海量显存节省与带宽极致加速。
