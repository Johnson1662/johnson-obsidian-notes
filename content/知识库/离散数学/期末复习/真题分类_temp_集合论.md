
# 集合论

## 关系复合

### 2019-2020
令 $R = \{\langle 1,2 \rangle, \langle 3,4 \rangle, \langle 2,2 \rangle\}$ 以及 $S = \{\langle 4,2 \rangle, \langle 2,5 \rangle, \langle 3,1 \rangle, \langle 1,3 \rangle\}$，则 $R$ 与 $S$ 的复合关系 $R \circ S$ 为

> [!NOTE] 复合关系
> 设 $R$ 为 $X$ 到 $Y$ 的关系，$S$ 为从 $Y$ 到 $Z$ 的关系，则 $R \circ S$ 称为 $R$ 和 $S$ 的复合关系。$$R \circ S = \{\langle x, z \rangle \mid x \in X \wedge z \in Z \wedge (\exists y) (y \in Y \wedge \langle x, y \rangle \in R \wedge \langle y, z \rangle \in S)\}$$
> （定义3-7.1）

### 解：

按复合关系定义，对 $R$ 中每个序偶 $\langle x, y \rangle$，查找 $S$ 中是否有以 $y$ 为第一个元素的序偶 $\langle y, z \rangle$，若有则 $\langle x, z \rangle$ 属于 $R \circ S$。

- $\langle 1, 2 \rangle \in R$，$S$ 中有 $\langle 2, 5 \rangle$，得 $\langle 1, 5 \rangle$
- $\langle 3, 4 \rangle \in R$，$S$ 中有 $\langle 4, 2 \rangle$，得 $\langle 3, 2 \rangle$
- $\langle 2, 2 \rangle \in R$，$S$ 中有 $\langle 2, 5 \rangle$，得 $\langle 2, 5 \rangle$

因此 $R \circ S = \{\langle 1, 5 \rangle, \langle 3, 2 \rangle, \langle 2, 5 \rangle\}$。

---

## 偏序集与哈斯图

### 2019-2020（8分）
集合 $P = \{x_1, x_2, x_3, x_4, x_5, x_6, x_7\}$ 上的偏序关系如下图所示
![](assets/真题分类/file-20260611184055606.png)
(1) $P$ 的最大、最小、极大、极小元素。
(2) 写出子集 $\{x_5, x_6, x_7\}$ 的上界、下界，子集 $\{x_4, x_5, x_6, x_7\}$ 的上确界及下确界。

> [!NOTE] 偏序关系与偏序集
> 设 $A$ 是一个集合，如果 $A$ 上的一个关系 $R$ 满足自反性、反对称性和传递性，则称 $R$ 是 $A$ 上的一个偏序关系，并把它记为"$\leq$"。序偶 $\langle A, \leq \rangle$ 称作偏序集。
> （定义3-12.1）

> [!NOTE] 极大元与极小元
> 设 $\langle A, \leq \rangle$ 是一个偏序集合，且 $B$ 是 $A$ 的子集，对于 $B$ 中的一个元素 $b$，如果 $B$ 中没有任何元素 $x$，满足 $b \neq x$ 且 $b \leq x$，则称 $b$ 为 $B$ 的极大元。对于 $b \in B$，如果 $B$ 中没有任何元素 $x$，满足 $b \neq x$ 且 $x \leq b$，则称 $b$ 为 $B$ 的极小元。
> （定义3-12.5）

> [!NOTE] 最大元与最小元
> 令 $\langle A, \leq \rangle$ 是一个偏序集，且 $B$ 是 $A$ 的子集，若有某个元素 $b \in B$，对于 $B$ 中每一个元素 $x$ 有 $x \leq b$，则称 $b$ 为 $\langle B, \leq \rangle$ 的最大元。若有某个元素 $b \in B$，对每一个 $x \in B$ 有 $b \leq x$，则称 $b$ 为 $\langle B, \leq \rangle$ 的最小元。
> （定义3-12.6）

> [!NOTE] 上界与下界
> 设 $\langle A, \leq \rangle$ 为一偏序集，对于 $B \subseteq A$，如有 $a \in A$，且对 $B$ 的任意元素 $x$，都满足 $x \leq a$，则称 $a$ 为子集 $B$ 的上界。同样地，对于 $B$ 的任意元素 $x$，都满足 $a \leq x$，则称 $a$ 为 $B$ 的下界。
> （定义3-12.7）

> [!NOTE] 最小上界与最大下界
> 设 $\langle A, \leq \rangle$ 为偏序集且 $B \subseteq A$ 为一子集，$a$ 为 $B$ 的任一上界，若对 $B$ 的所有上界 $y$ 均有 $a \leq y$，则称 $a$ 为 $B$ 的最小上界（上确界）。若 $b$ 为 $B$ 的任一下界，若对 $B$ 的所有下界 $z$，均有 $z \leq b$，则称 $b$ 为 $B$ 的最大下界（下确界）。
> （定义3-12.8）

### 解：

根据哈斯图，偏序关系 $\leq$ 由下至上传递。

(1) **极大元**：没有元素比它大。从图上看，$x_1, x_3$ 不被任何其他元素覆盖，故极大元为 $x_1, x_3$。

**极小元**：没有元素比它小。从图上看，$x_6, x_7$ 不覆盖任何其他元素，故极小元为 $x_6, x_7$。

**最大元**：由于极大元不唯一（$x_1$ 和 $x_3$），故不存在最大元。

**最小元**：由于极小元不唯一（$x_6$ 和 $x_7$），故不存在最小元。

(2) 对于子集 $B_1 = \{x_5, x_6, x_7\}$：
- **上界**：$x_5 \leq x_2 \leq x_1$，$x_5 \leq x_3$；$x_6 \leq x_4 \leq x_2 \leq x_1$，$x_6 \leq x_4 \leq x_3$；$x_7 \leq x_4 \leq x_2 \leq x_1$，$x_7 \leq x_4 \leq x_3$。同时大于等于 $x_5, x_6, x_7$ 的元素为 $x_1$（因 $x_1 \geq x_2 \geq x_5$，$x_1 \geq x_2 \geq x_4 \geq x_6$，$x_1 \geq x_2 \geq x_4 \geq x_7$），故上界为 $\{x_1\}$。
- **下界**：同时小于等于 $x_5, x_6, x_7$ 的元素不存在，故下界为 $\varnothing$。

