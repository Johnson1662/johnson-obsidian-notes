# Inference & Decoding：大语言模型推理、显存与生成策略

> Stanford CS336 Lecture 10。训练时可以把一整个序列并行送入 Transformer；推理时必须逐 token 生成，因此瓶颈从“算力”转向“显存读写、动态请求调度和生成策略”。
>
> 记号：$B$ 为并发请求数（batch），$S$ 为已知/历史 token 数，$T$ 为本次要计算的 token 数，$D$ 为模型维度，$F$ 为 MLP 中间维度，$N$ 为 query head 数，$K$ 为 key/value head 数，$H$ 为每头维度，$L$ 为层数，$V$ 为词表大小。通常 $F=4D$、$D=NH$；GQA 下 $N=KG$，其中 $G$ 是每个 KV 头服务的 query 头数。

---

## 1. 推理为什么重要

### 1.1 推理出现在哪里

- **实际使用**：聊天机器人、代码补全、Agent、批量文档处理。
- **模型评测**：指令遵循、数学、代码和开放式对话都需要生成。
- **强化学习**：先采样很多回答，再计算奖励或偏好并更新模型。
- **在线服务**：闭源模型供应商和 open-weight 服务商都要长期重复支付推理成本。

训练是一次性的高额成本；推理会随着用户数量、会话长度和 Agent 内部轨迹不断累加。对 Agent 来说，查询 → 工具调用/内部思考 → 最终输出可能产生远多于用户可见文本的 token，因此“生成 token 数”近似决定了计算消耗。

### 1.2 “快”的三种指标

| 指标 | 定义 | 适用场景 |
| --- | --- | --- |
| TTFT（time-to-first-token） | 从请求到第一个输出 token 的时间 | 交互式聊天，用户先感知等待多久 |
| 单请求延迟 | 一个请求生成每个 token 所需的秒数，或完整响应的时间 | 交互式应用 |
| 吞吐（throughput） | 多个请求总共每秒生成的 token 数 | 批处理和服务集群 |

TTFT 主要由 prompt 的 **prefill** 阶段决定；后续 token 的速度主要由 **decode/generation** 阶段决定。低延迟与高吞吐通常存在权衡。

---

## 2. Transformer 计算与 Arithmetic Intensity

### 2.1 矩阵乘法的 FLOPs 与显存读写

考虑 $X\in\mathbb R^{B\times D}$ 与 $W\in\mathbb R^{D\times F}$ 的矩阵乘法 $Y=XW$。按 bf16（每个元素 2 bytes）计：

1. 从 HBM 读 $X$：$2BD$ bytes。
2. 从 HBM 读 $W$：$2DF$ bytes。
3. 计算 $Y$：每次乘加按 2 FLOPs 计，共 $2BDF$ FLOPs。
4. 写回 $Y\in\mathbb R^{B\times F}$：$2BF$ bytes。

因此

$$
\operatorname{FLOPs}=2BDF,
\qquad
\operatorname{Bytes}=2BD+2DF+2BF,
$$

**算术强度（arithmetic intensity）**为每搬运一个 byte 完成的 FLOPs：

$$
I=\frac{2BDF}{2BD+2DF+2BF}
=\frac{BDF}{BD+DF+BF}.
$$

当 $B\ll D,F$ 时，$I\approx B$。批量越大，读一次权重后可以做越多矩阵乘，算术强度越高。

### 2.2 计算受限与显存受限

以 H100 为例，理论峰值约 $989\times10^{12}$ FLOPs/s、HBM 带宽约 $3.35\times10^{12}$ bytes/s，硬件的算术强度分界约为

$$
I_{\mathrm{H100}}
\approx\frac{989\times10^{12}}{3.35\times10^{12}}
\approx295\ \text{FLOPs/byte}.
$$

- $I>I_{\mathrm{H100}}$：**compute-bound**，增加计算吞吐可能有帮助。
- $I<I_{\mathrm{H100}}$：**memory-bound**，时间主要用于把权重/KV cache 从 HBM 搬到计算单元。

