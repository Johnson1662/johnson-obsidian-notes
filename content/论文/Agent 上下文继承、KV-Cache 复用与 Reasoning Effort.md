## 1. 问题背景

复杂 Agent 常采用主 Agent + 子 Agent：

```text
Main Agent
├─ Search Agent
├─ Coding Agent
├─ Test Agent
└─ Review Agent
```

如果子 Agent 只收到任务说明，常出现两类重复：

1. **重复探索**：重新读文件、搜索、调用工具、推理；
2. **重复 Prefill**：即使 Parent 直接把原文传给 Child，Child 仍要重新计算这些 Token。

因此可以分成两类问题：

- **Context Management**：Child 应该看到哪些已有信息？
- **KV-Cache Reuse**：这些信息已经被模型处理过，能否复用已有计算状态？

---

# 2. 子 Agent 的 Context 继承与选择

## 2.1 AOrchestra：由 Orchestrator 生成 Curated Context

**AOrchestra: Automating Sub-Agent Creation for Agentic Orchestration**  
来源：arXiv:2602.03786  
https://arxiv.org/abs/2602.03786

AOrchestra 把一个 Agent 抽象成：

$$
\Phi=(Instruction,\ Context,\ Tools,\ Model)
$$

Orchestrator 每次委派时动态生成这四项，其中 Context 是经过筛选和压缩的 task-relevant history。

论文在 50 个 GAIA validation 样本上做了 Context ablation：

| 设置 | 平均分 |
|---|---:|
| No Context | 86% |
| Full Context | 84% |
| Curated Context | **96%** |

这个实验规模较小，但直接说明：**Full Context 不一定优于选择性继承。**

---

## 2.2 RCR-Router：按角色和阶段路由 Shared Memory

**RCR-Router: Efficient Role-Aware Context Routing for Multi-Agent LLM Systems with Structured Memory**  
来源：arXiv:2508.04903  
https://arxiv.org/abs/2508.04903

RCR-Router 维护 Shared Memory，并为当前 Agent 选择一个受 Token Budget 限制的子集。

主要依据包括：

- Agent role；
- 当前 task stage；
- semantic relevance；
- structured memory priority。

在 HotPotQA、MuSiQue、2WikiMultihop 上，论文报告最多约 **30% Token reduction**，同时维持或提升答案质量。

它研究的核心就是：

> **当前 Agent 应该从共享历史中看到哪些信息。**

---

## 2.3 AnyMAC：Next-Context Selection

**AnyMAC: Cascading Flexible Multi-Agent Collaboration via Next-Agent Prediction**  
来源：EMNLP 2025  
https://aclanthology.org/2025.emnlp-main.584/

AnyMAC 同时学习：

1. **Next-Agent Prediction**：下一步由哪个 Agent 工作；
2. **Next-Context Selection（NCS）**：下一 Agent 应该访问哪些历史步骤。

NCS 可以从任意之前的 Agent step 中选择相关信息，而不是固定继承完整历史或只继承上一步输出。

---

## 2.4 DeLM：Shared Verified Context

**Decentralized Multi-Agent Systems with Shared Context**  
来源：arXiv:2606.10662  
https://arxiv.org/abs/2606.10662

DeLM 不依赖中央 Orchestrator，而是使用：

```text
Parallel Agents
      ↕
Shared Verified Context
      ↕
   Task Queue
```

Agent 异步领取子任务，读取已有进展，并把**紧凑、已验证的更新**写回共享 Context。

论文在 SWE-bench Verified 上报告相对最强 baseline 最高约 **+10.5 个百分点**，同时 task cost 约下降一半；在 LongBench-v2 Multi-Doc QA 上也报告了提升。

---

## 2.5 “相关”之外：可靠性与时效性

以下工作不是专门的 Parent → Child Context Selector，但直接研究了 Context 是否可信、是否仍然有效。

### Hindsight

**Hindsight: Structured Agent Memory that Retains, Recalls, and Reflects**  
来源：ACL 2026 System Demonstrations  
https://aclanthology.org/2026.acl-demo.27/

Hindsight 把 memory 分成 world、experience、observation、opinion 等逻辑网络，区分**客观事实和主观判断**，并结合 temporal filtering 和 confidence。

### STALE

**STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?**  
来源：arXiv:2605.06527  
https://arxiv.org/abs/2605.06527

