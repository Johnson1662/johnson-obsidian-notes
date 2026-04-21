# MPI编程

> 📚 本章涵盖：PPT 06 MPI基础、PPT 07 MPI进阶、PPT 09 MPI多级混合编程
> 
> 🎯 对应考点：**MPI编程模型（必考！）**、点对点通信、组通信、代码实现

---

## 一、MPI概述

### 1.1 什么是MPI？

**MPI（Message Passing Interface）**：
- 消息传递接口标准
- 用于**分布式内存**系统的并行编程
- 定义了一套通信原语和库函数
- 是高性能计算的事实标准

**MPI vs OpenMP对比**：

| 特性 | MPI | OpenMP |
|------|-----|--------|
| 内存模型 | 分布式内存 | 共享内存 |
| 通信方式 | 显式消息传递 | 隐式共享 |
| 编程复杂度 | 较高 | 较低 |
| 可扩展性 | 好（适合大规模） | 受限 |
| 应用场景 | 集群、超级计算机 | 多核服务器 |

> 🎯 **必考概念**：MPI是消息传递模型，OpenMP是共享内存模型

### 1.2 MPI程序结构

```c
#include <mpi.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    int rank, size;
    
    // 1. 初始化MPI环境
    MPI_Init(&argc, &argv);
    
    // 2. 获取进程信息
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);  // 获取进程ID
    MPI_Comm_size(MPI_COMM_WORLD, &size);  // 获取进程总数
    
    // 3. 并行计算代码
    printf("Hello from process %d of %d\n", rank, size);
    
    // 4. 终止MPI环境
    MPI_Finalize();
    
    return 0;
}
```

**编译运行**：
```bash
mpicc -o hello hello.c        # 编译
mpirun -np 4 ./hello          # 运行4个进程
```

---

## 二、点对点通信

### 2.1 阻塞通信

**发送函数**：
```c
MPI_Send(
    void* buf,           // 发送缓冲区
    int count,           // 数据个数
    MPI_Datatype dtype,  // 数据类型
    int dest,            // 目标进程ID
    int tag,             // 消息标签
    MPI_Comm comm        // 通信域
);
```

**接收函数**：
```c
MPI_Recv(
    void* buf,           // 接收缓冲区
    int count,           // 最大接收个数
    MPI_Datatype dtype,  // 数据类型
    int source,          // 源进程ID
    int tag,             // 消息标签
    MPI_Comm comm,       // 通信域
    MPI_Status* status   // 状态信息
);
```

**示例**：进程0发送数据给进程1
```c
int data = 100;
if (rank == 0) {
    MPI_Send(&data, 1, MPI_INT, 1, 0, MPI_COMM_WORLD);
} else if (rank == 1) {
    int received;
    MPI_Recv(&received, 1, MPI_INT, 0, 0, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    printf("Received: %d\n", received);
}
```

### 2.2 常用数据类型

| MPI数据类型 | C类型 |
|-------------|-------|
| `MPI_INT` | int |
| `MPI_FLOAT` | float |
| `MPI_DOUBLE` | double |
| `MPI_CHAR` | char |
| `MPI_BYTE` | 1字节 |

### 2.3 通信模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **标准模式** | MPI_Send/MPI_Recv | 通用 |
| **缓冲模式** | MPI_Bsend | 需要缓冲 |
| **同步模式** | MPI_Ssend | 需要同步确认 |
| **就绪模式** | MPI_Rsend | 确保接收方已准备好 |

---

## 三、组通信（⭐⭐⭐ 必考！）

### 3.1 组通信概述

**组通信特点**：
- 涉及通信域中的所有进程
- 由一个进程发起，所有进程参与
- 自带同步功能（所有进程执行到组通信函数后才会继续）

**分类**：

| 类型 | 说明 | 示例函数 |
|------|------|----------|
| **一对多** | 一个进程向所有进程发送 | MPI_Bcast, MPI_Scatter |
| **多对一** | 所有进程向一个进程发送 | MPI_Gather, MPI_Reduce |
| **多对多** | 所有进程相互通信 | MPI_Allgather, MPI_Allreduce |
| **同步** | 所有进程同步等待 | MPI_Barrier |

> 💡 **通俗解释**：组通信就像"集体活动"，所有人都要参与，不能有人偷懒。点对点通信是"私聊"，组通信是"群聊"或"集体行动"。

### 3.2 广播（Broadcast）⭐

**功能**：一个进程向所有进程发送相同数据（一对多）

