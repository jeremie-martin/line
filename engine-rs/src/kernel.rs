//! Per-frame solver — bit-faithful port of lr-core's states/index.js (Point.step,
//! Binding) + constraints/index.js (Stick/RepelStick/BindStick/BindJoint) +
//! lines/SolidLine.collide, driven in LineEngine._getNextFrame order:
//!   step → 6×(resolve 22 iterating, collide 10) → resolve 3 non-iterating.
//!
//! The arithmetic here is REUSED VERBATIM from the proven kernel (bit-identical on
//! all 5 fixtures via wasm:check/trace) — only the collision section is restructured
//! to compute the 3×3 cells once (cells_near_entity) and share them between the
//! line lookup and the faithful addToGrid history recording.

use crate::grid::{cells_near_entity, IntMap};
use crate::line::{Line, MAX_FORCE_LENGTH};
use crate::frame::{add_to_collisions, add_to_grid, Collisions, HistGrid};
use crate::{
    BASE, BUTT, COLLIDABLES, FRIC, GRAVITY_X, GRAVITY_Y, IS_POINT, ITER, ITERATE, JOINTS,
    LFOOT, LHAND, NENT, NITER, NOSE, PEG, RFOOT, RHAND, RIDER_MOUNTED, SHOULDER,
    STRING, TAIL,
};

#[derive(Clone)]
pub(crate) struct State {
    pub px: [f64; NENT],
    pub py: [f64; NENT],
    pub prevx: [f64; NENT],
    pub prevy: [f64; NENT],
    pub vx: [f64; NENT],
    pub vy: [f64; NENT],
    pub fsu: [i32; NENT],
}

#[inline]
fn dist(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let dx = bx - ax;
    let dy = by - ay;
    (dx * dx + dy * dy).sqrt()
}

