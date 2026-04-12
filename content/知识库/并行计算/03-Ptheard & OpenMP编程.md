# OpenMP编程

> 📚 本章涵盖：PPT 03 多线程并行程序设计、PPT 05 OpenMP
> 
> 🎯 对应考点：名词解释（OpenMP、编译制导语句、互斥锁、多线程）

---

## 一、多线程基础概念

### 1.1 进程与线程

**进程（Process）**：
- 程序的一次执行实例
- 拥有独立的内存空间
- 资源分配的基本单位

**线程（Thread）**：
- 进程内的执行单元
- 共享进程的内存空间
- CPU调度的基本单位

**多线程的优势**：
- 共享内存，通信开销小
- 创建和切换开销比进程小
- 适合共享内存并行计算

### 1.2 并行编程挑战

| 问题 | 说明 | 解决方案 |
|------|------|----------|
| **数据竞争** | 多线程同时读写共享数据 | 互斥锁、原子操作 |
| **死锁** | 线程互相等待对方释放锁 | 避免嵌套锁、固定顺序 |
| **负载不均衡** | 各线程工作量不均 | 动态调度 |
| **缓存一致性** | 多核缓存数据不同步 | 缓存一致性协议 |

---

## 二、OpenMP概述

### 2.1 什么是OpenMP？

**OpenMP（Open Multi-Processing）**：
- 面向**共享内存**的多处理器多线程并行编程语言
- 一种显式制导多线程并行的应用程序编程接口（API）
- 标准诞生于1997年，目前发展到5.0版本

**特点**：
- 基于**Fork-Join**编程模型
- 使用**编译制导语句**（Pragma）实现并行
- 支持C/C++和Fortran
- 易于学习和使用

> 📖 **记忆要点**：OpenMP = 共享内存 + 编译制导 + Fork-Join模型

### 2.2 OpenMP发展历程

| 年份 | 版本 |
|------|------|
| 1997 | OpenMP Fortran 1.0 |
| 1998 | OpenMP Fortran 1.1 |
| 2000 | OpenMP C/C++ 2.0 |
| 2005 | OpenMP F/C/C++ 2.5 |
| 2008 | OpenMP 3.0 |
| 2013 | OpenMP 4.0 |
| 2015 | OpenMP 4.5 |
| 2018 | OpenMP 5.0 |

---

## 三、Fork-Join编程模型

### 3.1 模型流程

```
        主线程
           │
           ▼
    ┌──────────────┐
    │   串行代码    │
    └──────────────┘
           │
           ▼  Fork（派生）
    ┌──────────────────────────────────┐
    │  线程0   线程1   线程2   线程3   │  并行域
    │  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
    │  │任务│ │任务│ │任务│ │任务│    │
    │  └────┘ └────┘ └────┘ └────┘    │
    └──────────────────────────────────┘
           │
           ▼  Join（合并）
    ┌──────────────┐
    │   串行代码    │
    └──────────────┘
           │
           ▼
        主线程
```

**流程说明**：
1. 程序开始时只有**主线程**存在
2. 遇到并行域时，**Fork**派生出多个线程
3. 主线程和派生线程**共同执行**并行代码
4. 并行代码结束后，派生线程**Join**合并回主线程
5. 继续执行串行代码

> 🎯 **必考概念**：能画出或解释Fork-Join模型的执行流程

---

## 四、OpenMP三要素

### 4.1 编译制导语句（Compiler Directive）

**基本格式**：
```c
#pragma omp <directive> [clause[[,]clause]...]
```

**核心指令**：

| 指令 | 说明 | 示例 |
|------|------|------|
| `parallel` | 创建并行域 | `#pragma omp parallel` |
| `for` | 并行化for循环 | `#pragma omp parallel for` |
| `sections` | 任务分区 | `#pragma omp sections` |
| `single` | 单线程执行 | `#pragma omp single` |
| `critical` | 临界区 | `#pragma omp critical` |
| `barrier` | 同步屏障 | `#pragma omp barrier` |
| `atomic` | 原子操作 | `#pragma omp atomic` |

**常用子句（Clauses）**：

| 子句 | 说明 | 示例 |
|------|------|------|
| `private` | 变量私有化 | `private(i, sum)` |
| `shared` | 变量共享 | `shared(array)` |
| `firstprivate` | 私有但初始化 | `firstprivate(x)` |
| `reduction` | 归约操作 | `reduction(+:sum)` |
| `num_threads` | 指定线程数 | `num_threads(4)` |

### 4.2 运行时库函数

**常用函数**：

