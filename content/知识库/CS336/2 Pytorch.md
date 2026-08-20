# CS336 Lecture 2：PyTorch、FLOPs 与资源核算

> **本讲主线**：语言模型的每一步都是张量运算。先掌握 PyTorch/einops 语义，再核算显存、计算量和数据移动，最后用 arithmetic intensity（算术强度）判断一个操作是 memory-bound 还是 compute-bound。

---

## 1. 为什么要做 resource accounting

给定模型、数据和硬件，真正的问题不是“代码能不能跑”，而是：

- 需要多少显存才能容纳参数、梯度、激活和优化器状态？
- 需要多少 FLOPs、多少秒或多少天才能完成训练？
- GPU 是在等待内存搬运，还是在进行矩阵乘法？
- 增大 batch、序列长度或模型宽度后，哪个资源先成为瓶颈？

### 1.1 两个数量级估算

**问题 A：70B 模型在 1024 张 H100 上训练 15T token 要多久？**

训练 FLOPs 的一阶估算：

$$
C=6ND
=6\times70\times10^9\times15\times10^{12}
=6.3\times10^{24}\ \text{FLOPs}。
$$

代码使用 H100 dense BF16 峰值：

```python
h100_flop_per_sec = 1979e12 / 2  # 1979 TFLOP/s 是稀疏峰值，dense 约一半
mfu = 0.5
flops_per_day = h100_flop_per_sec * mfu * 1024 * 60 * 60 * 24
days = (6 * 70e9 * 15e12) / flops_per_day
# 约 144 天；实际还要计入通信、输入管线和故障
```

**问题 B：8 张 80GB H100 用 AdamW 能放多大模型？**

混合精度训练的粗略每参数显存：

| 内容 | dtype | 字节/参数 |
| --- | --- | ---: |
| 参数 | BF16 | 2 |
| 梯度 | BF16 | 2 |
| Adam 一阶矩 $m$ | FP32 | 4 |
| Adam 二阶矩 $v$ | FP32 | 4 |
| **合计** |  | **12** |

忽略激活时：

$$
N_{\max}\approx\frac{8\times80\times10^9}{12}
\approx 5.33\times10^{10}
=53.3\text{B parameters}。
$$

这是**上界**：实际还要为激活、临时张量、CUDA 工作区、通信 buffer 和碎片留空间。

---

## 2. PyTorch 张量基础

### 2.1 张量的 rank 与 Transformer 形状

张量（tensor）是存储数据、参数、梯度、优化器状态和激活的基本容器。rank 是维度数量：

```python
import torch

x = torch.zeros(4)          # rank 1: (4,)
x = torch.zeros(4, 8)       # rank 2: (4, 8)
x = torch.zeros(4, 8, 2)    # rank 3: (4, 8, 2)

B, S, H, D = 32, 16, 16, 64
x = torch.zeros(B, S, H, D)  # rank 4
```

在语言模型中常见符号：

- $B$：batch size，并行样本数；
- $S$：sequence length，序列长度；
- $d$ 或 $D$：model/hidden dimension；
- $H$：attention heads 数；
- $d_h=d/H$：每个 head 的维度。

### 2.2 dtype、元素大小与显存

张量内存只由两个因素决定：元素个数和每个元素字节数：

$$
M(x)=\operatorname{numel}(x)\times\operatorname{element\_size}(x)\quad\text{bytes}。
$$

```python
def get_memory_usage(x: torch.Tensor) -> int:
    return x.numel() * x.element_size()

x = torch.zeros(4, 8)  # 默认 float32
assert x.dtype == torch.float32
assert x.numel() == 32
assert x.element_size() == 4
assert get_memory_usage(x) == 128
```

一个 GPT-3 feed-forward 矩阵形状为 $(4\times12288,12288)$，FP32 占用：

$$
4\times12288^2\times4\text{ bytes}
\approx2.3\text{ GiB}。
$$

#### 常见低精度格式

