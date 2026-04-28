# Lecture 4

# Entity-Relationship Model (part 1)

ER模型

(第1部分)

# Outline

• The Entity/Relationship Model   
Design Principles   
• Constraints in the E/R Model   
Weak Entity Sets

# Outline

• The Entity/Relationship Model   
Design Principles   
• Constraints in the E/R Model   
Weak Entity Sets

# Database Design Phase

• The database modeling and implementation process

![](images/22394e777c694ddba0e068354a0d841e3a8b4f3a122feba8abc37e1e1df28e1e.jpg)

# The Entity/Relationship Model

![](images/f94e373e2bb0860c6384ee757b06540d481577a26f27c7fba3081d3e4e45e5f2.jpg)

• The Entity/Relationship Model 实体/联系 模型

E/R Model

E/R Diagram

E/R 模型

E/R 图

Dr. Peter Chen

陈品山博士

1976年发明了E/R模型

– Entity sets 实体集  
– Attributes 属性  
– Relationships 联系

[P.P.S. Chen. The Entity Relationship Model – Towards a Unified View of Data. ACM Transactions on Database Systems, 1(1):9–36, 1976]

# Entity Sets

Entity

– An abstract object of some sort

Entity set

– A collection of similar entities forms an entity set

E/R Model

Entity

Entity set

OO Programming

Object

Class

# Entity Sets

• Example (Movie-database)

– Entity   
• A movie   
• A star   
• A studio

– Entity set

• The set of all movies   
• The set of all stars   
• The set of studios

# Attributes

# Attributes 属性

– Entity sets have associated attributes, which are properties of the entities in that set.

# Example

– The entity set Movies

• Might be given attributes such as title and length

# Assume

– Attributes are of primitive types, such as strings, integers, or reals

# Relationships

• Relationships 联系

– Connections among two or more entity sets

Example

– Two entity sets: Movies and Stars   
– Relationship: Stars-in

that connects movies and stars

– The intent

• A movie entity m is related to a star entity s by the relationship Stars-in if s appears in movie m

# Entity-Relationship Diagrams

# • E/R Diagram E/R图

– An E/R diagram is a graph representing entity sets, attributes, and relationships

Elements Nodes

Entity sets Rectangles 矩形

Attributes Ovals 椭圆

Relationships Diamonds 菱形

# – Edges

• Connect an entity set to its attributes and also connect a relationship to its entity sets.

# Entity-Relationship Diagrams

# Example 4.2

![](images/8fba24ba93c5cf5bc9e772d067019bf69bf7eb18270da485180208601bff28ec.jpg)

# Instances of an E/R Diagram

Entity set E

– A particular finite set of entities

Relationship R

Relationship set of R 联系集  
– Connects n entity sets E1, E2, …, En   
– “Instance”: a finite set of tuples $( e _ { 1 } , e _ { 2 } , . . . , e _ { n } )$

$$
e _ {i} \in E _ {i}
$$

# Instances of an E/R Diagram

# Example

– An instance of the Stars-in relationship

<table><tr><td>Movies</td><td>Stars</td></tr><tr><td>Basic Instinct</td><td>Sharon Stone</td></tr><tr><td>Total Recall</td><td>Arnold Schwarzenegger</td></tr><tr><td>Total Recall</td><td>Sharon Stone</td></tr></table>

# Multiplicity of Binary E/R Relationships

# • Multiplicity of Binary Relationships

– R is a relationship connecting entity sets E and F

# many-one 多对一

• If each member of $E$ can be connected by $R$ to at most one member of $F$ , then we say that $R$ is many-one from $E$ to $F$ .

(Note that in a many-one relationship from $E$ to $F$ , each entity in $F$ can be connected to many members of $E$ .)

• If each member of $F$ can be connected by $R$ to at most one member of $E$ , then we say that $R$ is many-one from $F$ to $E$ . (or equivalently, one-many from $E$ to F). 一对多

# Multiplicity of Binary E/R Relationships

• Multiplicity of Binary Relationships

– R is a relationship connecting entity sets E and F

many-one 多对一

实体集E

![](images/ec57573137e28bfd4f86b735599f02a71c586535c275eab454de4981f7a0f33f.jpg)

one-many 一对多

实体集E

![](images/d3ca0132b5e1b664f0e3eb2fa23781a6d303fd522f52d908f5cd0c6c9ab0dc44.jpg)

# Multiplicity of Binary E/R Relationships

# • Multiplicity of Binary Relationships

– R is a relationship connecting entity sets E and F

# one-one 一对一

• If R is both many-one from $E$ to $F$ and many-one from $F$ to $E$ , then we say that R is one-one.

(In a one-one relationship an entity of either entity set can be connected to at most one entity of the other set.)

![](images/04dca2ae9108738c8013ca20e41217576a5a5acccc6e0a8a68a7cc3caba9971e.jpg)

