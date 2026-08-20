# Scaling Laws（Part 2）：实践配方、下游能力与推理时扩展

> Stanford CS336 Lecture 11。上一讲给出了 $L(N,D)$ 和计算最优分配的基本形式；本讲关注真实大模型如何做 scaling study：学习率/批量如何迁移、Chinchilla sweep 如何省成本、muP 为什么能稳定宽度外推，以及 pretrain loss、downstream 能力和 test-time compute 为什么不完全等价。

---

## 1. 真实缩放的三个难题

### 1.1 从小模型预测大模型并不自动成立

需要同时解决：

1. **模型架构缩放**：深度、宽度、长宽比、注意力和 MLP 维度是否保持比例？
2. **优化器超参数缩放**：学习率、batch size、warmup、weight decay 是否随规模改变？
3. **计算最优数据—模型比例**：需要大量从头训练运行，拟合 Chinchilla 曲线本身可能耗费接近目标训练预算。

初始化、优化器和学习率/批量 schedule 都可能对规模敏感。若只把参数量放大而沿用一个小模型的训练配置，曲线可能看似有规律，到了大模型却发散或完全改变斜率。

### 1.2 从小模型外推的基本流程

1. 先固定 tokenizer、数据清洗、序列长度和评估协议。
2. 训练多个宽度/深度以及多个数据量的模型，不只沿一条“模型和数据一起变大”的对角线。
3. 对每个 $(N,D,C)$ 记录最终 loss、学习率、batch、实际 FLOPs、吞吐和稳定性。
4. 拟合 loss、最优学习率、最优 batch 或架构变量的缩放关系。
5. 用预测结果选择目标规模配置，在目标规模做复核。

---

## 2. MiniCPM：muP 与 Chinchilla 分析的实践案例

### 2.1 公开结果与策略

MiniCPM（清华团队，2024）展示了约 1–2.5B 参数模型的高性能；在许多任务上超过其他约 2B 模型，并接近一些现代 7B 模型。它不是当时绝对的 SOTA，却公开了相当完整的缩放计算。

核心策略：

- 使用 muP 让初始化和学习率对宽度更稳定；
- 固定模型 aspect ratio（深度/宽度比例），只整体放大模型；
- 用小规模实验直接拟合最优 batch、learning rate 和 token/parameter ratio；
- 示例超参数包括 `Scale_emb = 12`、`scale_depth = 1.4`、`init_std = 0.1`、`lr = 0.01`（这些是该配方的设置，不是所有 Transformer 的通用常数）。

缩放实验中最大模型与最终真正训练的模型仍相差约 5 倍；关键是验证最优 batch、学习率和 token-to-size ratio 可以从小网格外推。

### 2.2 最优学习率

muP 的理想主张是：改变宽度后，在正确参数化下最优学习率大致稳定。实际仍需：

- 在多个宽度、多个学习率上画最终 loss 曲线；
- 检查最小点是否稳定、是否存在发散边界；
- 区分 Adam、SGD、Muon 等优化器，因为每种更新的尺度不同。

若使用普通参数化（standard parameterization, SP），最优点可能随宽度明显漂移，需要每个规模重新调参。

### 2.3 最优 batch 的测量

MiniCPM 对 9M、30M、170M 等模型扫描数据量（纵轴）、batch（横轴）和 loss。固定 batch 的竖直点列表示一条训练曲线；在每个数据量处取最低 loss 点，可得到模型大小/数据量组合下的最优 batch。

随后可以仿照 Kaplan，把最优 batch 画成最终 loss 的函数：

$$
B_{\mathrm{opt}}\approx f(L_{\mathrm{final}}),
$$

经验上呈多项式增长：loss 越低（训练越充分），合理 batch 往往越大。它与上一讲的 critical batch size 直觉一致，但这里是经过具体训练 schedule 和目标数据集拟合的经验关系。

---

## 3. 用 WSD 降低 Chinchilla sweep 的成本

### 3.1 为什么完整拟合很贵

Chinchilla 方法需要知道每个 $(N,D)$ 模型**从头训练到目标数据量后的最终 loss**。如果每个规模都只训练一小段再 early stop，不能可靠地判断最终数据收益。对 $n$ 个模型规模与 $n$ 个数据规模，完整网格的训练开销近似从 $O(n)$ 增长到 $O(n^2)$。

