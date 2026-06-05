//! Line Rider body physics — a Rust→WASM reimplementation of the vendored lr-core,
//! a BIT-IDENTICAL drop-in (the cosmetic scarf dropped). Organized 1:1 with the JS
//! engine so each module audits against one source file:
//!
//!   grid.rs   ← utils/hashNumberPair.js + grids/getCellsFromLine.js + ClassicGrid geom
//!   line.rs   ← lines/{Line,SolidLine,AccLine}.js + ClassicGrid cellLinesMap
//!   kernel.rs ← states/index.js + constraints/index.js + SolidLine.collide (the solver)
//!   frame.rs  ← line-engine/Frame.js (collision-history grid + invalidation scan)
//!   engine.rs ← line-engine/LineEngine.js (lazy frame cache, fork, _addLine)
//!   abi.rs    ← the WASM export surface (frozen contract)
//!
//! Only +,-,*,/,sqrt; `f64::sqrt` → wasm `f64.sqrt` (IEEE-754 correctly-rounded,
//! identical to V8). Exact operation order is preserved — the chaotic sim demands it.

mod grid;
mod line;
mod kernel;
mod frame;
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
pub(crate) const FRIC: [f64; NENT] = [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.8, 0.8, 0.1, 0.1, 0.0, 0.0];
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

pub(crate) const COLLIDABLES: [usize; 10] = [PEG, TAIL, NOSE, STRING, BUTT, SHOULDER, RHAND, LHAND, LFOOT, RFOOT];
pub(crate) const OUT_ORDER: [usize; 10] = [BUTT, LFOOT, LHAND, NOSE, PEG, RFOOT, RHAND, SHOULDER, STRING, TAIL];

pub(crate) const GRAVITY_X: f64 = 0.0;
pub(crate) const GRAVITY_Y: f64 = 0.175;
pub(crate) const ITERATE: usize = 6;
