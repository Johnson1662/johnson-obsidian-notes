迷宫问题

  

Contest Problem

Time Limit：C/C++ 1000MS，Other 2000MS  
Memory Limit：C/C++ 128MB，Other 256MB  

Description

int maze[5][5] = {

```
0, 1, 0, 0, 0,
0, 1, 0, 1, 0,
0, 0, 0, 0, 0,
0, 1, 1, 1, 0,
0, 0, 0, 1, 0,
```

};它表示一个迷宫，其中的1表示墙壁，0表示可以走的路，只能横着走或竖着走，不能斜着走，要求编程序找出从左上角到右下角的最短路线。

Input

一个5×5的二维数组，表示一个迷宫。数据保证有唯一解。

Output

左上角到右下角的最短路径，格式如样例所示。

Sample Input 1 

0 1 0 0 0
0 1 0 1 0
0 0 0 0 0
0 1 1 1 0
0 0 0 1 0

Sample Output 1 

(0, 0)
(1, 0)
(2, 0)
(2, 1)
(2, 2)
(2, 3)
(2, 4)
(3, 4)
(4, 4)

结合提供的知识库内容，针对该迷宫问题，详细解答如下：

### 1. 对应算法及出处
* [cite_start]**算法名称**：广度优先搜索（Breadth-First Search, BFS） [cite: 1, 250]。
* [cite_start]**PPT出处**：该内容主要位于《25262程序设计综合实践-第五次课.pdf》中关于“迷宫问题-BFS”及“RobotA in Maze”的部分（约第150-196页，或PDF内标号250-281页） [cite: 150, 250]。

### 2. 算法介绍与问题分析
#### 算法介绍（零基础版）
想象你在一个大雾弥漫的迷宫里，为了找到出口且保证路程最短，你雇佣了一群分身协助你：
1.  **逐层扩散**：你站在起点，让分身们同时向四周能走的格子迈出一步。
2.  **避免重复**：每个分身到达新格子后，都会贴上“已访问”标签。如果某个格子已经有标签了，后来的分身就不再进入。
3.  **队列管理**：分身们按照到达的先后顺序排成一队。排在队首的分身继续向四周扩散，产生的新分身排到队尾。
4.  **路径记录**：每个分身在迈进新格子时，都会记住自己是从哪个格子跳过来的。
5.  [cite_start]**先到先得**：第一个到达终点的分身所走的路径，一定就是最短路径，因为它是“同步”向外扩散的 [cite: 27, 257]。

#### 问题分析
* [cite_start]**最短路径性质**：BFS 算法利用队列（Queue）实现。由 BFS 的思想可知，当第一次访问到某个点时，必然是经过最少步数到达的 [cite: 27, 257]。
* [cite_start]**状态表示**：使用坐标 `(x, y)` 记录当前位置 [cite: 66, 260]。
* [cite_start]**路径保存**：为了最后能输出完整的路径，需要额外开辟一个数组（如 `pre[x][y]`）来记录当前格子的“上一个格子”是谁。找到终点后，从终点逆向回溯到起点即可得到完整路线 [cite: 255, 275]。


### 3. 可运行的简洁高效代码 (C++)
[cite_start]参考课件中的代码逻辑 [cite: 260, 275]，以下是针对该题目要求的实现：

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

数的变换

  

Contest Problem

Time Limit：C/C++ 1000MS，Other 2000MS  
Memory Limit：C/C++ 256MB，Other 512MB  

Description

有一个有趣的游戏，从一个数 _K_ 开始，然后有三种操作。

1. 当前数乘以2  
2. 如果当前数是偶数，可以除以2  
3. 当前数加1

我们的目标是通过最少的操作次数得到数 _P_。 数据范围为 0 < _P, K_  < 100000, 并且在操作过程中当前数永远不会大于或等于100000。

  

Input

第一行是一个数_T_, 表示输入数据的组数。然后输入_T_组数据。

  
每组数据包含两个整数 _K_ and _P_ ，分别表示开始数和目标数。

Output

输出最少的操作次数，如果不可能由_K_经过一些操作得到 _P_ ，输出-1。

Sample Input 1 

2
11 20
99999 50000

Sample Output 1 

7
-1

Hint

第一组样例中，可进行如下操作 11 -> 12 -> 6 -> 3 -> 4 -> 5 -> 10 -> 20.

  
对第二组样例，尽管我们可以通过 99999 -> 100000 -> 50000这样的操作得到答案，但要求任何中间数不能大于等于100000，所以不可以这样操作。


结合提供的知识库内容，针对“数的变换”问题解答如下：

### 1. 对应算法及出处

- **算法名称**：**广度优先搜索（Breadth-First Search, BFS）** 。
    
- **PPT出处**：该题目属于典型的**状态空间搜索**问题，在《25262程序设计综合实践-第五次课.pdf》中通过“Catch that cow”案例详细讲解了此类数值变换求最少步数的实现方法（第146页/PPT 335页） 。
    

---

### 2. 算法介绍与问题分析

#### 算法介绍（零基础版）

BFS 就像是在水中投下一颗石子产生的**涟漪**：

1. **逐层扩展**：从起始数 $K$ 出发，第一步能变出的所有数字（通过 $\times 2$、$\div 2$ 或 $+1$）算作“第一层”。
    
2. **先到先得**：接着从第一层的所有数字出发，变出它们能达到的、且之前没出现过的数字，算作“第二层”。
    
3. **最短性保证**：因为我们是按步数一层一层往外找的，所以**第一次**变出目标数 $P$ 时，所经过的层数就是最少的操作次数 。
    

#### 问题分析

- **状态表示**：每一个生成的数字即为一个“状态” 。
    
- **判重处理**：为了避免陷入死循环或重复计算，需要建立一个 `visit` 数组。一旦某个数字被计算过，就不再将其放入队列 。
    
- **边界约束**：题目特别强调“操作过程中当前数永远不会大于或等于 100,000”。这意味着在进行 $\times 2$ 或 $+1$ 操作时，必须先判断结果是否小于 100,000，否则该操作无效。
    
- **终止条件**：如果队列为空仍未找到 $P$，则说明无法到达，输出 -1 。
    

---

### 3. 简洁高效的代码实现 (C++)

C++

```
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