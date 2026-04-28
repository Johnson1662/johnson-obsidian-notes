# Lab2 Pthread多线程并行编程完整教程

## 一、什么是Pthread？

### 1.1 Pthread的基本概念

**Pthread (POSIX Threads)** = POSIX线程标准

想象一个场景：
```
你有一个大任务要完成，比如计算10000行矩阵
- 一个人算：需要很长时间
- 4个人一起算：每人算2500行，快4倍！

Pthread就是让多个"工人"（线程）在同一台机器上协作完成任务的工具
```

### 1.2 线程 vs 进程

| 特性 | 线程（Thread） | 进程（Process） |
|------|---------------|----------------|
| 内存 | 共享同一块内存 | 各自独立的内存 |
| 比喻 | 同一个房间的多个人，共用一张桌子 | 不同房间的多个人 |
| 通信 | 直接访问共享变量 | 需要进程间通信 |
| 创建开销 | 小 | 大 |
| 适用场景 | 单机多核并行计算 | 多任务隔离 |

### 1.3 核心概念

```
线程（Thread）：
  - 程序执行的最小单位
  - 多个线程共享同一个进程的内存空间
  - 可以并行执行不同的任务

共享内存：
  - 所有线程都能访问同一个变量
  - 例如：全局数组 double *x
  - 优点：通信方便
  - 缺点：需要注意数据竞争

线程ID：
  - 每个线程有一个唯一的编号
  - 用于区分不同的线程
  - 例如：线程0, 1, 2, 3
```

---

## 二、Pthread程序的基本结构

### 2.1 最简单的Pthread程序

```cpp
#include <pthread.h>
#include <stdio.h>

// 线程工作函数
void* thread_work(void* arg) {
    int thread_id = *(int*)arg;
    printf("我是线程 %d\n", thread_id);
    return NULL;
}

int main() {
    pthread_t threads[4];  // 线程句柄数组
    int thread_ids[4];     // 线程ID数组
    
    // 创建4个线程
    for (int i = 0; i < 4; i++) {
        thread_ids[i] = i;
        pthread_create(&threads[i],      // 线程句柄
                      NULL,              // 线程属性（默认）
                      thread_work,       // 线程函数
                      &thread_ids[i]);   // 传递给线程的参数
    }
    
    // 等待所有线程完成
    for (int i = 0; i < 4; i++) {
        pthread_join(threads[i], NULL);
    }
    
    printf("所有线程完成！\n");
    return 0;
}
```

**运行结果**：
```
我是线程 0
我是线程 1
我是线程 2
我是线程 3
所有线程完成！
```

**关键点**：
- `pthread_create`: 创建线程
- `pthread_join`: 等待线程结束
- 所有线程执行**同一个函数**，但参数不同

---

## 三、Pthread的核心操作

### 3.1 线程创建和等待

```cpp
pthread_t thread;
int thread_id = 0;

// 创建线程
int ret = pthread_create(&thread,           // 线程句柄
                        NULL,               // 属性（NULL=默认）
                        thread_function,    // 线程函数
                        &thread_id);        // 参数
if (ret != 0) {
    printf("创建线程失败\n");
}

// 等待线程结束
pthread_join(thread, NULL);
```

### 3.2 线程同步：Barrier（屏障）

**作用**：让所有线程在某个点等待，直到所有线程都到达

```cpp
pthread_barrier_t barrier;

// 初始化barrier（4个线程）
pthread_barrier_init(&barrier, NULL, 4);

// 在线程函数中使用
void* thread_work(void* arg) {
    // 第一阶段工作
    printf("线程 %d: 完成第一阶段\n", thread_id);
    
    // 等待所有线程完成第一阶段
    pthread_barrier_wait(&barrier);
    
    // 第二阶段工作（所有线程都到达后才开始）
    printf("线程 %d: 开始第二阶段\n", thread_id);
    
    return NULL;
}

// 销毁barrier
pthread_barrier_destroy(&barrier);
```

**比喻**：
- 4个人一起搬家
- 第一阶段：每人搬自己的东西
- 到达barrier：等所有人都搬完
- 第二阶段：一起搬大件家具

---

## 四、Lab2的问题背景

### 4.1 我们要解决什么问题？

求解**稀疏线性方程组**：**Ax = b**

