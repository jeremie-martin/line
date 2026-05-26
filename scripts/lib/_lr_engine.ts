/**
 * lr-core interop shim — handles a CJS-default shape difference between
 * Node's main thread and worker_threads when tsx is the loader.
 *
 * Main thread:   await import("lr-core/...")  →  { default: <LineRiderEngine>, createLineFromJson, … }
 * Worker thread: await import("lr-core/...")  →  { default: { default: <LineRiderEngine>, createLineFromJson, … } }
 *
 * The double-default in worker context is a tsx loader interop quirk for CJS
 * modules. This shim absorbs both shapes so consumers can import
 * `LineRiderEngine` and `createLineFromJson` directly without caring which
 * context they're in.
 *
 * This file is interop-only — it does NOT change compiler / search behavior.
 */
// deno-lint-ignore no-explicit-any
const lrCore: any = await import("lr-core/line-rider-engine/index.js");

// Pick whichever shape exposes a callable LineRiderEngine.
const isFn = (x: unknown) => typeof x === "function";
const top = lrCore;
const nested = lrCore.default;

export const LineRiderEngine =
  isFn(top.default) ? top.default :
  isFn(nested?.default) ? nested.default :
  top.default;

export const createLineFromJson =
  isFn(top.createLineFromJson) ? top.createLineFromJson :
  isFn(nested?.createLineFromJson) ? nested.createLineFromJson :
  top.createLineFromJson;
