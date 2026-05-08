# BFS（广度优先搜索）

## 迷宫问题

### 题目描述

有一个 $5 \times 5$ 的迷宫，其中的 1 表示墙壁，0 表示可以走的路，只能横着走或竖着走，不能斜着走。要求编程序找出从左上角到右下角的最短路线。

数据保证有唯一解。

### 输入格式

一个 $5 \times 5$ 的二维数组，表示一个迷宫。

### 输出格式

左上角到右下角的最短路径，格式如样例所示。

### 样例输入

```
0 1 0 0 0
0 1 0 1 0
0 0 0 0 0
0 1 1 1 0
0 0 0 1 0
```

### 样例输出

```
(0, 0)
(1, 0)
(2, 0)
(2, 1)
(2, 2)
(2, 3)
(2, 4)
(3, 4)
(4, 4)
```

### 算法分析

BFS 算法利用`队列（Queue）`实现。由 BFS 的思想可知，当第一次访问到某个点时，必然是经过最少步数到达的。

为了最后能输出完整的路径，需要额外开辟一个数组（如 `pre[x][y]`）来记录当前格子的"上一个格子"是谁。找到终点后，从终点逆向回溯到起点即可得到完整路线。

### 代码实现

```cpp
#include <iostream>
#include <queue>
#include <vector>
#include <stack>

using namespace std;

// 定义坐标点结构
struct Node {
    int x, y;
};

int maze[5][5];
Node pre[5][5]; // 记录路径：pre[i][j] 存储到达该点的上一个点坐标
bool visited[5][5];

// 方向数组：下、右、上、左
int dx[] = {1, 0, -1, 0};
int dy[] = {0, 1, 0, -1};

void bfs() {
    queue<Node> q;
    q.push({0, 0});
    visited[0][0] = true;

    while (!q.empty()) {
        Node curr = q.front();
        q.pop();

        // 达到右下角终点
        if (curr.x == 4 && curr.y == 4) return;

        for (int i = 0; i < 4; i++) {
            int nx = curr.x + dx[i];
            int ny = curr.y + dy[i];

            // 边界检查、障碍检查及是否访问检查
            if (nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && maze[nx][ny] == 0 && !visited[nx][ny]) {
                visited[nx][ny] = true;
                pre[nx][ny] = curr; // 记录路径
                q.push({nx, ny});
            }
        }
    }
}

int main() {
    // 输入迷宫
    for (int i = 0; i < 5; i++) {
        for (int j = 0; j < 5; j++) {
            cin >> maze[i][j];
        }
    }

    bfs();

    // 路径回溯：从终点 (4,4) 逆推回起点 (0,0)
    stack<Node> path;
    Node temp = {4, 4};
    while (temp.x != 0 || temp.y != 0) {
        path.push(temp);
        temp = pre[temp.x][temp.y];
    }
    path.push({0, 0});

    // 按顺序输出
    while (!path.empty()) {
        Node p = path.top();
        cout << "(" << p.x << ", " << p.y << ")" << endl;
        path.pop();
    }

    return 0;
}
```

---

## 数的变换

### 题目描述

有一个有趣的游戏，从一个数 `K` 开始，然后有三种操作：
1. 当前数乘以 $\times 2$
2. 如果当前数是偶数，可以除以 $\div 2$
3. 当前数加 $+1$

我们的目标是通过最少的操作次数得到数 `P`。数据范围为 $0 < P, K < 100\,000$，并且在操作过程中当前数永远不会大于或等于 $100\,000$。

### 输入格式

第一行是一个数 $T$，表示输入数据的组数。然后输入 $T$ 组数据。

每组数据包含两个整数 `K` 和 `P`，分别表示开始数和目标数。

### 输出格式

输出最少的操作次数，如果不可能由 `K` 经过一些操作得到 `P`，输出 -1。

### 样例输入

```
2
11 20
99999 50000
```

### 样例输出

```
7
-1
```

### 提示

第一组样例中，可进行如下操作：11 → 12 → 6 → 3 → 4 → 5 → 10 → 20。

对第二组样例，尽管我们可以通过 99999 → 100000 → 50000 这样的操作得到答案，但要求任何中间数不能大于等于 100000，所以不可以这样操作。

### 算法分析

BFS 就像是在水中投下一颗石子产生的**涟漪**：

1. **逐层扩展**：从起始数 `K` 出发，第一步能变出的所有数字（通过 `curr * 2`、`curr / 2` 或 `curr + 1`）算作"第一层"。
2. **先到先得**：接着从第一层的所有数字出发，变出它们能达到的、且之前没出现过的数字，算作"第二层"。
3. **最短性保证**：因为我们是按步数一层一层往外找的，所以**第一次**变出目标数 `P` 时，所经过的层数就是最少的操作次数。

**注意**：题目特别强调"操作过程中当前数永远不会大于或等于 $100\,000$"。这意味着在进行 `curr * 2` 或 `curr + 1` 操作时，必须先判断结果是否小于 $100\,000$，否则该操作无效。

### 代码实现