极端的 $B=1$ 矩阵向量乘只有约 1 FLOP/byte，读取 $D\times F$ 权重却只做 $2DF$ FLOPs，几乎必然 memory-bound。这正是单请求生成的典型状态。

---

## 3. 从训练到推理：Prefill、Decode 与 KV Cache

### 3.1 朴素生成的浪费

若每次生成下一个 token 都把完整历史重新输入 Transformer，生成第 $t$ 个 token 时要重复计算长度为 $t$ 的 prefix。注意力一次前向约为 $O(t^2)$，连续生成 $T$ 个 token 的总注意力 FLOPs 近似

$$
\sum_{t=1}^{T}O(t^2)=O(T^3).
$$

很多前缀计算在相邻步骤之间完全相同，解决方法是缓存每层的 key/value。

### 3.2 KV Cache 是什么

对每个请求、每个历史 token、每一层和每个 KV head，保存 attention 的 key 向量和 value 向量。生成新 token 时只需计算新的 $Q,K,V$，再用新 $Q$ 与缓存的全部 $K,V$ 做注意力，而不用重新生成旧 token 的 $K,V$。

- **Prefill**：输入 prompt，一次并行编码所有 token；可像训练一样使用大矩阵乘，通常 compute-bound。
- **Decode/Generation**：每次产生一个新 token；$T=1$，需要反复读取权重和不断增长的 KV cache，通常 memory-bound。

KV cache 只保存推理所需的 K/V，不保存训练反向传播所需的全部激活，因此它不等于训练显存。

### 3.3 MLP 的 FLOPs、I/O 与强度

一个 SwiGLU/门控 MLP 有 $W_{up},W_{gate}\in\mathbb R^{D\times F}$ 和 $W_{down}\in\mathbb R^{F\times D}$。忽略逐元素 GeLU/乘法，读写账本为：

$$
\operatorname{FLOPs}_{\mathrm{MLP}}=6BTDF,
$$

$$
\operatorname{Bytes}_{\mathrm{MLP}}
=4BTD+4BTF+6DF.
$$

于是

$$
I_{\mathrm{MLP}}
=\frac{6BTDF}{4BTD+4BTF+6DF}
=\frac{3BTDF}{2BTD+2BTF+3DF}.
$$

当 $BT\ll D,F$ 时，$I_{\mathrm{MLP}}\approx BT$。因此：

- Prefill：$T=S$，强度约为 $BS$，增大 prompt 长度或 batch 容易达到 compute-bound。
- Decode：$T=1$，强度约为 $B$，只有足够多的并发请求才能提高矩阵乘利用率。

### 3.4 Attention 的 FLOPs、I/O 与强度

用 FlashAttention 计算 $QK^\top$ 以及 attention-weighted $V$，其中

$$
Q\in\mathbb R^{B\times T\times D},
\quad K,V\in\mathbb R^{B\times S\times D}.
$$

计算两次矩阵乘：

$$
\operatorname{FLOPs}_{\mathrm{attn}}=4BSTD.
$$

读入 $Q,K,V$ 并写出 $Y$：

$$
\operatorname{Bytes}_{\mathrm{attn}}=4BSD+4BTD.
$$

所以

$$
I_{\mathrm{attn}}
=\frac{4BSTD}{4BSD+4BTD}
=\frac{ST}{S+T}.
$$

两阶段的结果：

| 阶段 | 代入 | Attention 强度 | 结论 |
| --- | --- | ---: | --- |
| Prefill | $T=S$ | $S/2$ | 长 prompt 时较容易 compute-bound |
| Decode | $T=1$ | $S/(S+1)<1$ | 几乎不可能靠 batch 变成 compute-bound |

Attention 强度不含 $B$，因为每条请求有自己的 KV cache；与 MLP 共享同一套权重不同，batch 不能把多条请求的 KV 读写完全摊平。

**阶段总结**：prefill 主要受算力限制；decode 同时受到逐 token 顺序和显存带宽限制，尤其是 attention 的 KV cache 读取。

---

## 4. KV Cache 显存公式与样例

