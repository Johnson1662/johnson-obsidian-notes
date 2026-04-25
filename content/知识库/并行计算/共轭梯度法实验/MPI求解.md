# Lab3 MPI并行编程完整教程

## 一、什么是MPI？

### 1.1 MPI的基本概念

**MPI (Message Passing Interface)** = 消息传递接口

想象一个场景：
```
你有一个大任务要完成，比如搬1000块砖
- 一个人搬：需要很长时间
- 10个人一起搬：每人搬100块，快10倍！

MPI就是让多个"工人"（进程）协作完成任务的工具
```

### 1.2 MPI vs pthread（Lab2）的区别

| 特性 | pthread（Lab2） | MPI（Lab3） |
|------|----------------|-------------|
| 工作方式 | 多个线程共享内存 | 多个进程独立内存 |
| 比喻 | 同一个房间的多个人，共用一张桌子 | 不同房间的多个人，通过对讲机交流 |
| 内存 | 共享（可以直接访问同一个变量） | 独立（必须通过消息传递） |
| 适用场景 | 单台机器多核 | 多台机器集群 |
| 通信方式 | 直接访问共享变量 | 发送/接收消息 |

### 1.3 核心概念

```
进程（Process）：
  - 每个进程是一个独立的程序副本
  - 有自己的内存空间
  - 不能直接访问其他进程的变量

Rank（进程编号）：
  - 每个进程有一个唯一的编号
  - Rank 0 通常是"老大"，负责协调
  - 例如：4个进程，rank分别是 0, 1, 2, 3

Size（进程总数）：
  - 一共有多少个进程在工作
  - 例如：size = 4 表示有4个进程
```

---

## 二、MPI程序的基本结构

### 2.1 最简单的MPI程序

```cpp
#include <mpi.h>
#include <stdio.h>

int main(int argc, char *argv[])
{
    // 1. 初始化MPI环境
    MPI_Init(&argc, &argv);
    
    // 2. 获取自己的编号
    int rank;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    
    // 3. 获取总进程数
    int size;
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    // 4. 每个进程打印自己的信息
    printf("我是进程 %d，总共有 %d 个进程\n", rank, size);
    
    // 5. 结束MPI环境
    MPI_Finalize();
    return 0;
}
```

**运行结果**（假设用4个进程）：
```
我是进程 0，总共有 4 个进程
我是进程 1，总共有 4 个进程
我是进程 2，总共有 4 个进程
我是进程 3，总共有 4 个进程
```

**关键点**：
- 每个进程都执行**同一份代码**
- 但每个进程的`rank`不同，所以可以做不同的事

---

## 三、MPI的核心操作

### 3.1 点对点通信（一对一）

#### 发送消息：MPI_Send

```cpp
// 进程0发送数据给进程1
if (rank == 0) {
    int data = 100;
    MPI_Send(&data,           // 发送的数据地址
             1,               // 发送1个元素
             MPI_INT,         // 数据类型是整数
             1,               // 发送给进程1
             0,               // 消息标签（用于区分不同消息）
             MPI_COMM_WORLD); // 通信域
    printf("进程0发送了: %d\n", data);
}
```

#### 接收消息：MPI_Recv

```cpp
// 进程1接收来自进程0的数据
if (rank == 1) {
    int data;
    MPI_Recv(&data,           // 接收数据的地址
             1,               // 接收1个元素
             MPI_INT,         // 数据类型
             0,               // 从进程0接收
             0,               // 消息标签
             MPI_COMM_WORLD,  // 通信域
             MPI_STATUS_IGNORE); // 状态（这里忽略）
    printf("进程1接收到: %d\n", data);
}
```

**比喻**：
- MPI_Send = 写信寄出去
- MPI_Recv = 等待并收信

---

### 3.2 集体通信（所有人一起）

#### 广播：MPI_Bcast（一对多）

```cpp
int data;

if (rank == 0) {
    data = 999;  // 进程0有数据
}

// 进程0把data广播给所有人
MPI_Bcast(&data,          // 数据地址
          1,              // 1个元素
          MPI_INT,        // 整数类型
          0,              // 从进程0广播
          MPI_COMM_WORLD);

printf("进程%d收到广播: %d\n", rank, data);
```

**结果**：
```
进程0收到广播: 999
进程1收到广播: 999
进程2收到广播: 999
进程3收到广播: 999
```

**比喻**：老师（进程0）用喇叭喊话，所有学生都听到

