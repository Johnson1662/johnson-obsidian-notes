# CS336 Lecture 3：Transformer 架构与超参数

> **核心问题**：现代大语言模型虽然有大量变体，但哪些设计已经形成共识？哪些超参数影响大？哪些选择主要由系统效率决定？本讲从原始 Transformer 出发，推导位置编码、归一化、激活函数和常用模型尺度。

---

## 1. 从原始 Transformer 到现代 Transformer

### 1.1 原始 Transformer 的选择

Vaswani 等人的 encoder-decoder Transformer 采用了：

- token embedding 加正弦/余弦位置编码；
- multi-head attention；
- FFN 中使用 ReLU；
- **post-norm LayerNorm**：子层先计算，再把残差相加后的结果归一化；
- 线性层带 bias（具体实现可能略有差异）。

一个 decoder-only 语言模型保留“masked self-attention + FFN + residual”，去掉 encoder-cross-attention，使用 causal mask 只读取当前位置及之前的 token。

### 1.2 课程中实现的现代简化版本

CS336 Assignment 1 采用接近 LLaMA 的变体：

| 组件 | 原始 Transformer | 现代常用选择 |
| --- | --- | --- |
| 归一化位置 | post-norm | pre-norm（LayerNorm/RMSNorm 位于子层之前） |
| 位置编码 | 加法式正弦/余弦 | RoPE，直接旋转 Q/K |
| FFN 激活 | ReLU | SwiGLU 等 gated activation |
| bias | 线性层和 norm 常保留 | 多数现代 LM 删除 bias |
| 注意力 | MHA | MHA、GQA/MQA、滑窗/稀疏、MLA 等 |

> 这些选择不是“唯一正确答案”。大多数共识来自跨模型实验、数值稳定性和硬件效率，而非一个能解释所有规模的定理。

---

## 2. Transformer 的完整计算图

### 2.1 符号

设：

- batch 大小 $B$；
- 序列长度 $S$；
- 词表大小 $V$；
- 模型宽度/隐藏维度 $d=d_{model}$；
- attention head 数 $h$；
- 每个 head 宽度 $d_h$（通常 $d_hh=d$）；
- FFN 隐藏维度 $d_{ff}$；
- block 层数 $L$。

token id 为 $t_i\in\{0,\ldots,V-1\}$，token embedding 矩阵：

$$
E\in\mathbb{R}^{V\times d},
\qquad
x_i^{(0)}=E[t_i]。
$$

如果使用绝对位置向量 $p_i$，则：

$$
X^{(0)}_i=E[t_i]+p_i。
$$

### 2.2 Pre-LN decoder block

常见的 pre-norm block：

$$
\begin{aligned}
U^{(\ell)} &= X^{(\ell-1)} + \operatorname{Attention}(\operatorname{Norm}_1(X^{(\ell-1)})),\\
X^{(\ell)} &= U^{(\ell)} + \operatorname{FFN}(\operatorname{Norm}_2(U^{(\ell)})).
\end{aligned}
$$

最后经过 norm 和输出投影：

$$
H=\operatorname{Norm}_{final}(X^{(L)}),
\qquad
Z=HW_U+b_U\in\mathbb{R}^{B\times S\times V}。
$$

若输入 embedding 与输出投影共享权重（weight tying），可令 $W_U=E^\top$，减少参数量并让输入/输出词表处于同一表示空间。

### 2.3 Multi-head self-attention

输入 $X\in\mathbb{R}^{B\times S\times d}$：

$$
Q=XW_Q,\quad K=XW_K,\quad V=XW_V,
$$

其中 $W_Q,W_K,W_V\in\mathbb{R}^{d\times hd_h}$。reshape 后：

$$
Q,K,V\in\mathbb{R}^{B\times h\times S\times d_h}。
$$

因果注意力：

$$
A=\operatorname{softmax}\left(\frac{QK^\top}{\sqrt{d_h}}+M\right),
\qquad
Y=AVW_O,
$$

$M_{ij}=-\infty$（当 $j>i$）以屏蔽未来 token。完整注意力的时间和中间矩阵显存分别近似为 $O(BhS^2d_h)=O(BS^2d)$ 与 $O(BhS^2)$。

### 2.4 一个最小 PyTorch block