```c
MPI_Bcast(
    void* buf,           // 缓冲区（发送/接收共用）
    int count,           // 数据个数
    MPI_Datatype dtype,  // 数据类型
    int root,            // 根进程ID（发送者）
    MPI_Comm comm        // 通信域
);
```

**示例**：
```c
int data;
if (rank == 0) {
    data = 100;  // 根进程初始化数据
}
MPI_Bcast(&data, 1, MPI_INT, 0, MPI_COMM_WORLD);
// 所有进程现在都有data=100
```

```
广播过程：
    进程0           进程1    进程2    进程3
    [100]    →      [100]   [100]   [100]
      │              │        │        │
      └──────────────┴────────┴────────┘
```

> 💡 **通俗解释**：广播就像班主任在群里发通知，一个人发，所有人都能收到同样的消息。

### 3.3 散射（Scatter）⭐

**功能**：将根进程的数据分发给所有进程（每人一部分，一对多）

```c
MPI_Scatter(
    void* sendbuf,       // 发送缓冲区（仅根进程有效）
    int sendcount,       // 每个进程接收的数据个数
    MPI_Datatype sendtype,
    void* recvbuf,       // 接收缓冲区
    int recvcount,       // 接收数据个数
    MPI_Datatype recvtype,
    int root,            // 根进程
    MPI_Comm comm
);
```

**示例**：
```c
int data[4] = {1, 2, 3, 4};
int my_value;

MPI_Scatter(data, 1, MPI_INT, &my_value, 1, MPI_INT, 0, MPI_COMM_WORLD);
// 进程0得到1，进程1得到2，进程2得到3，进程3得到4
```

```
散射过程：
    进程0: [1,2,3,4]  →  进程0: [1]
                          进程1: [2]
                          进程2: [3]
                          进程3: [4]
```

> 💡 **通俗解释**：散射就像老师把一叠作业本分给每个同学，每人拿一本（或几本）。广播是所有人听同样的内容，散射是每人拿不同的部分。

### 3.4 收集（Gather）⭐

**功能**：将所有进程的数据收集到根进程（多对一）

```c
MPI_Gather(
    void* sendbuf,       // 发送缓冲区
    int sendcount,       // 发送数据个数
    MPI_Datatype sendtype,
    void* recvbuf,       // 接收缓冲区（仅根进程有效）
    int recvcount,       // 每个进程发送的数据个数
    MPI_Datatype recvtype,
    int root,            // 根进程
    MPI_Comm comm
);
```

**示例**：
```c
int my_value = rank + 1;
int result[4];

MPI_Gather(&my_value, 1, MPI_INT, result, 1, MPI_INT, 0, MPI_COMM_WORLD);
// 进程0的result变为[1,2,3,4]
```

```
收集过程：
    进程0: [1]          进程0: [1,2,3,4]
    进程1: [2]    →     
    进程2: [3]          
    进程3: [4]          
```

> 💡 **通俗解释**：收集就像收作业，每个同学交一本，老师收到全部作业。散射是"分发"，收集是"回收"。

### 3.5 归约（Reduce）⭐⭐⭐

**功能**：对所有进程的数据进行归约运算，结果存入根进程（多对一）

```c
MPI_Reduce(
    void* sendbuf,       // 发送缓冲区
    void* recvbuf,       // 接收缓冲区（仅根进程）
    int count,           // 数据个数
    MPI_Datatype dtype,  // 数据类型
    MPI_Op op,           // 归约操作
    int root,            // 根进程
    MPI_Comm comm
);
```

**常用归约操作**：

| 操作 | 说明 |
|------|------|
| `MPI_SUM` | 求和 |
| `MPI_PROD` | 求积 |
| `MPI_MAX` | 求最大值 |
| `MPI_MIN` | 求最小值 |
| `MPI_MAXLOC` | 最大值及其位置 |
| `MPI_MINLOC` | 最小值及其位置 |
| `MPI_LAND` | 逻辑与 |
| `MPI_LOR` | 逻辑或 |
| `MPI_BAND` | 按位与 |
| `MPI_BOR` | 按位或 |

**示例**：
```c
int local_sum = rank + 1;
int total_sum;

MPI_Reduce(&local_sum, &total_sum, 1, MPI_INT, MPI_SUM, 0, MPI_COMM_WORLD);
// 进程0的total_sum为10 (1+2+3+4)
```

```
归约过程（求和）：
    进程0: 1 ─┐
    进程1: 2 ─┼→  进程0: 10
    进程2: 3 ─┤
    进程3: 4 ─┘
```

