## 1. 问题背景

复杂 Agent 系统常采用“Main Agent + Sub-Agent”的结构：

```text
Main Agent
├─ Search Agent
├─ Coding Agent
├─ Test Agent
└─ Review Agent
```

如果 Sub-Agent 只收到任务说明，常出现两类重复：

1. **重复探索**：重新读文件、搜索、调用工具、推理；
2. **重复 Prefill**：即使 Main Agent 直接把原文传给 Sub-Agent，子模型仍要重新计算这些 Token。

因此可以把问题分成两条线：

- **Context Management**：Sub-Agent 应该看到哪些已有信息？
- **KV Cache Reuse**：这些信息已经被模型处理过，能否复用已有计算状态？

---

# 2. Sub-Agent 的 Context 继承与选择

## 2.1 AOrchestra：由 Orchestrator 筛选 Sub-Agent Context

**AOrchestra: Automating Sub-Agent Creation for Agentic Orchestration**  
来源：arXiv:2602.03786  
https://arxiv.org/abs/2602.03786

AOrchestra 把一个 Sub-Agent 表示为：

$$
\Phi=(Instruction,\ Context,\ Tools,\ Model)
$$

也就是说，Orchestrator 不仅决定“Sub-Agent 做什么”，还动态决定：

- 给它什么 Context；
- 给它哪些 Tools；
- 使用哪个 Model。

其中 Context 不是直接复制完整历史，而是经过筛选和压缩的任务相关信息。

论文在 50 个 GAIA validation 样本上做了 Context 消融实验：

| 设置              |     平均分 |
| --------------- | ------: |
| No Context      |     86% |
| Full Context    |     84% |
| Curated Context | **96%** |

这个实验规模较小，但至少说明：**把全部历史都交给 Sub-Agent 并不一定更好。**


**作者明确提到的局限 / 边界：** 当前版本未单列 Limitations，也没有在结论中系统列出方法限制；这里不额外推断。

---

## 2.2 RCR-Router：按角色和任务阶段选择 Shared Memory

**RCR-Router: Efficient Role-Aware Context Routing for Multi-Agent LLM Systems with Structured Memory**  
来源：arXiv:2508.04903  
https://arxiv.org/abs/2508.04903

RCR-Router 维护一份 Shared Memory，每次只为当前 Agent 选择其中一部分。

主要依据包括：

- Agent role；
- 当前 task stage；
- semantic relevance；
- structured memory priority；
- Token budget。

在 HotPotQA、MuSiQue、2WikiMultihop 上，论文报告最多约 **30% Token 消耗下降**，同时维持或提升答案质量。

它研究的核心就是：

> **当前 Agent 应该从 Shared Memory 中看到哪些信息。**


**作者明确提到的局限 / 边界：**

- 论文未单列 Limitations。其理论分析中，greedy routing 的最优性依赖 memory item 的 Token 长度一致；长度不一致时不再保证全局最优。
- 作者把 learned routing、更复杂的 Agent workflow 和 multimodal setting 留作后续扩展。

---

## 2.3 AnyMAC：直接学习“下一步该看哪些历史”

**AnyMAC: Cascading Flexible Multi-Agent Collaboration via Next-Agent Prediction**  
来源：EMNLP 2025  
https://aclanthology.org/2025.emnlp-main.584/

AnyMAC 同时学习两个决策：

1. **Next-Agent Prediction**：下一步由哪个 Agent 工作；
2. **Next-Context Selection（NCS）**：下一 Agent 应该读取哪些历史 step。

因此，下一 Agent 不必固定继承完整历史，也不必只看上一步输出，而可以从任意之前的 step 中选择相关信息。


**作者明确提到的局限 / 边界：**

- 在 HumanEval 上，Next-Context Selection 有时会选择过长 Context，可能让模型被过量信息干扰。
- 作者认为 1,000 条 RL sampling 数据可能不足，可能导致次优收敛；继续扩大 RL sampling 的计算和经济成本较高。

---

## 2.4 DeLM：共享 Verified Context

**Decentralized Multi-Agent Systems with Shared Context**  
来源：arXiv:2606.10662  
https://arxiv.org/abs/2606.10662

DeLM 不依赖中央 Orchestrator，而是维护一份 **Shared Verified Context（共享已验证上下文）**：

```text
Parallel Agents
      ↕
Shared Verified Context
      ↕
   Task Queue
```

Agent 异步领取子任务，读取已有进展，并把紧凑、已验证的新结果写回 Shared Context。

论文在 SWE-bench Verified 上报告，相对最强 baseline 最高提升约 **10.5 个百分点**，同时 task cost 约下降一半。


**作者明确提到的局限 / 边界：**