```cpp
#include <iostream>
#include <queue>
#include <cstring>

using namespace std;

const int MAXN = 100000;
int dist[MAXN]; // 记录到达每个数的最少步数，同时充当 visit 数组

int bfs(int k, int p) {
    if (k == p) return 0;

    memset(dist, -1, sizeof(dist));
    queue<int> q;

    q.push(k);
    dist[k] = 0;

    while (!q.empty()) {
        int curr = q.front();
        q.pop();

        // 尝试三种操作
        int next_states[3];
        next_states[0] = curr * 2;         // 操作1: 乘2
        next_states[1] = (curr % 2 == 0) ? curr / 2 : -1; // 操作2: 偶数除2
        next_states[2] = curr + 1;         // 操作3: 加1

        for (int i = 0; i < 3; i++) {
            int next = next_states[i];

            // 检查边界：必须 >0 且 <100000，且未被访问过
            if (next > 0 && next < MAXN && dist[next] == -1) {
                dist[next] = dist[curr] + 1;
                if (next == p) return dist[next]; // 找到目标，直接返回
                q.push(next);
            }
        }
    }
    return -1; // 无法到达
}

int main() {
    int T;
    if (!(cin >> T)) return 0;
    while (T--) {
        int k, p;
        cin >> k >> p;
        cout << bfs(k, p) << endl;
    }
    return 0;
}
```

---

## 非常可乐

### 题目描述

大家一定觉的运动以后喝可乐是一件很惬意的事情，但是 seeyou 却不这么认为。因为每次当 seeyou 买了可乐以后，阿牛就要求和 seeyou 一起分享这一瓶可乐，而且一定要喝的和 seeyou 一样多。

但 seeyou 的手中只有两个杯子，它们的容量分别是 `N` 毫升和 `M` 毫升。可乐的体积为 `S`（`S < 101`）毫升（正好装满一瓶），它们三个之间可以相互倒可乐（都是没有刻度的，且 `S = N + M`，`101 > S > 0`，`N > 0`，`M > 0`）。

聪明的 ACMER 你们说他们能平分吗？如果能请输出倒可乐的最少的次数，如果不能输出 "NO"。

### 输入格式

三个整数：`S` 可乐的体积，`N` 和 `M` 是两个杯子的容量，以 "0 0 0" 结束。

### 输出格式

如果能平分的话请输出最少要倒的次数，否则输出 "NO"。

### 样例输入

```
7 4 3
4 1 3
0 0 0
```

### 样例输出

```
NO
3
```

### 算法分析

这个问题可以类比成"走迷宫"，只不过迷宫的每个"房间"不是坐标，而是**三个容器里可乐的剩余量**：

1. **初始状态**：一共有 S 毫升可乐，分布在容器 (S, 0, 0) 中（瓶子装满，两个杯子为空）。
2. **动作尝试**：每一步你可以尝试从一个容器倒向另一个容器。因为没有刻度，倒水只有两种结果：要么把目标容器**倒满**，要么把源容器**倒空**。
3. **层层递进**：第一步尝试所有可能的倒水组合（共 6 种可能），第二步在产生的新状态基础上再进行一次倒水。
4. **目标达成**：当你发现某次倒完后，其中两个容器的量正好等于 S/2（且 S 必须是偶数，否则无法平分），那么当前的步数就是最少次数。
5. **判重**：为了不反复在同一个状态纠缠，我们用一个三维数组 `visited[s][n][m]` 记录这个状态是否出现过。

### 代码实现

```cpp
#include <iostream>
#include <queue>
#include <cstring>

using namespace std;

struct State {
    int v[3]; // v[0]:S, v[1]:N, v[2]:M
    int step;
};

int cap[3]; // 容量上限
bool vis[101][101][101];

int bfs() {
    if (cap[0] % 2 != 0) return -1; // 奇数无法平分
    int target = cap[0] / 2;

    memset(vis, 0, sizeof(vis));
    queue<State> q;
    q.push({{cap[0], 0, 0}, 0});
    vis[cap[0]][0][0] = true;

    while (!q.empty()) {
        State cur = q.front();
        q.pop();

        // 检查是否达到平分状态（任意两个容器等于 S/2）
        int cnt = 0;
        for(int i = 0; i < 3; i++) if(cur.v[i] == target) cnt++;
        if(cnt == 2) return cur.step;

        // 尝试 6 种倒水方式：从 i 倒向 j
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (i == j) continue;

                State next = cur;
                // 计算倒水量：要么把 j 倒满，要么把 i 倒空
                int pour = min(next.v[i], cap[j] - next.v[j]);
                next.v[i] -= pour;
                next.v[j] += pour;
                next.step = cur.step + 1;

                if (!vis[next.v[0]][next.v[1]][next.v[2]]) {
                    vis[next.v[0]][next.v[1]][next.v[2]] = true;
                    q.push(next);
                }
            }
        }
    }
    return -1;
}

int main() {
    while (cin >> cap[0] >> cap[1] >> cap[2] && (cap[0] || cap[1] || cap[2])) {
        int res = bfs();
        if (res == -1) cout << "NO" << endl;
        else cout << res << endl;
    }
    return 0;
}
```
