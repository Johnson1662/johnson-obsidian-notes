# CS336 Lecture 4：Attention Alternatives 与 Mixture of Experts

> **核心问题**：完整 attention 的 $O(S^2)$ 成本如何随上下文长度增长？线性注意力、状态空间模型（SSM/Mamba）、稀疏注意力各自牺牲什么、换来什么？MoE 如何在保持每 token 激活计算量可控的同时扩展总参数？

---

## 1. 为什么需要 Attention Alternatives

### 1.1 完整 attention 的瓶颈

对 $Q,K\in\mathbb{R}^{S\times d_k}$、$V\in\mathbb{R}^{S\times d_v}$：

$$
\operatorname{Attn}(Q,K,V)
=\rho(QK^\top)V,
$$

其中 $\rho$ 通常是带缩放和 causal mask 的 softmax。计算 $QK^\top$ 会产生 $S\times S$ 的分数矩阵：

- 时间复杂度约 $O(S^2d_k+S^2d_v)$；
- 训练中间激活显存约 $O(BhS^2)$；
- 增长上下文长度时，成本比线性层更快地上升；
- 增量解码虽只算一个新 query，但需要反复读取不断增长的 KV Cache，常受内存带宽限制。

因此需要在**全局可访问性、表达能力、训练并行度、推理内存**之间折中。

### 1.2 工程上最基本的工具箱

1. **局部/滑动窗口 attention**：每个 token 只看邻域；
2. **周期性 full attention**：让信息隔若干层全局传播；
3. **系统优化**：FlashAttention、融合 kernel、KV Cache、GQA/MQA；
4. **更激进的替代**：线性 attention、SSM/Mamba、稀疏检索 attention。

局部+全局是最容易部署的方案；下面的线性/递归方法则尝试把上下文复杂度真正降到线性。

---

## 2. Linear Attention

### 2.1 从结合律重排开始

先忽略 softmax，令 $\rho$ 为恒等函数：

$$
QK^\top V
=Q(K^\top V)。
$$

原始顺序先形成 $S\times S$ 矩阵：

$$
QK^\top: O(S^2d_k),
\qquad
(QK^\top)V: O(S^2d_v)。
$$

重排后先计算小矩阵 $K^\top V\in\mathbb{R}^{d_k\times d_v}$：

$$
K^\top V: O(Sd_kd_v),
\qquad
Q(K^\top V):O(Sd_kd_v)，
$$

总计约 $2Sd_kd_v$，对 $S$ 是线性的（当 $d_k,d_v$ 相对固定）。这一步看似只是结合律，却改变了超长上下文的渐近复杂度。

### 2.2 Kernelized linear attention

softmax 不能直接使用矩阵乘法结合律。常见做法是寻找特征映射 $\phi$，近似：

$$
\exp(q^\top k)\approx \phi(q)^\top\phi(k)。
$$

则：

$$
\operatorname{Attn}(q_t)
\approx
\frac{\phi(q_t)^\top\left(\sum_{i\le t}\phi(k_i)v_i^\top\right)}
{\phi(q_t)^\top\left(\sum_{i\le t}\phi(k_i)\right)}。
$$

分子需要维护矩阵状态，分母维护向量状态。不同 kernel 映射会带来不同的近似误差和数值行为。

### 2.3 递归形式：把 attention 变成 RNN

定义状态：

$$
S_t=S_{t-1}+k_tv_t^\top,
\qquad
y_t=q_t^\top S_t。
$$

若还需要归一化，可同时维护 $z_t=z_{t-1}+k_t$，用 $q_t^\top z_t$ 作分母。

这产生重要的 duality：

| 场景 | 适合的形式 | 原因 |
| --- | --- | --- |
| 训练 | 并行的 $Q(K^\top V)$ 或分块扫描 | 大量 token 可同时处理 |
| 自回归推理 | 递归状态 $S_t$ | 每步只更新一个状态，内存不随完整 KV 线性增长 |

