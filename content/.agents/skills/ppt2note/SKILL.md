---
name: ppt2note
description: Convert any format of course PPT into clean, beginner-friendly Markdown notes. Use when user mentions "PPT转笔记", "课件整理", "ppt2note", "把PPT转成笔记", "整理PPT为笔记", or asks to process courseware files into structured notes. Handles extraction, deduplication, error correction, formula fixing, and structure optimization.
---

# PPT2Note

Convert course PPTs into well-structured Markdown notes optimized for beginners.

## Core Requirement

**Preserve all substantive content. Only delete redundant/duplicate content.**

- Retain ALL learning material: knowledge points, theorems, proofs, examples, exercises, practice problems, formulas, data tables, key diagrams, and any content that aids learning.
- Only remove:
  - Duplicate content (repeated titles, outlines, instructor info, copyright notices)
  - Redundant content (decorative images, headers/footers, page numbers, garbled characters, placeholder text)
  - Fix errors (broken formulas, typos, syntax errors) without deleting the underlying content
- Never delete or omit any original course content that contributes to learning objectives.

## Workflow

### Step1: Extract PPT to Raw Markdown

If input is not a md file:

- using `mineru-open-api extract` to extract text, images, and structure,the usage of `mineru-open-api extract` is as follows

```powershell
PS C:\Users\lneoo\Desktop> mineru-open-api extract --help
Precision Extract provides the most comprehensive way to convert documents.
Perfect for high-quality extraction with layout preservation and asset retrieval.

Capabilities & Limits:
  - Auth Required (API Token)
  - Supports: PDF, Images (png, jpg, etc.), Doc, Docx, Ppt, Pptx, Html
  - File Limits: Max 200MB and 600 pages per document
  - Content: Precision extraction with all assets (Images, Tables, Formulas) in multiple formats (Markdown, Docx, LaTeX, etc.)

For quick, No Auth, Markdown-only extraction, use 'flash-extract' command.

Usage:
  mineru-open-api extract <file-or-url> [...] [flags]

Examples:
  mineru-open-api extract report.pdf                         # markdown to stdout
  mineru-open-api extract report.pdf -f html                  # html to stdout
  mineru-open-api extract report.pdf -o ./out/                # save to file
  mineru-open-api extract report.pdf -o ./out/ -f md,docx     # save multiple formats
  mineru-open-api extract *.pdf -o ./results/                  # batch
  mineru-open-api extract --list files.txt -o ./results/       # batch from file list

Flags:
      --concurrency int     Batch concurrency (reserved, not yet applied)
  -f, --format string       Output format(s): md,json,html,latex,docx (comma-separated) (default "md")
      --formula             Formula recognition (default on, use --formula=false to disable) (default true)
  -h, --help                help for extract
  -l, --language string     Document language (default "ch")
      --list string         Read input list from file (one per line)
      --model string        Model: vlm, pipeline, html (default: auto)
      --ocr                 OCR for scanned documents (default off)
  -o, --output string       Output path (file or dir); omit to output to stdout
      --pages string        Page range, e.g. '1-10,15'
      --stdin               Read file content from stdin
      --stdin-list          Read input list from stdin
      --stdin-name string   Filename for stdin mode (default "stdin.pdf")
      --table               Table recognition (default on, use --table=false to disable) (default true)
      --timeout int         Timeout in seconds (default: 300 single, 1800 batch)

Global Flags:
      --base-url string   API base URL (for private deployments)
      --token string      API Token (overrides env and config)
  -v, --verbose           Verbose mode, print HTTP details
```

- If input is already a `.md` file: skip this step

### Step2: Read and Analyze Raw Content

Read the full document and identify:

- Section structure and hierarchy
- **Duplicate content**: repeated titles, duplicate outlines, repeated instructor info
- **Redundant content**: decorative images, page headers/footers, garbled characters, placeholder text
- **Error content**: broken formulas, typos, logical contradictions
- **Essential images**: architecture diagrams, flowcharts, key schematics, data tables

### Step2.5: Vision Capability Check & Image Pre-tagging

Check if the current model has vision capability:

- **Has vision**: proceed to Step3.2, analyze images directly
- **No vision**: run `scripts/vision_tag_images.py` to pre-tag all images via OpenRouter:

  ```bash
  python scripts/vision_tag_images.py --dir <images_dir> --model google/gemma-4-31b-it:free
  ```

  - Requires `OPENROUTER_API_KEY` env var (user must set this)
  - Outputs `image_tags.json` with `{filename, description, tag: KEEP/DELETE, reason}` for each image
  - Uses `google/gemma-4-31b-it:free` by default (free, capable vision model)
  - Read `image_tags.json` before Step3.2 to guide image filtering decisions

### Step3: Clean and Modify

#### 3.1 Remove Duplicates

- Delete repeated instructor info (e.g., "汤善江 副教授" headers)
- Delete 2+ duplicate Outline/大纲 sections
- Delete repeated course titles, copyright notices
- _Reference_: Processed 12 courseware files, each had 2-3 duplicate Outlines removed

#### 3.2 Remove Redundant Content

- **Images**: Keep only images critical for understanding
  - KEEP: architecture diagrams, flowcharts, key schematics, data tables
  - DELETE: logos, decorative images, repeated diagrams, emojis
  - _Reference_: Each courseware file had 30-50 unnecessary images removed
  - **If using image_tags.json** (from Step2.5): trust KEEP/DELETE tags, only review UNCERTAIN ones manually
- Delete irrelevant headers/footers, page numbers, placeholders, garbled characters

#### 3.3 Identify and Fix Errors

- **Formula repair**:
  - Broken LaTeX → correct format: `$inline formula$`, `$$block formula$$`
  - Fix subscript/superscript/fraction/matrix syntax
  - _Reference_: Fix `$\frac{4}{3}\sigma$` → `$\frac{4}{3}\sigma$`
- Fix typos, syntax errors, logical contradictions

### Step4: Structure Optimization

- Unified heading levels: `#` for course/main chapter → `##` for major sections → `###` for subsections → `####` for items
- Use `---` to separate major sections for readability
- Convert scattered lists → Markdown tables (prefer tables for comparative content)
- Code examples wrapped with ```language (c/cpp/fortran/bash etc.)
- _Reference_:
  ```markdown
  | Comparison  | CPU         | GPU             |
  | ----------- | ----------- | --------------- |
  | Design Goal | Low latency | High throughput |
  ```

### Step5: Beginner Adaptation

- Add brief explanations for professional terms (in parentheses or footnotes)
- Ensure content flows from shallow to deep, with clear steps and complete examples
- Add analogies for complex concepts (e.g., "latency类比消防龙头")
- Avoid unexplained jargon

### Step6: Output

- Generate the cleaned Markdown file, overwriting the original or saving to `content/知识库/课程名/课件/XXX.md`
- Output modification summary:
  ```
  ✅ 主要修改：
  - 删除重复Outline：3处
  - 删除冗余图片：42张
  - 修复公式：7处
  - 结构调整：合并2个重复章节，新增3个表格
  ```

## Key Principles

**Concise is Key**: Only add context Claude doesn't already have. Challenge each piece: "Does Claude really need this explanation?" Prefer tables over verbose explanations.

**Progressive Disclosure**:

1. Metadata (name + description) - Always in context
2. SKILL.md body - When skill triggers (<5k words)
3. Bundled resources - As needed

**Set Appropriate Degrees of Freedom**:

- High freedom: Text-based instructions for flexible approaches
- Medium freedom: Pseudocode or scripts with parameters
- Low freedom: Specific scripts for fragile, error-prone operations

## Scripts

### `scripts/vision_tag_images.py`

Batch image tagging via OpenRouter Vision API. Use when current model lacks vision capability.

```bash
python scripts/vision_tag_images.py --dir <images_dir> [--model google/gemini-2.0-flash-001] [--output image_tags.json]
```

- Sends all images in one API call, returns JSON with tags
- Requires `OPENROUTER_API_KEY` environment variable
- Default model: `google/gemini-2.0-flash-001` (cost-effective, strong vision)
- Output: `image_tags.json` with `filename`, `description`, `tag` (KEEP/DELETE), `reason`

## Example Invocation

```
User: 用ppt2note处理 "D:\课件\并行计算\05 OpenMP.pptx"
AI执行：
1. mineru-open-api extract → 05_OpenMP_raw.md
2. 删除重复的教师信息、3处Outline
3. 删除38张不必要图片，保留5张关键架构图
4. 修复12处破碎公式，统一LaTeX格式
5. 用表格整理OpenMP子句对比，用---分隔大节
6. 输出 05_OpenMP.md，附修改说明
```
