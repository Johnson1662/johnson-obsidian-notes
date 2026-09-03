可以按论文原有顺序做**忠实的人话释义**；但不能把公开论文整篇逐段近乎完整翻译成可替代原文的中文版。下面不加入论文之外的观点，只解释作者每部分在说什么。

## Abstract（摘要）

Prefix Cache（前缀缓存）只有在后续请求再次来到**还保存着对应 KV Cache 的服务器**时才有用。普通负载均衡会把请求分散，导致缓存难以复用；把同一类请求固定到一台服务器又容易造成负载不均。

CacheRoute 的办法是：**不要每个请求来了才临时决定，而是周期性提前规划好哪些 key 去哪些服务器，同时考虑缓存复用和服务器负载。**

在主要 70B 实验中，所有 key 实际都只分配给一台服务器，即 \(k_b=1\)。结果是 KV 命中率提高，并在 3.5 秒 p99 SLO 下取得比最强 baseline 高 2.3 倍的容量。但 32B 实验也发现，如果能靠亲和性挽回的 KV 计算太少，CacheRoute 反而会更差，所以作者建议上线前一定实际回放测试。 ([arXiv][1])

---

# 1 Introduction（引言）

作者先提出矛盾：

**普通负载均衡的问题：**同一个业务的请求可能每次去不同服务器。服务器虽然各自有 Prefix Cache，但请求回来得太慢，之前的缓存可能已经被淘汰。

**固定路由的问题：**如果把一个业务永久固定到一台机器，热门业务就可能把这台机器堵死，整个系统的 p99 最终由最忙的机器决定。

所以作者提出 CacheRoute：

> 根据历史业务请求速率，周期性生成一张固定一段时间的路由表。

热门业务优先获得稳定的缓存位置；太热门的业务理论上可以分给多台服务器；然后用 LPT（最长处理时间优先）尽量把总负载放均匀。没有被选中的长尾请求继续使用普通负载均衡。

作者还特别强调：**70B 主实验中没有业务热到需要复制，因此全部 \(k_b=1\)**。所以主实验验证的主要是“热门业务筛选 + 稳定单副本路由 + 均衡放置”，而不是 replication（多副本）。 ([arXiv][1])

---

# 2 Workload and Failure Mode（工作负载与问题来源）

## 2.1 Semi-synthetic aggregate workload

作者模拟的是多租户聊天服务，比如很多公司的客服机器人。

每个 business（业务）都有一段固定上下文，因此同一业务的不同聊天会重复使用这部分 Prefix。

数据不是直接拿真实聊天内容，而是从真实服务统计中提取：

* 每个业务的请求频率；
* 请求间隔；
* 热门程度分布等；

然后生成半合成请求。

主数据有约 12.9 万个业务 key，流量非常不均匀：大约 4% 的 key 占 47% 请求。

平均 Prompt 大约 1200 token，但真正和路由有关、能够稳定复用的是每个业务自己的约 180 token 上下文。全局模板去哪台机器都可能缓存；RAG 获取的 few-shot 内容又经常变化，因此并不是主要路由优化对象。 ([arXiv][1])

## 2.2 Why balancing and stickiness both fail

假如业务 \(b\) 的请求速率为 \(\lambda_b\)，一共有 \(R\) 个服务器，而且请求平均撒到这些机器，那么同一个业务再次访问某台机器的平均间隔大约随

$$
R/\lambda_b
$$

增长。

所以**服务器越多，不一定越容易命中缓存**：请求被撒得更散了。

但完全固定又会让热门业务直接变成热门服务器。

因此作者认为真正需要解决的是：

> 缓存命中带来的计算节省，能不能超过亲和性路由带来的负载不均衡损失。

所以 Cache Hit 高本身并不能说明方案更好。 ([arXiv][1])

---

# 3 CacheRoute

## 3.1 Planning objective（规划目标）

首先估计每个业务的请求速率 \(\lambda_b\)。