- admission-time verification 会带来额外开销，作者认为更轻量的 verifier 仍有优化空间。
- 性能依赖 task decomposition：拆得太粗会信息不足，拆得太细又会产生不必要的 Agent 和推理复杂度。
- 不同 model family 没有统一最优 Prompt，实际使用可能需要针对模型调整。

---

## 2.5 Context 不仅要“相关”，还涉及可靠性与时效性

下面这些工作不专门研究“Parent 给 Child 传什么”，但直接涉及 Context 是否可信、是否已经过期。

### Hindsight

**Hindsight: Structured Agent Memory that Retains, Recalls, and Reflects**  
来源：ACL 2026 System Demonstrations  
https://aclanthology.org/2026.acl-demo.27/

Hindsight 把 Memory 区分为 world、experience、observation、opinion 等类型，并显式区分：

- 客观事实；
- 主观判断；
- confidence；
- 时间信息。

因此它不只按“相似度”检索 Memory，还关注信息本身的性质。

**作者明确提到的局限 / 边界：**

- 依赖 LLM 做 fact extraction、entity resolution 和 opinion formation，基础模型的错误可能传播进 Memory Graph。
- 实验主要是英文 LongMemEval / LoCoMo，其他语言没有系统验证。
- opinion evolution 仍缺少正式的用户研究；时间解析也可能漏掉高度含糊或文化相关的时间表达。
- 系统依赖 PostgreSQL + pgvector，部署复杂度高于纯内存方案。

### STALE

**STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?**  
来源：arXiv:2605.06527  
https://arxiv.org/abs/2605.06527

STALE 研究一种更难的情况：

> 后续 observation 已经使旧 Memory 失效，但没有一句话显式说“旧信息错了”。

它构建了 400 个专家验证场景、1,200 个查询；论文报告最强被测模型整体准确率约 **55.2%**。


**作者明确提到的局限 / 边界：**

- benchmark 主要是受控的一次性隐式状态变化；现实环境中的多次更新、连锁状态传播和渐进漂移更复杂。
- 场景由 LLM 生成后再人工验证，且 distractor 主要来自 LongMemEval，仍可能与真实长期对话存在分布差异。
- LLM-as-a-judge 可能漏掉语义上正确但表达不同的回答。
- CUPMem 依赖预定义状态 schema，目前只覆盖有限属性域；schema-free 的状态维护仍留作后续工作。

### Fresh Memory, Stale Plans

**Fresh Memory, Stale Plans: Dependency-Scoped Validation for Distributed LLM-Agent Memory**  
来源：arXiv:2609.03340  
https://arxiv.org/abs/2609.03340

这篇论文指出：

> 即使 Executor 已经拿到最新事实，旧 Plan 仍可能建立在过期事实上。

它提出 PlanFence：让 Plan 记录自己依赖了哪些外部状态；执行动作前，只重新验证真正影响当前 Action 的依赖。

**作者明确提到的局限 / 边界：**

- 实验只覆盖 3 类 workflow、3–8 个 Agent、构造的 keyspace 和有限历史 network trace，压力测试结果不能直接推广到所有 Agent 系统。
- PlanFence 的安全性依赖 benign owner、正确 parent link 和完整 dependency declaration。
- 当前不处理 Byzantine owner、owner migration、隐式 dependency、semantic merge，以及不在 public lineage 中的 private reasoning。
- 多 owner validation 与外部 Action 之间不是原子操作；更强一致性需要 transaction 类机制。

# 3. KV Cache 复用与转换
## 3.1 KVCOMM：同模型、不同 Prefix 下复用同一段内容

**KVCOMM: Online Cross-context KV-cache Communication for Efficient LLM-based Multi-agent Systems**  
来源：NeurIPS 2025  
https://papers.nips.cc/paper_files/paper/2025/hash/1a074a28c3a6f2056562d00649ae6416-Abstract-Conference.html

Multi-Agent 系统里，同一段共享内容可能处在不同的 Prefix 之后：

```text
Agent A: Prefix_A + Shared Content
Agent B: Prefix_B + Shared Content
```

即使两边使用同一个模型，由于 Prefix 不同：

$$
KV_A(\text{Shared})\neq KV_B(\text{Shared})
$$

KVCOMM 把这种差异建模为 **context-induced KV offset（上下文引起的 KV 偏移）**，并用在线维护的 anchor pool 估计和校正这部分偏移。

特点：

- training-free；
- 不要求切换模型；
- 解决的是**同模型、同内容、不同 Prefix**造成的 KV 不兼容。

论文报告多种 Multi-Agent workload 中的 KV reuse rate 超过 70%；在其五 Agent 实验设置中，TTFT 从约 430 ms 降到约 55 ms。


**作者明确提到的局限 / 边界：**

