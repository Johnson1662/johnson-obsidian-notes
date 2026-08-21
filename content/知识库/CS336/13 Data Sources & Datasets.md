# CS336 Lecture 13: 预训练语料来源、数据格式与数据集演进

大模型的知识与泛化能力 $90\%$ 以上源于预训练数据。算力预算固定时，**预训练数据的多样性、规模与清洗纯度直接决定了模型的上限**。本讲剖析公开网络爬虫数据结构、主流开源预训练数据集的演进脉络及数据合规。

---

## 1. 互联网底层数据源：Common Crawl 体系

[Common Crawl](https://commoncrawl.org/) 是一个非盈利的公开网络抓取项目，每月爬取数十亿网页，是几乎所有大模型（如 GPT-3、Llama 系列、DeepSeek、Qwen）的核心原始语料来源。

```
[ 原始 HTTP 抓取 ] ---> WARC (Web ARChive) : 完整 HTTP 请求/响应报头 + 原始 HTML
                             |
                             v
[ HTML 解析抽取 ]   ---> WAT (Web Archive Transformation) : 网页元数据、DOM 树与超链接
                             |
                             v
[ 正文提取去模版 ]   ---> WET (Web Extracted Text) : 纯文本内容 (去除脚本、CSS 与 HTML 标签)
```

### 1.1 三种核心数据格式对比

| 文件格式 | 全称 | 包含内容 | 单月典型大小 | 大模型数据 Pipeline 使用方式 |
|---|---|---|---|---|
| **WARC** | Web ARChive | 原始 HTTP 响应、状态码、原始 HTML 源码 | $\sim 50 \sim 100 \text{ TB}$ (压缩后) | 自研高级正文提取算法（如基于 DOM 树密度分析）时使用 |
| **WAT** | Web Archive Transformation | 结构化元数据、链接、HTML 标签属性 | $\sim 10 \sim 20 \text{ TB}$ | 用于根据外链声誉、域名权重做网页评分 |
| **WET** | Web Extracted Text | 剥离 HTML 标签后的纯文本文本流 | $\sim 5 \sim 10 \text{ TB}$ | **绝大多数开源数据清洗 Pipeline 的直接起点** |

---

## 2. 开源预训练数据集的代际演化

过去五年中，大模型社区的数据集重心经历了从“**追求大而全**”到“**极致精细化启发式过滤**”再到“**合成数据与教育级质量分类**”的演进：

| 年份 | 数据集名称 | 主导机构 | 规模 (Token 数) | 核心特点与历史贡献 |
|---|---|---|---|---|
| **2020** | **The Pile** | EleutherAI | ~825 GB (约 300B Tokens) | 首次强调**领域多样性**（融合 arXiv, GitHub, PubMed, StackExchange, Wikipedia），奠定早期开源模型基础 |
| **2020** | **C4 (Colossal Clean Crawled Corpus)** | Google (T5) | ~750 GB (约 150B Tokens) | 确立了一套经典的**启发式网页质量过滤规则**（标点过滤、坏词屏蔽、行长度截断） |
| **2023** | **RefinedWeb** | TII (Falcon) | 5.0T Tokens | 证明了**仅依靠对 Common Crawl 严苛的启发式过滤 + 强力 MinHash 模糊去重**，效果可超越多源混合数据 |
| **2023** | **RedPajama (v1 / v2)** | Together AI | 1.2T / 30T Tokens | 完整复刻 Llama 1 数据配方，v2 版本公开了超过 40 种质量评分特征 |
| **2024** | **FineWeb & FineWeb-Edu** | Hugging Face | 15.0T / 1.3T Tokens | **现代开源最高质量预训练数据集之一**。引入基于 Llama-3-70B 标注的教育价值评分分类器（Edu-Score） |
| **2024** | **DCLM (DataComp for LM)** | 多机构联合 | 3.8T Tokens | 构建了严格受控的基准评测闭环，被广泛用于验证过滤策略的 Scaling 效果 |

---

## 3. 预训练语料的垂直领域构成

一个高质量的现代预训练语料库通常包含以下关键领域比例配置：

```
[ 优质通用网页 Common Crawl / RefinedWeb / FineWeb (~50% - 60%) ]
[ 高质量代码 GitHub / StackOverflow / Jupyter (~15% - 20%) ]
[ 学术论文 arXiv / PubMed / 开放获取期刊 (~5% - 10%) ]
[ 高质量书籍 Books3 / Project Gutenberg (~5% - 8%) ]
[ 百科与知识库 Wikipedia / Wikihow (~2% - 5%) ]
[ 合成与增强推理数据 Synthetic CoT / Math (~5% - 10%) ]
```

- **代码数据的作用**：不仅使模型具备编码能力，其严密的语法作用域与逻辑缩进大幅提升了模型在自然语言上的**推理与链式思考能力**。
- **数学与学术论文**：提供高信息密度的专业符号、逻辑推演与形式化定义，抑制模型闲聊幻觉。

---

## 4. 数据版权、合规与使用边界

1. **合理使用原则 (Fair Use)**：在美国判例法下，将公开网络数据用于训练大模型特征表征通常被主张为“转换性使用”（Transformative Use），但诉讼风险持续存在。
2. **Robots.txt 协议**：商业抓取流水线通常尊重网站的 `User-agent: * Disallow` 标记，避免法律争议。
3. **数据商业授权趋势**：前沿机构（如 OpenAI、Google）开始直接向 Reddit、Stack Overflow、各大出版集团购买专属授权的高质量对话与新闻数据。
