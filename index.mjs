// magpie's entry for this repository: magpie's git install takes a
// repository as one plugin and loads what its root package names, so this
// file re-exports every provider's plugin function from the packages under
// packages/. The host takes every function a module exports as a plugin
// (host.js's servers), so one repository — one `magpie plugin add` — serves
// every vendor whose daily check-in (签到) magpie can press.
//
// Each package stays installable on its own by path (magpie plugin add
// ./packages/zcode), and npm carries them separately as
// @magpie-community/opencode-<name>-auth.

// AutoClaw (智谱 OpenClaw): CN phone SMS and oversea web sign-in
export { AutoclawAuthPlugin, AutoclawCnAuthPlugin } from "./packages/autoclaw/index.mjs"

// Huawei Cloud CodeArts (码道): the client's 「限时福利 → 每日领取」
export { CodeArtsAuthPlugin } from "./packages/codearts/index.mjs"

// MiniMax Code: account credits and M Plan, CN and international
export { MiniMaxCodeAuthPlugin, MiniMaxCodeGlobalAuthPlugin } from "./packages/minimax/index.mjs"

// Qoder (qoder.com and Qoder CN) and QwenWork (千问办公)
export { QoderAuthPlugin, QoderCNAuthPlugin, QwenWorkAuthPlugin, QwenWorkEnterpriseAuthPlugin } from "./packages/qoder/index.mjs"

// SenseTime Raccoon (商汤小浣熊): account credits and daily check-in
export { RaccoonAuthPlugin } from "./packages/raccoon/index.mjs"

// Trae CN (trae.cn) and Trae international (trae.ai)
export { TraeCNAuthPlugin, TraeGlobalAuthPlugin } from "./packages/trae/index.mjs"

// WorkBuddy's China build (CodeBuddy plan) and its international build
export { WorkBuddyAuthPlugin, WorkBuddyAIAuthPlugin } from "./packages/workbuddy/index.mjs"

// ZCode: Z.ai / BigModel (智谱) GLM Coding Plan, team seats and the Start Plan
export { ZCodeAuthPlugin } from "./packages/zcode/index.mjs"