| 类型            |  位宽 | 每值字节 | 特征与用途                      |
| ------------- | --: | ---: | -------------------------- |
| FP64          |  64 |    8 | 科学计算高精度，训练 LLM 很少使用        |
| FP32          |  32 |    4 | 动态范围和精度均好，常用于优化器状态         |
| FP16          |  16 |    2 | 节省显存，但小数动态范围小，可能下溢         |
| BF16          |  16 |    2 | 与 FP32 类似的指数范围，深度学习训练更稳    |
| FP8 E4M3/E5M2 |   8 |    1 | 低精度加速，需缩放和专用库              |
| NVFP4         |   4 |  0.5 | 量化推理/训练实验，每 block 另存 scale |

FP16 下溢示例：

```python
x = torch.tensor([1e-8], dtype=torch.float16)
assert x == 0  # 太小，表示为 0

x = torch.tensor([1e-8], dtype=torch.bfloat16)
assert x != 0  # BF16 的指数范围接近 FP32
```

BF16 的代价是有效尾数更短，但在深度学习中通常比 FP16 的动态范围问题更容易接受。

### 2.3 Mixed precision（混合精度）

常见训练配置：

- 参数、激活、梯度用 BF16，减少显存和矩阵乘法成本；
- Adam 的一阶/二阶矩用 FP32，避免长时间累积时的数值不稳定；
- 对不适合低精度的运算（如指数、归一化的一些中间量）保留 FP32。

PyTorch AMP 会在安全的算子上自动选择 dtype：

```python
with torch.amp.autocast("cuda", dtype=torch.bfloat16):
    x = torch.zeros(4, 8)
```

### 2.4 CPU 与 GPU 设备

CPU 是默认设备；GPU 上的张量才会由 CUDA kernel 处理：

```python
def cuda_if_available():
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")

device = cuda_if_available()
x = torch.zeros(32, 32)          # CPU
x = x.to(device)                 # 搬到 GPU

with torch.device(device):       # 直接在 GPU 创建
    y = torch.zeros(32, 32)
```

`.to(device)` 会触发数据移动。高性能代码应尽量减少不必要的 CPU↔GPU 拷贝，并确保参与同一运算的张量在同一设备上。

---

## 3. einops：给维度命名

PyTorch 原生写法常依赖 `-1`、`-2` 等位置索引，复杂 attention 代码很容易把 batch、序列和 head 搞混。`einops` 用维度名称显式表达意图：

```python
from einops import rearrange, einsum, reduce
```

### 3.1 `einsum`：带形状账本的广义矩阵乘法

普通矩阵乘法：

```python
x = torch.ones(3, 4)  # seq1 hidden
y = torch.ones(4, 3)  # hidden seq2
z = x @ y              # seq1 seq2
```

等价的 `einops.einsum`：

```python
z = einsum(x, y, "seq1 hidden, hidden seq2 -> seq1 seq2")
```

输出中没有出现的维度会被求和：

```python
x = torch.ones(2, 3, 4)  # batch seq1 hidden
y = torch.ones(2, 3, 4)  # batch seq2 hidden
z = einsum(
    x, y,
    "batch seq1 hidden, batch seq2 hidden -> batch seq1 seq2",
)
# 对 hidden 求和，输出 (batch, seq1, seq2)
```

`...` 表示任意数量的广播维度：

```python
z = einsum(x, y, "... seq1 hidden, ... seq2 hidden -> ... seq1 seq2")
```

### 3.2 `reduce`：显式写归约维度

```python
x = torch.ones(2, 3, 4)       # batch seq hidden
y = x.sum(dim=-1)             # (batch, seq)
y2 = reduce(x, "... hidden -> ...", "sum")
assert torch.equal(y, y2)
```

同理可以使用 `mean`、`max`、`min` 等归约操作。

### 3.3 `rearrange`：拆分和合并维度

设 `total_hidden = heads * hidden1`：

```python
x = torch.ones(3, 8)           # seq total_hidden
w = torch.ones(4, 4)           # hidden1 hidden2

# (seq, heads*hidden1) -> (seq, heads, hidden1)
x = rearrange(x, "... (heads hidden1) -> ... heads hidden1", heads=2)

x = einsum(x, w, "... hidden1, hidden1 hidden2 -> ... hidden2")

# (seq, heads, hidden2) -> (seq, heads*hidden2)
x = rearrange(x, "... heads hidden2 -> ... (heads hidden2)")
```

把形状写在字符串中，相当于给每一维附上类型信息，是实现 QKV reshape、multi-head 合并和分布式分片的简单防错手段。

