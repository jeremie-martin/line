//! Compiler physics backend, independently checked against engine-rs and lr-core.
//! Modules separate simulation, stored frames, version ownership and transport:
//!
//!   grid.rs    — cell coordinates, rasterization and integer lookup tables
//!   line.rs    — immutable line geometry and ordered grid registration
//!   kernel.rs  — body state, solver, collision queries and explicit observations
//!   history.rs — collision indexes and rollback for geometry edits
//!   frame_states.rs — saved-state chunks shared across detached caches
//!   cache.rs   — geometry, computed frames, summaries and lazy history
//!   engine.rs  — immutable versions, lineage reconciliation and handle ownership
//!   abi.rs     — private compiler WASM boundary, paired with wasm.ts
//!
//! Only +,-,*,/,sqrt; `f64::sqrt` → wasm `f64.sqrt` (IEEE-754 correctly-rounded,
//! identical to V8). Exact operation order is preserved — the chaotic sim demands it.

mod grid;
mod line;
mod kernel;
mod history;
mod frame_states;
mod cache;
mod engine;
mod abi;

// ── rider body topology (rider-data/index.json, scarf dropped) ──
// entity indices in state-array order
pub(crate) const RIDER_MOUNTED: usize = 0;
pub(crate) const SLED_INTACT: usize = 1;
pub(crate) const PEG: usize = 2;
pub(crate) const TAIL: usize = 3;
pub(crate) const NOSE: usize = 4;
pub(crate) const STRING: usize = 5;
pub(crate) const BUTT: usize = 6;
pub(crate) const SHOULDER: usize = 7;
pub(crate) const RHAND: usize = 8;
pub(crate) const LHAND: usize = 9;
pub(crate) const LFOOT: usize = 10;
pub(crate) const RFOOT: usize = 11;
pub(crate) const NENT: usize = 12;

pub(crate) const BASE: [(f64, f64); NENT] = [
    (0.0, 0.0), (0.0, 0.0), (0.0, 0.0), (0.0, 5.0), (15.0, 5.0), (17.5, 0.0),
    (5.0, 0.0), (5.0, -5.5), (11.5, -5.0), (11.5, -5.0), (10.0, 5.0), (10.0, 5.0),
];
pub(crate) const IS_POINT: [bool; NENT] = [
    false, false, true, true, true, true, true, true, true, true, true, true,
];

// iterating constraints: (kind, p1, p2, binding, endurance_param, length_factor)
// kind: 0=Stick, 1=BindStick, 2=RepelStick
pub(crate) const ITER: [(u8, usize, usize, usize, f64, f64); 22] = [
    (0, PEG, TAIL, 0, 0.0, 1.0),
    (0, TAIL, NOSE, 0, 0.0, 1.0),
    (0, NOSE, STRING, 0, 0.0, 1.0),
    (0, STRING, PEG, 0, 0.0, 1.0),
    (0, PEG, NOSE, 0, 0.0, 1.0),
    (0, STRING, TAIL, 0, 0.0, 1.0),
    (1, PEG, BUTT, RIDER_MOUNTED, 0.057, 1.0),
    (1, TAIL, BUTT, RIDER_MOUNTED, 0.057, 1.0),
    (1, NOSE, BUTT, RIDER_MOUNTED, 0.057, 1.0),
    (0, SHOULDER, BUTT, 0, 0.0, 1.0),
    (0, SHOULDER, LHAND, 0, 0.0, 1.0),
    (0, SHOULDER, RHAND, 0, 0.0, 1.0),
    (0, BUTT, LFOOT, 0, 0.0, 1.0),
    (0, BUTT, RFOOT, 0, 0.0, 1.0),
    (0, SHOULDER, RHAND, 0, 0.0, 1.0), // SHOULDER_RHAND_2
    (1, SHOULDER, PEG, RIDER_MOUNTED, 0.057, 1.0),
    (1, STRING, LHAND, RIDER_MOUNTED, 0.057, 1.0),
    (1, STRING, RHAND, RIDER_MOUNTED, 0.057, 1.0),
    (1, LFOOT, NOSE, RIDER_MOUNTED, 0.057, 1.0),
    (1, RFOOT, NOSE, RIDER_MOUNTED, 0.057, 1.0),
    (2, SHOULDER, LFOOT, 0, 0.0, 0.5),
    (2, SHOULDER, RFOOT, 0, 0.0, 0.5),
];
pub(crate) const NITER: usize = 22;

// non-iterating BindJoints: (p1, p2, q1, q2, binding)
pub(crate) const JOINTS: [(usize, usize, usize, usize, usize); 3] = [
    (SHOULDER, BUTT, STRING, PEG, RIDER_MOUNTED),
    (PEG, TAIL, STRING, PEG, SLED_INTACT),
    (PEG, TAIL, STRING, PEG, RIDER_MOUNTED),
];

pub(crate) const GRAVITY_X: f64 = 0.0;
pub(crate) const GRAVITY_Y: f64 = 0.175;
pub(crate) const ITERATE: usize = 6;