- **A**: 一个很大的稀疏矩阵（大部分元素是0）
- **x**: 未知向量（我们要求的）
- **b**: 已知向量

### 4.2 什么是共轭梯度法（CG）？

这是一种**迭代算法**，通过不断改进猜测值来逼近真实解。

**核心思想**：
```
1. 从一个初始猜测 x₀ = 0 开始
2. 计算残差（误差）r = b - Ax
3. 沿着某个方向 p 更新 x
4. 重复直到误差足够小
```

### 4.3 CG算法的伪代码

```
初始化：
  x = 0
  r = b - Ax = b  （因为x=0）
  p = r
  rho_old = r^T × r

循环（直到收敛）：
  1. Ap = A × p          ← 矩阵向量乘（最耗时！）
  2. pAp = p^T × Ap      ← 点积
  3. α = rho_old / pAp
  4. x = x + α × p       ← 向量更新
  5. r = r - α × Ap      ← 向量更新
  6. rho_new = r^T × r   ← 点积
  7. 检查是否收敛（||r|| < tol）
  8. β = rho_new / rho_old
  9. p = r + β × p       ← 向量更新
  10. rho_old = rho_new
```

### 4.4 为什么需要并行化？

CG算法中**最耗时的操作**是：
- **SpMV（稀疏矩阵向量乘）**: Ap = A × p
- 这个操作在每次迭代中都要执行
- 矩阵很大时（如100000×100000），计算量巨大

**并行化策略**：
- 把矩阵的行分配给不同的线程
- 每个线程计算自己负责的行
- 理论上可以获得接近线程数的加速比

---

## 五、稀疏矩阵存储格式（CSR）

### 5.1 为什么需要特殊格式？

```
普通存储（密集矩阵）：
  矩阵 A = [1  0  2]
          [0  3  0]
          [4  0  5]
  
  存储：[1, 0, 2, 0, 3, 0, 4, 0, 5]
  问题：浪费大量空间存储0

CSR存储（压缩稀疏行）：
  只存储非零元素！
```

### 5.2 CSR格式详解

```
矩阵 A = [1  0  2]
        [0  3  0]
        [4  0  5]

CSR存储：
  values  = [1, 2, 3, 4, 5]     // 非零元素值
  col_idx = [0, 2, 1, 0, 2]     // 每个元素的列号
  row_ptr = [0, 2, 3, 5]        // 每行的起始位置

解释：
  第0行：values[0:2] = [1, 2]，列号 [0, 2]
  第1行：values[2:3] = [3]，列号 [1]
  第2行：values[3:5] = [4, 5]，列号 [0, 2]
```

### 5.3 CSR格式的矩阵向量乘

```cpp
// y = A × x
void spmv_csr(int n, const int *row_ptr, const int *col_idx, 
              const double *values, const double *x, double *y) {
    for (int i = 0; i < n; i++) {  // 遍历每一行
        double sum = 0.0;
        
        // 遍历第i行的所有非零元素
        for (int j = row_ptr[i]; j < row_ptr[i+1]; j++) {
            sum += values[j] * x[col_idx[j]];
            //     ^^^^^^^^^   ^^^^^^^^^^^^^
            //     矩阵元素值   对应的x向量元素
        }
        
        y[i] = sum;
    }
}
```

**并行化思路**：
- 每个线程负责一部分行
- 例如：4个线程，10000行
  - 线程0: 行 0-2499
  - 线程1: 行 2500-4999
  - 线程2: 行 5000-7499
  - 线程3: 行 7500-9999

---

## 六、Lab2的并行化策略

### 6.1 任务分配（行分块）

```
原始矩阵（10000行）：
┌─────────────┐
│ 行 0        │
│ 行 1        │
│ ...         │
│ 行 9999     │
└─────────────┘

分配策略（4个线程）：
线程0: 行 0    - 2499  (2500行)
线程1: 行 2500 - 4999  (2500行)
线程2: 行 5000 - 7499  (2500行)
线程3: 行 7500 - 9999  (2500行)
```

### 6.2 计算分配范围

