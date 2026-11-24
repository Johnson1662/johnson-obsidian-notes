# 第 1 章 · LLM 架构与优化方法

> 来源：《智能体 AI 漫游指南：从基础到系统》· LLM 架构与优化方法 · PDF 第 39–106 页

---

本部分覆盖大语言模型的基础架构，以及让训练和推理高效化的关键优化技术。内容按课程顺序组织：先介绍 Transformer 本身，然后讨论如何高效训练、如何低成本适配、如何压缩、如何扩展规模，以及如何加速推理。

## 1.1 LLM 工作原理：直觉概览

在深入架构细节之前，让我们先建立大语言模型如何将文本转换为文本的直觉。整个过程遵循一条简单的流水线：文本 → Token → 表征 → Token → 文本。

![](../images/7f62bbe108c45a6a8c4c6f669500a2a48deb77470f8773f9605c282f8ee516a9.jpg)

*Figure 1.1: LLM 流水线：文本被分词为子词单元，转换为整数 ID，嵌入为稠密向量，经 Transformer 层处理，投影到词表 logits，最后解码回文本。虚线回路展示自回归生成——每个输出 Token 被追加到输入中作为下一次前向传播的输入。*

## 四个关键阶段

1. 分词（Tokenization）：使用学习得到的词表将原始文本切分为子词片段（既非字符也非完整单词）。“unhappiness” 可能被切为 [“un”, “happiness”] 或 [“unhapp”, “iness”]。

2. 嵌入（Embedding）：每个 Token ID 索引到一张学习得到的嵌入表中，产生 R<sup>d</sup>（通常d = 4096）中的稠密向量。这些向量捕捉语义含义——相似的词获得相似的向量。

3. 上下文处理：Transformer 栈并行处理所有嵌入，通过自注意力让每个位置 “读取” 所有其他位置。经过 L 层之后，每个位置的隐藏状态编码了丰富的上下文信息。

4. 预测：最终的隐藏状态被投影为整个词表上的概率分布，由解码策略选择下一个 Token。

## 1.2 分词（Tokenization）

分词（Tokenization）是将原始文本转换为语言模型所操作的离散符号的关键第一步。分词器的选择直接影响模型质量、多语种能力和计算效率。

## 为什么用子词？

字符级模型需要很长的序列（注意力代价高昂）。词级模型无法处理稀有词或新词。子词分词达到了理想的平衡：常见词作为单个 Token（“the” → [the]），稀有词被分解为已知片段（“cryptocurrency”→ [“crypt”, “ocur”, “rency”]），同时词表保持可控规模（32K–128K Token）。

<table><tr><td>BPE 算法</td></tr><tr><td>1. 从单个字符(字节)的词表开始</td></tr><tr><td>2. 统计训练语料中所有相邻符号对</td></tr><tr><td>3. 将出现频率最高的对合并为一个新符号</td></tr><tr><td>4. 重复步骤 2-3 共 k 次迭代(直到达到目标词表大小)</td></tr></table>

Table 1.1: 不同分词粒度的权衡。

<table><tr><td>粒度</td><td>词表大小</td><td>序列长度</td><td>问题</td></tr><tr><td>字符</td><td>~256</td><td>极长</td><td>注意力开销  $O(n^{2})$ ;难以学习长程语义</td></tr><tr><td>词</td><td>~500K+</td><td>短</td><td>无法处理稀有/新词;嵌入表巨大</td></tr><tr><td>子词</td><td>32K-128K</td><td>适中</td><td>最佳权衡:短序列、开放词表</td></tr></table>

## 1.2.1 为什么不用字符或词？

## 1.2.2 字节对编码（Byte-Pair Encoding，BPE）

字节对编码（Byte-Pair Encoding，BPE） [320] 是 GPT、Llama、Mistral 以及大多数现代 LLM 采用的主流分词算法。

```csv
lower
↓
lower
↓
lower
↓
lower
↓
Initial: characters
Merge 1: e+r → er (most frequent)
Merge 2: o+w → ow
Merge 3: l+ow → low
Merge 4: low+er → lower
```

*Figure 1.2: BPE 分词示例：从字符开始，算法迭代地合并出现频率最高的相邻对，直到该词成为单个 Token或词表预算耗尽。*

## 1.2.3 其他分词方法

Table 1.2: 子词分词算法对比。

<table><tr><td>方法</td><td>使用者</td><td>核心思想</td></tr><tr><td>BPE</td><td>GPT-4 [274], Llama-3 [118], Mistral [165]</td><td>自底向上合并频繁对;确定性</td></tr><tr><td>WordPiece</td><td>BERT [76], DistilBERT [312]</td><td>类似 BPE,但最大化训练数据似然</td></tr><tr><td>Unigram LM</td><td>SentencePiece (T5 [303], XLNet [406])</td><td>自顶向下:从大词表开始,按似然影响剪枝</td></tr><tr><td>字节级 BPE (Byte-level BPE)</td><td>GPT-2 [301]+</td><td>在原始字节上做 BPE(不可能出现未知 Token);256 个基础词</td></tr></table>

## 1.2.4 分词最佳实践

1. 词表大小很重要：32K 是最低限度；128K 能提供更好的多语种覆盖和代码处理能力。Llama-3使用 128K Token。

2. 特殊 Token：始终包含 <bos>、<eos>、<pad>、<unk>。对于指令微调模型，需添加角色标记（<|user|>、<|assistant|>）。

3. 繁殖度（Fertility）：度量各语种的每词 Token 数。高繁殖度（每词产生很多 Token）表示对该语种的覆盖较差。

4. 切勿跨边界分词：空格、标点和数字应一致处理。大多数现代分词器会在前面添加空格标记（如 “the”）以区分词首 Token 与词中续接 Token。

5. 数字：对算术任务考虑数字级分词。“2024” 切为 [“2”,“0”,“2”,“4”] 可以支持逐位推理。

6. 代码：确保高效地分词空白（缩进）。Llama-3 将连续空格分词为单个 Token。

## 1.2.5 分词实战：HuggingFace 示例

transformers 库为所有分词器提供了统一接口。以下演示了使用现代 LLM 分词器进行编码和解码：

```python
from transformers import AutoTokenizer

# 加载 Llama-3 分词器（128K 词表，字节级 BPE）
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
text = "Reinforcement learning optimizes long-term rewards."

# 编码：文本 -> Token ID
token_ids = tokenizer.encode(text)
print(token_ids)
# [128000, 29934, 262, 11008, 4815, 6900, 1317, 9860, 21845, 13]

# 将单个 Token 解码以查看子词切分
tokens = tokenizer.convert_ids_to_tokens(token_ids)
print(tokens)
# [<|begin_of_text|>', 'Re', 'inforce', 'ment', 'learning',
# ' optimizes', 'long', '-term', 'rewards', '.']

# 解码回文本（双向往返）
reconstructed = tokenizer.decode(token_ids, skip_special_tokens=True)
assert reconstructed == text # 完美重建

# 带注意力掩码的分词（用于带 padding 的批量输入）
batch = tokenizer(
    ["Short text.", "A much longer input sentence for comparison."],
    padding=True, return_tensors="pt"
```

```python
)
print(batch.keys()) # dict_keys(['input_ids', 'attention_mask'])
```

*Listing 1.1: 使用 HuggingFace Transformers 进行分词的编码/解码。*

## 1.2.6 特殊 Token 与结构化提示

特殊 Token 是保留的词表条目，承载结构性含义而非语言内容。它们对控制模型行为至关重要。

Table 1.3: 各类 LLM 中常见的特殊 Token。

<table><tr><td>Token</td><td>别名</td><td>用途</td></tr><tr><td></td><td>BOS</td><td>标记序列开始</td></tr><tr><td></td><td>EOS</td><td>标记序列结束;停止生成</td></tr><tr><td></td><td>—</td><td>标记对话中用户轮次的开始</td></tr><tr><td></td><td>—</td><td>标记对话中助手轮次的开始</td></tr><tr><td></td><td>PAD</td><td>将批次填充到统一长度;在注意力中被掩盖</td></tr><tr><td></td><td>UNK</td><td>词表外占位符(在 BPE 中很少出现)</td></tr><tr><td>[SEP]</td><td>SEP</td><td>分隔片段(BERT 风格)</td></tr><tr><td>[CLS]</td><td>CLS</td><td>分类 Token(BERT)</td></tr><tr><td>[MASK]</td><td>MASK</td><td>用于掩码语言模型(MLM)预训练的掩码 Token</td></tr></table>

指令微调模型的角色标记。 现代对话模型使用特殊 Token 来界定对话结构。它们并非被训练来承载语义含义——而是结构分隔符，模型学习去解析它们：

```python
# Llama-3 对话模板
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain PPO in one sentence."},
]

# apply_chat_template 处理所有特殊 Token 的插入
prompt = tokenizer.apply_chat_template(messages, tokenize=False)
print(prompt)
# <|begin_of_text|>|system<|end_header_id|>
#
# You are a helpful assistant.<|eot_id|>|user<|end_header_id|>
#
# Explain PPO in one sentence.<|eot_id|>|assistant<|end_header_id|>
#
#
```  
*Listing 1.2: 带特殊 Token 的对话模板（Llama-3 格式）。*

## 特殊 Token 最佳实践

- 切勿拆分特殊 Token：它们必须是原子单位——确保分词器将其视为单个单元，而非字符序列。

- 对特殊 Token 屏蔽损失：在 SFT 期间，不要对结构性 Token（角色标记、分隔符）计算损失。模型不应 “学习” 预测格式本身。

- 用模板表达结构：通过特殊 Token 而非自然语言指令编码任务语义。例如，<|tool\_call|> 比 “Now I will call a tool:” 更可靠。

- 工具/函数调用：定义专用 Token，如 <|function|>、<|result|>，以在推理与动作之间建立无歧义的边界。

- RL 中的一致处理：在 PPO/GRPO 期间，确保参考模型与策略模型使用相同的分词和特殊 Token 处理——不一致会破坏 KL 计算。

- EOS 处理：在生成时，确保 EOS 包含在动作空间中。若模型无法发出 EOS，回复将无界增长（常见的 RL 失败模式）。

## 1.3 Transformer 架构

Transformer [357] 是所有现代 LLM 的基础。理解其组件对于把握本指南中的每种优化和训练方法都至关重要。

## 1.3.1 整体结构

仅解码器（decoder-only）的 Transformer 依次通过嵌入层、重复的注意力 +FFN 块以及最终对词表 logits 的投影来处理 Token。图 1.3 展示了完整架构。

## 1.3.2 原始的编码器-解码器 Transformer

Transformer 最初被提出 [357] 时是一种用于序列到序列任务（机器翻译、摘要）的编码器-解码器架构。尽管现代 LLM 主要使用仅解码器变体（GPT 风格），理解完整架构仍然至关重要，因为交叉注意力和带掩码的自注意力——两者都起源于此——仍是基础构建模块。

编码器（Encoder）。 编码器双向地处理整个输入序列——每个 Token 关注所有其他 Token（无因果掩码）。这产生了丰富的上下文表征 $\mathbf { H } ^ { \mathrm { e n c } } \in \mathbb { R } ^ { n \times a }$ ，其中每个位置都编码了关于整个输入的信息：

- 输入：Token 嵌入 + 正弦位置编码

- 每一层：多头自注意力 → Add & Norm → FFN → Add & Norm

- 无因果掩码：位置 i 关注所有位置 $1 , \ldots , n$

- 输出：整个输入序列的上下文表征

解码器——带掩码的多头自注意力。 解码器一次生成一个输出 Token（自回归地）。为了防止模型“看到未来”，解码器中的自注意力使用因果掩码（causal mask）：

$$
\text { MaskedAttn } (Q, K, V) = \operatorname{softmax} \left(\frac {Q K ^ {T}}{\sqrt {d _ {k}}} + M\right) V\tag{1.1}
$$

其中掩码 M 为：

$$
M _ {i j} = \left\{ \begin{array}{l l} 0 & \text { if } i \geq j (\text { can   attend }) \\ - \infty & \text { if } i <   j (\text { future   token   —   blocked }) \end{array} \right.
$$

![](../images/aa7ec32f953da44562b3783335c3938bd5406094c276b414352d0872c3ec969a.jpg)  
*Figure 1.3: 仅解码器 Transformer 块（GPT 风格，Pre-Norm 变体）。每个子层（注意力、FFN）之前先经过 LayerNorm，之后接残差相加： $\mathbf { x } + \mathrm { S u b L a y e r } ( \mathrm { L N } ( \mathbf { x } ) ) { \mathrm { { c } } }$ 。这种 Pre-Norm 顺序（被 Llama、GPT-3、Mistral采用）在无需 warmup 的情况下稳定训练，不同于原始的 Post-Norm（在相加之后应用 LayerNorm）。L 个相同的块被堆叠，之后是一个最终的 LayerNorm 和到词表 logits 的线性投影。*

## 为什么掩码很重要

在训练期间，解码器并行处理整个目标序列（teacher forcing），但每个位置只能关注之前的位置以保持自回归特性。掩码确保生成 Token t 时仅使用 Token 1,...,t−1 的信息。在推理时，Token是逐一生成的，因此掩码是隐式的——但在训练期间，它使并行计算成为可能，同时保持因果性。

解码器——交叉注意力。 在带掩码的自注意力之后，每个解码器层应用交叉注意力（cross-attention），解码器关注编码器的输出表征。这是解码器 “读取” 输入的机制：

$$
\mathrm{CrossAttn} (Q _ {\mathrm{dec}}, K _ {\mathrm{enc}}, V _ {\mathrm{enc}}) = \mathrm{softmax} \left(\frac {Q _ {\mathrm{dec}} K _ {\mathrm{enc}} ^ {T}}{\sqrt {d _ {k}}}\right) V _ {\mathrm{enc}}\tag{1.2}
$$

- Query 来自解码器之前的子层（带掩码自注意力的输出）

- Key 和 Value 来自编码器的最终输出 ${ \bf H } ^ { \mathrm { e n c } }$

- 不应用掩码——每个解码器位置可以关注每个编码器位置

- 这使得解码器在每个生成步骤可以动态聚焦于输入的不同部分（例如，在英语 → 西班牙语翻译中，生成 “gato” 时关注 “cat”）

完整的解码器层。 每个解码器层包含三个子层（编码器只有两个）：

## 1. 带掩码的多头自注意力 + 残差 + LayerNorm

![](../images/14cd0784584074fab6979bf7353b1f3245ccf100765b78f449284e90982d2377.jpg)  
*Figure 1.4: 原始 Transformer 架构（Vaswani 等，2017）。编码器（左）通过双向自注意力处理整个输入。解码器（右）使用带掩码的自注意力以及对编码器表征的交叉注意力来自回归生成 Token。虚线框表示重复的层块（×N）；灰线表示绕过每个子层的残差连接。注意：原始工作使用 Post-Norm（LayerNorm 在残差相加之后应用：LN(x + SubLayer(x))），不同于现代 LLM 使用 Pre-Norm。*

2. 多头交叉注意力（对编码器输出）+ 残差 + LayerNorm

3. 前馈网络（Feed-Forward Network） + 残差 + LayerNorm

从编码器-解码器到仅解码器。 现代 LLM（GPT、Llama、Qwen）只使用解码器，完全移除了编码器和交叉注意力层。关键洞察：对于生成式语言建模，单个因果（掩码）自注意力栈就足够了——模型在单次传递中学会编码上下文并生成后续内容。这简化了架构、训练和推理，并且更有效地扩展规模。编码器-解码器模型（T5、BART）对于具有明确输入/输出结构的任务（翻译、摘要）仍然有意义，而交叉注意力在多模态模型中再次出现，其中视觉编码器为语言解码器提供 Key/Value。

## 1.3.3 仅解码器 vs 编码器-解码器

现代 LLM 几乎只使用仅解码器架构，但理解与编码器-解码器设计的权衡有助于阐明原因。

<table><tr><td>架构</td><td>示例</td><td>使用场景</td></tr><tr><td>仅解码器</td><td>GPT-4 [274], Llama [118], Mistral [165], Qwen [350]</td><td>自回归生成;在对话/推理领域占主导</td></tr><tr><td>编码器-解码器</td><td>T5 [303], BART [207], Flan-T5 [59]</td><td>Seq2seq(翻译、摘要);现在较少使用</td></tr><tr><td>仅编码器</td><td>BERT [76], RoBERTa [233]</td><td>分类/嵌入;不用于生成</td></tr></table>

仅解码器模型更简单（单一模型，单一损失），扩展性更好（所有参数都参与生成），并且支持统的训练（预训练 = 下一个 Token 预测 = 微调目标）。对于纯生成任务，编码器-解码器模型在编码器上浪费了容量。

## 1.3.4 嵌入：从离散 Token 到连续空间

在任何注意力或计算发生之前，Transformer 必须将离散的 Token ID 转换为神经网络可处理的连续向量。这就是嵌入层（embedding layer）的作用。

什么是嵌入？ 嵌入是一个离散符号的学习得到的稠密向量表示。我们不再把单词 “king” 表示为大小为 |V| = 128,000 的独热向量（大部分为零），而是表示为 R<sup>d</sup>（例如 d = 4096）中一个紧凑的向量，捕捉其含义。

关键洞察：相似的概念得到相近的向量。在一个训练良好的嵌入空间中：

- “king” 和 “queen” 接近（都是王室）

- “king” 和 “bicycle” 距离很远（无关）

- 向量运算捕捉关系： ${ \mathrm { k i n g - m a n + w o r n a n } } \approx { \mathrm { q u } } { \vec { \mathrm { e } } } { \mathrm { n } }$

![](../images/14e7d318cea3f1901118039b262d179402c7bcf49116b07b2eff1ab7adb27c45.jpg)  
*Figure 1.5: 嵌入空间可视化（二维投影）：语义相似的词聚集在一起。嵌入表在预训练期间学习这些位置，纯粹从文本中的共现模式中捕捉含义。*

嵌入表。 在实践中，嵌入层就是一个矩阵 $\mathbf { E } \in \mathbb { R } ^ { | \mathcal { V } | \times d }$ ，其中第 i 行存储 Token i 的嵌入向量：

$$
\operatorname{embed} (x _ {t}) = \mathbf {E} [ x _ {t} ] \in \mathbb {R} ^ {d}\tag{1.3}
$$

对于一个 Token ID 序列 $[ x _ { 1 } , x _ { 2 } , \ldots , x _ { n } ]$ ，嵌入只是一个简单的表查询（索引操作）：

$$
\mathbf {H} _ {0} = [ \mathbf {E} [ x _ {1} ]; \mathbf {E} [ x _ {2} ]; \dots ; \mathbf {E} [ x _ {n} ] ] \in \mathbb {R} ^ {n \times d}
$$

## Transformer 中的嵌入表

- 尺寸： $| \nu | \times d _ { \circ }$ 对于 Llama-3：128,256 × 4,096 = 525M 参数（占 8B 模型的 6.5%）。

- 初始化：随机（Xavier/正态分布），然后通过反向传播学习。

- 权重共享（Weight tying）：许多模型共享嵌入矩阵与输出投影头： $W _ { \mathrm { h e a d } } = \mathbf { E } ^ { T } \circ$ 。这节省参数并创建对称的编码-解码结构。

- 输入：Token ID（整数）→ 输出：R<sup>d</sup> 中的稠密向量。

- 梯度流：在训练期间，只有当前批次中 Token 对应的行接收梯度更新（稀疏更新）。

## 为什么嵌入有效

嵌入表与模型其余部分端到端地一起学习。因为模型被训练去预测下一个 Token，它必须学到这样的表征：出现在相似上下文中的 Token 得到相似的向量。这就是分布假说：“你应当通过一个词的伙伴来了解它” [91]。嵌入层将这种统计结构压缩为稠密几何。

各向异性（anisotropy）问题。 当使用预训练嵌入（例如来自 BERT 或 GPT-2）用于下游任务（如检索 RAG 或推荐系统冷启动）时，会出现一个关键问题：学习到的表征高度各向异性（anisotropic）——它们占据嵌入空间中一个狭窄的锥形区域，而非均匀分布在所有方向上 [86]。

![](../images/624988e62c6dd62cc91c0b9f5662d6a248a7d248b3ff4c80be7d19536330a53d.jpg)

![](../images/f500277bbc1ae00cddd018d24caebaba05ff6c81617eb643834f21c686d0f19f.jpg)  
*Figure 1.6: 嵌入空间中的各向同性（isotropy）与各向异性（anisotropy）。左：各向同性的嵌入均匀分布，使余弦相似度成为可靠的语义相关性度量。右：各向异性的嵌入（如 BERT 中观察到的）聚集在狭窄的锥形内，导致所有对的余弦相似度都很高，无论语义内容如何。白化（whitening）变换空间以恢复各向同性。*

这为何对应用很重要：

- RAG / 检索：如果所有嵌入无论内容如何余弦相似度都 > 0.7，检索排名几乎成为随机——系统无法区分相关与不相关的段落。

- 推荐系统：使用预训练 LLM 嵌入来表示物品/用户，只有在几何结构保留了有意义的相似性结构时才有效。

- 聚类：各向异性的嵌入使聚类塌缩，无法发现自然分组。

解决方案：白化（whitening）。 一个简单有效的解决方法是白化（whitening） [340]——一种使嵌入分布变得各向同性（零均值、单位协方差）的线性变换：

$$
\tilde {\mathbf {h}} = \mathbf {D} ^ {- 1 / 2} \mathbf {U} ^ {T} (\mathbf {h} - \boldsymbol {\mu})\tag{1.4}
$$

其中 $\pmb { \mu }$ 是平均嵌入， $\mathbf { U D U } ^ { T }$ 是协方差矩阵 $\begin{array} { r } { \Sigma = \frac { 1 } { N } \sum _ { i } ( \mathbf { h } _ { i } - \pmb { \mu } ) ( \mathbf { h } _ { i } - \pmb { \mu } ) ^ { T } } \end{array}$ 的特征分解。

## 白化的实践

- 作用：旋转并缩放嵌入空间，使所有方向具有相等的方差（单位协方差）。

- 效果：余弦相似度变得有意义——语义相似的对得分高，不相似的对得分低。

- 额外好处：可以同时通过仅保留前 k 个特征向量来降维（类似 PCA），使检索更快。

- 成本：需要在一个代表性语料上计算协方差矩阵（一次性， $O ( N \cdot d ^ { 2 } ) )$ ）。变换本身在推理时只是简单的矩阵乘法。

- 替代方法：对比微调（SimCSE）、基于 flow 的归一化，或使用促进各向同性的正则项进行训练。

## 1.3.5 自注意力机制

自注意力是核心操作，它允许每个 Token 关注序列中的每一个其他 Token，基于相关性计算加权组合。

缩放点积注意力（Scaled Dot-Product Attention）

给定输入序列  $X \in R^{n \times d}$ ，我们计算：

 $Q = XW_{Q}, \quad K = XW_{K}, \quad V = XW_{V} \quad (W_{Q}, W_{K}, W_{V} \in \mathbb{R}^{d \times d_{k}})$ 

Attention(Q, K, V) = softmax $\left(\frac{QK^{T}}{\sqrt{d_{k}}} + M\right)V$ 

其中 M 是因果掩码（用于自回归模型）：若  $i \geq j$  则  $M_{ij} = 0$ ，否则为  $-\infty$ 。

直觉：每个 Token“关注”所有先前的 Token，基于 query-key 相似度计算其 value 的加权平均。
计算复杂度。 朴素的注意力计算在序列长度上具有平方代价：

- 时间： $O ( n ^ { 2 } \cdot d )$ ——计算 $Q K ^ { T }$ 需要 $n ^ { 2 }$ 个点积，每个维度为 $d _ { k \circ }$

- 内存： $O ( n ^ { 2 } )$ ——必须物化完整的注意力矩阵才能应用 Softmax。

对于一个 $d = 4 0 9 6$ 的 128K Token 上下文，仅注意力矩阵就是 $1 2 8 \mathrm { K } \times 1 2 8 \mathrm { K } = 1 6 4$ 亿个元素（FP32 下为 64 GB）。这种平方扩展是长上下文 LLM 的根本瓶颈。

Table 1.4: 注意力代价的扩展：为何朴素实现对长序列不可行。

