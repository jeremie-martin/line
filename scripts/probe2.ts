/**
 * Deeper probe: enter the editor, then look for Video Export trigger.
 *
 * Run: npm run probe2 -- [--headed]
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

console.log("navigating...");
await page.goto("https://www.linerider.com", { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);

// Inspect splash DOM to find PLAY locator
const splashButtons = await page.evaluate(() => {
  const anchors = Array.from(document.querySelectorAll("a, button, [role=button]"));
  return anchors.map((el) => ({
    tag: el.tagName,
    text: (el.textContent || "").trim().slice(0, 30),
    href: (el as HTMLAnchorElement).href ?? null,
  })).filter((x) => x.text);
});
console.log("splash buttons:", JSON.stringify(splashButtons, null, 2));

// Try clicking via case-insensitive text
console.log("clicking PLAY...");
const playButton = page.locator("text=/^\\s*PLAY\\s*$/i").first();
await playButton.click({ timeout: 10_000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: resolve(OUT_DIR, "probe2-editor.png"), fullPage: false });
console.log("now at:", page.url());

const probe = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const w = window as any;

  const allGlobals = Object.keys(w);
  const interestingGlobals = allGlobals.filter((k) => {
    const lk = k.toLowerCase();
    return (
      lk.includes("export") || lk.includes("render") || lk.includes("video") ||
      lk.includes("store") || lk.includes("track") || lk.includes("line") ||
      lk.includes("rider") || lk.includes("engine") || lk.includes("save") ||
      lk.includes("load") || lk.includes("add") || lk.includes("create") ||
      lk.includes("mod") || lk.includes("encode") || lk.includes("record")
    );
  });

  const result: Record<string, unknown> = {
    title: document.title,
    interestingGlobals: interestingGlobals.sort(),
  };

  if (w.store) {
    const state = w.store.getState();
    result.topLevelKeys = Object.keys(state);

    if (state.command?.hotkeys) {
      result.hotkeyCount = Object.keys(state.command.hotkeys).length;
      result.allHotkeyIds = Object.keys(state.command.hotkeys).sort();
      result.exportHotkeys = Object.keys(state.command.hotkeys).filter((k) =>
        /export|render|video|record/i.test(k)
      );
    }

    if (state.views) {
      result.views = state.views;
    }

    if (state.progress) {
      result.progressKeys = Object.keys(state.progress);
    }
  }

  const fnGlobals: string[] = [];
  for (const k of allGlobals) {
    try {
      if (typeof w[k] === "function" && !/^[A-Z]/.test(k.charAt(0)) && !k.startsWith("webkit")) {
        fnGlobals.push(k);
      }
    } catch { /* ignore */ }
  }
  result.functionGlobalsLower = fnGlobals.sort();

  // Look for export-related buttons in the editor DOM
  const buttons = Array.from(document.querySelectorAll("button, a, [role=button], [title]"));
  result.exportRelatedDom = buttons
    .map((el) => ({
      tag: el.tagName,
      text: (el.textContent || "").trim().slice(0, 40),
      title: el.getAttribute("title") || "",
      ariaLabel: el.getAttribute("aria-label") || "",
    }))
    .filter((x) => /export|render|video|record/i.test(x.text + x.title + x.ariaLabel));

  return result;
});

console.log(JSON.stringify(probe, null, 2));
writeFileSync(resolve(OUT_DIR, "probe2.json"), JSON.stringify(probe, null, 2));
writeFileSync(resolve(OUT_DIR, "probe2-console.log"), consoleLines.join("\n"));

await browser.close();
console.log(`\nartifacts in ${OUT_DIR}/`);