对于子集 $B_2 = \{x_4, x_5, x_6, x_7\}$：
- **上界**：$x_4 \leq x_2 \leq x_1$，$x_4 \leq x_3$；$x_5 \leq x_2 \leq x_1$，$x_5 \leq x_3$；$x_6 \leq x_4 \leq x_2 \leq x_1$，$x_6 \leq x_4 \leq x_3$；$x_7 \leq x_4 \leq x_2 \leq x_1$，$x_7 \leq x_4 \leq x_3$。故上界为 $\{x_1, x_3\}$。
- **上确界（最小上界）**：$x_1$ 和 $x_3$ 不可比，故上确界不存在。
- **下界**：同时小于等于 $x_4, x_5, x_6, x_7$ 的元素不存在，故下界为 $\varnothing$，下确界也不存在。

---

### 2022-2023 期中（8分）
设集合 $A = \{1, 2, 4, 6, 8, 12\}$，$R$ 为整除关系。

* **(1)** 计算 $\text{COV } A$；
* **(2)** 画出偏序集 $\langle A, R \rangle$ 的哈斯图；
* **(3)** 写出 $A$ 的子集 $B = \{4, 6, 8, 12\}$ 的上界、下界、最小上界、最大下界；
* **(4)** 写出 $A$ 的最大元、最小元、极大元、极小元。

> [!NOTE] 盖住
> 在偏序集合 $\langle A, \leq \rangle$ 中，如果 $x, y \in A$，$x \leq y$，$x \neq y$ 且没有其他元素 $z$ 满足 $x \leq z$，$z \leq y$，则称元素 $y$ 盖住元素 $x$。记 $\operatorname{COV} A = \{\langle x, y \rangle \mid x, y \in A; y \text{盖住} x\}$。
> （定义3-12.2）

> [!NOTE] 偏序关系与偏序集
> 设 $A$ 是一个集合，如果 $A$ 上的一个关系 $R$ 满足自反性、反对称性和传递性，则称 $R$ 是 $A$ 上的一个偏序关系。序偶 $\langle A, \leq \rangle$ 称作偏序集。
> （定义3-12.1）

（极大元、极小元、最大元、最小元、上界、下界、上确界、下确界的定义同上题，此处不再重复引用）

### 解：

(1) 对于 $A = \{1, 2, 4, 6, 8, 12\}$，整除关系 $R$：$aRb \iff a \mid b$。

检查各元素之间的盖住关系（$x$ 被 $y$ 盖住当且仅当 $x \mid y$，$x \neq y$，且不存在 $z$ 使 $x \mid z$ 且 $z \mid y$）：
- $1 \mid 2$，$1 \mid 4$，$1 \mid 6$，$1 \mid 8$，$1 \mid 12$，但 $1 \mid 2 \mid 4$，故 $1$ 不盖住 $4$（有 $2$ 在中间）；同理 $1$ 不盖住 $6, 8, 12$（$2, 4$ 等在中间）。$1$ 盖住谁？只有 $2$ 满足中间无其他元素。
- $2 \mid 4$，$2 \mid 6$，$2 \mid 8$，$2 \mid 12$。$2 \mid 4 \mid 8$，故 $2$ 不盖住 $8$；$2 \mid 4 \mid 12$，故 $2$ 不盖住 $12$。$2$ 盖住 $4$ 和 $6$（因 $2 \mid 4$、$2 \mid 6$ 且中间无其他元素）。
- $4 \mid 8$，$4 \mid 12$。$4 \mid 8$ 中间无其他元素，故 $4$ 盖住 $8$。但 $4 \mid 12$ 有 $4 \mid 6$？$4 \nmid 6$，$4 \mid 12$ 中间没有其他整除关系的元素... 检查：$4 \mid 12$，是否存在 $z \in A-\{4,12\}$ 使 $4 \mid z \mid 12$？$z=6$ 时 $4 \nmid 6$，$z=8$ 时 $8 \nmid 12$，所以 $4$ 盖住 $12$。
- $6 \mid 12$，中间无其他元素，故 $6$ 盖住 $12$。

因此 $\text{COV } A = \{\langle 1, 2 \rangle, \langle 2, 4 \rangle, \langle 2, 6 \rangle, \langle 4, 8 \rangle, \langle 4, 12 \rangle, \langle 6, 12 \rangle\}$。

(2) 哈斯图：
```
        8    12
       |   / |
       4  /  6
       | /   |
       2     |
       |     |
       1     
```
（$4$ 和 $6$ 在同一层，$8$ 和 $12$ 在顶层，$2$ 在 $1$ 之上，$4$ 和 $6$ 在 $2$ 之上，$8$ 在 $4$ 之上，$12$ 在 $4$ 和 $6$ 之上）

(3) $B = \{4, 6, 8, 12\}$：
- **上界**：需要同时大于等于 $4, 6, 8, 12$ 的元素。$4 \mid 12$，$6 \mid 12$，$8 \mid 24$ 但 $24 \notin A$。$12$ 不能大于等于 $8$（$8 \nmid 12$），故上界不存在，为 $\varnothing$。
- **下界**：需要同时小于等于 $4, 6, 8, 12$ 的元素。$1 \mid 4,6,8,12$，$2 \mid 4,6,8,12$。故下界为 $\{1, 2\}$。
- **最小上界**：上界不存在，故无最小上界。
- **最大下界**：下界为 $\{1, 2\}$，$1 \mid 2$，故 $2$ 是最大下界（下确界），为 $2$。

(4) 对于集合 $A$：
- **极大元**：没有比它大的元素。$8$：没有 $x \in A$ 使 $8 \mid x$ 且 $x \neq 8$。$12$：没有 $x \in A$ 使 $12 \mid x$ 且 $x \neq 12$。故极大元为 $8, 12$。
- **极小元**：没有比它小的元素。$1$：没有 $x \in A$ 使 $x \mid 1$ 且 $x \neq 1$。故极小元为 $1$。
- **最大元**：由于极大元不唯一，故不存在最大元。
- **最小元**：极小元唯一为 $1$，且 $1$ 小于等于所有元素，故最小元为 $1$。

