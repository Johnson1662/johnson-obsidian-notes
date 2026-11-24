# 第 2 章 · 面向 LLM 的系统基础

> 来源：《智能体 AI 漫游指南：从基础到系统》· 面向 LLM 的系统基础 · PDF 第 107–120 页

---

## 2.1 GPU 架构——从硅片到 LLM 训练

现代大型语言模型几乎完全依赖 GPU（图形处理器，Graphics Processing Unit）进行训练和服务。理解 GPU 架构对于在并行策略、内存管理、内核优化和基础设施规模等方面做出明智决策至关重要。本节针对 LLM 工作负载，系统地介绍 GPU 硬件相关知识。

## 2.1.1 为什么深度学习要用 GPU？

GPU 和 CPU 代表了根本不同的硬件设计哲学。理解这种差异能解释为何 LLM 训练在 GPU 上能快 100–1000 倍。

CPU 与 GPU——基本设计哲学
- CPU 针对延迟进行优化——它们以尽可能快的速度执行少量线程，配备大型缓存、分支预测器和乱序执行单元。现代 CPU 拥有 8–96 个核心。
- GPU 针对吞吐量进行优化——它们并行执行数千个线程，每个线程只做简单工作。现代 GPU 拥有数千个“核心”(执行单元)，它们被组织成流式多处理器(Streaming Multiprocessor, SM)。
深度学习工作负载以矩阵乘法（在 $O(n^{2})$ 数据上执行 $O(n^{3})$ 操作）为主，这是天然并行的。70B 模型的单次 transformer 前向传播每个 token 需要约 140 TFLOP 计算量——非常适合 GPU 的吞吐能力。
## 2.1.2 NVIDIA GPU 微架构代际演进

NVIDIA 已经发布了一系列 GPU 架构，每一代都为深度学习带来关键创新：

Table 2.1: 面向深度学习的 NVIDIA GPU 微架构时间线。

<table><tr><td>架构</td><td>年份</td><td>旗舰</td><td>深度学习关键创新</td></tr><tr><td>Pascal</td><td>2016</td><td>P100</td><td>首款 HBM GPU; FP16 支持; NVLink 1</td></tr><tr><td>Volta</td><td>2017</td><td>V100</td><td>Tensor Cores (第一代); 混合精度训练</td></tr><tr><td>Turing</td><td>2018</td><td>T4</td><td>INT8 推理; RT cores (非 ML 用途)</td></tr><tr><td>Ampere</td><td>2020</td><td>A100</td><td>BF16 Tensor Cores; TF32; 第 3 代 NVLink; MIG</td></tr><tr><td>Hopper</td><td>2022</td><td>H100</td><td>FP8 Tensor Cores; TMA; Transformer Engine; NVLink 4</td></tr><tr><td>Blackwell</td><td>2024</td><td>B200</td><td>第 2 代 Transformer Engine; NVLink 5 (1.8 TB/s); FP4</td></tr></table>

Table 2.2: 与 LLM 工作负载相关的 GPU 规格。所有带宽数字均为双向。

<table><tr><td>GPU</td><td>架构</td><td>HBM</td><td>BF16 TF</td><td>HBM 带宽</td><td>NVLink</td><td>LLM 角色</td></tr><tr><td>V100-32GB</td><td>Volta</td><td>32 GB</td><td>125 TF*</td><td>900 GB/s</td><td>300 GB/s</td><td>旧型号;小模型微调</td></tr><tr><td>A100-40GB</td><td>Ampere</td><td>40 GB</td><td>312 TF</td><td>1.5 TB/s</td><td>600 GB/s</td><td>经济型训练/推理</td></tr><tr><td>A100-80GB</td><td>Ampere</td><td>80 GB</td><td>312 TF</td><td>2.0 TB/s</td><td>600 GB/s</td><td>标准 RLHF(70B 模型用 8-64 卡)</td></tr><tr><td>H100 SXM</td><td>Hopper</td><td>80 GB</td><td>990 TF</td><td>3.35 TB/s</td><td>900 GB/s</td><td>训练快 3×</td></tr><tr><td>H200 SXM</td><td>Hopper</td><td>141 GB</td><td>990 TF</td><td>4.8 TB/s</td><td>900 GB/s</td><td>用更少 GPU 装下 70B 策略 + 参考模型</td></tr><tr><td>B200 SXM</td><td>Blackwell</td><td>192 GB</td><td>2250 TF</td><td>8.0 TB/s</td><td>1800 GB/s</td><td>新一代;比 H100 快 2×</td></tr><tr><td colspan="7">AMD 和 Google 替代方案:</td></tr><tr><td>MI300X</td><td>CDNA3</td><td>192 GB</td><td>1300 TF</td><td>5.3 TB/s</td><td>N/A</td><td>显存最大;ROCm</td></tr><tr><td>TPU v5e</td><td>Google</td><td>16 GB</td><td>197 TF</td><td>1.6 TB/s</td><td>ICI 1.6 TB/s</td><td>仅云端;JAX/XLA</td></tr></table>

## 2.1.3 LLM 训练与推理常用 GPU

## 如何选择 GPU？