### 决定一个业务分给几台服务器

先实际测出一台服务器大概能稳定承受多少负载，记作 \(q_{cap}\)。

然后：

$$
k_b=\max\left(1,\left\lceil\frac{\lambda_b}{q_{cap}}\right\rceil\right)
$$

意思很简单：

**如果一个业务太热门，一台服务器扛不住，就把它分到多台。**

但这个公式只是控制负载，不代表这些服务器上的缓存一定不会被淘汰。

### 决定哪些业务值得占缓存

Cache 容量有限，所以按请求速率从高到低选择业务。

热门业务先获得稳定位置，直到预计的 warm-prefix 空间用完。

### 把业务放到服务器

把选中的业务按照流量从大到小处理，每次尽量放到当前预计负载最低的服务器，也就是 LPT 思路。

运行时：

* 被规划的业务 → 只去自己固定的服务器集合；
* 没被规划的长尾业务 → 普通 Power-of-Two Choices（两随机选择）负载均衡。

所以 CacheRoute 实际分成两阶段：

**离线/周期性规划 → 在线快速查表路由。** ([arXiv][1])

## 3.2 Operational semantics（实际运行方式）

生成的路由表在一个 control interval（控制周期）内保持不变。

这样缓存可以稳定下来，但也有代价：业务流量发生变化后，旧路由可能过时。

换新路由表也有代价，因为很多业务被换到新服务器之后要重新把 KV Cache 热起来。

而且 CacheRoute：

* 不给 KV Cache 预留空间；
* 不搬迁 KV；
* 不保证缓存一定存在；
* 仍然使用推理引擎本身的淘汰机制。

因此作者实际部署前使用 shadow replay（影子回放）测效果，而不是靠公式预测。

作者再次明确：**主 70B workload 全部 \(k_b=1\)，replication 没有贡献主结果。** ([arXiv][1])

---

# 4 Experimental Method（实验方法）

主要平台：

* Llama-3.3-70B；
* FP8；
* 60 张 H100；
* 30 个 TP2 推理 destination。

另有 8B 平台用于拆解机制。

比较六种策略：

Flat-LB、Sticky、CHWBL、DualMap、Preble、CacheRoute。

作者提醒：CHWBL、DualMap 和 Preble 是他们自己在统一实验框架中重新实现的版本，**不能认为是对原论文完整系统的复现。**

Capacity（容量）的定义是：找到仍满足 p99 延迟 SLO 且失败率 ≤5% 时，可以承受的最高测试 QPS。KV 命中率则是真实服务测出来的，不是模拟估计。 ([arXiv][1])

---

# 5 Evaluation（实验结果）

## 5.1 70B on 60 H100 GPUs

这是论文最重要的实验。

3.5 秒 p99 SLO 下：

* CacheRoute：176±11 QPS；
* Preble：76±11；
* Flat-LB：42±20。

所以论文的 **2.3×** 来自 CacheRoute 对最强 baseline Preble 的比较。

CacheRoute KV Hit 为 93.2%。

作者的解释是：Sticky 虽然缓存命中也高，但负载太偏；Preble、CHWBL 负载更均匀，但缓存复用又少一些。CacheRoute 同时维持较高缓存复用和较低热点。 ([arXiv][1])

第二套 workload 并没有完全复现 2.3×。Top-K128 时几个方案甚至打平；Top-K256 时 CacheRoute 才达到 160 QPS，而最好 baseline 是 100 QPS。

作者把这个结果也保留下来，用来说明优势不是固定倍数。 ([arXiv][1])

## 5.2 What creates the improvement?（提升到底来自什么）

作者用 8B 人工加入非常热门的 whale key。

依次增加组件：

Flat-LB → affinity → replication → LPT。

结果发现：

* affinity 大幅提高缓存命中，但负载严重不均，capacity 不变；
* replication 减轻一些负载倾斜，但 capacity 仍没提高；
* 加上 LPT 后负载才明显变均匀，capacity 才大幅提高。