```python
import math
import torch
from torch import nn
import torch.nn.functional as F

class TransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, d_ff):
        super().__init__()
        assert d_model % n_heads == 0
        self.norm1 = nn.RMSNorm(d_model)
        self.qkv = nn.Linear(d_model, 3 * d_model, bias=False)
        self.out = nn.Linear(d_model, d_model, bias=False)
        self.norm2 = nn.RMSNorm(d_model)
        self.ff1 = nn.Linear(d_model, d_ff, bias=False)
        self.ff2 = nn.Linear(d_ff, d_model, bias=False)
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads

    def forward(self, x, causal_mask=None):
        b, s, d = x.shape
        h = self.norm1(x)
        q, k, v = self.qkv(h).chunk(3, dim=-1)
        q = q.view(b, s, self.n_heads, self.head_dim).transpose(1, 2)
        k = k.view(b, s, self.n_heads, self.head_dim).transpose(1, 2)
        v = v.view(b, s, self.n_heads, self.head_dim).transpose(1, 2)
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.head_dim)
        if causal_mask is not None:
            scores = scores.masked_fill(causal_mask, float("-inf"))
        a = scores.softmax(dim=-1)
        attn = (a @ v).transpose(1, 2).reshape(b, s, d)
        x = x + self.out(attn)
        x = x + self.ff2(F.silu(self.ff1(self.norm2(x))))
        return x
```

该片段用普通 SiLU FFN 展示数据流；现代模型常把后面的 FFN 改为 SwiGLU，并在 Q/K 上加入 RoPE。

---

## 3. Pre-Norm 与 Post-Norm

### 3.1 两种公式

**Post-norm**（BERT 等早期模型常见）：

$$
X' = \operatorname{Norm}(X+F(X))。
$$

**Pre-norm**（现代 decoder-only LM 的主流）：

$$
X' = X+F(\operatorname{Norm}(X))。
$$

这里 $F$ 可以是 attention 或 FFN。

### 3.2 为什么多数现代模型选择 pre-norm

pre-norm 把 LayerNorm 放到残差支路上，残差主路径近似是恒等映射：

$$
X^{(\ell)}\approx X^{(\ell-1)}+\text{小的更新}。
$$

这带来：

- 更直接的梯度传播，深层网络中的梯度衰减更弱；
- 训练初期更少出现梯度尖峰；
- 对 warmup 和大学习率通常更宽容。

原始研究还讨论了通过 post-norm 移除 warmup 的优势；如今重点更多是大型/深层网络的稳定性和可使用的学习率。

少数模型会在残差流外再加一次“double norm”或 non-residual post-norm（例如部分 Grok、Gemma 2、Olmo 2 设计），目的在于进一步约束输出尺度。OPT-350M 是较少见的现代 post-norm 例外。

---

## 4. LayerNorm 与 RMSNorm

### 4.1 LayerNorm

对单个 token 的 hidden 向量 $x\in\mathbb{R}^d$：

$$
\mu=\frac1d\sum_{j=1}^{d}x_j,
\qquad
\sigma^2=\frac1d\sum_{j=1}^{d}(x_j-\mu)^2,
$$

$$
\operatorname{LayerNorm}(x)
=\gamma\odot\frac{x-\mu}{\sqrt{\sigma^2+\epsilon}}+\beta。
$$

$\gamma,\beta\in\mathbb{R}^d$ 是可学习缩放和偏置。

### 4.2 RMSNorm

RMSNorm 不减均值，也通常不使用 bias：

$$
\operatorname{RMSNorm}(x)
=\gamma\odot\frac{x}{\sqrt{\frac1d\sum_{j=1}^{d}x_j^2+\epsilon}}。
$$

它只约束均方根（root mean square），因此：

- 少计算均值和方差，算子更短；
- 少一组 bias 参数，减少需要搬运的数据；
- 实践中通常达到与 LayerNorm 相当的效果；
- 归一化本身 FLOPs 不大，但常是 memory-bound，少一次数据读写仍可能改善 wall-clock。

> 重要经验：FLOPs 不是 runtime。内存访问、kernel 启动和融合程度也决定速度。

### 4.3 删除 bias

许多现代 Transformer 使用无 bias 线性层和 norm：

$$
\operatorname{FFN}(x)=\sigma(xW_1)W_2,
$$

而不是在每个线性层加常数项。原因主要是：