<table><tr><td>训练 70B+ 模型:带 NVLink 的 H100/B200 节点(张量并行需要快速互联)。每个实例至少 8×H100。推理(延迟敏感):H100/H200 适合高带宽场景;MI300X 适合内存密集(Memory-Bound)场景(巨大的键值缓存(KV Cache))。微调 7B-13B 模型:A100-80GB 性价比高。用 LoRA 单卡即可。预算紧张:A100-40GB,甚至用 A10(24GB)在 7B 模型上跑 LoRA。</td></tr></table>

## 2.1.4 GPU 内部架构——流式多处理器（SM）

GPU 由一组流式多处理器（Streaming Multiprocessor，SM）阵列组成，每个 SM 都是独立的处理器，拥有自己的寄存器文件、共享内存和执行单元。理解 SM 是理解 GPU 性能的关键。

![](../images/f29f254f82a84dfd7ac89a271006f5092f8b0cd7b0910c601bedba401fb50a03.jpg)

*Figure 2.1: 左：A100 单个流式多处理器（SM）的内部结构——64 个 FP32 CUDA cores、4 个 Tensor Cores、4 个 warp 调度器、256 KB 寄存器文件以及 192 KB 共享内存/L1 缓存。右：完整 A100 芯片包含 108 个 SM，共享 40 MB L2 缓存和 80 GB HBM2e。左侧边栏的带宽标注显示了从寄存器到 HBM 的急剧下降。*

## SM 的关键组件

- CUDA Cores：用于 FP32/INT32 运算的标量 ALU。A100 上每个 SM 有 64 个。用于逐元素运算、归约和非矩阵运算。

- Tensor Cores：专用的矩阵乘加（matrix-multiply-accumulate，MMA）单元。每个单元每周期执行一次 4×4×4 融合乘加运算。A100 每个 SM 有 4 个，在支持的精度下提供相对CUDA cores 16× 的吞吐量。

- 寄存器文件：最快的存储（延迟 1 周期）。所有活动线程共享。溢出到 L1 会显著降速。

- 共享内存 / L1：由程序员显式管理的片上 SRAM。这是 FlashAttention 性能的关键（数据块完全装入共享内存）。

- Warp 调度器：每个 SM 有 4 个 warp 调度器（A100）。一个 warp = 32 个步调一致执行的线程（SIMT 模型）。调度器通过在 warp 之间切换来隐藏内存延迟。

## SIMT 执行模型

GPU 采用单指令多线程（Single Instruction, Multiple Threads，SIMT）执行模型。在一个 warp（32 个线程）内，所有线程执行相同指令但作用于不同数据。当线程出现分支（例如 if/else）时，两条路径都会被串行执行——称为 warp 分支（warp divergence）。这就是为什么 GPU 内核必须最小化分支的原因。对于 LLM 工作负载，主要运算（GEMM、attention、softmax）在线程间具有统一的控制流，非常适合 SIMT 执行。

## 2.1.5 各代际 GPU 芯片的扩展

NVIDIA GPU 架构的演进显示出在计算密度、片上内存和深度学习专用单元方面持续扩展：

Table 2.3: 各代 NVIDIA 架构在 SM 层面的扩展。

<table><tr><td>架构</td><td>SM 数</td><td>TCs/SM</td><td>SRAM/SM</td><td>L2</td><td>关键变化</td></tr><tr><td>Volta (V100)</td><td>80</td><td>8</td><td>128 KB</td><td>6 MB</td><td>引入 Tensor Cores</td></tr><tr><td>Ampere (A100)</td><td>108</td><td>4</td><td>192 KB</td><td>40 MB</td><td>BF16/TF32; 更大的 L2</td></tr><tr><td>Hopper (H100)</td><td>132</td><td>4</td><td>256 KB</td><td>50 MB</td><td>TMA; FP8; Thread Block Clusters</td></tr><tr><td>Blackwell (B200)</td><td>148</td><td>4</td><td>256 KB</td><td>128 MB</td><td>2× 裸片; FP4; TMEM; NVLink 5</td></tr></table>

## 2.1.6 GPU 内存层级与带宽

现代 GPU 训练和推理性能几乎完全取决于你如何管理数据在内存层级之间的搬运。理解内存层级不是可选项——它是后续章节讨论每一种优化技术的基础。

## GPU 内存层级——A100 80GB 参考数字

<table><tr><td>层级</td><td>容量</td><td>带宽</td><td>延迟</td><td>位置</td></tr><tr><td>寄存器</td><td>~256 KB/SM</td><td>>100 TB/s</td><td>1 周期</td><td>片上,每线程</td></tr><tr><td>SRAM (shared)</td><td>164 KB/SM</td><td>~19 TB/s</td><td>~20 周期</td><td>片上,每 SM</td></tr><tr><td>L2 缓存</td><td>共 40 MB</td><td>~5 TB/s</td><td>~200 周期</td><td>片上,共享</td></tr><tr><td>HBM2e (VRAM)</td><td>80 GB</td><td>2 TB/s</td><td>~200 ns</td><td>封装上(5 个堆栈)</td></tr><tr><td>CPU DRAM</td><td>512 GB+</td><td>~25 GB/s</td><td>~10 μs</td><td>主机(PCIe 4)</td></tr><tr><td>NVMe SSD</td><td>TB 级</td><td>7 GB/s</td><td>~100 μs</td><td>主机存储</td></tr></table>

## 为何各层级差距如此巨大

