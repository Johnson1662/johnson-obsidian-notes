# DFS（深度优先搜索）

## 数池塘（Lake Counting）

### 题目描述

由于近期的降雨，农夫约翰的田地（一个 $N \times M$ 的矩形，1 ≤ N ≤ 100；1 ≤ M ≤ 100）中积攒了许多水洼。每个格子要么是水（'W'），要么是旱地（'.'）。农夫约翰想知道他的田里形成了多少个池塘。池塘定义为一组相连的水洼，每个格子与其八个方向的邻居相邻。

给定农夫约翰田地的示意图，请计算出他有多少个池塘。

### 输入格式

- 第 1 行：两个空格分隔的整数 N 和 M
- 第 2…N+1 行：每行 M 个字符，表示田地的一行。每个字符是 'W' 或 '.'，字符之间没有空格。

### 输出格式

- 第 1 行：田中池塘的数量

### 样例输入

```
10 12
W........WW.
.WWW.....WWW
....WW...WW.
.........WW.
.........W..
..W......W..
.W.W.....WW.
W.W.W.....W.
.W.W......W.
..W.......W.
```

### 样例输出

```
3
```

### 问题分析

#### 第一步：理解问题

农夫约翰的田地是一个网格，每个格子要么是水（W）要么是旱地（.）。如果一个 W 格子与另一个 W 格子相邻（包括上下左右和四个对角方向），它们就属于同一个池塘。

题目要求统计池塘的数量。

#### 第二步：DFS 的核心思路——"洪水填充"

这个问题是经典的 Flood Fill（洪水填充）算法。想象一下往一个水坑里倒墨水——墨水会沿着相邻的水坑一直扩散，直到把整个池塘染满。

具体做法：
1. 遍历整个网格
2. 遇到一个 W，说明发现了一个新池塘，计数器加 1
3. 从这个 W 出发，通过 DFS 把与之相连的所有 W 都标记为已访问（这里采用直接改成 '.' 的方式，省去 visited 数组）
4. 继续遍历，直到找到下一个未被标记的 W

这样每个池塘只会被计数一次。

#### 第三步：搜索方向

题目定义相邻包括 8 个方向（上、下、左、右、左上、右上、左下、右下），所以需要遍历 8 个方向向量：

```
(-1,-1) (-1,0) (-1,1)
(0,-1)   (自身)  (0,1)
(1,-1)  (1,0)  (1,1)
```

#### 第四步：模拟示例的一部分

对于样例输入，从 (0,0) 位置发现第一个 W，DFS 会沿着所有相邻的 W 扩散，把左上角的一片水域全部标记。然后继续遍历找到下一个未被标记的 W，总共找到 3 个池塘。

### 代码实现

```cpp
#include <iostream>
#include <vector>
#include <string>

using namespace std;

int N, M;
vector<string> field;

// 深度优先搜索，将属于同一个水池的所有 'W' 替换为 '.'
void dfs(int x, int y)
{
    // 将当前位置标记为已访问（通过把 W 变成 . 来实现，避免使用额外的 visited 数组）
    field[x][y] = '.';

    // 遍历周围 8 个方向
    for (int dx = -1; dx <= 1; ++dx)
    {
        for (int dy = -1; dy <= 1; ++dy)
        {
            // 跳过自身
            if (dx == 0 && dy == 0)
                continue;

            int nx = x + dx;
            int ny = y + dy;

            // 越界检查以及是否为水域检查
            if (nx >= 0 && nx < N && ny >= 0 && ny < M && field[nx][ny] == 'W')
            {
                dfs(nx, ny);
            }
        }
    }
}

int main()
{
    // 基础输入处理
    if (!(cin >> N >> M))
        return 0;

    field.resize(N);
    for (int i = 0; i < N; ++i)
    {
        cin >> field[i];
    }

    int count = 0;
    for (int i = 0; i < N; ++i)
    {
        for (int j = 0; j < M; ++j)
        {
            // 只要遇到 'W'，就意味着发现了一个新的水池
            if (field[i][j] == 'W')
            {
                count++;
                // 搜索并标记所有连通的 'W'
                dfs(i, j);
            }
        }
    }

    cout << count << endl;

    return 0;
}
```

> Submitted by 3024205103 @ 2026-04-19 16:29:15

---

## 正方形（拼棒问题）

### 题目描述

有 n 个木棒，需要用上所有木棒，围成一个正方形。如果可以围成正方形，则输出 "yes"，否则输出 "no"。

### 输入格式