- 参数/激活需要在 GPU 间移动；
- bias 的表达收益相对较小；
- 较少的可学习偏移有时更容易稳定优化。

---

## 5. FFN 与激活函数

### 5.1 普通 FFN

对输入 $x$：

$$
\operatorname{FFN}(x)=\sigma(xW_1+b_1)W_2+b_2,
$$

其中 $W_1\in\mathbb{R}^{d\times d_{ff}}$，$W_2\in\mathbb{R}^{d_{ff}\times d}$。

常见激活：

- **ReLU**：$\operatorname{ReLU}(z)=\max(0,z)$；
- **GeLU**：$\operatorname{GeLU}(x)=x\Phi(x)$，其中 $\Phi$ 是标准正态 CDF；
- **SiLU/Swish**：$\operatorname{SiLU}(x)=x\sigma(x)$。

原始 Transformer、T5、Gopher、Chinchilla、OPT 等使用过 ReLU/GeLU；GPT 家族、GPT-J/NeoX、BLOOM 等使用 GeLU。

### 5.2 Gated Linear Unit（GLU）

GLU 在 FFN 第一段引入一个额外的门控投影 $V$。以 ReGLU 为例：

$$
\operatorname{ReGLU}(x)
=\bigl(\operatorname{ReLU}(xW)\odot xV\bigr)W_2。
$$

其中 $\odot$ 是逐元素乘法。门分支决定每个维度的通过程度，value 分支提供内容。

**GeGLU**：

$$
\operatorname{GeGLU}(x)
=\bigl(\operatorname{GeLU}(xW)\odot xV\bigr)W_2。
$$

**SwiGLU**：

$$
\operatorname{SwiGLU}(x)
=\bigl(\operatorname{SiLU}(xW)\odot xV\bigr)W_2。
$$

代码：

```python
class SwiGLU(nn.Module):
    def __init__(self, d_model, d_ff):
        super().__init__()
        self.w_gate = nn.Linear(d_model, d_ff, bias=False)
        self.w_value = nn.Linear(d_model, d_ff, bias=False)
        self.w_out = nn.Linear(d_ff, d_model, bias=False)

    def forward(self, x):
        gate = F.silu(self.w_gate(x))
        value = self.w_value(x)
        return self.w_out(gate * value)
```

门控 FFN 多一个输入投影矩阵。为保持参数量和计算量接近普通 $4d$ FFN，实践中把 $d_{ff}$ 缩小约 $2/3$：

$$
4d\times\frac23\approx\frac83d。
$$

因此 LLaMA 等模型常用 $d_{ff}\approx2.66d$ 的 SwiGLU，而不是 $4d$。

### 5.3 激活函数经验结论

ReLU/GeLU/SwiGLU 都能训练出可用模型；GPT-3 说明 GLU 不是必要条件。但 2023 年以后大多数模型采用 SwiGLU 或 GeGLU，许多独立实验都观察到比较稳定的收益。也存在 Squared ReLU 等少数探索，不能把“共识”理解成数学必然性。

---

## 6. Serial 与 Parallel Transformer Layers

### 6.1 Serial（串行）block

标准 block 先 attention、后 FFN：

$$
X'=X+\operatorname{Attn}(\operatorname{Norm}(X)),
$$

$$
X''=X'+\operatorname{FFN}(\operatorname{Norm}(X'))。
$$

### 6.2 Parallel block

GPT-J、PaLM、GPT-NeoX 等尝试让 attention 与 FFN 共享同一输入并行计算：

$$
X'=X+\operatorname{Attn}(\operatorname{Norm}(X))
+\operatorname{FFN}(\operatorname{Norm}(X))。
$$

若实现正确，可以共享 LayerNorm，并融合部分矩阵乘法，减少 kernel 启动和数据读写；代价是改变了层内的信息交互路径，主流模型仍多采用 serial。

---

## 7. 位置编码：让模型知道顺序

Self-attention 本身对输入 token 的排列是置换等变的；不提供位置时，`ABC` 与 `CBA` 的结构无法区分。常见位置编码分三类。

### 7.1 正弦/余弦位置编码

原始 Transformer 为每个位置 $p$ 和维度 $2i,2i+1$ 定义：

$$
PE_{p,2i}=\sin\left(\frac{p}{10000^{2i/d}}\right),
$$

$$
PE_{p,2i+1}=\cos\left(\frac{p}{10000^{2i/d}}\right)。
$$

