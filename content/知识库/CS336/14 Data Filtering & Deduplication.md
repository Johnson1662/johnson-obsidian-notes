# Lecture 14：数据过滤与去重（Data Filtering & Deduplication）

> 上一讲：在线服务 → dump/crawl → 处理后的数据；必须考虑 ToS、版权、许可证与合理使用。
> 本讲：把原始数据变成能稳定训练的语料，重点是**转换、过滤、去重、混合**，并说明中训练与 SFT 为什么大量依赖合成数据。

## 1. 数据工程 Pipeline 总览

完整的训练数据管线可以写成：

```text
HTML/PDF/代码仓库
      ↓
解析与线性化（HTML → text，PDF/OCR，git clone）
      ↓
语言识别、质量过滤、毒性/PII 过滤
      ↓
精确去重 + 模糊去重（MinHash + LSH）
      ↓
按来源和训练预算做 Data Mixing
      ↓
预训练 / 中训练 / SFT 数据
```

### 1.1 原始数据不是“文本文件”

常见输入：

- HTML：删除导航、广告等 boilerplate，提取正文；
- PDF（如 arXiv）：需要版面解析、OCR 或视觉语言模型（VLM）；
- 代码仓库：保留目录、文件、提交和工程上下文，而不是简单抓网页。

HTML→文本天然有损：必须把图片、表格、列表、代码与布局线性化，部分信息不可避免地丢失。规则工具包括 `trafilatura`、`resiliparse`、`jusText`、`lynx` 等。DCLM 的实验显示转换工具不同会改变 token 数量和下游任务准确率。

### 1.2 PDF 管线：FinePDFs 的例子

FinePDFs 从 Common Crawl 中重新抓取被截断的 PDF：

1. 递归抓取/重抓大文件，避免 Common Crawl 中的截断版本；
2. 用 VLM（如 RolmOCR）或 Docling 做 OCR 与结构解析，并让解析过程足够快；
3. 做大量清理、格式修复和质量过滤；
4. 接受一个基本事实：许多版面信息（列布局、图表语义、脚注关系）在纯文本中会丢失。

---

## 2. 过滤：把“好数据”推广到海量原始池

### 2.1 目标数据与原始数据

给定少量代表“好数据”的目标集合 $T$，以及海量原始集合 $R$，目标是找出 $R$ 的子集 $T'$，使其分布尽量接近 $T$：

$$
T' = \{x\in R : \operatorname{score}(x)\ge \tau\}.
$$

过滤器的两个要求：

1. **泛化**：不能只记住 $T$ 中的例子，而要识别不同但同样优质的文档；
2. **极快**：必须在 $R$ 的每个样本上运行，不能使用昂贵的大模型逐文档判断。

通用框架：

1. 从 $R,T$ 估计一个模型并导出评分函数；
2. 按分数阈值（确定性或随机地）保留 $R$ 中的样本。

| 模型类型 | 评分函数 | 直觉 |
| --- | --- | --- |
| 目标分布生成模型（KenLM） | $\operatorname{score}(x)=p_T(x)$（实践中常用负 perplexity） | “像目标语料的语言模型概率高” |
| 判别模型（fastText 等） | $\operatorname{score}(x)=p(T\mid x)$ | “分类器认为它属于好数据” |

### 2.2 是否应该使用模型过滤

刻意只使用规则、不使用质量分类器的配方包括 C4、Gopher、RefinedWeb、FineWeb、Dolma；GPT-3、LLaMA、DCLM 使用模型过滤，且模型过滤正在变成常见做法。

模型过滤的优点是能组合多种弱信号并泛化；缺点是会引入正例数据分布的偏见、误删长尾知识，并增加训练/推理成本。阈值不能脱离模型规模和训练 token 预算独立决定。

### 2.3 Gopher 与 C4 的启发式规则

规则过滤不训练一个大分类器，而是用可解释条件快速删除明显低质量页面。

#### C4 规则（基于 2019 年 4 月 Common Crawl 快照）

