# 语义 Web (Semantic Web) 全体系深度解析

> [!info] 学习目标
> 深入理解从“文档互联”到“数据互联”的架构跃迁，掌握 RDF 数据模型、Turtle 语法规范以及 RDFS 的逻辑蕴含规则。

---

## 一、 万维网的进化：从 Document Web 到 Data Web

### 1. 现状：文档网 (Web of Documents)

- **核心单位**：HTML 网页。
- **连接方式**：超链接 (Hyperlinks)。
- **局限性**（PPT 32页）：
  - **人读 vs 机器读**：HTML 描述的是展示格式（加粗、字体），而不是内容含义。
  - **歧义性**：搜索 "Jaguar"，机器无法区分是动物、汽车还是操作系统。

### 2. 愿景：数据网 (Web of Data)

- **核心单位**：资源/事物 (Things/Entities)。
- **连接方式**：**有类型的链接 (Typed Links)**。链接本身具有语义（例如：`isAuthorOf`, `bornIn`）。
- **智能代理 (Agents)**：机器可以自动遍历这些链接，执行跨站点的复杂任务（如：自动预订一套符合所有偏好的旅游行程）。

---

## 二、 语义网标准技术栈 (The Layer Cake)

这是 PPT 36-37 页的核心架构图，理解语义网必须理解这层“蛋糕”：

1.  **URI/IRI & Unicode**：基础层。确保每个事物都有全球唯一的“身份证”。
2.  **XML**：语法层。提供基础的数据包装格式。
3.  **RDF (Resource Description Framework)**：**核心数据层**。将事实拆解为三元组。
4.  **RDFS & OWL**：**模式与本体层**。定义类、属性和复杂的逻辑约束。
5.  **SPARQL**：**查询层**。在图数据中进行模式匹配查询。
6.  **Logic, Proof, Trust**：高层应用。确保推理过程可信、可验证。

---

## 三、 RDF：资源描述框架 (PPT 38-57页)

### 1. 核心三要素 (RDF Terms)

- **URIs**：全局资源标识符。例如：`dbr:Beijing`。
- **Literals (字面量)**：数据值。
  - **带语言标签**：`"北京"@zh`, `"Beijing"@en`。
  - **带数据类型**：`"2024-03-15"^^xsd:date`, `"100"^^xsd:integer`。
- **Blank Nodes (匿名节点)**：表示没有全局 ID 的节点。
  - **用途**：当一个属性的值包含多个部分时（例如：地址由街道、城市、邮编组成）。

### 2. RDF 三元组 (Triple) 模型

知识的原子单位是：**(Subject, Predicate, Object)**。

- **谓语 (Predicate)** 必须是 URI，表示属性或关系。
- **数学定义** (PPT 39页)：$(s, p, o) \in (U \cup B) \times U \times (U \cup B \cup L)$。

### 3. Turtle 语法实战 (PPT 41-44页)

这是考试和工程中最常用的格式。

#### 示例 1：从基础到简写

**原始三元组 (N-Triples):**

```nt
<http://example.org/Alice> <http://example.org/knows> <http://example.org/Bob> .
<http://example.org/Alice> <http://example.org/age> "25"^^<http://www.w3.org/2001/XMLSchema#integer> .
```

**Turtle 简写 (Prefixes + Semicolon):**

```turtle
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:Alice :knows :Bob ;      # 分号表示复用主语 :Alice
       :age 25 .          # 整数会自动识别为 xsd:integer
```

#### 示例 2：复用谓语 (Comma)

```turtle
:Alice :hobby "Reading" , "Coding" , "Hiking" .
# 等价于三个三元组，主语都是 Alice，谓语都是 hobby
```

### 4. 匿名节点 (Blank Nodes) 深度示例

**任务**：描述“Alice 的住址是北京中关村”。由于住址由城市和街道组成，我们不能直接连到“北京”，需要一个中间节点。

```turtle
:Alice :hasAddress [
    :city :Beijing ;
    :street "Zhongguancun"
] .
# 方括号 [] 创建了一个匿名节点。Alice 指向它，它再指向城市和街道。
```

### 5. RDF 容器与集合

- **`rdf:Bag` (无序)**：如一袋子苹果。
- **`rdf:Seq` (有序)**：如一本书的章节顺序。
- **`rdf:List` (封闭集合)**：使用 `( :item1 :item2 )` 语法。

---

## 四、 RDFS：RDF 的模式层 (PPT 58-67页)

### 1. 核心词汇及其推理意义

RDFS 不仅仅是标签，它带有**逻辑蕴含**。

#### 示例 3：层级推理 (subClassOf)

- **定义**：`:Doctor rdfs:subClassOf :Person .`
- **事实**：`:GregoryHouse rdf:type :Doctor .`
- **机器推理**：`:GregoryHouse rdf:type :Person .` (自动推导出 House 也是人)

#### 示例 4：属性约束推理 (Domain & Range)

这是 PPT 61 页的重点。

- **定义谓语**：`:hasWife rdfs:domain :Man ; rdfs:range :Woman .`
- **输入事实**：`:John :hasWife :Mary .`
- **机器推理**：
  1.  John 自动获得类型 `:Man`。
  2.  Mary 自动获得类型 `:Woman`。

### 2. RDFS 推理规则表 (Entailment Rules)

掌握 PPT 第 62 页的 13 条规则。例如：

- **rdfs7**: 如果 $p \sqsubseteq q$，且存在 $(s, p, o)$，则必有 $(s, q, o)$。
  - _例：如果“导师”是“老师”的子属性，张三是李四的导师，那么张三也是李四的老师。_

---

## 五、 简单模型理论 (Simple Models)

PPT 66-67 页讨论了三元组的真值判定。

- 一个三元组 $(s, p, o)$ 在解释 $\mathcal{I}$ 下为**真**，当且仅当映射后的对 $(s^\mathcal{I}, o^\mathcal{I})$ 属于谓语的解释集合 $p^\mathcal{I}$ 中。
- 这就像是在判断：**“在这个虚拟世界中，主语和宾语之间是否真的存在这条连接线？”**

---

## 六、 进阶：RDF 重构 (Reification) —— 对陈述的陈述

PPT 第 53-57 页提到如何描述“张三认为蒙娜丽莎在卢浮宫”。

```turtle
# 使用中间节点描述一个“声明”
:statement1 a rdf:Statement ;
    rdf:subject :Mona_Lisa ;
    rdf:predicate :locatedIn ;
    rdf:object :Louvre .

:ZhangSan :believes :statement1 .
# 这样我们就把一个三元组变成了另一个三元组的宾语。
```
