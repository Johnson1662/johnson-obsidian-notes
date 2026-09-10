# Lecture 03 - Architectures & Hyperparameters

> **课程主题**：现代 Transformer 架构细节、演进共识与超参数配置
> **授课教师**：Tatsunori Hashimoto
> **核心目标**：系统剖析现代开源与前沿大模型（Llama 系列、Gemma、DeepSeek、OLMo、Mistral 等）在归一化、激活函数、位置编码、注意力变体及训练稳定性技巧上的架构共识与关键超参数规律。

---

## 1. 现代 Transformer 架构演进全景

从 2017 年原始 Transformer（Vaswani et al.）到现代大模型（2023-2026），工业界与学术界形成了高度统一的**标准现代变体（Standard Modern Variant）**：

| 组件 | 原始 Transformer (2017) | 现代大模型主流标准 (2024-2026) | 演进核心动因 |
| :--- | :--- | :--- | :--- |
| **归一化位置 (Norm Position)** | Post-LN | **Pre-LN**（部分采用双重 Norm） | 消除残差主通路梯度衰减与爆炸，免除脆弱的 Warmup |
| **归一化类型 (Norm Type)** | LayerNorm（含均值与偏置） | **RMSNorm**（无均值、无偏置） | 减少显存访存（Memory Traffic），加速计算，效果等价 |
| **偏置项 (Bias Terms)** | 线性层与归一化均保留偏置 | **全部移除偏置 (No Bias)** | 减少显存占用，增强超大规模训练数值稳定性 |
| **激活函数 (Activation)** | ReLU / GeLU | **SwiGLU / GeGLU** | 门控机制带来稳定的下游评测收益 |
| **位置编码 (Positional Encoding)** | 正余弦绝对位置编码 | **RoPE (旋转位置编码)** | 保持内积旋转不变性，天生支持相对位置与长度外推 |
| **注意力头机制 (Attention Heads)** | Multi-Head Attention (MHA) | **GQA / MQA / MLA** | 大幅缩减推理时 KV Cache 显存开销与带宽瓶颈 |

---

## 2. 归一化机制：Pre-LN、RMSNorm 与稳定性扩展

### 2.1 Pre-LN vs Post-LN

- **Post-LN（BERT / 原始 Transformer）**：
  $$x_{l+1} = \text{LayerNorm}(x_l + \text{Sublayer}(x_l))$$
  随着网络层数加深，反向传播经过 LayerNorm 时梯度会发生逐层衰减（Gradient Attenuation）或出现梯度尖峰（Gradient Spikes），深层网络必须依赖极小的学习率和严苛的 Warmup。
- **Pre-LN（现代大模型标配）**：
  $$x_{l+1} = x_l + \text{Sublayer}(\text{LayerNorm}(x_l))$$
  保持残差主干（Residual Stream）畅通无阻，梯度可以直接回传至浅层，支持更大的学习率与更稳定的深层扩展。
- **前沿拓展（Double Norm / 非残差 Post-Norm）**：
  Gemma 2、Grok、OLMo 2 在子模块内部输出处额外增加一层 Norm，进一步抑制极端激活动态。

### 2.2 LayerNorm vs RMSNorm

- **LayerNorm**：需计算均值 $\mu$ 与方差 $\sigma^2$：
  $$y = \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} \odot \gamma + \beta$$
- **RMSNorm（Root Mean Square Normalization）**：不减均值，不加偏置 $\beta$：
  $$\text{RMS}(x) = \sqrt{\frac{1}{d} \sum_{i=1}^d x_i^2}, \quad y = \frac{x}{\text{RMS}(x) + \epsilon} \odot \gamma$$
- **硬件视角**：由于 Elementwise 算子是受限于内存带宽的（Memory-Bound），RMSNorm 省去了求和求均值与偏置加载的显存读写，在保持模型效果甚至略优的前提下显著降低训练与推理的 Wall-Clock 耗时。

---

## 3. 门控激活函数 (Gated Linear Units, GLU)

