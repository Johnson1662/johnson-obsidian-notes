# Lecture 13 - Pretraining Data (Sources & Datasets)

> **课程主题**：大语言模型预训练数据源体系、数据获取、版权法理与里程碑数据集演进
> **授课教师**：Percy Liang
> **核心目标**：系统掌握大模型预训练语料的采集链路与法律技术边界，深入剖析 Common Crawl 原始格式（WARC/WET），全面梳理从早期 WebText、C4、The Pile 到现代 FineWeb、Dolma、DCLM 与 Nemotron-CC 的演进脉络与配方设计。

---

## 1. 数据获取的现实边界与法律框架

“大模型是在全互联网上训练的”是一种过度简化的说法。现实中爬取并使用数据面临多重硬性约束：

### 1.1 技术与商业壁垒
1. **动态渲染与单页应用 (SPA)**：现代 Web 依赖大量 JavaScript 动态交互与表单提交（如 Discord、Wandb），传统静态爬虫无法获取。
2. **围墙花园与认证鉴权 (Walled Gardens)**：X、LinkedIn、Facebook、NYTimes 将核心内容封锁在登录与付费墙之后。
3. **同意权倒退 (Decline of Consent)**：近年来限制爬虫的 `robots.txt` 与服务条款（ToS）急剧增加，Cloudflare 等防爬验证码（CAPTCHA）层出不穷。

### 1.2 知识产权与合理使用 (Copyright & Fair Use)

- **美国 1976 年版权法**：保护“固定于有形表达媒介上的原创作品”，无需注册即自动享有版权。**互联网上几乎所有内容均受版权保护**。
- **合理使用（Fair Use，第 107 条）四大判断要素**：
  1. **使用目的与性质**：是否具有**转换性（Transformative）**？大模型提取通用语言与世界规律，而非机械复制。
  2. **原作品的性质**：事实性作品优先于虚构/艺术创作作品。
  3. **使用部分的数量与实质性**：使用片段优于全篇抄录。
  4. **对原作品潜在市场价值的影响**：是否与原作品构成直接市场替代竞争。
- **司法诉讼前沿裁决**：
  - *Bartz v. Anthropic (2025)* 与 *Kadrey v. Meta (2025)*：法官初审认定**将合法获取的图书用于模型训练本身构成合理使用**；但通过盗版影子图书馆（Shadow Libraries，如 LibGen, Books3）下载侵权副本仍属违法。
  - 工业界趋势：OpenAI/Google 转向直接与 Reddit、StackExchange、Shutterstock 等大型内容平台签署商业授权许可（Data Licensing）。

---

## 2. 核心原生数据源深度解析

```
                                [ 通用与垂直预训练数据源 ]
  ┌───────────────────────┬───────────────────────┬───────────────────────┐
  ▼                       ▼                       ▼                       ▼
Common Crawl (全网爬取)   Wikipedia (百科实体)    GitHub / Stack (代码/PR)  arXiv / PubMed (学术论文)
WARC / WET (PB级原始网页)  高质量事实 / 投毒防范   Software Heritage / 许可  LaTeX源码 / 数学推理
```

### 2.1 Common Crawl 架构与格式
- **基本规模**：自 2007 年成立的非营利机构，每月执行一次全网抓取（新增 $30 \sim 50$ 亿网页），累计存有超 3000 亿网页，单月快照压缩达数百 TB。
- **三大文件格式**：
  - **WARC (Web ARChive)**：包含完整 HTTP 请求与原始响应（含原始 HTML、响应头、元数据）。
  - **WAT (Web ATtributes)**：仅包含 WARC 中的元数据与超链接结构。
  - **WET (Web Extracted Text)**：Common Crawl 官方提取的纯文本格式（转换较为粗糙）。
- **HTML 文本清洗工具**：**Trafilatura** 与 **Resiliparse** 相比官方 WET 能够大幅剔除网页导航栏、页脚广告与模板噪音，直接显著提升下游模型评测指标。

