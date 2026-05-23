/**
 * Reach the live VideoExporter React component instance via fiber walk.
 *
 * Why: the resolution/HQ knobs and the render trigger live in component
 * state, not Redux. From outside the page we can dispatch Redux actions
 * easily, but to set component state we need to find the live instance.
 *
 * Approach: open the modal, then walk the React fiber tree from #root
 * looking for any class component whose state has a `resolutionOption`
 * field (a uniquely-named field on the VideoExporter, per unpacked/1044.js).
 */
import { chromium } from "playwright";

const ORIGIN = process.env.LR_ORIGIN ?? "http://127.0.0.1:8765";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

const consoleLines: string[] = [];
page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));

console.log(`navigating to ${ORIGIN}/?forceMillions ...`);
await page.goto(`${ORIGIN}/?forceMillions`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);

// Enter editor via the documented action creator path, dispatched directly.
// The shape was reverse-engineered from unpacked/279.js:
//   enterEditor = () => setViews("ENTER_EDITOR", {[Main]: Editor, [Entry]: null, [TrackLoader]: null})
// where setViews = (e, t, n=false) => ({type:"SET_VIEWS", payload:t, meta:{name:e, auto:n}})
// We don't know the Pages.Main / Pages.Entry constant string values from here,
// but we can read them from state.views (which already shows e.g. Main="editor").
const enterResult = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  const before = w.store.getState().views;
  w.store.dispatch({
    type: "SET_VIEWS",
    payload: { Main: "editor", Entry: null, TrackLoader: null },
    meta: { name: "ENTER_EDITOR", auto: false },
  });
  const after = w.store.getState().views;
  return { before, after };
});
console.log("enter-editor dispatch:", JSON.stringify(enterResult, null, 2));
await page.waitForTimeout(1500);

// Open the VideoExporter modal via dispatch.
const openResult = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;
  w.store.dispatch({
    type: "SET_VIEWS",
    payload: { Sidebar: null, VideoExporter: "export" },
    meta: { name: "OPEN_VIDEO_EXPORTER", auto: false },
  });
  return w.store.getState().views;
});
console.log("openVideoExporter views:", JSON.stringify(openResult, null, 2));
await page.waitForTimeout(1500);

// Walk the React fiber tree, looking for any class component instance whose
// state has the signature fields of VideoExporter.
const fiberHits = await page.evaluate(function () {
  type Hit = { path: string; stateKeys: string[]; stateSample: Record<string, unknown>; methodNames: string[] };
  const hits: Hit[] = [];

  // React fiber keys can be attached to various elements; walk the whole DOM looking for them.
  // deno-lint-ignore no-explicit-any
  let rootEl: any = null;
  let key: string | null = null;
  const diag = { bodyChildCount: document.body.children.length, bodyChildren: [] as string[], elementsWithReactKey: 0, samplePaths: [] as string[] };
  const allEls = document.querySelectorAll("*");
  diag.bodyChildren = Array.from(document.body.children).map((c) => c.tagName + (c.id ? "#" + c.id : ""));
  for (let i = 0; i < allEls.length; i++) {
    const el = allEls[i];
    for (const k of Object.keys(el)) {
      if (k.startsWith("__react")) {
        diag.elementsWithReactKey++;
        if (diag.samplePaths.length < 5) diag.samplePaths.push(`${el.tagName}${el.id ? "#" + el.id : ""} : ${k}`);
        if (!key && (k.startsWith("__reactContainer$") || k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"))) {
          key = k;
          // deno-lint-ignore no-explicit-any
          rootEl = el as any;
        }
        break;
      }
    }
    if (diag.elementsWithReactKey > 100) break;
  }
  if (!key || !rootEl) return { error: "no React fiber keys found in DOM", diag, hits };

  // Walk UP `.return` from the starting fiber to the FiberRoot (where return===null),
  // then BFS the whole tree downward. Handles portals: MUI dialogs mount in a separate
  // DOM subtree but the same fiber tree.
  // deno-lint-ignore no-explicit-any
  let startFiber: any = rootEl[key];
  if (!startFiber) return { error: "fiber key present but empty", diag, hits };

  // Climb to root
  let topFiber = startFiber;
  let climbed = 0;
  while (topFiber.return && climbed < 200) {
    topFiber = topFiber.return;
    climbed++;
  }

  const SIGNATURE = ["resolutionOption", "resolutionWidth", "resolutionHeight"];

  // deno-lint-ignore no-explicit-any
  const stack: { fiber: any; depth: number }[] = [{ fiber: topFiber, depth: 0 }];
  let visited = 0;
  let maxDepth = 0;
  while (stack.length && visited < 20000) {
    const { fiber, depth } = stack.pop()!;
    visited++;
    if (!fiber) continue;
    if (depth > maxDepth) maxDepth = depth;

    const node = fiber.stateNode;
    if (node && typeof node === "object" && node.state && node.props && typeof node.setState === "function") {
      const stateKeys = Object.keys(node.state);
      if (SIGNATURE.every((k) => stateKeys.includes(k))) {
        const stateSample: Record<string, unknown> = {};
        for (const k of stateKeys) stateSample[k] = node.state[k];
        const methodNames = Object.getOwnPropertyNames(node).filter((n) => typeof node[n] === "function" && /^on[A-Z]/.test(n));
        hits.push({ path: `depth=${depth}`, stateKeys, stateSample, methodNames });
        // deno-lint-ignore no-explicit-any
        (window as any).__videoExporter = node;
      }
    }

    if (fiber.child) stack.push({ fiber: fiber.child, depth: depth + 1 });
    if (fiber.sibling) stack.push({ fiber: fiber.sibling, depth });
  }

  return { error: null, visited, climbed, maxDepth, hits, fiberKeyOnRoot: key };
});

console.log("\nfiber-walk result:");
console.log(JSON.stringify(fiberHits, null, 2));

// If we found it, try calling a benign read on the instance: just confirm
// we can poke .state from outside via the window alias.
if (Array.isArray(fiberHits.hits) && fiberHits.hits.length > 0) {
  const probe = await page.evaluate(() => {
    // deno-lint-ignore no-explicit-any
    const v = (window as any).__videoExporter;
    return {
      canRead: !!v && typeof v.state === "object",
      hasOnRenderButtonClick: typeof v.onRenderButtonClick === "function",
      hasSetState: typeof v.setState === "function",
      currentStatus: v.state.status,
      currentResolutionOption: v.state.resolutionOption,
      handlersOfInterest: ["onRenderButtonClick", "onHQChange", "onResolutionOptionChange", "onResolutionWidthChange", "onResolutionHeightChange", "onStartFromChange"]
        .map((n) => ({ name: n, present: typeof v[n] === "function" })),
    };
  });
  console.log("\ninstance probe:");
  console.log(JSON.stringify(probe, null, 2));
}

await page.screenshot({ path: "shakedown/fiber-probe.png" });
await browser.close();
