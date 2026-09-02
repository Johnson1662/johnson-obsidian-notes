### 1. 背景

相同 business（业务租户）的请求往往共享稳定 prefix（前缀），复用其 KV Cache 可以省掉重复 Prefill（预填充计算）。

但存在矛盾：

* **普通负载均衡**：请求分散 → 负载均衡，但缓存命中低。
* **固定亲和路由**：同一 business 固定服务器 → 缓存命中高，但流量倾斜导致热点服务器，恶化 p99（第 99 百分位延迟）。

目标：**同时获得 cache locality（缓存局部性）与 load balance（负载均衡）。** ([arXiv][1])

### 2. 理论

CacheRoute 周期性统计每个 business 的请求率 \(\lambda_b\)，生成固定一段时间的路由表。

**① 决定副本数**

$$
k_b=\max\left(1,\left\lceil \lambda_b/q_{\rm cap}\right\rceil\right)
$$

\(q_{\rm cap}\) 是单个推理实例的目标承载能力；超热门 business 才需要 \(k_b>1\)。

**② Warm-set admission（热集合准入）**

总缓存槽：

$$
C=R\times W
$$

按 \(\lambda_b\) 从高到低优先保护热门 business，直到容量耗尽。

**③ LPT placement（最长处理时间优先放置）**

每个 assignment（分配）的预计负载为：

$$
\lambda_b/k_b
$$

从热门 business 开始，将其放到当前预计负载最低的服务器。

请求到达后：

* 已准入 business → 只在固定候选服务器中选当前负载最低者；
* 长尾 business → 使用普通负载均衡。

主 70B 实验中**所有 \(k_b=1\)**：没有单个 business 热到需要多副本；性能提升主要来自 **热门 key 准入 + 单副本稳定亲和 + 全局均衡放置**。([arXiv][1])

### 3. 实验设计

主实验：

* Llama-3.3-70B，FP8（8 位浮点）
* 60×H100
* 30 个 TP2（2 卡张量并行）推理实例
* 半合成真实业务分布：128,824 个 business key
* 平均输入约 1.2K token，可稳定复用的 business prefix 约 180 token
* 与 Flat-LB（普通负载均衡）、Sticky（固定亲和）、CHWBL（有界负载一致性哈希）、DualMap、Preble 五种 baseline（基线方法）比较

核心指标：

* KV Cache hit rate（KV 缓存命中率）
* p99 latency（第 99 百分位延迟）
* SLO capacity（满足服务等级目标时的最大 QPS）
* Load imbalance（负载不均衡程度）

主 SLO（服务等级目标）：

$$
p99\le3.5s
$$

另外做：

* 第二套流量分布验证；
* 8B 消融实验；
* 人工超级热门 key 测试 \(k_b>1\)；
* burstiness（突发流量）测试；
* workload drift（流量分布漂移）测试；
* 两个 32B 负面案例。([arXiv][1])

### 4. 实验结果

主 70B 实验：

| 方法             |    KV 命中率 | 3.5s SLO 容量 | 100 QPS 时 p99 |
| -------------- | --------: | ----------: | ------------: |
| Flat-LB        |     64.1% |      42 QPS |          5.7s |
| Sticky         |     87.3% |      30 QPS |          8.5s |
| Preble         |     72.0% |      76 QPS |          3.8s |
| **CacheRoute** | **93.2%** | **176 QPS** |      **1.8s** |

即 CacheRoute 的 SLO 容量约为最强 baseline 的 **2.3×**。([arXiv][1])

消融实验进一步说明：

```text
Flat-LB
KV 56% / imbalance 1.00× / 240 QPS

+ Affinity（亲和）
KV 88% / imbalance 3.46× / 240 QPS

+ Replication（多副本）
KV 88% / imbalance 2.60× / 240 QPS

+ LPT
KV 90% / imbalance 1.24× / ≥500 QPS
```

因此核心结论不是“缓存命中率越高越好”，而是：

> **高缓存复用 + 低负载倾斜必须同时成立。** ([arXiv][1])

### 5. 局限性

CacheRoute **不是普遍优于负载均衡**。

它要求：

* 有稳定 routing key（路由标识）；
* 存在足够长、足够频繁复用的 prefix；
* 请求率在至少一个缓存预热周期内相对可预测。

两个 32B workload（工作负载）中，缓存收益不足时，CacheRoute 分别只有 Flat-LB 的 **0.50–0.67×** 容量和 **1.0×** 容量。([arXiv][1])

其他限制：

* 当前 admission（准入）假设 prefix 大小近似一致，不支持精确按字节优化；
* 长尾请求仍可能驱逐热缓存；
* 流量变化后重新规划会造成大量 cache churn（缓存映射变动）和重新预热；
* 半合成数据不能覆盖所有真实业务；
* 作者尝试的解析缓存驻留模型误差较大。

因此作者建议上线前用 **Shadow Replay（影子流量回放）**真实测量缓存命中、负载和 p99，确认性能改善后再启用。([arXiv][1])

