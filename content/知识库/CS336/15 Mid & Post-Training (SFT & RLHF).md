# Lecture 15：中训练与后训练——SFT、RLHF 与 DPO

> 预训练让模型接近 GPT-3 的“会续写”能力；本讲讨论如何得到 InstructGPT 一类“会按要求回答”的模型。主线是：**监督微调（SFT）模仿示例 → 偏好数据建模 → RLHF/PPO 或 DPO 优化偏好**。

## 1. 为什么要后训练

预训练数据规模巨大、容易获得，但它不是我们真正想要的行为分布：网页中既有文章，也有广告、争论、错误答案和不安全内容。我们希望模型输出具备指定行为：遵循指令、回答有帮助、拒绝危险请求、保持合适风格。

### 1.1 指令遵循是一种强控制

用户只给出一句自然语言指令，模型就能改变任务、格式、语气和约束。课程材料用“让模型写一首关于爵士历史的诗”等例子说明：这不是简单记忆，而是对输出分布的精细控制。

### 1.2 本讲目标

1. SFT 数据到底是什么格式，什么性质的数据真正提高性能？
2. 如何利用人类/AI 的偏好比较？
3. 是否需要与预训练同等规模的数据和计算？

### 1.3 资料披露的现实

早期论文对后训练描述较丰富：

- Stiennon et al.（2020）公开了 RLHF 摘要任务的标注指南等细节；
- Bai et al.（2022）讨论了 Anthropic HH 与安全标注的设置。

现代闭源模型常把数据和“secret sauce”视为核心竞争力；开源发布往往包含大量蒸馏数据，却不完整公开收集过程、过滤阈值和偏好标注细节。

### 1.4 标准训练路线

```text
预训练 base LM
      ↓
SFT（模仿高质量指令回答）
      ↓
偏好数据（chosen > rejected）
      ├─ Reward Model + PPO（RLHF）
      └─ DPO（直接优化偏好）
```

---

## 2. 监督微调（SFT）

SFT（Supervised Fine-Tuning）仍然只是梯度下降：把 prompt 与理想回答当作监督样本，最大化模型对回答 token 的条件似然。

### 2.1 SFT 数据格式