- 只保留以标点结尾且至少包含 5 个词的行；
- 页面少于 3 个句子则删除；
- 命中 bad-word 词表则删除；
- 包含 `{`（常提示代码）、`lorem ipsum`、`terms of use` 等模式则删除；
- 用 `langdetect` 过滤非英语，要求英语概率约 0.99；
- 后续还对 3 句 span 做精确去重。

#### Gopher/MassiveWeb 规则

- 保留英语，进行文档去重并删除与训练/测试集重叠的内容；
- 质量启发式示例：至少 80% 的词包含一个字母字符，避免导航、乱码、纯数字与模板垃圾；
- 使用 Google SafeSearch 过滤毒性，而非只靠粗俗词列表。

RefinedWeb、FineWeb、Dolma 也有意保留规则管线，避免训练数据定义的 ML 分类器把某种写作风格或领域偏见放大；GPT-3、LLaMA、DCLM 则使用分类器补足规则的泛化能力。实践中常将规则作为低成本第一阶段，再对剩余数据运行语言/质量/毒性模型。

---

## 3. 语言识别与质量/毒性分类器

### 3.1 语言识别

目标：从多语言网页中保留目标语言（如英语）。fastText language identification 是常用现成分类器：

- 支持 176 种语言；
- 在 Wikipedia、Tatoeba（翻译网站）、SETimes（东南欧新闻）等多语言站点上训练；
- Dolma 保留 $p(\text{English})\ge 0.5$ 的页面；FineWeb 使用更严格的 $p(\text{English})>0.65$；C4 的 `langdetect` 阈值为 0.99。

### 3.2 OpenMathText：数学领域质量过滤

OpenMathText 从 Common Crawl 构建大规模数学语料：

- 先使用规则，例如文档包含 LaTeX 命令；
- 用 ProofPile 训练的 KenLM，保留 perplexity < 15,000 的文本；
- 训练 fastText 数学文本分类器，阈值设置为：判断“是数学”时 0.17，判断“不是数学”时 0.8；
- 得到 147 亿 tokens，并训练 14 亿参数模型；模型效果超过只用其 20 倍数据训练的基线。

### 3.3 GPT-3 的质量分类器

- 正例：Wikipedia、WebText2、Books1、Books2 的采样；
- 负例：Common Crawl 的采样；
- 用词特征训练线性分类器；
- 根据分数随机保留文档。一种教学代码写法是：

```python
import numpy as np

def keep_document(score: float) -> bool:
    # score 越高，保留概率越大；Pareto 让高质量文档更容易保留
    return np.random.pareto(9) > 1 - score
```

### 3.4 LLaMA / RedPajama 的质量分类器

- 正例：被 Wikipedia **引用**的页面；
- 负例：Common Crawl 页面；
- 保留被分类为正例的文档。

这里的“被引用”只是高质量的代理信号，并不意味着每个引用页面都可靠。

### 3.5 phi-1：用强模型标注教育价值

phi-1 的哲学是用极高质量的“教材式数据”训练小模型（约 1.5B），数据包含 GPT-3.5/GPT-4 合成数据与过滤后的代码。

流程：

1. 原始集合 $R$：The Stack 的 Python 子集；
2. 给 GPT-4 的提示词：判断代码对“想学习基础编程概念的学生”的教育价值；
3. 用 GPT-4 分类 10 万样本得到正例 $T$；
4. 取预训练 CodeGen 的输出 embedding，训练随机森林分类器；
5. 在全体 $R$ 上筛选分类为正的代码。

HumanEval 结果：

| 训练数据 | 1.3B 模型结果 |
| --- | ---: |
| The Stack Python 子集（96K steps） | 12.19% |
| 新的教育价值过滤子集（36K steps） | 17.68% |

更少训练步数仍达到更高性能，说明过滤器改变了数据的有效质量。

### 3.6 Dolma 的毒性过滤

Dolma 使用 Jigsaw Toxic Comments（2018）数据集训练/校准毒性分类器。Wikipedia talk 页面评论被标注为：`toxic`、`severe_toxic`、`obscene`、`threat`、`insult`、`identity_hate`。

