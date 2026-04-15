---
title: Adam优化器
source: https://www.rethink.fun/chapter9/Adam优化器.html
chapter: 09-优化与正则化
tags: [深度学习, RethinkFun, 09-优化与正则化]
---

# Adam优化器

## 9.5 Adam优化器

Adam(Adaptive Moment Estimation)，结合了Momentum优化器和RMSProp优化器的优点，目前已经是深度学习领域默认的优化器。
Adam优化器同时利用动量来给梯度更新增加惯性和震荡阻尼，也利用历史梯度的均方根来自适应调整学习率。下边我们给出它的具体计算过程。

首先计算参数w的梯度：

gw=∂loss∂wg_w=\frac{\partial loss}{\partial w}gw​=∂w∂loss​

然以后计算并更新一阶矩指数加权平均值VwV_wVw​，和二阶矩指数加权平均值SwS_wSw​。

Vw=β1Vw+(1−β1)gwV_w=\beta_1V_w+(1-\beta_1)g_wVw​=β1​Vw​+(1−β1​)gw​

Sw=β2Sw+(1−β2)gw2S_w=\beta_2S_w+(1-\beta_2){g_w}^2Sw​=β2​Sw​+(1−β2​)gw​2

β1=0.9;β2=0.999\beta_1=0.9;\beta_2=0.999β1​=0.9;β2​=0.999

接着对这两个值进行校正：

Vwcorrect=Vw1−β1tV_w^{correct}=\frac{V_w}{1-{\beta_1}^t}Vwcorrect​=1−β1​tVw​​

Swcorrect=Sw1−β2tS_w^{correct}=\frac{S_w}{1-{\beta_2}^t}Swcorrect​=1−β2​tSw​​

最后更新参数：

w=w−lrVwcorrectSwcorrect+εw=w-lr\frac{V_w^{correct}}{\sqrt{S_w^{correct}}+\varepsilon}w=w−lrSwcorrect​​+εVwcorrect​​

Adam优化器可以稳定且迅速的训练深度神经网络，但是它需要为每个参数额外在显存里保存两个值：V和S，来记录梯度的一阶和二阶指数加权平均值。这占据了大量宝贵的显存空间。