### 3.2 WSD（Warmup–Stable–Decay）schedule

与单一 cosine schedule 不同，WSD 把学习率分为三段：

1. **Warmup**：从小学习率升到目标值；
2. **Stable**：长时间保持近似常数；
3. **Decay**：在末段快速衰减，课程中 MiniCPM 的 decay 约占 10% 左右。

示意写作

$$
\eta(t)=
\begin{cases}
\eta_{\max}\,t/T_w,&0\le t<T_w,\\
\eta_{\max},&T_w\le t<T_s,\\
\eta_{\max}\,g(t),&T_s\le t\le T,
\end{cases}
$$

其中 $g(t)$ 可为线性或 cosine 衰减。

在 stable 阶段结束时可以复制/重启运行，改变目标训练长度而不必从零开始完整跑完所有模型；因此 WSD 让 Chinchilla 风格的曲线拟合更便宜。它在 MiniCPM 中表现良好：stable 阶段较慢、decay 阶段损失快速下降。

### 3.3 MiniCPM 的 Chinchilla 拟合

MiniCPM 同时使用：

- **方法 1（lower envelope）**：在不同运行的最终 loss 中取下包络，观察模型大小—数据比例趋势；
- **方法 3（joint fit）**：在模型/数据网格上直接拟合联合 scaling law。

方法 1 显示随数据增加仍有收益，且数据方面的边际收益相对低；方法 3 给出的最优 data/model ratio 较高，支持“较小模型用更多 token”这一部署友好方向。不同方法不完全一致，说明 schedule、参数口径和拟合噪声仍然重要。

---

## 4. DeepSeek、Qwen 与近期公开配方

### 4.1 DeepSeek

DeepSeek（2024）研究了约 7B 和 67B 参数模型的缩放，整体性能在开源模型中较强。与 MiniCPM 不同，它不依赖 muP 来固定最优点，而是直接估计每个规模的 batch 和 learning rate：

1. 在小规模上收集“近最优”模型（最终 loss 在最小值约 0.25% 内）；
2. 对 batch/LR 变量拟合经验幂律；
3. 将拟合结果用于大模型。

DeepSeek 也使用 WSD 风格的 schedule：快速 warmup，再进行两次约 10% 的 decay。实践中通常能达到与 cosine 接近的性能。

数据—模型折中采用 **Chinchilla 方法 2（IsoFLOPs）**：对固定 FLOPs 预算改变参数量和 token 数，取每条等 FLOPs 曲线的最低点。拟合后的 scaling law 总体上能预测最终模型 loss。

### 4.2 其他公开报告中的变量

| 项目/研究 | Scaling 关注点 | 课堂要点 |
| --- | --- | --- |
| Qwen 2.5 | batch 与超参数拟合 | 展示 batch/LR 随规模变化的经验曲线 |
| Qwen 3 | LR/batch 缩放 | 结论相似，但公开细节有限 |
| Kimi K2 | MoE/稀疏性 | 用 sparsity scaling 选择稀疏水平与 active 参数 |
| Hunyuan（2024） | MoE 参数规模 | IsoFLOPs 风格，示例 data:active-param 约 96:1 |
| LLaMA 3（2024） | 数据规模与 downstream | IsoFLOPs 和 compute-to-downstream scaling，示例 ratio 约 39:1 |
| MiniMax-01（2025） | 架构缩放 | 同时考察架构变量和 Chinchilla 方法 1 |

这些数字依赖 token 定义（总参数还是 active 参数）、数据清洗和 loss/下游指标，不能作为跨模型的硬规则。

### 4.3 近期经验归纳

不同团队的公开程度不同，但常见 recipe 可以归纳为：

- 假设多数 Transformer 结构比例在规模间不变，单独做 batch/LR scaling；
- 使用 IsoFLOPs 选择模型大小；
- 使用 WSD 等分段 schedule 降低 joint-fit 成本；
- 或使用 muP，使初始化和学习率迁移更稳定；
- 更晚的研究常只公开 IsoFLOPs 或架构决策，不公开完整 optimizer sweep。

---

## 5. 优化器、batch 和学习率的 Scaling