与单纯的 bad-word 列表相比，分类器可以识别上下文，但也可能误伤讨论敏感主题的非毒性文本，因此需要阈值与抽样审查。

### 3.7 过滤阈值依赖训练规模

不存在一个对所有实验都最优的过滤阈值：

- 若训练时间较短/预算较小，应提高阈值，集中在少量高质量数据；
- 若训练时间更长，应放宽阈值以获得更多多样性和长尾知识；
- 高质量数据会被反复 epoch，低质量数据通常更丰富。

因此阈值必须和模型大小、总训练 tokens、领域覆盖一起调节，而不是只在小规模实验上选一次。

---

## 4. 去重：精确重复与近重复

### 4.1 为什么要去重

重复数据会：

- 浪费训练 tokens，降低有效数据量；
- 增强模型记忆，导致隐私和版权风险；
- 让训练/评测发生泄漏，虚高 benchmark；
- 放大模板化、低信息密度文本。

重复类型：

1. **精确重复（exact duplicate）**：镜像网站、GitHub fork、完全相同的文件；
2. **近重复（near duplicate）**：只改少量词、格式或标点的相同文本。

常见近重复：MIT 等许可证全文、模板化产品介绍、复制粘贴的文章、自动生成的同一模版。C4 中某段产品描述被重复 61,036 次，是近重复危害的典型例子。

去重设计空间由三个问题决定：

1. **item 是什么**：句子、段落、文档，还是 $n$-gram？
2. **如何匹配**：完全相等、存在共同子项，还是共同子项比例超过阈值？
3. **采取什么动作**：全部删除、只保留一个，还是删除其中较低质量者？

核心难点是“比较所有 item”需要 $O(N^2)$；规模化方案必须接近线性时间。

### 4.2 哈希函数

哈希函数 $h$ 把任意 item 映射成更小的整数或字符串。不同输入产生相同值称为碰撞：

$$
h(x)=h(y),\quad x\ne y.
$$

哈希设计在速度与抗碰撞性之间取舍：

| 哈希 | 特点 | 用途 |
| --- | --- | --- |
| SHA-256 等密码学哈希 | 抗碰撞强、较慢 | 完整性、Bitcoin |
| DJB2、MurmurHash、CityHash | 不保证密码学抗碰撞、很快 | 哈希表、大规模去重 |

课程代码使用 MurmurHash：

```python
import mmh3
h = mmh3.hash("hello")
```

---

## 5. 精确去重（Exact Deduplication）

### 5.1 教学示例

设置：item 是字符串；匹配方式是完全相等；每组只保留一个。

```python
import itertools
import mmh3

items = ["Hello!", "hello", "hello there", "hello", "hi", "bye"]

# 按哈希排序，然后把相同哈希的 item 分组
hash_items = itertools.groupby(
    sorted(items, key=mmh3.hash), key=mmh3.hash
)

# 每组保留第一个
# 生产代码还应在哈希相同后再次比较原文，避免理论碰撞误删
deduped_items = [next(group) for h, group in hash_items]
```

优点：语义清晰、实现简单、精确率高；缺点：无法识别近重复。代码采用 MapReduce 风格，可以把“按哈希分桶”和“每桶保留一个”并行化到大规模数据。

> 上面示例中 `"Hello!"` 和 `"hello"` 仍然不同；如果要把大小写、空白、Unicode 标点归一化，必须先定义规范化规则，并接受它可能把不同语义合并。

### 5.2 C4 的 3 句 span 去重

C4 的设置：

1. item：连续 3 句的 span；
2. 匹配：完全匹配；
3. 动作：每个 span 只保留一个。

警告：如果从文档中间删除一个重复的三句 span，前后段落可能失去连贯性。因此生产管线应记录删除位置，或改为删除整篇文档/重建段落，而不是无条件拼接残余文本。

---

## 6. Jaccard 相似度与 MinHash

### 6.1 Jaccard 相似度

把文档表示成 token、字符 $n$-gram 或句子集合。Jaccard 相似度定义为：

$$
J(A,B)=\frac{|A\cap B|}{|A\cup B|}.
$$