---

## 4. FLOPs、FLOP/s 与 MFU

### 4.1 两个容易混淆的缩写

- **FLOPs**：floating-point operations，完成一次计算需要多少浮点操作；
- **FLOP/s（也写 FLOPS）**：每秒可完成多少浮点操作，描述硬件速度。

例如：GPT-3 训练约 $3.14\times10^{23}$ FLOPs；GPU 的规格则会给出 BF16/FP16 的峰值 FLOP/s，而且不同 dtype 会有很大差别。

### 4.2 矩阵乘法的 FLOPs

对

$$
X\in\mathbb{R}^{B\times D},\quad
W\in\mathbb{R}^{D\times K},\quad
Y=XW\in\mathbb{R}^{B\times K},
$$

每个输出 $Y_{ik}$ 需要 $D$ 次乘法和约 $D$ 次加法，因而：

$$
F_{\text{matmul}}\approx 2BDK。
$$

```python
B, D, K = 1024, 256, 64
x = torch.ones(B, D, device=cuda_if_available())
w = torch.randn(D, K, device=cuda_if_available())
y = x @ w
actual_num_flops = 2 * B * D * K
```

### 4.3 实测 FLOP/s 与 MFU

用计时器测出操作耗时 $t$：

$$
\text{actual FLOP/s}=\frac{F}{t}。
$$

模型 FLOPs utilization（MFU）定义为：

$$
\text{MFU}=\frac{\text{actual FLOP/s}}{\text{promised peak FLOP/s}}。
$$

它忽略通信和其他开销；大型、规整的矩阵乘法通常可以达到约 0.5 或更高，单个小算子则往往远低于此。

```python
import timeit

def benchmark(func, num_trials=5):
    if torch.cuda.is_available():
        torch.cuda.synchronize()

    def run():
        func()
        if torch.cuda.is_available():
            torch.cuda.synchronize()

    return timeit.timeit(run, number=num_trials) / num_trials

time_s = benchmark(lambda: x @ w)
actual_flop_per_sec = actual_num_flops / time_s
promised_flop_per_sec = 989.5e12  # H100 dense BF16 的示例峰值
mfu = actual_flop_per_sec / promised_flop_per_sec
```

---

## 5. Arithmetic Intensity 与 Roofline

### 5.1 一次 GPU 运算的三步

1. 从 HBM/显存把输入搬到计算单元；
2. 在 SM/Tensor Core 上计算；
3. 把输出写回显存。

若输入输出传输字节数为 $M$、操作 FLOPs 为 $F$，理想重叠情况下：

$$
T\approx\max\left(\frac{M}{\text{memory bandwidth}},\frac{F}{\text{peak FLOP/s}}\right)。
$$

定义：

$$
\text{Arithmetic Intensity (AI)}=\frac{F}{M}\quad(\text{FLOPs/byte}),
$$

硬件的转折强度为：

$$
\text{AI}_{\text{accelerator}}
=\frac{\text{peak FLOP/s}}{\text{memory bandwidth}}。
$$

- 若 $\text{AI}<\text{AI}_{\text{accelerator}}$：传输更慢，**memory-bound**；
- 若 $\text{AI}>\text{AI}_{\text{accelerator}}$：计算更慢，**compute-bound**。

以 H100 dense BF16 粗略取：

$$
\text{peak}\approx989.5\ \text{TFLOP/s},\quad
\text{bandwidth}\approx3.35\ \text{TB/s},
$$

因此转折点约为 $295$ FLOPs/byte。

### 5.2 典型算子推导（BF16）

假设 BF16 每个值 2 bytes。

| 操作 | 传输字节 $M$ | FLOPs $F$ | AI（近似） | 结论 |
| --- | --- | --- | ---: | --- |
| ReLU($x$) | 读 $x$ + 写 $y=4n$ | $n$ 次比较 | $1/4$ | memory-bound |
| GeLU($x$) | $4n$ | 约 $20n$（近似多项式/tanh） | $5$ | 仍 memory-bound |
| dot($x,w$) | $2n+2n+2$ | $2n-1$ | $\approx1/2$ | memory-bound |
| matrix-vector | $2n+2n^2+2n$ | $n(2n-1)$ | $\approx1$ | memory-bound |
| $n\times n$ matmul | $6n^2$ | $n^2(2n-1)$ | $\approx n/3$ | 大矩阵时 compute-bound |

