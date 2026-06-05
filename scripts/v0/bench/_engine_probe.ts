/**
 * Shared engine-comparison helpers for the WASM bench/diff harnesses — the JS
 * ground-truth engine resolution and the state/updates/rider extractors, in one
 * place so they can't drift apart (previously copy-pasted across wasm_diff_check,
 * wasm_replay_check, wasm_budget_check).
 */

export const isScarf = (id: unknown): boolean => typeof id === "string" && id.startsWith("SCARF");

/** Resolve the vendored JS engine (ground truth) + createLineFromJson, absorbing
 *  the CJS default/double-default shape (same logic _lr_engine.ts centralizes). */
export async function jsGroundTruth(): Promise<{ Engine: any; createLine: any }> {
  // deno-lint-ignore no-explicit-any
  const m: any = await import("../../../vendor/lr-core/line-rider-engine/index.js");
  const isFn = (x: unknown) => typeof x === "function";
  const Engine = isFn(m.default) ? m.default : isFn(m.default?.default) ? m.default.default : m.default;
  const createLine = isFn(m.createLineFromJson) ? m.createLineFromJson : m.default?.createLineFromJson;
  return { Engine, createLine };
}

/** Flat, exact-float signature of a frame's non-scarf entity state. */
// deno-lint-ignore no-explicit-any
export function extractState(engine: any, f: number): string {
  const sm = engine.getStateMapAtFrame(f);
  const ids = [...sm.keys()].filter((id) => !isScarf(id)).sort();
  const out: number[] = [];
  for (const id of ids) {
    const e = sm.get(id);
    const st = e.__state__ ?? e;
    if (st.pos) out.push(st.pos.x, st.pos.y, st.prevPos.x, st.prevPos.y, st.vel.x, st.vel.y);
    else out.push(st.framesSinceUnbind);
  }
  return out.join(",");
}

/** Folded per-frame update sequence: type + (numeric) id, plus the collided
 *  point ids for CollisionUpdates — so a wrong point identity (detector sled
 *  attribution) is caught, not just a wrong line id. */
// deno-lint-ignore no-explicit-any
export function extractUpdates(engine: any, f: number): string {
  const out: string[] = [];
  for (const u of engine.getUpdatesAtFrame(f)) {
    if (isScarf(u?.id)) continue;
    let s = `${u.type}:${typeof u.id === "number" ? u.id : ""}`;
    if (u.type === "CollisionUpdate" && Array.isArray(u.updated)) {
      s += `:[${u.updated.map((e: any) => e?.id).filter((id: unknown) => !isScarf(id)).join(",")}]`;
    }
    out.push(s);
  }
  return out.join("|");
}

/** Compact body position/velocity signature from getRider. */
// deno-lint-ignore no-explicit-any
export function riderSig(engine: any, f: number): string {
  const r = engine.getRider(f);
  return `${r.position.x},${r.position.y},${r.velocity.x},${r.velocity.y}`;
}