| 函数 | 说明 |
|------|------|
| `omp_get_thread_num()` | 获取当前线程ID |
| `omp_get_num_threads()` | 获取线程总数 |
| `omp_set_num_threads(n)` | 设置线程数 |
| `omp_get_num_procs()` | 获取处理器数 |
| `omp_in_parallel()` | 判断是否在并行域中 |

**使用示例**：
```c
#include <omp.h>
#include <stdio.h>

int main() {
    omp_set_num_threads(4);
    
    #pragma omp parallel
    {
        int tid = omp_get_thread_num();
        int nthreads = omp_get_num_threads();
        printf("Thread %d of %d\n", tid, nthreads);
    }
    return 0;
}
```

### 4.3 环境变量

| 环境变量 | 说明 | 示例 |
|----------|------|------|
| `OMP_NUM_THREADS` | 设置默认线程数 | `export OMP_NUM_THREADS=4` |
| `OMP_SCHEDULE` | 设置循环调度方式 | `OMP_SCHEDULE="dynamic,10"` |
| `OMP_DYNAMIC` | 允许动态调整线程数 | `OMP_DYNAMIC=true` |

---

## 五、编译制导语句详解

### 5.1 并行域（parallel region）

```c
#pragma omp parallel [clause]
{
    // 并行域中的代码被所有线程执行
    // 每个线程执行相同的代码
}
```

**示例**：
```c
#include <omp.h>
main() {
    int nthreads, tid;
    
    #pragma omp parallel private(tid)
    {
        tid = omp_get_thread_num();
        printf("Hello World from thread = %d\n", tid);
        
        #pragma omp barrier  // 同步屏障
        
        if (tid == 0) {
            nthreads = omp_get_num_threads();
            printf("Number of threads = %d\n", nthreads);
        }
    }
}
```

### 5.2 共享任务结构

**for指令**：将循环迭代分配给线程组
```c
#pragma omp parallel for [clause]
for (int i = 0; i < n; i++) {
    // 循环体被分配到多个线程执行
}
```

**sections指令**：将不同任务分配给不同线程
```c
#pragma omp parallel sections
{
    #pragma omp section
    {
        // 任务1
    }
    
    #pragma omp section
    {
        // 任务2
    }
}
```

### 5.3 数据域

**变量属性子句**：

| 子句 | 含义 | 初始值 |
|------|------|--------|
| `private` | 每个线程有独立副本 | 未定义 |
| `firstprivate` | 每个线程有独立副本 | 主线程值 |
| `lastprivate` | 最后迭代的值传回主线程 | - |
| `shared` | 所有线程共享同一变量 | - |

**示例**：
```c
int x = 10;

#pragma omp parallel private(x)
{
    x = omp_get_thread_num();  // x未初始化，直接赋值
}

#pragma omp parallel firstprivate(x)
{
    x = x + omp_get_thread_num();  // x初始值为10
}
```

### 5.4 同步机制

**critical指令**：临界区，同一时间只有一个线程执行
```c
#pragma omp critical [name]
{
    // 临界区代码，互斥执行
}
```

**atomic指令**：原子操作
```c
#pragma omp atomic
sum += local_sum;  // 原子加法
```

**barrier指令**：同步屏障
```c
#pragma omp barrier  // 所有线程在此等待，直到全部到达
```

---

## 六、经典示例

### 6.1 数组求和

```c
#include <omp.h>
#include <stdio.h>

#define N 1000000

int main() {
    int array[N];
    long long sum = 0;
    
    // 初始化数组
    for (int i = 0; i < N; i++) {
        array[i] = i + 1;
    }
    
    // 并行求和
    #pragma omp parallel for reduction(+:sum)
    for (int i = 0; i < N; i++) {
        sum += array[i];
    }
    
    printf("Sum = %lld\n", sum);
    return 0;
}
```

> 📖 **关键点**：使用 `reduction(+:sum)` 实现并行归约

### 6.2 矩阵乘法

```c
#pragma omp parallel for private(i, j, k)
for (i = 0; i < N; i++) {
    for (j = 0; j < N; j++) {
        for (k = 0; k < N; k++) {
            C[i][j] += A[i][k] * B[k][j];
        }
    }
}
```

---

## 七、名词解释汇总

| 术语 | 英文 | 定义 |
|------|------|------|
| **OpenMP** | Open Multi-Processing | 共享内存并行编程API |
| **编译制导语句** | Compiler Directive | 以#pragma开头的特殊注释，指导编译器并行化 |
| **Fork-Join** | - | 先派生线程执行并行任务，再合并回主线程 |
| **互斥锁** | Mutex | 保证同一时间只有一个线程访问共享资源 |
| **临界区** | Critical Section | 同一时间只能有一个线程执行的代码段 |
| **原子操作** | Atomic Operation | 不可分割的最小操作单元 |
| **同步屏障** | Barrier | 所有线程必须全部到达才能继续执行 |
| **归约** | Reduction | 将多个值合并为一个值的操作 |
| **多线程** | Multi-threading | 单进程内多个线程并发执行 |
| **私有变量** | Private Variable | 每个线程独立拥有的变量副本 |

