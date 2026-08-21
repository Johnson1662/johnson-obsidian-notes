# CS336 Lecture 3: Transformer 架构设计与超参数体系

现代工业级 Decoder-Only 大语言模型（如 Llama 3、Qwen 2.5、DeepSeek-V3）在初代 Transformer（Vaswani 2017）的基础上经历了一系列关键架构演进。本讲梳理现代标准架构的数学定义、设计原理与超参数选择。

---

## 1. 现代 Transformer 标准计算流 (Pre-LN Decoder-Only)

现代大模型统一采用 **Pre-LayerNorm / Pre-RMSNorm** 架构，保证残差主干（Residual Stream）作为无衰减的“梯度高速公路”。

### 1.1 前向传播公式
设输入为 Token 序列 $t_{1:S}$，嵌入维度为 $d$，层数为 $L$：
1. **输入嵌入**：$X^{(0)} = E[t_{1:S}] \in \mathbb{R}^{S \times d}$
2. **第 $\ell$ 层 Transformer Block ($\ell = 1, \dots, L$)**：
   $$
   \begin{aligned}
   U^{(\ell)} &= X^{(\ell-1)} + \text{Attention}\left(\text{RMSNorm}(X^{(\ell-1)})\right) \\
   X^{(\ell)} &= U^{(\ell)} + \text{FFN}\left(\text{RMSNorm}(U^{(\ell)})\right)
   \end{aligned}
   $$
3. **最终输出与 Logits**：
   $$
   H = \text{RMSNorm}_{\text{final}}(X^{(L)}) \in \mathbb{R}^{S \times d}
   $$
   $$
   Z = H W_U \in \mathbb{R}^{S \times V} \quad (\text{Logits})
   $$
   *(若启用 Weight Tying，则输出投影权重 $W_U = E^\top$)*

---

## 2. 核心组件深入剖析

### 2.1 归一化：Pre-LN vs Post-LN 与 RMSNorm
- **Post-LN (原始 2017 Transformer)**：
  $$X^{(\ell)} = \text{LN}(X^{(\ell-1)} + \text{SubLayer}(X^{(\ell-1)}))$$
  每过一层，残差方差被不断缩减，深层梯度发生指数级衰减，未加 Warmup 极易发散。
- **Pre-LN (现代标准)**：
  归一化置于子层输入侧，残差连接 $X^{(\ell)} = X^{(\ell-1)} + \dots$ 保持恒等映射，梯度可无阻碍回传至浅层，支持数百层极深网络训练。
- **RMSNorm (Root Mean Square Normalization)**：
  LayerNorm 需要同时计算均值 $\mu$ 与方差 $\sigma^2$：
  $$
  \text{LN}(x) = \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} \odot \gamma + \beta, \quad \mu = \frac{1}{d}\sum x_i, \quad \sigma^2 = \frac{1}{d}\sum (x_i - \mu)^2
  $$
  RMSNorm 假设激活值均值自然接近 0，舍弃去均值操作，仅计算均方根：
  $$
  \text{RMSNorm}(x) = \frac{x}{\text{RMS}(x)} \odot \gamma, \quad \text{RMS}(x) = \sqrt{\frac{1}{d}\sum_{i=1}^d x_i^2 + \epsilon}
  $$
  **工程收益**：减少一次全向量求和与 SRAM 搬运，在 GPU 上提速约 $10\% \sim 50\%$，模型质量无损。现代模型通常同时移除偏置项 $\beta$。

### 2.2 位置编码：RoPE (Rotary Position Embedding)
绝对位置编码（如正弦编码、可学习位置向量）直接与 Token Embedding 相加，无法显式建模 Token 间的相对距离。RoPE 通过**复数空间旋转变换**注入相对位置信息。

#### 2.2.1 数学原理
对 Query 和 Key 向量每 2 个维度组成一个子空间平面，在位置 $m$ 处乘以 2D 旋转矩阵：
$$
R_{\theta, m} = \begin{pmatrix} \cos(m\theta) & -\sin(m\theta) \\ \sin(m\theta) & \cos(m\theta) \end{pmatrix}
$$
对 $d$ 维向量 $x = [x_0, x_1, \dots, x_{d-1}]$，频率定义为 $\theta_i = b^{-2i/d}$（基频 $b$ 早期为 10000，Llama 3 扩大为 500,000 以支持长上下文）。

#### 2.2.2 核心性质：内积保持相对位置
在位置 $m$ 的 Query $q_m = R_m W_Q x_m$ 与位置 $n$ 的 Key $k_n = R_n W_K x_n$ 做内积时：
$$
\langle R_m q, R_n k \rangle = q^\top R_m^\top R_n k = q^\top R_{n-m} k = g(q, k, m-n)
$$
注意力打分仅取决于相对距离 $(m-n)$，天然具备长文本外推与相对位置感知能力。

