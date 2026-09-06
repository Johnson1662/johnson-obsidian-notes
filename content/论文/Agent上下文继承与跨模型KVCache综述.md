## 前置知识

### 普通 LLM 和 Agent 的区别

普通 LLM 通常是：

```
输入 Prompt
   ↓
LLM
   ↓
输出文本
```

Agent 则是在 LLM 外面加了一套执行循环：

```
用户目标
   ↓
LLM 决策
   ↓
调用工具 / 读文件 / 搜索 / 执行代码
   ↓
获得 Observation
   ↓
继续决策
   ↓
直到完成任务
```

可以粗略理解为：

> **LLM 负责“想”，Agent runtime 负责“让它能持续观察环境并采取行动”。**

典型能力包括：

- Tool Use（工具调用）
- Planning（规划）
- Memory / Context Management（记忆与上下文管理）
    
- Environment Interaction（与代码库、网页、SaaS、终端等环境交互）
    
- Multi-Agent / Sub-Agent Delegation（多 Agent / 子 Agent 委派）
    

---

## 1 问题背景

复杂任务如果完全交给一个 Agent，通常会遇到：

- Context 越来越长；
- 不同子任务相互干扰；
- 一个 Agent 需要同时承担搜索、编码、测试、审查等不同角色；
- 一些子任务可以并行。

所以很多 Agent 框架支持：

```
Main Agent
├─ Sub-Agent A：搜索资料
├─ Sub-Agent B：修改代码
├─ Sub-Agent C：测试
└─ Sub-Agent D：Review
```

工程上的常见实现是：

1. 主 Agent 先探索；
2. 主 Agent 决定要拆出一个子任务；
3. 启动一个新的 Sub-Agent；
4. Sub-Agent 的上下文基本为空；
5. 主 Agent 只给它要做什么、在哪做、验收标准和少量提示。

因此会出现一个明显的问题：

> **主 Agent 已经读过、搜过、推理过的信息，子 Agent 可能还要重新经历一遍。**

例如：

```
Main Agent
已经：
- read README
- grep auth
- read auth.ts
- read middleware.ts
- 跑过测试
- 判断 bug 可能在 token 校验

        ↓ delegate

Sub-Agent
只收到：
“修复登录 bug，重点看 auth.ts”

        ↓

Sub-Agent 又：
- read README
- grep auth
- read auth.ts
- read middleware.ts
- 再跑一遍测试
```

这会产生两类重复成本。

### 2.1 重复探索成本

- 重复 read / grep / search
- 重复 tool call
- 重复 reasoning
- 重复环境交互

### 2.2 重复 Prefill 成本

即使主 Agent 把原文直接传给子 Agent：

```
Main Agent 已经读过 20K tokens
        ↓
把 20K tokens 文本交给 Child
        ↓
Child 仍然要重新 Prefill 20K tokens
```

所以：

> **文本级 Context 继承可以减少“重新找”，但不等于减少模型计算。**

这正好引出后面两条研究线：

1. **子 Agent 应该继承什么 Context？**
2. **决定继承以后，能不能连已经算过的 KV-Cache 一起复用？**

---

# 2. DroidSpeak：同源微调模型之间的 KV-Cache 复用

## 2.1 DroidSpeak 的场景

DroidSpeak 研究的是多个来自同一个基础模型的微调模型，例如：

```text
Llama-3-8B
├─ Coder-LoRA
├─ Reviewer-LoRA
└─ Tester-LoRA
```

这些模型：

- Transformer 结构相同
- Tokenizer 相同
- Layer 数相同
- 大部分参数来源相同
- 只是经过不同的 Fine-tuning 或 LoRA 微调

如果它们在一个 Agent Workflow 中反复读取相同长上下文：

```text
Repository Context
      ↓
Coder Model
      ↓
Reviewer Model
      ↓
Tester Model
```

那么后面的模型会重复执行大量 Prefill。

DroidSpeak 的问题就是：

> Model A 已经为这段 Context 算过 KV-Cache，Model B 能不能利用？

---

## 2.2 为什么不能直接把 KV 全部复制过去

对于相同 Context：

```text
Model A → KV_A
Model B → KV_B
```

即使两个模型来自同一个基础模型，由于微调后的参数已经不同：

$$
KV_A \neq KV_B
$$