### 5.1 StepFun 的经验研究

核心问题是：当模型与数据变大时，LR/batch 的正确变量和函数形式是什么？候选观点包括：

- **Critical batch 观点**：batch 是最终 loss 的函数（OpenAI/Kaplan 风格）；
- **Compute power law**：batch 或 LR 是训练 compute 的幂函数（DeepSeek 风格）；
- **其他经验参数化**：直接按 $(N,D)$ 网格拟合。

StepFun 风格的做法是网格搜索 batch × LR，观察 pretraining loss 曲面：

- 对 batch 与 LR，损失曲面通常近似凸，最小点可较干净地识别；
- Chinchilla 联合缩放下，最优 batch 主要依赖数据量 $D$；
- 固定模型大小时，$D$ 增大可能伴随更高最优 LR，但若把 schedule 从 cosine 换成 WSD，这一结论可能不稳健；
- 趋势在 MoE、其他数据集和多个优化器上有一定泛化，但仍需复核。

### 5.2 常见失败模式

1. 不同优化器需要完全不同的 LR、weight decay 和 batch；“同一 LR 适用于所有 optimizer”会产生错误比较。
2. scale dependence 可能很强；如果一项改进只在更大 compute 或更有利的 Chinchilla ratio 下出现，不能归因于算法本身。
3. 一条漂亮的小规模 scaling 曲线可能在大规模发散。参数化、梯度裁剪、warmup、二阶矩估计和通信数值误差都可能在大规模放大。
4. 强 weight decay（例如 $0.1$）可能是 muP 的显著失败模式；RMSNorm 可学习 gain、某些 exotic optimizer、SwiGLU/squared ReLU、初始化细节也可能破坏理论假设。

算法开发时必须报告：固定 compute 的比较、固定 data/model ratio 的比较和超参数调优预算；否则规模本身是混杂变量。

---

## 6. muP：为什么能稳定宽度外推

### 6.1 记号与两条条件

考虑深度线性网络

$$
 h_l=W_l h_{l-1},
 \qquad W_l\in\mathbb R^{n_l\times n_{l-1}},
$$

其中 $n_l$ 是第 $l$ 层宽度。muP 的直观目标是让宽度改变时：

- **A1：初始化激活稳定**：每个激活坐标为 $\Theta(1)$，因而 $\|h_l\|_2=\Theta(\sqrt{n_l})$；
- **A2：一步更新稳定**：梯度更新造成的激活变化 $\Delta h_l$ 也为 $\Theta(1)$，既不会在宽模型中消失，也不会爆炸。

稳定的激活与稳定的更新意味着：在小模型上调好的 LR、初始化和某些结构超参数可以迁移到大模型。

### 6.2 条件 A1：初始化方差的量纲

设 $W_{l,ij}\sim\mathcal N(0,\sigma_l^2)$。对固定 $h_{l-1}$，有

$$
\mathbb E\left[\|W_lh_{l-1}\|_2^2\mid h_{l-1}\right]
=n_l\sigma_l^2\|h_{l-1}\|_2^2.
$$

若归纳假设 $\|h_{l-1}\|_2^2=\Theta(n_{l-1})$，要让 $\|h_l\|_2^2=\Theta(n_l)$，需要

$$
 n_l\sigma_l^2 n_{l-1}=\Theta(n_l)
 \quad\Longrightarrow\quad
 \sigma_l^2=\Theta\left(\frac1{n_{l-1}}\right).
$$

也就是说，输入宽度越大，单个权重的方差必须按 $1/n_{l-1}$ 缩小。Xavier/He 初始化是这一量纲约束的具体实现；muP 进一步把它与不同层的宽度、输出读出方式统一起来。

### 6.3 条件 A2：更新不能随宽度爆炸

SGD 对线性层的更新具有激活外积形式：

$$
\Delta W_l=-\eta_l\nabla_{h_l}\ell\;h_{l-1}^{\top}.
$$

激活更新为

$$
\Delta h_l
=(W_l+\Delta W_l)(h_{l-1}+\Delta h_{l-1})-W_lh_{l-1}
$$

$$
= W_l\Delta h_{l-1}
+\Delta W_lh_{l-1}
+\Delta W_l\Delta h_{l-1}.
$$

