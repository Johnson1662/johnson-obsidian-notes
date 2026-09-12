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

# 4. Reasoning Effort 与 KV Cache

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