> 💡 **通俗解释**：归约就像"汇总统计"，每个人报自己的成绩，最后算出总分、最高分或平均分。Reduce是"计算后汇总"，Gather是"直接汇总"。

### 3.6 全收集与全归约

**MPI_Allgather**：所有进程收集到全部数据（多对多）
```c
MPI_Allgather(&my_value, 1, MPI_INT, result, 1, MPI_INT, MPI_COMM_WORLD);
// 所有进程的result都变为[1,2,3,4]
```

**MPI_Allreduce**：所有进程获得归约结果（多对多）
```c
MPI_Allreduce(&local_sum, &total_sum, 1, MPI_INT, MPI_SUM, MPI_COMM_WORLD);
// 所有进程的total_sum都为10
```

**MPI_Barrier**：同步屏障，所有进程都到达后才继续
```c
MPI_Barrier(MPI_COMM_WORLD);
// 所有进程都执行到这里后才会继续
```

> 💡 **通俗解释**：
> - **Allgather**：就像每个人都知道所有人的成绩
> - **Allreduce**：就像每个人都知道全班的平均分
> - **Barrier**：就像"等大家都到齐了再出发"

### 3.7 组通信函数详细对比

| 函数 | 方向 | 功能 | 记忆方法 | 类比 |
|------|------|------|----------|------|
| `MPI_Bcast` | 1→N | 广播 | 一人说，所有人听 | 班主任发通知 |
| `MPI_Scatter` | 1→N | 散射 | 一人分，各得一份 | 老师发作业本 |
| `MPI_Gather` | N→1 | 收集 | 各出一份，汇于一处 | 收作业 |
| `MPI_Reduce` | N→1 | 归约 | 各出数据，算出结果 | 统计成绩 |
| `MPI_Allgather` | N→N | 全收集 | 各出一份，人手全集 | 成绩公示 |
| `MPI_Allreduce` | N→N | 全归约 | 各出数据，人手结果 | 每人知道平均分 |
| `MPI_Barrier` | 同步 | 屏障 | 所有人到齐 | 集合点名 |

> 🎯 **考试重点**：理解各种组通信函数的功能和区别

---

## 四、组通信函数总结

| 函数 | 方向 | 功能 | 记忆方法 | 通俗解释 |
|------|------|------|----------|----------|
| `MPI_Bcast` | 1→N | 广播 | 一人说，所有人听 | 班主任发通知 |
| `MPI_Scatter` | 1→N | 散射 | 一人分，各得一份 | 发作业本 |
| `MPI_Gather` | N→1 | 收集 | 各出一份，汇于一处 | 收作业 |
| `MPI_Reduce` | N→1 | 归约 | 各出数据，算出结果 | 统计成绩 |
| `MPI_Allgather` | N→N | 全收集 | 各出一份，人手全集 | 成绩公示 |
| `MPI_Allreduce` | N→N | 全归约 | 各出数据，人手结果 | 每人知道平均分 |
| `MPI_Barrier` | 同步 | 屏障 | 所有人到齐 | 集合点名 |

**函数选择指南**：
- 需要**相同数据**给所有人 → `MPI_Bcast`（广播）
- 需要**不同数据**给每个人 → `MPI_Scatter`（散射）
- 需要**收集所有数据**到一个进程 → `MPI_Gather`（收集）
- 需要**计算汇总结果**（如求和、最大值） → `MPI_Reduce`（归约）
- 需要**所有人都知道结果** → `MPI_Allreduce`（全归约）
- 需要**同步等待** → `MPI_Barrier`（屏障）

---

## 五、经典算法实现

### 5.1 MPI求立方和

**问题**：$f(n) = 1^3 + 2^3 + ... + n^3$

```c
#include <mpi.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    int rank, size;
    int n = 1000;
    long long local_sum = 0, global_sum = 0;
    
    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    // 计算每个进程负责的范围
    int chunk = n / size;
    int start = rank * chunk + 1;
    int end = (rank == size - 1) ? n : (rank + 1) * chunk;
    
    // 计算局部立方和
    for (int i = start; i <= end; i++) {
        local_sum += (long long)i * i * i;
    }
    
    // 归约到进程0
    MPI_Reduce(&local_sum, &global_sum, 1, MPI_LONG_LONG, 
               MPI_SUM, 0, MPI_COMM_WORLD);
    
    if (rank == 0) {
        printf("Sum of cubes from 1 to %d = %lld\n", n, global_sum);
    }
    
    MPI_Finalize();
    return 0;
}
```

