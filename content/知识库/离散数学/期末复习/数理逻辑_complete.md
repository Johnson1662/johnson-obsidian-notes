# 数理逻辑

## 命题符号化与推理

### 2019-2020
符号化下列命题，并进行推理
- A或B获诺贝尔奖
- 若A获奖，则《三体》中科学预言成立
- 若B实验结果正确，则量子计算机研制没有成功
- 若B实验结果不正确，则《三体》中科学预言不成立
- 量子计算机的研制获得了成功
问：谁获得了诺贝尔奖

> [!NOTE] 定义1-2.3（析取）
> 两个命题 $P$ 和 $Q$ 的析取是一个复合命题，记作 $P \lor Q$。当且仅当 $P, Q$ 同时为 $F$ 时，$P \lor Q$ 的真值为 $F$，否则 $P \lor Q$ 的真值为 $T$。

> [!NOTE] 定义1-2.4（条件）
> 给定两个命题 $P$ 和 $Q$，其条件命题是一个复合命题，记作 $P \rightarrow Q$。当且仅当 $P$ 的真值为 $T$，$Q$ 的真值为 $F$ 时，$P \rightarrow Q$ 的真值为 $F$，否则 $P \rightarrow Q$ 的真值为 $T$。

> [!NOTE] 定义1-2.1（否定）
> 设 $P$ 为一命题，$P$ 的否定是一个新的命题，记作 $\neg P$。若 $P$ 为 $T$，则 $\neg P$ 为 $F$；若 $P$ 为 $F$，则 $\neg P$ 为 $T$。

> [!NOTE] 定义1-8.1（有效结论）
> 设 $H_1, H_2, \dots, H_n, C$ 是命题公式，当且仅当 $H_1 \wedge H_2 \wedge \dots \wedge H_n \Rightarrow C$，称 $C$ 是一组前提 $H_1, H_2, \dots, H_n$ 的有效结论。

### 证明：

**符号化：**
设命题：
- $P$: A获得了诺贝尔奖
- $Q$: B获得了诺贝尔奖
- $R$: 《三体》中科学预言成立
- $S$: B的实验结果正确
- $T$: 量子计算机研制成功

前提：
1. $P \lor Q$ —— A或B获奖
2. $P \rightarrow R$ —— A获奖则预言成立
3. $S \rightarrow \neg T$ —— B结果正确则量子计算机未成功
4. $\neg S \rightarrow \neg R$ —— B结果不正确则预言不成立
5. $T$ —— 量子计算机研制成功

**推理过程：**

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $T$ | P规则（前提5） |
| ② | $S \rightarrow \neg T$ | P规则（前提3） |
| ③ | $\neg S$ | ①,②, I12（拒取式：$\neg Q, P \rightarrow Q \Rightarrow \neg P$） |
| ④ | $\neg S \rightarrow \neg R$ | P规则（前提4） |
| ⑤ | $\neg R$ | ③,④, I11（假言推理：$P, P \rightarrow Q \Rightarrow Q$） |
| ⑥ | $P \rightarrow R$ | P规则（前提2） |
| ⑦ | $\neg P$ | ⑤,⑥, I12（拒取式） |
| ⑧ | $P \lor Q$ | P规则（前提1） |
| ⑨ | $Q$ | ⑦,⑧, I10（析取三段论：$\neg P, P \lor Q \Rightarrow Q$） |

结论：Q为真，故**B获得了诺贝尔奖**。

---

### 2022-2023 期中（8分）
符号化下列命题，并进行推理，事实情况如下所述：

* **a)** Alice 或 Bob 获得了 Turing 奖；
* **b)** 若 Alice 获得 Turing 奖，则 Church-Turing 命题不成立；
* **c)** 若 Bob 的证明正确，则量子计算机的研制没有获得成功；
* **d)** 若 Bob 的证明不正确，则 Church-Turing 命题成立；
* **e)** 量子计算机的研制获得了成功。

问：谁获得了 Turing 奖？

> [!NOTE] 定义1-2.3（析取）
> 两个命题 $P$ 和 $Q$ 的析取是一个复合命题，记作 $P \lor Q$。当且仅当 $P, Q$ 同时为 $F$ 时，$P \lor Q$ 的真值为 $F$，否则 $P \lor Q$ 的真值为 $T$。

> [!NOTE] 定义1-2.4（条件）
> 给定两个命题 $P$ 和 $Q$，其条件命题是一个复合命题，记作 $P \rightarrow Q$。当且仅当 $P$ 的真值为 $T$，$Q$ 的真值为 $F$ 时，$P \rightarrow Q$ 的真值为 $F$，否则 $P \rightarrow Q$ 的真值为 $T$。

> [!NOTE] 定义1-8.1（有效结论）
> 设 $H_1, H_2, \dots, H_n, C$ 是命题公式，当且仅当 $H_1 \wedge H_2 \wedge \dots \wedge H_n \Rightarrow C$，称 $C$ 是一组前提 $H_1, H_2, \dots, H_n$ 的有效结论。

### 证明：

**符号化：**
设命题：
- $A$: Alice获得了Turing奖
- $B$: Bob获得了Turing奖
- $C$: Church-Turing命题成立
- $D$: Bob的证明正确
- $E$: 量子计算机研制成功

前提：
- a) $A \lor B$
- b) $A \rightarrow \neg C$
- c) $D \rightarrow \neg E$
- d) $\neg D \rightarrow C$
- e) $E$

**推理过程：**

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $E$ | P规则（前提e） |
| ② | $D \rightarrow \neg E$ | P规则（前提c） |
| ③ | $\neg D$ | ①,②, I12（拒取式） |
| ④ | $\neg D \rightarrow C$ | P规则（前提d） |
| ⑤ | $C$ | ③,④, I11（假言推理） |
| ⑥ | $A \rightarrow \neg C$ | P规则（前提b） |
| ⑦ | $\neg A$ | ⑤,⑥, I12（拒取式） |
| ⑧ | $A \lor B$ | P规则（前提a） |
| ⑨ | $B$ | ⑦,⑧, I10（析取三段论） |

结论：B为真，故**Bob获得了Turing奖**。

---

### 2022-2023 期末（5分）
三位球迷预测下一届足球世界杯的冠军。

* **A球迷**：巴西和德国都不是冠军。
* **B球迷**：中国是冠军，并且德国不是冠军。
* **C球迷**：巴西是冠军，并且中国不是冠军。

预言家笑着说，三位球迷中的两位预测完全正确，而另一位球迷的预测完全错误。
请运用数理逻辑知识，判断该预言家认为哪个国家是世界杯冠军。

> [!NOTE] 定义1-2.2（合取）
> 两个命题 $P$ 和 $Q$ 的合取是一个复合命题，记作 $P \wedge Q$。当且仅当 $P, Q$ 同时为 $T$ 时，$P \wedge Q$ 为 $T$，在其他情况下，$P \wedge Q$ 的真值都是 $F$。

