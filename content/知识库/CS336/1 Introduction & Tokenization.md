# CS336 Lecture 1: 语言模型导论与 Tokenization

语言模型的本质是建立在离散序列上的自回归概率分布 $P(x_1, x_2, \dots, x_T) = \prod_{t=1}^T P(x_t \mid x_{<t})$。输入是任意人类文本（Unicode 字节流），模型计算单元是整数索引。**Tokenization（分词）** 是连接二者的底层协议。

---

## 1. 为什么需要分词：四种分词粒度的权衡

构建分词器的核心矛盾在于：**词表大小（Vocabulary Size）** 与 **序列长度（Sequence Length）** 之间的物理权衡。

| 分词方案 | 词表大小 $|V|$ | 序列长度 | 未登录词 (OOV) | 核心缺陷 |
|---|---|---|---|---|
| **Character（字符级）** | ~150K (Unicode Code Point) | 极长 | 稀有字符导致冷启动 | 词表巨大且包含大量罕见 Unicode，压缩比极低 |
| **Byte（字节级）** | 256 (单字节 $0 \sim 255$) | 最长（1 字符可占 1~4 字节） | 无 OOV（覆盖所有字节） | 序列膨胀 3~4 倍；自注意力计算复杂度为 $O(T^2)$，计算成本灾难性上升 |
| **Word（词级）** | 巨大且开放 ($10^5 \sim 10^7$) | 最短 | 严重（未见词必须映射为 `<UNK>`） | `<UNK>` 破坏困惑度 (PPL) 评测；无法泛化到新词、代码与跨语言 |
| **Subword（子词级，如 BPE）** | 可控（通常 $32\text{K} \sim 100\text{K}$） | 适中（压缩比约 $3 \sim 5\text{x}$） | 降级到字节，无 OOV | 需在预训练语料上预先训练统计合并规则 |

### 压缩比（Compression Ratio）
衡量分词器效率的关键物理量：
$$
\text{Compression Ratio} = \frac{\text{Number of UTF-8 Bytes}}{\text{Number of Tokens}}
$$
压缩比越大，相同文本经分词后的序列长度 $T$ 越短。由于 Transformer 的 KV Cache 显存与自注意力计算量正比于 $T$ 或 $T^2$，更高的压缩比直接降低了推理与训练开销。

---

## 2. Byte-Pair Encoding (BPE) 算法原理与实现

BPE（Philip Gage 1994 数据压缩算法，Sennrich 2015 引入 NLP）采用**数据驱动的贪心迭代合并**策略：以 256 个 UTF-8 基础字节为初始词表，反复统计相邻 Token 对的共现频次，将最高频的 Pair 合并为一个新 Token。

### 2.1 BPE 训练流程 (Training)

```python
from collections import defaultdict
from dataclasses import dataclass

@dataclass(frozen=True)
class BPETokenizerParams:
    vocab: dict[int, bytes]            # token_id -> bytes
    merges: dict[tuple[int, int], int]  # (token_id_1, token_id_2) -> new_token_id

def train_bpe(text: str, num_merges: int) -> BPETokenizerParams:
    # 1. 初始序列为 UTF-8 字节列表 (0 ~ 255)
    indices = list(text.encode("utf-8"))
    
    # 2. 初始化词表 (256 个基础字节)
    vocab = {x: bytes([x]) for x in range(256)}
    merges = {}

    for i in range(num_merges):
        # 统计所有相邻 pair 的共现频率
        counts = defaultdict(int)
        for pair in zip(indices, indices[1:]):
            counts[pair] += 1
            
        if not counts:
            break
            
        # 贪心选出出现频率最高的 pair
        best_pair = max(counts, key=counts.get)
        new_token_id = 256 + i
        
        # 记录 merge 规则与新词表映射
        merges[best_pair] = new_token_id
        vocab[new_token_id] = vocab[best_pair[0]] + vocab[best_pair[1]]
        
        # 替换当前序列中的 pair
        indices = merge_pair(indices, best_pair, new_token_id)
        
    return BPETokenizerParams(vocab=vocab, merges=merges)

def merge_pair(indices: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
    new_indices = []
    i = 0
    while i < len(indices):
        if i + 1 < len(indices) and indices[i] == pair[0] and indices[i + 1] == pair[1]:
            new_indices.append(new_id)
            i += 2
        else:
            new_indices.append(indices[i])
            i += 1
    return new_indices
```