它看起来像 RNN，但仍可用矩阵并行技巧训练。若把旧状态乘以衰减系数 $\gamma$：

$$
S_t=\gamma S_{t-1}+k_tv_t^\top，
$$

就得到 RetNet 一类的衰减状态更新。

### 2.4 代码骨架

```python
# q: (B, S, Dk), k: (B, S, Dk), v: (B, S, Dv)
def linear_attention(q, k, v):
    # 并行形式；训练时可用 einsum/fused kernel
    state = torch.einsum("bsd,bsv->bdv", k, v)   # K^T V
    return torch.einsum("bsd,bdv->bsv", q, state) # Q(K^T V)

def recurrent_linear_attention(q, k, v):
    state = torch.zeros(q.size(0), q.size(-1), v.size(-1), device=q.device)
    outputs = []
    for t in range(q.size(1)):
        state = state + k[:, t, :, None] * v[:, t, None, :]
        outputs.append(torch.einsum("bd,bdv->bv", q[:, t], state))
    return torch.stack(outputs, dim=1)
```

教学代码的循环不是高性能实现，实际训练应使用 scan、块并行和融合 kernel；它只用于显示二者的数学等价关系。

---

## 3. 从 Linear Attention 到 Mamba-2

### 3.1 门控状态衰减

普通线性 attention 永远累加历史，状态可能不断增大，也难以选择性遗忘。Mamba-2 引入输入依赖的门控衰减：

$$
S_t=\gamma_tS_{t-1}+k_tv_t^\top,
\qquad
y_t=q_t^\top S_t+v_t^\top D,
$$

$$
\gamma_t=f(x_t)。
$$

- $\gamma_t$ 控制保留多少旧状态；
- $k_tv_t^\top$ 写入当前信息；
- $v_t^\top D$ 是额外的逐通道直连项；
- 门控让模型能根据输入内容决定“记住/忘掉”什么。

Mamba-2 仍具有并行/递归 duality：训练时并行计算门控 scan，推理时维护固定大小状态。Minimax M1 等模型使用了类似 **7 个线性层 + 1 个 full attention 层**的混合结构，并观察到随上下文长度近似线性的推理开销。

### 3.2 Gated Delta Net：选择性擦除

再进一步，对旧状态施加沿当前 key 方向的擦除操作：

$$
S_t
=\gamma_t\left(I-\beta_t k_tk_t^\top\right)S_{t-1}
+\beta_t k_tv_t^\top,
$$

$$
 y_t=q_t^\top S_t,
\qquad
\gamma_t=f_\gamma(x_t),\quad
\beta_t=f_\beta(x_t)。
$$

解释：

- $\gamma_t$：整体保留/遗忘旧状态；
- $\beta_t=0$：执行“无输入”或不写入操作；
- $I-\beta_t k_tk_t^\top$：沿当前 key 方向擦掉与新信息冲突的旧内容；
- $\beta_t k_tv_t^\top$：把新 key-value 关系写入状态。

它与 fast weight programming、test-time training 等思想有密切联系：状态不是简单的缓存，而是在序列中在线更新的小型记忆矩阵。

### 3.3 混合架构的经验

Qwen 3.5/Qwen Next 等较新的设计使用约 3 个 GDN/线性层配 1 个 attention 层；Nemotron 等也使用 Mamba-attention hybrid。实验控制通常还不充分，但已有证据表明在较小 hybrid 比例下可以保持低 loss，同时改善长上下文推理特性。

---

## 4. Sparse Attention 与 DeepSeek Sparse Attention

### 4.1 滑动窗口与结构化稀疏

设每个 query 只连接 $w$ 个 key，则：

$$
\text{成本}=O(Swd),
\qquad w\ll S。
$$

局部窗口能很好处理短程模式，但单层无法直接读取很远的 token。解决方式包括：

- 不同层使用不同窗口；
- 每隔 $r$ 层插入 full attention；
- 层间使用全局 token、摘要 token 或块级连接；
- 按内容而非固定距离动态选择 key。

