# MPI进阶

## 非阻塞通信#

阻塞通信的局限：发送/接收调用会等待直到操作完成（或至少安全返回），期间无法执行其他计算。

### 非阻塞操作的优势
- 调用后立即返回，不等待任何通信事件
- 将计算与通信重叠，改进并行效率
- 避免由于发送/接收次序错误导致的死锁

### 非阻塞发送/接收

**非阻塞发送**：
```c
MPI_Isend(void* buf, int count, MPI_Datatype datatype,
            int dest, int tag, MPI_Comm comm,
            MPI_Request *request);  // 非阻塞通信对象
```

**非阻塞接收**：
```c
MPI_Irecv(void* buf, int count, MPI_Datatype datatype,
            int source, int tag, MPI_Comm comm,
            MPI_Request *request);
```

> `MPI_Request` 是MPI内部对象，通过句柄存取，标识非阻塞通信的特性（模式、缓冲区、上下文等）。

### 非阻塞通信模式对照表#

| 阻塞模式 | 非阻塞等价 | 说明 |
|----------|-------------|------|
| `MPI_SEND` | `MPI_Isend` | 标准非阻塞 |
| `MPI_Bsend` | `MPI_Ibsend` | 缓存非阻塞 |
| `MPI_Ssend` | `MPI_Issend` | 同步非阻塞 |
| `MPI_Rsend` | `MPI_Irsend` | 就绪非阻塞 |

**重复非阻塞通信**（用于循环内重复执行）：
| 阻塞模式 | 初始化 | 说明 |
|----------|---------|------|
| `MPI_SEND` | `MPI_Send_init` | 标准重复 |
| `MPI_Bsend` | `MPI_Bsend_init` | 缓存重复 |
| `MPI_Ssend` | `MPI_Ssend_init` | 同步重复 |
| `MPI_Rsend` | `MPI_Rsend_init` | 就绪重复 |

---

## 非阻塞通信的完成检测#

| 通信数量 | 检测（不阻塞） | 完成（阻塞等待） |
|-----------|---------------|-----------------|
| 单个 | `MPI_Test(&req, &flag, &status)` | `MPI_Wait(&req, &status)` |
| 任意一个 | `MPI_Testany(count, reqs, &idx, &flag, &status)` | `MPI_Waitany(count, reqs, &idx, &status)` |
| 部分 | `MPI_Testsome(count, reqs, &outcnt, indices, &status)` | `MPI_Waitsome(count, reqs, &outcnt, indices, &status)` |
| 所有 | `MPI_Testall(count, reqs, &flag, statuses)` | `MPI_Waitall(count, reqs, statuses)` |

### 单个非阻塞通信
```c
int MPI_Wait(MPI_Request *request, MPI_Status *status);
// 阻塞直到通信完成，完成后释放request对象

int MPI_Test(MPI_Request *request, int *flag, MPI_Status *status);
// 非阻塞检测，flag=true表示已完成
```

### 多个非阻塞通信
```c
// 等待任意一个完成
int MPI_Waitany(int count, MPI_Request *array_of_request,
                   int *index, MPI_Status *status);
// 返回后 index 表示完成的是第 index 个对象

// 等待所有完成
int MPI_Waitall(int count, MPI_Request *array_of_request,
                   MPI_Status *array_of_statuses);
```

---

## 非阻塞通信的取消#

```c
int MPI_Cancel(MPI_Request *request);
// 取消非阻塞通信
```
- 若取消成功，`MPI_Wait` 或 `MPI_Test` 返回的状态会标明该通信已被取消
- `int MPI_Test_cancelled(MPI_Status status, int *flag)`：检测是否被取消

### 非阻塞通信对象释放#
```c
int MPI_Request_free(MPI_Request *request);
// 释放非阻塞通信对象占用的资源
// 若通信尚未完成，等资源释放后再释放
```

---

## 消息到达检查#

```c
// 阻塞检测，有消息到达才返回
int MPI_Probe(int source, int tag, MPI_Comm comm, MPI_Status *status);

// 非阻塞检测
int MPI_Iprobe(int source, int tag, MPI_Comm comm,
                int *flag, MPI_Status *status);
```

---

## 重复非阻塞通信#

通信参数与MPI内部对象建立固定联系，优化以降低开销。

### 使用流程#
1. 初始化：`MPI_Send_init(...)` 或 `MPI_Recv_init(...)`
2. 启动通信：`MPI_Start(&request)`
3. 完成通信：`MPI_Wait(&request, &status)`
4. 释放对象：`MPI_Request_free(&request)`

---

## 死锁与避免#

### 死锁示例（阻塞操作）#
```c
// 每个进程都先发送后接收
MPI_Send(..., right_rank, ...);
MPI_Recv(..., left_rank, ...);
// 如果MPI选择同步协议，所有进程都会阻塞 → 死锁！
```

### 用非阻塞避免死锁#
```c
// 方法1：先接收后发送
MPI_Irecv(..., left_rank, ..., &req1);
MPI_Isend(..., right_rank, ..., &req2);
MPI_Wait(&req1, &status);
MPI_Wait(&req2, &status);

// 方法2：使用MPI_Sendrecv（推荐）
MPI_Sendrecv(sendbuf, cnt, type, right, tag,
             recvbuf, cnt, type, left, tag,
             MPI_COMM_WORLD, &status);
```

---

## MPI_Sendrecv（捆绑发送接收）#

把发送和接收合并到一个调用中，有效避免死锁。