第一行输入一个整数 T 表示样例个数。对于每个样例：
- 第一行输入一个整数 N 表示木棍的个数
- 第二行输入 N 个数字表示木棒的长度

### 输出格式

对于每个样例，如果可以则输出 "yes"，否则输出 "no"。

### 样例输入

```
3
4
1 1 1 1
5
10 20 30 40 50
8
1 7 2 6 4 4 3 5
```

### 样例输出

```
yes
no
yes
```

### 问题分析

#### 第一步：理解问题

给定 N 根木棒，要用上**所有**木棒拼成一个正方形。相当于把 N 个数字分成 4 组，每组的总和相等（都等于总和的 1/4）。

#### 第二步：DFS + 回溯的思路

这个问题是在玩"拼图游戏"：
1. **目标明确**：要把所有木棒分成 4 组，每组的长度总和相等（等于总周长的 1/4）。
2. **递归尝试（DFS）**：拿出一根木棒，尝试把它放进第一条边。如果放得下，就继续放下一根；如果放不下，就把它拿出来，换一根试试。
3. **回溯**：如果发现当前这种组合怎么也拼不成四条等长的边，就"反悔"回到上一步，重新调整之前的选择。

可以把这个过程想象成：你有 4 个空桶（四条边），要把所有木棒分配到这 4 个桶中，每个桶的总和必须相等。你逐个尝试将木棒放入某个桶，不行就拿出来放另一个桶。

#### 第三步：DFS 函数的含义

`dfs(count, current_len, index)` 中的参数：
- `count`：已经拼好的完整边数（已经有几条边恰好等于目标边长）
- `current_len`：当前正在拼的这条边已经累积了多少长度
- `index`：从第几根木棒开始尝试（避免重复搜索）

当 count = 3 时，第 4 条边自然就凑齐了，返回 true。

#### 第四步：剪枝优化

没有剪枝的 DFS 会穷举所有 4^N 种分配方案，N=20 时已经不可能。以下是关键剪枝：

- **总长度不能被 4 整除** → 直接 no
- **最长木棒 > 边长** → 直接 no
- **从大到小排序**：先放长木棒可以更快地填满，如果长木棒导致失败，说明这条路不行，尽早回溯
- **跳过相同长度**：如果长度为 5 的木棒试过不行，下一个长度为 5 的也一定不行
- **首根失败剪枝**：如果拼新边时，第一根选中的木棒就失败，那么这方案无解（这根木棒早晚要用）

### 代码实现

```cpp
#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>

using namespace std;

int sticks[25];
bool used[25];
int n, side_len;

// count: 当前已经拼凑好的边数
// current_len: 当前正在拼凑的边的长度
// index: 从第几个木棒开始尝试
bool dfs(int count, int current_len, int index) {
    if (count == 3) return true; // 只要拼好了3条边，第4条必然自动成立

    for (int i = index; i < n; i++) {
        if (used[i] || current_len + sticks[i] > side_len) continue;

        used[i] = true;
        if (current_len + sticks[i] == side_len) {
            // 拼好了一条完整边，开始拼下一条（从头开始找木棒）
            if (dfs(count + 1, 0, 0)) return true;
        } else {
            // 继续拼当前边
            if (dfs(count, current_len + sticks[i], i + 1)) return true;
        }
        used[i] = false; // 回溯

        // 剪枝优化：如果当前尝试失败，且它是该边的第一根或刚好凑满，
        // 或者后续有相同长度的，则都不必再试。
        if (current_len == 0 || current_len + sticks[i] == side_len) return false;
        while (i + 1 < n && sticks[i+1] == sticks[i]) i++;
    }
    return false;
}

void solve() {
    cin >> n;
    int sum = 0;
    for (int i = 0; i < n; i++) {
        cin >> sticks[i];
        sum += sticks[i];
        used[i] = false;
    }

    // 基本可行性判断
    if (sum % 4 != 0) {
        cout << "no" << endl;
        return;
    }
    side_len = sum / 4;
    sort(sticks, sticks + n, greater<int>()); // 从大到小排序

    if (sticks[0] > side_len) {
        cout << "no" << endl;
        return;
    }

    if (dfs(0, 0, 0)) cout << "yes" << endl;
    else cout << "no" << endl;
}

int main() {
    int T;
    cin >> T;
    while (T--) {
        solve();
    }
    return 0;
}
```

---

## 素数环（Prime Circle）

### 题目描述

如图所示，由 $n$ 个圆圈组成一个环。在每个圆圈中填入一个自然数，要求相邻两个圆圈中的数字之和必须为素数。

