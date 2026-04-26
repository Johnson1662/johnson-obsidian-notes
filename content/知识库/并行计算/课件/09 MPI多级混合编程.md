# MPI多级混合编程

汤善江 副教授

天津大学智能与计算学部

tashj@tju.edu.cn

http://cic.tju.edu.cn/faculty/tangshanjiang/

# Outline

• 多级混合编程概述  
• MPI+OpenMP混合编程  
• MPI+CUDA混合编程

# 计算机系统性能提升方法

• Scale Up模式

• 单个计算节点计算能力越来越强大

![](images/747c5653fef08f3f296b334481be33b98abc2bc0410d2d30b49ca412e9c08707.jpg)

# 计算机系统性能提升方法

# • Scale Up模式

. 单个芯片和计算节点计算能力越来越强大

• CPU（单核-〉多核-〉众核），GPU，MIC

![](images/a0d4fc4c129a45775e165974284c3a654c812422f451d4e7f46d60a0f2cd3452.jpg)  
Dual cores

![](images/9b1556bca3fb637bc629e1df80ff88f663be60c8fecd0371fc3027ac3b190ea0.jpg)

![](images/945d6b4b6a8d2726126b9ed7993533827d61f7730290ab200e660d1dfeeb30d6.jpg)  
Multi-core array

![](images/927a2b5577a0cbdad7133250a9ec241e1f309df27a296251871fa6d7996e34e7.jpg)

![](images/13db095e58be7cdb8ecdd88f2fc9ff98fc8a939c3085761e22125b12a8e3a6e7.jpg)

![](images/a4601fe9eb37f81f7156195d2fc1e8a8e8743858c2ecd772f4801902a539ad07.jpg)

![](images/062c773be7d1c6b9d6015bca4d76d79492c295e061828eb36e8fa7a5b1446e08.jpg)  
Scalar plus many cores   
Many-core array

![](images/455943c2aa99c690482bbbf26015ca40b9f9ebdf290c5b9168da1f1d8f3ac977.jpg)  
GPU

![](images/9a43612561d579ed78b30a3cc86f038da5b5efb56efab5b1812f82b3b1f60180.jpg)  
Xeon Phi

![](images/c18a3bc5cc30543939f60e8944ddd6444fc814af43bd9896e34c7320a910d24e.jpg)  
FPGA

# 计算机系统性能模式

# • Scale Out模式

• 可计算节点的规模越来越大

![](images/11d6f6470eaa5d6cd7b528bda90b113b590bc1e2ee94271c0e72bd1db1821dc5.jpg)

# 计算系统的发展趋势

• 多级化正成为大规模计算系统必然发展趋势

• 多级化计算机发展趋势：Scale Up + Scale Out

例如天河二号：16000个运算节点，每节点配备两颗Xen E5 12核CPU，3个Xeon Phi 57协处理器（运算加速卡），共312万颗计算核心。

![](images/f1631171b256c4ba793b721f428a5e0d8305f524acde41bf7809793d5ecedf2c.jpg)

# 多级并行计算系统

# • SMP节点构成的多核集群架构

• 节点内多个处理器彼此共享内存(OpenMP)  
• 节点间通过互联网络进行连接(MPI)  
• 编程模型：MPI+OpenMP

![](images/ad222ab28bad5f16b4f0e72f05e49097b018eb94215cb8c29fd089b8af6a190e.jpg)

# OpenMP inside of the SMP nodes

# MPI between the nodes via node interconnect

![](images/ca4385e0b6fd2bf14897a3c7beb131940e021e435c283025e8ad65f5ef534e6a.jpg)

# Node Interconnect

# 多级并行计算系统

# . 多GPUs集群架构

• 单个节点内包含多个GPUs (CUDA)   
• 节点间通过互联网络进行连接 (MPI)  
• 编程模型：MPI+CUDA

![](images/7b58bd19b4251baed5171be94ecfc22c7e8a143f3a2cc1b106808af70f781882.jpg)

# Outline

• 多级混合编程概述  
• MPI+OpenMP混合编程  
• MPI+CUDA混合编程

# MPI VS Thread