```c
int MPI_Sendrecv(
    void *sendbuf, int sendcount, MPI_Datatype sendtype,
    int dest, int sendtag,
    void *recvbuf, int recvcount, MPI_Datatype recvtype,
    int source, int recvtag,
    MPI_Comm comm, MPI_Status *status
);
```
- 语义上等同于一个发送 + 一个接收
- 系统优化通信次序，最大限度避免死锁
- 发送和接收缓冲区必须分开

### Jacobi迭代示例#
```c
int left = (myid > 0) ? myid-1 : MPI_PROC_NULL;
int right = (myid < n-1) ? myid+1 : MPI_PROC_NULL;

// 向右平移数据
MPI_Sendrecv(sendData1, cnt, MPI_FLOAT, right, tag1,
             recvData1, cnt, MPI_FLOAT, left, tag1,
             MPI_COMM_WORLD, &status);

// 向左平移数据
MPI_Sendrecv(sendData2, cnt, MPI_FLOAT, left, tag2,
             recvData2, cnt, MPI_FLOAT, right, tag2,
             MPI_COMM_WORLD, &status);
```

---

## 虚拟进程 `MPI_PROC_NULL`#

`MPI_PROC_NULL` 是不存在的假想进程，用于边界处理。

- 向 `MPI_PROC_NULL` 发送 → 立即成功返回（空操作）
- 从 `MPI_PROC_NULL` 接收 → 立即成功返回，接收缓冲区不变

```c
// 简化边界处理，无需if判断
int left = (myid > 0) ? myid-1 : MPI_PROC_NULL;
int right = (myid < n-1) ? myid+1 : MPI_PROC_NULL;

MPI_Sendrecv(sendData, cnt, MPI_FLOAT, right, tag,
             recvData, cnt, MPI_FLOAT, left, tag,
             MPI_COMM_WORLD, &status);
// 边界进程自动处理，无需特殊代码
```

---

## 自定义数据类型#

MPI基本数据类型：

| MPI类型 | C类型 |
|---------|-------|
| `MPI_CHAR` | `signed char` |
| `MPI_SHORT` | `signed short int` |
| `MPI_INT` | `signed int` |
| `MPI_LONG` | `signed long int` |
| `MPI_FLOAT` | `float` |
| `MPI_DOUBLE` | `double` |

### 连续数据类型：`MPI_Type_contiguous`#

将连续内存区域定义为一个类型。
```c
int MPI_Type_contiguous(int count, MPI_Datatype oldtype,
                          MPI_Datatype *newtype);
// 例：定义10个连续int
MPI_Type_contiguous(10, MPI_INT, &newtype);
MPI_Type_commit(&newtype);  // 提交类型后使用
```

### 向量数据类型：`MPI_Type_vector`#

定义跨步长为stride的向量类型。
```c
int MPI_Type_vector(int count, int blocklength, int stride,
                       MPI_Datatype oldtype, MPI_Datatype *newtype);
// 例：每隔3个取2个，共取4次 → 8个元素
// [0,1, skip 2,3,4, skip 5,6, skip 8,9]
MPI_Type_vector(4, 2, 3, MPI_INT, &newtype);
```

### 结构体数据类型：`MPI_Type_struct`#

定义包含不同类型和位移的结构体类型。
```c
int MPI_Type_struct(int count, int *array_of_blocklengths,
                        MPI_Aint *array_of_displacements,
                        MPI_Datatype *array_of_types,
                        MPI_Datatype *newtype);
```

---

## 虚拟进程拓扑#

### 笛卡尔拓扑（Cartesian Topology）#

```c
int MPI_Cart_create(MPI_Comm comm_old, int ndims,
                         int *dims, int *periods, int reorder,
                         MPI_Comm *comm_cart);
// ndims=2, dims={4,3}, periods={1,0} → 4×3网格，第1维环形
```

### 坐标与Rank互转#

```c
// rank → 坐标
int MPI_Cart_coords(MPI_Comm comm_cart, int rank,
                         int maxdims, int *coords);

// 坐标 → rank
int MPI_Cart_rank(MPI_Comm comm_cart, int *coords, int *rank);
```

### 计算邻居Rank#

```c
int MPI_Cart_shift(MPI_Comm comm_cart, int direction,
                        int disp, int *rank_source,
                        int *rank_dest);
// direction=0（第1维），disp=+1 → 向右邻居发送
// 若无邻居，返回 MPI_PROC_NULL
```

### 划分子拓扑：`MPI_Cart_sub`#

```c
int MPI_Cart_sub(MPI_Comm comm_cart, int *remain_dims,
                       MPI_Comm *comm_sub);
// remain_dims={true, false} → 保留第1维，沿第2维划分
```

### Jacobi迭代（笛卡尔拓扑版）#

```c
// 创建2D笛卡尔拓扑
int dims[2] = {4, 3};
int periods[2] = {1, 0};
MPI_Comm comm_cart;
MPI_Cart_create(MPI_COMM_WORLD, 2, dims, periods, 1, &comm_cart);

// 获取自己的坐标
int my_coords[2];
MPI_Cart_coords(comm_cart, my_rank, 2, my_coords);

// 计算上下左右邻居
int right, left;
MPI_Cart_shift(comm_cart, 0, 1, &left, &right);  // 水平方向
int up, down;
MPI_Cart_shift(comm_cart, 1, 1, &down, &up);    // 垂直方向

// 进行Jacobi迭代，使用邻居rank通信
```
