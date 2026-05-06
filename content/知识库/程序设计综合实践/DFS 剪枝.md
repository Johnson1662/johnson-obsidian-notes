正方形



Contest Problem
Time Limit：C/C++ 1000MS，Other 2000MS
Memory Limit：C/C++ 128MB，Other 256MB
Description
有n个木棒，需要用上所有木棒，围成一个正方形，如果可以围成正方形，则输出 “yes” , 否则输出"no"。
Input
第一行输入一个整数T表示样例个数。
对于每个样例，第一行输入一个整数N表示木棍的个数，第二行输入N个数字表示木棒的长度。
Output
对于每个样例，如果可以则输出"yes", 否则输出"no"。
Sample Input 1 
3 
4 
1 1 1 1 
5 
10 20 30 40 50 
8 
1 7 2 6 4 4 3 5
Sample Output 1 
yes
no
yes

结合知识库内容，针对“正方形（拼棒问题）”的解答如下：

### 1. 对应算法及出处
* **算法名称**：**深度优先搜索（DFS）** 与 **剪枝优化**。
* **PPT出处**：该题目是经典的“Sticks”问题的变体。相关内容位于《25262程序设计综合实践-第四次课.pdf》的最后部分（“Sticks”案例，约第11-13页）以及《25262程序设计综合实践-第五次课.pdf》关于 DFS 剪枝的部分。

---

### 2. 算法介绍与问题分析
#### 算法介绍（零基础版）
这个问题本质上是在玩一个“拼图游戏”：
1.  **目标明确**：要把所有木棒分成 4 组，每组的长度总和必须相等（等于总周长的 1/4）。
2.  **递归尝试（DFS）**：拿出一根木棒，尝试把它放进第一条边。如果放得下，就继续放下一根；如果放不下，就把它拿出来，换一根试试。
3.  **回溯**：如果发现当前这种组合怎么也拼不成四条等长的边，就“反悔”回到上一步，重新调整之前的选择。

#### 问题分析
如果直接暴力搜索，木棒较多时会产生天文数字般的可能性，导致超时。我们需要进行**剪枝（优化）**：
* **前置检查**：
    * 木棒总长度必须能被 4 整除。
    * 最长的那根木棒不能超过正方形的边长。
* **搜索优化**：
    * **从大到小排序**：先尝试长木棒。因为长木棒更难安置，尽早处理它们可以大幅减少后续无效的搜索分支。
    * **相同长度跳过**：如果当前长度的木棒尝试失败了，那么后面和它一样长的木棒也一定失败，直接跳过。
    * **关键位置剪枝**：如果在尝试拼凑某条边时，放入的第一根木棒就失败了，或者最后一根刚好凑满边长的木棒导致后续失败，那么说明之前的整体布局就有问题，直接回溯。

---

### 3. 简洁高效的代码实现 (C++)

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