在高宽度下，若每个坐标激活为 $\Theta(1)$，则 $\|h_{l-1}\|=\Theta(\sqrt{n_{l-1}})$。要使直接更新项 $\Delta W_lh_{l-1}$ 为 $\Theta(1)$，需要选择 LR 与矩阵元素尺度，使

$$
\|\Delta W_l\|_{\mathrm{eff}}\sqrt{n_{l-1}}=\Theta(1).
$$

由于 $\Delta W_l$ 又含有 $\eta_l$、$\nabla_{h_l}\ell$ 和 $h_{l-1}$，可得到与 fan-in/fan-out 相关的 LR 缩放；Adam 的归一化使具体幂次与 SGD 不同。关键不是死记一条 LR 数字，而是保持“更新对下一层激活的有效作用”为 $O(1)$。

### 6.4 Transformer 中的渐近规则

令 $M$ 表示基准宽度，课程给出的 muP 表格可概括为以下**数量级**（精确系数依赖架构和优化器）：

| 参数组 | 初始化方差（数量级） | Adam LR（数量级） | 说明 |
| --- | --- | --- | --- |
| embedding $W^E$ | $\Theta(1)$ | $\Theta(1)$ | 输入/词表读出单独处理 |
| $W^{AQ},W^{AK},W^{AV}$ | $\Theta(1/M)$ | $\Theta(1/M)$ | query/key/value 投影 |
| attention output $W^{AO}$ | $\Theta(1/M)$（注意力缩放含 $H,D$） | $\Theta(1/M)$ | 汇聚多个 head |
| MLP input $W^{FI}$ | $\Theta(1/M)$ | $\Theta(1/M)$ | 上投影/门控输入 |
| MLP output $W^{FO}$ | $\Theta(1/M)$（课程 exact 示例约 $0.25/M$） | $\Theta(1/M)$ | 回到 model width |
| unembedding/output $W^U$ | $\Theta(1/M^2)$ | $\Theta(1/M)$ | 防止 logits 随宽度爆炸 |

普通参数化往往把这些矩阵用同一类 fan-in 初始化并使用宽度不变 LR；宽度变大时最优 LR 漂移。muP 通过每类参数的 init/LR 规则使“最大更新”保持稳定，因而常被用于 zero-shot 超参数迁移。

### 6.5 muP 的边界

现代 LLM 并非理论中的纯线性网络；下列因素都需要实测：

- SwiGLU、squared ReLU 等非线性；
- 大/小 batch；
- zero attention、特殊初始化和 RMSNorm gain；
- Lion 等基于梯度符号的优化器；
- 强 regularization/weight decay。

课程实验显示 RMSNorm 的可学习 gain 可能破坏 muP 的稳定缩放；移除 gain 只带来很小性能损失。某些 exotic optimizer 和强 weight decay 也会明显偏离理论。总体证据仍支持 muP 比 standard parameterization 更容易调，但它不是“任何组件都自动适用”的保证。

---

## 7. Pretrain Loss 与 Downstream 能力

### 7.1 为什么下游不一定平滑

Pretraining loss 是对大量 token 的平均交叉熵，通常随 $N,D,C$ 平滑下降；下游任务则可能：

- 只考察少数技能（数学、代码、工具使用、知识）；
- 依赖 prompt、few-shot 示例和输出格式；
- 使用离散 accuracy/pass@k，存在阈值与噪声；
- 对 tokenizer、数据污染和 domain mixture 很敏感。

因此对第 $j$ 个 downstream 任务，可以用更谨慎的经验式表示：

$$
\mathcal E_j(N,D)
\approx \mathcal E_{j,\infty}
+A_jN^{-\alpha_j}+B_jD^{-\beta_j}+\varepsilon_j,
$$

但 $\mathcal E_j$ 的噪声和指数 $\alpha_j,\beta_j$ 可能远大于 pretrain loss；若指标是 accuracy，需要用 logit/错误率等连续代理分析。

### 7.2 “涌现能力”与度量阈值

当任务需要达到某个最低语言/知识能力才能答对时，连续的潜在能力经过离散评分会显得像突然出现：

$$
\operatorname{Acc}(N)
\approx \sigma\bigl(a(\mathrm{skill}(N)-\tau)\bigr),
$$