### 4.1 通用公式

每个请求、每层、每个 KV head 保存一个长度为 $H$ 的 K 和一个长度为 $H$ 的 V。若每个元素使用 $b$ bytes（bf16 时 $b=2$），上下文长度为 $S$，则

$$
M_{\mathrm{KV,per\ seq}}
=S\times K\times H\times L\times 2\times b.
$$

batch 为 $B$ 时

$$
M_{\mathrm{KV}}
=B S K H L\,2b.
$$

参数量可按课程代码中的近似式估计：

$$
P\approx 2VD+3DFL+(2DNH+2DKH)L,
$$

其中第一项是输入/输出 embedding（若权重共享，实际可调整），第二项是每层三个 MLP 矩阵，第三项分别是 $Q,O$ 和 $K,V$ 投影。参数显存为

$$
M_\theta=bP,
$$

推理总显存（不含临时 workspace、CUDA graph、碎片和 logits 缓冲）为

$$
M_{\mathrm{total}}
\approx M_\theta+M_{\mathrm{KV}}
=bP+2bBSKHL.
$$

若使用 fp8/int8/int4，应把 $b$ 换成 1、1 或 $0.5$；量化 scale、zero point 和未量化层会增加少量额外开销。

### 4.2 Llama 2 13B 的理论估算

课程代码使用：

- $S=1024,D=5120,F=13824,N=K=40,H=128,L=40,V=32000$；
- bf16（权重和 KV 每元素 2 bytes）；
- H100 HBM 带宽约 $3.35\times10^{12}$ bytes/s；
- 理论上假设计算和通信完全重叠，忽略 kernel/通信/调度开销。

由模型公式得到 $P\approx13.015\times10^9$，参数显存约 $26.03$ GB（十进制）。每条请求的 MHA KV cache：

$$
M_{\mathrm{KV,per\ seq}}
=1024\times40\times128\times40\times2\times2
=838{,}860{,}800\text{ bytes}\approx0.839\text{ GB}.
$$

把每一步的理论时间近似为

$$
\text{latency}\approx \frac{M_{\mathrm{total}}}{3.35\times10^{12}},
\qquad
\text{throughput}\approx\frac{B}{\text{latency}}.
$$

