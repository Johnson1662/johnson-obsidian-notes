# CS336 Lecture 1：语言模型导论与 Tokenization

> **课程主题**：Language Models from Scratch（从零构建语言模型）  
> **本讲目标**：理解语言模型为何需要分词器；掌握 Unicode、UTF-8、字符/字节/单词分词的取舍；从零推导并实现 Byte-Pair Encoding（BPE）。

---

## 1. 为什么要从零理解语言模型

### 1.1 抽象层次不断上移，但抽象仍然会“泄漏”

语言模型技术的使用方式在近十年发生了明显变化：

| 时间 | 研究者通常如何使用模型 | 主要抽象层次 |
| --- | --- | --- |
| 2016 | 自己实现并训练模型 | 直接操作算法、数据和硬件 |
| 2018 | 下载 BERT 等预训练模型，再微调 | 使用预训练模型 |
| 2020 左右 | 对 GPT-3 一类 API 进行提示 | 使用模型服务 |
| 2022 | 与 ChatGPT 对话 | 把模型当作交互系统 |
| 2026 | 让模型作为 Agent 自主调用工具 | 把模型当作行动者 |

抽象提高了生产力，但语言模型的抽象并不像编程语言或操作系统那样稳定：

- 数据管线、优化器、GPU 内核、并行策略等细节会直接影响结果；
- 许多“黑盒”接口会掩盖真正的瓶颈，导致研究者与底层技术脱节；
- 仍然存在需要修改模型、训练目标或硬件执行方式的基础研究问题。

因此本课程采用 **understanding via building（通过构建来理解）**：不只调用现成模型，而是亲手实现分词器、Transformer、训练循环、并行和对齐算法。

### 1.2 前沿模型的工业化与可迁移知识

前沿模型的训练成本很高，公开资料通常也不完整。例如：GPT-4 的训练成本被估计达到约 $10^8$ 美元，前沿公司会部署数十万张 GPU。个人或课程不可能复现这种规模，但仍能学到三类可迁移知识：

| 类型 | 含义 | 能否跨规模迁移 |
| --- | --- | --- |
| **Mechanics（机制）** | Transformer 如何计算、模型并行如何拆分、KV Cache 如何工作 | 较能迁移 |
| **Mindset（思维方式）** | 认真做资源核算，尽量减少数据移动，严肃看待 scaling | 较能迁移 |
| **Intuitions（经验直觉）** | 哪种数据混合、激活函数或超参数最有效 | 只能部分迁移，需实验验证 |

不能把“规模重要”误读成“算法不重要”。正确的表述是：

> **真正重要的是能够随规模扩展的算法。**

可用一个粗略关系概括：

$$
\text{accuracy} \approx \text{efficiency} \times \text{resources}。
$$

当算力和数据预算变大时，低效算法造成的浪费也会按规模放大。因此本课程始终围绕一个问题：

> 在固定的数据、显存、算力和通信预算下，如何训练出最好的模型？

### 1.3 语言模型发展脉络

| 阶段 | 代表思想/模型 | 关键贡献 |
| --- | --- | --- |
| 2010 年代以前 | Shannon 熵、N-gram | 用概率度量语言不确定性；N-gram 用局部统计服务于机器翻译和语音识别 |
| 神经网络基础 | LSTM、Bengio 神经语言模型、Seq2Seq、Adam | 长依赖、词向量、序列到序列学习、稳定优化 |
| 注意力与 Transformer | Bahdanau Attention、Transformer | 让每个位置选择性读取其他位置，且能并行训练 |
| 早期基础模型 | ELMo、BERT、T5 | 预训练后迁移；把不同任务统一成文本到文本 |
| Scaling 阶段 | GPT-2、Scaling Laws、GPT-3、PaLM、Chinchilla | 零样本、上下文学习；发现损失对模型规模/数据/算力具有可预测规律 |
| 开放模型 | GPT-J、OPT、BLOOM、Llama、Mistral、DeepSeek、Qwen、Olmo 等 | 开放权重、论文、代码或数据，推动可复现研究 |

模型的使用方式变了，但底层基本功仍然相同：注意力、张量运算、优化、数据和硬件效率。变化更多体现在上下文更长、推理成本更重要、模型需要调用工具。

---

## 2. 课程地图与效率视角