<table><tr><td>序列长度</td><td>注意力操作数</td><td>矩阵大小</td><td>实际影响</td></tr><tr><td>2K</td><td>4M</td><td>16 MB</td><td>快速;可放入 SRAM</td></tr><tr><td>8K</td><td>64M</td><td>256 MB</td><td>用 FlashAttention 可应对</td></tr><tr><td>32K</td><td>1B</td><td>4 GB</td><td>需要内存高效内核</td></tr><tr><td>128K</td><td>16B</td><td>64 GB</td><td>超出单块 GPU 的 HBM</td></tr><tr><td>1M</td><td>1T</td><td>4 TB</td><td>不使用次平方方法则不可行</td></tr></table>

驯服注意力代价的方法。 有几类方案可以应对这种平方瓶颈：

1. 具备 IO 感知的精确注意力（FlashAttention [65]）：不降低计算复杂度，但通过将注意力计算分块到能放入 SRAM 的瓦片中，消除了在 HBM 中物化 $n \times n$ 矩阵的需要。关键的是，FlashAttention 与下面的稀疏模式正交——它是一种执行引擎，而非注意力模式。生产系统通常将 FlashAttention 与滑动窗口或块稀疏掩码结合使用，同时获得 IO 效率和 FLOPs 减少。我们在第 1.6 节详细介绍该算法。

2. 滑动窗口 / 局部注意力：每个 Token 只关注最近的 w 个 Token（例如 $w = 4 0 9 6 )$ ）。代价变为$O ( n \cdot w )$ —在 n 上是线性的。被 Mistral [165]（窗口 = 4096）和 Longformer [23] 采用。以全局上下文换效率；之所以有效，是因为实践中大部分注意力是局部的。在现代技术栈中，滑动窗口掩码在 FlashAttention 内核内部执行。

3. 稀疏注意力模式：将局部窗口与周期性的全局 Token 结合（例如，每隔 512 个 Token 关注全部）。BigBird [416] 和 LongT5 [125] 使用此方法。以 $O ( n { \sqrt { n } } )$ 代价保留一些长程连通性。同样，FlashAttention 作为非零注意力块的底层内核。

4. 线性注意力 / 状态空间模型：利用结合律将 $\mathrm { s o f t m a x } ( Q K ^ { T } ) V$ 替换为 $\phi ( Q ) ( \phi ( K ) ^ { T } V )$ ，或重构为递归形式（Mamba [122]、RWKV [288]）。理论上总代价为 $O ( n \cdot d ^ { 2 } ) .$ 。与上面方法 2–3 不同，这些是架构上的替换，改变了模型的表达能力——无 Softmax 的注意力本质上表达力更弱，经验上这些模型在需要精确长程检索或复杂推理的任务上仍然落后于 Transformer。

5. KV 缓存压缩：在推理时，压缩或驱逐旧的 KV 对以限制内存。技术包括： $\mathrm { H _ { 2 } O }$ [429]（重击者预言机——只保留高注意力的 Key）、StreamingLLM [394]（保留初始 “注意力陷阱（AttentionSink）”Token + 最近窗口），以及量化 KV 缓存 [237]。

## FlashAttention + 稀疏模式 = 两全其美

一个常见误解是 FlashAttention 是稀疏注意力的替代。事实并非如此——它是注意力内核的 IO 优化，可以与任何注意力掩码自由组合。现代生产系统（如 Mistral、DeepSeek）使用 FlashAttention作为滑动窗口或块稀疏掩码底层的执行引擎。这同时为你带来 FLOPs 的减少（来自稀疏性）和最优的内存访问模式（来自瓦片化）。RingAttention [221] 将其进一步扩展到多设备场景，沿序列维度将瓦片化的计算分布到多块 GPU 上。线性注音力和状太空问描型 种直丁不同的加构迭选择 它们为了

线性注意力和状态空间模型（Mamba、RWKV）是一种真正不同的架构选择——它们为了 $O ( n )$ 计算而牺牲完整的成对交互。虽然理论上优雅，它们在知识密集或长程推理任务上仍未达到Transformer 的质量，前沿实验室继续使用精确注意力（结合 FlashAttention + 稀疏性）作为骨干。

## 1.3.6 多头注意力

多头注意力不是计算单一的注意力函数，而是并行运行多个注意力操作，每个都学习聚焦于输入的不同方面（句法、语义、位置等）。

## 多头注意力（Multi-Head Attention）

不使用一个 d 维 Key/Value 的注意力函数，而是使用 H 个维度为 $d _ { k } = d / H$ 的并行头：

$$
\operatorname{MultiHead} (X) = \operatorname{Concat} (\mathrm{head} _ {1}, \dots , \mathrm{head} _ {H}) W _ {O}
$$

每个头可以学习不同的注意力模式（例如，一个头处理句法，另一个处理语义，再一个处理位置邻近性）。

分组查询注意力（Grouped Query Attention，GQA）：Llama-3 [118] 使用比 Q 头更少的 K、V 头（例如，8 个 KV 头被 32 个 Q 头共享）。这将 KV 缓存大小减小 4×，质量损失极小。

多头潜在注意力（Multi-head Latent Attention，MLA）。 DeepSeek-V2 [69] 引入了更激进的压缩：与 GQA 共享 KV 头不同，MLA 把全部键值信息压缩为每个 token 的单一低秩潜向量：

$$
c _ {t} = W _ {D K V} h _ {t}, \quad K _ {t} = W _ {U K} c _ {t}, \quad V _ {t} = W _ {U V} c _ {t}
$$

其中 $c _ { t } ~ \in ~ \mathbb { R } ^ { d _ { c } }$ 且 $d _ { c } \ll n _ { h } \cdot d _ { h \circ }$ KV 缓存只存储 $c _ { t }$ 甚至比 $\mathrm { G Q A }$ 还小——而解压矩阵$W _ { U K } , W _ { U V }$ 会即时重建完整的键与值。由于压缩是端到端学到的，其质量达到甚至超过 $\mathrm { G Q A } _ { \circ }$ MLA 使 DeepSeek 后续的 Sparse Attention 得以实现次二次复杂度的长上下文扩展，如今已是DeepSeek-V3/V4 架构家族的基础。

## 1.3.7 位置编码

Transformer 在构造上是置换等变的——没有位置信息，模型无法区分 “the cat sat on the mat” 和“mat the on sat cat the”。位置编码注入序列顺序信号，使注意力能够推理 Token 的距离和方向。

Table 1.5: 现代 LLM 中的位置编码方法。

<table><tr><td>方法</td><td>使用者</td><td>核心思想</td></tr><tr><td>正弦(Sinusoidal)</td><td>原始 Transformer</td><td>不同频率的固定 sin / cos。无需学习。</td></tr><tr><td>学习的绝对位置</td><td>GPT-2 [301], BERT [76]</td><td>每个位置的学习嵌入。受限于训练长度。</td></tr><tr><td>RoPE</td><td>Llama [118], Qwen [350], Mistral [165]</td><td>将 Q、K 向量按位置相关的角度旋转。通过 NTK 感知缩放进行外推。</td></tr><tr><td>ALiBi</td><td>BLOOM [383], MPT [260]</td><td>不使用位置嵌入;在注意力分数上添加线性偏置 -m|i-j|。简单,外推性好。</td></tr></table>

正弦（固定）位置编码。 原始 Transformer [357] 中提出，该方法在几何间隔的频率上使用固定的正弦函数：

$$
\mathrm{PE} (p o s, 2 i) = \sin \Bigl (\frac {p o s}{1 0 0 0 0 ^ {2 i / d}} \Bigr), \qquad \mathrm{PE} (p o s, 2 i + 1) = \cos \Bigl (\frac {p o s}{1 0 0 0 0 ^ {2 i / d}} \Bigr)
$$

其中 pos 是 Token 位置，i 是维度索引，d 是模型维度。

动机：每个频率以不同尺度编码位置（类比二进制计数）。作者假设模型可以学会关注相对位置，因为 $\mathrm { P E } ( p o s + k )$ 可以表示为 $\mathrm { P E } ( p o s )$ 的线性函数。

优点：零学习参数；确定性；理论上支持任意长度。

缺点：实践中外推超出训练长度时表现不佳；模型必须间接地从绝对信号中学习解码相对位置；已大体被取代。

学习的绝对位置嵌入。 被 GPT-2 [301] 和 BERT [76] 采用：一个可学习的嵌入矩阵 $\mathbf { E } _ { \mathrm { p o s } } \in \mathbb { R } ^ { L _ { \mathrm { m a x } } \times d }$ 被加到 Token 嵌入上：

$$
h _ {0} ^ {(p o s)} = \mathrm{TokenEmbed} (x _ {p o s}) + \mathbf {E} _ {\mathrm{pos}} [ p o s ]
$$

动机：让模型自己学习对任务最优的位置表示，而不是强加一个固定结构。

优点：最大的灵活性；实现简单；对短序列通常优于正弦编码。

缺点：硬编码的最大长度 $L _ { \mathrm { m a x } }$ ；无法泛化到其之外； $L _ { \mathrm { m a x } }$ 末尾附近的嵌入训练不足；增加$L _ { \mathrm { m a x } } \times d$ 个参数。

旋转位置编码（Rotary Position Embedding， $\mathbf { R o P E } )$ ）。 RoPE [341] 通过在 2D 子空间中旋转Query 和 Key 向量来编码位置：

$$
\operatorname{RoPE} (x _ {m}, m) = \left( \begin{array}{c} x _ {m} ^ {(1)} \\ x _ {m} ^ {(2)} \\ \vdots \\ x _ {m} ^ {(d - 1)} \\ x _ {m} ^ {(d)} \end{array} \right) \odot \left( \begin{array}{c} \cos m \theta_ {1} \\ \cos m \theta_ {1} \\ \vdots \\ \cos m \theta_ {d / 2} \\ \cos m \theta_ {d / 2} \end{array} \right) + \left( \begin{array}{c} - x _ {m} ^ {(2)} \\ x _ {m} ^ {(1)} \\ \vdots \\ - x _ {m} ^ {(d)} \\ x _ {m} ^ {(d - 1)} \end{array} \right) \odot \left( \begin{array}{c} \sin m \theta_ {1} \\ \sin m \theta_ {1} \\ \vdots \\ \sin m \theta_ {d / 2} \\ \sin m \theta_ {d / 2} \end{array} \right)
$$

其中 $\theta _ { i } = 1 0 0 0 0 ^ { - 2 i / d }$ ，m 是位置索引。关键性质是：旋转后的 Query 与 Key 之间的点积只依赖于相对位置：

$$
\langle \mathrm{RoPE} (q _ {m}, m), \mathrm{RoPE} (k _ {n}, n) \rangle = f (q _ {m}, k _ {n}, m - n)
$$

动机：在无需显式偏置项的情况下实现相对位置编码，同时保持与线性注意力和 KV 缓存的兼容性。

优点：天然相对；无额外参数；与高效推理兼容；可以通过 NTK 感知缩放 [289] 或 YaRN（调整θ 基数或插值频率）扩展到更长的上下文。

缺点：每次注意力操作的计算略多（旋转 + 交错）；外推需要显式的缩放策略；在 2D 子空间中的旋转施加了一种结构，对所有任务未必最优。

<table><tr><td>RoPE长度扩展</td></tr><tr><td>将训练在L长度上的RoPE模型扩展到上下文长度 $L' > L$ :位置插值 (Position interpolation): 将位置按 $L/L'$ 缩放,使所有位置落在[0,L]内。简单但压缩了分辨率。NTK感知缩放: 增大θ基数(例如10000→10000· $(L'/L)^{d/(d-2)}$ ),有效地拉伸高频成分,同时保留低频成分。YaRN [289]: 将NTK缩放与注意力温度校正 $t = 0.1\ln(s) + 1$ 结合,以补偿更长距离上熵的增加。</td></tr></table>

ALiBi（带线性偏置的注意力，Attention with Linear Biases）。 ALiBi [292] 采取了根本不同的方法：完全不使用位置嵌入。取而代之，从注意力分数中减去一个静态的线性惩罚：

$$
\operatorname{Attention} (Q, K, V) = \operatorname{softmax} \left(\frac {Q K ^ {T}}{\sqrt {d _ {k}}} - m \cdot [ | i - j | ] _ {i, j}\right) V
$$

其中 $m$ 是头特定的斜率（几何设置：对总共 H 个头中的第 h 个头取 $m _ { h } = 2 ^ { - 8 h / H } )$ ）。偏置 $- m | i - j |$ 创建 $\vec { \mathrm { ~ \ j ~ } } ^ { \cdot }$ 一个软局部注意力窗口，其宽度因头而异。

动机：位置应使注意力偏向邻近 Token（近因先验），同时不干扰嵌入空间。通过纯粹在注意力分数空间中操作，ALiBi 避免了用位置信号污染 Token 表征。

优点：出色的长度外推（在 1k 上训练，在 8k+ 仍可用）；零参数；实现极简；头特定的斜率提供多尺度局部性。

缺点：对需要精确长程位置推理的任务（如 “第 5 个词是什么？”）表达力较弱；线性衰减是一种强归纳偏置，可能不适合所有领域；由于 RoPE 在短上下文上表现更好，最近的模型中已大体被RoPE 取代。

Table 1.6: 位置编码对比：实际权衡。

<table><tr><td></td><td>正弦(Sinusoidal)</td><td>学习绝对位置</td><td>RoPE</td><td>ALiBi</td></tr><tr><td>额外参数</td><td>无</td><td> $L_{\text{max}} \times d$ </td><td>无</td><td>无</td></tr><tr><td>位置类型</td><td>绝对</td><td>绝对</td><td>相对</td><td>相对(隐式)</td></tr><tr><td>长度外推</td><td>差</td><td>无</td><td>好(带缩放)</td><td>优秀</td></tr><tr><td>计算开销</td><td>可忽略</td><td>可忽略</td><td>小</td><td>可忽略</td></tr><tr><td>主导时期</td><td>2017-19</td><td>2018-20</td><td>2022-至今</td><td>2022-23</td></tr></table>

扩展到极长上下文 $\mathbf { \left( 1 0 0 K - 1 M + \Gamma 0 k e n \right) }$ o 现代前沿模型（Claude [11] 拥有 200K–1M 上下文、Gemini 1.5 [108] 达到 1M+、GPT-4 [274] 128K）需要在远超训练长度时仍然忠实的位置编码。当今的主流解决方案：

1. 带频率缩放的 RoPE：将 RoPE 扩展到训练长度之外的标准方法。无需重新训练，对基础频率 θ 进行重新缩放：

$$
\theta_ {i} ^ {\prime} = \theta_ {i} \cdot \left(\frac {L _ {\mathrm{target}}}{L _ {\mathrm{train}}}\right) ^ {2 i / d}
$$

变体包括：

- 线性缩放（位置插值） [48]：简单地将位置索引除以因子 $s _ { \circ }$ 。便宜但在高扩展比时降低质量。

- NTK 感知缩放 [289]：缩放基础频率 $\theta = 1 0 0 0 0 \to 1 0 0 0 0 \cdot s ^ { d / ( d - 2 ) }$ 。保留高频（局部）信 息的同时扩展低频（全局）范围。

- YaRN [289]（Yet another RoPE extensioN）：将 NTK 缩放与注意力温度校正以及在一个小型长上下文语料上的微调结合。Llama-3 用它将 8K 训练扩展到 128K 部署。

- 动态 NTK（Dynamic NTK） [289]：在推理时根据实际序列长度即时调整缩放因子。无需固定扩展比——模型随上下文增长而适应。

2. 在长数据上继续预训练：即使使用 RoPE 缩放，模型也能从在长文档上的短期继续预训练阶段（1–5B Token）中受益。这教会模型真正地使用远距离上下文，而不仅是在位置上容忍它。Llama-3.1 使用渐进式计划：8K → 64K → 128K。

3. Ring Attention / 分块并行 [221]：对于超出单 GPU 内存的序列 $\mathrm { ( 1 M + ~ T o k e n ) }$ ），RingAttention 以环形拓扑将序列分布在 GPU 之间。每块 GPU 持有一个块并在环上传递 KV 块，计算局部注意力瓦片。这使内存能够随 GPU 数量线性扩展，同时保留精确注意力。

4. 混合架构：一些系统将大多数层的局部滑动窗口（例如 4K）与选定层（如每 4 层一次）的全注意力结合。这为大部分计算提供 $O ( n \cdot w )$ 代价，同时维持全局信息流。

## 长上下文 ̸= 长上下文利用

拥有 1M 上下文长度的模型并不必然能有效利用所有 1M Token。“迷失中间 $\left( { \mathrm { L o s t i n t h e M i d d l e } } \right)$ 现象 [226] 表明，模型倾向于聚焦于长上下文的开始和结尾，对中间的信息利用不足。有效的长上下文利用需要位置编码支持和在奖励长程检索的任务上进行训练。

## 1.3.8 前馈网络（MLP）

每个 Transformer 块包含一个独立应用于每个位置的 MLP：

$$
\operatorname{FFN} (x) = W _ {2} \cdot \sigma \left(W _ {1} x + b _ {1}\right) + b _ {2}
$$

其中 $W _ { 1 } \in \mathbb { R } ^ { d \times 4 d } , W _ { 2 } \in \mathbb { R } ^ { 4 d \times d } \circ$ 。现代 LLM 使用：

- SwiGLU 激活： $\mathrm { F F N } ( x ) = W _ { 2 } ( \mathrm { S w i s h } ( W _ { 1 } x ) \odot W _ { 3 } x )$ ——被 Llama [118]、Mistral [165] 采用。需要 3 个权重矩阵，但带来更好的性能。

- 隐藏维度通常为 $8 / 3 \times d$ （取整到 256 的倍数以适配 Tensor Core 效率）。

## FFN 作为存储器

近期工作 [110] 表明 FFN 层充当一种键值存储器： $W _ { 1 }$ 的行是 $\mathrm { K e y }$ （要匹配的模式）， $W _ { 2 }$ 的列是Value（要输出的信息）。FFN 基于当前隐藏状态 “检索” 存储的知识。

## 1.3.9 层归一化（Layer Normalization）

层归一化通过在特征维度上对激活进行归一化来稳定训练。它相对于注意力/FFN 子层的位置显著影响训练动态。

LayerNorm 如何工作。 给定一个隐藏状态向量 $\mathbf { x } \in \mathbb { R } ^ { d }$ （单个 Token 的表征），LayerNorm [15]计算：

$$
\operatorname{LayerNorm} (\mathbf {x}) = \gamma \odot \frac {\mathbf {x} - \mu}{\sqrt {\sigma^ {2} + \epsilon}} + \beta\tag{1.5}
$$

其中：

$\textstyle \mu = { \frac { 1 } { d } } \sum _ { i = 1 } ^ { d } x _ { i }$ （在 d 个特征维度上的均值）

$\begin{array} { r } { \sigma ^ { 2 } = \frac { 1 } { d } \sum _ { i = 1 } ^ { d } ( x _ { i } - \mu ) ^ { 2 } } \end{array}$ （在特征上的方差）

$\gamma , \beta \in \mathbb { R } ^ { d }$ 是学习的缩放和平移参数（按维度）

$\cdot ~ \epsilon \approx 1 0 ^ { - 5 }$ 防止除以零

与 BatchNorm 的关键区别：LayerNorm 在单个样本的特征维度上归一化，而非跨批次。这使其独立于批次大小，并在训练和推理时表现一致。

RMSNorm——现代简化版。 均方根归一化（Root Mean Square Normalization，RMSNorm）[421]去掉了均值中心化步骤，仅按均方根归一化：

$$
\operatorname{RMSNorm} (\mathbf {x}) = \gamma \odot \frac {\mathbf {x}}{\operatorname{RMS} (\mathbf {x})}, \quad \operatorname{RMS} (\mathbf {x}) = \sqrt {\frac {1}{d} \sum_ {i = 1} ^ {d} x _ {i} ^ {2}}\tag{1.6}
$$

没有 $\beta$ （平移）参数，也没有均值减法——只有缩放。这每个 Token 节省一次归约操作，在 GPU 上快约 5–10%，同时保持等同的模型质量。所有现代 LLM（Llama、Mistral、Qwen）都使用 RMSNorm。

## Pre-LN vs Post-LN

- Post-LN（原始 Transformer）： $h + \mathrm { L a y e r N o r m } ( \mathrm { A t t n } ( h ) )$ 。需要仔细的 warmup；训练可能不稳定。

- Pre-LN（GPT-2+，所有现代 LLM）： $h + \mathrm { A t t n } ( \mathrm { L a y e r N o r m } ( h ) )$ )。稳定训练；允许更高的学习率。

- RMSNorm（Llama [118], Mistral [165]） ： 不 带 均 值 中 心 化 的 简 化 LayerNorm：$\mathrm { R M S N o r m } ( x ) = x / \mathrm { R M S } ( x ) \cdot \gamma _ { \circ }$ 稍快，同等质量。

## 为什么归一化对深度网络很重要

没有归一化，激活倾向于在层之间指数增长或收缩（爆炸/消失激活）。一个无 LayerNorm 的 128层 Transformer 在第一层和最后一层之间，量级会变化 $1 0 ^ { 3 0 } \times \textdegree$ 归一化将每层输出约束在可预测的范围内，使梯度流动稳定，并允许优化器在整个网络中使用一致的学习率。

## 1.3.10 模型规模参考

下表总结了广泛使用的开放权重模型（截至 2025 年的最新版本）的关键架构参数，为理解规模和设计选择提供了快速参考。

Table 1.7: 流行开放权重 LLM 的架构参数（2024–2025 代）。

<table><tr><td>模型</td><td>参数</td><td>层数</td><td>d</td><td>头数</td><td>KV 头数</td><td>上下文</td></tr><tr><td>Llama-3.1 8B [118]</td><td>8B</td><td>32</td><td>4096</td><td>32</td><td>8</td><td>128K</td></tr><tr><td>Llama-3.1 405B [118]</td><td>405B</td><td>126</td><td>16384</td><td>128</td><td>8</td><td>128K</td></tr><tr><td>Llama-4 Maverick [4]</td><td>400B (17B 活跃)</td><td>48</td><td>5120</td><td>40</td><td>8</td><td>1M</td></tr><tr><td>Mistral Large 2 [5]</td><td>123B</td><td>88</td><td>12288</td><td>96</td><td>8</td><td>128K</td></tr><tr><td>Qwen-2.5 72B [350]</td><td>72B</td><td>80</td><td>8192</td><td>64</td><td>8</td><td>128K</td></tr><tr><td>DeepSeek-V3 [70]</td><td>671B (37B 活跃)</td><td>61</td><td>7168</td><td>128</td><td>MLA</td><td>128K</td></tr></table>

注：标注 “活跃” 参数的模型使用混合专家（Mixture-of-Experts，MoE）架构——总参数表示模型容量，而活跃参数反映每个 Token 的计算代价。DeepSeek-V3 使用多头潜在注意力（Multi-headLatent Attention，MLA）而非标准 GQA，将 KV 压缩到低秩潜空间中。

## 1.3.11 注意力病态

虽然注意力机制功能强大，但它表现出实践者必须理解的系统性失败模式——特别是在扩展到长上下文或解释模型行为时。

## 注意力陷阱（Attention Sink）

现象。 Xiao 等 [393] 发现 Transformer 模型对序列中的第一个 Token 分配了不成比例的高注意力分数——无论其语义内容如何。即使第一个 Token 是无意义的 <BOS> 标记，所有层中的注意力头都持续地关注它，有时占总注意力质量的 20–50%。

为什么会发生。 Softmax 注意力必须产生有效的概率分布 $\begin{array} { r } { ( \sum _ { j } \alpha _ { j } = 1 ) } \end{array}$ ）。当没有 Key 对 Query 特别相关时，模型需要一个 “倾倒” 位置来安放未使用的注意力质量。在训练期间，第一个 Token 成为这个默认陷阱，因为它总是存在且在位置上可预测。它作为一个无操作的注意力目标——模型已经学会将不相关的注意力路由到那里，而不是不可预测地分配它。

$$
\alpha_ {\mathrm{sink}} = \frac {\exp (q ^ {\top} k _ {0} / \sqrt {d})}{\sum_ {j} \exp (q ^ {\top} k _ {j} / \sqrt {d})} \gg \frac {1}{n} \quad (\mathrm{evenwhen} k _ {0} \mathrm{issemanticallyirrelevant})
$$

后果。

- 流式推理失败：使用滑动窗口 KV 缓存时，驱逐第一个 Token 会导致困惑度灾难性地飙升——模型失去了它的注意力陷阱。

- 误导性的可解释性：朴素的注意力可视化暗示第一个 Token“重要”，而实际上它只是一种数学伪影。

- 上下文窗口浪费：陷阱 Token 占用一个 KV 缓存槽位，却不携带有用信息。

解决方案。

