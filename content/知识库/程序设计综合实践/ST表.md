# ST表

## Balanced Lineup

**Contest Problem**

- **Time Limit**：C/C++ 5000MS，Other 10000MS
- **Memory Limit**：C/C++ 64MB，Other 128MB

### Description

For the daily milking, Farmer John's *N* cows (1 ≤ *N* ≤ 50,000) always line up in the same order. One day Farmer John decides to organize a game of Ultimate Frisbee with some of the cows. To keep things simple, he will take a contiguous range of cows from the milking lineup to play the game. However, for all the cows to have fun they should not differ too much in height.

Farmer John has made a list of *Q* (1 ≤ *Q* ≤ 200,000) potential groups of cows and their heights (1 ≤ *height* ≤ 1,000,000). For each group, he wants your help to determine the difference in height between the shortest and the tallest cow in the group.

### Input

Line 1: Two space-separated integers, *N* and *Q*.

Lines 2…*N*+1: Line *i*+1 contains a single integer that is the height of cow *i*

Lines *N*+2…*N*+*Q*+1: Two integers *A* and *B* (1 ≤ *A* ≤ *B* ≤ *N*), representing the range of cows from *A* to *B* inclusive.

### Output

Lines 1…*Q*: Each line contains a single integer that is a response to a reply and indicates the difference in height between the tallest and shortest cow in the range.

### Sample Input

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

### Sample Output

```
6
3
0
```

### Solution

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