---

### 2022-2023 期末（8分）
设集合 $H = \{1, 2, 3, 4\}$ 的幂集上的"子集"关系，且集合 $K = \{\{1, 2\}, \{1, 3\}, \{2, 3\}\}$。画出 $R$ 的哈斯图，并给出集合 $K$ 的极大元、最大元、上界、上确界。

> [!NOTE] 偏序关系与偏序集
> 设 $A$ 是一个集合，如果 $A$ 上的一个关系 $R$ 满足自反性、反对称性和传递性，则称 $R$ 是 $A$ 上的一个偏序关系。序偶 $\langle A, \leq \rangle$ 称作偏序集。
> （定义3-12.1）

> [!NOTE] 幂集
> 给定集合 $A$，由集合 $A$ 的所有子集为元素组成的集合，称为集合 $A$ 的幂集，记为 $\mathcal{P}(A)$。
> （定义3-1.5）

（极大元、最大元、上界、上确界的定义同上，此处不再重复引用）

### 解：

$H = \{1, 2, 3, 4\}$ 的幂集 $\mathcal{P}(H)$ 包含 $2^4 = 16$ 个元素：$\varnothing, \{1\}, \{2\}, \{3\}, \{4\}, \{1,2\}, \{1,3\}, \{1,4\}, \{2,3\}, \{2,4\}, \{3,4\}, \{1,2,3\}, \{1,2,4\}, \{1,3,4\}, \{2,3,4\}, \{1,2,3,4\}$。

$R$ 是 $\mathcal{P}(H)$ 上的子集关系，即 $\langle X, Y \rangle \in R \iff X \subseteq Y$。

哈斯图按包含关系分层，从下至上为：
- 第0层：$\varnothing$
- 第1层：$\{1\}, \{2\}, \{3\}, \{4\}$
- 第2层：$\{1,2\}, \{1,3\}, \{1,4\}, \{2,3\}, \{2,4\}, \{3,4\}$
- 第3层：$\{1,2,3\}, \{1,2,4\}, \{1,3,4\}, \{2,3,4\}$
- 第4层：$\{1,2,3,4\}$

$K = \{\{1,2\}, \{1,3\}, \{2,3\}\}$：
- **极大元**：在 $K$ 中，$\{1,2\}$ 与 $\{1,3\}$ 不可比（互不包含），$\{1,2\}$ 与 $\{2,3\}$ 不可比，$\{1,3\}$ 与 $\{2,3\}$ 不可比。故 $K$ 中每个元素都是极大元，即 $\{1,2\}, \{1,3\}, \{2,3\}$。
- **最大元**：由于极大元不唯一，故不存在最大元。
- **上界**：需要同时包含 $\{1,2\}, \{1,3\}, \{2,3\}$ 的集合，即包含 $1,2,3$ 的集合。在 $\mathcal{P}(H)$ 中，$\{1,2,3\}$ 和 $\{1,2,3,4\}$ 都包含这三个元素，故上界为 $\{\{1,2,3\}, \{1,2,3,4\}\}$。
- **上确界（最小上界）**：在上界 $\{\{1,2,3\}, \{1,2,3,4\}\}$ 中，$\{1,2,3\} \subseteq \{1,2,3,4\}$，故最小上界（上确界）为 $\{1,2,3\}$。

---

### 2024-2025
设偏序关系 $\langle A, \preceq \rangle$ 中，有 $a, b, c, d \in A$ 且 $a \preceq b, c \preceq d$，设 $\{a, c\}, \{b, d\}$ 的上确界分别为 $e, f$，证明：$e \preceq f$。

> [!NOTE] 偏序关系与偏序集
> 设 $A$ 是一个集合，如果 $A$ 上的一个关系 $R$ 满足自反性、反对称性和传递性，则称 $R$ 是 $A$ 上的一个偏序关系。序偶 $\langle A, \leq \rangle$ 称作偏序集。
> （定义3-12.1）

> [!NOTE] 最小上界（上确界）
> 设 $\langle A, \leq \rangle$ 为偏序集且 $B \subseteq A$ 为一子集，$a$ 为 $B$ 的任一上界，若对 $B$ 的所有上界 $y$ 均有 $a \leq y$，则称 $a$ 为 $B$ 的最小上界（上确界），记作 LUB $B$。
> （定义3-12.8）

### 证明：

因为 $e$ 是 $\{a, c\}$ 的上确界，由定义可知 $e$ 是 $\{a, c\}$ 的上界，故
$$
a \preceq e \quad \text{且} \quad c \preceq e
$$

又已知 $a \preceq b$，$c \preceq d$，以及 $\preceq$ 是偏序关系（即满足传递性），故
$$
a \preceq e \quad \text{且} \quad a \preceq b \quad \Rightarrow \quad \text{无法直接得 } b \text{ 和 } e \text{ 的关系}
$$

我们需要证明 $e \preceq f$。由 $e$ 是 $\{a, c\}$ 的上确界，$f$ 是 $\{b, d\}$ 的上确界。

首先，由 $a \preceq b$ 和 $b \preceq f$（因为 $f$ 是 $\{b, d\}$ 的上界，故 $b \preceq f$），由传递性得 $a \preceq f$。

同理，由 $c \preceq d$ 和 $d \preceq f$（$f$ 是 $\{b, d\}$ 的上界），得 $c \preceq f$。

因此 $f$ 是 $\{a, c\}$ 的一个上界。因为 $e$ 是 $\{a, c\}$ 的最小上界，所以对于 $\{a, c\}$ 的任何上界 $x$ 都有 $e \preceq x$。特别地，$f$ 是 $\{a, c\}$ 的一个上界，故
$$
e \preceq f
$$

证毕。□

---

## 函数

### 2019-2020（7分）
$f$ 为 $\mathbb{Z} \times \mathbb{Z}$ 到 $\mathbb{Z}$ 的函数，$f(m, n) = |m| - |n|$，其中 $\mathbb{Z}$ 表示整数集。证明 $f$ 为满射。

