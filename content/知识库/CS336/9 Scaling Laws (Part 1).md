# Scaling Laws（Part 1）：从数据、模型到算力的可预测规律

> Stanford CS336 Lecture 9。主题是：用少量小规模实验拟合**缩放定律（scaling law）**，再外推到大模型，从而回答“应该扩大模型、数据，还是训练步数”等问题。
>
> 本讲义中的 $N$ 表示参数量，$D$ 表示训练 token 数，$C$ 表示训练 FLOPs（浮点运算量），$L$ 表示语言模型损失（通常是 token-level cross-entropy）。不同论文的参数计数、学习率计划和数据过滤方式不同，因此常数与指数只能在相同实验协议内比较。

---

## 1. 为什么要认真对待 Scaling

### 1.1 大规模资源下真正困难的选择

假设拿到一万张 B200 GPU、一个月时间，要训练一个高质量开源语言模型。基础设施、分布式训练框架和预训练数据当然重要，但还必须决定：

- 模型应该**宽**还是**深**？层数、隐藏维度、注意力头数和非线性函数如何选？
- 使用 Transformer 还是 LSTM？Adam 还是 SGD？
- 相同预算下，是训练更大的模型，还是让模型在更多数据上训练更久？
- 目标是最低训练损失、最低推理成本，还是某个 downstream（下游）任务的最高准确率？

直接在目标规模上试错会消耗数千万美元甚至更高。Scaling law 的目标是把“在大模型上调参”变成“在一组小模型上拟合可外推的规律”。

### 1.2 Scaling law 的定义

**缩放定律**是一个把资源规模映射到模型表现的简单、可预测公式。例如单变量数据缩放常写成：

$$
L(D) = L_\infty + A D^{-\beta}, \qquad A>0,\;\beta>0,
$$

其中：

- $L_\infty$：无限数据/无限资源下的不可约损失或渐近下限；
- $A$：任务、数据分布、架构和训练协议决定的幅度；
- $\beta$：缩放指数，决定收益衰减速度；
- $D^{-\beta}$：数据增加后剩余误差以幂律衰减。

当 $L_\infty$ 较小且可忽略时，

$$
\log L \approx \log A - \beta \log D,
$$

因此在 log-log 图上近似一条直线，斜率为 $-\beta$。加入下限后，不能把整条曲线都当成直线；通常要拟合 $L-L_\infty$ 或直接用三参数幂律。

### 1.3 早期背景

- 经典统计学习给出的是样本复杂度上界，例如有限假设集合的误差随 $n$ 大致按 $\log k/n$ 缩放；平滑密度估计也出现多项式收敛率。
- Banko & Brill（2001）观察到机器翻译随数据量呈 log-linear 改善。
- Kolachina 等（2012）研究了数据规模和下游性能的幂律关系。
- Hestness 等（2017）在机器翻译、语言建模、语音等任务上展示了可预测的神经网络缩放曲线，并讨论了“涌现”与速度/准确率的关系。
- Kaplan 等（2020）系统研究了语言模型的数据、参数量和计算量缩放。

这些工作共同改变了经验：不必先训练一个 GPT-3 级模型才知道哪种设计有效；可以先在小模型上拟合，再预测大模型趋势。

---

## 2. 数据缩放定律的理论直觉

### 2.1 从均值估计推导最简单的缩放律

设

$$
x_1,\ldots,x_n \overset{\text{i.i.d.}}\sim \mathcal N(\mu,\sigma^2),
$$

任务是用样本均值估计 $\mu$：

$$
\hat\mu = \frac1n\sum_{i=1}^n x_i.
$$

因为 $\mathbb E[\hat\mu]=\mu$，且样本均值方差为 $\operatorname{Var}(\hat\mu)=\sigma^2/n$，所以均方误差为

$$
\mathbb E[(\hat\mu-\mu)^2]
= \operatorname{Var}(\hat\mu) + \operatorname{Bias}(\hat\mu)^2
= \frac{\sigma^2}{n}.
$$

取对数：

$$
\log \operatorname{MSE} = -\log n + 2\log\sigma.
$$

这就是一个精确的幂律：误差随 $n^{-1}$ 衰减。更一般地，任意多项式收敛率 $1/n^\alpha$ 在 log-log 图上都是斜率为 $-\alpha$ 的直线。

### 2.2 非参数学习与内在维度

神经网络可逼近非常广泛的函数。考虑 $d$ 维单位盒中的均匀输入 $x_i$，观测