STALE 研究 later observation 已经隐式使旧 memory 失效，但没有显式否定旧事实的情况。

其 benchmark 包含 400 个专家验证场景、1,200 个查询；论文报告最强被测模型整体约 **55.2%**。

### Fresh Memory, Stale Plans

**Fresh Memory, Stale Plans: Dependency-Scoped Validation for Distributed LLM-Agent Memory**  
来源：arXiv:2609.03340  
https://arxiv.org/abs/2609.03340

论文指出：即使 Executor 已经拿到最新事实，旧 Plan 仍可能建立在过期事实上。

PlanFence 让 Plan 记录它依赖的 public records，执行动作前只验证真正影响该动作的依赖。论文在 30 个受控 live workflows 中报告，freshness-only executor 每次都会执行旧 Plan，而 PlanFence 没有执行 invalid action。

---

# 3. KV-Cache 复用与转换

## 3.1 KVCOMM：同模型、不同 Prefix Context 下复用共享内容

**KVCOMM: Online Cross-context KV-cache Communication for Efficient LLM-based Multi-agent Systems**  
来源：NeurIPS 2025  
https://papers.nips.cc/paper_files/paper/2025/hash/1a074a28c3a6f2056562d00649ae6416-Abstract-Conference.html

多 Agent 中，同一段共享文本可能位于不同 Agent-specific prefix 后面：

```text
Agent A: Prefix_A + Shared Content
Agent B: Prefix_B + Shared Content
```

即使模型相同，由于前缀不同：

$$
KV_A(Shared)\neq KV_B(Shared)
$$

KVCOMM 把差异建模为 **context-induced KV offset**，使用在线维护的 anchor pool 估计并校正共享内容的 KV。

特点：

- training-free；
- 不要求不同模型；
- 解决的是**同模型、同内容、不同 Prefix** 的 KV mismatch。

论文报告跨多种 multi-agent workload 的 KV reuse rate 超过 70%；在其五 Agent 指定设置下，TTFT 从约 430 ms 降到约 55 ms，最高约 7.8× speedup。

---

## 3.2 DroidSpeak：同架构模型变体的选择性复用

**DroidSpeak: KV Cache Sharing Across Fine-tuned Model Variants**  
来源：USENIX NSDI 2026  
https://www.usenix.org/conference/nsdi26/presentation/liu-yuhan

DroidSpeak 研究**相同 architecture** 的不同模型变体，重点包括 fine-tuned / LoRA variants。

对于相同 Context：

$$
KV_A\neq KV_B
$$

直接完整复用会显著伤害质量。

论文逐层测试后发现：只有少量 Layer 对跨模型 KV 偏差特别敏感，并称为 **Critical Layers**；测试 model pairs 中平均约 **11% Layer** 被识别为 critical。

因此：

```text
非关键 Layer → 复用 Sender KV
关键 Layer   → Receiver 重算
```

为了减少 E Cache 切换和表示误差，实际选择连续 recomputation group，并离线 profiling 不同重算区间；运行时再把 KV Transfer 与 Recomputation pipeline overlap。

论文报告：

- Prefill 加速最高约 3.1×；
- 在线吞吐最高约 4×；
- 质量损失很小。

限制：Sender / Receiver 需要相同 architecture。

---

## 3.3 ICaRus：训练时直接让不同专用模型产生相同 KV

**ICaRus: Identical Cache Reuse for Efficient Multi-Model Inference**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/37f6be32f832caf0f7980469fb06165b-Abstract-Conference.html

ICaRus 把 decoder-only Transformer 概念上拆成：

```text
Logical Encoder → 产生 KV
Logical Decoder → 根据 KV 预测 Token
```

训练专用模型时：

- 冻结 Logical Encoder；
- 只 fine-tune Logical Decoder。

于是不同专用模型对相同 Prefix 生成相同 KV：

$$
KV_A=KV_B=KV_C
$$

这样无需 Translator 即可完整共享 Cache。

代价是：必须按这种方式构造 / fine-tune 模型，不能直接用于任意已有模型。

论文在 8-model multi-agent 场景中报告最高约 11.1× 更低 P95 latency 和 3.8× 更高 throughput。

---

## 3.4 C2C：跨模型 Latent Communication，不是 Receiver Prefill 替代

