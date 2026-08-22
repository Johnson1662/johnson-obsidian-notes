# Lecture 06 - Kernels & Triton

> **课程主题**：GPU 自定义算子开发、OpenAI Triton 编程模型与算子融合实战
> **授课教师**：Percy Liang
> **核心目标**：掌握 GPU 性能基准测试与 Profiling 工具链，理解 CUDA 与 Triton 编程范式差异，熟练运用 Triton 编写高性能逐元素算子（GeLU）、融合 Softmax、行规约（Row Sum）与分块矩阵乘（Tiled Matmul + Activation Fusion）。

---

## 1. 性能基准测试与剖析 (Benchmarking & Profiling)

在编写底层加速算子前，必须建立严谨的测量机制：

### 1.1 精准 GPU 计时 (Benchmarking)
- **核心原则**：必须前置预热（Warmup）排除 JIT 编译与冷启动开销；使用 `torch.cuda.Event` 记录纯 GPU 端耗时，并在记录前后调用 `torch.cuda.synchronize()` 阻塞 CPU，避免将 Python CPU 调度开销误计入 GPU 运算时间。

```python
def benchmark(run_fn, num_warmups=3, num_trials=10):
    for _ in range(num_warmups):
        run_fn()
    torch.cuda.synchronize()

    start_event = torch.cuda.Event(enable_timing=True)
    end_event = torch.cuda.Event(enable_timing=True)

    start_event.record()
    for _ in range(num_trials):
        run_fn()
    end_event.record()
    torch.cuda.synchronize()

    return start_event.elapsed_time(end_event) / num_trials  # 返回毫秒 (ms)
```

### 1.2 深入 Profiling 分析
- 使用 `torch.profiler` 捕获实际调用的底层 CUDA Kernel 名称（如 CUTLASS、cuBLAS、Triton 生成的内核）。
- **`torch.compile` 的本质**：PyTorch 2.0 Inductor 后端的核心能力就是**将多个连续的 PyTorch 原生算子自动生成并编译为一个融合的 Triton Kernel**。

---

## 2. CUDA vs Triton 编程范式

```
  [ CUDA 编程模型 (NVIDIA) ]               [ Triton 编程模型 (OpenAI) ]
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ • 关注单个 Thread 的行为        │      │ • 关注单个 Thread Block 的行为  │
│ • 显式分配与管理 Shared Memory  │      │ • 面向 2D/3D 张量块 (Block/Tile)│
│ • 手动插入 __syncthreads() 同步 │      │ • 自动处理向量化与共享内存搬运  │
│ • 需极度繁杂的心智负担与优化    │      │ • 编译生成高效 PTX 汇编代码     │
└─────────────────────────────────┘      └─────────────────────────────────┘
```

Triton 的核心心智模型：
1. **Grid**：定义在各维度上启动多少个 Block（`tl.program_id` 获取当前 Block 索引）。
2. **Tile / Block**：每个 Block 一次性加载连续的一小块张量到片上 SRAM 中进行并行运算。
3. **Masking**：通过布尔掩码防止越界访问非整除尾部数据。

---

## 3. Triton 算子开发实战

### 3.1 逐元素融合算子：Triton GeLU

$$\text{GELU}(x) \approx 0.5x \left(1 + \tanh\left(\sqrt{\frac{2}{\pi}} (x + 0.044715 x^3)\right)\right)$$

```python
import torch
import triton
import triton.language as tl

@triton.jit
def triton_gelu_kernel(x_ptr, y_ptr, num_elements, BLOCK_SIZE: tl.constexpr):
    # 1. 获取当前 Block 的全局 ID
    pid = tl.program_id(axis=0)
    # 2. 计算当前 Block 处理的元素偏移
    offsets = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)
    # 3. 边界掩码 (防止越界)
    mask = offsets < num_elements

    # 4. 从全局显存 (HBM) 一次性加载至片上寄存器
    x = tl.load(x_ptr + offsets, mask=mask)

    # 5. 在片上执行融合数学运算 (无需写回显存中间结果)
    a = 0.79788456 * (x + 0.044715 * x * x * x)
    exp_2a = tl.exp(2 * a)
    tanh_a = (exp_2a - 1) / (exp_2a + 1)
    y = 0.5 * x * (1 + tanh_a)

    # 6. 一次性写回全局显存
    tl.store(y_ptr + offsets, y, mask=mask)

def triton_gelu(x: torch.Tensor):
    y = torch.empty_like(x)
    num_elements = x.numel()
    BLOCK_SIZE = 1024
    num_blocks = triton.cdiv(num_elements, BLOCK_SIZE)
    triton_gelu_kernel[(num_blocks,)](x, y, num_elements, BLOCK_SIZE=BLOCK_SIZE)
    return y
```