> [!NOTE] 定义1-2.1（否定）
> 设 $P$ 为一命题，$P$ 的否定是一个新的命题，记作 $\neg P$。若 $P$ 为 $T$，则 $\neg P$ 为 $F$；若 $P$ 为 $F$，则 $\neg P$ 为 $T$。

### 证明：

**符号化：**
设命题：
- $P$: 巴西是冠军
- $Q$: 德国是冠军
- $R$: 中国是冠军

各球迷的预测（命题公式）：
- A: $\neg P \wedge \neg Q$
- B: $R \wedge \neg Q$
- C: $P \wedge \neg R$

条件：三者中恰有两个为真，一个为假。

**穷举分析：**
可能的冠军只有巴西、德国、中国三者之一。

1. **假设巴西是冠军（$P = T, Q = F, R = F$）：**
   - A: $\neg T \wedge \neg F = F \wedge T = F$
   - B: $F \wedge \neg F = F \wedge T = F$
   - C: $T \wedge \neg F = T \wedge T = T$
   - 结果为 1 真 2 假，不符合题意。

2. **假设德国是冠军（$P = F, Q = T, R = F$）：**
   - A: $\neg F \wedge \neg T = T \wedge F = F$
   - B: $F \wedge \neg T = F \wedge F = F$
   - C: $F \wedge \neg F = F \wedge T = F$
   - 结果为 0 真 3 假，不符合题意。

3. **假设中国是冠军（$P = F, Q = F, R = T$）：**
   - A: $\neg F \wedge \neg F = T \wedge T = T$
   - B: $T \wedge \neg F = T \wedge T = T$
   - C: $F \wedge \neg T = F \wedge F = F$
   - 结果为 2 真 1 假，符合题意。

结论：由真值分析可知，满足条件的冠军是**中国**。

---

### 2022-2023 期末（8分）
小张接到了一个自称王警官的电话。根据通话内容，小张得到以下事实：

1. 王警官的真实身份是公安人员或电信诈骗分子。
2. 王警官是电信诈骗分子，当且仅当小张被要求提供银行卡信息。
3. 小张没有被要求提供银行卡信息。

根据上述事实，请使用推理理论，帮助小张判断王警官的真实身份。（要求写出推理过程）

> [!NOTE] 定义1-2.3（析取）
> 两个命题 $P$ 和 $Q$ 的析取是一个复合命题，记作 $P \lor Q$。当且仅当 $P, Q$ 同时为 $F$ 时，$P \lor Q$ 的真值为 $F$，否则 $P \lor Q$ 的真值为 $T$。

> [!NOTE] 定义1-2.5（双条件）
> 给定两个命题 $P$ 和 $Q$，其复合命题 $P \rightleftharpoons Q$（或记作 $P \leftrightarrow Q$）称作双条件命题。当 $P$ 和 $Q$ 的真值相同时，$P \rightleftharpoons Q$ 的真值为 $T$，否则 $P \rightleftharpoons Q$ 的真值为 $F$。

> [!NOTE] 定义1-2.1（否定）
> 设 $P$ 为一命题，$P$ 的否定是一个新的命题，记作 $\neg P$。若 $P$ 为 $T$，则 $\neg P$ 为 $F$；若 $P$ 为 $F$，则 $\neg P$ 为 $T$。

### 证明：

**符号化：**
设命题：
- $P$: 王警官是公安人员
- $Q$: 王警官是电信诈骗分子
- $R$: 小张被要求提供银行卡信息

前提：
1. $P \lor Q$
2. $Q \rightleftharpoons R$（即 $Q \leftrightarrow R$）
3. $\neg R$

**推理过程：**

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $\neg R$ | P规则（前提3） |
| ② | $Q \rightleftharpoons R$ | P规则（前提2） |
| ③ | $Q \rightarrow R$ | ②, E20（$P \rightleftharpoons Q \Leftrightarrow (P \rightarrow Q) \land (Q \rightarrow P)$） |
| ④ | $\neg Q$ | ①,③, I12（拒取式） |
| ⑤ | $P \lor Q$ | P规则（前提1） |
| ⑥ | $P$ | ④,⑤, I10（析取三段论） |

结论：由 $P$ 为真可知，**王警官的真实身份是公安人员**。

---

### 2022-2023 期末（7分）
翻译下面的前提和结论为数理逻辑公式，并使用直接证法或间接证法，证明前提能够推出结论。

* **前提**：
1. 所有大学生都喜欢打篮球。
2. 张三是天津大学的学生。

* **结论**：若张三是天津人，则张三喜欢打篮球。

> [!NOTE] 定义2-2.1（简单命题函数与量词）
> 由一个谓词和一些客体变元组成的表达式，称为**简单命题函数**。全称量词 $(\forall x)$ 表示"对所有的 $x$"，存在量词 $(\exists x)$ 表示"存在一些 $x$"。

> [!NOTE] 定义1-2.4（条件）
> 给定两个命题 $P$ 和 $Q$，其条件命题是一个复合命题，记作 $P \rightarrow Q$。当且仅当 $P$ 为 $T$，$Q$ 为 $F$ 时，$P \rightarrow Q$ 为 $F$，否则为 $T$。

> [!NOTE] 全称指定规则（US）
> $$
> \frac{(\forall x)P(x)}{\therefore P(c)}
> $$
> 其中 $P$ 是谓词，$c$ 是论域中某个任意的客体。

### 证明：

**符号化：**
设个体域为全总个体域。定义谓词：
- $U(x)$: $x$ 是大学生
- $L(x)$: $x$ 喜欢打篮球
- $T(x)$: $x$ 是天津大学的学生
- $TJ(x)$: $x$ 是天津人
- $z$: 张三（个体常量）

前提：
1. $\forall x(U(x) \rightarrow L(x))$ —— 所有大学生都喜欢打篮球
2. $T(z)$ —— 张三是天津大学的学生

结论：$TJ(z) \rightarrow L(z)$

**推理过程：**

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $\forall x(U(x) \rightarrow L(x))$ | P规则（前提1） |
| ② | $U(z) \rightarrow L(z)$ | ①, US（全称指定） |
| ③ | $T(z)$ | P规则（前提2） |
| ④ | $T(z) \rightarrow U(z)$ | 天津大学的学生必是大学生（隐含前提） |
| ⑤ | $U(z)$ | ③,④, I11（假言推理） |
| ⑥ | $L(z)$ | ②,⑤, I11（假言推理） |
| ⑦ | $TJ(z) \rightarrow L(z)$ | ⑥, I6（$Q \Rightarrow P \rightarrow Q$，因为 $L(z)$ 为真，蕴含式必为真） |

