# Pthread多线程编程

> 📚 本章涵盖：PPT 03 多线程并行程序设计（第40-63页）、2026年实验一二
> 
> 🎯 对应考点：线程与进程区别、互斥锁、条件变量、伪共享

---

## 一、多线程基本概念

### 1.1 什么是线程？

**线程（Thread）**：
- 进程上下文中执行的代码序列
- 又称**轻量级进程**（Light Weight Process）
- 在支持多线程的系统中：
  - **进程**是资源分配的实体
  - **线程**是被调度执行的基本单元

### 1.2 线程与进程的区别

| 特性 | 进程 | 线程 |
|------|------|------|
| **调度** | CPU调度和分派的基本单位 | CPU调度的基本单位，更轻量 |
| **并发性** | 进程间并发 | 同一进程内线程也可并发 |
| **拥有资源** | 独立拥有系统资源 | 不拥有资源，共享进程资源 |
| **系统开销** | 创建/切换开销大 | 创建/切换开销小 |
| **切换** | 涉及整个CPU环境保存 | 只需保存少量寄存器 |

**详细说明**：

**调度**：
- 传统OS：进程是CPU调度的基本单位
- 引入线程后：线程是CPU调度的基本单位
- 同一进程内线程切换不会引起进程切换，避免昂贵的系统调用

**并发性**：
- 不仅进程间可以并发，同一进程内多线程也可并发
- 提高系统吞吐量和资源利用率

**拥有资源**：
- 进程：拥有系统资源的独立单位
- 线程：不拥有系统资源，但可访问隶属进程的资源
- 同一进程的线程共享：代码段、数据段、打开的文件、I/O设备等

**系统开销**：
- 进程创建/撤销：需分配/回收资源（内存、I/O设备等）
- 进程切换：涉及整个CPU环境保存和设置
- 线程切换：只需保存和设置少量寄存器

### 1.3 线程层次

| 层次 | 说明 |
|------|------|
| **用户级线程** | 在用户层通过线程库实现，创建/切换不利用系统调用 |
| **核心级线程** | 由OS直接支持，创建/切换由核心实现 |
| **硬件线程** | 线程在硬件执行资源上的表现形式 |

**关系**：用户级线程 → 核心级线程 → 硬件线程

### 1.4 线程池

**线程池（Thread Pool）**：
- 维护多个线程，等待调度器分配可并发执行的任务
- **优点**：
  - 避免频繁创建/销毁线程的开销
  - 保证内核充分利用
  - 防止过分调度

---

## 二、共享存储访问问题

### 2.1 缓存一致性

**定义**：在层次结构存储系统中，保证高速缓存中数据与主存中数据相同的机制

```
CPU0          CPU1
  │             │
L1 Cache      L1 Cache
  │             │
L2 Cache      L2 Cache
  │             │
  └──── L3 Cache ────┘
            │
        Main Memory
```

### 2.2 竞态条件

**竞态条件（Race Condition）**：
- 两个或多个线程在同一时刻访问共享内存/数据
- 最后结果取决于线程执行的顺序

**示例**：
```c
shared double balance;

// 线程1: DEPOSIT
balance = balance + amount;

// 线程2: WITHDRAWAL  
balance = balance - amount;
```

**汇编层面**：
```
线程1:                 线程2:
load R1, balance      load R1, balance
load R2, amount       load R2, amount
add R1, R2            sub R1, R2
store R1, balance     store R1, balance
```

如果交替执行，结果可能不正确！

### 2.3 临界区

**临界区（Critical Section）**：
- 包含访问共享数据的代码段
- 保证同一时刻至多只有一个线程在临界区内执行

**三区域**：
```
┌─────────────────────────────┐
│      进入区 (Entry Section)  │  ← 申请锁
├─────────────────────────────┤
│      临界区 (Critical Section)│  ← 访问共享数据
├─────────────────────────────┤
│      退出区 (Exit Section)   │  ← 释放锁
└─────────────────────────────┘
```

---

## 三、Pthread API详解

### 3.1 POSIX标准