$$
y_i = f(x_i)+\varepsilon_i,
\qquad \varepsilon_i\sim\mathcal N(0,1),
$$

把输入空间划分成许多小盒子，并在每个盒子内估计 $f$。在 Lipschitz 平滑等假设下，盒子的典型边长约为 $n^{-1/d}$，因此插值/近邻误差具有维度依赖的形式：

$$
\operatorname{Error}(n) \approx C\,n^{-1/d}
+\text{噪声项} + \text{其他平滑度项}.
$$

维度越高，指数 $1/d$ 越小，数据收益越慢。这启发了“缩放指数与数据的内在维度有关”的解释（例如 Bahri 等人的工作），但实际内在维度估计并不稳定，不能把它当成完整理论。

### 2.3 为什么神经网络指数不是经典的 $1/n$

经典均值估计是低维、固定模型的特殊情形；语言建模同时受到：

- 数据分布的复杂性与长尾结构；
- 模型表达能力和优化误差；
- tokenization、重复数据、分布偏移；
- 有限模型容量、有限训练预算。

因此真实语言模型的 $\beta$ 通常与 $1$ 不同，而且不同数据集、模型族和损失定义的指数也不同。Scaling law 是经验上极其有用的近似，不是对所有范围都成立的定理。

---

## 3. 数据量、数据组成与重复

### 3.1 数据组成通常改变 offset

普通数据缩放回答“token 数量增加会怎样”。另一个问题是“同样数量的 token，组成不同会怎样”。在许多 distribution-shift 实验中，数据分布主要改变曲线的**偏移量**（offset），而不显著改变斜率：

$$
L(D;\mathcal P) \approx L_\infty(\mathcal P)+A(\mathcal P)D^{-\beta}.
$$

更高质量、更接近目标分布或更多样的数据可以降低 $L_\infty$；如果只改变混合比例，指数可能在有限范围内近似不变。这个结论解释了为什么小模型实验可以用来选择数据混合比例，但不能保证跨规模完全不变。

### 3.2 数据混合选择

若数据由多个来源组成，令 $D_i$ 是第 $i$ 个来源的 token 数，$q_i$ 是混合比例，则可把目标写成

$$
\min_{q_1,\ldots,q_m}\;L\bigl(D,q_1,\ldots,q_m\bigr),
\qquad \sum_i q_i=1,\;q_i\ge 0.
$$

实务上的小规模流程：

1. 固定模型和训练预算，训练若干不同混合比例的小模型。
2. 在目标验证分布上评估损失，而不是只看混合数据的平均损失。
3. 拟合每个来源/混合比例的缩放关系。
4. 将预测的最优比例外推到目标模型，并在目标分布上做小规模复核。

“直接在小模型上挑最低损失的数据集”是自然基线，但模型规模变化可能改变数据价值，因此应尽量拟合带规模变量的曲面。

### 3.3 有限数据与重复数据

当唯一 token 用完后，只能重复样本。重复的 token 数不会等价于同等数量的新 token；有效数据量可以用经验饱和式表示：

$$
D' = U_D + U_D R_D^*\left(1-e^{-R_D/R_D^*}\right),
$$

其中：

- $U_D$：唯一 token 数；
- $R_D$：平均重复次数；
- $R_D^*$：重复收益达到饱和的特征尺度；
- $D'$：有效数据量。

当 $R_D\ll R_D^*$ 时，$1-e^{-R_D/R_D^*}\approx R_D/R_D^*$，重复还有明显收益；当 $R_D\gg R_D^*$ 时，新增重复几乎不增加 $D'$。所以当计算预算增长时，数据选择应随规模自适应：少量重复可能必要，但盲目重复会造成过拟合并浪费 FLOPs。

### 3.4 适用范围与下界

- Scaling law 只描述被实验覆盖范围内的趋势；在数据分布改变、训练进入过拟合、优化不稳定或架构换代时可能失效。
- 它通常是一个经验下界/趋势预测：更好的数据、优化器或架构仍可能做得更好。
- 需要报告拟合区间、验证集、随机种子和残差，不能把一条小规模曲线无限外推。

---

## 4. 模型工程也可以用 Scaling 预测

Scaling 不仅回答“数据有多少”，还可以在小模型上比较架构和超参数。

### 4.1 架构：Transformer 与 LSTM

如果直接训练一个 GPT-3 规模的 LSTM 与 Transformer 比较，成本极高。更便宜的方法是：