---

## 八、复习要点

### ✅ 必须掌握
1. OpenMP的定义和特点
2. Fork-Join模型的工作流程
3. 编译制导语句的基本格式
4. 常用指令和子句的用法
5. 互斥锁、临界区、原子操作的区别

### ⚠️ 常见考题
- 解释OpenMP的含义（名词解释）
- 画出Fork-Join模型示意图（简答题）
- 写出给定算法的OpenMP并行代码（编程题）
- 比较private/shared/reduction的用法

### 📖 参考图示
- Fork-Join模型图 → **PPT 05 第6-7页**
- 编译制导语句示例 → **PPT 05 第10-11页**
- 同步机制示意 → **PPT 05 第30-40页**

---

## 九、Pthread编程（2026年实验重点！）

### 9.1 Pthread概述

**POSIX Threads（Pthread）**：
- POSIX标准定义的线程API
- C语言实现的多线程编程接口
- 需要 `#include <pthread.h>`

**编译命令**：
```bash
g++ -pthread -o test.o test.cpp
```

### 9.2 Pthread基本API

| 函数                        | 说明     |
| ------------------------- | ------ |
| `pthread_create()`        | 创建线程   |
| `pthread_join()`          | 等待线程结束 |
| `pthread_exit()`          | 退出线程   |
| `pthread_mutex_init()`    | 初始化互斥锁 |
| `pthread_mutex_lock()`    | 加锁     |
| `pthread_mutex_unlock()`  | 解锁     |
| `pthread_mutex_destroy()` | 销毁互斥锁  |

### 9.3 Pthread示例

```c
#include <pthread.h>
#include <stdio.h>

#define NUM_THREADS 4

void* thread_func(void* arg) {
    int tid = *(int*)arg;
    printf("Thread %d is running\n", tid);
    return NULL;
}

int main() {
    pthread_t threads[NUM_THREADS];
    int thread_ids[NUM_THREADS];
    
    // 创建线程
    for (int i = 0; i < NUM_THREADS; i++) {
        thread_ids[i] = i;
        pthread_create(&threads[i], NULL, thread_func, &thread_ids[i]);
    }
    
    // 等待所有线程完成
    for (int i = 0; i < NUM_THREADS; i++) {
        pthread_join(threads[i], NULL);
    }
    
    return 0;
}
```

### 9.4 互斥锁示例

```c
pthread_mutex_t mutex;
int shared_counter = 0;

void* increment(void* arg) {
    for (int i = 0; i < 1000; i++) {
        pthread_mutex_lock(&mutex);
        shared_counter++;  // 临界区
        pthread_mutex_unlock(&mutex);
    }
    return NULL;
}

int main() {
    pthread_mutex_init(&mutex, NULL);
    
    // 创建线程...
    
    pthread_mutex_destroy(&mutex);
    return 0;
}
```

### 9.5 实验一：多线程计算正弦值（2026年）

**泰勒级数展开**：
$$\sin(x) = \sum_{n=0}^{\infty} \frac{(-1)^n x^{2n+1}}{(2n+1)!} = x - \frac{x^3}{3!} + \frac{x^5}{5!} - ...$$

**并行策略**：
- 将展开式各项分配给不同线程
- 每个线程计算部分和
- 最后合并得到最终结果

**编译运行**：
```bash
g++ -pthread -o cal_sin.o cal_sin.cpp
./cal_sin.o 1.57 10000 4  # 弧度=1.57, 项数=10000, 线程数=4
```

### 9.6 实验二：多线程求解稀疏线性方程组（2026年）

**共轭梯度法（CG）**：
- 求解对称正定稀疏线性方程组 $Ax=b$
- 核心计算：SpMV、向量点积、向量更新

**CSR稀疏矩阵格式**：
```c
// 3x3矩阵 A = [3 1 0; 1 4 1; 0 1 5]
values[] = {3.0, 1.0, 1.0, 4.0, 1.0, 1.0, 5.0};  // 非零元素
row_ptr[] = {0, 2, 5, 7};                          // 行偏移
col_idx[] = {0, 1, 0, 1, 2, 1, 2};                 // 列索引
```

**并行策略**：
- 将矩阵行分配给不同线程
- 每个线程计算连续若干行的SpMV
- 点积需要全局规约（使用互斥锁）
- 注意避免假共享

---

*整理自：03 多线程并行程序设计.pdf (79页)、05 OpenMP.pdf (69页)、2026年实验指导书*
