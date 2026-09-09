# Agent 上下文继承、KV-Cache 复用与 Reasoning Effort

## 1. 问题背景

复杂 Agent 常采用主 Agent + 子 Agent：

```text
Main Agent
├─ Search Agent
├─ Coding Agent
├─ Test Agent
└─ Review Agent
```

子 Agent 往往只收到任务说明，因此会重复：

1. **探索**：重新读文件、搜索、调用工具、推理；
2. **Prefill**：即使主 Agent 直接传原文，子模型仍要重新计算这些 Token。

因此问题可以拆成两条线：

- **Context Management**：子 Agent 应该继承什么？
- **KV-Cache Reuse**：已经处理过的 Context，能否连计算结果一起复用？

---

# 2. 子 Agent 的 Context 继承

## 2.1 AOrchestra

**AOrchestra: Automating Sub-Agent Creation for Agentic Orchestration**  
来源：arXiv 2602.03786  
https://arxiv.org/abs/2602.03786

AOrchestra 把子 Agent 表示为：

$$
Agent=(Instruction,\ Context,\ Tools,\ Model)
$$

Orchestrator 不只决定“做什么”，还动态选择 Context、Tools 和 Model。

核心结论：

> **Context 不是越多越好，Curated Context（筛选后的上下文）更有效。**

因此，“主 Agent 选择相关 Context 给子 Agent”本身已经被直接研究。

---

## 2.2 DeLM

**Decentralized Multi-Agent Systems with Shared Context**  
来源：arXiv 2606.10662  
https://arxiv.org/abs/2606.10662

DeLM 不做 Parent → Child 的单向继承，而是维护 **Shared Verified Context（共享已验证上下文）**：

```text
Agent A ─┐
Agent B ─┼→ Shared Context
Agent C ─┘
```

Agent 可以读取其他 Agent 已确认的进展，再写回新的验证结果，从而减少重复探索。

---

## 2.3 还值得研究的问题

如何评判哪些context值得继承

例如：

```text
明确事实         → inherit
低成本可验证事实  → verify
Parent 推测      → independently verify
过期状态         → reacquire
```

核心权衡：

$$
\text{Reuse Benefit}
\quad vs \quad
\text{Error Propagation Risk}
$$

即：**继承 Context 能减少重复工作，但也可能继承错误和过期状态。**

---

# 3. KV-Cache 复用

## 3.1 DroidSpeak：同结构微调模型

**DroidSpeak: KV Cache Sharing Across Fine-tuned Model Variants**  
来源：USENIX NSDI 2026  
https://www.usenix.org/conference/nsdi26/presentation/liu-yuhan

场景：

```text
同一个基础模型
├─ Coder-LoRA
├─ Reviewer-LoRA
└─ Tester-LoRA
```

虽然结构和 Tokenizer 相同，但微调后：

$$
KV_A \neq KV_B
$$

直接全部复用会掉质量。

DroidSpeak 的关键发现：

> **只有少数 Layer 对跨模型 KV 差异特别敏感。**

因此：

```text
非关键 Layer → 直接复用
关键 Layer   → Receiver 重算
```

论文中 Critical Layers（关键层）平均约占 11%。系统还通过 Offline Profiling 选择重算区间，并让 KV Transfer 与 Recomputation 并行。

结果：

- Prefill 加速约 1.7–3.1×
- 在线吞吐最高约 4×

限制：主要适用于**结构相同、来源接近的模型变体**。

---

## 3.2 ICaRus：训练时直接让 KV 相同

**ICaRus: Identical Cache Reuse for Efficient Multi-Model Inference**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/37f6be32f832caf0f7980469fb06165b-Abstract-Conference.html

ICaRus 不做事后转换，而是在训练时冻结负责产生 KV 的部分，只调整后续任务能力。

因此不同专用模型对同一输入产生：

$$
KV_A=KV_B=KV_C
$$

优点：可以完整复用，无需 Translator。  
缺点：必须按这种方式训练，不能直接处理任意已有模型。

---

## 3.3 Cache-to-Cache（C2C）：隐空间通信

**Cache-to-Cache: Direct Semantic Communication Between Large Language Models**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/474ada926b331d78f06d95e8913111cc-Abstract-Conference.html

C2C 的重点不是跳过 Target Prefill，而是让两个模型直接通过 KV 通信：

```text
KV_A ─┐
      ├→ Fuser → Enhanced KV_B
KV_B ─┘
```

