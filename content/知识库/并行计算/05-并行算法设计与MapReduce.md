# 并行算法设计与MapReduce

> 📚 本章涵盖：PPT 10 MapReduce编程、PPT 11 并行算法设计、PPT 12 并行程序设计方法学
> 
> 🎯 对应考点：**PCAM方法学（必考！）**、域分解vs功能分解、MapReduce算法

---

## 一、并行算法设计概述

### 1.1 并行算法的定义

**串行算法**：只有一组计算指令序列

**并行算法**：一些可同时执行的计算任务的集合，这些计算任务分工合作获得给定问题的求解。

**设计思想**：
- 并行算法设计不是串行算法设计的进阶
- 并行计算硬件环境没有统一的体系结构
- 并行算法的设计与问题本身以及硬件平台均相关

### 1.2 设计并行算法的三种策略

| 策略 | 说明 | 特点 |
|------|------|------|
| **串行算法直接并行化** | 发掘现有串行算法中的并行性 | 最常用，但不是所有问题可行 |
| **从问题描述开始设计** | 根据问题固有属性从头设计 | 难度大，但通常更高效 |
| **借用已有算法** | 借助已有的并行算法求解新问题 | 基于类比或问题转换 |

> 🎯 **简答题考点**：能解释三种并行算法设计策略的主要思想

---

## 二、PCAM设计方法学（⭐⭐⭐ 必考！）

### 2.1 PCAM概述

**PCAM**是并行算法设计的四个步骤：

| 步骤 | 英文 | 中文 | 主要任务 |
|------|------|------|----------|
| **P** | Partitioning | 划分 | 将问题分解为小任务 |
| **C** | Communication | 通信 | 确定任务间的数据交换 |
| **A** | Agglomeration | 聚合 | 合并小任务以提高性能 |
| **M** | Mapping | 映射 | 将任务分配到处理器 |

### 2.2 详解各步骤

#### P - 划分（Partitioning）

**目标**：将问题分解为足够多的小任务，暴露并行性

**两种划分方式**：

**1. 域分解（Domain Decomposition）/ 数据分解**
- 将数据划分为多个子域
- 每个处理器处理一个子域
- 适合数据密集型应用

```
原始数据：            域分解：
┌─────────────┐     ┌─────┬─────┐
│             │     │ P0  │ P1  │
│   完整数据   │ →   ├─────┼─────┤
│             │     │ P2  │ P3  │
└─────────────┘     └─────┴─────┘
```

**2. 功能分解（Functional Decomposition）/ 任务分解**
- 将任务按功能划分为多个子任务
- 每个处理器执行不同的功能
- 适合功能明确的应用

```
功能分解：
    ┌──────────────────────────┐
    │         主任务            │
    └──────┬──────┬──────┬─────┘
           │      │      │
     ┌─────▼┐ ┌──▼───┐ ┌▼─────┐
     │功能A │ │功能B │ │功能C  │
     │ (P0) │ │ (P1) │ │ (P2) │
     └──────┘ └──────┘ └──────┘
```

#### C - 通信（Communication）

**目标**：确定任务间需要交换的数据

**通信类型**：

| 类型 | 说明 |
|------|------|
| **局部通信** | 只与相邻任务通信 |
| **全局通信** | 需要与所有任务通信 |
| **静态通信** | 通信模式固定 |
| **动态通信** | 通信模式在运行时决定 |

**优化原则**：
- 减少通信次数
- 增大每次通信的数据量
- 重叠计算与通信

#### A - 聚合（Agglomeration）

**目标**：将小任务合并为大任务，减少通信开销和任务管理开销

**聚合原则**：
- 减少通信频率
- 保持负载均衡
- 不增加太多串行部分

#### M - 映射（Mapping）

**目标**：将任务分配到具体的处理器上

**映射策略**：

| 策略 | 说明 |
|------|------|
| **静态映射** | 编译时确定任务分配 |
| **动态映射** | 运行时分配任务 |
| **负载均衡** | 各处理器工作量尽量相等 |

---

## 三、域分解与功能分解对比

| 特性 | 域分解 | 功能分解 |
|------|--------|----------|
| **划分对象** | 数据 | 任务/功能 |
| **适用场景** | 数据密集型 | 功能密集型 |
| **示例** | 矩阵运算、图像处理 | 流水线、信号处理 |
| **优点** | 负载均衡好 | 灵活性高 |
| **缺点** | 边界通信 | 负载可能不均 |

> 🎯 **简答题**：解释域分解和功能分解及二者的区别

---

## 四、MapReduce编程模型（⭐⭐⭐ 必考！）

### 4.1 什么是MapReduce？

**MapReduce**：
- 由Google提出的分布式计算编程模型
- 用于大规模数据（>1TB）的并行处理
- 核心思想：分而治之（Divide and Conquer）
- 自动实现分布式并行、容错和负载平衡

**特点**：
- 模型抽象简洁，程序员易用
- 运行于大规模分布式集群（>2000节点）
- 支持任务调度和状态监控

### 4.2 MapReduce编程模型

**输入输出**：`<key, value>` 对的集合

**用户只需实现两个函数**：

```
map (in_key, in_value) → list(out_key, intermediate_value)
    - 处理输入的<key, value>对
    - 产生中间结果

reduce (out_key, list(intermediate_value)) → list(out_value)
    - 将相同key的中间结果归约
    - 产生最终结果
```

### 4.3 执行流程