```cpp
int n = 10000;           // 总行数
int num_threads = 4;     // 线程数
int thread_id;           // 当前线程编号

// 计算每个线程负责多少行
int rows_per_thread = n / num_threads;  // 10000 / 4 = 2500
int remaining_rows = n % num_threads;   // 10000 % 4 = 0

// 计算我负责的起始和结束行
int start_row = thread_id * rows_per_thread + 
                min(thread_id, remaining_rows);
int end_row = start_row + rows_per_thread + 
              (thread_id < remaining_rows ? 1 : 0);

// 例如：
// thread_id=0: start=0,    end=2500
// thread_id=1: start=2500, end=5000
// thread_id=2: start=5000, end=7500
// thread_id=3: start=7500, end=10000
```

### 6.3 处理除不尽的情况

```cpp
// 如果 n=10001, num_threads=4
// rows_per_thread = 2500
// remaining_rows = 1

// 线程0多分配1行：
// thread_id=0: 2501行 (0-2500)
// thread_id=1: 2500行 (2501-5000)
// thread_id=2: 2500行 (5001-7500)
// thread_id=3: 2500行 (7501-10000)
```



---

## 七、并行CG算法详解

### 7.1 整体架构

```
main()
  │
  ├─ 读取矩阵和向量
  │
  ├─ 初始化全局变量
  │    x = 0, r = b, p = r
  │
  ├─ 创建线程
  │    pthread_create(...)
  │
  ├─ 每个线程执行 cg_thread_work()
  │    │
  │    └─ for (iter = 0; iter < max_iter; iter++)
  │         │
  │         ├─ 1. SpMV: Ap = A×p（局部计算）
  │         ├─ barrier（等待所有线程完成SpMV）
  │         │
  │         ├─ 2. 计算局部pAp
  │         ├─ barrier（等待所有线程完成）
  │         ├─ 主线程汇总pAp，计算α
  │         ├─ barrier（等待主线程完成）
  │         │
  │         ├─ 3. 更新x和r（局部计算）
  │         ├─ barrier（等待所有线程完成）
  │         │
  │         ├─ 4. 计算局部rho_new
  │         ├─ barrier（等待所有线程完成）
  │         ├─ 主线程汇总rho_new，检查收敛，计算β
  │         ├─ barrier（等待主线程完成）
  │         │
  │         ├─ 5. 更新p（局部计算）
  │         └─ barrier（等待所有线程完成）
  │
  └─ 等待所有线程结束
       pthread_join(...)
```

### 7.2 全局共享变量

```cpp
// 矩阵和向量（所有线程共享）
int n;                    // 矩阵维度
double *values;           // 非零元素
int *row_ptr;             // 行偏移
int *col_idx;             // 列索引
double *b;                // 右端向量
double *x;                // 解向量
double *r;                // 残差向量
double *p;                // 搜索方向
double *Ap;               // A*p的结果

// 同步变量
pthread_barrier_t barrier;
double *local_pAp_array;  // 每个线程的局部pAp
double *local_rho_array;  // 每个线程的局部rho
double global_rho_old;    // 上一次迭代的rho值
double shared_alpha;      // 共享的alpha值
double shared_beta;       // 共享的beta值
int converged = 0;        // 收敛标志
```

### 7.3 线程工作函数详解

