#!/usr/bin/env python3
"""
Format discrete mathematics Markdown files for Obsidian:
1. Convert HTML <table> tags to Markdown tables
2. Wrap definitions, theorems, examples in Obsidian callouts
3. Add frontmatter properties
4. Improve spacing/formatting
"""

import re
import os

# File processing configuration
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
    # Remove newlines within the table for easier processing
    table_html = table_html.strip()
    
    # Extract all rows
    rows = re.findall(r'<tr>(.*?)</tr>', table_html, re.DOTALL)
    if not rows:
        return table_html
    
    # Check for rowspan
    has_rowspan = 'rowspan' in table_html
    
    if has_rowspan:
        # For tables with rowspan, convert to a simpler representation
        # Extract all cells with their rowspan info
        return html_table_with_rowspan_to_markdown(table_html, rows)
    
    # Process each row
    markdown_rows = []
    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        # Clean cell content: remove extra whitespace, preserve LaTeX
        cleaned_cells = []
        for cell in cells:
            cell = cell.strip()
            cell = re.sub(r'\s+', ' ', cell)
            # Replace LaTeX \(...\) with $...$ if present
            cell = re.sub(r'\\\(', '$', cell)
            cell = re.sub(r'\\\)', '$', cell)
            # Escape pipe characters in cell content
            cell = cell.replace('|', '\\|')
            cleaned_cells.append(cell)
        
        if cleaned_cells:
            markdown_rows.append('| ' + ' | '.join(cleaned_cells) + ' |')
    
    if not markdown_rows:
        return table_html
    
    # Add header separator (first row becomes header)
    result = []
    for i, row in enumerate(markdown_rows):
        result.append(row)
        if i == 0:
            # Add separator row
            num_cols = row.count('|') - 1
            separator = '|' + '|'.join([' --- '] * num_cols) + '|'
            result.append(separator)
    
    return '\n'.join(result)


def html_table_with_rowspan_to_markdown(table_html, rows):
    """Handle tables with rowspan attribute."""
    # For complex tables with rowspan, we'll extract a simplified representation
    # that preserves the content
    all_cells = []
    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
        row_cells = []
        for cell in cells:
            cell = cell.strip()
            cell = re.sub(r'\s+', ' ', cell)
            cell = cell.replace('|', '\\|')
            row_cells.append(cell)
        if row_cells:
            all_cells.append(row_cells)
    
    if not all_cells:
        return table_html
    
    # Find max columns
    max_cols = max(len(r) for r in all_cells)
    
    markdown_rows = []
    for i, row_cells in enumerate(all_cells):
        # Pad with empty cells if needed
        while len(row_cells) < max_cols:
            row_cells.append('')
        markdown_rows.append('| ' + ' | '.join(row_cells) + ' |')
        if i == 0:
            separator = '|' + '|'.join([' --- '] * max_cols) + '|'
            markdown_rows.append(separator)
    
    return '\n'.join(markdown_rows)


def convert_html_tables(content):
    """Find and convert all HTML tables in content."""
    # Match <table>...</table> blocks (may span multiple lines)
    table_pattern = re.compile(r'<table>(.*?)</table>', re.DOTALL)
    
    def replace_table(match):
        return html_table_to_markdown(match.group(0))
    
    return table_pattern.sub(replace_table, content)


def add_callouts(content):
    """Wrap definitions, theorems, examples in Obsidian callouts."""
    
    # 1. Definitions: "定义X-X.X" or "定义X-X" at start of a paragraph
    def wrap_definition(match):
        prefix = match.group(1) or ''
        def_text = match.group(2)
        rest = match.group(3) or ''
        return f'{prefix}> [!definition] {def_text}{rest}'
    
    # Match definition lines
    content = re.sub(
        r'(^|\n)(定义[\d\-\.]+[^\n]*)',
        r'\n> [!definition] \2',
        content
    )
    
    # 2. Theorems: "定理X-X.X" or "定理X-X" at start of a paragraph
    content = re.sub(
        r'(^|\n)(定理[\d\-\.]+[^\n]*)',
        r'\n> [!theorem] \2',
        content
    )
    
    # 3. Examples: "例题X" at start of a paragraph
    # Be careful: some "例" words are just regular text like "例1" inside explanations
    content = re.sub(
        r'(^|\n)(例题[\d]+[^\n]*)',
        r'\n> [!example] \2',
        content
    )
    
    # 4. Proof sections: "证明"
    content = re.sub(
        r'(^|\n)(证明[\s\S]*?)(?=\n\n|\n(?:定义|定理|例题|解|$)|\Z)',
        lambda m: m.group(0),  # Keep proofs as-is for now
        content
    )
    
    # 5. "解" at start of paragraph in examples
    content = re.sub(
        r'(^|\n)(解[\s\S]*?)(?=\n\n|\n(?:定义|定理|例题|$)|\Z)',
        lambda m: m.group(0),  # Keep solutions as-is
        content
    )
    
    # Remove extra blank lines created by callout wrapping
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    return content


def add_frontmatter(content, config):
    """Add Obsidian frontmatter to the beginning of content."""
    # Remove existing frontmatter if any
    content = re.sub(r'^---\n.*?\n---\n', '', content, flags=re.DOTALL)
    
    frontmatter = f"""---
title: {config['title']}
tags:
"""
    for tag in config['tags']:
        frontmatter += f"  - {tag}\n"
    frontmatter += f"subject: 离散数学\n---\n\n"
    
    return frontmatter + content.lstrip()


def improve_formatting(content):
    """Improve overall formatting and readability."""
    # Ensure proper spacing around headings
    content = re.sub(r'\n(#+[^\n]+)\n(?!\n)', r'\n\n\1\n\n', content)
    
    # Ensure blank line before tables
    content = re.sub(r'([^\n])\n(\|)', r'\1\n\n\2', content)
    
    # Ensure blank line after tables
    content = re.sub(r'(\|[^\n]*)\n([^\n|])', r'\1\n\n\2', content)
    
    # Clean up excessive blank lines
    content = re.sub(r'\n{4,}', '\n\n\n', content)
    
    # Fix table spacing: ensure blank lines around tables
    content = re.sub(r'\n{2,}(\|[^\n]*\|)\n{2,}', r'\n\n\1\n\n', content)
    
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
    
    print(f"  Converting HTML tables...")
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
    
    print("\n" + "=" * 50)
    print("All files processed successfully!")
    print("=" * 50)


if __name__ == '__main__':
    main()