> [!NOTE] 函数/映射
> 设 $X$ 和 $Y$ 是任何两个集合，而 $f$ 是 $X$ 到 $Y$ 的一个关系，如果对于每一个 $x \in X$，有唯一的 $y \in Y$，使得 $\langle x, y \rangle \in f$，称关系 $f$ 为函数，记作 $f: X \to Y$。
> （定义4-1.1）

> [!NOTE] 满射
> 对于 $X \xrightarrow{f} Y$ 的映射中，如果 $\operatorname{ran} f = Y$，即 $Y$ 的每一个元素是 $X$ 中一个或多个元素的象点，则称这个映射为满射（或到上映射）。
> （定义4-1.3）

### 证明：

要证 $f$ 是满射，即证对任意 $z \in \mathbb{Z}$，都存在 $(m, n) \in \mathbb{Z} \times \mathbb{Z}$ 使得 $f(m, n) = z$。

对任意 $z \in \mathbb{Z}$，取 $m = |z|$，$n = 0$，则
$$
f(m, n) = |m| - |n| = \big||z|\big| - |0| = |z| - 0 = |z|
$$

当 $z \geq 0$ 时，$|z| = z$，故 $f(|z|, 0) = z$。

当 $z < 0$ 时，$|z| = -z > 0$。此时取 $m = 0$，$n = |z|$，则
$$
f(0, |z|) = |0| - \big||z|\big| = 0 - |z| = -|z| = z
$$

因此对任意 $z \in \mathbb{Z}$，都存在原像，故 $f$ 是满射。□

---

## 等价关系与划分

### 2019-2020（8分）
集合 $T = \{1, 2, 3, 4\}$，$R = \{\langle 1,1 \rangle, \langle 1,4 \rangle, \langle 4,4 \rangle, \langle 2,2 \rangle, \langle 2,3 \rangle, \langle 3,3 \rangle\}$
(1) $R$ 是否为 $T$ 上的等价关系？为什么？
(2) 给出集合 $S$ 及 $S$ 上等价关系 $R$，$R$ 能产生 $S$ 上的划分 $\{\{1,2\}, \{3\}, \{4,5\}\}$。

> [!NOTE] 等价关系
> 设 $R$ 为定义在集合 $A$ 上的一个关系，若 $R$ 是自反的、对称的和传递的，则 $R$ 称为等价关系。
> （定义3-10.1）

> [!NOTE] 等价关系决定划分
> 集合 $A$ 上的等价关系 $R$ 决定了 $A$ 的一个划分，该划分就是商集 $A / R$。
> （定理3-10.2）

> [!NOTE] 划分确定等价关系
> 集合 $A$ 的一个划分确定 $A$ 的元素间的一个等价关系。
> （定理3-10.3）

### 解：

(1) $R$ 不是 $T$ 上的等价关系，原因如下：

$R$ 缺少 $\langle 4, 1 \rangle$，不满足对称性。虽然 $\langle 1, 4 \rangle \in R$，但 $\langle 4, 1 \rangle \notin R$。同时 $R$ 缺少 $\langle 3, 2 \rangle$，也不满足对称性。此外，$R$ 也缺少 $\langle 4, 1 \rangle$ 相关的一些传递性要求，但首先对称性就不满足，故 $R$ 不是等价关系。

(2) 设 $S = \{1, 2, 3, 4, 5\}$，划分 $\{\{1,2\}, \{3\}, \{4,5\}\}$。

由划分诱导的等价关系 $R$ 定义为：$a R b$ 当且仅当 $a, b$ 在同一分块中。因此
$$
R = (\{1,2\} \times \{1,2\}) \cup (\{3\} \times \{3\}) \cup (\{4,5\} \times \{4,5\})
$$
即
$$
R = \{\langle 1,1 \rangle, \langle 1,2 \rangle, \langle 2,1 \rangle, \langle 2,2 \rangle, \langle 3,3 \rangle, \langle 4,4 \rangle, \langle 4,5 \rangle, \langle 5,4 \rangle, \langle 5,5 \rangle\}
$$

---

### 2022-2023 期中（8分）
设 $A = \{1, 2, 3, 4\}$，$S = \{\{1\}, \{2, 3\}, \{4\}\}$ 为 $A$ 的一个划分，求由 $S$ 诱导的集合 $A$ 上的等价关系。

> [!NOTE] 划分确定等价关系
> 集合 $A$ 的一个划分确定 $A$ 的元素间的一个等价关系。定义关系 $R$：$aRb$ 当且仅当 $a, b$ 在同一分块中。则 $R$ 是等价关系。
> （定理3-10.3）

### 解：

划分类为 $\{1\}, \{2, 3\}, \{4\}$。按定理3-10.3，定义的等价关系 $R$ 为：
$$
R = (\{1\} \times \{1\}) \cup (\{2,3\} \times \{2,3\}) \cup (\{4\} \times \{4\})
$$

分别计算：
- $\{1\} \times \{1\} = \{\langle 1,1 \rangle\}$
- $\{2,3\} \times \{2,3\} = \{\langle 2,2 \rangle, \langle 2,3 \rangle, \langle 3,2 \rangle, \langle 3,3 \rangle\}$
- $\{4\} \times \{4\} = \{\langle 4,4 \rangle\}$

故
$$
R = \{\langle 1,1 \rangle, \langle 2,2 \rangle, \langle 2,3 \rangle, \langle 3,2 \rangle, \langle 3,3 \rangle, \langle 4,4 \rangle\}
$$

---

### 2022-2023 期中（6分）
设 $R$ 是一个二元关系，设 $S = \{(a, b) \mid \text{对于某个 } c, \text{有 } (a, c) \in R \text{ 且 } (c, b) \in R\}$。
证明：若 $R$ 是一个等价关系，则 $S$ 也是一个等价关系。

> [!NOTE] 等价关系
> 设 $R$ 为定义在集合 $A$ 上的一个关系，若 $R$ 是自反的、对称的和传递的，则 $R$ 称为等价关系。
> （定义3-10.1）