- StreamingLLM [393]：始终在 KV 缓存中保留前 k 个 Token（“注意力陷阱”）以及最近的滑动窗口。在有界内存下实现无限长度生成。

- 设计上的陷阱 Token：一些模型（如 Mistral）在训练期间预置专门的陷阱 Token，明确用于吸收残余注意力。

- Softmax 替代：用 ReLU 注意力或 Sigmoid 门控替换 Softmax，使零注意力可以表示而无需倾倒目标。

## 注意力稀释（Attention Dilution）

现象。 随着序列长度 n 增长，每个 Query 必须将其注意力预算分配到更多 Key 上。每个 Token的平均注意力权重以 O(1/n) 下降，使得模型越来越难以集中在少数真正相关的位置上——这个问题被称为注意力稀释（attention dilution）或注意力扩散（attention difusion） [226]。

“迷失中间（Lost in the Middle）” 效应。 Liu 等 [226] 表明 LLM 表现出 U 形检索曲线：放在长上下文开始或结尾的信息被可靠地检索，但中间的信息常常被忽略。这是注意力稀释叠加 RoPE/ALiBi 位置偏差的直接后果：

为什么会发生。

- Softmax 饱和：在 Key 很多时，Softmax 温度有效降低，使分布更加均匀（熵化）。

- 位置衰减：RoPE 的相对位置编码引入了一种随距离的自然衰减，抑制了对距离开始和结尾都较远的中间位置的注意力。

- 训练分布：在较短序列上训练的模型形成了偏向近期上下文的注意力模式。

缓解策略。

- 显式检索：将相关上下文放在提示的开始或结尾；使用 RAG 来避免依赖中间位置。

- 长上下文训练：在关键信息位置多样化的长文档上训练 $[ 1 0 0 ] _ { \circ }$

- 层次化注意力：如 Mamba [123] 或 RWKV 等完全避免 $O ( n ^ { 2 } )$ 注意力瓶颈的架构。

- 地标 Token（Landmark tokens）：在上下文中插入可检索的标记，作为注意力的 “路标”。

- 温度缩放：一些实现将注意力 logits 按 logn 缩放，以抵消长序列中的稀释。

## 其他注意力现象

Table 1.8: 在大型 Transformer 中观察到的其他注意力模式。

<table><tr><td>模式</td><td>描述</td><td>影响</td></tr><tr><td>注意力头专门化</td><td>不同头学习不同角色:句法头、共指头、位置头 [361]</td><td>并非所有头都同等重要;很多可以被剪枝</td></tr><tr><td>归纳头(Induction heads)</td><td>实现 [A][B]...[A] → [B] 复制的头 [273]</td><td>对上下文学习至关重要;在 2层及以上的模型中涌现</td></tr><tr><td>注意力塌缩(Attention collapse)</td><td>在深度网络中,注意力分布可能收敛(所有头关注相同位置)</td><td>损害表达力;通过注意力多样性损失来解决</td></tr><tr><td>检索头(Retrieval heads)</td><td>特定头专门从上下文中检索事实信息 [387]</td><td>解释了为何剪枝某些头会导致幻觉激增</td></tr></table>

## 1.3.12 为可解释性而进行注意力可视化

注意力权重为模型推理提供了一扇窗户——但必须谨慎解读。

注意力可视化方法

原始注意力图。 最简单的方法：为每个头和每层将 $n \times n$ 注意力矩阵 $A = \operatorname { s o f t m a x } ( Q K ^ { \top } / \sqrt { d } )$ 绘制为热图。BertViz [359] 等工具可以渲染交互式的多头可视化。

注意力展开（Attention rollout）。 单层的原始注意力是有误导性的，因为信息通过残差连接流经所有层。Abnar 和 Zuidema [2] 提出了注意力展开（attention rollout）：将各层的注意力矩阵相乘以近似从输入到输出的总信息流：

$$
R ^ {(l)} = A ^ {(l)} \cdot R ^ {(l - 1)}, \quad R ^ {(0)} = I
$$

其中 $A ^ { ( l ) }$ 是第 l 层的注意力矩阵（跨头平均），经过调整以包含残差连接： $A ^ { ( l ) } = 0 . 5 \cdot A _ { \mathrm { r a w } } ^ { ( l ) } + 0 . 5 \cdot I _ { \circ }$ 梯度加权的注意力。 将注意力权重与梯度信息结合以识别哪些被关注的 Token 实际影响输出 [20]：

$$
\mathrm{Relevance} (i) = \alpha_ {i} \cdot \left| \frac {\partial y}{\partial h _ {i}} \right|
$$

这回应了 “高注意力 ̸= 高影响” 的批评（一个 Token 可以收到高注意力，但通过近零权重路径处理）。

## 注意力不是解释

Jain 和 Wallace [160] 表明，注意力权重往往与基于梯度的特征重要性不相关，对抗性的注意力分布可以产生相同的输出。将注意力可视化作为一种假设生成器，而非忠实的解释。对于因果归因，优先选择基于梯度的方法、探测（probing）或机制可解释性。

## 使用稀疏自编码器（Sparse Autoencoder，SAE）的机制可解释性

可解释性问题。 Transformer MLP 和残差流中的单个神经元通常是多义的（polysemantic）——单个神经元对多个不相关的概念激活（例如 “蓝色 AND 学术引文 AND 单词 ‘the”’）。这使得直接的神经元级解释变得不可靠。

稀疏自编码器（Sparse Autoencoder，SAE）。 Cunningham 等 [63] 和 Bricken 等 [30] 证明，在模型激活上训练稀疏自编码器（Sparse Autoencoder，SAE）可以将多义表征分解为单义特征（monosemantic features）——每个对应单一概念的可解释方向：

$$
h = W _ {\mathrm{dec}} \cdot \mathrm{ReLU} (W _ {\mathrm{enc}} \cdot x + b _ {\mathrm{enc}}) + b _ {\mathrm{dec}}
$$

其中 $W _ { \mathrm { e n c } } \in \mathbb { R } ^ { m \times d } , ~ m \gg d$ （超完备基），ReLU + 稀疏惩罚确保每个输入只有少数特征被激活。

## SAE 可解释性的关键发现：

- 特征是单义的：每个编码一个人类可解释的概念（“Python 代码”、“提及金门大桥”、“第一人称叙述”） [30]。

- 特征是可操控的：将某个特征的激活钳制为高/低直接控制模型行为（例如，强制 “金门大桥”特征开启会使模型在每个回复中都提到它） [353]。

- 特征可组合：复杂行为从简单特征的组合中涌现。

- SAE 可扩展：Templeton 等 [353] 在 Claude 3 Sonnet 上训练了多达 34M 个特征的 SAE，找到了与安全相关的概念（欺骗、谄媚、危险请求）的可解释特征。

## SAE 训练配方

1. 从特定模型层在一个大型语料上收集激活。

2. 在隐藏层上以 $L _ { 1 }$ 惩罚训练稀疏自编码器： $\mathcal { L } = \Vert x - \hat { x } \Vert _ { 2 } ^ { 2 } + \lambda \Vert z \Vert _ { 1 0 }$

3. 学到的编码器方向 $( W _ { \mathrm { e n c } }$ 的行）即候选特征。

4. 验证：对每个特征，找出最大激活样本并检查语义一致性。

5. 可选：测量特征吸收（feature absorption）和死特征（dead features）以评估 SAE 质量。

## 自然语言自编码器（Anthropic，2026）

虽然 SAE 将激活分解为可解释的向量，其特征仍需人工检查最大激活样本才能理解。Anthropic 的自然语言自编码器（Natural Language Autoencoders，NLAE） [12] 采取了根本不同的方法：用自然语言描述替代稀疏瓶颈，使可解释性自动化。

## NLAE 如何工作。

1. 编码器：一个语言模型读取隐藏激活（或输入文本）并产生关于活跃概念的自然语言描述：例如，“文本讨论法国菜并使用正式的学术语调。 ”

2. 解码器：第二个语言模型读取自然语言描述并重建原始激活（或预测下一个 Token）。

3. 训练：编码器和解码器端到端地训练以最小化重建损失，瓶颈是一个可变长度的自然语言字符串而非稀疏向量。

相对 SAE 的优势。

- 自解释：特征字面上就是自然语言——无需人工标注。

- 可组合：可以表达 SAE 特征无法作为单一方向表示的复杂关系概念（“对事实声明的讽刺回应”）。

- 层次化：描述可以在同一表征中同时捕捉细粒度（词级）和粗粒度（文档级）属性。

- 可审计：瓶颈描述是人类可读的，能够直接检查模型 “认为” 存在的信息。

局限性。 NLAE 引入了一个 “语言模型在回路中” 的设计，使其计算昂贵，并且可能与任何模型生成的解释一样面临忠实性担忧。它们也不能轻易表示亚符号特征（几何模式、精确数值），而 SAE能将这些自然地作为激活幅度处理。

!!! note
    可解释性层级栈

    将可解释性工具视为一个层级：
    1. 注意力图：“模型在看什么？”（最便宜，最不忠实）
    2. 探测分类器：“这一层编码了什么信息？”
    3. 稀疏自编码器：“哪些单义特征是活跃的？”（可扩展，需要人工标注）
    4. 自然语言自编码器：“模型认为发生了什么？”（自解释，昂贵）
    5. 因果追踪 / 修补（Causal tracing / patching）：“哪些组件实际导致了这个输出？”（最忠实，最昂贵）

    每个层级都在解释的成本、可扩展性和忠实性之间权衡。

## 1.4 预测头：Transformer 的输出

Transformer 主干网络为每个位置产生上下文隐藏状态 $\mathbf { h } _ { t } \in \mathbb { R } ^ { d _ { \mathrm { c } } }$ 。我们如何处理这些隐藏状态——即预测头（Prediction Head）——定义了任务本身。同一个 Transformer 主干网络只需更换预测头，就能服务于完全不同的目的。

![](../images/0bc45f71d705314f5b1e89aaa2572475390c2c5e02b5f9eea9de69a35f623a30.jpg)  
*Figure 1.7: 同一个 Transformer 主干网络通过更换预测头即可支持不同任务。本文使用的全部三种预测头在最终投影层之下具有完全相同的架构。*

## 1.4.1 语言建模头（预训练阶段）

标准的语言建模头（Language Modeling Head, LM Head）将最终隐藏状态投影到词表 logits，并以下一个 token 的交叉熵损失进行训练：

$$
P (x _ {t + 1} | x _ {\leq t}) = \operatorname{softmax} (\mathbf {W} _ {\mathrm{head}} \cdot \mathbf {h} _ {t} + \mathbf {b})\tag{1.7}
$$

其中 $\mathbf { W _ { h e a d } } \in$ R $| \nu | \times d$ （通常与 embedding 矩阵权重共享： $\mathbf { W } _ { \mathrm { h e a d } } = \mathbf { E } ^ { T } )$

## LM 头的特性

- 训练目标：因果语言建模（对每个位置预测下一个 token）

- 损失： $\begin{array} { r } { \mathcal { L } _ { \mathrm { L M } } = - \frac { 1 } { T } \sum _ { t = 1 } ^ { T } \log P ( x _ { t } | \boldsymbol { x } _ { < t } ) } \end{array}$

- 标签：每个 token 同时作为输入（右移一位）和目标（左移一位）

- 使用阶段：在大规模语料上的预训练（万亿级 token）

- 关键洞察：模型在下一 token 预测的副产品中学到通用语言理解能力

## 1.4.2 条件生成头（SFT / 指令跟随）

对于监督微调（Supervised Fine-Tuning, SFT），其架构与 LM 头完全相同——都是将隐藏状态线性投影到词表 logits。区别仅在于在哪些 token 上计算损失：

$$
\mathcal {L} _ {\mathrm{SFT}} = - \frac {1}{| y |} \sum_ {t = 1} ^ {| y |} \log P (y _ {t} | x _ {\mathrm{prompt}}, y _ {<   t})\tag{1.8}
$$

## 条件生成头 – 与 LM 头的关键区别

- 损失掩码：只在回复的 token 上计算损失，不计算 prompt/指令部分。Prompt 仅提供上下文，不提供梯度信号。

- 条件化：模型学会在特定指令格式（system prompt、用户查询、工具调用）的条件下生成回复。

- 格式 token：特殊 token（<|user|>、<|assistant|>）引导模型产生结构化输出。

- 使用阶段：在精心策划的指令-回复对上进行 $\operatorname { S F T } ;$ 也在强化学习的策略生成阶段使用（即产出动作/回复的策略头）。

## 同一个头 – 不同的训练信号

LM 头和 SFT 头在架构上完全相同（同一个 $\mathbf { W } _ { \mathrm { h e a d } } ) .$ 。唯一的区别是 SFT 阶段会掩码掉 prompttoken 的损失。这个细微的改动就把一个通用文本预测器转变为一个指令跟随助手。预测头学会根据上下文条件「激活」不同的生成模式。

## 1.4.3 价值头（用于 RL 的回归头）

在强化学习（PPO、GRPO）中，我们需要估计某个状态有多好——这需要一个标量输出，而不是词表 logits。价值头（Value Head）用一个简单的回归层替换了 LM 投影：

$$
V (s _ {t}) = \mathbf {w} _ {\mathrm{value}} ^ {T} \cdot \mathbf {h} _ {t} + b \in \mathbb {R}\tag{1.9}
$$

其中 $\mathbf { w } _ { \mathrm { v a l u e } } \in \mathbb { R } ^ { d } , b \in \mathbb { R } _ { \circ }$

## 价值头的特性

- 输出：单个标量（从该状态出发的期望累计奖励）

- 损失：预测回报与真实回报之间的均方误差： $\begin{array} { r } { \mathcal { L } _ { V } = \frac { 1 } { T } \sum _ { t } ( V ( s _ { t } ) - R _ { t } ) ^ { 2 } } \end{array}$

- 架构：线性层 $\mathbb { R } ^ { d } \to \mathbb { R } ^ { 1 }$ （有时会用一个小型 MLP：d → 256 → 1）

- 主干共享：通常与策略共享 Transformer 主干（但有独立的价值头），也可能使用完全独立的 critic 网络

- 使用阶段：PPO 优势估计（GAE）、奖励模型评分

## 1.4.4 预测头选择总览

Table 1.9: 本文使用的各类预测头及其训练场景。

<table><tr><td>预测头</td><td>输出</td><td>损失</td><td>阶段</td><td>用途</td></tr><tr><td>LM Head</td><td> $\mathbb{R}^{|\mathcal{V}|}$ </td><td>交叉熵(所有 token)</td><td>预训练</td><td>从原始文本学习语言</td></tr><tr><td>Conditional Head</td><td> $\mathbb{R}^{|\mathcal{V}|}$ </td><td>交叉熵(仅回复部分)</td><td>SFT</td><td>学习跟随指令</td></tr><tr><td>Value Head</td><td> $\mathbb{R}^1$ </td><td>MSE</td><td>RL (PPO)</td><td>估计状态价值以计算优势</td></tr><tr><td>Reward Head</td><td> $\mathbb{R}^1$ </td><td>成对排序</td><td>奖励模型训练</td><td>给回复质量打分</td></tr></table>

## 预测头初始化很重要

为预训练LM 添加价值头时，应将其初始化为接近零的小随机权重。若初始化值过大，初始价值估计会严重偏离，导致优势值过大、PPO 更新不稳定。常见做法：将最后一层线性层用 $\mathcal { N } ( 0 , 1 / \sqrt { d } )$ 初始化，或直接置零。

## 1.4.5 HuggingFace 实现

```python
from transformers import (
    AutoModelForCausalLM,    # LM 头（预训练 + SFT）
    AutoModelForSequenceClassification,  # 奖励头
    AutoTokenizer,
)
from trl import AutoModelForCausalLMWithValueHead  # 价值头（PPO）
import torch

model_name = "meta-llama/Llama-3.1-8B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)

# === 1. LM 头（预训练 / SFT） ===
# 默认的 CausalLM 模型——将隐藏状态投影到词表 logits
lm_model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
# lm_model.lm_head: Linear(hidden_size -> vocab_size)
# 输出：形状为（batch, seq_len, vocab_size）的 logits

inputs = tokenizer("The capital of France is", return_tensors="pt")
outputs = lm_model(**inputs)
next_token_logits = outputs.logits[:, -1, :]  # (batch, vocab_size)
probs = torch.softmax(next_token_logits, dim=-1)

# === 2. 条件生成头（SFT） ===
# 架构上与 LM 头完全相同——区别在于损失掩码
# SFT 时只在回复 token 上计算损失：
messages = [
    {"role": "user", "content": "What is 2+2?"},
    {"role": "assistant", "content": "4"},
]
formatted = tokenizer.apply_chat_template(messages, return_tensors="pt")
labels = formatted.clone()
# 掩码掉 prompt token（设为 -100，交叉熵会忽略它们）
prompt_len = len(tokenizer.apply_chat_template(messages[:1]))
labels[:, :prompt_len] = -100
loss = lm_model(input_ids=formatted, labels=labels).loss

# === 3. 价值头（PPO Critic） ===
# 在 LM 主干之上加一个 Linear(hidden_size -> 1)
value_model = AutoModelForCausalLMWithValueHead.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
# value_model.v_head: Linear(hidden_size -> 1)
# 同时返回 LM logits 和每个 token 的价值估计

inputs = tokenizer("Explain quantum computing", return_tensors="pt")
lm_logits, loss, values = value_model(
    **inputs, return_dict=False
)
# values 形状：(batch, seq_len, 1)——每个 token 一个标量估计

# === 4. 奖励头（奖励模型） ===
# 分类头：在最后一个 token 上接 Linear(hidden_size -> 1)
reward_model = AutoModelForSequenceClassification.from_pretrained(
    model_name,
    num_labels=1,    # 单标量输出
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
```

```python
# 通过池化最后一个 token 的隐藏状态对整个序列打分
inputs = tokenizer("Good response here", return_tensors="pt")
reward_score = reward_model(**inputs).logits # 形状：(batch, 1)
```

*Listing 1.3: 使用 HuggingFace 加载与使用不同的预测头。*

## 权重共享：LM 头 = embedding 矩阵的转置

大多数现代 LLM 会将 LM 头的权重与输入 embedding 矩阵共享（tie）：lm\_head.weight =model.embed\_tokens.weight。这意味着 LM 头并非独立学习的一层——它直接复用了 embedding表。好处包括：参数更少（节省 |V|×d）、泛化更好，并且 embedding 空间的几何结构直接决定了token 概率。你可以在 HuggingFace 中验证这一点：对大多数模型而言，model.lm\_head.weightis model.model.embed\_tokens.weight 会返回 True。

## 1.5 LLM 训练的优化理论

训练一个大语言模型意味着寻找一组参数 θ（数十亿个权重），使损失函数 ${ \mathcal { L } } ( \theta )$ ——通常是下一个token 的负对数似然——最小化。这是一个在极高维空间中的优化问题，用来在该空间中导航的算法直接决定了训练是成功、发散还是停滞。

## 1.5.1 梯度下降：基础

什么是梯度？ 梯度 $\nabla _ { \boldsymbol { \theta } } \mathcal { L }$ 是一个指向损失函数最陡上升方向的向量。每个分量 $\frac { \partial \mathcal { L } } { \partial \theta _ { i } }$ 告诉我们：如果对参数 $\theta _ { i }$ 略微增加一点，损失会变化多少。为了降低损失，我们沿相反方向移动：

$$
\theta_ {t + 1} = \theta_ {t} - \eta \nabla_ {\theta} \mathcal {L} (\theta_ {t})\tag{1.10}
$$

其中 $\eta > 0$ 是学习率（Learning Rate）——也就是步长。这就是梯度下降（Gradient Descent）[310]。

![](../images/4de7c5040420485fadddc8e69cff4b74b85b6d62e0260385d6f940d3fc2216d9.jpg)  
*Figure 1.8: 梯度下降：从随机初始化 $\theta _ { 0 }$ 开始，每一步都将参数沿降低损失的方向移动，步长由学习率 $\eta$ 控制。该过程会向某个（局部）最小值收敛。*

为何全梯度下降不可行。 计算精确梯度需要在整个训练集上评估损失（对 LLM 而言是万亿级token），计算开销极其高昂——单步梯度更新就需要遍历全部数据。

随机梯度下降（Stochastic Gradient Descent，SGD）。 解决办法是：用一个小的随机数据子集（小批量，mini-batch）来估计梯度 [308]：

$$
\nabla_ {\theta} \mathcal {L} (\theta) \approx \frac {1}{B} \sum_ {i = 1} ^ {B} \nabla_ {\theta} \ell (\theta ; x _ {i})
$$

其中 B 是批大小（对 LLM 通常是 1K–4M 个 token）。小批量梯度是真实梯度的含噪但无偏的估计。

## 为何小批量 SGD 有效

- 计算效率：每步开销是 $O ( B )$ 而非 $O ( N _ { \mathrm { t o t a l } } )$ 。当 $B = 4 0 9 6$ 而总 token 为 15T 时，每步开销约便宜 40 亿倍。

- 噪声即正则化：随机噪声有助于逃离尖锐的局部极小值，找到泛化性更好的平坦区域。

- GPU 利用率：小批量足够大，能充分占满 GPU 并行度（矩阵乘法变为计算受限而非显存受限）。

- 收敛性：理论上以 $O ( 1 / \sqrt { T } )$ 的速率收敛到局部极小值（比精确 GD 的 $O ( 1 / T )$ 慢，但每步开销便宜数百万倍）。

从 SGD 到自适应方法。 带动量的 SGD 对视觉模型（CNN）效果不错，但 LLM 训练需要自适应优化器（Adaptive Optimizer）——即为每个参数维护各自学习率的算法。

## 1.5.2 为何朴素 SGD 在 LLM 上失效

随机梯度下降按下式更新权重：

$$
\theta_ {t + 1} = \theta_ {t} - \eta \nabla_ {\theta} \mathcal {L} (\theta_ {t})
$$

## SGD 在 LLM 上的问题

- 各层梯度尺度不同：Transformer 早期层的梯度远小于后期层（梯度消失）。单一学习率 η对一些参数过大，对另一些参数又过小。

- 稀疏梯度：embedding 层只对当前批次出现的 token 有梯度，大部分行的梯度为零。带动量的 SGD 会在零梯度行上浪费动量。

- 鞍点：高维损失曲面存在大量鞍点。SGD 可能停滞，而自适应方法能更快逃脱。

- 对学习率敏感：SGD 需要仔细调参；η 变化 2 倍就可能导致发散。

## 1.5.3 Adam — 自适应矩估计（Adaptive Moment Estimation）

Adam [185] 为每个参数维护梯度一阶矩（均值）与二阶矩（非中心化方差）的估计。

Adam 更新方程

给定梯度  $g_{t} = \nabla_{\theta} \mathcal{L}(\theta_{t})$  与超参数  $\beta_{1}, \beta_{2}, \epsilon, \eta$ 

第 1 步 – 更新有偏一阶矩估计：

 $m_{t} = \beta_{1} m_{t-1} + (1 - \beta_{1}) g_{t}$ 

第 2 步 – 更新有偏二阶矩估计：

 $v_{t} = \beta_{2} v_{t-1} + (1 - \beta_{2}) g_{t}^{2}$ 

第 3 步 – 偏差校正：

 $\hat{m}_{t} = \frac{m_{t}}{1 - \beta_{1}^{t}}, \quad \hat{v}_{t} = \frac{v_{t}}{1 - \beta_{2}^{t}}$ 

第 4 步 – 参数更新：

 $\theta_{t+1} = \theta_{t} - \eta \cdot \frac{\hat{m}_{t}}{\sqrt{\hat{v}_{t}} + \epsilon}$ 

典型取值： $\beta_{1} = 0.9, \beta_{2} = 0.95$  或 0.999， $\epsilon = 10^{-8}, \eta = 10^{-4}$  至  $10^{-5}$ 。
## 每一项的作用

$m _ { t }$ （动量）：梯度的指数移动平均，可平滑噪声梯度估计。 $\beta _ { 1 } = 0 . 9$ 意味着当前梯度贡献$1 0 \% .$ ，历史贡献 90%。

$v _ { t }$ （自适应学习率）：梯度平方的 $\mathrm { E M A } _ { \circ }$ 。梯度持续较大的参数获得较小的有效学习率 $( \eta / \sqrt { v _ { t } } )$ 梯度较小的参数获得较大的有效学习率。这是应对各层梯度尺度差异的关键。

$\hat { m } _ { t } , \hat { v } _ { t }$ （偏差校正）：在 t = 1 时， $m _ { 1 } = ( 1 - \beta _ { 1 } ) g _ { 1 }$ 远小于真实均值。除以 $( 1 - \beta _ { 1 } ^ { t } )$ 可以校正这种初始化偏差。如果不做校正，早期更新步长会过小。