DroidSpeak 的实验表明：

> 直接让 Receiver 使用 Sender 的全部 KV-Cache，会导致明显的质量下降。

所以不能简单把不同模型的 KV 当成完全兼容的缓存。

---

## 2.3 DroidSpeak 的关键发现：只有少数 Layer 特别敏感

作者逐层替换 KV：

```text
Layer 0 使用 Sender KV
其他层由 Receiver 自己计算

Layer 1 使用 Sender KV
其他层由 Receiver 自己计算

...
```

结果发现：

> 不同 Layer 对跨模型 KV 差异的敏感程度很不一样。

多数 Layer 直接使用 Sender 的 KV 时，输出质量变化并不明显。

只有少部分 Layer 会明显影响最终结果。

作者把这些 Layer 称为：

> **Critical Layers（关键层）**

论文中统计的模型对里，平均大约有 11% 的 Layer 属于 Critical Layer。

因此 DroidSpeak 的基本策略变成：

```text
非关键 Layer → 直接复用 Sender KV
关键 Layer   → Receiver 重新计算
```

---

## 2.4 为什么不能只重算几个离散的关键层

假设关键层分布是：

```text
16–18
20
25–27
```

最直接的想法是只重算这些层。

但 Transformer 中，如果 Receiver 想从某一层重新开始计算，就需要这一层的输入 Hidden State。

DroidSpeak 把这种中间状态称作 **E Cache**。

如果系统不断在：

```text
Reuse
↓
Recompute
↓
Reuse
↓
Recompute
```

之间切换，就需要频繁传输 E Cache。

这样会带来两个问题：

- E Cache 本身也有通信成本
- 每次重新引入 Sender 的中间表示，都可能继续带来模型间误差

所以 DroidSpeak 更倾向于：

```text
直接连续重算 16–27
```

而不是只计算离散 Critical Layer。

---

## 2.5 Offline Profiling

DroidSpeak 不会针对每一个请求重新判断哪些 Layer 应该重算。

它会针对固定的一对：

```text
Sender Model A
Receiver Model B
```

提前做 Profiling：

```text
尝试不同 Recompute Layer 区间
            ↓
记录：
- 输出质量
- 重算层数
- Prefill latency
            ↓
形成 Pareto Frontier
```

在线阶段再根据当前系统负载和 SLO 选择不同配置。

可以理解为：

```text
系统空闲
→ 多重算一些
→ 更接近 Receiver 完整 Prefill 的质量

系统繁忙
→ 少重算一些
→ 更倾向复用
```

---

## 2.6 通信和计算重叠

如果 Sender 和 Receiver 在不同 GPU 节点上，系统还需要传输缓存。

最简单的方法是：

```text
先传 KV
↓
传完
↓
再重算关键层
```

DroidSpeak 则让：

$$
\text{KV Transfer} \parallel \text{Recomputation}
$$

也就是：

```text
先发送开始重算所需要的 E Cache
          ↓
Receiver 立刻开始计算

与此同时：

Sender 继续传输其他需要复用的 KV
```

通过把网络通信和 GPU 计算重叠，进一步降低 TTFT。

---

## 2.7 DroidSpeak 的结果和限制

论文报告的主要结果包括：

- Prefill 加速约 1.7–3.1×
- 平均约 2.1×
- 在线吞吐最高约 4×
- Coding Agent case study 中 TTFT 约提升 2.7×

但 DroidSpeak 的适用范围比较明确：

```text
同一个基础模型
+
结构基本一致
+
大量重复长 Context
```

它并不能直接解决：

```text
Qwen → Llama
Llama → Gemma
Qwen-32B → 完全不同架构模型
```

所以 DroidSpeak 更准确地说是：

> **同源微调模型之间的选择性 KV-Cache 复用。**

---

# 3. 子 Agent 的 Context 继承

## 3.1 AOrchestra

**AOrchestra: Automating Sub-Agent Creation for Agentic Orchestration**  
2026.02

AOrchestra 与“主 Agent 把已有上下文直接给子 Agent”这一问题非常接近。

它把一个子 Agent 表示为：

$$
Agent = (Instruction,\ Context,\ Tools,\ Model)
$$

也就是说，主 Orchestrator 不只负责决定：

> 子 Agent 要做什么

