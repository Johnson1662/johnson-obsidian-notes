---
title: "07 MPI进阶"
date: 2026-04-21
tags: [并行计算, MPI, 非阻塞通信, 数据类型, 进程拓扑]
---

# 07 MPI进阶

> [!info] 课程信息
> 讲师：汤善江副教授 | 天津大学智能与计算学部

## 目录

- [[#1 非阻塞通信]]
- [[#2 MPI_Sendrecv与虚拟进程]]
- [[#3 自定义数据类型]]
- [[#4 虚拟进程拓扑]]

---

## 1 非阻塞通信

### 1.1 什么是非阻塞通信？

> [!tip] 通俗理解
> **阻塞通信**就像打电话：你必须等对方接电话才能说正事，通话结束前你啥也干不了。
> **非阻塞通信**就像发短信：你发完短信就去做别的事，不用等对方回复。

非阻塞通信的核心思想：**把计算和通信重叠起来**，提升并行效率。

![阻塞与非阻塞对比](/知识库/并行计算/assets/07_blocking_vs_nonblocking1.jpg)

![阻塞与非阻塞对比2](/知识库/并行计算/assets/07_blocking_vs_nonblocking2.jpg)

### 1.2 非阻塞发送与接收

非阻塞操作分两步：
1. **发起操作**（立即返回）：`MPI_Isend` / `MPI_Irecv`
2. **等待完成**：`MPI_Wait` / `MPI_Test`

![非阻塞发送流程](/知识库/并行计算/assets/07_nonblocking_send.jpg)

![非阻塞接收流程](/知识库/并行计算/assets/07_nonblocking_recv.jpg)

![非阻塞标准发送接收](/知识库/并行计算/assets/07_nonblocking_send_recv.jpg)

#### MPI_Isend 函数签名

```c
int MPI_Isend(
    void* buf,              // 发送缓冲区
    int count,              // 数据个数
    MPI_Datatype datatype,  // 数据类型
    int dest,               // 目标进程号
    int tag,                // 消息标签
    MPI_Comm comm,          // 通信域
    MPI_Request *request    // 返回的通信对象（句柄）
);
```

> [!note] MPI_Request
> MPI内部的非阻塞通信对象，通过句柄访问。它记录了：
> - 发送/接收模式
> - 通信缓冲区
> - 通信上下文（标签、源/目标）

### 1.3 非阻塞通信模式

与阻塞通信一样，非阻塞通信也有四种模式：

| 通信模式 | 发送函数 | 接收函数 |
|---------|---------|---------|
| 标准通信 | `MPI_Isend` | `MPI_Irecv` |
| 缓存通信 | `MPI_Ibsend` | — |
| 同步通信 | `MPI_Issend` | — |
| 就绪通信 | `MPI_Irsend` | — |

> [!tip] 命名规则
> - 前缀 `I`（Immediate）= 非阻塞
> - 前缀 `B` = 缓存，`S` = 同步，`R` = 就绪

### 1.4 通信完成与检测

| 场景 | 检测(Test) | 完成(Wait) |
|-----|-----------|-----------|
| 单个通信 | `MPI_Test` | `MPI_Wait` |
| 任意一个完成 | `MPI_Testany` | `MPI_Waitany` |
| 部分完成 | `MPI_Testsome` | `MPI_Waitsome` |
| 全部完成 | `MPI_Testall` | `MPI_Waitall` |

- **`MPI_Wait`**：阻塞等待，通信完成后才返回
- **`MPI_Test`**：非阻塞检测，直接返回 `flag` 表示是否完成

```c
int MPI_Wait(MPI_Request *request, MPI_Status *status);  // 阻塞，等待完成
int MPI_Test(MPI_Request *request, int *flag, MPI_Status *status);  // 非阻塞检测
```

### 1.5 重复非阻塞通信

对于循环中反复执行的通信，可以用重复非阻塞通信优化：

工作流程：
1. **初始化**：`MPI_Send_init` 创建通信对象
2. **启动**：`MPI_Start` 启动通信
3. **等待**：`MPI_Wait` 等待完成
4. **释放**：`MPI_Request_free` 释放对象

![重复非阻塞通信](/知识库/并行计算/assets/07_repeated_nonblocking.jpg)

### 1.6 消息探测

`MPI_Probe` 可以在不实际接收消息的情况下，检查是否有消息到达：

```c
int MPI_Probe(int source, int tag, MPI_Comm comm, MPI_Status *status);
// 阻塞调用，检测到消息后才返回
```

### 1.7 非阻塞通信避免死锁

> [!warning] 死锁问题
> 当所有进程都先执行发送（阻塞），再执行接收时，可能导致所有进程都在等待对方，形成死锁。

![死锁示意图](/知识库/并行计算/assets/07_deadlock.jpg)

**解决方案**：使用非阻塞操作，让发送和接收都能立即返回：

![使用非阻塞发送避免死锁](/知识库/并行计算/assets/07_nonblocking_avoid_deadlock1.jpg)

![使用非阻塞接收避免死锁](/知识库/并行计算/assets/07_nonblocking_avoid_deadlock2.jpg)

### 1.8 阻塞与非阻塞操作总结

| 特性 | 阻塞操作 | 非阻塞操作 |
|-----|---------|-----------|
| 返回时机 | 通信完成后返回 | 调用后立即返回 |
| 缓冲区安全性 | 返回后可安全修改 | 需确认通信完成后才能修改 |
| 主要目的 | 简单编程 | **计算与通信重叠** |

---

## 2 MPI_Sendrecv与虚拟进程

### 2.1 问题背景：Jacobi迭代

Jacobi迭代是典型的需要邻居通信的算法，每个网格点的新值等于其上下左右四个邻居的平均值：

$$h_{i,j} = \frac{h_{i-1,j} + h_{i+1,j} + h_{i,j-1} + h_{i,j+1}}{4}$$

![Jacobi迭代示意图](/知识库/并行计算/assets/07_jacobi_iteration.jpg)

**数据划分**：将网格按行划分给不同进程

![Jacobi数据划分](/知识库/并行计算/assets/07_jacobi_data_partition.jpg)

**通信需求**：每个进程需要与相邻进程交换边界数据

![Jacobi通信](/知识库/并行计算/assets/07_jacobi_communication.jpg)

### 2.2 MPI_Sendrecv（捆绑发送接收）

> [!tip] 通俗理解
> `MPI_Sendrecv` 就像"一手交钱一手交货"：在一条语句中同时完成发送和接收，避免了手动安排发送/接收顺序导致的死锁问题。

```c
int MPI_Sendrecv(
    void *sendbuf, int sendcount, MPI_Datatype sendtype,
    int dest, int sendtag,           // 发送参数
    void *recvbuf, int recvcount, MPI_Datatype recvtype,
    int source, int recvtag,         // 接收参数
    MPI_Comm comm, MPI_Status *status
);
```

**优点**：
- 在语义上等价于一个发送加一个接收
- 由通信系统优化通信次序，**最大程度避免死锁**

![用MPI_Sendrecv实现Jacobi](/知识库/并行计算/assets/07_sendrecv_jacobi.jpg)

### 2.3 虚拟进程 MPI_PROC_NULL

> [!tip] 通俗理解
> 虚拟进程是一个"不存在"的进程。当你向它发送数据或从它接收数据时，操作立即成功返回，就像执行了一个空操作。

**用途**：简化边界情况的代码

```c
// 确定左右邻居（边界用虚拟进程）
if (myid > 0)
    left = myid - 1;
else
    left = MPI_PROC_NULL;  // 第一个进程没有左邻居

if (myid < n-1)
    right = myid + 1;
else
    right = MPI_PROC_NULL;  // 最后一个进程没有右邻居

// 从左向右平移数据（边界进程自动跳过）
MPI_Sendrecv(sendData, count, MPI_FLOAT, right, tag,
             recvData, count, MPI_FLOAT, left, tag,
             MPI_COMM_WORLD, &status);
```

![虚拟进程示意图](/知识库/并行计算/assets/07_virtual_process.jpg)

---

## 3 自定义数据类型

### 3.1 为什么需要自定义数据类型？

MPI基本类型（如 `MPI_INT`、`MPI_FLOAT`）只能发送连续内存的数据。但实际中经常需要发送：
- 数组的非连续元素（如矩阵的某一列）
- 结构体中不连续的字段
- 自定义的复杂数据布局

![自定义数据类型概览](/知识库/并行计算/assets/07_custom_datatype.jpg)

### 3.2 连续数据类型 MPI_Type_contiguous

将连续的 `count` 个相同类型的数据打包为新类型：

![连续数据类型](/知识库/并行计算/assets/07_contiguous_datatype.jpg)

```c
int MPI_Type_contiguous(int count, MPI_Datatype oldtype, MPI_Datatype *newtype);
```

### 3.3 向量数据类型 MPI_Type_vector

每隔 `stride` 个元素取 `blocklength` 个连续元素：

![向量数据类型](/知识库/并行计算/assets/07_vector_datatype.jpg)

```c
int MPI_Type_vector(
    int count,        // 块的数量
    int blocklength,  // 每个块的元素数
    int stride,       // 相邻块首元素的间距
    MPI_Datatype oldtype,
    MPI_Datatype *newtype
);
```

> [!example] 发送矩阵列
> 要发送一个 N×N 矩阵的第 j 列：`MPI_Type_vector(N, 1, N, MPI_FLOAT, &col_type)`

### 3.4 结构体数据类型 MPI_Type_struct

将不同类型、不同间隔的数据组合成新类型：

![结构体数据类型](/知识库/并行计算/assets/07_struct_datatype.jpg)

```c
int MPI_Type_struct(
    int count,                    // 块数
    int *array_of_blocklengths,   // 每个块的长度数组
    MPI_Aint *array_of_displacements,  // 每个块的偏移数组
    MPI_Datatype *array_of_types,      // 每个块的类型数组
    MPI_Datatype *newtype
);
```

---

## 4 虚拟进程拓扑

### 4.1 什么是虚拟进程拓扑？

> [!tip] 通俗理解
> MPI进程默认按 0, 1, 2, ... 编号排列（线性）。但很多问题（如二维网格计算）中，进程间的通信关系是二维或三维的。**虚拟进程拓扑**就是给进程赋予一个网格状的"虚拟地址"，让代码更直观。

**好处**：
- **方便命名**：用坐标代替进程号，代码更自然
- **简化代码**：自动处理邻居查找
- **辅助优化**：MPI内部可根据拓扑优化通信

### 4.2 笛卡尔拓扑

将进程排列成虚拟的网格，每个进程通过坐标标识，与邻居通信：

![二维阵列拓扑](/知识库/并行计算/assets/07_cartesian_topology.jpg)

#### 创建笛卡尔拓扑

```c
int MPI_Cart_create(
    MPI_Comm comm_old,   // 原通信域
    int ndims,           // 维度数（如2表示二维网格）
    int *dims,           // 每维的大小数组（如{4, 3}）
    int *periods,        // 每维是否周期（首尾相连）
    int *reorder,        // 是否允许重排进程号
    MPI_Comm *comm_cart  // 返回的新通信域
);
```

![笛卡尔坐标示例](/知识库/并行计算/assets/07_cart_coords.jpg)

#### 坐标与进程号映射

**进程号 → 坐标**：
```c
int MPI_Cart_coords(MPI_Comm comm_cart, int rank, int maxdims, int *coords);
```

![进程号到坐标映射](/知识库/并行计算/assets/07_rank_to_coords.jpg)

**坐标 → 进程号**：
```c
int MPI_Cart_rank(MPI_Comm comm_cart, int *coords, int *rank);
```

![坐标到进程号映射](/知识库/并行计算/assets/07_coords_to_rank.jpg)

#### 数据平移 MPI_Cart_shift

计算沿某个方向移动 `disp` 个位置后的邻居进程号：

```c
int MPI_Cart_shift(
    MPI_Comm comm_cart,
    int direction,       // 移动方向（0=行方向，1=列方向...）
    int disp,            // 移动距离（如1表示相邻）
    int *rank_source,    // 返回：数据来源的进程号
    int *rank_dest       // 返回：数据发送去的进程号
);
// 如果没有邻居，返回 MPI_PROC_NULL
```

![Cart_shift示例](/知识库/并行计算/assets/07_cart_shift.jpg)

#### 划分子拓扑 MPI_Cart_sub

将笛卡尔拓扑沿某些维度划分，形成低维子拓扑：

```c
int MPI_Cart_sub(MPI_Comm comm_cart, int *remain_dims, MPI_Comm *comm_sub);
// remain_dims: 布尔数组，哪些维度保留在子拓扑中
```

![子拓扑划分](/知识库/并行计算/assets/07_cart_sub.jpg)

> [!example] 按行划分
> 对于 4×3 的二维拓扑，`remain_dims = {true, false}` 会沿行方向划分为4个一维子通信域（每行一个）。

---

## 小结

| 主题 | 核心要点 |
|-----|---------|
| **非阻塞通信** | `MPI_Isend/Irecv` 发起，`MPI_Wait/Test` 完成，实现计算通信重叠 |
| **MPI_Sendrecv** | 一条语句完成发送接收，自动避免死锁 |
| **虚拟进程** | `MPI_PROC_NULL` 简化边界处理 |
| **自定义数据类型** | `contiguous`/`vector`/`struct` 灵活组织数据 |
| **虚拟进程拓扑** | `MPI_Cart_create` 创建网格拓扑，坐标化管理进程 |
