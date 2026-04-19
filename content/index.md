---
title: Dashboard
cssclass: dashboard
---

<div class="db-root">

<!-- ════════════════════════════════════
     HEADER
     ════════════════════════════════════ -->
<div class="db-header">
<span class="db-title">Dashboard</span>
<span class="db-subtitle">天津大学 · 计算机科学与技术 · 知识花园</span>
<div class="db-stats-row">
<div class="db-stat-pill">
<div class="db-stat-num">195</div>
<div class="db-stat-lbl">notes</div>
</div>
<div class="db-stat-pill">
<div class="db-stat-num">9</div>
<div class="db-stat-lbl">courses</div>
</div>
<div class="db-stat-pill">
<div class="db-stat-num">3</div>
<div class="db-stat-lbl">projects</div>
</div>
<div class="db-stat-pill">
<div class="db-stat-num">12</div>
<div class="db-stat-lbl">plans</div>
</div>
</div>
</div>

<!-- ════════════════════════════════════
     BENTO GRID — Row 1
     ════════════════════════════════════ -->
<div class="db-grid">

<!-- ── Focus Card ── -->
<div class="db-card db-span-8">
<div class="db-card-label">⚡ today's focus</div>
<div class="db-focus">
持续学习并行计算与深度学习，每周完成课程笔记。<br>
<span style="opacity:0.5;font-size:0.75em;">trust the process.</span>
</div>
</div>

<!-- ── Quick Actions ── -->
<div class="db-card db-span-4">
<div class="db-card-label">⌘ system</div>
<div class="db-actions">
<a class="db-action-btn" href="每日规划/"><span class="db-action-icon">📋</span><span class="db-action-lbl">规划</span></a>
<a class="db-action-btn" href="项目/Agent开发学习路线.md"><span class="db-action-icon">🚀</span><span class="db-action-lbl">项目</span></a>
<a class="db-action-btn" href="资源/课程安排.md"><span class="db-action-icon">📅</span><span class="db-action-lbl">课表</span></a>
<a class="db-action-btn" href="助手记忆.md"><span class="db-action-icon">🧠</span><span class="db-action-lbl">记忆</span></a>
<a class="db-action-btn" href="知识库/Triton.md"><span class="db-action-icon">⚡</span><span class="db-action-lbl">Triton</span></a>
<a class="db-action-btn" href="GL/"><span class="db-action-icon">📐</span><span class="db-action-lbl">GL</span></a>
</div>
</div>

</div>

<!-- ════════════════════════════════════
     BENTO GRID — Row 2: Courses
     ════════════════════════════════════ -->
<div class="db-grid">

<!-- ── Professional Courses ── -->
<div class="db-card db-span-6">
<div class="db-card-label">📚 专业课程</div>
<div class="db-course-list">
<a class="db-course-item" href="知识库/并行计算/README.md">
<span class="db-course-icon">⚡</span>
<div class="db-course-info">
<p class="db-course-name">并行计算</p>
<p class="db-course-desc">MPI · OpenMP · Pthread · 异构计算</p>
<div class="db-progress"><div class="db-progress-fill" style="width:80%;background:var(--db-accent);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="知识库/数据库系统/第1讲-关系数据模型.md">
<span class="db-course-icon">🗄️</span>
<div class="db-course-info">
<p class="db-course-name">数据库系统</p>
<p class="db-course-desc">关系模型 · SQL · 事务 · 并发控制</p>
<div class="db-progress"><div class="db-progress-fill" style="width:100%;background:var(--db-green);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="知识库/深入理解计算机系统/第二章 信息的表示和处理.md">
<span class="db-course-icon">🏗️</span>
<div class="db-course-info">
<p class="db-course-name">深入理解计算机系统</p>
<p class="db-course-desc">信息表示 · 异常控制流 · 虚拟内存</p>
<div class="db-progress"><div class="db-progress-fill" style="width:50%;background:var(--db-orange);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="知识库/知识工程/第一讲 知识工程与知识图谱.md">
<span class="db-course-icon">🧠</span>
<div class="db-course-info">
<p class="db-course-name">知识工程</p>
<p class="db-course-desc">知识图谱 · 知识表示 · 数据管理</p>
<div class="db-progress"><div class="db-progress-fill" style="width:38%;background:var(--db-purple);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="知识库/数据结构/第7章 图.md">
<span class="db-course-icon">💻</span>
<div class="db-course-info">
<p class="db-course-name">数据结构</p>
<p class="db-course-desc">图 · 查找 · 内部排序</p>
<div class="db-progress"><div class="db-progress-fill" style="width:40%;background:var(--db-green);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
</div>
</div>