内存层级中每一级大约比上一级慢 10 ，大 100–1000 。A100 有 312 TFLOP/s 的 BF16tensor-core 吞吐，但 HBM 带宽只有 2 TB/s。这意味着从 HBM 每加载一字节，你可以在下一字节到达之前完成 $3 1 2 \times 1 0 ^ { 1 2 } / ( 2 \times 1 0 ^ { 1 2 } ) \approx 1 5 6$ 次浮点运算。如果你的内核每字节运算少于 156FLOPs，它就是内存密集（Memory-Bound）的——计算单元在空等数据。

寄存器。 每个 CUDA 线程都有自己的私有寄存器文件。寄存器是芯片上最快的存储——读写在一个时钟周期内完成且无需仲裁。A100 每个 SM 有 65,536 个 32 位寄存器。寄存器溢出到本地内存（L1/L2）是主要的性能隐患。

SRAM——共享内存 / L1。 A100 上每个 SM 拥有 192 KB 的 $\operatorname { L 1 } / ;$ 共享内存池（H100 为 256 KB），其中最多 164 KB 可配置为共享内存。共享内存由程序员（或较新版本 CUDA 中由编译器）显式管理。例如，FlashAttention 的整个设计都基于一个洞察：注意力分块计算可以装入 SRAM。

L2 缓存。 A100 上的 40 MB L2 由所有 108 个 SM 共享。它充当 SRAM 与 HBM 之间的中转区。对于具有良好空间局部性的工作负载（例如在一个 batch 内被反复访问的权重矩阵），L2 命中率可以大幅降低实际 HBM 流量。

HBM——高带宽显存。 高带宽显存（High Bandwidth Memory，HBM）是直接安装在 GPU 封装上的堆叠 DRAM，通过宽带中介层连接。A100 SXM 拥有 80 GB HBM2e，带宽 2 TB/s；H100SXM5 拥有 80 GB HBM3，带宽 3.35 $\mathrm { T B } / \mathrm { s } _ { \circ }$ 它是模型权重、KV cache、激活和优化器状态的主要工作内存。

通过 PCIe 访问 CPU DRAM。 GPU HBM 与 CPU DRAM 之间的数据传输需经过 PCIe 总线。PCIe Gen4 ×16 每方向提供约 32 GB/s（双向 64 GB/s）；Gen5 翻倍。这相对于 HBM（每方向）是约 60× 的带宽下降。CPU 卸载（ZeRO-Infinity、DeepSpeed）利用这条链路，但必须谨慎使用以免成为瓶颈。

NVMe。 NVMe SSD（例如 Samsung 990 Pro）顺序读取可达约 $7 ~ \mathrm { G B / s } _ { \circ }$ ZeRO-Infinity 可以将优化器状态卸载到 NVMe，但只有在计算与 $\mathrm { I } / \mathrm { O }$ 比率非常高（大 batch 尺寸、训练步骤较慢）时才可行。

## 2.1.7 算术强度与 Roofline 模型

<table><tr><td>算术强度(Arithmetic Intensity)</td></tr><tr><td> $I = \frac{\text{FLOPs}}{\text{从 HBM 访问的字节数}} \quad (\text{FLOPs / Byte})$ </td></tr><tr><td>当  $I < I_{\text{ridge}}$  时内核是内存密集(Memory-Bound)的,当  $I > I_{\text{ridge}}$  时则是计算密集(Compute-Bound)的,其中</td></tr><tr><td> $I_{\text{ridge}} = \frac{\text{峰值 FLOP/s}}{\text{峰值带宽}} = \frac{312 \times 10^{12}}{2 \times 10^{12}} = 156 \text{ FLOP/Byte (A100 BF16)}$ </td></tr></table>

![](../images/9386d435db38ef2fe95b0e6370f8974233eb221964860b2217abba4fa25ea34a.jpg)  
*Figure 2.2: A100 BF16 的 Roofline 模型（Roofline Model）。Attention 深陷于内存密集区间；大型 GEMM（FFN 层）则是计算密集的。*

## Attention 的算术强度

对于序列长度 $n = 4 0 9 6 ,$ 、头维度 $d = 1 2 8$ 的单个注意力头：$\mathbf { F L O P s } \colon Q K ^ { T }$ 耗费 $2 n ^ { 2 } d ,$ ，softmax 为 $O ( n ^ { 2 } )$ ，Attn×V 耗费 $2 n ^ { 2 } d _ { \circ }$ 。总计： $\approx 4 n ^ { 2 } d = 4 \times 4 0 9 6 ^ { 2 } \times 1 2 8 \approx$ 8.6 GFLOP。

张量核心（Tensor Core）是 Volta 架构（2017）引入的专用矩阵乘加（MMA）单元。每个 Tensor Core 在单个时钟周期内执行一次  $4 \times 4 \times 4$  矩阵乘法：

[ D = A \times B + C \quad (4 \times 4 \text{ matrices}) ] 

A100 在 108 个 SM 中共有 432 个 Tensor Cores（每个 SM 4 个，每个子分区 1 个）。在 BF16 精度下提供 312 TFLOP/s 吞吐——约是 FP32 CUDA cores 吞吐的  $16 \times$ 。