- 当前只研究 text input，多模态 Context 留作后续工作。
- KVCOMM 主要降低 Prefill latency，不直接降低 Decode latency。
- 当前最适合 homogeneous Agent；同 architecture 不同 weights 以及更异构的 Attention 结构仍未充分验证。
- 方法依赖可识别的重复共享片段，不覆盖完全无结构、持续变化且难以分段的 Context。

---

## 3.2 DroidSpeak：同架构模型变体之间的选择性复用

**DroidSpeak: KV Cache Sharing Across Fine-tuned Model Variants**  
来源：USENIX NSDI 2026  
https://www.usenix.org/conference/nsdi26/presentation/liu-yuhan

DroidSpeak 研究的是**架构相同**的不同模型变体，例如同一个基础模型的不同 Fine-tuning 或 LoRA 版本。

对于相同 Context：

$$
KV_A\neq KV_B
$$

直接把 Sender 的全部 KV 给 Receiver，会明显损害质量。

论文逐层测试后发现：

> **只有少量 Layer 对跨模型 KV 偏差特别敏感。**

这些 Layer 被称为 **Critical Layers（关键层）**。在论文测试的 model pairs 中，Critical Layers 平均约占 11%。

因此：

```text
非关键 Layer → 直接复用 Sender KV
关键 Layer   → Receiver 重算
```

实际系统不会只重算几个离散 Layer，而是选择连续的 recomputation group，以减少 E Cache 切换和表示误差。

系统还会：

- 离线 profiling 不同重算区间；
- 在线按系统负载选择配置；
- 让 KV Transfer 和关键层 Recomputation 并行。

论文报告：

- Prefill 最高加速约 3.1×；
- 在线 throughput 最高约 4×；
- 质量损失较小。

限制：Sender 和 Receiver 需要具有相同 architecture。


**作者明确提到的局限 / 边界：**

- 当前只适用于从同一 foundation model 派生出的模型变体；跨 foundation model 不在本文范围内。
- Runtime 会根据系统负载调整重算比例，但没有同时根据 network bandwidth 自适应。
- Critical Layer 由离线 profiling 得到；如果数据分布发生 drift，可能需要周期性重新 profiling。
- “只有少量 Layer 敏感”是经验现象，作者不保证对所有 model pair 都成立。
- 当前把多模型场景拆成 pairwise reuse，跨多个模型的全局优化留作后续工作。

---

## 3.3 ICaRus：训练时就让不同专用模型产生相同 KV

**ICaRus: Identical Cache Reuse for Efficient Multi-Model Inference**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/37f6be32f832caf0f7980469fb06165b-Abstract-Conference.html

ICaRus 把 Decoder-only Transformer 概念上拆成：

```text
Logical Encoder → 产生 KV
Logical Decoder → 基于 KV 预测 Token
```

训练不同专用模型时：

- 冻结 Logical Encoder；
- 只 Fine-tune Logical Decoder。

于是不同专用模型对同一 Prefix 产生：

$$
KV_A=KV_B=KV_C
$$

这样不需要额外 Translator，就能完整复用 KV。

代价是：模型必须按这种方式训练，不能直接应用到任意已经训练好的模型。


**作者明确提到的局限 / 边界：**

- 论文未单列 Limitations。
- 正文明确指出，如果 Logical Encoder 和 Logical Decoder 顺序执行，同一请求可能因为参数 / KV 被访问两次而带来接近 2× 的延迟；作者用轻量 Adapter 和并行执行来缓解。
- 方法本身要求专用模型按 ICaRus 的方式训练，因此不是对任意已有模型的即插即用方案。

---

## 3.4 C2C：跨模型 Latent Communication，而不是省掉 Target Prefill

**Cache-to-Cache: Direct Semantic Communication Between Large Language Models**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/474ada926b331d78f06d95e8913111cc-Abstract-Conference.html

C2C 的目标不是让 Target 完全跳过自身 Prefill，而是让两个模型直接通过内部 KV 表示交换信息。

Target 本身已有自己的 KV，Source KV 经过 projection 和 fusion 后注入：

$$
KV_B^{fused}=KV_B+F(KV_B,KV_A)
$$

论文还使用 learnable gate 选择哪些 Target Layer 接收这部分信息。

因此 C2C 更准确地属于：

> **跨模型隐空间语义通信（Cross-model Latent Semantic Communication）**

而不是纯粹的 Prefill Reuse。


**作者明确提到的局限 / 边界：**

- 论文未单列 Limitations。
- 作者把更复杂 Fuser architecture 的系统研究、多模态 cache alignment / fusion，以及与 speculative decoding、heterogeneous routing 的结合留作 future work。

---

## 3.5 MoT：训练神经 Translator 进行异构 KV 转换

**Mixture-of-Translators: Translating KV Caches Across Heterogeneous Large Language Models**  
来源：arXiv:2607.28979  
https://arxiv.org/abs/2607.28979