将其加到 embedding：

$$
X_{p}=E[t_p]+PE_p。
$$

优点是无需学习额外位置参数，并且不同频率可以表示距离；缺点是这种加法会在内积中产生与绝对位置相关的交叉项，不能天然只依赖 $p-q$。

### 7.2 Learned absolute embedding

为每个绝对位置学习向量 $u_p$：

$$
X_p=E[t_p]+u_p。
$$

GPT-1/2/3、OPT 等使用过。最大位置长度通常固定，扩展到训练范围外需要插值或重新训练。

### 7.3 Relative position bias

不把位置向量加到输入，而是直接修正 attention logits：

$$
A_{ij}=\operatorname{softmax}_j
\left(\frac{q_i k_j^\top}{\sqrt{d_h}}+b_{i-j}\right)。
$$

T5、Gopher、Chinchilla 等采用过相对位置偏置；它更直接表达 token 间相对距离，但偏置参数/桶化方式需要设计。

### 7.4 RoPE：Rotary Position Embedding

RoPE 的目标是构造 $f(x,p)$，使两个位置的内积只依赖相对位置：

$$
\langle f(q,i), f(k,j)\rangle=g(q,k,i-j)。
$$

关键事实：内积在同一个正交旋转下不变。把 hidden 维度两两配对，在每个二维平面旋转：

$$
R(\theta)=
\begin{bmatrix}
\cos\theta & -\sin\theta\\
\sin\theta & \cos\theta
\end{bmatrix}。
$$

第 $m$ 对坐标使用角频率

$$
\theta_{p,m}=p\cdot\omega_m,
\qquad
\omega_m=\theta_{base}^{-2m/d_h}
$$

（常见 $\theta_{base}=10000$，具体模型可能调整）。对 query/key 应用：

$$
q'_p=R_pq_p,\qquad k'_q=R_qk_q。
$$

由于 $R_p^\top R_q=R_{q-p}$：

$$
\langle q'_p,k'_q\rangle
= q_p^\top R_p^\top R_q k_q
= q_p^\top R_{q-p} k_q，
$$

所以分数中的位置关系通过 $q-p$ 表现，而不像加法式编码那样引入额外 cross terms。

> RoPE 不是把一个位置向量加到 embedding，而是在**每一次 attention 的 Q/K** 上按位置旋转；V 不需要旋转。

#### RoPE 代码

```python
def rotate_half(x):
    x1, x2 = x[..., ::2], x[..., 1::2]
    return torch.stack((-x2, x1), dim=-1).flatten(-2)

def apply_rope(q, k, theta_base=10000.0):
    # q, k: (batch, heads, seq, head_dim)，head_dim 为偶数
    _, _, seq, dim = q.shape
    pos = torch.arange(seq, device=q.device)
    freq = theta_base ** (-torch.arange(0, dim, 2, device=q.device) / dim)
    angles = pos[:, None] * freq[None, :]
    cos = angles.cos()[None, None, :, :].repeat_interleave(2, dim=-1)
    sin = angles.sin()[None, None, :, :].repeat_interleave(2, dim=-1)
    return q * cos + rotate_half(q) * sin, k * cos + rotate_half(k) * sin
```

实际高效实现会预计算并缓存 `cos/sin`，避免每层重复构造；Gemma 4 等模型也探索只对前两个坐标做旋转等变体。

---

## 8. 超参数：哪些数值是“共识”

### 8.1 $d_{ff}/d_{model}$：4 倍规则

普通 ReLU/GeLU FFN 的经验法则：

$$
 d_{ff}\approx4d_{model}。
$$

SwiGLU/GeGLU 因为多一个输入投影，通常把有效宽度缩到约 $8/3$：

$$
 d_{ff}\approx\frac83d_{model}\approx2.67d_{model}。
$$

| 模型/系列 | $d_{ff}/d_{model}$（约） | 备注 |
| --- | ---: | --- |
| 普通 Transformer | 4 | 经典默认值 |
| PaLM | 3.5 | GLU 变体 |
| Mistral 7B | 3.5 | GLU 变体 |
| LLaMA-2 70B | 2.68 | 接近 $8/3$ |
| LLaMA 70B | 2.68 | 接近 $8/3$ |
| Qwen 14B | 2.67 | 接近 $8/3$ |
| DeepSeek 67B | 2.68 | 接近 $8/3$ |
| Yi 34B | 2.85 | 近似 GLU 缩放 |
| T5 v1.1 | 2.5 | GeGLU |
| T5 11B | 64 | 极端例外，$d=1024,d_{ff}=65536$ |