$$
KV_B^{fused}=KV_B+F(KV_B,KV_A)
$$

因此它更接近 **Cross-model Latent Communication（跨模型隐空间通信）**，而不是纯 Prefill Reuse。

---

## 3.4 Mixture-of-Translators（MoT）：异构 KV Translation

**Mixture-of-Translators: Translating KV Caches Across Heterogeneous Large Language Models**  
来源：arXiv 2607.28979  
https://arxiv.org/abs/2607.28979

目标：

$$
T_{A\rightarrow B}(KV_A)\approx KV_B
$$

MoT 使用多个 Translator + Router，处理不同 Token / Layer 区域中的不同映射关系。

它还发现：

- 太早注入：Translation Error 会继续传播；
- 太晚注入：Target 没有足够 Layer 修正误差。

因此加入 Context Correction，使翻译后的运行轨迹接近 Target 正常 Prefill。

---

## 3.5 Closed-form Cross-Model KV Transfer：线性映射

**Cross-Model KV Cache Transfer in LLM Families: A Closed-Form Linear Mapping for Prefill Reuse**  
来源：arXiv 2608.03893  
https://arxiv.org/abs/2608.03893

核心发现：

> **部分同 Family、不同尺寸模型之间的 KV 具有很强的线性结构。**

直接拟合：

$$
KV_B\approx WKV_A+b
$$

主要做法：

- 用少量 Calibration Context 获取成对 KV；
- 为 Target Layer 选择相关 Source Layer；
- Key 先去掉 Source RoPE；
- 按 Layer / Head 做 Ridge Regression；
- 最后重新加入 Target RoPE。

部分模型 Pair 保留了较高质量，映射比重新 Prefill 快约 2.7–25×；但部分 Pair 明显失败。

因此出现一个重要问题：

> **为什么有些模型之间容易映射，有些不行？**

---

## 3.6 CacheBridge：把线性 Mapping 做得更实用

**CacheBridge: Efficient Cross-Model KV Cache Transfer**  
来源：arXiv 2609.00891  
https://arxiv.org/abs/2609.00891

CacheBridge 继续优化上面的线性 Mapping。

原方法让一个 Target Head 读取很多 Source Head，导致 Mapper 大、计算多、容易引入噪声。

CacheBridge 改为：

1. **Head Matching**：Target Head 只读取匹配的 Source Head；
2. **Attention-aligned Calibration**：更重视真正影响 Attention 的 KV 误差；
3. **高效 Mapper Construction**：减少校准和构建开销。

---

## 3.7 Universal Context-Reuse Layer：跨 Family Context Mobility

**A Universal Context-Reuse Layer for Cross-Model KV Sharing**  
来源：arXiv 2608.30963  
https://arxiv.org/abs/2608.30963

它把目标扩展到：

- 不同尺寸
- 不同 Layer
- 不同 Attention
- 不同 Tokenizer
- 不同 Model Family

并提出 **Context Mobility（上下文可迁移性）**。

论文报告了 Llama → Qwen、Qwen → Gemma 等跨 Family Handoff 的可行性。

但当前公开版本没有充分给出核心 Transport Module 的实现，因此更适合视为：

> **跨 Family KV 迁移的可行性证据，而不是成熟可复现的 Translator。**

---

# 4. Reasoning Effort 与 KV Cache

一个新的场景是：

```text
low effort
    ↓
解决失败
    ↓
切换 high effort
```

如果切换 effort 改变了 Prompt Prefix，就可能导致相同长 Context 的 KV 失效，需要重新 Prefill。

## 4.1 为什么有时会失效

不同模型的 effort 实现不同。

### Prompt-conditioned effort

例如 gpt-oss：

```text
Reasoning: low
Context
```

和：

```text
Reasoning: high
Context
```

effort 位于 Context 前，因此：

$$
KV_{low}(C)\neq KV_{high}(C)
$$

理论上存在 KV 兼容性问题。

### Thinking Template

Qwen3、GLM 等通过 `enable_thinking`、特殊 Token 或 Chat Template 控制 Thinking Mode，也可能改变 Prefix。

### Decode Budget

如果只是限制后续最多生成多少 reasoning tokens，而 Prefill 输入不变：

$$
KV_{context}^{low}=KV_{context}^{high}
$$

这种情况直接复用即可，不需要转换。

---

# 5. Reasoning-Effort 相关研究

## 5.1 Ares：动态选择 low / medium / high

