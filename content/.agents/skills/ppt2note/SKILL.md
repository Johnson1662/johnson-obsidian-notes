---
name: ppt2note
description: Convert course PPT/PDF courseware into the house-style Markdown chapter note (mind map + tables + formulas) inside this Quartz repo. Use when the user says "整理第N章", "PPT转笔记", "课件整理", "ppt2note", or asks to turn raw/ppt/*.pdf into a verified note. Covers mineru extraction, table recovery from HTML, page-image cross-check of every number, KaTeX-safe LaTeX, and a render-verification gate.
---

# PPT2Note

把课件 PPT（`raw/ppt/N 章名.pdf`）转成一篇可发布、能渲染、数字有来源的章节笔记（`N 章名.md`）。

本 skill 记录的是**已在第 1–4 章跑通的固定流程**，按顺序执行即可；每一步都有"验收点"，不通过不要进入下一步。

## 硬约束

- **保留全部实质内容**：知识点、定义、定理、例题、练习、公式、数据表、关键图。
- **只删**：重复页（教师信息、重复大纲、封面、版权页）、页眉页脚页码、装饰图/商品图/表情、乱码占位符。
- **公式只修不删**：补回 LaTeX 语法，不丢内容。
- **数字必须有来源**：每个进笔记的数字要么来自 mineru 结构化输出，要么来自页面图（Step 4）。**禁止**用"教材常见例子"的记忆补数字——课件例子的数据经常与教材不同。
- **中文进数学必须 `\text{}`**，否则 KaTeX 会报警/渲染异常（详见 Step 6 清单）。

## Step 1 定位素材并预检

| 项   | 位置                                                       |
| ---- | ---------------------------------------------------------- |
| 源   | `<repo>/content/<课程目录>/raw/ppt/N 章名.pdf`             |
| 产出 | `<repo>/content/<课程目录>/N 章名.md`                      |
| 参考 | 同目录已有章节笔记（学它们的段落骨架与语气，别另起风格）    |

```bash
pdfinfo "raw/ppt/N 章名.pdf" | grep -E 'Pages|File size'   # 页数
ls -l "raw/ppt/N 章名.pdf"                                  # 体积
mineru-open-api auth --show                                 # token 是否已配（只看 Token source，别回显 Token）
```

选命令：

| 条件                  | 命令                                                       |
| --------------------- | ---------------------------------------------------------- |
| ≤10 MB 且 ≤20 页      | `flash-extract`（免 token、仅 Markdown）                    |
| 超限（课件常态）      | `extract`（需 token；`mineru-open-api auth` 配置）          |

基线：113 页 / 5.8 MB 的 PPT 用 `extract` 约 70 s 出结果。

## Step 2 mineru 抽取（后台跑）

```bash
mkdir -p /tmp/chN && cd "<repo>/content/<课程目录>/raw/ppt"
mineru-open-api extract "N 章名.pdf" --model pipeline -f md -o /tmp/chN/mineru > /tmp/chN/mineru.log 2>&1
```

- `--model pipeline`：**无幻觉**优先，适合课件里的数字（`vlm` 布局更准但可能编造文本）。数字准确性 > 版面美观。
- 长任务丢后台（async / `timeout: 0`），**不要前台等**；跑的同时做 Step 3、Step 4。
- 产物：`/tmp/chN/mineru/N 章名.md`（含 `<table>` HTML 与 `images/`）。

## Step 3 用脚本恢复表格（不要用 read 直读）

mineru 把表格写成 `<table>…</table>`，单行可达数千字符，`read` 会截断到 768 字符——**直接 read 会丢列**。改用脚本把表格转成行：

```python
import re
src = open('mineru/N 章名.md', encoding='utf-8').read()
for i, t in enumerate(re.findall(r'<table>.*?</table>', src, re.S)):
    print(f"--- T{i}")
    for r in re.findall(r'<tr>(.*?)</tr>', t, re.S):
        cells = re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)
        print("   ", ' | '.join(c.strip() for c in cells))
```

这一步能还原被画面拆散的表格（例：Apriori 例的 TID/Items、FP-tree 频率表、推荐算法范式表），也是判断"哪张表属于哪一节"的可靠依据。

## Step 4 图版页必须看图核数

```bash
pdftoppm -r 100 -png "N 章名.pdf" /tmp/chN/p      # 113 页约 20 s
```

只读"有例子 / 矩阵 / 树 / 时间线 / 图例"的页（关联规则章用到 23、32–40、42–43、53、66、68–73、89、94、100）。规则：

- 抽样核验并**独立复算**能算的数值。例：物品 1 与物品 2 的余弦相似度 $=12/(\sqrt{57}\cdot\sqrt{34})\approx0.27$，与课件标注一致才写进笔记。
- 若 PPT 图例只剩结论、中间数字在文本层丢失：写结论，并在正文标明是课件结论；**不要编造**中间值。
- `pdftotext` 的裸文本会把同一行不同文本框的字串混（例 `I1,13,14` 实为 `I1,I3,I4`），**不可作为数据来源**。

## Step 5 按固定骨架写笔记

七段式（第 1–4 章统一使用，保持可预测）：

1. `# N 章名` + **一句话总纲**：讲清这一章的因果主线（为什么有这章、按什么顺序解决）。
2. `## 总览（思维导图）`：LaTeX 花括号树（`\begin{array}` + `\begin{cases}`），一屏内看完这一章。
3. `## 考点权重` 表：`模块 | 真正需要掌握 | 优先级`。
4. 正文体：`# N.M 名称` / `## N.M.K 名称`，**编号与课件一致**。
5. `###` 粒度放"定义表 / 对比表 / 算例 / 陷阱"；能做成表的一律做表。
6. `# N.5 本章小结`：花括号 array 两列概括。
7. `# N.6 考前速查表`：`题目出现 | 立刻想到` 逐条映射，末行给"复习时间分配建议"。

补充约定：

- 课件**小节跳号**（例 4.2.3 直接到 4.2.6）要在文首用 `>` 引用块注明"不是漏抄"。
- 伪代码、树形结构用 fenced `text` 代码块（保留 ASCII 树与缩进），不要塞进 KaTeX。
- 需要"看图才懂"的流程（评分矩阵→相似度、树→条件模式基）用表格给出数值，文字里给公式与直觉。

## Step 6 验证门（缺一不可）

```bash
# a) KaTeX strict：0 警告（display 块 + 行内）
#    JS eval 里 import repo 的 katex，逐块 renderToString({throwOnError:true, strict:(c,m)=>warn.push(m)})
#    import('/home/johnson/quartz-repo/node_modules/katex/dist/katex.mjs')
#    同时扫描 table 行内 $…$ 是否含裸 |（会破表）
# b) 格式化
npx prettier "content/<课程目录>/N 章名.md" --write && npx prettier "content/<课程目录>/*.md" --check
# c) 构建
npx quartz build            # 成功标志：Emitted N files / Done processing
# d) 渲染实测（浏览器）
#    browser.open file://<repo>/public/<课程目录>/N-章名.html
#    量每个 .katex-display > .katex > .katex-html > .base 的宽度 vs 正文列宽（本站 741–850px）
#    检查 .katex-error 计数必须为 0、pre>code 无横向滚动、截图确认花括号树完整
```

KaTeX 安全清单（本次全部踩过）：

| 规则 | 说明 |
| ---- | ---- |
| 中文进数学 | 一律 `\text{中文}`；`\qquad` 后面的中文同样要包 |
| 圈码 | KaTeX 无 ①②③ 字体 → 写 `(1) (2) (3)` |
| 标点 | 全角标点、顿号不进数学；数学里用 `,` `\ ` 分隔 |
| 管道符 | 表格单元格内的数学禁用 `|`，用 `\lvert D\rvert`（否则破表） |
| 宽度 | 思维导图每嵌套一层都加宽；正文列宽 741px，单行控制在 ~600px 内，超了就拆行 |
| 可用 | `cases`、`array`、`\xrightarrow`、`\lvert`、`\varnothing`、`\Rightarrow`、`\dfrac`、`\left. … \right\}` |

## Step 7 收尾

- 删临时目录：`rm -rf /tmp/chN`（页面 PNG + mineru 中间产物；**不要留在仓库里**）。
- `git status --porcelain` 看改动范围；本仓库 Obsidian 备份插件会自动 commit，跨分钟的编辑可能被拆成多个 commit（正常），确认 HEAD 里已有该笔记即可。
- 交付回复三段：**结构/编号对齐表** + **恢复的关键数据表（含来源）** + **验证证据**（katex 0 警告、prettier、build、宽度实测值、截图结论）。

## 无视觉能力时

模型看不了图时用 `scripts/vision_tag_images.py` 预打标，再读 `image_tags.json` 决定图片去留：

```bash
python scripts/vision_tag_images.py --dir /tmp/chN/mineru/images --model google/gemma-4-31b-it:free
```

（需 `OPENROUTER_API_KEY`；输出 `filename / description / tag: KEEP|DELETE / reason`。）无视觉时 Step 4 的图片核对退化为"只保留课件原文结论"，并明确告知用户此限制。

## 反例（本次踩过的坑）

- 用 `read` 直读 mineru 的表格行 → 768 字符截断丢列；必须走 Step 3 脚本。
- 信 `pdftotext` 的裸文本 → `I1,13,14` 其实是 `I1,I3,I4`，表格串行。
- 前台等 113 页的 extract → 白等；后台跑 + 并行看页面图。
- 表格单元格写 `$|D|=10$` → 破表；用 `\lvert D\rvert`。
- 一次 `apply_patch` 里把"同一段新增内容的行"又当成另一个 hunk 的上下文 → 匹配失败；新增内容的锚点要用**原有行**。
- 思维导图不量宽度就交付 → 溢出正文列（需要拆行或减少嵌套）。

## 示例调用

```
用户：继续整理第五章
AI：
1. pdfinfo + ls 预检 → 选 extract --model pipeline（后台）
2. 脚本还原 <table> → 关键表格；pdftoppm 渲染 → 读图版页核数（复算能算的）
3. 按七段式写 content/课程/数据挖掘/5 XX.md（编号对齐课件，跳号注明）
4. 验证门：katex strict 0 警告 → prettier --check → quartz build → 浏览器量宽度 + 截图
5. rm -rf /tmp/ch5；回复三段（结构对齐 / 恢复数据 / 验证证据）
```
