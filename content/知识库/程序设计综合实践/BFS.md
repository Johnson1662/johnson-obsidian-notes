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