对应代码和公式：

```python
n = 1024 * 1024
x = torch.ones(n, dtype=torch.bfloat16, device=cuda_if_available())
y = torch.relu(x)
bytes_moved = 2*n + 2*n
flops = n
ai_relu = flops / bytes_moved

# n x n 矩阵乘法
n = 1024
x = torch.ones(n, n, dtype=torch.bfloat16, device=cuda_if_available())
w = torch.ones(n, n, dtype=torch.bfloat16, device=cuda_if_available())
y = x @ w
bytes_moved = 2*n*n + 2*n*n + 2*n*n
flops = n*n*(2*n - 1)
ai_matmul = flops / bytes_moved
```

这解释了两个看似反直觉的现象：

- 单独执行时，ReLU 不一定比 GeLU 快：二者都受内存搬运限制；
- **训练**有大 batch 和大矩阵乘法，通常 compute-bound；**逐 token 解码**近似 matrix-vector，通常 memory-bound。

### 5.3 Roofline 与 MFU 的关系

Roofline 图横轴是 arithmetic intensity，纵轴是可达性能：

- 低 AI 区域是一条斜线，性能随带宽线性增加；
- 超过转折点后变成水平线，受峰值计算能力限制；
- 转折点就是 $\text{AI}_{\text{accelerator}}$。

忽略其他开销时，常用估计：

$$
\text{MFU}\approx\min\left(1,
\frac{\text{AI}}{\text{AI}_{\text{accelerator}}}\right)。
$$

算术强度还依赖 dtype：降低每值字节数会增加 AI，但也要考虑 Tensor Core 是否支持该格式以及数值稳定性。

---

## 6. 前向、反向与训练 FLOPs

### 6.1 一个最简单的梯度例子

设

$$
\ell=\frac12(x\cdot w-5)^2。
$$

```python
x = torch.tensor([1., 2., 3.])
w = torch.tensor([1., 1., 1.], requires_grad=True)
pred_y = x @ w
loss = 0.5 * (pred_y - 5).pow(2)
loss.backward()
assert torch.equal(w.grad, torch.tensor([1., 2., 3.]))
```

`requires_grad=True` 让 PyTorch 建立 autograd 图；`backward()` 从损失反向应用链式法则，把梯度累积到 `w.grad`。

### 6.2 两层线性网络的 FLOPs 推导

对一层

$$
H_2=H_1W_2,
\quad H_1\in\mathbb{R}^{B\times D},
\quad W_2\in\mathbb{R}^{D\times D},
$$

前向：

$$
F_{\text{forward}}=2BDD=2BD^2。
$$

反向要计算两项：

$$
\frac{\partial\ell}{\partial H_1}=\frac{\partial\ell}{\partial H_2}W_2^\top,
\qquad
\frac{\partial\ell}{\partial W_2}=H_1^\top\frac{\partial\ell}{\partial H_2}。
$$

每项约 $2BD^2$ FLOPs，所以：

$$
F_{\text{backward}}\approx4BD^2=2F_{\text{forward}}。
$$

对总参数量 $P$ 的 MLP/短上下文 Transformer 近似：

$$
F_{\text{forward}}\approx2BP,
\quad F_{\text{backward}}\approx4BP,
\quad F_{\text{step}}\approx6BP。
$$

这就是 $6ND$ 训练估算的来源：把 $B$ 个样本的 token 总数记作 $D$ 即可。

### 6.3 一个可运行的深网络

```python
import math
import torch.nn.functional as F
from torch import nn

class Block(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.weight = nn.Parameter(torch.randn(dim, dim) / math.sqrt(dim))

    def forward(self, x):
        return F.relu(x @ self.weight)

class DeepNetwork(nn.Module):
    def __init__(self, dim: int, num_layers: int):
        super().__init__()
        self.layers = nn.ModuleList([Block(dim) for _ in range(num_layers)])

    def forward(self, x):
        for layer in self.layers:
            x = layer(x)
        return x

model = DeepNetwork(dim=8, num_layers=3)
assert sum(p.numel() for p in model.parameters()) == 8 * 8 * 3
```