还负责决定：

- 给它什么 Context
- 给它哪些 Tools
- 使用哪个 Model

它强调的是：

> **Curated Context（经过筛选的上下文）**

而不是把主 Agent 的所有历史直接复制给子 Agent。

AOrchestra 的 Context Ablation 对比了：

- No Context
- Full Context
- Curated Context

在论文给出的 GAIA 小规模消融实验里：

| 设置 | 平均准确率 |
|---|---:|
| No Context | 86% |
| Full Context | 84% |
| Curated Context | **96%** |

这个结果说明：

> **不给 Context 不一定好，把所有 Context 全塞进去同样不一定好，选择性继承可能更有效。**

因此，“主 Agent 给子 Agent 传相关 Context”本身已经是一个被直接研究过的问题。

论文：

https://arxiv.org/abs/2602.03786

---

## 3.2 DeLM

**DeLM: Decentralized Multi-Agent Systems with Shared Context**  
2026.06

DeLM 走的是另一种路线。

它不是 Parent → Child 的定向 Context 继承，而是维护一个：

> **Shared Verified Context（共享且经过验证的上下文）**

多个 Agent 可以：

```text
Agent A ─┐
Agent B ─┼→ Shared Context
Agent C ─┘
```

它们可以：

- 读取别人已经确认的进展
- 避免重新探索
- 将新的验证结果继续写入共享上下文

这更像一个多 Agent 的共享黑板或共享工作记忆。

论文在 SWE-bench Verified 上报告，在部分设置下：

- 成功率最高提升约 10.5 个百分点
- 成本可下降约一半

论文：

https://arxiv.org/abs/2606.10662

---

# 4. Context 继承的难点：可能继承到判断错误的context

假设 Parent Agent 已经得到：

```text
事实：
auth.ts 第 217 行调用 verifyToken()

测试：
login_test 失败

推测：
bug 可能在 auth.ts

外部信息：
README 说这里应该使用 JWT
```

如果这些全部直接传给 Child：

```text
Parent 判断错误
      ↓
Child 继承错误假设
      ↓
继续沿着错误方向探索
```

所以 Context 继承存在一个核心权衡：

$$
\text{Context Reuse}
\quad vs \quad
\text{Independent Verification}
$$

### 直接继承的优势

- 少搜索
- 少文件读取
- 少 Tool Call
- 少重复推理
- 更快进入子任务

### 直接继承的风险

- Parent 的错误会传播
- Child 的独立性下降
- 容易形成错误路径依赖
- Context 可能已经过期

因此更进一步的问题不是：

> 哪些 Context 与任务相关？

而是：

> **哪些 Context 可以直接相信，哪些应该由 Child 重新验证？**

一种可能的分类是：

```text
高置信度、可追溯事实
→ inherit

低成本可验证事实
→ verify

Parent 推测
→ independently verify

过期状态
→ reacquire

无关信息
→ drop
```

它与普通 Context Selection 的区别可以概括为：

```text
AOrchestra 更接近：
Relevant / Irrelevant

更进一步的问题：
Trust / Verify / Reacquire / Drop
```

---

# 5. 异构模型之间为什么更难共享 KV

如果 Main Agent 和 Sub-Agent 使用不同模型，例如：

```text
Main Agent = Qwen-32B
Sub-Agent = Llama / Gemma / Qwen-14B
```

那么直接共享 KV 会遇到更多问题：

- Tokenizer 不同
- Layer 数不同
- Hidden size 不同
- KV Head 数不同
- Head dimension 不同
- RoPE 配置不同
- 内部表示空间不同

对于相同输入 X：

$$
KV_A(X) \neq KV_B(X)
$$

所以异构模型 KV 复用的目标变成：

$$
KV_A(X)
\xrightarrow{Translator}
\widehat{KV_B(X)}
$$

并希望：

$$
\widehat{KV_B(X)} \approx KV_B(X)
$$

---

# 6. 异构模型 KV-Cache 复用的几条路线

## 6.1 Cache-to-Cache（C2C）

**Cache-to-Cache: Direct Semantic Communication Between Large Language Models**  
ICLR 2026

C2C 需要和真正的 Prefill Reuse 区分开。

它的流程更接近：

