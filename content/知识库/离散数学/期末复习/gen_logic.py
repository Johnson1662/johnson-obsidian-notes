# -*- coding: utf-8 -*-
import pathlib
content = """---
title: 期末复习 · 数理逻辑
---

# 数理逻辑 · 零基础期末复习

test
"""
pathlib.Path("test_out.md").write_text(content, encoding="utf-8")
print("ok")