### 2.1 一个基础语言模型由什么组成

本课程的第一个目标是训练一个基础语言模型，组件可分为：

1. **Tokenization**：把原始字节/字符串转换成整数序列；
2. **Model architecture**：用 Transformer 等网络预测下一个 token；
3. **Training**：用损失函数、优化器、学习率计划和资源预算训练参数。

后续还会讨论：

- **Systems**：GPU kernel、算子融合、数据/张量/流水线并行、推理；
- **Scaling laws**：在小模型上拟合规律，预测大规模训练的超参数和损失；
- **Data**：网页/书籍/论文/代码的转换、过滤、去重、混合和合成；
- **Alignment**：PPO、DPO、GRPO 等偏好优化。

### 2.2 资源核算的基本量

训练一个 $N$ 参数模型、使用 $D$ 个 token，常用的一阶估计是：

$$
C_{\text{train}} \approx 6ND\quad\text{FLOPs}。
$$

其中：

- 前向传播约 $2ND$ FLOPs；
- 反向传播约 $4ND$ FLOPs；
- 总计约 $6ND$ FLOPs（短上下文 Transformer 也常用此估计）。

模型必须在数据、HBM 显存、GPU 计算单元以及 GPU 间通信带宽之间移动。模型架构的许多“新技巧”——例如共享 KV、滑动窗口注意力、MoE——本质上都在降低这些资源的消耗。

### 2.3 Assignment 1 的实践目标

第一份作业将从底层实现：

- BPE tokenizer；
- Transformer、交叉熵损失、AdamW 和训练循环；
- 参数、激活、梯度、优化器状态的资源核算；
- 在 TinyStories 和 OpenWebText 上训练；
- 在固定约 45 分钟 B200 预算内最小化 OpenWebText perplexity。

一个好的实现需要同时平衡：

| 目标 | 问题 |
| --- | --- |
| 表达能力 | 能否表示数据中的复杂依赖？ |
| 稳定性 | 参数和梯度范数是否处于合适范围？ |
| 效率 | 在训练和推理硬件上是否足够快？ |

---

## 3. 课程路线：从基础机制到对齐

CS336 是一门 5 学分的高强度实践课，材料、录课和集群指南在线提供。课程不提供完整脚手架，而是提供单元测试和 adapter interface：先在本地验证正确性，再在集群上 benchmark 速度与质量。

### 3.1 五个作业单元

| 单元 | 核心内容 | 典型练习 |
| --- | --- | --- |
| Assignment 1：Basics | 分词、架构、训练、资源核算 | 实现 BPE、Transformer、交叉熵、AdamW、训练循环；在 TinyStories/OpenWebText 上训练 |
| Assignment 2：Systems | kernel、并行、推理 | Triton 融合 RMSNorm、分布式数据并行、优化器状态分片、profile |
| Assignment 3：Scaling laws | 计算预算与超参数迁移 | 在小规模预算上拟合损失规律，外推目标规模的模型/数据配比 |
| Assignment 4：Data | 评测、清洗、过滤、去重、混合 | HTML 转文本、质量/有害分类器、MinHash 去重 |
| Assignment 5：Alignment | 偏好学习与强化学习 | 实现 DPO 与 GRPO |

课程 AI policy 的重点不是禁止工具，而是提醒：coding agent 可以替你完成作业，却不会自动带来理解；AI 更适合用于答疑、辅导和检查思路，并应遵守课程提供的 `AGENTS.md` 和 AI policy guide。课程计算资源由 Modal 等平台提供。

### 3.2 其余单元的资源视角

#### Systems：把硬件用满

- kernel 是在 GPU 上运行的函数；PyTorch 每个 primitive 往往会启动标准 kernel；
- 通过 operator fusion（如 matmul+activation）和 tiling（如 FlashAttention）减少 HBM 往返；
- 1024 张 GPU 的通信通常比本地计算慢，需使用 gather、reduce、all-reduce 等 collective；
- 参数、梯度、激活、优化器状态可以跨 GPU shard；并行方式包括 data、tensor、pipeline、sequence、expert parallelism；
- 推理分为 **prefill**（整段 prompt 并行，偏 compute-bound）和 **decode**（逐 token，偏 memory-bound）；量化、剪枝、蒸馏、speculative decoding、融合 kernel、continuous batching 可降低成本。