**Cache-to-Cache: Direct Semantic Communication Between Large Language Models**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/474ada926b331d78f06d95e8913111cc-Abstract-Conference.html

C2C 的目标不是让 Target 完全跳过自身 Prefill，而是让两个模型通过内部 KV 表示交流。

Target 本身已有自己的 KV，Source KV 经神经网络 projection / fusion 后注入：

$$
KV_B^{fused}=KV_B+F(KV_B,KV_A)
$$

论文还使用 learnable gate 选择哪些 Target Layer 接收通信。

因此 C2C 更准确地属于：

> **Cross-model latent semantic communication**

而不是纯粹的 Receiver-side Prefill Reuse。

---

## 3.5 MoT：训练神经 Translator 做异构 KV Translation

**Mixture-of-Translators: Translating KV Caches Across Heterogeneous Large Language Models**  
来源：arXiv:2607.28979  
https://arxiv.org/abs/2607.28979

MoT 的目标是：

$$
T_{A\rightarrow B}(KV_A)\approx KV_B
$$

它不是简单线性矩阵，而是**需要训练的神经 Translator**。

一个 backbone Translator：

1. 分别处理 K 和 V；
2. 把 Source cache projection 到 translator hidden space；
3. 用 recurrent **Cross-Attention** 融合选定 Source Layer window；
4. 再 projection 到 Target KV space。

MoT 使用多个结构相同、参数不同的 Translator，并通过**token-level learned gating / routing**选择或组合它们。

训练时 Source / Target LLM 用同一 Context 产生 paired state；Translator 使用 Prompt LM Loss 和 **Context Correction Loss** 训练。Context Correction 约束使用 translated cache replay 后的 Target trajectory 接近 native Target trajectory。

论文还分析了两个误差：

- **Propagated Translation Shift**：注入过早，误差经过更多 Layer 放大；
- **Last-State Shift**：注入过晚，剩余 Layer 不足以修正误差。

实验覆盖 Qwen2.5、GPT-2、OPT 的 homogeneous / heterogeneous translation。

因此 MoT 的含义是：

> **可以针对具体 Source → Target pair 训练异构 KV Translator。**

它并没有证明一个 Translator 可以零训练适配任意模型组合。

---

## 3.6 Closed-form Cross-Model KV Transfer：部分模型对存在近似线性关系

**Cross-Model KV Cache Transfer in LLM Families: A Closed-Form Linear Mapping for Prefill Reuse**  
来源：arXiv:2608.03893  
https://arxiv.org/abs/2608.03893

论文研究的是 **matched-KV pairs**：Source / Target 具有相同 KV head 数和 per-head dimension。

核心发现：

> 部分同 Family、不同尺寸模型的 KV 之间存在较强线性结构。

方法：

1. 为每个 Target Layer 选择 top-k Source Layers；
2. Key 先去掉 Source RoPE；
3. 按 Layer / KV Head 用 Ridge Regression 拟合；
4. 再加 Target RoPE；
5. Value 直接映射。

可粗略写成：

$$
\tilde K_B=W_K\tilde K_A+b
$$

论文用 500 条 FineWeb-Edu、每条 1024 Token 做 Calibration。

六个 model pair 中：

- 4 个保留约 73–98% 的 Target standalone-prefill accuracy；
- 2 个明显失败；
- 非线性 MLP 能显著恢复部分失败 pair。

Mapper application 比重新 Prefill 快约 2.7–25×。

---

## 3.7 CacheBridge：缩小并稳定 Closed-form Mapping

**CacheBridge: Efficient Cross-Model KV Cache Transfer**  
来源：arXiv:2609.00891  
https://arxiv.org/abs/2609.00891

CacheBridge 直接针对上面的 Full-Head Mapping 做优化，仍保留 closed-form affine mapper。

三项核心修改：

1. **Head-local / matched-head support**：每个 Target Head 只从匹配的 Source Head 建映射，而不是读取所有 Source Heads；
2. **Attention-aligned Calibration**：按 causal attention sensitivity 对 reconstruction error 加权；
3. **Fused Mapper Construction**：直接计算 weighted sufficient statistics，避免构造巨大的 observation tensor。

结果中：