课程示例：

$$
A=\{1,2,3,4\},\quad B=\{1,2,3,5\},\quad
J(A,B)=\frac{3}{5}=0.6.
$$

当 $J(A,B)\ge \tau$ 时，把文档称为近重复。

```python
A = {"1", "2", "3", "4"}
B = {"1", "2", "3", "5"}

def compute_jaccard(A, B):
    return len(A & B) / len(A | B)
```

直接比较全部文档仍是二次复杂度，需要能在线性/近线性时间产生候选。

### 6.2 MinHash 的核心性质

MinHash 使用随机哈希函数 $h$，对集合 $S$ 取最小哈希值：

$$
\operatorname{minhash}_h(S)=\min_{x\in S} h(x).
$$

关键性质：

$$
\Pr_h\left[\operatorname{minhash}_h(A)=\operatorname{minhash}_h(B)\right]
=J(A,B).
$$

普通哈希希望不同 item 尽量不碰撞；MinHash 反而希望**碰撞概率等于集合相似度**。

```python
import mmh3

def minhash(S: set[str], seed: int):
    return min(mmh3.hash(x, seed) for x in S)
```

#### 为什么性质成立

把 $A\cup B$ 中的元素按随机排列看待。最先出现的元素若属于 $A\cap B$，则两个集合的最小元素相同；若最先出现的元素属于对称差（只属于 A 或只属于 B），最小元素不同。随机排列中，最先元素落入交集的概率就是：

$$
\frac{|A\cap B|}{|A\cup B|}=J(A,B).
$$

特征矩阵表示：

| item | A | B |
| --- | ---: | ---: |
| 1 | 1 | 1 |
| 2 | 1 | 1 |
| 3 | 1 | 1 |
| 4 | 1 | 0 |
| 5 | 0 | 1 |

使用 $n$ 个独立种子，匹配比例可估计 Jaccard：

```python
n = 100
matches = [minhash(A, seed) == minhash(B, seed) for seed in range(n)]
estimated_jaccard = sum(matches) / len(matches)
assert abs(estimated_jaccard - compute_jaccard(A, B)) < 0.01
```

但单次 MinHash 碰撞仍是随机事件；一次碰撞不能直接说明 $J(A,B)>\tau$。因此需要 LSH 锐化概率曲线。

---

## 7. MinHash + LSH（Locality-Sensitive Hashing）

### 7.1 Banding 结构

使用 $n$ 个 MinHash，把签名分成 $b$ 个 band，每个 band 包含 $r$ 个哈希：

$$
n=b\times r.
$$

文档 A、B 被判定为候选重复，当且仅当**至少一个 band 中的全部 $r$ 个哈希都相同**。这是“band 内 AND、band 间 OR”，能把相似度阈值变得尖锐。

示例：$n=12,b=3,r=4$：

```text
h1 h2 h3 h4 | h5 h6 h7 h8 | h9 h10 h11 h12
```

### 7.2 碰撞概率推导

设 Jaccard 相似度为 $s$。

一个 band 中全部 $r$ 个哈希相同的概率：

$$
p_{\text{band}}=s^r.
$$

$b$ 个 band 中至少一个匹配的概率：

$$
P_{\text{collision}}(s;b,r)=1-(1-s^r)^b.
$$

```python
def get_prob_collision(sim, b, r):
    prob_match = sim ** r
    return 1 - (1 - prob_match) ** b

# 例：s=0.8, b=5, r=10
p = get_prob_collision(0.8, b=5, r=10)
```

参数影响：

- 增大 $r$：每个 band 更难全匹配，曲线向右移动，更难判为重复；
- 增大 $b$：有更多 band，曲线向左移动，更容易产生候选。

经典设置：$n=9000,b=20,r=450$。相变大致发生在

$$
s_{\text{threshold}}\approx\left(\frac1b\right)^{1/r}.
$$

当 $s^r=1/b$ 时，固定 band 的匹配概率是 $1/b$；至少一个 band 碰撞的概率为

$$
1-\left(1-\frac1b\right)^b\approx 1-\frac1e\approx 0.632.
$$