MPI 描述了多个进程间的并行化（独立的地址空间）  
• 通常面向分布式网络计算环境，以消息发送接收的方式进行通信  
线程并行化提供了进程内部的共享内存模式  
• OpenMP是一个常用的线程并行化模型。基于用户通过提供制导语句，线程的创建和管理由编译器负责。

![](images/e73fcbd48ebb49cbef47ee5c9c0482f01cc3a567d0d874eb213680b7292347fd.jpg)

![](images/60fa33a153b63f0020d0db5a2080f2753df8cd15d45c2f67ee98d0021be05c54.jpg)

# MPI VS OpenMP

# • 纯MPI优点：

• 高可扩展性  
• 高可移植性  
节点间扩展

# • 纯OpenMP优点：

• 容易部署  
• 延迟低   
. 隐式通信  
• 粗粒度和细粒度划分  
. 动态负载平衡

# • 纯MPI缺点：

• 开发调试困难  
• 显式通信  
• 粗粒度划分  
• 负载平衡困难

# • 纯OpenMP缺点：

• 仅运行于共享内存机器  
• 仅节点内可扩展  
• 线程顺序未定义

# MPI+OpenMP

• 概念上简单和简洁，两级并发   
. 适合多核节点架构  
• 缓解纯MPI的可扩展性问题，降低进程数和网络洪水。

# Pure SMP Node

1 MPI Task

16 Threads/Task

![](images/dcde064cb0b8374789ca81db5e8131943fc7548583aa09d57bdd83eea091b52e.jpg)

4 MPI Tasks

4 Threads/Task

![](images/7ceea07d32247605780951727958753f049d47e102bba78ac2e67e763cae4beb.jpg)

# Pure MPI Node

16 MPI Tasks

![](images/360fe323304a29a0dca9d6953c0e01a4b369e80943840deb1cec7b877e9e52fa.jpg)

![](images/eeb3faeb609023ddda5c5a3f84b15f53ecd2b3e01560b94e0801ed0eea9f0eaf.jpg)

Master MPI Process $^ +$ Worker Thread

![](images/f58c6b6df34ecb191f65a2b9fd6a0e0a9ef157a32f85a46a9ed7ab724eac116d.jpg)

Worker Thread for Master MPl Process

![](images/48adf2af6f3aa5c6a38c7960c88b560f3d85c6fcde4265555de4e9340c535a34.jpg)

Single MPl Process on Core

# MPI+OpenMP混合编程模型

• MPI-only编程

• 每一个MPI进程只有一个执行单元

• MPI+OpenMP编程

• 单个进程内存在多个并发执行线程  
• 所有线程共享所有MPI对象（通信域，请求对象）

![](images/e6f520df2f9e095c01a438f3ad069573122eda3da6882815db1361e8aa120b25.jpg)  
MPI-only 编程模型  
Rank 0

![](images/6ec1a8dc6aabc1628f914c8d11b6cb39027098fc10f86d9cab9f93097c0e6094.jpg)  
Rank 1

![](images/a52d2d90eeb9279a303d1a44cf8ba7de04fdced78939c07c152e9fd263706d8e.jpg)  
MPI+OpenMP编程模型  
Rank 0

![](images/9396b04b2150056c12bc07d254e76c157fd0f80699e6c7321eb37adefb02de73.jpg)  
Rank 1

# MPI+OpenMP混合编程模型

• 每一个进程创建多个OpenMP线程

![](images/b91f0a2c48d3b232ebf741e0179b1b03c0ffee615615f0780c51f55fe7d3cb23.jpg)

# MPI+OpenMP混合编程

• Step1:初始化MPI   
• Step2:在每一个MPI进程中创建一个OMP并行区域

• 串行区域要么是主线程或MPI任务  
• MPI rank对于所有线程而言是已知的。

• Step3:在串行或并行区域调用MPI库  
• Step4:结束MPI

# Program

![](images/b415bd2beeb63ce256dd481928de5e91732721e2f41c99c8c345560cf0bd5d0c.jpg)

# MPI+OpenMP混合编程

# • 混合代码

# Fortran

include'mpif.h' program hybsimp

call MPI_Init(ierr) call MPl_Comm_rank (..,irank,ierr) call MPl_Comm_size (..,isize,ierr)

