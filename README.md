# magpie 签到插件合集

把 magpie 能签到的平台**全部聚合进一个仓库**，装一次就有全部签到能力。

每个平台都是一个 provider 插件，签到挂在它自己的 `auth.checkin` 钩子上——这是 magpie 的架构决定的：账号的凭据被锁在那个 provider 里，别家插件碰不到。所以"聚合"的形态是：**一个仓库、一条安装命令、15 个 provider、一个统一的开关面板**。

## 支持的平台

| provider | 平台 | 签到内容 |
|---|---|---|
| `zcode` | Z.ai / 智谱 GLM Coding Plan | 每日领取限时套餐（Trust Build 等），一次可领多份 |
| `workbuddy` | WorkBuddy 国内版（CodeBuddy） | 成长中心完整链条：签到 → 每日活跃 → 连登补签/兑换/抽奖 → 猫猫旅行 |
| `workbuddy-ai` | WorkBuddy 国际版 | 无成长中心，返回"不适用" |
| `autoclaw` / `autoclaw-cn` | 智谱 AutoClaw | 每日签到任务 + 活动福利 |
| `codearts` | 华为云码道 CodeArts | 限时福利·每日领取 |
| `minimax-code` / `minimax-code-global` | MiniMax Code | 每日签到领积分 |
| `qoder` / `qoder-cn` | Qoder | 每日活动额度领取 |
| `raccoon` | 商汤小浣熊 | 每日积分发放 |
| `trae-cn` / `trae-global` | Trae | SOLO 每日签到积分 |
| `qwenwork` / `qwenwork-enterprise` | 千问办公 | **无签到**（上游没有），只提供登录和用量 |

## 安装前准备

1. **magpie ≥ v0.1.1083**（签到钩子从这个版本开始支持）
2. 能访问 GitHub（国内需代理）

## 安装

### 方式一：命令行（推荐）

```bash
magpie plugin add github:MeYangGe/magpie-checkin-plugins
```

一条命令装完全部 15 个 provider。

### 方式二：图形界面

打开 magpie → **插件** → **添加插件** → 填入：

```
github:MeYangGe/magpie-checkin-plugins
```

### 方式三：只装某几个平台

clone 仓库后按路径安装单个包：

```bash
git clone https://github.com/MeYangGe/magpie-checkin-plugins.git
magpie plugin add ./magpie-checkin-plugins/packages/zcode
magpie plugin add ./magpie-checkin-plugins/packages/workbuddy
```

### 方式四：OpenCode

`opencode.json` 里加：

```json
{ "plugin": ["github:MeYangGe/magpie-checkin-plugins"] }
```

装完确认：

```bash
magpie plugin            # 等于 magpie plugin list，列出已装插件和它们的 provider
```

## 登录

签到用的就是各平台自己的登录态，**先登录再开签到**。

```bash
magpie plugin login zcode
magpie plugin login workbuddy
magpie plugin login autoclaw
magpie plugin login codearts
magpie plugin login qoder
magpie plugin login trae-cn
magpie plugin login raccoon
magpie plugin login minimax-code
```

图形界面里：**供应商**页面对应平台那一行点**登录**。

> **WorkBuddy 用户注意**：如果你已经装了社区版 `@magpie-community/opencode-workbuddy-auth` 并登录过，这里直接就能用——本仓库的 workbuddy 插件接管了它的签到。两个插件声明同一个 provider id 时，后加载的生效。

## 开启签到（关键一步）

**签到开关默认是关闭的**，必须手动打开：

**图形界面**：设置 → 用量 → **插件** 标签 → 每个平台一行 **每日签到** 开关，逐个打开。

**命令行查看当前状态**：

```bash
magpie accounts checkin
```

输出会列出每个账号今天的签到结果。

> **历史说明**：WorkBuddy 国内版、Trae CN、MiniMax Code、Qoder（含 CN）这四个，如果你之前用过 magpie 内置的签到开关，插件会**沿用那个开关的状态**，不用重设。其他平台默认关闭，需要手动打开。

## 手动签到

不想等自动调度时，随时手动触发：

```bash
magpie accounts checkin
```

这条命令会对**所有已登录、已启用的账号**立刻签一次，并打印每个账号的结果。

**图形界面**：账号卡片（供应商 → 账号）上的 **立即签到** 按钮。

**TUI**：用量页面按 `c`。

