import re
import sys
import os

def clean_markdown(filepath, outpath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Remove repeated content/outlines
    content = re.sub(r'# 目录\n\nC O N T E N T S\n\n(0?1.*?)\n(!\[.*?\]\(.*?\.jpg\)\n\n)?', '', content, flags=re.DOTALL)
    
    # Remove decorative images and small ones (heuristically)
    # This is simple for now - we'll just keep the first occurrence of images in sections
    
    # Write output
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write("# 知识工程与知识图谱 - 第1讲\n\n")
        f.write(content)

if __name__ == '__main__':
    clean_markdown(sys.argv[1], sys.argv[2])
