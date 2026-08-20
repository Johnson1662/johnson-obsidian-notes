# Lecture 13：数据来源与数据集（Data Sources & Datasets）

> 本讲回答一个常被过度简化的问题：**语言模型到底在什么数据上训练？**
> 课程主线是：在线服务 → 抓取/数据转储 → 文本转换、过滤与去重 → 训练数据集。数据不仅决定模型能学到什么，也决定模型的版权风险、偏见、隐私与安全边界。

## 1. 数据在训练流程中的位置

上一部分课程假设“给定数据，如何训练模型”；本讲和下一讲讨论“什么数据值得训练，以及如何得到它”。

### 1.1 三个训练阶段

从原始数据到最终聊天模型，通常存在三个阶段（边界并不绝对，现代模型可能有更多阶段）：

1. **预训练（pre-training）**：在网页文档、书籍、代码等大规模原始文本上训练，得到基础模型。
2. **中训练（mid-training）**：继续使用更高质量、更长上下文或更专业的资料，增强特定能力。
3. **后训练（post-training）**：使用对话、指令、偏好数据或强化学习，使模型遵循指令、表现得更安全有用。

总体趋势是：训练越往后，数据量从“巨大、质量参差不齐”变成“较小但质量更高”。

| 名称 | 训练结束后的模型 | 典型数据 |
| --- | --- | --- |
| **Base model（基础模型）** | 预训练 + 中训练 | 下一词预测用的网页、书籍、论文、代码 |
| **Instruct/Chat model（指令/聊天模型）** | 基础模型 + 后训练 | 指令—回答、对话、偏好比较、RL 轨迹 |

> 越来越多发布的“开放权重模型”直接是指令模型，而不是基础模型；例如课程材料举出 Qwen3.5-397B-A17B 这一类模型。

### 1.2 为什么数据工作是核心竞争力

- 开源权重模型通常会公开架构、训练阶段甚至训练超参数，却很少完整公开训练数据。
- 保密原因主要是：
  1. 数据本身是竞争优势；
  2. 数据版权与许可可能带来法律责任。
- 早期 NLP 的数据工作主要是给监督学习标注大量标签；基础模型时代虽然少了人工标签，却增加了抓取、转换、质量筛选、毒性过滤、去重、配比和合成数据工作。
- 数据是一个**长尾问题**：它随着人工审查、规则设计、领域知识与数据治理投入增长，不能像架构或系统优化那样简单复制扩张。

---

## 2. 原始数据从哪里来

### 2.1 “在整个互联网训练”并不准确

更准确的说法是：模型通常使用**公开万维网（public web）的一部分快照**。互联网是可连接的实时服务，而训练需要固定、可重复读取的数据文件。

典型实时访问：

```bash
curl https://cs336.stanford.edu/
```

训练系统不能直接在每个 batch 中访问实时网页，因此需要 **crawler（爬虫）**：

1. 从种子 URL 集合开始；
2. 下载页面；
3. 解析页面中的超链接并加入队列；
4. 按选择、礼貌和重访策略继续抓取。

### 2.2 抓不到、不能抓与不应抓

#### 动态内容

- 许多网站是应用而不是静态文档；URL 不变，但内容需要点击按钮、提交表单或运行 JavaScript 才出现。
- 例子：Discord、Weights & Biases（wandb）等。

#### 身份验证与付费墙

需要登录甚至付费才能访问的内容无法作为公开网页直接抓取：Facebook、X、LinkedIn、New York Times 等都存在大量“围墙花园”内容。

#### 技术限制

- `robots.txt` 可以声明不允许某些爬虫访问（通常是自愿协议，例如 NYT 的 robots 文件）。
- Cloudflare 等服务会检测机器人、要求 CAPTCHA；网站也可能封禁 IP/国家或设置速率限制。
- 爬虫若不遵守礼貌策略，会增加服务器负载、降低网站服务质量并产生额外成本。

#### 法律与合同限制

- 网站服务条款（ToS）可能禁止机器人下载或复制内容。
- 即使技术上能下载，也未必拥有复制网页并用于训练的许可。
- **Decline of Consent** 研究检查了 C4、RefinedWeb、Dolma 中 URL 的 robots.txt 与 ToS 限制，发现相关限制随时间增加。