```
输入数据
    │
    ▼
┌─────────────────────────────────────────┐
│              Map阶段                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Worker1 │ │ Worker2 │ │ Worker3 │   │
│  │   Map   │ │   Map   │ │   Map   │   │
│  └────┬────┘ └────┬────┘ └────┬────┘   │
└───────┼───────────┼───────────┼─────────┘
        │           │           │
        ▼           ▼           ▼
   中间结果     中间结果     中间结果
   (k1,v1)     (k2,v2)     (k3,v3)
        │           │           │
        └───────────┼───────────┘
                    │ Shuffle（按key分组）
                    ▼
┌─────────────────────────────────────────┐
│             Reduce阶段                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Worker 1 │ │Worker 2 │ │Worker 3 │   │
│  │ Reduce  │ │ Reduce  │ │ Reduce  │   │
│  └────┬────┘ └────┬────┘ └────┬────┘   │
└───────┼───────────┼───────────┼─────────┘
        │           │           │
        ▼           ▼           ▼
      结果1       结果2       结果3
                    │
                    ▼
                 最终输出
```

---

## 五、MapReduce经典示例

### 5.1 WordCount（词频统计）

**问题**：统计各单词在所有文件中出现的次数

**输入数据**：
- Page1: "the weather is good"
- Page2: "today is good"  
- Page3: "good weather is good"

**Map函数**：
```python
def map(filename, content):
    for word in content.split():
        emit(word, 1)  # 输出 (word, 1)
```

**Map输出**：
```
Worker1: (the,1), (weather,1), (is,1), (good,1)
Worker2: (today,1), (is,1), (good,1)
Worker3: (good,1), (weather,1), (is,1), (good,1)
```

**Shuffle后**（按key分组）：
```
good:    [1, 1, 1, 1]
is:      [1, 1, 1]
the:     [1]
today:   [1]
weather: [1, 1]
```

**Reduce函数**：
```python
def reduce(word, values):
    total = sum(values)
    emit(word, total)
```

**最终输出**：
```
good: 4
is: 3
the: 1
today: 1
weather: 2
```

### 5.2 Inverted Index（倒排索引）⭐⭐⭐

**问题**：统计各单词分别在哪些文件中出现过

**输入数据**：
- Page1: I like Tianjin university
- Page2: Tianjin university is the oldest university in China
- Page3: Tianjin is a beautiful city
- Page4: He is being studied in Tianjin university

**Map函数**：
```python
def map(page_id, content):
    for word in content.split():
        emit(word, page_id)  # 输出 (word, page_id)
```

**Map输出**：
```
Worker1: (I, Page1), (like, Page1), (Tianjin, Page1), (university, Page1)
Worker2: (Tianjin, Page2), (university, Page2), (is, Page2), ...
Worker3: (Tianjin, Page3), (is, Page3), (beautiful, Page3), ...
Worker4: (He, Page4), (is, Page4), (being, Page4), ...
```

**Shuffle后**：
```
Tianjin:    [Page1, Page2, Page3, Page4]
university: [Page1, Page2, Page4]
is:         [Page2, Page3, Page4]
...
```

**Reduce函数**：
```python
def reduce(word, page_list):
    emit(word, page_list)  # 输出 (word, [pages])
```

**最终输出**：
```
Tianjin: [Page1, Page2, Page3, Page4]
university: [Page1, Page2, Page4]
is: [Page2, Page3, Page4]
...
```

> 🎯 **编程题考点**：能写出WordCount或Inverted Index的MapReduce过程

---

## 六、并行程序设计方法学

### 6.1 Foster方法学

与PCAM类似，Foster方法学也包含四个步骤：
1. **划分（Partitioning）**
2. **通信（Communication）**
3. **归并（Agglomeration）**
4. **映射（Mapping）**

### 6.2 设计要点

**负载均衡**：
- 静态划分：数据均分
- 动态调度：任务队列

**通信优化**：
- 减少通信次数
- 批量通信
- 计算与通信重叠

**数据局部性**：
- 时间局部性：重复使用数据
- 空间局部性：访问相邻数据

---

## 七、名词解释汇总

| 术语 | 英文 | 定义 |
|------|------|------|
| **PCAM** | Partition-Communication-Agglomeration-Mapping | 并行算法设计四步骤 |
| **域分解** | Domain Decomposition | 将数据划分为多个子域 |
| **功能分解** | Functional Decomposition | 将任务按功能划分为子任务 |
| **MapReduce** | - | 分布式计算编程模型 |
| **倒排索引** | Inverted Index | 单词到文档的映射关系 |
| **负载均衡** | Load Balancing | 各处理器工作量尽量相等 |
| **聚合** | Agglomeration | 合并小任务以减少开销 |
| **映射** | Mapping | 将任务分配到处理器 |

---

## 八、复习要点

### ✅ 必须掌握
1. PCAM设计方法学的四个步骤及含义
2. 域分解与功能分解的区别
3. MapReduce编程模型的工作原理
4. WordCount和Inverted Index算法

### ⚠️ 常见考题
- 解释PCAM设计方法学（简答题）
- 比较域分解和功能分解（简答题）
- 描述MapReduce的Inverted Index算法（编程题）
- 画出MapReduce执行流程图

### 📖 参考图示
- PCAM流程图 → **PPT 12 第10-15页**
- 域分解示例 → **PPT 11 第15-20页**
- MapReduce流程 → **PPT 10 第10-20页**
- Inverted Index示例 → **PPT 10 第25-35页**

---

*整理自：10 MapReduce编程.pdf (56页)、11 并行算法设计.pdf (52页)、12+并行程序设计方法学.pdf (61页)*