! Setup shared mem, comp.& Comm

!$OMP parallel do do i=1,n <work> enddo ! compute& communicate

call MPI_Finalize(ierr) end

#include <mpi.h> int main(int argc, char **argv){ int rank, size, ierr, i;

ierr= MPl_Init(&argc,&argv[]); ierr= MPl_Comm_rank (.,&rank); ierr= MPl_Comm_size (...,&size); 7/Setup shared mem, compute & Comm

#pragma omp parallel for for(i=0; i<n; i++){ <work> } // compute& communicate

ierr= MPI_Finalize();

C

# MPI+OpenMP消息通信

# • 单一线程进行通信

通信来自MPI并行区域的单一线程或者串行临界区的

![](images/f114506a8ffe87675ddc251edfda23df8e420ebdba30d6d3f71de6505e79c7e9.jpg)  
rank to rank

# • 多线程进行通信

• 通信来自MPI并行区域的多个线程

![](images/0d6423d0ead8144b68099a8fb214e32d4780252ec231ac38161e09ddf671fb81.jpg)  
rank-thread ID to any rank-thread ID

# 线程中执行MPI调用

• 用MPI_Init_thread来选择和决定MPI线程的支持级别  
. 替换MPI_Init

• MPI2定义了线程调用MPI 4种情况：

• Single表示不支持多线程  
Funneled表示只有主线程能够调用MPI  
• Serialized表示多个线程可以调用MPI，但是一次只允许一个线程调用。  
. Multiple表示任何线程都可以调用。

# MPI2 MPI Init thread

# Syntax:

call MPI_Init_thread( irequired, iprovided, ierr) int MPl_Init_thread(int *argc, char **argv, int required, int *provided) int MPl::Init_thread(int& argc, char**& argv, int required)

<table><tr><td>Support Levels</td><td>Description</td></tr><tr><td>MPI_THREAD_SINGLE</td><td>Only one thread will execute.</td></tr><tr><td>MPI_THREADFUNNELED</td><td>Process may be multi-threaded, but only main thread will make MPI calls (calls are &quot;funneled&quot; to main thread). “Default”</td></tr><tr><td>MPI_THREAD_SERIALIZE</td><td>Process may be multi-threaded, any thread can make MPI calls, but threads cannot execute MPI calls concurrently (MPI calls are &quot;serialized&quot;).</td></tr><tr><td>MPI_THREAD_MULTIPLE</td><td>Multiple threads may call MPI, no restrictions.</td></tr></table>

If supported, the call will return provided $=$ required.

Otherwise, the highest level of support wil be provided.

# 通过主线程进行MPI调用

• MPI _THREAD_FUNNELED   
由于在master workshare construct (OMP_MASTER)中没有隐式的barrier，需要显示调用OMP_BARRIER进行同步  
• 所有其他线程都处于休眠当中。

![](images/5770ef024750096f863d254cb56b608f94a185da940b3ec718d222320123d3ce.jpg)

# 通过主线程进行MPI调用

Fortran   
```txt
include 'mpif.h' program hybmas   
!SOMP parallel   
!SOMP barrier   
!SOMP master   
callMPI_<Whatever>(...,ierr)   
!SOMP end master   
!SOMP barrier   
!SOMP end parallel   
end 
```

C   
```txt
include <mpi.h> int main(int argc, char \*\*argv){ int rank,size, ierr,i; #pragma omp parallel { #pragma omp barrier #pragma omp master { ierr=MPI_<Whatever>(...) } #pragma omp barrier } } 
```

# 在单个线程内进行MPI调用

• MPI _THREAD_ SERIALIZED   
• OMP_BARRIER只需要在开始的时候使用，主要是由于在SINGLEworkshare construct (OMP_SINGLE) 存在隐式的同步。  
• 所有其他线程都处于休眠当中。

![](images/ef8be5789840e62abfc5475367f7b9217f77bacb7c8b840d01aafc5de54fc565.jpg)

# 通过主线程进行MPI调用

# Fortran

```txt
include 'mpif.h'   
program hybsing   
call MPI_init_thread(MPI_THREAD SERIALIZED, iprovided,err) 
```

```txt
!$OMP parallel 
```

