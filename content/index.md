---
title: Dashboard
cssclasses: [dashboard-clean]
---

<div class="dash-wrapper">
  
  <!-- HEADER -->
  <header class="dash-header">
    <div class="dash-title-group">
      <h1>Digital Garden</h1>
      <p class="dash-subtitle">天津大学 · 计算机科学与技术</p>
    </div>
    <div class="dash-stats">
      <div class="dash-stat"><span>195</span> Notes</div>
      <div class="dash-stat"><span>9</span> Courses</div>
      <div class="dash-stat"><span>3</span> Projects</div>
      <div class="dash-stat"><span>12</span> Plans</div>
    </div>
  </header>

  <!-- BANNER -->
  <div class="dash-banner">
    <div class="dash-banner-icon">🎯</div>
    <div class="dash-banner-text">
      <strong>Today's Focus:</strong> 持续学习并行计算与深度学习，每周完成课程笔记。<br>
      <span class="dash-muted">trust the process.</span>
    </div>
  </div>

  <!-- MAIN GRID -->
  <div class="dash-grid">
    
    <!-- LEFT COLUMN -->
    <div class="dash-col">
      
      <section class="dash-section">
        <h2 class="dash-h2">Navigation</h2>
        <div class="dash-nav-grid">
          <a href="每日规划/" class="dash-nav-btn">📋 <span>规划</span></a>
          <a href="项目/Agent开发学习路线.md" class="dash-nav-btn">🚀 <span>项目</span></a>
          <a href="资源/课程安排.md" class="dash-nav-btn">📅 <span>课表</span></a>
          <a href="助手记忆.md" class="dash-nav-btn">🧠 <span>记忆</span></a>
          <a href="知识库/Triton.md" class="dash-nav-btn">⚡ <span>Triton</span></a>
          <a href="GL/" class="dash-nav-btn">📐 <span>GL</span></a>
        </div>
      </section>

      <section class="dash-section">
        <h2 class="dash-h2">Active Projects</h2>
        <div class="dash-list">
          <a href="项目/Agent开发学习路线.md" class="dash-card">
            <h3>🤖 Agent 开发</h3>
            <p>12 周执行清单 · 3 个月冲刺</p>
            <div class="dash-progress" style="--p: 45%;"></div>
          </a>
          <a href="GL/机器学习与深度学习/学习需求.md" class="dash-card">
            <h3>📊 ML/DL 学习</h3>
            <p>机器学习引论 · 系统化学习</p>
            <div class="dash-progress" style="--p: 15%;"></div>
          </a>
          <a href="GL/Mamba模型量化/学习需求.md" class="dash-card">
            <h3>⚙️ Mamba 模型量化</h3>
            <p>SSM · 量化挑战与方案</p>
            <div class="dash-progress" style="--p: 50%;"></div>
          </a>
        </div>
      </section>

      <section class="dash-section">
        <h2 class="dash-h2">Recent Plans</h2>
        <div class="dash-timeline">
          <div class="dash-time-item"><span class="dash-time">03-01</span> <a href="每日规划/2026-03-01.md">2026-03-01 规划</a></div>
          <div class="dash-time-item"><span class="dash-time">02-22</span> <a href="每日规划/2026-02-22.md">2026-02-22 规划</a></div>
          <div class="dash-time-item"><span class="dash-time">02-19</span> <a href="每日规划/2026-02-19.md">2026-02-19 规划</a></div>
          <div class="dash-time-item"><span class="dash-time">02-15</span> <a href="每日规划/2026-02-15.md">2026-02-15 规划</a></div>
          <div class="dash-time-item"><span class="dash-time">02-13</span> <a href="每日规划/2026-02-13.md">2026-02-13 规划</a></div>
        </div>
      </section>

    </div>

    <!-- RIGHT COLUMN -->
    <div class="dash-col">
      
      <section class="dash-section">
        <h2 class="dash-h2">Professional Courses</h2>
        <div class="dash-list">
          <a href="知识库/并行计算/README.md" class="dash-item-compact">
            <span class="dash-emoji">⚡</span>
            <div class="dash-item-content">
              <div class="dash-item-title">并行计算 <span class="dash-tag">80%</span></div>
              <div class="dash-item-desc">MPI · OpenMP · Pthread · 异构计算</div>
            </div>
          </a>
          <a href="知识库/数据库系统/第1讲-关系数据模型.md" class="dash-item-compact">
            <span class="dash-emoji">🗄️</span>
            <div class="dash-item-content">
              <div class="dash-item-title">数据库系统 <span class="dash-tag done">100%</span></div>
              <div class="dash-item-desc">关系模型 · SQL · 事务 · 并发控制</div>
            </div>
          </a>
          <a href="知识库/深入理解计算机系统/第二章 信息的表示和处理.md" class="dash-item-compact">
            <span class="dash-emoji">🏗️</span>
            <div class="dash-item-content">
              <div class="dash-item-title">深入理解计算机系统 <span class="dash-tag">50%</span></div>
              <div class="dash-item-desc">信息表示 · 异常控制流 · 虚拟内存</div>
            </div>
          </a>
          <a href="知识库/知识工程/第一讲 知识工程与知识图谱.md" class="dash-item-compact">
            <span class="dash-emoji">🧠</span>
            <div class="dash-item-content">
              <div class="dash-item-title">知识工程 <span class="dash-tag">38%</span></div>
              <div class="dash-item-desc">知识图谱 · 知识表示 · 数据管理</div>
            </div>
          </a>
          <a href="知识库/数据结构/第7章 图.md" class="dash-item-compact">
            <span class="dash-emoji">💻</span>
            <div class="dash-item-content">
              <div class="dash-item-title">数据结构 <span class="dash-tag">40%</span></div>
              <div class="dash-item-desc">图 · 查找 · 内部排序</div>
            </div>
          </a>
        </div>
      </section>

      <section class="dash-section">
        <h2 class="dash-h2">AI & Deep Learning</h2>
        <div class="dash-list">
          <a href="知识库/RethinkFun深度学习/README.md" class="dash-item-compact">
            <span class="dash-emoji">🔥</span>
            <div class="dash-item-content">
              <div class="dash-item-title">RethinkFun 深度学习 <span class="dash-tag done">100%</span></div>
              <div class="dash-item-desc">18 章 · 线性代数 → Transformer → LLM</div>
            </div>
          </a>
          <a href="知识库/Agent/1 Transformer架构.md" class="dash-item-compact">
            <span class="dash-emoji">🤖</span>
            <div class="dash-item-content">
              <div class="dash-item-title">Agent 开发 <span class="dash-tag done">100%</span></div>
              <div class="dash-item-desc">Transformer · LLM推理 · 工具调用</div>
            </div>
          </a>
          <a href="GL/离散数学/01-命题逻辑入门.md" class="dash-item-compact">
            <span class="dash-emoji">📐</span>
            <div class="dash-item-content">
              <div class="dash-item-title">GL 系列课程 <span class="dash-tag">30%</span></div>
              <div class="dash-item-desc">离散数学 · 机器学习 · Mamba 量化</div>
            </div>
          </a>
          <a href="知识库/数理基础课程/线性代数.md" class="dash-item-compact">
            <span class="dash-emoji">🔬</span>
            <div class="dash-item-content">
              <div class="dash-item-title">数理基础 <span class="dash-tag">60%</span></div>
              <div class="dash-item-desc">线性代数 · 概率论 · 大物2A</div>
            </div>
          </a>
          <a href="知识库/程序设计综合实践/递归.md" class="dash-item-compact">
            <span class="dash-emoji">🧩</span>
            <div class="dash-item-content">
              <div class="dash-item-title">程序设计综合实践 <span class="dash-tag">30%</span></div>
              <div class="dash-item-desc">递归 · DFS · 单调队列</div>
            </div>
          </a>
        </div>
      </section>

      <section class="dash-section">
        <h2 class="dash-h2">Weekly Habits</h2>
        <div class="dash-habits">
          <div class="dash-habit-row">
            <span>📖 阅读笔记</span>
            <div class="dash-dots"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></div>
          </div>
          <div class="dash-habit-row">
            <span>💻 代码练习</span>
            <div class="dash-dots"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i><i></i><i></i></div>
          </div>
          <div class="dash-habit-row">
            <span>🧠 深度学习</span>
            <div class="dash-dots"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div>
          </div>
          <div class="dash-habit-row">
            <span>📝 每日规划</span>
            <div class="dash-dots"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div>
          </div>
        </div>
      </section>

    </div>
  </div>
  
  <footer class="dash-footer">
    Digital Garden · Structured & Minimalist
  </footer>
</div>
