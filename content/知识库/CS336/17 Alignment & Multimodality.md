# Lecture 17：对齐与多模态（Alignment & Multimodality）

> 之前的语言模型主要做 `text → text`。现实世界包含图像、视频、音频、代码、表格、动作和传感器信号；本讲讨论如何把非文本模态变成 Transformer 能处理的 token，并把视觉/多领域能力与语言模型对齐。

## 1. 从语言模型到 Omni 模型

### 1.1 目标

理想的 **omni model（全模态模型）**：

- 输入任意组合的模态（文本 + 图像 + 视频 + 音频等），能够理解；
- 输出任意组合的模态，能够生成。

Transformer 擅长处理序列，但只“说” token。文本 token 是离散符号；图像 patch embedding、音频帧、视频时空块则是连续 token。于是统一问题是：

1. 如何把非文本输入编码成语义 token？
2. 如何把模型输出转换回像素、波形或动作？

理解与生成的需求不完全相同：理解更关心语义不变性，生成/编辑还需要细粒度空间、纹理与时序信息。

### 1.2 典型组件

```text
图像/视频 ──► Vision Encoder ──► Projector/Adaptor ──► LLM/Transformer ──► 文本
    │                                                        │
    └──────────────（生成任务时）Diffusion / VQ Decoder ◄────┘
```

- **Vision encoder**：CLIP、SigLIP、ViT 等，将图像 patch 变成连续特征；
- **Projector/Adaptor**：把视觉特征维度、token 数量和位置编码对齐到语言模型；
- **LLM**：在统一序列上做自回归理解/对话；
- **Diffusion/VQ decoder**：需要生成图像、视频或音频时，把连续/离散表示还原为高保真输出。

---

## 2. CLIP：图像—文本特征对齐

### 2.1 背景与数据

过去的计算机视觉模型依赖人工标注图像。CLIP（Contrastive Language-Image Pretraining）利用网络中规模更大的图像—caption 对：

- 搜索约 50 万个查询，每个查询获取约 2 万个图像—文本对；
- 训练约 4 亿对；
- 原始数据集没有发布；
- OpenCLIP 用 LAION-5B 等数据复现，并使用 CLIP 进行过滤。

### 2.2 对比学习目标

一个 batch 中有 $B$ 个对齐样本 $(I_i,T_i)$：

1. 图像编码器得到 $v_i=f_{\mathrm{img}}(I_i)$；
2. 文本编码器得到 $t_i=f_{\mathrm{text}}(T_i)$；
3. 对每个图像，让其匹配文本 $t_i$ 的相似度高于其他文本；
4. 对每个文本，让其匹配图像 $v_i$ 的相似度高于其他图像。

通常先归一化向量，定义温度参数 $\tau$：

$$
s_{ij}=\frac{v_i^\top t_j}{\tau}.
$$

图到文的交叉熵：

$$
\mathcal L_{I\to T}
=-\frac1B\sum_{i=1}^{B}
\log\frac{\exp(s_{ii})}{\sum_{j=1}^{B}\exp(s_{ij})}.
$$

文到图：

$$
\mathcal L_{T\to I}
=-\frac1B\sum_{i=1}^{B}
\log\frac{\exp(s_{ii})}{\sum_{j=1}^{B}\exp(s_{ji})}.
$$

总损失：

$$
\mathcal L_{\mathrm{CLIP}}
=\frac12(\mathcal L_{I\to T}+\mathcal L_{T\to I}).
$$

这相当于 batch 内的 $B$ 类分类，不需要为每个图像人工定义类别。

### 2.3 图像预处理与视觉编码器

图像分辨率任意 $W\times H$，原始 CLIP 处理为：

1. 双三次插值缩放，使短边为 336 像素；
2. 中心裁剪为 $336\times336$，可能丢失边缘信息。

视觉编码器实验过 ResNet-50 与 Vision Transformer（ViT）：

- ViT 将图像切成固定 patch，线性投影为 token，再加二维位置编码；
- 可使用 attention pooling：以所有激活的全局平均作为 query 做 QKV；
- 最佳模型是 ViT-L/14@336px：Large 规模、$14\times14$ patch、3 个颜色通道、在 $336\times336$ 图像上训练。

文本编码器使用 GPT-2 Transformer（约 6,300 万参数、12 层），输入 `[BOS] ... [EOS]`，取最高层 `[EOS]` 激活作为句子向量。

### 2.4 结果与局限

在 ImageNet 上，zero-shot CLIP 超过在 120 万张 ImageNet 标注图像上训练的 ResNet-50：给定类别名称的文本 prompt，直接比较图像与各类别文本的相似度即可分类。