Cohere Command A 等模型使用每 4 层一次 full attention 的模式：局部层负责短程信息，full 层负责全局传播；LLaMA 4、Gemma 3/4、OLMo 3 等也探索 full 与 sliding window 的交错。

### 4.2 DSA：内容索引器 + 稀疏读取

DeepSeek Sparse Attention（DSA，DeepSeek v3.2、GLM5 等相关方向）的基本流程：

1. 用轻量 **indexer** 为 query 与上下文块计算相关性；
2. 选择 top-$k$ 个 token/block；
3. 只对选中的 key/value 执行完整 attention；
4. 让 indexer 的成本远小于省下的 full attention。

复杂度近似从 $O(S^2d)$ 变为：

$$
O(Skd)+O(\text{indexer})，
\qquad k\ll S。
$$

轻量 indexer 还可以在已经完成 dense 短上下文预训练后做 post-hoc adaptation，而不必从零重训整个模型。

**代价**：检索错误会丢失关键信息；动态稀疏模式会带来 kernel 和负载均衡复杂度，不能只看理论 FLOPs。

---

## 5. 什么是 Mixture of Experts（MoE）

### 5.1 用很多小路由专家替换一个大 FFN

Dense Transformer 的每层 FFN 对所有 token 激活同一组参数。MoE 把一个大 FFN 替换为 $N$ 个专家网络和一个 router：

$$
\operatorname{MoE}(x)=\sum_{e\in\mathcal{T}(x)}g_e(x)E_e(x)，
$$

- $E_e$：第 $e$ 个 expert，通常是 FFN；
- $g_e(x)$：router 给出的权重；
- $\mathcal{T}(x)$：token 被选中的 top-$k$ 专家集合。

总参数量可以随 $N$ 增长，但每个 token 只激活 $k$ 个 expert，因此 active FLOPs 主要由 $k$ 而不是 $N$ 决定：

$$
P_{total}\approx N P_{expert}+P_{shared},
\qquad
F_{token}\approx kF_{expert}+F_{router}。
$$

这解释了 MoE 的吸引力：在近似相同 active FLOPs 下，更多参数提供更多容量，很多实验观察到更低 loss、更快达到同等质量，且专家可以分布到多个设备并行计算。

### 5.2 Dense 与 MoE 对比

| 维度 | Dense FFN | MoE FFN |
| --- | --- | --- |
| 总参数 | 一个专家 | $N$ 个专家（可加 shared experts） |
| 每 token 激活 | 全部 | top-$k$ |
| 容量 | 受单个 FFN 限制 | 总容量大，专家可分工 |
| 训练/推理 FLOPs | 稳定、简单 | 约与 $k$ 成正比 |
| 系统复杂度 | 低 | 路由、capacity、all-to-all、负载均衡 |
| 风险 | 表达容量有限 | 专家塌缩、token dropping、路由不稳定 |

MoE 通常放在 FFN 位置，也有少数工作尝试让 attention head 成为专家；前者是主流。

---

## 6. Top-k 路由的数学与实现

### 6.1 Router 打分

对 token 表示 $x_t\in\mathbb{R}^{d}$，router 产生 $N$ 个 logits：

$$
 r_t=x_tW_r\in\mathbb{R}^{N},
\qquad
p_t=\operatorname{softmax}(r_t)。
$$

取最大 $k$ 个专家：

$$
\mathcal{T}_t=\operatorname{TopK}(p_t,k)。
$$

对选中专家重新归一化：

$$
\tilde p_{t,e}=
\frac{p_{t,e}}{\sum_{j\in\mathcal{T}_t}p_{t,j}},
\quad e\in\mathcal{T}_t。
$$

最终：

$$
 y_t=\sum_{e\in\mathcal{T}_t}\tilde p_{t,e}E_e(x_t)。
$$

### 6.2 路由变体

