# 原始素材：小红书「403-error」Personal Agent 架构拆解

抓取日期：2026-10-24。作者：403-error。笔记标题「Personal Agent 架构拆解」。

这份文件是原稿，逐字保留笔记正文、视频口播稿、评论区原文和画面关键帧 OCR，供与整理稿
`../Personal Agent 架构拆解（Grok Bot）.md` 对照。

口播稿由 Cloudflare Whisper 机器转写，同音字有错，**以画面文字为准**；更正对照见文末。

## 笔记信息

- 笔记 ID：`6acf9cc6000000000a024e1a`
- 链接：https://www.xiaohongshu.com/explore/6acf9cc6000000000a024e1a
- 类型：视频，720x1280，95.5 秒，4.5 MB
- 互动：167 赞 · 15 评论 · 312 收藏 · 62 分享
- 标签：claudecode / howto用好AI

## 笔记正文（原文）

```text
尝试一下新的内容形式，Personal Agent 确实有不一样的体验，简单分析一波，欢迎交流，个人还是比较看好 personal agent 的未来的，只是需要再迭代尝试一下。
```

## 视频口播稿（机器转写，原文）

```text
很多人觉得 Personal Agent和Coding Agent的架构是一样的 我们对Grog Bot做了比较细的逆向 发现其实不是 有几个细节很影响体验 也是真正让人有粘性的地方 先看它的架构 分三层 主Agent负责理解你 安排工作交付结果 Worker负责耗时的执行 Harness负责保存状态 传递消息 再把主Agent叫醒 这里面有两个关键设计 外加一个有趣的小细节 第一点 纯逆步 主Agent只做三件事 理解你 派活 交付 超过两轮工具调用的活 一律交给后台Worker 派完它就结束这一轮 不等待 也不轮循 Worker 做完 Harness再把它唤醒 我们之前也讲过 OpenCore最重要的创新点 就是这个转后台 感兴趣可以进我的主页看 第二点 压缩也是逆步的 压缩上下文很费时间 要把整段历史交给模型重读一遍 再写成摘要 很多Agent的压缩时只能停下来 你只能干等 Crogbot 在剩余上下文不到1万Token 或者不到10%时 就在后台开始写摘要 对话照常继续 摘要期间 你新发的消息 会接在摘要后面 不会被旧摘要覆盖 后台的Worker也不受影响 压缩后 程序直接保存的代办列表 一条都不会丢 最后 再分享一个 我们在逆向里发现的有趣细节 压缩Prompt是按模型定制的 比如OpenAI分支 把交接摘要放在最后 贴合模型的训练预期 Enthropic和XAI 也各有一套 一句话总结 主Agent永远在线 连压缩都不打扰你
```

## 评论区（原文，共 15 条，下列为全部）

```text
【Henry Li】讲的非常好！

【403-error】模型生产视频能力一下提高太多！

【书影】这有一句话是在讲code和个人agent有啥不同吗？

【403-error】不好意思 确实这块缺失了 我补充一下哈 主要的区别是 code agent 偏向同步 所有任务做完了再汇报 而 personal agent 全部异步

【moYa】牛蛙，这动画有提示词吗

【403-error】等我再迭代几个版本可以发一下

【小蚊子～】怎么逆向的呀

【403-error】最近有一个开源项目 rea 非常火 可以看一看

【學.】一分钟讲得太清楚了

【mz】最新dot和muse之类的热度很高，但是从使用体感上就像是之前的openclaw接入了codex？不知道dot和openclaw类似的助手真正的差异在哪嘞？云上和本机嘛？

【403-error】主要是做的更加成熟吧，配上了稳定的主机和模型，你的龙虾不会随便死掉

【從申|神聪|CS.ai】agent trace 的机制如何呢

【啊ZzZ】厉害啊

【七卡瓦】用 o5.5 做的吗这是

【打钳的小虾🦐】highclaws 和 grok bot 有何区别
```

## 画面关键帧 OCR（原文，机器识别）

```text
[f001] 很多人觉得
[f002] Coding Agent Personal Agent 我们对 Grok Bot 做了比较细的逆向
[f003] Coding Agent Personal Agent Grok Bot 细致逆向 有几个细节很影响体验
[f004] 先看它的架构，分三层
[f005] 主 agent { 理解你 | 安排工作 | 交付结果 主 agent 负责理解你、安排工作、交付结果
[f006] 主 agent 耗时的执行 harness harness 负责保存状态、传递消息
[f007] 主 agent harness 02 异步压缩 这里面有两个关键设计
[f008] O1 纯异步 第一点，纯异步
[f009] 01 纯异步 理解你、派活、交付
[f010] 01 纯异步 调研 x 追问 agent 派发 worker 超过 2 轮工具调用 一 交给 worker 派完它就结束这一轮，不等待
[f011] 01 纯异步 调研 x 追问 worker 超过 2 轮工具调用 一 交给 worker harness 再做唤醒
[f012] 01 纯异步 调研 x 追问 用户 交付 主 agent worker 超过 2 轮工具调用 一 交给 worker OpenClaw 最主要的创新：转后台
[f013] 02 压缩也是异步的 第二点，压缩也是异步的
[f014] 02 压缩也是异步的 要把整段历史交给模型重读一遍
[f015] 02 压缩也是异步的 常见做法 agent 压缩时只能停下来
[f016] 02 压缩也是异步的 Grok Bot 在剩余上下文不到 10k tokens
[f017] 02 压缩也是异步的 Grok Bot 剩余 < 10k tokens 或 < 10% worker 对话照常继续
[f018] 02 压缩也是异步的 Grok Bot 剩余 < 10k tokens 或 < 10% 新消息 worker 不会被旧摘要覆盖
[f019] 02 压缩也是异步的 Grok Bot 剩余 < 10k tokens 或 < 10% worker 压缩后，程序直接保存的待办列表
[f020] 一个有趣的细节
[f021] 一个有趣的细节 压缩 prompt 按模型定制 OpenAI 压缩 prompt 是按模型定制的
[f022] 一个有趣的细节 压缩 prompt 按模型定制 OpenAI 摘要放最后 一 贴合模型的训练预期
[f023] 一个有趣的细节 压缩 prompt 按模型定制 OpenAI 摘要放最后 一 贴合模型的训练预期
[f024] 一句话总结 agent 永远在线 连压缩都不打扰你 Grok Bot 逆向分析，更多见主页
```

## 转写勘误对照

| 口播稿（机器转写） | 画面文字（正确） |
|---|---|
| Grog Bot / Crogbot | Grok Bot |
| 纯逆步 | 纯异步 |
| 压缩也是逆步的 | 压缩也是异步的 |
| OpenCore | OpenClaw |
| 代办列表 | 待办列表 |
| Enthropic | Anthropic |
| 轮循 | 轮询 |
