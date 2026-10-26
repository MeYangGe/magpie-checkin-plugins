// auth.checkin presses WorkBuddy's 签到 (China build only) the way the
// built-in workbuddy_checkin.go did through the plugin's fetch: the
// event's status first, the claim while it runs and today's isn't in, and
// a 401 told apart by whether the account's credits still read.
import { test, expect, afterEach, afterAll } from "bun:test"
import { WorkBuddyAuthPlugin, WorkBuddyAIAuthPlugin } from "./index.mjs"

// nothing leaves the machine; the fetch this file found is put back when it
// is done, so the next test file (bun runs them all in one process) doesn't
// inherit a stand-in: reset.test.mjs reads the real fetch it found
const offline = async () => { throw new Error("no network in tests") }
const real = globalThis.fetch
globalThis.fetch = offline
afterAll(() => (globalThis.fetch = real))
afterEach(() => { globalThis.fetch = offline })

const later = () => Date.now() + 3600_000
const ok = (data) => new Response(JSON.stringify({ code: 0, msg: "ok", data }))
const auth = { type: "oauth", access: "a", refresh: "r", expires: later(), uid: "u" }

function serve(routes) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    const u = new URL(String(url))
    calls.push({ url: u, init, headers: new Headers(init?.headers) })
    const r = routes[u.pathname]
    return r ? r(init) : new Response("", { status: 404 })
  }
  return calls
}

const STATUS = "/v2/billing/meter/checkin-activity-status"
const CLAIM = "/v2/billing/meter/daily-checkin"
const SUMMARY = "/billing/meter/get-user-resource-summary"

const checkin = async (plugin = WorkBuddyAuthPlugin, a = auth) => (await plugin({ client: {} })).auth.checkin(async () => a)

test("a day not in yet is claimed, its credits and streak reported", async () => {
  const calls = serve({
    [STATUS]: () => ok({ Active: true, TodayCheckedIn: false, StreakDays: 4 }),
    [CLAIM]: () => ok({ Credit: 20, StreakDays: 5, Message: "签到成功" }),
  })
  expect(await checkin()).toEqual({ outcome: "claimed", credit: 20, streak: 5, message: "签到成功" })
  const claim = calls.find((c) => c.url.pathname === CLAIM)
  expect(claim.url.origin).toBe("https://copilot.tencent.com")
  expect(claim.init.method).toBe("POST")
  expect(claim.headers.get("authorization")).toBe("Bearer a")
})

test("a day already in is done, with its streak", async () => {
  serve({ [STATUS]: () => ok({ Active: true, TodayCheckedIn: true, StreakDays: 6, TodayCredit: 20 }) })
  expect(await checkin()).toEqual({ outcome: "done", streak: 6 })
})

test("an event that isn't on is inactive, with the vendor's own words", async () => {
  serve({ [STATUS]: () => ok({ Active: false, Message: "活动已结束" }) })
  expect(await checkin()).toEqual({ outcome: "inactive", message: "活动已结束" })
})

test("no event at all is inactive without words", async () => {
  serve({ [STATUS]: () => ok({ Active: false }) })
  expect(await checkin()).toEqual({ outcome: "inactive", message: "no check-in event is on now" })
})

// WorkBuddy's app sends the check-in with a device token from its security
// SDK; a plugin can't make one. A 401 whose credits still read is that,
// not a dead sign-in: the day's answer is to check in in the app.
test("a 401 whose credits read is the app's own check-in, not a dead sign-in", async () => {
  serve({ [STATUS]: () => new Response("", { status: 401 }), [SUMMARY]: () => ok({ IsPaidUser: true, Packages: [] }) })
  const out = await checkin()
  expect(out.outcome).toBe("captcha")
  expect(out.message).toContain("WorkBuddy app")
})

test("a 401 whose credits don't read either is the sign-in gone", async () => {
  serve({ [STATUS]: () => new Response("", { status: 401 }), [SUMMARY]: () => new Response("", { status: 401 }) })
  expect(await checkin()).toEqual({ outcome: "failed", message: "WorkBuddy refused this account's sign-in; sign in to it again" })
})

test("a claim refused as already in is done, not a failure", async () => {
  serve({
    [STATUS]: () => ok({ Active: true, TodayCheckedIn: false, StreakDays: 3 }),
    [CLAIM]: () => new Response(JSON.stringify({ code: 10086, msg: "今天已签到" }), { status: 200 }),
  })
  expect(await checkin()).toEqual({ outcome: "done", streak: 3 })
})

test("a claim that failed otherwise is failed, with what WorkBuddy said", async () => {
  serve({
    [STATUS]: () => ok({ Active: true, TodayCheckedIn: false }),
    [CLAIM]: () => new Response(JSON.stringify({ code: 10001, msg: "parameter error" }), { status: 200 }),
  })
  expect(await checkin()).toEqual({ outcome: "failed", message: "parameter error" })
})

test("a status read that failed otherwise is failed, magpie asks again later", async () => {
  serve({ [STATUS]: () => new Response("", { status: 500 }) })
  const out = await checkin()
  expect(out.outcome).toBe("failed")
})

// WorkBuddy AI ships with the event off: the international build answers
// inactive rather than asking an endpoint it has none of
test("WorkBuddy AI has no check-in, and asks nothing", async () => {
  const calls = serve({})
  const out = await checkin(WorkBuddyAIAuthPlugin)
  expect(out.outcome).toBe("inactive")
  expect(calls.length).toBe(0)
})

test("an account not signed in is failed", async () => {
  const out = await checkin(WorkBuddyAuthPlugin, { type: "api", key: "k" })
  expect(out.outcome).toBe("failed")
  expect(out.message).toBe("not signed in")
})