```txt
!$OMP barrier 
```

```txt
!$OMP single 
```

```batch
call MPI_<whatever>(...,ierr) 
```

```txt
!$OMP end single 
```

```txt
!!OMP barrier 
```

```txt
!$OMP end parallel end 
```

```c
include <mpi.h>   
int main(int argc, char \*\*argv){   
int rank,size,err,i;   
MPI_init_thread(MPI_THREAD_SERIALIZED, iprovided) 
```

```txt
#pragma omp parallel
{
#pragma omp barrier
#pragma omp single
{
ierr=MPI_<Whatever>(...)
} 
```

```scss
//pragma omp barrier } 
```

C

# MPI_THREAD_MULTIPLE运行模式

• 通常是最灵活的模式，也是最为复杂的  
• 任何的线程可以进行MPI通信，而没有任何约束  
• 各线程调用MPI操作顺序不确定，有潜在错误或死锁风险

![](images/a316606e7a27aa56b6b90ad70bb1cdf6481d8a1fe1388ddf49cdd70b9a8c190c.jpg)

# MPI THREAD MULTIPLE例子

int main(int argc, char ** argv)   
{ int buf[100], provided; MPI_Init_thread(&argc, &argv, MPI_THREADultiple, &provided); if (provided < MPI_THREADultiple) MPI_Abort(MPI_comm_WORLD,1); #pragma omp parallel for for $(\mathrm{i} = 0;\mathrm{i} <   100;\mathrm{i} + + )$ { compute(buf[i]); /\*DoMPI stuff*/ } MPI_Final(); return 0;

# 计算与通信重叠

• 某个线程负责通信，通信过程中其余线程继续执行计算  
• 可提升整体效率，但同步与负载均衡较复杂

<table><tr><td>Fortran</td><td>C</td><td></td></tr><tr><td>include &#x27;mpif.h&#x27; program hybsing</td><td>#include &lt;mpi.h&gt; int main(int argc, char **argv) { int rank, size, ie, i; #pragma omp parallel { if (thread .eq. 0) then call MPI_Whatever&gt;(... ,ie) else &lt;work&gt;endif } $OMP end parallel end</td><td>#include &lt;mpi.h&gt; int main(int argc, char **argv) { int rank, size, ie, i; #pragma omp parallel { if (thread == 0) { ie= MPI_Whatever&gt;(...); } if (thread != 0) { &lt;work&gt; } } }</td></tr></table>

# 举例1：MPI+OpenMP计算π

• 每一个进程负责1/nproc范围的离散求和  
在每一个MPI进程内，nthreads个OpenMP线程负责局部求和计算。

$$
\pi = \int_ {0} ^ {1} \frac {4}{1 + x ^ {2}} d x \approx \sum_ {0 \leq i \leq N} \frac {4}{1 + (\frac {i + 0 . 5}{N}) ^ {2}} \times \frac {1}{N}
$$

![](images/f289059e5ddfb903397b49d50088e8279b64b23bb0eead976a9b4bf2e73436a4.jpg)

# 举例1：MPI+OpenMP计算π：hpi.c

nbin = NBIN/nproc: step = 1.0/(nbin*nproc); #pragma omp parallel private(tid)   
```c
include<stdio.h> #include<mpi.h> #include<omp.h> #define NBIN 100000 #define MAX_THREADs 8 void main(int argc,char \*\*argv){ int nbin,myid,nproc,nthreads,tid; double step,sum[MAX THREADS] = {0.0},pi=0.0,pig; MPI_Init(&argc,&argv); MPI_Comm_rank(MPICOMM_WORLD,&myid); MPI Comm size(MPI COMM WORLD,&nproc); 
```

{ int i; double x; nthreads $=$ omp_get_num Threads(); tid $=$ omp_get_thread_num(); for (i=nbin\*myid+tid; i<nbin\* (myid+1); i+=nthreads){ $\mathrm{x} = (\mathrm{i} + 0.5)^{*}$ step; sum[tid] $= 4.0 / (1.0 + \mathrm{x}^{*}\mathrm{x})$ .} printf("rank tid sum $=$ %d %d %e\n",myid,tid,sum[tid]); } for(tid=0；tid<nthreads；tid++)pi $= =$ sum[tid]\*step: MPI_Allreduce(&pi,&pig,1,MPI_DOUBLE,MPI_SUM,MPICOMM_WORLD); if (myid==0) printf("P1 $=$ %f\n",pig); MPI_Finalize();   
}