```cpp
void* cg_thread_work(void *arg) {
    thread_data_t *data = (thread_data_t*)arg;
    int tid = data->thread_id;
    int start = data->start_row;
    int end = data->end_row;
    
    // === 迭代求解 ===
    for (int iter = 0; iter < max_iter; iter++) {
        
        // ========== 步骤1: SpMV（局部计算）==========
        // 每个线程计算自己负责的行
        for (int i = start; i < end; i++) {
            double sum = 0.0;
            for (int j = row_ptr[i]; j < row_ptr[i+1]; j++) {
                sum += values[j] * p[col_idx[j]];
            }
            Ap[i] = sum;
        }
        
        // 等待所有线程完成SpMV
        pthread_barrier_wait(&barrier);
        
        // ========== 步骤2: 计算pAp（局部+归约）==========
        // 每个线程计算局部pAp
        double local_pAp = 0.0;
        for (int i = start; i < end; i++) {
            local_pAp += p[i] * Ap[i];
        }
        local_pAp_array[tid] = local_pAp;
        
        // 等待所有线程完成局部计算
        pthread_barrier_wait(&barrier);
        
        // 主线程汇总并计算alpha
        if (tid == 0) {
            double pAp = 0.0;
            for (int i = 0; i < num_threads; i++) {
                pAp += local_pAp_array[i];
            }
            
            if (fabs(pAp) < 1e-15) {
                converged = -1;  // 异常退出
                shared_alpha = 0.0;
            } else {
                shared_alpha = global_rho_old / pAp;
            }
        }
        
        // 等待主线程完成alpha计算
        pthread_barrier_wait(&barrier);
        
        // 检查异常退出
        if (converged == -1) {
            break;
        }
        
        // ========== 步骤3: 更新x和r（局部计算）==========
        double alpha = shared_alpha;
        for (int i = start; i < end; i++) {
            x[i] += alpha * p[i];
            r[i] -= alpha * Ap[i];
        }
        
        // 等待所有线程完成更新
        pthread_barrier_wait(&barrier);
        
        // ========== 步骤4: 计算rho_new（局部+归约）==========
        double local_rho_new = 0.0;
        for (int i = start; i < end; i++) {
            local_rho_new += r[i] * r[i];
        }
        local_rho_array[tid] = local_rho_new;
        
        // 等待所有线程完成局部计算
        pthread_barrier_wait(&barrier);
        
        // 主线程汇总rho_new并检查收敛
        if (tid == 0) {
            double rho_new = 0.0;
            for (int i = 0; i < num_threads; i++) {
                rho_new += local_rho_array[i];
            }
            
            double res_norm = sqrt(rho_new);
            if (res_norm < tol) {
                printf("迭代%d次后收敛，残差范数：%.6e\n", 
                       iter+1, res_norm);
                converged = 1;
            } else {
                shared_beta = rho_new / global_rho_old;
                global_rho_old = rho_new;
            }
        }
        
        // 等待主线程完成收敛检查
        pthread_barrier_wait(&barrier);
        
        // 检查是否收敛
        if (converged == 1) {
            break;
        }
        
        // ========== 步骤5: 更新p（局部计算）==========
        double beta = shared_beta;
        for (int i = start; i < end; i++) {
            p[i] = r[i] + beta * p[i];
        }
        
        // 等待所有线程完成p更新
        pthread_barrier_wait(&barrier);
    }
    
    return NULL;
}
```

### 7.4 关键技术点

#### 7.4.1 为什么需要这么多Barrier？

```
问题：线程之间需要同步

例如：SpMV计算
  线程0: 计算 Ap[0-2499]
  线程1: 计算 Ap[2500-4999]
  线程2: 计算 Ap[5000-7499]
  线程3: 计算 Ap[7500-9999]

如果没有barrier：
  线程0算完了，开始计算pAp
  但此时线程3还没算完Ap
  线程0读取Ap[7500]时，可能是旧值！

有barrier：
  所有线程都算完Ap后，才开始计算pAp
```

#### 7.4.2 归约操作（Reduction）

```
目标：计算 pAp = p^T × Ap = Σ p[i] * Ap[i]

串行版本：
  double pAp = 0.0;
  for (int i = 0; i < n; i++) {
      pAp += p[i] * Ap[i];
  }

并行版本（两阶段）：
  阶段1：每个线程计算局部和
    线程0: local_pAp[0] = Σ(i=0~2499) p[i]*Ap[i]
    线程1: local_pAp[1] = Σ(i=2500~4999) p[i]*Ap[i]
    线程2: local_pAp[2] = Σ(i=5000~7499) p[i]*Ap[i]
    线程3: local_pAp[3] = Σ(i=7500~9999) p[i]*Ap[i]
  
  阶段2：主线程汇总
    pAp = local_pAp[0] + local_pAp[1] + 
          local_pAp[2] + local_pAp[3]
```

#### 7.4.3 主线程模式

```cpp
// 只有主线程（tid=0）执行某些操作
if (tid == 0) {
    // 汇总所有线程的结果
    double pAp = 0.0;
    for (int i = 0; i < num_threads; i++) {
        pAp += local_pAp_array[i];
    }
    
    // 计算共享变量
    shared_alpha = global_rho_old / pAp;
}

// 所有线程等待主线程完成
pthread_barrier_wait(&barrier);

// 所有线程读取共享变量
double alpha = shared_alpha;
```

---

## 八、完整代码流程

### 8.1 主函数

