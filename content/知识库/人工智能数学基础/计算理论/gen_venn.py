import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Arc, Wedge, Circle
import os

# --- 字体设置 ---
# Windows 系统常用中文字体
font_paths = [
    'C:/Windows/Fonts/msyh.ttc',       # Microsoft YaHei
    'C:/Windows/Fonts/simhei.ttf',     # SimHei
    'C:/Windows/Fonts/msyhbd.ttc',     # Microsoft YaHei Bold
]
zh_font = None
for fp in font_paths:
    if os.path.exists(fp):
        from matplotlib.font_manager import FontProperties
        zh_font = FontProperties(fname=fp)
        break

if zh_font is None:
    # fallback: 用系统默认，尝试找任意中文字体
    import matplotlib.font_manager as fm
    for f in fm.findSystemFonts():
        try:
            prop = fm.FontProperties(fname=f)
            if prop.get_name() and any(k in f.lower() for k in ['yahei','simhei','msyh','noto','cjk','fang','song','hei','kai','ming']):
                zh_font = prop
                break
        except:
            pass

# --- 创建画布 ---
fig, ax = plt.subplots(figsize=(7, 5))
ax.set_xlim(-2.5, 2.5)
ax.set_ylim(-2, 2.5)
ax.set_aspect('equal')
ax.axis('off')

# --- 画两个重叠圆 ---
# NP 圆 (左)
circle_np = plt.Circle((-0.6, 0), 1.5, fill=False, edgecolor='#2B5B84', linewidth=2.5, zorder=2)
ax.add_patch(circle_np)
# NP 填充 (半透明)
circle_np_fill = plt.Circle((-0.6, 0), 1.5, color='#2B5B84', alpha=0.05, zorder=1)
ax.add_patch(circle_np_fill)

# NP-hard 圆 (右)
circle_nphard = plt.Circle((0.6, 0), 1.5, fill=False, edgecolor='#C0392B', linewidth=2.5, zorder=2)
ax.add_patch(circle_nphard)
circle_nphard_fill = plt.Circle((0.6, 0), 1.5, color='#C0392B', alpha=0.05, zorder=1)
ax.add_patch(circle_nphard_fill)

# --- 标签 ---
kw = dict(fontproperties=zh_font, fontsize=14, fontweight='bold')

# 集合名称
ax.text(-1.8, 1.5, 'NP', ha='center', va='center', color='#2B5B84', **kw)
ax.text(1.8, 1.5, 'NP-hard', ha='center', va='center', color='#C0392B', **kw)

# P (NP 左半, 不重叠区域)
ax.text(-1.2, 0.3, 'P', ha='center', va='center', fontsize=11, fontproperties=zh_font,
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#E8F0FE', edgecolor='#2B5B84', alpha=0.8))

# NPC (重叠区域)
ax.text(0, 0, 'NPC\n(NP∩NP-hard)', ha='center', va='center', fontsize=11, fontproperties=zh_font,
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#F0E6E6', edgecolor='#8B0000', alpha=0.8))

# NP-hard 右半 (不重叠)
ax.text(1.2, 0.3, '不在 NP 中的\nNP-hard 问题\n(如 HALT)', ha='center', va='center', fontsize=9, fontproperties=zh_font,
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#FDE8E8', edgecolor='#C0392B', alpha=0.8))

# NP 左下半 (NP中非P非NPC)
ax.text(-1.2, -0.6, 'NP中其他\n问题(NPI?)', ha='center', va='center', fontsize=9, fontproperties=zh_font,
        bbox=dict(boxstyle='round,pad=0.3', facecolor='#E8F0FE', edgecolor='#2B5B84', alpha=0.8))

# --- 标题 ---
# ax.set_title('P, NP, NPC, NP-hard 关系图', fontproperties=zh_font, fontsize=14, fontweight='bold')

# --- 图例 ---
# 用文本标注底部
ax.text(0, -1.8, 'P ⊆ NP,  NPC = NP ∩ NP-hard,  NP-hard ⊇ NPC', 
        ha='center', va='center', fontsize=10, fontproperties=zh_font,
        style='italic', color='#555')

# --- 输出 ---
output_dir = os.path.dirname(os.path.abspath(__file__))
# assets 目录
assets_dir = os.path.join(output_dir, 'assets', '计算理论')
os.makedirs(assets_dir, exist_ok=True)
output_path = os.path.join(assets_dir, 'p_np_npc_nphard_venn.png')
plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
plt.close()
print(f'Saved to: {output_path}')