### 5.2 前缀和（Prefix Sum）

**问题**：计算数组的前缀和 $B[i] = A[0] + A[1] + ... + A[i]$

**并行思路**：
1. 每个进程计算局部前缀和
2. 进程间传递累计和
3. 调整得到全局前缀和

```c
// 第一步：各进程计算局部前缀和
int local_prefix[N_LOCAL];
local_prefix[0] = local_data[0];
for (int i = 1; i < N_LOCAL; i++) {
    local_prefix[i] = local_prefix[i-1] + local_data[i];
}

// 第二步：传递累计和
if (rank > 0) {
    int prefix_sum;
    MPI_Recv(&prefix_sum, 1, MPI_INT, rank-1, 0, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    for (int i = 0; i < N_LOCAL; i++) {
        local_prefix[i] += prefix_sum;
    }
}
if (rank < size - 1) {
    int send_sum = local_prefix[N_LOCAL-1];
    MPI_Send(&send_sum, 1, MPI_INT, rank+1, 0, MPI_COMM_WORLD);
}
```

---

## 六、MPI进阶概念

### 6.1 通信域（Communicator）

**MPI_COMM_WORLD**：包含所有进程的默认通信域

**自定义通信域**：
```c
MPI_Comm new_comm;
MPI_Comm_split(MPI_COMM_WORLD, color, key, &new_comm);
```

> 💡 **通俗解释**：通信域就像"微信群"，定义了哪些进程可以互相通信。MPI_COMM_WORLD是默认的"大群"，包含所有进程。

### 6.2 进程组（Process Group）

```c
MPI_Group world_group, new_group;
MPI_Comm_group(MPI_COMM_WORLD, &world_group);

int ranks[2] = {0, 2};  // 选择进程0和2
MPI_Group_incl(world_group, 2, ranks, &new_group);
```

### 6.3 派生数据类型

```c
// 创建结构体数据类型
struct Particle {
    float x, y, z;
    float vx, vy, vz;
};

MPI_Datatype mpi_particle_type;
int blocklengths[2] = {3, 3};
MPI_Aint displacements[2];
MPI_Datatype types[2] = {MPI_FLOAT, MPI_FLOAT};

// 设置偏移量
displacements[0] = offsetof(struct Particle, x);
displacements[1] = offsetof(struct Particle, vx);

MPI_Type_create_struct(2, blocklengths, displacements, types, &mpi_particle_type);
MPI_Type_commit(&mpi_particle_type);
```

### 6.4 非阻塞通信

**阻塞 vs 非阻塞**：
- **阻塞**：发送/接收完成后才返回（MPI_Send/MPI_Recv）
- **非阻塞**：立即返回，用Wait/Test完成（MPI_Isend/MPI_Irecv）

**非阻塞通信函数**：
```c
// 非阻塞发送
MPI_Isend(
    void* buf,           // 发送缓冲区
    int count,           // 数据个数
    MPI_Datatype dtype,  // 数据类型
    int dest,            // 目标进程ID
    int tag,             // 消息标签
    MPI_Comm comm,       // 通信域
    MPI_Request* request // 请求对象（用于后续检查）
);

// 非阻塞接收
MPI_Irecv(
    void* buf,           // 接收缓冲区
    int count,           // 最大接收个数
    MPI_Datatype dtype,  // 数据类型
    int source,          // 源进程ID
    int tag,             // 消息标签
    MPI_Comm comm,       // 通信域
    MPI_Request* request // 请求对象
);

// 等待通信完成
MPI_Wait(MPI_Request* request, MPI_Status* status);

// 检查通信是否完成（非阻塞）
MPI_Test(MPI_Request* request, int* flag, MPI_Status* status);
```

> 💡 **通俗解释**：非阻塞通信就像发快递，发完就继续干别的事，不用干等着。等需要结果时再查快递到没到。

### 6.5 捆绑发送接收（MPI_Sendrecv）

**功能**：在一条语句中同时发送和接收数据，避免死锁

```c
MPI_Sendrecv(
    void* sendbuf,        // 发送缓冲区
    int sendcount,        // 发送数据个数
    MPI_Datatype sendtype, // 发送数据类型
    int dest,             // 目标进程
    int sendtag,          // 发送标签
    void* recvbuf,        // 接收缓冲区
    int recvcount,        // 接收数据个数
    MPI_Datatype recvtype, // 接收数据类型
    int source,           // 源进程
    int recvtag,          // 接收标签
    MPI_Comm comm,        // 通信域
    MPI_Status* status    // 状态信息
);
```