MoT 的目标是：

$$
T_{A\rightarrow B}(KV_A)\approx KV_B
$$

它不是简单的线性矩阵，而是需要训练的神经 Translator。

一个 Translator 大致包括：

1. 分别处理 K 和 V；
2. 把 Source KV 投影到 Translator hidden space；
3. 用递归式 Cross-Attention 融合多个 Source Layer；
4. 再投影到 Target KV space。

MoT 不只使用一个 Translator，而是使用多个结构相同、参数不同的 Translator，并通过**Token-level learned routing**决定每个 Token 使用哪个 Translator。

训练时：

```text
同一段 Context
   ↓              ↓
Source Model     Target Model
   ↓              ↓
KV_A            Native KV_B
   ↓
MoT Translator
   ↓
Predicted KV_B
```

训练目标不只是让 KV 数值接近，还加入 **Context Correction Loss（上下文校正损失）**，让 Target 使用 translated KV 后的运行轨迹接近正常 Prefill 时的轨迹。

论文还分析了两个问题：

- **Propagated Translation Shift（传播式翻译偏移）**：注入太早，翻译误差会经过很多 Layer 继续放大；
- **Last-State Shift（末状态偏移）**：注入太晚，Target 剩余 Layer 不足以修正误差。

实验覆盖 Qwen2.5、GPT-2、OPT 的同构和异构模型组合。

需要注意：

> MoT 是针对具体 Source → Target model pair 训练 Translator，并没有证明一个 Translator 可以直接适配任意模型。


**作者明确提到的局限 / 边界：**

- MoT 能减轻 translation shift，但不能直接提升 Target 自身的 correction ability，因此 correction deficit 仍存在。
- Channel mapping 主要依赖 relative depth；当两个模型的 instruction tuning、训练分布或内部表示组织差异很大时，这种映射可能变弱。
- 作者明确指出，跨 Tokenizer 的 KV translation 仍未完全解决：Tokenizer 不同时，Source / Target 的 cache position 本身就难以一一对齐。

---

## 3.6 Closed-form Cross-Model KV Transfer：部分模型对存在近似线性关系

**Cross-Model KV Cache Transfer in LLM Families: A Closed-Form Linear Mapping for Prefill Reuse**  
来源：arXiv:2608.03893  
https://arxiv.org/abs/2608.03893

论文首先研究的是 **matched-KV pairs**，即：

- KV Head 数量相同；
- 每个 KV Head 的维度相同。

核心发现：

> 部分同一 model family、不同尺寸的模型之间，KV 存在较强的线性关系。

方法：

1. 为每个 Target Layer 选择最相关的若干 Source Layer；
2. Key 先去掉 Source RoPE；
3. 按 Layer、按 KV Head 做 Ridge Regression；
4. 再加入 Target RoPE；
5. Value 直接映射。

可粗略写成：

$$
\tilde K_B=W_K\tilde K_A+b
$$

论文用 500 条 FineWeb-Edu、每条 1024 Token 做 Calibration。

六个 model pair 中：

- 4 个保留约 73–98% 的 Target native accuracy；
- 2 个明显失败；
- 使用非线性 MLP 后，可以恢复部分失败 model pair 的表现。

Mapper application 比重新 Prefill 快约 2.7–25×。


**作者明确提到的局限 / 边界：**

- Calibration 只使用 FineWeb-Edu，没有验证医学、法律等专业领域是否仍能保持同样映射质量。
- top-k Source Layer 的选择与部分报告指标使用了相同的 validation benchmark，因此不是完全独立的 out-of-sample 选择。
- 六组实验全部是 matched-KV pair；KV Head 数或 per-head dimension 不匹配的情况没有验证。
- 实验集中在同 family、dense full-attention 模型，hybrid attention、recurrent architecture 等不在本文范围内。

---

## 3.7 CacheBridge：让线性 KV Mapping 更小、更快、更稳

**CacheBridge: Efficient Cross-Model KV Cache Transfer**  
来源：arXiv:2609.00891  
https://arxiv.org/abs/2609.00891

CacheBridge 继续改进上面的 closed-form mapping。

原来的 Full-Head Mapping 会让一个 Target KV Head 读取很多 Source KV Head，带来：

- Mapper 参数多；
- 执行成本高；
- 无关 Head 可能引入噪声。

CacheBridge 做了三项主要修改：

1. **Matched-head mapping**：每个 Target Head 只从匹配的 Source Head 读取信息；
2. **Attention-aligned Calibration（注意力对齐校准）**：对真正影响 Attention 行为的 KV 误差赋予更高权重；
3. **Fused Mapper Construction**：直接计算 weighted sufficient statistics，减少 Calibration 阶段的内存和时间开销。

论文报告：