- 支持的精度：FP64、TF32、BF16、FP16、INT8、FP8（H100+）。
- 累加：内部始终使用 FP32，即使输入为 BF16。这能防止点积过程中的灾难性抵消。
内存流量（标准实现，非Flash版）：
- 读取 $Q, K: 2 \times n \times d \times 2 = 2$ MB
- 写入注意力分数 $S = QK^T: n^2 \times 2 = 33.5$ MB
- 为 softmax 读取 $S: n^2 \times 2 = 33.5$ MB
- 写入 softmax 输出 $P: n^2 \times 2 = 33.5$ MB
- 为最终矩阵乘读取 $P$ 和 $V: n^2 \times 2 + n \times d \times 2 = 34.5$ MB
- 写入输出 $O: n \times d \times 2 = 1$ MB

总内存：$\approx 138$ MB（由对 $n^2$ 注意力矩阵的4次遍历主导）。
算术强度：
$I = \frac{8.6 \times 10^9}{138 \times 10^6} \approx 62$ FLOP/Byte

这是A100脊点的 $62 / 156 = 40\%$ ——明确属于内存密集。GPU有 $60\%$ 的时间在等内存空转。
FlashAttention解决方案：通过永远不物化 $n \times n$ 矩阵（在SRAM中对 $Q, K, V$ 分块），FlashAttention把HBM流量降至仅读取 $Q, K, V$ 并写入 $O: 4 \times n \times d \times 2 = 4$ MB。每个加载的字节被复用于 $O(n)$ 次计算（每个query都要attend所有key），因此：
$I = \frac{4n^2d}{4 \cdot n \cdot d \cdot 2} = \frac{n}{2} = \frac{4096}{2} = 2048$ FLOP/Byte

这比脊点(156)高出 $13\times$ ——深度计算密集。GPU跑满峰值312TFLOPS,只需要312T/2048 $\approx 152$ GB/s带宽（HBM容量的 $7.6\%$）。内存不再是瓶颈。
## 2.1.8 Attention 是内存密集的；FFN 是计算密集的

Transformer 中的两种区间
一个 transformer 块有两个主要组件，它们的算术强度截然不同：
- Attention：作用于  $n \times d$  张量。 $QK^{T}$  乘积是  $O(n^{2}d)$  FLOPs，但注意力分数需要  $O(n^{2})$  内存。在长序列下，内存流量占主导地位——attention 是内存密集（Memory-Bound）的。
- FFN (MLP)：两个大型线性层，权重矩阵形状为  $[d_{model}, 4d_{model}]$ 。这些是高算术强度的大型 GEMM——FFN 是计算密集（Compute-Bound）的。
这就是为什么 FlashAttention（内存优化）对 attention 有效但对 FFN 无效，而量化（缩小权重体积）对 FFN 的帮助比对 attention 更大。
## 2.1.9 Tensor Cores

## 什么是 Tensor Cores？

- 要求：当矩阵维度是 8（BF16）或 16（FP8）的倍数时，Tensor Cores 效率最高。为此进行填充通常是值得的。

- WGMMA（H100）：Hopper 引入了 warpgroup 级别的 MMA 指令，作用于更大的分块（64×256×16），并可与 TMA（Tensor Memory Accelerator）数据搬运形成流水线。

## Tensor Core 陷阱

只有当你的内核是计算密集（Compute-Bound）时，Tensor Cores 才有用。如果你跑的是小 batch（batch size 1 的推理），GEMM 分块很小，Tensor Core 利用率很低，你又回到内存密集区间。这就是为什么推理引擎要激进地对请求进行 batch。

## 2.1.10 通信架构——NVLink、InfiniBand 与 PCIe

分布式 LLM 训练和推理需要在 GPU、节点和存储之间搬运海量数据。通信结构往往是大规模训练的瓶颈。

## PCIe——主机与设备的链路。

PCIe 各代

<table><tr><td>代际</td><td>x16 带宽(每方向)</td><td>双向</td><td>备注</td></tr><tr><td>PCIe Gen3</td><td>16 GB/s</td><td>32 GB/s</td><td>常见于较旧服务器</td></tr><tr><td>PCIe Gen4</td><td>32 GB/s</td><td>64 GB/s</td><td>A100 PCIe、当前主流服务器</td></tr><tr><td>PCIe Gen5</td><td>64 GB/s</td><td>128 GB/s</td><td>H100 PCIe,正在普及</td></tr></table>

PCIe 用于：

- CPU ↔ GPU 数据传输（模型加载、CPU 卸载）

- 当 NVLink 不可用时的跨节点 GPU 通信（罕见，且非常慢）

- NVMe 存储访问（经由 CPU）

## PCIe 不应用于 GPU 间通信

如果有 NVLink 可用，绝不要让 GPU-GPU 通信走 PCIe。PCIe 带宽（32 GB/s）比 NVLink 4（900 GB/s）低 28×。在没有 NVLink 的多 GPU 服务器中（例如消费级 GPU），GPU 间带宽被限制在 PCIe 水平，使得张量并行极其缓慢。

NVLink——节点内高速互联。

<table><tr><td>代际</td><td>链路数</td><td>总带宽</td><td>GPU</td></tr><tr><td>NVLink 2</td><td>6</td><td>300 GB/s</td><td>V100</td></tr><tr><td>NVLink 3</td><td>12</td><td>600 GB/s</td><td>A100</td></tr><tr><td>NVLink 4</td><td>18</td><td>900 GB/s</td><td>H100</td></tr><tr><td>NVLink 5</td><td>18</td><td>1800 GB/s</td><td>B200 (Blackwell)</td></tr></table>

