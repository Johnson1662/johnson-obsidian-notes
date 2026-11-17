# Agent Notes

站点：Obsidian vault（`content/`）→ MkDocs Material → GitHub Pages。

## 环境

- Python 3.12，依赖在 `requirements.txt`（`mkdocs-material==9.8.1`、`mkdocs-callouts==1.17.1`）
- 本地环境：`.venv/`（已 gitignore）

## 命令

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/mkdocs serve        # 本地预览
.venv/bin/mkdocs build        # 产出 site/
```

## 结构

- `content/` 是 Obsidian vault，**唯一内容源**；站点专用文件不要写进这里
- `hooks/obsidian.py`：`on_page_markdown` 转换 `[[wikilink]]`、`![[图片]]`、`%%注释%%`，并去掉空 YAML 头；`on_files` 注入 `hooks/site-assets` 下的 extra.css/extra.js/mermaid.min.js
- `overrides/main.html`：只在页面含 `class="mermaid"` 时加载 mermaid
- `hooks/site-assets/extra.js`：KaTeX 渲染（跟随 Material 的 `document$`）；**不要**再处理 mermaid，Material 内置集成负责渲染（它在 closed shadow root 里画图，DOM 查询看不到 svg 属正常）

## 已知约束

- 公式走 KaTeX（CDN），callout 由 `mkdocs-callouts` 把 `> [!note]-` 转 admonition；`check`/`faq`/`summary`/`important` 会被别名成 success/question/abstract/tip
- 标题锚点用 `pymdownx.slugs.slugify(case: lower)`，中文 id 保留
- 图片/PDF 等附件随 `content/` 原样复制；构建产物约 210 MB
- 部署 workflow：`.github/workflows/deploy.yml`（Python + upload-pages-artifact）
