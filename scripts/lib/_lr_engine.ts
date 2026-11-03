/** Engine selection for reference and legacy replay tools. The compiler imports
 * native_motion/engine.ts directly. Published and vendored JS remain independent
 * parity oracles; _lr_engine_wasm.ts wraps the frozen judge. */
const backend = process.env.LR_ENGINE ?? 'wasm';
if (!['wasm', 'js', 'official'].includes(backend)) throw new Error(`unknown LR_ENGINE: ${backend}`);

// CJS under tsx has one default in the main thread and two in workers.
const module: any = backend === 'js'
  ? await import('../../vendor/lr-core/line-rider-engine/index.js')
  : backend === 'official'
    ? await import('lr-core/line-rider-engine/index.js')
    : await import('./_lr_engine_wasm.ts');
export const LineRiderEngine = typeof module.default === 'function' ? module.default
  : typeof module.default?.default === 'function' ? module.default.default : module.LineRiderEngine;
export const createLineFromJson = module.createLineFromJson ?? module.default?.createLineFromJson;