> [!NOTE] 复合关系
> 设 $R$ 为 $X$ 到 $Y$ 的关系，$S$ 为从 $Y$ 到 $Z$ 的关系，则 $R \circ S$ 称为 $R$ 和 $S$ 的复合关系。$$R \circ S = \{\langle x, z \rangle \mid x \in X \wedge z \in Z \wedge (\exists y) (y \in Y \wedge \langle x, y \rangle \in R \wedge \langle y, z \rangle \in S)\}$$
> （定义3-7.1）

### 证明：

由定义可见，$S = R \circ R$。设 $R$ 是定义在集合 $A$ 上的等价关系。需证 $S$ 满足自反性、对称性和传递性。

**(1) 自反性**：对任意 $a \in A$，因为 $R$ 是等价关系，故 $R$ 自反，有 $\langle a, a \rangle \in R$。取 $c = a$，则 $\langle a, a \rangle \in R$ 且 $\langle a, a \rangle \in R$，故 $\langle a, a \rangle \in S$。因此 $S$ 自反。

**(2) 对称性**：设 $\langle a, b \rangle \in S$，则存在 $c \in A$ 使 $\langle a, c \rangle \in R$ 且 $\langle c, b \rangle \in R$。因为 $R$ 对称，故 $\langle c, a \rangle \in R$ 且 $\langle b, c \rangle \in R$。于是存在 $c$ 使 $\langle b, c \rangle \in R$ 且 $\langle c, a \rangle \in R$，即 $\langle b, a \rangle \in S$。因此 $S$ 对称。

**(3) 传递性**：设 $\langle a, b \rangle \in S$ 且 $\langle b, d \rangle \in S$，则存在 $c_1, c_2 \in A$ 使
$$
\langle a, c_1 \rangle \in R,\; \langle c_1, b \rangle \in R,\; \langle b, c_2 \rangle \in R,\; \langle c_2, d \rangle \in R
$$
由 $R$ 的传递性，由 $\langle c_1, b \rangle \in R$ 和 $\langle b, c_2 \rangle \in R$ 得 $\langle c_1, c_2 \rangle \in R$。再由 $\langle a, c_1 \rangle \in R$ 和 $\langle c_1, c_2 \rangle \in R$ 得 $\langle a, c_2 \rangle \in R$。最后由 $\langle a, c_2 \rangle \in R$ 和 $\langle c_2, d \rangle \in R$ 得 $\langle a, d \rangle \in S$。因此 $S$ 传递。

综上，$S$ 是等价关系。□

---

### 2022-2023 期末（7分）
设 $R$ 是集合 $A$ 上的一个二元关系。证明：

1. $\text{rts}(R) = \text{tsr}(R)$。其中 $\text{rts}(R)$ 表示先求对称闭包、再求传递闭包、最后求自反闭包。
2. $\text{rts}(R)$ 是 $A$ 上的一个等价关系。

> [!NOTE] 自反/对称/传递闭包
> 设 $R$ 是 $X$ 上的二元关系，如果有另一个关系 $R'$ 满足：
> a) $R'$ 是自反的（对称的，可传递的）；
> b) $R' \supseteq R$；
> c) 对于任何自反的（对称的，可传递的）关系 $R''$，如果有 $R'' \supseteq R$，就有 $R'' \supseteq R'$。
> 则称关系 $R'$ 为 $R$ 的自反（对称，传递）闭包，记作 $r(R)$（$s(R)$，$t(R)$）。
> （定义3-8.1）

> [!NOTE] 自反闭包与对称闭包构造
> 设 $R$ 是集合 $X$ 上的二元关系，则 $r(R) = R \cup I_X$，$s(R) = R \cup R^c$。
> （定理3-8.2、定理3-8.3）

> [!NOTE] 闭包复合性质
> 设 $X$ 是集合，$R$ 是 $X$ 上的二元关系，则
> $$rs(R) = sr(R)$$
> $$rt(R) = tr(R)$$
> $$ts(R) \supseteq st(R)$$
> （定理3-8.6）

> [!NOTE] 等价关系
> 设 $R$ 为定义在集合 $A$ 上的一个关系，若 $R$ 是自反的、对称的和传递的，则 $R$ 称为等价关系。
> （定义3-10.1）

### 证明：

**1. 证明 $\text{rts}(R) = \text{tsr}(R)$**

这里 $\text{rts}(R) = r(t(s(R)))$，$\text{tsr}(R) = t(s(r(R)))$。

由闭包复合性质（定理3-8.6）：
- $rt(R) = tr(R)$，即 $r(t(R)) = t(r(R))$
- 但我们需要的是 $r(t(s(R))) = t(s(r(R)))$。

事实上，$\text{rts}(R) = r(t(s(R))) \stackrel{(1)}{=} t(r(s(R))) \stackrel{(2)}{=} t(s(r(R))) = \text{tsr}(R)$。

其中：
(1) 由 $rt = tr$ 得 $r(t(s(R))) = t(r(s(R)))$。
(2) 由 $rs = sr$ 得 $r(s(R)) = s(r(R))$，故 $t(r(s(R))) = t(s(r(R)))$。

因此 $\text{rts}(R) = \text{tsr}(R)$。

**2. 证明 $\text{rts}(R)$ 是等价关系**

令 $R' = \text{rts}(R)$。

- **自反性**：$\text{rts}(R)$ 中包含了自反闭包运算 $r$，由自反闭包的定义，$r(t(s(R)))$ 是自反的。故 $R'$ 自反。
- **对称性**：先证 $\text{ts}(R)$ 是对称的。$s(R)$ 是对称的，而传递闭包 $t$ 不会破坏对称性（若 $S$ 对称，则 $t(S)$ 也对称），故 $t(s(R))$ 对称。再加自反闭包 $r$（即添加 $I_X$）仍保持对称性，故 $R'$ 对称。
- **传递性**：$\text{rts}(R)$ 中包含了传递闭包运算 $t$，由传递闭包的定义，$t(s(R))$ 是传递的。加自反闭包不破坏传递性，故 $R'$ 传递。

因此 $R'$ 是自反、对称、传递的，故 $\text{rts}(R)$ 是 $A$ 上的等价关系。□