- 修复了两组 Full-Head Mapping 明显掉点的 Ministral 3 transfer；
- Qwen3 上平均保持 99.83% Target retention；
- Qwen3 14B→32B 的 Mapper storage 降低 8×；
- application 最多加速约 3×；
- 500-sequence Mapper construction 从 92.63 s 降到 8.63 s。

---

# 4. Reasoning Effort 与 Reasoning-State KV

## 4.1 先区分“思考强度”和“是否开启思考”

### gpt-oss：真正的 low / medium / high effort

gpt-oss 官方 Harmony format 把 Reasoning Effort 写进 system message：

```text
Reasoning: low
Reasoning: medium
Reasoning: high
```

来源：OpenAI Harmony format  
https://github.com/openai/harmony/blob/main/docs/format.md

OpenAI 的 gpt-oss model card 说明，模型在训练时支持三种 effort；effort 越高，平均 CoT 长度越长。

因此这属于：

> **同一模型、同一任务，不同 reasoning intensity。**

### Qwen3 / GLM：主要是 Thinking On / Off

Qwen3 的 `enable_thinking=True/False`、`/think`、`/no_think`，以及 GLM 的 `enable_thinking`，主要控制**是否进入 Thinking Mode**。

Qwen3 来源：  
https://github.com/QwenLM/Qwen3/blob/main/docs/source/getting_started/quickstart.md

GLM 来源：  
https://github.com/zai-org/GLM-4.5

这和 low / medium / high effort 不是同一个问题。

另外，如果 Template 变化只发生在长 Context **之后**，根据 causal attention，前面的 Context KV 本身仍可保持相同；因此不能仅凭“Chat Template 不同”就断言整段 Context KV 必须重算。

---

## 4.2 Ares：动态选择每一步的 Reasoning Effort

**Ares: Adaptive Reasoning Effort Selection for Efficient LLM Agents**  
来源：arXiv:2603.07915  
https://arxiv.org/abs/2603.07915

Ares 使用 gpt-oss-20b，在多步 Agent 任务中为每一步动态选择：

```text
low / medium / high
```

它训练一个轻量 Router，根据 interaction history 和当前 observation 预测**最低但足够完成当前 step**的 effort。

训练流程先用 high-effort 成功轨迹得到 reference action，再分别测试 low / medium / high，标注能稳定复现正确 action 的最低 effort；随后 fine-tune Router，并进一步尝试 RL。

论文报告最高约 **52.7% reasoning-token reduction**，同时保持接近 fixed-high 的 task performance。

论文还明确把“同模型不同 effort 可以 preserve / reuse KV cache”作为相比 multi-model routing 的优势；但论文的主体实验评估的是 **effort routing 和 token cost**，不是专门的 KV compatibility / cache-hit study。

---

## 4.3 Efficient Reasoning on the Edge：让 Chat / Reasoning 天然共享 Prompt KV

**Efficient Reasoning on the Edge**  
来源：arXiv:2603.16867，Qualcomm AI Research  
https://arxiv.org/abs/2603.16867  
https://qualcomm-ai-research.github.io/llm-reasoning-on-edge/

它使用：

```text
Chat Mode      = Base Model
Reasoning Mode = Base + Reasoning LoRA
```

系统先用 Base Model 编码 Prompt，并使用 final-layer prompt hidden states 的 mean pooling 训练一个轻量 switcher 判断是否开启 Reasoning LoRA。

关键设计是：

> **Prompt 永远只用 Base Model 编码。**

Reasoning LoRA 被训练成直接基于 Base Model 生成的 Prompt KV 解码。因此两种模式可以共享同一 Prompt KV，而不需要开启 LoRA 后重新 Prefill。

这项工作不做 KV Translation，而是从训练和运行方式上保证 Cache Compatibility。

---

## 4.4 Beyond Speedup：用 KV 判断 Fast / Slow Thinking

**Beyond Speedup — Utilizing KV Cache for Sampling and Reasoning**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/d147f24cac1b6cd88753ca830e462bdc-Abstract-Conference.html

论文把 KV Cache 当作无需额外 forward 的 lightweight representation，并用于：

- Chain-of-Embedding；
- Fast / Slow Thinking Switching。

在 Qwen3-8B 和 DeepSeek-R1-Distil-Qwen-14B 上，KV-derived representation 用于判断何时采用更慢、更长的 reasoning，最高报告约 **5.7× token-generation reduction**，同时保持较小 accuracy loss。