### 3.2 融合行级 Softmax (Fused Softmax)

- **原生 PyTorch 访存灾难**：
  $$\text{Softmax}(X) = \frac{e^{X - \max(X)}}{\sum e^{X - \max(X)}}$$
  原生执行包含 Max、Sub、Exp、Sum、Div 等 5 步，导致 **$5MN + M$ 次全局显存读、$3MN + 2M$ 次显存写**。
- **Triton Fused Softmax**：每个 Block 处理一行数据，整行加载至 SRAM，**显存读写降至严格的 $MN$ 次读与 $MN$ 次写，带来 4 倍以上加速**。

```python
@triton.jit
def triton_softmax_kernel(x_ptr, y_ptr, x_row_stride, y_row_stride, num_cols, BLOCK_SIZE: tl.constexpr):
    row_idx = tl.program_id(0)
    col_offsets = tl.arange(0, BLOCK_SIZE)
    mask = col_offsets < num_cols

    # 定位当前行首指针并加载整行
    x_ptrs = x_ptr + row_idx * x_row_stride + col_offsets
    x_row = tl.load(x_ptrs, mask=mask, other=float("-inf"))

    # 数值稳定化：减去行最大值
    x_max = tl.max(x_row, axis=0)
    numerator = tl.exp(x_row - x_max)
    denominator = tl.sum(numerator, axis=0)
    y_row = numerator / denominator

    # 写回整行
    y_ptrs = y_ptr + row_idx * y_row_stride + col_offsets
    tl.store(y_ptrs, y_row, mask=mask)
```

---

## 4. 分块矩阵乘与算子融合 (Tiled GEMM + Fusion)

### 4.1 2D 分块计算原理

计算 $C = \text{ReLU}(A B)$，其中 $A \in \mathbb{R}^{M \times K}, B \in \mathbb{R}^{K \times N}$：
1. 将输出矩阵 $C$ 划分为 `(BLOCK_M, BLOCK_N)` 的 2D 瓷砖（Tiles），启动 $M/\text{BLOCK\_M} \times N/\text{BLOCK\_N}$ 的 2D Grid。
2. 沿 $K$ 维度以步长 `BLOCK_K` 循环滑动：每次从 $A$ 和 $B$ 分别加载一个小块至 SRAM，调用 `tl.dot()`（底层调用 Tensor Core）累加部分和。
3. 循环结束后在寄存器内直接执行 $\text{ReLU}$（`tl.maximum(acc, 0.0)`），最后写回全局显存。

```python
@triton.jit
def matmul_relu_kernel(
    a_ptr, b_ptr, c_ptr,
    M, N, K,
    stride_am, stride_ak,
    stride_bk, stride_bn,
    stride_cm, stride_cn,
    BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr, BLOCK_K: tl.constexpr
):
    pid_m = tl.program_id(0)
    pid_n = tl.program_id(1)

    # 计算当前块在 M, N, K 上的索引向量
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    offs_k = tl.arange(0, BLOCK_K)

    # 构造 2D 指针网格
    a_ptrs = a_ptr + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak
    b_ptrs = b_ptr + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn

    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)

    # 沿 K 维度循环分块累加
    for k in range(0, K, BLOCK_K):
        a = tl.load(a_ptrs, mask=(offs_m[:, None] < M) & (offs_k[None, :] + k < K), other=0.0)
        b = tl.load(b_ptrs, mask=(offs_k[:, None] + k < K) & (offs_n[None, :] < N), other=0.0)
        acc += tl.dot(a, b)
        a_ptrs += BLOCK_K * stride_ak
        b_ptrs += BLOCK_K * stride_bk

    # 算子融合：直接在 SRAM 寄存器中执行激活函数
    acc = tl.maximum(acc, 0.0)

    # 写回输出矩阵 C
    c_ptrs = c_ptr + offs_m[:, None] * stride_cm + offs_n[None, :] * stride_cn
    tl.store(c_ptrs, acc, mask=(offs_m[:, None] < M) & (offs_n[None, :] < N))
```