```text
Context
  ↓             ↓
Model A        Model B
Prefill        Prefill
  ↓             ↓
KV_A           KV_B
   \           /
      C2C Fuser
          ↓
     Enhanced KV_B
```

因此它的重点不是让 Receiver 完全跳过 Prefill，而是：

> **让两个模型直接通过内部表示通信，而不是先把信息生成成自然语言。**

它主要解决：

1. Tokenizer 对齐
2. Layer 对齐
3. Source KV 投影到 Receiver 表示空间
4. Residual Fusion
5. 学习哪些 Layer 值得融合

可以写成：

$$
KV_B^{fused}
=
KV_B + F(KV_B, KV_A)
$$

所以 C2C 更适合作为：

> **Cross-model latent communication（跨模型隐空间通信）**

而不是纯粹的跨模型 Prefill 复用。

论文：

https://proceedings.iclr.cc/paper_files/paper/2026/hash/474ada926b331d78f06d95e8913111cc-Abstract-Conference.html

---

## 6.2 Mixture-of-Translators（MoT）

**Mixture-of-Translators: Translating KV Caches Across Heterogeneous Large Language Models**  
2026.07

MoT 更接近真正的：

> A 已经 Prefill，B 不再重新完整读取 Context。

流程：

```text
Model A
已经处理 Context
      ↓
    KV_A
      ↓
Mixture of Translators
      ↓
    KV_B
      ↓
Model B 继续运行
```

核心目标是：

$$
T_{A \rightarrow B}(KV_A) \approx KV_B
$$

MoT 不只使用一个 Translator，而是多个 Translator：

```text
KV_A
 ↓
Router
├─ Translator 1
├─ Translator 2
├─ Translator 3
└─ ...
 ↓
Weighted Combination
 ↓
KV_B
```

原因是：

> 不同 Token、Layer 和表示区域之间的映射关系可能不同。

---

### Translation 注入点问题

MoT 还发现：

如果很早把翻译后的状态注入 Target Model：

```text
Translation Error
↓
后面很多 Layer
↓
误差持续传播
```

如果太晚注入：

```text
Translated KV
↓
只剩少量 Layer
↓
Target Model 来不及修正
```

因此存在一个比较明显的 trade-off：

> 注入太早，误差传播；注入太晚，修正不足。

MoT 还加入 Context Correction Loss，希望 Target Model 使用翻译 Cache 后的 Hidden-State Trajectory 接近正常 Prefill。

可以粗略理解为：

$$
\mathcal{L}_{CC}
=
\sum_l
\left\|
\hat{h}^{B}_l - h^{B}_l
\right\|^2
$$

重点不只是：

> “KV 数值像不像”

而是：

> “Target Model 用这份 KV 继续跑以后，行为像不像它真的读过这段 Context”。

论文：

https://arxiv.org/abs/2607.28979

---

## 6.3 Cross-Model KV Cache Transfer in LLM Families

2026.08

这篇论文的核心发现是：

> **某些同一模型家族、不同尺寸的模型之间，KV 映射关系可能近似线性。**

例如：

```text
Qwen3-14B
    ↓
Linear Mapper
    ↓
Qwen3-32B KV
```

于是它直接拟合：

$$
KV_B \approx W KV_A + b
$$

而不是训练一个复杂 Transformer Translator。

---

### 基本做法

1. 准备约 500 个 Calibration Context
2. 同时运行 Source Model 和 Target Model
3. 得到成对 KV
4. 为 Target Layer 找最相关的 Source Layer
5. Key 先去掉 Source RoPE
6. 用 Ridge Regression 拟合映射
7. 再加入 Target Model 自己的 RoPE
8. Value 直接做映射
9. 按 Layer / KV Head 分别建立 Mapper

对于 Key，可以粗略理解为：

$$
\tilde{K}_A
=
(R_t^A)^{-1}K_A
$$

先去掉 Source RoPE。

然后：

$$
\tilde{K}_B
=
W_K\tilde{K}_A+b
$$

最后加入 Target RoPE：

$$
K_B
=
R_t^B\tilde{K}_B
$$

这样 Mapper 主要学习的是：

> Source Model 的内容表示空间 → Target Model 的内容表示空间

而不是同时学习位置编码差异。

---

### 结果

部分模型对：