它使用 KV **选择 reasoning mode**，不是把 low-effort KV 映射成 high-effort KV。

---

# 5. 直接操纵或复用 Reasoning KV 的相关工作

## 5.1 Deliberation in Latent Space：训练 Coprocessor 增强 KV

**Deliberation in Latent Space via Differentiable Cache Augmentation**  
来源：ICML 2025  
https://proceedings.mlr.press/v267/liu25bc.html

这篇工作与“额外思考是否必须生成很多 reasoning tokens”直接相关。

Base LLM 保持冻结，额外训练一个 **Coprocessor**：

```text
已有 KV
  ↓
Coprocessor
  ↓
额外 latent embeddings
  ↓
Augmented KV
  ↓
Base LLM 继续 Decode
```

Coprocessor 使用 decoder 的 language-modeling loss 在普通 pretraining data 上端到端训练。

目标不是生成显式 CoT，而是把额外 computation 压进可供后续 Decode 使用的 KV / latent state。论文报告 cache augmentation 能降低后续 Token perplexity，并提升多种 reasoning-intensive task。

---

## 5.2 KV Cache Steering：一次性修改已有 K/V

**KV Cache Steering for Controlling Frozen LLMs**  
来源：arXiv:2507.08799  
https://arxiv.org/abs/2507.08799

它从 positive / negative reasoning examples 的 K、V 中计算 Mean-of-Differences steering tensors：

$$
S_l^K,\quad S_l^V
$$

Prefill 完后，对指定 token position 的已有 Cache 做一次性修改：

$$
K_l^*=K_l+c^KS_l^K
$$

$$
V_l^*=V_l+c^VS_l^V
$$

然后正常 Decode。

它不训练辅助网络，也不修改模型权重；实验表明可以增强显式多步推理，并控制 stepwise、causal、analogical 等 reasoning style。

---

## 5.3 Memory Inception：把文本指导编码成 Side KV Bank

**Memory Inception: Latent-Space KV Cache Manipulation for Steering LLMs**  
来源：arXiv:2605.06225v2  
https://arxiv.org/abs/2605.06225

Memory Inception 是 training-free 方法。

它先用冻结模型把 descriptor、summary、retrieved fact 或 reasoning heuristic 编码成 latent KV bank，然后只把这些 slots 注入自动选择的 Layer / Attention Head / KV Group。

普通 Prompt KV 保持不变：

```text
Prompt KV
   +
Selected Side KV Banks
   ↓
Attention
```

论文还使用 pre-RoPE canonical key storage，使 memory bank 更容易跨位置使用。

它主要研究行为 steering、可更新 guidance 和 structured reasoning，而不是不同 effort level 的 KV 对齐。

---

## 5.4 KaVa：用 Teacher 的压缩 KV 监督 Latent Reasoning

**KaVa: Latent Reasoning via Compressed KV-Cache Distillation**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/d2ca35069eb6e9cbd2a37bf90ba9091c-Abstract-Conference.html

KaVa 将 Teacher 长 CoT 对应的 KV Cache 压缩，并作为 self-distillation signal 训练 latent-reasoning student。

重点是：

> **即使压缩 KV 与显式 reasoning token 没有一一对应关系，它仍可以作为较强的推理监督信号。**

这是 training / distillation 场景，不是运行时 effort switching。

---

## 5.5 与“失败后继续思考”有关，但不是 KV Translation 的工作

### Thought Rollback

**Toward Adaptive Reasoning in Large Language Models with Thought Rollback**  
来源：ICML 2024  
https://proceedings.mlr.press/v235/chen24y.html

允许模型发现 reasoning error 后回到以前的 Thought，再把 trial-and-error 写进 Prompt 继续探索。

它做的是 **text / thought-level rollback**，不是 KV-level state translation。

### Reasoning Cache

**Reasoning Cache: Continual Improvement Over Long Horizons via Short-Horizon RL**  
来源：arXiv:2602.03773  
https://arxiv.org/abs/2602.03773

这里的 “Reasoning Cache” **不是 Transformer KV Cache**。

它通过 iterative decoding 和 summary-conditioned generation，把上一轮推理压成 summary，再基于 summary 继续更长 horizon 的 reasoning。

### ArborKV

**ArborKV: Structure-Aware KV Cache Management for Scaling Tree-based LLM Reasoning**  
来源：ICML 2026 / arXiv:2605.22106  
https://arxiv.org/abs/2605.22106