- ϵ（数值稳定性）：防止除零；同时也作为有效学习率的下限。

## 1.5.4 AdamW — 解耦权重衰减（Decoupled Weight Decay, AdamW）

AdamW [238] 修正了权重衰减与自适应优化器交互时一个细微但重要的问题。

## 为何在 Adam 中 L2 正则 ̸= 权重衰减

在 L2 正则化下，损失变为 ${ \mathcal { L } } + { \frac { \lambda } { 2 } } \| \theta \| ^ { 2 }$ 因此梯度为 $g _ { t } + \lambda \theta _ { t \circ }$ 在 Adam 中，这部分正则化梯度会被自适应因子 $1 / \sqrt { \hat { v } _ { t } }$ 缩放：

$$
\theta_ {t + 1} = \theta_ {t} - \eta \cdot \frac {\hat {m} _ {t} + \lambda \theta_ {t}}{\sqrt {\hat {v} _ {t}} + \epsilon}
$$

$v _ { t }$ 较大（梯度方差大）的参数受到的正则化反而更弱。这并不是我们想要的——权重衰减本应是均匀的。

## AdamW – 解耦权重衰减

AdamW（Loshchilov & Hutter, 2017）将权重衰减直接作用于参数本身，置于自适应缩放之外：

$$
\theta_ {t + 1} = \theta_ {t} - \eta \cdot \frac {\hat {m} _ {t}}{\sqrt {\hat {v} _ {t}} + \epsilon} - \eta \lambda \theta_ {t}
$$

权重衰减项 $\eta \lambda \theta _ { t }$ 不再被 $\sqrt { \hat { v } _ { t } }$ 缩放。这样无论参数的梯度历史如何，所有参数都能获得均匀的正则化。

典型取值：LLM 训练时 $\lambda = 0 . 1 _ { \circ }$ 。

## 对 LLM 始终使用 AdamW – 不要用纯 Adam

Adam 与 AdamW 的差别虽细微但很重要。使用 Adam + L2 时，梯度方差小的参数（如 bias、LayerNorm 参数）受到更强的权重衰减，梯度方差大的参数（如 attention 权重）受到的衰减更弱。AdamW 才能提供我们想要的均匀正则化。大多数框架默认使用 AdamW；务必确认你的优化器类。

## 1.5.5 Muon：超越 AdamW

近十年来，AdamW 一直是神经网络训练无可争议的默认优化器。Muon [224]（Liu 等人，2025）是第一个严肃挑战这一统治地位的优化器。其核心洞见是：Adam 累积的动量缓冲区携带的方向信息会被自适应缩放步骤掩盖——而在应用动量之前先对其做正交化，能产生根本更好的更新方向。

## Muon：正交化动量

Muon 用两步流程取代隐藏层权重矩阵上的标准 Adam 更新：

1. 正交化动量：对动量缓冲区 $M _ { t }$ 应用 Newton–Schulz 迭代，得到一个近似正交的矩阵$\tilde { M } _ { t } = \mathrm { N S } ( M _ { t } )$ 。

2. 重新缩放以匹配 AdamW 的 RMS：缩放 $\tilde { M _ { t } }$ 使其均方根与对应 AdamW 更新的 RMS一致，确保有效步长具有可比性。

最终的更新直接作用于权重矩阵。Embedding 层、输出投影与标量参数仍继续使用 AdamW。

Newton–Schulz 迭代是一个矩阵多项式，收敛于 $M _ { t }$ 极分解中的正交因 $\yen 0$ 。具体而言，从 $X _ { 0 } =$ $M _ { t } / \lVert M _ { t } \rVert _ { F }$ 出发，迭代

$$
X _ {k + 1} = \frac {3}{2} X _ {k} - \frac {1}{2} X _ {k} X _ {k} ^ {\top} X _ {k}
$$

会快速收敛（通常 5–10 步）到一个满足 $\tilde { M } _ { t } ^ { \top } \tilde { M } _ { t } \approx I$ 的矩阵 $\tilde { M } _ { t \circ }$ 正交性保证了更新方向在所有奇异值方向上最大程度地展开——防止优化器把更新坍缩到低秩子空间上，而这是 Adam 在奇异值谱高度倾斜的权重矩阵上的一个已知失败模式。

实证效率。 Muon 声称相对 AdamW 约有 2× 的算力效率：以大约一半的梯度步数达到相同的验证损失。这不是边际改进——它代表着优化器在损失景观上样本效率的质变。

前沿模型中的采用。 在大型预训练中，天平明显正在向 Muon 倾斜：

- GLM-4.5 / GLM-5（智谱 AI） [434, 435]：预训练采用 Muon

- Kimi K2（月之暗面） [17]：使用 MuonClip——一个加入 $Q K  – C l i p$ 的变体，通过重新缩放query 与 key 投影来限制 attention logits 并防止损失尖峰。Kimi K2 在超过 15.5T token 上训练且零损失尖峰，是该规模模型的稳定性纪录。

- DeepSeek-V4（2026） [71]：预训练采用 Muon

## AdamW 仍是安全默认

AdamW 仍是 MAI-Thinking-1、Qwen、Llama 以及大多数生产微调流水线的首选优化器。Muon的优势在权重矩阵的大规模预训练中最为显著；它在 LoRA 适配器、小型微调与 RL 训练（PPOGRPO）上的行为则尚未被充分刻画。除非你正在进行大规模预训练，且有基础设施在具体架构上验证 Muon 的行为，否则请使用 AdamW。

## 1.5.6 学习率 — 最重要的超参数

## 各训练阶段的典型学习率

<table><tr><td>阶段</td><td>典型学习率</td><td>备注</td></tr><tr><td>从零预训练</td><td>1e-4至3e-4</td><td>大模型、大批量</td></tr><tr><td>继续预训练</td><td>1e-5至1e-4</td><td>更小学习率以保留已有知识</td></tr><tr><td>SFT(监督微调)</td><td>1e-5至2e-5</td><td>标准区间</td></tr><tr><td>LoRA微调</td><td>1e-4至3e-4</td><td>适配器权重需用更高学习率</td></tr><tr><td colspan="3">(PPO、DPO、GRPO)请参见§11.15。</td></tr></table>

## 1.5.7 学习率预热（Warmup）

## 为何需要预热

训练开始时，v（二阶矩估计）被初始化为零。偏差校正后： $\hat { v } _ { t } = v _ { t } / ( 1 - \beta _ { 2 } ^ { t } ) _$ 。在 t = 1、 $\beta _ { 2 } = 0 . 9 9 9$ 时： $\hat { v } _ { 1 } = v _ { 1 } / ( 1 - 0 . 9 9 9 ) = 1 0 0 0 v _ { 1 }$ 。这意味着有效学习率是 $\eta / { \sqrt { 1 0 0 0 v _ { 1 } } }$ ，远小于预期。另一方面，如果第一步的梯度异常大（在初始化时常见），二阶矩估计会被这个离群值主导，导致早期更新极不稳定。预热（Warmup）通过从极小的学习率开始、逐步增大来缓解这一问题，让$v _ { t }$ 有时间积累一个可靠的估计。

- 线性预热： $\eta _ { t } = \eta _ { \mathrm { m a x } } \times t / T _ { \mathrm { w a r m u p } }$

- 典型预热时长：预训练为总步数的 1–5%；微调为 3–10%（更短的训练任务通常需要按比例更长的预热）

$\mathbf { S F T }$ 场景：通常预热 50–200 步

## 1.5.8 学习率调度策略

![](../images/9954bf19f25de97ac0012530cfd165290218cab0d496ad7c6dd6a90d5c279371.jpg)

![](../images/9a61a42821bce1e433d466075cc56068260b0200616f2c290a3185b20b87febf.jpg)

![](../images/06ad7ef4091925ae85fdd43fad12d273c9978a7a205c39f0a6e97c28fcbc60ad.jpg)

![](../images/2df3b2d58b125a3f7befcbcc3d7b8c1aac15b5b6852e31d601ba5c1d92289478.jpg)

![](../images/b48ff6b50a3dbadcf14aa079df12f42490c446efb23f89f3b2351802b66f68f3.jpg)  
*Figure 1.9: 常见学习率调度。所有调度都包含一个线性预热阶段。WSD（Warmup-Stable-Decay）正成为预训练的事实标准。*

(a) 恒定调度 $\mathbf { \Gamma } ( \mathbf { C o n s t a n t } ) _ { \circ }$ 最简单的调度。适合短期微调，以避免学习率过度衰减。风险在于：缺乏退火意味着模型可能无法收敛到最尖锐的最小值。

(b) 余弦衰减（Cosine Decay）。

$$
\eta_ {t} = \eta_ {\min} + \frac {1}{2} (\eta_ {\max} - \eta_ {\min}) \left(1 + \cos \left(\frac {t - T _ {\text { warmup }}}{T - T _ {\text { warmup }}} \pi\right)\right)
$$

预训练与 $\mathrm { S F T }$ 的标准选择。平滑衰减避免了学习率的突变。 $\eta _ { \mathrm { m i n } }$ 通常取 $\eta _ { \mathrm { m a x } } / 1 0 _ { \circ }$

(c) 线性衰减（Linear Decay）。 比余弦更简单，经验效果相近。当你希望任意步的学习率都可预测时优先选用。

(d) WSD — 预热-稳定-衰减（Warmup-Stable-Decay, WSD）。 大规模预训练的新标准 [118,150]。包含三个阶段：

1. 预热：线性升至 $\eta _ { \mathrm { m a x } }$ （占总步数的 1–5%）

2. 稳定：在训练的大部分时间保持恒定的 $\eta _ { \mathrm { m a x } }$

3. 衰减：以快速余弦或线性方式衰减到 $\eta _ { \mathrm { m i n } }$ （最后 10–20% 的步数）

核心优势在于：稳定阶段允许在任意时刻打 checkpoint 并继续训练；而衰减阶段可在任一训练任务结束时再施加。

(e) 带重启的余弦调度 — 带重启的随机梯度下降（Stochastic Gradient Descent with WarmRestarts, SGDR）。 周期性重启会将学习率重置为 $\eta _ { \mathrm { m a x } }$ ，有助于逃离局部极小值。在 LLM 中并不常用，更适合较小的模型。

## 1.5.9 梯度裁剪（Gradient Clipping）

## 梯度裁剪（Gradient Clipping）

当梯度的全局范数超过某阈值时，梯度裁剪会对其重新缩放：

$$
g _ {t} \leftarrow g _ {t} \cdot \min \biggl (1, \frac {\tau}{\| g _ {t} \| _ {2}} \biggr)
$$

其中 $\tau$ 是max_grad_norm（通常取1.0）。
## 梯度裁剪 vs. 降低学习率

梯度裁剪与降低学习率都能限制参数更新的幅度。区别在于：裁剪保留梯度的方向（只是缩放幅度），而较小的学习率会对所有更新一视同仁地缩放。裁剪更适合处理偶发的大梯度，同时不会拖慢正常训练步的速度。

## 综合实践：HuggingFace 优化器配置

下面的代码片段展示了本节中各概念——带解耦权重衰减的 AdamW（§1.6.6）、带线性预热的余弦学习率调度（§1.6.7）和梯度裁剪（§1.6.8）——如何借助 HuggingFace transformers 库在实践中结合起来。

```python
from transformers import TrainingArguments, Trainer
from transformers import get_cosine_schedule_with_warmup
import torch

# --- 方案 1：使用 TrainingArguments（推荐）---
training_args = TrainingArguments(
    output_dir="./checkpoints"

    # AdamW 优化器（解耦权重衰减，§1.6.6）
    optim="adamw_torch",
    learning_rate=2e-5,    # 预热后的峰值学习率
    adam_beta1=0.9,    # 一阶矩衰减
    adam_beta2=0.999,    # 二阶矩衰减
    adam_epsilon=1e-8,    # 数值稳定项
    weight_decay=0.01,    # 解耦 L2 惩罚
```

```python
# 学习率调度（§1.6.7）
lr_scheduler_type="cosine", # 余弦衰减至 0
warmup_ratio=0.1, # 10% 步数用于线性预热

# 梯度裁剪（§1.6.8）
max_grad_norm=1.0, # 按全局 L2 范数裁剪

# 混合精度（§1.6.9）
bf16=True, # 在 Ampere+ GPU 上使用 BFloat16

# 训练时长
num_train_epochs=3,
per_device_train_batch_size=8,
gradient_accumulation_steps=4, # 有效批量 = 8*4 = 32
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
)

trainer.train()

# --- 方案 2：手动控制（适用于自定义训练循环）---
from torch.optim import AdamW

# 权重衰减分组（不对 bias / norm 做正则化）
no_decay = ["bias", "LayerNorm.weight", "layernorm.weight"]
param_groups = [
    {
    "params": [p for n, p in model.named_parameters()
    if not any(nd in n for nd in no_decay)],
    "weight_decay": 0.01,
    },
    {
    "params": [p for n, p in model.named_parameters()
    if any(nd in n for nd in no_decay)],
    "weight_decay": 0.0,
    },
]

optimizer = AdamW(param_groups, lr=2e-5, betas=(0.9, 0.999))

# 带线性预热的余弦调度
total_steps = len(train_dataloader) * num_epochs
warmup_steps = int(0.1 * total_steps)
scheduler = get_cosine_schedule_with_warmup(
    optimizer,
    num_warmup_steps=warmup_steps,
    num_training_steps=total_steps,
)

# 带梯度裁剪的训练循环
for batch in train_dataloader:
    outputs = model(**batch)
    loss = outputs.loss
    loss.backward()

    # 在 optimizer.step() 之前裁剪梯度
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

    optimizer.step()
    scheduler.step()
    optimizer.zero_grad()

*Listing 1.4: 将 AdamW、余弦调度与梯度裁剪整合在一起的完整优化*
```

*Listing 1.4: 将 AdamW、余弦调度与梯度裁剪整合在一起的完整优化器配置。*

## 实践要点

- 权重衰减排除：bias 项和 LayerNorm 权重不应被正则化——它们参数很少，对其加正则反而损害性能 [238]。

- 预热比例：通常为总步数的 5–10%；预热不足配合高学习率会使早期训练不稳定。

- 梯度累积：在显存受限时模拟更大批量；裁剪作用于累积后的梯度。

- BF16 vs. FP16：在 Ampere+ GPU 上优先 bf16=True（更宽的动态范围可免去损失缩放）；老硬件回退到 $\mathtt { f p 1 6 = T r u e } _ { \mathtt { c } }$

## 1.5.10 混合精度训练（Mixed Precision Training）

BF16 vs. FP16

<table><tr><td>格式</td><td>指数位数</td><td>尾数位数</td><td>动态范围</td></tr><tr><td>FP32</td><td>8</td><td>23</td><td> $\sim 10^{-38}$  to  $10^{38}$ </td></tr><tr><td>BF16</td><td>8</td><td>7</td><td>与 FP32 相同(指数位相同)</td></tr><tr><td>FP16</td><td>5</td><td>10</td><td> $\sim 6 \times 10^{-5}$  to 65504</td></tr></table>

## 选 BF16 而不是 FP16：在 LLM 训练中范围比精度更重要

BF16 与 FP32 拥有相同的指数范围，能表示同样范围的数值（只是尾数精度更低）。FP16 的动态范围则小得多——超过 65504 的梯度或激活值会溢出（NaN/Inf）。这就是为什么 FP16 训练需要损失缩放（Loss Scaling）（把损失乘以一个大常数以让梯度保持在 FP16 范围内），而 BF16 训练通常不需要。A100 与 H100 原生支持 BF16；除非有特殊理由，否则请使用 BF16。

损失缩放（Loss Scaling，仅 FP16）。

1. 将损失乘以缩放因子 S（例如 $S = 2 ^ { 1 5 } )$

2. 用 FP16 计算梯度（梯度被 S 缩放）

3. 在 optimizer 步骤前将梯度除以 S

4. 检查溢出（NaN/Inf）；若发现则跳过该步并减小 S

5. 若连续 N 步未溢出，则增大 S

FP32 主权重（FP32 Master Weights）。 在混合精度训练中，权重以 FP32 形式保存（主副本），仅在前向/反向传播时转换为 $\mathrm { B F 1 6 / F P 1 6 } _ { \circ }$ 优化器步骤则在 FP32 下完成。这一点很重要，原因是：

- 很小的梯度更新 $( \Delta \theta \ll \theta )$ 在 BF16 精度下会丢失（7 位尾数 ≈ 0.8% 的相对精度）

- FP32 主权重可确保许多小更新在多步中的累积保持准确

- 显存代价：权重存储翻倍（FP32 + BF16 副本）

## 何时 FP32 主权重至关重要

FP32 主权重在以下情形下尤为重要：

- 长时间训练（大量微小梯度更新需要累积）

- 学习率较小（每次更新相对权重幅度极小）

对于学习率较大的短期 SFT，仅用 BF16（不保留 FP32 主权重）通常也能跑通且节省显存。但对于 RL 训练，FP32 主权重必不可少——参见 §11.15。

## 混合精度实战：HuggingFace

```python
# === HuggingFace TrainingArguments（最简方式） ===
from transformers import TrainingArguments

# Ampere+ GPU 上的 BF16（A100、H100、RTX 30xx/40xx）
args_bf16 = TrainingArguments(
    output_dir="./out",
    bf16=True,    # BF16 前向/反向；FP32 主权重
    bf16_full_eval=True,    # 评估时也使用 BF16
    # 无需 loss scaling — BF16 的范围已与 FP32 等价
)

# 老 GPU 上的 FP16（V100、T4、RTX 20xx）
args_fp16 = TrainingArguments(
    output_dir="./out",
    fp16=True,    # FP16 前向/反向
    fp16_full_eval=False,    # 评估仍用 FP32 以保证精度
    # 损失缩放由 PyTorch GradScaler 自动完成
)

# === 手写 PyTorch AMP（用于自定义训练循环） ===
import torch

# 初始化（PyTorch 2.x API）
use_fp16 = not torch.cuda.is_bf16_supported()
    scaler = torch.amp.GradScaler("cuda", enabled=use_fp16)  # 仅 FP16 需要
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5)
    dtype = torch.float16 if use_fp16 else torch.bfloat16

for batch in train_dataloader:
    optimizer.zero_grad()

    # autocast：以降精度执行前向
    with torch.autocast("cuda", dtype=dtype):
    outputs = model(**batch)
    loss = outputs.loss

    if use_fp16:
    # FP16 路径：缩放损失以防梯度下溢
    scaler.scale(loss).backward()
    scaler.unscale_(optimizer)    # 裁剪前先反缩放
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    scaler.step(optimizer)    # 溢出时会跳过 step
    scaler.update()    # 调整缩放因子
    else:
    # BF16 路径：无需缩放
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    optimizer.step()

    scheduler.step()
```  
*Listing 1.5: 使用 HuggingFace 与手写 PyTorch AMP 实现混合精度训练。*

!!! note
    代码层面 BF16 与 FP16 的关键差异
    - BF16: 只需用 autocast(dtype=torch.bfloat16) 包裹即可，无需 scaler。代码更简单，数值更稳定。
    - FP16: 需要 GradScaler 以防止梯度下溢。scaler 会动态调节乘子；若检测到溢出（NaN）就会跳过该 optimizer step 并降低缩放因子。
    - 梯度裁剪 + FP16: 必须在 clip_grad_norm_ 之前调用 scaler.unscale_(optimizer)，否则你裁剪的是被缩放后的梯度（阈值错误）。

- 显存节省：激活显存减半（激活值以 16-bit 存储）；权重显存取决于是否保留 FP32 主副本。

FP8 与 FP4：下一代训练精度。 DeepSeek-V3 [70] 证明：以 FP8（前向传播用 E4M3，反向传播用 E5M2）配合细粒度逐 tile 缩放训练 671B 参数模型，相对 BF16 仅损失不到 0.25%——而总训练成本约为 \$5.6M。关键技术包括：用随机舍入（stochastic rounding）降低量化偏差、让缩放因子逐 tile 适应局部激活幅度，以及在量化敏感度最高的首尾层保持更高精度。NVIDIA 的 Nemotron 3更进一步，采用 NVFP4（4-bit），通过在大约 15% 的层上维持 BF16，在超过 25T 训练 token 上证明了稳定性。其经济含义极为深远：精心的精度工程能把前沿训练成本降低 3–5×，让数十亿参数的训练不再只是最大实验室的专利。

## 1.5.11 各训练阶段的优化器配置实践

<table><tr><td colspan="6">优化器超参数参考表</td></tr><tr><td>阶段</td><td>优化器</td><td>学习率</td><td>权重衰减</td><td>预热</td><td>调度</td></tr><tr><td>预训练</td><td>AdamW</td><td>3e-4</td><td>0.1</td><td>2000步</td><td>WSD或Cosine</td></tr><tr><td>SFT</td><td>AdamW</td><td>2e-5</td><td>0.01</td><td>100步</td><td>Cosine</td></tr><tr><td>LoRA SFT</td><td>AdamW</td><td>2e-4</td><td>0.01</td><td>100步</td><td>Cosine</td></tr><tr><td colspan="6">以上均使用: $\beta_1=0.9$ 、 $\beta_2=0.95$ 、 $\epsilon=10^{-8}$ 、max_grad_norm=1.0、BF16。RL相关设置参见§11.15。</td></tr></table>

## 诊断训练不稳定

```python
# 监控以下指标以诊断优化器问题：
# 1. 梯度范数 — 大多数时候应 < max_grad_norm
# 2. 损失缩放因子（FP16）——应稳定，不应持续减小
# 3. 参数更新范数 — 应远小于参数自身的范数

import torch

def log_optimizer_stats(model, optimizer, step):
    # 梯度范数（裁剪前）
    total_norm = 0.0
    for p in model.parameters():
    if p.grad is not None:
    total_norm += p.grad.data.norm(2).item() ** 2
    total_norm = total_norm ** 0.5

    # Adam 二阶矩统计（自适应学习率的代理指标）
    v_norms = []
    for group in optimizer.param_groups:
    for p in group['params']:
    state = optimizer.state[p]
    if 'exp_avg_sq' in state:
    v_norms.append(state['exp_avg_sq'].mean().item())

    print(f"Step {step}: grad_norm={total_norm:.3f}, "
    f"mean_v={sum(v_norms)/len(v_norms):.6f}")

# 红色警报：
# grad_norm 反复 >> 1.0 — 降低学习率或加长预热
# grad_norm == 0.0 — 梯度消失或 loss 写错
# loss_scale 持续下降 — FP16 溢出，改用 BF16
# v 非常小 — Adam 还没预热完，加长预热
```

## 学习率是最重要的超参数

实践中，把学习率调对比任何其他超参数都重要。LLM 微调的经验法则：

- 从上表中的取值开始

!!! note
    - 若损失发散（初始下降后又上升）：学习率过高
    - 若损失下降极慢且过早进入平台期：学习率过低
    - 若损失不稳定（震荡）：学习率过高或预热过短
    第二重要的超参数是批大小（通过线性缩放规则影响梯度噪声和有效学习率）。其他都是次要的。

## 1.6 FlashAttention——算法与硬件感知

FlashAttention [64, 65] 是自 Transformer 本身以来深度学习领域最具影响力的算法创新之 $\mathit { \Pi } _ { \circ } ^ { - \bullet }$ 它不改变 Attention 的数学结果——计算出的输出与原始 Attention 完全相同——但它重构了内存访问模$\mathbb { \vec { x } } \mathbb { \hat { \Phi } } ,$ ，让 GPU 上容量有限的高速 SRAM 承担所有重活，从而将高带宽内存（HBM）占用从 $O ( n ^ { 2 } )$ 降至 $O ( n )$ ，并在典型工作负载上带来 2–4× 的端到端实际墙钟时间加速。

## 1.6.1 标准 Attention 的内存问题

标准的缩放点积 Attention 为：

$$
\operatorname{Attention} (Q, K, V) = \operatorname{softmax} \left(\frac {Q K ^ {T}}{\sqrt {d _ {k}}}\right) V
$$

标准 Attention 的内存复杂度

对于序列长度 n 和头维度 d:
- $Q, K, V \in R^{n \times d}$ :  $O(nd)$  内存
- $S = QK^{T} \in R^{n \times n}$ :  $O(n^{2})$  内存——瓶颈所在
- $P = \text{softmax}(S) \in \mathbb{R}^{n \times n}$ : 又一个  $O(n^{2})$ 
- $O = PV \in R^{n \times d}$ :  $O(nd)$ 