- 保留目标模型约 73–98% 的准确率
- 映射比完整 Prefill 快约 2.7–25×

但结果并不稳定：

```text
6 个模型 pair
├─ 4 个表现很好
└─ 2 个明显失败
```

使用非线性 MLP 后，失败的模型 pair 可以恢复一部分质量。

这说明：

> **Cross-model KV transferability 可能本身就是一个与模型 pair 强相关的性质。**

论文：

https://arxiv.org/abs/2608.03893

---

## 6.4 CacheBridge

**CacheBridge: Efficient Cross-Model KV Cache Transfer**  
2026.09

CacheBridge 基本是在上面的线性 KV Mapping 上继续优化。

原来的方法可能让一个 Target KV Head 读取很多 Source Head：

```text
Target H1
← Source H1
← Source H2
← Source H3
← ...
```

这样：

- Mapper 很大
- 计算量大
- 不相关 Head 会引入噪声

CacheBridge 改成：

> **Attention-aware Head Matching**

即先寻找：

```text
Source Head h_A
      ↕
Target Head h_B
```

再只在匹配 Head 之间进行映射。

---

### Attention-aware Reconstruction

普通线性拟合优化的是：

$$
\min_W
\left\|
WK_A-K_B
\right\|^2
$$

也就是所有误差一视同仁。

但 Attention 真正使用的是：

$$
Attention(Q,K,V)
=
softmax(QK^T)V
$$

某些 KV 误差虽然数值上很大，却可能几乎不影响 Attention。

另一些误差虽然很小，却刚好影响了关键 Attention 方向。

所以 CacheBridge 更强调：

> **Attention Behavior Similarity**

而不是单纯：

> **KV Numerical Similarity**

论文：

https://arxiv.org/abs/2609.00891

---

## 6.5 Universal Context-Reuse Layer

**A Universal Context-Reuse Layer for Cross-Model KV Sharing**  
2026.08.31

这篇把目标扩展到：

- 不同参数规模
- 不同 Layer 数
- 不同 Attention
- 不同 Tokenizer
- 不同 Architecture
- 不同 Model Family

例如：

```text
Llama → Qwen
Qwen → Gemma
```

它把这个问题称为：

> **Context Mobility（上下文可迁移性）**

论文报告的一个例子是：

```text
Llama-3.1-70B
      ↓ KV handoff
Qwen2.5-7B
```

目标模型正常 Prefill：

- Accuracy 约 45.7%
- Latency 约 899 ms

KV Handoff：

- Accuracy 约 44.0%
- Latency 约 138 ms

不过目前公开版本对其通用 Transport Module 的核心细节描述不如前几篇完整，因此更适合把它理解为：

> **Cross-family KV handoff 可行性的早期证据。**

论文：

https://arxiv.org/abs/2608.30963

---

## 6.6 ICaRus：从训练阶段直接让 KV 一致

**ICaRus: Identical Cache Reuse for Efficient Multi-Model Inference**  
ICLR 2026

前面的工作都在解决：

> 已经训练好的两个模型 KV 不一样，如何转换？

ICaRus 换了一个思路：

> 从训练时就让不同专用模型产生相同 KV。

它把模型概念上拆成：

```text
Shared Logical Encoder
        ↓
      Same KV
      /  |  \
Math   Code   Reasoning
Head   Head      Head
```

冻结负责生成 KV 的部分，只微调后面的任务部分。

于是：

$$
KV_A = KV_B = KV_C
$$

这样就不需要 Translator。

优点：

- 可以直接完全复用
- 没有 KV Translation 成本

缺点：

- 需要按这种方式训练
- 不能直接拿任意现成模型做

---

# 7. 相关工作的关系

## 7.1 子 Agent Context 管理

| 工作 | 核心问题 | 是否减少重复探索 | 是否减少 Prefill |
|---|---|---:|---:|
| AOrchestra | 给 Child 什么相关 Context | ✅ | ❌ |
| DeLM | 多 Agent 如何共享已验证进展 | ✅ | ❌ |

---

## 7.2 KV-Cache 复用