因此作者认为：

**Affinity 负责找回可以复用的计算，而 Placement 负责让这些收益在高负载时真正转化为吞吐能力。**

而且这里的 replication 是因为作者**人工注入 whale** 才真正触发的，不能拿来解释 70B 主实验。 ([arXiv][1])

## 5.3 Operating envelope and negative results

作者专门做了 CacheRoute 失败的实验。

在两个 Qwen3-32B workload 中：

一个 Cache Hit 从 1.1% 提高到 11.8%，但 CacheRoute 容量反而只有 Flat-LB 的 0.50–0.67 倍。

另一个从 0.8% 提高到 8.5%，最终只是和 Flat-LB 打平。

意思就是：

> 如果本来就没有多少 Prefix 计算可以挽救，为了缓存强行固定路由造成的负载不均衡反而更亏。

所以作者要求用 shadow replay 同时比较 KV Hit、每台机器负载和 p99，**只有真正改善 p99 或 capacity 才开启 CacheRoute。** ([arXiv][1])

## 5.4 Burstiness and replanning

### Burstiness

作者测试突发流量后，CacheRoute 的收益有所下降，但仍然明显优于 Flat-LB。

所以作者的结论不是“完全不受 burst 影响”，而是：

**主要收益并不依赖于请求到达特别平滑。**

### Rate drift

业务热度发生变化后，如果重新跑 LPT，竟然有约 94.5% 的 key 会换服务器，即使真正改变 \(k_b\) 的只有约 1.1%。

旧表继续用会慢慢变差；但马上换新表又会导致 Cache 重新预热，短时间命中率明显下降。

因此作者认为：

> 不能频繁重规划，应该等“旧表造成的损失”大于“重新预热缓存的损失”再换。

他们还没有实现真正 churn-aware（考虑迁移代价）的重新规划算法。 ([arXiv][1])

### Why we do not predict residency analytically

作者还尝试直接用数学模型预测 KV Cache 是否还存在。

结果预测误差很大，中位误差达到 14.3 个百分点，p90 达 44.7 个百分点。

因此作者不敢说自己知道底层为什么出现这种 Cache 行为，也不使用这个模型做部署决策。

所以最后还是：

**别算了，直接 shadow replay 实测。** ([arXiv][1])

---

# 6 Discussion and Limitations（讨论与局限）

### 能推广的条件

CacheRoute 至少需要：

1. 有一个稳定的 routing key；
2. 每个 key 有可以反复复用的稳定 Prefix；
3. 对 key 请求速率的估计至少能稳定一个缓存预热周期。

routing key 不一定是 business，也可以是 tenant、document collection、agent 或 application。

### 目前不能很好处理的情况

论文假设每个业务稳定 Prefix 大小差不多，因此用“slot 数”表示缓存容量。

如果不同 Prefix 长度差异很大，这套 admission 方法就不够。

另外：

* 长尾流量仍可能淘汰热门业务缓存；
* workload 没保留所有真实时间戳；
* 只有两个主要分布，不能代表所有应用；
* 部分 baseline 是重实现；
* 一些 8B 实验撞到了测试上限；
* 只有 3 个 seed 的实验统计区间较宽。

作者建议部署流程是：

**测 \(q_{cap}\) → 生成方案 → shadow replay → 比 Flat-LB → 胜出后小流量 canary → 超出适用范围就退回 Flat-LB。** ([arXiv][1])

---

# 7 Related Work（相关工作）

作者把现有工作大致分成几类：

* vLLM / SGLang：解决单个推理引擎内部怎么高效复用 KV；
* Preble / DualMap：请求到来时综合缓存和负载决定去哪；
* Consistent Hash / CHWBL：固定映射，同时限制负载；
* Mooncake / MemServe：直接跨服务器移动或共享 KV；
* Llumnix：迁移请求解决负载不均；
* DistServe / Splitwise：把 Prefill 和 Decode 分开部署。