NVLink 是同一节点内 GPU 之间的点对点互联。每条链路都是双向的。H100 SXM5 拥有 18 条NVLink 4 链路，每条提供 50 GB/s 双向带宽，总计 900 GB/s。

NVSwitch。 在 DGX H100 系统中，所有 8 块 GPU 都通过 NVSwitch 互联——这是一种提供全二分带宽（full bisection bandwidth）的专用交换芯片。这意味着任意 GPU 都能以完整 NVLink 速度同时与任何其他 GPU 通信，而不仅仅是环上邻居。

## 环形拓扑 vs. 全二分

在环形拓扑（8 GPU）中，AllReduce 需要数据绕环传输。每条链路必须承载总数据的 <sup>2(N−1)</sup>，因此算法带宽为 $\begin{array} { r } { B _ { \mathrm { l i n k } } \times \frac { N } { 2 ( N - 1 ) } } \end{array}$ （N = 8 时约为 $0 . 5 7 \times B _ { \mathrm { l i n k } } )$ ）。借助 NVSwitch 的全二分带宽，AllReduce 可以使用基于树的算法同时使用所有链路，达到接近峰值的带宽。在 DGX H100 实际测试中：ring 达到约 700 GB/s 总线带宽，NVSwitch 达到约 900 GB/s。

InfiniBand——节点间通信。 对于节点（服务器）之间的通信，InfiniBand 提供高带宽、低延迟的网络，并支持直接 GPU 内存访问。

## InfiniBand NDR

- NDR 400Gb/s = 每端口 50 GB/s（单向）

- HDR 200Gb/s = 每端口 25 GB/s（上一代）

- RDMA：远程直接内存访问（Remote Direct Memory Access）——GPU 可读写远端 GPU内存而无需远端 CPU 参与

- GPUDirect RDMA：数据直接经由 HBM → NIC → 网络 → NIC → HBM，完全绕过CPU 和系统 DRAM

- 延迟：小消息约 1–2 µs（对比 TCP/IP 的约 100 µs）

胖树拓扑（Fat-Tree Topology）。 大型 GPU 集群使用胖树（Fat-Tree Topology）网络拓扑。使用 k 端口交换机的 3 层胖树可支持 k<sup>3</sup>/4 个节点并保持全二分带宽。对于 k = 64 端口的 400Gb/sNDR 交换机： $6 4 ^ { 3 } / 4 = 6 5 { , } 5 3 6$ 个节点。

轨道优化拓扑（Rail-Optimized Topology）。 实践中，集群使用轨道优化拓扑（Rail-OptimizedTopology），节点中的每块 GPU 连接到不同的机架顶端（top-of-rack）交换机。这样可以保证 AllReduce操作（涉及所有 GPU）同时使用所有网络链路，从而最大化带宽。

分布式 LLM 训练中的通信模式。 分布式训练依赖集体通信原语。原语的选择决定了带宽需求和扩展行为。

<table><tr><td>张量并行(TP):每层都需要 all-reduce——仅在节点内通过 NVLink 使用。TP=8 是 H100 DGX 节点的标准。流水线并行(PP):阶段之间的点对点通信——可以跨节点,但会引入流水线气泡开销。当模型大到单靠 TP 装不下时使用。数据并行(DP):梯度的 AllReduce——可以通过 IB 跨节点。在快速 IB 下扩展性良好。FSDP/ZeRO:AllGather + ReduceScatter——类似于 DP 但会分片优化器状态。对于大模型优于 DP。</td></tr></table>

<table><tr><td>原语</td><td>使用场景</td><td>通信量</td></tr><tr><td>AllReduce</td><td>梯度同步(DDP、FSDP)</td><td>2(N-1)/N×参数大小</td></tr><tr><td>AllGather</td><td>收集分片权重(FSDP)</td><td>(N-1)/N×参数大小</td></tr><tr><td>ReduceScatter</td><td>分散梯度(FSDP)</td><td>(N-1)/N×参数大小</td></tr><tr><td>AllGather</td><td>张量并行激活</td><td>激活大小</td></tr><tr><td>Point-to-Point</td><td>流水线并行(send/recv)</td><td>micro-batch 激活</td></tr><tr><td>Broadcast</td><td>权重同步(新 worker)</td><td>完整模型大小</td></tr></table>

网络拓扑示意图。 下图展示了典型的双节点 GPU 集群拓扑，同时显示节点内（NVLink）和节点间（InfiniBand）通信路径。

![](../images/fd2e3d3ca23b71e12e8db6d04088a746538163bb3c9da64e9c80697c4aebd1b0.jpg)  
*Figure 2.3: 两节点 8-GPU 拓扑。节点内：通过 NVSwitch 的 NVLink 4（总计 900 GB/s）。节点间：通过机架顶端交换机的 InfiniBand NDR 400Gb/s。每个节点配有 8 块 IB 网卡（每块 GPU 一块），用于轨道优化AllReduce。*

## 根据带宽选择并行策略

## 2.2 vLLM——分页注意力与高吞吐推理