---

## 关系矩阵与传递闭包

### 2022-2023 期中（8分）
设集合 $A = \{a, b, c, d\}$ 上关系 $R = \{(a, b), (b, a), (b, c), (c, d)\}$

* **(1)** 写出 $R$ 的关系矩阵；
* **(2)** 用 Warshall 算法求 $R$ 的传递闭包。

> [!NOTE] 二元关系及其表示
> 任一序偶的集合确定了一个二元关系 $R$，$R$ 中任一序偶 $\langle x, y \rangle$ 可记作 $\langle x, y \rangle \in R$ 或 $xRy$。
> （定义3-5.1）

> [!NOTE] 传递闭包构造
> 设 $R$ 是 $X$ 上的二元关系，则 $t(R) = \bigcup_{i=1}^{\infty} R^i = R \cup R^2 \cup R^3 \cup \cdots$。
> （定理3-8.4）

> [!NOTE] 有限集传递闭包
> 设 $X$ 是含有 $n$ 个元素的集合，$R$ 是 $X$ 上的二元关系，则存在一个正整数 $k \leq n$，使得 $t(R) = R \cup R^2 \cup R^3 \cup \cdots \cup R^k$。
> （定理3-8.5）

### 解：

**(1)** 关系矩阵 $M_R$ 是 $4 \times 4$ 矩阵，行和列按 $a, b, c, d$ 顺序排列。$M_R[i][j] = 1$ 当且仅当 $\langle a_i, a_j \rangle \in R$。

$$
M_R = \begin{pmatrix}
0 & 1 & 0 & 0 \\
1 & 0 & 1 & 0 \\
0 & 0 & 0 & 1 \\
0 & 0 & 0 & 0
\end{pmatrix}
$$

**(2)** 用 Warshall 算法求传递闭包。

初始矩阵 $M_0 = M_R$：

$$
M_0 = \begin{pmatrix}
0 & 1 & 0 & 0 \\
1 & 0 & 1 & 0 \\
0 & 0 & 0 & 1 \\
0 & 0 & 0 & 0
\end{pmatrix}
$$

**第1列（$a$ 列）**：检查第1列中为1的行。$M_0[2][1] = 1$（$b$ 行 $a$ 列），将第1行加到第2行：$M_1[2][j] = M_0[2][j] \lor M_0[1][j]$。

$M_1$：
$$
\begin{pmatrix}
0 & 1 & 0 & 0 \\
1 & 1 & 1 & 0 \\
0 & 0 & 0 & 1 \\
0 & 0 & 0 & 0
\end{pmatrix}
$$

**第2列（$b$ 列）**：$M_1[1][2] = 1$（$a$ 行 $b$ 列），$M_1[2][2] = 1$（$b$ 行 $b$ 列）。将第2行加到第1行，第2行加到第2行（自身不变）。

$M_2$：
$$
\begin{pmatrix}
1 & 1 & 1 & 0 \\
1 & 1 & 1 & 0 \\
0 & 0 & 0 & 1 \\
0 & 0 & 0 & 0
\end{pmatrix}
$$

**第3列（$c$ 列）**：$M_2[1][3] = 1$（$a$ 行 $c$ 列），$M_2[2][3] = 1$（$b$ 行 $c$ 列）。将第3行加到第1行，第3行加到第2行。

$M_3$：
$$
\begin{pmatrix}
1 & 1 & 1 & 1 \\
1 & 1 & 1 & 1 \\
0 & 0 & 0 & 1 \\
0 & 0 & 0 & 0
\end{pmatrix}
$$

**第4列（$d$ 列）**：$M_3[1][4] = 1$，$M_3[2][4] = 1$，$M_3[3][4] = 1$。将第4行加到第1、2、3行（但第4行全为0，故不变）。

$M_4$：
$$
\begin{pmatrix}
1 & 1 & 1 & 1 \\
1 & 1 & 1 & 1 \\
0 & 0 & 0 & 1 \\
0 & 0 & 0 & 0
\end{pmatrix}
$$

故传递闭包 $t(R)$ 的关系矩阵为 $M_4$，对应的关系为：
$$
t(R) = \{(a,a), (a,b), (a,c), (a,d), (b,a), (b,b), (b,c), (b,d), (c,d)\}
$$

---

## 相容关系

### 2022-2023 期中（5分）
简述相容的定义，相容关系与覆盖的关系，相容关系、等价关系的不同。

> [!NOTE] 相容关系
> 给定集合 $A$ 上的关系 $r$，若 $r$ 是自反的、对称的，则称 $r$ 是相容关系。
> （定义3-11.1）

> [!NOTE] 覆盖诱导相容关系
> 给定集合 $A$ 的覆盖 $\{A_1, A_2, \dots, A_n\}$，由它确定的关系 $R = A_1 \times A_1 \cup A_2 \times A_2 \cup \cdots \cup A_n \times A_n$ 是相容关系。
> （定理3-11.2）

> [!NOTE] 相容与覆盖对应
> 集合 $A$ 上相容关系 $r$ 与完全覆盖 $C_r(A)$ 存在一一对应。
> （定理3-11.3）

> [!NOTE] 等价关系
> 设 $R$ 为定义在集合 $A$ 上的一个关系，若 $R$ 是自反的、对称的和传递的，则 $R$ 称为等价关系。
> （定义3-10.1）

### 解：

**相容关系的定义**：集合 $A$ 上的关系 $r$ 如果满足自反性和对称性，则称 $r$ 是相容关系。

**相容关系与覆盖的关系**：
- 由集合 $A$ 的一个覆盖 $\{A_1, A_2, \dots, A_n\}$ 可以诱导一个相容关系 $R = \bigcup_{i=1}^n (A_i \times A_i)$（定理3-11.2）。
- 反之，由集合 $A$ 上的一个相容关系 $r$，它的所有最大相容类构成的完全覆盖 $C_r(A)$ 是 $A$ 的一个覆盖。

**相容关系与等价关系的不同**：
- 相容关系只要求自反和对称，不要求传递。
- 等价关系要求自反、对称和传递。
- 因此，等价关系一定是相容关系，但相容关系不一定是等价关系。
- 等价关系对应的是集合的划分（各分块互不相交），而相容关系对应的是集合的覆盖（分块可以有交集）。

