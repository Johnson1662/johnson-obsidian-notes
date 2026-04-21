# OpenMP编程

> 📚 本章涵盖：PPT 05 OpenMP
> 
> 🎯 对应考点：名词解释（OpenMP、编译制导语句）、Fork-Join模型、调度策略、数据共享子句

**学习目标**：
1. 理解OpenMP的基本概念和Fork-Join模型
2. 掌握编译制导语句的使用方法
3. 学会使用各种数据共享子句
4. 理解不同的调度策略及其适用场景
5. 能够使用OpenMP实现简单的并行程序

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

| 年份 | 版本 | 主要特性 |
|------|------|----------|
| 1997 | OpenMP Fortran 1.0 | 首个标准，支持Fortran |
| 2000 | OpenMP C/C++ 2.0 | 支持C/C++语言 |
| 2005 | OpenMP 2.5 | 统一Fortran和C/C++标准 |
| 2008 | OpenMP 3.0 | 引入任务（task）概念 |
| 2013 | OpenMP 4.0 | 支持SIMD指令、设备卸载 |
| 2018 | OpenMP 5.0 | 增强的任务依赖、错误处理 |

**通俗解释**：OpenMP就像乐高积木，从最初只能拼简单模型（1997），到现在可以拼复杂结构（2018），功能越来越强大。

### 1.3 OpenMP的特点

**核心特点**：
1. **共享内存模型**：所有线程共享同一内存空间
2. **Fork-Join模型**：主线程派生（Fork）工作线程，完成后合并（Join）
3. **编译制导**：通过特殊注释（`#pragma omp`）指导编译器并行化
4. **增量并行化**：可以逐步将串行代码改为并行代码

**通俗理解**：就像项目经理（主线程）分配任务给团队成员（工作线程），任务完成后团队成员汇报结果。

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
| `OMP_DYNAMIC` | 是否动态调整线程数 | `OMP_DYNAMIC=TRUE` |
| `OMP_NESTED` | 是否允许嵌套并行 | `OMP_NESTED=TRUE` |
| `OMP_PROC_BIND` | 线程绑定到处理器 | `OMP_PROC_BIND=true` |
| `OMP_STACKSIZE` | 线程栈大小 | `OMP_STACKSIZE=10M` |

**通俗解释**：环境变量就像程序启动前的"全局设置"，可以在命令行设置，影响整个程序的并行行为。

**使用示例**：
```bash
# 设置4个线程，使用动态调度
export OMP_NUM_THREADS=4
export OMP_SCHEDULE="dynamic,10"
./my_program

# 或者在一行中设置
OMP_NUM_THREADS=4 OMP_SCHEDULE="dynamic,10" ./my_program
```

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

**调度策略（schedule子句）**：

`schedule(type[, size])` 用于控制循环迭代在多个线程间的分配方式。

| 调度类型 | 说明 | 适用场景 |
|----------|------|----------|
| **static** | 静态分配，编译时确定 | 迭代计算量均匀 |
| **dynamic** | 动态分配，运行时按需领取 | 迭代计算量不均匀 |
| **guided** | 启发式分配，先大后小 | 大量迭代且计算量递减 |
| **runtime** | 运行时通过环境变量确定 | 需要灵活配置 |

**详细解释**：

1. **static调度**（默认）：
   - 不指定size：将迭代平均分配给各线程（N/t个）
   - 指定size：每次分配size个迭代给下一个线程
   - **通俗理解**：就像老师提前把作业本平均分给学生

2. **dynamic调度**：
   - 不指定size：逐个分配迭代给空闲线程
   - 指定size：每次分配size个迭代给空闲线程
   - **通俗理解**：就像学生做完作业后自己去领新的

3. **guided调度**：
   - 开始分配大块迭代，逐渐减小到size
   - 默认size=1，即一直减少到1
   - **通俗理解**：就像先给学生大量作业，然后根据完成情况逐渐减少

**示例**：
```c
// 静态调度，每个线程处理25个迭代
#pragma omp parallel for schedule(static, 25)
for (int i = 0; i < 100; i++) {
    // 线程0: 0-24, 线程1: 25-49, 线程2: 50-74, 线程3: 75-99
}

// 动态调度，每次处理10个迭代
#pragma omp parallel for schedule(dynamic, 10)
for (int i = 0; i < 100; i++) {
    // 空闲线程领取10个迭代，直到所有迭代完成
}

// 启发式调度
#pragma omp parallel for schedule(guided, 5)
for (int i = 0; i < 100; i++) {
    // 开始分配大块，逐渐减小到5
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

### 4.5 高级数据共享概念

**threadprivate指令**：
- 使全局变量在并行域内变成每个线程私有
- 与private的区别：threadprivate变量在多个并行域之间保持值

```c
int counter = 0;
#pragma omp threadprivate(counter)

void inc_counter() {
    counter++;  // 每个线程有自己的counter副本
}
```

**copyin子句**：
- 用主线程的threadprivate变量值初始化所有线程的对应变量

```c
int global = 0;
#pragma omp threadprivate(global)

int main() {
    global = 1000;  // 主线程设置值
    #pragma omp parallel copyin(global)  // 所有线程的global都初始化为1000
    {
        printf("global=%d\n", global);  // 输出1000
    }
}
```

**copyprivate子句**：
- 从一个线程广播私有变量值到其他线程
- 通常与single指令配合使用

```c
int counter = 0;
#pragma omp threadprivate(counter)

