# Lecture 01 - Overview & Tokenization

> **课程主题**：CS336 大语言模型构建与原理（Language Models from Scratch）
> **授课教师**：Percy Liang & Tatsunori Hashimoto
> **核心目标**：从零理解大语言模型全生命周期的工程机制（Mechanics）、系统思维（Mindset）与经验直觉（Intuitions），掌握分词（Tokenization）核心算法与资源效率权衡。

---

## 1. 课程定位与大模型全景

### 1.1 课程哲学与苦涩的教训 (The Bitter Lesson)

大模型研究的核心矛盾在于**资源受限下的效率最大化**：
$$\text{Accuracy} = \text{Efficiency} \times \text{Resources}$$

- **苦涩教训（Rich Sutton）的正确诠释**：并非“算法无用，唯算力论”，而是**只有能够随着算力增长而高效扩展（Scale）的算法才具备持久生命力**。在超大规模下，算法效率的微小提升都会放大为巨大的算力与成本优势。
- **三类核心知识**：
  1. **机制 (Mechanics)**：Transformer 各层运算、分布式并行、反向传播与状态同步（可直接迁移）。
  2. **思维 (Mindset)**：最大化榨干硬件算力（GPU/TPU）、严密审视 Scaling 规律（可直接迁移）。
  3. **经验直觉 (Intuitions)**：数据清洗过滤、超参数选择（部分经验随规模放大可能失效，需实验校准）。

### 1.2 语言模型演进时间线

| 发展阶段 | 代表技术 / 模型 | 核心特征与范式演进 |
| :--- | :--- | :--- |
| **前神经阶段 (< 2010s)** | Shannon (1950), N-gram (Brants 2007) | 统计熵、马尔可夫链、平滑算法（Kneser-Ney） |
| **神经机制奠基 (2010-2017)** | LSTM, Seq2Seq, Attention, Adam, Transformer | 引入自注意力机制、端到端可微优化、MoE 与并行原型 |
| **早期基石模型 (2018-2019)** | ELMo, BERT, T5 (11B) | 预训练 + 判别式微调，统一 Text-to-Text 范式 |
| **Scale 爆发期 (2020-2022)** | GPT-2/3, Kaplan Scaling, Chinchilla, PaLM | 上下文学习（In-Context Learning）、计算最优缩放法则 |
| **开源与前沿竞争 (2023-2026)** | Llama 系列, Mistral/Mixtral, DeepSeek, Qwen | 开源权重与架构创新（MLA, SwiGLU, DeepSeek-R1 强化推理） |
| **自主智能体时代 (2026+)** | Reasoning Models (RLVR), Autonomous Agents | 长上下文、推理时扩展（Test-time Compute）、工具调用与环境交互 |

### 1.3 课程五大核心模块

1. **Basics（基础构建）**：BPE 分词器、Transformer 架构组件、交叉熵损失、AdamW 优化器与训练循环。
2. **Systems（系统效率）**：GPU 显存层级、Roofline 算力瓶颈分析、Triton 自定义算子（RMSNorm/FlashAttention）、分布式并行（DP/TP/PP）。
3. **Scaling Laws（缩放法则）**：计算最优配置（$C = 6ND$）、IsoFLOP 拟合、超参数外推（$\mu\text{P}$）。
4. **Data（数据工程）**：Common Crawl 数据清洗、启发式与分类器过滤、MinHash LSH 去重、数据混合与合成数据。
5. **Alignment & Post-Training（对齐与后训练）**：SFT 指令微调、DPO 偏好对齐、GRPO 与强化学习验证推理（RLVR）。

---

## 2. 分词（Tokenization）底层原理

### 2.1 为什么需要分词器？

语言模型本质上是对离散符号序列建模概率分布：
$$P(x_1, x_2, \dots, x_T) = \prod_{t=1}^T P(x_t \mid x_{<t})$$

原始文本在计算机中以 Unicode 字符串及底层字节（UTF-8 Bytes）表示。分词器负责在原始字节序列与整数 Token ID 序列之间建立双向映射（Encode 与 Decode）。

```
Raw Text ("Hello, 🌍!") ──(Encode)──> [15496, 11, 995, 0] ──(Decode)──> Raw Text ("Hello, 🌍!")
```

### 2.2 四种分词方案对比

| 分词方案 | 词表大小 (Vocab Size) | 压缩率 (Bytes/Token) | 优点 | 缺点 |
| :--- | :--- | :--- | :--- | :--- |
| **字符级 (Character)** | ~150,000 (Unicode) | 极低 (~1-2) | 语义单元直观 | 词表过大，生僻 Unicode 稀疏严重 |
| **纯字节级 (Byte)** | 256 (固定) | 最差 (严格 = 1.0) | 无 OOV 问题，词表极小 | 序列长度急剧膨胀，Transformer 二次复杂度计算不可承受 |
| **纯词级 (Word)** | 数十万 ~ 数百万 | 较高 (~4-6) | 符合人类语言习惯 | 词表爆炸，出现未登录词（`<UNK>`），破坏困惑度评测 |
| **子词/BPE (Subword/BPE)** | 32,000 ~ 256,000 (可控) | 最优折中 (~3.5-5.0) | 压缩比高，无 OOV，常见词单 Token，生僻词拆解 | 需前置训练词表，多语言压缩率存在偏差 |

---

## 3. 字节对编码 (Byte Pair Encoding, BPE) 算法

### 3.1 BPE 训练机制