---

## 模同余关系与商集

### 2022-2023 期中（6分）
设 $R_j$ 表示 $I$ 上的模 $j$ 等价关系，$R_k$ 表示 $I$ 上的模 $k$ 等价关系，证明：$I/R_k$ 细分 $I/R_j$，当且仅当 $k$ 是 $j$ 的整数倍。

> [!NOTE] 等价关系
> 设 $R$ 为定义在集合 $A$ 上的一个关系，若 $R$ 是自反的、对称的和传递的，则 $R$ 称为等价关系。
> （定义3-10.1）

> [!NOTE] 商集
> 集合 $A$ 上的等价关系 $R$，其等价类集合 $\{[a]_R \mid a \in A\}$ 称作 $A$ 关于 $R$ 的商集，记作 $A / R$。
> （定义3-10.3）

> [!NOTE] 加细
> 给定 $X$ 的任意两个划分 $\{A_1, A_2, \dots, A_r\}$ 和 $\{B_1, B_2, \dots, B_s\}$，若对于每一个 $A_j$ 均有 $B_k$ 使 $A_j \subseteq B_k$，则 $\{A_1, A_2, \dots, A_r\}$ 称为是 $\{B_1, B_2, \dots, B_s\}$ 的加细。
> （定义3-9.3）

### 证明：

模 $m$ 等价关系 $R_m$ 定义为：$a R_m b \iff a \equiv b \pmod{m}$，即 $m \mid (a - b)$。其商集 $I/R_m$ 将整数集划分为 $m$ 个等价类：$[0], [1], \dots, [m-1]$。

$I/R_k$ 细分 $I/R_j$ 意味着 $I/R_k$ 的每个等价类都包含在 $I/R_j$ 的某个等价类中。

**充分性**：若 $k$ 是 $j$ 的整数倍，即 $j = k \cdot t$（$t$ 为正整数）。

对任意 $[a]_k \in I/R_k$，任取 $x, y \in [a]_k$，则 $k \mid (x - a)$ 且 $k \mid (y - a)$，故 $k \mid (x - y)$。因 $j = k \cdot t$，故 $j \mid (x - y)$，即 $x R_j y$。这表示 $[a]_k$ 中的所有元素在 $R_j$ 下属于同一等价类，故 $[a]_k \subseteq [b]_j$（对某个 $b$）。因此 $I/R_k$ 是 $I/R_j$ 的加细，即 $I/R_k$ 细分 $I/R_j$。

**必要性**：若 $I/R_k$ 细分 $I/R_j$，则 $I/R_k$ 的每个等价类包含在 $I/R_j$ 的某个等价类中。

考虑 $[0]_k = \{x \mid k \mid x\}$，它包含在 $I/R_j$ 的某个等价类中。因为 $0 \in [0]_k$，且 $0 \in [0]_j$，故 $[0]_k \subseteq [0]_j$。于是对任意 $x \in [0]_k$，即 $k \mid x$，必有 $j \mid x$。特别地，取 $x = k$，则 $k \in [0]_k$，故 $j \mid k$，即 $k$ 是 $j$ 的整数倍。

综上所述，$I/R_k$ 细分 $I/R_j$ 当且仅当 $k$ 是 $j$ 的整数倍。□

---

## 笛卡尔积与子集

### 2022-2023 期末（5分）
证明：若 $A \subseteq B$ 和 $C \subseteq D$，则 $A \times C \subseteq B \times D$。

> [!NOTE] 笛卡尔积
> 令 $A$ 和 $B$ 是任意两个集合，若序偶的第一个成员是 $A$ 的元素，第二个成员是 $B$ 的元素，所有这样的序偶集合，称为集合 $A$ 和 $B$ 的笛卡尔乘积或直积，记作 $A \times B$。
> $$A \times B = \{\langle x, y \rangle \mid (x \in A) \wedge (y \in B)\}$$
> （定义3-4.2）

> [!NOTE] 笛卡尔积子集判定
> 设 $A, B, C, D$ 为四个非空集合，则 $A \times B \subseteq C \times D$ 的充要条件为 $A \subseteq C$ 且 $B \subseteq D$。
> （定理3-4.3）

### 证明：

任取 $\langle x, y \rangle \in A \times C$，由笛卡尔积定义知 $x \in A$ 且 $y \in C$。

已知 $A \subseteq B$，故 $x \in A \Rightarrow x \in B$。

已知 $C \subseteq D$，故 $y \in C \Rightarrow y \in D$。

因此 $x \in B$ 且 $y \in D$，即 $\langle x, y \rangle \in B \times D$。

所以 $A \times C \subseteq B \times D$。□

---

### 2024-2025
若 $B \subseteq C$，证明 $A \times B \subseteq A \times C$。

> [!NOTE] 笛卡尔积
> 令 $A$ 和 $B$ 是任意两个集合，若序偶的第一个成员是 $A$ 的元素，第二个成员是 $B$ 的元素，所有这样的序偶集合，称为集合 $A$ 和 $B$ 的笛卡尔乘积或直积，记作 $A \times B$。
> $$A \times B = \{\langle x, y \rangle \mid (x \in A) \wedge (y \in B)\}$$
> （定义3-4.2）

### 证明：

任取 $\langle x, y \rangle \in A \times B$，由笛卡尔积定义知 $x \in A$ 且 $y \in B$。

已知 $B \subseteq C$，故 $y \in B \Rightarrow y \in C$。

因此 $x \in A$ 且 $y \in C$，即 $\langle x, y \rangle \in A \times C$。

所以 $A \times B \subseteq A \times C$。□

---

## 基数

### 2022-2023 期末（5分）
设 $A$ 和 $B$ 是两个集合，定义 $A + B = \{\langle x, 0 \rangle \mid x \in A\} \cup \{\langle y, 1 \rangle \mid y \in B\}$。
证明：$|A \cup B| \le |A + B|$，其中 $|A + B|$ 表示 $A + B$ 的基数。

