---
title: SQL 语言用法总结
---
## 一、DDL — 数据定义语言

### 1.1 数据库操作

```sql
CREATE DATABASE moviedb;
DROP DATABASE moviedb;
```

### 1.2 建表（CREATE TABLE）

```sql
CREATE TABLE movieexec (
    name      CHAR(30),
    address   VARCHAR(255),
    cert      INT PRIMARY KEY,
    networth  INT
);

CREATE TABLE studio (
    name      CHAR(50) PRIMARY KEY,
    address   VARCHAR(255),
    presc     INT REFERENCES movieexec(cert)
);

CREATE TABLE movies (
    title       CHAR(100),
    year        INT,
    length      INT,
    genre       CHAR(10),
    studioname  CHAR(30),
    producerc   INT,
    PRIMARY KEY (title, year),
    FOREIGN KEY (studioname) REFERENCES studio(name),
    FOREIGN KEY (producerc) REFERENCES movieexec(cert)
);
```

### 1.3 修改表（ALTER TABLE）

```sql
ALTER TABLE MovieStar ADD phone CHAR(16);
ALTER TABLE MovieStar DROP birthdate;
```

### 1.4 删除表（DROP TABLE）

```sql
DROP TABLE R;
```

---

## 二、数据类型

| 类型 | SQL | 说明 |
|------|-----|------|
| 定长字符串 | `CHAR(n)` | |
| 变长字符串 | `VARCHAR(n)` | |
| 定长位串 | `BIT(n)` | |
| 变长位串 | `BIT VARYING(n)` | |
| 布尔 | `BOOLEAN` | TRUE / FALSE / UNKNOWN |
| 整数 | `INT` / `INTEGER` | |
| 短整数 | `SMALLINT` | |
| 单精度浮点 | `FLOAT` / `REAL` | |
| 双精度浮点 | `DOUBLE PRECISION` | |
| 定点数 | `DECIMAL(n, d)` / `NUMERIC` | |
| 日期 | `DATE` | `DATE '1984-05-14'` |
| 时间 | `TIME` | `TIME '15:00:02.5'` |
| 时间戳 | `TIMESTAMP` | `TIMESTAMP '1984-05-14 12:00:00'` |

> **日期/时间操作：**
>
> - 日期文字必须用单引号 + 关键字：`DATE '2024-01-01'`，不能写 `'2024-01-01'`（会被当字符串）
> - 日期可做算术：`DATE '2024-01-10' - DATE '2024-01-01'` → 9（天）
> - 提取分量：`EXTRACT(YEAR FROM DATE '2024-01-10')` → 2024
> - 当前时间：`CURRENT_DATE`、`CURRENT_TIME`、`CURRENT_TIMESTAMP`

---

## 三、DML — 数据操作语言

### 3.1 基本查询（SELECT-FROM-WHERE）

```sql
SELECT <列列表>
FROM <关系列表>
WHERE <条件>;

-- 示例
SELECT title, year
FROM Movies
WHERE length >= 100 AND studioName = 'Fox';
```

### 3.1 SELECT 逻辑执行顺序

理解 SQL 的关键是知道查询各子句的**逻辑执行顺序**（而非书写顺序）：

```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

| 步骤 | 子句 | 作用 |
|------|------|------|
| 1 | FROM | 笛卡尔积生成中间表 |
| 2 | WHERE | 逐行过滤中间表 |
| 3 | GROUP BY | 分组 |
| 4 | HAVING | 逐组过滤（此时可用聚合函数） |
| 5 | SELECT | 投影列 + 计算表达式 |
| 6 | ORDER BY | 排序（此时可引用 SELECT 中的别名） |
| 7 | LIMIT/OFFSET | 截取部分行 |

> 这就是为什么 `WHERE` 中不能用聚合函数（聚合在 GROUP BY 才发生），
> 而 `ORDER BY` 可以用 SELECT 中的别名（这是唯一后于 SELECT 的子句）。

### 3.2 排序（ORDER BY）

```sql
SELECT * FROM Movies
WHERE studioName = 'Disney' AND year = 1990
ORDER BY length, title;       -- ASC 升序（默认）
ORDER BY length DESC;         -- DESC 降序
```

### 3.3 去重（DISTINCT）

```sql
SELECT DISTINCT title, year, length FROM movies;
```

### 3.4 模式匹配（LIKE）

```sql
SELECT title FROM Movies WHERE title LIKE 'Star%';      -- % 匹配任意长度
SELECT title FROM Movies WHERE title LIKE '%''s%';      -- 匹配所有格
SELECT title FROM Movies WHERE title LIKE 'x%%x%' ESCAPE 'x';  -- 转义
```

- `%` 匹配任意长度（含零长度）的字符串
- `_` 匹配单个任意字符
- `ESCAPE` 指定转义字符
- 单引号转义用两个单引号 `''`（不是反斜杠）

### 3.5 空值处理

```sql
x IS NULL
x IS NOT NULL
```

- 对 NULL 使用算术运算符 → NULL
- 对 NULL 使用比较运算符 → UNKNOWN
- WHERE 子句只接受 TRUE，拒绝 FALSE 和 UNKNOWN

### 3.6 插入（INSERT）

```sql
INSERT INTO StarsIn(movieTitle, movieYear, starName)
VALUES ('The Maltese Falcon', 1942, 'Sydney Greenstreet');