```cpp
int main(int argc, char *argv[]) {
    // 1. 解析命令行参数
    const char *matrix_file = argv[1];
    const char *vector_file = argv[2];
    num_threads = atoi(argv[3]);
    
    // 2. 读取数据
    read_matrix(matrix_file);
    read_vector(vector_file);
    
    // 3. 初始化
    x = (double*)calloc(n, sizeof(double));  // x = 0
    r = (double*)malloc(n * sizeof(double));
    p = (double*)malloc(n * sizeof(double));
    Ap = (double*)malloc(n * sizeof(double));
    
    for (int i = 0; i < n; i++) {
        r[i] = b[i];  // r = b（因为x=0）
        p[i] = r[i];  // p = r
    }
    
    // 计算初始残差
    global_rho_old = 0.0;
    for (int i = 0; i < n; i++) {
        global_rho_old += r[i] * r[i];
    }
    
    // 4. 初始化同步变量
    pthread_barrier_init(&barrier, NULL, num_threads);
    local_pAp_array = (double*)malloc(num_threads * sizeof(double));
    local_rho_array = (double*)malloc(num_threads * sizeof(double));
    
    // 5. 创建线程
    pthread_t *threads = (pthread_t*)malloc(num_threads * sizeof(pthread_t));
    thread_data_t *thread_data = (thread_data_t*)malloc(
        num_threads * sizeof(thread_data_t));
    
    // 分配行块
    int rows_per_thread = n / num_threads;
    int remaining_rows = n % num_threads;
    int current_row = 0;
    
    for (int i = 0; i < num_threads; i++) {
        thread_data[i].thread_id = i;
        thread_data[i].start_row = current_row;
        thread_data[i].end_row = current_row + rows_per_thread + 
                                 (i < remaining_rows ? 1 : 0);
        current_row = thread_data[i].end_row;
        
        pthread_create(&threads[i], NULL, cg_thread_work, 
                      &thread_data[i]);
    }
    
    // 6. 等待所有线程完成
    for (int i = 0; i < num_threads; i++) {
        pthread_join(threads[i], NULL);
    }
    
    // 7. 验证结果
    double error = verify_solution();
    printf("验证误差 ||Ax-b||: %.6e\n", error);
    
    // 8. 清理
    pthread_barrier_destroy(&barrier);
    free(threads);
    free(thread_data);
    free(local_pAp_array);
    free(local_rho_array);
    free(values);
    free(row_ptr);
    free(col_idx);
    free(b);
    free(x);
    free(r);
    free(p);
    free(Ap);
    
    return 0;
}
```

### 8.2 读取矩阵文件

```cpp
void read_matrix(const char *filename) {
    FILE *fp = fopen(filename, "r");
    if (!fp) {
        printf("无法打开矩阵文件: %s\n", filename);
        exit(1);
    }
    
    int nnz;  // 非零元素个数
    fscanf(fp, "%d %d", &n, &nnz);
    
    // 分配内存
    values = (double*)malloc(nnz * sizeof(double));
    col_idx = (int*)malloc(nnz * sizeof(int));
    row_ptr = (int*)malloc((n + 1) * sizeof(int));
    
    // 读取row_ptr
    for (int i = 0; i <= n; i++) {
        fscanf(fp, "%d", &row_ptr[i]);
    }
    
    // 读取col_idx和values
    for (int i = 0; i < nnz; i++) {
        fscanf(fp, "%d %lf", &col_idx[i], &values[i]);
    }
    
    fclose(fp);
}
```

### 8.3 验证结果

```cpp
double verify_solution() {
    double *Ax = (double*)calloc(n, sizeof(double));
    
    // 计算Ax
    for (int i = 0; i < n; i++) {
        for (int j = row_ptr[i]; j < row_ptr[i+1]; j++) {
            Ax[i] += values[j] * x[col_idx[j]];
        }
    }
    
    // 计算||Ax-b||
    double error = 0.0;
    for (int i = 0; i < n; i++) {
        double diff = Ax[i] - b[i];
        error += diff * diff;
    }
    error = sqrt(error);
    
    free(Ax);
    return error;
}
```

---

## 九、性能分析

### 9.1 理论加速比

```
理想情况：
  1个线程：时间 T
  4个线程：时间 T/4
  加速比 = 4

实际情况：
  4个线程：时间 T/4 + 同步开销
  加速比 < 4
```

### 9.2 影响性能的因素

#### 9.2.1 同步开销

