# MPI多级混合编程#

## 计算机系统性能提升方法#

### Scale Up 模式#
- 单个计算节点能力越来越强大
- CPU：单核 → 多核 → 众核
- GPU、MIC（Xeon Phi）等加速器的加入
- 节点内核心数从几个增长到数千个（如天河二号：每节点2×12核CPU + 3×57核Xeon Phi = 312万核心）

### Scale Out 模式#
- 可计算节点规模越来越大
- 通过高速互联网络将更多节点连接起来
- 例如：天河二号16000个运算节点

### 多级化成为必然趋势#
- **Scale Up + Scale Out** 结合
- 节点内：多核+加速器（Scale Up）
- 节点间：大规模集群（Scale Out）
- 编程模型需同时支持两级并行

---

## 多级并行计算系统#

### SMP节点构成的集群架构（MPI+OpenMP）#

- 节点内：多个处理器共享内存（OpenMP）
- 节点间：通过互联网络连接（MPI）
- 编程模型：**MPI+OpenMP**

```
┌─────────────────────────────┐
│    Node 0 (SMP Node)       │
│  ┌──────┐  ┌──────┐     │
│  │ CPU0 │  │ CPU1 │ ... │
│  └──┬───┘  └──┬───┘     │
│     └───────┬──────┘         │
│           │ Shared Memory      │
│  ┌──────┐  ┌──────┐     │
│  │GPU0 │  │GPU1 │ ... │
│  └──┬───┘  └──┬───┘     │
└─────┼─────────────┴─────┘
      │ MPI
┌─────┼─────────────┬─────┐
│     │                 │     │
│  Node 1            Node N-1   │
└─────────────────────────────┘
```

### 多GPU集群架构（MPI+CUDA）#

- 节点内：多个GPU通过PCIe连接（CUDA）
- 节点间：通过互联网络连接（MPI）
- 编程模型：**MPI+CUDA**

---

## MPI vs Thread#

| 对比 | MPI | Thread（OpenMP/PThread） |
|------|-----|------------------------|
| 地址空间 | 独立 | 共享内存 |
| 适用环境 | 分布式网络计算 | 共享内存机器 |
| 通信方式 | 显式（Send/Recv） | 隐式（共享变量） |
| 可扩展性 | 高（跨节点） | 仅节点内 |
| 开发难度 | 较高 | 较容易 |
| 负载平衡 | 困难 | 支持动态平衡 |

### 纯MPI优点#
- 高可扩展性
- 高可移植性
- 节点间可扩展

### 纯OpenMP优点#
- 容易部署
- 延迟低
- 隐式通信
- 支持粗/细粒度划分
- 动态负载平衡

### 纯MPI缺点#
- 开发调试困难
- 显式通信
- 粗粒度划分
- 负载平衡困难

### 纯OpenMP缺点#
- 仅运行于共享内存机器
- 仅节点内可扩展
- 线程顺序未定义

### MPI+OpenMP：两全其美#
- 概念简洁，两级并发
- 适合多核节点架构
- 缓解纯MPI可扩展性问题，降低进程数和网络洪水
- 每个MPI进程内创建多个OpenMP线程

---

## MPI+OpenMP混合编程模型#

### 进程内线程创建#
```c
#include <mpi.h>
#include <omp.h>

int main(int argc, char **argv) {
    int rank, size, ierr;

    ierr = MPI_Init(&argc, &argv);
    ierr = MPI_Comm_rank(MPICOMM_WORLD, &rank);
    ierr = MPI_Comm_size(MPICOMM_WORLD, &size);

    #pragma omp parallel for
    for (int i = 0; i < n; i++) {
        <work>
    }

    // 串行区域或并行区域调用MPI库
    MPI_Send(...);   // 由主线程执行

    ierr = MPI_Finalize();
    return 0;
}
```

### MPI线程支持级别#

| 级别 | 描述 |
|------|------|
| `MPI_THREAD_SINGLE` | 不支持多线程，只有主线程 |
| `MPI_THREAD_FUNNELED` | 多核但只有主线程调用MPI（默认） |
| `MPI_THREAD_SERIALIZED` | 多线程可调用MPI，但一次只有一个线程（串行化） |
| `MPI_THREAD_MULTIPLE` | 任何线程可调用MPI，无限制（最灵活但最复杂） |

```c
int MPI_Init_thread(int *argc, char ***argv,
                     int required, int *provided);
// required: 请求的级别
// provided: 实际获得的级别（可能低于请求）
```

### 通过主线程进行MPI调用（MPI_THREAD_FUNNELED）#

```c
#pragma omp parallel {
    #pragma omp master {
        MPI_Whatever(...);  // 只有主线程调用
    }
    #pragma omp barrier  // 需要显式同步
}
```

### 单个线程内调用（MPI_THREAD_SERIALIZED）#

```c
#pragma omp parallel {
    #pragma omp single {
        MPI_Whatever(...);  // 只有一个线程执行
    }
    // OMP SINGLE有隐式barrier，无需额外同步
}
```