vLLM [195] 引入了分页注意力（PagedAttention），它借鉴操作系统用于管理 RAM 的分页抽象，并将其应用于 GPU 的键值缓存（KV Cache）。在 LLM 推理过程中，KV cache——存储了所有先前token 的 key 和 value 张量——是最大的内存消耗者。高效管理 KV cache 是高吞吐推理的核心挑战。

## 2.2.1 KV cache 碎片化问题

## KV cache 显存计算公式

对于具有 L 层、H 个头、头维度 d、序列长度为 n 个 token 的模型：

$$
\mathrm{KVcache} \mathrm{大小} = 2 \times L \times H \times d \times n \times \mathrm{每元素字节数}
$$

对于 Llama-3 70B（BF16）：L = 80、H = 8（GQA）、d = 128：

$$
= 2 \times 8 0 \times 8 \times 1 2 8 \times n \times 2 = 3 2 7, 6 8 0 \times n \mathrm{bytes}
$$

当 n = 4096 token 时：每条序列约 1.3 GB。

## 内部碎片与外部碎片

传统推理系统会为每条序列的 KV cache 预先分配一块连续内存，大小为可能的最大序列长度。这会造成两类浪费：

内部碎片：一条只生成 500 token 的序列仍然占据为 4096 token 预留的块。未使用的 3596 个token 槽位被浪费。

外部碎片：许多序列完成后，剩余空闲内存由许多小的不连续空隙组成。即使总空闲内存足够，新的长序列也无法被分配，因为没有任何一块连续区域足够大。

实际中，朴素分配下的 GPU 显存利用率通常只有 20–40%。

## 2.2.2 分页注意力——为 KV cache 引入虚拟内存

分页注意力（PagedAttention，Kwon 等，2023）借鉴了操作系统的分页抽象。它不再为每条序列分配一块连续内存，而是把 KV cache 切分成固定大小的页（page）（即块），并通过一个间接表——类似 CPU 页表——将每条序列的逻辑 token 位置翻译为分散的物理 GPU 内存地址。

PagedAttention 核心概念

- 块大小：通常每块 16 个 token（可调）。每个块存储 $1 6 \times 2 \times L \times H \times d$ 个元素。

- 块表（Block table）：每条序列一份的映射，把逻辑块索引映射到 GPU 内存池中的物理块索引。

- 物理块池：预先分配好的固定大小块池。分配为 O(1)——只需从空闲列表弹出。

- 注意力内核：做了修改，在注意力计算时使用块表从不连续的物理位置 gather KV 块。

## 块表示例

假设块大小 = 4 个 token，我们有两条序列：

- 序列 A（7 个 token）：逻辑块 [0,1] → 物理块 [3, 7]

- 序列 B（5 个 token）：逻辑块 [0,1] → 物理块 [1, 5]

物理块 3 持有序列 A 的 token 0–3。物理块 7 持有序列 A 的 token 4–6（部分填充）。序列 A 的注意力内核按顺序从物理块 3 和 7 读取，并以块表作为间接层。

## 2.2.3 PagedAttention 的收益

近零浪费。 内部碎片至多为每条序列一个部分填充块（最后一个块）。当块大小为 16 时，最差浪费为每条序列 15 个 token——可忽略不计。外部碎片被消除，因为块是固定大小、可互换的。

动态分配。 块在序列增长时按需分配。无需预先知道最终序列长度。这对生成任务至关重要，因为输出长度未知。

前缀共享（写时复制）。 多条共享同一前缀（例如同一系统提示）的序列可以共享相同的物理块来表示该前缀。块表只需让多条序列指向相同的物理块。当某条序列需要写入共享块（与前缀分叉）时，会触发写时复制（Copy-on-Write）。

## 前缀共享带来的节约

在一个拥有 1000-token 系统提示、服务 128 位并发用户的聊天机器人中：

- 无前缀共享：仅系统提示 KV cache 就需 $1 2 8 \times 1 0 0 0 \times 3 2 7 , 6 8 0 / 1 0 ^ { 9 } \approx 4 2 ~ \mathrm { G B }$

- 有前缀共享： $1 \times 1 0 0 0 \times 3 2 7 { \mathrm { , 6 8 0 / 1 0 ^ { 9 } } } \approx 0 . 3 3 { \mathrm { ~ G B } }$

- 节约：共享前缀部分约 128×

通过 swap 抢占。 当 GPU 显存耗尽时，vLLM 可以通过把某条序列的 KV 块换出到 CPU DRAM（或者直接丢弃，之后重新计算）来抢占该序列。这之所以可行，是因为块是自包含且非连续的——若是连续分配则需要复制整个缓冲区。

## 2.2.4 连续批处理

传统的批处理（“静态批处理”）会等到一批中所有序列都完成后才开始新批次。如果一条序列生成500 个 token、另一条生成 10 个，那么 GPU 在短序列上有 490 步是空闲的。这极其浪费。

连续批处理（Continuous Batching）

连续批处理（Continuous Batching，也叫迭代级调度）一次处理一个解码步。每一步之后：

1. 检查哪些序列已完成（生成了 EOS token）

2. 把已完成的序列从批中移除，释放其 KV 块

3. 加入新的等待序列以填补空出的槽位

4. 在更新后的批上运行下一解码步