T5 11B 证明极端比例也能工作，但后续 T5 v1.1 改为更标准的约 2.5，说明 64 倍很可能不是最优选择。经验上 $1\sim10$ 的宽度比例存在较宽的低损失区域，而不是一个精确魔数。

### 8.2 head dim、head 数与 model dim

常见约束是：

$$
 h\times d_h=d_{model}。
$$

这使 Q/K/V 拼接后回到模型宽度，但数学上不强制；某些模型允许 $h d_h>d_{model}$。

| 模型 | heads $h$ | head dim $d_h$ | $d_{model}$ | $hd_h/d_{model}$ |
| --- | ---: | ---: | ---: | ---: |
| GPT-3 | 96 | 128 | 12288 | 1 |
| T5 | 128 | 128 | 1024 | 16 |
| T5 v1.1 | 64 | 64 | 4096 | 1 |
| LaMDA | 128 | 128 | 8192 | 2 |
| PaLM | 48 | 256/258（实现取整） | 18432 | 约 1.48 |
| LLaMA-2 | 64 | 128 | 8192 | 1 |
| Qwen 3.5 27B | 24 | 256 | 5120 | 1.2 |

多数模型在 1 附近；Google 系列的一些例外说明这更多是工程/容量选择，验证证据并不如 $d_{ff}$ 规则充分。

### 8.3 深度与宽度（aspect ratio）

常用比值：

$$
\frac{d_{model}}{n_{layers}}。
$$

许多模型落在约 100～200 的范围。更深的模型：

- 串行层数多，端到端 latency 更高；
- 更难做高效 pipeline/tensor parallel；
- 可能带来更强的表达能力，但需要更谨慎的稳定性设置。

更宽的模型矩阵更大、单层并行度高，但参数和激活峰值也上升。实际选择常由 GPU 形状、通信和推理延迟共同决定。

### 8.4 词表大小

| 模型/场景 | 词表大小（约） |
| --- | ---: |
| Original Transformer | 37,000 |
| GPT | 40,257 |
| GPT-2/3 | 50,257 |
| T5/T5 v1.1 | 32,128 |
| LLaMA | 32,000 |
| mT5 | 250,000 |
| PaLM | 256,000 |
| GPT-4 | 100,276 |
| Gemma 4 | 262,144 |
| DeepSeek | 100,000 |
| Qwen 15B | 152,064 |
| Yi | 64,000 |

单语模型通常 30k～50k 已足够；多语言/生产系统需要 100k～250k 以降低不同语言的字节长度。词表越大，输入 embedding 和输出 logits 的参数/带宽成本也越高。

### 8.5 Dropout、weight decay 与正则化

预训练有万亿级 token，通常不会在同一语料上重复很多遍，因此过拟合论据弱于小数据任务。但 weight decay 与学习率 schedule 仍会改变优化动态和最终解。

| 模型 | Dropout | Weight decay |
| --- | ---: | ---: |
| Original Transformer | 0.1 | 0 |
| GPT-2 | 0.1 | 0.1 |
| T5 | 0.1 | 0 |
| GPT-3 | 0.1 | 0.1 |
| T5 v1.1 | 0 | 0 |
| PaLM | 0 | 可变 |
| OPT | 0.1 | 0.1 |
| LLaMA | 0 | 0.1 |
| Qwen 14B | 0.1 | 0.1 |

老模型更常报告 dropout；新模型（Qwen 等除外）常只用 weight decay。研究表明 weight decay 不是简单“防止记忆”，它与 cosine 学习率等共同决定参数尺度和训练动力学。

---

## 9. 稳定训练技巧

### 9.1 输出 softmax 与 z-loss

输出 logits $z\in\mathbb{R}^{V}$ 的 log-sum-exp：

$$
\operatorname{LSE}(z)=\log\sum_{i=1}^{V}e^{z_i}。
$$

softmax/log-softmax 中的指数和除法在 logits 很大时可能溢出或产生不稳定。可加入 z-loss：

$$
\mathcal{L}_{z}=\lambda\left(\operatorname{LSE}(z)\right)^2,
$$