pub(crate) fn init_state(sx: f64, sy: f64, svx: f64, svy: f64) -> State {
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

/// Rest length + endurance per iterating constraint, from the rider base pose.
pub(crate) fn compute_rest_endur() -> ([f64; NITER], [f64; NITER]) {
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

#[inline(always)]
fn resolve_stick(s: &mut State, p1: usize, p2: usize, rest: f64) {
    let length = dist(s.px[p1], s.py[p1], s.px[p2], s.py[p2]);
    let gd = if length == 0.0 { 0.0 } else { (length - rest) / length };
    let diff = gd * 0.5;
    let dx = (s.px[p1] - s.px[p2]) * diff;
    let dy = (s.py[p1] - s.py[p2]) * diff;
    s.px[p1] -= dx; s.py[p1] -= dy;
    s.px[p2] += dx; s.py[p2] += dy;
}

#[inline(always)]
fn resolve_repel(s: &mut State, p1: usize, p2: usize, rest: f64) {
    let length = dist(s.px[p1], s.py[p1], s.px[p2], s.py[p2]);
    if length < rest {
        let gd = if length == 0.0 { 0.0 } else { (length - rest) / length };
        let diff = gd * 0.5;
        let dx = (s.px[p1] - s.px[p2]) * diff;
        let dy = (s.py[p1] - s.py[p2]) * diff;
        s.px[p1] -= dx; s.py[p1] -= dy;
        s.px[p2] += dx; s.py[p2] += dy;
    }
}

#[inline(always)]
fn resolve_bind(s: &mut State, p1: usize, p2: usize, bind: usize, rest: f64, endur: f64) {
    if s.fsu[bind] == -1 {
        let length = dist(s.px[p1], s.py[p1], s.px[p2], s.py[p2]);
        let gd = if length == 0.0 { 0.0 } else { (length - rest) / length };
        let diff = gd * 0.5;
        if diff > endur {
            s.fsu[bind] = 0;
        } else {
            let dx = (s.px[p1] - s.px[p2]) * diff;
            let dy = (s.py[p1] - s.py[p2]) * diff;
            s.px[p1] -= dx; s.py[p1] -= dy;
            s.px[p2] += dx; s.py[p2] += dy;
        }
    }
}

/// One frame: step → 6×(constraints, collision) → BindJoints. `events` collects
/// (iteration, line_id, point_idx) per collision (for getUpdatesAtFrame). When
/// `track`, the addToGrid collision-history (→ `hist`, new cells → `touched_cells`)
/// and addToCollisions (→ `coll`, new line ids → `touched_lines`) are recorded at
/// `frame_index`; recording is purely additive — it does not affect the physics.
#[allow(clippy::too_many_arguments)]
pub(crate) fn step_state(
    s: &mut State,
    grid: &IntMap<i64, Vec<Line>>,
    rest: &[f64; NITER],
    endur: &[f64; NITER],
    events: &mut Vec<(u8, i32, i32)>,
    frame_index: i32,
    track: bool,
    hist: &mut HistGrid,
    touched_cells: &mut Vec<i64>,
    coll: &mut Collisions,
    touched_lines: &mut Vec<i32>,
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
        resolve_stick(s, PEG, TAIL, rest[0]);
        resolve_stick(s, TAIL, NOSE, rest[1]);
        resolve_stick(s, NOSE, STRING, rest[2]);
        resolve_stick(s, STRING, PEG, rest[3]);
        resolve_stick(s, PEG, NOSE, rest[4]);
        resolve_stick(s, STRING, TAIL, rest[5]);
        resolve_bind(s, PEG, BUTT, RIDER_MOUNTED, rest[6], endur[6]);
        resolve_bind(s, TAIL, BUTT, RIDER_MOUNTED, rest[7], endur[7]);
        resolve_bind(s, NOSE, BUTT, RIDER_MOUNTED, rest[8], endur[8]);
        resolve_stick(s, SHOULDER, BUTT, rest[9]);
        resolve_stick(s, SHOULDER, LHAND, rest[10]);
        resolve_stick(s, SHOULDER, RHAND, rest[11]);
        resolve_stick(s, BUTT, LFOOT, rest[12]);
        resolve_stick(s, BUTT, RFOOT, rest[13]);
        resolve_stick(s, SHOULDER, RHAND, rest[14]);
        resolve_bind(s, SHOULDER, PEG, RIDER_MOUNTED, rest[15], endur[15]);
        resolve_bind(s, STRING, LHAND, RIDER_MOUNTED, rest[16], endur[16]);
        resolve_bind(s, STRING, RHAND, RIDER_MOUNTED, rest[17], endur[17]);
        resolve_bind(s, LFOOT, NOSE, RIDER_MOUNTED, rest[18], endur[18]);
        resolve_bind(s, RFOOT, NOSE, RIDER_MOUNTED, rest[19], endur[19]);
        resolve_repel(s, SHOULDER, LFOOT, rest[20]);
        resolve_repel(s, SHOULDER, RFOOT, rest[21]);
        for &i in COLLIDABLES.iter() {
            // getCellsNearEntity once (pre-collision pos), shared by addToGrid + lookup.
            let cells = cells_near_entity(s.px[i], s.py[i]);
            // addToGrid (A): pre-collision snapshot into all 3×3 cells.
            if track {
                add_to_grid(hist, touched_cells, &cells, frame_index, s.px[i], s.py[i], s.vx[i], s.vy[i]);
            }
            for &cell in cells.iter() {
                if let Some(lns) = grid.get(&cell) {
                    for l in lns.iter() {
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
                            // addToGrid (B) + addToCollisions: post-collision, cells around the MOVED entity.
                            if track {
                                let pcells = cells_near_entity(s.px[i], s.py[i]);
                                add_to_grid(hist, touched_cells, &pcells, frame_index, s.px[i], s.py[i], s.vx[i], s.vy[i]);
                                add_to_collisions(coll, touched_lines, l.id, frame_index);
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
