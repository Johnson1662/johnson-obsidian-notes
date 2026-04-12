import pymupdf
import os

# 定义文件路径
pdf1_path = "/mnt/d/学习/专业课/并行计算/试题/2013级考试题.pdf"
pdf2_path = "/mnt/d/学习/专业课/并行计算/试题/21222_并行计算.pdf"

# 检查文件是否存在
print(f"文件1存在: {os.path.exists(pdf1_path)}")
print(f"文件2存在: {os.path.exists(pdf2_path)}")

# 解析第一个PDF
print("\n" + "="*50)
print("解析第一个PDF: 2013级考试题.pdf")
print("="*50)

try:
    doc1 = pymupdf.open(pdf1_path)
    print(f"页数: {len(doc1)}")
    
    # 提取文本
    text1 = ""
    for page in doc1:
        text1 += page.get_text()
    
    print("\n文本内容预览 (前1000字符):")
    print(text1[:1000])
    print(f"\n总字符数: {len(text1)}")
    
except Exception as e:
    print(f"解析第一个PDF出错: {e}")
    text1 = ""

# 解析第二个PDF
print("\n" + "="*50)
print("解析第二个PDF: 21222_并行计算.pdf")
print("="*50)

try:
    doc2 = pymupdf.open(pdf2_path)
    print(f"页数: {len(doc2)}")
    
    # 提取文本
    text2 = ""
    for page in doc2:
        text2 += page.get_text()
    
    print("\n文本内容预览 (前1000字符):")
    print(text2[:1000])
    print(f"\n总字符数: {len(text2)}")
    
except Exception as e:
    print(f"解析第二个PDF出错: {e}")
    text2 = ""

# 保存解析结果到文本文件
output_dir = "/mnt/d/quartz-repo/content/知识库/并行计算"
os.makedirs(output_dir, exist_ok=True)

# 保存第一个PDF的文本
with open(f"{output_dir}/2013级考试题_解析.txt", "w", encoding="utf-8") as f:
    f.write(f"=== 2013级考试题 ===\n\n{text1}")

# 保存第二个PDF的文本
with open(f"{output_dir}/21222_并行计算_解析.txt", "w", encoding="utf-8") as f:
    f.write(f"=== 21222_并行计算 ===\n\n{text2}")

print(f"\n解析结果已保存到: {output_dir}")