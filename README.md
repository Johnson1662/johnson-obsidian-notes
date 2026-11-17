# johnson-obsidian-notes

Obsidian 笔记库（`content/`）经 MkDocs Material 构建，发布到 GitHub Pages：
<https://johnson1662.github.io/johnson-obsidian-notes/>

## 结构

| 路径 | 说明 |
| --- | --- |
| `content/` | Obsidian vault，唯一内容源 |
| `mkdocs.yml` | 站点与 Markdown 扩展配置 |
| `hooks/obsidian.py` | 把 `[[wikilink]]`、`![[embed]]`、`%%注释%%` 转成标准 Markdown |
| `hooks/site-assets/` | 站点样式、KaTeX 渲染脚本、随包的 mermaid |
| `overrides/` | Material 模板覆盖（仅在含图的页面加载 mermaid） |
| `requirements.txt` | Python 依赖 |

## 本地构建

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/mkdocs serve
```

## 发布

推送到 `main` 后由 `.github/workflows/deploy.yml` 构建并部署 `site/`。