BPE 是一种基于数据驱动的贪心自底向上合并算法：
1. **初始化**：以 256 个单字节为基础词表（Vocab 0 ~ 255）。
2. **统计频次**：遍历语料中当前序列的所有相邻 Token 对 $(u, v)$，统计出现频率。
3. **贪心合并**：选取频次最高的 Token 对 $(u^*, v^*)$，分配新的 Token ID 并加入词表与合并规则表（Merges）。
4. **替换序列**：在语料中将所有相邻的 $(u^*, v^*)$ 替换为新 Token ID。
5. **迭代终止**：重复步骤 2~4 直至达到预设合并步数（`num_merges`）或目标词表大小。

```
初始字节序列: [t, h, e,  , c, a, t,  , i, n,  , t, h, e,  , h, a, t]
Step 1: 最高频 pair ('t', 'h') -> 合并为 Token 256 ("th")
Step 2: 最高频 pair (256, 'e') -> 合并为 Token 257 ("the")
Step 3: 最高频 pair ('a', 't') -> 合并为 Token 258 ("at")
最终压缩序列: [257, ' ', 'c', 258, ' ', 'i', 'n', ' ', 257, ' ', 'h', 258]
```

### 3.2 压缩率 (Compression Ratio) 计算

$$\text{Compression Ratio} = \frac{\text{Total UTF-8 Bytes}}{\text{Total Tokens}}$$

- 压缩率越高，输入模型的序列长度越短，在固定 Context Window（如 4K/8K/128K）内能装入的有效信息量越大。
- 扩大词表（Vocab Size 从 32K 提升至 128K/256K）能提高压缩率，但会增大嵌入层（Embedding Layer）与输出分类头（LM Head）的显存和计算开销。

---

## 4. Python 核心代码实现

### 4.1 分词器抽象基类与基础分词器

```python
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass

class Tokenizer(ABC):
    """分词器抽象接口"""
    @abstractmethod
    def encode(self, string: str) -> list[int]:
        raise NotImplementedError

    @abstractmethod
    def decode(self, indices: list[int]) -> str:
        raise NotImplementedError


class CharacterTokenizer(Tokenizer):
    """Unicode 码点字符级分词器"""
    def encode(self, string: str) -> list[int]:
        return list(map(ord, string))

    def decode(self, indices: list[int]) -> str:
        return "".join(map(chr, indices))


class ByteTokenizer(Tokenizer):
    """UTF-8 纯字节级分词器 (Vocab Size = 256)"""
    def encode(self, string: str) -> list[int]:
        return list(string.encode("utf-8"))

    def decode(self, indices: list[int]) -> str:
        return bytes(indices).decode("utf-8", errors="replace")
```

### 4.2 BPE 训练与推理实现

```python
def merge(indices: list[int], pair: tuple[int, int], new_index: int) -> list[int]:
    """将序列中所有连续出现的 pair 替换为 new_index"""
    new_indices = []
    i = 0
    while i < len(indices):
        if i + 1 < len(indices) and indices[i] == pair[0] and indices[i + 1] == pair[1]:
            new_indices.append(new_index)
            i += 2
        else:
            new_indices.append(indices[i])
            i += 1
    return new_indices


def count_adjacent_pairs(indices: list[int]) -> dict[tuple[int, int], int]:
    """统计序列中所有相邻 Token 对的出现频次"""
    counts = defaultdict(int)
    for idx1, idx2 in zip(indices, indices[1:]):
        counts[(idx1, idx2)] += 1
    return counts


@dataclass(frozen=True)
class BPETokenizerParams:
    vocab: dict[int, bytes]             # token_id -> byte sequence
    merges: dict[tuple[int, int], int]  # (token_id1, token_id2) -> new_token_id


def train_bpe(text: str, num_merges: int) -> BPETokenizerParams:
    """训练 BPE 分词器"""
    indices = list(text.encode("utf-8"))
    merges: dict[tuple[int, int], int] = {}
    vocab: dict[int, bytes] = {i: bytes([i]) for i in range(256)}

    for i in range(num_merges):
        counts = count_adjacent_pairs(indices)
        if not counts:
            break
        # 选择频次最高的 token 对
        best_pair = max(counts, key=counts.get)
        new_index = 256 + i
        
        merges[best_pair] = new_index
        vocab[new_index] = vocab[best_pair[0]] + vocab[best_pair[1]]
        indices = merge(indices, best_pair, new_index)

    return BPETokenizerParams(vocab=vocab, merges=merges)


class BPETokenizer(Tokenizer):
    """基于训练规则的 BPE 分词器"""
    def __init__(self, params: BPETokenizerParams):
        self.params = params

    def encode(self, string: str) -> list[int]:
        indices = list(string.encode("utf-8"))
        for pair, new_index in self.params.merges.items():
            indices = merge(indices, pair, new_index)
        return indices

    def decode(self, indices: list[int]) -> str:
        byte_chunks = [self.params.vocab.get(idx, b"") for idx in indices]
        return b"".join(byte_chunks).decode("utf-8", errors="replace")
```

---

## 5. 生产级 BPE 工程要点与作业要求

在实际大模型工程（如 GPT-4 / Llama 3 / tiktoken）中，基础 BPE 需扩展以下关键机制：

1. **预分词正则切分 (Pre-tokenization Regex)**：
   - 避免跨标点、跨空格、跨字母与数字之间的不合理合并（例如防止 `"hello!"` 与 `"world!"` 中的标点被混并入词根）。
   - GPT-2 / GPT-4 采用正则表达式先将文本拆分为切片，再对每个切片独立应用 BPE 合并。
2. **特殊 Token 处理 (Special Tokens)**：
   - 保证 `<|endoftext|>`、`<|im_start|>` 等特殊标识符被原子解析，不被拆散为子词。
3. **高效查找结构**：
   - 生产环境避免全量 Merges 线性循环，采用最小堆（Priority Queue）或双向链表将单次编码复杂度降至 $\mathcal{O}(N \log M)$。