**POSIX（Portable Operating System Interface）**：
- 基于UNIX的操作系统接口标准
- 由IEEE开发，ANSI和ISO标准化
- 目标：源代码级软件可移植性

### 3.2 线程管理函数

| 函数 | 说明 | 原型 |
|------|------|------|
| `pthread_create` | 创建线程 | `int pthread_create(pthread_t*, const pthread_attr_t*, void*(*)(void*), void*)` |
| `pthread_join` | 等待线程结束 | `int pthread_join(pthread_t, void**)` |
| `pthread_exit` | 终止线程 | `void pthread_exit(void*)` |
| `pthread_self` | 获取自身ID | `pthread_t pthread_self(void)` |
| `pthread_equal` | 比较线程ID | `int pthread_equal(pthread_t, pthread_t)` |
| `pthread_cancel` | 取消线程 | `int pthread_cancel(pthread_t)` |
| `pthread_detach` | 分离线程 | `int pthread_detach(pthread_t)` |

### 3.3 程序示例

```c
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

#define NUM_THREADS 4

// 线程函数
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
        int ret = pthread_create(&threads[i], NULL, thread_func, &thread_ids[i]);
        if (ret != 0) {
            printf("Error creating thread %d\n", i);
            exit(1);
        }
    }
    
    // 等待所有线程完成
    for (int i = 0; i < NUM_THREADS; i++) {
        pthread_join(threads[i], NULL);
    }
    
    printf("All threads completed\n");
    return 0;
}
```

**编译运行**：
```bash
g++ -pthread -o thread_test.o thread_test.cpp
./thread_test.o
```

### 3.4 pthread_create详解

```c
int pthread_create(
    pthread_t *thread,              // 返回的线程ID
    const pthread_attr_t *attr,     // 线程属性（NULL为默认）
    void *(*start_routine)(void*),  // 线程函数
    void *arg                       // 传递给线程函数的参数
);
```

**返回值**：成功返回0，失败返回错误码

### 3.5 pthread_join详解

```c
int pthread_join(
    pthread_t thread,   // 要等待的线程ID
    void **retval       // 线程返回值（可为NULL）
);
```

**功能**：阻塞调用线程，直到指定线程结束

---

## 四、同步机制

### 4.1 忙等待（Busy-Waiting）

**方法**：使用标志变量实现同步

```c
int flag = 0;  // 共享标志

// 线程0
while (flag != 0);  // 等待
// 执行临界区
flag = 1;

// 线程1  
while (flag != 1);  // 等待
// 执行临界区
flag = 0;
```

**缺点**：
- 浪费CPU时间
- 可能导致死锁

### 4.2 互斥锁（Mutex）⭐⭐⭐

**Mutex（MUTual EXclusion）**：
- 实现线程间同步的方法
- 线程访问共享资源前必须先获得锁
- 只有获得锁的线程才能进入临界区

**Pthread互斥锁函数**：

| 函数 | 说明 |
|------|------|
| `pthread_mutex_init` | 初始化互斥锁 |
| `pthread_mutex_destroy` | 销毁互斥锁 |
| `pthread_mutex_lock` | 加锁（阻塞） |
| `pthread_mutex_trylock` | 尝试加锁（非阻塞） |
| `pthread_mutex_unlock` | 解锁 |

**声明与初始化**：
```c
pthread_mutex_t mutex;

// 方法1：静态初始化
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;

// 方法2：动态初始化
pthread_mutex_init(&mutex, NULL);
```

**使用示例**：
```c
pthread_mutex_t mutex;
int shared_counter = 0;

void* increment(void* arg) {
    for (int i = 0; i < 1000; i++) {
        pthread_mutex_lock(&mutex);    // 加锁
        shared_counter++;              // 临界区
        pthread_mutex_unlock(&mutex);  // 解锁
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

### 4.3 条件变量

**条件变量（Condition Variable）**：
- 用来通知共享数据状态信息
- 当特定条件满足时，等待或唤醒其他线程
- 需要与互斥锁配合使用

**主要函数**：

| 函数 | 说明 |
|------|------|
| `pthread_cond_init` | 初始化条件变量 |
| `pthread_cond_destroy` | 销毁条件变量 |
| `pthread_cond_wait` | 等待条件变量 |
| `pthread_cond_signal` | 唤醒一个等待线程 |
| `pthread_cond_broadcast` | 唤醒所有等待线程 |

**使用示例**：
```c
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
int i = 1;

