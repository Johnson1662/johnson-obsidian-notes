# Lab4 GPU异构计算实验 - 完整教程

## 一、问题背景

### 1.1 我们要解决什么问题？

求解**稀疏线性方程组**：**Ax = b**

- **A**: 一个很大的稀疏矩阵（大部分元素是0）
- **x**: 未知向量（我们要求的）
- **b**: 已知向量

### 1.2 什么是共轭梯度法（CG）？

这是一种**迭代算法**，通过不断改进猜测值来逼近真实解。

**核心思想**：
```
1. 从一个初始猜测 x₀ = 0 开始
2. 计算残差（误差）r = b - Ax
3. 沿着某个方向 p 更新 x
4. 重复直到误差足够小
```

### 1.3 为什么需要GPU加速？

CG算法中**最耗时的操作**是：
- **SpMV（稀疏矩阵向量乘）**: Ap = A × p
- 这个操作在每次迭代中都要执行
- 矩阵很大时（如100000×100000），计算量巨大

GPU有**成千上万个核心**，可以并行计算，非常适合这种任务！

---

## 二、CPU vs GPU 的思维差异

### 2.1 CPU思维（串行）

```cpp
// CPU: 一个一个地计算
for (int i = 0; i < n; i++) {
    y[i] = 计算第i行的结果;
}
```

### 2.2 GPU思维（并行）

```cpp
// GPU: 所有行同时计算！
__global__ void kernel(...) {
    int i = 我是第几个线程;  // 每个线程负责一行
    y[i] = 计算第i行的结果;
}
```

**关键区别**：
- CPU: 一个工人，按顺序干活
- GPU: 10000个工人，同时干活

---

## 三、代码结构详解

### 3.1 整体架构

```
主机（CPU）                    设备（GPU）
   |                              |
   |-- 1. 准备数据                |
   |-- 2. 分配GPU内存             |
   |-- 3. 拷贝数据到GPU --------> |
   |                              |
   |-- 4. 启动GPU计算 ----------> | 执行Kernel
   |                              |
   |<- 5. 拷贝结果回CPU ----------|
   |                              |
   |-- 6. 释放GPU内存             |
```

### 3.2 内存管理

```cpp
// CPU端（主机）
double *x;              // CPU内存中的向量
double *d_x;            // GPU内存中的向量（d_前缀表示device）

// 分配GPU内存
hipMalloc(&d_x, n * sizeof(double));

// 拷贝：CPU -> GPU
hipMemcpy(d_x, x, n * sizeof(double), hipMemcpyHostToDevice);

// 拷贝：GPU -> CPU
hipMemcpy(x, d_x, n * sizeof(double), hipMemcpyDeviceToHost);

// 释放GPU内存
hipFree(d_x);
```


---

## 四、核心Kernel函数详解

### 4.1 SpMV Kernel（最重要！）

**目标**：计算 y = A × x

**稀疏矩阵存储格式（CSR）**：
```
矩阵 A = [1  0  2]
        [0  3  0]
        [4  0  5]

存储为：
values  = [1, 2, 3, 4, 5]     // 非零元素
col_idx = [0, 2, 1, 0, 2]     // 每个元素的列号
row_ptr = [0, 2, 3, 5]        // 每行的起始位置
```

**代码逐行解释**：

```cpp
__global__ void spmv_kernel(int n, const int *row_ptr, const int *col_idx, 
                            const double *values, const double *x, double *y)
{
    // 第1步：确定我是哪个线程，负责哪一行
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    //      ^^^^^^^^   ^^^^^^^^^^^   ^^^^^^^^^^
    //      第几个块    每块多少线程   块内第几个线程
    //
    // 例如：blockDim.x=256, blockIdx.x=2, threadIdx.x=10
    //       i = 2 * 256 + 10 = 522  （我负责第522行）
    
    // 第2步：检查是否越界（线程数可能比行数多）
    if (i < n)
    {
        // 第3步：计算第i行的结果
        double sum = 0.0;
        
        // 遍历第i行的所有非零元素
        for (int j = row_ptr[i]; j < row_ptr[i + 1]; j++)
        {
            //          ^^^^^^^^^^      ^^^^^^^^^^^^^
            //          第i行起始位置    第i+1行起始位置
            //          
            // 例如：row_ptr[2]=3, row_ptr[3]=5
            //       说明第2行有2个非零元素（索引3和4）
            
            sum += values[j] * x[col_idx[j]];
            //     ^^^^^^^^^   ^^^^^^^^^^^^^
            //     矩阵元素值   对应的x向量元素
        }
        
        // 第4步：写入结果
        y[i] = sum;
    }
}
```

**并行化的魔力**：
- 假设矩阵有10000行
- CPU：需要10000次循环
- GPU：10000个线程**同时**计算，理论上快10000倍！


---