---

## 7. 训练显存：参数、梯度、优化器与激活

### 7.1 Adam/AdaGrad 状态

Adam 可以看成 RMSProp（指数平均的梯度平方）加 momentum（梯度的一阶指数平均）：

- SGD：直接用梯度；
- momentum：保存一阶动量；
- AdaGrad：累加 $g_t^2$；
- RMSProp：指数平均 $g_t^2$；
- Adam：同时保存一阶、二阶矩。

教学版 AdaGrad：

```python
class AdaGrad(torch.optim.Optimizer):
    def __init__(self, params, lr=0.01):
        super().__init__(params, dict(lr=lr))

    def step(self):
        for group in self.param_groups:
            lr = group["lr"]
            for p in group["params"]:
                state = self.state[p]
                grad = p.grad.data
                g2 = state.get("g2", torch.zeros_like(grad))
                g2 += torch.square(grad)
                state["g2"] = g2
                p.data -= lr * grad / torch.sqrt(g2 + 1e-5)
```

令模型参数量为 $P$，batch 为 $B$，层数为 $L$，隐藏维度为 $d$，以 BF16 激活/参数为例：

| 项目 | 近似显存 |
| --- | ---: |
| 参数 | $2P$ bytes |
| 梯度 | $2P$ bytes |
| AdaGrad 二阶状态 | $4P$ bytes（FP32） |
| Adam 一阶+二阶状态 | $8P$ bytes（FP32） |
| 简化激活 | $2BDL$ bytes |

总显存（Adam）：

$$
M_{\text{train}}\approx2P+2P+8P+2BDL
=12P+2BDL\quad\text{bytes}。
$$

激活还会受到算子中间结果、注意力矩阵、临时 buffer 的影响，所以上式只是骨架。

### 7.2 Transformer 的显存公式（近似推导）

设：

- batch $B$，序列长度 $S$，层数 $L$；
- model dimension $d$，head 数 $h$，$d_h=d/h$；
- FFN 维度 $d_{ff}=r d$；
- BF16 每个激活 2 bytes，Adam 状态每个参数 8 bytes。

**参数量（每层）**：

- MHA 的 $W_Q,W_K,W_V,W_O$：$4d^2$；
- 普通两矩阵 FFN：$W_1,W_2$ 共 $2dd_{ff}=2rd^2$；
- 两个归一化向量约 $2d$（相对矩阵项可忽略）。

所以普通 dense 层：

$$
P_{\text{layer}}\approx(4+2r)d^2+2d。
$$

SwiGLU 有两个输入投影（门和 value）加一个输出投影：

$$
P_{\text{SwiGLU layer}}\approx(4+3r)d^2+2d。
$$

**需要保存的激活**（训练反向使用）：

| 激活 | 形状 | 元素量 |
| --- | --- | ---: |
| 残差/层输入输出 | $(B,S,d)$ | $BSd$ |
| Q、K、V | 各 $(B,S,d)$ | $3BSd$ |
| attention logits/probability | $(B,h,S,S)$ 各一份（实现可融合） | $2BhS^2$ |
| FFN 中间量 | $(B,S,d_{ff})$（SwiGLU 可能两份） | $BSd_{ff}$ 或 $2BSd_{ff}$ |
| dropout/mask/临时张量 | 依实现 | 同量级 |

用系数 $c_i$ 表示实现是否保存这些中间量，单层激活显存可写成：

$$
M_{\text{act,layer}}
\approx b\left[
 c_1BSd+c_2BhS^2+c_3BSd_{ff}
\right],
$$

其中 $b=2$ bytes（BF16），所有层保存时：

$$
M_{\text{act,total}}
\approx bL\left[c_1BSd+c_2BhS^2+c_3BSd_{ff}\right].
$$

注意力项 $BhS^2$ 在长序列时会迅速成为瓶颈；FlashAttention 通过分块和融合避免把完整 $S\times S$ 矩阵写回 HBM，但数学计算仍需考虑其 $O(S^2d)$ 工作量。

综合 Adam 混合精度训练的骨架：

$$
M_{\text{total}}
\approx (2+2+8)P
+bL\left[c_1BSd+c_2BhS^2+c_3BSd_{ff}\right]
+M_{\text{temporary}}。
$$