#### Scaling laws：把昂贵调参变成可迁移配方

直接在 $10^{25}$ FLOPs 上调参不可行，因此把“规模”理解为一个 scaling recipe：在较小预算上运行多组实验，拟合 loss 随 $N,D,C$ 的规律，再外推目标预算。经典计算最优结果给出一个有用的一阶经验：

$$
C\approx6ND,\qquad D\approx20N，
$$

即 70B 参数模型大约需要 1.4T token（只讨论训练成本，不含推理偏好）。预测性和最优性同样重要；参数化（如 muP）还要让学习率等超参数可跨宽度迁移。

#### Data：评测、清洗和混合

- 评测既用于内部开发（比较不同规模的平滑趋势），也用于外部质量（真实任务的生态有效性）；除了 perplexity，还需要 GPQA、HLE、SWE-Bench、Terminal-Bench 等多样测试；
- 原始数据来自网页、书籍、arXiv、GitHub 等，需将 HTML/PDF 转文本；
- filtering 保留高质量、移除有害内容；deduplication 用 Bloom filter/MinHash 节省计算并降低记忆；
- data mixing 决定不同来源的上采样/下采样；重写和合成数据可让分布更贴近下游任务；
- pretraining data 要大且多样，mid-training data 强调质量和长上下文，post-training data 包含对话和工具调用轨迹。

#### Alignment：从弱监督改善已有模型

当模型已会预测下一个 token 后，可以让它生成回答，由人类、verifier 或 LM judge 评分，再提高好回答的概率：

1. 生成候选回答；
2. 进行偏好/奖励评分；
3. 更新策略使其偏向更好回答。

PPO 需要 value function，DPO 直接使用偏好对，GRPO 用同组相对奖励移除 value function。挑战包括 RL 不稳定、异步 rollout 基础设施昂贵，以及系统效率和 on-policy 程度之间的折中。

### 3.3 从“微调模型”到“行动模型”

对语言模型的描述也在演化：BERT 常被视为“拿来微调的模型”，GPT-3 是“拿来提示的模型”，ChatGPT 是“拿来对话的模型”，Agent 则是“能自主行动的模型”。底层注意力、kernel 和优化基本不变，但规格发生变化：上下文更长、推理效率更重要、模型需要规划并调用工具。

---

## 4. Tokenization：模型操作的“原子”

### 4.1 语言模型并不直接处理字符串

原始文本通常是 Unicode 字符串。语言模型却要对一个离散整数序列建模：

$$
P(x_{1:T}) = \prod_{t=1}^{T}P(x_t\mid x_{<t}),
$$

其中 $x_t$ 是 token 的整数索引，词表大小为 $V$，每个条件分布是 $V$ 维向量。

因此 tokenizer 提供双向接口：

```python
from abc import ABC

class Tokenizer(ABC):
    """字符串/字节与整数 token 序列之间的双向接口。"""
    def encode(self, string: str) -> list[int]:
        raise NotImplementedError

    def decode(self, indices: list[int]) -> str:
        raise NotImplementedError
```

完整转换链为：

```text
原始字符串
   ↓ UTF-8 编码
字节序列
   ↓ 按词表映射/合并
整数 token 序列
   ↓ 模型与概率分布
预测 token
   ↓ 词表反查 + UTF-8 解码
a string
```

### 4.2 为什么不直接按字符或字节训练

Transformer 的全注意力对序列长度 $T$ 的计算和显存近似为 $O(T^2)$。一个好的 tokenizer 应该：

- 把常见的连续字节压缩成一个 token，减少 $T$；
- 对不同片段使用可变粒度：常见词可以整体表示，稀有/复杂片段拆成更小单元；
- 保持可逆：任意输入都应能无损 `encode → decode`。

定义压缩率（更准确地说是每个 token 承载的 UTF-8 字节数）：

$$
\text{compression ratio}
= \frac{\text{UTF-8 字节数}}{\text{token 数}}。
$$

```python
def get_compression_ratio(string: str, indices: list[int]) -> float:
    num_bytes = len(string.encode("utf-8"))
    return num_bytes / len(indices)
```

压缩率越大，序列越短，注意力的二次成本越低。但盲目增大词表会造成参数稀疏、训练样本不足，因此要在压缩率和词表大小之间折中。