### 4.2 Dot Product Kernel（点积）

**目标**：计算 `result = x^T × y = x[0]*y[0] + x[1]*y[1] + ... + x[n-1]*y[n-1]`

**挑战**：这是一个 **归约（reduction）** 操作，需要把所有结果加起来。

**两阶段策略**：
1. **阶段1（GPU）**：每个block计算部分和
2. **阶段2（CPU）**：把所有block的结果加起来

```cpp
__global__ void dot_product_kernel(int n, const double *x, const double *y, 
                                   double *partial_sums)
{
    // 共享内存：block内的线程可以共享
    __shared__ double shared_data[256];
    
    int tid = threadIdx.x;                          // 块内线程ID
    int i = blockIdx.x * blockDim.x + threadIdx.x;  // 全局线程ID
    
    // === 第1步：每个线程计算一个乘积 ===
    double sum = 0.0;
    if (i < n)
    {
        sum = x[i] * y[i];  // 例如：线程522计算 x[522]*y[522]
    }
    shared_data[tid] = sum;  // 存入共享内存
    __syncthreads();         // 等待block内所有线程完成
    
    // === 第2步：在共享内存中归约（树形归约）===
    // 
    // 假设blockDim.x=8，初始值：[a, b, c, d, e, f, g, h]
    //
    // 第1轮 (s=4): [a+e, b+f, c+g, d+h, e, f, g, h]
    // 第2轮 (s=2): [a+e+c+g, b+f+d+h, c+g, d+h, ...]
    // 第3轮 (s=1): [a+e+c+g+b+f+d+h, ...]
    //
    for (int s = blockDim.x / 2; s > 0; s >>= 1)  // s每次减半
    {
        if (tid < s)
        {
            shared_data[tid] += shared_data[tid + s];
        }
        __syncthreads();  // 每轮都要同步
    }
    
    // === 第3步：每个block的结果写入全局内存 ===
    if (tid == 0)
    {
        partial_sums[blockIdx.x] = shared_data[0];
        // 例如：block 0的结果存入partial_sums[0]
    }
}
```

**为什么用共享内存？**
- 共享内存速度快（比全局内存快100倍）
- 同一个block内的线程可以高效通信

**CPU端的最终归约**：
```cpp
double gpu_dot_product(...) {
    // 启动kernel
    hipLaunchKernelGGL(dot_product_kernel, ...);
    
    // 拷贝部分和回CPU
    hipMemcpy(h_partial_sums, d_partial_sums, ...);
    
    // CPU完成最后的加法
    double result = 0.0;
    for (int i = 0; i < num_blocks; i++) {
        result += h_partial_sums[i];
    }
    return result;
}
```

---

### 4.3 AXPY Kernel（向量更新）

**目标**：y = y + α × x

```cpp
__global__ void axpy_kernel(int n, double alpha, const double *x, double *y)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n)
    {
        y[i] += alpha * x[i];
        // 例如：线程522计算 y[522] = y[522] + alpha * x[522]
    }
}
```

**简单直接**：每个线程负责一个元素，完全并行！

---

### 4.4 Vector Update Kernel

**目标**：z = x + β × y

```cpp
__global__ void vector_update_kernel(int n, const double *x, double beta, 
                                     const double *y, double *z)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n)
    {
        z[i] = x[i] + beta * y[i];
    }
}
```


---

## 五、CG求解器的GPU实现

### 5.1 算法流程

```
初始化：
  x = 0
  r = b - Ax = b  （因为x=0）
  p = r

循环（直到收敛）：
  1. Ap = A × p          ← SpMV (GPU)
  2. pAp = p^T × Ap      ← Dot Product (GPU)
  3. α = (r^T × r) / pAp
  4. x = x + α × p       ← AXPY (GPU)
  5. r = r - α × Ap      ← AXPY (GPU)
  6. rho_new = r^T × r   ← Dot Product (GPU)
  7. 检查是否收敛
  8. β = rho_new / rho_old
  9. p = r + β × p       ← Vector Update (GPU)
```

### 5.2 代码实现

