# OpenMP并行编程

> [!tip] 本章重点
> 掌握**OpenMP**的基本概念、**Fork-Join模型**、**编译制导语句**和**常用子句**，能够编写简单的OpenMP程序。

## 📑 目录

1. [OpenMP概述](#openmp概述)
2. [Fork-Join编程模型](#fork-join编程模型)
3. [编译制导语句](#编译制导语句)
4. [数据共享属性](#数据共享属性)
5. [同步机制](#同步机制)
6. [运行时库函数与环境变量](#运行时库函数与环境变量)
7. [实例：计算π值](#实例计算π值)

---

## OpenMP概述

### 什么是OpenMP？

**OpenMP**（Open Multi-Processing）是一种面向**共享内存**以及**分布式共享内存**的多处理器多线程并行编程语言。

**核心特点**：
- **API标准**：应用程序编程接口
- **编译制导**：通过特殊注释指导编译器
- **共享内存**：适用于共享内存系统
- **易于使用**：相对MPI更简单

**发展历程**：
- 1997年：OpenMP标准诞生
- 目前：已发展到OpenMP 5.0版本
- 官网：www.openmp.org

### OpenMP与MPI对比

| 特性 | OpenMP | MPI |
|------|--------|-----|
| **内存模型** | 共享内存 | 分布式内存 |
| **编程复杂度** | 相对简单 | 相对复杂 |
| **通信方式** | 直接内存访问 | 显式消息传递 |
| **适用系统** | 多核CPU | 集群系统 |
| **扩展性** | 有限 | 良好 |

---

## Fork-Join编程模型

### 模型概述

![Fork-Join模型](assets/openmp_fork_join.jpg)

**执行流程**：
1. **开始**：只有主线程存在
2. **Fork**：遇到并行区域，派生线程执行并行任务
3. **并行执行**：主线程和派生线程共同工作
4. **Join**：并行代码结束，派生线程退出或挂起，控制回到主线程

**通俗理解**：就像项目经理（主线程）分配任务给团队成员（派生线程），完成后团队成员汇报结果。

### 三种实现方式

1. **编译制导语句**：特殊注释指导编译器
2. **运行时库函数**：提供运行时控制功能
3. **环境变量**：配置运行环境

---

## 编译制导语句

### 基本语法

```c
#pragma omp <directive> [clause[ [,] clause]…]
```

**说明**：
- `#pragma omp`：OpenMP编译制导前缀
- `<directive>`：制导指令
- `[clause]`：可选子句

### 1. 并行域（parallel region）

![并行域示意图](assets/openmp_parallel_region.jpg)

**语法**：
```c
#pragma omp parallel [clause[[,]clause]…]
{
    // 并行执行的代码
}
```

**可选子句**：
- `if(scalar-expression)`：条件执行
- `private(list)`：私有变量
- `firstprivate(list)`：带初始化的私有变量
- `default(shared | none)`：默认数据共享属性
- `shared(list)`：共享变量
- `num_threads(integer-expression)`：指定线程数

**示例**：
```c
#include <omp.h>

int main() {
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
    return 0;
}
```

### 2. 共享任务结构

#### for制导语句

**语法**：
```c
#pragma omp for [clause[[,]clause]…]
for (int i = 0; i < N; i++) {
    // 循环体
}
```

**schedule子句**：
```c
schedule(type [,chunk])
```

| 类型 | 说明 | 示例 |
|------|------|------|
| `static` | 静态分配，循环被分成大小为chunk的块 | `schedule(static, 10)` |
| `dynamic` | 动态分配，循环被动态划分为大小为chunk的块 | `schedule(dynamic, 5)` |

**示例**：
```c
#include <omp.h>
#define CHUNKSIZE 100
#define N 1000

int main() {
    int i, chunk;
    float a[N], b[N], c[N];
    
    // 初始化
    for (i = 0; i < N; i++) {
        a[i] = b[i] = i * 1.0;
    }
    chunk = CHUNKSIZE;
    
    #pragma omp parallel shared(a,b,c,chunk) private(i)
    {
        #pragma omp for schedule(dynamic,chunk) nowait
        for (i = 0; i < N; i++) {
            c[i] = a[i] + b[i];
        }
    }
    return 0;
}
```

#### sections制导语句

**语法**：
```c
#pragma omp sections [clause[.,]clause]...]
{
    #pragma omp section
    {
        // 代码块1
    }
    
    #pragma omp section
    {
        // 代码块2
    }
}
```

**说明**：不同的section由不同的线程执行。

#### single制导语句

**语法**：
```c
#pragma omp single [clause[[,]clause]…]
{
    // 只有单个线程执行的代码
}
```

**说明**：指定内部代码只有线程组中的一个线程执行。

#### parallel for和parallel sections

**简化写法**：
```c
// parallel for = parallel + for
#pragma omp parallel for
for (int i = 0; i < N; i++) {
    // 循环体
}

// parallel sections = parallel + sections
#pragma omp parallel sections
{
    #pragma omp section
    { /* 代码块1 */ }
    
    #pragma omp section
    { /* 代码块2 */ }
}
```

---

## 数据共享属性

### 数据作用域

| 子句 | 作用 | 说明 |
|------|------|------|
| `private` | 每个线程私有 | 未初始化，线程结束后值丢失 |
| `shared` | 所有线程共享 | 需要注意数据竞争 |
| `firstprivate` | 私有且初始化 | 从主线程拷贝初始值 |
| `lastprivate` | 私有且保留最后值 | 从最后一次迭代拷贝值 |
| `default` | 设置默认属性 | `shared`或`none` |

### private子句

**示例**：
```c
#include <stdio.h>

int main() {
    int i, x = 100;
    
    #pragma omp parallel for private(x)
    for (i = 0; i < 8; i++) {
        x += i;
        printf("x = %d\n", x);
    }
    
    printf("global x = %d\n", x);  // 输出：global x = 100
    return 1;
}
```

**说明**：每个线程有自己的x副本，主线程的x不受影响。

### firstprivate子句

**示例**：
```c
#include <stdio.h>

int main() {
    int i, x = 100;
    
    #pragma omp parallel for firstprivate(x)
    for (i = 0; i < 8; i++) {
        x += i;
        printf("x = %d\n", x);
    }
    
    printf("global x = %d\n", x);  // 输出：global x = 100
    return 1;
}
```

**说明**：每个线程的x初始化为100（主线程的值）。

### lastprivate子句

**示例**：
```c
#include <stdio.h>

int main() {
    int i, x = 100;
    
    #pragma omp parallel for firstprivate(x) lastprivate(x)
    for (i = 0; i < 8; i++) {
        x += i;
        printf("x = %d\n", x);
    }
    
    printf("global x = %d\n", x);  // 输出：global x = 113（最后一次迭代的值）
    return 1;
}
```

### reduction子句

**语法**：
```c
reduction(operator: list)
```

**常用操作符**：
- `+`：加法
- `-`：减法
- `*`：乘法
- `&`：按位与
- `|`：按位或
- `^`：按位异或

**示例**：
```c
#include <omp.h>

int main() {
    int i, n = 100, chunk = 10;
    float a[100], b[100], result = 0.0;
    
    // 初始化
    for (i = 0; i < n; i++) {
        a[i] = i * 1.0;
        b[i] = i * 2.0;
    }
    
    #pragma omp parallel for default(shared) private(i) \
            schedule(static,chunk) reduction(+:result)
    for (i = 0; i < n; i++) {
        result = result + (a[i] * b[i]);
    }
    
    printf("Final result = %f\n", result);
    return 0;
}
```

### threadprivate子句

**语法**：
```c
#pragma omp threadprivate (list)
```

**说明**：使全局文件作用域的变量在并行域内变成每个线程私有。

**与private的区别**：

| 特性 | private | threadprivate |
|------|---------|---------------|
| **数据类型** | 变量 | 变量 |
| **位置** | 域的开始或共享任务单元 | 块或整个文件区域 |
| **持久性** | 否 | 是 |
| **初始化** | 使用firstprivate | 使用copyin |

### copyin子句

**语法**：
```c
copyin(list)
```

**说明**：为线程组中所有线程的threadprivate变量赋相同的值。

**示例**：
```c
#include <omp.h>

int global = 0;
#pragma omp threadprivate(global)

int main() {
    global = 1000;
    
    #pragma omp parallel copyin(global)
    {
        printf("global = %d\n", global);  // 所有线程输出1000
        global = omp_get_thread_num();
    }
    
    printf("global = %d\n", global);  // 主线程输出0
    return 0;
}
```

---

## 同步机制

### 1. master制导语句

**语法**：
```c
#pragma omp master
{
    // 只有主线程执行的代码
}
```

### 2. critical制导语句

**语法**：
```c
#pragma omp critical [name]
{
    // 临界区代码，一次只能一个线程执行
}
```

**示例**：
```c
#include <omp.h>

int deque(float *a);
void work(int i, float *a);

void a16(float *x, float *y) {
    int ix_next, iy_next;
    
    #pragma omp parallel shared(x,y) private(ix_next, iy_next)
    {
        #pragma omp critical (xaxis)
        {
            ix_next = deque(x);
            work(ix_next, x);
        }
        
        #pragma omp critical (yaxis)
        {
            iy_next = deque(y);
            work(iy_next, y);
        }
    }
}
```

### 3. barrier制导语句

**语法**：
```c
#pragma omp barrier
```

**说明**：同步一个线程组中所有的线程，先到达的线程在此阻塞。

### 4. atomic制导语句

**语法**：
```c
#pragma omp atomic
x binop= expr
// 或
x++, ++x, x--, --x
```

**示例**：
```c
#include <iostream>
#include <omp.h>

int main() {
    int sum = 0;
    
    std::cout << "Before: " << sum << std::endl;
    
    #pragma omp parallel for
    for (int i = 0; i < 20000; i++) {
        #pragma omp atomic
        sum++;
    }
    
    std::cout << "After: " << sum << std::endl;  // 输出20000
    return 0;
}
```

### 5. flush制导语句

**语法**：
```c
#pragma omp flush (list)
```

**说明**：标识一个同步点，确保所有线程看到一致的存储器视图。

### 6. ordered制导语句

**语法**：
```c
#pragma omp ordered
{
    // 按循环次序执行的代码
}
```

**说明**：指出其所包含循环的执行按循环次序进行。

---

## 运行时库函数与环境变量

### 常用库函数

| 函数 | 功能 |
|------|------|
| `omp_get_thread_num()` | 获取当前线程编号 |
| `omp_get_num_threads()` | 获取线程总数 |
| `omp_set_num_threads(n)` | 设置线程数 |
| `omp_get_num_procs()` | 获取处理器数量 |
| `omp_in_parallel()` | 判断是否在并行区域 |

### 环境变量

| 变量 | 功能 |
|------|------|
| `OMP_SCHEDULE` | 线程调度类型 |
| `OMP_NUM_THREADS` | 执行中最大的线程数 |
| `OMP_DYNAMIC` | 是否动态设定线程数 |
| `OMP_NESTED` | 是否可以并行嵌套 |

---

## 实例：计算π值

### 问题描述

使用矩形法则的数值积分方法估算π值：

$$
\pi = \int_0^1 \frac{4}{1 + x^2} dx \approx \frac{1}{N} \sum_{i=1}^{N} f\left(\frac{i - 0.5}{N}\right)
$$

### 串行代码

```c
static long num_steps = 100000;
double step;

void main() {
    int i;
    double x, pi, sum = 0.0;
    
    step = 1.0 / (double)num_steps;
    
    for (i = 0; i < num_steps; i++) {
        x = (i + 0.5) * step;
        sum = sum + 4.0 / (1.0 + x * x);
    }
    
    pi = step * sum;
}
```

### 并行化版本1：使用并行域

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 2

void main() {
    int i;
    double x, pi, sum[NUM_THREAD];
    
    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREAD);
    
    #pragma omp parallel
    {
        double x;
        int id = omp_get_thread_num();
        
        for (i = id, sum[id] = 0.0; i < num_steps; i = i + NUM_THREAD) {
            x = (i + 0.5) * step;
            sum[id] += 4.0 / (1.0 + x * x);
        }
    }
    
    for (i = 0, pi = 0.0; i < NUM_THREAD; i++) {
        pi += sum[i] * step;
    }
}
```

### 并行化版本2：使用共享任务结构

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 2

void main() {
    int i;
    double x, pi, sum[NUM_THREAD];
    
    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREAD);
    
    #pragma omp parallel
    {
        double x;
        int id = omp_get_thread_num();
        sum[id] = 0;
        
        #pragma omp for
        for (i = 0; i < num_steps; i++) {
            x = (i + 0.5) * step;
            sum[id] += 4.0 / (1.0 + x * x);
        }
    }
    
    for (i = 0, pi = 0.0; i < NUM_THREAD; i++) {
        pi += sum[i] * step;
    }
}
```

### 并行化版本3：使用private和critical

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 2

void main() {
    int i;
    double x, sum, pi = 0.0;
    
    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREAD);
    
    #pragma omp parallel private(x, sum)
    {
        int id = omp_get_thread_num();
        sum = 0.0;
        
        for (i = id; i < num_steps; i = i + NUM_THREAD) {
            x = (i + 0.5) * step;
            sum += 4.0 / (1.0 + x * x);
        }
        
        #pragma omp critical
        pi += sum;
    }
}
```

### 并行化版本4：使用reduction（推荐）

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREADS 2

void main() {
    int i;
    double x, pi, sum = 0.0;
    
    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREADS);
    
    #pragma omp parallel for reduction(+:sum) private(x)
    for (i = 0; i < num_steps; i++) {
        x = (i + 0.5) * step;
        sum = sum + 4.0 / (1.0 + x * x);
    }
    
    pi = step * sum;
}
```

**优势**：代码简洁，性能良好，避免手动管理共享变量。

---

## 📝 实验与练习

### 实验1：Hello World

编写一个OpenMP程序，让每个线程输出"Hello World from thread X"，并统计线程总数。

### 实验2：向量加法

使用OpenMP并行化向量加法：`c[i] = a[i] + b[i]`，比较不同schedule策略的性能。

### 实验3：矩阵乘法

实现并行化的矩阵乘法，分析加速比和效率。

### 思考题

1. private、firstprivate、lastprivate有什么区别？
2. reduction子句是如何实现归约的？
3. 在什么情况下应该使用critical，什么情况下使用atomic？
4. 如何避免数据竞争？

---

> [!note] 关键术语
> - **Fork-Join模型**：主线程派生工作线程，完成后合并
> - **编译制导语句**：以`#pragma omp`开头的特殊注释
> - **数据共享属性**：private、shared、firstprivate等
> - **同步机制**：critical、barrier、atomic等
> - **归约操作**：reduction子句实现并行归约