INSERT INTO StarsIn
VALUES ('The Maltese Falcon', 1942, 'Sydney Greenstreet');

INSERT INTO Studio(name)
SELECT DISTINCT studioName FROM Movies
WHERE studioName NOT IN (SELECT name FROM Studio);
```

### 3.7 删除（DELETE）

```sql
DELETE FROM StarsIn
WHERE movieTitle = 'The Maltese Falcon' AND movieYear = 1942;

DELETE FROM StarsIn;   -- 清空表
```

### 3.8 更新（UPDATE）

```sql
UPDATE MovieExec
SET name = 'Pres. ' || name
WHERE cert# IN (SELECT presC# FROM Studio);
```

### 3.9 多关系查询（连接）

```sql
SELECT name
FROM Movies, MovieExec
WHERE title = 'Star Wars' AND producerC# = cert#;
```

**元组变量（自连接）：**

```sql
SELECT Star1.name, Star2.name
FROM MovieStar Star1, MovieStar Star2
WHERE Star1.address = Star2.address AND Star1.name < Star2.name;
```

---

## 四、连接（JOIN）

### 4.1 连接类型

```sql
-- 笛卡尔积
SELECT * FROM R CROSS JOIN S;
SELECT * FROM R, S;            -- 旧式写法

-- 自然连接（按共同属性自动匹配）
SELECT * FROM U NATURAL JOIN V;

-- θ-连接（带条件）
SELECT * FROM U INNER JOIN V ON A < D;