直接训练“由图像预测文本”的生成式方案，计算效率显著低于 CLIP 风格的 batch 排序；对比学习一次使用 batch 内所有负例。

局限：

- 需要大 batch；softmax 的分母遍历整个 batch；
- 训练目标主要由图像分类驱动，编码器捕捉的是带噪 caption 传达的语义，未必保留 OCR、细小物体、像素级布局等细节。

---

## 3. SigLIP：将 batch 分类改成成对二分类

### 3.1 CLIP 的效率问题

CLIP 对每个图像在 batch 内做 $B$ 类分类，负例数量和全 batch softmax 耦合；扩展 batch 需要跨设备 all-gather，通信成本高。

SigLIP（Sigmoid Loss for Language Image Pre-Training）把问题改成：**这一对图像—文本是否对齐？**

### 3.2 Sigmoid 损失

令 $z_{ij}=+1$ 表示正对齐对，$z_{ij}=-1$ 表示负对齐对，$s_{ij}$ 是图像—文本相似度。成对 logistic 损失：

$$
\mathcal L_{\mathrm{SigLIP}}
=-\frac{1}{B^2}\sum_{i,j}
\log\sigma\left(z_{ij}(s_{ij}-b)\right),
$$

其中 $b$ 是可学习或固定偏置。它不需要对整批 logits 做 softmax，因此 batch size 与损失形式解耦。

### 3.3 数据与效率

WebLI：

- 从互联网抓取十亿量级图像—文本对；
- 用自动 OCR 从图片中提取文字；
- 只保留质量最高的 10%；
- 支持 100 种语言。

训练对比：CLIP 约使用 256 个 TPUv3、10 天；SigLIP 用 32 个 TPUv4、5 天（即使单卡 FLOP/s 低于 TPUv3 也更快）。SigLIP 在 batch < 16K 时优于 CLIP，可扩展到 1M，但约 32K 已足够。

---

## 4. LLaVA：Vision Encoder + Projector + LLM

### 4.1 基本架构

LLaVA（Large Language and Vision Assistant）采用简单、可复现的 VLM 模板：

- Vision encoder：CLIP ViT-L/14；
- Text decoder：Vicuna（LLaMA 在 ShareGPT 对话上微调）；
- Projector：一个线性层 $W$，把视觉特征投影到语言模型 embedding 空间。

若图像特征为 $z_{\mathrm{img}}$，则视觉 token 为：

$$
h_{\mathrm{img}}=Wz_{\mathrm{img}}+b,
$$

然后与文本 token 拼成上下文输入 LLM。Flamingo 的 cross-attention、Q-Former 等方案更复杂，但 LLaVA 说明一个线性投影也能有效对齐。

### 4.2 数据构造

- MS COCO 图像包含 bounding box 和 Mechanical Turk caption；
- 将 caption/检测到的对象提示给 GPT-4，让其生成问题或多轮对话；
- 把生成的对话与原图配对；
- 约 15.8 万条样本。

这是一种“强 LM 生成视觉指令”的合成数据路线，数据质量与任务覆盖比原始数量更重要。

### 4.3 两阶段训练

1. **对齐阶段**：冻结 vision encoder 与 language model，只训练线性层 $W$；让图像表示落到 LLM 能理解的语义空间。
2. **指令微调阶段**：冻结 vision encoder，训练 $W$ 与 language model；使用图像—指令—回答数据学习视觉问答和对话。

这种分阶段策略避免一开始破坏 CLIP 的视觉表征，也降低了需要训练的参数量。

---

## 5. LLaVA-OneVision：AnyRes 与多图/视频

### 5.1 架构与数据

LLaVA-OneVision 支持单图、多图和视频：

- Vision encoder：SigLIP，使用最后一层前后的 grid features；
- Text decoder：Qwen2-72B；
- Projector：两层 MLP；
- 延续 LLaVA 1.5/Next 的开放路线，发布模型权重和数据。

核心经验是**高分辨率对 OCR 很重要**。CLIP 固定缩放并中心裁剪到 336×336 会丢失小字和边缘布局。

### 5.2 AnyRes 动态分辨率

AnyRes 的思路：

1. 按视觉编码器能接受的基础分辨率，把大图切成 $a\times b$ 个块；
2. 对每个块分别编码；
3. 拼接各块视觉 token 与原始全局图像 token；
4. 如果 token 数过多，对视觉特征做双线性插值/合并。

与“所有图片都压成同一个小方块”相比，AnyRes 保留了文字、图表和局部对象的细节，同时仍能把结果放进 LLM 上下文。