### 2.3 影子图书馆

影子图书馆在技术上属于互联网数据，但常常绕过付费墙并无视版权：Library Genesis（LibGen）、Z-Library、Anna’s Archive、Sci-Hub 等。

- 会收到下架要求、诉讼，或在不同国家被封锁；常通过跨国服务器规避控制。
- 支持者认为它使本应自由获取的知识变得可访问；从法律角度看，绕过版权并复制作品属于盗版/侵权。
- 课程材料给出的规模：LibGen 约有 400 万本书（2019），Sci-Hub 约有 8,800 万篇论文（2022）。

**小结**：互联网巨大，但能访问、能合法复制、愿意承担服务器负载的部分只是其中一小部分。

---

## 3. 版权、许可与合理使用

### 3.1 知识产权法的目标与版权对象

知识产权制度的目标是激励创作与传播，主要包括版权、专利、商标和商业秘密。

版权法（美国体系中的关键概念）：

- 英国《安妮法案》（Statute of Anne，1709）是早期政府与法院规制版权的里程碑；美国现行基础是 1976 年《Copyright Act》。
- 版权保护的是“固定在有形媒介中、具有原创性的作者作品”，使其可以被感知、复制或传播。
- 版权保护**表达**而不是抽象思想：例如快速排序的思想不受版权保护，但某份具体实现代码的表达可能受保护。
- 单纯的事实集合通常不是原创作品（电话簿是经典例子），但有创造性的选取或编排可能获得保护。
- 注册不是版权产生的必要条件；作品一经创作并固定通常即受保护。注册是起诉侵权前的程序要求（课程材料列出费用约 65 美元）。
- 保护期届满后作品进入公共领域；课程材料用 75 年作概括例子，并举出莎士比亚、贝多芬及 Project Gutenberg 中的大量作品。

因此，“网上公开可见”不等于“没有版权”：**互联网中基本所有内容都可能受版权保护**。

### 3.2 两条常见合法路径

1. **获取许可（license）**：许可方承诺在约定范围内不因使用而起诉；许可来自合同法，并不等于作品进入公共领域。
2. **主张合理使用（fair use）**：美国版权法第 107 节要求综合判断以下四因素：
   - 使用的目的与性质：教育用途通常更有利，转换性使用通常比原样复制更有利；
   - 作品性质：事实性、非创作性作品通常更有利；
   - 使用的数量与实质性：使用片段通常比整部作品更有利；
   - 对原作品现有或潜在市场的影响。

合理使用的常见例子：观看电影后写摘要；重新实现算法思想而不是复制代码；Google Books 索引书籍并显示片段（Authors Guild v. Google，2002—2013）。

版权不是“模型是否逐字记住”的简单问题：情节和角色等语义内容也可能受保护；讽刺模仿通常更可能属于合理使用。法律评价同时关注**语义、用途与经济影响**。

### 3.3 对语言模型训练的具体含义

- 训练第一步会复制数据；即使后续不公开模型，复制本身也可能是争议点。
- 训练应当是转换性的，而不是把网页直接复制粘贴给用户。
- 模型应该学习一般思想（例如“巫师”这一概念），而不是复现具体表达（例如《哈利·波特》的长段落）。
- 模型仍可能影响作者、艺术家的市场，因此“是否影响市场”不能忽略。
- **ToS 是额外约束**：即便作品有 Creative Commons 许可，平台条款也可能禁止下载。例如 YouTube 可能禁止下载视频，不能仅凭视频采用 CC 许可就绕过 ToS。

### 3.4 诉讼与不确定性

课程材料列举了当时的主要争议：

- *The New York Times v. OpenAI*（2023）：涉及训练及复现 NYT 文章的指控。
- 作者（Bartz、Graeber 等）诉 Anthropic（2024）：指控盗版数百万本书并用于训练；2025 年简易判决认为在该案事实下训练使用属于合理使用，但制作盗版副本即使不训练也不属于合理使用；Anthropic 购买并扫描图书的行为被认为可能合理，但时机已晚；后以约 15 亿美元和解。
- 作者（Kadrey、Silverman 等）诉 Meta：针对 Llama 论文披露的图书训练数据；2025 年判决在该案情形下认为训练使用属于合理使用，但通过 torrent 获取图书的指控仍待处理。