# Multiplicity of Binary E/R Relationships

• Multiplicity of Binary Relationships

– R is a relationship connecting entity sets E and F

many-many 多对多

• If R is neither many-one from $E$ to $F$ or from $F$ to $E$ , then we say that R is many-many.

实体集E

![](images/71d20a8f5d7410e72450988a11add8ea28f0b490cd3be3e6eda996a50a105e6b.jpg)

实体集F

# Multiplicity of Binary E/R Relationships

# • Multiplicity of Binary Relationships

– R is a relationship connecting entity sets E and F   
– If a relationship is many-one from E to F, then we place an arrow entering F

![](images/9dbdd85829a9b72c633fbd69c1c5ca9c6a3f8762c0ec57ea9e06310fceb43fcb.jpg)

# Multiplicity of Binary E/R Relationships

# Example

– A one-one relationship

![](images/8d87994c7533a606608cb88d4da7cb78fe95eab7498cb1e902bd0f1a4b1d4913.jpg)

# Multiway Relationship

• Multiway Relationship 多路联系

– In practice, ternary or higher-degree relationships are rare, but they occasionally are necessary to reflect the true state of affairs.

E Example

– A relationship Contracts

![](images/6204deb09326a1a5e0d51918f3630ac3eebbbb4172db054761d572acf31211fe.jpg)

# Multiway Relationship

# Example

– A relationship Contracts   
– An arrow pointing to E

• If we select one entity from each of the other entity sets in the relationship, those entities are related to at most one entity in E.   
• Functional Dependency All the other entity sets → E

# Roles in Relationships

• Roles in Relationships 联系中的角色

– Each line to the entity set represents a different role that the entity set plays in the relationship

• Label the edges by names, “roles”

Exampl

![](images/90a0034e89532bd45ec8a8b69ff80c51549c7fbc51294dfa5d6e49e0d953436a.jpg)

# Roles in Relationships

# Example

– Both a multiway relationship and an set with multiple r

(studio1, studio2, star, movie)

studio2 contracts with studio1 for the use of studio1’s star by studio2 for the movie

![](images/b392ed8fed2bd6c13c81610fa65bb4658cf7acc5bec8f26550cbf3381cbd8908.jpg)

# Attributes on Relationships

# Example

– Sometimes it is convenient, or even essential, to associate attributes with a relationship

![](images/9a384bd11c5ca34a94d63d13a8a2c4802b796755d873b290938c5cb291b5e933.jpg)

# Attributes on Relationships

# • Ex

![](images/d1c75b494e5fa90bef8892ca5f479904ffdd26cb4aaf57df7722c92d7c9cff0b.jpg)

# Converting Multiway Relationships to Binary

# Example

– Any multiway relationship can be converted to a collection of binary, many-one relationships

![](images/0000496b4f24899ea18fae0e3825416f9d38f261820300573e5c72bab4976be9.jpg)

# Subclasses in the E/R Model

# Subclasses 子类

– Special-case entity sets, or subclasses, each with its own special attributes and/or relationships   
isa relationship

• A one-one relationship   
• Although not draw the two arrows

![](images/3dd979ef394b6f73bcb087f4710ecb3320c80c876b7206ea0817d8f67000452e.jpg)

# Outline

• The Entity/Relationship Model   
• Design Principles   
• Constraints in the E/R Model   
Weak Entity Sets

# Design Principles

# • Faithfulness 忠实性

– The design should be faithful to the specifications of the application

# Design Principles

# • Avoiding Redundancy 避免冗余

– We should be careful to say everything once only

# – For instance

• We have used a relationship Owns between movies and studios   
• We might also choose to have an attribute studioName of entity set Movies

# Design Principles

• Simplicity Counts 简单性

– Avoid introducing more elements into your design than is absolutely necessary

Example

– A poor design with an unnecessary entity set

![](images/5e63b28267375b81271b7b5466986e4e532c0a3d62b1821e229dc16a6bbfde8e.jpg)

# Design Principles

• Choosing the Right Relationship选择正确 的

– Example

![](images/30636758d85349ebf3aad644fa7d9ae443f7a4e4fdeadd9f7aa82d8c8464edbc.jpg)

# Design Principles

• Choosing the Right Relationship 选择正确

– Example

![](images/fc8e884d46e06ae012747dafd6d19943804693e4e30435fc3dbe7a39deb63ec8.jpg)

# Design Principles

• Picking the Right Kind of Element 选择正确的元素种类

– Many of these choices are between

• using attributes   
• using entity set / relationship combinations

– In general

• an attribute is simpler to implement

– However,

• making everything an attribute will usually get us into trouble

# Design Principles

• Picking the Right Kind of Element 选择正确的元素种类

– Conditions under which we prefer to use an attribute instead of an entity set Suppose E is an entity set