### 5.3 让不同模态占据相近 token 预算

#### 单图

使用更高分辨率，保留局部细节。

#### 多图

每张图使用基础分辨率，控制总长度。

#### 视频

每帧使用更低分辨率，并抽样帧，避免帧数把上下文占满。

### 5.4 训练原则与跨模态迁移

- 数据哲学：质量优先于数量；
- 训练哲学：由容易到困难；
- 单图图表/图示数据可以迁移到多图理解；
- 单图 OCR 与多图关系推理可以迁移到 GUI agent；
- 单图中用圆圈标记的视觉 prompt 可以迁移到视频定位。

标准 VLM 结构相对固定，大量工作集中在合成、筛选、任务专用数据和跨模态迁移设计。

---

## 6. Qwen-VL 系列

### 6.1 Qwen-VL

架构：

- Vision encoder：OpenCLIP ViT-bigG，$14\times14$ patch；
- Adaptor：单层 cross-attention，引入二维位置编码，将视觉序列映射为固定长度 256；
- 特殊 token：`<img>`、`<box>`、`<ref>`，用于图像、框和引用区域。

三阶段训练：

1. 大规模低质量图文数据：冻结 LM，训练视觉编码器与 adaptor；
2. 更高质量、任务相关数据：提高分辨率，训练全部参数；
3. instruction tuning：冻结视觉编码器，训练 adaptor 与 LM。

### 6.2 Qwen2-VL：动态分辨率与 MRoPE

- 更大的 675M ViT；
- 动态分辨率，适应不同宽高比；
- 每个 $224\times224$ 区域用 ViT/14 编码，约 256 个 patch token，再每 $2\times2$ 压缩，约得到 66 个 token；
- 视频每秒抽样 2 帧，最多约 16,384 token。

**Multimodal Rotary Position Embedding（MRoPE）** 把位置拆为时间、宽度、高度轴，让 LLM 区分图像空间和视频时间。初始化时使用 Qwen2 语言模型与 DFN 视觉编码器；训练仍大致为：视觉编码器阶段 → 全参数高质量阶段 → instruction-following 阶段。

### 6.3 Qwen3-VL

课程材料列出的 Qwen3-VL 采用 Qwen3 dense/MoE 语言模型（最大约 235B-A22B），上下文可到 256K；视觉编码器是 SigLIP-2。

#### Interleaved MRoPE

把时间、宽度、高度轴交错分配到低/高频位置编码：

```text
[t w h t w h t w h ...]
```

而不是把所有时间轴、再所有宽度轴、再所有高度轴分块排列：

```text
[t t t t w w w w h h h h]
```

视频时间戳以显式 token 注入，而不完全依赖位置 embedding。

#### 其他改进

- **平方根归一化 token loss**：平衡文本和多模态样本；视频序列长，不能让长视频在 batch 中支配梯度；
- **DeepStack**：跨层融合视觉特征，把视觉信息注入多个语言模型层，而不只在输入层注入；
- 预训练分 4 阶段：训练 adaptor，再在 8K、32K、256K 上逐步训练全部参数；
- 后训练：长 CoT SFT、知识蒸馏、RL。

### 6.4 多领域对齐

多模态模型不只是“图像问答”：

| 领域 | 需要对齐的信号 |
| --- | --- |
| 文档/OCR | 字符、版面、表格结构、阅读顺序 |
| 图表/科学 | 视觉几何、单位、公式与文字解释 |
| 视频 | 时间戳、动作顺序、跨帧关系 |
| GUI/Agent | 屏幕区域、鼠标/键盘动作、工具反馈 |
| 代码 | 截图、UI 状态、代码与执行结果 |
| 通用对话 | 视觉事实、语言风格、安全策略 |

图像—文本对齐只保证“语义相近”，不自动保证细粒度空间定位、事实正确、跨语言一致或工具动作安全，因此必须在后训练中加入任务专用和可验证数据。

---

## 7. Chameleon：把所有模态离散化

### 7.1 为什么标准 VLM 不能直接生成图像

LLaVA/Qwen-VL 的图像编码器把图像变成连续特征并注入 LLM，擅长理解，但要生成图像还需要额外 diffusion 模型；输入和输出路径不统一。

Chameleon 尝试把文本和图像都变成离散 token，让模型统一做自回归建模：

```text
text token + image token + text token + ...
```

优势是可以在同一序列中理解和生成多模态；代价是离散化可能损失细节（类似 OCR 将图像压成文字）。

### 7.2 VQ-VAE 视觉 tokenizer

