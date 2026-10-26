# magpie check-in plugins

Every vendor's daily check-in (签到) and claim magpie can press, in one
install. Each is a provider plugin, so its check-in lives beside the
sign-in it uses: magpie asks `auth.checkin` once a Beijing day for each
signed-in, in-use account while the account's **Daily check-in** switch is
on (Settings → Usage → Plugins; off until you turn it on — *Check in now*
on the account's card asks at once).

| Provider | Vendor | What it presses |
|---|---|---|
| `zcode` | Z.ai / BigModel (智谱) GLM Coding Plan | the day's gift-plan claims — ZCode's limited-time runs, one plan a day, the same claims the ZCode app's banner makes |
| `workbuddy` | WorkBuddy 国内版 (CodeBuddy) | the 签到 event: credits a day, more on a streak |
| `workbuddy-ai` | WorkBuddy 国际版 | nothing: the event is off there, so it answers *inactive* |
| `autoclaw`, `autoclaw-cn` | AutoClaw (智谱 OpenClaw) | the `daily_signin` client task, plus the day's activity rewards |
| `codearts` | Huawei Cloud CodeArts (码道) | the client's 「限时福利 → 每日领取」 |
| `minimax-code`, `minimax-code-global` | MiniMax Code | the account credits' daily sign-in, CN and international |
| `qoder`, `qoder-cn` | Qoder | the day's campaign credits |
| `raccoon` | SenseTime Raccoon (商汤小浣熊) | the daily grant |
| `trae-cn`, `trae-global` | Trae | the SOLO `checkin_credits` claim |
| `qwenwork`, `qwenwork-enterprise` | QwenWork (千问办公) | no check-in: the vendor has none, so these carry the sign-in and usage only |

## Install

The repository root names an entry (`index.mjs`) that re-exports every
provider's plugin, so a git install takes the whole repository:

```sh
magpie plugin add github:MeYangGe/magpie-checkin-plugins
```

magpie's git install takes a repository as one plugin and loads what its
root package names; one module may export several plugin functions, so this
one repository serves every provider above.

Each package is also installable on its own by path:

```sh
magpie plugin add ./packages/zcode
magpie plugin add ./packages/workbuddy
```

## Sign in

The check-in uses the provider's own sign-in, so sign in first:

```sh
magpie plugin login zcode
magpie plugin login workbuddy
magpie plugin login autoclaw
```

Then turn the check-in on under Settings → Usage → Plugins. Each provider
has its own switch there; `magpie accounts checkin` lists what came of every
account in one go, and the TUI's Usage page presses `c`.

## What comes back

The outcomes are magpie's own: **claimed** (checked in now, with the credits
and streak where the vendor gives them), **done** (already in today),
**inactive** (no check-in event now), **ineligible** (the account doesn't
qualify, or has no session to claim with), **captcha** (the vendor wants a
captcha — the plugin never solves one and says to check in in the vendor's
app) and **failed** (magpie asks again in half an hour).

Each plugin reads its vendor's own endpoints, worked out from the clients
and from [agent2api](https://github.com/aimod-cc/agent2api)'s ports of them.
Where a claim needs a device id, it is the sign-in's own and stays the same
for that account: the risk control ties a claim to the machine that made it.

## Tests

Each package tests its check-in against a stubbed fetch (no network):

```sh
cd packages/zcode && bun test
```

All of them:

```sh
for p in packages/*/; do (cd "$p" && bun test); done
```

On Windows, run them with a home inside the temp directory, as the packages'
tests require:

```sh
USERPROFILE="C:\Users\<you>\AppData\Local\Temp" bun test
```

## Credits

These packages are the community's: they come from
[magpie-community/plugins](https://github.com/magpie-community/plugins), MIT
licensed, and keep their own authors' work. The ZCode daily claim and the
WorkBuddy plugin's own check-in are additions to it.

## License

MIT