| 方法 | $k$ 或机制 | 例子/特点 |
| --- | --- | --- |
| Switch | $k=1$ | 路由和通信最简单 |
| Top-2 | $k=2$ | GShard、Grok、Mixtral 常见 |
| Top-4 | $k=4$ | Qwen、DBRX 等 |
| Top-7/8 | 较多 active experts | DeepSeek 等更细粒度专家 |
| Hash routing | 哈希决定专家 | 不需要可学习 top-k，作为 baseline |
| RL routing | REINFORCE 学路由 | 理论直接但方差和复杂度高 |
| Matching/assignment | 解匹配问题 | 追求全局均衡，代价高 |

大多数现代 MoE 仍使用 token-choice top-k：每个 token 选择专家。也可以反过来由 expert 选择 token，但工程实现更复杂。

### 6.3 PyTorch 路由骨架

```python
class TopKMoE(nn.Module):
    def __init__(self, d_model, d_ff, n_experts, k=2):
        super().__init__()
        self.router = nn.Linear(d_model, n_experts, bias=False)
        self.experts = nn.ModuleList([
            SwiGLU(d_model, d_ff) for _ in range(n_experts)
        ])
        self.k = k

    def forward(self, x):                 # x: (tokens, d_model)
        logits = self.router(x).float()   # router 常用 FP32
        probs = logits.softmax(dim=-1)
        top_p, top_i = probs.topk(self.k, dim=-1)
        top_p = top_p / top_p.sum(dim=-1, keepdim=True)
        out = torch.zeros_like(x)
        for e, expert in enumerate(self.experts):
            token_pos, slot = torch.where(top_i == e)
            if token_pos.numel() == 0:
                continue
            y = expert(x[token_pos])
            out.index_add_(0, token_pos, y * top_p[token_pos, slot, None])
        return out
```

代码为了清楚而用 Python 循环；生产实现会把 token 按 expert 排序、padding 到 capacity，用 grouped/sparse matmul 和 all-to-all 避免逐专家循环。

---

## 7. Expert Capacity 与 Token Dropping

### 7.1 为什么要设置容量

一个 batch 中若大量 token 选中同一专家，该专家会溢出显存或拖慢所有设备。设：

- token 数为 $T=B\times S$；
- 专家数 $N$；
- 每 token 路由到 $k$ 个专家；
- capacity factor 为 $c\ge1$。

每个专家的容量（可处理 token 槽位）通常设为：

$$
C=\left\lceil c\cdot\frac{Tk}{N}\right\rceil。
$$

- $c=1$：理想均匀路由下刚好够用，但稍有偏斜就丢 token；
- $c>1$：更少丢弃，但 padding/计算/显存增加；
- 超过 $C$ 的 token 会被 drop、跳过该专家，或走 residual/备用路径。

Capacity 是质量和系统吞吐之间的直接旋钮。

### 7.2 负载不均的后果

若专家利用率极不平衡：

- 热门专家成为吞吐瓶颈；
- 冷门专家参数训练不足，出现 expert collapse；
- all-to-all 流量和 padding 浪费增加；
- token dropping 使结果依赖同 batch 中其他人的路由。

因此 MoE 训练必须让路由既保持稀疏，又尽量均匀。

---

## 8. MoE 的负载均衡与不可微路由

### 8.1 为什么需要辅助损失

`TopK` 是离散选择，不可直接对选择结果求普通梯度。解决途径：

1. 用 REINFORCE 等强化学习优化路由；
2. 在 logits 上加入随机扰动，使路由更平滑/鲁棒；
3. 使用启发式 load-balancing auxiliary loss（实践主流）。

### 8.2 Switch Transformer auxiliary loss

对一个 batch 定义：

- $f_i$：实际被路由到专家 $i$ 的 token 比例；
- $P_i$：router 对专家 $i$ 的平均概率；
- $N$：专家数。

典型辅助损失：

$$
\mathcal{L}_{aux}
=\alpha N\sum_{i=1}^{N}f_iP_i。
$$

如果路由完全均匀，$f_i=P_i=1/N$，则：

