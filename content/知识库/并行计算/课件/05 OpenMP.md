# OpenMP

## OpenMP 概述

OpenMP 是一种面向共享内存以及分布式共享内存的多处理器多线程并行编程语言，是一种用于显式制导多线程、共享内存并行的应用程序编程接口（API）。

- 标准诞生于1997年，目前最新版本为 OpenMP 5.0
- 官网：www.openmp.org

### 编程模型：Fork-Join

- 开始时只有主线程存在
- 遇到并行计算时，主线程派生（Fork）线程执行并行任务
- 并行执行时，主线程和派生线程共同工作
- 并行代码结束后，派生线程退出或挂起，控制回到主线程（Join）

### OpenMP 实现组成

- 编译制导语句（Compiler Directive）
- 运行时库函数
- 环境变量

---

## 编译制导语句

格式：`#pragma omp <directive> [clause[, clause]...]`

在 C/C++ 中，用 `#pragma omp` 标识并行程序块；普通编译器会将其当作普通注释忽略。

### 并行域（Parallel Region）

并行域中的代码被所有线程执行。

```c
#pragma omp parallel [clause...]
// clause: if(scalar-expression), private(list), firstprivate(list),
//         default(shared|none), shared(list), copyin(list),
//         reduction(operator: list), num_threads(integer-expression)
```

**示例**：

```c
#include <omp.h>

int main() {
    int nthreads, tid;

    #pragma omp parallel private(tid) {
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

---

### 共享任务结构

将代码划分给线程组各成员执行，包括：并行 for、并行 sections、single 等。

#### for 编译制导语句

指定紧随的循环由线程组并行执行。

```c
#pragma omp for [clause...]
// clause: schedule(type[,chunk]), ordered, private(list),
//         firstprivate(list), lastprivate(list), shared(list),
//         reduction(operator: list), nowait
```

**schedule 参数**：

| type    | 说明                                              |
| ------- | ------------------------------------------------- |
| static  | 循环被分成大小为 chunk 的块，静态分配给线程       |
| dynamic | 循环被动态划分为大小为 chunk 的块，动态分配给线程 |

chunk 为每个线程分配的计算量；未指定时迭代尽可能平均分配。

**示例**：

```c
#include <omp.h>
#define CHUNKSIZE 100
#define N 1000

int main() {
    int i, chunk;
    float a[N], b[N], c[N];

    for (i = 0; i < N; i++)
        a[i] = b[i] = i * 1.0;
    chunk = CHUNKSIZE;

    #pragma omp parallel shared(a,b,c,chunk) private(i) {
        #pragma omp for schedule(dynamic, chunk) nowait
        for (i = 0; i < N; i++)
            c[i] = a[i] + b[i];
    }
    return 0;
}
```

#### sections 编译制导语句

指定内部代码划分给各线程，不同 section 由不同线程执行。

```c
#pragma omp sections [clause...] {
    [#pragma omp section]
    ...
    [#pragma omp section]
    ...
}
// clause: private(list), firstprivate(list), lastprivate(list),
//         reduction(operator: list), nowait
```

**示例**：

```c
#include <omp.h>
#define N 1000

int main() {
    int i;
    float a[N], b[N], c[N], d[N];

    #pragma omp parallel shared(a,b,c,d) private(i) {
        #pragma omp sections nowait {
            #pragma omp section
            for (i = 0; i < N; i++)
                c[i] = a[i] + b[i];

            #pragma omp section
            for (i = 0; i < N; i++)
                d[i] = a[i] * b[i];
        }
    }
    return 0;
}
```

#### single 编译制导语句

指定内部代码只有线程组中的一个线程执行。

```c
#pragma omp single [clause...]
// clause: private(list), firstprivate(list), nowait
```

**示例**：

```c
#include <stdio.h>

void work1() { /* ... */ }
void work2() { /* ... */ }

