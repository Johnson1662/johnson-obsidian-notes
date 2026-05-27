#!/usr/bin/env python3
"""
Format discrete mathematics Markdown files for Obsidian:
1. Convert HTML <table> tags to Markdown tables (no blank lines between rows)
2. Wrap definitions, theorems, examples AND their body content in Obsidian callouts
3. Add frontmatter properties
4. Improve spacing and readability
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

    result_lines = [markdown_rows[0]]
    num_cols = markdown_rows[0].count('|') - 1
    result_lines.append('|' + '|'.join([' --- '] * num_cols) + '|')
    result_lines.extend(markdown_rows[1:])

    return '\n'.join(result_lines)


def convert_html_tables(content):
    """Find and convert all HTML tables in content."""
    table_pattern = re.compile(r'<table>(.*?)</table>', re.DOTALL)
    return table_pattern.sub(lambda m: html_table_to_markdown(m.group(0)), content)


def wrap_callouts(content):
    """
    Line-by-line processing to wrap definitions, theorems, examples in callouts.
    The callout extends until the next heading, next callout item, or end of file.
    """
    lines = content.split('\n')
    result = []
    i = 0

    # Patterns for starting a callout
    def_pattern = re.compile(r'^(定义[\d\-\.]+)\s*(.*)')
    theorem_pattern = re.compile(r'^(定理[\d\-\.]+)\s*(.*)')
    example_pattern = re.compile(r'^(例题[\d\-\.]+)\s*(.*)')
    exercise_pattern = re.compile(r'^(习题[\d\-\.]+)\s*(.*)')

    # Patterns for ending a callout
    heading_pattern = re.compile(r'^#{1,6}\s')
    # Also end at another callout-starting line

    def is_callout_starter(line):
        m = def_pattern.match(line)
        if m: return 'definition', m.group(1), m.group(2)
        m = theorem_pattern.match(line)
        if m: return 'theorem', m.group(1), m.group(2)
        m = example_pattern.match(line)
        if m: return 'example', m.group(1), m.group(2)
        m = exercise_pattern.match(line)
        if m: return 'exercise', m.group(1), m.group(2)
        return None

    while i < len(lines):
        line = lines[i]
        match = is_callout_starter(line)

        if match:
            callout_type, title, rest = match
            callout_lines = []

            # Map callout types to Obsidian callout types
            type_map = {
                'definition': 'definition',
                'theorem': 'theorem',
                'example': 'example',
                'exercise': 'example'
            }
            obsidian_type = type_map.get(callout_type, 'note')

            # Add the title line to callout
            full_title = f"{title} {rest}".strip()
            callout_lines.append(f"> [!{obsidian_type}] {full_title}")

            i += 1

            # Collect body content until the next heading or next callout starter or end
            while i < len(lines):
                next_line = lines[i]
                next_match = is_callout_starter(next_line)
                is_heading = heading_pattern.match(next_line)

                if next_match or is_heading:
                    break

                # Add the body line with > prefix
                if next_line.strip() == '':
                    callout_lines.append('>')
                else:
                    callout_lines.append(f"> {next_line}")
                i += 1

            result.append('\n'.join(callout_lines))
        else:
            result.append(line)
            i += 1

    return '\n'.join(result)


def add_frontmatter(content, config):
    """Add Obsidian frontmatter, replacing any existing one."""
    # Remove existing frontmatter
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
    """
    Improve formatting carefully:
    - Ensure blank line before headings (but not inside callouts)
    - Ensure blank line before callout blocks
    - Ensure blank line before tables (first row with |)
    - Clean up excessive blank lines
    - Don't break table formatting
    """
    lines = content.split('\n')
    result = []
    i = 0
    in_callout = False
    in_table = False

    callout_starter = re.compile(r'^> \[!')

    while i < len(lines):
        line = lines[i]
        next_in_callout = False

        # Check if this line starts a callout
        is_callout_start = callout_starter.match(line)

        if is_callout_start:
            # Ensure blank line before callout if needed
            if result and result[-1].strip() != '':
                result.append('')
            in_callout = True
            result.append(line)
        elif line.strip().startswith('>') and in_callout:
            result.append(line)
        else:
            # Exiting callout
            if in_callout and line.strip() != '':
                in_callout = False

            # Track table state - a line that looks like a table row
            if line.strip().startswith('|') and line.strip().endswith('|'):
                if not in_table and not in_callout:
                    # This is the first row of a table - add blank line before if needed
                    if result and result[-1].strip() != '':
                        result.append('')
                in_table = True
                result.append(line)
            else:
                if in_table:
                    in_table = False

                # For headings, ensure blank line before
                is_heading = re.match(r'^#{1,6}\s', line)
                if is_heading and not in_callout:
                    if result and result[-1].strip() != '':
                        result.append('')
                    result.append(line)
                else:
                    result.append(line)

        i += 1

    content = '\n'.join(result)

    # Clean up excessive blank lines (3+ -> 2)
    content = re.sub(r'\n{3,}', '\n\n', content)

    # Ensure file ends with a single newline
    content = content.rstrip('\n') + '\n'

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

    print(f"  Wrapping callouts...")
    content = wrap_callouts(content)

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
