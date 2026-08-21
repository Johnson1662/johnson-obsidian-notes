# CS336 Lecture 17: 多模态大模型架构与跨模态对齐 (VLM & Multimodality)

将大语言模型（LLM）扩展为能够理解图像、图表与视频的**视觉-语言模型（Vision-Language Model, VLM）**，已成为通用人工智能演进的核心方向。本讲剖析视觉编码器、跨模态投影层（Projector）、动态分辨率（AnyRes）机制及多模态安全对齐。

---

## 1. 现代 VLM 三段式标准架构 (LLaVA / Qwen-VL 范式)

现代自回归视觉大模型统一采用**编码器-投影器-语言基座**三层解耦架构：

```
输入图像 I [ 高清分辨率 ]
     |
     v
[ 1. 视觉编码器 Vision Encoder (如 SigLIP / CLIP ViT) ]
     | 提取密集视觉 Patch 特征: H_v ∈ R^{N_patches x d_v}
     v
[ 2. 跨模态投影器 Cross-modal Projector (2-Layer MLP / Pixel Shuffle) ]
     | 将视觉维度映射到 LLM 词向量空间: X_v ∈ R^{N_tokens x d_model}
     v
[ 3. 大语言模型 LLM Backbone (如 Llama 3 / Qwen 2.5) ] <--- 输入文本 Token 序列 X_t
     |
     +---> 统一将 [X_v, X_t] 视作多模态自回归序列，生成文本回复
```

### 1.1 对比学习视觉特征提取 (CLIP / SigLIP)
视觉编码器通常采用基于海量图文对预训练的 Vision Transformer (ViT)：
- **CLIP 对比损失**：最大化对应图文对 $(v_i, t_i)$ 的余弦相似度，最小化不匹配图文对的相似度：
  $$
  \mathcal{L}_{\text{contrast}} = -\frac{1}{2B}\sum_{i=1}^B \left( \log \frac{\exp(\langle v_i, t_i \rangle / \tau)}{\sum_{j=1}^B \exp(\langle v_i, t_j \rangle / \tau)} + \log \frac{\exp(\langle t_i, v_i \rangle / \tau)}{\sum_{j=1}^B \exp(\langle t_i, v_j \rangle / \tau)} \right)
  $$
- **SigLIP 改进**：将带有全局分母归一化的 Softmax 替换为独立的对偶 Sigmoid 二分类损失，大幅降低小 Batch 训练波动。

---

## 2. 动态多分辨率技术 (AnyRes / Dynamic Patching)

### 2.1 固定分辨率的 OCR 与小目标缺陷
传统 ViT 将输入图像强制双线性插值缩放到小尺寸（如 $336 \times 336$ 或 $448 \times 448$）：
- 导致高分辨率图表、复杂 PDF 论文与密集 OCR 文本严重模糊变形，丧失细粒度几何信息。

### 2.2 AnyRes 动态切块方案 (LLaVA-NeXT / Qwen2-VL)
根据原图纵横比（Aspect Ratio），将原图动态拆分为若干局部网格切块与一个全局缩略图：

```
原始高分辨率图像 (例如 672 x 1008)
  |
  +---> [ 全局缩略图 (Downsampled Overview 336x336) ] ➔ 捕获全图宏观语义
  |
  +---> [ 局部切块 2x3 网格 (6 个 336x336 的局部高清块) ] ➔ 捕获密集文字细节
            [Crop 0,0] [Crop 0,1] [Crop 0,2]
            [Crop 1,0] [Crop 1,1] [Crop 1,2]
```

- **空间换行符注入 (Spatial Newline Tokens)**：
  在将 2D 网格的 Patch 特征序列展平输入 LLM 时，在每一行的末尾显式插入一个特殊的 `\n` Token，使自注意力机制能够天然识别图像的二维几何邻接拓扑结构。

---

## 3. 多模态后训练与幻觉对齐 (Multimodal Alignment)

### 3.1 两阶段跨模态训练 Pipeline
1. **预训练特征对齐 (Feature Alignment)**：
   - 冻结 Vision Encoder 与 LLM 基座，**仅训练 Projector (MLP)**；
   - 在图文配对描述数据（Captioning）上训练，使视觉特征与词嵌入空间对齐。
2. **多模态指令微调 (Visual Instruction Tuning)**：
   - 解冻 LLM 基座与 Projector；
   - 在图表问答 (ChartQA)、复杂文档解析 (DocVQA)、多步骤视觉推理与定位任务上进行全量 SFT。

### 3.2 视觉幻觉 (Visual Hallucination) 与 DPO 对齐
大模型易产生**视觉幻觉**（如图像中只有猫，模型根据语言惯性脑补出狗或背景物体）：
- **多模态 DPO**：构造三元组 $(I, x, y_w, y_l)$，其中 $y_l$ 为包含幻觉物体的负样本，$y_w$ 为严格与图像像素对应的精准回答，通过 DPO 损失显式压低模型基于语言先验的胡乱猜测。

### 3.3 视觉越狱与多模态安全 (Visual Jailbreak Defense)
- **视觉对抗攻击**：攻击者可将有害 Prompt 渲染为图像（绕过纯文本敏感词过滤），或向图像注入不可察觉的高频噪声对抗扰动诱导模型输出违规内容。
- **防御机制**：在后训练中混入带有视觉隐写、图文混杂的多模态安全红队数据集，强制模型对图像中的文字内容同样执行最高等级的安全价值观过滤。
