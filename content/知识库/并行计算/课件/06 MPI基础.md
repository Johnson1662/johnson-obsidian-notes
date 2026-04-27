# MPI基础

## MPI概述

MPI（Message Passing Interface）是一种消息传递编程模型的标准/规范，而非特定实现。
- MPI是事实上的并行计算标准，绝大多数并行计算机制造商都提供支持
- MPI实现是一个**库**，而非一门新语言
- 可将 `Fortran+MPI` 或 `C+MPI` 看作在串行语言基础上扩展的并行语言

### MPI程序结构（SPMD：Single Program Multiple Data）

```
MPI include file
Declarations, prototypes, etc.

Program Begins
    Serial code
    MPI_Init(&argc, &argv);   // 初始化MPI环境
    Parallel code begins
        Do work and make message passing calls
    Terminate MPI Environment
    Parallel code ends
    Serial code
Program Ends
```

### MPI六个基本接口

| 功能 | 函数 |
|------|--------|
| 开始 | `MPI_INIT` |
| 结束 | `MPI_FINALIZE` |
| 进程数 | `MPI_COMM_SIZE` |
| 进程编号 | `MPI_COMM_RANK` |
| 发送消息 | `MPI_SEND` |
| 接收消息 | `MPI_RECV` |

### MPI程序示例：Hello World!

**Fortran**
```fortran
PROGRAM hello
INCLUDE 'mpif.h'
INTEGER err
CALL MPI_INIT(err)
PRINT *, "hello world!"
CALL MPI_FINALIZE(err)
END
```

**C**
```c
#include <stdio.h>
#include <mpi.h>
int main(int argc, char *argv[]) {
    int err;
    err = MPI_Init(&argc, &argv);
    printf("Hello world!\n");
    err = MPI_Finalize();
    return 0;
}
```

---

## 集群体系结构

### 集群分类（按用途）

| 类型 | 说明 |
|------|------|
| 高性能计算 | 科学计算、并行计算，优先考虑计算性能 |
| 大数据分析 | 分布式并行数据处理，优先考虑IO与存储性能 |
| 高可用服务 | 高可靠在线服务，最大程度减少对外服务中断 |

### 集群作业管理

在大规模集群/超算上，通常需通过作业管理系统提交计算任务。

| 管理系统 | 特点 |
|-----------|------|
| PBS (Portable Batch System) | 开源（OpenPBS/Torque），支持批处理、交互式、串行/并行作业 |
| Slurm (Simple Linux Utility for Resource Management) | TOP500中约60%使用，天河二号采用，支持希尔伯特曲线调度优化 |
| LSF | IBM商业调度系统 |

**PBS与Slurm命令对照表**

| 功能 | PBS | Slurm |
|------|-----|-------|
| 任务名称 | `#PBS -N name` | `#SBATCH -J name` |
| 指定队列/分区 | `#PBS -q cpu` | `#SBATCH -p cpu` |
| 最长运行时间 | `#PBS -l walltime=5:00` | `#SBATCH -t 5:00` |
| 指定节点数 | `#PBS -l nodes=1` | `#SBATCH -N 1` |
| 指定CPU核心 | `#PBS -l ppn=4` | `#SBATCH --cpus-per-task=4` |
| 指定GPU卡 | 不支持 | `#SBATCH --gres=gpu:1` |
| 作业数组 | `#PBS -t 0-2` | `#SBATCH -a 0-2` |
| 输出文件 | `#PBS -o test.out` | `#SBATCH -o test.out` |
| 提交任务 | `qsub run.pbs` | `sbatch run.slurm` |
| 查看状态 | `qstat` | `squeue` |
| 取消任务 | `qdel 1234` | `scancel 1234` |
| 交互式任务 | `qsub -I` | `salloc` |

---

## 点到点通信

### 发送：`MPI_Send`

```c
MPI_Send(
    void* buf,       // 发送缓冲区起始地址
    int count,       // 数据项数
    MPI_Datatype datatype,  // 数据类型
    int dest,         // 目标进程编号
    int tag,          // 消息标签
    MPI_Comm comm     // 通信域
);
```

### 接收：`MPI_Recv`

```c
MPI_Recv(
    void* buf,       // 接收缓冲区起始地址
    int count,       // 最大可接收数据项数
    MPI_Datatype datatype,  // 接收数据类型
    int source,       // 源进程编号
    int tag,          // 消息标签
    MPI_Comm comm,     // 通信域
    MPI_Status *status  // 返回状态（可NULL）
);
```

- `status.MPI_SOURCE`：实际发送方
- `status.MPI_TAG`：实际标签
- `MPI_Get_count(&status, MPI_INT, &C)`：读出实际接收的数据项数

### 消息标签的作用

标签用于区分同一对进程间发送的不同类型消息，避免接收错误。

**未使用标签（可能出错）**：
```
Process P:  send(A,32,Q)  send(B,16,Q)
Process Q:  recv(X,32,P)  recv(Y,16,P)
// 若B先到，X可能收到B的数据！
```