- 修复了两组原方法明显掉点的 Ministral 3 transfer；
- Qwen3 上平均保持 99.83% 的 Target performance retention；
- Qwen3 14B → 32B 的 Mapper storage 降低 8×；
- Mapper application 最多加速约 3×；
- 500 条 Calibration 数据下，Mapper construction 从 92.63 s 降到 8.63 s。


**作者明确提到的局限 / 边界：**

- 当前只验证 same-family transfer。
- 所有实验模型都是 dense GQA，并且 Source / Target 的 KV Head 数匹配；Head 数不匹配、sparse / sliding-window / linear / hybrid attention 尚未验证。
- 质量评估主要是 immediate continuation，包括选择题准确率和 teacher-forced NLL；没有系统测试开放式 multi-turn generation。
- 作者指出 repeated handoff 可能积累误差。

---

## 3.8 Universal Context-Reuse Layer：探索跨 model family 的 Context Mobility

**A Universal Context-Reuse Layer for Cross-Model KV Sharing**  
来源：arXiv:2608.30963v1  
https://arxiv.org/abs/2608.30963

这篇论文把目标扩展到 Source 和 Target 在以下方面都可能不同：

- model scale；
- Layer 数；
- Attention 配置；
- Tokenizer；
- model family。

论文把这种能力称为 **Context Mobility（上下文迁移性）**。

公开实验包括：

- Qwen2.5-7B → Qwen2.5-1.5B；
- Qwen2.5-1.5B → Gemma-2-2B；
- Llama-3.1-70B → Qwen2.5-7B。

其中 Llama-3.1-70B → Qwen2.5-7B 的实验报告：

- Target 正常 Prefill accuracy 约 45.7%；
- KV handoff 后约 44.0%；
- measured handoff latency 约从 899 ms 降到 138 ms。

需要注意：当前 v1 对实验结果和整体设计目标描述较多，但没有像 MoT、Closed-form Transfer、CacheBridge 那样公开到足以直接重建核心 Transport Module 的细节。

因此更适合把它理解为：

> **跨 model family KV handoff 可行性的实验性证据。**

---

# 4. Reasoning Effort 与 KV Cache


**作者明确提到的局限 / 边界：** 当前 v1 未单列 Limitations。作者将论文结果表述为支持 Context Mobility 的 **initial evidence（初步证据）**，没有宣称已经覆盖所有跨模型组合。本文不把第三方对 Transport Module 细节不足的批评写成作者自述局限。

## 4.1 先区分“Reasoning Effort”和“是否开启 Thinking”

### gpt-oss：真正的 low / medium / high Reasoning Effort

gpt-oss 官方 Harmony format 把 **Reasoning Effort（推理强度）**写入 system message：

```text
Reasoning: low
Reasoning: medium
Reasoning: high
```

来源：OpenAI Harmony format  
https://github.com/openai/harmony/blob/main/docs/format.md

gpt-oss model card 说明，它在训练时支持这三档 Reasoning Effort；Effort 越高，平均 CoT 长度越长。

这属于：

> **同一个模型、同一个任务，用不同计算预算进行推理。**

### Qwen3 / GLM：主要控制 Thinking On / Off

Qwen3 的：

```text
enable_thinking=True / False
/think
/no_think
```

以及 GLM 的 `enable_thinking`，主要控制是否进入 Thinking Mode。

Qwen3：  
https://github.com/QwenLM/Qwen3/blob/main/docs/source/getting_started/quickstart.md

GLM：  
https://github.com/zai-org/GLM-4.5

这和 low / medium / high Reasoning Effort 不是同一个问题。

另外，如果 Chat Template 的变化只发生在长 Context **之后**，由于 causal attention，前面的 Context KV 仍然可以完全相同。因此不能仅凭“Chat Template 不同”就断言整段 Context KV 必须重算。

---

## 4.2 Ares：动态选择每一步的 Reasoning Effort

**Ares: Adaptive Reasoning Effort Selection for Efficient LLM Agents**  
来源：arXiv:2603.07915  
https://arxiv.org/abs/2603.07915

Ares 使用 gpt-oss-20b，在多步 Agent 任务中动态选择：

```text
low / medium / high
```

它训练一个轻量 Router，根据：

- interaction history；
- 当前 observation；

预测**完成当前 step 所需的最低 Reasoning Effort**。

训练流程大致是：

1. 先用 high-effort 成功轨迹得到 reference action；
2. 再分别测试 low / medium / high；
3. 找到能稳定得到正确 action 的最低 Effort；
4. 用这些标签训练 Router；
5. 进一步尝试 RL 优化。

论文报告最高约 **52.7% 的 reasoning Token reduction**，同时保持接近 fixed-high 策略的 task performance。

