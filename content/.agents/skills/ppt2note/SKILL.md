---
name: ppt2note
description: 课件 PPT/PDF → 本仓库的课程笔记（课程级 0 复习总览 + 每章 0 读这一章之前/人话/重画 SVG 图/例题，KaTeX + 渲染验证门；表格只用于真对比、其余分点）。用户说"整理第N章 / PPT转笔记 / 课件整理 / 按语音课那样整理 / ppt2note"时用。
---

# PPT2Note

`raw/ppt/N 章名.pdf` → `N 章名.md`，全课再加一份 `0 复习总览.md`。
按序执行；每一阶段都有可检查的产出，不靠"看起来对"。

## 脚本

| 脚本                             | 作用                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/mdcheck.py <file\|dir>` | 结构体检：表格/图片前空行、`> **人话**` 后空行、`$$` 块前后空行、代码块自动跳过 |
| `scripts/kcheck.mjs <file>`      | KaTeX strict 校验（一次一个文件）                                               |
| `scripts/verify_template.py`     | 例题答案断言模板（解析题面 → 重算 → 断言 md 数值）                              |
| `scripts/vision_tag_images.py`   | 无视觉能力时给课件图打标签                                                      |

## 0 变量

```bash
cd /home/johnson/quartz-repo/content/Courses/数据挖掘   # 课程目录
CH=5; NAME="章名"; PDF="raw/ppt/$CH $NAME.pdf"; NOTE="$CH $NAME.md"
SK=/home/johnson/quartz-repo/content/.agents/skills/ppt2note
```

## 1 预检 + 抽取

```bash
pdfinfo "$PDF" | grep Pages; ls -l "$PDF"     # >20 页或 >10MB 用 extract，小文件可 flash-extract
mkdir -p /tmp/ch$CH/mineru
mineru-open-api extract "$PDF" --model pipeline -f md -o /tmp/ch$CH/mineru > /tmp/ch$CH/log 2>&1 &
```

`--model pipeline` = 不编造文本（课件数字多，别用 vlm）。后台跑，同时做 2、3。
超过 200 页会报 `-60006`，分段 `--pages 1-125` / `--pages 126-250` 抽取后合并 `images/` 再 `cat`。

## 2 表格还原（`read` 会把 >768 字符的行截断，必须用脚本）

```bash
python3 - "/tmp/ch$CH/mineru/$CH $NAME.md" <<'PY'
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
for i, t in enumerate(re.findall(r'<table>.*?</table>', src, re.S)):
    print(f"--- T{i}")
    for r in re.findall(r'<tr>(.*?)</tr>', t, re.S):
        print("   ", ' | '.join(c.strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)))