### MPI_THREAD_MULTIPLE模式#

```c
int main(int argc, char **argv) {
    int provided;
    MPI_Init_thread(&argc, &argv, MPI_THREAD_MULTIPLE, &provided);
    if (provided < MPI_THREAD_MULTIPLE)
        MPI_Abort(MPICOMM_WORLD, 1);

    #pragma omp parallel for
    for (int i = 0; i < 100; i++) {
        MPI_Whatever(...);  // 任何线程可调用
    }

    MPI_Finalize();
    return 0;
}
```
> 最灵活但最复杂，线程调用顺序不确定，有潜在死锁风险。

### 计算与通信重叠#
- 一个线程负责通信，其余线程继续执行计算
- 可提升整体效率，但同步与负载均衡较复杂

---

## 举例1：MPI+OpenMP计算π#

### 公式#
$$\pi = \int_0^1 \frac{4}{1+x^2}dx \approx \sum_{i=0}^{N} \frac{4}{1+(\frac{i+0.5}{N})^2} \times \frac{1}{N}$$

### 设计#
- 每个MPI进程负责 `1/nproc` 范围的离散求和
- 每个MPI进程内，`nthreads` 个OpenMP线程负责局部求和

### 核心代码#
```c
#include <stdio.h>
#include <mpi.h>
#include <omp.h>
#define NBIN 100000
#define MAX_THREADS 8

void main(int argc, char **argv) {
    int nbin, myid, nproc, nthreads, tid;
    double step, sum[MAX_THREADS] = {0.0}, pi = 0.0, Pi;

    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPICOMM_WORLD, &myid);
    MPI_Comm_size(MPICOMM_WORLD, &nproc);

    nbin = NBIN / nproc;
    step = 1.0 / (double)(nbin * nproc);

    #pragma omp parallel private(tid) {
        int i;
        double x;
        nthreads = omp_get_num_threads();
        tid = omp_get_thread_num();

        for (i = nbin * myid + tid; i < nbin * (myid+1); i += nthreads) {
            x = (i + 0.5) * step;
            sum[tid] += 4.0 / (1.0 + x * x);
        }
        printf("rank %d tid %d sum=%e\n", myid, tid, sum[tid]);
    }

    for (tid = 0; tid < nthreads; tid++)
        pi += sum[tid] * step;

    MPI_Allreduce(&pi, &Pi, 1, MPI_DOUBLE, MPI_SUM, MPICOMM_WORLD);
    if (myid == 0) printf("PI = %f\n", Pi);
    MPI_Finalize();
}
```

### PBS脚本#
```bash
#!/bin/bash
#PBS -l nodes=2:ppn=1
#PBS -l walltime=00:00:59
#PBS -N hpi
#PBS -j oe

export OMP_NUM_THREADS=2
WORK_HOME=/path/to/work
cd $WORK_HOME
np=$(cat $PBS_NODEFILE | wc -l)
mpirun -np $np -machinefile $PBS_NODEFILE ./hpi
```

---

## 举例2：Multi-Zone NAS Parallel Benchmarks#

### 混合编程模式#
| 层次 | 技术 | 说明 |
|------|------|------|
| 节点间 | MPI | 进程间通信 |
| 节点内 | OpenMP | 线程并行 |
| 计算 | Zones | 每个Zone由不同进程处理 |

### BT-MZ（Block Tridiagonal - Multi-Zone）#
```fortran
call omp_set_num_threads(weight)
call mpi_send/recv

do step = 1, itmax
    call exch_qbc(u, qbc, nx, ...)
    do zone = 1, num_zones
        if (iam == pzone_id(zone)) then
            call zsolve(u, rsd, ...)
        endif
    enddo
enddo

subroutine zsolve(u, rsd, ...)
    !$OMP PARALLEL DEFAULT(SHARED)
    !$OMP& PRIVATE(m,i,j,k,...)
    do k = 2, nz-1
        !$OMP DO
        do j = 2, ny-1
            do i = 2, nx-1
                do m = 1, 5
                    u(m,i,j,k) = dt*rsd(m,i,j,k-1) + ...
                enddo
            enddo
        enddo
        !$OMP END DO NOWAIT
    enddo
    ...
    !$OMP END PARALLEL
endsubroutine
```

### LU-MZ（Lower-Upper - Multi-Zone）#
```fortran
call omp_set_num_threads(weight)

do step = 1, itmax
    call exch_qbc(u, qbc, nx, ...)
    do zone = 1, num_zones
        if (iam == pzone_id(zone)) then
            call ssor  ! 使用SSOR迭代
        endif
    enddo
enddo

subroutine ssor
    !$OMP PARALLEL DEFAULT(SHARED)
    !$OMP& PRIVATE(m,i,j,k,...)
    call sync1()  ! 同步管道

    do k = 2, nz-1
        !$OMP DO
        do j = 2, ny-1
            do i = 2, nx-1
                do m = 1, 5
                    rsd(m,i,j,k) = dt*rsd(m,i,j,k-1) + ...
                enddo
            enddo
        enddo
        !$OMP END DO WAIT
    enddo
    call sync2()  ! 同步管道
    ...
    !$OMP END PARALLEL
endsubroutine
```