void* thread1(void* arg) {
    for (i = 1; i <= 9; i++) {
        pthread_mutex_lock(&mutex);
        if (i % 3 == 0)
            pthread_cond_signal(&cond);  // 通知thread2
        else
            printf("thread1: %d\n", i);
        pthread_mutex_unlock(&mutex);
        sleep(1);
    }
    return NULL;
}

void* thread2(void* arg) {
    while (i < 9) {
        pthread_mutex_lock(&mutex);
        if (i % 3 != 0)
            pthread_cond_wait(&cond, &mutex);  // 等待条件
        printf("thread2: %d\n", i);
        pthread_mutex_unlock(&mutex);
        sleep(1);
    }
    return NULL;
}
```

**输出**：
```
thread1: 1
thread1: 2
thread2: 3
thread1: 4
thread1: 5
thread2: 6
thread1: 7
thread1: 8
thread2: 9
```

### 4.4 死锁

**死锁（Deadlock）**：
- 两个或多个线程互相等待对方释放锁

**示例**：
```c
// 线程1                    // 线程2
pthread_mutex_lock(&lock1); pthread_mutex_lock(&lock2);
// 执行...                  // 执行...
pthread_mutex_lock(&lock2); // 等待lock2  pthread_mutex_lock(&lock1); // 等待lock1
// 执行...                  // 执行...
```

**避免方法**：
- 固定锁的获取顺序
- 使用尝试加锁（trylock）
- 避免嵌套锁

---

## 五、性能优化

### 5.1 伪共享（False Sharing）⭐⭐

**问题来源**：
- CPU缓存一致性以**缓存行**为单位（通常64字节）
- 对缓存行中任意部分的修改等同于对整个行的修改
- 不同线程访问同一缓存行的不同变量会导致不必要的缓存失效

**示例**：
```c
// 假设缓存行64字节
struct {
    int count[2];  // count[0]和count[1]在同一缓存行
} shared_data;

// 线程0访问count[0]，线程1访问count[1]
// 虽然是不同变量，但会相互影响缓存！
```

**解决方案**：填充到不同缓存行
```c
struct {
    int value;
    char padding[60];  // 填充到64字节
} private_count[2];
```

### 5.2 性能对比

| 方法 | 性能 | 说明 |
|------|------|------|
| 无同步 | 高 | 结果不正确 |
| 忙等待 | 低 | 浪费CPU |
| 互斥锁 | 中 | 正确且相对高效 |
| 避免伪共享 | 高 | 缓存友好 |

---

## 六、经典算法示例

### 6.1 积分法求π

**公式**：
$$\pi = 4 \int_0^1 \frac{1}{1+x^2} dx$$

**串行代码**：
```c
double sum = 0.0;
double step = 1.0 / n;
for (int i = 0; i < n; i++) {
    double x = (i + 0.5) * step;
    sum += 4.0 / (1.0 + x * x);
}
double pi = step * sum;
```

**并行思路**：
- 将n次迭代分配给多个线程
- 每个线程计算部分和
- 最后合并

### 6.2 统计数组中3的个数

**串行代码**：
```c
int count3s(int *array, int length) {
    int count = 0;
    for (int i = 0; i < length; i++) {
        if (array[i] == 3) {
            count++;
        }
    }
    return count;
}
```

**并行版本1（有竞态条件）**：
```c
void* count_thread(void* arg) {
    int start = *(int*)arg;
    for (int i = start; i < start + chunk; i++) {
        if (array[i] == 3) {
            count++;  // 竞态条件！
        }
    }
    return NULL;
}
```

**并行版本2（加互斥锁）**：
```c
void* count_thread(void* arg) {
    int start = *(int*)arg;
    for (int i = start; i < start + chunk; i++) {
        if (array[i] == 3) {
            pthread_mutex_lock(&mutex);
            count++;  // 安全
            pthread_mutex_unlock(&mutex);
        }
    }
    return NULL;
}
```

**并行版本3（局部变量）**：
```c
void* count_thread(void* arg) {
    int start = *(int*)arg;
    int local_count = 0;  // 局部变量
    for (int i = start; i < start + chunk; i++) {
        if (array[i] == 3) {
            local_count++;
        }
    }
    pthread_mutex_lock(&mutex);
    count += local_count;  // 只加锁一次
    pthread_mutex_unlock(&mutex);
    return NULL;
}
```

**并行版本4（避免伪共享）**：
```c
struct padded_int {
    int value;
    char padding[60];
};