| 注意力配置 | $B$ | 参数显存 (GB) | KV 显存 (GB) | 总显存 (GB) | 理论单步延迟 (ms) | 理论吞吐 (token/s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MHA $K=40$ | 1 | 26.03 | 0.84 | 26.87 | 8.02 | 124.7 |
| MHA $K=40$ | 64 | 26.03 | 53.69 | 79.72 | 23.80 | 2689.5 |
| MHA $K=40$ | 256 | 26.03 | 214.75 | 240.78 | 71.87 | 3561.8 |
| GQA $K=8$ | 1 | 26.03 | 0.17 | 26.20 | 7.82 | 127.9 |
| GQA $K=8$ | 64 | 26.03 | 10.74 | 36.77 | 10.98 | 5831.1 |
| GQA $K=8$ | 256 | 26.03 | 42.95 | 68.98 | 20.59 | 12432.5 |

> 表中 GB 使用十进制 $10^9$ bytes；实际框架还要预留运行时和碎片，因此不能把 80 GB H100 的理论余量全部分配给 KV cache。

结论：增大 batch 会摊薄一次性读取参数的成本，吞吐上升；但 KV cache 按 $O(B)$ 增长，单请求延迟变差，达到显存上限后吞吐收益也会饱和。

### 4.3 延迟与吞吐的部署权衡

- 低 batch：TTFT/单请求延迟较好，吞吐较低。
- 高 batch：吞吐较好，KV cache 占用大，交互延迟变差。
- 复制 $M$ 份完整模型通常能近似保持单副本延迟并把总吞吐提高约 $M$；模型并行/切分则还要支付通信和 KV cache 分片成本。
- Prefill 更适合小 batch，以缩短 TTFT；decode 可以聚合更大的 batch 以提高总体吞吐。

---

## 5. 降低 KV Cache：有损但尽量保精度

推理 memory-bound，因此减少 cache 往往直接减少延迟和增加吞吐；代价是注意力表达能力可能下降。

### 5.1 MHA、MQA 与 GQA

| 形式 | Query heads | KV heads | KV 相对 MHA | 直观解释 |
| --- | ---: | ---: | ---: | --- |
| MHA（multi-head attention） | $N$ | $K=N$ | $1$ | 每个 query head 有独立 K/V |
| MQA（multi-query attention） | $N$ | $K=1$ | $1/N$ | 所有 query head 共享一组 K/V |
| GQA（grouped-query attention） | $N$ | $1<K<N$ | $K/N$ | 每组 query head 共享一个 K/V |

GQA 将 KV cache 减少约 $N/K$ 倍。Llama 2 13B 的课程样例从 $K=40$ 改为 $K=8$，每条序列 cache 约降至五分之一，因而 $B=256$ 可以从理论上超过 80 GB 之外变为约 69 GB（仍需考虑实际开销）。

### 5.2 Multi-head Latent Attention（MLA）

普通注意力缓存

$$
K=W_Kh,\qquad V=W_Vh
$$

需要保存 $N\times H$ 维的 K/V。MLA 改为缓存低维 latent：

$$
 c=W_ch\in\mathbb R^C,
 \qquad K=W_Kc,\quad V=W_Vc,
$$

需要使用时再投影。DeepSeek v2 的示例把 $N H=16384$ 压缩到 $C=512$；由于 RoPE 与 latent 解码不直接兼容，还额外保留 64 个 RoPE 维度，总缓存维度约为 $512+64=576$。缓存明显变小，但需要额外投影和更复杂的实现。

### 5.3 Cross-Layer Attention（CLA）

GQA 在头之间共享 K/V；CLA 进一步在不同层之间共享 K/V。它减少 cache 的层维度，在准确率—缓存大小（从而延迟/吞吐）的 Pareto 前沿上取得改进，但需要验证层间共享不会损害长程信息。

### 5.4 Local / Sliding-Window Attention

只让 token 查看固定窗口的局部上下文：

- 每层 KV cache 只保留窗口内 token，缓存不再随完整序列长度增长。
- 多层堆叠后，有效感受野约随层数线性扩大。
- 局部模式可能伤害需要全局引用的任务；常用混合层，在部分层插入 global attention。

### 5.5 稀疏与压缩注意力

课程提到面向百万上下文的 DeepSeek v4 思路：

- **CSA（Compressed Sparse Attention）**：把每 $m$ 个 token 压缩成一个表示；
- **DSA（DeepSeek Sparse Attention）**：只选 top-$k$ 相关 token；
- **HCA（Heavily Compressed Attention）**：使用更激进的压缩。

核心原则是：优先保留对当前 query 最相关的信息，而不是机械地保存全部历史。

### 5.6 其他方向

线性注意力、状态空间模型（例如 Mamba 2、GatedDeltaNet）用固定大小的状态替代完整 KV；扩散模型式的并行生成也可能改变“逐 token 解码”的瓶颈，但它们需要不同的训练和质量分析。

---

## 6. 量化、剪枝与蒸馏

### 6.1 量化公式

量化把高精度实数映射到有限整数格。给定 scale $s$ 和 zero point $z$：

$$
q=\operatorname{round}\left(\frac{x}{s}\right)+z,
\qquad
\hat{x}=s(q-z).
$$

例如 $x=5.2342,s=0.1,z=4$：$q=\operatorname{round}(52.342)+4=56$，反量化 $\hat x=(56-4)\times0.1=5.2$。误差来自舍入、截断和不同通道动态范围。

### 6.2 精度与占用

| 表示 | 每元素占用 | 典型范围/用途 | 代价 |
| --- | ---: | --- | --- |
| fp32 | 4 bytes | 训练参数、优化器状态 | 显存和带宽大 |
| bf16/fp16 | 2 bytes | 常见推理默认 | 精度较低但硬件友好 |
| fp8（如 H100 e4m3） | 1 byte | 可用于激进训练/推理 | 动态范围与校准要求高 |
| int8 | 1 byte | PTQ/QAT 推理 | 可能比 fp8 更不精确 |
| int4 | 0.5 byte | 极低显存推理 | 量化误差最大，需校准 |

### 6.3 QAT、PTQ、GPTQ 与 AWQ

- **QAT（quantization-aware training）**：前向中模拟量化—反量化，让训练适应量化误差；精度通常更稳，但需要昂贵的再训练。
- **PTQ（post-training quantization）**：训练完成后用校准样本为每层/每个 tensor 求 scale 和 zero point；便宜但更依赖数据代表性。
- **GPTQ**：利用 Hessian/二阶敏感度信息，更新未量化权重以补偿量化误差。
- **AWQ（activation-aware quantization）**：观察到少数 activation channel 数值较大、对应权重更重要；只把约 0.1%–1% 的敏感权重保留较高精度，其余权重量化。课程示例中 fp16 → int3 约减少 4×显存、约带来 3.2×加速（实际取决于 kernel 和硬件）。

减少每次读写的 bytes 是 memory-bound 推理的直接加速路径，但必须在目标任务上复核损失、长上下文和罕见 token 的质量。

### 6.4 结构化剪枝与蒸馏

剪枝直接删除昂贵模型中的层、注意力头或隐藏维度，再用知识蒸馏修复：

1. 在约 1024 个校准样本上评估 `{layer, head, hidden dimension}` 的重要性。
2. 删除不重要组件，得到更小的结构化模型。
3. 用原模型的 logits/中间表示蒸馏到剪枝模型。

“从头训练”流程是先定义快架构、再训练；“蒸馏”流程则是定义快架构 → 用原模型初始化/提供软目标 → 进行 repair/distillation。结构化剪枝比非结构化稀疏更容易得到真实 kernel 加速。

---

## 7. 解码策略：从 logits 到文本

令模型在第 $t$ 步输出 logits $\ell_t(v)$，词表为 $\mathcal V$。温度 $\tau$ 下的概率为

$$
 p_\tau(v\mid x_{<t})
 =\frac{\exp(\ell_t(v)/\tau)}
 {\sum_{u\in\mathcal V}\exp(\ell_t(u)/\tau)}.
$$

$\tau=1$ 是原始分布；$\tau<1$ 使分布更尖锐、结果更确定；$\tau>1$ 使分布更平滑、多样；$\tau\to0^+$ 时趋近 greedy。

### 7.1 Greedy decoding

每一步选最高概率 token：

$$
 y_t=\arg\max_{v\in\mathcal V}p(v\mid y_{<t},x).
$$

优点是速度快、可复现、实现简单；缺点是局部最优、容易重复，不能表达多种合理续写。

### 7.2 Temperature sampling

按 $p_\tau$ 随机采样。高温适合创作和多样输出，低温适合事实/代码等更确定任务。温度不能修复模型分布本身的错误，只是在同一个分布上重新分配随机性。

### 7.3 Top-k sampling

只保留概率最高的 $k$ 个 token：

$$
\mathcal S_k=\operatorname{TopK}(p,k),
\qquad
\tilde p(v)=
\frac{p(v)\mathbf 1[v\in\mathcal S_k]}
 {\sum_{u\in\mathcal S_k}p(u)}.
$$

$k$ 太小会退化成近似 greedy，太大则把长尾噪声重新引入；常与 temperature 联合使用。

### 7.4 Top-p / Nucleus sampling

不固定候选个数，而是取覆盖累计概率至少为 $p$ 的最小集合：

$$
\mathcal S_p=\min\left\{\mathcal S:\sum_{v\in\mathcal S}p(v)\ge p\right\},
$$

然后在 $\mathcal S_p$ 上重归一化采样。分布尖锐时集合小，分布平坦时集合大，通常比固定 top-k 更能适应上下文。

### 7.5 Beam Search

维护 $K$ 条候选序列，每步扩展并保留累计 log probability 最高的 $K$ 条：

$$
\operatorname{score}(y_{1:t})
=\sum_{i=1}^{t}\log p(y_i\mid y_{<i},x).
$$

因为长序列累积的 log probability 必然更低，常使用长度惩罚，例如

$$
\operatorname{score}_{\mathrm{norm}}(y)
=\frac{\sum_i\log p(y_i\mid y_{<i},x)}{t^\alpha},
\qquad 0\le\alpha\le1.
$$

Beam search 是搜索而非随机采样，适合机器翻译等有明确序列目标的任务；在开放式对话中可能降低多样性、产生模板化或重复输出，且计算/显存开销约随 beam 数增加。

### 7.6 实践中的组合

常见解码管线是 temperature → top-k/top-p 过滤 → 采样，再叠加 repetition penalty、no-repeat n-gram 或停止 token。评测时必须固定温度、top-p、最大长度、随机种子和停止规则，否则不同解码器会制造比模型差异更大的方差。

---

## 8. Speculative Decoding：用便宜模型猜、用大模型批量验

### 8.1 为什么可行

Prefill 可以并行处理一段 token，通常比逐 token generation 更容易充分利用 GPU。因此“检查一串候选”比“让大模型逐个生成”便宜。Speculative sampling 利用这个不对称性：小模型先猜，大模型并行验证。

### 8.2 算法

设 draft model 分布为 $p$，target model 分布为 $q$，一次 draft 长度为 $m$（例如 4）：

1. 用小模型 $p$ 顺序采样候选 $y_1,\ldots,y_m$。
2. 把 prompt 和候选串一次性送入大模型 $q$，得到每个位置的 $q_i$。
3. 对第 $i$ 个候选，以
   $$
   a_i=\min\left(1,\frac{q_i(y_i)}{p_i(y_i)}\right)
   $$
   的概率接受。
4. 若首次拒绝发生在位置 $i$，从残差分布采样替代 token：
   $$
   r_i(v)=\frac{\max(q_i(v)-p_i(v),0)}
   {\sum_u\max(q_i(u)-p_i(u),0)}.
   $$
   丢弃其后的 draft token，进入下一轮。
5. 若所有 $m$ 个都接受，再从 target 分布额外采样至少一个 token，避免拒绝采样“整轮不产生 token”。

这不是启发式的“相似就接受”：修正后的拒绝采样对 target 分布是**精确采样（exact sampling）**，前提是 draft 与 target 概率计算一致且实现没有数值/截断偏差。

### 8.3 二词表证明

假设词表为 $\{A,B\}$，draft 概率为 $[p(A),p(B)]$，target 概率为 $[q(A),q(B)]$，且 $p(A)>q(A)$。于是 draft 对 $A$ 过采样，对 $B$ 欠采样，残差为

$$
[\max(q(A)-p(A),0),\max(q(B)-p(B),0)]=[0,1]\ \text{（按比例表示）}.
$$

最终采到 $A$ 的概率：

$$
P(A)=p(A)\frac{q(A)}{p(A)}+p(B)\cdot1\cdot0=q(A).
$$

最终采到 $B$ 的概率：

$$
P(B)=p(B)\cdot1+p(A)\left(1-\frac{q(A)}{p(A)}\right)\cdot1=q(B).
$$

多 token、多词表情况逐位置应用相同的残差构造，因此仍保持 target 分布。

### 8.4 工程要点与 Medusa

- target model 可以是 70B、draft 是 8B；也可以是 8B/1B 等组合。
- draft 越接近 target，接受率越高；可用蒸馏训练 draft。
- **Medusa**：在 target 的隐藏状态上增加多个 draft heads，同时预测多个未来位置，形成候选树，再由原始 target 一次验证；它减少了独立 draft model 的额外开销。
- **EAGLE** 等方法把 target 的高层特征用于 draft，提高候选质量。
- 速度收益取决于接受率、draft 成本、目标模型 prefill/decode 比例和 batch；接受率低时只会增加额外工作。

---

## 9. 动态请求：Continuous Batching 与 PagedAttention

### 9.1 为什么静态 batching 不适合在线推理

训练时 batch 是规则的 $B\times S\times H$ 张量；服务请求则：

1. 到达时间不同，等待最慢请求会使早到请求延迟变大。
2. 请求可能共享 system prompt、或同一 prompt 采样多条回答。
3. 生成长度不同，固定 padding 浪费计算与显存。

### 9.2 Continuous batching / iteration-level scheduling

Orca 等系统在每个 decode iteration 调度：

- 每次只推进一个 token；
- 新请求到达就加入当前 batch；
- 已完成的请求立即退出；
- 不等待整批请求全部结束。

这把“批处理”从一次完整序列变成可动态变化的 token iteration，提高在线吞吐并降低排队延迟。

### 9.3 Selective batching

对于长度为 $[3,H],[9,H],[5,H]$ 的 ragged 序列：

- Attention 部分分别处理各自序列，避免无意义 padding。
- 非 attention 的 MLP/线性层把 token 拼接为 $[3+9+5,H]$，仍可使用高效矩阵乘。

### 9.4 PagedAttention 与碎片

传统服务通常按最大长度一次性为每个请求预留连续 KV cache：

- **内部碎片**：实际生成很短，预留空间未使用。
- **外部碎片**：不同请求的连续预留区之间出现空洞，剩余显存无法满足新请求。

PagedAttention 借鉴操作系统分页：

1. 把一个序列的 KV cache 切成固定大小 block。
2. block 可以在物理显存中非连续存放，用逻辑表映射到物理地址。
3. 只按实际生成长度分配 block，避免大块连续预留。
4. 共享 prefix 时让多个请求指向同一组只读 block，写入新 token 时在 block 级 copy-on-write。

这天然支持共享 system prompt、同 prompt 多次采样和 beam/树搜索。vLLM 还可通过融合 block 读取与 attention、FlashAttention/FlashDecoding、CUDA Graphs 等降低 kernel launch 开销。

---

## 10. 端到端推理优化清单

| 目标 | 主要手段 | 牺牲/风险 |
| --- | --- | --- |
| 降低 TTFT | 优化 prefill kernel、缩小首批 batch、prompt 缓存 | 可能降低总体吞吐 |
| 提高 decode 吞吐 | larger batch、continuous batching、量化 | 单请求延迟/质量可能变差 |
| 降低 KV 显存 | GQA/MQA、MLA、CLA、滑窗、稀疏注意力 | 长程信息或精度损失 |
| 降低参数读写 | fp8/int8/int4、AWQ/GPTQ | 量化误差、校准成本 |
| 减少模型工作量 | 结构化剪枝、蒸馏、更快架构 | 需再训练和质量验证 |
| 减少 target decode 步数 | speculative decoding、Medusa、EAGLE | draft 成本、接受率不确定 |
| 处理动态请求 | continuous batching、selective batching、PagedAttention | 调度和实现复杂度 |

---

## 11. 本讲总结

- 推理包含并行的 prefill 和顺序的 decode；前者偏 compute-bound，后者偏 memory-bound。
- KV cache 把重复的历史 K/V 计算变成显存占用；其核心公式是
  $$M_{\mathrm{KV}}=2bBSKHL.$$
- MLP 的强度约为 $BT$，attention 的强度为 $ST/(S+T)$；decode attention 小于 1，说明仅靠 batch 很难解决带宽瓶颈。
- 低维 KV（GQA、MLA、CLA）、局部/稀疏注意力、量化和结构化剪枝都在减少 bytes；必须在质量和真实硬件上复核。
- Greedy、temperature、top-k、top-p 和 beam search 是不同的概率/搜索约束，评测必须固定解码配置。
- Speculative sampling 利用“检查比生成快”的不对称性，在 draft 候选上进行 target 验证，并通过残差拒绝采样保持精确 target 分布；Medusa 用多个 heads 并行提议未来 token。
- 在线服务需要 continuous batching、selective batching 和 PagedAttention，把操作系统的调度/分页思想用于动态 KV cache。