### 3.1 SwiGLU 与 GeGLU 数学表达

传统 MLP 仅包含单路线性投影与非线性映射：
$$\text{FFN}_{\text{ReLU}}(x) = \max(0, x W_1) W_2$$

GLU 变体引入元素级乘法的门控分支（Gating Branch）：
- **ReGLU**：$(\max(0, x W_1) \otimes (x V)) W_2$
- **GeGLU**：$(\text{GELU}(x W_1) \otimes (x V)) W_2$
- **SwiGLU**（Llama、Mistral、DeepSeek、OLMo 等广泛使用）：
  $$\text{FFN}_{\text{SwiGLU}}(x) = (\text{Swish}(x W_1) \otimes (x V)) W_2 = ((x W_1 \odot \sigma(x W_1)) \otimes (x V)) W_2$$

### 3.2 维度调整与参数量对齐 (The 2/3 Rule)

标准 FFN 包含 2 个权重矩阵（$W_1 \in \mathbb{R}^{d \times d_{ff}}, W_2 \in \mathbb{R}^{d_{ff} \times d}$），参数量为 $2 d \cdot d_{ff} = 8 d^2$（当 $d_{ff} = 4d$ 时）。

SwiGLU 包含 3 个权重矩阵（$W_1, V \in \mathbb{R}^{d \times d_{ff}}, W_2 \in \mathbb{R}^{d_{ff} \times d}$），参数量为 $3 d \cdot d_{ff}$。为保持与传统模型相同的参数量与算力开销：
$$3 d \cdot d_{ff} \approx 8 d^2 \implies d_{ff} = \frac{8}{3} d \approx 2.67 d_{\text{model}}$$

---

## 4. 旋转位置编码 (Rotary Position Embedding, RoPE)

### 4.1 核心设计动机

我们期望注意力分数的计算仅依赖于两个 Token 的相对位置差 $(i - j)$，且满足内积旋转不变性：
$$\langle f(x, i), f(y, j) \rangle = g(x, y, i - j)$$

- 正弦绝对编码：内积展开后存在 $v_x^T v_y$ 与绝对位置的交叉干扰项。
- T5 相对位置编码：直接修改注意力矩阵，破坏了标准内积算子与 FlashAttention 等底层内核的融合优化。

### 4.2 RoPE 数学原理

RoPE 将二维向量在复数平面内旋转角度 $m\theta$。对于 $d$ 维向量，将其两两配对为 $d/2$ 个二维子空间：
$$R_{\Theta, m}^d = \text{diag}\left( R_{\theta_1, m}, R_{\theta_2, m}, \dots, R_{\theta_{d/2}, m} \right)$$
其中每个二维旋转矩阵为：
$$R_{\theta_k, m} = \begin{pmatrix} \cos(m \theta_k) & -\sin(m \theta_k) \\ \sin(m \theta_k) & \cos(m \theta_k) \end{pmatrix}, \quad \theta_k = 10000^{-2(k-1)/d}$$

当计算 Query 与 Key 的内积时：
$$(R_{\Theta, m} q)^T (R_{\Theta, n} k) = q^T R_{\Theta, m}^T R_{\Theta, n} k = q^T R_{\Theta, n - m} k$$
完美实现**仅依赖相对距离 $(n - m)$ 的正交旋转变换**。

---

## 5. 关键超参数经验法则与共识

### 5.1 隐层与前馈维度比 (Feedforward Ratio)
- **标准 Dense 模型**：$d_{ff} = 4 d_{\text{model}}$。
- **GLU 门控模型**：$d_{ff} = \frac{8}{3} d_{\text{model}} \approx 2.67 \sim 2.85 d_{\text{model}}$（LLaMA-3 采用 $\approx 3.5 d_{\text{model}}$）。
- **经验结论**：Kaplan 等人研究表明，倍率在 $1 \sim 10$ 的宽平盆地内均接近最优，无需过度微调。