或者更直接地：由⑥知 $L(z)$ 为真，故对任意命题 $TJ(z)$，$TJ(z) \rightarrow L(z)$ 必为真（前提为假时条件式为真，前提为真时后件亦真）。因此结论成立。

---

### 2024-2025
符号化命题，利用数理逻辑判断1) 2) 是否可以推出3)

1. A会和B会都在天津召开  
2. 若B会在天津召开，则今年是天大130年校庆  
3. 若校庆标志为 $\beta^{\circ}$ , 则今年是天大130周年校庆

> [!NOTE] 定义1-2.2（合取）
> 两个命题 $P$ 和 $Q$ 的合取是一个复合命题，记作 $P \wedge Q$。当且仅当 $P, Q$ 同时为 $T$ 时，$P \wedge Q$ 为 $T$。

> [!NOTE] 定义1-2.4（条件）
> 给定两个命题 $P$ 和 $Q$，其条件命题记作 $P \rightarrow Q$。当且仅当 $P$ 为 $T$，$Q$ 为 $F$ 时，$P \rightarrow Q$ 为 $F$，否则为 $T$。

> [!NOTE] 定义1-8.1（有效结论）
> 设 $H_1, H_2, \dots, H_n, C$ 是命题公式，当且仅当 $H_1 \wedge H_2 \wedge \dots \wedge H_n \Rightarrow C$，称 $C$ 是一组前提 $H_1, H_2, \dots, H_n$ 的有效结论。

### 证明：

**符号化：**
设命题：
- $P$: A会在天津召开
- $Q$: B会在天津召开
- $R$: 今年是天大130年校庆
- $S$: 校庆标志为 $\beta^{\circ}$

前提：
1. $P \wedge Q$
2. $Q \rightarrow R$

结论（待判断）：$S \rightarrow R$

**推理过程：**

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $P \wedge Q$ | P规则（前提1） |
| ② | $Q$ | ①, I2（$P \land Q \Rightarrow Q$） |
| ③ | $Q \rightarrow R$ | P规则（前提2） |
| ④ | $R$ | ②,③, I11（假言推理） |
| ⑤ | $S \rightarrow R$ | ④, I6（$Q \Rightarrow P \rightarrow Q$） |

由于 $R$ 为真，$S \rightarrow R$ 恒为真（无论 $S$ 取何值）。因此，由前提1)和2)可以推出3)。

---

## 真值表

### 2019-2020
画出命题公式 $(P ↔ R) ∧ (¬Q → (P ∨ R))$ 的真值表

> [!NOTE] 定义1-4.1（真值表）
> 在命题公式中，对于分量指派真值的各种可能组合，就确定了这个命题公式的各种真值情况，把它汇列成表，就是命题公式的真值表。
>
> 一般地，$n$ 个命题变元组成的命题公式共有 $2^n$ 种真值情况。

> [!NOTE] 定义1-2.5（双条件）
> $P \rightleftharpoons Q$ 当 $P$ 和 $Q$ 真值相同时为 $T$，否则为 $F$。

> [!NOTE] 定义1-2.4（条件）
> $P \rightarrow Q$ 当且仅当 $P$ 为 $T$ 且 $Q$ 为 $F$ 时为 $F$，否则为 $T$。

> [!NOTE] 定义1-2.1（否定）
> $\neg P$ 与 $P$ 真值相反。

### 证明：

公式 $(P \leftrightarrow R) \wedge (\neg Q \rightarrow (P \lor R))$ 的真值表如下：

| $P$ | $Q$ | $R$ | $P \leftrightarrow R$ | $\neg Q$ | $P \lor R$ | $\neg Q \rightarrow (P \lor R)$ | $(P \leftrightarrow R) \wedge (\neg Q \rightarrow (P \lor R))$ |
|:---:|:---:|:---:|:---------------------:|:--------:|:----------:|:-----------------------------:|:-----------------------------------------------------------:|
| T | T | T | T | F | T | T | T |
| T | T | F | F | F | T | T | F |
| T | F | T | T | T | T | T | T |
| T | F | F | F | T | T | T | F |
| F | T | T | F | F | T | T | F |
| F | T | F | T | F | F | T | T |
| F | F | T | F | T | T | T | F |
| F | F | F | T | T | F | F | F |

该公式在 $P,Q,R$ 的 $2^3 = 8$ 种指派中有3种情况为真。

---

### 2022-2023 期中
试利用真值表证明德·摩根律。

> [!NOTE] 定义1-4.1（真值表）
> 在命题公式中，对于分量指派真值的各种可能组合，就确定了这个命题公式的各种真值情况，把它汇列成表，就是命题公式的真值表。

> [!NOTE] 定义1-4.2（等价 / 逻辑相等）
> 给定两个命题公式 $A$ 和 $B$，若给所有原子变元的任一组真值指派，$A$ 和 $B$ 的真值都相同，则称 $A$ 和 $B$ 是**等价的**，记作 $A \Leftrightarrow B$。

> [!NOTE] 德·摩根律
> $$
> \neg(P \lor Q) \Leftrightarrow \neg P \land \neg Q,\qquad \neg(P \land Q) \Leftrightarrow \neg P \lor \neg Q
> $$

### 证明：

**证明 $\neg(P \lor Q) \Leftrightarrow \neg P \land \neg Q$：**

| $P$ | $Q$ | $P \lor Q$ | $\neg(P \lor Q)$ | $\neg P$ | $\neg Q$ | $\neg P \land \neg Q$ |
|:---:|:---:|:---------:|:--------------:|:--------:|:--------:|:-------------------:|
| T | T | T | F | F | F | F |
| T | F | T | F | F | T | F |
| F | T | T | F | T | F | F |
| F | F | F | T | T | T | T |

$\neg(P \lor Q)$ 与 $\neg P \land \neg Q$ 在各指派下真值完全相同，故 $\neg(P \lor Q) \Leftrightarrow \neg P \land \neg Q$ 成立。

**证明 $\neg(P \land Q) \Leftrightarrow \neg P \lor \neg Q$：**

| $P$ | $Q$ | $P \land Q$ | $\neg(P \land Q)$ | $\neg P$ | $\neg Q$ | $\neg P \lor \neg Q$ |
|:---:|:---:|:-----------:|:----------------:|:--------:|:--------:|:------------------:|
| T | T | T | F | F | F | F |
| T | F | F | T | F | T | T |
| F | T | F | T | T | F | T |
| F | F | F | T | T | T | T |

$\neg(P \land Q)$ 与 $\neg P \lor \neg Q$ 在各指派下真值完全相同，故 $\neg(P \land Q) \Leftrightarrow \neg P \lor \neg Q$ 成立。

综上，德·摩根律得证。

---

### 2024-2025
写出 $\neg (\neg P \to (Q \lor R))$ 的真值表，并写出这个命题公式的主析取范式  