论文还把“同模型不同 Effort 可以保留 / 复用 KV Cache”作为相比 multi-model routing 的优势之一；但它的主体实验研究的是 **Reasoning Effort routing 和 Token cost**，不是专门的 KV compatibility 或 cache-hit 实验。


**作者明确提到的局限 / 边界：**

- 论文未单列 Limitations。
- 作者指出，在 long-horizon deep research 中，一次低估 Reasoning Effort 就可能产生错误 query 并沿后续步骤传播，因此 Router 需要很高的判断精度。
- 系统的绝对性能仍受 backbone model 能力上限约束。
- 作者把 multimodal input 的扩展留作 future work。

---

## 4.3 Efficient Reasoning on the Edge：让 Chat / Reasoning Mode 共享 Prompt KV

**Efficient Reasoning on the Edge**  
来源：arXiv:2603.16867，Qualcomm AI Research  
https://arxiv.org/abs/2603.16867  
https://qualcomm-ai-research.github.io/llm-reasoning-on-edge/

它使用：

```text
Chat Mode      = Base Model
Reasoning Mode = Base Model + Reasoning LoRA
```

系统先用 Base Model 编码 Prompt，再用 final-layer prompt hidden states 的 mean pooling 表示训练一个轻量 switcher，判断是否需要启用 Reasoning LoRA。

关键设计是：

> **Prompt 始终只由 Base Model 编码。**

Reasoning LoRA 被训练成直接基于 Base Model 产生的 Prompt KV 继续 Decode。

因此：

```text
Prompt
  ↓
Base Model Prefill
  ↓
Shared Prompt KV
  ├─ Chat Mode
  └─ Reasoning LoRA
```

这项工作不做 KV Translation，而是从训练方式上让两种 Mode 天然兼容同一份 Prompt KV。


**作者明确提到的局限 / 边界：** 论文未单列 Limitations。公开实验主要围绕 Qwen2.5-7B 和 mobile / edge deployment 展开；作者没有在文中给出跨更多 base model family 的系统性验证。

---

## 4.4 Beyond Speedup：用 KV 判断应该 Fast Thinking 还是 Slow Thinking

**Beyond Speedup — Utilizing KV Cache for Sampling and Reasoning**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/d147f24cac1b6cd88753ca830e462bdc-Abstract-Conference.html

这篇论文把 KV Cache 当作一种无需额外 forward 即可获得的轻量内部表示，并用于：

- Chain-of-Embedding；
- Fast / Slow Thinking Switching。

在 Qwen3-8B 和 DeepSeek-R1-Distil-Qwen-14B 上，它从 KV 中提取 representation，用来判断当前是否需要更长、更慢的 Reasoning。

论文最高报告约 **5.7× 的 generated Token reduction**，同时保持较小 accuracy loss。

它解决的是：

> **根据 KV 决定采用哪种 Reasoning Mode。**

而不是把 low-effort KV 转换成 high-effort KV。

---

# 5. 直接操纵或复用 Reasoning State KV 的工作


**作者明确提到的局限 / 边界：** 论文未单列 Limitations。作者明确承认，从 KV 提取的 representation 弱于专门训练的 embedding；本文主要验证了 Chain-of-Embedding 和 Fast / Slow Thinking Switching 两类用途。

## 5.1 Deliberation in Latent Space：用 Coprocessor 增强 KV

**Deliberation in Latent Space via Differentiable Cache Augmentation**  
来源：ICML 2025  
https://proceedings.mlr.press/v267/liu25bc.html

这篇工作研究：

> 额外思考是否一定要通过生成更多显式 Reasoning Token 来实现？

Base LLM 保持冻结，额外训练一个 **Coprocessor（协处理器）**：

```text
Existing KV
   ↓
Coprocessor
   ↓
Latent Embeddings
   ↓
Augmented KV
   ↓
Base LLM Decode
```

Coprocessor 使用 language-modeling loss 在普通 pretraining data 上端到端训练。

目标不是生成显式 CoT，而是把额外 computation 直接压进后续 Decode 可使用的 KV / latent state。

论文报告这种 cache augmentation 可以降低后续 Token perplexity，并改善多种 reasoning-intensive task。


**作者明确提到的局限 / 边界：** 论文未单列 Limitations。作者把更大模型、多个 modular Coprocessor、不同 Coprocessor architecture 和更多 downstream task 留作 future work。

---

## 5.2 KV Cache Steering：直接修改已有 K/V

**KV Cache Steering for Controlling Frozen LLMs**  
来源：arXiv:2507.08799  
https://arxiv.org/abs/2507.08799

它从正 / 负 Reasoning 样例的 K、V 中计算 **Mean-of-Differences steering tensors（均值差引导张量）**：

$$
S_l^K,\quad S_l^V
$$

Prefill 完成后，对指定 Token position 的已有 KV 做一次性修改：

$$
K_l^*=K_l+c^KS_l^K
$$