---

#### 归约：MPI_Allreduce（多对多）

```cpp
int local_sum = rank + 1;  // 每个进程有自己的值
                           // rank 0: 1, rank 1: 2, rank 2: 3, rank 3: 4

int global_sum;
MPI_Allreduce(&local_sum,     // 本地值
              &global_sum,    // 全局结果
              1,              // 1个元素
              MPI_INT,        // 整数
              MPI_SUM,        // 求和操作
              MPI_COMM_WORLD);

printf("进程%d: 局部=%d, 全局和=%d\n", rank, local_sum, global_sum);
```

**结果**：
```
进程0: 局部=1, 全局和=10
进程1: 局部=2, 全局和=10
进程2: 局部=3, 全局和=10
进程3: 局部=4, 全局和=10
```

**比喻**：每个人报一个数，然后所有人都知道总和

**常用操作**：
- `MPI_SUM`: 求和
- `MPI_MAX`: 求最大值
- `MPI_MIN`: 求最小值

---

#### 收集：MPI_Gatherv（多对一，不等长）

```cpp
// 每个进程有不同数量的数据
int local_n = rank + 1;  // rank 0: 1个, rank 1: 2个, rank 2: 3个...
int *local_data = (int*)malloc(local_n * sizeof(int));
for (int i = 0; i < local_n; i++) {
    local_data[i] = rank * 10 + i;
}

// 准备接收信息（仅进程0需要）
int *recv_counts = NULL;
int *displs = NULL;
int *global_data = NULL;

if (rank == 0) {
    recv_counts = (int*)malloc(size * sizeof(int));
    displs = (int*)malloc(size * sizeof(int));
    
    // 计算每个进程发送多少数据
    for (int i = 0; i < size; i++) {
        recv_counts[i] = i + 1;
        displs[i] = (i == 0) ? 0 : displs[i-1] + recv_counts[i-1];
    }
    
    int total = displs[size-1] + recv_counts[size-1];
    global_data = (int*)malloc(total * sizeof(int));
}

// 收集数据到进程0
MPI_Gatherv(local_data,    // 本地数据
            local_n,       // 本地数据量
            MPI_INT,
            global_data,   // 全局数据（仅rank 0有效）
            recv_counts,   // 每个进程发送多少
            displs,        // 每个进程数据的起始位置
            MPI_INT,
            0,             // 收集到进程0
            MPI_COMM_WORLD);
```

**比喻**：老师（进程0）收集所有学生的作业，每个学生交的作业数量不同

---

#### 全收集：MPI_Allgatherv（多对多，不等长）

```cpp
// 类似Gatherv，但所有进程都能得到完整数据
MPI_Allgatherv(local_data,
               local_n,
               MPI_INT,
               global_data,  // 所有进程都有
               recv_counts,
               displs,
               MPI_INT,
               MPI_COMM_WORLD);
```

**比喻**：所有学生互相传阅作业，最后每个人都有全班的作业


---

## 四、MPI并行的核心思想：任务分配

### 4.1 问题：如何分配工作？

假设有一个10000行的矩阵，4个进程：

```
原始矩阵（10000行）：
┌─────────────┐
│ 行 0        │
│ 行 1        │
│ ...         │
│ 行 9999     │
└─────────────┘

分配策略（行分块）：
进程0: 行 0    - 2499  (2500行)
进程1: 行 2500 - 4999  (2500行)
进程2: 行 5000 - 7499  (2500行)
进程3: 行 7500 - 9999  (2500行)
```

### 4.2 计算分配范围

```cpp
int n = 10000;           // 总行数
int size = 4;            // 进程数
int rank;                // 当前进程编号

// 计算每个进程负责多少行
int rows_per_proc = n / size;  // 10000 / 4 = 2500

// 计算我负责的起始和结束行
int my_start = rank * rows_per_proc;
int my_end = (rank == size - 1) ? n : (rank + 1) * rows_per_proc;
//             ^^^^^^^^^^^^^^^^^^
//             最后一个进程要处理剩余的所有行（防止除不尽）

int my_local_n = my_end - my_start;  // 我负责的行数

// 例如：
// rank 0: my_start=0,    my_end=2500,  my_local_n=2500
// rank 1: my_start=2500, my_end=5000,  my_local_n=2500
// rank 2: my_start=5000, my_end=7500,  my_local_n=2500
// rank 3: my_start=7500, my_end=10000, my_local_n=2500
```