```
每次迭代需要的barrier次数：
  1. SpMV后
  2. 计算pAp后
  3. 计算alpha后
  4. 更新x和r后
  5. 计算rho_new后
  6. 检查收敛后
  7. 更新p后

总共：7次barrier

小矩阵：
  - 计算量小，同步开销占比大
  - 加速比低

大矩阵：
  - 计算量大，同步开销占比小
  - 加速比高
```

#### 9.2.2 负载均衡

```
理想情况：每个线程工作量相同
  线程0: ████████
  线程1: ████████
  线程2: ████████
  线程3: ████████

不均衡情况：
  线程0: ████████
  线程1: ██████
  线程2: ████████████
  线程3: ████
  
  问题：线程2成为瓶颈
```

**Lab2的负载均衡**：
- 行分块策略：每个线程负责连续的行
- 对于稀疏矩阵，不同行的非零元素数量可能不同
- 可能导致轻微的负载不均衡

#### 9.2.3 缓存效应

```
好的访问模式（连续访问）：
  线程0访问：x[0], x[1], x[2], ...
  线程1访问：x[2500], x[2501], x[2502], ...
  
  优点：缓存命中率高

坏的访问模式（随机访问）：
  访问：x[100], x[5000], x[200], x[8000], ...
  
  缺点：缓存命中率低
```

**Lab2的访问模式**：
- SpMV中访问col_idx[j]对应的x元素
- 对于稀疏矩阵，可能是随机访问
- 缓存效率取决于矩阵的稀疏模式

### 9.3 实验结果分析

```
预期结果（基于实际实验）：

矩阵规模 1000×1000：
  - 加速比 < 1（线程开销大于收益）
  - 不建议使用多线程

矩阵规模 5000×5000：
  - 加速比约2x（开始有效）
  - 4线程时效果较好

矩阵规模 10000×10000：
  - 加速比约4x（较好）
  - 8线程时效果较好

矩阵规模 50000×50000：
  - 加速比约4x（良好）
  - 16线程时效果较好

矩阵规模 100000×100000：
  - 加速比约13x（优秀）
  - 32线程时效果最好
```



---

## 十、编译和运行

### 10.1 编译

```bash
# 使用g++编译，链接pthread库
g++ -pthread -o sparse.o sparse.cpp

# 或者使用优化选项
g++ -pthread -O3 -o sparse.o sparse.cpp
```

**编译选项说明**：
- `-pthread`: 链接pthread库
- `-O3`: 开启最高级别优化
- `-o sparse.o`: 指定输出文件名

### 10.2 本地运行

```bash
# 运行程序
./sparse.o matrix.txt vector.txt 4
#          ^^^^^^^^^^ ^^^^^^^^^^^ ^
#          矩阵文件   向量文件    线程数

# 示例输出：
# 读取数据...
# 矩阵维度: 10000, 线程数: 4
# 开始求解...
# 迭代156次后收敛，残差范数：9.876543e-11
# 求解完成！
# 计算时间: 1.234567 秒
# 验证误差 ||Ax-b||: 1.234567e-10
```

### 10.3 通过PBS提交（集群）

```bash
# 提交任务
qsub -v MATRIX=matrix.txt,VECTOR=vector.txt,THREADS=4,OUTPUT=result.log sparse.pbs

# 查看任务状态
qstat -u $USER

# 查看结果
cat result.log
```

### 10.4 PBS脚本

```bash
#!/bin/bash
#PBS -N sparse
#PBS -l nodes=1:ppn=32
#PBS -j oe

cd $PBS_O_WORKDIR

# 运行程序并记录时间
{ time ./sparse.o ${MATRIX} ${VECTOR} ${THREADS} ; } 2>&1 > ${OUTPUT}
```

---

## 十一、使用方法

### 方式1: 使用脚本（推荐）

```bash
# 1. 上传代码到服务器
scp -r sparse.cpp generate_test_data.cpp sparse.pbs run_experiment.sh pc-lab:~/Lab2/

# 2. 登录服务器
ssh pc-lab

# 3. 运行实验
cd ~/Lab2
bash run_experiment.sh small    # 小规模测试
# 或
bash run_experiment.sh large    # 大规模测试
# 或
bash run_experiment.sh all      # 全部规模

# 4. 等待完成后分析结果
python3 analyze_all_results.py results

# 5. 下载报告（在本地）
scp pc-lab:~/Lab2/results/*.txt ./
scp pc-lab:~/Lab2/results/*.png ./
```

### 方式2: 使用Windows控制脚本