LSH 只负责生成候选对；候选还应使用真实 Jaccard、编辑距离或 token 重叠再次确认，以控制误报。

### 7.3 规模化去重的工程建议

1. 先把文档切成固定大小的 token/字符 $n$-gram 集合；
2. 对每个集合计算 MinHash 签名；
3. 按 band 哈希写入分桶存储；
4. 只在同桶候选内计算精确 Jaccard；
5. 按质量、时间、来源许可证选择保留者；
6. 记录“哪些文档因哪个候选被删”，支持审计和回滚。

---

## 8. Data Mixing：不同来源如何配比

语言模型通常同时训练 Wikipedia、Common Crawl、GitHub、书籍、论文等来源。问题不是“有没有数据”，而是采样分布 $p(s)$ 应该如何设定。

例子：

```python
sources = {"Wikipedia", "CC", "GitHub"}
p = {"Wikipedia": 0.3, "CC": 0.5, "GitHub": 0.2}
```

### 8.1 三种基线

| 方法 | 定义 | 问题 |
| --- | --- | --- |
| 人工直觉（vibes） | 手工设置 $p(s)$ | 常见但难以复现、难以优化 |
| 均匀采样 | $p(s)\propto 1$ | 小来源与大来源占同样概率 |
| 按 token 比例 | $p(s)\propto N_s$ | 低质量的大来源可能支配训练 |

直觉上高质量来源应被上采样，但还必须考虑多样性和有限数据。

### 8.2 Epoching 与过拟合

来源是有限的；若在小数据源上给很大采样权重，就必须重复 epoch。

```python
def billion(x):
    return x * 10**9

def trillion(x):
    return x * 10**12

source_token_counts = {
    "low": trillion(10),   # 10T，丰富但较低质量
    "high": billion(10),   # 10B，稀缺但高质量
}
p = {"low": 0.5, "high": 0.5}
train_tokens = trillion(1)
low_num_epochs = p["low"] * train_tokens / source_token_counts["low"]
high_num_epochs = p["high"] * train_tokens / source_token_counts["high"]
```

此时高质量来源会被重复约 50 个 epoch，容易过拟合、记忆甚至破坏泛化。

### 8.3 UniMax：带 epoch 上限的混合

UniMax 研究多语言平衡，观察到以

$$
p(s)\propto N_s^\alpha,\qquad \alpha\in[0,1]
$$

可以在均匀与按 token 比例之间插值。它进一步提出硬上限 $C$：

$$
p(s)\times N_{\text{train}}\le C,
$$

即任一来源最多被训练到指定 epoch 数。超过上限后重新分配概率，避免小来源无限重复。

### 8.4 回归式混合（Regression-based Mixing）

把混合系数当成可优化变量：

1. 在混合分布 $p$ 上定义搜索空间，例如 Dirichlet 分布；
2. 以线性回归、梯度提升树等拟合“混合 → 验证集指标”的关系；
3. 用小规模实验的下游评测作为目标，寻找最优配比；
4. 将配比迁移到更大训练规模。

两个关键假设：

- 回归模型在最优点附近足够准确；
- 小模型得到的最优混合能迁移到大模型。

这两个假设都可能失败，且下游评测过多会导致过拟合。

### 8.5 Simulated Epoching

存在尺度依赖：小实验可能愿意让高质量小数据占 90%，因为还没重复太多；大实验使用同一比例会严重 epoch。

Simulated Epoching 的思想是让小规模实验“看起来像”大规模数据有限：

```python
small_run_tokens = billion(10)
large_run_tokens = trillion(1)
ratio = small_run_tokens / large_run_tokens

downsampled_counts = {
    source: count * ratio
    for source, count in source_token_counts.items()
}
```

先按比例下采样每个来源，再做小规模混合；在被下采样的数据上过度重复会显出代价，因此找到的最优混合更可能平衡质量与多样性。

### 8.6 Data Mixing 小结