1. 在多个小模型规模上分别训练两种架构。
2. 对每个架构拟合 $L(N)$ 或 $L(C)$。
3. 比较在同一规模外推后的损失，检查交叉点和误差条。

类似方法可比较不同 Transformer 变体、混合专家（MoE）等。架构缩放比较必须保持 tokenizer、数据、训练步数和优化协议一致。

### 4.2 优化器：Adam 与 SGD

Hestness 等早期实验已显示优化器影响随规模变化。一个可执行的设计程序是：

- 在小规模模型上为 Adam、SGD 或其他优化器分别做学习率/批量大小网格；
- 对每个优化器建立损失随参数或 FLOPs 的缩放曲线；
- 选择在目标规模上预测最优且稳定的优化器，而不是依据单个小模型的最低损失。

### 4.3 深度、宽度和长宽比

经验上，只有 1 层到 2 层会带来巨大收益；在参数量低于约 $10^7$ 的范围，增加层数通常收益明显，之后边际收益下降。隐藏宽度、层数、注意力头数和 MLP 比例应放在同一参数/FLOP 预算下比较。

**参数并不等价**：embedding 参数的行为与 Transformer block 参数不同；把所有参数简单相加可能误导缩放拟合。MoE 还要区分总参数量和每个 token 的 active 参数量。

### 4.4 批量大小与 Critical Batch Size

批量大小增加会减少梯度噪声、提高并行度，但超过临界点后每一步获得的信息增益很小。一个实用定义：

1. 选择目标损失，测量达到该损失所需的优化步数 $S$ 与样本数。
2. 扫描不同 batch size，得到“步数随样本数”的曲线。
3. 用近似曲线拟合最小步数 $S_{\min}$ 与最小样本数/误差 $E_{\min}$，把二者的交汇区域定义为 critical batch size。

常用的近似形式是

$$
S(B)\approx S_{\min}\left(1+\frac{B_{\mathrm{crit}}}{B}\right),
$$

或者等价地描述样本效率和并行效率的折中。$B_{\mathrm{crit}}$ 常被认为与梯度协方差迹和梯度均值平方范数的比值同阶：

$$
B_{\mathrm{crit}}\sim
\frac{\operatorname{Tr}\operatorname{Cov}(g)}{\|\mathbb E[g]\|_2^2}.
$$

目标损失越低，通常需要越大的 batch；因此“固定 batch 适用于所有训练阶段”不是稳健策略。

### 4.5 学习率与 muP

直接放大模型时，最优学习率可能随宽度、深度或参数化改变。muP（maximal update parameterization）通过缩放初始化和更新，使不同宽度的模型拥有更稳定的激活、更新幅度和超参数迁移行为。核心观点：在小模型上找到的学习率可以更可靠地迁移到大模型，但必须使用与 muP 一致的初始化、输出层和优化器缩放规则。

---

## 5. 联合模型—数据缩放定律

### 5.1 基本拟合形式

设模型参数量为 $N$，训练 token 数为 $D$。Rosenfeld 等人使用的加性形式可写为

$$
L(N,D)=E + A N^{-\alpha}+B D^{-\beta},
$$

其中 $E$ 是不可约项，$A N^{-\alpha}$ 是模型容量不足造成的误差，$B D^{-\beta}$ 是数据不足造成的误差。另一种常见记法把模型和数据变量写成 $m,n$：

$$
\operatorname{Error}(m,n)=C+m^{-\alpha}+n^{-\beta}.
$$

Kaplan 的语言模型拟合也采用类似的幂律，但报告了不同的参数计数和指数；形式上的共同点是：模型和数据各提供一个有边际递减的收益。

### 5.2 给定算力求最优 $N,D$

对稠密 Transformer，训练计算量通常近似

$$
C \approx cND,
$$

其中 $c$ 是与前向/反向、激活重计算和架构有关的常数；常用粗略估计是每个 token 每个参数约 $6$ FLOPs，因此 $c\approx 6$。

固定 $C$ 时，$D=C/(cN)$。把它代回损失：

$$
\begin{aligned}
L(N,C)
&=E+A N^{-\alpha}+B\left(\frac{C}{cN}\right)^{-\beta}\\
&=E+A N^{-\alpha}+B\left(\frac{cN}{C}\right)^\beta.
\end{aligned}
$$

对 $N$ 求导并令其为零：

$$
\frac{\partial L}{\partial N}
=-\alpha A N^{-\alpha-1}
+\beta B\left(\frac cC\right)^\beta N^{\beta-1}=0.
$$

整理得到最优点满足“模型误差与数据误差按指数加权平衡”：