$$
V_l^*=V_l+c^VS_l^V
$$

之后正常 Decode。

它：

- 不训练额外网络；
- 不修改模型权重；
- 直接操纵 KV。

实验表明，可以增强显式多步 Reasoning，并控制 stepwise、causal、analogical 等不同 Reasoning style。


**作者明确提到的局限 / 边界：**

- 实验主要关注小型 LLM 的 reasoning induction，只补充验证了一个更大模型；更大规模模型和更多任务域仍待验证。
- 作者也指出 steering 技术可能被用于诱导有害、欺骗性或带偏见的行为，因此存在 misuse 风险。

---

## 5.3 Memory Inception：把外部 guidance 编码成额外 KV Bank

**Memory Inception: Latent-Space KV Cache Manipulation for Steering LLMs**  
来源：arXiv:2605.06225v2  
https://arxiv.org/abs/2605.06225

Memory Inception 是一种 training-free 方法。

它先用冻结模型把：

- descriptor；
- summary；
- retrieved fact；
- reasoning heuristic；

编码成额外的 latent KV bank，然后只把这些 KV slots 注入选定的 Layer、Attention Head 或 KV Group。

普通 Prompt KV 保持不变：

```text
Prompt KV
   +
Side KV Bank
   ↓
Attention
```

论文还使用 pre-RoPE canonical Key storage，使 KV Bank 更容易跨位置复用。

它主要研究 behavior steering、可更新 guidance 和 structured reasoning，而不是不同 Reasoning Effort 之间的 KV 对齐。


**作者明确提到的局限 / 边界：**

- 不同任务族使用不同 judge / scoring protocol，因此跨任务结果只能间接比较，没有统一 aggregate score。
- KV Bank 的质量依赖任务：过于 noisy、过细或过宽的 slot 都可能失效，selector 仍需要按任务校准。
- 效果依赖 backbone；论文观察到 Qwen3 最稳定，而 Llama 上 control / quality trade-off 更明显。
- Cache 分析主要统计 KV storage，不等同于真实端到端 latency 或 allocator-level VRAM 节省。
- 作者还讨论了隐藏 guidance 被滥用的安全风险。

---

## 5.4 KaVa：用 Teacher 的压缩 KV 监督 Latent Reasoning

**KaVa: Latent Reasoning via Compressed KV-Cache Distillation**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/d2ca35069eb6e9cbd2a37bf90ba9091c-Abstract-Conference.html

KaVa 将 Teacher 长 CoT 对应的 KV Cache 压缩，再把它作为 self-distillation signal 训练 latent-reasoning student。

重点是：

> **即使压缩后的 KV 和显式 Reasoning Token 没有一一对应关系，它仍然可以携带有用的推理信息。**

它属于 training / distillation 场景，而不是 runtime Reasoning Effort switching。


**作者明确提到的局限 / 边界：** 论文未单列 Limitations。Conclusion 明确指出，latent reasoning 的进一步提升仍依赖大规模训练数据来学习新的 reasoning dynamics。

---

## 5.5 与“失败后继续思考”有关，但不属于 KV Translation 的工作

### Thought Rollback

**Toward Adaptive Reasoning in Large Language Models with Thought Rollback**  
来源：ICML 2024  
https://proceedings.mlr.press/v235/chen24y.html

Thought Rollback 允许模型发现 Reasoning error 后回到之前的 Thought，再把 trial-and-error 信息写入 Prompt 继续探索。

它做的是：

> **Text / Thought-level rollback**

而不是 KV-level state translation。


**作者明确提到的局限 / 边界：** 论文未单列 Limitations，也没有在结论中明确列出 future work；这里不额外推断。

### Reasoning Cache

**Reasoning Cache: Continual Improvement Over Long Horizons via Short-Horizon RL**  
来源：arXiv:2602.03773  
https://arxiv.org/abs/2602.03773

这里的 “Reasoning Cache” **不是 Transformer KV Cache**。

它通过：

```text
一轮 Reasoning
↓
压成 Summary
↓
基于 Summary 继续下一轮 Reasoning
```

把上一轮 Reasoning 压缩成较短状态，再继续更长 horizon 的推理。


**作者明确提到的局限 / 边界：**

- 训练过程没有直接优化 summary generation，作者认为跨多轮 credit assignment 较困难。
- 每轮局部 reward 容易偏向短期有效策略，难以奖励“当前看似较差、但对后续有帮助”的远期 reasoning。
- summary-conditioned generation 并非对所有模型都同样有效，尤其专门的 reasoning model 可能 instruction following 较弱。
- 并非所有任务都受益；search-heavy 问题可能在 Summary 中丢失关键细节。
- 当前主要依赖可验证 outcome reward，开放式任务仍留作后续工作。

### ArborKV

