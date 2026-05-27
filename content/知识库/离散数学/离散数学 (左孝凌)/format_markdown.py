#!/usr/bin/env python3
"""
Format discrete mathematics Markdown files for Obsidian:
1. Convert HTML <table> tags to Markdown tables (NO blank lines between rows)
2. Wrap definitions, theorems, examples in Obsidian callouts
3. Add frontmatter properties
4. Improve spacing/formatting
"""

import re
import os

FILES = [
    {
        "path": "1 数理逻辑.md",
        "title": "数理逻辑",
        "tags": ["离散数学", "数理逻辑", "命题逻辑", "谓词逻辑"]
    },
    {
        "path": "2 集合论.md",
        "title": "集合论",
        "tags": ["离散数学", "集合论", "关系", "函数"]
    },
    {
        "path": "3 代数系统.md",
        "title": "代数系统",
        "tags": ["离散数学", "代数系统", "代数结构", "布尔代数"]
    },
    {
        "path": "4 图论.md",
        "title": "图论",
        "tags": ["离散数学", "图论"]
    },
    {
        "path": "5 计算机科学中的应用.md",
        "title": "计算机科学中的应用",
        "tags": ["离散数学", "形式语言", "自动机", "纠错码"]
    }
]


def html_table_to_markdown(table_html):
    """Convert HTML table to Markdown table format."""
    table_html = table_html.strip()
    
    # Extract all rows
    rows = re.findall(r'<tr>(.*?)</tr>', table_html, re.DOTALL)
    if not rows:
        return table_html
    
    has_rowspan = 'rowspan' in table_html
    
    markdown_rows = []
    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        cleaned_cells = []
        for cell in cells:
            cell = cell.strip()
            cell = re.sub(r'\s+', ' ', cell)
            cell = cell.replace('|', '\\|')
            cleaned_cells.append(cell)
        
        if cleaned_cells:
            markdown_rows.append('| ' + ' | '.join(cleaned_cells) + ' |')
    
    if not markdown_rows:
        return table_html
    
    # Build result WITHOUT blank lines between rows
    result_lines = [markdown_rows[0]]
    num_cols = markdown_rows[0].count('|') - 1
    result_lines.append('|' + '|'.join([' --- '] * num_cols) + '|')
    result_lines.extend(markdown_rows[1:])
    
    return '\n'.join(result_lines)


def convert_html_tables(content):
    """Find and convert all HTML tables in content."""
    table_pattern = re.compile(r'<table>(.*?)</table>', re.DOTALL)
    return table_pattern.sub(lambda m: html_table_to_markdown(m.group(0)), content)


def add_callouts(content):
    """Wrap definitions, theorems, examples in Obsidian callouts."""
    # Definitions
    content = re.sub(
        r'(^|\n)(定义[\d\-\.]+[^\n]*)',
        r'\n> [!definition] \2',
        content
    )
    
    # Theorems
    content = re.sub(
        r'(^|\n)(定理[\d\-\.]+[^\n]*)',
        r'\n> [!theorem] \2',
        content
    )
    
    # Examples
    content = re.sub(
        r'(^|\n)(例题[\d]+[^\n]*)',
        r'\n> [!example] \2',
        content
    )
    
    # Clean up extra blank lines
    content = re.sub(r'\n{4,}', '\n\n\n', content)
    
    return content


def add_frontmatter(content, config):
    """Add Obsidian frontmatter."""
    content = re.sub(r'^---\n.*?\n---\n', '', content, flags=re.DOTALL)
    
    tags_yaml = '\n'.join(f'  - {tag}' for tag in config['tags'])
    frontmatter = f"""---
title: {config['title']}
tags:
{tags_yaml}
subject: 离散数学
---

"""
    
    return frontmatter + content.lstrip()


def improve_formatting(content):
    """Improve formatting without breaking tables."""
    lines = content.split('\n')
    result = []
    i = 0
    in_table = False
    
    while i < len(lines):
        line = lines[i]
        
        # Detect if we're in a Markdown table
        if line.strip().startswith('|') and line.strip().endswith('|'):
            in_table = True
            result.append(line)
        elif in_table:
            in_table = False
            result.append(line)
        else:
            result.append(line)
        
        i += 1
    
    content = '\n'.join(result)
    
    # Ensure blank lines before headings
    content = re.sub(r'\n(#+[^\n]+)(?:\n(?!#))', r'\n\n\1\n\n', content)
    
    # Clean up excessive blank lines (more than 2)
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # Ensure blank line before tables (but NOT inside them)
    # Use a marker-based approach
    content = re.sub(r'([^\n])\n(\|[^\n]+\|)', r'\1\n\n\2', content)
    
    return content


def process_file(config):
    """Process a single markdown file."""
    filepath = config['path']
    
    if not os.path.exists(filepath):
        print(f"  ✗ File not found: {filepath}")
        return False
    
    print(f"  Reading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_len = len(content)
    
    print(f"  Converting HTML tables to Markdown...")
    content = convert_html_tables(content)
    
    print(f"  Adding callouts...")
    content = add_callouts(content)
    
    print(f"  Improving formatting...")
    content = improve_formatting(content)
    
    print(f"  Adding frontmatter...")
    content = add_frontmatter(content, config)
    
    new_len = len(content)
    print(f"  Writing {filepath} ({original_len} -> {new_len} chars)...")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True


def main():
    print("=" * 50)
    print("Formatting Discrete Mathematics Markdown Files")
    print("=" * 50)
    
    for config in FILES:
        print(f"\nProcessing: {config['path']}")
        process_file(config)
    
    print(f"\n{'=' * 50}")
    print("All files processed successfully!")
    print("=" * 50)


if __name__ == '__main__':
    main()