---

## GPU集群：三级硬件并发#

```
┌──────────────────────────────────────┐
│  GPU层：多处理器上运行的线程           │
│ 节点层：CPU + GPU + 网卡绑定         │
│ 集群层：通过互联网络连接         │
└──────────────────────────────────────┘
```

### 并发策略#
- 节点内：CUDA进行GPU并发
- 节点间：MPI进行跨节点通信

---

## MPI+CUDA混合编程#

### 分工合作#
- **CUDA**：处理GPU层次的并发（大规模数据并行）
- **MPI**：处理节点间的并发（跨节点通信）
- 每个GPU可由一个MPI进程负责（非必须）

### 设备间数据传输（传统方式）#

```
Sender:
  数据从设备内存 → host缓冲区  (cudaMemcpyDeviceToHost)
  MPI_Send(host_buffer, ...)

Receiver:
  MPI_Recv(host_buffer, ...)
  数据从host缓冲区 → 设备内存  (cudaMemcpyHostToDevice)
```

### 使用统一寻址（Unified Memory，CUDA 6.0+）#

- 在Host内存与Device显存之间根据访问需要自动迁移数据
- Host和Device都可访问同一指针
- 需要显式同步保证数据更新完成

```c
__device__ __managed__ int ret[1000];

__global__ void AplusB(int a, int b) {
    ret[threadIdx.x] = a + b + threadIdx.x;
}

int main() {
    AplusB<<<1,1000>>>(10, 100);
    cudaDeviceSynchronize();  // 同步等待kernel完成
    for (int i = 0; i < 1000; i++)
        printf("%d: 10+100+%d = %d\n", i, i, ret[i]);
    return 0;
}
```

### GPUDirect P2P（Peer-to-Peer）#

- 同一节点内多个GPU直接进行内存拷贝，无需经过主存
- 减少延迟和带宽瓶颈

### GPUDirect RDMA（Remote Direct Memory Access）#

- 数据从GPU内存直接推送到网卡，无需CPU参与
- 避免数据额外存储和传输
- 性能显著提升

```c
// 使用GPUDirect RDMA，无需显式host拷贝
if (0 == rank) {
    MPI_Send(device_buffer, size, MPI_CHAR, 1, tag, MPICOMM_WORLD);
} else {
    MPI_Recv(device_buffer, size, MPI_CHAR, 0, tag, MPICOMM_WORLD, &status);
}
```

---

## 举例：MPI+CUDA计算π#

### 空间分解#
- 每个MPI进程负责 `1/nproc` 范围的离散求和
- 每个MPI进程内：`NUM_BLOCK × NUM_THREAD` 个CUDA线程进行求和

### 核心Kernel#
```c
__global__ void cal_pi(float *sum, int nbin, float step, float offset,
                     int nthreads, int nblocks) {
    int i;
    float x;
    int idx = blockIdx.x * blockDim.x + threadIdx.x;  // 跨Block的线程索引

    for (i = idx; i < nbin; i += nthreads * nblocks) {
        x = offset + (i + 0.5) * step;
        sum[idx] += 4.0 / (1.0 + x * x);
    }
}
```

### 主程序#
```c
#include <stdio.h>
#include <mpi.h>
#include <cuda.h>

#define NBIN 10000000
#define NUM_BLOCK 13
#define NUM_THREAD 192

int main(int argc, char **argv) {
    int myid, nproc, nbin;
    float step, offset, pi = 0.0, Pi;
    float *sumHost, *sumDev;
    dim3 dimGrid(NUM_BLOCK, 1, 1);
    dim3 dimBlock(NUM_THREAD, 1, 1);

    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPICOMM_WORLD, &myid);
    MPI_Comm_size(MPICOMM_WORLD, &nproc);

    nbin = NBIN / nproc;
    step = 1.0 / (float)(nbin * nproc);
    offset = myid * step * nbin;

    size_t size = NUM_BLOCK * NUM_THREAD * sizeof(float);
    sumHost = (float *)malloc(size);
    cudaMalloc((void**)&sumDev, size);
    cudaMemset(sumDev, 0, size);

    cal_pi<<<dimGrid, dimBlock>>>(sumDev, nbin, step, offset, NUM_THREAD, NUM_BLOCK);

    cudaMemcpy(sumHost, sumDev, size, cudaMemcpyDeviceToHost);
    for (int tid = 0; tid < NUM_BLOCK * NUM_THREAD; tid++)
        pi += sumHost[tid];
    pi *= step;

    MPI_Allreduce(&pi, &Pi, 1, MPI_FLOAT, MPI_SUM, MPICOMM_WORLD);
    if (myid == 0) printf("PI = %f\n", Pi);

    free(sumHost); cudaFree(sumDev);
    MPI_Finalize();
    return 0;
}
```