其中 $\sigma$ 是 logistic，$\tau$ 是任务阈值。若换成按 token 的交叉熵、校准概率或部分得分，所谓“突然涌现”可能变成平滑增长；但真正的组合能力也可能在规模、数据和 inference strategy 达到临界点后快速增强。

分析涌现时应同时报告：模型规模、训练 token、prompt/few-shot、解码配置、任务分解方式、连续指标和误差条，避免把 benchmark 格式变化误判为新能力。

### 7.3 用 scaling 预测下游的正确流程

1. 先拟合 pretrain loss 作为低噪声 proxy。
2. 对每个关键下游任务在多个规模上固定 prompt 和 decoding，测量完整曲线。
3. 检查是否能用 loss/skill 解释任务变化，而不是默认线性对应。
4. 对能力阈值、数据污染、prompt 敏感任务分别拟合，必要时用任务族的分层模型。
5. 把最终模型选择同时按 pretrain loss、目标下游、推理成本和安全指标优化。

“更低 pretrain loss”通常是必要但不充分条件；同样的 loss 可能来自不同的数据组成，带来不同的代码、数学、多语言或对话能力。

---

## 8. Data Quality 对 Scaling 的影响

### 8.1 数量不等于有效 token

把每个数据来源 $i$ 的 token 数写成 $D_i$，用 $q_i$ 表示相对质量/目标相关性，可定义一个用于直觉分析的有效数据量：

$$
D_{\mathrm{eff}}=\sum_i q_iD_i,
\qquad 0\le q_i\le 1.
$$

把它代入数据项：

$$
L\approx E+A N^{-\alpha}+B D_{\mathrm{eff}}^{-\beta}.
$$

高质量、去重、事实一致、任务相关的数据可提高 $D_{\mathrm{eff}}$；低质量网页、重复模板、污染样本或与目标 domain 不匹配的数据使 $q_i$ 很小。真实实验中质量还可能改变 $E,A,B$ 和指数，而不是只有简单的 token 权重。

### 8.2 质量、重复与混合比例

- **重复**：同一信息被多次见到，收益按上一讲的有效数据公式饱和；同时可能过拟合。
- **去重**：降低训练—验证重叠与记忆性，提高独立评测可信度。
- **高质量数据**：常表现为较低的损失 offset、较高的下游样本效率；但过度过滤会减少覆盖面和多样性。
- **混合比例**：不同模型规模的最优混合可能不同；小模型偏好容易数据，大模型可能从稀有/高质量长尾中继续获益。
- **分布匹配**：数据对目标任务的价值由目标分布决定，不能只用混合数据的平均 loss 排序。

实际选择应同时测量：验证 loss、去重后唯一 token、来源/语言/代码比例、长尾覆盖、下游任务和污染率。

### 8.3 数据质量实验设计

1. 建立来源级 metadata（来源、时间、语言、许可证、过滤规则）。
2. 对每个质量等级做固定 $N,D,C$ 的对照，避免高质量集同时拥有更好的 tokenization 或更多计算。
3. 画 $L(D)$ 与下游性能曲线，比较 offset、斜率和饱和点。
4. 做混合比例和重复率 sweep，并保留完全独立的 fresh/private eval。
5. 报告质量过滤损失：删掉多少 token、去掉哪些能力、是否引入语言/地域偏差。

---

## 9. Test-Time Compute Scaling（推理时计算扩展）

### 9.1 与训练 Scaling 的区别

Training scaling 增加参数量、训练数据或训练 FLOPs；**test-time compute scaling** 在模型冻结后，为每一个问题投入更多推理计算，例如：

- 生成多个候选并做 self-consistency/majority vote；
- 采样不同 reasoning traces，由 verifier/reranker 选最可信答案；
- 使用 beam/tree search、工具调用、代码执行和反思；
- 对同一个候选做多轮验证或单元测试。

每个 query 的推理预算可以抽象为

$$
C_{\mathrm{test}}
\approx kC_{\mathrm{sample}}+C_{\mathrm{verify}}+C_{\mathrm{search}},
$$

其中 $k$ 为候选数。与单次 greedy 相比，性能往往提高但具有边际递减。