---

## 五、Lab3的完整流程详解

### 5.1 整体架构

```
阶段1: 数据分发
  Rank 0 读取文件
    ↓
  Rank 0 分发数据给其他进程
    ↓
  每个进程得到自己负责的矩阵行

阶段2: 并行计算（CG迭代）
  每个进程计算自己的部分
    ↓
  通过MPI通信同步必要的数据
    ↓
  重复迭代直到收敛

阶段3: 结果收集
  每个进程把自己的解发送给Rank 0
    ↓
  Rank 0 汇总完整的解向量
```

### 5.2 数据分发详解

#### 为什么需要数据分发？

```
问题：文件只能被一个进程读取
解决：Rank 0 读取后分发给其他进程

就像：
- 老师（Rank 0）拿到一本书
- 把不同章节复印后分给不同学生
- 每个学生只需要看自己的章节
```

#### 代码实现

```cpp
// === Rank 0 的工作 ===
if (rank == 0) {
    // 1. 读取完整的矩阵和向量
    read_matrix_full(matrix_file, &n_global, &full_row_ptr, 
                     &full_col_idx, &full_values, &full_nnz);
    read_vector_full(vector_file, &full_b);
    
    // 2. 分发给其他进程
    for (int i = 1; i < size; i++) {
        // 计算进程i需要的数据范围
        int i_start = i * rows_per_proc;
        int i_end = (i == size - 1) ? n_global : (i + 1) * rows_per_proc;
        int i_local_n = i_end - i_start;
        
        // 计算进程i需要的非零元素数量
        int i_nnz = full_row_ptr[i_end] - full_row_ptr[i_start];
        
        // 发送行偏移数组
        MPI_Send(&full_row_ptr[i_start], i_local_n + 1, MPI_INT, i, 0, MPI_COMM_WORLD);
        
        // 发送向量b的对应部分
        MPI_Send(&full_b[i_start], i_local_n, MPI_DOUBLE, i, 1, MPI_COMM_WORLD);
        
        // 发送非零元素值
        MPI_Send(&full_values[full_row_ptr[i_start]], i_nnz, MPI_DOUBLE, i, 2, MPI_COMM_WORLD);
        
        // 发送列索引
        MPI_Send(&full_col_idx[full_row_ptr[i_start]], i_nnz, MPI_INT, i, 3, MPI_COMM_WORLD);
    }
    
    // 3. Rank 0 也要准备自己的数据
    // （从完整数据中复制自己负责的部分）
}

// === 其他进程的工作 ===
else {
    // 接收Rank 0 发来的数据
    row_ptr = (int*)malloc((my_local_n + 1) * sizeof(int));
    b_local = (double*)malloc(my_local_n * sizeof(double));
    
    MPI_Recv(row_ptr, my_local_n + 1, MPI_INT, 0, 0, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    MPI_Recv(b_local, my_local_n, MPI_DOUBLE, 0, 1, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    
    int my_nnz = row_ptr[my_local_n] - row_ptr[0];
    values = (double*)malloc(my_nnz * sizeof(double));
    col_idx = (int*)malloc(my_nnz * sizeof(int));
    
    MPI_Recv(values, my_nnz, MPI_DOUBLE, 0, 2, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    MPI_Recv(col_idx, my_nnz, MPI_INT, 0, 3, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
}
```

**关键点**：
- 消息标签（tag）用于区分不同类型的数据
- 每个进程只保存自己需要的数据，节省内存

---

### 5.3 并行CG算法详解

#### CG算法回顾

```
初始化：
  x = 0, r = b, p = r

循环：
  1. Ap = A × p          ← 矩阵向量乘
  2. pAp = p^T × Ap      ← 点积
  3. α = rho / pAp
  4. x = x + α × p       ← 向量更新
  5. r = r - α × Ap      ← 向量更新
  6. rho_new = r^T × r   ← 点积
  7. 检查收敛
  8. β = rho_new / rho_old
  9. p = r + β × p       ← 向量更新
```

#### 并行化的挑战

```
问题1: SpMV需要完整的p向量
  - 每个进程只有p的一部分
  - 解决：用MPI_Allgatherv同步完整的p

问题2: 点积需要所有进程的结果
  - 每个进程只能计算局部点积
  - 解决：用MPI_Allreduce求和

问题3: 最终需要完整的解x
  - 每个进程只有x的一部分
  - 解决：用MPI_Gatherv收集到Rank 0
```