| 工作 | 模型关系 | 核心方法 | 是否真正减少 Receiver Prefill |
|---|---|---|---:|
| DroidSpeak | 同基模微调变体 | 复用大部分 Layer，关键层重算 | ✅ |
| ICaRus | 按统一方案训练的专用模型 | 从训练阶段让 KV 相同 | ✅ |
| C2C | 异构模型 | Source KV 融合进 Target KV | 不完全是 |
| MoT | 异构模型 | Mixture of Translators | ✅ |
| Cross-Model KV Transfer | 同 family 不同尺寸 | Linear / Ridge Mapping | ✅ |
| Universal Context-Reuse | 跨 family | 通用 KV Transport | ✅，但仍属早期结果 |
| CacheBridge | 异构模型 | Head Matching + Attention-aware Mapping | ✅ |

---

# 8. 两条研究线的本质区别

可以把它们压缩成两个问题。

### Context Management

> **Child 应该知道什么？**

```text
Parent Context
      ↓
Context Selection
      ↓
Relevant Information
      ↓
Child
```

主要减少：

- 重复探索
- 重复工具调用
- 重复搜索
- 重复推理

---

### KV-Cache Reuse

> **这些 Child 应该知道的内容，能不能不重新算？**

```text
Parent 已经处理过 Context
        ↓
KV Reuse / KV Translation
        ↓
Child 继承计算状态
```

主要减少：

- Prefill
- GPU 计算
- TTFT

---

# 9. 一个自然但过大的联合方向

从逻辑上看，可以把两条线组合成：

```text
Main Agent Context
       ↓
Context Selector
       ↓
┌──────────────┬──────────────┬──────────────┐
│              │              │
Raw Text     Summary       KV Transfer
│              │              │
└──────────────┴──────────────┴──────────────┘
               ↓
            Sub-Agent
```

甚至进一步根据 Context 类型决定：

```text
明确事实 / 约束
→ Raw Text

高成本、已验证的长 Context
→ KV Transfer

Parent 的推测
→ 让 Child 独立验证

无关信息
→ Drop
```

但这个问题实际上同时涉及：

1. Agent Orchestration
2. Context Management
3. Cross-model KV Translation
4. Serving Runtime

范围很容易过大。

所以：

> **把多个已有方向直接拼起来，并不会自动形成一个好的新研究问题。**

---

# 10. 当前已经比较拥挤的问题

下面这些方向已经有比较直接的工作：

| 想法 | 当前情况 |
|---|---|
| Planner / Coder / Reviewer 式新 Multi-Agent 架构 | 很拥挤 |
| 主 Agent 给 Child 传相关 Context | AOrchestra 已直接研究 |
| 多 Agent 共享已验证信息 | DeLM 已研究 |
| 同源微调模型复用 KV | DroidSpeak 已研究 |
| 异构模型 KV Translator | MoT、C2C、Universal 等已经开始形成研究线 |
| 同 family 的线性 KV Mapping | Cross-Model Transfer、CacheBridge 已研究 |
| 从训练阶段统一 KV | ICaRus 已研究 |

因此后续更有价值的方向，可能不再是：

> “再设计一个新的 Context Selector 或 KV Translator”

而是去研究：

> **这些已有方法在什么条件下会失效。**

---

# 11. 仍然值得继续研究的问题

## 11.1 Cross-model KV Transferability

Closed-form KV Transfer 的结果很有意思：

```text
6 个 model pair
├─ 4 个效果很好
└─ 2 个明显失败
```

这说明：

> 不同模型之间的 KV 兼容性可能差异非常大。

可以继续研究：

- 哪些 architecture feature 会影响兼容性？
- Representation Similarity 能否预测？
- Attention configuration 是否决定线性可映射性？
- Fine-tuning 强度会不会破坏兼容性？
- 能否在真正构建 Mapper 之前就判断两个模型是否值得做 KV Transfer？

可以把问题写成：

$$
Compatibility(A,B)
\rightarrow
\text{是否值得进行 KV Transfer}
$$

也就是：

> **Cross-model KV Compatibility / Transferability Prediction**

---

## 11.2 KV / Context Reuse 的 Failure Boundary

多数已有工作在证明：

> Reuse 可以更快。

但还有另一个问题：

> **什么时候 Reuse 会开始伤害模型或 Agent？**

例如：

- Reasoning 是否比普通 QA 更敏感？
- Coding 是否更敏感？
- Judge Model 是否更敏感？
- Context 越长是否越容易出问题？
- Parent 的错误 Context 是否会被 Child 放大？
- Context 已经过期后继续复用会怎样？
- 不同任务对 KV Approximation 的容忍度是否不同？