$$
\mathcal{L}_{aux}
=\alpha N\cdot N\cdot\frac1{N^2}=\alpha。
$$

某个专家若被频繁选中且概率也大，乘积 $f_iP_i$ 会升高，梯度会把概率推向其他专家；这相当于对“热门专家”施加更强下权重。

实际总目标：

$$
\mathcal{L}=\mathcal{L}_{LM}+\mathcal{L}_{aux}。
$$

辅助损失系数 $\alpha$ 太大可能干扰语言建模，太小则负载不均。

### 8.3 每专家与每设备均衡

多机训练时仅平衡全局 expert token 数还不够：

- **per-expert balance**：每个专家收到的 token 数接近；
- **per-device balance**：每台设备上驻留的专家总工作量接近，减少跨设备通信拥塞。

DeepSeek v1/v2 同时考虑专家与设备；v2 还引入通信方向上的 balancing objective（平衡发送和接收）。

### 8.4 随机路由扰动

Shazeer 等早期工作向 router logits 加 Gaussian noise：

$$
\tilde r_{t,i}=r_{t,i}+\epsilon_{t,i},
\qquad
\epsilon_{t,i}\sim\mathcal{N}(0,\sigma_i^2(x_t))。
$$

优点：

- 让专家对微小输入变化更鲁棒；
- softmax 学会相对排名，而不是过早锁死单一专家。

Fedus 等使用过 uniform multiplicative jitter；后续工作发现可以移除或改动该扰动。

### 8.5 Auxiliary-loss-free bias

DeepSeek v3 为每个专家维护一个 bias $b_i$，用于影响被选中的概率，但不把它直接放进主语言建模损失。在线统计负载后：

- 过载专家降低 bias；
- 低载专家提高 bias；
- 让未来 token 更可能流向空闲专家。

抽象更新可写为：

$$
 b_i\leftarrow b_i+\eta\,\operatorname{sign}(\text{target load}-\text{observed load}_i)。
$$

称为“auxiliary-loss-free balancing”，但实际完整系统仍可能使用 sequence-wise loss 或其他均衡项，不能简单理解为完全没有任何辅助目标。

---

## 9. 分布式 MoE：路由就是通信

### 9.1 Expert parallel 的 All-to-All

当专家分布在不同 GPU 上，token 必须经过以下流程：

```text
本地 token 表示
   ↓ router top-k
按目标 expert 分桶、padding 到 capacity
   ↓ all-to-all dispatch
远端 GPU 上的 expert FFN
   ↓ all-to-all combine
恢复原 token 顺序并按 gate 加权
   ↓ residual + 下一层
```

all-to-all 的发送量近似与 $Tkd$ 成正比，且受互联拓扑和最慢设备影响。即使理论 FLOPs 低，通信也可能成为瓶颈。

### 9.2 为什么 MoE 适合多设备但实现复杂

优点：

- 每个 expert 可以放进单个设备或一组设备；
- 不同 expert 的矩阵乘法天然并行；
- 总参数可以跨大量 GPU 扩展。

复杂性：

- 动态 token 数导致负载不规则；
- capacity padding 和 token dropping；
- all-to-all 发送/接收 buffer；
- 与 data/tensor/pipeline parallel 组合时需要额外布局；
- 稀疏矩阵乘法 kernel 需要按 token 分组。

MegaBlocks 等库使用 block-sparse/grouped matmul 提高实际利用率；一些 Nemotron 设计先降维 activation，再通信以降低 all-to-all 数据量。

### 9.3 路由伪代码

```python
# hidden: (T, d), router_logits: (T, N)
probs = router_logits.float().softmax(-1)
weights, experts = probs.topk(k, dim=-1)
capacity = math.ceil(capacity_factor * T * k / N)

# 1. 为每个 (token, expert) 分配槽位，超过 capacity 的路由丢弃/走 fallback
# 2. 按 expert/device 对 token 重排并 all_to_all
# 3. 每个本地 expert 批量执行 FFN
# 4. all_to_all 返回，按 token id 恢复顺序
# 5. output[token] += weight * expert_output
```