### 2.3 前馈网络 (FFN) 与 SwiGLU 激活函数
现代大模型全面废弃 ReLU，改用门控线性单元（Gated Linear Unit）：
- **标准 2 层 FFN**：
  $$\text{FFN}(x) = \text{GELU}(x W_1) W_2$$
- **SwiGLU (Shazeer 2020)**：
  $$
  \text{SwiGLU}(x) = \left( \text{SiLU}(x W_{\text{gate}}) \odot (x W_{\text{up}}) \right) W_{\text{down}}
  $$
  其中 $\text{SiLU}(z) = z \cdot \sigma(z) = \frac{z}{1 + e^{-z}}$。
- **维度配置规则**：
  标准 FFN 隐藏层维度 $d_{\text{ffn}} = 4 d_{\text{model}}$。由于 SwiGLU 增加了一个投影矩阵，为了保持总参数量不变，通常设置：
  $$
  d_{\text{ffn}} \approx \frac{8}{3} d_{\text{model}} \quad (\text{通常取 256 或 128 的整数倍})
  $$

---

## 3. 注意力变体演进：MHA ➔ MQA ➔ GQA ➔ MLA

为解决自回归推理阶段 **KV Cache 显存瓶颈**，注意力机制发生多代演化：

| 注意力机制 | Query Head 数 $H_Q$ | Key/Value Head 数 $H_{KV}$ | KV 显存开销 | 代表模型 | 核心特点 |
|---|---|---|---|---|---|
| **MHA (Multi-Head)** | $H$ | $H$ | $1.0\times$ (基准) | GPT-3, Llama 1 | 表达能力强，但长文本推理 KV 显存巨大 |
| **MQA (Multi-Query)** | $H$ | 1 | $\frac{1}{H}\times$ (通常 $1/32$) | PaLM, StarCoder | KV 极大压缩，但注意力表征容量轻微受损 |
| **GQA (Grouped-Query)** | $H$ | $G$ (如 8) | $\frac{G}{H}\times$ (如 $1/4 \sim 1/8$) | Llama 2/3, Qwen 2.5 | 性能与容量的最佳平衡，现代 LLM 主流标准 |
| **MLA (Multi-Head Latent)** | $H$ (低秩投影) | 压缩为单一 Latent $c_{KV}$ | 相比 MHA 压缩 $>80\%$ | DeepSeek-V2/V3/R1 | 结合低秩矩阵分解与解耦 RoPE，极致降低 KV 显存 |

---

## 4. 工业级主流模型架构参数全景对比

| 超参数 | Llama 3 8B | Llama 3 70B | Qwen 2.5 72B | DeepSeek-V3 (MoE 激活) |
|---|---|---|---|---|
| **隐藏维度 $d_{\text{model}}$** | 4,096 | 8,192 | 8,192 | 7,168 |
| **层数 $L$** | 32 | 80 | 80 | 61 |
| **Query Heads ($H_Q$)** | 32 | 64 | 64 | 128 |
| **KV Heads ($H_{KV}$)** | 8 (GQA) | 8 (GQA) | 8 (GQA) | MLA (低秩 Latent 512) |
| **Head 维度 $d_k$** | 128 | 128 | 128 | 128 |
| **FFN 维度 $d_{\text{ffn}}$** | 14,336 ($\approx 3.5d$) | 28,672 ($\approx 3.5d$) | 29,568 | 2,048 / 专家 (共 256 专家) |
| **词表大小 $\vert V \vert$** | 128,256 | 128,256 | 152,064 | 129,280 |
| **RoPE Base** | 500,000 | 500,000 | 1,000,000 | 10,000 (配合 YaRN 扩展) |
| **Norm 类型** | RMSNorm (No Bias) | RMSNorm (No Bias) | RMSNorm (No Bias) | RMSNorm (No Bias) |

### 架构设计黄金经验
1. **宽深比平衡**：模型规模增大时，优先同比例增加 $d_{\text{model}}$ 和 $L$；$d_k$ 几乎固定为 128（与 GPU Tensor Core 128-byte 访存对其最佳）。
2. **无 Bias 设计**：线性层与 Norm 层全面剔除 bias，既提升 GPU Kernel 算子效率，又提高训练数值稳定性。
3. **Weight Tying 策略**：小模型（$<1\text{B}$）建议开启词表权重共享减少参数浪费；大模型（$\ge 7\text{B}$）词表参数占比较小，通常解耦输入输出权重以提升表达能力。
