#!/usr/bin/env python3
"""例题答案核对模板 —— 复制到 /tmp/verify_ch<N>.py 后按章填断言。

原则：从**题面数据**重算，再断言 md 正文里确实写着这个数。
只读 md 里已经写好的答案去"确认"它自己，等于没检查。

    cp $SK/scripts/verify_template.py /tmp/verify_ch4.py
    # 填 check_* 函数
    python3 /tmp/verify_ch4.py        # 必须 FAIL 0

实战记录：15 道例题、118 项断言，抓到 3 处真错（两点距离写错、事务表抄错导致计数全崩）。
"""
import math
import re
import sys
from fractions import Fraction as F

BASE = "/home/johnson/quartz-repo/content/Courses/数据挖掘/"
ok, fail = [], []


def chk(cond, msg):
    (ok if cond else fail).append(msg)


def read(fn):
    return open(BASE + fn, encoding="utf-8").read()


def block(fn, marker):
    """取出某个例题小节（`#### 例题 …marker…` 到下一个小节标题）。"""
    m = re.search(r"#### 例题[^\n]*" + marker + r"[\s\S]*?(?=\n#### |\n## |\n# |\Z)", read(fn))
    assert m, f"{fn} 里找不到例题：{marker}"
    return m.group(0)


def parse_table(b, header_pattern):
    """从 md 表格里取数字：返回 [[cell, ...], ...]，按 header_pattern 定位表头所在表。"""
    m = re.search(header_pattern + r"[\s\S]*?\n\n", b)
    if not m:
        return []
    rows = []
    for line in m.group(0).split("\n"):
        if line.startswith("|") and not set(line) <= set("|-: "):
            rows.append([c.strip() for c in line.strip("|").split("|")])
    return rows[1:]  # 去掉表头


# ---------- 示例 1：分位数（课件算法 n+1 乘百分数）----------
def check_quantiles(fn="2 认识数据.md"):
    vals = [2, 4, 5, 7, 8, 10, 12, 13, 15, 60]

    def q(f):
        xs = sorted(vals)
        pos = F(len(xs) + 1) * f
        j = int(pos)
        return F(xs[j - 1]) if pos == j else F(xs[j - 1] + xs[j], 2)

    Q1, Q2, Q3 = q(F(1, 4)), q(F(1, 2)), q(F(3, 4))
    iqr = Q3 - Q1
    b = block(fn, "中位数、四分位数")
    chk((Q1, Q2, Q3) == (F(9, 2), F(9), F(14)), f"分位数 {Q1}/{Q2}/{Q3} 应为 4.5/9/14")
    chk(Q3 + F(3, 2) * iqr == F(113, 4), "上须阈值应为 28.25")
    chk(Q1 - F(3, 2) * iqr == F(-39, 4), "下须阈值应为 -9.75")
    for s in ["4.5", "9.5", "28.25", "-9.75"]:
        chk(s in b, f"md 里应出现 {s}")


# ---------- 示例 2：Apriori（解析事务表 → 重算 L1/L2/L3 与置信度）----------
def check_apriori(fn="4 关联规则.md", min_count=3):
    b = block(fn, "Apriori 完整手推")
    items = ["数据库", "算法", "网络", "操作系统", "编译"]
    rows = re.findall(r"\|\s*(T\d)\s*\|\s*([^|\n]+?)\s*(?=\|)", b)
    trans = [set(x.strip() for x in c.split(",") if x.strip() in items) for _, c in rows]
    chk(len(trans) == 8, f"解析到 {len(trans)} 条事务，应为 8")
    cnt = lambda S: sum(1 for t in trans if set(S) <= t)

    # 与 md 里 L1 表逐个比对
    md_l1 = dict(re.findall(r"\|\s*(数据库|算法|网络|操作系统|编译)\s*\|\s*(\d+)\s*\|\s*[是否]\s*\|", b))
    chk(len(md_l1) == 5 and all(cnt([k]) == int(v) for k, v in md_l1.items()), f"L1 计数不符 {md_l1}")

    # 规则表：前件计数必须等于真实计数
    for ante, cons, _, den in re.findall(
        r"\|\s*([^\n|]*?)\s*→\s*([^\n|]+?)\s*\|\s*(\d+)\s*\|\s*\$3/(\d+)", b
    ):
        A = tuple(sorted(x.strip() for x in ante.split(",")))
        chk(cnt(A) == int(den), f"规则 {ante}→{cons} 前件计数 {cnt(A)} vs md {den}")


# ---------- 示例 3：一元线性回归 ----------
def check_regression(fn="5 分类.md"):
    pairs = [(1, 2), (2, 4), (3, 5), (4, 4), (5, 5)]
    mx = sum(p[0] for p in pairs) / len(pairs)
    my = sum(p[1] for p in pairs) / len(pairs)
    Sxy = sum((x - mx) * (y - my) for x, y in pairs)
    Sxx = sum((x - mx) ** 2 for x, y in pairs)
    w, b0 = Sxy / Sxx, my - (Sxy / Sxx) * mx
    res = [y - (w * x + b0) for x, y in pairs]
    sse = sum(r * r for r in res)
    sst = sum((y - my) ** 2 for x, y in pairs)
    chk(abs(w - 0.6) < 1e-12 and abs(b0 - 2.2) < 1e-12, "w/b 应为 0.6/2.2")
    chk(abs(sse - 2.4) < 1e-9 and abs(sse / len(pairs) - 0.48) < 1e-12, "SSE/MSE 应为 2.4/0.48")
    chk(abs(1 - sse / sst - 0.6) < 1e-12, "R² 应为 0.6")


# ---------- 示例 4：k-means 迭代 + SSE ----------
def check_kmeans(fn="6 聚类.md"):
    pts = {"A": (1, 1), "B": (2, 1), "C": (4, 3), "D": (5, 4), "E": (3, 2)}
    c1, c2 = [1.0, 1.0], [5.0, 4.0]
    for _ in range(20):
        g = {0: [], 1: []}
        for n, p in pts.items():
            g[0 if math.dist(p, c1) <= math.dist(p, c2) else 1].append(n)
        n1 = [sum(pts[n][i] for n in g[0]) / len(g[0]) for i in (0, 1)]
        n2 = [sum(pts[n][i] for n in g[1]) / len(g[1]) for i in (0, 1)]
        if n1 == c1 and n2 == c2:
            break
        c1, c2 = n1, n2
    chk(g == {0: ["A", "B", "E"], 1: ["C", "D"]}, f"归属 {g}")
    chk(abs(c1[0] - 2) < 1e-12 and abs(c1[1] - 4 / 3) < 1e-12 and c2 == [4.5, 3.5], f"中心 {c1} {c2}")
    sse = sum((pts[n][0] - c[0]) ** 2 + (pts[n][1] - c[1]) ** 2
              for gi, c in [(0, c1), (1, c2)] for n in g[gi])
    chk(abs(sse - 11 / 3) < 1e-12, f"SSE {sse} 应为 11/3")


def main():
    for fn in (check_quantiles, check_apriori, check_regression, check_kmeans):
        fn()
    print(f"PASS {len(ok)} / FAIL {len(fail)}")
    for f in fail:
        print("FAIL:", f)
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
