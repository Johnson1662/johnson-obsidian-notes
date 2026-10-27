---
name: ppt2note
description: 课件 PPT/PDF → 本仓库的课程笔记（课程级 0 复习总览 + 每章 0 读这一章之前/人话/PPT 原图/例题，KaTeX + 渲染验证门）。用户说"整理第N章 / PPT转笔记 / 课件整理 / 按语音课那样整理 / ppt2note"时用。
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

## 4 选图入笔记（PPT 原图）

1. 定位候选页：`pdftotext -f P -l P -layout` 逐页 grep 关键词（盒图 / Apriori / 支持向量 / 缺失值…）。
2. **一次看完**：候选页按 80dpi 渲染，PIL 拼 4×2 contact sheet，只读一次图，勾出真正承担解释的 2~4 张/章。
   逐页读图是 8 次读图开销，contact sheet 是 1 次。
3. 出图：`pdftoppm -r 120 -png -singlefile` → PIL 转 `WEBP quality=88, method=6`（约 100KB/张，中文小字仍锐利）。
4. 存放与引用：`assets/ch<CH>-p<页码>.webp`，题注统一 `![PPT 第N页：说明](assets/chN-pNN.webp)`，紧贴对应小节标题下。
5. 选图标准：**这张图能否替代一段解释**。纯公式页、章节封面、目录页跳过；小结页跳过。

## 5 骨架

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

## 0 读这一章之前 ← 前置知识 / 一句话概括 / 三个新词 / 与考试的关系（4 条）

## 总览（思维导图） ← $$ \begin{array} + \begin{cases} $$

## 考点权重 ← 表：模块 | 真正需要掌握 | 优先级

# N.M 小节 ← 正文；每个考点小节标题下先一句「人话」，再定义/公式/图

## 例题 ← 见第 7 节

# N.5 本章小结

# N.6 考前速查表
```

- 课件**跳号**（4.2.3 直接到 4.2.6）用 `>` 引用块注明"不是漏抄"。
- 伪代码、树形结构用 ` ```text `，不要塞进 KaTeX。
- 零基础可读是硬要求：第 1–4 章出现的概念都要能读懂，别默认读者记得前置内容。

## 6 「人话」写法与空行铁律

每个考点小节标题下紧跟一行，生活语言，一句话说清机制，再给定义：

```markdown
> **人话**：一个项集不频繁，它加上任何东西得到的超集一定也不频繁——这是剪枝的全部依据。
```

**引用块后必须空行**。紧跟的表格/图片会被当成引用续行（懒续行），Obsidian 与 Quartz 都渲染成逐行管道文本；
`prettier --write` 还会给这些行补 `>` 前缀，把问题固化。插入任何内容后立刻跑 `mdcheck.py`。

## 7 例题（考试课必做）

结构固定，每道都带中间步骤与易错点：

```markdown
#### 例题 N（计算）：标题

**题目**：给全数据与要求（阈值、分组方式、初始中心等），不留歧义。

**解**：中间表（逐项计数 / 偏差乘积 / 距离 / 分位数）+ 公式块，一行一步。

**答**：结论加粗，多个量逐个列出。

**易错**：1~2 条真正会丢分的点（分母是谁、须画到哪、阈值算不算满足）。
```

**正确性要求：答案必须由脚本从题面数据重算，并断言 md 里的每个数字。** 不能靠心算。
起点是 `scripts/verify_template.py`：`chk(cond, msg)` 收集断言、`block()` 取例题小节、`parse_table()` 取 md 表格，
示例已实现分位数 / Apriori / 线性回归 / k-means 四类。复制到 `/tmp/verify_ch<N>.py`，把该章每道例题都补上断言。

- 脚本模式：解析 md 里的题面表 → 独立重算 → 断言正文中的数值串存在。
  15 道例题/118 项断言的实战中抓到 3 处真错（两点距离写成 4.24 实为 5.00；事务表一行抄错导致 L1 计数全崩）。
- 出题范围**以课件为准**：课件只讲准确率就别加 precision/recall 的题；需要新概念时先补进正文，否则删掉该题。
- 同一考点给一道"标准问法"+ 一条"补充问法"（如 Apriori 只问某条规则的支持度/置信度），贴合考卷习惯。
- 简答题也出例题：写成"答题要点"分点编号，附「易错」。

## 8 KaTeX 禁令（违反必报错）

1. 数学里中文一律 `\text{中文}`（`\qquad` 后面也一样）。
2. 圈码 ①②③ 无字体 → 写 `(1) (2) (3)`。
3. 全角标点、顿号、`→` 不进数学（用 `\to`）。
4. 表格单元格内的数学禁用 `|` → 用 `\lvert D\rvert`（否则破表）。
5. 单行 `$$…$$` 必须前后空行；与正文贴邻会退化成行内公式。
6. 公式块宽度：正文列 **750px**（1280 viewport、侧栏展开）。超宽的展开式拆成多个 `$$` 块，
   不要用 `\qquad` 硬塞一行。

## 9 验证门（全过才算完）

```bash
python3 $SK/scripts/mdcheck.py .        # 结构：表格/图片/人话/$$ 空行，必须 OK
node $SK/scripts/kcheck.mjs "$NOTE"     # KaTeX strict，必须 OK、exit 0（一次只吃一个文件，多文件用 for）
npx prettier "$NOTE" --write && npx prettier "*.md" --check
npx quartz build                        # 输出 Emitted … files 即成功
python3 /tmp/verify_ch$CH.py            # 例题断言，必须 FAIL 0（从 $SK/scripts/verify_template.py 复制后填满每道题）
```

浏览器实测（**不要用 relay**，那是用户真实 Chrome；用隔离无头）：

```js
const t = await browser.open({
  url: "http://localhost:8099/Courses/数据挖掘/4-关联规则",
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
           brokenImgs: [...document.images].filter(i=>!i.complete||i.naturalWidth===0).length }
})()`),
)
await browser.close({ all: true })
```

必须：`over` 空、`katexErr` 0、`brokenImgs` 0；表格数与该章表格数一致。
起服务用 `npx quartz build --serve --port 8099`（`-p` 不认），完成后 kill 掉。

## 10 收尾

```bash
rm -rf /tmp/ch$CH /tmp/verify_ch$CH.py
git status --porcelain        # Obsidian 备份插件会自动 commit；确认 HEAD 里有该笔记与 assets
git log --oneline -1 -- "$NOTE"
```

## 无视觉能力时

```bash
python $SK/scripts/vision_tag_images.py --dir /tmp/ch$CH/mineru/images   # 需 OPENROUTER_API_KEY，输出 image_tags.json
```

读 `image_tags.json` 决定图片去留；此时第 3 步退化为"只写课件原文结论"，第 4 步跳过选图并告知用户该限制。
