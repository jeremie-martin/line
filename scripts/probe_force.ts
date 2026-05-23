/**
 * Find what "force enable graphics" actually changes (URL? localStorage? cookie?).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("shakedown");
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto("https://www.linerider.com", { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2000);
await page.locator("text=/^\\s*PLAY\\s*$/i").first().click({ timeout: 10_000 });
await page.waitForTimeout(3000);

// Capture pre-state
const pre = await page.evaluate(() => ({
  url: location.href,
  localStorage: { ...localStorage },
  sessionStorage: { ...sessionStorage },
}));

// Open video export
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  for (const btn of buttons) {
    const d = btn.querySelector("path")?.getAttribute("d") ?? "";
    if (d.startsWith("M17,10.5V7C17,6.45")) { (btn as HTMLButtonElement).click(); return; }
  }
});
await page.waitForTimeout(1500);

// Snapshot the force-enable link's href and onclick attribute BEFORE clicking it
const linkInfo = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a, button"));
  for (const el of links) {
    const t = (el.textContent || "").trim().toLowerCase();
    if (t.includes("force enabling") || t.includes("force enable")) {
      return {
        tag: el.tagName,
        text: el.textContent?.trim(),
        href: (el as HTMLAnchorElement).href ?? null,
        onclick: el.getAttribute("onclick"),
        outerHTML: el.outerHTML.slice(0, 500),
      };
    }
  }
  return null;
});
console.log("force-enable link info:\n", JSON.stringify(linkInfo, null, 2));

// Click it and snapshot post
await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a, button"));
  for (const el of links) {
    const t = (el.textContent || "").trim().toLowerCase();
    if (t.includes("force enabling") || t.includes("force enable")) { (el as HTMLElement).click(); return; }
  }
});
await page.waitForTimeout(3000);

const post = await page.evaluate(() => ({
  url: location.href,
  localStorage: { ...localStorage },
  sessionStorage: { ...sessionStorage },
}));

const diff = {
  urlChanged: pre.url !== post.url,
  urlBefore: pre.url,
  urlAfter: post.url,
  localStorageDiff: Object.fromEntries(
    Object.entries(post.localStorage).filter(([k, v]) => pre.localStorage[k] !== v),
  ),
  removed: Object.keys(pre.localStorage).filter((k) => !(k in post.localStorage)),
  sessionStorageDiff: Object.fromEntries(
    Object.entries(post.sessionStorage).filter(([k, v]) => pre.sessionStorage[k] !== v),
  ),
};

console.log("diff:\n", JSON.stringify(diff, null, 2));
writeFileSync(resolve(OUT_DIR, "force-enable-diff.json"), JSON.stringify({ linkInfo, pre, post, diff }, null, 2));

await browser.close();
