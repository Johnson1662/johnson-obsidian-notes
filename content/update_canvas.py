import json

with open('网络技术挑战赛.canvas', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Update groups
for node in data['nodes']:
    if node['id'] == 'group00000000001':
        node['label'] = '1. 数据平面 (P4 可编程数据平面)'
    elif node['id'] == 'group00000000002':
        node['label'] = '3. 采集层 (Collector Agent)'
    elif node['id'] == 'group00000000003':
        node['label'] = '5. 控制平面 (多智能体系统 CrewAI / LangGraph)'
    elif node['id'] == 'group00000000004':
        node['label'] = '6. 知识模型层 (SecGPT + RAG)'
    elif node['id'] == 'group00000000005':
        node['label'] = '7. 执行与展示层'

# Update existing text nodes
for node in data['nodes']:
    if node['id'] == 'node000000000002':
        node['text'] = "## P4 Programmable Switch\n\n**系统高速实时处理核心**\n\n- 自定义包解析、匹配、统计特征提取（五元组、包长、间隔、熵值等）。\n- **作用**：实现线速（10Gbps+）初步过滤 + 打标签，只把可疑流 + INT物理元数据上送后续层。"
    elif node['id'] == 'node000000000003':
        node['text'] = "## INT (In-band Network Telemetry)\n\n- 逐跳采集物理特性（纳秒级时延、队列深度、端口利用率、缓冲区占用等）。\n- **大赛亮点**：B-EP1赛道核心技术，体现可编程网络。"
    elif node['id'] == 'node000000000004':
        node['text'] = "**架构亮点**\n\n数据平面仅将**可疑流**与 **INT物理元数据** 上送给控制平面。深度体现了可编程网络的卸载价值。"
    elif node['id'] == 'node000000000005':
        node['text'] = "## Collector Agent\n\n**数据桥梁**\n\n- 统一解析 P4/INT 导出的流特征 + 物理栈 +（可选）eBPF 输出。\n- **作用**：标准化后分发给多Agent，同时调用 Wireshark/tshark 导出补充特征。"
    elif node['id'] == 'node000000000006':
        node['text'] = "## Detector Agent\n\n**1. 轻量初筛**\n\n接收 Collector + Wireshark 数据。利用预设规则或轻量级小模型，快速判断流量是否异常。极大减少后续大模型的算力开销。"
    elif node['id'] == 'node000000000007':
        node['text'] = "## Classifier Agent\n\n**2. 核心多类分类**\n\n接收 Detector 数据，调用 SecGPT 进行精细分类。"
    elif node['id'] == 'node000000000008':
        node['text'] = "## Explainer Agent\n\n**3. 证据链与可解释性报告**\n\n结合 RAG 和 SecGPT 生成自然语言报告。解释分类依据，将抽象特征还原为**物理证据**与**攻击链溯源**。"
    elif node['id'] == 'node000000000009':
        node['text'] = "## Defender Agent\n\n**4. 防御决策引擎**\n\n根据分类结果，自动制定相应的防御策略，形成闭环决策。"
    elif node['id'] == 'node000000000010':
        node['text'] = "## Supervisor Agent\n\n**全局协作中枢**\n\n- 协调全局 Agent 消息流转\n- 协调可选 eBPF 规则更新"
    elif node['id'] == 'node000000000011':
        node['text'] = "## SecGPT\n\n**专业知识引擎**\n\nSecGPT 提供安全领域推理；结合 INT 物理特性 + Wireshark 解析结果，生成带物理证据的攻击链报告。"
    elif node['id'] == 'node000000000012':
        node['text'] = "## RAG 知识库\n\n**动态检索**\n\nRAG 动态检索知识库消除幻觉。存储安全领域专属知识（图谱/向量化）。"
    elif node['id'] == 'node000000000013':
        node['text'] = "## ONOS / P4Runtime\n\n**SDN 自动下发**\n\n动态下发 P4 规则（可选同步 eBPF 规则），闭环执行。"
    elif node['id'] == 'node000000000014':
        node['text'] = "## Web 可视化仪表盘\n\n**闭环执行与人机交互**\n\n- Echarts/Grafana 实时展示物理热力图。\n- Agent 对话 + SecGPT 报告 + Wireshark 截图/导出。\n- 完整演示闭环 + PDF 报告导出。"

# Add new groups and nodes
new_nodes = [
    {"id":"group00000000006","type":"group","x":-250,"y":620,"width":480,"height":340,"color":"1","label":"2. 可选快速防御层 (eBPF/XDP)"},
    {"id":"node000000000015","type":"text","text":"## eBPF / XDP\n\n**可选增强模块（服务器内核快速响应）**\n\n- 在服务器网卡入口（XDP钩子）读取 P4 标签，进行轻量二分类初筛或直接 XDP_DROP。\n- **作用**：进一步减轻多Agent计算压力，实现“P4挡洪水 → eBPF快速过滤”的两级漏斗。\n- **何时开启**：时间充足、想加强实时防御时使用；时间紧可省略，不影响核心功能。\n- **与 Wireshark 配合**：用 xdpdump + Wireshark 共同调试 eBPF 处理前后流量。","x":-220,"y":660,"width":420,"height":260},
    {"id":"group00000000007","type":"group","x":1400,"y":620,"width":480,"height":450,"color":"4","label":"4. 验证层 (Wireshark / tshark)"},
    {"id":"node000000000016","type":"text","text":"## Wireshark / tshark\n\n**全新独立验证与可视化辅助层**\n\n- **Wireshark（GUI）**：实时捕获 Mininet/BMv2 端口流量，验证 INT Metadata 栈是否正确插入、协议解析是否完整。\n- **tshark（命令行）**：自动化导出 CSV/JSON 特征（结合 INT 物理数据），供 Collector Agent 使用。\n- **作用**：测试验证（P4联动正确性），数据集构建，演示可视化。\n- **与系统融合**：并行工作，不影响实时路径；输出直接喂 Dashboard 和 SecGPT。\n- **大赛亮点**：工程严谨性、可视化效果拉满，获奖作品常用工具。","x":1430,"y":660,"width":420,"height":370}
]

data['nodes'].extend(new_nodes)

# Add new edges if helpful
new_edges = [
    {"id":"edge000000000022","fromNode":"node000000000002","fromSide":"bottom","toNode":"node000000000015","toSide":"top","label":"P4 标签"},
    {"id":"edge000000000023","fromNode":"node000000000015","fromSide":"right","toNode":"node000000000005","toSide":"left","label":"eBPF 输出"},
    {"id":"edge000000000024","fromNode":"node000000000002","fromSide":"right","toNode":"node000000000016","toSide":"top","label":"流量镜像"},
    {"id":"edge000000000025","fromNode":"node000000000016","fromSide":"left","toNode":"node000000000005","toSide":"right","label":"CSV/JSON 特征"},
    {"id":"edge000000000026","fromNode":"node000000000016","fromSide":"bottom","toNode":"node000000000014","toSide":"right","label":"截图/导出"},
    {"id":"edge000000000027","fromNode":"node000000000016","fromSide":"bottom","toNode":"node000000000011","toSide":"right","label":"解析结果"}
]

data['edges'].extend(new_edges)

with open('网络技术挑战赛.canvas', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent="\t")