批次组成每一步都在变化——序列动态地加入和离开。这让 GPU 利用率接近 100%，并大幅提升吞吐（相对静态批处理提升 1.5–3×）。PagedAttention 在这里至关重要：在批次中动态添加/移除序列需要动态分配/释放 KV 块，只有在分页内存下才高效。

## 2.2.5 vLLM 中的投机解码

投机解码（Speculative Decoding）使用一个小型草稿模型（draft model，例如 1B 参数）快速提出k 个候选 token，再由大型目标模型（target model）在一次前向传播中验证。从第一个被拒绝处之前的所有 token 都会被接受（预期接受数：每次验证 3–5 个 token）。这为延迟敏感的单序列生成带来 2–3× 提速，且无质量损失。

vLLM 将投机解码与 PagedAttention 集成：

- 草稿 token 被分配投机性 KV 块

- 拒绝时，投机块被释放（在分页分配下成本极低）

- 接受时，投机块被提升为主序列的一部分

- 块表更新为 O(k)——只需更新少量表项

## 2.2.6 具体显存节约——大规模 70B 模型

显存预算——70B BF16 推理

设定：Llama-3 70B，BF16，单个 A100 80GB 节点（8 GPU，张量并行）。
模型权重： $70 \times 10^{9} \times 2$ 字节 = 140 GB ÷ 8 GPU = 17.5 GB/GPU。
KV cache 可用部分：80 - 17.5 - 3（开销）= 59.5 GB/GPU。
每块 GPU 每 token 的 KV cache (TP=8 时每块 GPU 持有 1/8 的头):  $2 \times 80 \times 1 \times 128 \times 2 = 40,960$ 字节 ≈ 40 KB/token。
KV cache 最大 token 数:  $59.5 \times 10^{9}/40,960 \approx 145$ 万 token。
当 128 条并发序列每条 4096 个 token 时:  $128 \times 4096 = 524,288$ 个 token——完全在预算之内。
若不使用 PagedAttention（为每条序列预分配最大长度 4096）：同样的计算，但碎片化平均浪费约  $50\% \rightarrow$  只能容纳 64 条序列。

块大小的权衡
更大的块大小可减少块表开销，并提高内存访问局部性（更少的分散读取）。更小的块大小可减少内部碎片，并支持更细粒度的前缀共享。vLLM 默认每块 16 个 token，是一个不错的平衡。对于非常长的序列（10 万 + token），更大的块（32-64）可能更合适。
## 2.2.7 vLLM：端到端系统

vLLM 将 PagedAttention 封装在一整套服务栈中：连续批处理（Continuous Batching）、前缀缓存（Prefix Caching）、投机解码（Speculative Decoding）以及张量并行的模型分片协同工作，最大化每美元 GPU 的吞吐。

## 2.2.8 架构总览

![](../images/196f4a52f537402de033115adceb4c6d555a40801fd77aaad6924b3d06b3eab9.jpg)  
*Figure 2.4: vLLM 架构：请求自上而下流动。Scheduler 管理准入与抢占，Block Manager 负责虚拟到物理KV cache 映射（像操作系统页表一样），Model Executor 在 GPU HBM 中从预分配的块池读取数据并执行批量推理。*

## 2.2.9 核心组件

- API Server：接收 OpenAI 兼容的请求（completions、chat）。对输入进行 tokenize，并创建“序列组（sequence groups）”（用于 beam search 或多样本）。

- Scheduler：vLLM 的大脑。维护三个队列：

– waiting：尚未开始的新请求（等待 prefill）

– running：正在生成 token（decode 阶段）

– swapped：被抢占、KV cache 已卸载到 CPU 的请求

每次迭代，调度器根据可用 GPU 内存块决定运行哪些请求。

- Block Manager：为 KV cache 实现虚拟内存抽象。将逻辑块（按序列）映射到物理块（GPU内存池中）。负责处理：

– 分配（生成新 token → 需要新块）

– 写时复制（Copy-on-Write）（用于 beam search：多 beam 共享前缀块，仅在分叉时复制）

– Swap（抢占/恢复时在 GPU ↔ CPU 之间迁移）

– 前缀缓存（Prefix Caching）（当 prompt 共享相同前缀时复用已缓存块）

- Model Executor：执行实际的 LLM 前向传播。管理跨 GPU 的张量并行，调度从分页 KVcache 块读取的注意力内核。

- KV Cache Pool：预分配的 GPU 内存，划分为固定大小的块（默认每块 16 token × num\_heads× head\_dim × 2 字节）。运行时无动态分配 → 零碎片。

## 2.2.10 请求生命周期（端到端流程）

1. 到达：客户端发送 prompt。API server 将其 tokenize，创建一个 SequenceGroup，放入 waiting队列。

2. 调度：每一步，调度器执行：

(a) 检查是否有 swapped 序列可以恢复（有足够空闲块）。

(b) 检查是否有 waiting 序列可以开始 prefill（有足够块容纳完整 prompt）。

(c) 在 running 序列之间预算剩余块（若当前块已满，每条序列每步需要 1 个新块）。

(d) 如果超出预算：抢占优先级最低的运行中序列（把 KV 换出到 CPU 或之后重新计算）。

3. Prefill（请求的第一次迭代）：整个 prompt 在一次前向传播中被处理。所有 prompt token 的KV cache 被计算并存入已分配的块。这是计算密集（Compute-Bound）的（大批 token）。

