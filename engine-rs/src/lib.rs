//! Line Rider body physics, ported bit-faithfully from vendored lr-core (scarf
//! dropped). Two layers:
//!   - the per-frame kernel (`step_state`) — proven bit-identical to the JS
//!     engine on all 5 fixtures (Phase 0b).
//!   - a stateful, handle-based `Engine` with a lazy per-frame cache (Phase 2),
//!     the shape the JS wrapper drives.
//!
//! Only +,-,*,/,sqrt; `std` is used for `f64::sqrt` (→ wasm `f64.sqrt`,
//! IEEE-754 correctly-rounded, identical to V8) and BTreeMap (deterministic,
//! no entropy). Exact operation order is preserved (the chaotic sim demands it).

use std::collections::BTreeMap;

// ── entity indices (state-array order) ──
const RIDER_MOUNTED: usize = 0;
const SLED_INTACT: usize = 1;
const PEG: usize = 2;
const TAIL: usize = 3;
const NOSE: usize = 4;
const STRING: usize = 5;
const BUTT: usize = 6;
const SHOULDER: usize = 7;
const RHAND: usize = 8;
const LHAND: usize = 9;
const LFOOT: usize = 10;
const RFOOT: usize = 11;
const NENT: usize = 12;

const BASE: [(f64, f64); NENT] = [
    (0.0, 0.0), (0.0, 0.0), (0.0, 0.0), (0.0, 5.0), (15.0, 5.0), (17.5, 0.0),
    (5.0, 0.0), (5.0, -5.5), (11.5, -5.0), (11.5, -5.0), (10.0, 5.0), (10.0, 5.0),
];
const FRIC: [f64; NENT] = [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.8, 0.8, 0.1, 0.1, 0.0, 0.0];
const IS_POINT: [bool; NENT] = [
    false, false, true, true, true, true, true, true, true, true, true, true,
];