在 n = 8192、d = 128、BF16 条件下：仅 Attention 矩阵本身就达到  $8192^{2} \times 2 \approx 134$  MB 每头。若有 32 个头，单单一层的 Attention 分数就要占用 4.3 GB。

为什么  $O(n^{2})$  是灾难性的

Attention 矩阵必须写入 HBM（对长序列而言它放不进 SRAM），随后再读出来做 Softmax，然后再读一次用于 PV 乘法。每一次 HBM 往返都很慢。当 n = 32768（32K 上下文）时，Attention 矩阵达  $32768^{2} \times 2 \approx 2$  GB 每头——完全无法存储。
## 1.6.2 FlashAttention 的核心洞察——分块（ $\bf ( T i l i n g )$ ）与在线 Softmax（Online Softmax）

核心洞察是：我们从不需要把完整的 $n \times n$ 矩阵一次性放入内存。如果使用在线 Softmax 技巧，就可以按块逐步计算输出 $O _ { \circ }$

在线 Softmax（Online Softmax）。 回想一下，为了数值稳定性，Softmax 需要一个全局最大值：

$$
\operatorname{softmax} (x _ {i}) = \frac {e ^ {x _ {i} - m}}{\sum_ {j} e ^ {x _ {j} - m}}, \quad m = \max _ {j} x _ {j}
$$

诀窍在于：我们可以在处理新块时更新运行中的最大值和归一化因子，而无需在任何时刻物化整行。

## 在线 Softmax 更新规则

$$
(m _ {\mathrm{old}}, \ell_ {\mathrm{old}}, O _ {\mathrm{old}})
$$

$$
s _ {\mathrm{new}}
$$

1.  $m_{\mathrm{new}} = \max(m_{\mathrm{old}}, \max(s_{\mathrm{new}}))$ 
2.  $\ell_{new} = e^{m_{old} - m_{new}} \cdot \ell_{old} + \sum_{j} e^{s_{new,j} - m_{new}}$ 
3.  $O_{new} = \frac{1}{\ell_{new}} (e^{m_{old} - m_{new}} \cdot \ell_{old} \cdot O_{old} + e^{s_{new} - m_{new}} \cdot V_{new})$ 
这在数学上等价于一次性对所有块计算 Softmax。
## 1.6.3 FlashAttention 算法

FlashAttention 前向传播——分块（Block Tiling）

设定：SRAM 大小 M。块大小  $B_{r} = \lceil M/(4d) \rceil, B_{c} = \min(\lceil M/(4d) \rceil, d)$ 。

1. 将 Q 划分为  $T_{r} = \lceil n/B_{r} \rceil$  块  $Q_{1}, \ldots, Q_{T_{r}}$ 

2. 将 K, V 划分为  $T_{c} = \lceil n/B_{c} \rceil$  块  $K_{1}, \ldots, K_{T_{c}}$ 

3. 初始化输出  $O \in R^{n \times d}$ 、运行最大值  $m \in R^{n}$ 、运行求和  $\ell \in R^{n}$ （均在 HBM 中）

4. 对  $j = 1, \ldots, T_{c}$  进行外循环：

(a) 将  $K_{j}, V_{j}$  从 HBM 加载到 SRAM

(b) 对  $i = 1, \ldots, T_{r}$  进行内循环：

i. 将  $Q_{i}, O_{i}, m_{i}, \ell_{i}$  从 HBM 加载到 SRAM

ii. 计算  $S_{ij} = Q_{i} K_{j}^{T} / \sqrt{d}$ （保留在 SRAM 中）

iii. 应用在线 Softmax 更新得到新的  $m_{i}, \ell_{i}, O_{i}$ 

iv. 将  $O_{i}, m_{i}, \ell_{i}$  写回 HBM

5. 返回 O

关键： $S_{ij}$ （Attention 块）在 SRAM 中计算并丢弃。它从不写入 HBM。
<table><tr><td colspan="3">FlashAttention 复杂度</td></tr><tr><td></td><td>标准 Attention</td><td>FlashAttention</td></tr><tr><td>内存(HBM)</td><td> $O(n^{2})$ </td><td> $O(n)$ </td></tr><tr><td>HBM 读写量</td><td> $O(n^{2}d)$ </td><td> $O(n^{2}d/M)$ </td></tr><tr><td>FLOPs</td><td> $O(n^{2}d)$ </td><td> $O(n^{2}d)$ (相同)</td></tr><tr><td>加速比</td><td>1×</td><td>2-4×</td></tr></table>

## 1.6.4 FlashAttention 2——更好的并行性

FlashAttention 2 [64] 做出了三项关键改进：

1. 减少非矩阵乘法 FLOPs：原版 FA 在内循环中存在不必要的重缩放操作。FA2 重构循环以最小化这些操作。在 A100 上，Tensor Core 矩阵乘法比标量运算快约 16×，因此即便内循环中只有少量非矩阵乘法工作，也会成为延迟瓶颈。

2. 序列维度上更好的并行性： FA1 仅在 batch 和 head 上并行。FA2 还在 query 序列维度上并行，使长序列、小批量场景下的 GPU 利用率显著提升。

3. 因果掩码优化：对于自回归（因果）Attention，大约一半的块是完全被掩码的。FA2 完全跳过这些块，相对于双向 Attention 带来约 2× 的加速。

## 1.6.5 FlashAttention 3——Hopper 架构

FlashAttention 3 [322] 专为 H100 设计，并利用了三项 Hopper 特有的特性：

- TMA（Tensor Memory Accelerator，张量内存加速器）： H100 有一个专用硬件单元用于在 HBM 和 SRAM 之间进行异步批量数据搬移。FA3 利用 TMA 让数据加载与计算重叠，从而隐藏内存延迟。

- Warp 专用化（Warp-specialization）： FA3 给不同的 warp 分配不同角色（生产者 warp通过 TMA 加载数据；消费者 warp 计算 MMA）。这是一种软件流水线技术，使内存系统和Tensor Core 同时保持繁忙。

- FP8 支持： H100 以 BF16 两倍的吞吐量支持 FP8（E4M3/E5M2）Tensor Core 运算。FA3支持 FP8 Attention，并通过逐块量化来保持精度。

FA3 在 FP16 Attention 上可达 H100 理论峰值的 75%，相比之下 FA2 约为 35%。

## 1.6.6 FlashAttention 4——Blackwell 架构

FlashAttention 4 [415] 面向 NVIDIA 的 Blackwell GPU（B200/GB200），这类 GPU 将 Tensor Core吞吐量提高到 2.25 PFLOP/s（BF16），但非矩阵乘法单元（指数运算、共享内存带宽）的扩展速度较慢。这种非对称的硬件扩展意味着瓶颈发生了转移：在 Blackwell 上，Attention 的限制因素不再是矩阵乘法，而是 Softmax 指数运算以及围绕它们的共享内存流量。

FA4 通过四项关键技术来应对这一问题：

- 完全异步的 MMA 流水线：Blackwell 的 MMA 指令是完全异步的（不像 Hopper 的 wgmma仍会阻塞等待完成）。FA4 重新设计了流水线，在更大的分块尺寸上让 MMA、TMA 加载和Softmax 重缩放相互重叠，使所有硬件单元保持饱和。

- 软件模拟指数运算：FA4 不调用硬件的 ex2 单元（吞吐量瓶颈），而是用多项式近似在快得多的 Tensor Core 上模拟 e<sup>x</sup>。这相当于用额外的矩阵乘法指令换取消除指数单元的停顿。

- 条件式 Softmax 重缩放：标准 FlashAttention 每个分块都会重缩放运行 max。FA4 在新分块的最大值不超过当前运行最大值时（实际中很常见）跳过重缩放，从而节省寄存器搬移和同步屏障。

- Tensor Memory + 2-CTA MMA 模式（反向传播）：反向传播使用 Blackwell 的张量内存（Tensor Memory）（一种比共享内存更大的、每 SM 私有的暂存区）以及 2-CTA 协作模式，在两个线程块簇之间融合 dQ 累加，使共享内存往返次数减半。

## FA4 实现：CuTe-DSL

FA4 是首个用 CuTe-DSL 编写的 FlashAttention 版本，CuTe-DSL 是一种嵌入在 Python 中、面向 GPU 内核的领域特定语言（CUTLASS 4.x 的一部分）。CuTe-DSL 的编译速度比 C++CUTLASS 模板快 20–30×，同时保留对寄存器分配和流水线调度的完全控制。这显著缩短了内核开发的迭代时间。

结果。 在 B200 上，BF16、head 维度 128（因果，序列长度 8K）：

- 1613 TFLOP/s——达到 Blackwell 峰值利用率的 71%

- 比 cuDNN 9.13（NVIDIA 的专有融合内核）快 1.3×

- 在同一硬件上比 Triton 快 2.7×

## 软硬件协同演化

FlashAttention 系列体现了一条关键原则：每一代 GPU 都会让瓶颈发生转移，因此需要新的算法思想而不仅是重新编译。A80 → 内存带宽受限（FA1/FA2：分块 + 重计算）。H100 → 数据搬移受限（FA3：TMA + warp 专用化）。B200 → 非矩阵乘法计算受限（FA4：软件模拟 exp + 条件式重缩放）。理解硬件瓶颈究竟在哪是编写高效内核的前提。

## 1.7 预训练：最佳实践

预训练是 LLM 开发中代价最高的阶段——消耗数百万 GPU 小时，需要对数据、算力和超参数进行精心编排。本节提炼 Llama-3 [118]、Chinchilla [140] 和 GPT-4 [274] 的关键经验。

## 1.7.1 训练目标

所有现代仅解码器 LLM 都使用因果语言建模（Causal Language Modeling，CLM）：

$$
\mathcal {L} _ {\mathrm{CLM}} = - \frac {1}{T} \sum_ {t = 1} ^ {T} \log P _ {\theta} (x _ {t} \mid x _ {<   t})
$$

这个简单的目标——在足够的数据和规模下——无需显式监督就能产生涌现能力（上下文学习、推理、指令遵循） [32]。

## 1.7.2 数据流水线

## 预训练数据配方

- 规模：前沿模型为 1–15 万亿 Token（Llama-3：15T Token）

- 来源：网页抓取（80%）、代码（10%）、书籍/论文（5%）、精选数据（5%）

- 去重：MinHash + 精确子串去重可降低记忆化 [203]

- 质量过滤：基于困惑度的分类器、启发式过滤器（长度、语种识别、毒性）

- 数据混合：跨域温度加权采样；为推理能力提升代码与数学的权重

## 1.7.3 扩展律

Hofmann 等 [140] 表明，算力最优的训练需要平衡模型大小 N 和数据大小 $D \colon \ N _ { \mathrm { o p t } } \ \propto \ C ^ { 0 . 5 0 } .$ $D _ { \mathrm { o p t } } \propto C ^ { 0 . 5 0 }$ 。70B 模型的算力最优点约在 1.4T Token。实际中，模型通常被过训练（Token 数超过 Chinchilla 最优值），因为推理成本随模型大小而非训练 Token 数扩展——较小的过训练模型部署成本更低。

## 1.7.4 关键超参数

Table 1.10: 已发表模型的预训练超参数。

<table><tr><td>设置</td><td>Llama-3 405B</td><td>Llama-3 8B</td><td>Qwen-2.5 72B</td><td>Mistral 7B</td></tr><tr><td>Token 数</td><td>15T</td><td>15T</td><td>18T</td><td>8T</td></tr><tr><td>批大小 (Token)</td><td>16M</td><td>4M</td><td>4M</td><td>4M</td></tr><tr><td>峰值学习率</td><td>8e-5</td><td>3e-4</td><td>3e-4</td><td>3e-4</td></tr><tr><td>调度策略</td><td>WSD</td><td>WSD</td><td>Cosine</td><td>Cosine</td></tr><tr><td>权重衰减</td><td>0.1</td><td>0.1</td><td>0.1</td><td>0.1</td></tr><tr><td>上下文长度</td><td>8192</td><td>8192</td><td>4096→32K</td><td>8192</td></tr></table>

## 1.7.5 常见失败模式

## 预训练陷阱

- 损失尖峰：由坏数据批次或数值不稳定引发的损失突增。Llama-3 报告通过回滚检查点并跳过问题批次来处理。

- 记忆化：模型逐字复述训练数据。修复：激进去重；监控抽取攻击。

- 上下文长度：在短序列上训练却部署到长上下文会失败。应在长文档上做继续预训练 +RoPE 缩放。

## 1.7.6 中期训练：为强化学习做准备

在原始预训练与后训练之间，一个新的流水线阶段已经浮现。中期训练（Mid-training）（有时也叫“继续预训练（continued pretraining）”或“退火（annealing）”）在高质量精选数据上提高 STEM、数学与代码的权重，同时把上下文长度扩展到 128K–256K token。它的目的不是传授新知识，而是让模型为 RL 做好准备：植入验证、回溯、子目标分解这些认知行为，供之后的强化学习放大。

中期训练决定 RL 就绪度

OctoThinker [236] 证明：中期训练的数据构成决定了 base 模型是否会对 RL 产生响应。同一套GRPO 配方在 Qwen（其中期训练富含推理内容）上带来了显著的推理提升，在 Llama（缺少此类内容）上却完全失败。差异不在模型大小或架构——而在于 base 模型是否已经展现出 RL 可以强化的自我纠正行为。

典型的中期训练使用 100B–500B token 的精选高质量数据，搭配余弦衰减的学习率。Llama 3 的“退火尾巴（annealing tail）”、MiMo 的三阶段混合（把数学 + 代码提高到 70%），以及 MAI-Thinking-1对 STEM 的显式加权，都是这一模式的实例。

## 1.8 监督微调（Supervised Fine-Tuning，SFT）

SFT 通过在精选的「提示——回复」对上训练，将预训练语言模型转化为指令遵循助手。它是从原始语言建模到 RLHF 的桥梁。

## 1.8.1 SFT 目标

损失与 CLM 相同，但只在回复 Token 上计算：

$$
\mathcal {L} _ {\mathrm{SFT}} = - \frac {1}{| y |} \sum_ {t = 1} ^ {| y |} \log P _ {\theta} (y _ {t} | x _ {\mathrm{prompt}}, y _ {<   t})
$$

提示 Token 提供上下文但不接收梯度（标签设为 −100）。

## 1.8.2 数据质量：LIMA 原则

Zhou 等 [439] 证明，1,000 个精心策划的样例可以匹敌在 50K+ 嘈杂样例上训练的模型。关键要求：

- 多样性：涵盖问答、摘要、代码、数学、创意写作、多轮对话

- 正确性：每条回复必须事实准确且格式良好

- 长度平衡：混合短（单句）和长（多段落）回复

- 去污染：移除与评估基准的重叠

## 1.8.3 训练配置

```python
from trl import SFTTrainer, SFTConfig

sft_config = SFTConfig(
    output_dir="./sft_output",
    max_seq_length=4096,
    packing=True, # 将多个短样例打包进完整序列
    learning_rate=2e-5,
    lr_scheduler_type="cosine",
    warmup_ratio=0.1,
    weight_decay=0.01,
    max_grad_norm=1.0,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,
    bf16=True,
    gradient_checkpointing=True,
)

trainer = SFTTrainer(model=model, args=sft_config,
    train_dataset=dataset, processing_class=tokenizer)
trainer.train()
```

## 1.8.4 高效训练方案

标准的 HuggingFace 训练存在显著的性能浪费。多个库为 SFT 工作负载提供了即插即用的效率提升：

Liger Kernel [145]。 LinkedIn 开源的一组 Triton 融合内核，在训练时替换标准的 PyTorch 算子。关键融合包括：

- 融合交叉熵：将最后的线性投影、Softmax 和损失计算合并为单个内核——避免物化完整的(batch × seq × vocab) logit 张量。

- 融合 RMSNorm / SwiGLU / RoPE：消除常见 LLM 构建块的中间内存分配。

- 分块操作：将大张量按块处理，从而限制峰值内存。

效果：仅需一行集成代码（apply\_liger\_kernel\_to\_llama()）即可获得 20% 的吞吐量提升和最高 60% 的内存降低。兼容 FSDP、DeepSpeed 和 LoRA。

Unsloth [132]。 一个专注于微调的库，将自定义 CUDA/Triton 内核与激进的内存优化相结合：

- 对 LoRA 层进行手工反向传播（避免 autograd 开销）。

- 带融合反量化的 4-bit QLoRA——在单张 48 GB GPU 上训练 70B 模型。

- 针对每种架构（Llama、Mistral、Qwen、Gemma）的智能 RoPE 与 Attention 内核融合。

效果：比原版 HuggingFace + PEFT 快 2–5×，显存占用降低 60–70%。对单 GPU 与消费级硬件工作流尤为重要。

torchtune [349]。 Meta 的原生 PyTorch 微调库（2025 年开发逐步收尾），其设计围绕可组合性而非单体抽象：

- 纯 PyTorch——没有 trainer 类；配方（recipe）是可读的单文件脚本。

- 与 torch.compile、FSDP2 以及激活检查点的原生集成。

- 对 QLoRA、全量微调与知识蒸馏的一等支持。

- 内置量化感知训练（QAT），用于训练后压缩。

效果：速度与自定义方案相当，但具备完整的可调试性，无框架锁定。

## 选择效率栈

!!! note
    - 单 GPU（≤1 GPU）上的快速 LoRA/QLoRA：Unsloth（训练上手最快，配置最少）
    - 多 GPU 全量微调：TRL/DeepSpeed + Liger Kernel（大规模下的最佳吞吐）
    - 研究 / 自定义训练循环：torchtune（透明、可改造、原生 PyTorch）
    它们是互补的：Liger 内核可同时在 TRL 和 torchtune 工作流中使用。

## 1.8.5 最佳实践

Table 1.11: SFT 训练指南。

<table><tr><td>实践</td><td>细节</td></tr><tr><td>打包(Packing)</td><td>将多个短样例拼接为一个序列(用 EOS 分隔)。避免填充浪费。</td></tr><tr><td>NEFTune [159]</td><td>在 Embedding 上添加均匀噪声 (α = 5)。零代价提升 MT-Bench 5-15%。</td></tr><tr><td>对话模板</td><td>始终使用模型原生模板。模板不匹配会降低质量。</td></tr><tr><td>Epoch 数</td><td>大数据集 2-3 个;小型(<10K)精选集最多 5 个。过训练会导致格式记忆化。</td></tr></table>

## SFT 还不够

SFT 能教会格式和基础的指令遵循，但难以可靠地教会：偏好（哪一个回复更好——需要 RLHF/DPO）、拒绝（何时不该回答——需要安全训练）、校准（说「我不知道」——需要带真实性奖励的RL）、或复杂推理（多步推理链——需要带可验证奖励的 RL）。完整流水线是：Pretrain → SFT→ RLHF/DPO。

## 1.9 LoRA 与参数高效微调

对 70B 模型进行全量微调需要存储 70B 可训练参数及其优化器状态（560+ GB 内存）。低秩适配（Low-Rank Adaptation，LoRA） [146] 提供了一种仅用 <1% 参数即可微调、并达到相当质量的方法。

## 1.9.1 LoRA 的核心洞察

## LoRA 核心思想

不更新完整的权重矩阵 $W \in \mathbb { R } ^ { d \times d }$ ，而是学习一个低秩扰动：

$$
W ^ {\prime} = W + \frac {\alpha}{r} \cdot B A, \quad B \in \mathbb {R} ^ {d \times r}, A \in \mathbb {R} ^ {r \times d}
$$

- $W$ 被冻结（无梯度，无优化器状态）

- 只训练 B 和 $A \colon 2 \times d \times r$ 参数而非 $d ^ { 2 }$

- 在秩 $r = 1 6 , \ d = 4 0 9 6$ 时：LoRA 每层新增 $2 \times 4 0 9 6 \times 1 6 = 1 3 1 K$ 参数，而完整矩阵为16.8M

- $\alpha / r$ 缩放因子控制更新的幅度

## 低秩为何有效

Aghajanyan 等 [3] 表明，微调发生在一个非常低维的子空间——微调任务的「内在维度（intrinsicdimensionality）」远小于模型的参数量。一个 175B 模型的微调任务内在维度可能 <10,000。LoRA直接利用了这一点：秩 r 把每个权重矩阵的更新约束在 r 维子空间内。

## LoRA: Low-Rank Decomposition of Weight Update

![](../images/58903695b5a657b76e96594f771c5e050ff8a6bb485d9c19ea9d80755a6f3079.jpg)

*Figure 1.10: LoRA 将权重更新 $\Delta W$ 分解为两个小矩阵 $B \times A _ { \circ }$ 原始权重 W 保持冻结；只有 B 和 A 接收梯度。推理时，乘积 BA 可以零开销地合并到 W 中。*

## 为什么 α/r 缩放很重要

如果不做缩放，将秩 翻倍大约会让 $\Delta W = B A$ 的幅度翻倍（B 中更多列参与求和）。这意味着改变秩也会改变模型被扰动的幅度——你每次调整 r 都得重新调学习率。$\alpha / r$ 因子对更新幅度进行归一化，使其无论秩为多少都大致保持恒定：

$$
W ^ {\prime} = W + \frac {\alpha}{r} \cdot B A
$$

- 固定 $\alpha ,$ ，扫描 $r \colon$ 有效更新幅度无论秩为何都保持在 $\sim \alpha$ 附近。可以尝试 $r \in \{ 8 , 1 6 , 3 2 , 6 4 \}$ 而无需重新调学习率。

- 常见做法：设 $\alpha = r$ （即 $\alpha / r = 1 )$ ）或 $\alpha = 2 r$ （即 $\alpha / r = 2 )$ ）。这是缩放因子为小整数的便捷默认。

- 为什么不直接调 LR？可以，但 $\alpha / r$ 提供了一个与秩无关的旋钮。团队可以在不同秩的实验间共享 LR 配方。

- rsLoRA 洞察 [176]：在高秩 $\left( r \geq 6 4 \right)$ 下，经验证据表明 $\alpha / \sqrt { r }$ 比 $\alpha / r$ 更稳定，因为 $B A$ 的方差按 $\sqrt { r }$ 而非 r 缩放。

## 1.9.2 LoRA 超参数

正确选择 LoRA 超参数至关重要——错误的秩或 alpha 要么欠拟合（约束过强），要么浪费内存（表达力过剩）。

## 秩选择经验法则

- $\mathbf { r } { = } 8 $ 简单任务（单领域聊天、分类）。非常省内存。

- $\mathbf { r } { = } \mathbf { 1 6 } \colon$ ：通用微调。良好的默认值。

- $\mathbf { r = 3 2 - 6 4 } \mathbf { : }$ ：复杂任务（数学、代码、多轮推理）。接近全量微调质量。

Table 1.12: LoRA 超参数指南。

<table><tr><td>超参数</td><td>典型值</td><td>建议</td></tr><tr><td>r(秩)</td><td>8,16,32,64</td><td>更高=更大容量但更多内存。从16开始。</td></tr><tr><td>lora_alpha</td><td>16,32(通常=r或2r)</td><td>通过α/r缩放控制更新幅度。</td></tr><tr><td>target_modules</td><td>q_proj,k_proj,v_proj,o_proj</td><td>所有Attention投影。添加gate_proj,up_proj,down_proj以实现完整覆盖。</td></tr><tr><td>lora_dropout</td><td>0.0-0.1</td><td>正则化。小数据集通常用0.05。</td></tr><tr><td>bias</td><td>&quot;none&quot;</td><td>训练偏置项新增参数极少但很少有帮助。</td></tr><tr><td>学习率</td><td>1e-4到3e-4</td><td>高于全量微调(只更新适配器)。</td></tr><tr><td colspan="3">·r=128+:收益递减;考虑全量微调或更高秩的QLoRA。·关键指标:若训练损失明显高于全量微调损失而停滞不前,则增大秩。</td></tr></table>

## 1.9.3 LoRA 变体

Table 1.13: LoRA 变体及其创新。

