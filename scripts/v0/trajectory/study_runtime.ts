/** Runtime identity used by every frozen-trajectory capture and replay. */
export function activeStudyEngine(environment: NodeJS.ProcessEnv = process.env): string {
  // Keep this aligned with scripts/lib/_lr_engine.ts: an unset LR_ENGINE loads
  // the Rust/WASM engine, while js/official/record are explicit diagnostic modes.
  return environment.LR_ENGINE ?? "wasm";
}
