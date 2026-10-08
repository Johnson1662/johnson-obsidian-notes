---
name: ppt2note
description: 课件 PPT/PDF → 本仓库的章节笔记（七段式骨架 + 表格 + KaTeX，且必须过渲染验证门）。用户说"整理第N章 / PPT转笔记 / 课件整理 / ppt2note"时用。
---

# PPT2Note

`raw/ppt/N 章名.pdf` → `N 章名.md`。按序复制执行。

## 0 变量

```bash
cd /home/johnson/quartz-repo/content/课程/数据挖掘
CH=5; NAME="章名"; PDF="raw/ppt/$CH $NAME.pdf"; NOTE="$CH $NAME.md"
```

## 1 预检 + 抽取

```bash
pdfinfo "$PDF" | grep Pages; ls -l "$PDF"            # >20 页或 >10MB 用 extract，小文件用 flash-extract（免 token）
mkdir -p /tmp/ch$CH/mineru
mineru-open-api extract "$PDF" --model pipeline -f md -o /tmp/ch$CH/mineru > /tmp/ch$CH/log 2>&1 &
```

`--model pipeline` = 不编造文本（课件数字多，别用 vlm）。后台跑，跑的同时做 2、3。

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

## 3 图版页看图核数

```bash
pdftoppm -r 100 -png "$PDF" /tmp/ch$CH/p             # 读 /tmp/ch$CH/p-023.png 这类
```

只读有例子 / 矩阵 / 树 / 时间线 / 图例的页，然后：笔记里每个数字都要有来源（mineru 或页面图）；能算的独立复算；`pdftotext` 裸文本会串行（`I1,13,14` 实为 `I1,I3,I4`），不可作数据源。

## 4 笔记骨架（七段，编号与课件一致）

```markdown
# N 章名                     ← 一句话总纲：这章的因果主线
## 总览（思维导图）           ← $$ \begin{array} + \begin{cases} 花括号树 $$
## 考点权重                   ← 表：模块 | 真正需要掌握 | 优先级
# N.M 小节                    ← 正文，能做成表的一律做表；定义表 / 对比表 / 算例
# N.5 本章小结               ← $$ \left.\begin{array}{ll}…\end{array}\right\} $$
# N.6 考前速查表             ← 表：题目出现 | 立刻想到
```

- 课件**跳号**（如 4.2.3 直接到 4.2.6）用 `>` 引用块注明"不是漏抄"。
- 伪代码、树形结构用 ` ```text ` 代码块，不要塞进 KaTeX。

## 5 KaTeX 禁令（违反必报错）

1. 数学里中文一律 `\text{中文}`（`\qquad` 后面也一样）。
2. 圈码 ①②③ 无字体 → 写 `(1) (2) (3)`。
3. 全角标点、顿号不进数学。
4. 表格单元格内的数学禁用 `|` → 用 `\lvert D\rvert`（否则破表）。
5. 思维导图每层嵌套都加宽；正文列宽 741px，单行控制在 ~600px，超了拆行。

## 6 验证门（全过才算完）

```bash
node /home/johnson/quartz-repo/content/.agents/skills/ppt2note/scripts/kcheck.mjs "$NOTE"   # 必须输出 OK、exit 0
npx prettier "$NOTE" --write && npx prettier "*.md" --check
npx quartz build                                                                            # 输出 Emitted … files 即成功
```

浏览器实测（在 eval JS 内核里跑，必须溢出 0、`.katex-error` 为 0）：

```js
const tb = await browser.open({ name: "chk", url: `file:///home/johnson/quartz-repo/public/课程/数据挖掘/${CH}-${NAME}.html`, viewport: { width: 1100, height: 900 } })
await tb.waitForSelector(".katex-display")
display(await tb.evaluate(() => {
  const ds = [...document.querySelectorAll(".katex-display")]
  const colW = Math.round(ds[0].clientWidth)
  return { colW, over: ds.map(d => Math.round(d.querySelector(":scope > .katex > .katex-html > .base").getBoundingClientRect().width)).filter(w => w > colW), katexErr: document.querySelectorAll(".katex-error").length }
}))
await tb.emulate({ deviceScaleFactor: 2 }); display(await tb.screenshot({ silent: true }))
await browser.close({ name: "chk", kill: true })
```

## 7 收尾

```bash
rm -rf /tmp/ch$CH
git status --porcelain        # 本仓库 Obsidian 备份插件会自动 commit；确认 HEAD 里有该笔记
```

## 无视觉能力时

```bash
python /home/johnson/quartz-repo/content/.agents/skills/ppt2note/scripts/vision_tag_images.py --dir /tmp/ch$CH/mineru/images   # 需 OPENROUTER_API_KEY，输出 image_tags.json
```

读 `image_tags.json` 决定图片去留；此时第 3 步退化为"只写课件原文结论"，并告知用户该限制。