### 2.2 BPE 编解码 (Encode & Decode)

```python
class BPETokenizer:
    def __init__(self, params: BPETokenizerParams):
        self.vocab = params.vocab
        self.merges = params.merges

    def encode(self, text: str) -> list[int]:
        # 字节级别初始化
        indices = list(text.encode("utf-8"))
        # 按训练顺序应用 merge 规则
        for pair, new_id in self.merges.items():
            indices = merge_pair(indices, pair, new_id)
        return indices

    def decode(self, indices: list[int]) -> str:
        raw_bytes = b"".join(self.vocab[idx] for idx in indices)
        return raw_bytes.decode("utf-8", errors="replace")
```

---

## 3. 生产级工程细节与陷阱 (Assignment 1 核心考点)

在真实工业级模型（如 GPT-2、GPT-4、Llama 3、Tiktoken）中，简单的 BPE 需要补充以下关键工程机制：

### 3.1 预分词正则切分 (Pre-tokenization Regex)
直接对整篇语料统计 BPE 会导致标点与单词跨界合并（例如把 `world!` 或 `dog.` 合并为一个 Token），破坏词表的跨句复用能力。
GPT-2 采用正则表达式先将文本切分成语义块，**禁止跨类别合并**：

```python
import regex

# GPT-2 正则切分规则
GPT2_SPLIT_REGEX = r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""

def pre_tokenize(text: str) -> list[str]:
    return regex.findall(GPT2_SPLIT_REGEX, text)
```
- `'s|'t|'re...`：将英语缩写单独切开。
- ` ?\p{L}+`：匹配可选前置空格 + 连续字母。
- ` ?\p{N}+`：将连续数字切开（避免大数字污染词表）。
- 作用：BPE 统计仅在每个 chunk 内部进行，不同 chunk 之间严禁 cross-boundary merge。

### 3.2 特殊 Token 处理 (Special Tokens)
- 文档边界符（如 `<|endoftext|>`）、指令对齐符（如 `<|im_start|>`, `<|im_end|>`）必须作为独立原子，**不可被 BPE 拆分成字节片段**。
- 实现机制：编码前使用字典树（Trie）或拆分正则将 special tokens 锁定保护，其余文本再进入 BPE 流程。

### 3.3 编码性能优化 ($O(N \cdot M)$ 到 $O(N \log N)$)
朴素 BPE encode 按序遍历所有 merges 规则（时间复杂度为 $O(|\text{merges}| \cdot L)$），对长文本极慢。
优化方案：
1. **优先队列/最小堆**：对输入文本的所有相邻 pair 建立最小堆，优先提取当前序列中优先级最高（在 merges 中出现最早）的 pair 进行局部替换。
2. **双向链表**：用双向链表维护 Token 序列，局部合并时仅更新前后相邻节点的指针与 pair 频次，避免全局列表复制。

---

## 4. 思考与延伸

1. **为什么当代 LLM 词表不断扩大？**
   - GPT-2: 50,257 ➔ Llama 2: 32,000 ➔ Llama 3: 128,256 ➔ GPT-4o (o200k_base): 200,000。
   - 更大的词表显著提升了多语言、代码与数字的压缩比，减少推理生成的 Token 总数，但代价是 Embedding 层参数显存开销增加。
2. **Tokenizer-free 架构的探索**：
   - ByT5、MegaByte、BLT 等模型尝试直接在 Byte 上进行局部 Patch 卷积或分层 Transformer 建模，规避 Tokenizer 带来的多语言偏见与鲁棒性漏洞，但目前在超大模型上效率仍难匹敌 BPE。