-- 带条件 + WHERE 过滤
SELECT * FROM U INNER JOIN V ON A < D WHERE U.B <> V.B;
```

### 4.2 INNER JOIN vs OUTER JOIN

| 类型 | 保留行 | 不匹配时 |
|------|--------|---------|
| `INNER JOIN` | 仅匹配成功的行 | 丢弃 |
| `LEFT OUTER JOIN` | 左表全部保留 | 右表列填 NULL |
| `RIGHT OUTER JOIN` | 右表全部保留 | 左表列填 NULL |
| `FULL OUTER JOIN` | 两表全部保留 | 缺失列填 NULL |

> 自然连接（NATURAL JOIN）自动按同名属性匹配，**不需要写 ON**。但要注意：
> 如果两表有多个同名属性，会全部用于匹配，可能导致意外的结果，生产环境慎用。

### 4.3 JOIN 的执行语义

JOIN 在逻辑上等价于：
1. **FROM 多表** → 笛卡尔积（CROSS JOIN）
2. **ON/WHERE 过滤** → 逐行检查条件

```sql
-- 以下三种写法结果等价（但可读性不同）：
SELECT * FROM R, S WHERE R.x = S.x;                    -- 隐式连接
SELECT * FROM R INNER JOIN S ON R.x = S.x;             -- 显式连接（推荐）
SELECT * FROM R NATURAL JOIN S;                        -- 自然连接（有坑）
```

> 显式 JOIN + ON 是最推荐的写法：条件与过滤分离，可读性高，不易出错。

---

## 五、集合操作

```sql
(SELECT * FROM R) UNION      (SELECT * FROM S);    -- 并（自动去重）
(SELECT * FROM R) INTERSECT  (SELECT * FROM S);    -- 交
(SELECT * FROM R) EXCEPT     (SELECT * FROM S);    -- 差
```

---

## 六、子查询

### 6.1 返回标量

```sql
SELECT name FROM MovieExec
WHERE cert# = (
    SELECT producerC# FROM Movies WHERE title = 'Star Wars'
);
```

### 6.2 返回集合

| 操作符 | 含义 |
|--------|------|
| `EXISTS R` | R 非空时为 TRUE |
| `s IN R` | s 等于 R 中某个值 |
| `s NOT IN R` | s 不等于 R 中任何值 |
| `s > ALL R` | s 大于 R 中所有值 |
| `s > ANY R` | s 大于 R 中至少一个值 |

> **⚠️ NOT IN 的 NULL 陷阱：**
>
> ```sql
> -- 如果子查询结果集中包含 NULL，NOT IN 会返回空集！
> SELECT name FROM MovieExec
> WHERE cert NOT IN (SELECT presC FROM Studio);  -- ⚠️ 若 presC 有 NULL，结果恒空
> ```
>
> 原因：`x NOT IN (1, 2, NULL)` 等价于 `x <> 1 AND x <> 2 AND x <> NULL`。
> 而 `x <> NULL` 结果为 UNKNOWN，AND 短路导致整体为 UNKNOWN。
>
> **安全的替代方案：** 使用 `NOT EXISTS`
> ```sql
> SELECT name FROM MovieExec
> WHERE NOT EXISTS (SELECT 1 FROM Studio WHERE presC = cert);
> ```

```sql
SELECT name FROM MovieExec
WHERE cert# IN (
    SELECT producerC# FROM Movies
    WHERE (title, year) IN (
        SELECT movieTitle, movieYear FROM StarsIn
        WHERE starName = 'Harrison Ford'
    )
);
```

### 6.3 相关子查询

```sql
SELECT title FROM Movies Old
WHERE year < ANY (
    SELECT year FROM Movies
    WHERE title = Old.title
);
```

### 6.4 FROM 子句中的子查询

```sql
SELECT name
FROM MovieExec, (
    SELECT producerC# FROM Movies, StarsIn
    WHERE title = movieTitle AND year = movieYear AND starName = 'Harrison Ford'
) Prod
WHERE cert# = Prod.producerC#;
```

---

## 七、聚合与分组

### 7.1 聚合函数

| 函数 | 含义 |
|------|------|
| `SUM` | 求和 |
| `AVG` | 平均 |
| `MIN` | 最小值 |
| `MAX` | 最大值 |
| `COUNT` | 计数（含 NULL） |
| `COUNT(DISTINCT col)` | 去重计数 |

```sql
SELECT AVG(netWorth) FROM MovieExec;
SELECT COUNT(*) FROM StarsIn;
SELECT COUNT(DISTINCT starName) FROM StarsIn;
```

> **COUNT 的 NULL 行为（常见面试坑）：**
>
> | 写法 | 行为 |
> |------|------|
> | `COUNT(*)` | 统计所有行，无论是否全 NULL |
> | `COUNT(col)` | 统计该列非 NULL 的行数 |
> | `COUNT(DISTINCT col)` | 统计该列非 NULL 的去重值个数 |
> | `AVG(col)` | `SUM(col) / COUNT(col)`，即分母排除了 NULL 行 |
>
> ```sql
> SELECT COUNT(*) FROM R;        -- 结果：5
> SELECT COUNT(A) FROM R;        -- 结果：3（A 列有 2 个 NULL，不计）
> SELECT AVG(A) FROM R;          -- SUM(A) / COUNT(A)，分母是 3 不是 5
> ```

### 7.2 GROUP BY

```sql
SELECT studioName, SUM(length) FROM Movies
GROUP BY studioName;
```

**SELECT 子句规则：** 要么是 GROUP BY 属性，要么是聚合函数。

### 7.3 HAVING

```sql
SELECT name, SUM(length)
FROM MovieExec, Movies
WHERE producerC# = cert#
GROUP BY name
HAVING MIN(year) < 1930;
```

**HAVING vs WHERE 的区别：**

| 特性 | WHERE | HAVING |
|------|-------|--------|
| 执行时机 | GROUP BY **之前**，逐行过滤 | GROUP BY **之后**，逐组过滤 |
| 可用聚合函数 | 否（聚合未发生） | 是 |
| 可用列别名 | 否（SELECT 未计算） | 否（同上） |
| 引用非分组列 | 可以 | 不可以（除非在聚合函数中） |

**逻辑上等价于（伪代码）：**
```python
result = []
for row in table:                  # WHERE 逐行过滤
    if where_condition(row):
        groups[row.group_key].append(row)
