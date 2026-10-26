// The daily claim (magpie's check-in): the list, the risk control's word,
// the activation events and the claim's answers, as zcode.z.ai answers
// them (agent2api's port of the ZCode client worked them out). Everything
// runs against a stubbed fetch; no home and no network is touched.
import { afterEach, beforeEach, expect, test } from "bun:test"
import { ZCodeAuthPlugin } from "./index.mjs"

const now = Math.trunc(Date.now() / 1000)
const jwt = ["{}", JSON.stringify({ exp: now + 3600 })].map((s) => Buffer.from(s).toString("base64url")).join(".") + ".synthetic"
const state = { site: "zai", base: "https://api.z.ai/api/anthropic", key: "synthetic-key", jwt, device: "11111111-2222-4333-8444-555555555555", uid: "u-42" }
const auth = { type: "oauth", access: state.key, refresh: JSON.stringify(state), expires: 0, accountId: "a@example.com", uid: state.uid }

const PREVIEW = "/api/v1/zcode-plan/billing/preview"
const CLAIM = "/api/v1/zcode-plan/billing/claim"
const CONFIGS = "/api/v1/client/configs"
const EVENT = "/api/v1/event/report"

const run = { plans: [], emptyFirst: false, captcha: { enabled: false, prefix: "no8xfe", region: "cn", sceneId: "11xygtvd" }, claims: {}, previews: 0 }
const sent = []
const ok = (data) => new Response(JSON.stringify({ code: 0, data }), { headers: { "content-type": "application/json" } })
const envelope = (code, msg) => new Response(JSON.stringify({ code, msg }), { headers: { "content-type": "application/json" } })
const plan = (over = {}) => ({ plan_id: "zcode-v3-start-plan-trust-0928", name: "ZCode Trust Build", priority: 10, entitlements: [{ show_name: "Trust Build quota", unit_type: "tokens", grant_units: 100_000_000, period: "one_time" }], ...over })
const real = globalThis.fetch

beforeEach(() => {
  run.plans = []
  run.emptyFirst = false
  run.captcha = { enabled: false, prefix: "no8xfe", region: "cn", sceneId: "11xygtvd" }
  run.claims = {}
  run.previews = 0
  sent.length = 0
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const body = init.body ? JSON.parse(init.body) : undefined
    sent.push({ path: url.pathname, headers: init.headers ?? {}, body })
    if (url.pathname === PREVIEW) {
      run.previews++
      return ok({ plans: run.emptyFirst && run.previews < 2 ? [] : run.plans })
    }
    if (url.pathname === CONFIGS) return ok({ configs: { captcha: run.captcha } })
    if (url.pathname === EVENT) return ok({})
    if (url.pathname === CLAIM) {
      const answer = run.claims[body?.plan_id]
      if (answer?.code) return envelope(answer.code, answer.msg)
      return ok({ plan: { starts_at: now, ends_at: now + 86400 } })
    }
    throw new Error("unmocked request blocked: " + url.pathname)
  }
})
afterEach(() => { globalThis.fetch = real })

const checkin = async (credentials = auth) => {
  const plugin = await ZCodeAuthPlugin({ client: {} })
  return plugin.auth.checkin(async () => credentials)
}

test("a listed plan is claimed, its one-off tokens the credit", async () => {
  run.plans = [plan()]
  const out = await checkin()
  expect(out.outcome).toBe("claimed")
  expect(out.credit).toBe(100_000_000)
  expect(out.message).toBe("claimed ZCode Trust Build")
  const claim = sent.find((r) => r.path === CLAIM)
  expect(claim.body).toEqual({ plan_id: "zcode-v3-start-plan-trust-0928" })
  expect(claim.headers.Authorization).toBe("Bearer " + jwt)
  expect(claim.headers["X-Device-Mid"]).toBe(state.device)
  expect(claim.headers["X-ZCode-App-Version"]).toBeTruthy()
  expect(claim.headers["X-Platform"]).toBe(process.platform + "-" + process.arch)
  expect(claim.headers["X-Aliyun-Captcha-Verify-Param"]).toBeUndefined()
})

test("a claim refused as already claimed is done", async () => {
  run.plans = [plan()]
  run.claims["zcode-v3-start-plan-trust-0928"] = { code: 1003, msg: "该套餐已领取" }
  expect(await checkin()).toEqual({ outcome: "done", message: "every plan on the list was claimed already" })
})

test("the risk control wanting the slider is captcha, and no claim is pressed", async () => {
  run.plans = [plan()]
  run.captcha = { ...run.captcha, enabled: true }
  const out = await checkin()
  expect(out.outcome).toBe("captcha")
  expect(out.message).toBe("claim “ZCode Trust Build” in the ZCode app")
  expect(sent.some((r) => r.path === CLAIM)).toBe(false)
})