### 9.2 简单的多样本上界

若单次独立候选解题成功率为 $p$，且最终选择器能选中任意正确候选，则 $k$ 次采样至少有一个正确答案的概率为

$$
P_{\mathrm{any}}(k)=1-(1-p)^k.
$$

它解释了 self-consistency 的早期收益；真实系统并不满足独立性，且 verifier 可能选错，因此实际曲线低于这个上界并在较大 $k$ 时饱和。

### 9.3 Test-time scaling 曲线

可用与训练缩放类似的形式拟合错误率：

$$
E(C_{\mathrm{test}})
\approx E_\infty+A_tC_{\mathrm{test}}^{-\alpha_t},
$$

或对 solve rate 使用饱和 logistic。横轴应明确是每题 token、模型 FLOPs、候选数、工具调用数还是 wall-clock；不同 verifier 和搜索策略不能混成一条曲线。

测试时扩展尤其适合数学、代码和可验证任务：代码可以执行单元测试，数学可以检查答案/步骤，搜索可以用规则或外部工具验证。开放式写作的“正确性”不明确时，更多采样可能只是产生更多风格差异。

### 9.4 训练—推理预算的联合决策

若预计要回答 $Q$ 个 query，总生命周期计算可写成

$$
C_{\mathrm{life}}
=C_{\mathrm{train}}(N,D)+Q\,C_{\mathrm{test}}(N,k).
$$

当 $Q$ 小，可以用大模型和较少的 test-time search；当 $Q$ 大或任务可验证时，训练更强的 verifier/小模型、缓存共享前缀、使用 speculative decoding 或批量搜索可能更划算。模型规模 scaling、训练 token scaling 与 inference-time scaling 是三个可共同优化的轴。

---

## 10. 一个可复现的实践 Checklist

### 10.1 拟合前

- 固定数据版本、去重、tokenizer、序列长度和验证集。
- 明确 $N$ 是总参数、非 embedding 参数还是 active 参数。
- 记录真实 FLOPs（MoE 不能只报告总参数）、batch、LR、schedule、optimizer 和稳定性。
- 为每个设置分配足够调参预算，避免把未调优的 baseline 当成算法差异。

### 10.2 拟合时

- 同时尝试 lower envelope、IsoFLOPs 和 joint fit。
- 报告 $E,A,B,\alpha,\beta$、置信区间和外推范围。
- 检查 log-log 残差、数据重复、warmup、early stopping 和 schedule 敏感性。
- 对 downstream、data quality 和 test-time compute 单独拟合，不强行沿用 pretrain loss 指数。

### 10.3 交付前

- 在目标规模做真实复核运行。
- 同时比较训练成本、推理显存/吞吐、目标下游和安全指标。
- 保存每个模型的 checkpoint、数据摘要、配置和评估 prompts，确保曲线可以复现。

---

## 11. 本讲总结

- Scaling 在真实项目中首先是实验设计问题：LR、batch、schedule、数据质量和参数口径都会改变结论。
- MiniCPM 用 muP、固定 aspect ratio 和 WSD 降低缩放与 Chinchilla 拟合成本；DeepSeek 用近最优 LR/batch sweep、WSD 和 IsoFLOPs 直接外推。
- StepFun/Qwen 等研究表明最优 batch/LR 通常能从小规模经验曲面预测，但不同 optimizer 和 schedule 可能改变缩放率。
- muP 的两个核心条件是初始化激活与一步更新保持 $\Theta(1)$；它提高宽度迁移稳定性，但对 RMSNorm gain、强 weight decay、exotic optimizer 等并不自动鲁棒。
- Pretrain loss 是平滑 proxy，不等于下游能力；离散指标、prompt 和任务阈值会造成 apparent emergence。应分别拟合 downstream 曲线并检查数据污染。
- 数据质量通过有效 token、loss offset/斜率、混合比例和重复饱和影响 scaling；“更多原始 token”不等于“更多有效学习信号”。
- Test-time compute scaling 通过多样本、验证器、搜索和工具调用提升解题率，可用 $E(C_{\mathrm{test}})=E_\infty+A_tC_{\mathrm{test}}^{-\alpha_t}$ 描述边际递减；最终应共同优化训练、部署和每 query 的计算预算。
