# Lecture 18 - Alignment Practice (Instruction Tuning, DPO & Safety)

> **课程主题**：通用对话系统对齐实战：指令微调（SFT）、DPO 偏好对齐、安全红队测试与对齐税分析
> **授课教师**：CS336 教学团队（基于 Assignment 5 对齐大作业与前沿对齐实验）
> **核心目标**：从工程落地角度完整实现通用对话大模型的后训练流水线，掌握 Packed 变长数据打包、零样本基准评测、DPO 偏好损失实现、双卡参考模型部署与对齐税（Alignment Tax）抑制技术。

---

## 1. 从基座模型到对齐助手的工程全流程

在完成预训练后，基座模型（如 LLaMA-3.1-8B-Base）仅具备文本续写能力，必须通过严谨的后训练流水线转化为兼具**指令遵从性（Helpfulness）与安全性（Harmlessness）**的通用助手。

```
[ LLaMA-3.1-8B-Base ] ──(SFT: UltraChat + SafetyTuned)──> [ SFT Model ] ──(DPO: Anthropic HH)──> [ Aligned Model ]
          │                                                    │                                       │
          ▼                                                    ▼                                       ▼
  [ 零样本基线评测 ]                                   [ 行为变化与红队评测 ]                 [ 胜率与对齐税全面评估 ]
```

---

## 2. 评测基线与输出解析协议 (Evaluation Baselines)

为机械化评测模型在各阶段的能力跃迁，构建涵盖四类核心维度的评测矩阵：

| 评估维度 | 评测基准 | 评估方式与指标 | 格式化 Prompt 与解析规则 |
| :--- | :--- | :--- | :--- |
| **学科事实知识** | MMLU (Hendrycks 2021) | 零样本贪心解码 ($T=0$)，多选题准确率 | 提示模型输出 `"The correct answer is (A/B/C/D)"`，正则提取选项字母 |
| **数学推理能力** | GSM8K (Cobbe 2021) | 零样本贪心解码 ($T=0$)，精准匹配 (Exact Match) | 提取模型输出生成的最后一个数值作为预测答案，与 Ground Truth 比对 |
| **通用对话质量** | AlpacaEval (Li 2023) | LLaMA-3.3-70B 作为裁判，对比 GPT-4 Turbo | 计算面对通用指令时的相对胜率（Winrate）与长度去偏胜率（LC-Winrate） |
| **安全性与合规** | SimpleSafetyTests (2024) | 自动红队安全评判脚本 | 针对有害/非法输入，统计模型主动拒绝的安全回复比例（Safe Rate） |

---

## 3. 指令微调 (SFT) 数据工程与训练实现

### 3.1 样本打包数据加载器 (Packed Sequence Dataset)
传统按样本 Padding 到最大长度会导致 GPU 大量算力浪费在 `<pad>` 占位符上。工业级标准采用 **Token 序列紧密打包（Sequence Packing）**：

```python
import torch
from torch.utils.data import Dataset

class PackedSFTDataset(Dataset):
    """紧密打包的 SFT 数据集 (消除 Padding 显存与计算浪费)"""
    def __init__(self, tokenizer, data_pairs, seq_length=512):
        self.seq_length = seq_length
        all_tokens = []
        
        # 1. 将 prompt 与 response 用 Alpaca 模板格式化并拼接入全局 Token 序列
        for item in data_pairs:
            formatted_text = f"### Instruction:\n{item['prompt']}\n\n### Response:\n{item['response']}{tokenizer.eos_token}"
            all_tokens.extend(tokenizer.encode(formatted_text))
            
        # 2. 划分为固定长度 seq_length 的不重叠 Chunk
        num_chunks = len(all_tokens) // seq_length
        self.chunks = [all_tokens[i*seq_length : (i+1)*seq_length] for i in range(num_chunks)]

    def __len__(self):
        return len(self.chunks)

    def __getitem__(self, i):
        chunk = torch.tensor(self.chunks[i], dtype=torch.long)
        # 输入与自回归 Label 相同 (CrossEntropyLoss 内部执行 Shift)
        return {"input_ids": chunk, "labels": chunk.clone()}
```

### 3.2 梯度累积与混合精度训练循环
- **显存与 Batch 权衡**：即使加载 BF16 与 FlashAttention-2，单卡显存仍难以支撑大 Batch。
- **梯度累积（Gradient Accumulation）**：通过每 $K$ 个 Micro-batch 执行一次参数更新，损失除以 $K$ 保持梯度幅值无偏。

```python
optimizer.zero_grad()
accum_steps = 4

for idx, batch in enumerate(dataloader):
    input_ids = batch["input_ids"].to(device)
    labels = batch["labels"].to(device)
    
    # 前向计算
    logits = model(input_ids).logits
    # 计算自回归交叉熵损失
    loss = F.cross_entropy(logits.view(-1, logits.size(-1)), labels.view(-1))
    loss = loss / accum_steps
    loss.backward()
    
    if (idx + 1) % accum_steps == 0:
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        optimizer.zero_grad()
```