```powershell
# 上传并启动实验
.\lab2_control.ps1 -Action upload -Scale small

# 检查实验状态
.\lab2_control.ps1 -Action check

# 下载结果
.\lab2_control.ps1 -Action download -Scale small

# 分析结果
.\lab2_control.ps1 -Action analyze -Scale small
```

### 方式3: 手动运行

```bash
# 1. 编译
g++ -pthread -O3 -o sparse.o sparse.cpp

# 2. 准备数据（如果没有）
g++ -o generate_test_data.o generate_test_data.cpp
./generate_test_data.o 10000 0.01 matrix_10000.txt vector_10000.txt

# 3. 提交任务
qsub -v MATRIX=matrix_10000.txt,VECTOR=vector_10000.txt,THREADS=4,OUTPUT=result.log sparse.pbs

# 4. 查看状态
qstat -u $USER

# 5. 查看结果
cat result.log
```

---

## 十二、调试技巧

### 12.1 打印调试信息

```cpp
// 在线程函数中打印
void* cg_thread_work(void *arg) {
    int tid = data->thread_id;
    int start = data->start_row;
    int end = data->end_row;
    
    // 打印线程信息
    printf("[线程%d] 负责行 %d-%d\n", tid, start, end-1);
    fflush(stdout);  // 立即输出
    
    // 在关键位置打印
    for (int iter = 0; iter < max_iter; iter++) {
        if (tid == 0 && iter % 10 == 0) {
            printf("[迭代%d] 进行中...\n", iter);
        }
        // ...
    }
}
```

### 12.2 检查数据分配

```cpp
// 在主函数中检查
printf("线程分配情况：\n");
for (int i = 0; i < num_threads; i++) {
    printf("  线程%d: 行 %d-%d (%d行)\n", 
           i, 
           thread_data[i].start_row, 
           thread_data[i].end_row - 1,
           thread_data[i].end_row - thread_data[i].start_row);
}
```

### 12.3 常见错误

**错误1：忘记初始化barrier**
```cpp
// ❌ 错误：没有初始化
pthread_barrier_wait(&barrier);  // 会崩溃

// ✅ 正确：先初始化
pthread_barrier_init(&barrier, NULL, num_threads);
pthread_barrier_wait(&barrier);
```

**错误2：barrier数量不匹配**
```cpp
// ❌ 错误：线程数和barrier数量不一致
pthread_barrier_init(&barrier, NULL, 4);  // 初始化为4
// 但实际创建了8个线程
// 结果：死锁

// ✅ 正确：数量一致
pthread_barrier_init(&barrier, NULL, num_threads);
```

**错误3：数据竞争**
```cpp
// ❌ 错误：多个线程同时写同一个变量
double global_sum = 0.0;
// 线程函数中：
global_sum += local_sum;  // 数据竞争！

// ✅ 正确：每个线程写自己的位置
local_sum_array[tid] = local_sum;
// 主线程汇总
if (tid == 0) {
    for (int i = 0; i < num_threads; i++) {
        global_sum += local_sum_array[i];
    }
}
```

**错误4：忘记等待线程结束**
```cpp
// ❌ 错误：没有join
for (int i = 0; i < num_threads; i++) {
    pthread_create(&threads[i], ...);
}
// 直接退出，线程还在运行

// ✅ 正确：等待所有线程
for (int i = 0; i < num_threads; i++) {
    pthread_create(&threads[i], ...);
}
for (int i = 0; i < num_threads; i++) {
    pthread_join(threads[i], NULL);
}
```

---

## 十三、与Lab3/Lab4的对比

| 特性 | Lab2 (pthread) | Lab3 (MPI) | Lab4 (GPU) |
|------|----------------|------------|------------|
| **并行模型** | 共享内存多线程 | 分布式内存多进程 | 大规模数据并行 |
| **线程/进程数** | 1-32 | 1-32 | 数千到数万 |
| **内存访问** | 直接访问共享变量 | 通过消息传递 | GPU显存 |
| **通信方式** | 无需通信（共享内存） | MPI消息传递 | CPU-GPU传输 |
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