PY
```

## 3 图版页核数

```bash
pdftoppm -r 100 -png "$PDF" /tmp/ch$CH/p      # 读 /tmp/ch$CH/p-023.png
```

笔记里每个数字都要有来源（mineru 或页面图）；能算的独立复算。
`pdftotext` 裸文本会串行（`I1,13,14` 实为 `I1,I3,I4`），只能用来定位页码，不能作数据源。

## 4 图：读图后手绘成干净 SVG

**原则**：笔记里的图必须"能替代一段解释"。纯文字/纯公式、内容已被正文覆盖的页 → **不留图**（删掉）。

1. 定位候选页：`pdftotext -f P -l P -layout` 逐页 grep 关键词（盒图 / Apriori / 支持向量 / 缺失值…）。
2. **一次看完**：候选页按 80dpi 渲染，PIL 拼 4×2 contact sheet，只读一次图，勾出真正承担解释的 2~4 张/章。
3. **留图判定**：有独立图形（散点/箱线/直方图/树/流程/网格/示意）才留；只是把要点文字或公式又抄一遍的页，删图不转。
4. **重画成 SVG（不是截图、不是裁剪、不是把位图套壳）**：
   - 读原图，记下坐标轴范围/刻度、数据点的大致位置、曲线形状、标注文字。
   - 写干净 SVG：白底，去掉 PPT 蓝色页眉与页码、去掉与正文重复的要点文字，只保留图形本体 + 必要的轴标签/图例/数值标注。
   - 存 `assets/ch<CH>-p<NN>.svg`，题注 `![PPT 第N页：说明](assets/chN-pNN.svg)`，紧贴对应小节标题下。
5. **渲染核对**（这是硬门，别只信"看起来对"）：
   ```bash
   google-chrome --headless=new --disable-gpu --hide-scrollbars \
     --force-device-scale-factor=1 --window-size=W,H \
     --screenshot=/tmp/x.png "file://$PWD/assets/ch${CH}-p${NN}.svg"
   ```
   读该 PNG：无文字重叠、无越界、无空白/报错。
6. **和原图并排比对**：PIL 把 [原图 | 重画] 拼一张逐张看，结构/标签/数据/刻度必须一致；不一致就改到一致。
7. 删旧图：`assets/*.webp` 移走并在 git 删除；把 md 里 `assets/*.webp` → `*.svg`；`grep -rn '\.webp' *.md` 必须为 0。

**重要事实**：源 PDF 里的图多是**位图**（`<image>` 嵌入），`pdftocairo -svg` 或裁切只是把同一张位图包一层 `<svg>`，不会变矢量。所以必须读图后**手绘**。SVG 写作坑：

- 文本里的 `<` `>` 必须转义成 `&lt;` `&gt;`（如 `b &lt; 0`），否则整页 XML 解析失败、Obsidian 显示空白。
- 不要用 HTML 的 `<sub>/<sup>`（SVG 不认）→ 用 Unicode 下标 `₁₂₃` 或 `tspan baseline-shift`。
- 中文字体：`font-family="Noto Sans CJK SC, Source Han Sans SC, sans-serif"`。
- 用 `viewBox` 固定画布、坐标自行换算；散点/柱高按原图近似即可，但轴刻度、区间端点和标注要还原。
- 全量校验 XML：`python3 -c "import glob,xml.etree.ElementTree as ET;[ET.parse(f) for f in glob.glob('assets/*.svg')]"`。

需要时参考技能 `redraw-course-figures-as-svg`（同一套流程与坑）。

## 5 格式纪律：表格只在"真对比"时用

**表格只用于横向对比**：行是同类可选对象（≥2），列是同一组属性（≥2），横读能比较。例：属性类型 标称/二元/序数/区间/比率、均值/中位数/众数、分类 vs 聚类、Apriori vs FP-growth、L1/L2/L∞、Ridge/Lasso。

其余一律分点/有序列表：

- 单概念的要点（定义/举例/特点）→ `- **键**：值`
- 术语 / 说明 → 列表
- 流程 / 步骤 → `1. **步骤**：说明`（保留原顺序）
- 相互独立的枚举（四大挑战、方法罗列、例题答案表）→ 列表
- 单列表格、两列「术语—说明」表 → 列表

校验：确认剩下的表都是对比表，列数一致（脚本枚举表格，`|` 计数应一致）。参考技能 `declutter-markdown-tables`。

## 6 骨架

### 课程级 `0 复习总览.md`

```markdown
# 0 复习总览

> 前提说明（考试形式从哪来、可靠性如何）

## 去年计算题 / 简答题（回忆版） ← 表：题目 | 在哪一章

## 怎么用这两张表（别当成范围） ← 只能检验，不能删减

## 例题清单 ← 表：章 | 例题 | 类型

## 怎么读这份笔记 ← 零基础路线 / 应试路线 / 练题方法

## 六章入口 ← 表：章 | 一句话 | 本章重点

## 必背公式 ← 表：公式 | 用处

## 复习顺序（按去年方向排，不是范围）
```

**考试材料性质判定（重要）**：`raw/exam/*.md` 这类文件通常是**去年考题的回忆版**，不是老师要求、也不是今年范围。
只能写"去年考了什么、用来自测"；绝不能据此删知识点，也不能写成"老师给的考试说明"。无法确认性质时先问用户。
任何降低考点覆盖的裁剪，必须有课件或课堂的明确标注（掌握 / 了解 / 基本概念）支撑。

### 章级

```markdown
# N 章名 ← 一句话总纲（因果主线）

## 0 读这一章之前 ← 前置知识 / 一句话概括 / 三个新词 / 计算题集中在哪（4 条）

## 总览（思维导图） ← $$ \begin{cases} … \end{cases} $$

# N.M 小节 ← 正文；每个考点小节标题下先一句「人话」，再定义/公式/图

## N.M.K 子标题 ← 需要时用二级/三级标题拆点

#### 例题 K（计算）：标题 ← 见第 8 节
```

- **不要**「考点权重 / 本章小结 / 考前速查表」这三块（用户已要求删除）：小结内容直接留在正文与例题里。
- 课件**跳号**（4.2.3 直接到 4.2.6）用 `>` 引用块注明"不是漏抄"。
- 伪代码、树形结构用 ` ```text `，不要塞进 KaTeX。
- 零基础可读是硬要求：第 1–4 章出现的概念都要能读懂，别默认读者记得前置内容。

## 7 「人话」写法与空行铁律

每个考点小节标题下紧跟一行，生活语言，一句话说清机制，再给定义：

```markdown
> **人话**：一个项集不频繁，它加上任何东西得到的超集一定也不频繁——这是剪枝的全部依据。
```

**引用块后必须空行**。紧跟的表格/图片会被当成引用续行（懒续行），Obsidian 与 MkDocs 都渲染成逐行管道文本；
`prettier --write` 还会给这些行补 `>` 前缀，把问题固化。插入任何内容后立刻跑 `mdcheck.py`。

## 8 例题（考试课必做）

结构固定，每道都带中间步骤与易错点：

```markdown
#### 例题 N（计算）：标题

**题目**：给全数据与要求（阈值、分组方式、初始中心等），不留歧义。

**解**：中间过程（逐项计数 / 偏差乘积 / 距离 / 分位数）+ 公式块，一行一步。

**答**：结论加粗，多个量逐个列出。

**易错**：1~2 条真正会丢分的点（分母是谁、须画到哪、阈值算不算满足）。
```

**正确性要求：答案必须由脚本从题面数据重算，并断言 md 里的每个数字。** 不能靠心算。
起点是 `scripts/verify_template.py`：`chk(cond, msg)` 收集断言、`block()` 取例题小节、`parse_table()` 取 md 表格，
示例已实现分位数 / Apriori / 线性回归 / k-means 四类。复制到 `/tmp/verify_ch<N>.py`，把该章每道例题都补上断言。

- 脚本模式：解析 md 里的题面数据 → 独立重算 → 断言正文中的数值串存在。
  15 道例题/118 项断言的实战中抓到 3 处真错（两点距离写成 4.24 实为 5.00；事务表一行抄错导致 L1 计数全崩）。
- 出题范围**以课件为准**：课件只讲准确率就别加 precision/recall 的题；需要新概念时先补进正文，否则删掉该题。
- 同一考点给一道"标准问法"+ 一条"补充问法"（如 Apriori 只问某条规则的支持度/置信度），贴合考卷习惯。
- 简答题也出例题：写成"答题要点"分点编号，附「易错」。

## 9 KaTeX 禁令（违反必报错）

1. 数学里中文一律 `\text{中文}`（`\qquad` 后面也一样）。
2. 圈码 ①②③ 无字体 → 写 `(1) (2) (3)`。
3. 全角标点、顿号、`→` 不进数学（用 `\to`）。
4. 表格单元格内的数学禁用 `|` → 用 `\lvert D\rvert`（否则破表）。
5. 单行 `$$…$$` 必须前后空行；与正文贴邻会退化成行内公式。
6. 公式块宽度：正文列约 **750px**（Material 内容区，1280 viewport、侧栏展开）。超宽的展开式拆成多个 `$$` 块，
   不要用 `\qquad` 硬塞一行。

## 10 验证门（全过才算完）

仓库已从 Quartz 迁到 **MkDocs Material**（`content/` 是 docs_dir）。构建与预览：

```bash
cd /home/johnson/quartz-repo
.venv/bin/mkdocs build                          # 无 ERROR 即成功
.venv/bin/mkdocs serve -a 127.0.0.1:8099        # 本地预览（后台跑，完成后 kill）
```

```bash
python3 $SK/scripts/mdcheck.py .                # 结构：表格/图片/人话/$$ 空行，必须 OK
node $SK/scripts/kcheck.mjs "$NOTE"             # KaTeX strict，必须 OK、exit 0（一次一个文件，多文件用 for）
npx prettier "$NOTE" --write
python3 /tmp/verify_ch$CH.py                    # 例题断言，必须 FAIL 0
```

浏览器实测（**不要用 relay**，那是用户真实 Chrome；用隔离无头）：

```js
const t = await browser.open({
  url: "http://127.0.0.1:8099/Courses/数据挖掘/4 关联规则/",
  app: { relay: false, tern: false },
  headed: false,
  viewport: { width: 1400, height: 1000 },
})
await t.waitForSelector(".katex-display")
display(
  await t.evaluate(`(()=>{
  const ds=[...document.querySelectorAll('.katex-display')]
  return { over: ds.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.slice(0,50)),
           katexErr: document.querySelectorAll('.katex-error').length,
           tables: document.querySelectorAll('table').length,
           brokenImgs: [...document.images].filter(i=>!i.complete||i.naturalWidth===0).length,
           webp: [...document.images].filter(i=>/\.webp$/.test(i.src)).length }
})()`),
)
await browser.close({ all: true })
```

必须：`over` 空、`katexErr` 0、`brokenImgs` 0、`webp` 0；表格数与该章对比表数一致。
MkDocs 用目录式 URL（中文保留），如 `/Courses/数据挖掘/4 关联规则/`。

## 11 收尾

```bash
rm -rf /tmp/ch$CH /tmp/verify_ch$CH.py
grep -rn '\.webp' "$NOTE" || echo "no webp refs"
git status --porcelain        # Obsidian 备份插件会自动 commit；确认 HEAD 里有该笔记与 assets
git log --oneline -1 -- "$NOTE"
```

## 无视觉能力时

```bash
python $SK/scripts/vision_tag_images.py --dir /tmp/ch$CH/mineru/images   # 需 OPENROUTER_API_KEY，输出 image_tags.json
```

读 `image_tags.json` 决定图片去留；此时第 4 步退化为"只写课件原文结论、不留图"，并告知用户该限制。
