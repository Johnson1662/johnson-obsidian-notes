# MapReduce编程

## 思考问题
- 数据：10000个英文文本文件
- 问题1（WordCount）：统计各个单词在所有文件中出现的次数
- 问题2（Inverted Index）：统计各个单词分别在哪些文件中出现过
- 串行算法？并行算法？

---

## 大数据背景
- 大量数据不断产生和存储：电子商务、社交网络、图像视频、科学数据
- 处理挑战：
  - 任务计算失败（网络异常、断电、硬件故障）
  - 大量网络通信、负载不均衡、不同机器运行进度不一

---
## MapReduce概述
- 编程模型：抽象简洁，程序员易用
- 大数据处理系统：
  - 运行于大规模分布式集群（>2000节点）
  - 自动实现分布式并行计算
  - 内置容错、负载平衡、任务调度和状态监控
- 核心论文：*MapReduce: Simplified Data Processing on Large Clusters*（Jeffrey Dean, Sanjay Ghemawat）

---

## MapReduce编程模型
输入和输出均为 `<key, value>` 对，用户只需实现两个函数：
```pseudocode
map(in_key, in_value) -> list(out_key, intermediate_value)
reduce(out_key, list(intermediate_value)) -> list(out_value)
```
- `map`：处理输入键值对，生成中间结果
- `reduce`：归约相同key的中间结果，生成最终输出

### 示例1：WordCount
统计所有文件中每个单词的出现次数。
```pseudocode
// map函数：输入为(文件名, 文件内容)
map(String input_key, String input_value):
    for each word w in input_value:
        EmitIntermediate(w, "1")

// reduce函数：输入为(单词, 中间结果列表)
reduce(String output_key, Iterator intermediate_values):
    int result = 0
    for each v in intermediate_values:
        result += ParseInt(v)
    Emit(output_key, AsString(result))
```

**处理流程示例**：
- 源数据：
  - Page 1: the weather is good
  - Page 2: today is good
  - Page 3: good weather is good
- Map输出：(the,1), (weather,1), (is,1), (good,1) 等
- Reduce输出：(the,1), (is,3), (weather,2), (good,4), (today,1)

### 示例2：Inverted Index
统计每个单词出现的文件列表。
```pseudocode
// map函数：输入为(文件名, 文件内容)
map(String input_key, String input_value):
    for each word w in input_value:
        EmitIntermediate(w, input_key)

// reduce函数：输入为(单词, 文件列表)
reduce(String output_key, Iterator intermediate_values):
    String result = ""
    for each v in intermediate_values:
        result += " " + v
    Emit(output_key, result)
```

**处理流程示例**：
- 源数据：
  - foo: This page contains so much text
  - bar: My page contains text too
- Map输出：(this,foo), (page,foo), (contains,foo) 等
- Reduce输出：(page, "foo bar"), (contains, "foo bar") 等

---

## MapReduce运行逻辑
- `map()` 并行执行，不同输入数据集生成不同中间结果
- `reduce()` 并行执行，分别处理不同output key
- map与reduce处理过程无通信
- 瓶颈：所有map任务结束后，reduce任务才能开始

### Shuffle与Sort
- Map输出先写入内存缓冲区，达到阈值后spill到磁盘，预排序提升效率
- 可选Combiner（Mini Reducer）在Map节点本地先做一次归约，减少数据传输量
- Reduce阶段拷贝所有Map输出，归并排序后交给reduce函数处理

---

## Hadoop生态
Hadoop是Apache基金会的分布式系统基础架构，对Google MapReduce、GFS、BigTable的开源实现，由Doug Cutting创建。

### Google与Hadoop组件对应
| Google组件 | Hadoop等效组件 |
|------------|----------------|
| MapReduce | Hadoop MapReduce |
| GFS | HDFS |
| Bigtable | HBase |

---

## HDFS（Hadoop分布式文件系统）
- 基于块存储，默认块大小64MB，默认副本数3
- 随机选择存储节点，减少元数据量，支持顺序读写
- 核心特征：
  - 存储规模大，支持大文件、大量节点
  - 高可靠：单/多节点失效不影响系统
  - 高可扩展：可轻松增加服务器扩展集群
  - 为MapReduce优化：优先本地数据计算
- 适用场景：大文件、顺序读、一次写入多次读取，不支持随机更新

### HDFS体系结构
- **NameNode**：管理文件系统元数据（文件名、副本数、块ID等）
- **DataNode**：存储实际数据块，执行读写请求

---

## YARN（第二代MapReduce框架）
解决第一代Hadoop的缺陷：单点故障（JobTracker瓶颈）、扩展性差（仅支持4000节点）、仅支持MapReduce、资源利用率低。

### 架构拆分
将第一代JobTracker功能拆分为：
- **ResourceManager（RM）**：全局资源管理
  - 调度器：负责资源分配，可插拔（Fair Scheduler、Capacity Scheduler等）
  - 应用管理器：管理应用程序生命周期
- **ApplicationMaster（AM）**：每个应用程序独有
  - 向RM申请资源（Container）
  - 二次分配资源给内部任务
  - 与NodeManager通信启停任务
  - 监控任务状态，失败自动重启
- **NodeManager（NM）**：每个节点的资源和任务管理器，汇报资源使用状态，处理AM的请求
- **Container**：资源抽象，封装内存、CPU等资源，任务只能在分配的Container中运行

### YARN优势
- 支持多种计算框架（不仅是MapReduce，还支持Spark、Flink等）
- 高扩展性，解决单点瓶颈
- 更高资源利用率