- 问题：如何在通用文本、Wikipedia、代码、论文等来源间分配权重；
- 回归式混合类似数据版 scaling law：估计小规模损失并优化分布；
- 必须显式处理来源有限、epoching 与过拟合，可使用 UniMax 的 cap 或 simulated epoching。

---

## 9. 中训练 / 后训练的合成数据

后训练数据常见配方：

1. 定义环境（数学、代码仓库、浏览器、工具等）；
2. 定义任务/提示词；
3. 用强模型（teacher）生成多条回答或 agent 轨迹；
4. 过滤正确性、格式、难度和安全性，再用于中训练或 SFT/RL。

### 9.1 OpenThoughts

- 用 QwQ-32B 作为 teacher，生成约 120 万例；
- 问题来自 27 个人类与合成来源，包括 Stack Exchange、NuminaMath、化学等；
- 每个 prompt 采样 16 条回答通常有帮助；
- 更大的模型不一定是更好的 teacher：QwQ-32B 在此实验中优于 DeepSeek-R1；
- 过滤回答未必有帮助；
- 小而高质量的来源（如 OpenMath-2-Math）可能胜过大而杂的来源。

### 9.2 SWE-smith、SWE-Zero 与 SWE-rebench

#### SWE-smith

给定仓库，让 LM 自动引入 bug、生成软件工程任务；128 个 GitHub 仓库生成约 5 万任务。

#### SWE-Zero

SWE 任务依赖复杂环境，不像数学/代码竞赛那样容易配置：成千上万个 Docker 镜像会造成基础设施噩梦。观察发现，强模型许多时候不需要执行反馈也能解决任务，因为其内部已有代码语义的“世界模型”。

- 生成约 30 万条不依赖仓库执行的 agent 轨迹；
- 来源约 15 万个 GitHub PR；
- 使用 OpenHands scaffold，去掉未来 git commit，防止 agent 通过“git hacking”作弊；
- 由 Qwen3-Coder-480B 蒸馏并过滤，仍尽量尝试执行；
- SWE-Hero 另有约 1.3 万条需要执行反馈的轨迹。

#### SWE-rebench

- 3,400 个 GitHub 仓库中的 2.1 万个交互式 Python SWE 任务；
- GitHub 与 GitHub Archive 共 45 万 PR；
- 用 Qwen2.5-72B-Instruct 安装依赖并评估 PR 质量。

#### SWE-ZERO-12M-trajectories

- 将 SWE-Zero 扩展到 1,200 万条轨迹；
- 使用 SWE-rebench-v2（3.2 万可执行任务 + 12 万不可执行任务）；
- 用很小的 mini-coder-1.7B（pass@100 为 50.4）与 mini-swe-agent scaffold 生成轨迹；
- 合成 prompt 可以是完全合成、半合成（真实环境 + 合成任务）或真实 GitHub PR；回答通常来自有能力且善于教学的模型。

### 9.3 合成数据的通用结论

- 生成 prompt：完全合成 < 半合成（真实环境 + 合成任务） < 真实任务，真实性与规模需要权衡；
- teacher 选择和样本过滤比单纯扩大数量重要；
- 执行型代码环境成本高，不能照搬数学任务的生成流程；
- 合成数据仍需去重、毒性/PII 筛选、正确性验证和训练—评测去重。

---

## 10. 本讲总结

1. **转换**：原始数据不是文本；HTML、PDF、代码需要不同解析器，转换质量会改变模型能力。
2. **过滤**：定义目标数据，训练语言识别、质量、毒性分类器，再将评分推广到海量原始数据。
3. **去重**：精确哈希适合完全相同文本；MinHash 用碰撞概率估计 Jaccard，LSH 用 banding 将近重复搜索降到近线性。
4. **混合**：不要只凭直觉设置来源比例；考虑质量、多样性、来源有限、epoching 和模型尺度，可用 cap 或 simulated epoching。
5. **后训练数据**：它更像评测与真实环境，广泛使用强 teacher 合成问题、回答和 agent 轨迹，但必须验证正确性与防止环境作弊。
6. 大量数据工作仍依赖领域知识、人工查看样本和工程审计，不存在一个脱离任务的“万能过滤器”。