---

## 5. Unicode、码点与 UTF-8

### 5.1 Unicode 码点

Unicode 为字符分配整数 **code point（码点）**。Python 的 `ord` 把字符转为码点，`chr` 做反向转换：

```python
assert ord("a") == 97
assert ord("🌍") == 127757
assert chr(97) == "a"
assert chr(127757) == "🌍"
```

字符序列 `"Hello, 🌍! 你好!"` 是 Unicode 字符的序列；不同字符占用的码点数仍然是一个一个字符。

### 5.2 字符级 tokenizer

```python
class CharacterTokenizer(Tokenizer):
    """把字符串表示为 Unicode 码点序列。"""
    def encode(self, string: str) -> list[int]:
        return list(map(ord, string))

    def decode(self, indices: list[int]) -> str:
        return "".join(map(chr, indices))

string = "Hello, 🌍! 你好!"
tok = CharacterTokenizer()
ids = tok.encode(string)
assert tok.decode(ids) == string
```

问题：

1. Unicode 字符总量约 15 万，词表很大；
2. 许多字符极其稀有（例如某个 emoji），为它们单独分配 token 浪费容量；
3. 词表大却不一定压缩得好，字符级 token 对多字节文字尤其不划算。

### 5.3 UTF-8 字节级 tokenizer

UTF-8 把 Unicode 字符编码为 1～4 个字节，每个字节都是 $0\ldots255$，所以基础词表固定为 256：

```python
assert "a".encode("utf-8") == b"a"
assert "🌍".encode("utf-8") == b"\xf0\x9f\x8c\x8d"

class ByteTokenizer(Tokenizer):
    def encode(self, string: str) -> list[int]:
        return list(string.encode("utf-8"))

    def decode(self, indices: list[int]) -> str:
        return bytes(indices).decode("utf-8")

string = "Hello, 🌍! 你好!"
tok = ByteTokenizer()
ids = tok.encode(string)
assert tok.decode(ids) == string
assert all(0 <= i < 256 for i in ids)
```

优点是词表小、任意 Unicode 都能表示、没有未登录字符；缺点是每个字节都成为 token：

$$
\text{compression ratio}_{\text{byte}}=1
$$

多字节字符会扩张序列，受限上下文中尤其低效。

### 5.4 单词级 tokenizer

经典 NLP 常按单词切分，例如：

```python
import regex

string = "I'll say supercalifragilisticexpialidocious!"
chunks = regex.findall(r"\w+|.", string)
# 可得到字母数字块、空格和标点等片段
```

优点：token 往往有语义，序列压缩率较好。缺点：

- 训练语料中不同单词数量可能极大，词表不易固定；
- 罕见词几乎没有足够样本学习；
- 测试时出现训练中没见过的新词，只能映射到 `UNK`（unknown）；
- `UNK` 丢失了原始拼写，也会让 perplexity 的统计失真。

### 5.5 三种朴素 tokenizer 对比

| 类型 | 基础词表 | 压缩率 | 未登录词 | 主要问题 |
| --- | ---: | ---: | --- | --- |
| 字符 | 约 15 万 Unicode 码点 | 取决于字符 | 无 | 词表大且稀疏 |
| 字节 | 256 | 1 字节/token | 无 | 序列太长，注意力成本高 |
| 单词 | 训练语料中的不同词 | 通常较高 | 有 | 词表不稳定，`UNK` 丢信息 |
| BPE | 256 + 数据驱动合并 | 高且可调 | 无需 `UNK` | 训练/推理实现更复杂 |

理想的 tokenizer 应让模型操作“有意义但可变长度的块”：频繁片段用大块，稀有片段退化到字节。BPE 正是这种折中。

---

## 6. Byte-Pair Encoding（BPE）原理

### 6.1 历史与核心直觉

- BPE 最初由 Philip Gage（1994）提出，用于数据压缩；
- 后被用于神经机器翻译，之后 GPT-2 等语言模型广泛采用；
- 核心思想：**先从单字节开始，反复把训练语料里最常见的相邻 token 对合并成一个新 token**。

高频序列（如 `the`、常见后缀、前导空格+单词）会被压缩成一个 token；罕见序列仍由多个较短 token 表示。因此无需为每个完整单词建立词表，也无需 `UNK`。