```cpp
void cg_solver()
{
    // === 初始化 ===
    x = (double *)calloc(n, sizeof(double));  // x = 0
    r = (double *)malloc(n * sizeof(double));
    p = (double *)malloc(n * sizeof(double));
    
    for (int i = 0; i < n; i++)
    {
        r[i] = b[i];  // r = b（因为Ax=0）
        p[i] = r[i];  // p = r
    }
    
    // 拷贝到GPU
    hipMemcpy(d_r, r, n * sizeof(double), hipMemcpyHostToDevice);
    hipMemcpy(d_p, p, n * sizeof(double), hipMemcpyHostToDevice);
    hipMemcpy(d_x, x, n * sizeof(double), hipMemcpyHostToDevice);
    
    // === 设置kernel启动参数 ===
    int block_size = num_threads;  // 每个block有多少线程（如256）
    int num_blocks = (n + block_size - 1) / block_size;  // 需要多少个block
    //
    // 例如：n=10000, block_size=256
    //       num_blocks = (10000 + 255) / 256 = 40
    //       总共40个block，每个256线程，共10240个线程（够用）
    
    // 计算初始残差
    double rho_old = gpu_dot_product(n, d_r, d_r, ...);
    
    // === 迭代求解 ===
    for (int iter = 0; iter < max_iter; iter++)
    {
        // 1. SpMV: Ap = A × p
        hipLaunchKernelGGL(spmv_kernel, 
                           dim3(num_blocks),    // 启动多少个block
                           dim3(block_size),    // 每个block多少线程
                           0, 0,                // 共享内存大小，stream
                           n, d_row_ptr, d_col_idx, d_values, d_p, d_Ap);
        
        // 2. 计算 pAp = p^T × Ap
        double pAp = gpu_dot_product(n, d_p, d_Ap, ...);
        
        // 3. 计算 α
        double alpha = rho_old / pAp;
        
        // 4. 更新 x = x + α × p
        hipLaunchKernelGGL(axpy_kernel, 
                           dim3(num_blocks), dim3(block_size), 0, 0,
                           n, alpha, d_p, d_x);
        
        // 5. 更新 r = r - α × Ap
        hipLaunchKernelGGL(axpy_subtract_kernel, 
                           dim3(num_blocks), dim3(block_size), 0, 0,
                           n, alpha, d_Ap, d_r);
        
        // 6. 计算新残差
        double rho_new = gpu_dot_product(n, d_r, d_r, ...);
        
        // 7. 检查收敛
        if (sqrt(rho_new) < tol) {
            printf("收敛！\n");
            break;
        }
        
        // 8. 计算 β
        double beta = rho_new / rho_old;
        
        // 9. 更新 p = r + β × p
        hipLaunchKernelGGL(vector_update_kernel, 
                           dim3(num_blocks), dim3(block_size), 0, 0,
                           n, d_r, beta, d_p, d_p);
        
        rho_old = rho_new;
    }
    
    // 拷贝结果回CPU
    hipMemcpy(x, d_x, n * sizeof(double), hipMemcpyDeviceToHost);
}
```


---

## 六、关键概念总结

### 6.1 线程组织

```
Grid（网格）
  └─ Block 0 (256个线程)
  └─ Block 1 (256个线程)
  └─ Block 2 (256个线程)
  └─ ...

每个线程的全局ID：
  i = blockIdx.x * blockDim.x + threadIdx.x
```

### 6.2 内存层次

```
速度：快 ────────────────────> 慢
      寄存器 > 共享内存 > 全局内存 > CPU内存

使用原则：
- 频繁访问的数据 → 共享内存
- 大数据 → 全局内存
- 结果 → 拷贝回CPU内存
```

### 6.3 同步

```cpp
__syncthreads();  // block内所有线程等待
```

**为什么需要同步？**
- 确保所有线程都完成了某个阶段
- 避免数据竞争

---

## 七、性能优化要点

### 7.1 减少数据传输

```cpp
// ❌ 不好：每次迭代都传输
for (iter...) {
    hipMemcpy(d_p, p, ...);  // CPU -> GPU
    kernel<<<...>>>();
    hipMemcpy(p, d_p, ...);  // GPU -> CPU
}

// ✅ 好：数据保持在GPU
hipMemcpy(d_p, p, ...);      // 只传一次
for (iter...) {
    kernel<<<...>>>();        // 在GPU上计算
}
hipMemcpy(p, d_p, ...);      // 最后传回
```

### 7.2 选择合适的Block大小

```
太小（如32）：GPU利用率低
太大（如1024）：寄存器/共享内存不够
合适（128-512）：平衡性能
```

### 7.3 合并内存访问

```cpp
// ✅ 好：连续访问
for (int j = row_ptr[i]; j < row_ptr[i+1]; j++) {
    sum += values[j] * x[col_idx[j]];
}
```

---

## 八、调试技巧

### 8.1 检查GPU错误

```cpp
hipError_t err = hipMalloc(&d_x, size);
if (err != hipSuccess) {
    printf("错误: %s\n", hipGetErrorString(err));
}
```

### 8.2 打印调试信息

```cpp
__global__ void kernel(...) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i == 0) {  // 只让第0个线程打印
        printf("Debug: n=%d\n", n);
    }
}
```


---

## 九、完整流程示意图

