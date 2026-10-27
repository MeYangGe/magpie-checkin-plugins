// auth.checkin presses WorkBuddy's growth-centre chain the way
// connoryang331/magpie-workbuddy-growth's port of the client does: the
// day's 签到, the daily-activity report that lights the streak, the
// streak's make-up/redemption/draws, and one step of the cat's travel.
// Everything runs against a stubbed fetch; no home and no network.
import { test, expect, afterEach, afterAll } from "bun:test"
import { WorkBuddyAuthPlugin, WorkBuddyAIAuthPlugin } from "./index.mjs"

const offline = async () => { throw new Error("no network in tests") }
const real = globalThis.fetch
globalThis.fetch = offline
afterAll(() => (globalThis.fetch = real))
afterEach(() => { globalThis.fetch = offline })

const later = () => Date.now() + 3600_000
const ok = (data) => new Response(JSON.stringify({ code: 0, msg: "ok", data }), { headers: { "content-type": "application/json" } })
const auth = { type: "oauth", access: "tok", refresh: "r", expires: later(), uid: "u1", domain: "" }

function serve(routes) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    const u = new URL(String(url))
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ path: u.pathname, body })
    const r = routes[u.pathname]
    return r ? r(init) : ok(null)
  }
  return calls
}

const checkin = async (plugin = WorkBuddyAuthPlugin, a = auth) =>
  (await plugin({ client: {} })).auth.checkin(async () => a)

const CHECKIN = "/v2/billing/meter/daily-checkin"
const REPORT = "/v2/report"

test("the chain signs in, reports the day and takes the travel's step", async () => {
  const calls = serve({
    [CHECKIN]: () => ok({ credit: 20 }),
    [REPORT]: () => ok({}),
  })
  const out = await checkin()
  expect(out.outcome).toBe("claimed")
  expect(out.credit).toBeGreaterThanOrEqual(20)
  const paths = calls.map((c) => c.path)
  expect(paths).toContain(CHECKIN)
  expect(paths).toContain(REPORT)
  const said = String(out.message)
  expect(said).toContain("签到成功")
  expect(said).toContain("每日活跃")
})

test("a day already signed in is done, and the chain still runs", async () => {
  serve({
    [CHECKIN]: () => new Response(JSON.stringify({ code: 0, msg: "今日已签到" }), { status: 400 }),
    [REPORT]: () => ok({}),
  })
  const out = await checkin()
  expect(out.outcome).toBe("done")
  expect(String(out.message)).toContain("已签到")
})

test("the streak's day count reaches magpie's streak field", async () => {
  // growth.mjs keeps a per-uid "reported today" map (so a day is reported
  // once), so this test's account is the one it hasn't seen
  serve({
    [CHECKIN]: () => ok({ credit: 10 }),
    [REPORT]: () => ok({}),
    // the streak read is {data: {streak: {days}}}, at the path the client uses
    "/activity/growth/streak": () => ok({ streak: { days: 7 } }),
  })
  const out = await checkin(WorkBuddyAuthPlugin, { ...auth, uid: "u-streak" })
  expect(out.outcome).toBe("claimed")
  expect(String(out.message)).toContain("连登 7 天")
  expect(out.streak).toBe(7)
})

test("an enterprise account has no growth centre", async () => {
  const out = await checkin(WorkBuddyAuthPlugin, { ...auth, enterpriseId: "ent-1" })
  expect(out.outcome).toBe("inactive")
  expect(out.message).toContain("enterprise")
})

test("WorkBuddy AI has no growth centre, and asks nothing", async () => {
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

test("a day that already signed in keeps done even when a later step fails", async () => {
  globalThis.fetch = async (url) => {
    const p = new URL(String(url)).pathname
    if (p === CHECKIN) return new Response(JSON.stringify({ code: 0, msg: "今日已签到" }), { status: 400 })
    if (p === REPORT) throw new Error("report down")
    throw new Error("down")
  }
  const out = await checkin()
  expect(out.outcome).toBe("done")
})

test("the check-in's own failure is failed, with what the vendor said", async () => {
  serve({
    [CHECKIN]: () => new Response(JSON.stringify({ code: 10001, msg: "parameter error" }), { status: 500 }),
  })
  const out = await checkin()
  expect(out.outcome).toBe("failed")
  expect(String(out.message)).toContain("签到失败")
})

test("the travel's failure never takes the day's claimed away", async () => {
  // the travel step is an extra: it adds credit and a line, but the
  // outcome was settled by the check-in itself, so a travel that fails
  // still answers claimed for a day that signed in
  globalThis.fetch = async (url) => {
    const p = new URL(String(url)).pathname
    if (p === CHECKIN) return ok({ credit: 15 })
    if (p === REPORT) return ok({})
    // everything the travel needs is down
    throw new Error("travel down")
  }
  const out = await checkin(WorkBuddyAuthPlugin, { ...auth, uid: "u-travel-down" })
  expect(out.outcome).toBe("claimed")
  expect(out.credit).toBeGreaterThanOrEqual(15)
  expect(String(out.message)).toContain("猫猫旅行")
})

test("a day with no streak read carries no streak field at all", async () => {
  // magpie's contract makes streak optional: absent is not zero, so the
  // card doesn't show 「连登 0 天」 for a first-ever day
  serve({
    [CHECKIN]: () => ok({ credit: 5 }),
    [REPORT]: () => ok({}),
    "/activity/growth/streak": () => ok({ streak: { days: 0 } }),
  })
  const out = await checkin(WorkBuddyAuthPlugin, { ...auth, uid: "u-no-streak" })
  expect(out.outcome).toBe("claimed")
  expect("streak" in out).toBe(false)
})

test("the chain reports the streak it counted", async () => {
  // the chain states the day as 「连登 N 天」 in its message and index.mjs
  // reads the number back out of it for magpie's streak field. This is the
  // one test that pins the wording: those words are the wire between
  // growth.mjs and index.mjs, so a message that stops naming the day in
  // them loses the streak quietly — that's the failure this covers
  globalThis.fetch = async (url) => {
    const p = new URL(String(url)).pathname
    if (p === CHECKIN) return ok({ credit: 3 })
    if (p === REPORT) return ok({})
    if (p === "/activity/growth/streak") return ok({ streak: { days: 11 } })
    if (p === "/activity/growth/heatmap") return ok({ cells: [] })
    if (p === "/activity/growth/buddy/info") return ok({ buddy: null })
    if (p === "/activity/growth/lottery/summary") return ok({ chances: 0 })
    return ok(null)
  }
  const plugin = await WorkBuddyAuthPlugin({ client: {} })
  const out = await plugin.auth.checkin(async () => ({ ...auth, uid: "u-counted" }))
  expect(out.outcome).toBe("claimed")
  expect(out.streak).toBe(11)
  expect(String(out.message)).toContain("连登 11 天")
})
