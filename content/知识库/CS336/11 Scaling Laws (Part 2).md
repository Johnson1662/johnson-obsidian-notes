# CS336 Lecture 11: 扩展定律进阶与测试时计算 (Scaling Laws Part 2)

经典的 Scaling Law 主要描述预训练 Cross-Entropy Loss 与算力的关系。本讲探讨 Scaling 的深水区：**预训练 Loss 与下游任务表现的非线性映射、跨规模超参零样本迁移 ($\mu\text{P}$)、WSD 学习率调度、数据质量乘数以及测试时计算扩展 (Test-Time Compute Scaling)**。

---

## 1. 预训练 Loss 与下游任务表现：“涌现”现象的本质

在很多 Benchmark（如 GSM8K、MMLU、代码生成）中，小模型准确率接近 $0\%$，模型达到某一临界规模后性能突然暴涨，被早期文献称为“**涌现能力 (Emergent Abilities)**”。

```
精确匹配准确率 (Exact Match) ^
                             |                         /
                             |                        /
                             |                       /  (非线性指标呈现阶跃假象)
                             |                      /
                             |  -------------------+
                             +------------------------------------->
                             0                模型规模 / Compute
```

### 1.1 指标非线性失真理论 (Schaeffer et al., NeurIPS 2023)
- **数学本质**：若一个多步骤推理任务需要连续答对 $L$ 个 Token（每个 Token 预测独立且正确率为 $p$），则最终任务的准确率为：
  $$
  \text{Accuracy} = p^L
  $$
  - 当模型从浅到深扩展时，单 Token 正确率 $p$（或交叉熵 Loss）随算力**完全平滑、连续、可预测地线性增长**；
  - 但一旦套入高阶多项式 $p^L$ 或不连续阶跃评分标准（非 0 即 1 的 Exact Match），在宏观上便呈现出所谓“突变与涌现”的假象。
- **工程结论**：**基础能力的积累始终是平滑且严格遵循 Scaling Law 的**，可以通过监控平滑的 Cross-Entropy Loss 与 Brier Score 准确预测下游大模型的任务表现。

---

## 2. 极限超参零样本迁移：Maximal Update Parametrization ($\mu\text{P}$)

在标准参数化（Standard Parametrization, SP）中，当模型宽度 $d_{\text{model}}$ 增加时，最佳学习率 $\eta$、初始化方差和输出缩放因子会发生剧烈漂移，大模型必须重新做昂贵的超参搜索。

微软研究院提出的 **$\mu\text{P}$ (Yang et al., 2022)** 通过对各层权重与学习率进行严格的维度缩放，使得无论模型宽度 $d \to \infty$ 如何增加，**特征激活值与梯度的更新幅度始终保持 $O(1)$ 常数稳定**：

| 组件 / 层类型 | 标准参数化 (SP) | $\mu\text{P}$ 参数化 | 随着宽度 $d \to \infty$ 的理论行为 |
|---|---|---|---|
| **初始化方差 $\text{Var}(W)$** | $O(1/d)$ | 隐藏层 $O(1/d)$，输出投影 $O(1/d^2)$ | 激活值方差不随宽度发散 |
| **学习率缩放 $\eta_W$** | 全局统一常数 $\eta$ | 隐藏层 $\eta \propto 1/d$，输出层 $\eta \propto 1/d$ | 梯度更新步长保持 $O(1)$ |
| **Attention 缩放因子** | $\frac{1}{\sqrt{d_k}}$ | $\frac{1}{d_k}$ (配合 $\mu\text{P}$ 缩放) | 注意力 Logits 幅度稳定 |

> **$\mu\text{P}$ 的工程价值**：
> 可以在 $10\text{M} \sim 100\text{M}$ 的微型 Toy 模型上进行详尽的网格超参搜索（学习率、Batch Size、Weight Decay），**直接零样本应用（Zero-shot Transfer）到 100B+ 生产大模型上，无需任何额外调优**。

---

## 3. 预训练学习率调度：Cosine vs WSD (Warmup-Stable-Decay)

传统 Cosine 衰减调度器要求在训练开始前严格固定总步数 $T$；若在半途提前停止或延长训练，模型性能会严重受损。

现代前沿模型（MiniCPM, DeepSeek-V3, Qwen 2.5）转向 **WSD 调度器**：

```
学习率 lr ^
          |      [ Stable 稳定平台期 (80% ~ 90% 步数) ]
          |     +----------------------------------------+
          |    /                                          \
          |   /                                            \  [ Decay 快速退火期 (10% ~ 20% 步数) ]
          |  / (Warmup)                                     \
          +--------------------------------------------------+-------------------->
          0                                                                      Steps
```

- **三大工程优势**：
  1. **无限持续预训练 (Continual Pretraining)**：在 Stable 阶段可以根据算力随时增加数据训练，无需提前预测终点。
  2. **分支低成本退火**：随时从 Stable 阶段保存的 Checkpoint 切出分支，注入高质量代码或数学数据进行快速 Decay（Annealing），直接产出特化模型。
  3. **数据配比实验**：在 Stable 阶段只需用小规模 Decay 即可快速评估某种数据配比的最终潜力。

---

## 4. 测试时计算扩展定律 (Test-Time Compute Scaling)

OpenAI o1 与 DeepSeek-R1 开启了大模型能力的“第二扩展曲线”：**从仅在预训练阶段增加算力（Pre-training Scaling），转向在推理阶段通过增加思考 Token 扩展算力（Inference / Test-Time Compute Scaling）**。

$$
\text{Total Effective Compute} = C_{\text{pretrain}} + C_{\text{posttrain}} + C_{\text{test-time}}
$$

```
Benchmark 准确率 ^
                 |                                      / (o1 / R1 思维链长思考)
                 |                                    /
                 |                                  /   (短回答 / 基础模型)
                 |                 +---------------+
                 |                /
                 |               /
                 +--------------+------------------------------------>
                 0                                     Inference Compute (生成 Token 数 / 搜索步数)
```

### 4.1 测试时扩展的三种机制
1. **长思维链自主推理 (Long CoT with RL)**：模型在输出最终答案前，生成数千个甚至数万个内部思考 Token，进行逐步推导、假设验证与自我反思纠错。
2. **Best-of-$N$ 采样与验证器重排 (PRM Re-ranking)**：推理时采样 $N$ 条候选路径，使用过程奖励模型（Outcome/Process Reward Model）打分挑选最佳答案。
3. **蒙特卡洛树搜索 (MCTS / Tree Search)**：在推理阶段对推理步骤进行显式分支搜索与价值回溯，突破单向自回归生成的局限性。