4. Decode（后续迭代）：每条序列每步生成一个新 token。所有运行中的序列被一起 batch（连续批处理）。这是内存密集（Memory-Bound）的（读取完整 KV cache，生成 1 个 token）。

5. 块分配：每个 decode 步后，如果某条序列的最后一个块已满，Block Manager 分配一个新的物理块并将其映射到下一逻辑块。

6. 完成：当一条序列遇到 EOS 或达到最大长度时，它会从 running 中移除。其物理块立即被释放 → 可供其他序列使用。响应被流式回传给客户端。

## 2.2.11 前缀缓存（自动 Prompt 缓存）

当多个请求共享相同前缀（系统 prompt、few-shot 示例）时：

1. 对每个逻辑块的 token 内容计算哈希。

2. 新请求到达时，检查是否有前缀块已在缓存中。

3. 命中时：跳过这些 token 的 prefill，直接复用物理 KV 块。首 token 延迟（Time-to-first-token）大幅下降。

4. 驱逐：LRU 策略。缓存块仅在内存压力需要时才被释放。

影响：对于具有长系统提示（2K+ token、所有用户共享）的聊天应用，前缀缓存可降低 TTFT60–80%。

## 2.2.12 vLLM 中的引导（受约束）解码

vLLM 通过可插拔的后端原生支持受约束解码（参见 Section 1.12.11），可以在服务期间以极小的性能开销保证结构化输出。

支持的约束类型。 OpenAI 兼容 API 通过 guided\_\* 参数或 response\_format 字段接受约束：

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8000/v1")

# --- JSON Schema 约束 ---
response = client.chat.completions.create(
    model="meta-llama/Llama-3-70B-Instruct",
    messages=[{"role": "user",
    "content": "Extract: name, age, city from: " 'John is 30 and lives in NYC'"}],
    extra_body={
    "guided_json": {
    "type": "object",
    "properties": {
    "name": {"type": "string"},
    "age": {"type": "integer"},
    "city": {"type": "string"}
    },
    "required": ["name", "age", "city"]
    }
    }
)

# 输出保证是符合该 schema 的合法 JSON

# --- 正则表达式约束 ---
response = client.completions.create(
    model="meta-llama/Llama-3-70B-Instruct",
    prompt="Generate an IPv4 address: ",
    extra_body={
    "guided_regex": r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    }
)

# --- 选项约束 ---
response = client.completions.create(
    model="meta-llama/Llama-3-70B-Instruct",
    prompt="Sentiment: ",
    extra_body={"guided_choice": ["positive", "negative", "neutral"]}
```

后端架构。 vLLM 将掩码计算委托给后端引擎：

- XGrammar（自 v0.7 起为默认）：基于下推自动机的引擎，支持 JSON schema、正则和任意EBNF 语法。得益于高效的 C++ 核心，对复杂 schema 而言最快。

- Outlines [378]：基于 FSM；支持 JSON 和正则。在 XGrammar 不可用时作为回退方案。

掩码在模型前向传播产生 logits 之后、采样之前施加——实际中每步只增加不到 1 ms，因为 FSM/PDA 状态转移和预先计算的索引查找均为 O(1)。

性能影响。 由于约束仅对 logits 进行掩码（不重新计算 attention 或 FFN），吞吐损失可忽略（基准测试中 <2%）。主要成本来自把 schema 编译成 FSM/PDA 索引，耗时 0.5–5 秒，取决于 schema复杂度。vLLM 会跨请求缓存已编译的 schema，因此每个独特 schema 只需支付一次成本。

<table><tr><td>结构化输出 ≠ 正确输出</td></tr><tr><td>受约束解码保证输出语法上有效(能解析为 JSON、符合 schema 的类型)。但它不保证语义上的正确性——模型仍可能产生能成功解析但事实错误的幻觉值。务必在下游验证业务逻辑。</td></tr></table>

Table 2.4: vLLM 与其他方案的性能对比（70B 模型，A100 × 4，TP=4）。

<table><tr><td>指标</td><td>vLLM</td><td>HF Generate</td><td>原因</td></tr><tr><td>吞吐 (tok/s)</td><td>2,500–4,000</td><td>300–600</td><td>连续批处理 + PagedAttention</td></tr><tr><td>显存利用率</td><td>90–95%</td><td>50–60%</td><td>零碎片,动态块分配</td></tr><tr><td>最大并发序列数</td><td>200–500</td><td>16–32</td><td>分页 KV 消除每序列预留</td></tr><tr><td>首 token 延迟</td><td>100–300ms</td><td>500–2000ms</td><td>对重复系统提示启用前缀缓存</td></tr></table>

Dynamo：数据中心级推理编排。 Dynamo [270] 是 NVIDIA 的开源编排层，位于各推理引擎（SGLang、TensorRT-LLM、vLLM）之上，把它们组织成协同的多节点服务系统。关键能力包括：分离式服务（把 prefill 与 decode 阶段拆到专用节点池）、基于 KV 缓存局部性的智能请求路由、多级KV 缓存（GPU → CPU → SSD），以及自动扩缩容。它填补了单 GPU 推理优化（由 vLLM 覆盖）与数据中心级生产服务之间的空白。