for group_key, rows in groups:     # HAVING 逐组过滤
    if having_condition(rows):
        result.append(aggregate(rows))
```

---

## 八、约束

### 8.1 键约束

```sql
PRIMARY KEY (title, year)      -- 主键（实体完整性）
UNIQUE                          -- 唯一键
```

### 8.2 外键约束（参照完整性）

```sql
FOREIGN KEY (studioname) REFERENCES studio(name)
```

**违约处理策略：**

```sql
CREATE TABLE studio (
    name    CHAR(50) PRIMARY KEY,
    address VARCHAR(255),
    presC   INT REFERENCES movieexec(cert)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
```

| 策略 | 说明 |
|------|------|
| 默认（Reject） | 拒绝修改 |
| `ON DELETE/UPDATE CASCADE` | 级联删除/更新 |
| `ON DELETE/UPDATE SET NULL` | 置空 |

**延迟约束检查：**

```sql
CREATE TABLE Studio (
    name  CHAR(30) PRIMARY KEY,
    presC INT REFERENCES MovieExec(cert)
        DEFERRABLE INITIALLY DEFERRED
);

SET CONSTRAINTS MyConstraint DEFERRED;   -- 改为延迟
SET CONSTRAINTS MyConstraint IMMEDIATE;  -- 改为立即
```

### 8.3 CHECK 约束

```sql
-- 属性级
gender CHAR(1) CHECK (gender IN ('F', 'M'))

-- 元组级
CHECK (gender = 'F' OR name NOT LIKE 'Ms.%')

-- 表级 CHECK
CHECK (presc IN (SELECT cert FROM movieexec))
```

### 8.4 默认值

```sql
gender CHAR(1) DEFAULT '?'
phone  CHAR(16) DEFAULT 'unlisted'
```

### 8.5 断言（Assertion）

```sql
CREATE ASSERTION RichPres CHECK (
    NOT EXISTS (
        SELECT * FROM studio, movieexec
        WHERE presC = cert AND netWorth < 10000000
    )
);
```

### 8.6 约束管理

```sql
-- 命名约束
CONSTRAINT nameiskey PRIMARY KEY
CONSTRAINT noandro CHECK (gender IN ('F', 'M'))

-- 删除约束
ALTER TABLE relationName DROP CONSTRAINT constraintName;

-- 添加约束
ALTER TABLE relationName ADD CONSTRAINT constraintName CHECK(...);
```

---

## 九、触发器（Trigger）

```sql
CREATE TRIGGER NetWorthTrigger
AFTER UPDATE OF netWorth ON MovieExec
REFERENCING
    OLD ROW AS OldTuple,
    NEW ROW AS NewTuple
FOR EACH ROW
WHEN (OldTuple.netWorth > NewTuple.netWorth)
BEGIN
    UPDATE MovieExec
    SET netWorth = OldTuple.netWorth
    WHERE cert = NewTuple.cert;
END;
```

**触发时机：** `BEFORE` / `AFTER` / `INSTEAD OF`
**触发粒度：** `FOR EACH ROW`（行级）/ `FOR EACH STATEMENT`（语句级）
**引用对象：** `OLD ROW` / `NEW ROW` / `OLD TABLE` / `NEW TABLE`

> **触发执行模型：**
>
> 如果一个 `UPDATE` 影响了 3 行，触发器行为如下：
>
> ```
> FOR EACH STATEMENT（语句级）：触发 1 次
>   └─ OLD TABLE = 修改前的 3 行快照
>   └─ NEW TABLE = 修改后的 3 行快照
>
> FOR EACH ROW（行级）：触发 3 次，每次处理一行
>   ├─ 第 1 次：OLD ROW = 修改前第 1 行，NEW ROW = 修改后第 1 行
>   ├─ 第 2 次：OLD ROW = 修改前第 2 行，NEW ROW = 修改后第 2 行
>   └─ 第 3 次：OLD ROW = 修改前第 3 行，NEW ROW = 修改后第 3 行
> ```
>
> `BEFORE` 在修改前执行（可修改 NEW ROW 的值），`AFTER` 在修改后执行（可读取修改结果）。

---

## 十、视图与索引

### 10.1 视图

```sql
-- 创建视图
CREATE VIEW DisneyMovies AS
SELECT title, year FROM Movies WHERE studioName = 'Disney';

-- 多表视图
CREATE VIEW MovieProd(movieTitle, prodName) AS
SELECT title, name FROM Movies, MovieExec WHERE producerC = cert;

-- 物化视图
CREATE MATERIALIZED VIEW MovieProd AS
SELECT title, year, name FROM Movies, MovieExec WHERE producerC = cert;

-- 视图修改（有限制）
INSERT INTO DisneyMovies VALUES ('Star Trek', 1979, 'Disney');
DELETE FROM DisneyMovies WHERE title LIKE '%Trek%';
UPDATE DisneyMovies SET year = 2013 WHERE title = 'Frozen';

-- INSTEAD OF 触发器（使视图可修改）
CREATE TRIGGER DisneyInsert
INSTEAD OF INSERT ON DisneyMovies
REFERENCING NEW ROW AS NewRow
FOR EACH ROW
BEGIN
    INSERT INTO Movies(title, year, studioName)
    VALUES(NewRow.title, NewRow.year, 'Disney');
END;
```

### 10.2 索引

```sql
CREATE INDEX YearIndex ON Movies(year);
CREATE INDEX KeyIndex ON Movies(title, year);    -- 多属性索引
DROP INDEX YearIndex;
```

---

## 十一、存储过程与函数

### 11.1 基本语法

```sql
-- 存储过程
CREATE PROCEDURE <name> (<parameter list>)
<body>;

-- 函数
CREATE FUNCTION <name> (<parameter list>) RETURNS <type>
<body>;
```

**参数模式：** `IN`（默认）/ `OUT` / `INOUT`

```sql
CREATE PROCEDURE Move(
    IN oldAddr VARCHAR(255),
    IN newAddr VARCHAR(255)
)
UPDATE MovieStar
SET address = newAddr
WHERE address = oldAddr;

CALL Move('Baldwin Av', 'King St');
```

### 11.2 控制流

```sql
-- IF 语句
IF <condition> THEN <statement(s)>
ELSEIF <condition> THEN <statement(s)>
ELSE <statement(s)> END IF;

-- 循环
LOOP <语句序列> END LOOP;
WHILE <condition> DO <statements> END WHILE;
REPEAT <statements> UNTIL <condition> END REPEAT;
FOR <loop name> AS <cursor name> CURSOR FOR <query> DO <statements> END FOR;

-- LEAVE 跳出循环
my_loop_label: LOOP
    SET counter = counter + 1;
    IF ... THEN LEAVE my_loop_label; END IF;
END LOOP my_loop_label;
```

### 11.3 游标

```sql
DECLARE c CURSOR FOR <query>;
OPEN c;
FETCH FROM c INTO x1, x2, ..., xn;
CLOSE c;
```

**游标循环完整示例：**

```sql
CREATE PROCEDURE MeanVar(IN s CHAR(15), OUT mean REAL, OUT variance REAL)
BEGIN
    DECLARE Not_Found CONDITION FOR SQLSTATE '02000';
    DECLARE MovieCursor CURSOR FOR
        SELECT length FROM Movie WHERE studioName = s;
    DECLARE newLength INTEGER;
    DECLARE moviecount INTEGER;
    SET mean = 0.0; SET variance = 0.0; SET moviecount = 0;
    OPEN MovieCursor;
    movieLoop: LOOP
        FETCH MovieCursor INTO newLength;
        IF Not_Found THEN LEAVE movieLoop; END IF;
        SET moviecount = moviecount + 1;
        SET mean = mean + newLength;
        SET variance = variance + newLength * newLength;
    END LOOP;
    CLOSE MovieCursor;
    SET mean = mean / moviecount;
    SET variance = variance / moviecount - mean * mean;
END;
```

### 11.4 SELECT INTO

```sql
SELECT netWorth INTO presNetWorth
FROM Studio, MovieExec
WHERE presC# = cert# AND Studio.name = studioName;
```

### 11.5 异常处理

```sql
DECLARE Not_Found CONDITION FOR SQLSTATE '02000';
DECLARE EXIT HANDLER FOR Not_Found RETURN NULL;
```

处理动作：`CONTINUE` / `EXIT` / `UNDO`

---

## 十二、事务与并发控制

### 12.1 事务定义

```sql
BEGIN TRANSACTION
    SQL statement 1
    SQL statement 2
COMMIT      -- 提交（永久保存）
ROLLBACK    -- 回滚（撤销所有修改）

-- 隐式声明：每条 SQL 语句就是一个事务
```

### 12.2 隔离级别

```sql
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;     -- 大多数 DBMS 默认
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|----------|------|-----------|------|
| READ UNCOMMITTED | √ | √ | √ |
| READ COMMITTED | × | √ | √ |
| REPEATABLE READ | × | × | √ |
| SERIALIZABLE | × | × | × |

---

## 十三、DCL — 数据控制语言

### 13.1 授权（GRANT）

```sql
GRANT SELECT, INSERT ON Studio TO kirk, picard WITH GRANT OPTION;
GRANT SELECT ON Movies TO kirk, picard WITH GRANT OPTION;
```

**9 种权限：** SELECT, INSERT, DELETE, UPDATE, REFERENCES, USAGE, TRIGGER, EXECUTE, UNDER

### 13.2 撤销（REVOKE）

```sql
REVOKE SELECT, INSERT ON Studio FROM picard CASCADE;
REVOKE SELECT, INSERT ON Studio FROM picard RESTRICT;
```

- `CASCADE`：级联撤销
- `RESTRICT`：若已转授则报错

### 13.3 视图的访问控制

```sql
CREATE VIEW SafeEmps AS
SELECT name, addr FROM Emps;
-- 用户只需 SafeEmps 权限，无需底层表权限
```

---

## 十四、SQL 三值逻辑

SQL 使用三值逻辑：TRUE、FALSE、UNKNOWN（NULL 参与比较的结果）。

| x | y | x AND y | x OR y | NOT x |
|---|---|---|---------|--------|
| T | T | T | T | F |
| T | U | U | T | F |
| T | F | F | T | F |
| U | U | U | U | U |
| U | F | F | U | U |
| F | F | F | F | T |

> **关键规则：** WHERE 只接受 TRUE，UNKNOWN 和 FALSE 都不通过。

### 三值逻辑的实践影响

| 场景 | 问题 | 正确写法 |
|------|------|---------|
| `x = NULL` | 永远返回 UNKNOWN，不会选出任何行 | 应写 `x IS NULL` |
| `NOT IN` 含 NULL | 结果恒为空（见 §6.2） | 用 `NOT EXISTS` 替代 |
| `WHERE x <> 10` | NULL 行会被排除（`NULL <> 10` = UNKNOWN） | 如需保留：`x <> 10 OR x IS NULL` |
| CHECK 约束 | CHECK 中 UNKNOWN 视同通过（不违规），与 WHERE 相反 | 设计约束时要注意 NULL 行为 |

> **记忆口诀：** NULL 参与比较 → 结果 UNKNOWN。UNKNOWN 在 WHERE 中被拒，在 CHECK 中被放行。

---

## 十五、常用模式速查

```sql
-- DDL
CREATE DATABASE / CREATE TABLE / ALTER TABLE / DROP TABLE / DROP DATABASE

-- DML
SELECT ... FROM ... WHERE ... ORDER BY / GROUP BY / HAVING
INSERT INTO ... VALUES / INSERT INTO ... SELECT
DELETE FROM ... WHERE
UPDATE ... SET ... WHERE

-- DCL
GRANT ... TO ... [WITH GRANT OPTION]
REVOKE ... FROM ... [CASCADE | RESTRICT]

-- TCL
BEGIN TRANSACTION / COMMIT / ROLLBACK

-- 集合
UNION / INTERSECT / EXCEPT

-- 连接
R NATURAL JOIN S / R INNER JOIN S ON cond / R CROSS JOIN S / R, S

-- 子查询
IN / NOT IN / EXISTS / NOT EXISTS / > ALL / > ANY

-- 模式匹配
LIKE '%...%' / LIKE '..._' / ESCAPE 'x'

-- 空值
IS NULL / IS NOT NULL

-- 聚合
SUM / AVG / MIN / MAX / COUNT / COUNT(DISTINCT ...)

-- 约束
PRIMARY KEY / FOREIGN KEY ... REFERENCES / UNIQUE / NOT NULL
CHECK / DEFAULT / CONSTRAINT ... DEFERRABLE

-- 高级对象
CREATE VIEW / CREATE MATERIALIZED VIEW
CREATE INDEX / DROP INDEX
CREATE TRIGGER ... BEFORE/AFTER/INSTEAD OF ... FOR EACH ROW/STATEMENT
CREATE PROCEDURE / CREATE FUNCTION
CREATE ASSERTION
```

---