$$
\alpha A N^{-\alpha}=\beta B D^{-\beta}.
$$

同时

$$
N_\star^{\alpha+\beta}
=\frac{\alpha A}{\beta B}\left(\frac Cc\right)^\beta,
$$

因此

$$
N_\star
=\left(\frac{\alpha A}{\beta B}\right)^{\!1/(\alpha+\beta)}
\left(\frac Cc\right)^{\!\beta/(\alpha+\beta)},
$$

$$
D_\star
=\left(\frac{\beta B}{\alpha A}\right)^{\!1/(\alpha+\beta)}
\left(\frac Cc\right)^{\!\alpha/(\alpha+\beta)}.
$$

所以幂指数为

$$
N_\star\propto C^{\beta/(\alpha+\beta)},
\qquad
D_\star\propto C^{\alpha/(\alpha+\beta)}.
$$

最优 token-to-parameter ratio 为

$$
\frac{D_\star}{N_\star}
=\left(\frac{\beta B}{\alpha A}\right)^{\!2/(\alpha+\beta)}
\left(\frac Cc\right)^{\!(\alpha-\beta)/(\alpha+\beta)}.
$$

这说明：

- 若 $\alpha\approx\beta$，最优 $D/N$ 随算力近似稳定；
- 若 $\alpha>\beta$，随着算力增加，最优策略倾向于使用更多 token/参数；
- 常数 $A,B$ 与数据质量、架构和训练协议有关，所以“固定 20 tokens/parameter”不是普适定理。

### 5.3 训练计算估算

若每个参数每个 token 约需 $6$ FLOPs：

$$
C_{\mathrm{train}}\approx 6ND.
$$

例如 $N=7\times10^9$、$D=1.4\times10^{12}$ 时，

$$
C\approx 6\times 7\times10^9\times1.4\times10^{12}
\approx 5.88\times10^{22}\text{ FLOPs}.
$$

实际值还受序列长度、激活检查点、稀疏性、MoE active 参数、通信和硬件利用率影响。

---

## 6. Kaplan 与 Chinchilla：两种计算最优结论

### 6.1 Kaplan（2020）的外推

Kaplan 等人报告的经典趋势近似为

$$
N_{\mathrm{opt}}\propto C^{0.73},
\qquad
D_{\mathrm{opt}}\propto C^{0.27}.
$$

因此在该拟合下，算力增加时更偏向扩大模型，token/parameter ratio 反而下降。它在当时的数据和训练设置内拟合良好，但外推到更大的模型/更长训练会产生较大偏差。

### 6.2 Chinchilla 的三种拟合方法

Hoffmann 等人重新研究固定训练 FLOPs 下模型大小和数据量的折中，核心观点是许多此前模型**太大、训练 token 太少**。

#### 方法 1：所有训练曲线的 lower envelope

- 对多个 $(N,D)$ 训练运行记录最终损失。
- 在每个训练预算/参数量上取可达到的最低损失。
- 这些最低点组成一条 lower envelope，再拟合幂律。

#### 方法 2：IsoFLOPs

- 选择一组固定 FLOPs 预算。
- 在每个预算内改变 $N$，相应改变 $D=C/(cN)$。
- 每条固定预算曲线通常呈凸形；取每条曲线最低点。
- 这些最低点随 $C$ 的位置给出 $N_\star(C)$ 与 $D_\star(C)$。

优点是直接围绕“固定训练算力下的最优模型”建模，通常比把所有非最优运行混在一起更稳健。

#### 方法 3：联合拟合

在模型大小—数据量网格上运行一批模型，直接用最小二乘拟合

$$
L(N,D)=E+A N^{-\alpha}+B D^{-\beta}
$$

或其含计算量、优化项的扩展形式，然后用约束优化求最优 $N,D$。该方法需要大量从头训练样本；如果大量运行只是 early stop，最终损失曲线的形状可能不代表真正的 Chinchilla 最优点。

### 6.3 为什么结论差异大

常见解释包括：

- 参数计数是否包含最后的输出层/embedding；embedding 参数和 block 参数的“价值”并不相同。
- 小计算预算下 warmup 过长，导致小模型被不公平地惩罚；学习率衰减和 batch 是否同步调优也会改变拟合。
- 训练曲线终点、数据重复、tokenizer、数据过滤和验证分布不同。
- 联合拟合中非线性、噪声或数据整理错误会强烈影响指数；后续数据取证与重拟合曾得到更接近 lower-envelope/IsoFLOPs 的结果。