---

## 4. 安全红队对抗测试 (Red-Teaming)

在 SFT 之后，需通过主动红队对抗诱导潜在风险行为：
1. **隐式恶意诱导**：如通过虚构小说写作、角色扮演（Jailbreak Prompts）规避关键词过滤。
2. **反向双重用途 (Dual-Use)**：请求编写网络渗透测试脚本、化学反应方程式合成等敏感应用。
3. **拒答过当（Over-refusal）分析**：在提高安全性的同时，需防范模型对包含敏感词但无害的学术探讨（如“如何治疗抑郁症”、“历史战争伤亡统计”）产生过度拒答。

---

## 5. 直接偏好优化 (DPO) 算法工程实现

### 5.1 单样本 DPO 损失实现

$$\mathcal{L}_{\text{DPO}}(\pi_\theta; \pi_{\text{ref}}) = -\log \sigma\left( \beta \left( \log \pi_\theta(y_w \mid x) - \log \pi_{\text{ref}}(y_w \mid x) \right) - \beta \left( \log \pi_\theta(y_l \mid x) - \log \pi_{\text{ref}}(y_l \mid x) \right) \right)$$

```python
def compute_per_instance_dpo_loss(model, ref_model, prompt_ids, chosen_ids, rejected_ids, beta=0.1):
    """
    计算单样本成对 DPO 损失
    prompt_ids: 提示词 Token IDs
    chosen_ids: 人类偏好的优胜回答 Token IDs (y_w)
    rejected_ids: 被拒绝的回答 Token IDs (y_l)
    """
    # 1. 拼接输入 Prompt 与 Response
    chosen_seq = torch.cat([prompt_ids, chosen_ids])
    rejected_seq = torch.cat([prompt_ids, rejected_ids])
    prompt_len = len(prompt_ids)
    
    # 2. 计算训练策略模型 π_θ 的对数似然 (仅针对 Response 部分)
    with torch.no_grad():
        ref_chosen_logits = ref_model(chosen_seq.unsqueeze(0)).logits[0]
        ref_rejected_logits = ref_model(rejected_seq.unsqueeze(0)).logits[0]
    
    policy_chosen_logits = model(chosen_seq.unsqueeze(0)).logits[0]
    policy_rejected_logits = model(rejected_seq.unsqueeze(0)).logits[0]
    
    # 3. 提取目标 Token 的条件对数概率 log π(y | x)
    def get_log_probs(logits, seq):
        log_p = F.log_softmax(logits[:-1], dim=-1)
        targets = seq[1:]
        # 仅截取 response 对应的 token
        resp_log_p = log_p[prompt_len-1 : , :]
        resp_targets = targets[prompt_len-1 :]
        return resp_log_p.gather(1, resp_targets.unsqueeze(1)).sum()
    
    pi_cw = get_log_probs(policy_chosen_logits, chosen_seq)
    pi_cl = get_log_probs(policy_rejected_logits, rejected_seq)
    ref_cw = get_log_probs(ref_chosen_logits, chosen_seq)
    ref_cl = get_log_probs(ref_rejected_logits, rejected_seq)
    
    # 4. 计算隐式奖励差值
    log_ratio_w = pi_cw - ref_cw
    log_ratio_l = pi_cl - ref_cl
    
    # 5. DPO 对数损失
    loss = -F.logsigmoid(beta * (log_ratio_w - log_ratio_l))
    
    # 计算当前隐式奖励分类准确率 (chosen 是否得分高于 rejected)
    acc = (log_ratio_w > log_ratio_l).float()
    return loss, acc
```

### 5.2 双卡分布式部署架构
- **显存隔离策略**：由于 DPO 需要同时加载当前优化模型 $\pi_\theta$ 与冻结的参考模型 $\pi_{\text{ref}}$，单卡极易 OOM。标准工程实践将**参考模型部署在 GPU 1（纯 Eval 模式），训练模型部署在 GPU 0（开启梯度）**，实现跨卡异步计算与显存均衡。

---

## 6. 对齐税现象 (The Alignment Tax) 与能力保持

```
                           [ 对齐税的消长平衡 ]
  安全与通用对话指标 (AlpacaEval / SimpleSafetyTests) ───[ 大幅跃升 ↑↑ ]
                             vs
  数理学术能力 (GSM8K / MMLU / 编程代码)              ───[ 轻度回退或钝化 ↓ ]
```

- **对齐税（Alignment Tax）机理**：在追求高安全性、强拒绝倾向与礼貌格式的过程中，模型探索多样性被压缩，导致原本在复杂多步骤数学与算法推理上的解题灵活性受到一定抑制。
- **缓解策略**：在 DPO / RLHF 数据集中混入高质量数学证明与代码解题偏好对，或引入多阶段退火（如 DeepSeek-R1 阶段 4），确保通用安全性与极致理科推理并存。