**应用场景**：
- 循环数据交换（如Jacobi迭代中相邻进程交换边界数据）
- 避免Send/Recv顺序不当导致的死锁

> 💡 **通俗解释**：就像两个人互相递东西，一只手递出去，另一只手接过来，同时完成。

### 6.6 虚进程（Virtual Process）

**MPI_PROC_NULL**：特殊的"空进程"，用于Sendrecv中表示无操作

```c
// 示例：环形通信中，边界进程与虚进程通信
MPI_Sendrecv(sendbuf, sendcount, MPI_FLOAT, right, tag,
             recvbuf, recvcount, MPI_FLOAT, left, tag,
             MPI_COMM_WORLD, &status);
```

> 💡 **通俗解释**：虚进程就像"空气"，跟它发消息等于没发，从它收消息等于收到空。用于简化边界处理代码。

---

## 七、名词解释汇总

| 术语 | 英文 | 定义 | 通俗解释 |
|------|------|------|----------|
| **MPI** | Message Passing Interface | 消息传递接口标准 | 分布式内存并行编程的"通用语言" |
| **通信域** | Communicator | 定义一组可以相互通信的进程集合 | "微信群"，定义谁能互相发消息 |
| **点对点通信** | Point-to-Point | 两个进程之间的通信 | "私聊"，两个人之间发消息 |
| **组通信** | Collective Communication | 涉及通信域中所有进程的通信 | "群聊"，所有人一起参与 |
| **广播** | Broadcast | 一个进程向所有进程发送相同数据 | "班主任发通知" |
| **散射** | Scatter | 将数据分发给各进程（每人一部分） | "发作业本" |
| **收集** | Gather | 将各进程数据汇集成一个数组 | "收作业" |
| **归约** | Reduce | 对各进程数据进行运算得到单一结果 | "统计成绩" |
| **阻塞通信** | Blocking | 发送/接收完成后才返回 | "干等着，直到对方收到" |
| **非阻塞通信** | Non-blocking | 立即返回，用Wait/Test完成 | "发完就干别的事，不用干等" |
| **MPI_Sendrecv** | Send-Receive | 同时发送和接收数据 | "一手递出去，一手接过来" |
| **虚进程** | Virtual Process | 特殊的"空进程"，用于Sendrecv中 | "空气"，跟它发消息等于没发 |

---

## 八、复习要点

### ✅ 必须掌握
1. MPI程序的基本结构（Init/Finalize/Comm_rank/Comm_size）
2. 点对点通信（MPI_Send/MPI_Recv）
3. **组通信函数**（Bcast/Scatter/Gather/Reduce/Allreduce）
4. 非阻塞通信（MPI_Isend/MPI_Irecv/MPI_Wait）
5. 捆绑发送接收（MPI_Sendrecv）
6. 能写出简单的MPI并行程序

### ⚠️ 常见考题
- 解释MPI编程模型（名词解释）
- 列举3个以上MPI组通信接口（简答题）
- 写出MPI并行求和/前缀和程序（编程题）
- 画出Scatter/Gather/Reduce示意图
- 解释阻塞与非阻塞通信的区别
- 解释MPI_Sendrecv的用途

### 📖 参考图示
- MPI程序结构 → **PPT 06 第17-20页**
- 点对点通信 → **PPT 06 第25-40页**
- 组通信示意 → **PPT 07 第10-30页**
- Reduce操作 → **PPT 07 第25-30页**
- 非阻塞通信 → **PPT 07 第31-50页**

---

## 九、MPI实验实践（2026年实验三）

### 9.1 实验三：MPI多进程求解稀疏线性方程组

**实验目标**：使用MPI实现共轭梯度法（CG）的并行计算

**并行策略**：
- **行分块**：将矩阵A的n行均匀划分给p个进程
- 每个进程存储本地行块（CSR格式）、右端项片段b_local
- 向量p和r采用**冗余存储**（所有进程保持完整副本）
- 点积使用 **MPI_Allreduce** 全局规约

**数据分布**：
```
进程0: 矩阵行0~n/p-1, b[0~n/p-1]
进程1: 矩阵行n/p~2n/p-1, b[n/p~2n/p-1]
...
进程p-1: 矩阵行最后部分, b最后部分

向量p, r: 所有进程都有完整副本（冗余存储）
```

### 9.2 MPI环境配置

**加载MPI模块**：
```bash
module load mpi
```