### 5.2 头维度与模型长宽比 (Aspect Ratio)
- **头维度配比**：绝大多数模型严格遵循 $\text{num\_heads} \times \text{head\_dim} = d_{\text{model}}$（典型 $\text{head\_dim} = 128$ 或 $256$）。
- **深宽比 ($d_{\text{model}} / n_{\text{layers}}$)**：主流模型多处于 $100 \sim 200$ 区间。过深的模型会增加自回归解码延迟并加剧流水线并行气泡，过宽的模型则难以充分表达层次化特征。

### 5.3 词表大小 (Vocab Size) 与正则化
- **单语言/代码模型**：$32,000 \sim 50,000$（GPT-2/3: 50,257; LLaMA-1/2: 32,000）。
- **多语言/生产级模型**：$100,000 \sim 262,144$（GPT-4: 100K; LLaMA-3: 128K; Gemma-4: 262K）。
- **正则化共识**：现代数万亿 Token 预训练中**基本完全弃用 Dropout（设为 0）**，仅依靠权重衰减（Weight Decay，通常 $0.1$）与余弦学习率衰减配合调节优化动力学。

---

## 6. 大规模训练稳定性技巧

大模型训练中最忌讳发生损失发散（Loss Spikes）导致训练崩盘。核心防范策略包括：

1. **z-loss（输出 Softmax 稳定性）**：
   在交叉熵损失中增加惩罚项，抑制 Logits 绝对值过大导致的数值上溢：
   $$\mathcal{L}_z = \alpha \log^2 \left( \sum_{i} \exp(z_i) \right)$$
   （应用于 PaLM, DCLM, OLMo 2/3）。
2. **QK-Norm（注意力矩阵稳定性）**：
   在计算点积注意力前，对 Query 和 Key 分别进行 RMSNorm，防止注意力点积数值过大导致 Softmax 梯度饱和为 0（应用于 Gemma 2, Qwen 3, OLMo 3, 跨模态模型）。
3. **Logit Soft-Capping**：
   通过 $\text{cap} \cdot \tanh(\text{logits} / \text{cap})$ 将 Logits 严格约束在可控区间内（Gemma 2）。

---

## 7. 注意力头效率优化：MQA, GQA, MLA 与滑动窗口

### 7.1 MHA vs MQA vs GQA

```
Multi-Head Attention (MHA)        Grouped-Query Attention (GQA)       Multi-Query Attention (MQA)
     Q: 8 heads, KV: 8 heads             Q: 8 heads, KV: 2 groups            Q: 8 heads, KV: 1 head
   [Q1][Q2][Q3][Q4][Q5][Q6][Q7][Q8]   [Q1][Q2][Q3][Q4] [Q5][Q6][Q7][Q8]   [Q1][Q2][Q3][Q4][Q5][Q6][Q7][Q8]
   [K1][K2][K3][K4][K5][K6][K7][K8]         [KV 1]           [KV 2]                     [KV]
   [V1][V2][V3][V4][V5][V6][V7][V8]
```

- **MHA**：每个 Query 头对应一组 Key/Value 头，KV Cache 显存与访存随上下文线性激增。
- **MQA (Shazeer 2019)**：所有 Query 头共享单一组 Key/Value，KV Cache 压缩至 $1/H$，极大缓解内存瓶颈，但表达能力略有折损。
- **GQA (Ainslie 2023)**：将 Query 头分组，每组共享一组 KV 头（如 8 个 Q 对应 1 个 KV），在维持 MHA 评测精度的同时获得接近 MQA 的推理吞吐。
- **MLA (Multi-head Latent Attention, DeepSeek)**：对 Key/Value 进行低秩联合投影压缩，进一步压缩 KV Cache。

### 7.2 滑动窗口注意力 (Sliding Window Attention, SWA) 与交错注意力
- 全局自注意力计算复杂度为 $\mathcal{O}(S^2)$。
- **交错架构（Interleaved Attention）**：如每 4 层设置 3 层滑动窗口局部注意力（SWA + RoPE），仅在第 4 层设置全局全量注意力（Full Attention + NoPE），兼顾超长上下文信息捕获与线性计算复杂度。
