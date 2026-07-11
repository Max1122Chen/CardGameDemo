## Meta

- **Status:** Draft
- **Owner:** 麦克斯大大
- **Last updated:** 2026-07-09
- **Depends on:** [core-loop.md](./core-loop.md),  [equipment-and-cards.md](./equipment-and-cards.md), [attributes.md](./attributes.md)
- **See also:** [Overview.md](../Overview.md), [GASDocumentation](https://github.com/tranek/GASDocumentation#concepts-ga), [effects.md](./effects.md)

## TL;DR

本章定义 CardGameDemo 的规则机器框架：Attribute/Tag/GE/GA/Event 及其统一承载组件。  
核心目标是支持复杂效果结算与状态变化，并保持高可扩展性与可调试性。  
框架必须支持多运行模式，尤其是可独立启动的战斗模式与控制台调试模式。



# Gameplay Framework

本章节描述的是游戏中最为关键的一些”机制“，它们构成了游戏最重要的规则。



先看一些我们需要解决的问题和现有的解决方案。

### 数值的表示——Attribute & AttributeSet

在游戏中往往涉及大量的数值计算，它们可能是”攻击力“”力量“”生命值“”暴击率”等等。

在实际的设计中，”属性“在程序中往往是一种特殊的数据类型，其看似是一个值其实实际上应当由两个值和若干运算组成，”属性“由基础值"BaseValue"和当前值"CurrentValue"组成。

BaseValue和CurrentValue正如其名，它们有不同的含义，例如考虑一个角色初始拥有12点力量属性，这12点力量就是”力量“属性的基础值，之后角色使用了一瓶力量药水，获得持续1个回合的力量+1，角色获得了一个持续两回合的Buff，使得力量+25%，那么这两种对属性的修改应该如何作用？

从单纯数学的角度上来看，逻辑上计算顺序应该是先计算基础的12点力量加上临时的1点力量药水加成，然后结果再乘(100%+25%)，写成数学公式就是(12 + 1) * (100% + 25%)，此时算出来力量值是16.25。

如果我们只维护一个浮点数，那么在数据中未来力量值就永远是16.25了。这样的问题在于当力量药水的Buff到期之后，应该如何削减力量值？显然16.25-1这样是错误的，使得它正确的算法是((16.25 / 125%) - 1) * 125%，但这非常糟糕，这要求一个参数变化时，算法需要先逆转其他参数的作用，而且这某种程度上需要算法全知。

所以CurrentValue是用于保存基于BaseValue和一系列计算的结果的值。



AttributeSet是一系列Attribute的集合，便于通过Character组合AttributeSet而不是定义某种CharacterBase来在多种Character间复用同一系列Attribute，仅此而言。



### 数值结算的问题与解决——Modifier

考虑这样一个情形，虽然这个情形可能并不出现在我们的游戏中，但在RPG游戏中很常见：

单位拥有攻击力。

现在一个单位的攻击力基础值是10，它发起攻击的同时又有以下效果参与：武器面板加持——攻击+10，狂暴状态——攻击+25%，虚弱状态——攻击-10%，假设初始按照先算基础攻击力+武器面板再算攻击百分比的算法，百分比部分按加法先加后乘，那么计算式是(10+10)*(100% + 25%-10%) = 23.被计算好的“攻击力”就静静地写在单位身上。

这初看下来似乎没有什么难度，但很快问题就来了，假设这时单位脱除了装备，按正常的逻辑来看，单位的攻击力绝不是变成（23-10）=13，而是应该用上面的公式重新运算，变成(10) * 115% = 11.5

这说明了一个问题，属性系统的交互绝不是简单的加减乘除这么简单，而是涉及明确的“算法”，属性的更新绝不是听见“+25%”就立马给当前数值*125%这么简单，必须明确一种“算法”。但是如何定义相应的算法？我们现在的这个情形很容易让人想出使用一条公式即可，例如：

(基础攻击力 + 武器面板) * Σ攻击倍率，只要代入参数计算即可，但这在程序的角度上非常不妙，假如仅仅只是在代码中写入这条计算公式，那么假设以后有任何对攻击力计算方式的修改，都必须侵入式地修改整条公式，并且攻击力计算的额外的潜在需求理论上是无限多的，如果每个版本想到一个新的因素加进去就修改一次公式，那么这条公式是非常不稳定的，并且很可能无限膨胀。

一个巧妙的解法是把“公式”变成“流水线（Pipeline）”，把公式中的各个部分抽取成流水线上的环节，以合理的方式连接起来，计算的过程即是数据在流水线上的流动处理，这样一来，无论是增加因子还是减少因子，流水线本身的架构不变，变化的是组成流水线的部件，只要很简单地增设/移除部件就能实现算法的变化。

在现在的相关架构中，常把上面描述的流水线的“环节”的一种类似设计称为Modifier，例如在Epic的UE的Gameplay Ability System（GAS）中。

和我们上面描述的流水线“环节”有些不同，它的计算方式并不符合”流水线“，Modifier的作用方式是”聚合“而不是”流水“，有一个Aggregator负责把当前和一个Attribute相关的所有Modifier收集起来并且按设计好的算法计算。这使得多个Modifer的应用时序并无影响，不会有先后冲突，应用时序只与使用的Operation相关。

Modifier往往有这些要素：

- Target Attribute：这个Modifer要修改的Attribute

- Modifier Operation：运算，通常有加、乘、除、覆盖（Override）（减法即是加的逆运算）

- Modifier Magnitude：把Modifier看作是Op(TargrtAttr, Magnitude)这样的函数就可理解Magnitude的意义

  Modifier Magnitude可以是简单的浮点数Scalable Float，可以由Modifier的发起者设置数值Set By Caller，甚至可以捕获特定Attribute，以及更为复杂的Custom Calculation

  捕获Attribute用于计算时，可以控制捕获的Attribute的来源是Modifier的发起者Source还是它的目标Target，并且可以简单地设置如何使用捕获的Attribute用于计算

通过组合Modifier，就可以实现非常丰富的数值计算需求，这同时也解释了为什么我们要把”伤害“、”倍率“、“修正”这些值也设计成“属性”。这样一来，考虑“伤害”的计算，我们就不再会在各种乘法加法以及执行顺序中迷失，“造成伤害+XX%”是对“伤害倍率”的一个加法运算Modifier，“伤害修正*XX”是对“伤害修正”的一个乘法运算Modifier，“造成的伤害+X”是对“伤害偏移”的一个加法Modifer，而（实际上GAS的Modifer中并不支持Post Add这种计算，Add总是在乘法之前计算），最关键的“伤害”本身，则是捕获了这些东西，按照：

```
伤害基础值
 + 属性补正
 * 伤害倍率
 * 伤害修正
 + 伤害偏移
= 当前伤害值
```

的顺序计算，甚至考虑受击者的伤害吸收，可以再拓展为：

```
伤害基础值
 + 属性补正
 * 伤害倍率
 * 伤害修正
 + 伤害偏移
 * 伤害吸收率
 * 伤害吸收修正
 - 伤害吸收偏移
= 当前伤害值
```

这就以一种良好的方式定义了伤害计算的管线。

值得注意的是”基础值BaseValue“和”当前值CurrentValue“的差异，很显然，基础值提供了类似基底的作用，当前值是基础值经过一系列计算后得出的。

我们把”属性“和”属性修改参数”分离的好处还有一点，假设对于伤害，未来我们想要设计独立于之前设计的属性修改参数的新参数，例如还是考虑“伤害”，假设造成伤害的单位时一个亡灵猎手而目标是一个骷髅兵，我们想要设计亡灵猎手对亡灵造成的伤害+20%，我们只需要增加一项“亡灵伤害倍率”属性给亡灵猎手的属性值，并且把亡灵猎手的伤害管线加上” * 亡灵伤害倍率“这一项。但我们可以注意到的一点是显然这一项应当在计算伤害偏移之后，伤害吸收之前计算，如果我们关于每一个角色特性都要重新抄走大部分的相同的计算公式，只插入少量的新因子，那其实是很糟糕的。

更好的办法可能是抽取通用的部分，并且细分成更小的步骤，例如通用伤害计算部分：

```
伤害基础值
 + 属性补正
 * 伤害倍率
 * 伤害修正
= 当前伤害值
```

然后传递给特别的新因子

```
当前伤害值
 * 亡灵伤害倍率
= 当前伤害值
```

这里甚至可以继续传递给更多特别的因子

再加上伤害偏移

```
当前伤害值
 + 伤害偏移
= 当前伤害值
```

最后算伤害吸收

```
当前伤害值
 * 伤害吸收率
 * 伤害吸收修正
 - 伤害吸收偏移
= 当前伤害值
```



实际上以上的”流水线“在GAS的Modifier组合设计下是无法实现的，因为Modifier天然的设计就不是流水线式的而聚合式的。这个问题在后续讨论GameplayEffect时会深入讨论。



值得一提的是，对于属性的修改往往是有其持续时间（Duration）的概念的，实现上可以使用简单的Timer的方式来实现“持续时间”。



### “状态”表示的问题与解决——"Tag" v.s. "bool"

在上面我们已经较为充分地讨论了属性值数值计算的问题，接下来再考虑关于”状态“的问题。

在游戏中，我们往往需要对属性值作临时修改，或者不是修改属性值，而是改变事物的一些”状态“。

例如考虑LOL中的强攻符文，当英雄使用普通攻击攻击一个敌方英雄时，就会 给敌人挂上一层持续一定时间的”标记“，当标记累计满3层之后就会对敌人造成一定伤害并且使一定时间内敌人受到的伤害增加一定百分比，即陷入“易伤”。

在这个例子中涉及两种状态：”标记“和”易伤“，它们都拥有”持续时间“的概念，并且并不都和“属性值”有关，“标记”只是一种中间状态，和任何属性都无关，不与任何属性交互。

一种设计是把状态设计成布尔开关变量或者枚举，例如IsVulnerable, PressTheAttackCount并配合Timer来实现持续时间，这种是传统的“状态机”思想。在需要维护的状态数量较少的情况尚可接受，例如只需要维护角色IsMoving, IsInAir, IsDead，但许多游戏可能需要维护非常多种状态，并且随着游戏版本的变化支持的状态很可能会不断变化。

这时你就被迫为Character内部增加大量的状态Flag和判断逻辑，每当设计师想要增加一种新的状态，例如考虑搞笑点的愚人节搞笑彩蛋，被赋予这个状态的敌人头会变大，而4月1号之后这个状态可能就会被删掉，如果用Bool，设计师就无法绕过程序员编写Character代码这一层来为Character放入新的东西。

一种更灵活的做法是使用所谓的“Tag”或者说”GameplayTag“来表达状态，Character只需要拥有一个通用的Tag Container来容纳Tag，并且支持查询、增加、移除

Tag通常本质**是有层级的字符串**，在UE的实践中，用"."来分隔层级，例如"Status.Stunning""Status.Rooted""Status.Vulnerable""Character.Player""Character.Enemy""Character.Enemy.Orc"等等，它的层级实现了类似IPv4子网掩码的效果，便于查询匹配。

这样一来，设计师想要增加任何状态，只需要在Tag注册表中添加新的Tag类型即可，而不需要要求程序员侵入Character，当然相关的游戏逻辑还是需要程序员实现的，但这已经离”数据驱动“更进一步了。

Tag并不仅仅只能用于”状态“的表示，正如”Tag“本身的词义”标记“，它本质上说明了一个东西”是什么“，或者更准确地说，**”现在是什么“**。它更强大的作用在于Classification，不仅仅是用于表示状态。



### 行为的抽象——GameplayAbility

在游戏中，往往要定义许多”行为“，例如英雄的”技能“，甚至是”移动“”跳跃“”攻击“这些更基础的动作。

要求Character执行一个动作本身是非常简单的，最简单地只需要调用一个函数即可，困难的点在于判定可执行的”条件“。

例如考虑”跳跃“这个动作，如果只支持一段跳，那么当角色还未进行一次跳跃时允许玩家进行跳跃，当角色进行了一次跳跃但还未落地时，应当使玩家的下一次跳跃指令无效，或者跳跃需要消耗”耐力Stamina“，需要判断角色此时的耐力是否足够，这就涉及了一个”条件“判断的问题。

现在我们的讨论语境已经涉及了”属性“了，对于数值的判断，可以查询属性即可，但关于状态类条件如何设计？

还是像上一个章节所讨论的那样，更灵活的做法是给Character上挂Tag表示状态，并且用Tag查询来支持状态类的条件判断。

并且与其每种行为各自实现Tag查询的行为，不如统一一个框架支持Tag类的查询和判定，这正是UE-GAS中GameplayAbility的设计。

以下如无特殊说明，GameplayAbility使用GA的缩写。

GA拥有”激活Activate“的概念，而Activate这个动作支持条件判定。

以下引自[UE-GASDocumentation]([tranek/GASDocumentation: My understanding of Unreal Engine 5's GameplayAbilitySystem plugin with a simple multiplayer sample project.](https://github.com/tranek/GASDocumentation#concepts-ga))

| `GameplayTag 容器`   | 描述                                                         |
| -------------------- | ------------------------------------------------------------ |
| `能力标签`           | `GameplayAbility` 所拥有的 `GameplayTags`，用于描述该 `GameplayAbility`。 |
| `取消具有标签的能力` | 当此 `GameplayAbility` 激活时，其他具有这些 `GameplayTags` 的 `GameplayAbilities` 在其 `能力标签` 中将被取消。 |
| `阻止具有标签的能力` | 此 `GameplayAbility` 激活期间，其他具有这些 `GameplayTags` 的 `GameplayAbilities` 不得激活。 |
| `激活时所有者标签`   | 当此 `GameplayAbility` 活动时，这些 `GameplayTags` 将赋予 `GameplayAbility` 的所有者。请记住，这些不被复制。 |
| `激活所需标签`       | 如果拥有者拥有 **所有** 这些 `GameplayTags`，此 `GameplayAbility` 才能激活。 |
| `激活受阻标签`       | 如果拥有者拥有 **任意** 这些 `GameplayTags`，此 `GameplayAbility` 无法激活。 |
| `来源所需标签`       | 如果 `Source` 拥有 **所有** 这些 `GameplayTags`，此 `GameplayAbility` 才能激活。`Source GameplayTags` 只有当 `GameplayAbility` 由事件触发时才设置。 |
| `来源受阻标签`       | 如果 `Source` 拥有 **任意** 这些 `GameplayTags`，此 `GameplayAbility` 无法激活。`Source GameplayTags` 只有当 `GameplayAbility` 由事件触发时才设置。 |
| `目标所需标签`       | 如果 `Target` 拥有 **所有** 这些 `GameplayTags`，此 `GameplayAbility` 才能激活。`Target GameplayTags` 只有当 `GameplayAbility` 由事件触发时才设置。 |
| `目标受阻标签`       | 如果 `Target` 拥有 **任意** 这些 `GameplayTags`，此 `GameplayAbility` 无法激活。`Target GameplayTags` 只有当 `GameplayAbility` 由事件触发时才设置。 |

GA的作用在于”描述一个行为“，并且支持Apply GameplayEffect来产生对游戏状态的影响（见下文）。



在UE-GAS的设计中，GA还可以设置成本Cost和冷却时间CoolDown，通过配合GE来实现。



### GameplayEffect

上面我们已经讨论了Modifier和Tag两种思想，实际上”修改数值“和”修改状态“都可以被归结为”修改“，更详细地说是修改**”游戏状态“**，可以用"Game State", "Gameplay State", "Game Context", "Gameplay Context"来表达都可以。这两者常常配合起来工作，例如”持续一定时间的易伤状态，易伤状态下受到的伤害增加XX%“。

这两者和游戏状态的交互结合起来可以归结为GameplayEffect。

GameplayEffect表达了一种游戏状态的变换，不应该仅仅只是把它看作是Attribute修改器或者Tag修改器。

以下如无特殊说明，GameplayEffect使用GE的缩写。



### GE in UE-GAS

以下讨论基于UE-GAS的设计。

GameplayEffect拥有**“持续时间”**的概念，一个GameplayEffect可以是”Instant""Infinite"或"Has Duration"。

Instant的GE将立即完成作用并且Modifier对于Attribute的修改是作用在BaseValue上。

Infinite的GE将一直持续在GE所在对象上并且Modifier对于Attribute的修改体现在CurrentValue上。

Has Duration有持续时间，修改和Infinite一样。

如何理解Modifier对于Attribute的修改？

我们说Attribute拥有两个内部值BaseValue和CurrentValue，实际上CurrentValue更像是一个EvaluatedValue。

GAS的Ability System会把和关于某个Attribute的任何GE上的Modifier收集起来聚合计算，这些Modifier一部分立即修改BaseValue，一部分聚合起来生成CurrentValue

CurrentValue总是这样计算得出的：

```
CurrentValue = ((InlineBaseValue + ΣAdditive) * ΠMultiplicitive) / ΠDivision
```

并且UE-GAS中Multiplicitive的Magnitudes默认按照加法运算，例如两个乘法Modifier，一个Magnitude是1，一个是0.5，你可能想要的是* (1 * 0.5) 但实际情况是* (1 + 0.5) ，想要修改成按乘算需要修改源码。

Modifier的执行顺序和它们写在GE列表中的顺序无关，正如上面的公式体现的，Modifiers本质是一种聚合的思想。



对于Infinite和Has Duration的GE，可以允许它们有周期性的行为。



GE拥有各种各样的Tag：

以下引自[UE-GASDocumentation]([tranek/GASDocumentation: My understanding of Unreal Engine 5's GameplayAbilitySystem plugin with a simple multiplayer sample project.](https://github.com/tranek/GASDocumentation#concepts-ga))

| Category                          | Description                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| Gameplay Effect Asset Tags        | Tags that the `GameplayEffect` has. They do not do any function on their own and serve only the purpose of describing the `GameplayEffect`. |
| Granted Tags                      | Tags that live on the `GameplayEffect` but are also given to the `ASC` that the `GameplayEffect` is applied to. They are removed from the `ASC` when the `GameplayEffect` is removed. This only works for `Duration` and `Infinite` `GameplayEffects`. |
| Ongoing Tag Requirements          | Once applied, these tags determine whether the `GameplayEffect` is on or off. A `GameplayEffect` can be off and still be applied. If a `GameplayEffect` is off due to failing the Ongoing Tag Requirements, but the requirements are then met, the `GameplayEffect` will turn on again and reapply its modifiers. This only works for `Duration` and `Infinite` `GameplayEffects`. |
| Application Tag Requirements      | Tags on the Target that determine if a `GameplayEffect` can be applied to the Target. If these requirements are not met, the `GameplayEffect` is not applied. |
| Remove Gameplay Effects with Tags | `GameplayEffects` on the Target that have any of these tags in their `Asset Tags` or `Granted Tags` will be removed from the Target when this `GameplayEffect` is successfully applied. |



## CardGameDemo需要的Gameplay Framework

我们的CardGameDemo拥有丰富的“属性”方面的数值计算，也需要支持大量的“状态”，因此UE-GAS可以作为一个有效的参考。



UE-GAS的GE的聚合式Modifier的设计是值得借鉴的点，但有一些CardGameDemo的任务它无法满足。

### AttributeEvaluationPipeline

我们借鉴UE-GAS的GE的设计，并且希望CardGameDemo的Modifier可以通过划分Evaluation Stage来实现计算流水线，但一个Evaluate Stage内部Modifier仍然是聚合式的，结合以下的一个可能的例子来理解：

```
GE_CommonDamageCalculation:
Modifiers:
 Modifier 0: // 属性补正部分
  Target Attribute: Damage
  Stage: CommonDamage
  Op: Add
  Magnitude Calculation Type: Custom CalculationClass // 属性补正计算比较复杂，需要自定义复杂逻辑

 Modifier 1: // 伤害倍率部分
  Target Attribute: Damage
  Stage: CommonDamage
  Op: Multiply
  Magnitude Calculation Type: Attribute Based
   Backing Attribute: DamageMultiplier // 伤害倍率
   Attribute Calculation Type: Attribute Current Value
   
 Modifier 2: // 伤害修正部分
  Target Attribute: Damage
  Stage: CommonDamage
  Op: Multiply
  Magnitude Calculation Type: Attribute Based
   Backing Attribute: DamageCorrection // 伤害修正
   Attribute Calculation Type: Attribute Current Value
```

```
Other Possible GE...
```


```
GE_DamageOffsetCalculation:
Modifiers:
 Modifier 0: // 伤害偏移部分
  Target Attribute: Damage
  Stage DamageOffset
  Op: Add
  Magnitude Calculation Type: Attribute Based
   Backing Attribute: DamageOffset // 伤害偏移
   Attribute Calculation Type: Attribute Current Value
```

```
Other Possible GE...
```

定义一个AttributeEvaluationPipeline：DamageEvaluationPipeline

```
DamageEvaluatiionPipeline:
 Stage Order:
  0 CommonDamage
  // You can insert more stage if you want
  1 DamageOffset
```

AttributeEvaluationPipeline仅仅只是一个对计算Attribute时的Stage编排顺序的声明，它仅仅只说明了一种“顺序”，但是结合Modifier Stage非常有意义。AttributEvaluationPipeline应当绑定到相应的Attribute，并且它是针对于特定Character的而不是针对于全局的，这样便于不同的Character使用不同的计算管线。如果不分配管线，则EvaluationStage无意义，全部按无Stage直接聚合。

对于任何一个Attribute，其计算管线都可以以如下伪代码表示：

```
Stage OrderedEvaluationStages[] := AttributeEvaluationPiplineOfThisAttribute.Stages; 
set<Modifier> Modifiers = Collect All Modifiers for this Attribute;
Current Value := BaseValue;
float Accumulator := 0;
float Multipiler := 0;
float Divisor := 1;
float Overrider := 0;

// Handele the modifiers that has valid stage.
for Stage in OrderedEvaluationStages:
    Accumulator := 0;
    Multipiler := 0;
    Divisor := 1;
    Overrider := 0;
	for Modifier in Modifiers:
		if Modifier.Stage == Stage:
			switch Modifier.Op:
				Add: Accumlator += Modifier.Magnitude; break;
				Multiply: Multiplier += Modifier.Magnitude; break; // Or *= depends on your need
				Divide: Divisor *= Modifier.Magnitude; break;
				Override: Overrider := Modifier.Magnitude; break;
				default: break
			Modifiers.remove(Modifier);
	CurrentValue := (CurrentValue + Accumulator) * Multipilier / Divisor;

// Handle the modifiers that has no valid stage.
Accumulator := 0;
Multipiler := 0;
Divisor := 1;
Overrider := 0;
for Modifier in Modifiers:
	if Modifier.Stage == Stage:
        switch Modifier.Op:
            Add: Accumlator += Modifier.Magnitude; break;
            Multiply: Multiplier += Modifier.Magnitude; break; // Or *= depends on your need
            Divide: Divisor *= Modifier.Magnitude; break;
            Override: Overrider := Modifier.Magnitude; break;
            default: break
		
CurrentValue := (CurrentValue + Accumulator) * Multipilier / Divisor;


			
```

这样一来，Modifiers就不再只是简单地聚合，而可以按照一定的时序来执行。

把上面的伪代码结合CardGameDemo所需要的伤害计算数据流就像这样：

```
Stage: PreEvaluate(A virtual stage that doesn't really exist): 
	CurrentDamage = BaseDamage
            │
            ▼
Stage: CommonDamage: 
	CurrentDamage = (CurrentDamage + DamageBonus) * 
                     DamageMultiplier *
                     DamageCorrection // No divisor needed
            │
            ▼
Other Possible Stage...
 			│
            ▼
Stage: DamageOffset:
	CuurentDamage += DamageOffset

```



### GameplayEffect,GameplayAbility & GameplayEvent

接下来来看更复杂的例子，假设现在玩家角色打出了一张牌，这张牌的效果是“标记一个敌人，在这个回合内，你对该目标造成的伤害+25%”，很显然这里的+25%是指伤害倍率+25%。

一个可行的方案是这样的，给玩家自己Apply一个GE，姑且称之为GE_MoreDamageOnMarkedEnemy，GE的效果是给自己伤害倍率+25%，持续时间1回合，GE生效的条件是“当前攻击的目标是被标记的敌人”，这样只有在“当前攻击的目标是被标记的敌人“事件出现时才激活这个GE，否则关闭。

这就涉及两个概念，一个是GE的Application !=  Valiadation，仍然可以借鉴UE的设计，GE可以设置一系列的Tag，其中可以设置Ongoing Tag Requirement，只有当满足Tag Requirement时才GE才会真正发挥实际作用。

另一个是我们如何表达”事件“和监听事件并对事件做出反应，表达事件并不困难，最简单的设计是直接采用一个GameplayEvent枚举类型，但这里我们需要的事件的语义非常特殊，它的语义是”被XX牌标记的敌人被玩家选定为攻击目标“，正如Tag v.s. Bool中指出的那样，正如游戏状态，游戏事件也非常灵活，类似地我们也可以用Tag来表示事件，想要增加一种事件类型只需要增加一个Tag "GameplayEvents.MarkedEnemyChosenAsAttackTarget"或更有层次一点以便可以复用："GameplayEvent.CharacterChosen.Enemy.AsAttackTarget.Marked"。

但有了表达事件的方式还不够，接收到事件之后，我们需要执行的逻辑是给玩家自身加一个满足Ongoing Tag Requirement的Tag来保证伤害增加GE可以生效，但我们还需要阻止它对其他攻击行为造成影响，可行的方式是监听”玩家造成了伤害“的事件，并在造成伤害之后立即施加一个GE移除这个通行证Tag。

我们还需要一个办法来监听事件并对事件做出反应。“监听”需要玩家角色知道自己要接受一个带有某些Tag的事件，反应只要在监听到后执行逻辑即可。比较容易想到的解决方案是给玩家角色注册一个监听回调，当玩家角色收到事件时，检查是否有需要的Tag，判断是否可以执行逻辑。但与其给角色加入一个“监听事件回调列表“，我们不如采取一种更统一的角度来看待这个需求。我们把在一定时间内监听某种特殊事件并且能够做出相应的反应看作一种”被动能力“的话，我们完全可以用GameplayAbility的角度来实现这个功能。

这需要我们支持玩家给自己施加的GE_MoreDamageOnMarkedEnemy再拥有一项功能：给玩家赋予一个新的GA并且激活它，并在GE自己到期的时候一并移除这个GA。

这样一来我们就能够描述“标记一个敌人，在这个回合内，你对该目标造成的伤害+25%”这张牌的GE和其行为了。

```
GE_MoreDamageOnMarkedEnemy:

Duration Policy: Has Duration
Duration: 1 Turn

Application Tag Requirements: None
Ongoing Tag Requirements: "AttackingXXCardMarkedEnemy"

Modifiers:
 Modifier 0:
 Target Attribute: DamageMultiplier
 Stage: None
  Op: Add
  Magnitude Calculation Type: Scalable
   Backing Attribute: DamageMultiplier // 伤害倍率
   Attribute Calculation Type: Attribute Current Value
   
Granted Abilities:
 Ablility 0:
  GA_ReactToAttackingMarkedEnemy
 Removal Policy: Remove On End
```

```
GA_ReactToAttackingMarkedEnemy:
 Listen to GameplayEvents with Tag GameplayEvent.CharacterChosen.Enemy.AsAttackTarget.Marked and GameplayEvent.PostPlayerDoneDamage;
 
 when hear event with Tag GameplayEvent.CharacterChosen.Enemy.AsAttackTarget.Marked
 	Apply GE_AllowMoreDamageToMarkedTarget which grant player tag AllowedMoreDamagedToMarkedTarget;
 	
 when hear event with tag GameplayEvent.PostPlayerDoneDamage
 	try remove tag AllowedMoreDamagedToMarkedTarget on player;
```



### Gameplay Framework Component

在前文的讨论中，我们总是绕过了一个东西，总是称把AttributeSet，GameplayAbility，GameplayEffect，GameplayTag挂载在“角色”身上，实际上，我们应当需要一个Component来实现这些Gameplay Framework通用的工作，这正是UE-GAS中AbilitySystemComponent的作用。除此之外，Gameplay Framework Component还应当有处理GameplayEvent的能力。

以下如无特殊说明，Gameplay Framework Component缩写为GFC.



让我们分几个维度考虑GFC的功能，在前文的叙述中，我们已经分析了Attribute用于一部分维护数值类的游戏状态，Tag用于维护一部分状态类的游戏状态，GameplayEffect本质上是一种对游戏状态的“影响”，GameplayAbility可以抽象一部分游戏行为，GameplayEvent传播游戏状态的变化。注意我的用词，我并没有说Gameplay Framework对于Gameplay开发是万能的，恰恰相反，例如像Inventory System，Farming System等它并不擅长，我们有必要清楚UE-GAS-like的Gameplay Framework更擅长处理复杂数值逻辑和复杂状态变化而非所有复杂游戏性业务逻辑。



#### GameplayState

AttributeSet和GameplayTags可以看作是“游戏性状态GameplayState".

GFC应当提供它们的查询能力，但也许我们需要限制修改它们的权限，UE-GAS中只有GE能够修改Attribute，但GameplayTag可以随意修改，一个原因是GameplayTag参与的游戏实现很多，它的含义很丰富，也许不应该限制它。

即GFC应当维护挂载的一系列AttributeSet和一个GameplayTagContainer。

##### Attribute Query

GFC应当支持Attribute的查询（我们应该限制Attribute的修改吗？）。

##### AttributeChangeCallbacks

GFC还应支持订阅Attribute变化事件，并且支持PreAttributeChanges和PostAttributeChanged回调，来支持在修改Attribute的前后作出反应，例如实现clamp来避免Attribute的值偏离合理的范围。

#### Modification of GameplayState

GameplayEffect是对“游戏性状态”的一种影响，GFC应当能够接受GE表达的影响，保持那些infinite或Hash Duration的GE，并时刻对各种各样的GE对游戏性状态的影响完成结算。



### GameplayEvent System

在CardGameDemo中，可能存在大量的“事件”语义需要处理，例如有装备的效果是“当你在本场战斗中第一次失去生命值时，你获得若干格挡”，那么这件装备就需要监听“玩家生命值减少”这个事件，并且很有可能有许许多多潜在的监听者需要了解同一个事件，所以这时“委托”这种点对点的事件传播不够好用了。除了简单的点对待你委托之外，我们需要一个“发布-订阅”模式的事件系统，来支持潜在的各种事件广播以及监听。

在上文中我们提到，我们可以用GameplayTag来初步表明事件的类型，除此之外，GameplayEvent还应当可以承载一些payload以适应不同事件所需的信息。

我们至少需要以下事件语义（用GameplayTag来明确地表达层级）：



地牢冒险层次：

ParentTag：GameplayEvent.Dungeon

| 事件子Tag        | 描述             | Payload |
| ---------------- | ---------------- | ------- |
| Level.Generate   | 层级生成         |         |
| Level.RoundStart | 层级中新一轮开始 |         |
| Level.RoundEnd   | 层级中一轮结束   |         |
|                  |                  |         |

| 事件子Tag              | 描述                                  | Payload      |
| :--------------------- | ------------------------------------- | ------------ |
| player.StartAdventure  | 玩家进入地牢即开始Adventure           | -            |
| player.EndAdventure    | 玩家离开地牢即结束Adventure           | -            |
| player.EnterLevel      | 玩家进入一个层级                      | 至少层级序号 |
| player.LeaveLevel      | 玩家离开一个层级                      | 至少层级序号 |
| player.EnterRoom       | 玩家进入房间                          | -            |
| player.LeaveRoom       | 玩家进入房间                          | -            |
| player.StartCombat     | 玩家开始战斗                          |              |
| player.FinishCombat    | 玩家结束战斗                          |              |
| player.Loot            | 玩家拾取战利品                        |              |
| player.Loot.Currency   | 玩家拾取货币                          |              |
| player.Loot.Equipment  | 玩家拾取装备                          |              |
| player.Loot.TradeGoods | 玩家拾取换金道具                      |              |
| player.ConsumeItem     | 玩家使用消耗品                        |              |
| player.Rest            | 玩家进行休息                          |              |
| player.Trade           | 玩家进入交易（但不一定完成交易）      |              |
| player.Equip           | 玩家穿上装备                          |              |
| player.Unequip         | 玩家脱下装备                          |              |
| player.EncounterEvent  | 玩家遭遇游戏事件（不是GameplayEvent） |              |



战斗层次：

ParentTag：GameplayEvent.Combat

| 事件子Tag                   | 描述                             | Payload |
| --------------------------- | -------------------------------- | ------- |
| player/NPC.StartTurn        | 玩家/NPC回合开始                 |         |
| player/NPC.FinishTurn       | 玩家/NPC回合结束                 |         |
| player/NPC.DrawACard        | 玩家/NPC抽一张牌                 |         |
| player/NPC.PlayACard        | 玩家/NPC打出一张牌               |         |
| player/NPC.DiscardACard     | 玩家/NPC丢弃一张牌               |         |
| player/NPC.Shuffle          | 玩家/NPC把弃牌堆洗牌后放到抽牌堆 |         |
| player/NPC.DealDamage       | 玩家/NPC造成伤害                 |         |
| player/NPC.TakeDamage       | 玩家/NPC受到伤害                 |         |
| player/NPC.GainActionPoint  | 获得行动力                       |         |
| player/NPC.SpendActionPoint | 使用行动力                       |         |
| player/NPC.GainBlock        | 获得格挡                         |         |
| player/NPC.LoseBlock        | 失去格挡                         |         |
| player/NPC.GainHealth       | 获得生命值                       |         |
| player/NPC.LoseHealth       | 失去生命值                       |         |
| player/NPC.Defeated         | 在战斗中失败                     |         |
|                             |                                  |         |

## Design constraints（当前约束）

### 1) 多运行模式是硬约束

框架必须支持至少三种运行形态：

- **FullAdventureMode**：完整冒险流程（局外准备 + 地牢探索 + 战斗）
- **BattleOnlyMode**：直接启动一场战斗，不依赖完整冒险上下文
- **DebugConsoleMode**：控制台/命令式调试，支持构造场景与状态注入

### 2) 核心模块可独立运行

至少以下模块应可独立测试与运行：

- AttributeEvaluationPipeline
- GameplayEffect 计算与生命周期
- GameplayEvent 发布-订阅
- 战斗回合循环（无地牢依赖）

### 3) 可复现与可观测

- 关键流程必须支持 seed 固定复现
- 关键事件与状态变化必须可结构化输出（日志/快照）

## Open questions

### A. 计算语义与顺序

1. `Multiply` 在 Stage 内默认是 `+=` 聚合后一次乘，还是连续乘算（`*=`）？  

   A：对于一个通用的数值计算系统的话，按理说应该都支持，但我只需要按+=算

2. `Override` 的优先级是 Stage 内最后生效，还是按独立规则覆盖？  

   A：如果存在Override，Override总是应该覆盖，这就是说，不管Override的实现逻辑是在其他modifier算完之后override来实现覆盖，还是先覆盖然后跳过其他modifier，都行，只要保证行为对就行。

3. 无 Stage 的 Modifier 应并入哪个阶段（末尾统一处理，还是预定义 fallback stage）？

   A：无stage的modifier全部默认集中在最后算

### B. Damage Pipeline 细节

1. 护甲减伤采用何种曲线（线性、双曲、指数衰减）？  

   A：我还没想好

2. 穿透（固定/百分比）在吸收前还是吸收后生效？  

   A：护甲穿透应当作为一种Source Attribute参与目标的DamageToTake Attribute的计算，所以所谓的“生效时序”不存在

3. 额外伤害是否总是产生新事件（可触发连锁）还是可标记为“静默伤害”？

   A：区分“额外伤害”的形式，如果表述是“额外造成n点伤害“，意思只是在本次伤害计算时BaseValue多加n点伤害，如果表述是“额外造成一次n点伤害”，意思是和初始造成伤害这个行为平行的另外一次单独结算的伤害，是单独的一段计算。

### C. GE / GA / Event 交互

1. GE 授予 GA 时，GA 生命周期是否总是绑定 GE 生命周期？  

   A：也许可以设置一个选项选择是否绑定

2. 同一事件帧内多个监听者触发顺序如何确定（优先级、注册序、稳定排序）？  

   A：也许应该有某种优先级，优先级不同的必然按照次序触发，优先级相同的也应当遵守某种稳定顺序触发以保证一致性

3. 事件循环（A 触发 B，B 再触发 A）如何防止死循环（深度限制或防抖 key）？

   A：按理来说游戏设计中应当避免这种情况，但人不可能不犯错，需要一种机制兜底

### D. 工程与工具链

1. GameplayTag 的唯一真源是代码枚举、表格导入，还是二者融合？  

   ​	A：二者融合

2. 控制台调试命令采用 DSL、JSON 指令，还是 REPL 命令式接口？  

   A：不知道什么意思

3. BattleOnly 模式中 Character 初始状态由何种场景文件描述（最小 schema）？

   A：给我建议
