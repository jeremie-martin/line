//! Phase-0b: full per-frame Line Rider body physics, ported bit-faithfully from
//! vendored lr-core (scarf dropped). Standalone `sim()` simulates a fixed line
//! set and writes the 10 collision points' per-frame state for diffing against
//! the JS engine's recorded dump. Only +,-,*,/,sqrt — wasm f64 ops are IEEE-754
//! correctly-rounded, matching V8, so this is bit-identical when op order is
//! reproduced exactly (lr-core warns "multiplication is not associative").
//!
//! `std` is used only for `f64::sqrt` (→ wasm `f64.sqrt` opcode) and BTreeMap
//! (deterministic, no entropy — unlike HashMap's RandomState). No per-frame
//! allocation in steady state matters later; Phase-0b prioritizes correctness.

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

// base skeleton positions (no start offset); bindings are placeholders
const BASE: [(f64, f64); NENT] = [
    (0.0, 0.0),   // RIDER_MOUNTED
    (0.0, 0.0),   // SLED_INTACT
    (0.0, 0.0),   // PEG
    (0.0, 5.0),   // TAIL
    (15.0, 5.0),  // NOSE
    (17.5, 0.0),  // STRING
    (5.0, 0.0),   // BUTT
    (5.0, -5.5),  // SHOULDER
    (11.5, -5.0), // RHAND
    (11.5, -5.0), // LHAND
    (10.0, 5.0),  // LFOOT
    (10.0, 5.0),  // RFOOT
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

// collidable points, in state-array order
const COLLIDABLES: [usize; 10] = [PEG, TAIL, NOSE, STRING, BUTT, SHOULDER, RHAND, LHAND, LFOOT, RFOOT];
// output order = dump order = alphabetical by id
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

static mut LINES_IN: [f64; MAX_LINES * LINE_STRIDE] = [0.0; MAX_LINES * LINE_STRIDE];
static mut OUT: [f64; (MAX_FRAMES + 1) * OUT_STRIDE] = [0.0; (MAX_FRAMES + 1) * OUT_STRIDE];

#[no_mangle]
pub extern "C" fn lines_in_ptr() -> u32 {
    &raw const LINES_IN as u32
}
#[no_mangle]
pub extern "C" fn out_ptr() -> u32 {
    &raw const OUT as u32
}

// ── precomputed line geometry ──
struct Line {
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
    // getCellPosAndOffset
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
    // box of cell coords
    let box_left = cs_x.min(ce_x);
    let box_right = cs_x.max(ce_x);
    let box_top = cs_y.min(ce_y);
    let box_bottom = cs_y.max(ce_y);

    let mut posx = p1x;
    let mut posy = p1y;
    loop {
        // getDelta
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
        // getNextPos
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
        // getCellPosAndOffset(nextPos)
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

#[no_mangle]
pub extern "C" fn sim(n_lines: u32, sx: f64, sy: f64, svx: f64, svy: f64, frames: u32) -> u32 {
    let n_lines = n_lines as usize;
    let frames = (frames as usize).min(MAX_FRAMES);

    // ── build lines + grid ──
    let mut lines: Vec<Line> = Vec::with_capacity(n_lines);
    let mut grid: BTreeMap<i64, Vec<u32>> = BTreeMap::new();
    for li in 0..n_lines {
        let base = li * LINE_STRIDE;
        let (x1, y1, x2, y2, ty, flags) = unsafe {
            (
                LINES_IN[base],
                LINES_IN[base + 1],
                LINES_IN[base + 2],
                LINES_IN[base + 3],
                LINES_IN[base + 4] as i64,
                LINES_IN[base + 5] as i64,
            )
        };
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
        // norm = vec.rotCW() * (invLength * flipSign); rotCW: (-y, x)
        let normx = (-vecy) * (inv_length * flip_sign);
        let normy = (vecx) * (inv_length * flip_sign);
        let extension = (MAX_FORCE_LENGTH / length).min(0.25);
        let left_bound = if left_ext { -extension } else { 0.0 };
        let right_bound = if right_ext { 1.0 + extension } else { 1.0 };
        // acc = norm.rotCW() * (ACC * flipSign); rotCW(norm): (-normy, normx)
        let accx = (-normy) * (ACC * flip_sign);
        let accy = (normx) * (ACC * flip_sign);
        let line = Line {
            p1x: x1, p1y: y1, vecx, vecy, normx, normy, inv_len_sq,
            left_bound, right_bound, is_acc, accx, accy,
        };
        // register into grid (only collidable: SOLID(0)/ACC(1); SCENERY(2) not)
        if ty == 0 || ty == 1 {
            for cell in classic_cells(&line) {
                grid.entry(cell).or_default().push(li as u32);
            }
        }
        lines.push(line);
    }

    // ── rest lengths + endurance ──
    let mut rest = [0.0f64; NITER];
    let mut endur = [0.0f64; NITER];
    for k in 0..NITER {
        let (_kind, p1, p2, _bind, ep, lf) = ITER[k];
        let r = dist(BASE[p1].0, BASE[p1].1, BASE[p2].0, BASE[p2].1) * lf;
        rest[k] = r;
        endur[k] = ep * r * 0.5;
    }

    // ── initial state ──
    let mut px = [0.0f64; NENT];
    let mut py = [0.0f64; NENT];
    let mut prevx = [0.0f64; NENT];
    let mut prevy = [0.0f64; NENT];
    let mut vx = [0.0f64; NENT];
    let mut vy = [0.0f64; NENT];
    let mut fsu = [-1i32; NENT]; // framesSinceUnbind; -1 = binded
    for i in 0..NENT {
        if IS_POINT[i] {
            px[i] = BASE[i].0 + sx;
            py[i] = BASE[i].1 + sy;
            prevx[i] = px[i] - svx;
            prevy[i] = py[i] - svy;
            vx[i] = svx;
            vy[i] = svy;
        }
    }

    let write_frame = |f: usize, px: &[f64; NENT], py: &[f64; NENT], prevx: &[f64; NENT], prevy: &[f64; NENT], vx: &[f64; NENT], vy: &[f64; NENT]| {
        let base = f * OUT_STRIDE;
        for (k, &i) in OUT_ORDER.iter().enumerate() {
            let o = base + k * 6;
            unsafe {
                OUT[o] = px[i];
                OUT[o + 1] = py[i];
                OUT[o + 2] = prevx[i];
                OUT[o + 3] = prevy[i];
                OUT[o + 4] = vx[i];
                OUT[o + 5] = vy[i];
            }
        }
    };

    write_frame(0, &px, &py, &prevx, &prevy, &vx, &vy);

    for f in 1..=frames {
        // ── step ──
        for i in 0..NENT {
            if IS_POINT[i] {
                let nvx = (px[i] - prevx[i]) * (1.0 - 0.0) + GRAVITY_X;
                let nvy = (py[i] - prevy[i]) * (1.0 - 0.0) + GRAVITY_Y;
                let nx = px[i] + nvx;
                let ny = py[i] + nvy;
                prevx[i] = px[i];
                prevy[i] = py[i];
                px[i] = nx;
                py[i] = ny;
                vx[i] = nvx;
                vy[i] = nvy;
            } else {
                // Binding.step: if unbinded, framesSinceUnbind += 1
                if fsu[i] != -1 {
                    fsu[i] += 1;
                }
            }
        }

        // ── 6 iterations of (constraints, collision) ──
        for _ in 0..ITERATE {
            for k in 0..NITER {
                let (kind, p1, p2, bind, _ep, _lf) = ITER[k];
                let length = dist(px[p1], py[p1], px[p2], py[p2]);
                match kind {
                    0 => {
                        // Stick
                        let gd = if length == 0.0 { 0.0 } else { (length - rest[k]) / length };
                        let diff = gd * 0.5;
                        let dx = (px[p1] - px[p2]) * diff;
                        let dy = (py[p1] - py[p2]) * diff;
                        px[p1] -= dx; py[p1] -= dy;
                        px[p2] += dx; py[p2] += dy;
                    }
                    2 => {
                        // RepelStick
                        if length < rest[k] {
                            let gd = if length == 0.0 { 0.0 } else { (length - rest[k]) / length };
                            let diff = gd * 0.5;
                            let dx = (px[p1] - px[p2]) * diff;
                            let dy = (py[p1] - py[p2]) * diff;
                            px[p1] -= dx; py[p1] -= dy;
                            px[p2] += dx; py[p2] += dy;
                        }
                    }
                    _ => {
                        // BindStick
                        if fsu[bind] == -1 {
                            let gd = if length == 0.0 { 0.0 } else { (length - rest[k]) / length };
                            let diff = gd * 0.5;
                            if diff > endur[k] {
                                fsu[bind] = 0; // setBind(false)
                            } else {
                                let dx = (px[p1] - px[p2]) * diff;
                                let dy = (py[p1] - py[p2]) * diff;
                                px[p1] -= dx; py[p1] -= dy;
                                px[p2] += dx; py[p2] += dy;
                            }
                        }
                    }
                }
            }
            // ── collision ──
            for &i in COLLIDABLES.iter() {
                let gx = (px[i] / GRID_SIZE).floor() as i64;
                let gy = (py[i] / GRID_SIZE).floor() as i64;
                for ci in -1..=1i64 {
                    for cj in -1..=1i64 {
                        let cell = hash_int_pair(ci + gx, cj + gy);
                        if let Some(lns) = grid.get(&cell) {
                            for &lidx in lns.iter() {
                                let l = &lines[lidx as usize];
                                let ox = px[i] - l.p1x;
                                let oy = py[i] - l.p1y;
                                let perp_comp = l.normx * ox + l.normy * oy;
                                let line_pos = (l.vecx * ox + l.vecy * oy) * l.inv_len_sq;
                                let pnt_dir = l.normx * vx[i] + l.normy * vy[i];
                                if pnt_dir > 0.0
                                    && perp_comp > 0.0
                                    && perp_comp < MAX_FORCE_LENGTH
                                    && line_pos >= l.left_bound
                                    && line_pos <= l.right_bound
                                {
                                    let tx = l.normx * perp_comp - px[i];
                                    let ty = l.normy * perp_comp - py[i];
                                    let posx = tx * -1.0;
                                    let posy = ty * -1.0;
                                    let mut fvx = (l.normy * FRIC[i]) * perp_comp;
                                    let mut fvy = ((-l.normx) * FRIC[i]) * perp_comp;
                                    if prevx[i] >= posx { fvx = fvx * -1.0; }
                                    if prevy[i] < posy { fvy = fvy * -1.0; }
                                    fvx = fvx + prevx[i];
                                    fvy = fvy + prevy[i];
                                    if l.is_acc {
                                        fvx = fvx + l.accx;
                                        fvy = fvy + l.accy;
                                    }
                                    px[i] = posx;
                                    py[i] = posy;
                                    prevx[i] = fvx;
                                    prevy[i] = fvy;
                                    // vel unchanged
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── non-iterating BindJoints ──
        for &(p1, p2, q1, q2, bind) in JOINTS.iter() {
            let ax = px[p2] - px[p1];
            let ay = py[p2] - py[p1];
            let bx = px[q2] - px[q1];
            let by = py[q2] - py[q1];
            let cross = ax * by - ay * bx;
            if cross >= 0.0 {
                // allow
            } else if fsu[bind] == -1 {
                fsu[bind] = 0;
            }
        }

        write_frame(f, &px, &py, &prevx, &prevy, &vx, &vy);
    }

    frames as u32
}