总损失为 $\mathcal{L}+\mathcal{L}_z$，鼓励 logit 的整体归一化常数不要无限变大。PaLM 及后续一些模型使用过此技巧。

### 9.2 QK Norm

attention softmax 的输入是 $q_i k_j^\top/\sqrt{d_h}$。若 Q/K 范数不断变大，logits 会变尖，softmax 梯度可能消失。QK norm 在内积前归一化 Q 和 K：

$$
\tilde q=\operatorname{RMSNorm}(q),
\qquad
\tilde k=\operatorname{RMSNorm}(k),
$$

再计算 $\tilde q\tilde k^\top$。DCLM、OLMo 2、Gemma 2、Qwen 3、Gemma 4 等采用或测试过该技巧。

### 9.3 Logit soft-capping

用有界函数限制 logits：

$$
\tilde z=c\tanh(z/c)，
$$

可防止 logits 爆炸，但会改变大 logit 区域的梯度和性能，需实验验证。

---

## 10. 推理成本相关的注意力变体

这些方法在 Lecture 4 会继续展开；本讲从超参数视角先看它们为什么出现。

### 10.1 MHA、MQA 与 GQA

**MHA**：每个 query head 都有独立的 K/V head；KV Cache 的形状近似 $(B,S,h,d_h)$。

**MQA**：所有 query head 共享一个 K/V head。Q 仍有 $h$ 个，K/V 只有 1 组，KV Cache 大约缩小 $h$ 倍，但表达能力可能略降。

**GQA**：把 query heads 分成若干组，每组共享一组 K/V；令 $h_{kv}<h$，在质量与 KV 显存之间提供旋钮。

增量解码时每次只生成一个 token，Q 投影计算量不一定是瓶颈，K/V cache 的读写更关键。减少 $h_{kv}$ 直接减少内存流量，通常比减少理论 FLOPs 更能改善 latency。

### 10.2 Sparse / Sliding Window Attention

完整注意力让每个 token 读取整个上下文，成本 $O(S^2)$。滑动窗口只读取半径 $w$ 内的 token，成本约：

$$
O(Swd)\quad(w\ll S)。
$$

若每隔若干层插入一次 full attention，局部层负责短程细节，full 层负责长程信息传播，就能在表达能力和成本之间折中。GPT-4/Mistral、LLaMA 4、Gemma 3/4、OLMo 3 等采用过 full + sliding/local 的交错设计。

---

## 11. 设计决策的实用顺序

从零实现或选择架构时，可以按以下顺序检查：

1. **先固定资源预算**：参数量、训练 FLOPs、显存和推理延迟；
2. **选主干**：decoder-only pre-norm Transformer；
3. **选 norm**：通常 RMSNorm，无 bias；
4. **选位置**：RoPE 是当前常见默认；需要超长上下文时评估缩放/插值；
5. **选 FFN**：普通 FFN 用 $4d$，SwiGLU 用约 $8d/3$；
6. **选 head**：先让 $hd_h\approx d$，再按硬件对齐和 GQA 改动；
7. **稳定性**：监测 Q/K 范数、logit、梯度尖峰，必要时 QK norm、z-loss 或 soft-capping；
8. **推理优化**：上下文很长或 decode 成本高时评估 GQA、滑窗、稀疏/线性注意力；
9. **最后才微调细节**：dropout、weight decay、深宽比例和词表大小都要配合真实数据做实验。

### 本讲小结

- 现代 LLM 主要采用 LLaMA-like 的 decoder-only、pre-norm、RoPE、SwiGLU、无 bias 结构；
- LayerNorm 归一化均值和方差，RMSNorm 只归一化 RMS，后者更少数据移动；
- SwiGLU 用门控提升 FFN 表达力，通常将 $d_{ff}$ 缩小到约 $8/3d$；
- RoPE 通过二维旋转使 Q/K 内积依赖相对位置，而不是把位置向量相加；
- 经验超参数有 $d_{ff}=4d$（普通）或约 $8d/3$（GLU）、$hd_h\approx d$、深宽比约 100～200；
- 词表、正则化、稳定性和 GQA/滑窗等选择同时受模型质量、带宽和推理场景影响；
- FLOPs 只是成本的一部分，真正的 architecture design 还要考虑内存、通信、并行和数值稳定性。