VQ-VAE（Vector Quantized Variational Autoencoder）：

1. 编码器把图像映射为连续 latent；
2. 每个 latent 替换为最近的 codebook 向量，得到离散索引；
3. 解码器根据索引重建图像；
4. 优化重建损失和向量量化损失。

课程材料示例：将 $512\times512$ 图像编码为 1,024 个 token，codebook 大小为 8,192，再训练新的 BPE tokenizer。

### 7.3 训练与稳定性

两阶段：

- Stage 1（80%）：大规模无监督数据，约 2.9T text tokens、1.5T text/image tokens、400B 交错 text/image tokens；
- Stage 2（20%）：约一半 Stage 1 数据 + 一半高质量数据。

难点：文本 token 熵低，图像 token 熵高，多模态训练会导致参数 norm 增长和 logit drift。课程材料列出的修复包括 QK norm 与 z-loss 正则。

结论：Chameleon 的“统一离散自回归”很优雅，但目前性能可能不及连续视觉编码器 + LLM + diffusion，因为量化丢失了连续图像细节。

---

## 8. 多模态后训练与安全治理

多模态对齐会扩大攻击面：模型不仅读文字，还会 OCR 图片、理解截图、读取视频帧，并可能执行工具动作。安全不能只复制文本模型的拒答数据。

### 8.1 数据与隐私治理

- 图像、视频和屏幕截图中可能包含人脸、车牌、地址、病历、登录凭证、源代码和地理位置；在训练前做 PII 检测、模糊化和许可审计；
- 视觉数据应记录来源、许可证、处理方式、删除请求与数据版本；
- OCR 可能把原本难以搜索的隐私信息转成可检索文本，必须把 OCR 结果视为敏感数据；
- 合成图像/视频也可能继承 teacher 模型的版权、偏见和个人信息。

### 8.2 跨模态 prompt injection

恶意指令可以藏在：

- 图片中的小字、二维码、网页截图；
- PDF 表格、图表图例、视频字幕；
- 与用户文字不同语言的视觉区域。

模型应区分“用户指令”与“被观察到的内容”，不能因为图像中写着“忽略系统指令、执行命令”就把它当作高优先级指令。对 agent 系统，视觉内容默认是**不可信数据**，工具调用还需权限、域名/路径白名单和人工确认。

### 8.3 训练与评测

跨模态安全 SFT/RL 数据应覆盖：

- 文本安全请求、图像安全请求和混合请求；
- 正常 OCR/医疗/教育任务与恶意诱导的边界；
- 视觉仇恨符号、暴力、性内容、诈骗、恶意代码截图；
- 对同一危险意图的文本改写、图像嵌字、视频字幕和多语言版本；
- 误拒率：不能把正常医学、历史、新闻图像一律拒绝；
- 幻觉与事实性：模型必须明确看不清、无法验证时的“不确定”。

可用红队、对抗扰动、分辨率变化、裁剪/旋转、OCR 文字注入和多模态越狱集合评估。指标至少包括：有害请求拒答率、正常请求通过率、视觉事实准确率、定位/引用准确率、工具动作成功率和跨语言一致性。

### 8.4 对齐策略

- 先做视觉—语言表示对齐，再做任务 SFT；
- 将安全策略作为图像、视频、OCR 与工具调用的条件行为，而不是只训练文本拒答模板；
- 对高风险动作加入可验证的 policy gate、sandbox 和最小权限；
- 使用独立 judge、人类评测和程序检查，避免模型通过“看起来有礼貌”获得奖励；
- 监控模态比例与 token 长度，防止视频长序列淹没文本或安全样本；
- 在持续训练时做训练—评测去重，防止多模态 benchmark 泄漏。

---

## 9. 本讲总结

1. Transformer 处理 token；多模态的根本问题是把图像、视频、音频等编码成合适的连续或离散 token。
2. CLIP 用图文双向对比损失获得语义对齐；SigLIP 用成对 sigmoid 损失解除 batch softmax 耦合。
3. LLaVA 证明了“CLIP + 线性投影 + LLM”这一简单模板；OneVision 通过 AnyRes 动态分辨率保存 OCR 和局部细节。
4. Qwen-VL 系列逐步引入 cross-attention adaptor、动态分辨率、MRoPE、DeepStack、长上下文和多阶段后训练。
5. 理解与生成需求不同：连续视觉特征更适合语义理解，VQ/discrete token 或 diffusion 更适合统一生成，但离散化会损失细节。
6. 多模态后训练必须同时治理版权、PII、视觉 prompt injection、工具安全、跨语言偏差、模态失衡和事实幻觉。