OpenMP部分

MPI部分

# 举例1：MPI+OpenMP计算π：hpi.c

# · Compilation

source /usr/usc/mpich/default/gm-intel/setup.csh mpicc -o hpi hpi.ɕ -openmp

# PBS script

```shell
#!/bin/bash
#PBS -1 nodes=2:ppn=1
#PBS -1 walltime=00:00:59
#PBS -o hpi.out
#PBS -j oe
#PBS -N hpi
source /usr/ucp/mpich/default/gm-intel/setup.sh
OMP_NUM Threads=2
export OMP_NUM Threads
WORK_HOME=/auto/rcf-12/anakano/hpc/cs596/
cd $WORK_HOME
np=$(cat $PBS_MODEFILE | wc -l)
mpirun -np $np -machinefile $PBS_MODEFILE ./hpi 
```

# ·Output

```txt
rank tid sum = 1 1 6.434981e+04  
rank tid sum = 1 0 6.435041e+04  
rank tid sum = 0 0 9.272972e+04  
rank tid sum = 0 1 9.272932e+04  
PI = 3.141593 
```

# 举例2：The Multi-Zone NAS Parallel Benchmarks

Multi-zone versions of the NAS Parallel Benchmarks   
• E.g. LU,SP, and BT

![](images/43fd3155a52a7ad4d331214201bd3521470c9bf7c0f92ab104be202528b0f72d.jpg)

<table><tr><td></td><td>MPI/OpenMP</td></tr><tr><td>Time step</td><td>sequential</td></tr><tr><td>inter-zones</td><td>MPI
Processes</td></tr><tr><td>exchange
boundaries</td><td>Call MPI</td></tr><tr><td>intra-zones</td><td>OpenMP</td></tr></table>

# MPI/OpenMP BT-MZ

call omp_set_numthreads (weight)   
call mpi_send/recv   
do step $= 1$ ，itmax call exch_qbc(u，qbc，nx,...)

do zone $= 1$ num Zones if (iam .eq. pzone_id(zone)) then call zsolve(u,rsd,...) end if end do

```txt
enddo 
```

subroutine zsolve(u, rsd,...)   
```txt
...
!$OMP PARALLEL DEFAULT(SHARED)
!$OMP& PRIVATE(m,i,j,k...) do k = 2, nz-1 
```

```fortran
!$OMP DO
do j = 2, ny-1
do i = 2, nx-1
do m = 1, 5
u(m, i, j, k) =
dt*rsd(m, i, j, k-1)
end do
end do
end do 
```

```fortran
!$OMP END DO NOWAIT
end do
...
!$OMP END PARALLEL 
```

# MPI/OpenMP LU-MZ

call omp_set_numthreads (weight)

do step $\ l = \ 1$ ，itmax

call exch_qbc(u，qbc， nx...)

do zone $\ c = ~ 1$ ，num_zones