> [!NOTE] 定义1-4.1（真值表）
> 在命题公式中，对于分量指派真值的各种可能组合，就确定了这个命题公式的各种真值情况，把它汇列成表，就是命题公式的真值表。

> [!NOTE] 定义1-7.5（主析取范式）
> 对于给定的命题公式，如果有一个等价公式，它仅由小项的析取所组成，则该等价式称作原式的**主析取范式**。

> [!NOTE] 定理1-7.3（主析取范式定理）
> 在真值表中，一个公式的真值为 $T$ 的指派所对应的小项的析取，即为此公式的主析取范式。

### 证明：

**真值表：**
$\neg (\neg P \to (Q \lor R))$ 的真值表如下：

| $P$ | $Q$ | $R$ | $\neg P$ | $Q \lor R$ | $\neg P \to (Q \lor R)$ | $\neg (\neg P \to (Q \lor R))$ |
|:---:|:---:|:---:|:--------:|:----------:|:----------------------:|:----------------------------:|
| T | T | T | F | T | T | F |
| T | T | F | F | T | T | F |
| T | F | T | F | T | T | F |
| T | F | F | F | F | T | F |
| F | T | T | T | T | T | F |
| F | T | F | T | T | T | F |
| F | F | T | T | T | T | F |
| F | F | F | T | F | F | T |

观察发现，只有当 $P = F, Q = F, R = F$ 时，公式真值为 $T$。

**主析取范式：**
公式仅在 $P=0, Q=0, R=0$ 时真值为 $T$，对应小项为 $\neg P \wedge \neg Q \wedge \neg R$。由定理1-7.3，主析取范式为：
$$
\neg (\neg P \to (Q \lor R)) \Leftrightarrow \neg P \wedge \neg Q \wedge \neg R
$$

（等价地，也可以直接化简：由 E17 $\neg(P \rightarrow Q) \Leftrightarrow P \land \neg Q$，得
$\neg(\neg P \rightarrow (Q \lor R)) \Leftrightarrow \neg P \land \neg(Q \lor R) \Leftrightarrow \neg P \land \neg Q \land \neg R$。）

---

## 主析取范式

### 2019-2020
求命题公式 $P ∨ (¬P → (Q ∨ (¬Q → R)))$ 的主析取范式 

> [!NOTE] 定义1-7.5（主析取范式）
> 对于给定的命题公式，如果有一个等价公式，它仅由小项的析取所组成，则该等价式称作原式的**主析取范式**。

> [!NOTE] 定理1-7.3（主析取范式定理）
> 在真值表中，一个公式的真值为 $T$ 的指派所对应的小项的析取，即为此公式的主析取范式。

> [!NOTE] 基本等价式
> 对合律：$\neg\neg P \Leftrightarrow P$；E16：$P \rightarrow Q \Leftrightarrow \neg P \lor Q$；幂等律：$P \lor P \Leftrightarrow P$。

### 证明：

**方法一：等价公式法**

$$
\begin{aligned}
P \lor (\neg P \rightarrow (Q \lor (\neg Q \rightarrow R)))
&\Leftrightarrow P \lor (\neg P \rightarrow (Q \lor (\neg\neg Q \lor R))) \quad (\text{E16: } \neg Q \rightarrow R \Leftrightarrow Q \lor R) \\
&\Leftrightarrow P \lor (\neg P \rightarrow (Q \lor Q \lor R)) \\
&\Leftrightarrow P \lor (\neg P \rightarrow (Q \lor R)) \quad (\text{幂等律}) \\
&\Leftrightarrow P \lor (\neg\neg P \lor (Q \lor R)) \quad (\text{E16: } \neg P \rightarrow (Q \lor R) \Leftrightarrow \neg\neg P \lor (Q \lor R)) \\
&\Leftrightarrow P \lor (P \lor Q \lor R) \quad (\text{对合律}) \\
&\Leftrightarrow P \lor Q \lor R \quad (\text{幂等律})
\end{aligned}
$$

所以原式等价于 $P \lor Q \lor R$。

**方法二：真值表法**

$P \lor Q \lor R$ 的真值表：

| $P$ | $Q$ | $R$ | $P \lor Q \lor R$ |
|:---:|:---:|:---:|:---------------:|
| T | T | T | T |
| T | T | F | T |
| T | F | T | T |
| T | F | F | T |
| F | T | T | T |
| F | T | F | T |
| F | F | T | T |
| F | F | F | F |

公式为真当且仅当 $P,Q,R$ 不全为 $F$。对应的小项为除 $\neg P \land \neg Q \land \neg R$ 外的所有小项。

**主析取范式：**
$$
\begin{aligned}
P \lor Q \lor R \Leftrightarrow &(\neg P \land \neg Q \land R) \lor (\neg P \land Q \land \neg R) \lor (\neg P \land Q \land R) \\
&\lor (P \land \neg Q \land \neg R) \lor (P \land \neg Q \land R) \lor (P \land Q \land \neg R) \lor (P \land Q \land R)
\end{aligned}
$$

---

### 2022-2023 期中（8分）
求 $\neg(\neg p \wedge q) \rightarrow r$ 的主析取范式。

> [!NOTE] 定义1-7.5（主析取范式）
> 对于给定的命题公式，如果有一个等价公式，它仅由小项的析取所组成，则该等价式称作原式的**主析取范式**。

> [!NOTE] 定理1-7.3（主析取范式定理）
> 在真值表中，一个公式的真值为 $T$ 的指派所对应的小项的析取，即为此公式的主析取范式。

### 证明：

**方法一：等价公式法**

$$
\begin{aligned}
\neg(\neg p \wedge q) \rightarrow r
&\Leftrightarrow (\neg\neg p \lor \neg q) \rightarrow r \quad (\text{德·摩根律}) \\
&\Leftrightarrow (p \lor \neg q) \rightarrow r \quad (\text{对合律}) \\
&\Leftrightarrow \neg(p \lor \neg q) \lor r \quad (\text{E16}) \\
&\Leftrightarrow (\neg p \land \neg\neg q) \lor r \quad (\text{德·摩根律}) \\
&\Leftrightarrow (\neg p \land q) \lor r \quad (\text{对合律})
\end{aligned}
$$

所以原式等价于 $(\neg p \land q) \lor r$。

**方法二：真值表法**

| $p$ | $q$ | $r$ | $\neg p \land q$ | $(\neg p \land q) \lor r$ |
|:---:|:---:|:---:|:---------------:|:-----------------------:|
| T | T | T | F | T |
| T | T | F | F | F |
| T | F | T | F | T |
| T | F | F | F | F |
| F | T | T | T | T |
| F | T | F | T | T |
| F | F | T | F | T |
| F | F | F | F | F |

