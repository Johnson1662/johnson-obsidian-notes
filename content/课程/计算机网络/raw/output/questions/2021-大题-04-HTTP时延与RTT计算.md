---
qid: NW-2021-FRQ04
year: "2021"
chapter: "应用层"
type: "协议时延计算题"
tags: [HTTP, RTT, 持久连接, 非持久连接, 并发TCP]
concept: "[[02-应用层#HTTP时延分析]]"
status: "未做"
difficulty: 3
score: "12分"
---

# 2021年期末 · 计算大题 4 (HTTP 对象获取时延与RTT计算)

> [!question] 2021年期末 · 计算大题 4 (HTTP 对象获取时延与RTT计算)
> 某 HTML 文件引用了同一服务器上的 8 个极小的对象（传输时延忽略不计）。设建立 TCP 连接需 1 个 RTT，发送 HTTP 请求到收到响应需 1 个 RTT，DNS 解析耗时为 $RTT_{DNS}$。分别计算以下三种场景下获取该完整页面所需的时间：
> 
> a. 非持久 HTTP，不使用并行 TCP 连接；
> b. 非持久 HTTP，浏览器开启 6 条并行 TCP 连接；
> c. 带流水线的持久 HTTP（Pipelined Persistent HTTP）；
> d. 串行持久 HTTP（Non-pipelined Persistent HTTP）。
> 
> **考点**：HTTP, RTT, 持久连接, 非持久连接, 并发TCP | **分值**：12分 | **关联概念**：[[02-应用层#HTTP时延分析]]

> [!check]- 参考答案与解析（点击展开）
> **参考答案与公式推导**：
> 
> 记 $RTT_0$ 为客户端与服务器之间的往返时延，基础 DNS 解析耗时为 $RTT_{DNS}$。
> 
> ### a. 非持久 HTTP（无并行连接，串行获取）
> - 获取基础 HTML 文件：1 个 RTT 握手 + 1 个 RTT 请求 = $2 RTT_0$。
> - 每个对象都需要单独建立 TCP 并请求，共 8 个对象：$8 \times 2 RTT_0 = 16 RTT_0$。
> - **总时延**：$RTT_{DNS} + 2 RTT_0 + 16 RTT_0 = 18 RTT_0 + RTT_{DNS}$。
> 
> ### b. 非持久 HTTP（同时开 6 条并行连接）
> - 获取基础 HTML 文件：$2 RTT_0$。
> - 8 个对象分两批并行获取：
>   - 第 1 批并行请求 6 个对象：耗时 $2 RTT_0$。
>   - 第 2 批并行请求剩余 2 个对象：耗时 $2 RTT_0$。
> - **总时延**：$RTT_{DNS} + 2 RTT_0 + 2 RTT_0 + 2 RTT_0 = 6 RTT_0 + RTT_{DNS}$。
> 
> ### c. 流水线持久 HTTP（Pipelined）
> - 建立 TCP 连接：$1 RTT_0$。
> - 请求 HTML 页面：$1 RTT_0$。
> - 收到 HTML 后，8 个引用对象的请求紧接着在一个 RTT 内并行/流水线送达并返回：$1 RTT_0$。
> - **总时延**：$RTT_{DNS} + 1 RTT_0 + 1 RTT_0 + 1 RTT_0 = 3 RTT_0 + RTT_{DNS}$。
> 
> ### d. 串行持久 HTTP（Non-pipelined）
> - 建立连接 + 获取 HTML：$2 RTT_0$。
> - 复用已有 TCP 连接，8 个对象串行请求（每次 1 个 RTT）：$8 \times 1 RTT_0 = 8 RTT_0$。
> - **总时延**：$RTT_{DNS} + 2 RTT_0 + 8 RTT_0 = 10 RTT_0 + RTT_{DNS}$。
