# CS336 Lecture 6: GPU 编程、Triton 算子开发与 FlashAttention

在大模型训练与推理中，原生 PyTorch 算子调度会产生大量孤立的小 Kernel，导致**频繁往返读写 HBM 显存**。编写自定义 GPU Kernel（使用 CUDA 或 OpenAI Triton）的核心目标是**算子融合（Operator Fusion）**与**分块缓存（Tiling）**。

---

## 1. GPU 性能分析基准 (Benchmarking & Profiling)

在优化 Kernel 前，必须准确测量耗时与瓶颈所在：

### 1.1 精准计时：CUDA Events
GPU 是异步执行的，不能使用 Python 原生 `time.time()` 测量 Kernel 耗时。必须使用 CUDA 事件进行同步：

```python
import torch

def benchmark_cuda(fn, *args, warmup=10, iters=100) -> float:
    # 1. 预热 (Warm-up)：触发 GPU 初始化与 JIT 编译
    for _ in range(warmup):
        fn(*args)
    torch.cuda.synchronize()

    # 2. 正式测量
    start_event = torch.cuda.Event(enable_timing=True)
    end_event = torch.cuda.Event(enable_timing=True)

    start_event.record()
    for _ in range(iters):
        fn(*args)
    end_event.record()
    torch.cuda.synchronize()

    return start_event.elapsed_time(end_event) / iters  # 毫秒 (ms)
```

---

## 2. OpenAI Triton 编程模型

传统 CUDA 需要开发者直接在**单线程级别**管理 Warp 分歧、共享内存对齐与 Bank 冲突。**Triton** 采用了**块级别（Block-level）**的高级抽象：开发者直接对固定大小的 Block 数组（如 `BLOCK_SIZE = 1024`）编写算法，由 Triton 编译器自动完成向量化指令发射与寄存器分配。

```
CUDA 抽象 (Thread-level):
  - 开发者编写单线程操作: Thread ID -> 内存地址
  - 手动管理: __syncthreads(), __shared__ 数组, Warp Shuffle

Triton 抽象 (Block-level):
  - 开发者编写块操作: tl.load(ptr + offsets, mask), tl.dot(a, b)
  - 编译器自动处理: SIMD 向量化、SRAM 缓存调度、Warp 线程同步
```

### 2.1 Triton 经典算子实现 (逐元素：Fused GELU)

```python
import torch
import triton
import triton.language as tl

@triton.jit
def gelu_kernel(x_ptr, y_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    # 获取当前 Program 块的 ID
    pid = tl.program_id(axis=0)
    # 计算当前块负责处理的全局元素索引偏移
    block_start = pid * BLOCK_SIZE
    offsets = block_start + tl.arange(0, BLOCK_SIZE)
    # 边界掩码 (防止越界访存)
    mask = offsets < n_elements

    # 1. 从 HBM 加载数据到 SRAM/寄存器
    x = tl.load(x_ptr + offsets, mask=mask)
    
    # 2. 在片上完成 GELU 计算 (近似形式: 0.5 * x * (1 + tanh(sqrt(2/pi)*(x + 0.044715*x^3))))
    sqrt_2_over_pi = 0.7978845608028654
    inner = sqrt_2_over_pi * (x + 0.044715 * x * x * x)
    # 使用 tl.math 算子，避免中间结果写回 HBM
    y = 0.5 * x * (1.0 + tl.math.tanh(inner))

    # 3. 将最终结果一次性写回 HBM
    tl.store(y_ptr + offsets, y, mask=mask)

def triton_gelu(x: torch.Tensor) -> torch.Tensor:
    y = torch.empty_like(x)
    n_elements = x.numel()
    BLOCK_SIZE = 1024
    grid = (triton.cdiv(n_elements, BLOCK_SIZE),)
    gelu_kernel[grid](x, y, n_elements, BLOCK_SIZE=BLOCK_SIZE)
    return y
```

### 2.2 融合行归约算子 (Fused Softmax with Online Max)
对二维矩阵 $X \in \mathbb{R}^{M \times N}$ 按行求 Softmax：
$$
S_{i, j} = \frac{\exp(X_{i, j} - m_i)}{\sum_{k=1}^N \exp(X_{i, k} - m_i)}, \quad m_i = \max_k X_{i, k}
$$

```python
@triton.jit
def softmax_kernel(x_ptr, y_ptr, stride_xm, stride_ym, N, BLOCK_SIZE: tl.constexpr):
    row_idx = tl.program_id(0)
    row_offsets = tl.arange(0, BLOCK_SIZE)
    mask = row_offsets < N

    # 加载一整行到 SRAM
    x_ptrs = x_ptr + row_idx * stride_xm + row_offsets
    row = tl.load(x_ptrs, mask=mask, other=-float('inf'))

    # 片上求最大值 (防止指数溢出)
    row_max = tl.max(row, axis=0)
    # 片上求 exp 与累加和
    numerator = tl.exp(row - row_max)
    denominator = tl.sum(numerator, axis=0)
    out = numerator / denominator

    # 写回一整行
    y_ptrs = y_ptr + row_idx * stride_ym + row_offsets
    tl.store(y_ptrs, out, mask=mask)
```