注意：第一个圆圈中的数字必须始终为 1。

### 输入格式

多组测试数据，每行一个 $n$，输入以 0 结束。

### 输出格式

对于每个测试用例，按字典序输出所有可能的序列，每个用例后输出一个空行。

### 样例输入

```
6
8
0
```

### 样例输出

```
Case 1:
1 4 3 2 5 6
1 6 5 2 3 4

Case 2:
1 2 3 8 5 6 7 4
1 2 5 8 3 4 7 6
1 4 7 6 5 8 3 2
1 6 7 4 3 8 5 2
```

### 问题分析

#### 第一步：理解问题

将 1 到 n 的数字排成一个环，要求相邻两个数字之和为素数。第一个数字固定为 1。

例如 n=6 时，序列 [1, 4, 3, 2, 5, 6]：
- 1+4=5（素数 ✓）
- 4+3=7（素数 ✓）
- 3+2=5（素数 ✓）
- 2+5=7（素数 ✓）
- 5+6=11（素数 ✓）
- 6+1=7（素数 ✓，注意首尾也要相邻）

#### 第二步：回溯思路

这个问题是一个全排列的变种，但多了素数约束。

可以这样理解：我们面前有 n 个空位，需要从 2 到 n 中选数字填入（1 已经固定在第 0 位）。每次填一个数字时：
1. 检查该数字是否已被使用
2. 检查该数字与上一个填入的数字之和是否为素数
3. 如果满足，填入并继续填下一个
4. 如果某个位置所有数字都试过都不行，就退回上一步换一个数字

这个过程类似于"走迷宫遇到死路就回头"，因此称为回溯法。

#### 第三步：剪枝与优化

- **奇偶剪枝**：当 n 为奇数时，必然存在两个奇数相邻，其和为偶数（≥ 2 的偶数不可能是素数），所以 n 为奇数时直接无解。代码中用 `if (n % 2 == 0)` 判断。
- **素数判定**：因为相邻两数之和最大不超过 2n，对于 n ≤ 16 来说和不超过 32，可以预处理素数表，也可以写一个简单的素性测试函数。
- **字典序输出**：从小到大尝试数字（2 到 n），自然满足字典序。

### 代码实现

```cpp
#include <cstdio>
#include <vector>
#include <algorithm>

using namespace std;

int n, a[25];
bool used[25];

// 判定素数（由于和最大不超过40，也可以用预处理数组）
bool is_prime(int x) {
    if (x < 2) return false;
    for (int i = 2; i * i <= x; i++) {
        if (x % i == 0) return false;
    }
    return true;
}

// cur: 当前正在尝试填入第几个位置
void dfs(int cur) {
    // 终止条件：已经填满了n个数字
    if (cur == n) {
        // 额外判定：首尾相加是否为素数
        if (is_prime(a[n - 1] + a[0])) {
            for (int i = 0; i < n; i++) {
                printf("%d%c", a[i], i == n - 1 ? '\n' : ' ');
            }
        }
        return;
    }

    for (int i = 2; i <= n; i++) {
        if (!used[i] && is_prime(i + a[cur - 1])) {
            used[i] = true;
            a[cur] = i;     // 尝试填入
            dfs(cur + 1);   // 递归搜索
            used[i] = false; // 回溯：撤销标记
        }
    }
}

int main() {
    int kase = 0;
    while (scanf("%d", &n) != EOF) {
        if (kase > 0) printf("\n"); // 每组案例间空一行
        printf("Case %d:\n", ++kase);

        for (int i = 0; i < 25; i++) used[i] = false;
        a[0] = 1; // 题目要求第一个数始终为1
        used[1] = true;

        if (n % 2 == 0) { // 奇数无解
            dfs(1);
        }
    }
    return 0;
}
```

---

## Sticks
### 问题描述

Description

George took sticks of the same length and cut them randomly until all parts became at most 50 units long. Now he wants to return sticks to the original state, but he forgot how many sticks he had originally and how long they were originally. Please help him and design a program which computes the smallest possible original length of those sticks. All lengths expressed in units are integers greater than zero.

Input

The input contains blocks of 2 lines. The first line contains the number of sticks parts after cutting, there are at most 64 sticks. The second line contains the lengths of those parts separated by the space. The last line of the file contains zero.

Output

The output should contains the smallest possible length of original sticks, one per line.

Sample Input 1 

9
5 2 1 5 2 1 5 2 1
4
1 2 3 4
0