<table><tr><td>方法</td><td>关键创新</td><td>适用场景</td></tr><tr><td>QLoRA [75]</td><td>4-bit 量化基座 + BF16 的 LoRA。NF4 数据类型 + 双重量化。</td><td>在单张 48GB GPU 上微调 70B。</td></tr><tr><td>DoRA [228]</td><td>将 W 分解为幅度与方向;LoRA 只更新方向。</td><td>推理任务的泛化更好。</td></tr><tr><td>LoRA+ [136]</td><td>为 A/B 使用不同的 LR。</td><td>免费的 2% 提升;无额外成本。</td></tr><tr><td>AdaLoRA [424]</td><td>跨层动态秩预算(基于 SVD 的重要性)。</td><td>算力预算非常紧张时。</td></tr><tr><td>rsLoRA [176]</td><td>用 α/√r 而非 α/r 缩放。在高秩下稳定。</td><td>使用 r ≥ 64 时。</td></tr><tr><td>VeRA [190]</td><td>共享冻结的随机 A, B;只训练对角缩放。</td><td>极致的参数效率。</td></tr><tr><td>LoRA-FA</td><td>初始化后冻结 A;只训练 B。将 LoRA 内存减半。</td><td>内存受限场景。</td></tr></table>

## 关键扩展详解

DoRA——权重分解低秩适配（Weight-Decomposed Low-Rank Adaptation，DoRA）。DoRA [228] 观察到，全量微调倾向于改变权重向量的方向多于幅度。标准 LoRA 把二者混在一起。DoRA 将每个权重列分解为幅度 $m = \| W \| _ { \mathrm { c o l } }$ 和方向 $\hat { V } = W / \| W \| _ { \mathrm { c o l } }$ ，然后只对方向应用LoRA：

$$
W ^ {\prime} = m \odot \hat {V} ^ {\prime}, \quad \hat {V} ^ {\prime} = \frac {W + B A}{\| W + B A \| _ {\mathrm{col}}}
$$

幅度 $m$ 是单独的可学习向量（每列一个标量）。它在推理与指令遵循基准上始终比 LoRA 高 1–3%，且无额外推理成本（部署时合并）。

LoRA+——非对称学习率。 Hayou 等 [136] 表明，LoRA 中的矩阵 A 和 B 拥有不同的最优学习率。由于 B 初始化为零，它与从 $\mathcal { N } ( 0 , \sigma ^ { 2 } )$ 初始化的 A 处于截然不同的状态。设置 $\eta _ { B } \approx 1 6 \times \eta _ { A }$ 可提升收敛速度并将最终质量提高约 2%——一个仅需一行配置改动的免费收益：

```json
# PEFT 中的 LoRA+：为每个矩阵设置不同的学习率
optimizer_grouped_parameters = [
    {"params": [p for n, p in model.named_parameters() if "lora_B" in n], "lr": 2e-4 * 16}, # B 矩阵：更高的学习率
    {"params": [p for n, p in model.named_parameters() if "lora_A" in n], "lr": 2e-4}, # A 矩阵：基础学习率
]
```

VeRA——基于向量的随机矩阵适配（Vector-based Random Matrix Adaptation，VeRA）。VeRA [190] 把参数效率推向极致：它不学习 A 和 B，而是将它们冻结为所有层之间共享的随机矩阵，仅训练两个对角缩放向量 $d _ { b } \in \mathbb { R } ^ { r }$ 和 $d _ { a } \in \mathbb { R } ^ { d }$

$$
\Delta W = B \cdot \mathrm{diag} (d _ {b}) \cdot A \cdot \mathrm{diag} (d _ {a})
$$

这相比 LoRA 将可训练参数减少约 10×（每层只有 r +d 个参数），同时达到 LoRA 90–95% 的质量。最适合需要数百个任务专用适配器、且存储极小化的场景。

!!! note
    QLoRA 内存节省
    70B 模型全量微调：140 GB（权重）+ 280 GB（优化器）+ 140 GB（梯度）= 560 GB（7× A100-80GB）。
    70B QLoRA (r=16，所有线性层)：
    • NF4 格式的基座模型：70B × 0.5 = 35 GB
    • BF16 格式的 LoRA 适配器：~160 MB
    • 优化器状态（仅适配器）：~320 MB
    • 激活值（梯度检查点）：~8 GB
    • 总计：~44 GB——可装入单张 48GB GPU!

```python
# 使用 PEFT 的 QLoRA 配置
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import BitsAndBytesConfig
import torch

# 4-bit 量化配置
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",    # NormalFloat4 - 对权重最优
    bnb_4bit_compute_dtype=torch.bfloat16,  # 计算使用 BF16
    bnb_4bit_use_double_quant=True,    # 对量化常数再次量化
)

# LoRA 配置
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,    # alpha/r = 2 倍缩放
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = prepare_model_for_kbit_training(model)  # 为 QLoRA 做准备
model = get_peft_model(model, lora_config)  # 添加 LoRA 适配器
```

!!! note
    model.print_trainable_parameters()
    # 输出：trainable params: 83,886,080 || all params: 70,553,706,496 || 0.12%

## 1.9.4 其他 PEFT 方法

LoRA 主导了现代实践，但并非唯一的参数高效方法。为完整起见，列出主要的替代方案：

Table 1.14: 参数高效微调（Parameter-Eficient Fine-Tuning，PEFT）方法家族。LoRA 是 LLM 微调的事实标准；其余方法列在此处用于历史背景和小众使用场景。

<table><tr><td>方法</td><td>机制</td><td>优点/缺点</td><td>现状</td></tr><tr><td>LoRA [146](及变体)</td><td>在现有权重上添加低秩矩阵</td><td>推理时可合并(零开销);支持完善;适用于所有架构</td><td>标准</td></tr><tr><td>Adapters [144]</td><td>在层之间插入小型瓶颈MLP</td><td>模块化;可堆叠;增加推理延迟(额外的串行层)</td><td>很少使用</td></tr><tr><td>前缀微调[211]</td><td>在每层K/V前拼接可学习的「虚拟Token」</td><td>不修改权重;对生成任务有效;占用上下文长度</td><td>小众</td></tr><tr><td>提示微调[204]</td><td>在输入前拼接可学习的软提示Embedding</td><td>参数极少(<0.01%);复杂任务上弱于LoRA</td><td>小众</td></tr><tr><td>IA3 [222]</td><td>用学到的向量对K、V和FFN激活进行重缩放</td><td>参数比LoRA更少;可合并;容量有限</td><td>已弃用</td></tr><tr><td>BitFit [417]</td><td>只训练偏置项</td><td>参数接近于零;在简单任务上意外有效;表达力有限</td><td>历史方法</td></tr></table>

## 为什么 LoRA 胜出

LoRA成为标准是因为它独特地兼具：(1)零推理开销——适配器可合并入基座权重，不像Adapters或前缀微调会增加延迟或消耗上下文；(2) 可组合性——多个 LoRA 适配器可在服务时切换，用于多租户部署；(3) 生态支持——HuggingFace PEFT、TRL、vLLM 以及所有主流框架都对 LoRA有一等支持；(4) 大规模验证——Meta、Google 以及 HuggingFace 上大多数开源微调都在生产中使用。除非你有 LoRA 无法满足的特定约束，否则它应当是你的默认选择。

## 1.10 专家混合模型（Mixture of Experts，MoE）

专家混合模型 [166, 325] 通过对每个 Token 只激活参数的一个子集，从而在不按比例增加计算成本的情况下扩展模型容量。

## 1.10.1 架构

## MoE 层

在一个 MoE Transformer 中，每个块中的 FFN 层被替换为 N 个并行的“专家”FFN，再加上一个路由器（router）来选择使用哪些专家：

$$
\operatorname{MoE} (x) = \sum_ {i = 1} ^ {N} g _ {i} (x) \cdot E _ {i} (x), \quad g (x) = \operatorname{TopK} (\operatorname{softmax} (W _ {r} x))
$$

$E _ { i }$ 是专家网络（标准的 FFN 层）

- $g _ { i } ( x )$ 是来自路由器的门控权重（只有 top-K 个非零）

- 通常每个 Token 在 N = 8–64 个专家中激活 K = 2 个

- 总参数量随 N 增长；激活参数量按 FFN 大小的 K/N 比例增长

![](../images/6fa741d873345537c6b8829456339d59af9db832da95e16edfb814cf7adc1706.jpg)  
*Figure 1.11: 具有 8 个专家和 Top-2 路由的 MoE 层。每个 Token 只计算门控值最高的两个专家；其余专家被完全跳过。*

## 1.10.2 负载均衡

## 负载均衡问题

在没有约束的情况下，路由器可能会把大多数 Token 都发送到相同的 1–2 个专家上（“专家坍缩（expert collapse）”）。这既浪费了容量，又造成了跨 GPU 的计算不均衡（每个专家通常位于不同的 $\mathrm { G P U } \perp ) _ { \mathsf { c } }$

解决方案：添加一个辅助的负载均衡损失：

$$
\mathcal {L} _ {\mathrm{bal}} = \alpha \cdot N \sum_ {i = 1} ^ {N} f _ {i} \cdot p _ {i}
$$

其中 $f _ { i }$ 表示路由到专家 i 的 Token 比例， $p _ { i }$ 表示专家 i 的平均路由概率。这鼓励了对专家的均匀利用。

## 1.10.3 噪声 Top-K 门控（Noisy Top-K Gating）：让离散路由变得可训练

MoE 的核心挑战在于 top-k 选择是不可微的——你无法通过一个硬性的“挑选前 2 名”操作反向传播。该领域发展出了两个关键技巧来解决这个问题：

## 路由可微性问题

路由器为每个专家计算 $\mathrm { l o g i t s ~ } h ( x ) = W _ { r } \cdot x$ ，然后选择 top-k。但是：

- 被选中 的专家会通过其门控权重获得梯度（在被选中者上做 softmax）

- 选择决策本身（挑选哪 k 个）的梯度为零

- 如果没有技巧，路由器可能会卡住：一个从未被选中的专家 → 永远得不到梯度信号 → 永远不会被选中

方法 1：噪声 Top-K 门控（Noisy Top-K Gating） [325]。 在进行 top-k 选择之前，向路由器的 logits 添加可学习的高斯噪声：

(clean logits)

$$
H (x) = h (x) + \epsilon \cdot \mathrm{Softplus} (W _ {\mathrm{noise}} \cdot x), \quad \epsilon \sim \mathcal {N} (0, 1)\tag{noisy logits}
$$