ArborKV 面向 Tree-of-Thoughts 的 branch / backtracking，管理不同 reasoning branch 的 KV。

它根据 tree topology 和 branch utility 做 eviction，并在分支重新激活时 lazy rehydration，从而降低多分支 reasoning 的 KV memory；论文报告最高约 4× peak KV-memory reduction。

它研究的是**已有 reasoning branch 的 Cache 管理与恢复**，不是把一种 reasoning effort state 翻译成另一种。

---

# 6. 关系总结

## 6.1 Context 继承

| 工作         | 主要决策对象                        | 主要依据                                                 |
| ---------- | ----------------------------- | ---------------------------------------------------- |
| AOrchestra | 给 Sub-Agent 什么 Context        | Orchestrator 动态 curate / compress                    |
| RCR-Router | 当前 Agent 看 Shared Memory 的哪部分 | role、task stage、semantic relevance、budget            |
| AnyMAC     | 下一 Agent 访问哪些历史 step          | learned Next-Context Selection                       |
| DeLM       | 多 Agent 共享什么进展                | compact verified updates                             |
| Hindsight  | Memory 如何区分事实 / 判断            | fact-belief separation、confidence、temporal filtering |
| STALE      | 旧 Memory 是否已失效                | implicit conflict / state revision                   |
| PlanFence  | Action 前验证哪些旧依赖               | plan dependency scope                                |

## 6.2 KV 复用 / 转换

| 工作 | Source / Target 关系 | 方法 | 是否训练 Translator |
|---|---|---|---:|
| KVCOMM | 同模型、不同 Prefix | anchor-based online KV offset correction | ❌ |
| DroidSpeak | 同 architecture 模型变体 | 大部分 KV 复用 + Critical Layer 重算 | ❌ |
| ICaRus | 特殊训练的多个专用模型 | 训练时让 KV 完全一致 | 不需要 |
| C2C | 异构模型 | neural projection + fusion | ✅ |
| MoT | 异构模型 Pair | 多个 Cross-Attention Translator + learned routing | ✅ |
| Closed-form Transfer | matched-KV model pairs | Ridge Regression | ❌ |
| CacheBridge | 异构 / matched support | head-local affine mapping + attention-aligned calibration | ❌ |
| Universal Context-Reuse | 跨 scale / architecture / family | cross-model transport，公开实现细节有限 | 论文未充分展开 |

## 6.3 Reasoning 与 KV

| 工作 | 主要问题 | KV 的作用 |
|---|---|---|
| Ares | 每一步选 low / medium / high | 论文将跨 effort KV reuse 作为优势 |
| Efficient Reasoning on the Edge | Chat / Reasoning 动态切换 | 训练设计保证共享 Prompt KV |
| Beyond Speedup | Fast / Slow Thinking Switching | KV 作为 routing representation |
| Deliberation in Latent Space | 不生成长 CoT 也增加额外 computation | Coprocessor 增强 KV |
| KV Cache Steering | 低成本改变 reasoning behavior | 一次性修改 K/V |
| Memory Inception | 持久 / 可更新 guidance | 注入 selective KV banks |
| KaVa | Latent reasoning supervision | 压缩 Teacher KV 做 distillation |
| ArborKV | Tree reasoning branch 管理 | 保存 / eviction / rehydrate branch KV |

---

# 7. 三个容易混淆的问题

### 1. Context Selection

> **哪些已有信息应该给另一个 Agent？**

主要工作：AOrchestra、RCR-Router、AnyMAC、DeLM。

### 2. Context Computation Reuse

> **这些信息已经被处理过，另一个 Context / Model 能不能复用已有 KV？**

主要工作：KVCOMM、DroidSpeak、ICaRus、MoT、Closed-form Transfer、CacheBridge 等。

### 3. Reasoning-State Manipulation / Reuse

> **模型已经形成一定 reasoning state 后，能不能继续利用、增强、修改或恢复这些计算状态？**

相关工作包括 Deliberation in Latent Space、KV Cache Steering、Memory Inception、KaVa、ArborKV 等。

这三个问题有关联，但研究对象并不相同，不能简单把“传 Context”“共享 Prompt KV”“改变 Reasoning Effort”“修改 reasoning KV”视为同一个问题。