#### 代码实现（核心部分）

```cpp
void cg_parallel(int local_n, int n, int rank_start, int rank, int size)
{
    // 准备Allgatherv所需的参数
    int *recv_counts = (int*)malloc(size * sizeof(int));
    int *displs = (int*)malloc(size * sizeof(int));
    
    int rows_per_proc = n / size;
    for (int i = 0; i < size; i++) {
        int i_start = i * rows_per_proc;
        int i_end = (i == size - 1) ? n : (i + 1) * rows_per_proc;
        recv_counts[i] = i_end - i_start;  // 进程i有多少元素
        displs[i] = i_start;               // 进程i的起始位置
    }
    
    // 分配向量
    double *x_local = (double*)calloc(local_n, sizeof(double));  // 局部解
    double *r_local = (double*)malloc(local_n * sizeof(double)); // 局部残差
    double *Ap_local = (double*)malloc(local_n * sizeof(double));// 局部Ap
    double *p_global = (double*)malloc(n * sizeof(double));      // 完整的p向量
    
    // === 初始化 ===
    for (int i = 0; i < local_n; i++) {
        r_local[i] = b_local[i];  // r = b（因为x=0）
    }
    
    // 初始化p_global：先填入自己的部分，然后同步
    for (int i = 0; i < local_n; i++) {
        p_global[rank_start + i] = r_local[i];
    }
    
    // 同步p向量（所有进程都得到完整的p）
    MPI_Allgatherv(MPI_IN_PLACE,           // 使用原地操作
                   0, MPI_DATATYPE_NULL,   // 发送参数（原地操作时忽略）
                   p_global,               // 接收缓冲区
                   recv_counts,            // 每个进程贡献多少
                   displs,                 // 每个进程的起始位置
                   MPI_DOUBLE,
                   MPI_COMM_WORLD);
    
    // 计算初始残差范数
    double local_rho = 0.0;
    for (int i = 0; i < local_n; i++) {
        local_rho += r_local[i] * r_local[i];
    }
    
    double rho_old;
    MPI_Allreduce(&local_rho,    // 局部值
                  &rho_old,      // 全局结果
                  1,             // 1个元素
                  MPI_DOUBLE,
                  MPI_SUM,       // 求和
                  MPI_COMM_WORLD);
    
    // === 迭代求解 ===
    for (int iter = 0; iter < max_iter; iter++) {
        // 1. SpMV: Ap = A × p（局部计算）
        spmv_csr_local(local_n, p_global, Ap_local);
        
        // 2. 计算 pAp = p^T × Ap（局部计算 + 全局归约）
        double local_pAp = 0.0;
        for (int j = 0; j < local_n; j++) {
            local_pAp += p_global[rank_start + j] * Ap_local[j];
        }
        
        double pAp;
        MPI_Allreduce(&local_pAp, &pAp, 1, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);
        
        // 3. 更新 x 和 r（局部操作）
        double alpha = rho_old / pAp;
        for (int j = 0; j < local_n; j++) {
            x_local[j] += alpha * p_global[rank_start + j];
            r_local[j] -= alpha * Ap_local[j];
        }
        
        // 4. 计算新残差范数（局部计算 + 全局归约）
        double local_rho_new = 0.0;
        for (int j = 0; j < local_n; j++) {
            local_rho_new += r_local[j] * r_local[j];
        }
        
        double rho_new;
        MPI_Allreduce(&local_rho_new, &rho_new, 1, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);
        
        // 5. 检查收敛
        if (sqrt(rho_new) < tol) {
            if (rank == 0) {
                printf("迭代 %d 次后收敛\n", iter + 1);
            }
            break;
        }
        
        // 6. 更新搜索方向 p（局部更新 + 全局同步）
        double beta = rho_new / rho_old;
        for (int j = 0; j < local_n; j++) {
            p_global[rank_start + j] = r_local[j] + beta * p_global[rank_start + j];
        }
        
        // 同步更新后的p向量
        MPI_Allgatherv(MPI_IN_PLACE, 0, MPI_DATATYPE_NULL,
                       p_global, recv_counts, displs, MPI_DOUBLE,
                       MPI_COMM_WORLD);
        
        rho_old = rho_new;
    }
    
    // === 收集结果到Rank 0 ===
    if (rank == 0) {
        x_final = (double*)malloc(n * sizeof(double));
    }
    
    MPI_Gatherv(x_local,      // 局部解
                local_n,      // 局部大小
                MPI_DOUBLE,
                x_final,      // 全局解（仅Rank 0有效）
                recv_counts,
                displs,
                MPI_DOUBLE,
                0,            // 收集到Rank 0
                MPI_COMM_WORLD);
}
```