<!-- ── AI Courses ── -->
<div class="db-card db-span-6">
<div class="db-card-label">🤖 AI & 深度学习</div>
<div class="db-course-list">
<a class="db-course-item" href="知识库/RethinkFun深度学习/README.md">
<span class="db-course-icon">🔥</span>
<div class="db-course-info">
<p class="db-course-name">RethinkFun 深度学习</p>
<p class="db-course-desc">18 章 · 线性代数 → Transformer → LLM</p>
<div class="db-progress"><div class="db-progress-fill" style="width:100%;background:var(--db-accent);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="知识库/Agent/1 Transformer架构.md">
<span class="db-course-icon">🤖</span>
<div class="db-course-info">
<p class="db-course-name">Agent 开发</p>
<p class="db-course-desc">Transformer · LLM推理 · 工具调用</p>
<div class="db-progress"><div class="db-progress-fill" style="width:100%;background:var(--db-purple);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="GL/离散数学/01-命题逻辑入门.md">
<span class="db-course-icon">📐</span>
<div class="db-course-info">
<p class="db-course-name">GL 系列课程</p>
<p class="db-course-desc">离散数学 · 机器学习 · Mamba 量化</p>
<div class="db-progress"><div class="db-progress-fill" style="width:30%;background:var(--db-orange);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="知识库/数理基础课程/线性代数.md">
<span class="db-course-icon">🔬</span>
<div class="db-course-info">
<p class="db-course-name">数理基础</p>
<p class="db-course-desc">线性代数 · 概率论 · 大物2A</p>
<div class="db-progress"><div class="db-progress-fill" style="width:60%;background:var(--db-yellow);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="知识库/程序设计综合实践/递归.md">
<span class="db-course-icon">🧩</span>
<div class="db-course-info">
<p class="db-course-name">程序设计综合实践</p>
<p class="db-course-desc">递归 · DFS · 单调队列</p>
<div class="db-progress"><div class="db-progress-fill" style="width:30%;background:var(--db-green);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
</div>
</div>

</div>

<!-- ════════════════════════════════════
     BENTO GRID — Row 3
     ════════════════════════════════════ -->
<div class="db-grid">

<!-- ── Habit Tracker ── -->
<div class="db-card db-span-4">
<div class="db-card-label">🔥 本周习惯</div>
<div class="db-habit-row">
<span class="db-habit-name">📖 阅读笔记</span>
<div class="db-habit-dots">
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot"></div>
<div class="db-habit-dot"></div>
</div>
</div>
<div class="db-habit-row">
<span class="db-habit-name">💻 代码练习</span>
<div class="db-habit-dots">
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot"></div>
<div class="db-habit-dot"></div>
<div class="db-habit-dot"></div>
<div class="db-habit-dot"></div>
</div>
</div>
<div class="db-habit-row">
<span class="db-habit-name">🧠 深度学习</span>
<div class="db-habit-dots">
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot"></div>
<div class="db-habit-dot"></div>
<div class="db-habit-dot"></div>
</div>
</div>
<div class="db-habit-row">
<span class="db-habit-name">📝 每日规划</span>
<div class="db-habit-dots">
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot active"></div>
<div class="db-habit-dot"></div>
</div>
</div>
</div>

<!-- ── Recent Plans ── -->
<div class="db-card db-span-4">
<div class="db-card-label">📅 近期规划</div>
<div class="db-recent-list">
<div class="db-recent-item">
<div class="db-recent-dot" style="background:var(--db-accent);"></div>
<span class="db-recent-title">[[每日规划/2026-03-01]]</span>
<span class="db-recent-date">03-01</span>
</div>
<div class="db-recent-item">
<div class="db-recent-dot" style="background:var(--db-green);"></div>
<span class="db-recent-title">[[每日规划/2026-02-22]]</span>
<span class="db-recent-date">02-22</span>
</div>
<div class="db-recent-item">
<div class="db-recent-dot" style="background:var(--db-purple);"></div>
<span class="db-recent-title">[[每日规划/2026-02-19]]</span>
<span class="db-recent-date">02-19</span>
</div>
<div class="db-recent-item">
<div class="db-recent-dot" style="background:var(--db-orange);"></div>
<span class="db-recent-title">[[每日规划/2026-02-15]]</span>
<span class="db-recent-date">02-15</span>
</div>
<div class="db-recent-item">
<div class="db-recent-dot" style="background:var(--db-yellow);"></div>
<span class="db-recent-title">[[每日规划/2026-02-13]]</span>
<span class="db-recent-date">02-13</span>
</div>
</div>
</div>

<!-- ── Projects ── -->
<div class="db-card db-span-4">
<div class="db-card-label">🚀 进行中项目</div>
<div class="db-course-list">
<a class="db-course-item" href="项目/Agent开发学习路线.md">
<span class="db-course-icon">🤖</span>
<div class="db-course-info">
<p class="db-course-name">Agent 开发</p>
<p class="db-course-desc">12 周执行清单 · 3 个月冲刺</p>
<div class="db-progress"><div class="db-progress-fill" style="width:45%;background:var(--db-accent);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="GL/机器学习与深度学习/学习需求.md">
<span class="db-course-icon">📊</span>
<div class="db-course-info">
<p class="db-course-name">ML/DL 学习</p>
<p class="db-course-desc">机器学习引论 · 系统化学习</p>
<div class="db-progress"><div class="db-progress-fill" style="width:15%;background:var(--db-green);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
<a class="db-course-item" href="GL/Mamba模型量化/学习需求.md">
<span class="db-course-icon">⚙️</span>
<div class="db-course-info">
<p class="db-course-name">Mamba 模型量化</p>
<p class="db-course-desc">SSM · 量化挑战与方案</p>
<div class="db-progress"><div class="db-progress-fill" style="width:50%;background:var(--db-purple);"></div></div>
</div>
<span class="db-course-arrow">→</span>
</a>
</div>
</div>

</div>

<div class="db-footer">
⚡ quartz · obsidian · border theme · v2
</div>

</div>