**编译命令**：
```bash
mpic++ -i_dynamic -o sparse.o sparse.cpp
```

**运行命令**：
```bash
mpirun -np 4 ./sparse.o matrix.txt vector.txt
```

### 9.3 MPI CG算法要点

```c
// 1. 初始化
MPI_Comm_rank(MPI_COMM_WORLD, &rank);
MPI_Comm_size(MPI_COMM_WORLD, &size);

// 2. 分发矩阵数据
// 每个进程读取自己的行块
int rows_per_proc = n / size;
int start_row = rank * rows_per_proc;
int end_row = (rank == size-1) ? n : (rank+1) * rows_per_proc;

// 3. SpMV本地计算（矩阵行分块，向量完整）
void local_spmv(int start, int end, ...) {
    for (int i = start; i < end; i++) {
        y[i] = 0.0;
        for (int j = row_ptr[i]; j < row_ptr[i+1]; j++) {
            y[i] += values[j] * x[col_idx[j]];
        }
    }
}

// 4. 全局点积规约
double local_pAp = 0.0;
for (int i = start_row; i < end_row; i++) {
    local_pAp += p[i] * Ap[i];
}
double global_pAp;
MPI_Allreduce(&local_pAp, &global_pAp, 1, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);

// 5. 向量更新（冗余存储，无通信）
for (int i = 0; i < n; i++) {
    x[i] += alpha * p[i];
    r[i] -= alpha * Ap[i];
}
```

### 9.4 PBS作业脚本

```bash
#!/bin/bash
#PBS -N sparse_mpi
#PBS -l nodes=2:ppn=2
#PBS -j oe

module load mpi
cd $PBS_O_WORKDIR
procs=$(cat $PBS_NODEFILE | wc -l)

mpirun -np $procs -machinefile $PBS_NODEFILE ./sparse.o \
    matrix.txt vector.txt &> run.log
```

**提交任务**：
```bash
qsub sparse_mpi.pbs
```

### 9.5 混合编程：MPI+OpenMP

**编译命令**：
```bash
mpic++ -i_dynamic -fopenmp -o hybrid.o hybrid.cpp
```

**应用场景**：
- MPI负责进程间通信
- OpenMP负责节点内多线程并行
- 适合大规模集群环境

### 9.6 混合编程：MPI+CUDA

**应用场景**：
- MPI负责节点间通信（跨节点）
- CUDA负责节点内GPU并行计算
- 适合GPU集群环境

**数据传输模式**：
```c
// MPI进程间传输GPU数据（需要经过主机内存）
if (rank == 0) {
    // 1. 从GPU拷贝到主机内存
    cudaMemcpy(host_buffer, device_buffer, size, cudaMemcpyDeviceToHost);
    // 2. 通过MPI发送
    MPI_Send(host_buffer, size, MPI_CHAR, 1, tag, MPI_COMM_WORLD);
} else if (rank == 1) {
    // 3. 接收数据到主机内存
    MPI_Recv(host_buffer, size, MPI_CHAR, 0, tag, MPI_COMM_WORLD, &status);
    // 4. 从主机内存拷贝到GPU
    cudaMemcpy(device_buffer, host_buffer, size, cudaMemcpyHostToDevice);
}
```

**GPUDirect RDMA**（高级优化）：
- 允许GPU直接通过网络发送数据，绕过主机内存
- 减少数据拷贝次数，提高性能
- 需要特定硬件支持（如InfiniBand）

**多级并行策略**：
```
┌─────────────────────────────────────┐
│           集群层（MPI）              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐
│  │  节点0  │  │  节点1  │  │  节点2  │
│  │ ┌─────┐ │  │ ┌─────┐ │  │ ┌─────┐ │
│  │ │ GPU │ │  │ │ GPU │ │  │ │ GPU │ │
│  │ │(CUDA)│ │  │ │(CUDA)│ │  │ │(CUDA)│ │
│  │ └─────┘ │  │ └─────┘ │  │ └─────┘ │
│  └─────────┘  └─────────┘  └─────────┘
└─────────────────────────────────────┘
```

> 💡 **通俗解释**：就像公司组织结构：
> - **MPI**：不同部门之间的沟通（跨部门协作）
> - **CUDA**：部门内部员工的分工（部门内协作）
> - **多级混合**：既有部门间协作，又有部门内分工

---

*整理自：06 MPI基础.pdf (76页)、07+MPI进阶.pdf (57页)、09 MPI多级混合编程.pdf (45页)、2026年实验指导书*