---

## 六、关键技术点详解

### 6.1 MPI_IN_PLACE的妙用

**问题**：Allgatherv需要发送和接收缓冲区，但我们想直接在同一个数组上操作

**解决**：使用`MPI_IN_PLACE`

```cpp
// ❌ 不使用IN_PLACE（需要两个数组）
double *send_buf = (double*)malloc(local_n * sizeof(double));
double *recv_buf = (double*)malloc(n * sizeof(double));

// 先复制到send_buf
for (int i = 0; i < local_n; i++) {
    send_buf[i] = r_local[i];
}

MPI_Allgatherv(send_buf, local_n, MPI_DOUBLE,
               recv_buf, recv_counts, displs, MPI_DOUBLE,
               MPI_COMM_WORLD);

// ✅ 使用IN_PLACE（只需一个数组）
double *p_global = (double*)malloc(n * sizeof(double));

// 直接在p_global中填入自己的部分
for (int i = 0; i < local_n; i++) {
    p_global[rank_start + i] = r_local[i];
}

// 原地同步（MPI会自动处理）
MPI_Allgatherv(MPI_IN_PLACE, 0, MPI_DATATYPE_NULL,
               p_global, recv_counts, displs, MPI_DOUBLE,
               MPI_COMM_WORLD);
```

**优点**：
- 节省内存
- 减少数据复制

---

### 6.2 局部偏移归一化

**问题**：每个进程收到的row_ptr是全局索引，需要转换为局部索引

```cpp
// 例如：进程1负责行2500-4999
// 收到的row_ptr可能是：[5000, 5010, 5025, ...]
//                        ^^^^
//                        这是全局的非零元素起始位置

// 需要转换为局部索引：[0, 10, 25, ...]

int offset = row_ptr[0];  // 记录偏移量
for (int i = 0; i <= my_local_n; i++) {
    row_ptr[i] -= offset;  // 减去偏移，归一化
}

// 现在row_ptr[0] = 0，可以正常使用了
```

---

### 6.3 同步点（Barrier）

**作用**：确保所有进程都到达同一个点才继续

```cpp
// 开始计时前同步
MPI_Barrier(MPI_COMM_WORLD);
double start_time = MPI_Wtime();

// ... 并行计算 ...

// 结束计时前同步
MPI_Barrier(MPI_COMM_WORLD);
double end_time = MPI_Wtime();

if (rank == 0) {
    printf("计算时间: %.6f 秒\n", end_time - start_time);
}
```

**为什么需要Barrier？**

```
没有Barrier的情况：
  进程0: ----计算----| 结束
  进程1: ----计算--------| 结束
  进程2: ----计算------| 结束
  进程3: ----计算----------| 结束
  
  问题：进程0先结束，计时不准确

有Barrier的情况：
  进程0: ----计算----| 等待 | 结束
  进程1: ----计算--------| 结束
  进程2: ----计算------| 等待 | 结束
  进程3: ----计算----------| 结束
  
  所有进程都等最慢的那个完成
```

---

### 6.4 时间测量

```cpp
// MPI提供的高精度计时器
double start = MPI_Wtime();  // 返回当前时间（秒）

// ... 要测量的代码 ...

double end = MPI_Wtime();
double elapsed = end - start;

// 只让Rank 0打印（避免重复输出）
if (rank == 0) {
    printf("耗时: %.6f 秒\n", elapsed);
}
```

---

## 七、通信模式总结

### 7.1 通信类型对比

| 操作 | 类型 | 说明 | 使用场景 |
|------|------|------|----------|
| MPI_Send/Recv | 点对点 | 一对一通信 | 数据分发 |
| MPI_Bcast | 集体 | 一对多广播 | 分发参数 |
| MPI_Reduce | 集体 | 多对一归约 | 收集结果 |
| MPI_Allreduce | 集体 | 多对多归约 | 全局求和 |
| MPI_Gather | 集体 | 多对一收集 | 收集结果 |
| MPI_Gatherv | 集体 | 多对一收集（不等长）| 收集不等长数据 |
| MPI_Allgather | 集体 | 多对多收集 | 同步向量 |
| MPI_Allgatherv | 集体 | 多对多收集（不等长）| 同步不等长向量 |

