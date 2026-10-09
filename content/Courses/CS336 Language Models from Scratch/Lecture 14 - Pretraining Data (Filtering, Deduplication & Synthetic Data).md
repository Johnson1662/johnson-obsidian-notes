# Lecture 14 - Pretraining Data (Filtering, Deduplication & Synthetic Data)

> **课程主题**：预训练与后训练数据工程：文本清洗过滤、MinHash LSH 模糊去重、数据配比优化与合成数据
> **授课教师**：Percy Liang
> **核心目标**：掌握现代大模型数据处理全链路算法，深入理解启发式规则与分类器质量过滤（fastText/DCLM）、MinHash 局部敏感哈希（LSH）去重数学推导、数据配比算法（RegMix/Simulated Epoching）以及智能体合成数据管线（OpenThoughts/SWE-Zero）。

---

## 1. 数据抽取与清洗流水线 (Transformation)

原始互联网网页与学术文献通常包含大量非结构化干扰标记：
- **HTML 纯文本提取**：从 WARC 原始响应中提取主体文本，**Trafilatura** 与 **Resiliparse** 能精准剥离 DOM 树中的导航条、侧边广告与版权页脚，较官方 WET 提取质量大幅提升。
- **PDF 与结构化文献解析 (FinePDFs / Nougat)**：针对多栏排版、复杂数学公式与数据表格，采用视觉文档大模型（Docling / VLM OCR）将版面信息无损还原为 Markdown / LaTeX 格式。

---

## 2. 启发式与模型质量过滤 (Quality Filtering)

```
                            [ 数据质量过滤通用框架 ]
  目标高质量集合 T (Wikipedia/Books/ELI5) + 原始海量语料 R (Common Crawl)
                            │
                            ▼
           训练轻量级判别模型 / 计算领域困惑度
  ┌─────────────────────────┴─────────────────────────┐
  ▼                                                   ▼
生成式困惑度模型 (KenLM): score(x) = p_T(x)         判别分类器 (fastText): score(x) = P(T | x)
                            │
                            ▼
          保留 score(x) ≥ Threshold 的高质量语料子集 T'
```

### 2.1 主流过滤策略对比

| 过滤方案 | 核心算法与机制 | 典型应用模型 | 优缺点分析 |
| :--- | :--- | :--- | :--- |
| **基础启发式规则** | 行尾标点、句子数量 $\ge 3$、停用词比例、禁词表过滤 | C4, Gopher, RefinedWeb | 速度极快，但容易误杀代码、数学公式与古籍文学 |
| **语言识别 (LangID)** | 176 种语言 fastText 分类器（$P(\text{lang}) \ge 0.65$） | FineWeb, Dolma, LLaMA | 过滤非目标语种与乱码编码错误 |
| **领域困惑度过滤** | 基于目标高质量语料训练 5-gram **KenLM**，过滤高 PPL 文本 | CCNet, OpenMathText | 能够有效筛选语法流畅度，但对生僻专业词存在偏见 |
| **模型质量分类器** | 以 OpenHermes / ELI5 为正样本训练 **fastText 线性分类器** | **DCLM (DataComp-LM)** | **下游模型评测表现最优**，全面超越传统规则与 KenLM |
| **大模型教育价值打分**| 用 GPT-4 / 340B 模型对样本打分（1~5分），蒸馏小分类器 | **phi-1, Nemotron-CC** | 筛选极高密度合成与教科书级数据（Textbooks Are All You Need） |

---

## 3. 去重理论与 MinHash LSH 算法 (Deduplication)

数据去重不仅能节省数十万 GPU 训练算力，还能大幅降低模型对特定私有/版权文本的机械背诵与记忆过拟合。

### 3.1 精确去重 (Exact Deduplication)
- **文档级 / 跨度级哈希**：对整篇文档或 3 句话连续片段计算 MurmurHash / SHA-256，利用分布式 MapReduce 剔除重复哈希值（如 C4、Gutenberg 镜像站去重）。

### 3.2 模糊去重：Jaccard 相似度与 MinHash 定理

设文档 $A, B$ 的 $N$-gram 词袋集合分别为 $S_A, S_B$：
$$\text{Jaccard}(A, B) = \frac{|S_A \cap S_B|}{|S_A \cup S_B|}$$