void a12() {
    #pragma omp parallel {
        #pragma omp single
        { printf("Beginning work1.\n"); work1(); }

        #pragma omp single
        { printf("Finishing work1.\n"); }

        #pragma omp single nowait
        { printf("Finished work1 and beginning work2.\n"); work2(); }
    }
}
```

#### parallel for / parallel sections

- `parallel for`：并行域包含独立的 for 语句
- `parallel sections`：并行域包含单独的 sections 语句

---

### 同步制导语句

#### master 语句

指定代码段只有主线程执行。

```c
#pragma omp master
```

#### critical 语句

临界区代码一次只能一个线程执行，其他线程阻塞。

```c
#pragma omp critical [name]
```

#### barrier 语句

同步线程组中所有线程，先到达的阻塞等待。

```c
#pragma omp barrier
```

#### atomic 语句

指定特定存储单元被原子更新。

支持的格式：

- `x binop = expr`
- `x++` / `++x`
- `x--` / `--x`

其中 `binop` 为 `+`, `*`, `-`, `/`, `&`, `^`, `|`, `<<`, `>>` 等。

**示例**：

```cpp
#include <iostream>
#include <omp.h>

int main() {
    int sum = 0;
    std::cout << "Before: " << sum << std::endl;

    #pragma omp parallel for
    for (int i = 0; i < 20000; ++i) {
        #pragma omp atomic
        sum++;
    }

    std::cout << "After: " << sum << std::endl; // 输出 20000
    return 0;
}
```

若无 `atomic`，结果不确定。

#### flush 语句

标识同步点，确保所有线程看到一致的存储器视图。

```c
#pragma omp flush (list)
```

在 barrier、critical、ordered、parallel 退出等场景会隐含执行。

#### ordered 语句

指定循环按迭代次序执行，同一时间只有一个线程执行。

```c
#pragma omp ordered
```

只能出现在 for 或 parallel for 的动态范围内。

---

### 数据域属性子句

| 子句                        | 说明                                           |
| --------------------------- | ---------------------------------------------- |
| `private(list)`             | 变量对每个线程是局部的                         |
| `shared(list)`              | 变量被所有线程共享                             |
| `default(shared\|none)`     | 规定并行域内变量的缺省作用范围                 |
| `firstprivate(list)`        | private 的超集，对变量做原子初始化             |
| `lastprivate(list)`         | private 的超集，将最后迭代的值赋给原变量       |
| `reduction(operator: list)` | 对变量进行规约，每个线程保留私有拷贝，最后合并 |

#### reduction 示例

```c
#include <omp.h>
#define N 100

int main() {
    int i, n = N, chunk = 10;
    float a[N], b[N], result = 0.0;

    for (i = 0; i < n; i++) {
        a[i] = i * 1.0;
        b[i] = i * 2.0;
    }

    #pragma omp parallel for default(shared) private(i) \
        schedule(static, chunk) reduction(+:result)
    for (i = 0; i < n; i++)
        result += a[i] * b[i];

    printf("Final result = %f\n", result);
    return 0;
}
```

### threadprivate 子句

使全局变量在并行域内变成每个线程私有，每个线程保留一份拷贝。

```c
#pragma omp threadprivate(list)
```

**与 private 的区别**：

|        | PRIVATE                | THREADPRIVATE                |
| ------ | ---------------------- | ---------------------------- |
| 位置   | 域的开始或共享任务单元 | 块或整个文件区域的例程定义上 |
| 持久性 | 否                     | 是                           |
| 初始化 | 使用 FIRSTPRIVATE      | 使用 COPYIN                  |

**示例**：

```c
#include <omp.h>

int counter = 0;
#pragma omp threadprivate(counter)

void inc_counter() { counter++; }

int main() {
    #pragma omp parallel private(i) {
        for (int i = 0; i < 1000; i++)
            inc_counter();
        printf("counter=%d\n", counter); // 每个线程输出 1000
    }
    printf("counter=%d\n", counter); // 主线程 counter=0
    return 0;
}
```

### copyin / copyprivate 子句

- `copyin(list)`：为所有线程的 threadprivate 变量赋相同值（取自主线程）
- `copyprivate(list)`：在 single 构造中，将一个线程的私有变量广播到其他线程

**copyin 示例**：

```c
#include <omp.h>