struct padded_int local_counts[NUM_THREADS];

void* count_thread(void* arg) {
    int tid = *(int*)arg;
    int start = tid * chunk;
    for (int i = start; i < start + chunk; i++) {
        if (array[i] == 3) {
            local_counts[tid].value++;  // 无伪共享
        }
    }
    return NULL;
}
```

---

## 七、2026年实验

### 7.1 实验一：多线程计算正弦值

**泰勒级数展开**：
$$\sin(x) = \sum_{n=0}^{\infty} \frac{(-1)^n x^{2n+1}}{(2n+1)!} = x - \frac{x^3}{3!} + \frac{x^5}{5!} - ...$$

**编译运行**：
```bash
g++ -pthread -o cal_sin.o cal_sin.cpp
./cal_sin.o 1.57 10000 4  # 弧度=1.57, 项数=10000, 线程数=4
```

### 7.2 实验二：多线程求解稀疏线性方程组

**共轭梯度法（CG）**：
- 求解对称正定稀疏线性方程组 Ax = b
- 核心：SpMV、向量点积、向量更新

**CSR稀疏矩阵格式**：
```c
values[] = {3.0, 1.0, 1.0, 4.0, 1.0, 1.0, 5.0};  // 非零元素
row_ptr[] = {0, 2, 5, 7};                          // 行偏移
col_idx[] = {0, 1, 0, 1, 2, 1, 2};                 // 列索引
```

**并行策略**：
- 行分块：每个线程处理连续若干行
- SpMV本地计算
- 点积需要全局规约（互斥锁）
- **注意避免假共享**

---

## 八、名词解释汇总

| 术语 | 英文 | 定义 |
|------|------|------|
| **线程** | Thread | 进程中执行的代码序列，轻量级进程 |
| **互斥锁** | Mutex | 保证同一时刻只有一个线程访问共享资源 |
| **临界区** | Critical Section | 访问共享数据的代码段 |
| **竞态条件** | Race Condition | 结果取决于线程执行顺序的情况 |
| **条件变量** | Condition Variable | 用于线程间状态通知的同步机制 |
| **死锁** | Deadlock | 线程互相等待对方释放锁 |
| **伪共享** | False Sharing | 不同变量在同一缓存行导致的性能问题 |
| **忙等待** | Busy-Waiting | 循环检查条件的等待方式 |
| **线程池** | Thread Pool | 预创建的线程集合 |

---

## 九、复习要点

### ✅ 必须掌握
1. 线程与进程的区别
2. 互斥锁的使用方法
3. 条件变量的使用场景
4. 伪共享问题及解决方法
5. Pthread基本API

### ⚠️ 常见考题
- 比较线程与进程（简答题）
- 解释互斥锁的作用（名词解释）
- 解释伪共享问题（简答题）
- 写出Pthread并行程序（编程题）

### 📖 参考图示
- 线程与进程对比 → **PPT 03 第4-10页**
- 临界区示意图 → **PPT 03 第17页**
- 互斥锁示意 → **PPT 03 第22-24页**
- 伪共享问题 → **PPT 03 第36-38页**

---

*整理自：03 多线程并行程序设计.pdf (79页)、2026年实验指导书*
