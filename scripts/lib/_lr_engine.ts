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
 *
 * The engine is VENDORED at vendor/lr-core (a copy of lr-core's ES6 source,
 * verified byte-identical to the published build via `npm run trace`). We own
 * it so the per-frame hot path can be optimized in-repo with the trace oracle
 * guarding behavior. The original `lr-core` package is kept as a devDependency
 * (reference + supplies the `immy`/`lodash` leaf deps the engine imports).
 */
// DEFAULT = Rust→WASM engine (engine-rs) — the one we always want. LR_ENGINE=js selects the
// vendored JS engine (parity reference); record/official are diagnostic paths.
// deno-lint-ignore no-explicit-any
let _LineRiderEngine: any;
// deno-lint-ignore no-explicit-any
let _createLineFromJson: any;

if (process.env.LR_ENGINE === "record") {
  const r = await import("./_lr_engine_record.ts");
  _LineRiderEngine = r.LineRiderEngine;
  _createLineFromJson = r.createLineFromJson;
} else if (process.env.LR_ENGINE === "official") {
  // Reference path for parity probes: the untouched published lr-core CJS build.
  // deno-lint-ignore no-explicit-any
  const lrCore: any = await import("lr-core/line-rider-engine/index.js");
  const isFn = (x: unknown) => typeof x === "function";
  const top = lrCore;
  const nested = lrCore.default;
  _LineRiderEngine =
    isFn(top.default) ? top.default :
    isFn(nested?.default) ? nested.default :
    top.default;
  _createLineFromJson =
    isFn(top.createLineFromJson) ? top.createLineFromJson :
    isFn(nested?.createLineFromJson) ? nested.createLineFromJson :
    top.createLineFromJson;
} else if (process.env.LR_ENGINE === "js") {
  // deno-lint-ignore no-explicit-any
  const lrCore: any = await import("../../vendor/lr-core/line-rider-engine/index.js");
  const isFn = (x: unknown) => typeof x === "function";
  const top = lrCore;
  const nested = lrCore.default;
  _LineRiderEngine =
    isFn(top.default) ? top.default :
    isFn(nested?.default) ? nested.default :
    top.default;
  _createLineFromJson =
    isFn(top.createLineFromJson) ? top.createLineFromJson :
    isFn(nested?.createLineFromJson) ? nested.createLineFromJson :
    top.createLineFromJson;
} else {
  // Default: Rust→WASM.
  const w = await import("./_lr_engine_wasm.ts");
  _LineRiderEngine = w.LineRiderEngine;
  _createLineFromJson = w.createLineFromJson;
}

export const LineRiderEngine = _LineRiderEngine;
export const createLineFromJson = _createLineFromJson;