---

## 10. MoE 的训练与微调问题

### 10.1 稳定性

router softmax 对 logits 很敏感；低精度下更容易产生溢出、NaN 或路由塌缩。常见做法：

- router logits/softmax 使用 FP32，即使主网络是 BF16/FP8；
- 对 router 加 z-loss，约束 $\operatorname{LSE}(r_t)$；
- 监测每专家 token 数、最大/平均负载、drop rate；
- 选择合适 capacity factor 和辅助损失系数。

### 10.2 Batch-level stochasticity

token dropping 往往按 batch 的 capacity 决定。因此某个用户的 token 是否被保留，可能取决于同一 batch 中其他用户的路由——MoE 比 dense 模型具有额外随机性。这会影响复现性、在线服务尾延迟和评估稳定性。

### 10.3 小数据微调容易过拟合

稀疏 MoE 在小规模 SFT 数据上可能比 dense MLP 更容易过拟合：每个专家看到的数据更少，路由也可能偏向少数模式。常见方案：

- 微调时把 MoE 临时替换成 dense MLP；
- 使用足够多的高质量数据（DeepSeek 报告约 1.4M SFT 样本的路线）；
- 继续保留路由但调整正则化/均衡目标。

### 10.4 Upcycling：从 dense checkpoint 初始化 MoE

Upcycling 的问题是：能否把已训练的 dense LM 变成 MoE，而非从随机专家开始？常见做法：

1. 复制 dense FFN 权重初始化多个 expert；
2. 初始化 router（或让 shared expert 保留原路径）；
3. 在更多 token 上继续训练，让专家分化。

MiniCPM 与 Qwen MoE 等实验显示，top-k=2/4、多专家和 shared expert 的 upcycling 可以在相对有限的额外训练后超过原 dense 基线。复制并不意味着专家永远相同，后续路由梯度会促使它们专门化。

---

## 11. 近期 MoE 路由配置

| 模型 | Routed experts | Active experts/token | Shared experts | Fine-grained ratio（约） |
| --- | ---: | ---: | ---: | ---: |
| GShard | 2048 | 2 | 0 | — |
| Switch Transformer | 64 | 1 | 0 | — |
| ST-MoE | 64 | 2 | 0 | — |
| Mixtral | 8 | 2 | 0 | — |
| DBRX | 16 | 4 | 0 | — |
| Grok | 8 | 2 | 0 | — |
| DeepSeek v1 | 64 | 6 | 2 | 1/4 |
| Qwen 1.5 MoE | 60 | 4 | 4 | 1/8 |
| DeepSeek v3 | 256/258 | 8 | 1 | 1/14 |
| OlMoE | 64 | 8 | 0 | 1/8 |
| MiniMax | 32 | 2 | 0 | 约 1/4 |
| Llama 4 Maverick | 128 | 1 | 1 | 1/2 |

“Fine-grained”通常表示把一个较大的 expert 拆成更多较小 expert，再增加 active 数，让总 active 参数相近但路由粒度更细。

---

## 12. DeepSeek MoE v1 → v2 → v3

### 12.1 DeepSeek MoE v1

约 16B 总参数、约 2.8B active：

- 2 个 shared experts；
- 64 个 fine-grained routed experts，选中 6 个左右（共享与路由组合后 active 约 2.8B）；
- 标准 top-k router；
- expert-level + device-level auxiliary balancing loss。

### 12.2 DeepSeek MoE v2

约 236B 总参数、约 21B active：

- 2 个 shared experts；
- 160 个 fine-grained experts，路由选 6 个；
- 引入 top-M device routing；
- 同时平衡通信进入/离开设备的负载，避免“专家均匀但设备拥塞”。

### 12.3 DeepSeek MoE v3

约 671B 总参数、约 37B active：

- 1 个 shared expert；
- 约 256/258 个 routed experts，active 8；
- sigmoid + softmax 的 top-k 组合；
- top-M device routing；
- per-expert bias 的 auxiliary-loss-free balancing；
- sequence-wise auxiliary objective。