公式为真的指派对应的小项：$p,q,r$ 取值为 $111, 101, 011, 010, 001$（二进制编码）。

**主析取范式：**
$$
\begin{aligned}
\neg(\neg p \wedge q) \rightarrow r
\Leftrightarrow &(p \land q \land r) \lor (p \land \neg q \land r) \lor (\neg p \land q \land r) \\
&\lor (\neg p \land q \land \neg r) \lor (\neg p \land \neg q \land r)
\end{aligned}
$$

---

### 2024-2025
写出 $\neg (\neg P \to (Q \lor R))$ 的真值表，并写出这个命题公式的主析取范式  

（同真值表 2024-2025，此处不再重复。参见"真值表 2024-2025"）

---

## 前束范式

### 2019-2020
求谓词公式 $(\exists x)A(x) \rightarrow (\forall x)B(x)$ 的前束范式。

> [!NOTE] 定义2-6.1（前束范式）
> 一个公式，如果量词均在全式的开头，它们的作用域延伸到整个公式的末尾，则该公式叫做**前束范式**。可记为 $(\square v_1)(\square v_2)\dots(\square v_n)A$，其中 $\square$ 可能是 $\forall$ 或 $\exists$，$A$ 是没有量词的谓词公式。

> [!NOTE] 定理2-6.1（前束范式存在定理）
> 任意一个谓词公式，均和一个前束范式等价。

> [!NOTE] 量词转化律与量词作用域的扩张收缩
> $$
> \begin{aligned}
> \neg(\forall x)P(x) &\Leftrightarrow (\exists x)\neg P(x) \\
> \neg(\exists x)P(x) &\Leftrightarrow (\forall x)\neg P(x) \\
> ((\exists x)A(x) \rightarrow B) &\Leftrightarrow (\forall x)(A(x) \rightarrow B) \\
> ((\forall x)A(x) \rightarrow B) &\Leftrightarrow (\exists x)(A(x) \rightarrow B)
> \end{aligned}
> $$

### 证明：

注意 $(\exists x)A(x)$ 和 $(\forall x)B(x)$ 中的 $x$ 分别为不同量词的指导变元，需要先将其中一个变元换名以避免混淆。

$$
\begin{aligned}
(\exists x)A(x) \rightarrow (\forall x)B(x)
&\Leftrightarrow (\exists x)A(x) \rightarrow (\forall y)B(y) \quad (\text{约束变元换名：} x \to y) \\
&\Leftrightarrow \neg(\exists x)A(x) \lor (\forall y)B(y) \quad (\text{E16: } P \rightarrow Q \Leftrightarrow \neg P \lor Q) \\
&\Leftrightarrow (\forall x)\neg A(x) \lor (\forall y)B(y) \quad (\text{量词转化律}) \\
&\Leftrightarrow \forall x\forall y(\neg A(x) \lor B(y)) \quad (\text{量词作用域扩张}) \\
&\Leftrightarrow (\forall x)(\forall y)(\neg A(x) \lor B(y))
\end{aligned}
$$

其中 $\neg A(x) \lor B(y)$ 是无量词的谓词公式。因此原公式的前束范式为：

$$
(\forall x)(\forall y)(\neg A(x) \lor B(y))
$$

---

### 2022-2023 期中（8分）
把下列各式化为前束范式：

* **(1)** $(\exists x)(\neg ((\exists y)P(x, y)) \rightarrow ((\exists z)Q(z) \rightarrow R(x)))$
* **(2)** $((\forall x)P(x) \vee (\exists y)Q(y)) \rightarrow (\forall x)R(x)$

> [!NOTE] 定义2-6.1（前束范式）
> 一个公式，如果量词均在全式的开头，它们的作用域延伸到整个公式的末尾，则该公式叫做**前束范式**。

> [!NOTE] 定理2-6.1（前束范式存在定理）
> 任意一个谓词公式，均和一个前束范式等价。

> [!NOTE] 常用等价式
> $$
> \begin{aligned}
> \neg(\forall x)P(x) &\Leftrightarrow (\exists x)\neg P(x) \\
> \neg(\exists x)P(x) &\Leftrightarrow (\forall x)\neg P(x) \\
> ((\exists x)A(x) \rightarrow B) &\Leftrightarrow (\forall x)(A(x) \rightarrow B) \\
> A \rightarrow (\forall x)B(x) &\Leftrightarrow (\forall x)(A \rightarrow B(x)) \\
> A \rightarrow (\exists x)B(x) &\Leftrightarrow (\exists x)(A \rightarrow B(x))
> \end{aligned}
> $$

### 证明：

**(1)** $(\exists x)(\neg ((\exists y)P(x, y)) \rightarrow ((\exists z)Q(z) \rightarrow R(x)))$

先消去条件联结词：

$$
\begin{aligned}
&\neg ((\exists y)P(x, y)) \rightarrow ((\exists z)Q(z) \rightarrow R(x)) \\
&\Leftrightarrow \neg ((\exists y)P(x, y)) \rightarrow (\neg(\exists z)Q(z) \lor R(x)) \quad (\text{E16}) \\
&\Leftrightarrow (\exists y)P(x, y) \lor (\neg(\exists z)Q(z) \lor R(x)) \quad (\text{E16}) \\
&\Leftrightarrow (\exists y)P(x, y) \lor ((\forall z)\neg Q(z) \lor R(x)) \quad (\text{量词转化律})
\end{aligned}
$$

带回原式（最外层有 $(\exists x)$）：

$$
\begin{aligned}
&(\exists x)\big[(\exists y)P(x, y) \lor (\forall z)\neg Q(z) \lor R(x)\big] \\
&\Leftrightarrow (\exists x)(\exists y)(\forall z)\big[P(x, y) \lor \neg Q(z) \lor R(x)\big] \quad (\text{量词作用域扩张})
\end{aligned}
$$

因此前束范式为：
$$
(\exists x)(\exists y)(\forall z)(P(x, y) \lor \neg Q(z) \lor R(x))
$$

**(2)** $((\forall x)P(x) \vee (\exists y)Q(y)) \rightarrow (\forall x)R(x)$

换名以避免混淆（将 $(\forall x)R(x)$ 中的 $x$ 换为 $z$）：

$$
\begin{aligned}
&((\forall x)P(x) \vee (\exists y)Q(y)) \rightarrow (\forall z)R(z) \\
&\Leftrightarrow \neg((\forall x)P(x) \vee (\exists y)Q(y)) \lor (\forall z)R(z) \quad (\text{E16}) \\
&\Leftrightarrow (\neg(\forall x)P(x) \land \neg(\exists y)Q(y)) \lor (\forall z)R(z) \quad (\text{德·摩根律}) \\
&\Leftrightarrow ((\exists x)\neg P(x) \land (\forall y)\neg Q(y)) \lor (\forall z)R(z) \quad (\text{量词转化律}) \\
&\Leftrightarrow (\exists x)(\forall y)(\forall z)\big[(\neg P(x) \land \neg Q(y)) \lor R(z)\big] \quad (\text{量词作用域扩张})
\end{aligned}
$$