test("a claim refused 3007 is captcha even when the risk control said no", async () => {
  run.plans = [plan()]
  run.claims["zcode-v3-start-plan-trust-0928"] = { code: 3007, msg: "验证码校验未通过" }
  expect((await checkin()).outcome).toBe("captcha")
})

test("an empty list reports the day's activation and reads the list once more", async () => {
  run.plans = [plan()]
  run.emptyFirst = true
  const out = await checkin()
  expect(out.outcome).toBe("claimed")
  const events = sent.filter((r) => r.path === EVENT)
  expect(events.map((e) => e.body.element_name)).toEqual(["app_launch", "app_daily_active"])
  expect(events[0].body.user_id).toBe(state.uid)
  expect(events[0].body.device_mid).toBe(state.device)
  expect(events[0].body.event_id).not.toBe(events[1].body.event_id)
  expect(events[0].headers.Authorization).toBeUndefined()
  expect(events[0].headers["X-Device-Mid"]).toBeUndefined()
  expect(run.previews).toBe(2)
})

test("an empty list that stays empty after the events is inactive", async () => {
  const out = await checkin()
  expect(out.outcome).toBe("inactive")
  expect(run.previews).toBe(2)
})

test("an account without a user id skips the events", async () => {
  const out = await checkin({ ...auth, refresh: JSON.stringify({ ...state, uid: undefined }), uid: undefined })
  expect(out.outcome).toBe("inactive")
  expect(sent.some((r) => r.path === EVENT)).toBe(false)
})

test("a 404 list — a run not up yet — is inactive, not a failure", async () => {
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === PREVIEW) return new Response("not found", { status: 404 })
    if (url.pathname === EVENT) return ok({})
    throw new Error("unmocked request blocked: " + url.pathname)
  }
  expect((await checkin()).outcome).toBe("inactive")
})

test("a list that fails to read is failed, magpie asks again later", async () => {
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === PREVIEW) return new Response("boom", { status: 500 })
    throw new Error("unmocked request blocked: " + url.pathname)
  }
  const out = await checkin()
  expect(out.outcome).toBe("failed")
  expect(out.message).toBe("the gift plan list failed to read")
})

test("several plans are claimed in priority order, the grants summed", async () => {
  run.plans = [
    plan({ plan_id: "zcode-v3-start-plan-trust-0928", priority: 20 }),
    plan({ plan_id: "zcode-v3-start-plan-daily-0929", name: "ZCode Daily", priority: 10, entitlements: [{ show_name: "Daily", unit_type: "tokens", grant_units: 5_000, period: "daily" }] }),
  ]
  run.claims["zcode-v3-start-plan-daily-0929"] = { code: 1003, msg: "该套餐已领取" }
  const out = await checkin()
  expect(out.outcome).toBe("claimed")
  expect(out.credit).toBe(100_000_000)
  expect(out.message).toBe("claimed ZCode Trust Build · 1 claimed already")
  const order = sent.filter((r) => r.path === CLAIM).map((r) => r.body.plan_id)
  expect(order).toEqual(["zcode-v3-start-plan-trust-0928", "zcode-v3-start-plan-daily-0929"])
})

test("a run not open yet or spent is inactive, with what the vendor said", async () => {
  run.plans = [plan()]
  run.claims["zcode-v3-start-plan-trust-0928"] = { code: 1002, msg: "活动已结束" }
  expect(await checkin()).toEqual({ outcome: "inactive", message: "活动已结束" })
})

test("an account the run does not take is ineligible", async () => {
  run.plans = [plan()]
  run.claims["zcode-v3-start-plan-trust-0928"] = { code: 1004, msg: "不符合活动资格" }
  expect(await checkin()).toEqual({ outcome: "ineligible", message: "不符合活动资格" })
})

test("an API key has no session to claim with", async () => {
  const out = await checkin({ type: "api", key: "synthetic-key" })
  expect(out.outcome).toBe("ineligible")
  expect(sent.length).toBe(0)
})

test("an expired session is failed with the sign-in words", async () => {
  const expired = ["{}", JSON.stringify({ exp: now - 60 })].map((s) => Buffer.from(s).toString("base64url")).join(".") + ".synthetic"
  const out = await checkin({ ...auth, refresh: JSON.stringify({ ...state, jwt: expired }) })
  expect(out.outcome).toBe("failed")
  expect(out.message).toContain("sign in to ZCode again")
})

test("a claimed plan reaches the requests at once: the route cache is dropped", async () => {
  const { _internal } = await import("./index.mjs")
  _internal.routes.set(state.key + "\0" + jwt, { start: true, at: Date.now() })
  run.plans = [plan()]
  await checkin()
  expect(_internal.routes.has(state.key + "\0" + jwt)).toBe(false)
})