if (iam .eq.pzone_id(zone)） then

call ssor

end if

end do

end do

# MPI/OpenMP LU-MZ

# . Pipelined Thread Execution in SSOR

subroutine ssor
!\\(OMP PARALLEL DEFAULT(SHARED)
!\\)OMP& PRIVATE(m,i,j,k...) call sync1()
do k = 2, nz-1

```csv
! $OMP DO
do j = 2, ny-1
do i = 2, nx-1
do m = 1, 5
rsd(m, i, j, k) =
dt*rsd(m, i, j, k-1) + ...
end do
end do
end do 
```

```txt
!$OMP END DO await
end do
call sync2()
...
... 
```

```txt
!$OMP END PARALLEL 
```

subroutine sync1
...neigh =iam -1
do while (isync(neigh) .eq. 0)
! $$ OMP FLUSH(isync)
end do
isync(neigh) = 0
! $$ OMP FLUSH(isync)
...
subroutine sync2
...
neigh =iam -1
do while (isync(neigh) .eq. 1)
! $$ OMP FLUSH(isync)
end do
isync(neigh) = 1
! $$ OMP FLUSH(isync)

# Outline

• 多级混合编程概述  
• MPI+OpenMP混合编程  
• MPI+CUDA混合编程

# GPU集群

# • 三级硬件并发

• GPU层— —多处理器上运行的线程  
节点层— 将CPU、GPU和网卡绑定在一起  
• 集群层— 通过互联网络将不同节点连接在一起

![](images/ce07f2759ddb8a4591231ae469f00c05771ecb461dd813531b7f1372b4f23ef8.jpg)

# GPU集群

# • 并发策略

• 节点内采用CUDA进行并发   
• 节点间采用MPI

![](images/4b999a68ed8cd467fe00096d0d4c98bcf4183e0efd1b842fe10595d45061b5fe.jpg)

# MPI+CUDA 并行模式

# • CUDA和MPI分工合作

• CUDA处理GPU层次的并发   
• MPI负责处理节点间的并发  
• 可以每一个GPU由一个MPI进程负责（不是必须）

# • 设备间的数据传输方式

• Sender：

• 将数据从设备内存拷贝到临时的host缓冲区  
• 将host缓冲区数据进行网络发送

# • Receiver

• 接收数据，将其存入host缓冲区  
• 将数据拷贝到设备内存

# MPI+CUDA数据通信

![](images/656a489b9906af6eec99f5bea4b5f2b20d94dd850a80b250c16394267482f4e8.jpg)

if( $0 ==$ rank）{ CUDAMemcpy(host_buffer, device_buffer, size, CUDAMemcpyDeviceToHost); MPI_Send(host_buffer, size, MPI_CHAR, 1, tag, MPICOMM_WORLD); } else{// assume MPI rank 1 MPI_Recv(host_buffer,size,MPI_CHAR,0,tag,MPICOMM_WORLD,&status); CUDAMemcy(device_buffer, host_buffer, size, CUDAMemcpyHostToDevice);   
}

1. 数据从GPU内存拷贝到host A主存  
2. 通过MPI发送到host B  
3. Host B机器接受数据放入host B 主存   
4. 将数据从host B主存拷贝到GPU 内存

# 统一寻址（Unified Memory）

# Managed memory (CUDA6.0起开始支持）

在 host 内存与device显存之间根据访问需要自动迁移数据，同时保证 host 和 device 都可访问，应用程序并不需要知道访问时数据所在位置  
需要进行显式同步（以保证前一步骤中数据更新操作全部完成）

# Unified Memory

# DramaticallyLower Developer Effort

![](images/dea3def4bb969d1c93c31220c0432c864d622cbd1a4e605be4d61745a9c422c3.jpg)  
DeveloperViewToday   
System Memory

![](images/4436572c203e75b2f1bd5dc93270da2d2e3bfa90c1cb18c21f6b1058e3884880.jpg)  
Developer ViewWith UnifiedMemory   
UnifiedMemory

# Nvidia GPUDirect P2P

P2P(Peer-to-Peer)允许同一节点内部的多个GPU直接进行内存数据拷贝，而不需要经过主存。

![](images/9a2ab89c8988c813e2ef358008c949fc6ac0f637cbace4ac5ba83bd5257de016.jpg)  
No GPUDirect P2P

![](images/59e1021b36442adf3371420de3f52b3185a1e8afd19da8caccb9c96a54861597.jpg)  
GPUDirect P2P

# Nvidia GPUDirect RDMA

• 将数据从GPU内存直接推送到网卡，然后通过网络发送到另外一台机器。

• 避免了CPU的参与，提高了性能。  
• 同时不需要往系统主存写数据，避免了数据的额外存储与传输

![](images/a7999eb5f85c06906f6d697d2010335d97466215a2123583f104f0e90b241054.jpg)  
No GPUDirect RDMA

![](images/89ccffb75868de3bb0ad78a12f6c71cac5cf62dafb0b43f5dff15d98a848807e.jpg)  
GPUDirect RDMA

# MPI+CUDA with GPUDirect RDMA

![](images/e917c8baec2dc76d9c98e23dd966e28be3e37c122ad840dd5eda89f4333422f1.jpg)

1.不在需要显式地从设备内存向CPU与系统内存进行拷贝

2.数据直接从本地发送到远程的机器。

```c
if(0 == rank) {
   udaMemcpy(host_buffer, device_buffer, size,udaMemcpyDeviceToHost);
    MPI_Send(device_buffer, size, MPI_CHAR, 1, tag, MPICOMM_WORLD);
} else { // assume MPI rank 1
    MPI_Recv(device_buffer, size, MPI_CHAR, 0, tag, MPICOMM_WORLD, &status);
   udaMemcpy(device_buffer, host_buffer, size,udaMemcpyHostToDevice);
} 
```

# 举例：MPI+CUDA计算π

Spatial Decomposition：每一个MPI进程负责1/nproc范围内的离散求和  
Interleaving：在每一个MPI进程内部，NUM_BLOCK*NUM_THREAD 个CUDA线程进行求和计算。

$$
\pi = \int_ {0} ^ {1} \frac {4}{1 + x ^ {2}} d x \approx \sum_ {0 \leq i \leq N} \frac {4}{1 + (\frac {i + 0 . 5}{N}) ^ {2}} \times \frac {1}{N}
$$

![](images/23511e35aa6c56730c25dae57d230caf4c202d6c89cbb79d29936e214db100cb.jpg)

# 举例：MPI+CUDA计算π：hypi.cu (1)

```c
include<stdio.h> #include <mpi.h> #include <uda.h> 
```

```c
define NBIN 10000000 // Number of bins  
#define NUM_BLOCK 13 // Number of thread blocks  
#define NUM_THREAD 192 // Number of threads per block 
```

13个Block,每个Block192个线程  
```txt
// Kernel that executes on the CUDA device
__global__ void cal_pi(float *sum, int nbin, float step, float offset, int nthreads, int nblocks)
{
    int i;
    float x;
    int idx = blockIdx.x*blockDim.x+threadIdx.x; // Sequential thread index across blocks
    for (i=idx; i<nbin; i+=nthreads*nblocks) { // Interleaved bin assignment to threads
        x = offset + (i+0.5)*step;
        sum[idx] += 4.0/(1.0+x*x);
    }
} 
```

# 举例：MPI+CUDA计算π：hypi.cu (2)

```c
int main(int argc, char **argv) { int myid,nproc,nbin,tid; float step, offset, pi = 0.0, pig; dim3 dimGrid (NUM_BLOCK,1,1); // Grid dimensions (only use 1D) dim3 dimBlock (NUM_THREAD,1,1); // Block dimensions (only use 1D) float *sumHost,*sumDev; // Pointers to host & device arrays MPI_Init (& argc, &argv); MPI_Comm_rank (MPICOMM_WORLD, &myid); // My MPI rank MPI_Comm_size (MPI COMM_WORLD, &nproc); // Number of MPI processes nbin = NBIN/nproc; // Number of bins per MPI process step = 1.0/(float)(nbin*nproc); // Step size with redefined number of bins offset = myid*step*nbin; // Quadrature-point offset size_t size = NUM_BLOCK*NUM_THREAD*sizeof(float); // Array memory size sumHost = (float *)malloc(size); // Allocate array on host CUDAAlloc((void **) &sumDev,size); // Allocate array on device CUDAMemset (sumDev,0,size); // Reset array in device to 0 // Calculate on device (call CUDA kernel) cal_pi << dimGrid, dimBlock >> (sumDev, nbin, step, offset, NUM_THREAD, NUM_BLOCK); // Retrieve result from device and store it in host array CUDAMemcpy (sumHost, sumDev, size,udaMemcpyDeviceToHost); // Reduction over CUDA threads for(tid=0; tid<NUM_THREAD*NUM_BLOCK; tid++) pi += sumHost [tid]; pi *= step; // CUDA cleanup free (sumHost);udaFree (sumDev); printf("myid = %d: partial pi = %f\n", myid, pi); // Reduction over MPI processes MPI_Allreduce(&pi, &pig, 1, MPI_FLOAT, MPI_SUM, MPICOMM_WORLD); if (myid == 0) printf("PI = %f\n", pig); MPI_Final(); return 0; } 
```