自动调度规则：每个已登录、启用的账号，**每个北京日一次**；启动后 2 分钟首次检查，之后每 30 分钟一次；失败的话 30 分钟后重试；其他结果当天不再问。

## 查看结果

三个地方都能看：

| 位置 | 看到什么 |
|---|---|
| 设置 → 用量 → 插件 | 每个平台的开关 + 今天的结果 |
| 供应商 → 账号卡片 | 该账号的签到行（领到多少积分、连登几天、失败原因） |
| `magpie accounts checkin` | 一次性列出全部账号的签到结果 |

## 各平台特别说明

### WorkBuddy

成长中心链条按客户端顺序执行四步，**每步独立容错**——某步失败不会撤销前面已完成的：

1. 每日签到（拿积分）
2. 每日活跃上报（点亮连登）
3. 连登（补签卡补昨日 → 7d/14d/28d 档位兑换 → 抽奖最多 20 发）
4. 猫猫旅行（领养 → 派出 → 到达领奖，一天一步）

**限制**：只有国内版**个人账号**有成长中心。企业号会返回"不适用"，国际版也是。

### ZCode

ZCode 没有传统签到，它的是**限时发放的体验套餐**（每天一个新套餐，领一次）。插件会：

- 列出当天可领套餐，按优先级领取
- 列表为空时，先补报客户端的启动/日活事件（资格靠这个发放），再重读一次
- **遇到验证码就停手**，提示你去 ZCode 客户端领——插件永远不会代解验证码

### 千问办公（qwenwork）

上游没有签到活动，所以这两个 provider 只提供登录和用量查询，签到钩子会返回"不适用"。

## 常见问题

**Q：装完看不到页面？**

本仓库**没有页面**。magpie 的页面插件是只读沙箱，只能读用量统计和 provider 列表，**读不到签到结果**（那数据在 `plugin-checkin.json`，magpie 没开放这个读权限）。签到状态请看上面「查看结果」的三个位置。

**Q：为什么一个插件里有 15 个 provider？**

magpie 的 git 安装会**把一个仓库当作一个插件**，加载根 `package.json` 指定的入口。而一个模块可以导出多个插件函数（官方文档明确支持），所以根 `index.mjs` 重新导出全部 15 个，一次安装全生效。

反过来，**签到只能由各自 provider 的插件执行**——这是 magpie 的硬性架构，`checkinOf(provider)` 只认声明了该 provider id 的插件。

**Q：报错 `isn't an OpenCode or magpie plugin`？**

说明装到了仓库根但根没有可加载入口。本仓库已修复（根有 `index.mjs`）。如果仍出现，检查是否装的是旧版本，执行 `magpie plugin update`。

**Q：签到显示"需要验证码"？**

上游风控要求人机验证。插件**不会也不应该**破解验证码，请到对应平台的官方客户端手动签到一次。

**Q：某个平台签到失败？**

1. 确认该平台已登录：`magpie plugin login <provider>`
2. 确认开关已开：设置 → 用量 → 插件
3. 手动触发一次看具体错误：`magpie accounts checkin`
4. 失败会在 30 分钟后自动重试

## 卸载

先看装了什么（名字以 `magpie plugin list` 显示的为准）：

```bash
magpie plugin
```

然后按名字卸载：

```bash
magpie plugin remove magpie-checkin-plugins
```

`remove` 接受的是**已安装的名字**（包名或本地路径），不是 GitHub 地址。只卸单个平台的话，用那个包自己的 npm 名，例如：

```bash
magpie plugin remove @magpie-community/opencode-zcode-auth
```

卸载后账号数据会保留；重新安装即可恢复。

## 开发

```bash
# 跑全部测试
for p in packages/*/; do (cd "$p" && bun test); done
```

Windows 上需要把 HOME 指到临时目录（各包测试的硬性要求）：

```bash
USERPROFILE="C:\Users\<你>\AppData\Local\Temp" bun test
```

## 致谢

各 provider 包来自
[magpie-community/plugins](https://github.com/magpie-community/plugins)，MIT
许可，版权归各自作者。

- ZCode 每日领取：移植自 [agent2api](https://github.com/aimod-cc/agent2api)
- WorkBuddy 成长链：[magpie-workbuddy-growth](https://github.com/connoryang331/magpie-workbuddy-growth)

## 许可

MIT
