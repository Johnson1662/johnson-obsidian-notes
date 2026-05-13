import os
import re
import shutil

def process_md_file(md_path):
    # Extract lecture stem (filename without .md)
    base = os.path.basename(md_path)
    stem = os.path.splitext(base)[0]  # e.g., "第1讲 关系数据模型"
    # Target directory under assets
    target_dir = os.path.join(os.path.dirname(md_path), 'assets', stem)
    os.makedirs(target_dir, exist_ok=True)

    # Read the markdown file
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all image references: ![](images/xxx)
    # Pattern: !\[[^]]*\]\(images/[^)]*\)
    pattern = r'!\[[^]]*\]\(images/[^)]*\)'
    matches = re.findall(pattern, content)
    # Extract the image paths inside parentheses
    img_paths = []
    for match in matches:
        # match looks like ![](images/xxx)
        # extract the part inside parentheses
        inner = match[match.find('(')+1:match.rfind(')')]
        img_paths.append(inner)
    # Deduplicate
    img_paths = list(set(img_paths))

    for img_rel in img_paths:
        # img_rel is like "images/0000496b4f24899ea18fae0e3825416f9d38f261820300573e5c72bab4976be9.jpg"
        src_path = os.path.join(os.path.dirname(md_path), img_rel)
        if not os.path.isfile(src_path):
            print(f"Warning: Source image not found: {src_path}")
            continue
        filename = os.path.basename(img_rel)
        dst_path = os.path.join(target_dir, filename)
        # Move the file
        shutil.move(src_path, dst_path)
        # Update the reference in content: replace images/xxx with assets/stem/filename
        new_rel = os.path.join('assets', stem, filename).replace('\\', '/')
        content = content.replace(img_rel, new_rel)
        print(f"Moved: {src_path} -> {dst_path}")

    # Write back the updated content
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # Find all .md files in base_dir (not recursive)
    for entry in os.listdir(base_dir):
        if entry.endswith('.md'):
            md_path = os.path.join(base_dir, entry)
            print(f"Processing {md_path}")
            process_md_file(md_path)

if __name__ == '__main__':
    main()