也可进一步写为：

$$
(\exists x)(\forall y)(\forall z)((\neg P(x) \lor R(z)) \land (\neg Q(y) \lor R(z))) \quad (\text{分配律})
$$

因此前束范式为：
$$
(\exists x)(\forall y)(\forall z)((\neg P(x) \lor R(z)) \land (\neg Q(y) \lor R(z)))
$$

---

## 逻辑蕴含与推理证明

### 2022-2023 期中（6分）
> 注：原卷第4页缺失，证明题仅余第1、2、6、7小题

证明：$\neg(\neg p \rightarrow q)$ 逻辑蕴含 $\neg p$。

> [!NOTE] 定义1-5.3（蕴含）
> 当且仅当 $P \rightarrow Q$ 是一个重言式时，称"$P$ 蕴含 $Q$"，并记作 $P \Rightarrow Q$。

> [!NOTE] 基本等价式 E17
> $\neg(P \rightarrow Q) \Leftrightarrow P \land \neg Q$

### 证明：

要证明 $\neg(\neg p \rightarrow q) \Rightarrow \neg p$，即证 $\neg(\neg p \rightarrow q) \rightarrow \neg p$ 为重言式。

**方法一：等价化简**

由 E17，$\neg(\neg p \rightarrow q) \Leftrightarrow \neg p \land \neg q$，即：
$$
\neg(\neg p \rightarrow q) \Leftrightarrow \neg p \land \neg q
$$

根据 I1（$P \land Q \Rightarrow P$），有：
$$
\neg p \land \neg q \Rightarrow \neg p
$$

因此 $\neg(\neg p \rightarrow q) \Rightarrow \neg p$ 成立。

**方法二：真值表法**

| $p$ | $q$ | $\neg p$ | $\neg p \rightarrow q$ | $\neg(\neg p \rightarrow q)$ | $\neg(\neg p \rightarrow q) \rightarrow \neg p$ |
|:---:|:---:|:--------:|:--------------------:|:--------------------------:|:--------------------------------------------:|
| T | T | F | T | F | T |
| T | F | F | T | F | T |
| F | T | T | T | F | T |
| F | F | T | F | T | T |

最后一列全为 $T$，故 $\neg(\neg p \rightarrow q) \rightarrow \neg p$ 是重言式，即 $\neg(\neg p \rightarrow q) \Rightarrow \neg p$。

---

### 2022-2023 期中（6分）
证明：$\neg(P \rightarrow Q) \rightarrow \neg(R \vee S), (Q \rightarrow P) \vee \neg R, R \Rightarrow P \leftrightarrow Q$。

> [!NOTE] 定义1-8.1（有效结论）
> 设 $H_1, H_2, \dots, H_n, C$ 是命题公式，当且仅当 $H_1 \wedge H_2 \wedge \dots \wedge H_n \Rightarrow C$，称 $C$ 是一组前提 $H_1, H_2, \dots, H_n$ 的有效结论。

> [!NOTE] 常用推理蕴含式
> | 编号 | 蕴含式 |
> |:---:|:------:|
> | I11 | $P, P \rightarrow Q \Rightarrow Q$ |
> | I12 | $\neg Q, P \rightarrow Q \Rightarrow \neg P$ |
> | I10 | $\neg P, P \lor Q \Rightarrow Q$ |
> | E17 | $\neg(P \rightarrow Q) \Leftrightarrow P \land \neg Q$ |
> | E20 | $P \rightleftharpoons Q \Leftrightarrow (P \rightarrow Q) \land (Q \rightarrow P)$ |

### 证明：

前提：
1. $\neg(P \rightarrow Q) \rightarrow \neg(R \vee S)$
2. $(Q \rightarrow P) \vee \neg R$
3. $R$

结论：$P \leftrightarrow Q$

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $R$ | P规则（前提3） |
| ② | $(Q \rightarrow P) \vee \neg R$ | P规则（前提2） |
| ③ | $Q \rightarrow P$ | ①,②, I10（析取三段论：$R \Rightarrow \neg\neg R$，$\neg\neg R$ 与 $(Q \rightarrow P) \vee \neg R$ 推出 $Q \rightarrow P$） |
| ④ | $\neg(P \rightarrow Q) \rightarrow \neg(R \vee S)$ | P规则（前提1） |
| ⑤ | $R \vee S$ | ①, I3（$P \Rightarrow P \lor Q$） |
| ⑥ | $\neg\neg(R \vee S)$ | ⑤, E1（对合律） |
| ⑦ | $\neg\neg(P \rightarrow Q)$ | ④,⑥, I12（拒取式） |
| ⑧ | $P \rightarrow Q$ | ⑦, E1（对合律） |
| ⑨ | $(P \rightarrow Q) \land (Q \rightarrow P)$ | ⑧,③, I9（合取引入） |
| ⑩ | $P \leftrightarrow Q$ | ⑨, E20 |

故结论成立。

---

### 2022-2023 期中
证明：$(P \vee Q) \wedge (Q \vee R) \wedge (P \vee R) \Longleftrightarrow (P \wedge Q) \vee (Q \wedge R) \vee (P \wedge R)$。

> [!NOTE] 定理1-4.1（等价置换定理）
> 设 $X$ 是合式公式 $A$ 的子公式，若 $X \Leftrightarrow Y$，则将 $A$ 中的 $X$ 用 $Y$ 置换后所得公式 $B$ 与 $A$ 等价。

> [!NOTE] 基本等价式
> 分配律：$P \lor (Q \land R) \Leftrightarrow (P \lor Q) \land (P \lor R)$；$P \land (Q \lor R) \Leftrightarrow (P \land Q) \lor (P \land R)$。
> 交换律、结合律、幂等律、吸收律。

### 证明：

**方法一：等价公式法**

从左到右展开：

$$
\begin{aligned}
&(P \vee Q) \wedge (Q \vee R) \wedge (P \vee R) \\
&\Leftrightarrow [(P \vee Q) \wedge (Q \vee R)] \wedge (P \vee R) \\
&\Leftrightarrow [Q \vee (P \wedge R)] \wedge (P \vee R) \quad (\text{分配律: } (P \vee Q) \wedge (Q \vee R) \Leftrightarrow Q \vee (P \wedge R)) \\
&\Leftrightarrow (Q \wedge (P \vee R)) \vee ((P \wedge R) \wedge (P \vee R)) \quad (\text{分配律: } (A \vee B) \wedge C \Leftrightarrow (A \wedge C) \vee (B \wedge C))\\
&\Leftrightarrow (Q \wedge P) \vee (Q \wedge R) \vee (P \wedge R \wedge P) \vee (P \wedge R \wedge R) \quad (\text{分配律展开}) \\
&\Leftrightarrow (P \wedge Q) \vee (Q \wedge R) \vee (P \wedge R) \vee (P \wedge R) \quad (\text{交换律、幂等律}) \\
&\Leftrightarrow (P \wedge Q) \vee (Q \wedge R) \vee (P \wedge R) \quad (\text{幂等律})
\end{aligned}
$$