---

## 3. FlashAttention: 突破注意力显存墙

### 3.1 传统自注意力的 HBM 读写瓶颈
标准注意力公式 $O = \text{Softmax}\left(\frac{Q K^\top}{\sqrt{d}}\right) V$ 的朴素实现：
1. 从 HBM 读取 $Q, K \in \mathbb{R}^{S \times d}$，计算 $S = Q K^\top \in \mathbb{R}^{S \times S}$ ➔ **写入 HBM** ($O(S^2)$ 显存与带宽开销)；
2. 从 HBM 读取 $S$，计算 $P = \text{Softmax}(S)$ ➔ **写入 HBM** ($O(S^2)$ 读写)；
3. 从 HBM 读取 $P$ 和 $V$，计算 $O = P V \in \mathbb{R}^{S \times d}$ ➔ **写入 HBM**。

> **核心矛盾**：中间注意力矩阵 $P \in \mathbb{R}^{S \times S}$ 极其庞大，整个过程被 HBM 读写带宽死死卡住。

### 3.2 FlashAttention-1/2 的三大核心创新

```
   HBM (全局显存)                 SRAM (片上高速缓存)
   [ Q, K, V 矩阵 ]                
         |                                
   (分块 Tiling 流式加载)           +-----------------------+
         v                         | 在 SRAM 内部完成:      |
   加载 Block_Q [Br x d]  ----->  | 1. Q_i * K_j^T        |
   加载 Block_K [Bc x d]  ----->  | 2. 在线更新 m, l      |
   加载 Block_V [Bc x d]  ----->  | 3. 局部输出 O_i 累加   |
                                   +-----------+-----------+
                                               |
                                    (写回最终输出, 无中间矩阵)
                                               v
                                     HBM: 输出 O [S x d]
```

#### 1. 分块计算 (Tiling)
将 $Q, K, V$ 划分为适合放入 SRAM 的小分块（如 $B_r = 64, B_c = 64$）。外层循环遍历 $K, V$ 分块，内层遍历 $Q$ 分块，所有矩阵乘法与 Softmax 均在 SRAM 内部完成。

#### 2. 在线 Softmax 动态更新 (Online Softmax)
Softmax 分母需要对全序列求和，如何在不看见全部 Key 的情况下计算局部结果？
FlashAttention 维护局部最大值 $m^{(j)}$ 与归一化分母 $\ell^{(j)}$：
$$
\begin{aligned}
m_{\text{new}} &= \max(m_{\text{old}}, \; m_{\text{block}}) \\
\ell_{\text{new}} &= \ell_{\text{old}} \cdot e^{m_{\text{old}} - m_{\text{new}}} + \ell_{\text{block}} \cdot e^{m_{\text{block}} - m_{\text{new}}} \\
O_{\text{new}} &= O_{\text{old}} \cdot \left( \frac{\ell_{\text{old}} \cdot e^{m_{\text{old}} - m_{\text{new}}}}{\ell_{\text{new}}} \right) + O_{\text{block}} \cdot \left( \frac{e^{m_{\text{block}} - m_{\text{new}}}}{\ell_{\text{new}}} \right)
\end{aligned}
$$
- 遍历所有分块后，$O$ 精确收敛到标准全局 Softmax 注意力输出，**完全不需要在 HBM 中物化 $S \times S$ 矩阵**。

#### 3. 反向传播重计算 (Backward Recomputation)
- 传统注意力在反向传播时需要从 HBM 加载保存的前向 $S \times S$ 矩阵 $P$。
- FlashAttention 前向**不保存任何注意力矩阵**（显存复杂度从 $O(S^2)$ 降为 $O(S)$）；在反向传播时，直接利用保存的 $Q, K, V$ 分块在 SRAM 中重新即时计算一次注意力矩阵，反向速度反而大幅提升（重算时间远小于 HBM 搬运时间）。

### 3.3 性能对比与复杂度分析

| 指标 | 传统 Standard Attention | FlashAttention-1 / 2 |
|---|---|---|
| **HBM 访存量 (Memory Access)** | $O(S^2 + S d)$ | $O\left(\frac{S^2 d^2}{\text{SRAM Size}} + S d\right) \approx O(S d)$ |
| **激活值显存占用 (Activation Memory)**| $O(S^2)$ (长文本必然 OOM) | $O(S)$ (与序列长度线性相关) |
| **端到端加速比** | $1.0\times$ | **$2\times \sim 4\times$** |