> [!NOTE] 基数比较
> 若从集合 $A$ 到集合 $B$ 存在一个入射，则称 $A$ 的基数不大于 $B$ 的基数，记作 $K[A] \leq K[B]$。
> （定义4-6.1）

> [!NOTE] 入射/单射
> 从 $X$ 到 $Y$ 的映射中，$X$ 中没有两个元素有相同的象，则称这个映射为入射（或一对一映射）。$x_1 \neq x_2 \Rightarrow f(x_1) \neq f(x_2)$。
> （定义4-1.4）

### 证明：

要证 $|A \cup B| \le |A + B|$，只需构造从 $A \cup B$ 到 $A + B$ 的一个入射。

定义 $f: A \cup B \to A + B$ 如下：
$$
f(x) = \begin{cases}
\langle x, 0 \rangle, & x \in A \\
\langle x, 1 \rangle, & x \in B - A
\end{cases}
$$

验证 $f$ 是入射：任取 $x_1 \neq x_2$，分情况讨论：
- 若 $x_1, x_2 \in A$，则 $f(x_1) = \langle x_1, 0 \rangle$，$f(x_2) = \langle x_2, 0 \rangle$，由 $x_1 \neq x_2$ 得 $\langle x_1, 0 \rangle \neq \langle x_2, 0 \rangle$。
- 若 $x_1 \in A$，$x_2 \in B - A$，则 $f(x_1) = \langle x_1, 0 \rangle$，$f(x_2) = \langle x_2, 1 \rangle$，由于第二分量 $0 \neq 1$，故 $f(x_1) \neq f(x_2)$。
- 若 $x_1, x_2 \in B - A$，则 $f(x_1) = \langle x_1, 1 \rangle$，$f(x_2) = \langle x_2, 1 \rangle$，由 $x_1 \neq x_2$ 得 $\langle x_1, 1 \rangle \neq \langle x_2, 1 \rangle$。

因此 $f$ 是入射。由基数比较定义，$|A \cup B| \le |A + B|$。□

---

## 关系性质（自反与反自反）

### 2024-2025
已知集合 $A, B$ 是自反的，证明：$A \oplus B$ 是反自反的。

> [!NOTE] 自反关系
> 设 $R$ 为定义在集合 $X$ 上的二元关系，如果对于每个 $x \in X$，有 $xRx$，则称二元关系 $R$ 是自反的。
> $$R \text{在} X \text{上自反} \Leftrightarrow (\forall x) (x \in X \rightarrow x R x)$$
> （定义3-6.1）

> [!NOTE] 反自反关系
> 设 $R$ 为定义在集合 $X$ 上的二元关系，如果对于每一个 $x \in X$，都有 $\langle x, x \rangle \notin R$，则 $R$ 称作反自反的。
> $$R \text{在} X \text{上反自反} \Leftrightarrow (\forall x) (x \in X \rightarrow \langle x, x \rangle \notin R)$$
> （定义3-6.4）

> [!NOTE] 对称差
> 设 $A, B$ 为任意两个集合，$A$ 和 $B$ 的对称差为 $A \oplus B = (A - B) \cup (B - A) = \{x \mid x \in A \;\overline{\vee}\; x \in B\}$。
> （定义3-2.5）

### 证明：

这里题目中的 $A, B$ 应理解为定义在某个集合 $X$ 上的自反关系（二元关系），$A \oplus B$ 是它们的对称差运算。

设 $X$ 是 $A$ 和 $B$ 的定义域（即 $A, B \subseteq X \times X$），且 $A$ 和 $B$ 都是 $X$ 上的自反关系。

对任意 $x \in X$，因为 $A$ 自反，故 $\langle x, x \rangle \in A$；因为 $B$ 自反，故 $\langle x, x \rangle \in B$。

由对称差定义：
$$
A \oplus B = (A - B) \cup (B - A)
$$

由于 $\langle x, x \rangle \in A$ 且 $\langle x, x \rangle \in B$，故 $\langle x, x \rangle \notin A - B$ 且 $\langle x, x \rangle \notin B - A$。因此 $\langle x, x \rangle \notin A \oplus B$。

由 $x$ 的任意性，对每个 $x \in X$ 都有 $\langle x, x \rangle \notin A \oplus B$，故 $A \oplus B$ 是反自反的。□

---

## 可数集

### 2024-2025
设 $A = \left\{\frac{n}{n + 1} \;\middle|\; n \in \mathbb{N} - \{2, 91, 255\}\right\}$，证明 $A$ 是可数的。

> [!NOTE] 可数集
> 与自然数集合等势的任意集合称为可数的，可数集合的基数用 $\aleph_0$ 表示。
> （定义4-5.1）

> [!NOTE] 可数集的排列形式
> $A$ 为可数集的充分必要条件是可以排列成 $A = \{a_1, a_2, \dots, a_n, \dots\}$ 的形式。
> （定理4-5.1）

> [!NOTE] 可数集的无限子集可数
> 可数集的任何无限子集是可数的。
> （定理4-5.4）

### 证明：

令 $B = \left\{\frac{n}{n+1} \;\middle|\; n \in \mathbb{N}\right\}$。先证 $B$ 是可数集。

定义映射 $f: \mathbb{N} \to B$，$f(n) = \frac{n}{n+1}$。易见 $f$ 是双射：
- 满射：对任意 $\frac{n}{n+1} \in B$，取 $n \in \mathbb{N}$ 即得原像。
- 入射：若 $f(n_1) = f(n_2)$，则 $\frac{n_1}{n_1+1} = \frac{n_2}{n_2+1}$，交叉相乘得 $n_1(n_2+1) = n_2(n_1+1)$，即 $n_1 n_2 + n_1 = n_1 n_2 + n_2$，故 $n_1 = n_2$。

因此 $B \sim \mathbb{N}$，$B$ 是可数集。

又 $A = B - \left\{\frac{2}{3}, \frac{91}{92}, \frac{255}{256}\right\}$，即 $A$ 是 $B$ 挖去有限个元素得到的子集。由于 $B$ 是无限可数集，挖去有限个元素后 $A$ 仍是无限集。由定理4-5.4，可数集的无限子集仍是可数集，故 $A$ 是可数集。□
