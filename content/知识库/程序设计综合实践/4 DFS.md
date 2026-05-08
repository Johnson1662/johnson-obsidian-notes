# DFS（深度优先搜索）

## 数池塘（Lake Counting）

**Contest Problem**

- **Time Limit**：C/C++ 1000MS，Other 2000MS
- **Memory Limit**：C/C++ 64MB，Other 128MB
- **Level**：Beginner

### 题目描述

由于近期的降雨，农夫约翰的田地（一个 N × M 的矩形，1 ≤ N ≤ 100；1 ≤ M ≤ 100）中积攒了许多水洼。每个格子要么是水（'W'），要么是旱地（'.'）。农夫约翰想知道他的田里形成了多少个池塘。池塘定义为一组相连的水洼，每个格子与其八个方向的邻居相邻。

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

**Contest Problem**

- **Time Limit**：C/C++ 1000MS，Other 2000MS
- **Memory Limit**：C/C++ 128MB，Other 256MB

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

### 算法分析

这个问题本质上是在玩一个"拼图游戏"：
1. **目标明确**：要把所有木棒分成 4 组，每组的长度总和必须相等（等于总周长的 1/4）。
2. **递归尝试（DFS）**：拿出一根木棒，尝试把它放进第一条边。如果放得下，就继续放下一根；如果放不下，就把它拿出来，换一根试试。
3. **回溯**：如果发现当前这种组合怎么也拼不成四条等长的边，就"反悔"回到上一步，重新调整之前的选择。

**剪枝优化**：
- **前置检查**：木棒总长度必须能被 4 整除；最长的那根木棒不能超过正方形的边长。
- **搜索优化**：从大到小排序（先尝试长木棒）；相同长度跳过；关键位置剪枝。

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

**Contest Problem**

- **Time Limit**：C/C++ 1000MS，Other 2000MS
- **Memory Limit**：C/C++ 128MB，Other 256MB

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

### 算法分析

回溯法类似于"走迷宫"：
1. **尝试**：按数字从小到大（字典序）尝试填入一个尚未使用的数字。
2. **检查**：检查该数字与前一个数字的和是否为素数。
3. **递归**：如果满足，就去填下一个位置。
4. **回溯**：如果填到最后发现不通，就退回到上一步，换一个数字继续试。

**剪枝**：由于 n 的范围通常较小（如 n ≤ 16），可以直接预处理素数表或使用简单的素数判定。注意题目提示使用"更快的输出方式"，在 C++ 中建议使用 `printf` 代替 `cout`。

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
