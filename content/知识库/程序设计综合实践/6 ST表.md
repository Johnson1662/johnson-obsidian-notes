# ST表

## Balanced Lineup（平衡的队伍）

**Contest Problem**

- **Time Limit**：C/C++ 5000MS，Other 10000MS
- **Memory Limit**：C/C++ 64MB，Other 128MB

### 题目描述

每天挤奶时，农夫约翰的 $N$ 头奶牛（$1 \le N \le 50\,000$）总是按同样的顺序排成一队。有一天，农夫约翰决定组织一场终极飞盘比赛，选一些奶牛参加。为了简单起见，他将选取队伍中连续的一段奶牛参赛。不过，为了让所有参赛奶牛都玩得开心，它们的身高差不能太大。

农夫约翰列出了一份名单，包含 $Q$（$1 \le Q \le 200\,000$）组候选奶牛及其身高（$1 \le \text{身高} \le 1\,000\,000$）。对于每个候选组，他需要你帮忙计算该组中最高奶牛与最矮奶牛的身高差。

### 输入格式

第 1 行：两个空格分隔的整数 $N$ 和 $Q$。

第 2…$N$+1 行：第 $i$+1 行包含一个整数，表示第 $i$ 头奶牛的身高。

第 $N$+2…$N$+$Q$+1 行：两个整数 $A$ 和 $B$（$1 \le A \le B \le N$），表示要查询的奶牛范围（从 $A$ 到 $B$，包含两端）。

### 输出格式

共 $Q$ 行：每行一个整数，表示该范围内的最高与最矮奶牛的身高差。

### 样例输入

```
6 3
1
7
3
4
2
5
1 5
4 6
2 2
```

### 样例输出

```
6
3
0
```

### 解题思路

使用 ST 表（稀疏表）进行区间最值查询。ST 表可以在 O(1) 时间内回答区间最大值和最小值查询，预处理时间为 O(N log N)。

具体步骤：
1. 预处理 `max_st[i][j]` 和 `min_st[i][j]`，表示区间 `[i, i+2^j-1]` 的最大值和最小值。
2. 对于每个查询 `[l, r]`，找到最大的 k 使得 `2^k ≤ r-l+1`，然后分别从 l 和 r-2^k+1 开始取最值。
3. 输出最大值与最小值之差。

### 代码实现

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
#include <cmath>

using namespace std;

const int MAXN = 50005;
const int LOGN = 17; // 2^16 = 65536 > 50000

int max_st[MAXN][LOGN];
int min_st[MAXN][LOGN];
int lg2[MAXN];

void precompute_logs(int n) {
    lg2[1] = 0;
    for (int i = 2; i <= n; i++) {
        lg2[i] = lg2[i / 2] + 1;
    }
}

int main() {
    // 优化输入输出
    ios::sync_with_stdio(false);
    cin.tie(0);

    int n, q;
    if (!(cin >> n >> q)) return 0;

    precompute_logs(n);

    for (int i = 1; i <= n; i++) {
        int h;
        cin >> h;
        max_st[i][0] = min_st[i][0] = h;
    }

    // 预处理 ST 表
    for (int j = 1; j < LOGN; j++) {
        for (int i = 1; i + (1 << j) - 1 <= n; i++) {
            max_st[i][j] = max(max_st[i][j - 1], max_st[i + (1 << (j - 1))][j - 1]);
            min_st[i][j] = min(min_st[i][j - 1], min_st[i + (1 << (j - 1))][j - 1]);
        }
    }

    // 处理查询
    while (q--) {
        int l, r;
        cin >> l >> r;
        int k = lg2[r - l + 1];
        int res_max = max(max_st[l][k], max_st[r - (1 << k) + 1][k]);
        int res_min = min(min_st[l][k], min_st[r - (1 << k) + 1][k]);
        cout << res_max - res_min << "\n";
    }

    return 0;
}
```