**使用标签（正确）**：
```
Process P:  send(A,32,Q,tag1)  send(B,16,Q,tag2)
Process Q:  recv(X,32,P,tag1)  recv(Y,16,P,tag2)
// 标签保证正确匹配
```

### 消息路径

发送进程 → 系统发送缓冲区 → 网络 → 系统接收缓冲区 → 接收进程

---

## 组通信（Collective Communication）

| 类型 | 函数 | 说明 |
|------|------|------|
| 一到多广播 | `MPI_Bcast` | Root进程向所有进程发送相同数据 |
| 一到多散播 | `MPI_Scatter` | Root向各进程发送不同数据（等长） |
| 一到多散播（不等长） | `MPI_Scatterv` | Root向各进程发送不同长度数据 |
| 多到一收集 | `MPI_Gather` | 各进程向Root发送数据（等长） |
| 多到一收集（不等长） | `MPI_Gatherv` | 各进程向Root发送不同长度数据 |
| 多到多收集 | `MPI_Allgather` | 所有进程收集所有进程的数据 |
| 归约 | `MPI_Reduce` | 所有进程向Root归约（MAX/MIN/SUM/PROD等） |
| 全归约 | `MPI_Allreduce` | 所有进程均获得归约结果 |
| 归约散播 | `MPI_Reduce_scatter` | 归约后将结果散播到各进程 |
| 扫描 | `MPI_Scan` | 进程i对进程0..i做归约，结果存进程i |
| 同步屏障 | `MPI_Barrier` | 所有进程在此等待，直到全部到达 |

### 广播：`MPI_Bcast`

```c
MPI_Bcast(&value, 1, MPI_INT, 0, MPI_COMM_WORLD);
// Root=0发送value，所有进程（含Root自己）接收
```

### 散播：`MPI_Scatter`

```c
int gsize, *sendbuf, rbuf[100];
MPI_Comm_size(comm, &gsize);
sendbuf = (int*)malloc(gsize * 100 * sizeof(int));
MPI_Scatter(sendbuf, 100, MPI_INT, rbuf, 100, MPI_INT, root, comm);
// Root将sendbuf中每100个数据发给一个进程
```

### 收集：`MPI_Gather`

```c
int gsize, sendarray[100], *rbuf;
MPI_Comm_size(comm, &gsize);
rbuf = (int*)malloc(gsize * 100 * sizeof(int));
MPI_Gather(sendarray, 100, MPI_INT, rbuf, 100, MPI_INT, root, comm);
// 各进程发送100个数据给Root，Root按rank顺序拼接
```

### 归约：`MPI_Reduce`

支持操作：`MPI_MAX`, `MPI_MIN`, `MPI_SUM`, `MPI_PROD`, `MPI_LAND`, `MPI_BAND`, `MPI_LOR`, `MPI_BOR`, `MPI_LXOR`, `MPI_BXOR`, `MPI_MAXLOC`, `MPI_MINLOC`

```c
MPI_Reduce(&my_value, &result, 1, MPI_INT, MPI_SUM, root, comm);
// 所有进程归约求和，结果存root
```

### 全归约：`MPI_Allreduce`

```c
MPI_Allreduce(&my_value, &result, 1, MPI_INT, MPI_SUM, comm);
// 所有进程均获得归约结果
```

### 扫描：`MPI_Scan`

```c
MPI_Scan(&my_value, &result, 1, MPI_INT, MPI_SUM, comm);
// 进程i的结果 = 进程0..i的my_value之和
```

### 全交换：`MPI_Alltoall`

每个进程将发送缓冲区的第i块发给进程i，同时从进程j接收数据放到接收缓冲区第j块。

---

## 阻塞通信模式

| 模式 | 函数前缀 | 说明 |
|------|-----------|------|
| 标准通信 | `MPI_Send` | MPI决定是否缓存，发送可立即返回 |
| 缓存通信 | `MPI_Bsend` | 用户自行提供缓存，不依赖系统 |
| 同步通信 | `MPI_Ssend` | 必须等到接收方开始接收才返回 |
| 就绪通信 | `MPI_Rsend` | 接收方已准备好才能发送，否则出错 |

### 非阻塞版本（前缀`I`）

| 标准 | 缓存 | 同步 | 就绪 |
|------|------|------|------|
| `MPI_Isend` | `MPI_Ibsend` | `MPI_Issend` | `MPI_Irsend` |
| `MPI_Irecv` | — | — | — |

### 非阻塞通信完成检测

| 数量 | 检测 | 完成 |
|------|------|------|
| 单个 | `MPI_Test` | `MPI_Wait` |
| 任意一个 | `MPI_Testany` | `MPI_Waitany` |
| 多个 | `MPI_Testsome` | `MPI_Waitsome` |
| 所有 | `MPI_Testall` | `MPI_Waitall` |

### 重复非阻塞通信

| 模式 | 发送初始化 | 接收初始化 |
|------|-----------|-----------|
| 标准 | `MPI_Send_init` | `MPI_Recv_init` |
| 缓存 | `MPI_Bsend_init` | — |
| 同步 | `MPI_Ssend_init` | — |
| 就绪 | `MPI_Rsend_init` | — |

