---
qid: NW-2021-MCQ05
year: "2021"
chapter: "应用层"
type: "选择题"
tags: [HTTP, 无状态, Cookies, Web缓存]
concept: "[[02-应用层#HTTP协议与Web]]"
status: "未做"
difficulty: 2
score: "2分"
---

# 2021年期末 · 选择题 5

> [!question] 2021年期末 · 选择题 5
> 关于 HTTP，下列说法正确的是（）。
> 
> A. HTTP 的数据包头部是以二进制形式存储的，很难读懂内容
> B. 使用 UDP 协议
> C. HTTP 服务器采用无状态（stateless）管理方式，不保存客户端的任何状态信息。为了能记录用户状态，需要使用 cookies
> D. HTTP 的 web proxy 总是能够降低响应时间，提升用户体验
> 
> **考点**：HTTP, 无状态, Cookies, Web缓存 | **分值**：2分 | **关联概念**：[[02-应用层#HTTP协议与Web]]

> [!check]- 参考答案与解析（点击展开）
> **参考答案**：C
> 
> **解析**：
> - HTTP/1.x 协议本质是无状态的，Web 站点为了记录用户会话状态（如登录、购物车）必须依赖客户端与服务端协同的 Cookies 机制。
> - A 错误：HTTP/1.x 请求和响应首部均采用纯 ASCII 文本格式，人类可读（HTTP/2 才采用二进制分帧）。
> - B 错误：HTTP 运行在 TCP 传输层之上。
> - D 错误：缓存未命中时代理会增加一跳时延，并非“总是”能降低响应时间。