### 6.2 词表与 merge 表的形式化表示

基础字节 token 的索引为 $0\ldots255$。第 $i$ 次合并产生的新索引为 $256+i$。

- `vocab: index → bytes`：每个 token 对应的字节串；
- `merges: (index_a, index_b) → new_index`：某个相邻 token 对合并后的索引。

设当前序列为 $I=(i_1,\ldots,i_m)$，选择最常见相邻对

$$
(a^*,b^*)=\arg\max_{(a,b)}\operatorname{count}_I(a,b)。
$$

用新 token $c$ 替换所有 **不重叠** 的 $(a^*,b^*)$，得到更短的序列。

### 6.3 `merge`：一次合并的代码

```python
def merge(indices: list[int], pair: tuple[int, int], new_index: int) -> list[int]:
    """把 indices 中所有不重叠的 pair 替换为 new_index。"""
    new_indices = []
    i = 0
    while i < len(indices):
        if (
            i + 1 < len(indices)
            and indices[i] == pair[0]
            and indices[i + 1] == pair[1]
        ):
            new_indices.append(new_index)
            i += 2
        else:
            new_indices.append(indices[i])
            i += 1
    return new_indices
```

从左到右扫描意味着重叠对不会重复使用。例如序列 `aaa` 里，若合并 `(a,a)`，结果是 `[aa, a]`，而不是两个重叠的 `aa`。

### 6.4 统计相邻 token 对

```python
from collections import defaultdict

def count_adjacent_pairs(indices: list[int]) -> dict[tuple[int, int], int]:
    counts = defaultdict(int)
    for index1, index2 in zip(indices, indices[1:]):
        counts[(index1, index2)] += 1
    return counts
```

### 6.5 训练算法：从字节到词表

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class BPETokenizerParams:
    vocab: dict[int, bytes]                 # token id -> 字节串
    merges: dict[tuple[int, int], int]      # (id1, id2) -> 新 id

def train_bpe(string: str, num_merges: int) -> BPETokenizerParams:
    indices = list(string.encode("utf-8"))
    merges: dict[tuple[int, int], int] = {}
    vocab: dict[int, bytes] = {i: bytes([i]) for i in range(256)}

    for i in range(num_merges):
        counts = count_adjacent_pairs(indices)
        if not counts:
            break
        pair = max(counts, key=counts.get)
        new_index = 256 + i
        merges[pair] = new_index
        vocab[new_index] = vocab[pair[0]] + vocab[pair[1]]
        indices = merge(indices, pair, new_index)

    return BPETokenizerParams(vocab=vocab, merges=merges)
```

严格地说，真实训练会在整个语料库上维护 pair 计数，并设置目标词表大小 $V$，因此合并次数通常是 $V-256$：

$$
V = 256 + M,
$$

其中 $M$ 是 merge 次数。

### 6.6 手算示例：`the cat in the hat`

初始 token 是每个 UTF-8 字节（ASCII 文本中即字符）：

```text
t h e _ c a t _ i n _ t h e _ h a t
```

其中 `_` 表示空格。一次合理的合并序列是：

| 步骤 | 最高频相邻对（并列时依实现顺序） | 新 token | 当前序列中的变化 |
| ---: | --- | --- | --- |
| 0 | `(t, h)` | `th` | `t h` → `th` |
| 1 | `(th, e)` | `the` | `th e` → `the` |
| 2 | `(the, _)` | `the_` | `the _` → `the_` |

训练得到的 `vocab[258]` 是字节串 `b"the "`。在新文本中，编码过程会尝试复用这些合并规则；未见过的片段仍退化为基础字节，因此不会产生 `UNK`。

### 6.7 BPE tokenizer 的编码与解码

```python
class BPETokenizer(Tokenizer):
    def __init__(self, params: BPETokenizerParams):
        self.params = params

    def encode(self, string: str) -> list[int]:
        indices = list(string.encode("utf-8"))
        # 教学版：按训练得到的 merge 顺序尝试所有规则
        for pair, new_index in self.params.merges.items():
            indices = merge(indices, pair, new_index)
        return indices

    def decode(self, indices: list[int]) -> str:
        byte_strings = [self.params.vocab[i] for i in indices]
        return b"".join(byte_strings).decode("utf-8")