最常见的结构是对话消息列表：

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain what an algorithm is."},
    {"role": "assistant", "content": "An algorithm is a step-by-step ..."}
  ]
}
```

也可以用 instruction/input/output 格式：

```json
{
  "instruction": "Find the average number in a list.",
  "input": "[4, 3, 6, 10, 8]",
  "output": "The average is 6.2."
}
```

训练时通常只对 assistant/target 的 token 计算 loss，prompt、system 消息以及 padding 的标签设为 `-100`（忽略），避免模型被迫重建输入。

### 2.2 SFT 目标函数

对数据集 $\mathcal D=\{(x,y)\}$，$y=(y_1,\ldots,y_T)$：

$$
\mathcal L_{\mathrm{SFT}}(\theta)
=-\mathbb E_{(x,y)\sim\mathcal D}
\left[\sum_{t=1}^{T}\log \pi_\theta(y_t\mid x,y_{<t})\right].
$$

等价于在目标回答上做 teacher forcing 的交叉熵；它学习的是“示范者会怎样回答”，并不直接知道回答是否真的正确。

### 2.3 开放 SFT 数据的演化

从早期的短指令、简单标签，数据逐渐向更长、更复杂、更具工具调用能力的回答演化：

| 数据/路线 | 特点 |
| --- | --- |
| FLAN / FLAN 自指令 | 将大量 NLP 任务统一成指令—回答，覆盖分类、抽取、改写等 |
| Alpaca | 少量种子指令 + 强模型生成指令/回答，格式简洁 |
| ShareGPT / Vicuna | 真实用户与 ChatGPT 对话，交互更长 |
| OpenAssistant（OASST） | 社区对话，回答更详细，包含复杂知识与引用 |
| WizardLM | 用强模型演化指令、增加复杂度 |
| Tulu3、Nemotron | 更大规模、多轮、工具使用与安全/偏好数据 |

#### FLAN 示例

- “Stephanie—请完成附件并让 Brad Richter 签字；为这封邮件写主题。”
- 给出 Ahold 出售西班牙业务的新闻，要求判断属于 World、Sports、Business 还是 Science/Tech。
- 给出关于海牙旅行的长文章，要求写亮点。
- 给餐馆结构化信息 `name=Aromi, eatType=coffee shop, food=English, rating=5/5, area=city centre`，要求生成包含这些事实的句子。

#### Alpaca 示例

- “给出三个保持健康的建议。”
- “algorithm 是什么意思？”
- “求一个列表的平均值”，并给出 `avg_list` Python 实现和输出。
- 要求介绍经济学术语 monopsony、给出劳动力市场例子并引用研究。
- 要求为小学生设计便宜有趣的科学项目。

开放数据还包含真实的软件工程问题，例如比较 JavaScript `async/await` 与 `.then()`，或为计算器选择整数与浮点数。

### 2.4 SFT 数据的关键维度

#### 长度与风格

数据集之间存在长度、项目符号、格式和详细程度的差异。FLAN 往往简短、像 benchmark；OpenAssistant 更长、更像人类回答。模型会学到这些风格。

人类或 GPT 评测中的偏好对回答长度非常敏感：在评测者不严格检查内容时，更长、格式更完整的回答可能被判为更好。长度效应在偏好评测中很强，但对许多传统 benchmark 的准确率影响较小。

#### 规模

少量样本就能改变语气、格式、安全拒答等行为，但长尾任务需要更广覆盖。不能把“少量数据能有效”理解为“规模无关紧要”。

#### 安全

模型会被部署给真实用户，需要针对误导、诈骗、垃圾信息、仇恨和危险请求进行控制。

#### 事实与引用

例如用户要求介绍 monopsony 并引用 Bivens & Mishel（2013），训练样本可能教模型输出一个带参考文献的段落。但问题是：模型是否真的“知道”这些文献，还是只学会了引用样式？把尾部知识硬写进 SFT 可能导致幻觉。

### 2.5 知识提取与对齐的陷阱

一种常见说法是：给模型微调它原本不知道的事实会让它幻觉。实证观察更细致：

- 如果目标只是让模型提取预训练中已有的能力，SFT 通常有效；
- 添加事实数据有时会损害原有能力，尤其当数据少、噪声大或格式不一致；
- RL 风格的正确性反馈在原则上可以帮助，但前提是可验证；
- LM 的知识存储与调用机制混乱，不能把一次成功复述等同于稳健知识。

### 2.6 少量安全数据也有明显效果

公开安全 SFT 细节通常很少，但实验显示几百个高质量样本就能带来显著变化：例如加入约 500 个 Alpaca 风格安全示例，可以让模型更遵循安全指南；Anthropic HH 的仇恨言论数据也能改变拒答行为。

Llama 2 等模型的安全 SFT 只有几千个示例，但其关键流程不是随机写拒答，而是从真实用户请求中抽取危险场景，覆盖仇恨、暴力、诈骗、隐私和越狱等类别，再为每类编写合规回答并做多轮安全审核。小数据有效的前提是场景覆盖与示例质量，而不是样本数量本身。

关键不是盲目收集大量数据，而是覆盖真实危险场景、提供清晰安全策略、保证回答本身正确且不泄漏有害细节。

### 2.7 SFT 的结论

1. 指令微调最擅长**抽取和强化预训练已有行为**，不一定适合注入长尾事实。
2. 错误或不一致的事实数据可能伤害模型。
3. 少量正确的安全、指令遵循和风格数据可以产生大幅行为变化；更大的数据仍有助于长尾覆盖。

---

## 3. 如何扩大 SFT：中训练（Mid-training）

普通学术设置中，“微调 + 梯度下降”基本就是全部。但当计算和指令数据都很多时，可以把指令数据变成一种预训练数据：

1. 在网页/预训练数据上训练；
2. 将 instruction-tuning 数据混入继续预训练；
3. 最后做一次短的真正 SFT。

这种“中训练 / 两阶段训练”可以在不显著灾难性遗忘的情况下扩展 instruction tuning。许多公司采用它但不详细公开；课程材料提到 miniCPM、jetMoE 等模型公开讨论过类似配方。

---

## 4. 从模仿到偏好优化

### 4.1 SFT 与 RLHF 的区别

**模仿学习（SFT）**：拟合某个参考分布 $p^*(y\mid x)$：

$$
\hat p(y\mid x)\approx p^*(y\mid x).
$$

它需要参考策略产生的示范回答，目标是“像示范者”。

**RLHF**：寻找一个策略 $\hat p$，直接最大化可测量奖励：

$$
\max_{\pi}\ \mathbb E_{x\sim\mathcal D,\,y\sim\pi(y\mid x)}[R(x,y)].
$$

LM 在 RL 中是 policy：它不再只是拟合一个固定回答分布，而是主动选择能获得更高奖励的输出。

### 4.2 为什么需要优化而不只是模仿

存在 **G-V gap（生成—偏好差距）**：人类在现实中想要的内容与人类真正写下/标注的示范不完全一致。新闻摘要研究显示，人们偏好某种摘要，但未必会亲自写出同样的文本。偏好比较允许我们直接优化“喜欢什么”，而不是要求收集每个理想输出的精确样本。

---

## 5. RLHF 三阶段

标准 RLHF（以 InstructGPT 为代表）分三步：

### 5.1 阶段一：SFT

收集高质量 prompt—回答样本，对 base model 做监督微调，得到初始策略 $\pi_{\mathrm{SFT}}$。

### 5.2 阶段二：Reward Model（奖励模型）

对同一个 prompt $x$，从策略采样多个回答，标注者选择更好的回答：

$$
(x,y_w,y_l),\qquad y_w\succ y_l.
$$

奖励模型 $r_\phi(x,y)$ 用 Bradley–Terry 偏好模型表示选择概率：

$$
P(y_w\succ y_l\mid x)
=\frac{\exp r_\phi(x,y_w)}
{\exp r_\phi(x,y_w)+\exp r_\phi(x,y_l)}
=\sigma\left(r_\phi(x,y_w)-r_\phi(x,y_l)\right),
$$

其中 $\sigma(z)=1/(1+e^{-z})$。其负对数似然为：

$$
\mathcal L_{\mathrm{RM}}(\phi)
=-\mathbb E_{(x,y_w,y_l)\sim\mathcal D}
\left[\log\sigma\left(r_\phi(x,y_w)-r_\phi(x,y_l)\right)\right].
$$

奖励只在差值上可辨识：同时给两个回答加常数不会改变偏好。

### 5.3 阶段三：策略优化

从当前策略采样回答，用奖励模型打分，再通过 PPO 等 on-policy RL 优化策略，同时限制它不要偏离 SFT/reference 模型太远。

---

## 6. RLHF 数据如何收集

### 6.1 人类 pairwise 比较

典型界面展示 prompt 与两个匿名回答，标注者选择：左更好、右更好、相同或无法判断。指南会把“有帮助、正确、相关、清晰、安全”等拆成标准。

现实复杂性：

- 需要高质量、可验证的标注者，尤其是数学、代码、医学等专业问题；
- 标注者未必真的检查正确性；
- 需要防止标注者使用 AI 代答；
- 不同平台和工人群体的报酬差异很大，近年专家标注增长明显；
- 只覆盖一个平台（例如 Outlier、Scale AI）的研究不能代表整个工人市场。

### 6.2 伦理与人口统计偏差

大规模外包标注可能存在低薪、不透明审核、心理伤害和同意问题。标注者的国家、语言、教育与文化分布会显著改变偏好模型的风格和拒答边界；即使标注数量很大，也不意味着偏差会自动消失。

因此应记录标注者群体、给出公平报酬和心理支持，使用多来源标注与不确定性估计，并将少数群体偏好作为评测维度，而不是简单多数投票。

### 6.3 LM-generated / AI feedback

GPT-4 在成对比较上可达到接近人类的系统级排序相关性，某些设置下与人类标注者的一致程度接近人类—人类一致性。

因此前沿模型常用 AI feedback：

- UltraFeedback 支持 Zephyr 7B 等模型；
- Tulu3、OLMo 等模型使用 AI 偏好数据；
- Constitutional AI 让模型按一组原则自我批评、改写，再使用比较结果训练。

但 AI feedback 会继承 judge 的长度偏好、知识错误和安全盲点，必须用人类小样本校准。

### 6.4 长度效应

RLHF 在多个研究中显著增加回答长度：奖励模型可能把“更长、更详细”当成“更有帮助”。这种 proxy reward 偏好并不总等于真实质量，因此需要长度控制、答案正确性评测和独立的人类验证。

---

## 7. PPO：原始 RLHF 优化路线

### 7.1 Policy Gradient

对策略 $p_\theta(z)$ 和奖励 $R(z)$：

$$
\nabla_\theta\mathbb E_{z\sim p_\theta}[R(z)]
=\mathbb E_{z\sim p_\theta}
\left[R(z)\nabla_\theta\log p_\theta(z)\right].
$$

直接使用会有高方差，尤其是语言模型的序列很长。

### 7.2 TRPO

TRPO 在当前策略附近线性化目标，并限制新旧策略的 KL：

$$
\max_\theta\ \hat{\mathbb E}_t
\left[\frac{\pi_\theta(a_t\mid s_t)}
{\pi_{\mathrm{old}}(a_t\mid s_t)}\hat A_t\right]
$$

满足

$$
\hat{\mathbb E}_t\left[
D_{\mathrm{KL}}\left(\pi_{\mathrm{old}}(\cdot\mid s_t)
\,\|\,\pi_\theta(\cdot\mid s_t)\right)
\right]\le\delta.
$$

### 7.3 PPO clipping

PPO 用概率比率

$$
r_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}
{\pi_{\mathrm{old}}(a_t\mid s_t)}
$$

并把它限制在 $[1-\epsilon,1+\epsilon]$：

$$
L^{\mathrm{CLIP}}(s,a,\theta_k,\theta)
=\min\left(
 r_t(\theta)\hat A_t,
 \operatorname{clip}(r_t(\theta),1-\epsilon,1+\epsilon)\hat A_t
\right).
$$

语言模型中每个 token 是 action，整个回答得到奖励；实践中常在每 token 加 reference KL 惩罚，最后一个 token 加完整 reward。还会使用 value model 估计 advantage/GAE。PPO 的优势是通用、可在线采样；缺点是 rollout、value model、外层—内层循环和超参数很多，显存与实现成本高。

### 7.4 在 PPO 之前尝试过什么

为了避免 on-policy RL，人们尝试过：

- 加一个控制 token：chosen 前加 `[GOOD]`、rejected 前加 `[BAD]`，再对两类样本做 SFT；
- 只在 preferred output 上训练；
- 训练 reward model，采样 LM 输出，只把偏好答案重新 SFT；
- 训练 reward model，一次采样 1,024 个回答，取分数最高者再训练。

这些方法可能有效，但没有统一解决“如何稳定利用成对偏好并持续探索”的问题。

---

## 8. DPO：不用显式奖励模型的直接偏好优化

DPO（Direct Preference Optimization）的目标是：保留偏好比较 $(x,y_w,y_l)$，去掉显式 reward model 和 on-policy PPO rollout，直接对策略做 supervised-like 更新。

直觉上：增加 $y_w$ 的 log-probability，降低 $y_l$ 的 log-probability，但权重由当前隐含奖励模型的预测误差决定。

### 8.1 从 KL 正则化 RLHF 目标开始

对 reference policy $\pi_{\mathrm{ref}}$，考虑 KL 正则化目标：

$$
\max_{\pi_\theta}
\mathbb E_{x\sim\mathcal D,\,y\sim\pi_\theta(y\mid x)}
\left[
 r_\phi(x,y)
 -\beta D_{\mathrm{KL}}
 \left(\pi_\theta(\cdot\mid x)\,\|\,\pi_{\mathrm{ref}}(\cdot\mid x)\right)
\right].
$$

$\beta>0$ 控制偏离 reference 的代价：越大越保守，越小越追逐奖励。

### 8.2 非参数最优策略

假设策略空间包含所有条件分布（非参数假设）。对每个 $x$，最大化上述目标的最优策略是：

$$
\pi_r(y\mid x)
=\frac{1}{Z(x)}\pi_{\mathrm{ref}}(y\mid x)
\exp\left(\frac{1}{\beta}r(x,y)\right),
$$

其中配分函数

$$
Z(x)=\sum_y\pi_{\mathrm{ref}}(y\mid x)
\exp\left(\frac{1}{\beta}r(x,y)\right)
$$

负责归一化。解出隐含奖励：

$$
r(x,y)
=\beta\log\frac{\pi_r(y\mid x)}{\pi_{\mathrm{ref}}(y\mid x)}
+\beta\log Z(x).
$$

### 8.3 代入 Bradley–Terry，配分函数消失

把策略参数化为 $\pi_\theta$，则偏好奖励差为：

$$
\begin{aligned}
r_\theta(x,y_w)-r_\theta(x,y_l)
=\beta\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\mathrm{ref}}(y_w\mid x)}
-\beta\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\mathrm{ref}}(y_l\mid x)},
\end{aligned}
$$

因为同一个 $x$ 的 $+\beta\log Z(x)$ 在差值中抵消。将其代入 Bradley–Terry 负对数似然，得到 DPO 损失：

$$
\boxed{
\mathcal L_{\mathrm{DPO}}(\pi_\theta;\pi_{\mathrm{ref}})
=-\mathbb E_{(x,y_w,y_l)\sim\mathcal D}
\left[
\log\sigma\left(
\beta\log\frac{\pi_\theta(y_w\mid x)}{\pi_{\mathrm{ref}}(y_w\mid x)}
-\beta\log\frac{\pi_\theta(y_l\mid x)}{\pi_{\mathrm{ref}}(y_l\mid x)}
\right)
\right].
}
$$

序列概率按 token 乘积计算，因此实践中使用 log-probability 之和：

$$
\log\pi_\theta(y\mid x)=\sum_t\log\pi_\theta(y_t\mid x,y_{<t}).
$$

### 8.4 DPO 梯度的机制解释

定义隐含奖励估计

$$
\hat r_\theta(x,y)=\beta\log\frac{\pi_\theta(y\mid x)}
{\pi_{\mathrm{ref}}(y\mid x)}.
$$

DPO 梯度可以写为：

$$
\nabla_\theta\mathcal L_{\mathrm{DPO}}
=-\beta\,\mathbb E\left[
\sigma\big(\hat r_\theta(x,y_l)-\hat r_\theta(x,y_w)\big)
\left(\nabla_\theta\log\pi_\theta(y_w\mid x)
-\nabla_\theta\log\pi_\theta(y_l\mid x)\right)
\right].
$$

解释：

- 如果模型已经把 chosen 的隐含奖励估得比 rejected 高很多，$\sigma(\cdot)$ 很小，更新很小；
- 如果模型判断错（给 rejected 更高奖励），权重变大；
- 更新增加 $y_w$ 的 log-probability，同时降低 $y_l$ 的 log-probability。

所以 DPO 不是简单“只在 chosen 上做 SFT”：它包含对 rejected 的负梯度，以及随预测错误程度变化的权重。

### 8.5 DPO 与 PPO 的对比

| 项目 | PPO/RLHF | DPO |
| --- | --- | --- |
| 偏好数据 | pairwise | pairwise |
| Reward Model | 需要显式训练 | 不单独训练，奖励隐含在策略比值中 |
| Rollout | on-policy、反复采样 | 直接用离线偏好数据 |
| 优化 | RL policy gradient + clipping | 偏好二分类式 log-loss |
| 参考模型 | 通常用于 KL 惩罚 | 必需（$\pi_{\mathrm{ref}}$） |
| 工程难度 | 高，需 value model/rollout | 低，像监督学习 |
| 主要风险 | reward hacking、过优化、模式坍缩 | 偏好数据偏差、reference 选择、长度偏差 |

DPO 的代价是它依赖 Bradley–Terry 形式的成对偏好；如果反馈天然是标量验证奖励或多目标轨迹，GRPO/RLVR 等方法更自然。

### 8.6 变体

- **SimPO**：去掉 reference model，直接设计隐含奖励/长度归一化目标；
- **Length-normalized DPO**：将每条回答的 log-ratio 除以长度，减少模型偏爱短/长回答的影响：

$$
\max_{\pi_\theta}\mathbb E\left[
\log\sigma\left(
\frac{\beta}{|y_c|}
\log\frac{\pi_\theta(y_c\mid x)}{\pi_{\mathrm{ref}}(y_c\mid x)}
-\frac{\beta}{|y_r|}
\log\frac{\pi_\theta(y_r\mid x)}{\pi_{\mathrm{ref}}(y_r\mid x)}
\right)
\right].
$$

实际结果高度依赖数据质量、reference、学习率、长度处理和评测方式；PPO 在某些设置下仍然优于 DPO，不能仅凭工程简单就断言 DPO 总是更好。

---

## 9. RLHF 的副作用与监控

### 9.1 Reward overoptimization

随着策略继续优化 reward model，代理奖励会提高，但真实人类偏好可能先提高后下降：模型学会 reward model 的漏洞（reward hacking）。这种现象在人类偏好、带噪 LM 偏好中都常见；若 judge 完全无噪声，曲线可能不同，但不能据此忽略真实部署风险。

监控：

- 独立人类评测与多个 judge；
- 真实任务正确率、拒答质量、毒性和事实性；
- KL 与 reference 的距离；
- 不同长度分桶的性能；
- 训练外的新 prompts。

### 9.2 Mode collapse 与校准

RLHF 可能让策略集中在少数高奖励模式，失去概率模型的多样性；默认不再具有良好 calibration。常见迹象是：回答风格高度相似、重复模板、采样温度变化也难以产生多样回答。

可用 KL 正则、熵奖励、早停、数据多样性和独立校准评测缓解。

---

## 10. 讲次总结

1. SFT 使用高质量 instruction/response 做最大似然；数据格式、长度、风格、事实性、安全与工具使用都会被模型学习。
2. 指令数据不一定越多越好：少量正确的行为样本很有效，错误事实可能伤害模型，长尾任务仍需要更广覆盖。
3. RLHF 三阶段是：SFT → Bradley–Terry Reward Model → PPO 等策略优化。
4. PPO 通过概率比率 clipping 与 KL 控制提高稳定性，但实现复杂、显存和 rollout 成本高。
5. DPO 从 KL 正则化 RLHF 目标的非参数最优解出发，把奖励写成策略/reference 的 log-ratio，代入 Bradley–Terry 后得到只需偏好对的监督式损失。
6. DPO 省去显式 reward model 和 on-policy RL，但仍依赖可靠偏好数据、reference 模型和独立防过优化评测。
7. 任何“奖励变高”的结果都必须和真实质量、事实性、安全、校准与多样性一起观察。