使用流程：
1. `MPI_Send_init(...)` — 初始化
2. `MPI_Start(&request)` — 启动
3. `MPI_Wait(&request, &status)` — 等待完成
4. `MPI_Request_free(&request)` — 释放对象

### 死锁避免

**错误示例（可能死锁）**：
```c
// 每个进程向右侧发送，从左接收
MPI_Send(..., right_rank, ...);
MPI_Recv(..., left_rank, ...);
// 若MPI选择同步协议，所有进程同时等待 → 死锁
```

**正确方法（使用非阻塞或捆绑发送接收）**：
```c
// 方法1：先接收后发送
MPI_Recv(..., left_rank, ...);
MPI_Send(..., right_rank, ...);

// 方法2：使用MPI_Sendrecv（推荐）
MPI_Sendrecv(sendbuf, cnt, type, right, tag,
             recvbuf, cnt, type, left, tag,
             MPI_COMM_WORLD, &status);
```

### `MPI_Sendrecv`

捆绑发送和接收于一个调用，避免单独写发送/接收时的次序错误导致死锁。
- 语义上等同于一个发送+一个接收
- 系统会优化通信次序，最大限度避免死锁
- 发送缓冲区和接收缓冲区必须分开

---

## 虚拟进程 `MPI_PROC_NULL`

`MPI_PROC_NULL` 是不存在的假想进程，用于编写通信语句时简化边界处理。
- 向`MPI_PROC_NULL`发送 → 立即成功返回（空操作）
- 从`MPI_PROC_NULL`接收 → 立即成功返回，接收缓冲区不变

```c
// Jacobi迭代中处理边界
int left = (myid > 0) ? myid-1 : MPI_PROC_NULL;
int right = (myid < n-1) ? myid+1 : MPI_PROC_NULL;

MPI_Sendrecv(sendData1, cnt, MPI_FLOAT, right, tag,
             recvData1, cnt, MPI_FLOAT, left, tag,
             MPI_COMM_WORLD, &status);
```

---

## MPI基本数据类型

| MPI类型 | C类型 |
|----------|-------|
| `MPI_CHAR` | `signed char` |
| `MPI_SHORT` | `signed short int` |
| `MPI_INT` | `signed int` |
| `MPI_LONG` | `signed long int` |
| `MPI_UNSIGNED_CHAR` | `unsigned char` |
| `MPI_UNSIGNED` | `unsigned int` |
| `MPI_FLOAT` | `float` |
| `MPI_DOUBLE` | `double` |
| `MPI_LONG_DOUBLE` | `long double` |
| `MPI_BYTE` | 字节 |
| `MPI_PACKED` | 打包数据 |

---

## 自定义数据类型

### 连续数据类型：`MPI_Type_contiguous`

将连续的内存区域定义为一个类型。
```c
int MPI_Type_contiguous(int count, MPI_Datatype oldtype, MPI_Datatype *newtype);
// 例：定义10个连续int的类型
MPI_Type_contiguous(10, MPI_INT, &newtype);
MPI_Type_commit(&newtype);
```

### 向量数据类型：`MPI_Type_vector`

定义跨步长为stride的向量类型。
```c
int MPI_Type_vector(int count, int blocklength, int stride,
                       MPI_Datatype oldtype, MPI_Datatype *newtype);
// 例：每隔3个取2个，共取4次
// [0,1, skip 2,3, skip 5,6, skip 8,9] → 8个元素
MPI_Type_vector(4, 2, 3, MPI_INT, &newtype);
```

### 结构体数据类型：`MPI_Type_struct`

定义包含不同类型和位移的结构体类型。
```c
int MPI_Type_struct(int count, int *array_of_blocklengths,
                        MPI_Aint *array_of_displacements,
                        MPI_Datatype *array_of_types,
                        MPI_Datatype *newtype);
```

---

## 虚拟进程拓扑

### 笛卡尔拓扑

```c
int MPI_Cart_create(MPI_Comm comm_old, int ndims,
                          int *dims, int *periods, int reorder,
                          MPI_Comm *comm_cart);
// ndims=2, dims={4,3}, periods={1,0} → 4×3网格，第1维环形
```

### 坐标与rank互转

```c
// rank → 坐标
MPI_Cart_coordinates(comm_cart, rank, maxdims, coords);

// 坐标 → rank
MPI_Cart_rank(comm_cart, coords, &rank);
```

### 计算邻居rank

```c
MPI_Cart_shift(comm_cart, direction, disp, &rank_source, &rank_dest);
// direction=0（第1维），disp=+1 → 向右邻居发送
// 若无邻居，返回MPI_PROC_NULL
```

### 划分子拓扑：`MPI_Cart_sub`

```c
int MPI_Cart_sub(MPI_Comm comm_cart, int *remain_dims, MPI_Comm *comm_sub);
// remain_dims={true, false} → 保留第1维，沿第2维划分
```