### 7.2 Lab3中的通信模式

```
数据分发阶段：
  Rank 0 → Rank 1,2,3  (MPI_Send/Recv)

CG迭代阶段（每次迭代）：
  1. 同步p向量：所有进程 ↔ 所有进程 (MPI_Allgatherv)
  2. 归约pAp：  所有进程 → 所有进程 (MPI_Allreduce)
  3. 归约rho：  所有进程 → 所有进程 (MPI_Allreduce)

结果收集阶段：
  Rank 1,2,3 → Rank 0  (MPI_Gatherv)
```

---

## 八、性能分析

### 8.1 理论加速比

```
理想情况：
  1个进程：时间 T
  4个进程：时间 T/4
  加速比 = 4

实际情况：
  4个进程：时间 T/4 + 通信开销
  加速比 < 4
```

### 8.2 通信开销

```
主要通信操作（每次迭代）：
  1. MPI_Allgatherv (p向量)：O(n)
  2. MPI_Allreduce (pAp)：   O(1)
  3. MPI_Allreduce (rho)：   O(1)

通信次数：
  - 小矩阵：迭代次数少，通信占比大
  - 大矩阵：迭代次数多，计算占比大
```

### 8.3 负载均衡

```
理想情况：每个进程工作量相同
  进程0: ████████
  进程1: ████████
  进程2: ████████
  进程3: ████████

不均衡情况：
  进程0: ████████
  进程1: ██████
  进程2: ████████████
  进程3: ████
  
  问题：进程2成为瓶颈
```

**Lab3的负载均衡**：
- 行分块策略：每个进程负责连续的行
- 对于稀疏矩阵，不同行的非零元素数量可能不同
- 可能导致轻微的负载不均衡

---

## 九、调试技巧

### 9.1 打印调试信息

```cpp
// 只让Rank 0打印（避免混乱）
if (rank == 0) {
    printf("矩阵维度: %d\n", n);
}

// 所有进程都打印（带上rank标识）
printf("[Rank %d] 我负责 %d 行\n", rank, local_n);

// 使用fflush确保立即输出
printf("[Rank %d] 开始计算\n", rank);
fflush(stdout);
```

### 9.2 检查数据分发

```cpp
// 在每个进程中检查收到的数据
printf("[Rank %d] 收到 %d 行, %d 个非零元素\n", 
       rank, local_n, row_ptr[local_n] - row_ptr[0]);

// 检查第一行的数据
if (local_n > 0) {
    printf("[Rank %d] 第一行有 %d 个非零元素\n",
           rank, row_ptr[1] - row_ptr[0]);
}
```

### 9.3 常见错误

**错误1：死锁**
```cpp
// ❌ 错误：所有进程都在等待接收
MPI_Recv(...);
MPI_Send(...);

// ✅ 正确：先发送再接收，或使用非阻塞通信
if (rank == 0) {
    MPI_Send(...);
} else {
    MPI_Recv(...);
}
```

**错误2：数据类型不匹配**
```cpp
// ❌ 错误：发送int，接收double
MPI_Send(&data, 1, MPI_INT, ...);
MPI_Recv(&data, 1, MPI_DOUBLE, ...);

// ✅ 正确：类型匹配
MPI_Send(&data, 1, MPI_INT, ...);
MPI_Recv(&data, 1, MPI_INT, ...);
```

**错误3：忘记同步**
```cpp
// ❌ 错误：没有同步就使用p_global
for (int i = 0; i < local_n; i++) {
    p_global[rank_start + i] = r_local[i];
}
// 直接使用p_global（其他进程的部分还是旧值！）

// ✅ 正确：先同步
for (int i = 0; i < local_n; i++) {
    p_global[rank_start + i] = r_local[i];
}
MPI_Allgatherv(...);  // 同步
// 现在可以安全使用p_global
```


---

## 十、完整流程图