// iterating constraints: (kind, p1, p2, binding, endurance_param, length_factor)
// kind: 0=Stick, 1=BindStick, 2=RepelStick
const ITER: [(u8, usize, usize, usize, f64, f64); 22] = [
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
const NITER: usize = 22;

// non-iterating BindJoints: (p1, p2, q1, q2, binding)
const JOINTS: [(usize, usize, usize, usize, usize); 3] = [
    (SHOULDER, BUTT, STRING, PEG, RIDER_MOUNTED),
    (PEG, TAIL, STRING, PEG, SLED_INTACT),
    (PEG, TAIL, STRING, PEG, RIDER_MOUNTED),
];

const COLLIDABLES: [usize; 10] = [PEG, TAIL, NOSE, STRING, BUTT, SHOULDER, RHAND, LHAND, LFOOT, RFOOT];
const OUT_ORDER: [usize; 10] = [BUTT, LFOOT, LHAND, NOSE, PEG, RFOOT, RHAND, SHOULDER, STRING, TAIL];

const GRAVITY_X: f64 = 0.0;
const GRAVITY_Y: f64 = 0.175;
const ITERATE: usize = 6;
const GRID_SIZE: f64 = 14.0;
const MAX_FORCE_LENGTH: f64 = 10.0;
const ACC: f64 = 0.1;

const MAX_LINES: usize = 1024;
const MAX_FRAMES: usize = 2400;
const LINE_STRIDE: usize = 6; // x1,y1,x2,y2,type,flags
const OUT_STRIDE: usize = 60; // 10 points * 6

// Exchange buffers. LINES_IN: caller writes line data. OUT: batch sim() output.
// SCRATCH: stateful engine reads/writes (12 entities × 6 f64 = 72, then 12 fsu).
static mut LINES_IN: [f64; MAX_LINES * LINE_STRIDE] = [0.0; MAX_LINES * LINE_STRIDE];
static mut OUT: [f64; (MAX_FRAMES + 1) * OUT_STRIDE] = [0.0; (MAX_FRAMES + 1) * OUT_STRIDE];
const SCRATCH_LEN: usize = NENT * 6 + NENT;
static mut SCRATCH: [f64; SCRATCH_LEN] = [0.0; SCRATCH_LEN];
// per-frame collision records, read by get_updates: pairs of (iteration, line_id).
// per-frame collision records read by get_updates: (iteration, line_id,
// point_idx) f64 triples. Sized far above any realistic per-frame collision
// count (~10 collidables × 6 iterations × a few lines ≈ 100s); get_updates caps
// the write at EVENTS_LEN/3 and returns the written count.
const EVENTS_LEN: usize = 49152; // 16384 collision records × 3
static mut EVENTS: [f64; EVENTS_LEN] = [0.0; EVENTS_LEN];

#[no_mangle]
pub extern "C" fn lines_in_ptr() -> u32 {
    &raw const LINES_IN as u32
}
#[no_mangle]
pub extern "C" fn out_ptr() -> u32 {
    &raw const OUT as u32
}
#[no_mangle]
pub extern "C" fn scratch_ptr() -> u32 {
    &raw const SCRATCH as u32
}
#[no_mangle]
pub extern "C" fn events_ptr() -> u32 {
    &raw const EVENTS as u32
}

// ── precomputed line geometry ──
#[derive(Clone)]
struct Line {
    id: i32,
    p1x: f64,
    p1y: f64,
    vecx: f64,
    vecy: f64,
    normx: f64,
    normy: f64,
    inv_len_sq: f64,
    left_bound: f64,
    right_bound: f64,
    is_acc: bool,
    accx: f64,
    accy: f64,
    collidable: bool,
}

fn hash_int_pair(a: i64, b: i64) -> i64 {
    let aa = if a >= 0 { 2 * a } else { -2 * a - 1 };
    let bb = if b >= 0 { 2 * b } else { -2 * b - 1 };
    let c = if aa >= bb { aa * aa + aa + bb } else { bb * bb + aa };
    if c & 1 != 0 { -(c - 1) / 2 - 1 } else { c / 2 }
}

fn cell_cor(x: f64) -> i64 {
    (x / GRID_SIZE).floor() as i64
}

// classicCells rasterization (getCellsFromLine.js) — faithful float walk.
fn classic_cells(l: &Line) -> Vec<i64> {
    let p1x = l.p1x;
    let p1y = l.p1y;
    let p2x = l.p1x + l.vecx;
    let p2y = l.p1y + l.vecy;
    let cs_x = cell_cor(p1x);
    let cs_y = cell_cor(p1y);
    let mut cur_x = cs_x;
    let mut cur_y = cs_y;
    let mut cur_gx = p1x - GRID_SIZE * cs_x as f64;
    let mut cur_gy = p1y - GRID_SIZE * cs_y as f64;
    let ce_x = cell_cor(p2x);
    let ce_y = cell_cor(p2y);

    let mut cells = vec![hash_int_pair(cs_x, cs_y)];
    if (l.vecx == 0.0 && l.vecy == 0.0) || (cs_x == ce_x && cs_y == ce_y) {
        return cells;
    }
    let box_left = cs_x.min(ce_x);
    let box_right = cs_x.max(ce_x);
    let box_top = cs_y.min(ce_y);
    let box_bottom = cs_y.max(ce_y);

    let mut posx = p1x;
    let mut posy = p1y;
    loop {
        let dx;
        let dy;
        if cur_x < 0 {
            dx = (GRID_SIZE + cur_gx) * (if l.vecx > 0.0 { 1.0 } else { -1.0 });
        } else {
            dx = -cur_gx + (if l.vecx > 0.0 { GRID_SIZE } else { -1.0 });
        }
        if cur_y < 0 {
            dy = (GRID_SIZE + cur_gy) * (if l.vecy > 0.0 { 1.0 } else { -1.0 });
        } else {
            dy = -cur_gy + (if l.vecy > 0.0 { GRID_SIZE } else { -1.0 });
        }
        let (nposx, nposy) = if l.vecx == 0.0 {
            (posx, posy + dy)
        } else if l.vecy == 0.0 {
            (posx + dx, posy)
        } else {
            let slope = l.vecy / l.vecx;
            let y_next = posy + slope * dx;
            if (y_next - posy).abs() < dy.abs() {
                (posx + dx, y_next)
            } else if (y_next - posy).abs() == dy.abs() {
                (posx + dx, posy + dy)
            } else {
                (posx + l.vecx * dy / l.vecy, posy + dy)
            }
        };
        let nc_x = cell_cor(nposx);
        let nc_y = cell_cor(nposy);
        if nc_x >= box_left && nc_x <= box_right && nc_y >= box_top && nc_y <= box_bottom {
            cells.push(hash_int_pair(nc_x, nc_y));
            cur_x = nc_x;
            cur_y = nc_y;
            cur_gx = nposx - GRID_SIZE * nc_x as f64;
            cur_gy = nposy - GRID_SIZE * nc_y as f64;
            posx = nposx;
            posy = nposy;
        } else {
            break;
        }
    }
    cells
}

fn dist(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let dx = bx - ax;
    let dy = by - ay;
    (dx * dx + dy * dy).sqrt()
}

fn build_line(id: i32, x1: f64, y1: f64, x2: f64, y2: f64, ty: i64, flags: i64) -> Line {
    let flipped = (flags & 1) != 0;
    let left_ext = (flags & 2) != 0;
    let right_ext = (flags & 4) != 0;
    let is_acc = ty == 1;
    let vecx = x2 - x1;
    let vecy = y2 - y1;
    let len_sq = vecx * vecx + vecy * vecy;
    let inv_len_sq = 1.0 / len_sq;
    let length = len_sq.sqrt();
    let inv_length = 1.0 / length;
    let flip_sign = if flipped { -1.0 } else { 1.0 };
    let normx = (-vecy) * (inv_length * flip_sign);
    let normy = (vecx) * (inv_length * flip_sign);
    let extension = (MAX_FORCE_LENGTH / length).min(0.25);
    let left_bound = if left_ext { -extension } else { 0.0 };
    let right_bound = if right_ext { 1.0 + extension } else { 1.0 };
    let accx = (-normy) * (ACC * flip_sign);
    let accy = (normx) * (ACC * flip_sign);
    Line {
        id, p1x: x1, p1y: y1, vecx, vecy, normx, normy, inv_len_sq,
        left_bound, right_bound, is_acc, accx, accy,
        collidable: ty == 0 || ty == 1, // SCENERY(2) not collidable
    }
}

// Cells a line rasterizes into, or empty for non-collidable lines.
fn line_cells(l: &Line) -> Vec<i64> {
    if l.collidable { classic_cells(l) } else { Vec::new() }
}

// Append a line and register its (precomputed) cells into the grid. Shared by
// sim() and add_line() so registration lives in one place; add_line reuses the
// same `cells` it already computed for invalidation (no double rasterization).
fn push_line(lines: &mut Vec<Line>, grid: &mut BTreeMap<i64, Vec<u32>>, l: Line, cells: &[i64]) {
    let li = lines.len() as u32;
    for &cell in cells {
        grid.entry(cell).or_default().push(li);
    }
    lines.push(l);
}

fn compute_rest_endur() -> ([f64; NITER], [f64; NITER]) {
    let mut rest = [0.0f64; NITER];
    let mut endur = [0.0f64; NITER];
    for k in 0..NITER {
        let (_kind, p1, p2, _bind, ep, lf) = ITER[k];
        let r = dist(BASE[p1].0, BASE[p1].1, BASE[p2].0, BASE[p2].1) * lf;
        rest[k] = r;
        endur[k] = ep * r * 0.5;
    }
    (rest, endur)
}

#[derive(Clone)]
struct State {
    px: [f64; NENT],
    py: [f64; NENT],
    prevx: [f64; NENT],
    prevy: [f64; NENT],
    vx: [f64; NENT],
    vy: [f64; NENT],
    fsu: [i32; NENT],
}

fn init_state(sx: f64, sy: f64, svx: f64, svy: f64) -> State {
    let mut s = State {
        px: [0.0; NENT], py: [0.0; NENT], prevx: [0.0; NENT], prevy: [0.0; NENT],
        vx: [0.0; NENT], vy: [0.0; NENT], fsu: [-1; NENT],
    };
    for i in 0..NENT {
        if IS_POINT[i] {
            s.px[i] = BASE[i].0 + sx;
            s.py[i] = BASE[i].1 + sy;
            s.prevx[i] = s.px[i] - svx;
            s.prevy[i] = s.py[i] - svy;
            s.vx[i] = svx;
            s.vy[i] = svy;
        }
    }
    s
}

// Per-cell collision history (lr-core's Frame.grid): cell → (frame, pos, vel)
// snapshots recorded at each addToGrid call. Only built when `track` is set
// (the compiler needs it for exact addLine invalidation; pure simulation skips
// it and stays at full speed). Used by getIndexOfCollisionInCell.
type History = BTreeMap<i64, Vec<(u32, f64, f64, f64, f64)>>;

// Record an entity's addToGrid snapshot into its 3×3 cells (getCellsNearEntity).
#[inline]
fn add_to_history(h: &mut History, frame: u32, px: f64, py: f64, vx: f64, vy: f64) {
    let gx = (px / GRID_SIZE).floor() as i64;
    let gy = (py / GRID_SIZE).floor() as i64;
    for ci in -1..=1i64 {
        for cj in -1..=1i64 {
            h.entry(hash_int_pair(ci + gx, cj + gy)).or_default().push((frame, px, py, vx, vy));
        }
    }
}

// The per-frame kernel: step → 6×(constraints, collision) → BindJoints.
// Proven bit-identical to lr-core's _getNextFrame on all 5 fixtures.
// `events` records (iteration, line_id, point_idx) for each collision in
// occurrence order — the CollisionUpdates lr-core emits (line id + which point
// hit, so the wrapper can rebuild `.updated` for the detector's sled-contact
// attribution), for getUpdatesAtFrame parity.
// When `track`, also records the addToGrid collision history into `history` at
// frame `frame_index` (for exact addLine invalidation). Recording is purely
// additive — it does not affect the physics.
fn step_state(
    s: &mut State,
    lines: &[Line],
    grid: &BTreeMap<i64, Vec<u32>>,
    rest: &[f64; NITER],
    endur: &[f64; NITER],
    events: &mut Vec<(u8, i32, i32)>,
    track: bool,
    frame_index: u32,
    history: &mut History,
) {
    // step
    for i in 0..NENT {
        if IS_POINT[i] {
            let nvx = (s.px[i] - s.prevx[i]) * (1.0 - 0.0) + GRAVITY_X;
            let nvy = (s.py[i] - s.prevy[i]) * (1.0 - 0.0) + GRAVITY_Y;
            let nx = s.px[i] + nvx;
            let ny = s.py[i] + nvy;
            s.prevx[i] = s.px[i];
            s.prevy[i] = s.py[i];
            s.px[i] = nx;
            s.py[i] = ny;
            s.vx[i] = nvx;
            s.vy[i] = nvy;
        } else if s.fsu[i] != -1 {
            s.fsu[i] += 1;
        }
    }

    for it in 0..ITERATE {
        for k in 0..NITER {
            let (kind, p1, p2, bind, _ep, _lf) = ITER[k];
            let length = dist(s.px[p1], s.py[p1], s.px[p2], s.py[p2]);
            match kind {
                0 => {
                    let gd = if length == 0.0 { 0.0 } else { (length - rest[k]) / length };
                    let diff = gd * 0.5;
                    let dx = (s.px[p1] - s.px[p2]) * diff;
                    let dy = (s.py[p1] - s.py[p2]) * diff;
                    s.px[p1] -= dx; s.py[p1] -= dy;
                    s.px[p2] += dx; s.py[p2] += dy;
                }
                2 => {
                    if length < rest[k] {
                        let gd = if length == 0.0 { 0.0 } else { (length - rest[k]) / length };
                        let diff = gd * 0.5;
                        let dx = (s.px[p1] - s.px[p2]) * diff;
                        let dy = (s.py[p1] - s.py[p2]) * diff;
                        s.px[p1] -= dx; s.py[p1] -= dy;
                        s.px[p2] += dx; s.py[p2] += dy;
                    }
                }
                _ => {
                    if s.fsu[bind] == -1 {
                        let gd = if length == 0.0 { 0.0 } else { (length - rest[k]) / length };
                        let diff = gd * 0.5;
                        if diff > endur[k] {
                            s.fsu[bind] = 0;
                        } else {
                            let dx = (s.px[p1] - s.px[p2]) * diff;
                            let dy = (s.py[p1] - s.py[p2]) * diff;
                            s.px[p1] -= dx; s.py[p1] -= dy;
                            s.px[p2] += dx; s.py[p2] += dy;
                        }
                    }
                }
            }
        }
        for &i in COLLIDABLES.iter() {
            // addToGrid (A): record the pre-collision snapshot into the 3×3 cells
            if track {
                add_to_history(history, frame_index, s.px[i], s.py[i], s.vx[i], s.vy[i]);
            }
            let gx = (s.px[i] / GRID_SIZE).floor() as i64;
            let gy = (s.py[i] / GRID_SIZE).floor() as i64;
            for ci in -1..=1i64 {
                for cj in -1..=1i64 {
                    let cell = hash_int_pair(ci + gx, cj + gy);
                    if let Some(lns) = grid.get(&cell) {
                        for &lidx in lns.iter() {
                            let l = &lines[lidx as usize];
                            let ox = s.px[i] - l.p1x;
                            let oy = s.py[i] - l.p1y;
                            let perp_comp = l.normx * ox + l.normy * oy;
                            let line_pos = (l.vecx * ox + l.vecy * oy) * l.inv_len_sq;
                            let pnt_dir = l.normx * s.vx[i] + l.normy * s.vy[i];
                            if pnt_dir > 0.0
                                && perp_comp > 0.0
                                && perp_comp < MAX_FORCE_LENGTH
                                && line_pos >= l.left_bound
                                && line_pos <= l.right_bound
                            {
                                let tx = l.normx * perp_comp - s.px[i];
                                let ty = l.normy * perp_comp - s.py[i];
                                let posx = tx * -1.0;
                                let posy = ty * -1.0;
                                let mut fvx = (l.normy * FRIC[i]) * perp_comp;
                                let mut fvy = ((-l.normx) * FRIC[i]) * perp_comp;
                                if s.prevx[i] >= posx { fvx = fvx * -1.0; }
                                if s.prevy[i] < posy { fvy = fvy * -1.0; }
                                fvx = fvx + s.prevx[i];
                                fvy = fvy + s.prevy[i];
                                if l.is_acc {
                                    fvx = fvx + l.accx;
                                    fvy = fvy + l.accy;
                                }
                                s.px[i] = posx;
                                s.py[i] = posy;
                                s.prevx[i] = fvx;
                                s.prevy[i] = fvy;
                                events.push((it as u8, l.id, i as i32));
                                // addToGrid (B): record the post-collision snapshot
                                if track {
                                    add_to_history(history, frame_index, s.px[i], s.py[i], s.vx[i], s.vy[i]);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    for &(p1, p2, q1, q2, bind) in JOINTS.iter() {
        let ax = s.px[p2] - s.px[p1];
        let ay = s.py[p2] - s.py[p1];
        let bx = s.px[q2] - s.px[q1];
        let by = s.py[q2] - s.py[q1];
        let cross = ax * by - ay * bx;
        if cross >= 0.0 {
            // allow
        } else if s.fsu[bind] == -1 {
            s.fsu[bind] = 0;
        }
    }
}

// ── batch sim() — kept as the Phase-0b regression harness (wasm:check) ──
#[no_mangle]
pub extern "C" fn sim(n_lines: u32, sx: f64, sy: f64, svx: f64, svy: f64, frames: u32) -> u32 {
    let n_lines = n_lines as usize;
    let frames = (frames as usize).min(MAX_FRAMES);
    let mut lines: Vec<Line> = Vec::with_capacity(n_lines);
    let mut grid: BTreeMap<i64, Vec<u32>> = BTreeMap::new();
    for li in 0..n_lines {
        let b = li * LINE_STRIDE;
        let l = unsafe {
            build_line(li as i32, LINES_IN[b], LINES_IN[b + 1], LINES_IN[b + 2], LINES_IN[b + 3], LINES_IN[b + 4] as i64, LINES_IN[b + 5] as i64)
        };
        let cells = line_cells(&l);
        push_line(&mut lines, &mut grid, l, &cells);
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
    let mut hist = History::new(); // unused: sim() is pure forward simulation (track=false)
    for f in 1..=frames {
        ev.clear();
        step_state(&mut s, &lines, &grid, &rest, &endur, &mut ev, false, 0, &mut hist);
        write(f, &s);
    }
    frames as u32
}

// ───────────────────────── stateful, handle-based Engine ─────────────────────
//
// Mirrors lr-core's LineEngine read surface: lazy per-frame cache, monotonic
// getLastFrameIndex, getStateMapAtFrame. addLine currently APPENDS + rebuilds
// the grid; exact mid-stream invalidation (truncating the cache to the new
// line's first collision frame, for physics-frame budget parity) is Phase 2b —
// NOT needed for the trace gate, which adds all lines before reading any frame.

struct Engine {
    lines: Vec<Line>,
    grid: BTreeMap<i64, Vec<u32>>,
    rest: [f64; NITER],
    endur: [f64; NITER],
    frames: Vec<State>,               // frames[0] = initial; lazily extended
    events: Vec<Vec<(u8, i32, i32)>>, // per-frame collision records: (iter, line_id, point_idx)
    cur: State,                       // == frames.last(); the working state for stepping
    history: History,                 // collision history for exact addLine invalidation
    track_history: bool,              // build history (compiler) vs skip it (pure sim)
}

impl Engine {
    fn new() -> Engine {
        let (rest, endur) = compute_rest_endur();
        let s = init_state(0.0, 0.0, 0.4, 0.0); // DEFAULT_START
        Engine { lines: Vec::new(), grid: BTreeMap::new(), rest, endur, frames: vec![s.clone()], events: vec![Vec::new()], cur: s, history: History::new(), track_history: true }
    }

    fn compute_to(&mut self, frame: usize) {
        while self.frames.len() <= frame {
            let fi = self.frames.len() as u32;
            let mut ev: Vec<(u8, i32, i32)> = Vec::new();
            step_state(&mut self.cur, &self.lines, &self.grid, &self.rest, &self.endur, &mut ev, self.track_history, fi, &mut self.history);
            self.frames.push(self.cur.clone());
            self.events.push(ev);
        }
    }

    fn last_frame_index(&self) -> i32 {
        (self.frames.len() - 1) as i32
    }
}

// handle registry (slots; free() sets None). wasm is single-threaded per module.
// Engines are IMMUTABLE: set_start/add_line fork a new handle, parent untouched
// (the compiler's beam frontier holds many live engines). A FinalizationRegistry
// in the JS wrapper frees discarded handles.
static mut ENGINES: Vec<Option<Engine>> = Vec::new();

fn engines() -> &'static mut Vec<Option<Engine>> {
    unsafe { &mut *&raw mut ENGINES }
}

fn alloc(e: Engine) -> u32 {
    let v = engines();
    for (i, slot) in v.iter().enumerate() {
        if slot.is_none() {
            v[i] = Some(e);
            return i as u32;
        }
    }
    v.push(Some(e));
    (v.len() - 1) as u32
}

#[no_mangle]
pub extern "C" fn create_engine() -> u32 {
    alloc(Engine::new())
}

#[no_mangle]
pub extern "C" fn free_engine(h: u32) {
    if let Some(slot) = engines().get_mut(h as usize) {
        *slot = None;
    }
}

/// Fork a new engine with the parent's lines + grid, reset to a fresh start.
#[no_mangle]
pub extern "C" fn set_start(h: u32, px: f64, py: f64, vx: f64, vy: f64) -> u32 {
    let (lines, grid, rest, endur) = {
        let p = engines()[h as usize].as_ref().unwrap();
        (p.lines.clone(), p.grid.clone(), p.rest, p.endur)
    };
    let s = init_state(px, py, vx, vy);
    alloc(Engine { lines, grid, rest, endur, frames: vec![s.clone()], events: vec![Vec::new()], cur: s, history: History::new(), track_history: true })
}

// line.collidesWith(snapshot) — the shouldCollide test, for invalidation.
#[inline]
fn collides_with(l: &Line, px: f64, py: f64, vx: f64, vy: f64) -> bool {
    let ox = px - l.p1x;
    let oy = py - l.p1y;
    let perp = l.normx * ox + l.normy * oy;
    let line_pos = (l.vecx * ox + l.vecy * oy) * l.inv_len_sq;
    let dir = l.normx * vx + l.normy * vy;
    dir > 0.0 && perp > 0.0 && perp < MAX_FORCE_LENGTH && line_pos >= l.left_bound && line_pos <= l.right_bound
}

/// Fork a new engine = parent + one line, invalidating the inherited frame cache
/// to the frame the new line first affects, so getLastFrameIndex / physics-frame
/// budget track lr-core. Frames/events/history before that point are reused;
/// everything after is recomputed lazily.
///
/// Invalidation index = the EARLIEST frame any of the new line's cells recorded a
/// colliding snapshot (min over cells). This is the smallest frame the line can
/// affect, so it never under-invalidates (state stays correct). lr-core's
/// `_addLine` sets frames.length per cell in classic_cells order; for the short
/// arc segments the compiler emits (where all of a line's cells are crossed in
/// the same frame) that coincides with this minimum. The two could differ only
/// for a long line whose cells first-collide at different frames — final bit-exact
/// budget parity on such inputs is confirmed by the Tier-3 track-hash gate.
#[no_mangle]
pub extern "C" fn add_line(h: u32, id: i32, ty: i32, x1: f64, y1: f64, x2: f64, y2: f64, flags: i32) -> u32 {
    let l = build_line(id, x1, y1, x2, y2, ty as i64, flags as i64);
    let cells = line_cells(&l); // computed once: used for invalidation AND registration
    let (mut lines, mut grid, rest, endur, frames, events, cur, mut history, track, trunc_len, orig_len) = {
        let p = engines()[h as usize].as_ref().unwrap();
        let orig_len = p.frames.len();
        let mut trunc_len = orig_len;
        if l.collidable && orig_len > 1 {
            if p.track_history {
                for &cell in &cells {
                    if let Some(snaps) = p.history.get(&cell) {
                        for &(frame, px, py, vx, vy) in snaps.iter() {
                            if collides_with(&l, px, py, vx, vy) {
                                trunc_len = trunc_len.min(frame as usize);
                                break; // earliest in this cell (snapshots are frame-ordered)
                            }
                        }
                    }
                }
            } else {
                // No history (pure-sim engine): can't compute the exact index, so
                // fall back to full invalidation — correct (recompute everything
                // with the new line), just no budget reuse. Keeps correctness
                // independent of the track_history perf toggle.
                trunc_len = 1;
            }
        }
        (
            p.lines.clone(),
            p.grid.clone(),
            p.rest,
            p.endur,
            p.frames[..trunc_len].to_vec(),
            p.events[..trunc_len].to_vec(),
            p.frames[trunc_len - 1].clone(),
            p.history.clone(),
            p.track_history,
            trunc_len,
            orig_len,
        )
    };
    // discard history snapshots for the invalidated (recomputed) frames
    if trunc_len < orig_len {
        for v in history.values_mut() {
            v.retain(|&(f, _, _, _, _)| (f as usize) < trunc_len);
        }
    }
    push_line(&mut lines, &mut grid, l, &cells);
    alloc(Engine { lines, grid, rest, endur, frames, events, cur, history, track_history: track })
}

#[no_mangle]
pub extern "C" fn get_last_frame_index(h: u32) -> i32 {
    match engines().get(h as usize) {
        Some(Some(e)) => e.last_frame_index(),
        _ => -1,
    }
}

/// Compute (if needed) and write frame `f` of engine `h` into SCRATCH:
/// 12 entities × [px,py,prevx,prevy,vx,vy] (72 f64), then 12 fsu (i32 as f64).
#[no_mangle]
pub extern "C" fn get_state_map(h: u32, f: i32) {
    if let Some(Some(e)) = engines().get_mut(h as usize) {
        let f = f as usize;
        e.compute_to(f);
        let s = &e.frames[f];
        unsafe {
            for i in 0..NENT {
                let o = i * 6;
                SCRATCH[o] = s.px[i]; SCRATCH[o + 1] = s.py[i];
                SCRATCH[o + 2] = s.prevx[i]; SCRATCH[o + 3] = s.prevy[i];
                SCRATCH[o + 4] = s.vx[i]; SCRATCH[o + 5] = s.vy[i];
            }
            for i in 0..NENT {
                SCRATCH[NENT * 6 + i] = s.fsu[i] as f64;
            }
        }
    }
}

/// Compute (if needed) frame `f` of engine `h` and write its collision records
/// into EVENTS as (iteration, line_id, point_idx) f64 triples; returns the
/// collision count (capped at EVENTS_LEN/3, far above any realistic per-frame
/// count). The JS wrapper synthesizes the full lr-core update sequence from
/// these (StepUpdate, 22 ConstraintUpdates per iteration with CollisionUpdates
/// — carrying line id + collided point — interleaved, 3 BindJoint updates).
#[no_mangle]
pub extern "C" fn get_updates(h: u32, f: i32) -> i32 {
    if let Some(Some(e)) = engines().get_mut(h as usize) {
        let f = f as usize;
        e.compute_to(f);
        let ev = &e.events[f];
        let n = ev.len().min(EVENTS_LEN / 3);
        unsafe {
            for (k, &(it, id, pt)) in ev.iter().take(n).enumerate() {
                EVENTS[k * 3] = it as f64;
                EVENTS[k * 3 + 1] = id as f64;
                EVENTS[k * 3 + 2] = pt as f64;
            }
        }
        return n as i32;
    }
    0
}
