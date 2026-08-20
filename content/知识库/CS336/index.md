# CS336: Language Modeling from Scratch

> 斯坦福大学顶级大模型核心课（Spring 2026）完整精修笔记库。  
> 遵循从零手写大语言模型的全流程：Tokenization ➔ 架构设计 ➔ 硬件与算子优化 ➔ 分布式训练 ➔ Scaling Laws ➔ 预训练数据工程 ➔ 后训练与对齐。

---

## 📚 课程讲义笔记索引

### 阶段一：基础架构与算力分析 (Basics & Foundation)
- [[1 Introduction & Tokenization]] — 课程概览、Unicode/UTF-8、BPE 算法原理与分词器实现
- [[2 Pytorch]] — PyTorch 与 einops 核心操作、FLOPs 算力模型、Transformer 显存推导与算术强度分析
- [[3 Architectures & Hyperparameters]] — Transformer 各层剖析、Norm 方案 (LN/RMSNorm/Pre-LN)、RoPE 旋转位置编码、SwiGLU 与超参数规律
- [[4 Attention Alternatives & MoE]] — 长上下文替代方案、线性注意力、Mamba/SSM、Mixture of Experts (MoE) 门控路由与通信

### 阶段二：系统、硬件与并行加速 (Systems & Parallelism)
- [[5 GPUs & TPUs]] — GPU 硬件层次 (SM/Warp/SRAM/HBM)、Tensor Core 混合精度 (FP16/BF16/FP8)、Roofline 模型与 TPU 架构
- [[6 Kernels & Triton]] — GPU 编程模型、OpenAI Triton 语言开发、FlashAttention-1/2 算法原理与 Online Softmax
- [[7 Parallelism Basics]] — 数据并行 (DDP)、Megatron-LM 张量并行 (TP 矩阵切分)、流水线并行 (PP) 调度与气泡率
- [[8 Parallelism Distributed]] — 集合通信原语、ZeRO (1/2/3) 显存分析、FSDP、序列并行 (SP) 与 3D/4D 混合并行

### 阶段三：模型缩放与推理评测 (Scaling, Inference & Evaluation)
- [[9 Scaling Laws (Part 1)]] — Kaplan 与 Chinchilla 缩放定律、联合拟合公式推导、计算最优配比与过训练价值
- [[10 Inference & Decoding]] — 推理 Prefill/Decode 阶段、KV Cache 显存占用、解码采样策略、投机采样 (Speculative Decoding)
- [[11 Scaling Laws (Part 2)]] — 预训练 Loss 与下游涌现能力、Test-Time Compute 扩展定律、高质量数据对 Scaling 曲线的影响
- [[12 Evaluation]] — 困惑度 (Perplexity) 计算与局限、核心 Benchmark (MMLU/GSM8K/HumanEval/HELM/Arena)、数据污染检测

### 阶段四：数据工程与对齐后训练 (Data & Post-Training)
- [[13 Data Sources & Datasets]] — 预训练语料来源全景 (Common Crawl WARC/WAT/WET、C4、RefinedWeb、FineWeb、DCLM)、版权与合规
- [[14 Data Filtering & Deduplication]] — 数据清洗 Pipeline、Gopher/C4 启发式规则、质量分类器、MinHash LSH 模糊去重与 Data Mixing
- [[15 Mid & Post-Training (SFT & RLHF)]] — 监督微调 (SFT)、人类偏好对齐原理、Bradley-Terry 模型、RLHF 三阶段与 DPO 算法推导
- [[16 Post-Training (RLVR)]] — 可验证奖励强化学习 (RLVR)、GRPO 策略优化推导、DeepSeek-R1 / OpenAI o1 思维链 (CoT) 激发机制
- [[17 Alignment & Multimodality]] — 视觉-语言模型 (VLM) 架构、CLIP 对齐、LLaVA 投影层与 AnyRes 动态分辨率、多模态安全治理