结论：目前部分个案支持训练的合理使用，但不能推广成普遍安全港；盗版图书本身风险明确，法律仍在快速演化。

### 3.5 Creative Commons 与许可数据

Creative Commons 由 Lessig 与 Eldred 于 2001 年创建，用许可条款在公共领域与完整保留版权之间提供中间方案。典型开放资源包括 Wikipedia、OpenCourseWare、Khan Academy、Free Music Archive，以及 Flickr、MusicBrainz、YouTube 等平台上采用开放许可的内容。

模型开发者也可能直接购买数据许可，例如 Google 与 Reddit、OpenAI 与 Shutterstock、OpenAI 与 Stack Exchange 的合作。许可要看具体数据、用途、地域、再分发权限与条款，不能把“开放网站”当成统一许可证。

---

## 4. Common Crawl：公共网页快照的基础设施

### 4.1 规模与抓取流程

[Common Crawl](https://commoncrawl.org/) 是 2007 年成立的非营利组织，约每月运行一次网页爬取：

- 每次增加约 30—50 亿网页；不同 crawl 有重叠，但会尽力扩大覆盖；累计约 3,000 亿页面。
- URL 总数难以估计，量级至少是数十亿；Google 搜索索引至少 100 PB。
- 课程材料给出的 2026 年 4 月 crawl：21.9 亿页面、372.2 TB。
- 抓取使用 Apache Nutch。流程是从至少数亿种子 URL 开始，取出一个 URL、下载页面、把页面链接放回队列。

#### 爬虫策略

| 策略 | 需要决定的问题 |
| --- | --- |
| 选择策略（selection） | 哪些页面值得下载？ |
| 礼貌策略（politeness） | 是否遵守 robots.txt？如何避免压垮服务器？ |
| 重访策略（revisit） | 页面多久检查一次变化？ |

URL 可能是动态的，许多不同 URL 最终指向几乎相同内容，造成大量冗余。

### 4.2 Common Crawl 的文件格式

#### WARC：原始归档

**WARC（Web ARChive）** 保存 HTTP 请求/响应及相关元数据，通常含原始 HTML、状态码、Header、URL、时间戳等。它最接近抓取现场，适合重新设计 HTML→文本转换和审计来源，但体积大、解析成本高。

#### WAT：元数据/链接信息

**WAT（Web Archive Transformation）** 是从 WARC 提取的结构化元数据，常包括页面 Header、链接、HTML 元数据、文本统计等，而不是完整网页正文。它适合分析站点图谱、URL 与链接关系、抓取质量，而不是直接作为语言模型的训练文本。

#### WET：纯文本转换结果

**WET（Web Extracted Text）** 是将 WARC HTML 转换为文本后的有损结果。导航栏、广告等 boilerplate 通常会被移除，但表格、图片、代码、布局和部分上下文可能丢失。

| 格式 | 保存内容 | 优点 | 代价/用途 |
| --- | --- | --- | --- |
| WARC | 原始 HTTP 响应 | 信息最完整，可重处理 | 体积大、转换成本高 |
| WAT | Header、链接和抽取元数据 | 轻量、适合链接/元数据分析 | 没有完整正文 |
| WET | HTML→文本结果 | 直接供文本管线使用、较小 | 有损，转换质量影响下游 |

### 4.3 HTML→文本为何会改变模型能力

常用规则工具包括 `trafilatura`、`resiliparse`、`jusText`、`lynx` 等。它们需要：

- 删除导航、广告、页脚等 boilerplate；
- 识别并保留主要正文；
- 对图片、表格、列表、代码和标题做线性化；
- 处理编码、脚本、异常 HTML。

这是有损转换；DCLM 的分析表明，WET 的不同转换方式会改变保留的 token 数量，也会改变下游任务准确率。因此研究者有时从 WARC 重新处理，而不是盲目使用 WET。

---

## 5. 专门化数据源

### 5.1 Wikipedia

- 2001 年建立的免费在线百科全书；读者可以随机访问文章，也可以下载每隔几周发布的官方 dump，无需自己爬取。
- 截至课程材料所列 2026 年 5 月统计：361 个语言版本、约 6,700 万篇文章；英语、西班牙语、德语、法语最常见。
- 不应包含原创观点、宣传、个人主页等；文章需要满足可靠来源支持的 notability（显著性）。
- 任何人都可编辑，管理员会回滚破坏；少数高活跃编辑贡献了大多数修改（材料举例 Steven Pruitt 约 500 万次编辑）。

**数据投毒风险**：攻击者可在 dump 生成前注入恶意编辑，待模型抓取后再回滚。已有研究用触发短语（例如 iPhone）注入负面情感样本。即使数据源整体高质量，也必须检查时间窗口、编辑历史和异常内容。

### 5.2 GitHub 与软件代码

代码不仅服务编程任务，也可能帮助推理（课程材料称为一种 folklore 观察）。

- GitHub 2008 年成立、2018 年被 Microsoft 收购；课程材料所列 2026 年 5 月规模为 4.2 亿以上仓库，其中约 2,800 万个公开仓库。
- 仓库包含目录结构、提交历史、Issue、Pull Request、评论等；复制代码、fork 会制造大量重复。
- 公开仓库能否训练取决于许可证；MIT、Apache 等宽松许可证通常更适合，但要按仓库、文件和衍生物逐项审查。
- **仓库数据**应通过 git 协议下载，而不是抓 GitHub 网页；**元数据**可通过 GitHub API 或 GitHub Archive 的事件流快照获取。

Software Heritage 是 2016 年成立的非营利软件保存组织，聚合 GitHub、GitLab、Bitbucket、PyPI 等，重点保存仓库/源文件而非 Issue、评论等元数据。课程材料所列截至 2026 年约有 2,880 万源文件。

### 5.3 arXiv

- 1991 年起为研究者免费分享论文；早期以物理为主，后覆盖数学、计算机科学、统计学等。
- 约 300 万次投稿；一条提交包含元数据、PDF，可能还包含 LaTeX 源码。
- 只有轻量审核，不等同于同行评审。
- 作者可以选择保留全部权利或使用 CC 等许可；标题、摘要元数据采用较宽松的 CC0。
- 可从 Amazon S3 批量下载，不必爬网页；LaTeX 源码比从 PDF OCR 更适合提取公式和引用。

### 5.4 BERT 与 BooksCorpus

BERT 的训练数据包括 Wikipedia 与书籍；训练序列按**文档**组织，而不是把句子打散。与 10 亿词 benchmark（大量机器翻译句子）相比，文档边界保留了跨句上下文。

BooksCorpus 来自 Smashwords 自出版电子书：

- Smashwords 2008 年成立，允许个人自出版；课程材料列出 2024 年约 15 万作者、50 万本书；
- BooksCorpus 抓取价格为 0 的书，约 7,000 本、9.85 亿词；
- 后因违反 Smashwords 服务条款被下架。

### 5.5 GPT-2 WebText 与 OpenWebText

**WebText** 使用 Reddit 帖子外链作为质量代理：只保留 karma ≥ 3 的链接，约 800 万页面、40 GB 文本。

**OpenWebTextCorpus** 是开放复现：

- 从 Reddit submissions 数据集中提取所有 URL；
- 用 Facebook fastText 分类器过滤非英语；
- 删除近重复。

Reddit 的 karma 不是内容质量的充分条件，网页覆盖也不完整；但“由用户主动推荐的链接”提供了一种弱监督质量信号。

### 5.6 CCNet

CCNet 的目标是自动构造大规模高质量预训练数据，特别关心 Urdu 等低资源语言。

三个组件：

1. **去重**：轻量标准化后按段落删除重复；
2. **语言识别**：运行 fastText language-ID，只保留目标语言；
3. **质量筛选**：使用 KenLM 5-gram 语言模型，保留看起来像 Wikipedia 的文档。

用 CCNet(Common Crawl) 训练的 BERT 超过仅 Wikipedia 训练的基线。CCNet 既指论文发布的数据，也指开源工具。

### 5.7 C4（Colossal Clean Crawled Corpus）

C4 与 T5 的 text-to-text 统一任务思想一起被广泛引用，但 C4 本身也是重要贡献。

- 观察：Common Crawl 大部分并不是有用的自然语言。
- 起点：2019 年 4 月单次 Common Crawl 快照，约 1.4 万亿 tokens。
- 规则过滤：
  - 只保留以标点结尾且至少有 5 个词的行；
  - 删除少于 3 个句子的页面；
  - 删除包含粗俗词表中任意“bad word”的页面；
  - 删除含 `{`（倾向于代码）、`lorem ipsum`、`terms of use` 等模式的页面；
  - 用 `langdetect` 过滤非英语，英语概率阈值 0.99。
- 结果：约 806 GB、1560 亿 tokens。
- C4 的域名构成分析显示数据高度集中于少数站点；从 OpenWebText 链接构造的 WebText-like 版本使用 12 个 dump 得到 17 GB，而 WebText 是 40 GB，说明 Common Crawl 不是完整网页集合；不过该版本在 GLUE、SQuAD 等任务上提升。

### 5.8 GPT-3 数据集

GPT-3 使用：处理过的 Common Crawl、扩大的 WebText2、未完全披露的互联网书籍 Books1/Books2，以及 Wikipedia；总计约 570 GB、4,000 亿 tokens。

Common Crawl 处理方式：

- 以 WebText、Wikipedia、Books1、Books2 作为正例，从 Common Crawl 取负例；
- 训练质量分类器区分它们；
- 对文档做模糊去重，并与 WebText、评测 benchmark 做重叠去除。

### 5.9 The Pile

The Pile 是 GPT-3 之后开源模型运动的重要产物，由志愿者在 Discord 协调，精心汇集 22 个领域，约 825 GB、2,750 亿 tokens。

| 来源 | 关键内容 |
| --- | --- |
| Pile-CC | Common Crawl；使用 WARC 和 jusText 转文本，转换质量优于直接 WET |
| PubMed Central | 约 500 万篇论文；NIH 资助工作通常有公开要求 |
| arXiv | 1991 年起的预印本，尽量使用 LaTeX |
| Enron 邮件 | 调查公开的约 50 万封邮件，来自 Enron 高层约 150 人 |
| Project Gutenberg / PG-19 | 经过版权清理、主要为公共领域的书籍；PG-19 取 2019 年前书籍 |
| Books3 | 来自影子图书馆 Bibliotik 的约 19.6 万本书，包含 Stephen King、Min Jin Lee、Zadie Smith 等作者作品；因版权诉讼下架 |
| Stack Exchange | 用户问答站点集合；包含用户、投票、评论、徽章、标签元数据，XML dump 已匿名化 |

Stack Exchange 从 2008 年 Stack Overflow 起步，用声望与徽章激励贡献，扩展到数学、文学等主题。问答格式接近指令微调与真实应用，元数据可用于筛选高质量答案（例如按分数排序）。

### 5.10 Gopher 的 MassiveText

Gopher 的模型后来被 Chinchilla 取代，但 MassiveText 的数据描述很有参考价值。

组成：MassiveWeb、C4、书籍、新闻、GitHub、Wikipedia（后四者细节较少）。MassiveWeb 的过滤包括：

- 保留英文、去重、避免训练—测试重叠；
- 手工质量规则而非分类器，例如至少 80% 的词包含字母字符；
- 用 Google SafeSearch 做毒性过滤，不使用简单粗俗词表。

结果约 10.5 TB 文本，但 Gopher 实际只用约 3,000 亿 tokens（约 12%）。

### 5.11 LLaMA、RedPajama 与 SlimPajama

LLaMA 数据约 1.2 万亿 tokens：

- Common Crawl：CCNet；按页面是否被 Wikipedia **引用**分类；
- C4：保留更丰富的网页多样性，但依然是规则过滤；
- GitHub：只保留宽松许可证，并使用手工规则；
- Wikipedia：2022 年 6—8 月、20 种语言，人工过滤；
- Project Gutenberg 与 Books3（取自 The Pile）；
- arXiv：删除评论、展开内联宏、处理参考文献；
- Stack Exchange：28 个最大站点，按答案分数排序。

Together 的 RedPajama v1 复现了这一数据配方。Cerebras 的 **SlimPajama** 从 RedPajama v1 去重得到 6,270 亿 tokens 子集，使用 MinHash-LSH。

### 5.12 RefinedWeb 与 FineWeb

**RefinedWeb** 的中心论点是“网页数据本身就足够”：

- 用 `trafilatura` 从 WARC 而非预转换 WET 中提取文本；
- Gopher 规则过滤，刻意避免 ML 质量分类器以减少偏见；
- 5-gram 上用 MinHash 模糊去重；
- 从 5 万亿 tokens 中发布 6,000 亿 tokens。

**FineWeb** 最初复现 RefinedWeb，之后加入改进：

- 95 个 Common Crawl dump；
- URL 筛选、语言识别（保留 `p(en) > 0.65`）；
- Gopher、C4 与更多手工规则；
- MinHash 模糊去重；
- 匿名化 email 和公开 IP 等个人信息（PII）；
- 结果约 15 万亿 tokens。

### 5.13 Dolma

Dolma 约 3 万亿 tokens，来源包括：

- Pushshift（2005—2023）的 Reddit submissions 与 comments，分别处理；
- PeS2o：来自 Semantic Scholar 的约 4,000 万篇学术论文；
- C4、Project Gutenberg、Wikipedia/Wikibooks。

Common Crawl 处理：fastText 语言识别保留英文；Gopher、C4 规则质量过滤（避免模型质量过滤）；Jigsaw 分类器加规则做毒性过滤；Bloom filter 去重。

### 5.14 DCLM（DataComp-LM）

DCLM 的目标是为数据处理算法建立标准实验平台：

- 将 Common Crawl 处理成 240 万亿 tokens 的 DCLM-pool；
- 用质量分类器过滤得到 DCLM-baseline；
- 正例 20 万：OpenHermes-2.5（大量 GPT-4 生成的指令数据）与 ELI5 问答；
- 负例 20 万：RefinedWeb；
- 在全量 DCLM-pool 上运行 fastText 质量分类器；
- 结果约 3.8 万亿 tokens，质量分类器超过其他过滤方案。

核心转变是：不再只用固定规则，而是定义“好数据”正例/负例，再训练足够快的模型推广到海量池。

### 5.15 Nemotron-CC

FineWebEdu、DCLM 过滤得很激进（约删除 90% 数据），但训练更强模型仍需要更多 tokens，因此 Nemotron-CC 采用“尽量保留质量，同时增加 token”的方向：

- HTML→文本使用 `jusText`，因它保留的 tokens 比 `trafilatura` 多；
- **分类器集成**：让 Nemotron-340B-Instruct 按教育价值给 FineWeb 文档打分，再蒸馏成更快模型，并与 DCLM 分类器组合；
- **合成改写**：低质量数据用 LM 重写；高质量数据用 LM 生成 QA、关键信息抽取等任务。

结果为 6.3 万亿 tokens，其中高质量子集 1.1 万亿；作为参照，课程材料列出 Llama 3 训练约 15 万亿、Qwen3 约 36 万亿 tokens。

### 5.16 The Stack 与 Stack v2

**The Stack**：

- 从 GitHub Archive（2015—2022）得到仓库名；
- `git clone` 约 1.37 亿仓库、510 亿文件，去重后约 50 亿唯一文件；
- `go-license-detector` 只保留 MIT、Apache 等宽松许可证；
- MinHash + Jaccard 去除近重复；
- 最终约 3.1 TB 代码。

**Stack v2** 扩展了结构化软件工程信息：

- GitHub Archive 的 Issue、评论、PR；
- Software Heritage 仓库；
- PyPI、npm、devdocs.io 等网站文档；
- 删除二进制文件、恶意软件和机器人活动，去重、PII 脱敏，并对 PR 进行子采样；
- 将低资源语言（例如 Nim）与共享的低级中间语言 LLVM 配对；
- 纳入 GSM8K、代码竞赛、Stack Overflow、arXiv、Wikipedia、OpenWebMath 等已有数据。

Pull Request 会被线性化成 token 序列，加入 diff 周围的文件上下文并进行子采样。代码数据不仅用于代码补全，也能提供软件工程推理和代理轨迹。

### 5.17 CommonPile：只用许可数据

回顾：

- 互联网绝大多数内容有版权；
- 其中一部分有宽松许可证；
- 受版权保护内容的合理使用仍未完全确定。

CommonPile 研究的问题是：**只用宽松许可数据，能否训练出好的模型？** 它收集约 8 TB 许可数据，模型表现尚可，但若要与大规模未许可数据竞争，通常需要更多 tokens。

需要特别注意：

- **许可洗白（license laundering）**：把受版权保护作品重新发布成宽松许可，自动检测很困难；
- 数据集集合的许可证（如 Dolma 的 ODC-By）不一定延伸到其中每个单独作品；
- 用未许可数据训练的 LM 生成合成数据，再把合成数据用于训练，版权归属仍有争议。

### 5.18 数据集演变速览

| 阶段/数据集 | 规模或代表性 | 主要创新 | 典型局限 |
| --- | --- | --- | --- |
| BERT / BooksCorpus | 约 9.85 亿词 | Wikipedia + 文档级书籍上下文 | 书籍 ToS、规模有限 |
| GPT-2 WebText / OpenWebText | WebText 约 800 万页、40 GB | Reddit karma 作为质量代理，链接去重 | Reddit 覆盖偏差、网页不完整 |
| CCNet / C4 | C4 约 156B tokens | 语言 ID、Wikipedia/KenLM 或规则质量过滤 | 规则启发式、域名集中 |
| GPT-3 | 约 400B tokens | 质量分类器 + 模糊去重 + benchmark 去重 | 来源和书籍细节不透明 |
| The Pile | 约 275B tokens、22 个域 | 开源多领域混合，保留问答/论文/邮件元数据 | Books3 版权问题 |
| Gopher MassiveText | 约 10.5 TB，实际训练 300B | 手工质量规则、SafeSearch 毒性过滤 | 只使用约 12%，细节不完整 |
| LLaMA / RedPajama / SlimPajama | LLaMA 约 1.2T；SlimPajama 627B | 多来源公开复现，MinHash 去重 | 授权范围和复制关系复杂 |
| RefinedWeb / FineWeb | RefinedWeb 600B；FineWeb 15T | 直接从 WARC 处理、MinHash、更多 dump 与 PII 脱敏 | 规则/阈值仍可能误删长尾 |
| Dolma | 约 3T | Reddit、学术论文、C4 等混合；Bloom filter 去重 | 质量与许可需逐来源审计 |
| DCLM | pool 240T → baseline 3.8T | 标准化数据处理实验、fastText 质量分类器 | 正负例分布决定分类器偏差 |
| Nemotron-CC | 6.3T（HQ 1.1T） | 教育价值分类器集成与合成改写 | 高质量子集仍较小 |
| CommonPile | 约 8 TB 许可数据 | 探索只用宽松许可数据训练 | 与超大规模未许可语料竞争需要更多 tokens |

---

## 6. 总结：一条真实的数据供应链

1. 数据不会凭空出现：必须从实时服务构建快照，承担抓取、存储、解析和许可成本。
2. 常见管线是：

   **live service → raw dump/crawl → transformation → filtering → deduplication → mixing → training**

3. WARC 保留原始响应，WAT 保留元数据/链接，WET 是有损纯文本；HTML→文本工具的选择会改变模型下游能力。
4. 数据集演化的总体方向是：
   - 从单一网页/书籍，走向多领域混合；
   - 从固定规则，走向质量分类器、教育价值评分与合成改写；
   - 从“越多越好”，走向质量、重复、PII、毒性和许可证共同治理。
5. 版权、隐私和伦理是数据工程的一部分，而不是训练完成后的附属审查。
6. 绝大部分筛选策略仍然是启发式的：不同领域、模型规模、训练 token 预算对应不同最优选择，数据处理仍有大量改进空间。