**方法二：真值表法**

列出 $P,Q,R$ 的所有 8 种真值指派，比较左右两式。两式在每种指派下真值相同，故等价。

---

### 2022-2023 期中
用 CP 规则证明：

$$(\exists x)A(x) \rightarrow (\forall x)B(x) \Rightarrow (\forall x)(A(x) \rightarrow B(x))$$

> [!NOTE] CP规则
> 若要证 $H_1 \wedge H_2 \wedge \dots \wedge H_m \Rightarrow (R \rightarrow C)$，可将 $R$ 作为附加前提，若能证明 $(H_1 \wedge H_2 \wedge \dots \wedge H_m \wedge R) \Rightarrow C$，则原结论成立。

> [!NOTE] 存在指定规则（ES）
> $$
> \frac{(\exists x)P(x)}{\therefore P(c)}
> $$
> 其中 $c$ 是论域中的某些客体，且 $c$ 不是任意的。

> [!NOTE] 全称推广规则（UG）
> $$
> \frac{P(x)}{\therefore (\forall x)P(x)}
> $$

> [!NOTE] 表1-8.3 常用蕴含式 I11
> $P, P \rightarrow Q \Rightarrow Q$

### 证明：

要证明 $(\exists x)A(x) \rightarrow (\forall x)B(x) \Rightarrow (\forall x)(A(x) \rightarrow B(x))$。

由于结论是 $(\forall x)(A(x) \rightarrow B(x))$，使用 CP 规则：对任意个体 $c$，附加前提 $A(c)$，若能推出 $B(c)$，则 $A(c) \rightarrow B(c)$ 对任意 $c$ 成立，再由 UG 得 $(\forall x)(A(x) \rightarrow B(x))$。

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $(\exists x)A(x) \rightarrow (\forall x)B(x)$ | P规则（前提） |
| ② | $A(c)$ | 附加前提（CP规则） |
| ③ | $(\exists x)A(x)$ | ②, EG（存在推广） |
| ④ | $(\forall x)B(x)$ | ③,①, I11（假言推理） |
| ⑤ | $B(c)$ | ④, US（全称指定） |
| ⑥ | $A(c) \rightarrow B(c)$ | ②→⑤, CP规则 |
| ⑦ | $(\forall x)(A(x) \rightarrow B(x))$ | ⑥, UG（全称推广） |

故原蕴含式成立。

---

### 2024-2025
使用直接证法或间接证法证明下面式子成立  

$$
\forall x (A (x) \rightarrow B (x)), \neg \forall x (A (x) \rightarrow C (x)) \implies \exists x B (x)
$$

> [!NOTE] 定义1-8.1（有效结论）
> 当且仅当 $H_1 \wedge H_2 \wedge \dots \wedge H_n \Rightarrow C$，称 $C$ 是一组前提 $H_1, H_2, \dots, H_n$ 的有效结论。

> [!NOTE] 量词转化律
> $\neg(\forall x)P(x) \Leftrightarrow (\exists x)\neg P(x)$

> [!NOTE] US规则（全称指定）
> $\frac{(\forall x)P(x)}{\therefore P(c)}$

> [!NOTE] ES规则（存在指定）
> $\frac{(\exists x)P(x)}{\therefore P(c)}$，$c$ 为论域中某些客体。

### 证明：

前提：
1. $\forall x(A(x) \rightarrow B(x))$
2. $\neg \forall x(A(x) \rightarrow C(x))$

结论：$\exists x B(x)$

| 步骤 | 公式 | 依据 |
|:---:|:----:|:----:|
| ① | $\neg \forall x(A(x) \rightarrow C(x))$ | P规则（前提2） |
| ② | $\exists x \neg(A(x) \rightarrow C(x))$ | ①, 量词转化律 |
| ③ | $\neg(A(c) \rightarrow C(c))$ | ②, ES（存在指定，设该客体为 $c$） |
| ④ | $A(c) \land \neg C(c)$ | ③, E17（$\neg(P \rightarrow Q) \Leftrightarrow P \land \neg Q$） |
| ⑤ | $A(c)$ | ④, I1（$P \land Q \Rightarrow P$） |
| ⑥ | $\forall x(A(x) \rightarrow B(x))$ | P规则（前提1） |
| ⑦ | $A(c) \rightarrow B(c)$ | ⑥, US（全称指定） |
| ⑧ | $B(c)$ | ⑤,⑦, I11（假言推理） |
| ⑨ | $\exists x B(x)$ | ⑧, EG（存在推广） |

故 $\exists x B(x)$ 成立。

---

### 2024-2025
证明 $P \leftrightarrow Q, Q \rightarrow \neg S, \neg P$ 不逻辑蕴含 $S$   

> [!NOTE] 定义1-8.1（有效结论）
> $C$ 是一组前提 $H_1, H_2, \dots, H_n$ 的有效结论当且仅当 $H_1 \wedge H_2 \wedge \dots \wedge H_n \Rightarrow C$。

> [!NOTE] 定义1-5.1（重言式）
> 若无论对分量作怎样的指派，公式的真值永为 $T$，则称该公式为**重言式**。

> [!NOTE] 定义1-2.5（双条件）
> $P \rightleftharpoons Q$ 当 $P$ 和 $Q$ 真值相同时为 $T$，否则为 $F$。

### 证明：

要证明 $P \leftrightarrow Q, Q \rightarrow \neg S, \neg P$ 不逻辑蕴含 $S$，即证明存在一组真值指派使得前提全为真而 $S$ 为假。

前提：
1. $P \leftrightarrow Q$
2. $Q \rightarrow \neg S$
3. $\neg P$

**构造反例：**

取指派 $P = F, Q = F, S = F$，验证各前提：
- 前提1 $P \leftrightarrow Q$：$F \leftrightarrow F = T$ ✓
- 前提2 $Q \rightarrow \neg S$：$F \rightarrow \neg F = F \rightarrow T = T$ ✓
- 前提3 $\neg P$：$\neg F = T$ ✓

所有前提均真，而结论 $S = F$。故 $H_1 \wedge H_2 \wedge H_3 \not\Rightarrow S$，即 $S$ 不是有效结论。

---

## 变量分类（自由变元与约束变元）

