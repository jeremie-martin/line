//! WASM ABI — the export surface the JS wrapper (`_lr_engine_wasm.ts`) drives.
//! Frozen contract: symbol names, signatures, and the SCRATCH/EVENTS buffer
//! layouts must not change. Owns the exchange buffers and the `sim()` batch kernel
//! (the Phase-0b regression harness, wasm:check). The stateful engine state lives
//! in engine.rs (one shared cache per lineage); these are thin marshalling shims.

use std::collections::BTreeMap;
use crate::engine;
use crate::kernel::{compute_rest_endur, init_state, step_state, State};
use crate::line::{build_line, line_cells, push_line, Line};
use crate::{NENT, OUT_ORDER};

const MAX_LINES: usize = 1024;
const MAX_FRAMES: usize = 2400;
const LINE_STRIDE: usize = 6; // x1,y1,x2,y2,type,flags
const OUT_STRIDE: usize = 60; // 10 points * 6

// Exchange buffers. LINES_IN: caller writes line data. OUT: batch sim() output.
// SCRATCH: 12 entities × 6 f64 (= 72), then 12 framesSinceUnbind. EVENTS:
// per-frame collision records as (iteration, line_id, point_idx) f64 triples.
static mut LINES_IN: [f64; MAX_LINES * LINE_STRIDE] = [0.0; MAX_LINES * LINE_STRIDE];
static mut OUT: [f64; (MAX_FRAMES + 1) * OUT_STRIDE] = [0.0; (MAX_FRAMES + 1) * OUT_STRIDE];
const SCRATCH_LEN: usize = NENT * 6 + NENT;
static mut SCRATCH: [f64; SCRATCH_LEN] = [0.0; SCRATCH_LEN];
const EVENTS_LEN: usize = 49152; // 16384 collision records × 3
static mut EVENTS: [f64; EVENTS_LEN] = [0.0; EVENTS_LEN];

#[no_mangle]
pub extern "C" fn lines_in_ptr() -> u32 { &raw const LINES_IN as u32 }
#[no_mangle]
pub extern "C" fn out_ptr() -> u32 { &raw const OUT as u32 }
#[no_mangle]
pub extern "C" fn scratch_ptr() -> u32 { &raw const SCRATCH as u32 }
#[no_mangle]
pub extern "C" fn events_ptr() -> u32 { &raw const EVENTS as u32 }

// ── batch sim() — Phase-0b regression harness (wasm:check). Pure forward sim of a
// fixed track from a start state; no history/collisions recording (track=false). ──
#[no_mangle]
pub extern "C" fn sim(n_lines: u32, sx: f64, sy: f64, svx: f64, svy: f64, frames: u32) -> u32 {
    let n_lines = n_lines as usize;
    let frames = (frames as usize).min(MAX_FRAMES);
    let mut grid: BTreeMap<i64, Vec<Line>> = BTreeMap::new();
    for li in 0..n_lines {
        let b = li * LINE_STRIDE;
        let l = unsafe {
            build_line(li as i32, LINES_IN[b], LINES_IN[b + 1], LINES_IN[b + 2], LINES_IN[b + 3], LINES_IN[b + 4] as i64, LINES_IN[b + 5] as i64)
        };
        let cells = line_cells(&l);
        push_line(&mut grid, l, &cells);
    }
    let (rest, endur) = compute_rest_endur();
    let mut s = init_state(sx, sy, svx, svy);

    let write = |f: usize, s: &State| {
        let base = f * OUT_STRIDE;
        for (k, &i) in OUT_ORDER.iter().enumerate() {
            let o = base + k * 6;
            unsafe {
                OUT[o] = s.px[i]; OUT[o + 1] = s.py[i];
                OUT[o + 2] = s.prevx[i]; OUT[o + 3] = s.prevy[i];
                OUT[o + 4] = s.vx[i]; OUT[o + 5] = s.vy[i];
            }
        }
    };
    write(0, &s);
    let mut ev: Vec<(u8, i32, i32)> = Vec::new();
    let mut hist = BTreeMap::new();
    let mut tc: Vec<i64> = Vec::new();
    let mut coll = BTreeMap::new();
    let mut tl: Vec<i32> = Vec::new();
    for f in 1..=frames {
        ev.clear();
        step_state(&mut s, &grid, &rest, &endur, &mut ev, f as i32, false, &mut hist, &mut tc, &mut coll, &mut tl);
        write(f, &s);
    }
    frames as u32
}

// ── stateful engine ABI (handles = version ids in engine.rs) ──
#[no_mangle]
pub extern "C" fn create_engine() -> u32 {
    engine::create()
}

// A version is an immutable node whose ancestors the cache walk needs, so freeing
// one handle only marks it; the whole lineage (its shared cache + version slots) is
// reclaimed once its LAST live handle is freed (no JS wrapper can reference it then).
#[no_mangle]
pub extern "C" fn free_engine(h: u32) {
    engine::free(h);
}

#[no_mangle]
pub extern "C" fn set_start(h: u32, px: f64, py: f64, vx: f64, vy: f64) -> u32 {
    engine::set_start(h, px, py, vx, vy)
}

#[no_mangle]
pub extern "C" fn add_line(h: u32, id: i32, ty: i32, x1: f64, y1: f64, x2: f64, y2: f64, flags: i32) -> u32 {
    engine::add_line(h, id, ty, x1, y1, x2, y2, flags)
}

#[no_mangle]
pub extern "C" fn get_last_frame_index(h: u32) -> i32 {
    engine::last_frame_index(h)
}

#[no_mangle]
pub extern "C" fn get_state_map(h: u32, f: i32) {
    let out = unsafe { &mut *&raw mut SCRATCH };
    engine::state_into(h, f, out);
}

#[no_mangle]
pub extern "C" fn get_updates(h: u32, f: i32) -> i32 {
    let out = unsafe { &mut *&raw mut EVENTS };
    engine::events_into(h, f, out, EVENTS_LEN / 3) as i32
}