### 2.2 结构化与学术数据源
- **Wikipedia**：包含 361 种语言的 6700 万词条，通过定期 Dumps 导出；需防范在快照前夕恶意篡改词条的数据投毒（Data Poisoning）。
- **GitHub / The Stack**：代码数据不仅赋能编程，其严格的逻辑结构对通用复杂推理（Reasoning）至关重要。需使用许可证检测工具（如 `go-license-detector`）严格过滤仅保留宽松开源协议（MIT, Apache 2.0）。
- **arXiv & PubMed**：包含数百万篇高质量 LaTeX 源码与生物医学论文，是数理逻辑与专业领域能力的核心源泉。

---

## 3. 里程碑预训练数据集演进史

```
2018 (BERT): BookCorpus (7K 免费图书) + Wikipedia
     │
2019 (GPT-2): WebText (Reddit 高赞链接 40GB) ──> C4 (T5, 806GB 启发式清洗)
     │
2020 (GPT-3): CommonCrawl + WebText2 + Books1/2 (400B Tokens)
     │
2021 (The Pile): EleutherAI 开源 825GB (22 个领域精选，含 Books3, PubMed, arXiv)
     │
2023 (LLaMA-1 / RefinedWeb): RedPajama (1.2T) ──> RefinedWeb (Falcon, 5T 高质量纯网页)
     │
2024-2026 (现代前沿): FineWeb (15T) ──> Dolma (3T) ──> DCLM (3.8T 分类器过滤) ──> Nemotron-CC (6.3T 合成重写)
```

### 3.1 主流数据集核心配方与清洗策略对照

| 数据集名称 | 发布机构/年份 | 数据总量 (Tokens) | 主要数据源构成 | 核心清洗与过滤特色 |
| :--- | :--- | :--- | :--- | :--- |
| **C4 (2019)** | Google (T5) | 156B (806GB) | Common Crawl (2019-04 单快照) | 严苛启发式规则（标点结尾、禁词表、剔除 `{` 括号代码与代码模板） |
| **The Pile (2021)** | EleutherAI | 275B (825GB) | 22 个精选子集（Pile-CC, arXiv, PubMed, GitHub, Books3, Enron） | 首次将预训练语料从纯网页拓展到学术、代码与多元化书籍 |
| **RedPajama / SlimPajama**| Together / Cerebras | 1.2T $\to$ 627B | LLaMA 语料 1:1 开源复刻 | 引入大规模 MinHash LSH 模糊去重，大幅提升训练 Token 密度 |
| **RefinedWeb (2023)**| TII (Falcon) | 5T (开源 600B) | 纯 Common Crawl | 证明**只要经过高质量 Trafilatura 解析与严格 MinHash 去重，纯网页数据即可匹敌精选数据集** |
| **FineWeb (2024)** | Hugging Face | **15T** | 95 个 Common Crawl 快照 | 融合 Gopher + C4 规则、fastText 语言过滤、MinHash 去重与 PII 隐私脱敏 |
| **Dolma (2024)** | AI2 (OLMo) | 3T | Common Crawl, Reddit, PeS2o 论文, Books | 使用 Bloom Filter 实现百亿级 Token 快速去重与 Jigsaw 毒性过滤 |
| **DCLM (2024)** | DCLM 联盟 | 3.8T (源于 240T 池) | Common Crawl | **模型质量分类器过滤**（以 OpenHermes 与 ELI5 为正样本训练 fastText，击败所有传统规则） |
| **Nemotron-CC (2024)**| NVIDIA | 6.3T | Common Crawl | 引入大模型打分蒸馏 + **低质网页合成重写（Synthetic Rephrasing）**，兼顾语料规模与质量 |
| **The Stack v2 (2024)**| BigCode | 3.1TB+ 代码 | Software Heritage + GitHub | 包含完整 Git 提交历史、Pull Request 差异上下文与多语言中间表征 (LLVM) |
| **CommonPile (2025)** | 学术社区 | 8TB | 100% 宽松版权许可数据 | 探索完全合规、无版权争议的纯商业级模型预训练语料基底 |