#pragma omp parallel
{
    int count;
    #pragma omp single copyprivate(counter)  // 一个线程设置counter，然后广播
    {
        counter = 50;  // 只有single线程执行
    }
    count = increment_counter();  // 所有线程使用广播后的counter值
}
```

**private vs threadprivate对比**：

| 特性 | private | threadprivate |
|------|---------|---------------|
| 作用域 | 单个并行域 | 整个程序 |
| 持久性 | 否 | 是 |
| 初始化 | firstprivate | copyin |
| 适用范围 | 循环变量、临时变量 | 全局状态、计数器 |

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

### 5.3 积分法求π（多种并行化方法）

**串行代码**：
```c
static long num_steps = 100000;
double step;
void main() {
    int i;
    double x, pi, sum = 0.0;
    step = 1.0/(double) num_steps;
    for (i=0; i<num_steps; i++) {
        x = (i+0.5)*step;
        sum = sum + 4.0/(1.0+x*x);
    }
    pi = step * sum;
}
```

**方法1：使用并行域和手动划分**：
```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 4

void main() {
    int i;
    double x, pi, sum[NUM_THREAD];
    step = 1.0/(double) num_steps;
    omp_set_num_threads(NUM_THREAD);
    
    #pragma omp parallel
    {
        double x;
        int id = omp_get_thread_num();
        sum[id] = 0.0;
        
        // 每个线程处理不同的迭代
        for (i=id; i<num_steps; i=i+NUM_THREAD) {
            x = (i+0.5)*step;
            sum[id] += 4.0/(1.0+x*x);
        }
    }
    
    // 合并各线程结果
    for (i=0, pi=0.0; i<NUM_THREAD; i++)
        pi += sum[i] * step;
}
```

**方法2：使用for指令**：
```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 4

void main() {
    int i;
    double x, pi, sum[NUM_THREAD];
    step = 1.0/(double) num_steps;
    omp_set_num_threads(NUM_THREAD);
    
    #pragma omp parallel
    {
        double x;
        int id = omp_get_thread_num();
        sum[id] = 0;
        
        #pragma omp for  // 自动划分循环迭代
        for (i=0; i<num_steps; i++) {
            x = (i+0.5)*step;
            sum[id] += 4.0/(1.0+x*x);
        }
    }
    
    for (i=0, pi=0.0; i<NUM_THREAD; i++)
        pi += sum[i] * step;
}
```

**方法3：使用private和critical**：
```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 4

void main() {
    int i;
    double x, sum, pi = 0.0;
    step = 1.0/(double) num_steps;
    omp_set_num_threads(NUM_THREAD);
    
    #pragma omp parallel private(x, sum)  // x和sum是线程私有的
    {
        int id = omp_get_thread_num();
        sum = 0.0;
        
        for (i=id; i<num_steps; i=i+NUM_THREAD) {
            x = (i+0.5)*step;
            sum += 4.0/(1.0+x*x);
        }
        
        #pragma omp critical  // 临界区保护pi的更新
        pi += sum;
    }
    pi = pi * step;
}
```

**方法4：使用reduction（最简洁）**：
```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREADS 4

void main() {
    int i;
    double x, pi, sum = 0.0;
    step = 1.0/(double) num_steps;
    omp_set_num_threads(NUM_THREADS);
    
    #pragma omp parallel for reduction(+:sum) private(x)
    for (i=0; i<num_steps; i++) {
        x = (i+0.5)*step;
        sum = sum + 4.0/(1.0+x*x);
    }
    pi = step * sum;
}
```

**四种方法对比**：

| 方法 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 并行域+手动划分 | 控制精确 | 代码复杂 | 需要精细控制 |
| for指令 | 简单自动 | 灵活性低 | 规则循环 |
| private+critical | 灵活安全 | 有锁开销 | 不规则计算 |
| reduction | 最简洁 | 功能有限 | 简单归约操作 |

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
5. threadprivate、copyin、copyprivate的区别
6. 积分法求π的多种并行化方法

### ⚠️ 常见考题
- 解释OpenMP的含义（名词解释）
- 画出Fork-Join模型示意图（简答题）
- 写出给定算法的OpenMP并行代码（编程题）
- 比较private和threadprivate的区别（简答题）
- 分析不同并行化方法的优缺点（分析题）

### 📖 参考图示
- Fork-Join模型图 → **PPT 05 第6-7页**
- 编译制导语句示例 → **PPT 05 第10-11页**
- OpenMP发展历程 → **PPT 05 第34-36页**
- 积分法求π示例 → **PPT 05 第795-921页**

### 💡 学习建议
1. **理解模型**：重点理解Fork-Join并行模型
2. **掌握语法**：熟练使用`#pragma omp`指令和各种子句
3. **实践编程**：多写OpenMP程序，从简单到复杂
4. **性能分析**：学会分析并行程序的性能瓶颈

### 🔍 考试重点
1. **名词解释**：OpenMP、编译制导语句、Fork-Join模型
2. **简答题**：比较不同数据共享子句的区别
3. **编程题**：用OpenMP实现数组求和、矩阵乘法等
4. **分析题**：分析并行程序的正确性和性能

---

*整理自：05 OpenMP.pdf (69页)、PPT内容补充、Web搜索补充*