```
main()
  │
  ├─ MPI_Init()  // 初始化MPI环境
  │
  ├─ 获取rank和size
  │
  ├─ 数据分发阶段
  │   │
  │   ├─ Rank 0:
  │   │   ├─ 读取完整矩阵和向量
  │   │   ├─ 计算每个进程的数据范围
  │   │   ├─ 用MPI_Send分发给其他进程
  │   │   └─ 准备自己的数据
  │   │
  │   └─ Rank 1,2,3,...:
  │       └─ 用MPI_Recv接收数据
  │
  ├─ 局部偏移归一化
  │
  ├─ MPI_Barrier()  // 同步，准备开始计时
  │
  ├─ start_time = MPI_Wtime()
  │
  ├─ cg_parallel()  // 并行CG求解
  │   │
  │   ├─ 初始化 x=0, r=b, p=r
  │   │
  │   ├─ 同步p向量 (MPI_Allgatherv)
  │   │
  │   ├─ 计算初始残差 (MPI_Allreduce)
  │   │
  │   └─ for (iter = 0; iter < max_iter; iter++)
  │       │
  │       ├─ SpMV: Ap = A×p (局部计算)
  │       │
  │       ├─ pAp = p^T×Ap (局部计算 + MPI_Allreduce)
  │       │
  │       ├─ α = rho/pAp
  │       │
  │       ├─ x = x + α×p (局部更新)
  │       │
  │       ├─ r = r - α×Ap (局部更新)
  │       │
  │       ├─ rho_new = r^T×r (局部计算 + MPI_Allreduce)
  │       │
  │       ├─ 检查收敛
  │       │
  │       ├─ β = rho_new/rho_old
  │       │
  │       ├─ p = r + β×p (局部更新)
  │       │
  │       └─ 同步p向量 (MPI_Allgatherv)
  │
  ├─ MPI_Barrier()  // 同步，准备结束计时
  │
  ├─ end_time = MPI_Wtime()
  │
  ├─ 收集结果到Rank 0 (MPI_Gatherv)
  │
  ├─ Rank 0 打印结果
  │
  ├─ 释放内存
  │
  └─ MPI_Finalize()  // 结束MPI环境
```

---

## 十一、编译和运行

### 11.1 编译

```bash
# 使用MPI编译器
mpicxx -O3 sparse.cpp -o sparse.o

# 或者使用mpicc（C语言）
mpicc -O3 sparse.c -o sparse.o
```

### 11.2 运行

```bash
# 本地运行（4个进程）
mpirun -np 4 ./sparse.o matrix.txt vector.txt

# 通过PBS提交（集群）
qsub -v MATRIX=matrix.txt,VECTOR=vector.txt,PROCS=4 sparse.pbs
```

### 11.3 PBS脚本

```bash
#!/bin/bash
#PBS -N lab3_mpi
#PBS -l nodes=1:ppn=32
#PBS -j oe

cd $PBS_O_WORKDIR

# 运行MPI程序
{ time mpirun -np ${PROCS} ./sparse.o ${MATRIX} ${VECTOR} ; } 2>&1 > ${OUTPUT}
```

---

## 十二、与Lab2/Lab4的对比

| 特性 | Lab2 (pthread) | Lab3 (MPI) | Lab4 (GPU) |
|------|----------------|------------|------------|
| **并行模型** | 共享内存 | 分布式内存 | 大规模数据并行 |
| **线程/进程数** | 1-32 | 1-32 | 数千到数万 |
| **内存访问** | 直接访问共享变量 | 通过消息传递 | GPU显存 |
| **通信方式** | 无需通信 | MPI消息传递 | CPU-GPU传输 |
| **同步机制** | pthread_barrier | MPI_Barrier | __syncthreads |
| **数据分配** | 自动共享 | 手动分发 | 手动拷贝 |
| **适用场景** | 单机多核 | 多机集群 | GPU加速 |
| **编程难度** | 中等 | 较高 | 高 |
| **扩展性** | 受限于单机核数 | 可扩展到多机 | 受限于GPU |

### 关键区别

**Lab2 (pthread)**：
```cpp
// 所有线程共享同一个数组
double *x = (double*)malloc(n * sizeof(double));

#pragma omp parallel
{
    // 所有线程都能直接访问x
    x[i] = ...;
}
```

**Lab3 (MPI)**：
```cpp
// 每个进程有自己的数组
double *x_local = (double*)malloc(local_n * sizeof(double));

// 需要通过MPI通信才能访问其他进程的数据
MPI_Allgatherv(...);
```

**Lab4 (GPU)**：
```cpp
// CPU和GPU有各自的内存
double *x_cpu = (double*)malloc(n * sizeof(double));
double *x_gpu;
hipMalloc(&x_gpu, n * sizeof(double));

// 需要显式拷贝
hipMemcpy(x_gpu, x_cpu, ..., hipMemcpyHostToDevice);
```

---

## 十三、实验参数