int global = 0;
#pragma omp threadprivate(global)

int main() {
    global = 1000;

    #pragma omp parallel copyin(global) {
        printf("global=%d\n", global); // 所有线程输出 1000
        global = omp_get_thread_num();
    }

    printf("global=%d\n", global); // 主线程 global=1000
    return 0;
}
```

---

## 运行时库函数与环境变量

### 运行时库函数

- 需引用头文件 `omp.h`
- 常用函数：
  - `omp_get_thread_num()`：获取当前线程 ID
  - `omp_get_num_threads()`：获取线程总数
  - `omp_set_num_threads(int)`：设置线程数

### 环境变量

| 变量              | 说明                                  |
| ----------------- | ------------------------------------- |
| `OMP_SCHEDULE`    | 线程调度类型，用于 for / parallel for |
| `OMP_NUM_THREADS` | 执行中最大的线程数                    |
| `OMP_DYNAMIC`     | TRUE/FALSE，是否动态设定并行域线程数  |
| `OMP_NESTED`      | 是否允许并行嵌套                      |

---

## OpenMP 计算实例：估算 Pi

用矩形法则数值积分：
$$P_i = \int_0^1 \frac{4}{1+x^2}dx \approx \frac{1}{N}\sum_{i=1}^N f\left(\frac{i-0.5}{N}\right)$$

### 串行版本

```c
static long num_steps = 100000;
double step;

int main() {
    int i;
    double x, pi, sum = 0.0;
    step = 1.0 / (double)num_steps;

    for (i = 0; i < num_steps; i++) {
        x = (i + 0.5) * step;
        sum += 4.0 / (1.0 + x * x);
    }
    pi = step * sum;
    return 0;
}
```

### 并行域版本

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 2

int main() {
    int i;
    double x, pi, sum[NUM_THREAD];

    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREAD);

    #pragma omp parallel {
        double x;
        int id = omp_get_thread_num();
        sum[id] = 0.0;

        for (i = id; i < num_steps; i += NUM_THREAD) {
            x = (i + 0.5) * step;
            sum[id] += 4.0 / (1.0 + x * x);
        }
    }

    pi = 0.0;
    for (i = 0; i < NUM_THREAD; i++)
        pi += sum[i] * step;
    return 0;
}
```

### parallel for 版本

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 2

int main() {
    int i;
    double x, pi, sum[NUM_THREAD];

    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREAD);

    #pragma omp parallel {
        int id = omp_get_thread_num();
        sum[id] = 0.0;

        #pragma omp for
        for (i = 0; i < num_steps; i++) {
            x = (i + 0.5) * step;
            sum[id] += 4.0 / (1.0 + x * x);
        }
    }

    pi = 0.0;
    for (i = 0; i < NUM_THREAD; i++)
        pi += sum[i] * step;
    return 0;
}
```

### critical 版本

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREAD 2

int main() {
    int i;
    double x, pi = 0.0, sum;

    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREAD);

    #pragma omp parallel private(x, sum) {
        int id = omp_get_thread_num();
        sum = 0.0;

        for (i = id; i < num_steps; i += NUM_THREAD) {
            x = (i + 0.5) * step;
            sum += 4.0 / (1.0 + x * x);
        }

        #pragma omp critical
        pi += sum;
    }
    return 0;
}
```

### reduction 版本（推荐）

```c
#include <omp.h>
static long num_steps = 100000;
double step;
#define NUM_THREADS 2

int main() {
    int i;
    double x, pi, sum = 0.0;

    step = 1.0 / (double)num_steps;
    omp_set_num_threads(NUM_THREADS);

    #pragma omp parallel for reduction(+:sum) private(x)
    for (i = 0; i < num_steps; i++) {
        x = (i + 0.5) * step;
        sum += 4.0 / (1.0 + x * x);
    }

    pi = step * sum;
    return 0;
}
```