MoE 只是 DeepSeek v3 的一部分，还需要高效注意力和训练/推理技巧。

---

## 13. MLA、RoPE 兼容性与 MTP（补充）

### 13.1 Multi-head Latent Attention（MLA）

MLA 把 Q/K/V 表示为低维 latent activation $c_t$ 的函数：

$$
q_t=c_tW_Q,
\qquad
k_t=c_tW_{UK},
\qquad
v_t=c_tW_{UV}。
$$

解码时只需缓存低维 $c_t^{KV}$，而不是完整每头 K/V：

$$
\text{KV cache size}\propto\dim(c_t^{KV})
\ll h d_h。
$$

没有 RoPE 时，$W_{UK}$ 可以合并到 Q 投影中；有 RoPE 时，旋转矩阵同时作用于 query/key，低维压缩与旋转不完全交换：

$$
q^R=hW_QR_q,
\qquad
k^R=R_kW_{UK}c_t^{KV}。
$$

因此 DeepSeek 等实现保留少量 non-latent key dimensions 供 RoPE 旋转，其余维度走 latent cache。这是缓存压缩与相对位置编码之间的工程折中。

### 13.2 Multi-Token Prediction（MTP）

MTP 使用轻量预测头/小模型预测未来多个 token，训练时提供额外监督，推理时可作为 speculative decoding 的 draft。DeepSeek v3 只采用 one-token-ahead 的 MTP 变体；EAGLE 等工作则进一步研究多步草稿。

---

## 14. 选型总结：哪种替代方案适合什么场景

| 方案 | 训练复杂度 | 解码状态 | 全局建模 | 主要优点 | 主要风险 |
| --- | --- | --- | --- | --- | --- |
| Full attention | $O(S^2)$ | KV cache 随 $S$ 增长 | 强 | 质量和实现成熟 | 长上下文成本高 |
| Sliding/sparse | 约 $O(Sw)$ 或 $O(Sk)$ | 稀疏 KV/索引 | 依赖全局层 | 直接、可工程化 | 可能漏掉远程依赖 |
| Linear attention | $O(Sd_kd_v)$ | 固定状态矩阵 | 近似/核特征 | 线性上下文、低 cache | softmax 近似和表达损失 |
| Mamba/GDN/SSM | 线性 scan | 固定/小状态 | 通过递归记忆 | 快速解码、门控遗忘 | 并行与长程检索能力需验证 |
| MoE（FFN 替换） | 与 active $k$ 相关 | 路由+专家 | 参数容量大 | 同 FLOPs 更多参数 | all-to-all、均衡、稳定性 |

最终实践往往是混合：局部/full attention、线性/SSM 层与 attention 层交错，FFN 用 MoE 扩容，再用 GQA/MLA 压缩推理缓存。

### 本讲小结

- Full attention 的 $S^2$ 计算和 $BhS^2$ 激活显存是长上下文主要瓶颈；
- 线性 attention 用 $Q(K^TV)$ 重排把复杂度降为线性，并可写成递归状态；
- Mamba-2 通过 $\gamma_t$ 门控遗忘，Gated Delta Net 再沿 key 方向选择性擦除；
- 稀疏/滑窗/DSA 只读取局部或检索出的关键 token，节省成本但依赖索引质量和结构设计；
- MoE 用 router 的 top-k 选择少数 FFN expert，在保持 active FLOPs 可控的同时增加总参数；
- Capacity factor $C=\lceil cTk/N\rceil$、load-balancing loss、device balance 和 all-to-all 是 MoE 的核心系统问题；
- router 常用 FP32、z-loss 和 bias balancing 以提高稳定性；小数据微调可过拟合，upcycling 是从 dense checkpoint 转 MoE 的实用路径；
- 深入理解这些替代方案的关键不是背模型名称，而是同时核算计算量、状态大小、通信和信息表达能力。