```
main()
  │
  ├─ 读取数据（矩阵A，向量b）
  │
  ├─ 分配GPU内存
  │    hipMalloc(&d_values, ...)
  │    hipMalloc(&d_x, ...)
  │    ...
  │
  ├─ 拷贝数据到GPU
  │    hipMemcpy(d_values, values, ..., H2D)
  │    hipMemcpy(d_b, b, ..., H2D)
  │
  ├─ cg_solver()
  │    │
  │    ├─ 初始化 x=0, r=b, p=r
  │    │
  │    └─ for (iter = 0; iter < max_iter; iter++)
  │         │
  │         ├─ SpMV: Ap = A×p  ──> GPU Kernel
  │         ├─ pAp = p^T×Ap    ──> GPU Kernel + CPU归约
  │         ├─ α = rho/pAp
  │         ├─ x = x + α×p     ──> GPU Kernel
  │         ├─ r = r - α×Ap    ──> GPU Kernel
  │         ├─ rho = r^T×r     ──> GPU Kernel + CPU归约
  │         ├─ 检查收敛
  │         ├─ β = rho_new/rho_old
  │         └─ p = r + β×p     ──> GPU Kernel
  │
  ├─ 拷贝结果回CPU
  │    hipMemcpy(x, d_x, ..., D2H)
  │
  ├─ 验证结果
  │
  └─ 释放GPU内存
       hipFree(d_values)
       hipFree(d_x)
       ...
```

---

## 十、与Lab2/Lab3的对比

| 特性 | Lab2 (pthread) | Lab3 (MPI) | Lab4 (GPU) |
|------|----------------|------------|------------|
| 并行方式 | CPU多线程 | CPU多进程 | GPU大规模并行 |
| 线程数 | 1-32 | 1-32 | 数千到数万 |
| 内存 | 共享内存 | 分布式内存 | GPU显存 |
| 通信 | 无需通信 | 进程间通信 | CPU-GPU传输 |
| 适用场景 | 单机多核 | 集群 | 大规模数据并行 |

---

## 十一、使用方法

### 方式1: 使用Windows控制脚本（推荐）

```powershell
# 上传代码并启动实验（小规模测试）
.\lab4_control.ps1 -Action all -Mode small

# 检查实验状态
.\lab4_control.ps1 -Action check

# 在服务器分析并下载报告
.\lab4_control.ps1 -Action analyze

# 只下载报告（如果已分析）
.\lab4_control.ps1 -Action download
```

### 方式2: 手动操作

```bash
# 1. 上传代码
scp -r code/src pc-lab:~/Lab4/
scp code/script/* pc-lab:~/Lab4/

# 2. 登录服务器
ssh pc-lab

# 3. 转换格式并运行
cd ~/Lab4
sed -i 's/\r$//' *.sh *.pbs *.py
chmod +x *.sh *.py

# 4. 启动实验
bash run_experiment.sh small    # 小规模测试
# 或
bash run_experiment.sh large    # 大规模测试
# 或
bash run_experiment.sh all      # 全部规模

# 5. 检查状态
qstat -u $USER

# 6. 分析结果（在服务器）
python3 analyze_results.py results

# 7. 下载报告（在本地执行）
scp pc-lab:~/Lab4/results/*.txt ./results/
scp pc-lab:~/Lab4/results/*.png ./results/
```

---

## 十二、实验参数

### 矩阵规模
- **small**: 1000, 5000, 10000
- **large**: 10000, 50000, 100000
- **all**: 1000, 5000, 10000, 50000, 100000

### GPU Block大小
- 64, 128, 256, 512

### 重复次数
- 每个配置重复5次

---

## 十三、编译说明

程序使用HIP编译器编译：

```bash
hipcc -O3 sparse.cpp -o sparse.o
```

---

## 十四、PBS配置

```bash
#PBS -N lab4_gpu
#PBS -l nodes=1:ppn=1:gpus=1  # 申请1个GPU
#PBS -j oe
```

---

## 十五、文件结构

```
第四次实验/
├── code/
│   ├── src/
│   │   ├── sparse.cpp          # GPU加速版本（HIP）
│   │   └── sparse_old.cpp      # 原始串行版本
│   └── script/
│       ├── run_experiment.sh   # 实验运行脚本
│       ├── sparse.pbs          # PBS作业脚本
│       └── analyze_results.py  # 结果分析脚本
├── lab4_control.ps1            # Windows控制脚本
└── README.md                   # 本文件
```

---

## 十六、故障排查

### 编译错误
- 检查是否使用了`hipcc`编译器
- 检查HIP头文件路径

### 运行错误
- 检查PBS脚本是否申请了GPU资源
- 检查GPU驱动和运行时是否正常

### 性能异常
- 检查Block大小是否合理（64-512）
- 检查数据传输是否优化
- 查看GPU利用率

---

## 十七、预期结果

- 相比CPU串行版本，GPU版本应该有显著加速
- 不同Block大小会影响性能
- 矩阵规模越大，GPU加速效果越明显

---

## 十八、参考资料

- HIP编程指南
- 实验指导书第四章
- AGENTS.md中的实验经验总结