### 2022-2023 期中（5分）
将下面式子规范化并指出其中的自由变元和约束变元并说明理由。

$$\forall x ((A(x) \rightarrow B(y, x)) \wedge \exists z \, C(y, z)) \rightarrow D(x)$$

> [!NOTE] 约束变元与自由变元
> - **指导变元**（作用变元）：量词 $\forall$ 或 $\exists$ 后面所跟的变元。
> - **作用域**（辖域）：量词所作用的公式部分。
> - **约束变元**：在量词作用域中出现的受该量词指导变元约束的变元。
> - **自由变元**：除去约束变元以外所出现的变元。

> [!NOTE] 约束变元的换名规则
> 1. 对于约束变元可以换名，其更改的变元名称范围是量词中的指导变元，以及该量词作用域中所出现的该变元，在公式的其余部分不变。
> 2. 换名时一定要更改为作用域中没有出现的变元名称。

### 证明：

**规范化（约束变元换名）：**

原公式中，量词 $\forall x$ 的作用域为 $(A(x) \rightarrow B(y, x)) \wedge \exists z \, C(y, z)$，该作用域内的 $x$ 受 $\forall x$ 约束。而 $D(x)$ 中的 $x$ 不在 $\forall x$ 的作用域内，是自由变元。为避免混淆，将 $\forall x$ 的约束变元 $x$ 换名为 $u$：

$$
\forall u ((A(u) \rightarrow B(y, u)) \wedge \exists z \, C(y, z)) \rightarrow D(x)
$$

量词 $\exists z$ 的作用域为 $C(y, z)$，其中的 $z$ 受 $\exists z$ 约束。

**分析自由变元与约束变元：**

| 变元 | 出现位置 | 分类 | 理由 |
|:---:|:--------:|:----:|:----:|
| $x$ | $D(x)$ 中 | **自由变元** | 不受任何量词约束 |
| $y$ | $B(y, u)$ 和 $C(y, z)$ 中 | **自由变元** | 不受任何量词约束 |
| $u$ | 在 $\forall u$ 作用域内的 $A(u)$ 和 $B(y, u)$ 中 | **约束变元** | 受全称量词 $\forall u$ 约束 |
| $z$ | 在 $\exists z$ 作用域内的 $C(y, z)$ 中 | **约束变元** | 受存在量词 $\exists z$ 约束 |

**结论：** 公式中的自由变元为 $x$ 和 $y$；约束变元为 $u$（原 $x$）和 $z$，分别受 $\forall u$ 和 $\exists z$ 约束。

---

## 命题公式构造

### 2022-2023 期末（5分）
设命题公式 $A$ 包含三个命题变元 $p, q, r$。在两个真值指派 $p=0, q=1, r=1$ 和 $p=1, q=0, r=0$ 下，公式 $A$ 的真值为 $1$；在其余的真值指派下，$A$ 的真值都是 $0$。请写出公式 $A$ 的具体形式。要求 $A$ 中仅含联结词 $\neg$ 和 $\rightarrow$。

> [!NOTE] 定义1-7.4（小项 / 布尔合取）
> $n$ 个命题变元的合取式，称作**布尔合取**或**小项**（minterm），其中每个变元与它的否定不能同时存在，但两者必须出现且仅出现一次。

> [!NOTE] 定义1-7.5（主析取范式）
> 对于给定的命题公式，如果有一个等价公式，它仅由小项的析取所组成，则该等价式称作原式的**主析取范式**。

> [!NOTE] 定理1-7.3（主析取范式定理）
> 在真值表中，一个公式的真值为 $T$ 的指派所对应的小项的析取，即为此公式的主析取范式。

> [!NOTE] 基本等价式 E16 与 E20
> E16：$P \rightarrow Q \Leftrightarrow \neg P \lor Q$
> E20：$P \rightleftharpoons Q \Leftrightarrow (P \rightarrow Q) \land (Q \rightarrow P)$

### 证明：

**步骤1：求主析取范式**

公式 $A$ 在以下两个指派下真值为 $1$：

1. $p=0, q=1, r=1$：对应小项 $\neg p \land q \land r$
2. $p=1, q=0, r=0$：对应小项 $p \land \neg q \land \neg r$

其余 6 种指派下真值均为 $0$。

由定理1-7.3，主析取范式为：
$$
A \Leftrightarrow (\neg p \land q \land r) \lor (p \land \neg q \land \neg r)
$$

**步骤2：转化为仅含 $\neg$ 和 $\rightarrow$ 的形式**

利用等价式 $P \lor Q \Leftrightarrow \neg P \rightarrow Q$ 和 $P \land Q \Leftrightarrow \neg(P \rightarrow \neg Q)$：

$$
\begin{aligned}
A &\Leftrightarrow (\neg p \land q \land r) \lor (p \land \neg q \land \neg r) \\
&\Leftrightarrow \neg(\neg p \land q \land r) \rightarrow (p \land \neg q \land \neg r) \quad (\text{将 } \lor \text{ 转为 } \rightarrow) \\
&\Leftrightarrow \neg(\neg p \land (q \land r)) \rightarrow (p \land (\neg q \land \neg r))
\end{aligned}
$$

分别处理合取：
- $q \land r \Leftrightarrow \neg(q \rightarrow \neg r)$
- $\neg p \land (q \land r) \Leftrightarrow \neg(p \lor \neg(q \land r)) \Leftrightarrow \neg(p \rightarrow (q \land r))$，逐步化简

另一种更简洁的构造方式：
已知 $A \lor B \Leftrightarrow \neg A \rightarrow B$，且 $A \land B \Leftrightarrow \neg(A \rightarrow \neg B)$。

$$
\begin{aligned}
\neg p \land q \land r &\Leftrightarrow \neg(\neg p \rightarrow \neg(q \land r)) \\
&\Leftrightarrow \neg(\neg p \rightarrow \neg(\neg(q \rightarrow \neg r))) \\
&\Leftrightarrow \neg(\neg p \rightarrow (q \rightarrow \neg r))
\end{aligned}
$$

同理：
$$
p \land \neg q \land \neg r \Leftrightarrow \neg(p \rightarrow \neg(\neg q \land \neg r)) \Leftrightarrow \neg(p \rightarrow (\neg q \rightarrow r))
$$

因此：
$$
A \Leftrightarrow \neg(\neg(\neg p \rightarrow (q \rightarrow \neg r))) \rightarrow \neg(p \rightarrow (\neg q \rightarrow r))
$$

进一步利用对合律 $\neg\neg A \Leftrightarrow A$ 化简：
$$
A \Leftrightarrow (\neg p \rightarrow (q \rightarrow \neg r)) \rightarrow \neg(p \rightarrow (\neg q \rightarrow r))
$$

这就是仅含 $\neg$ 和 $\rightarrow$ 的 $A$ 的具体形式。