1. E must be the “one” is many-one relationships   
2. The only key for E is all its attributes   
3. No relationship involves E more than once

# Outline

• The Entity/Relationship Model   
Design Principles   
• Constraints in the E/R Model   
Weak Entity Sets

# Constraints in the E/R Model

# Constraints

– Keys 键   
– Functional dependencies 函数依赖   
– Referential-integrity 参照完整性

# Keys in the E/R Model

# • Key

– Every entity set must have a key   
– There can be more than one possible key for an entity set. It is customary to pick one key as the “primary key”   
When an entity set is involved in an isa-hierarchy, we require that the root entity set have all the attributes needed for a key

# Representing Keys in the E/R Model

# Example

– Underline the attributes belonging to a key

![](images/c4cd13f86c3c0a2a9964c59e612c74fbf1c79eb690e14c185821a8364327b1a8.jpg)

# Referential Integrity

# Notation

– Suppose R is a relationship from E to F   
– A rounded arrow-head pointing to F indicates

• not only that the relationship is many-one from E to F,   
• but that the entity of set $F$ related to a given entity of set E is required to exist

![](images/2d3015258ef34b08c67a23b185e99c28bbb0fc572e750fe0078727e1b97f2e46.jpg)

# Degree Constraints

Notation

– Attach a bounding number to the edges

Example

– A movie entity cannot be connected by relationship Stars-in to more than 10 star entities

![](images/91ec368f1531dab326cec0092ee1b6a7dc1cd223b109566af3526e389a3092f2.jpg)

# Outline

• The Entity/Relationship Model   
Design Principles   
• Constraints in the E/R Model   
• Weak Entity Sets

# Weak Entity Sets

# Weak entity set 弱实体集

– An entity set’s key is composed of attributes, some or all of which belong to another entity set

# Causes of Weak Entity Sets

# Two principal reasons

# – First

If entities of set E are subunits of entities in set $F$ , then it is possible that the names of $E$ -entities are not unique until we take into account the name of the $F$ -entity to which the E entity is subordinate.

# – Example

![](images/55f122df1a576c0c7041d3661c3bb41313495084eeef244465d90978994e9b8c.jpg)

# Causes of Weak Entity Sets

# Two principal reasons

# – First

If entities of set E are subunits of entities in set $F$ , then it is possible that the names of $E$ -entities are not unique until we take into account the name of the $F$ -entity to which the E entity is subordinate.

# – Example

![](images/aa0f03f1d78cee8874403189c9cd9141b77ea86931d6a969ee6e5243b0cc4953.jpg)

# Causes of Weak Entity Sets

# Two principal reasons

# – Second

The connecting entity sets that are introduced as a way to eliminate a multiway relationship. These entity sets often have no attributes of their own. Their key is formed from the attributes that are the key attributes for the entity sets they connect.

# Causes of Weak Entity Sets

# Two principal reasons

# Second

The connecting entity sets that are introduced as a way to eliminate a multiway relationship.

# – Example

salary

Contracts

Star-of

Stars

name

address

name

Studio-of

Studios

ldress

Movie-of

Movies

genre

length

year

# Requirements for Weak Entity Sets

# • Key attributes for a weak entity set E

1. Zero or more of its own attributes, and   
2. Key attributes from entity sets that are reached by certain many-one relationships from E to other entity sets

• These many-one relationships are called supporting relationships for $E$ , and 支持联系   
• the entity sets reached from E are supporting entity sets 支持实体集

# Requirements for Weak Entity Sets

# • R to be a supporting relationship for E

The following conditions must be obeyed:

a) R must be a binary, many-one relationship from E to F   
b) R must have referential integrity from E to F   
c) The attributes that $F$ supplies for the key of $E$ must be key attributes of F   
d) If F is itself weak, then some of the key attributes of F supplied to E will be key attributes of the entity set G to which F is connected by a supporting relationship (Recursively)

# Requirements for Weak Entity Sets

# • R to be a supporting relationship for E

The following conditions must be obeyed:

e) If there are several different supporting relationships from E to the same entity set $F$ , then each relationship is used to supply a copy of the key attributes of $F$ to help form the key of $E$ .

Note that an entity e from $E$ may be related to different entities in $F$ through different supporting relationships from F. Thus, the keys of several different entities from $F$ may appear in the key values identifying a particular entity e from E.

# Weak Entity Sets Notation

# Notations

1. If an entity set is weak, it will be shown as a rectangle with a double border   
2. Its supporting many-one relationship will be shown as diamonds with a double border   
3. If an entity set supplies any attributes for its own key, then those attributes will be underlined

# Weak Entity Sets Notation

# The following rule

Whenever we use an entity set E with a double border, it is weak. The key for E is whatever attributes of E are underlined plus the key attributes of those entity sets to which E is connected by many-one relationships with a double border.