### 矩阵规模
- **small**: 1000, 5000, 10000
- **large**: 10000, 50000, 100000
- **all**: 1000, 5000, 10000, 50000, 100000

### 进程数
- 1, 2, 4, 8, 16, 32

### 重复次数
- 每个配置重复5次

---

## 十四、使用方法

### 方式1: 使用脚本（推荐）

```bash
# 1. 上传代码到服务器
scp -r code/* pc-lab:~/Lab3/

# 2. 登录服务器
ssh pc-lab

# 3. 运行实验
cd ~/Lab3
bash run_experiment.sh small    # 小规模测试
# 或
bash run_experiment.sh large    # 大规模测试
# 或
bash run_experiment.sh all      # 全部规模

# 4. 等待完成后分析结果
python3 analyze_results.py results

# 5. 下载报告（在本地）
scp pc-lab:~/Lab3/results/*.txt ./
scp pc-lab:~/Lab3/results/*.png ./
```

### 方式2: 手动运行

```bash
# 1. 编译
mpicxx -O3 sparse.cpp -o sparse.o

# 2. 准备数据（如果没有）
# 可以使用Lab2的测试数据

# 3. 提交任务
qsub -v MATRIX=matrix_10000.txt,VECTOR=vector_10000.txt,PROCS=4,OUTPUT=result.log sparse.pbs

# 4. 查看状态
qstat -u $USER

# 5. 查看结果
cat result.log
```

---

## 十五、预期结果

### 加速比分析

```
理想加速比：
  进程数 = 4 → 加速比 = 4
  进程数 = 8 → 加速比 = 8

实际加速比（考虑通信开销）：
  小矩阵（1000×1000）：
    - 计算量小，通信开销占比大
    - 加速比 < 理想值
    - 可能出现负加速（进程多反而慢）
  
  大矩阵（100000×100000）：
    - 计算量大，通信开销占比小
    - 加速比接近理想值
    - 并行效率高
```

### 性能曲线

```
加速比 vs 进程数：
  
  ^
  |                    理想曲线 /
  |                           /
  |                         /
  |                       /
  |                     /
  |        实际曲线   /
  |              ___/
  |          __/
  |      __/
  |  __/
  |/
  +------------------------->
   1   2   4   8  16  32    进程数
```

---

## 十六、故障排查

### 编译错误

```bash
# 错误：找不到mpi.h
# 解决：加载MPI模块
module load mpi

# 错误：找不到mpicxx
# 解决：使用正确的编译器路径
which mpicxx
```

### 运行错误

```bash
# 错误：进程数超过可用核数
# 解决：减少进程数或申请更多节点

# 错误：数据文件找不到
# 解决：检查文件路径，使用绝对路径

# 错误：内存不足
# 解决：减小矩阵规模或增加内存申请
```

### 性能异常

```bash
# 问题：加速比很低
# 检查：
1. 矩阵是否太小（通信开销大）
2. 进程数是否太多（负载不均衡）
3. 是否有进程卡住（死锁）

# 问题：结果不正确
# 检查：
1. 数据分发是否正确
2. 局部偏移是否归一化
3. 通信是否同步
```

---

## 十七、文件结构

```
第三次实验/
├── code/
│   ├── sparse.cpp              # MPI并行版本
│   └── script/
│       ├── run_experiment.sh   # 实验运行脚本
│       ├── sparse.pbs          # PBS作业脚本
│       └── analyze_results.py  # 结果分析脚本
└── README.md                   # 本教程
```

---

## 十八、学习建议

### 从简单到复杂

1. **第一步**：理解MPI基本概念
   - 运行简单的Hello World程序
   - 理解rank和size

2. **第二步**：学习点对点通信
   - 实现简单的Send/Recv
   - 理解消息传递机制

3. **第三步**：学习集体通信
   - 实现Bcast, Reduce, Gather
   - 理解不同通信模式的区别

4. **第四步**：理解数据分发
   - 实现简单的数组分发
   - 理解数据分块策略

5. **第五步**：完整的并行算法
   - 理解Lab3的CG算法
   - 分析通信和计算的平衡

### 调试建议

1. **先用少量进程测试**（如2个进程）
2. **打印中间结果验证正确性**
3. **逐步增加进程数观察性能**
4. **对比串行版本验证结果**

---

## 十九、参考资料

- MPI标准文档
- 实验指导书第三章
- AGENTS.md中的实验经验总结
- Lab2代码（对比学习）
