#!/usr/bin/env python3
"""Markdown 结构体检：抓「被吞掉的表格/图片/公式」这类渲染事故。

用法：
    python3 mdcheck.py "4 关联规则.md"
    python3 mdcheck.py .            # 目录下所有 *.md

检查项（全部为 0 才算通过）：
    TABLE-NOBLANK   表格首行前面没有空行 → 会被上一条引用块/段落吞掉
    IMG-NOBLANK     图片行前面没有空行 → 同上
    QUOTE-SWALLOW   `> **人话**` 后面紧跟非空行 → 后续表格/图片被当成引用续行
    DISPLAY-NOBLANK $$ 块的首行/末行外侧没有空行 → 公式被并进段落
    DISPLAY-INLINE  单行 `$$…$$` 紧贴正文 → 会退化成行内公式
"""
import glob
import os
import sys


def check_file(path):
    bad = []
    lines = open(path, encoding="utf-8").read().split("\n")
    n = len(lines)
    inside = False  # 是否处在 $$ … $$ 块内部
    fence = False  # 是否处在 ``` 代码块内部（代码块里的示例不参与检查）
    for i, line in enumerate(lines):
        s = line.strip()
        prev = lines[i - 1].strip() if i > 0 else ""
        nxt = lines[i + 1].strip() if i + 1 < n else ""

        if s.startswith("```"):
            fence = not fence
            continue
        if fence:
            continue

        if not inside:
            if line.startswith("|") and prev and not prev.startswith("|"):
                bad.append((i + 1, "TABLE-NOBLANK", line[:60]))
            if line.startswith("![") and prev:
                bad.append((i + 1, "IMG-NOBLANK", line[:60]))
            if s.startswith("> **人话**") and nxt:
                bad.append((i + 1, "QUOTE-SWALLOW", line[:60]))

        if s == "$$":
            if not inside:  # 开块
                if prev and prev != "$$":
                    bad.append((i + 1, "DISPLAY-NOBLANK", "$$ 前缺空行"))
                inside = True
            else:  # 收块
                if nxt and nxt != "$$":
                    bad.append((i + 1, "DISPLAY-NOBLANK", "$$ 后缺空行"))
                inside = False
        elif s.startswith("$$") and s.endswith("$$") and len(s) > 4 and not inside:
            # 单行 $$…$$：自成一个 display 块，但前后必须空行
            if prev or nxt:
                bad.append((i + 1, "DISPLAY-INLINE", line[:60]))
    if inside:
        bad.append((n, "DISPLAY-NOBLANK", "$$ 未闭合"))
    return bad


def main(argv):
    targets = []
    for a in argv:
        if os.path.isdir(a):
            targets += sorted(glob.glob(os.path.join(a, "*.md")))
        else:
            targets.append(a)
    if not targets:
        print("用法: mdcheck.py <file|dir> [...]")
        return 2
    total = 0
    for f in targets:
        bad = check_file(f)
        total += len(bad)
        if bad:
            print(f"FAIL {f}  {len(bad)} 处")
            for ln, kind, snippet in bad:
                print(f"  {ln}: {kind}  {snippet}")
    if total == 0:
        print(f"OK {len(targets)} 个文件结构正常")
        return 0
    print(f"共 {total} 处需要修")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