params = train_bpe("the cat in the hat", num_merges=3)
tok = BPETokenizer(params)
text = "the quick brown fox"
ids = tok.encode(text)
assert tok.decode(ids) == text
```

**解码为什么可靠？** 每个新 token 的字节串由两个已有 token 的字节串拼接而成；最终把 token 对应的字节串拼起来，再进行 UTF-8 解码，即可恢复输入。前提是 token 序列本身不被截断或篡改。

### 6.8 真实 BPE 的训练与推理细节

教学实现便于理解，但很慢：每轮都会重新扫描整个序列，推理时还会遍历所有 merge。Assignment 1 要求进一步完善：

1. **只应用相关 merge**：根据当前相邻对和优先级队列更新计数，避免无关规则；
2. **预分词（pre-tokenization）**：先按 GPT-2 正则等规则分成局部片段，再在每片段内 BPE，避免跨单词无约束合并；
3. **特殊 token**：先识别 `<|endoftext|>` 等保留串，直接映射到固定 id，不能让普通 BPE 把它拆开；
4. **边界约定**：很多词表把前导空格与单词合并（如 `" world"`），所以句首 `hello` 与句中 ` hello` 可能是不同 token；
5. **数值与 Unicode**：数字常被按几位一组切分；任意 Unicode 最终都必须可回退到 UTF-8 字节。

---

## 7. 特殊 Token、未登录词与安全解码

### 7.1 特殊 token 的职责

常见特殊 token 包括：

| Token | 用途 |
| --- | --- |
| `<|endoftext|>` / `<eos>` | 文档或对话结束，训练时分隔样本 |
| `<bos>` | 序列开始（不一定所有模型都使用） |
| `<pad>` | batch 对齐长度（因果语言模型常尽量减少 padding） |
| `<unk>` | 无法表示的 token（BPE/字节级通常可以避免） |

特殊 token 必须有明确的保留顺序：

```text
先扫描并锁定特殊 token
→ 普通文本做 UTF-8 + 预分词 + BPE
→ 将特殊 token 与普通 token 拼回同一序列
```

否则例如 `<|endoftext|>` 可能被编码成多个普通字节 token，模型就无法识别文档边界。

### 7.2 BPE 与 `UNK` 的对比

单词 tokenizer 需要为未见过的词设置 `UNK`；BPE 只要求基础字节存在：

$$
\text{任意字符串}
\xrightarrow{\text{UTF-8}}
\text{有限字节序列}
\xrightarrow{\text{回退到字节}}
\text{可编码 token 序列}。
$$

因此 BPE 在开放词汇、多语言和拼写错误场景中更稳健，perplexity 也不会因为大量 `UNK` 而失真。

---

## 8. 从字节到端到端模型的思考

理想的 tokenizer-free 模型直接处理字节，省去人为词表设计；Byte-level Transformer、ByT5、MEGABYTE、BLT 等方向都在探索这一点。但在当前前沿规模上，直接使用字节通常会带来很长的序列和更高的注意力成本，尚未完全取代 BPE/Unigram 等分词器。

无论最终方案是 BPE 还是端到端字节模型，都需要满足：

1. 模型应在序列的**块/抽象**上计算，而不是被迫逐字符处理所有细节；
2. 块的长度应当**可变**，让更多计算容量分配给有信息量的片段；
3. 编码应可逆，且特殊边界、Unicode 和异常输入不会导致数据丢失。

---

## 9. 本讲小结

- Tokenizer 是字符串与整数 token 序列之间的可逆映射；
- 字符级词表大且稀疏，字节级词表小但序列过长，单词级存在巨大词表和 `UNK`；
- BPE 从 256 个字节 token 出发，迭代合并语料中最常见的相邻 token 对；
- 训练保存 `vocab` 与有序 `merges`，推理按同样顺序复用规则，解码时拼接字节并进行 UTF-8 解码；
- 压缩率越高，注意力序列越短，但词表过大也会造成参数稀疏；
- 生产级实现还需要预分词、特殊 token、快速 pair 更新以及严格的 round-trip 测试；
- **效率**是贯穿课程的主线：在固定数据和硬件预算下，让每个 token、每个 FLOP 都产生尽可能多的有效学习。