Sample Output 1 

6
5

### 算法分析

POJ 1011 "Sticks" 是一道非常经典的 **深度优先搜索 (DFS)** 题目。它的核心难点不在于搜索本身，而在于如何通过**剪枝 (Pruning)** 来降低复杂度，否则面对 $2^{64}$ 级别的状态空间必然会超时。

#### 核心解题思路

1. **基本搜索逻辑**：
   * **枚举原长 $L$**：原木棍的长度 $L$ 必定在 `[最长的小木棍长度, 所有木棍总长度]` 之间。
   * **约束条件**：$L$ 必须能被总长度整除（因为要拼成整数根）。
   * **DFS 状态**：`dfs(当前拼到了第几根, 当前这根还差多少长度, 上次用的小木棍索引)`。

2. **五大关键剪枝技巧**（缺一不可）：
   * **优化 1：降序排序**。将小木棍按长度从大到小排序。先尝试长的木棍可以更快地填满 $L$，如果失败能更早回溯。
   * **优化 2：去重剪枝**。如果当前木棍 `sticks[i]` 尝试失败，那么后面所有长度相同的木棍都可以直接跳过。
   * **优化 3：首棍失败剪枝**。如果在尝试拼一根新木棍时，第一根选中的木棍 `sticks[i]` 就无法完成后续拼接，那么当前 $L$ 方案必然失败（因为这根木棍早晚得用上）。
   * **优化 4：末棍失败剪枝**。如果放入某根木棍恰好填满了当前的 $L$，但剩下的木棍无法拼出后续的完整木棍，则直接回溯。
   * **优化 5：控制搜索起点**。每次搜索下一根小木棍时，从上一次选中的木棍索引之后开始找。

#### 关键点解释

* **`total_len % target_len != 0`**：这是第一道防线，确保我们只尝试合法的几何分割。
* **`dfs` 中的 `cur_sum == 0` 判定**：这是一个逻辑上的"必杀技"。如果在一根新木棍的起点位置放上一根现存最长的木棍都无法得出解，那么换任何一根更短的木棍放在这个起点位置也绝对无法得出解。
* **状态回溯**：`used[i] = false` 是 DFS 的标配，代表"尝试不选这根木棍"的情况。

### 代码实现

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
#include <functional>

using namespace std;

int n;
int sticks[65];
bool used[65];
int target_len; // 当前枚举的目标原长
int total_len;
int num_sticks; // 最终应该拼成的根数

// cnt: 已拼好的木棍数, cur_sum: 当前正在拼的木棍已达到的长度, last_idx: 上次使用的棍子下标
bool dfs(int cnt, int cur_sum, int last_idx) {
    if (cnt == num_sticks) return true; // 全部拼完

    if (cur_sum == target_len) {
        // 当前这根拼好了，开始拼下一根，从第 0 个棍子重新寻找
        return dfs(cnt + 1, 0, -1);
    }

    // 剪枝 5：从 last_idx + 1 开始搜
    for (int i = last_idx + 1; i < n; ++i) {
        if (used[i] || cur_sum + sticks[i] > target_len) continue;

        used[i] = true;
        if (dfs(cnt, cur_sum + sticks[i], i)) return true;
        used[i] = false; // 回溯

        // --- 核心剪枝策略 ---

        // 剪枝 3：如果这是新木棍的第一根就失败了，后续不用搜了
        if (cur_sum == 0) return false;

        // 剪枝 4：如果这根木棍恰好填满但后续失败了，说明当前方案不可行
        if (cur_sum + sticks[i] == target_len) return false;

        // 剪枝 2：跳过相同长度的木棍
        while (i + 1 < n && sticks[i] == sticks[i + 1]) i++;
    }

    return false;
}

void solve() {
    while (cin >> n && n != 0) {
        total_len = 0;
        int max_len = 0;
        for (int i = 0; i < n; ++i) {
            cin >> sticks[i];
            total_len += sticks[i];
            if (sticks[i] > max_len) max_len = sticks[i];
        }

        // 剪枝 1：降序排序
        sort(sticks, sticks + n, greater<int>());

        // 枚举可能的目标长度 L
        for (target_len = max_len; target_len <= total_len; ++target_len) {
            if (total_len % target_len != 0) continue; // 必须整除

            num_sticks = total_len / target_len;
            fill(used, used + n, false);

            if (dfs(0, 0, -1)) {
                cout << target_len << endl;
                break;
            }
        }
    }
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(0);
    solve();
    return 0;
}
```