CacheRoute 的区别是：

**它不移动 KV，也不是每个请求动态决策，而是周期性提前生成一个全局、基于请求速率的路由规划。** ([arXiv][1])

---

# 8 Conclusion（结论）

论文最后把结论压缩成两句话：

**正面结果：**在特定 70B/60-H100/Top-K128 实验中，CacheRoute 达到 93.2% KV Hit，并在 3.5 秒 p99 SLO 下比最强 baseline 提高 2.3× capacity。

**同样重要的负面结果：**如果可挽回的 Prefix 计算量太少，亲和性路由反而会降低性能。

因此作者没有说“CacheRoute 应该普遍替代负载均衡”，而是说：

> **每个实际 workload 都应该先用 shadow replay 测出自己是否处在 CacheRoute 有利的区域。** ([arXiv][1])

---

# Supplementary Material（补充材料）

附录主要是在给正文的结论补证据，没有提出新的核心结论。

### A Workload Detail

进一步列出 workload 数据：约 12.9 万业务、流量 Gini 0.756、多轮请求占 80.8%、平均输入约 1.2K token、真正稳定的 business context 约 180 token。

同时强调不使用真实请求文本和用户内容。 ([arXiv][1])

### B Experiment Provenance and Statistics

解释每个实验到底用了真实 H100 还是模拟器、几个 seed，以及 capacity 是怎么计算的。

作者特别提醒：3-seed 实验置信区间很宽，因此小差异不要过度解释。 ([arXiv][1])

### C Additional 70B Results

FP16 实验缓存压力更大，但所有方法都达不到正文 3.5 秒 SLO，所以作者没有把它算进主要性能结论。

Top-K256 又额外跑了 8 个 seed，CacheRoute 相对 DualMap 的提升只有 **1.33×**，明显低于 headline 的 2.3×。 ([arXiv][1])

### D Arrival-Process Sensitivity

换不同请求到达分布后，CacheRoute 的具体数字变化，但总体优势仍存在。

作者只把它作为敏感性实验，不把结果推广到所有 baseline 或 workload。 ([arXiv][1])

### E Replanning Under Drift

进一步给出前面提到的重规划问题：重新跑 LPT 会产生非常大的 placement churn，因此作者认为未来需要减少无意义迁移的算法。 ([arXiv][1])

### F 8B Sensitivity and Replication Scope

这里进一步验证了你之前问的 **\(k_b\)**。

在普通 8B workload 中，即使改变 \(q_{cap}\)，所有 key 仍然：

$$
k_b=1
$$

真正触发 replication 的仍然是人工加入的 whale。

同时作者发现服务器数量增加也不一定更好：固定总 QPS 时，服务器越多，相同 key 回到某台服务器的频率越低，Prefix 反而可能冷掉。 ([arXiv][1])

### G Negative Hardware Regimes

完整给出了两个 32B 负面实验，进一步证明：

**提高 Cache Hit ≠ 提高系统容量。**

CacheRoute 可能赢、可能平、也可能输。 ([arXiv][1])

### H Analytic Residency Model: Negative Result

再次说明作者尝试预测 KV residency（驻留）失败，因此认为仅知道物理 Cache 容量和业务请求速率，还不足以准确决定 CacheRoute 是否应该开启。

附录最后甚至专门列了 **claim-to-evidence map（结论—证据对应表）**，强调：

* 2.3× 只对应一个具体 70B 实验；
* Top-K256 实际只有 1.33×；
* 第二分布最高是 1.6×；
* 主 workload 中 \(k_b=1\)；
* replication 只由 synthetic whales 验证；
* 32B 实验确实存在输和平的情况。

也就是说，作者自己对 **2.3× 的适用范围限制得非常严格**。 ([arXiv][1])

[1]: https://arxiv.org/pdf/2608.19677 "CacheRoute: Planned Prefix-Affinity Routing for Large-Scale LLM Serving"