$$
\operatorname{TopK} (v, k) _ {i} = \left\{ \begin{array}{l l} v _ {i} & \text { if   } v _ {i} \text {   is   in   the   top   } k \\ - \infty & \text { otherwise } \end{array} \right.\tag{1.11}
$$

$$
g (x) = \operatorname{softmax} \bigl (\operatorname{TopK} (H (x), k) \bigr)\tag{sparse gates}
$$

$W _ { \mathrm { n o i s e } }$ 是学习得到的噪声幅度——模型会学习每个专家需要多少探索量

- 在训练过程中，噪声偶尔会将“弱势”专家提升到 top-k 中，使其获得梯度信号

- 在推理时去除噪声：使用干净的 logits h(x) 进行确定性路由

- Softplus 确保噪声尺度始终为正

方法 2：Gumbel-Softmax 技巧（Gumbel-Softmax Trick，用于可微的离散采样）。 来自变分推断文献的另一种方法 [161]。Gumbel-Max 技巧（Gumbel-Max trick）提供了从类别分布中精确采样的方式：

$$
z = \arg \max _ {i} \left[ \log \pi_ {i} + G _ {i} \right], \quad G _ {i} \sim \operatorname{Gumbel} (0, 1)\tag{1.12}
$$

其中 Gumbel 噪声由 $G _ { i } = - \log ( - \log ( U _ { i } ) ) , U _ { i } \sim \mathrm { U n i f o r m } ( 0 , 1 )$ 生成。

对于 top-k 路由：取 $\left( \log \pi _ { i } + G _ { i } \right)$ 的 top-k，等价于从由 $\pi$ 定义的类别分布中无放回地抽取 k 个样本。

由于 argmax 是不可微的，Gumbel-Softmax 松弛将其替换为一个由温度控制的 softmax：

$$
\hat {g} _ {i} = \frac {\exp \left((\log \pi_ {i} + G _ {i}) / \tau\right)}{\sum_ {j} \exp \left((\log \pi_ {j} + G _ {j}) / \tau\right)}\tag{1.13}
$$

$\tau  0 \cdot$ ：趋近于硬 one-hot（精确但不可微）

$\tau \to \infty$ ：趋近于均匀分布（可微但无信息量）

- 实践中，在训练过程中将 τ 从 1.0 退火到 0.1–0.5

- 直通估计器（Straight-through estimator）：前向传播中使用硬 top-k，反向传播中使用Gumbel-Softmax 梯度——两全其美

## 实际中使用的是哪种方法？

- Sparsely-Gated MoE [325]、Mixtral [166]、DeepSeek-V2 [69]：使用带高斯噪声的噪声 Top-K。简单、有效，在大规模上得到了充分验证。

- Switch Transformer [89]：简化为不带噪声的 Top-1（仅依赖负载均衡损失）。

- 研究型 / 小规模 MoE：一些工作使用 Gumbel-Softmax 实现完全可微的路由，尤其是当学习路由本身就是研究目标时。

- 关键见解：两种方法都通过噪声注入解决了同一个问题（让离散选择可训练）。高斯噪声更简单；Gumbel 噪声在类别采样上有更强的理论保证。

无辅助损失负载均衡。 标准做法是在训练损失上加一个均衡惩罚项，但 DeepSeek [372] 证明这会与路由信号相互对抗：损失把利用率推向均匀，而路由器想要专业化。他们的解决方案把均衡完全移出梯度，改为一个基于观测利用率更新的逐专家路由偏置（bias）——同时实现了更好的质量和更高的专家专业化。Qwen 的后续洞见进一步揭示：聚合范围比机制本身更重要——按微批次（常见默认）计算均衡统计会悄无声息地摧毁专业化，因为微批次过于同质。像 MAI-Thinking-1所证实的那样，在整个全局批次上聚合，才能恢复专家分化所需的多样性信号。

## 1.10.4 值得关注的 MoE 模型

<table><tr><td>模型</td><td>总参数量</td><td>激活参数量</td><td>专家</td><td>创新点</td></tr><tr><td>Switch Transformer [89]</td><td>1.6T</td><td>100B</td><td>128, Top-1</td><td>首个大规模 MoE; 简化的路由</td></tr><tr><td>Mixtral 8x7B [166]</td><td>47B</td><td>13B</td><td>8, Top-2</td><td>开放权重; 质量媲美 Llama-2 70B</td></tr><tr><td>DeepSeek-V2 [69]</td><td>236B</td><td>21B</td><td>160, Top-6</td><td>带共享 + 路由专家的 DeepSeekMoE</td></tr><tr><td>Qwen-MoE [350]</td><td>14.3B</td><td>2.7B</td><td>60, Top-4</td><td>为提升效率而设计的细粒度专家</td></tr><tr><td>DBRX [67]</td><td>132B</td><td>36B</td><td>16, Top-4</td><td>每块 4 个专家的细粒度结构</td></tr></table>

## 1.11 LLM 训练中的多样性

多样性——在训练数据、模型输出和优化轨迹上的多样性——对于防止模式坍缩并确保鲁棒的通用LLM 至关重要。本节介绍适用于所有 LLM 训练阶段的关键多样性机制。

## 1.11.1 采样多样性

## 用于多样化生成的采样策略

- 温度 τ： $P ( x _ { i } ) \propto \exp ( \mathrm { l o g i t } _ { i } / \tau )$ 。更高的 τ = 更均匀的分布 = 更多样化。典型值：RLHF 生成中使用 τ = 0.7–1.0。

- Top-k：只从概率最高的 k 个 Token 中采样。防止退化的低概率 Token。

- Top-p（核采样，Nucleus Sampling）：从累计概率 ≥ p 的最小 Token 集合中采样。自适应：模型不确定时更多样。

- Min-p：仅保留满足 $P \ge p _ { \mathrm { m i n } } \times P _ { \mathrm { m a x } }$ 的 Token。比 top-k 更具原理性。

- 频率/出现惩罚（Frequency/presence penalty）：对已在回复中出现过的 Token 进行惩罚。鼓励词汇多样性。

## 1.11.2 训练数据多样性

- 提示多样性：覆盖不同的领域、难度等级和格式。Goldilocks 原则：提示的成功率应在 20–80%之间。

- 去重：移除近似重复的训练样本（MinHash、n-gram 重叠）。重复样本会导致对特定模式的过拟合。

- 数据混合：使用温度加权采样或课程策略，在任务/领域之间进行平衡。

## 1.11.3 促进多样性的方法

<table><tr><td>方法</td><td>它如何促进多样性</td></tr><tr><td>温度缩放 (Temperature scaling)</td><td>更高的  $\tau$  会让分布变得更平坦;更多 Token 变得合理。</td></tr><tr><td>Top- $p$  / Min- $p$ </td><td>自适应阈值允许模型在不确定时进行更广的采样。</td></tr><tr><td>频率惩罚 (Frequency penalty)</td><td>惩罚重复出现的 Token,强制在一次回复内产生词汇多样性。</td></tr><tr><td>数据去重</td><td>从训练数据中移除近似重复样本,防止对特定模式的过拟合。</td></tr><tr><td>多领域混合</td><td>跨领域的温度加权采样确保了广泛的覆盖。</td></tr><tr><td>口头化采样 (Verbalized sampling)</td><td>提示模型显式地用语言表达出对回复的概率分布 [422]。见 §7.5。</td></tr></table>

## 1.12 文本生成：解码方法

一个训练好的语言模型在每一步都会输出一个在词表上的概率分布： $P ( x _ { t } | x _ { < t } ) _ { \mathsf { c } }$ 。解码策略决定了我们如何从该分布中选择下一个 Token。这个选择深刻地影响输出质量、多样性和连贯性。

## 1.12.1 贪心解码（Greedy Decoding）

最简单的策略：总是选择概率最高的 Token。

$$
x _ {t} = \arg \max _ {v \in \mathcal {V}} P (v | x _ {<   t})
$$

直觉：就像在句子中总是选取最显而易见的下一个词。”The capital of France is...” → ”Paris”（概率 0.92）。

优点：确定性、快速、无超参数。

缺点：产生重复、泛泛的文本。当一个早期的低概率 Token 会带来全局更优输出时会被错过。没有多样性。

## 1.12.2 束搜索（Beam Search）

并行维护 B 个（束宽）部分假设，每一步用 top-k 个 Token 扩展每个假设，并保留得分最高的 B个完整序列：

$$
\operatorname{score} (y _ {1: t}) = \sum_ {i = 1} ^ {t} \log P (y _ {i} | y _ {<   i})
$$

配合长度归一化（length normalization）避免偏好短序列：

$$
\operatorname{score} _ {\text {norm}} (y) = \frac {1}{| y | ^ {\alpha}} \sum_ {i = 1} ^ {| y |} \log P (y _ {i} | y _ {<   i}), \quad \alpha \in [ 0. 6, 1. 0 ]
$$

直觉：就像同时在迷宫中探索多条路径，并在每个岔路口只保留 B 条最有希望的路径。

优点：能找到比贪心解码似然更高的序列；适合翻译和摘要等存在单一“正确”输出的任务。

缺点：对开放式生成仍倾向于产生泛泛、重复的文本；计算量增加 B 倍；所有束往往收敛到相似的输出。

![](../images/d3c4c91ea3c9f3e6ca21bc4a8e9f1a54757f431bad52011c2a5ae9f639fba5e7.jpg)

*Figure 1.12: 束宽为 B = 2 的束搜索。在每一步，只有得分最高的 2 个部分序列会被保留（蓝色）。得分较低的候选会被剪枝（灰色）。*

## 1.12.3 多样化束搜索（Diverse Beam Search）

标准束搜索会产生近似重复的束。多样化束搜索（Diverse Beam Search） [360] 将束划分为 G 个组，并在组之间添加一个不相似性惩罚（dissimilarity penalty）：

$$
\operatorname{score} _ {g} (y _ {t}) = \log P (y _ {t} | y _ {<   t}) - \lambda \sum_ {g ^ {\prime} <   g} \Delta (y _ {t}, Y _ {g ^ {\prime}})
$$

其中 $\Delta$ 衡量与较早组已选 Token 的重叠（例如 Hamming 多样性），λ 控制多样性强度。

直觉：就像强迫一个头脑风暴小组生成不同的想法——每个子组若重复了较早子组所说的内容就会被惩罚。

优点：产生真正不同的候选序列；对重排序流水线很有用。

缺点：多样性惩罚可能降低单个束的质量；超参数更多（G、λ）。

## 1.12.4 Top-k 采样

仅从概率最高的 k 个 Token 中采样，并重新分配概率质量：

$$
P ^ {\prime} (v | x _ {<   t}) = \left\{ \begin{array}{l l} \frac {P (v | x _ {<   t})}{\sum_ {v ^ {\prime} \in \operatorname{Top-} k} P (v ^ {\prime} | x _ {<   t})} & \text { if } v \in \operatorname{Top-} k \\ 0 & \text { otherwise } \end{array} \right.
$$

直觉：在”The cat sat on the...” 之后，只考虑前 k 个合理的延续 $( " \mathrm { m a t } " , ~ " \mathrm { H o o r } " , ~ " \mathrm { c o u c h } " . . . . . . . . )$ 2忽略那些极不可能的（”quantum”、”archipelago”）。

优点：去除尾部噪声；实现简单。

缺点：固定的 k 对尖峰分布而言过于严格（浪费概率质量），对平坦分布而言又过于宽松（让垃圾 Token 进入）。

## 1.12.5 Top-p 采样（核采样，Nucleus Sampling）

从累计概率超过 $p$ 的最小 Token 集合中采样：

$$
\operatorname{Top} - p = \min \left\{S \subseteq \mathcal {V}: \sum_ {v \in S} P (v | x _ {<   t}) \geq p \right\}
$$

其中 Token 按概率降序排序，并逐个加入直到达到阈值 $p _ { \circ }$

直觉：自适应地调整候选池大小。如果模型很自信 $( \mathrm { { } w p a r i s } ^ { \mathrm { { \prime } v } } \mathrm { { } p a r i s } ^ { \mathrm { { \prime } v } }$ 概率 95%），核就很小。如果不确定（”The movie was...”），核会扩展以包含许多合理的形容词。

优点：能适应分布形状；广泛使用的默认设置 $( p = 0 . 9 \ – 0 . 9 5 )$

缺点：在核的尾部仍会包含一些低质量 Token；阈值是一个单一的全局超参数。

![](../images/20323e976969e55434d73bcbd7b03e1a79eee0973bce8a39b9ac284b80ed7397.jpg)

*Figure 1.13: Top-p（核）采样：Token 按概率排序并依次加入，直到累计质量达到 $p = 0 . 9 $ 。核（深蓝）会根据分布形状自适应其大小——这里 5 个 Token 就足够了。*

## Top-k 与 Top-p

## 考虑预测下一个词：

- 在”2 + 2 =” 之后：分布是尖峰的——top-1 Token（”4”）占据 99% 的质量。Top-k=50 会浪费地考虑 49 个错误答案。Top-p=0.9 则正确地只选取”4”。

- 在”I enjoy eating” 之后：分布是平坦的——许多食物都合理。Top-k=5 太过严格。Top-p=0.9可能会包含 50 多个 Token，与实际的不确定性相匹配。

Top-p 自适应；top-k 不会。实践中，两者常被结合使用：从 top-p 与 top-k 的交集中采样。

## 1.12.6 Min-p 采样

一种较新的替代方法，它设置一个相对概率下限 [266]：

$$
\operatorname{Min} - p = \left\{v \in \mathcal {V}: P (v | x _ {<   t}) \geq p _ {\min} \cdot \max _ {v ^ {\prime}} P (v ^ {\prime} | x _ {<   t}) \right\}
$$

只有概率至少为最高 Token 概率 $p _ { \mathrm { m i n } }$ 倍的 Token 才会被保留。

直觉：“只考虑那些其可能性至少为最优 Token 10% 的 Token。”如果最高 Token 的概率为 0.8，那么只有概率高于 0.08 的 Token 能留下。如果最高 Token 的概率为 0.05（非常不确定），概率高于0.005 的 Token 都能留下——自然地扩大了候选池。

优点：会随模型置信度自然伸缩；在尖峰分布上比 top-p 产生更少的退化样本；只有一个直观的参数。

缺点：较新、经受的实战检验较少；尚未在所有推理框架中成为标准。

## 1.12.7 温度缩放

在应用任何采样策略之前，将 logits 除以温度 T：

$$
P _ {T} (v | x _ {<   t}) = \frac {\exp (z _ {v} / T)}{\sum_ {v ^ {\prime}} \exp (z _ {v ^ {\prime}} / T)}
$$

$T < 1 \dot { : }$ ：使分布更尖锐 → 更确定、更聚焦的输出。

$T = 1 \cdot$ ：未修改的模型分布。

$T > 1 :$ 使分布更平坦 → 更随机、更有创造性的输出。

$T  0 \colon$ ：退化为贪心解码。 $T \to \infty :$ 退化为均匀采样。

常见设置：事实性任务 $T = 0 . 7 ,$ ，创意写作 $T = 1 . 0 – 1 . 2 ,$ ，代码/数学 $T = 0 . 0 \ \left( \widehat { \sf { D A } } ^ { } \prime \sf { L } \right)$ ）。

## 1.12.8 对比解码（Contrastive Decoding）

对比解码（Contrastive Decoding） [210] 利用一个强模型（专家）与一个弱模型（业余者）之间的差异，来放大专家独有的知识：

$$
x _ {t} = \arg \max _ {v \in \mathcal {V} (x _ {<   t})} [ \log P _ {\mathrm{expert}} (v | x _ {<   t}) - \log P _ {\mathrm{amateur}} (v | x _ {<   t}) ]
$$

其中 $\begin{array} { r } { \mathcal { V } ( x _ { < t } ) = \left\{ v : P _ { \mathrm { e x p e r t } } ( v | x _ { < t } ) \geq \alpha \cdot \operatorname* { m a x } _ { v ^ { \prime } } P _ { \mathrm { e x p e r t } } ( v ^ { \prime } | x _ { < t } ) \right\} } \end{array}$ 是一个自适应的合理性约束。

直觉：业余模型捕捉到的是泛泛的、显而易见的模式（常用词、重复）。减去其对数概率就去除了这种“泛泛信号”，留下专家独有的知识和推理。就像从录音中去除背景噪声以听见信号一样。

优点：减少重复和泛泛的措辞；在不额外训练的情况下提升事实性和连贯性；可与任意一对模型搭配使用。

缺点：需要运行两个模型（计算量加倍）；对业余模型的选择敏感；合理性阈值 α 需要调优。

## 1.12.9 重复惩罚

与采样策略正交，重复惩罚（repetition penalties）阻止模型重复 Token。给定 Token v 的原始 logit$z _ { v }$ （即 LM 头在 softmax 之前输出的未归一化得分），惩罚后的 logit 为：

$$
z _ {v} ^ {\prime} = \left\{ \begin{array}{l l} z _ {v} / \theta & \text { if } v \in \text { generated   tokens   and } z _ {v} > 0 \\ z _ {v} \cdot \theta & \text { if } v \in \text { generated   tokens   and } z _ {v} <   0 \end{array} \right.
$$

其中 $\theta > 1$ 是惩罚因子（通常为 1.1–1.3）。在两种情况下，其效果都是把 logit 推向零——从而降低先前生成 Token 的概率。频率惩罚和出现惩罚是 OpenAI API 使用的更简单的加性变体：

$$
z _ {v} ^ {\prime} = z _ {v} - \alpha \cdot \mathrm{count} (v) - \beta \cdot {\bf 1} [ v \in \mathrm{generated} ]
$$

其中 $\alpha$ 是频率惩罚（与 v 出现次数成正比）， $\beta$ 是出现惩罚（对任何先前出现给予恒定惩罚）。

## 1.12.10 实际对比

Table 1.15: LLM 文本生成中各解码方法的对比。

<table><tr><td>方法</td><td>是否确定性</td><td>多样性</td><td>质量</td><td>最佳适用</td></tr><tr><td>Greedy</td><td>是</td><td>无</td><td>中等</td><td>代码、事实问答</td></tr><tr><td>Beam Search (B=4-8)</td><td>是</td><td>低</td><td>高(较窄)</td><td>翻译、摘要</td></tr><tr><td>Diverse Beam Search</td><td>是</td><td>中等</td><td>高</td><td>用于重排序的候选生成</td></tr><tr><td>Top-k (k=50)</td><td>否</td><td>中等</td><td>中等</td><td>通用生成</td></tr><tr><td>Top-p (p=0.9)</td><td>否</td><td>自适应</td><td>高</td><td>开放式任务的默认选择</td></tr><tr><td>Min-p (pmin=0.1)</td><td>否</td><td>自适应</td><td>高</td><td>top-p 的稳健替代</td></tr><tr><td>Contrastive</td><td>是</td><td>低</td><td>非常高</td><td>事实性、连贯的长文本</td></tr></table>

## 实际中的解码：“Once upon a time”

给定提示”Once upon a time,”：

- Greedy: ”there was a young girl who lived in a small village...”（泛泛的童话）

- Top-p=0.9, T=1.0: ”the rivers ran backwards and the fish learned to fly...”（有创意、出 人意料）

- $\mathbf { T o p } – p { = } \mathbf { 0 . 9 } , \ T { = } \mathbf { 0 . 3 } \mathrm { . }$ : ”there was a kingdom ruled by a wise and just king...”（连贯、常规）

- Contrastive: ”in the amber-lit corridors of a collapsing star, two minds argued about the nature of time...”（独特，避免了陈词滥调）

同一个模型、同一个提示——解码策略决定了输出的风格。

## 1.12.11 受限解码（Constrained Decoding，结构化生成 Structured Generation）

上述所有方法都在每一步从完整的词表中采样。受限解码（Constrained Decoding）限制允许的Token 集合，从而保证输出符合某种形式语法——通常是 JSON 模式、正则表达式或上下文无关文法（Context-Free Grammar，CFG）。

核心机制。 在每个解码步 t，会根据当前解析器状态计算一个 Token 掩码（token mask） $M _ { t } \subseteq \mathcal { V } _ { \circ }$ 只有 $M _ { t }$ 中的 Token 保留其原始 logits；在 softmax 之前，所有其它 Token 都被设为 −∞：

$$
P ^ {\prime} (v | x _ {<   t}) = \left\{ \begin{array}{l l} P (v | x _ {<   t}) / Z & \text { if } v \in M _ {t} \\ 0 & \text { otherwise } \end{array} \right.
$$

其中 $\begin{array} { r } { Z = \sum _ { v \in M _ { t } } P ( v | x _ { < t } ) } \end{array}$ 用于重新归一 $\scriptstyle  \{ \underline { { \boldsymbol { \chi } } } _ { \scriptscriptstyle \infty }$ 。由于掩码每一步都会变化（它取决于到目前为止已经P生成的内容），约束是逐步强制实施的——模型在任何位置都不可能生成一个非法前缀。

从模式到掩码。 编译流水线为：

$$
\text {JSON Schema} \xrightarrow {\text {compile}} \text {Regex} \xrightarrow {\text {compile}} \text {FSM (DFA)} \xrightarrow {\text {index}} \text {Token Mask per State}
$$

有限状态机（FSM）的状态对应正则表达式中的位置。对每个状态，所有能使字符串保持在该语言内的词表 Token 都被预计算成索引（对每个模式只需一次性的开销）。在运行时，查询掩码只是一次 O(1) 的表访问——对每个解码步带来的延迟可忽略不计。

关键库。

- Outlines [378]：将 JSON 模式和正则表达式编译为交织的、由 FSM 引导的生成。支持任何提供 logits 接口的模型。

- lm-format-enforcer<sup>1</sup>：类似的 FSM 方法，重点放在与服务框架（vLLM、TGI）的集成上。

- Guidance<sup>2</sup>（Microsoft）：将受限生成与控制流（循环、条件）交织在一起，可实现超越扁平模式的复杂结构化输出。

- XGrammar [77]：基于下推自动机的引擎，支持完整的上下文无关文法（不仅限于正则语言），被 MLC-LLM 和 vLLM 用于语法模式的解码。

权衡。 受限解码保证了语法有效性——不会出现事后解析失败，也无需重试。然而：

- 语义质量：如果模型对“正确”答案的概率质量位于语法之外，强制结构可能会降低内容质量。在实践中，对于设计良好的模式和训练良好的模型，这种情况很少出现。

- 编译开销：必须为每个模式构建 FSM 索引。对于复杂模式可能需要 1–5 秒，但这一开销会在所有使用该模式的请求间摊销。

- 语法覆盖：正则/FSM 可处理 JSON、YAML、SQL 片段以及大多数结构化格式。完整的 CFG（通过 XGrammar 或 LALR 解析器）可覆盖 Python 或 XML 等语言。

## 何时使用受限解码

当模型输出的消费者是程序而不是人类时，就应使用受限解码。工具调用智能体、API 后端和数据抽取流水线都能从有保证的合法结构中受益。对于自由形式的散文或创意文本 无约束采样仍然是合适的选择。

## 1.13 Prompt 工程

Prompt 工程是一门设计 LLM 输入的学科，目标是在不修改模型权重的情况下可靠地激发预期行为。微调修改的是模型本身，而 Prompt 工程则通过精心的框架、示例与结构来挖掘模型已有的能力。它是改善 LLM 输出最快、最便宜、也最易获得的杠杆，即使在使用微调模型时也依然不可或缺。

## 1.13.1 上下文学习（In-Context Learning，ICL）

上下文学习 [32] 是大语言模型一项令人瞩目的能力：在推理时仅凭 Prompt 中提供的示例就能学习任务，完全无需梯度更新。模型从输入-输出对的模式中隐式推断任务，并泛化到新的输入上。

## 为什么上下文学习有效

- 隐式贝叶斯推断：模型在预训练时见过数百万种任务。Prompt 示例在模型学到的分布中定位到相关任务 [396]。

- 归纳头（Induction heads）：特定的 attention 头学会复制模式（“A 之于 B，如 C 之于”），从而实现上下文泛化 [273]。

- 任务向量（Task vectors）：ICL 在残差流中创建隐式的任务表示，引导生成朝向所演示的格式与内容 [354]。

扩展行为。 ICL 主要在参数量约 1B 以上的模型中涌现，并随模型规模呈对数线性提升 [32]。较小的模型可以记住示例，但难以在同一上下文窗口内泛化到新的输入。

## 1.13.2 零样本提示（Zero-Shot Prompting）

零样本提示不提供任何示例，只有任务描述或指令。模型必须完全依靠预训练知识与指令微调来生成正确的格式与内容。

## 零样本分类

!!! note
    Classify the following movie review as POSITIVE or NEGATIVE. Review: "The cinematography was breathtaking but the plot felt rushed and predictable." Sentiment:

## 零样本何时奏效：

- 模型在预训练/SFT 阶段大量见过的任务（翻译、摘要、情感分析）

- 指令明确、输出格式无歧义

- 指令微调模型（如 ChatGPT、Claude、Llama-3-Instruct）在零样本任务上显著优于基座模型 [280]

零样本何时失效： 全新格式、领域特定的标注方案，或模型无法仅凭指令推断出确切需求的模糊任务。

## 1.13.3 少样本提示（Few-Shot Prompting）

少样本提示 [32] 在实际查询之前提供 k 个输入-输出示例（即 “shots”）。它是上下文学习最常见的形式，也仍然是最有效的提示策略之一。

## 少样本命名实体识别

!!! note
    Extract named entities from the text. Format: [ENTITY](TYPE)
    Text: "Apple released the iPhone 15 in Cupertino."
    Entities: [Apple](ORG), [iPhone 15](PRODUCT), [Cupertino](LOC)
    Text: "Elon Musk announced Tesla's new factory in Berlin."
    Entities: [Elon Musk](PER), [Tesla](ORG), [Berlin](LOC)
    Text: "OpenAI partnered with Microsoft to deploy GPT-4."
    Entities:

## 少样本示例的关键设计原则：

1. 多样性：覆盖预期输入的范围（不同长度、边界情况、类别）。

2. 顺序：将较难或更具代表性的示例放在最后（近因偏差，recency bias） [241]。

3. 标签平衡：分类任务中要包含所有类别的示例，以避免多数类偏差。

4. 格式一致性：每个示例都必须遵循完全相同的结构。模型会模仿这种模式。

5. 相关性：选用与目标查询语义相近的示例可获得最佳效果 [223]。

需要多少个示例？ 性能通常会从 0 个示例提升到 4–8 个示例，然后趋于平稳。超过约 20 个示例后收益微乎其微，反而有占满上下文窗口的风险。Min 等人 [257] 表明，示例的格式与标签空间比标签正确性更重要——即使随机标签也有帮助（不过正确标签帮助更大）。

## 1.13.4 指令跟随类 Prompt

指令微调模型对清晰、结构化的指令响应最好。关键洞察是：把 Prompt 当作规范说明，而不是建议。

## 高效指令型 Prompt 的解剖

1. 角色/人格：定义模型是谁（“你是一名资深数据科学家⋯⋯”）

2. 任务：要做什么，表述清晰无歧义

3. 上下文：模型需要的背景信息

4. 约束：长度限制、语气、需要避免的内容、输出格式

5. 示例（可选）：展示期望的输出格式

6. 输入：实际待处理的数据

## 带约束的指令型 Prompt

```yaml
Role: You are a medical literature reviewer.

Task: Summarize the following research abstract for a general audience.

Constraints:
- Maximum 3 sentences
- No jargon (explain any technical terms)
- Include the key finding and its clinical implication
- Do NOT speculate beyond what the abstract states

Abstract: [...]
```

System Prompt 与 User Prompt 的对比。 现代聊天 API 将系统 Prompt（持久指令、角色定义）与用户消息（每轮输入）分离。多数模型对 system prompt 赋予更高的 attention 优先级，是放置角色定义、约束和输出格式说明的天然位置 [274]。

## 1.13.5 结构化输出 Prompt（JSON/XML）

对于程序化用途，最关键的提示技术是强制结构化输出——尤其是 JSON。

## JSON 输出 Prompt

```python
Extract the following information from the customer email.
Respond ONLY with valid JSON, no other text.

Schema:
{
    "intent": "refund|complaint|question|praise",
    "urgency": "low|medium|high",
    "product_mentioned": "string or null",
    "summary": "one sentence summary"
}

Email: [...]
```

## 获得可靠结构化输出的技巧：

- Schema 优先：在输入之前展示精确的 JSON schema，模型会将其当作模板。

- 约束解码（Constrained decoding）：使用基于语法的采样（如 Outlines [378]、Guidance）在 token 级别保证 JSON 语法合法。

- XML 标签：对于嵌套或多段输出，XML 标签（如 <thinking>...</thinking>）提供无歧义的分隔符，模型能可靠地遵循。

- Pydantic/TypeScript 类型：提供类型定义有助于模型理解字段约束（OpenAI 的 functioncalling 内部就使用 JSON Schema）。

## Prompt 中的 JSON ——常见陷阱

- 模型可能加上 markdown 代码围栏（‘‘‘json ... ‘‘‘）——需明确要求输出原始 JSON。

- 嵌套对象和数组会增加幻觉风险——尽量将 schema 扁平化。

- 枚举字段（固定选项）比自由文本字段可靠得多。

- 始终要在程序中校验输出；不借助约束解码，任何 Prompt 都无法 100% 保证合规。

JSON Prompting：结构化输入本身。 一种独立但互补的技术是 JSONprompting——将 Prompt本身格式化为 JSON 而非自然语言。这利用了模型在结构化数据（API、配置、代码）上的大量预训练，从而提升指令遵循度、降低歧义，并使多字段请求能被确定性地解析。

## 结合 System Prompt 的 JSON Prompting

```python
=== SYSTEM ===
You are a senior code reviewer. Analyze code for bugs, security issues, and style violations. Always respond in the JSON schema provided.

=== USER (JSON prompt) ===
{
    "task": "code_review",
    "language": "python",
```

```python
"severity_filter": "high",
"code": "def login(user, pw):\n query = ...",
"output_schema": {
    "issues": [
    {
    "line": "int",
    "severity": "critical|high|medium|low",
    "category": "security|bug|style|performance",
    "description": "string",
    "fix": "string"
    }],
    "overall_risk": "critical|high|medium|low"
    }
}
为何 JSON prompting 有效:
- 无歧义的字段边界：不会混淆一条指令何处结束、下一条何处开始。
- 带类型的约束：像"severity_filter": "high" 这样的字段比“只显示高严重度问题”更清晰。
- Schema 即契约：在输入中加入 output_schema 复刻了模型在预训练中大量见过的 API 设计模式。
- System prompt 依然不可或缺：System 消息提供角色、语气与行为约束，这些内容并不适合放进 JSON 负载里。
```

## 1.13.6 思维链（Chain-of-Thought，CoT）Prompting

思维链 Prompting [374] 要求模型在给出最终答案之前先生成中间推理步骤。这一简单技术在需要多步推理的任务上（算术、逻辑、常识推断与代码生成）能带来显著的性能提升。

## CoT 为何奏效：

- 将计算序列化：Transformer 深度固定，但生成长度可变。CoT 将并行（困难）问题转化为串行（容易）的步骤，相当于增加了模型的计算预算。

- 降低累积误差：每一步都是更简单的子问题，单步错误率更低。

- 暴露中间状态：让推理过程可审计、可调试。

## 思维链的变体

<table><tr><td>方法</td><td>说明</td></tr><tr><td>零样本 CoT (Zero-Shot CoT) [189]</td><td>在任意 Prompt 末尾追加“Let&#x27;s think step by step”</td></tr><tr><td>少样本 CoT (Few-shot CoT) [374]</td><td>提供带显式推理链的示例</td></tr><tr><td>自一致性(Self-Consistency) [367]</td><td>采样 N 条 CoT 路径;对最终答案做多数投票</td></tr><tr><td>思维树 (Tree of Thoughts) [407]</td><td>探索多条推理分支并支持回溯</td></tr><tr><td>Plan-and-Solve [364]</td><td>先规划步骤,再逐步执行</td></tr><tr><td>ReAct [408]</td><td>交替进行 Reasoning 与 Acting(工具调用)</td></tr></table>

## 零样本思维链

Q: A store has 45 apples. They sell 3/5 of them in the morning and 1/3 of the remaining in the afternoon. How many apples are left? Let's think step by step. A: Morning sales: $45 * 3/5 = 27$ apples sold.

!!! note
    Remaining after morning: 45 - 27 = 18.
    Afternoon sales: 18 * 1/3 = 6 apples sold.
    Remaining: 18 - 6 = 12 apples.

自一致性（Self-Consistency）。 Wang 等人 [367] 表明，采样多条思维链推理路径并对最终答案做多数投票，能显著优于单路径 CoT。直觉是：正确的推理路径往往收敛于同一答案，而错误通常各有不同。这是用算力（生成 N 个样本）换取准确率——在延迟不如正确性重要时非常实用。

CoT 何时反而有害。 CoT 并非普遍有益。对于简单任务（单步分类、检索、格式化），CoT 会增加不必要的 token、提高延迟，甚至会因过度思考引入错误。应有选择地在确实需要多步推理的任务中使用 CoT。

## 1.13.7 进阶 Prompting 技术

检索增强生成（Retrieval-Augmented Generation，RAG）。 RAG [208] 不再只依赖模型的参数化记忆，而是检索相关文档并将其纳入 Prompt：

!!! note
    Context (retrieved): [document chunks]
    Question: [user query]
    Answer based ONLY on the provided context.

这将模型的回答锚定在可验证的来源上，在知识密集型任务中能显著减少幻觉。

Prompt 链式调用与分解。 复杂任务受益于被拆解成由多个简单 Prompt 组成的流水线，每一步的输出作为下一步的输入：

1. 从文档中提取关键事实

2. 在提取出的事实上进行推理

3. 格式化最终答案

每一步都可以使用不同的 Prompt 模板、模型或温度设置。相较单一的大 Prompt，这种方式更可控，也便于有针对性地调试。

宪法 AI（Constitutional AI）/ 自我批评（Self-Critique）。 Bai 等人 [16] 引入了一类 Prompt：让模型根据一组原则批评并修订自己的输出：

!!! note
    [Generate initial response]
    Critique: Does this response violate any of the following principles? [list principles]
    Revision: Rewrite the response addressing the critique.

元提示（Meta-Prompting）与 Prompt 优化。 与手工编写 Prompt 不同，近期工作开始自动化 Prompt 设计：

- APE [441]：使用 LLM 自动生成并打分候选 Prompt。

- DSPy [183]：将声明式的任务描述编译为优化过的 Prompt 流水线，并带有学习到的少样本示例。

- OPRO [402]：将 Prompt 优化视为优化问题，使用 LLM 作为优化器。

专注推理查询（Attentive Reasoning Queries，ARQ）。 ARQ [403] 解决了标准 Prompting 的一个根本弱点：随着上下文变长，模型越来越容易 “丢失” Prompt 中段的关键信息（即 lost-in-the-middle 效应）。ARQ 通过将复杂查询分解为若干聚焦的子查询来缓解这一问题，每个子查询都旨在将模型的 attention 引向上下文的特定部分：

1. 查询分解：将用户问题拆解为原子级的子问题，每个聚焦一个狭窄方面。

2. 专注检索：对每个子查询，仅检索或高亮与之相关的上下文片段——迫使模型聚焦于它。

3. 聚合：将子答案合并为连贯的最终回答。

这在长文档问答、对大规模检索集合的多跳推理以及上下文窗口中包含大量工具输出的智能体任务中尤为有效。ARQ 可被视为一种结构化的思维链，它显式地管理模型看哪里，而不仅仅是怎么推理。

## 1.13.8 最佳实践：打造高效 Prompt

基于文献中的实证发现与从业者经验，以下原则能够稳定地提升 Prompt 质量：

<table><tr><td>Prompt 工程检查清单</td></tr><tr><td>1. 具体且无歧义:把“总结一下”替换为“用2-3个要点总结,每条不超过20字,聚焦可操作的发现”。</td></tr><tr><td>2. 展示而非陈述:一个好示例胜过100字的说明。拿不准时就加一个少样本示例。</td></tr><tr><td>3. 显式定义输出格式:指定JSON schema、要点列表、表格格式或精确分隔符。绝不把格式留给模型自行解读。</td></tr><tr><td>4. 为输入数据使用分隔符:用明确的分隔符(&quot;&quot;&quot;、...</input>、---)包裹用户输入,将指令与数据分开。</td></tr><tr><td>5. 指定角色:“你是一名[领域专家],[具体行为]”可以激发相关知识与语气。</td></tr><tr><td>6. 指明不要做什么:负向约束(“不要解释你的推理”、“绝不输出超过5项”)通常比正向约束更有效。</td></tr><tr><td>7. 为推理任务加入思维链:对数学、逻辑或多跳问题,追加“Think step by step”或提供解题示例。</td></tr><tr><td>8. 合理控制温度:事实/确定性任务用 $T \approx 0$ ;创造性/多样化输出用 $T \approx 0.7-1.0$ 。</td></tr><tr><td>9. 基于实证迭代:把Prompt当作代码——做版本管理、A/B测试,并在代表性评测集上度量性能。</td></tr><tr><td>10. 利用近因偏差:将最关键的指令和示例放在Prompt的末尾(最接近生成位置)。</td></tr></table>

Table 1.16: 常见的 Prompting 失效模式与解决方案。

<table><tr><td>失效模式</td><td>症状</td><td>解决方案</td></tr><tr><td>指令遗忘</td><td>模型在长 Prompt 中忽略约束</td><td>把约束放到末尾;重复关键规则;使用 system prompt</td></tr><tr><td>格式漂移</td><td>输出开头正确,但在长生成中逐渐崩坏</td><td>使用约束解码;拆分为多段较短的链式 Prompt</td></tr><tr><td>谄媚(Sycophancy)</td><td>模型附和 Prompt 中错误的前提</td><td>加上“若前提不正确请质疑”;使用系统级指令</td></tr><tr><td>细节幻觉</td><td>模型编造上下文中不存在的事实</td><td>加上“若未知请说不知道”;使用带溯源的 RAG</td></tr><tr><td>过度拒答</td><td>模型因安全训练而拒绝无害请求</td><td>改写以澄清正当意图;显式说明请求合理性的上下文</td></tr></table>

## Prompt 工程的心智模型

把 Prompt 工程想象成用自然语言编程。模型是一个强大但字面化的解释器——它会严格按照你的要求执行，并按其训练分布中最可能的方式去理解。软件工程的常见原则同样适用：

- DRY（Don’t Repeat Yourself）：除非是为对抗长上下文中的 attention 衰减

- 关注点分离：角色、约束、示例与输入分置于不同的 Prompt 段落

- 测试驱动开发：先定义期望输出，再编写 Prompt

- 版本控制：跟踪 Prompt 的迭代及其评测分数

- 模块化：构建可复用的 Prompt 模板；将可变部分参数化

当经过系统迭代后 Prompt 仍无法达到所需质量，这就是切换到微调（SFT）或强化学习（RLHF/DPO）的信号。

## 1.14 模型压缩方法

模型压缩在保持质量的同时降低模型规模和推理成本。三种主要方法：量化（Quantization，降低数值精度）、剪枝（Pruning，移除参数）和蒸馏（Distillation，训练较小模型模仿更大模型）。

## 1.14.1 量化（Quantization）

量化通过将权重（以及可选的激活值）表示为更低精度的格式来缩小模型规模、降低推理成本。其核心权衡在于压缩率与质量下降之间。

量化概览

量化将模型权重（以及可选的激活值）的数值精度从 FP32/BF16 降至更低位宽的格式：

$$
x _ {q} = \mathrm{round} \bigg (\frac {x - z}{s} \bigg), x _ {\mathrm{dequant}} = s \cdot x _ {q} + z
$$

其中 s 是缩放因子，z 是零点。

Table 1.17: 面向 LLM 的量化方法。

<table><tr><td>方法</td><td>位宽</td><td>类型</td><td>核心思想</td></tr><tr><td>GPTQ [99]</td><td>4-bit</td><td>PTQ, 仅权重</td><td>基于 optimal brain surgeon 进行逐层量化,最小化  $\|WX - \hat{WX}\|^2$ 。</td></tr><tr><td>AWQ [217]</td><td>4-bit</td><td>PTQ, 仅权重</td><td>保护显著权重(与大激活相对应)。1% 的权重承担 99% 的重要性。</td></tr><tr><td>GGUF [109]</td><td>2-8 bit</td><td>PTQ, 仅权重</td><td>面向 CPU 优化的格式(llama.cpp)。按 block 量化,支持多种类型。</td></tr><tr><td>FP8 (E4M3)</td><td>8-bit</td><td>训练 + 推理</td><td>H100 原生支持。相比 BF16 提供 2× 吞吐。</td></tr><tr><td>SmoothQuant [392]</td><td>W8A8</td><td>PTQ, 权重 + 激活</td><td>在量化前将激活离群值平滑迁移到权重。使 INT8 GEMM 可行。</td></tr><tr><td>QAT [234]</td><td>4-bit</td><td>QAT</td><td>使用模拟量化进行训练。质量最高但成本昂贵。</td></tr><tr><td>AQLM [83]</td><td>2-bit</td><td>PTQ, 加性码字</td><td>通过学习到的加性量化码本实现极端压缩。</td></tr></table>

## 何时进行量化

- 推理服务：始终量化。W4A16（4-bit 权重，BF16 激活）是甜点——节省 2× 内存，对 70B以上模型质量损失 ${ < } 1 \mathrm { ‰ }$

- 训练：H100 上的 FP8 在质量损失极小的情况下提供 2× 吞吐。BF16 仍是较小模型的默认

选项。

- 边缘部署：在消费级硬件上做本地推理时使用 GGUF Q4\_K\_M。

- RLHF：将冻结模型（参考模型、奖励模型）量化为 INT8/FP8。策略模型保持 BF16 以确保训练精度。

## 1.14.2 剪枝（Pruning）

为何要剪枝？ 现代 LLM 包含数十亿参数，而实证研究一致表明其中相当大一部分权重对模型输出贡献甚微。剪枝正是利用这种过参数化：通过移除冗余权重，可以降低内存占用（使其能部署于较小的 GPU 或边缘设备）、推理延迟（每次前向传递的乘加操作更少），以及服务成本（每美元的吞吐更高）。与对所有权重统一降低精度的量化不同，剪枝有选择地消除权重——与量化结合时能带来乘性的节省（例如 50% 稀疏、4-bit 的模型相比密集 BF16 基线节省 4× 内存）。挑战在于既要实现高稀疏度又不损害生成质量，这推动了无需重新训练的一次性（one-shot）原则性方法的发展。

## 剪枝方法

- 非结构化剪枝：将低于阈值的单个权重置零。可实现高稀疏度（50–90%）。需要稀疏 GEMM内核（A100/H100 上的 2:4）。

- 结构化剪枝：移除整个 attention 头、层或 FFN 神经元。无需专门内核即可直接降低 $\mathrm { F L O P S } _ { \mathrm { c } }$

- SparseGPT [98]：使用近似逆 Hessian 进行一次性剪枝。在 175B 模型上以极小的质量损失实现 50% 非结构化稀疏。

- Wanda [345]：按 $| w | \times \| x \|$ （权重幅值乘以输入激活范数）剪枝。无需校准数据，效果可与SparseGPT 竞争。

## NVIDIA 2:4 结构化稀疏

A100/H100 Tensor Core 原生支持 2:4 稀疏：每 4 个元素中至多 2 个非零。在硬件加速支持的操作上恰好带来 2 加速。其约束是：必须恰好在这一特定模式下达到 50% 稀疏，相比任意稀疏度灵活性较低。

## 1.14.3 知识蒸馏（Knowledge Distillation）

知识蒸馏 [139] 将一个大型教师模型已学到的行为迁移到一个更小、更便宜的学生模型中。核心思想是：教师在 token 上的输出分布所携带的信号远比单纯的硬标签丰富——揭示了类间相似性、置信度校准与不确定性，学生可以加以利用。

温度缩放（Temperature Scaling）的 Softmax。 为了揭示教师 logits 中的 “暗知识”（darkknowledge），我们用温度 $T > 1$ 对分布进行软化：

$$
p _ {i} ^ {(T)} = \frac {\exp (z _ {i} / T)}{\sum_ {j} \exp (z _ {j} / T)}
$$

温度较高时概率质量在更多 token 上分布开来，使接近正确的备选项变得可见。训练时学生使用相同温度；推理时学生使用 $T = 1 ,$ C

通用蒸馏损失。

$$
\mathcal {L} _ {\mathrm{distill}} = \alpha T ^ {2} \cdot \mathrm{KL} (P _ {\mathrm{teacher}} ^ {(T)} \parallel P _ {\mathrm{student}} ^ {(T)}) + (1 - \alpha) \cdot \mathcal {L} _ {\mathrm{CE}} (y, P _ {\mathrm{student}} ^ {(1)})
$$

$T ^ { 2 }$ 因子补偿了软化分布造成的梯度幅度下降。典型取值： $T \in [ 2 , 2 0 ] , \ \alpha \in [ 0 . 5 , 0 . 9 ]$ （教师质量越高，KL 的权重越大）。

Table 1.18: 面向 LLM 的知识蒸馏范式。

<table><tr><td>范式</td><td>机制</td><td>优点</td><td>缺点</td></tr><tr><td>离线/白盒(Offline/White-box)</td><td>预先计算教师 logits;学生在完整分布上训练</td><td>完整分布信号;教师代价一次性付出</td><td>数据陈旧;存储开销大</td></tr><tr><td>在线/协同训练(Online/Co-training)</td><td>教师在线生成;学生看到新鲜 logits</td><td>适应学生弱点</td><td>算力2×;基础设施复杂</td></tr><tr><td>黑盒(API)</td><td>仅有教师的文本输出(无 logits)</td><td>适用于专有模型</td><td>失去暗知识;近似于SFT</td></tr><tr><td>自蒸馏(Self-distillation)</td><td>模型蒸馏到自身的较小版本</td><td>不需要单独的教师</td><td>教师=学生家族;存在上限</td></tr></table>

离线（白盒）蒸馏。 为每个训练 token 记录教师完整的 logit 向量（或为节省存储而记录 top-klogits）。学生最小化与这些存储分布的 KL 散度。在教师访问不受限时，这是最数据高效的范式。

动机：将教师推理与学生训练解耦——在高端硬件上跑一次教师，之后廉价地训练多个学生。

优点：确定性、可复现；教师代价被摊销；完整分布信号。

缺点：需要为每个 token 存储 |V| 维向量（可通过 top-k 剪枝缓解）；教师无法针对学生的失误进行调整。

在线（协同训练）蒸馏。 教师与学生联合运行：教师为学生当前的训练批次生成 logits。

动机：让教师聚焦于学生当前难以处理的输入（类似课程学习）。

优点：数据新鲜；可使用学生生成的输入进行 on-policy 蒸馏。

缺点：GPU 代价翻倍；同步复杂度高；更难扩展。

黑盒（API）蒸馏。 当仅有文本输出可用时（例如从专有 API 蒸馏），学生通过对教师生成结果做 SFT 进行训练，并可选地辅以思维链轨迹。

动机：现实约束——大多数前沿模型不暴露 logits。

优点：流程简单；适用于任何带 API 的模型。

缺点：没有软标签信号；容易放大幻觉；本质上等同于监督微调。

自蒸馏。 模型从同一架构家族中的较大版本（例如 Llama-3 70B → 8B）或训练过程中的自身checkpoint 蒸馏。

动机：避免训练单独的教师；在不同规模上利用模型自身的能力。

优点：架构兼容；无外部依赖。

缺点：教师天花板等于模型天花板；无法引入真正新的知识。

## 暗知识（Dark Knowledge）

设想一个语言模型在预测 “The capital of France is” 之后的词。硬标签只告诉它 “Paris” 是正确答案。但教师的软分布可能把 5% 分给 “Lyon”、2% 分给 “Marseille”、对 “banana” 接近零这告诉学生哪些错误是合理的，从而显著提升校准度与泛化能力。

## LLM 蒸馏的实践考量。

- 序列级 vs. token 级：token 级 KL 是标准做法；序列级蒸馏（在完整序列上最小化 KL）能更好地捕捉长程一致性，但更难优化。

- 逐层提示：匹配中间表示（attention 图、隐藏状态）能提供额外的学习信号——尤其在学生架构不同的情况下有用。

- 数据选择：蒸馏数据质量很重要；精挑多样化的困难样本比随机采样能产出更好的学生。

<table><tr><td>投机解码框架</td></tr><tr><td>1. 一个快速的草稿(draft)机制提议k个候选token: $\hat{x}_{1},\ldots,\hat{x}_{k}$ </td></tr><tr><td>2. 大的目标模型对所有k个token进行一次(批量)前向传递</td></tr><tr><td>3. 验证:从左到右依次接受token,只要 $P_{\text{target}}(\hat{x}_{i}) \geq r_{i} \cdot P_{\text{draft}}(\hat{x}_{i})$ (其中 $r_{i} \sim U[0,1]$ )</td></tr><tr><td>4. 在位置j首次被拒绝时:从调整后的分布重新采样 $x_{j}$ ,并丢弃 $\hat{x}_{j+1},\ldots,\hat{x}_{k}$ </td></tr><tr><td>关键性质:这一接受/拒绝方案保证最终分布与 $P_{\text{target}}$ 完全一致。</td></tr><tr><td>加速比:若接受率为 $\alpha$ ,每步期望token数= $\frac{1-\alpha^{k+1}}{1-\alpha}$ 。在 $\alpha = 0.8$ 、 $k = 5$ 时:每步期望3.4个token,相较标准解码的1个。</td></tr></table>

- 学生容量：学生参数低于教师约 10% 时收益递减；在极端压缩下可能需要架构变更（例如MoE → dense）。

- 与量化结合：蒸馏 + 4-bit 量化（例如 QLoRA 蒸馏模型）能在 20× 压缩下达到接近教师的质量。

## 压缩方法对比——70B 模型

<table><tr><td>方法</td><td>大小</td><td>速度</td><td>质量</td><td>使用场景</td></tr><tr><td>BF16(基线)</td><td>140 GB</td><td>1×</td><td>100%</td><td>训练、参考</td></tr><tr><td>FP8 (E4M3)</td><td>70 GB</td><td>2×</td><td>99.5%</td><td>H100 推理</td></tr><tr><td>INT8 (SmoothQuant)</td><td>70 GB</td><td>1.8×</td><td>99%</td><td>A100 推理</td></tr><tr><td>4-bit (AWQ)</td><td>35 GB</td><td>2.5×</td><td>97–98%</td><td>大规模服务</td></tr><tr><td>2-bit (AQLM)</td><td>17.5 GB</td><td>3×</td><td>90–93%</td><td>边缘、实验</td></tr><tr><td>Pruned 50% (2:4)</td><td>70 GB</td><td>1.8×</td><td>97%</td><td>结构化加速</td></tr><tr><td>Distilled 8B</td><td>16 GB</td><td>10×</td><td>80–85%</td><td>移动、边缘</td></tr></table>

## 1.15 投机解码（Speculative Decoding）方法

投机解码 [205] 通过同时预测多个 token，然后在目标模型的一次前向传递中对其进行验证，来加速自回归生成。它产生与标准解码完全相同的输出分布（无质量损失），同时实现 2–3× 加速。

## 1.15.1 核心原理

## 1.15.2 方法对比

## 1.15.3 Medusa 多头推测解码

Table 1.19: 现代推理引擎支持的投机解码方法。

<table><tr><td>方法</td><td>草稿来源</td><td>加速比</td><td>核心思想</td></tr><tr><td>标准方案 [205]</td><td>小模型(1-7B)</td><td>2-3×</td><td>独立的草稿模型生成候选。简单但需要同时加载2个模型。</td></tr><tr><td>Medusa [35]</td><td>并行LM头</td><td>2-3×</td><td>在目标模型上增加k个额外的预测头。每个分别预测+1,+2,...,+k位置的token。</td></tr><tr><td>Eagle [212]</td><td>特征层级</td><td>2.5-3.5×</td><td>轻量解码器根据目标模型的隐藏状态生成草稿token。接受率高于Medusa。</td></tr><tr><td>Eagle-2 [212]</td><td>上下文感知</td><td>3-4×</td><td>基于置信度扩展的动态草稿树。当前最先进的接受率。</td></tr><tr><td>N-gram Lookup</td><td>N-gram缓存</td><td>1.5-2×</td><td>将Prompt的n-gram与已生成文本进行匹配。零成本;对重复输出极佳。</td></tr><tr><td>Lookahead [101]</td><td>Jacobi迭代</td><td>2-2.5×</td><td>并行Jacobi解码配合n-gram验证。无需草稿模型;使用目标模型自身。</td></tr><tr><td>多token预测[111]</td><td>修改架构</td><td>2-3×</td><td>训练模型原生地在每步预测多个token(Meta在Llama中的方案)。</td></tr></table>

## Medusa 工作原理

Medusa 在 LLM 上额外增加 k 个 “预测头”（共享同一主干）：

- Head 0（原始）：预测位置 t + 1 的 token（标准的下一个 token）

- Head 1：预测位置 t + 2 的 token（跳过一个）

- Head i：预测位置 t + i + 1 的 token

- 所有头在一次前向传递中并行运行

- 一种树状结构的验证同时校验多条候选序列

训练：只微调 Medusa 头（主干冻结）。成本：在代表性数据上约 1 个 epoch。

优势：无需独立的草稿模型；每个头都很小（一层线性层）。内存开销：<1%。

## 1.15.4 Eagle：特征级草稿

## 为何 Eagle 优于 Medusa

<table><tr><td>Medusa 的各个头在不同位置独立预测——它们无法以自己先前的预测为条件 (t+2 位置的 token 不知道 t+1 预测了什么)。Eagle 通过一个作用在目标模型隐藏状态上的轻量自回归解码器修正了这一点:</td></tr><tr><td>1. 从目标模型最后一层提取隐藏状态</td></tr><tr><td>2. 输入一个小型(1 层)解码器,以先前隐藏状态为条件自回归地生成草稿 token</td></tr><tr><td>3. 这捕捉到了 Medusa 所缺失的 token 间依赖</td></tr><tr><td>结果:Eagle 实现 85-95% 的接受率,而 Medusa 为 60-80%。</td></tr></table>

## 1.15.5 N-gram 投机解码

<table><tr><td>N-gram 查找方法</td></tr><tr><td>最简单的投机解码——无需额外模型或训练:</td></tr><tr><td>1. 维护一份来自 Prompt 与已生成文本的 n-gram 缓存</td></tr><tr><td>2. 每一步检查当前上下文的最后 n - 1 个 token 是否匹配缓存中的任一 n-gram</td></tr><tr><td>3. 若匹配:将其后继作为草稿 token 提议</td></tr><tr><td>4. 像往常一样在目标模型上进行验证</td></tr><tr><td>最佳场景:代码生成(重复模式)、结构化输出(JSON/XML),以及带有重复元素的 Prompt。成本:基本为零。</td></tr></table>

## 1.15.6 与 vLLM 的集成

```python
from vllm import LLM, SamplingParams

# 标准投机解码（独立的草稿模型）
llm = LLM(
    model="meta-llama/Llama-3-70B",
    tensor_parallel_size=4,
    speculative_config={
    "model": "meta-llama/Llama-3-8B",
    "num_speculative_tokens": 5,
    },
)

# N-gram 投机（零成本，无需草稿模型）
llm = LLM(
    model="meta-llama/Llama-3-70B",
    speculative_config={
    "method": "ngram",
    "num_speculative_tokens": 5,
    "prompt_lookup_max": 4, # 从 Prompt 中匹配最长 4-gram
    },
)

# EAGLE 风格（特征级草稿，高接受率）
llm = LLM(
    model="meta-llama/Meta-Llama-3-8B-Instruct",
    tensor_parallel_size=4,
    speculative_config={
    "model": "yuhuili/EAGLE-LLaMA3-Instruct-8B",
    "num_speculative_tokens": 2,
    "method": "eagle",
    "draft_tensor_parallel_size": 1,
    },
)

# MLP 推测器（IBM 风格，轻量预测头）
llm = LLM(
    model="meta-llama/Meta-Llama-3.1-70B-Instruct",
    tensor_parallel_size=4,
    speculative_config={
    "model": "ibm-ai-platform/llama3-70b-accelerator",
    "draft_tensor_parallel_size": 1,
    },
)
```

## 何时不该使用投机解码

- 高批量：当 batch ≥ 64 时，生成本身已经计算密集。投机解码引入的开销（草稿生成 + 验证）得不偿失。

- 分布差异过大：若草稿模型与目标模型差异过大，接受率会跌至 50% 以下，反而比标准解码更慢。

- 短输出：对少于 20 个 token 的输出，投机解码的启动开销超过收益。

- 经验法则：投机解码对延迟敏感的单流生成（聊天机器人、交互式代码补全）帮助最大。

## 1.16 幻觉检测

LLM 会生成流畅但可能事实错误的文本——这种现象称为幻觉（hallucination） [164]。本节介绍在模型层面（不依赖外部检索或多智能体校验）的基本检测方法。

## 1.16.1 幻觉的类型

## 幻觉分类法

- 内在型（Intrinsic）：与所提供的输入/上下文矛盾（例如摘要与原文相反）

- 外在型（Extrinsic）：生成无法从输入验证的陈述，且事实上错误

- 忠实性（Faithfulness）：输出偏离指令或所指定的约束

## 1.16.2 检测方法（模型层级）

Table 1.20: 在模型层面运作的基础幻觉检测方法。

<table><tr><td>方法</td><td>机制</td><td>信号</td></tr><tr><td>Token级熵</td><td>生成时的高熵表示不确定[175]</td><td> $H(P(x_t)) > \tau$ </td></tr><tr><td>序列对数概率</td><td>输出的平均对数概率较低提示存在虚构</td><td> $\frac{1}{T} \sum_{t} \log P(x_t)$ </td></tr><tr><td>一致性采样</td><td>生成N个回复;一致性低=可能幻觉[249]</td><td>矛盾率</td></tr><tr><td>语义熵(Semantic Entropy)</td><td>对语义(而非字符串)聚类;语义熵高=不确定[193]</td><td>聚类多样性</td></tr><tr><td>DoLA</td><td>对比后层与前层的logits;放大事实知识[58]</td><td>层间差异</td></tr></table>

语义熵（Semantic Entropy）。 Kuhn 等人 [193] 观察到 token 级熵并不可靠（同义改写包含不同 token 但意义相同）。他们改为生成多个回复，按语义等价（通过 NLI）聚类，并在语义聚类上计算熵：

$$
S E = - \sum_ {c \in \mathrm{clusters}} P (c) \log P (c)
$$

高 SE 意味着模型产生语义不同的答案——这是强烈的幻觉信号。

SelfCheckGPT。 Manakul 等人 [249] 通过检查自一致性来检测幻觉：生成多个回复并验证主回复中的陈述是否被其他回复支持。若模型 “自相矛盾”，则该陈述很可能是幻觉。无需外部知识。

按层对比解码（Decoding by Contrasting Layers，DoLA）。 Chuang 等人 [58] 观察到事实知识在 Transformer 较深的层中浮现，而较早的层保留更多通用/不确定的表示。DoLA 在每个解码步上对比较深（“成熟”）层与较早（“未成熟”）层的 logits 分布：

$$
\mathrm{DoLA} (x _ {t}) = \mathrm{softmax} (\log P _ {\mathrm{late}} (x _ {t}) - \log P _ {\mathrm{early}} (x _ {t}))
$$

通过放大深层中事实知识所编码的信号，DoLA 在推理时降低幻觉，无需重新训练——只需对对比层进行一次额外的前向传递。它与基于采样的方法互补，可以与之结合使用。

## 模型层级检测的局限

这些方法检测的是不确定性，而非错误性。模型可能自信地犯错（低熵、一致的回复——但事实上错误）。要实现可靠检测，应结合基于检索的验证（RAG）或外部事实核查工具。

## 1.17 LLM 安全与负责任 AI

安全并非事后补救——它是 LLM 训练流水线不可或缺的一部分。本节涵盖 LLM 安全的关键维度以及用于强制负责任行为的机制。

Table 1.21: LLM 安全威胁类别。

<table><tr><td>类别</td><td>描述与示例</td></tr><tr><td>有害内容</td><td>生成有毒、暴力或非法的指令(生物武器、CSAM)</td></tr><tr><td>偏见与歧视</td><td>延续刻板印象;在不同人口群体间的不公正对待 [104]</td></tr><tr><td>隐私侵犯</td><td>泄露训练数据中的 PII;记忆攻击 [39]</td></tr><tr><td>越狱(Jailbreaking)</td><td>绕过安全护栏的对抗性 Prompt [443]</td></tr><tr><td>虚假信息</td><td>生成令人信服但虚假的陈述(规模化的幻觉)</td></tr><tr><td>双重用途</td><td>合法能力(编程、化学)被武器化用于伤害</td></tr></table>

## 1.17.1 威胁分类

## 1.17.2 安全训练流水线

![](../images/33275303e62b4cf440232cb82892223e203349c269bb117fbeda84eaad751193.jpg)

*Figure 1.14: 安全贯穿每个阶段：预训练中的数据过滤、SFT 中的拒答示例、RLHF 中专门的安全奖励模型，以及迭代式红队测试。*

## 1.17.3 关键安全机制

## 安全技术

- 数据过滤：从预训练语料中剔除有毒、有偏见以及含 PII 的文本

- 安全 SFT：在恰当拒答的示例上训练（“我无法帮你做这件事，因为⋯⋯”）

- 宪法 AI（Constitutional AI） [16]：基于原则进行自我批评（Self-Critique）；模型依照部规则宪法修订自身输出

- 安全奖励模型：基于安全标注配对训练独立的 RM；在 RLHF 中通过加权和与 helpfulnessRM 结合

- 护栏（Guardrails）：在服务时拦截有害请求/回复的输入/输出分类器

- 红队测试（Red teaming） [290]：系统性的对抗评估，在部署前发现失效模式

## 1.17.4 有用性与安全性的权衡

## 在有用性与安全性之间平衡

对安全的过度优化会带来过度拒答问题：模型拒绝无害的请求（例如在教育语境中拒绝讨论历史暴力）。目标是一个帕累托最优策略，在安全约束之内最大化有用性：

$$
\max _ {\theta} \mathbb {E} [ R _ {\mathrm{helpful}} ] \quad \text { subject   to } \quad \mathbb {E} [ R _ {\mathrm{safety}} ] \geq \tau
$$

在实践中，这通过加权奖励实现： $R = \alpha R _ { \mathrm { h e l p f u l } } + ( 1 - \alpha ) R _ { \mathrm { s a f e t y } }$ ，并仔细调整 α（通常 0.6–0.8）。Meta 的 Llama-3 报告称使用独立的安全与有用性奖励模型，并采用基于 margin 的加权 [118]。

## 1.17.5 评测

- 安全基准：ToxiGen、RealToxicityPrompts、BBQ（偏见）、CrowS-Pairs

- 越狱鲁棒性：GCG 攻击 [443]、多轮越狱、编码型 Prompt

- 过度拒答率：度量无害 Prompt 上的假阳性拒答（目标 <5%）

- 红队评估：由领域专家（生物安全、网络安全）执行的人类对抗性测试

## 安全永无完结

任何技术组合都无法提供绝对的安全。新的攻击向量不断被发现（多模态越狱、剥除安全训练的微调攻击、many-shot prompting）。安全需要持续监控、对新威胁的快速响应，以及纵深防御（多层独立防线）。