// 线程函数中直接访问
void* thread_work(void* arg) {
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

## 十四、实验参数

### 矩阵规模
- **small**: 1000, 5000, 10000
- **large**: 50000, 100000
- **all**: 1000, 5000, 10000, 50000, 100000

### 线程数
- 1, 2, 4, 8, 16, 32

### 重复次数
- 每个配置重复10次

### 稀疏度
- 0.01（1%的元素非零）

---

## 十五、文件结构

```
第二次实验/
├── sparse.cpp                  # Pthread并行版本
├── generate_test_data.cpp      # 测试数据生成器
├── sparse.pbs                  # PBS作业脚本
├── run_experiment.sh           # 实验运行脚本
├── lab2_control.ps1            # Windows控制脚本
├── analyze_all_results.py      # 结果分析脚本
├── results/                    # 实验结果目录
└── README.md                   # 本教程
```

---

## 十六、故障排查

### 编译错误

```bash
# 错误：找不到pthread库
# 解决：添加-pthread选项
g++ -pthread sparse.cpp -o sparse.o

# 错误：未定义的引用
# 解决：确保链接了pthread库
g++ sparse.cpp -o sparse.o -lpthread
```

### 运行错误

```bash
# 错误：段错误（Segmentation fault）
# 可能原因：
1. 数组越界
2. 空指针访问
3. barrier未初始化

# 调试方法：
gdb ./sparse.o
run matrix.txt vector.txt 4
bt  # 查看堆栈
```

### 性能异常

```bash
# 问题：加速比很低
# 检查：
1. 矩阵是否太小（同步开销大）
2. 线程数是否太多（负载不均衡）
3. 是否有线程卡住（死锁）

# 问题：结果不正确
# 检查：
1. 数据分配是否正确
2. 是否有数据竞争
3. barrier是否正确使用
```

---

## 十七、学习建议

### 从简单到复杂

1. **第一步**：理解Pthread基本概念
   - 运行简单的Hello World程序
   - 理解线程创建和等待

2. **第二步**：学习线程同步
   - 实现简单的barrier
   - 理解为什么需要同步

3. **第三步**：理解数据分配
   - 实现简单的数组分块
   - 理解行分块策略

4. **第四步**：完整的并行算法
   - 理解Lab2的CG算法
   - 分析同步和计算的平衡

### 调试建议

1. **先用少量线程测试**（如2个线程）
2. **打印中间结果验证正确性**
3. **逐步增加线程数观察性能**
4. **对比串行版本验证结果**

---

## 十八、参考资料

- Pthread编程指南
- 实验指导书第二章
- AGENTS.md中的实验经验总结
- 共轭梯度法数学原理.md

---

## 十九、常见问题（FAQ）

### Q1: 为什么小矩阵的加速比很低？

A: 小矩阵的计算量小，线程创建和同步的开销占比大，导致加速比低。建议使用大矩阵测试。

### Q2: 如何选择合适的线程数？

A: 一般选择与CPU核心数相同或略多的线程数。例如：
- 4核CPU：使用4-8线程
- 8核CPU：使用8-16线程
- 32核CPU：使用16-32线程

### Q3: 为什么需要这么多barrier？

A: CG算法中有多个依赖关系，必须确保前一步完成后才能进行下一步。例如：
- 必须等所有线程完成SpMV后，才能计算pAp
- 必须等主线程计算完alpha后，才能更新x和r

### Q4: 如何验证结果的正确性？

A: 计算||Ax-b||的范数，应该接近0（如1e-10）。如果误差很大，说明求解不正确。

### Q5: 为什么实际加速比达不到理论值？

A: 主要原因：
1. 同步开销（barrier）
2. 负载不均衡
3. 缓存效应
4. 内存带宽限制

### Q6: 如何提高性能？

A: 可以尝试：
1. 使用更大的矩阵（减少同步开销占比）
2. 优化数据分配策略（提高负载均衡）
3. 使用编译器优化选项（-O3）
4. 减少不必要的同步点

---

## 二十、总结

Lab2通过Pthread实现了共轭梯度法的并行化，主要学习内容：

1. **Pthread基础**：线程创建、等待、同步
2. **并行策略**：行分块、归约操作
3. **性能分析**：加速比、负载均衡、同步开销
4. **调试技巧**：打印调试、错误排查

**核心思想**：
- 把大任务分解成小任务
- 多个线程并行执行小任务
- 通过barrier同步线程
- 主线程汇总结果

**下一步**：
- Lab3学习MPI分布式并行
- Lab4学习GPU大规模并行

祝实验顺利！🎉
