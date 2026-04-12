# OpenMP编程

> 📚 本章涵盖：PPT 05 OpenMP
> 
> 🎯 对应考点：名词解释（OpenMP、编译制导语句）

---

## 一、OpenMP概述

### 1.1 什么是OpenMP？

**OpenMP（Open Multi-Processing）**：
- 面向**共享内存**的多处理器多线程并行编程语言
- 一种显式制导多线程并行的应用程序编程接口（API）
- 标准诞生于1997年，目前发展到5.0版本
- 官网：www.openmp.org

**特点**：
- 基于**Fork-Join**编程模型
- 使用**编译制导语句**（Pragma）实现并行
- 支持C/C++和Fortran
- 易于学习和使用

### 1.2 OpenMP发展历程

| 年份 | 版本 |
|------|------|
| 1997 | OpenMP Fortran 1.0 |
| 2000 | OpenMP C/C++ 2.0 |
| 2005 | OpenMP 2.5 |
| 2008 | OpenMP 3.0 |
| 2013 | OpenMP 4.0 |
| 2018 | OpenMP 5.0 |

---

## 二、Fork-Join编程模型

### 2.1 模型流程

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

## 三、OpenMP三要素

### 3.1 编译制导语句（Compiler Directive）⭐⭐

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

**示例**：
```c
#include "omp.h"
void main() {
    double Res[1000];
    #pragma omp parallel for
    for(int i=0; i<1000; i++) {
        do_huge_comp(Res[i]);
    }
}
```

### 3.2 运行时库函数

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

### 3.3 环境变量

| 环境变量 | 说明 | 示例 |
|----------|------|------|
| `OMP_NUM_THREADS` | 设置默认线程数 | `export OMP_NUM_THREADS=4` |
| `OMP_SCHEDULE` | 设置循环调度方式 | `OMP_SCHEDULE="dynamic,10"` |

---

## 四、编译制导语句详解

### 4.1 并行域（parallel region）

```c
#pragma omp parallel [clause]
{
    // 并行域中的代码被所有线程执行
}
```

**子句**：
- `private(list)`：私有变量
- `firstprivate(list)`：私有但初始化
- `shared(list)`：共享变量
- `reduction(operator: list)`：归约
- `num_threads(integer)`：线程数

**示例**：
```c
#include <omp.h>
main() {
    int nthreads, tid;
    
    #pragma omp parallel private(tid)
    {
        tid = omp_get_thread_num();
        printf("Hello World from thread = %d\n", tid);
        
        if (tid == 0) {
            nthreads = omp_get_num_threads();
            printf("Number of threads = %d\n", nthreads);
        }
    }
}
```

### 4.2 共享任务结构

**for指令**：
```c
#pragma omp parallel for [clause]
for (int i = 0; i < n; i++) {
    // 循环体被分配到多个线程执行
}
```

**sections指令**：
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

### 4.3 数据域

**变量属性子句**：

| 子句 | 含义 | 初始值 |
|------|------|--------|
| `private` | 每个线程有独立副本 | 未定义 |
| `firstprivate` | 每个线程有独立副本 | 主线程值 |
| `lastprivate` | 最后迭代的值传回主线程 | - |
| `shared` | 所有线程共享同一变量 | - |

### 4.4 同步机制

**critical指令**：
```c
#pragma omp critical [name]
{
    // 临界区代码，互斥执行
}
```

**atomic指令**：
```c
#pragma omp atomic
sum += local_sum;  // 原子加法
```

**barrier指令**：
```c
#pragma omp barrier  // 所有线程在此等待
```

---

## 五、经典示例

### 5.1 数组求和

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

### 5.2 矩阵乘法

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

## 六、名词解释汇总

| 术语 | 英文 | 定义 |
|------|------|------|
| **OpenMP** | Open Multi-Processing | 共享内存并行编程API |
| **编译制导语句** | Compiler Directive | 以#pragma开头的特殊注释，指导编译器并行化 |
| **Fork-Join** | - | 先派生线程执行并行任务，再合并回主线程 |
| **临界区** | Critical Section | 同一时间只能有一个线程执行的代码段 |
| **原子操作** | Atomic Operation | 不可分割的最小操作单元 |
| **同步屏障** | Barrier | 所有线程必须全部到达才能继续执行 |
| **归约** | Reduction | 将多个值合并为一个值的操作 |

---

## 七、复习要点

### ✅ 必须掌握
1. OpenMP的定义和特点
2. Fork-Join模型的工作流程
3. 编译制导语句的基本格式
4. 常用指令和子句的用法

### ⚠️ 常见考题
- 解释OpenMP的含义（名词解释）
- 画出Fork-Join模型示意图（简答题）
- 写出给定算法的OpenMP并行代码（编程题）

### 📖 参考图示
- Fork-Join模型图 → **PPT 05 第6-7页**
- 编译制导语句示例 → **PPT 05 第10-11页**

---

*整理自：05 OpenMP.pdf (69页)*
