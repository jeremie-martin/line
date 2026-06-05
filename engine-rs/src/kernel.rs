//! Per-frame solver — bit-faithful port of lr-core's states/index.js (Point.step,
//! Binding) + constraints/index.js (Stick/RepelStick/BindStick/BindJoint) +
//! lines/SolidLine.collide, driven in LineEngine._getNextFrame order:
//!   step → 6×(resolve 22 iterating, collide 10) → resolve 3 non-iterating.
//!
//! The arithmetic here is REUSED VERBATIM from the proven kernel (bit-identical on
//! all 5 fixtures via wasm:check/trace) — only the collision section is restructured
//! to compute the 3×3 cells once (cells_near_entity) and share them between the
//! line lookup and the faithful addToGrid history recording.

use crate::grid::{cells_near_entity, FlatIntMap};
use crate::line::{Line, MAX_FORCE_LENGTH};
use crate::frame::{add_to_collisions, add_to_grid, ActiveCellCache, Collisions, HistGrid, SnapNode};
use crate::{
    BASE, BUTT, COLLIDABLES, FRIC, GRAVITY_X, GRAVITY_Y, IS_POINT, ITER, ITERATE, JOINTS, LFOOT,
    LHAND, NENT, NITER, NOSE, PEG, RHAND, RIDER_MOUNTED, RFOOT, SHOULDER, STRING, TAIL,
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
unsafe fn resolve_stick(s: &mut State, rest: &[f64; NITER], k: usize, p1: usize, p2: usize) {
    let p1x = *s.px.get_unchecked(p1);
    let p1y = *s.py.get_unchecked(p1);
    let p2x = *s.px.get_unchecked(p2);
    let p2y = *s.py.get_unchecked(p2);
    let length = dist(p1x, p1y, p2x, p2y);
    let gd = if length == 0.0 { 0.0 } else { (length - *rest.get_unchecked(k)) / length };
    let diff = gd * 0.5;
    let dx = (p1x - p2x) * diff;
    let dy = (p1y - p2y) * diff;
    *s.px.get_unchecked_mut(p1) = p1x - dx;
    *s.py.get_unchecked_mut(p1) = p1y - dy;
    *s.px.get_unchecked_mut(p2) = p2x + dx;
    *s.py.get_unchecked_mut(p2) = p2y + dy;
}

#[inline(always)]
unsafe fn resolve_repel(s: &mut State, rest: &[f64; NITER], k: usize, p1: usize, p2: usize) {
    let p1x = *s.px.get_unchecked(p1);
    let p1y = *s.py.get_unchecked(p1);
    let p2x = *s.px.get_unchecked(p2);
    let p2y = *s.py.get_unchecked(p2);
    let length = dist(p1x, p1y, p2x, p2y);
    if length < *rest.get_unchecked(k) {
        let gd = if length == 0.0 { 0.0 } else { (length - *rest.get_unchecked(k)) / length };
        let diff = gd * 0.5;
        let dx = (p1x - p2x) * diff;
        let dy = (p1y - p2y) * diff;
        *s.px.get_unchecked_mut(p1) = p1x - dx;
        *s.py.get_unchecked_mut(p1) = p1y - dy;
        *s.px.get_unchecked_mut(p2) = p2x + dx;
        *s.py.get_unchecked_mut(p2) = p2y + dy;
    }
}

#[inline(always)]
unsafe fn resolve_bind(
    s: &mut State,
    rest: &[f64; NITER],
    endur: &[f64; NITER],
    k: usize,
    p1: usize,
    p2: usize,
    bind: usize,
) {
    let p1x = *s.px.get_unchecked(p1);
    let p1y = *s.py.get_unchecked(p1);
    let p2x = *s.px.get_unchecked(p2);
    let p2y = *s.py.get_unchecked(p2);
    let length = dist(p1x, p1y, p2x, p2y);
    if *s.fsu.get_unchecked(bind) == -1 {
        let gd = if length == 0.0 { 0.0 } else { (length - *rest.get_unchecked(k)) / length };
        let diff = gd * 0.5;
        if diff > *endur.get_unchecked(k) {
            *s.fsu.get_unchecked_mut(bind) = 0;
        } else {
            let dx = (p1x - p2x) * diff;
            let dy = (p1y - p2y) * diff;
            *s.px.get_unchecked_mut(p1) = p1x - dx;
            *s.py.get_unchecked_mut(p1) = p1y - dy;
            *s.px.get_unchecked_mut(p2) = p2x + dx;
            *s.py.get_unchecked_mut(p2) = p2y + dy;
        }
    }
}

#[inline(always)]
unsafe fn resolve_iter_constraints(s: &mut State, rest: &[f64; NITER], endur: &[f64; NITER]) {
    resolve_stick(s, rest, 0, PEG, TAIL);
    resolve_stick(s, rest, 1, TAIL, NOSE);
    resolve_stick(s, rest, 2, NOSE, STRING);
    resolve_stick(s, rest, 3, STRING, PEG);
    resolve_stick(s, rest, 4, PEG, NOSE);
    resolve_stick(s, rest, 5, STRING, TAIL);
    resolve_bind(s, rest, endur, 6, PEG, BUTT, RIDER_MOUNTED);
    resolve_bind(s, rest, endur, 7, TAIL, BUTT, RIDER_MOUNTED);
    resolve_bind(s, rest, endur, 8, NOSE, BUTT, RIDER_MOUNTED);
    resolve_stick(s, rest, 9, SHOULDER, BUTT);
    resolve_stick(s, rest, 10, SHOULDER, LHAND);
    resolve_stick(s, rest, 11, SHOULDER, RHAND);
    resolve_stick(s, rest, 12, BUTT, LFOOT);
    resolve_stick(s, rest, 13, BUTT, RFOOT);
    resolve_stick(s, rest, 14, SHOULDER, RHAND);
    resolve_bind(s, rest, endur, 15, SHOULDER, PEG, RIDER_MOUNTED);
    resolve_bind(s, rest, endur, 16, STRING, LHAND, RIDER_MOUNTED);
    resolve_bind(s, rest, endur, 17, STRING, RHAND, RIDER_MOUNTED);
    resolve_bind(s, rest, endur, 18, LFOOT, NOSE, RIDER_MOUNTED);
    resolve_bind(s, rest, endur, 19, RFOOT, NOSE, RIDER_MOUNTED);
    resolve_repel(s, rest, 20, SHOULDER, LFOOT);
    resolve_repel(s, rest, 21, SHOULDER, RFOOT);
}

/// One frame: step → 6×(constraints, collision) → BindJoints. `events` collects
/// (iteration, line_id, point_idx) per collision (for getUpdatesAtFrame). When
/// `track`, the addToGrid collision-history (→ `hist`, new cells → `touched_cells`)
/// and addToCollisions (→ `coll`, new line ids → `touched_lines`) are recorded at
/// `frame_index`; recording is purely additive — it does not affect the physics.
#[allow(clippy::too_many_arguments)]
pub(crate) fn step_state<const TRACK: bool>(
    s: &mut State,
    grid: &FlatIntMap<Vec<Line>>,
    rest: &[f64; NITER],
    endur: &[f64; NITER],
    events: &mut Vec<(u8, i32, i32)>,
    frame_index: i32,
    hist: &mut HistGrid,
    touched_cells: &mut Vec<i64>,
    hist_snaps: &mut Vec<SnapNode>,
    active_cells: &mut ActiveCellCache,
    coll: &mut Collisions,
    touched_lines: &mut Vec<i32>,
) {
    active_cells.begin_frame();
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
        unsafe { resolve_iter_constraints(s, rest, endur); }
        for &i in COLLIDABLES.iter() {
            let (mut pxi, mut pyi, mut prevxi, mut prevyi, vxi, vyi, fric) = unsafe {
                (
                    *s.px.get_unchecked(i),
                    *s.py.get_unchecked(i),
                    *s.prevx.get_unchecked(i),
                    *s.prevy.get_unchecked(i),
                    *s.vx.get_unchecked(i),
                    *s.vy.get_unchecked(i),
                    *FRIC.get_unchecked(i),
                )
            };
            // getCellsNearEntity once (pre-collision pos), shared by addToGrid + lookup.
            let cells = cells_near_entity(pxi, pyi);
            // addToGrid (A): pre-collision snapshot into all 3×3 cells.
            if TRACK {
                add_to_grid(hist, touched_cells, hist_snaps, active_cells, &cells, frame_index, pxi, pyi, vxi, vyi);
            }
            for &cell in cells.iter() {
                if let Some(lns) = grid.get(&cell) {
                    for l in lns.iter() {
                        let ox = pxi - l.p1x;
                        let oy = pyi - l.p1y;
                        let perp_comp = l.normx * ox + l.normy * oy;
                        let line_pos = (l.vecx * ox + l.vecy * oy) * l.inv_len_sq;
                        let pnt_dir = l.normx * vxi + l.normy * vyi;
                        if pnt_dir > 0.0
                            && perp_comp > 0.0
                            && perp_comp < MAX_FORCE_LENGTH
                            && line_pos >= l.left_bound
                            && line_pos <= l.right_bound
                        {
                            let tx = l.normx * perp_comp - pxi;
                            let ty = l.normy * perp_comp - pyi;
                            let posx = tx * -1.0;
                            let posy = ty * -1.0;
                            let mut fvx = (l.normy * fric) * perp_comp;
                            let mut fvy = ((-l.normx) * fric) * perp_comp;
                            if prevxi >= posx { fvx = fvx * -1.0; }
                            if prevyi < posy { fvy = fvy * -1.0; }
                            fvx = fvx + prevxi;
                            fvy = fvy + prevyi;
                            if l.is_acc {
                                fvx = fvx + l.accx;
                                fvy = fvy + l.accy;
                            }
                            unsafe {
                                *s.px.get_unchecked_mut(i) = posx;
                                *s.py.get_unchecked_mut(i) = posy;
                                *s.prevx.get_unchecked_mut(i) = fvx;
                                *s.prevy.get_unchecked_mut(i) = fvy;
                            }
                            pxi = posx;
                            pyi = posy;
                            prevxi = fvx;
                            prevyi = fvy;
                            events.push((it as u8, l.id, i as i32));
                            // addToGrid (B) + addToCollisions: post-collision, cells around the MOVED entity.
                            if TRACK {
                                let pcells = cells_near_entity(pxi, pyi);
                                add_to_grid(hist, touched_cells, hist_snaps, active_cells, &pcells, frame_index, pxi, pyi, vxi, vyi);
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
