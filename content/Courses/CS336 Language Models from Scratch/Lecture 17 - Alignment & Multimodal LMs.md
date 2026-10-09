# Lecture 17 - Alignment & Multimodal LMs

> **课程主题**：多模态大语言模型（MLLM）架构设计、跨模态表征对齐与原生多模态生成
> **授课教师**：Percy Liang
> **核心目标**：掌握视觉-语言多模态大模型的核心架构演进，深入理解对比学习表征对齐（CLIP vs SigLIP）、模块化融合架构（LLaVA / LLaVA-OneVision）、动态分辨率与 3D 位置编码（Qwen2-VL M-RoPE）以及离散 Token 端到端原生多模态建模（Chameleon）。

---

## 1. 多模态大模型演进全景

大语言模型正从纯文本智能向能够理解图像、视频、音频并具备原生生成能力的**全模态统一模型（Omni / Native Multimodal Models）**演进。

```
[ 范式 1: 模块化后融合 (Modular Late-Fusion) ]
图像 ──> 预训练视觉编码器 (CLIP/SigLIP) ──> 投影适配器 (MLP/Cross-Attn) ──> 冻结/微调大语言模型 (LLaVA, Qwen-VL)

[ 范式 2: 原生离散早期融合 (Native Early-Fusion) ]
图像 ──> 离散量化编码 (VQ-VAE / dVAE) ──> 统一离散词表 ──> 自回归统一生成文本与图像 Token (Chameleon)
```

---

## 2. 视觉-语言对比表征预训练：CLIP vs SigLIP

### 2.1 CLIP (Contrastive Language-Image Pretraining, OpenAI 2021)
- **架构**：ViT 图像编码器与 GPT 文本编码器，提取全局特征向量并归一化。
- **InfoNCE 对比损失**：在大小为 $B$ 的批次内，将对角线上的 $B$ 对真实图文配对作为正样本，其余 $B(B-1)$ 个交叉图文作为负样本，分别沿行与列执行 Softmax 交叉熵：
  $$\mathcal{L}_{\text{CLIP}} = -\frac{1}{2B} \sum_{i=1}^B \left( \log \frac{\exp(x_i \cdot y_i / \tau)}{\sum_{j=1}^B \exp(x_i \cdot y_j / \tau)} + \log \frac{\exp(x_i \cdot y_i / \tau)}{\sum_{j=1}^B \exp(x_j \cdot y_i / \tau)} \right)$$
- **局限性**：全局 Softmax 必须在全卡批次间进行全局规约通信（All-Gather），导致多机扩展受限。

### 2.2 SigLIP (Sigmoid Loss for Language Image Pretraining, Google 2023)
- **核心革新**：**将多分类 Softmax 转化为独立的逐对二元 Sigmoid 分类**。
- **SigLIP 损失函数**：
  $$\mathcal{L}_{\text{SigLIP}} = -\frac{1}{B} \sum_{i=1}^B \sum_{j=1}^B \log \sigma\left( z_{ij} (x_i \cdot y_j + b) \right), \quad z_{ij} = \begin{cases} +1 & i = j \\ -1 & i \neq j \end{cases}$$
- **优势**：彻底解耦 Batch Size 与全局 Softmax 归一化，消除了跨卡通信瓶颈，在更小算力下达到更高对齐精度。

---

## 3. 模块化视觉问答架构：LLaVA 体系

```
                       LLaVA Architecture
  Input Image ──> Vision Encoder (SigLIP ViT) ──> Projector (2-layer MLP) ──┐
                                                                            ├──> LLM (Qwen / Llama) ──> Text Response
  Input Prompt ───────────────────> Text Tokenizer / Embedding ─────────────┘
```

### 3.1 两阶段对齐训练策略 (Two-Stage Training)
1. **Stage 1（特征对齐阶段）**：冻结 Vision Encoder 与 LLM 权重，仅训练轻量级 Projector 映射矩阵 $W$，将视觉特征投影至 LLM 文本嵌入空间。
2. **Stage 2（视觉指令微调阶段）**：保持 Vision Encoder 冻结，微调 Projector 与 LLM 主干，注入包含复杂推理、问答与细节描述的指令数据（158K GPT-4 生成样本）。

### 3.2 动态高分辨率切块 (AnyRes / LLaVA-OneVision)
- **传统局限**：CLIP 强制缩放至 $336 \times 336$ 会彻底抹杀高密文本与微小目标（OCR 灾难）。
- **AnyRes 机制**：将任意高分辨率原始大图切分成多个 $a \times b$ 的标准网格小块（Patches），分别送入视觉编码器，外加一张全局缩略图，在保留全局布局的同时保留局部微观细节。

---

## 4. 原生动态分辨率与 3D 位置编码：Qwen-VL 系列

```
                      Qwen2-VL 3D M-RoPE 空间位置编码
               ┌──────────────────────────────────────────┐
               │ Temporal Axis (时间轴 / 视频帧索引 t)    │
               │ Height Axis   (空间高度 Y 轴坐标 h)      │
               │ Width Axis    (空间宽度 X 轴坐标 w)      │
               └──────────────────────────────────────────┘
```

### 4.1 原生动态分辨率 (Native Dynamic Resolution)
- 直接将任意长宽比图像切分为连续的 Variable-length Patches，结合 2D 卷积压缩将相邻 $2 \times 2$ 空间 Token 合并，极大降低 Token 序列长度。

### 4.2 多模态旋转位置编码 (Multimodal RoPE, M-RoPE)
- 传统 1D RoPE 仅能编码一维标量位置。
- **M-RoPE** 将每个注意头向量通道拆分为三大子空间：分别赋予**时间（帧序号 $t$）、高度（$h$）与宽度（$w$）**三维独立旋转角度：
  $$R_{\text{M-RoPE}}(t, h, w) = \text{diag}\left( R_{\theta}(t), R_{\theta}(h), R_{\theta}(w) \right)$$
- **交错 M-RoPE (Interleaved M-RoPE, Qwen3-VL)**：将三维位置坐标均匀穿插分布在高频与低频旋转波段，实现对长视频连续时空动态的精准建模。

---

## 5. 统一离散早期融合：Chameleon

```
Text Tokens [ "Describe", "this" ] ──┐
                                     ├──> Unified Transformer ──> Autoregressive Output (Text or Image Tokens)
Image Tokens [ VQ-102, VQ-8191... ] ──┘                                   │
                                                                         ▼
                                                                VQ-VAE Decoder ──> Output Image
```

### 5.1 离散视觉量化 (VQ-VAE / dVAE)
- 利用矢量量化自编码器（VQ-VAE）将 $512 \times 512$ 像素图像量化编码为 $1024$ 个离散 Token（码本大小 8192）。
- 与文本 BPE Token 融合成单一统一词表，实现真正的图文交错自回归生成。

### 5.2 模态熵不平衡与训练稳定性
- **熵差异挑战**：文本 Token 具有低熵语义聚集性，而离散图像 Token 具有极高熵和表面纹理冗余，极易引发激活范数爆炸与 Logit 漂移。
- **核心稳定策略**：必须在全注意力层中强制引入 **QK-Norm** 与 **z-loss 正则化**，保证跨模态联合训练不发生发散。
