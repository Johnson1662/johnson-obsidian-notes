# CS336 Lecture 4: 长上下文注意力替代方案与 Mixture of Experts (MoE)

标准 Multi-Head Attention 在处理长序列时面临**计算量平方增长 $O(S^2 d)$** 与 **KV Cache 显存线性膨胀 $O(S \cdot d)$** 的双重瓶颈。同时，Dense 架构在扩大参数量时计算成本同比例上升。本讲分析两种前沿解法：**亚二次复杂度注意力替代模型** 与 **条件计算稀疏架构 (MoE)**。

---

## 1. 为什么自注意力在长序列失效

设序列长度为 $S$，隐藏维度为 $d$：
$$
\text{Attention}(Q, K, V) = \text{Softmax}\left(\frac{Q K^\top}{\sqrt{d_k}}\right) V
$$
1. **计算复杂度**：$Q K^\top$ 矩阵乘法需要 $2 S^2 d$ FLOPs，当 $S = 128\text{K}$ 时，计算量比 $S = 2\text{K}$ 激增 **4096 倍**。
2. **显存复杂度**：自回归生成需要缓存历史所有 Token 的 $K, V$ 向量，显存无法释放。

---

## 2. 长上下文注意力替代方案 (Sub-Quadratic Architectures)

```
                       +-----------------------------------+
                       |    长序列建模方案 (Sequence Models)  |
                       +-----------------+-----------------+
                                         |
            +----------------------------+----------------------------+
            |                                                         |
  +---------v---------+                                     +---------v---------+
  | 稀疏/窗口注意力    |                                     | 循环与状态空间模型 |
  | (Sparse/Local)    |                                     | (SSM & Recurrent) |
  +---------+---------+                                     +---------+---------+
            |                                                         |
  - Sliding Window (Mistral)                                - Linear Attention (Katharopoulos 2020)
  - Dilated/Block Sparse (Longformer)                       - Mamba 1/2 (Gu & Dao 2023/2024)
  - Local + Global Token (BigBird)                          - Gated DeltaNet (Schlag 2024)
```

### 2.1 线性注意力 (Linear Attention)
通过核函数将 Softmax 拆解：$\text{Softmax}(Q K^\top) \approx \phi(Q) \phi(K)^\top$（其中 $\phi(x) = \text{elu}(x) + 1$ 或 $\text{ReLU}(x)$）：
$$
O = (\phi(Q) \phi(K)^\top) V = \phi(Q) \left( \phi(K)^\top V \right)
$$
- **训练阶段（并行矩阵乘法）**：先算 $M = \phi(K)^\top V \in \mathbb{R}^{d \times d}$，再算 $\phi(Q) M$，复杂度降为 $O(S \cdot d^2)$。
- **推理阶段（RNN 递推形式）**：
  $$
  S_t = S_{t-1} + \phi(k_t) v_t^\top \in \mathbb{R}^{d \times d}, \quad o_t = \phi(q_t) S_t
  $$
  **推理 KV Cache 显存为 $O(d^2)$ 常数**，完全独立于序列长度 $S$。

### 2.2 状态空间模型 (SSM) 与 Mamba
Mamba 基于连续线性时不变系统（LTI）离散化，并引入输入自适应选择机制（Selective Scan）：
$$
\begin{aligned}
h_t &= \bar{A}_t h_{t-1} + \bar{B}_t x_t \\
y_t &= C_t h_t
\end{aligned}
$$
- 矩阵 $A, B, C, \Delta$ 随输入 $x_t$ 动态变化（Selective Mechanism），使模型具备像注意力一样的“信息过滤与精确召回”能力。
- **硬件感知并行扫描 (Hardware-aware Parallel Scan)**：利用 GPU SRAM 融合前缀和扫描，避免 HBM 频繁搬运。
- **Mamba-2 与注意力的统一**：证明了结构化 SSM 与线性注意力在数学上等价为半可分离矩阵变换（State Space Duality, SSD）。

---

## 3. Mixture of Experts (MoE) 架构原理

MoE 将标准 Transformer 的 FFN 层替换为一组平行的专家网络（Experts $\{E_1, E_2, \dots, E_N\}$），每个 Token 仅动态激活其中极少数专家（如 $k = 2$ 或 $k = 8$）。

### 3.1 门控路由网络 (Gating / Router Mechanism)
设输入张量为 $x \in \mathbb{R}^d$，路由器权重为 $W_g \in \mathbb{R}^{d \times N}$：
1. **计算路由亲和度得分**：
   $$
   H(x) = x W_g \in \mathbb{R}^N
   $$