- **MinHash 定理**：对于任意随机哈希函数 $h$，两个集合最小哈希值碰撞的概率严格等于它们的 Jaccard 相似度：
  $$P(\min_{x \in S_A} h(x) = \min_{y \in S_B} h(y)) = \text{Jaccard}(A, B)$$
- **多哈希签名（Signatures）**：生成 $n$ 个独立 MinHash 函数，得到长为 $n$ 的签名向量，将相似度估计转化为签名比对。

### 3.3 局部敏感哈希 (Locality Sensitive Hashing, LSH) 严格推导

为避免 $\mathcal{O}(N^2)$ 的全量两两签名比对，将 $n$ 个哈希函数划分为 **$b$ 个分桶（Bands），每个分桶包含 $r$ 个哈希函数**（$n = b \times r$）：

```
Signature Matrix (n = b * r):
Band 1: [ h_1, h_2, ..., h_r ] ──> Hash to Bucket
Band 2: [ h_{r+1}, ..., h_{2r}]──> Hash to Bucket
...
Band b: [ ..., ..., h_{br}   ] ──> Hash to Bucket
```

- **判定规则**：只要两篇文档在**任意一个 Band 内的全部 $r$ 个哈希值完全一致**，即判定为候选重复文档对。
- **碰撞概率 S 曲线公式**：
  设两篇文档的 Jaccard 相似度为 $s$：
  1. 在某一个固定 Band 内全部 $r$ 个哈希匹配的概率：$P_{\text{band}} = s^r$。
  2. 在该 Band 内不匹配的概率：$1 - s^r$。
  3. 在全部 $b$ 个 Band 内均不匹配的概率：$(1 - s^r)^b$。
  4. **至少在一个 Band 内发生碰撞的最终概率**：
     $$P(\text{Collision}) = 1 - (1 - s^r)^b$$
- **相变阈值（Threshold）**：S 曲线在 $s^* \approx \left(\frac{1}{b}\right)^{\frac{1}{r}}$ 处发生急剧相变。
  - 例如 $b = 20, r = 450$ 时，相似度高于 $s^*$ 的文档以近乎 $100\%$ 概率碰撞进同一分桶，低于 $s^*$ 的文档碰撞概率几乎为 $0$。

---

## 4. 多源数据配比优化 (Data Mixing)

在包含网页、百科、代码、学术论文等多源混合预训练时，如何为各数据源分配采样权重 $p(s)$？

```
                         [ 数据配比方法对比 ]
  1. 比例采样 (Proportional):      p(s) ∝ Tokens(s) ──> 网页主导，学术与代码被稀释
  2. 经验启发式 (Vibes Mixing):    人工直觉调整 ──> 易主观漂移
  3. UniMax (Epoch-Capped):       均匀采样但对稀缺高质量源设定硬性 Epoch 上限
  4. 回归配比 (RegMix / DoReMi):  小模型网格实验 ──> 拟合超参数与下游 Loss ──> 凸优化求解
```

### 4.1 模拟退火与跨尺度防过拟合 (Simulated Epoching)
- **陷阱**：在小规模实验（如 10B Tokens）中，将权重极度偏向稀缺高质量数据（如 10B 优质代码，此时仅跑 1 轮）会表现极佳；但若直接将该比例迁移至 1T Token 大模型训练，该高质量源将被重复训练 50~100 轮引发**灾难性过拟合**。
- **模拟轮次解法 (Simulated Epoching)**：在小模型实验前，将所有数据源按照目标大模型的缩放比例等比例下采样，迫使小模型提前暴露重复过拟合代价，从而寻找到真正可外推的大规模最优配比。

---

## 5. 后训练合成数据工程 (Synthetic Data)

```
                            [ 合成数据生成范式 ]
  1. 种子提示词库 ──> 强教师模型 (QwQ/DeepSeek-R1) ──> 采样多条长思维链 (CoT) ──> 严格规则过滤
  2. 真实 GitHub 代码仓库 ──> 自动化引入缺陷/需求 ──> Agent 执行轨迹录制 (SWE-Zero)
```

- **OpenThoughts (1.2M 推理数据集)**：以 QwQ-32B 为教师模型，单 Prompt 采样 16 条候选 CoT，聚焦数学与代码垂直领域蒸馏。
- **SWE-Zero / SWE-rebench**：突破传统软件工程任务必须依赖庞大 Docker 沙盒的基建瓶颈，利用超大代码模型内化语义执行，批量构建数十万条真实 PR 级别的交互式 Agent 解决轨迹。