**Ares: Adaptive Reasoning Effort Selection for Efficient LLM Agents**  
来源：arXiv 2603.07915  
https://arxiv.org/abs/2603.07915

Ares 使用 gpt-oss-20b，在 Agent 每一步动态选择最低够用的：

```text
low / medium / high
```

它解决的是：

> **什么时候值得使用更高 reasoning effort？**

最高减少约 52.7% reasoning tokens。

但它没有系统回答：

- low / high Prompt KV 是否一致；
- 直接跨 effort 复用是否掉质量；
- 哪些 Layer / Head 对 effort 敏感；
- 是否需要 KV Repair / Translation。

因此它与目标场景高度相关，但没有直接解决 **low → high KV compatibility**。

---

## 5.2 Efficient Reasoning on the Edge：训练时保证共享 KV

**Efficient Reasoning on the Edge**  
来源：arXiv 2603.16867，Qualcomm AI Research  
https://arxiv.org/abs/2603.16867

它研究：

```text
Base Model
   ↓
困难时开启 Reasoning LoRA
```

正常情况下启用 LoRA 会改变 Prompt KV。

作者通过 **Masked LoRA Training**：

```text
Prompt 阶段   → LoRA 关闭
Response 阶段 → LoRA 开启
```

使普通模式和 Reasoning 模式天然共享 Prompt KV。

这说明：

> **“先用便宜模式，必要时升级，同时避免重新 Prefill”是一个真实问题。**

但它通过训练消除了 KV 差异，而不是事后转换已有 KV。

---

## 5.3 Beyond Speedup：用 KV 判断 Fast / Slow Thinking

**Beyond Speedup — Utilizing KV Cache for Sampling and Reasoning**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/d147f24cac1b6cd88753ca830e462bdc-Abstract-Conference.html

它把 KV 当作轻量 representation：

$$
d=f(Pool(KV))
$$

用来判断当前应该 Fast Thinking 还是 Slow Thinking，并支持动态切换。

在实验中最多减少约 5.7× reasoning token generation。

它解决的是：

> **用 KV 决定什么时候切 effort。**

不是：

$$
KV_{low}\rightarrow KV_{high}
$$

---

## 5.4 KV Cache Steering：直接修改 KV 改变推理行为

**KV Cache Steering for Controlling Frozen LLMs**  
来源：arXiv 2507.08799  
https://arxiv.org/abs/2507.08799

它直接对已有 KV 做一次性干预：

$$
KV'=KV+\alpha\Delta KV
$$

通过从 reasoning traces 学到的 steering direction，让冻结模型更倾向于多步推理。

意义在于：

> **不重新 Prefill，轻量修改 KV 确实可以改变 reasoning behavior。**

但它没有把 high-effort KV 作为监督目标，因此不是严格的 low → high KV Translation。

---

## 5.5 Memory Inception：向 Attention 注入 KV Memory

**Memory Inception: Latent-Space KV Cache Manipulation for Steering LLMs**  
来源：arXiv 2605.06225  
https://arxiv.org/abs/2605.06225

Memory Inception 不修改原 Prompt，而是把文本指导编码成额外 KV Bank，只注入部分 Layer / Head：

```text
Normal KV
   +
Guidance KV Bank
   ↓
Selected Attention Layers
```

它可以在对话中途改变行为和 structured reasoning，而不用重写完整 Prompt。

这进一步说明：

> **KV 空间可以作为动态行为控制接口。**

但它仍是 KV Injection，而不是 low-effort KV → high-effort KV 对齐。

---

## 5.6 KaVa：用深度推理 KV 监督 latent reasoning

**KaVa: Latent Reasoning via Compressed KV-Cache Distillation**  
来源：ICLR 2026  
https://proceedings.iclr.cc/paper_files/paper/2026/hash/d2ca35069eb6e9cbd2a37bf90ba9091c-Abstract-Conference.html

KaVa 把 Teacher 的长 CoT KV Cache 压缩，并作为监督信号训练 latent-reasoning student。

它说明：

> **深度推理过程中积累的 KV 状态确实包含可压缩、可迁移的 reasoning information。**

但它研究的是离线 Distillation，不是运行时 low → high effort escalation。

---
## 5.7 值得研究的问题

当模型先以 low reasoning effort 尝试任务并失败后，如何最大程度复用已经产生的 reasoning computation，而不是以 high effort 从头重新推理？

实验设计：三组对照实验
- 直接将思考强度从low切换到high，然后继续
- 直接从头开始
- 