**ArborKV: Structure-Aware KV Cache Management for Scaling Tree-based LLM Reasoning**  
来源：ICML 2026 / arXiv:2605.22106  
https://arxiv.org/abs/2605.22106

ArborKV 面向 Tree-of-Thoughts 的：

- branch；
- backtracking；
- branch reactivation；

管理不同 Reasoning branch 对应的 KV Cache。

它根据 tree topology 和 branch utility 决定：

- 哪些 KV 保留；
- 哪些 eviction；
- 哪些在分支恢复时 rehydrate。

论文报告最高约 **4× 的 peak KV memory reduction**。

它研究的是**已有 Reasoning branch 的 KV 管理和恢复**，不是把一种 Reasoning Effort 的内部状态翻译成另一种。

---

# 6. 关系总结


**作者明确提到的局限 / 边界：** 当前论文版本未单列 Limitations / Future Work；这里不使用第三方 review 对模型规模或硬件范围的评价作为作者自述。

## 6.1 Context 继承

| 工作 | 主要问题 | 主要方法 |
|---|---|---|
| AOrchestra | Sub-Agent 应该获得什么 Context | Orchestrator 动态筛选和压缩 |
| RCR-Router | 当前 Agent 应该看到 Shared Memory 的哪一部分 | role、task stage、semantic relevance、budget |
| AnyMAC | 下一 Agent 应该访问哪些历史 step | learned Next-Context Selection |
| DeLM | Multi-Agent 应该共享哪些进展 | compact verified updates |
| Hindsight | Memory 如何区分事实、观察和判断 | 类型化 Memory、confidence、时间过滤 |
| STALE | 旧 Memory 是否已经失效 | 检测 implicit conflict 和 state change |
| PlanFence | Action 前应该重新验证哪些依赖 | 只验证当前 Plan 真正依赖的状态 |

## 6.2 KV Cache 复用与转换

| 工作 | 模型 / Context 关系 | 核心方法 | 是否训练 Translator |
|---|---|---|---:|
| KVCOMM | 同模型、不同 Prefix | 在线估计并校正 KV offset | ❌ |
| DroidSpeak | 同 architecture 模型变体 | 大部分 KV 复用 + Critical Layer 重算 | ❌ |
| ICaRus | 按统一方式训练的专用模型 | 训练时直接让 KV 相同 | 不需要 |
| C2C | 异构模型 | neural projection + KV fusion | ✅ |
| MoT | 异构 model pair | 多个 Cross-Attention Translator + learned routing | ✅ |
| Closed-form Transfer | matched-KV model pairs | Ridge Regression linear mapping | ❌ |
| CacheBridge | 异构 / matched model pairs | matched-head affine mapping + attention-aligned calibration | ❌ |
| Universal Context-Reuse | 跨 scale、architecture、model family | cross-model transport，公开细节有限 | 公开版本未充分展开 |

## 6.3 Reasoning 与 KV

| 工作 | 主要问题 | KV 的作用 |
|---|---|---|
| Ares | 每一步选择 low / medium / high Reasoning Effort | 论文把跨 Effort KV reuse 作为优势 |
| Efficient Reasoning on the Edge | Chat / Reasoning Mode 动态切换 | 训练设计保证共享 Prompt KV |
| Beyond Speedup | Fast / Slow Thinking Switching | KV 作为 routing representation |
| Deliberation in Latent Space | 不生成长 CoT 也增加额外 computation | Coprocessor 增强 KV |
| KV Cache Steering | 低成本改变 Reasoning behavior | 直接修改 K/V |
| Memory Inception | 持久、可更新的 guidance | 注入额外 KV Bank |
| KaVa | Latent Reasoning supervision | 压缩 Teacher KV 做 distillation |
| ArborKV | Tree Reasoning branch 管理 | 保存、evict 和 rehydrate branch KV |

---

# 7. 三个容易混淆的问题

## 7.1 Context Selection

> **哪些已有信息应该给另一个 Agent？**

主要工作：AOrchestra、RCR-Router、AnyMAC、DeLM。

## 7.2 Context Computation Reuse

> **这些信息已经被模型处理过，另一个 Context 或另一个 Model 能不能复用已有 KV？**

主要工作：KVCOMM、DroidSpeak、ICaRus、MoT、Closed-form Transfer、CacheBridge 等。

## 7.3 Reasoning-State Manipulation / Reuse

> **模型已经形成一定 Reasoning State 后，能不能继续利用、增强、修改或恢复这些计算状态？**

相关工作包括：

- Deliberation in Latent Space；
- KV Cache Steering；
- Memory Inception；
- KaVa；
- ArborKV。

这三个问题有关联，但研究对象不同，不能简单把“传 Context”“共享 Prompt KV”“改变 Reasoning Effort”“修改 Reasoning KV”视为同一个问题。