这类问题更适合做：

> **Failure Mode + Mechanism + Benchmark**

---

## 11.3 Context Inheritance vs Independent Verification

AOrchestra 更关注：

```text
Relevant / Irrelevant
```

但实际 Agent 系统还存在：

```text
Trust / Verify / Reacquire
```

例如：

```text
Parent 提供文件中的明确事实
→ 直接继承

Parent 提供推测
→ Child 重新验证

Parent 提供旧的环境状态
→ 重新获取
```

这里本质上是：

$$
\text{Reuse Benefit}
\quad vs \quad
\text{Error Propagation Risk}
$$

需要同时考虑：

- 信息来源
- 信息置信度
- 验证成本
- 错误后果
- Context 是否可能过期

---

## 11.4 Stale Context / Version Consistency

真实 Agent 系统中，环境可能同时被多个 Agent 修改：

```text
Parent 读取 auth.ts v1
       ↓
把结论交给 Child

与此同时：

Agent B 把 auth.ts 修改成 v2

       ↓

Child 仍然基于 v1 Context 继续工作
```

这会产生：

> **Stale Context（过期上下文）**

进一步的问题包括：

- Context 什么时候应该被判定为 stale？
- Context 是否需要 version？
- 是否需要 provenance？
- Parent 获得新证据后，Child 当前 Plan 是否需要失效？
- 多 Agent 并发修改 Workspace 时如何保证 Context Consistency？

这类问题更接近：

> **Agent Runtime + Distributed Systems**

而不是普通 Prompt Engineering。

---

# 12. 整体技术演进

可以把这几条工作放在同一条线上理解：

```text
主 Agent 已经积累 Context
        ↓
Sub-Agent 是否需要重新探索？
        ↓
AOrchestra / DeLM
解决语义层 Context Sharing
        ↓
但 Child 仍然要重新 Prefill
        ↓
DroidSpeak
同源微调模型部分共享 KV
        ↓
C2C
异构模型开始直接传递内部表示
        ↓
MoT
真正做 KV_A → KV_B Translation
        ↓
Cross-Model KV Transfer
发现部分模型之间甚至可以线性映射
        ↓
CacheBridge
进一步降低 Mapping 成本
        ↓
Universal Context-Reuse
开始探索 Cross-family Context Mobility
```

因此目前的发展趋势已经比较清楚：

> **Agent 层面在研究“已有信息如何共享”，Serving 层面在研究“已有计算如何共享”。**

真正还没有完全解决的重点，正在逐渐从：

> “能不能共享”

转向：

> **“什么时候共享是安全的、什么时候共享会失败，以及系统能不能事先判断。”**

---

# 13. 总结

主 Agent / 子 Agent 系统里有两种很自然的冗余：

```text
重复探索
+
重复 Prefill
```

AOrchestra、DeLM 等工作主要解决前者：

> **让 Agent 不必重新寻找已经获得的信息。**

DroidSpeak 和后续 Cross-model KV 工作主要解决后者：

> **让模型不必重新计算已经处理过的 Context。**

DroidSpeak 证明，同一个基础模型的不同微调版本之间，可以通过：

```text
大部分 Layer 复用
+
少部分 Critical Layer 重算
```

来避免完整 Prefill。

后续工作又进一步扩展到：

- 异构模型之间的 Latent Communication
- KV Translation
- Linear KV Mapping
- Cross-family Context Mobility

因此，单纯研究：

> “给子 Agent 传 Context”

或者：

> “不同模型能不能共享 KV”

已经逐渐变得拥挤。

现在更值得关注的问题是：

1. **哪些模型之间的 KV 本身具有可迁移性？**
2. **能否提前预测 KV Transfer 是否会成功？**
3. **Context / KV Reuse 在什么条件下会失效？**
4. **Parent 的错误是否会随着 Context Inheritance 传播？**
5. **什么时候 Child 应该继承，什么时候应该独立验证？**
6. **动态环境中如何处理 Stale Context 和版本一致性？**

整体来看，研究重点正在从：

```text
Can we reuse context?
```

逐渐转向：

```text
When should we reuse it,
and when should we not?
```
