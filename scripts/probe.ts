/**
 * Probe linerider.com to discover what globals/Redux store are exposed.
 * Goal: confirm we can read state and dispatch actions from outside.
 *
 * Run: npm run probe -- [--headed]
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("shakedown");
mkdirSync(OUT_DIR, { recursive: true });

const headed = process.argv.includes("--headed");

const browser = await chromium.launch({ headless: !headed });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleLines: string[] = [];
page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));

console.log("navigating to linerider.com...");
await page.goto("https://www.linerider.com", { waitUntil: "networkidle", timeout: 60_000 });

// Give the SPA time to mount.
await page.waitForTimeout(3000);

const probe = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  const interestingKeys = Object.keys(w).filter((k) => {
    const lk = k.toLowerCase();
    return (
      lk.includes("store") ||
      lk.includes("redux") ||
      lk.includes("line") ||
      lk.includes("rider") ||
      lk.includes("track") ||
      lk.includes("engine") ||
      lk.includes("app") ||
      lk.startsWith("__")
    );
  });

  const result: Record<string, unknown> = {
    title: document.title,
    url: location.href,
    interestingGlobals: interestingKeys,
    hasStore: typeof w.store !== "undefined",
    hasReduxDevtools: typeof w.__REDUX_DEVTOOLS_EXTENSION__ !== "undefined",
  };

  if (w.store && typeof w.store.getState === "function") {
    try {
      const state = w.store.getState();
      result.storeStateTopLevelKeys = Object.keys(state);
      // Try a shallow dump (avoid massive blobs)
      const shallow: Record<string, string> = {};
      for (const k of Object.keys(state)) {
        const v = state[k];
        if (v === null) shallow[k] = "null";
        else if (Array.isArray(v)) shallow[k] = `Array(${v.length})`;
        else if (typeof v === "object") shallow[k] = `Object{${Object.keys(v).slice(0, 8).join(",")}}`;
        else shallow[k] = `${typeof v}: ${String(v).slice(0, 40)}`;
      }
      result.storeStateShallow = shallow;
    } catch (e) {
      result.storeStateError = String(e);
    }
  }

  // Hunt for hidden references to a Redux store on any element via React fiber.
  const rootEl = document.getElementById("root") || document.querySelector("[data-reactroot]") || document.body;
  let fiberStoreFound = false;
  if (rootEl) {
    const keys = Object.keys(rootEl);
    const fiberKey = keys.find((k) => k.startsWith("__reactContainer$") || k.startsWith("__reactFiber$") || k.startsWith("_reactRootContainer"));
    result.rootElementKeys = keys.slice(0, 20);
    result.reactFiberKey = fiberKey ?? null;
    if (fiberKey) {
      try {
        // Walk fiber tree shallowly looking for stateNode.store or memoizedState.store
        // deno-lint-ignore no-explicit-any
        const fiber: any = (rootEl as any)[fiberKey];
        let cur = fiber?.stateNode?.current ?? fiber;
        let depth = 0;
        while (cur && depth < 20) {
          if (cur.memoizedProps?.store) {
            fiberStoreFound = true;
            // deno-lint-ignore no-explicit-any
            (window as any).__probeStore = cur.memoizedProps.store;
            break;
          }
          cur = cur.child;
          depth++;
        }
      } catch (e) {
        result.fiberWalkError = String(e);
      }
    }
  }
  result.fiberStoreFound = fiberStoreFound;
  if (fiberStoreFound) {
    // deno-lint-ignore no-explicit-any
    const s = (window as any).__probeStore;
    if (s && typeof s.getState === "function") {
      result.probeStoreTopLevelKeys = Object.keys(s.getState());
    }
  }

  return result;
});

console.log(JSON.stringify(probe, null, 2));

writeFileSync(resolve(OUT_DIR, "probe.json"), JSON.stringify(probe, null, 2));
writeFileSync(resolve(OUT_DIR, "probe-console.log"), consoleLines.join("\n"));
await page.screenshot({ path: resolve(OUT_DIR, "probe.png"), fullPage: false });

console.log(`\nartifacts written to ${OUT_DIR}/`);

await browser.close();