因此比较论文时必须同时比较：参数定义、数据定义、FLOP 计算方式、优化器、学习率 schedule、batch、训练是否完整以及验证集。

### 6.4 “训练最优”不一定是“部署最优”

Chinchilla 的目标是：在固定**训练计算**下，让模型达到最低损失。但现实系统通常要重复推理很多次，推理成本可能超过训练成本。典型 token/parameter ratio（不同论文和版本的口径略有差异）包括：

| 模型/配方 | 训练 token / 参数（约） | 说明 |
| --- | ---: | --- |
| GPT-3 | 2 | 训练偏少，模型较大 |
| Chinchilla | 20 | 训练计算最优附近的经典比例 |
| LLaMA 65B | 22 | 已明显多于 GPT-3 |
| Llama 2 70B | 29 | 继续增加数据 |
| Mistral 7B | 110 | 小模型、长数据，降低每次推理成本 |
| Llama 3 70B | 215 | 用更高一次性训练成本换取部署效率 |

设一次性训练成本为 $C_{\mathrm{train}}(N,D)$，预期服务总 token 数为 $U$，则生命周期成本可粗略写作

$$
C_{\mathrm{life}}(N,D,U)
=C_{\mathrm{train}}(N,D)+U\,C_{\mathrm{infer}}(N).
$$

$U$ 越大，减小 $N$、增加 $D$ 的前置训练成本越值得。**Over-training（过训练）**不是训练失败，而是故意使用超过 train-optimal 的 token/parameter ratio，以得到更小、更便宜、更低延迟的部署模型。应按预期使用量、服务硬件、延迟约束和质量目标进行生命周期优化。

### 6.5 Scaling law 的其他用途

IsoFLOPs/lower-envelope 方法不只适用于语言模型，也可用于 diffusion、MoE active 参数和架构稀疏度等问题：先在受控预算上测量，再用曲线寻找最优资源分配。

---

## 7. 一套可执行的 Scaling 设计流程

1. **固定协议**：tokenizer、训练/验证数据、序列长度、优化器、schedule、精度和评估指标。
2. **选择规模网格**：至少数个参数量与数据量，不要只运行一条“模型变大、数据也变大”的对角线。
3. **记录真实成本**：参数量、有效 token、实际 FLOPs、wall-clock、峰值显存和硬件利用率。
4. **拟合模型**：优先直接拟合带 $E$ 的幂律；检查 log-log 残差、置信区间与外推范围。
5. **比较实验设计**：lower envelope、IsoFLOPs、joint fit 互相核对；对 early stopping、warmup、数据重复做敏感性分析。
6. **根据目标选择**：训练最优、推理最优和下游最优可能不同；明确目标后再求 $N,D$。
7. **在目标规模做小型复核**：Scaling 预测不能替代最后一次真实规模验证。

### 7.1 必须记录的量

| 类别 | 记录项 | 为什么重要 |
| --- | --- | --- |
| 模型 | 总参数、非 embedding 参数、active 参数、层数/宽度/头数 | 参数口径决定拟合指数 |
| 数据 | 唯一 token、重复率、混合比例、质量过滤 | 有效 $D$ 不等于原始 token |
| 训练 | batch、学习率、warmup/decay、优化器、实际 FLOPs | 小预算设置可能扭曲曲线 |
| 评估 | train/validation loss、下游任务、分布 | pretrain loss 不等于所有下游能力 |
| 系统 | GPU 型号、MFU、通信、峰值显存、吞吐 | 理论 FLOPs 与墙钟时间不同 |

---

## 8. 本讲总结

- 数据、模型参数量、计算量和许多超参数都可呈现近似幂律缩放。
- 均值估计和非参数学习提供了“误差按多项式下降”的直觉，但神经网络指数受数据、架构与优化共同影响。
- 数据组成通常改变损失 offset；有限数据重复的有效收益会饱和。
- 联合缩放的核心拟合式是
  $$L(N,D)=E+A N^{-\alpha}+B D^{-\beta}.$$
- 在 $C\approx cND$ 下，最优 $N,D$ 可由加权模型误差与数据误差相等的条件推导；Kaplan 与 Chinchilla 的差异主要来自数据与训练协议、参数口径、拟合方法和外推范围。
- Train-optimal 不等于 deployment-optimal；预期推理次数很高时，过训练小模型常常更划算。
- Scaling law 是预测工具，不是无限外推的保证；必须报告范围、协议、误差与真实规模复核结果。