这是上界估算和并行切分的起点，而不是特定框架的精确 profile。

---

## 8. 训练循环与梯度管理

### 8.1 标准训练循环

```python
D, B, L = 16, 4, 2
true_w = torch.arange(D, dtype=torch.float32)
model = DeepNetwork(dim=D, num_layers=L)
optimizer = AdaGrad(model.parameters(), lr=0.01)

def get_batch():
    x = torch.randn(B, D)
    y = x @ true_w
    return x, y

for step in range(3):
    x, y = get_batch()
    pred_y = model(x).mean()
    loss = F.mse_loss(pred_y, y)
    loss.backward()                 # 梯度累加到 .grad
    optimizer.step()                # 更新参数/状态
    optimizer.zero_grad(set_to_none=True)
```

若忘记 `zero_grad`，梯度会跨 step 累加，除非这正是梯度累积的意图。

### 8.2 Gradient accumulation

大 batch 通常有更稳定的梯度，但激活显存近似与 batch 成正比：

$$
M_{\text{act}}\propto B。
$$

梯度累积把一个大 batch 拆成多个 micro-batch：

```python
optimizer.zero_grad(set_to_none=True)
for micro_x, micro_y in micro_batches:
    loss = criterion(model(micro_x), micro_y)
    (loss / num_micro_batches).backward()  # 不清空梯度
optimizer.step()
optimizer.zero_grad(set_to_none=True)
```

若有效 batch 为 $B$、micro-batch 为 $b$，需要约 $B/b$ 次前后向后才更新一次参数；单次激活从 $O(B)$ 降到 $O(b)$，但总计算量基本不变。

### 8.3 Activation checkpointing（重计算）

训练通常要保存每层激活，推理只需保存当前层。checkpointing 的想法是：

- 前向只保存少数 checkpoint 激活；
- 反向到达缺失段时，从最近 checkpoint 重新前向计算；
- 以额外 FLOPs 换取更低显存。

```python
class DeepNetworkCheckpointed(nn.Module):
    def __init__(self, dim, num_layers):
        super().__init__()
        self.layers = nn.ModuleList([Block(dim) for _ in range(num_layers)])

    def forward(self, x):
        for layer in self.layers:
            x = torch.utils.checkpoint.checkpoint(layer, x)
        return x
```

深度为 $L$ 时，checkpoint 间隔的渐近关系：

| 保存策略 | 激活显存 | 重计算量 |
| --- | --- | --- |
| 保存每层 | $O(L)$ | 近似 0 |
| 不保存中间层 | $O(1)$ | $O(L^2)$（反向时重复从头计算） |
| 每 $\sqrt L$ 层保存 | $O(\sqrt L)$ | $O(L)$ |

实际 PyTorch 会使用更细致的分段策略，但“显存换计算”的原则不变。

---

## 9. PyTorch 实践检查清单

1. **形状**：在每次 `matmul`、`einsum`、`rearrange` 前写出维度；
2. **dtype**：确认参数/激活使用 BF16 还是 FP32，避免无意的 upcast；
3. **device**：避免 CPU/GPU 混用和隐式拷贝；
4. **FLOPs**：先按乘加次数估算，再用 `benchmark` 和同步后的 CUDA 时间测量；
5. **显存**：分别估算参数、梯度、优化器状态、激活和临时 buffer；
6. **瓶颈**：用 arithmetic intensity/roofline 判断是否该做算子融合或减少内存读写；
7. **验证**：小张量先用 `assert` 检查形状、dtype、梯度和 `encode/decode` 类似的 round-trip 性质。

### 本讲小结

- 一切都是张量：数据、参数、激活、梯度和状态；
- `einops` 把维度名称写进运算，降低 attention 实现的形状错误；
- 矩阵乘法约 $2MNK$ FLOPs，训练一阶估算为 $6ND$ FLOPs；
- MFU 衡量实际 FLOP/s 相对硬件峰值的比例，但 FLOPs 不等于运行时间；
- arithmetic intensity 决定 memory-bound 或 compute-bound；训练的大矩阵乘法通常计算受限，逐 token 推理通常内存受限；
- 梯度累积和 activation checkpointing 分别用更多 step 或重计算换显存，使更大的 batch/模型成为可能。