2. **Top-$k$ 离散选择与 Softmax 归一化**：
   $$
   \text{TopK}(H(x), k) = \text{选出得分最高的 } k \text{ 个专家索引集合 } \mathcal{T}
   $$
   $$
   g_i(x) = \begin{cases} \frac{\exp(H(x)_i)}{\sum_{j \in \mathcal{T}} \exp(H(x)_j)}, & i \in \mathcal{T} \\ 0, & i \notin \mathcal{T} \end{cases}
   $$
3. **专家输出加权汇聚**：
   $$
   y = \sum_{i \in \mathcal{T}} g_i(x) \cdot E_i(x)
   $$

### 3.2 负载均衡辅助损失 (Load Balancing Auxiliary Loss)
若门控网络自由优化，极易出现**富者愈富（Routing Collapse）**：少数专家被选中处理所有 Token，其余专家彻底“冻结”。

Switch Transformer 引入辅助损失强制负载均衡：
$$
\mathcal{L}_{\text{aux}} = \alpha \cdot N \sum_{i=1}^N f_i \cdot P_i
$$
- $f_i = \frac{1}{T} \sum_{t=1}^T \mathbb{I}(\text{Token } t \text{ 路由至专家 } i)$：专家 $i$ 实际分配到的 Token 比例。
- $P_i = \frac{1}{T} \sum_{t=1}^T \text{Softmax}(H(x_t))_i$：模型分配给专家 $i$ 的平滑概率期望。
- 当 $f_i$ 与 $P_i$ 均为均匀分布 $1/N$ 时，$\mathcal{L}_{\text{aux}}$ 取得最小值。

### 3.3 专家容量因子 (Capacity Factor) 与 Token 丢弃
在分布式专家并行（Expert Parallelism, EP）中，每张 GPU 分配若干专家。为避免单卡显存溢出与等待延迟，系统设定**专家容量（Expert Capacity）**：
$$
\text{Capacity} = \left( \frac{\text{Tokens per Batch}}{N} \right) \times \text{Capacity Factor}
$$
- 若路由到某专家的 Token 数超过 Capacity，超额 Token 将被**丢弃（Dropped）**，直接通过残差连接跳过该层。
- 现代训练中，DeepSeek 提出了 **Aux-Loss-Free 负载均衡**（通过动态偏置调整代替损失惩罚），实现了 $100\%$ 无丢弃且完美均衡。

---

## 4. 现代 MoE 架构的演进 (DeepSeek-V3 / Qwen 2.5-Max 模式)

传统 MoE（如 Mixtral 8x7B）使用粗粒度专家（8 个大专家选 2 个）。现代前沿 MoE（DeepSeek-V3）采用**细粒度专家分割 + 共享专家**：

| 设计维度 | 传统 MoE (如 Mixtral 8x7B) | 现代细粒度 MoE (如 DeepSeek-V3) |
|---|---|---|
| **专家数量** | 8 个大专家 ($E = 8$) | 256 个微型专家 ($E = 256$) |
| **激活专家数** | Top-2 ($2/8 = 25\%$) | Top-8 ($8/256 = 3.125\%$) |
| **共享专家 (Shared Experts)** | 无 | 1 个独立常驻专家（捕获跨领域公共常识） |
| **参数利用率** | 路由组合少 ($\binom{8}{2} = 28$ 种) | 路由组合极大 ($\binom{256}{8} \approx 4.3 \times 10^{14}$ 种)，表征能力极高 |
| **总参数量 / 激活参数量** | 47B 总参 / 13B 激活 | 671B 总参 / 37B 激活 |

```
输入 Token x
   |
   +-------------------------+-------------------------+
   | (必选常驻通路)                                    | (动态稀疏路由)
   v                                                   v
[ 共享专家 Shared Expert ]                  [ Top-8 路由器 Router ]
   |                                                   |
   |                                     +-------------+-------------+
   |                                     | 分发至激活的 8 个微型专家   |
   |                                     v             v             v
   |                                 [Expert 12]   [Expert 45] ... [Expert 201]
   |                                     |             |             |
   |                                     +-------------+-------------+
   |                                                   | (加权求和)
   +-------------------------+-------------------------+
                             |
                             v
                        输出汇总 y
```

---

## 5. 分布式 MoE 的通信瓶颈：All-to-All
在模型并行中，专家分布在不同的 GPU/节点上。每个 MoE 层需要两次全局 **All-to-All 集合通信**：
1. **Dispatch（分发）**：各 GPU 将本地 Token 根据路由决策发送给专家所在的远程 GPU。
2. **Combine（回收）**：各专家计算完成后，将输出特征通过 All-to-All 发送回源 GPU。
- **系统优化关键**：必须使用 NVLink / NVSwitch 与 InfiniBand 组网重叠通信与计算（Compute-Communication Overlap），否则通信开销将吞噬 MoE 的算力收益。
