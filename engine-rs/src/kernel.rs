//! Per-frame solver — bit-faithful port of lr-core's states/index.js (Point.step,
//! Binding) + constraints/index.js (Stick/RepelStick/BindStick/BindJoint) +
//! lines/SolidLine.collide, driven in LineEngine._getNextFrame order:
//!   step → 6×(resolve 22 iterating, collide 10) → resolve 3 non-iterating.
//!
//! The arithmetic here is REUSED VERBATIM from the proven kernel (bit-identical on
//! all 5 fixtures via wasm:check/trace) — only the collision section is restructured
//! to use center-cell history and line lookup indexes equivalent to lr-core's
//! 3×3 neighborhood queries.

use crate::frame::{
    add_to_collisions, add_to_grid, ActiveCellCache, Collisions, HistGrid, SnapNode,
};
use crate::grid::{cell_hash, FlatIntMap};
use crate::line::{GridLine, MAX_FORCE_LENGTH};
use crate::{
    BASE, BUTT, COLLIDABLES, FRIC, GRAVITY_X, GRAVITY_Y, IS_POINT, ITER, ITERATE, JOINTS, LFOOT,
    LHAND, NENT, NITER, NOSE, PEG, RFOOT, RHAND, RIDER_MOUNTED, SHOULDER, STRING, TAIL,
};

const LINE_CELL_CACHE_SLOTS: usize = 64;

pub(crate) struct LineCellCache {
    keys: [i64; LINE_CELL_CACHE_SLOTS],
    ptrs: [*const Vec<GridLine>; LINE_CELL_CACHE_SLOTS],
    epochs: [u32; LINE_CELL_CACHE_SLOTS],
    current_epoch: u32,
}

impl Default for LineCellCache {
    fn default() -> LineCellCache {
        LineCellCache {
            keys: [0; LINE_CELL_CACHE_SLOTS],
            ptrs: [std::ptr::null(); LINE_CELL_CACHE_SLOTS],
            epochs: [0; LINE_CELL_CACHE_SLOTS],
            current_epoch: 1,
        }
    }
}

impl LineCellCache {
    #[inline]
    fn begin_frame(&mut self) {
        self.current_epoch = self.current_epoch.wrapping_add(1);
        if self.current_epoch == 0 {
            self.epochs.fill(0);
            self.current_epoch = 1;
        }
    }

    #[inline]
    fn slot(cell: i64) -> usize {
        ((cell as u64).wrapping_mul(0x9E3779B97F4A7C15) as usize) & (LINE_CELL_CACHE_SLOTS - 1)
    }

    #[inline]
    fn lookup<'a>(
        &mut self,
        grid: &'a FlatIntMap<Vec<GridLine>>,
        cell: i64,
    ) -> Option<&'a Vec<GridLine>> {
        let slot = Self::slot(cell);
        if self.epochs[slot] == self.current_epoch && self.keys[slot] == cell {
            let ptr = self.ptrs[slot];
            return if ptr.is_null() {
                None
            } else {
                Some(unsafe { &*ptr })
            };
        }
        let found = grid.get(&cell);
        self.keys[slot] = cell;
        self.ptrs[slot] = found
            .map(|bucket| bucket as *const Vec<GridLine>)
            .unwrap_or(std::ptr::null());
        self.epochs[slot] = self.current_epoch;
        found
    }
}

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
        px: [0.0; NENT],
        py: [0.0; NENT],
        prevx: [0.0; NENT],
        prevy: [0.0; NENT],
        vx: [0.0; NENT],
        vy: [0.0; NENT],
        fsu: [-1; NENT],
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
    let gd = if length == 0.0 {
        0.0
    } else {
        (length - *rest.get_unchecked(k)) / length
    };
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
    // Repels fire only when length < rest, which is rare (~2% — feet rarely closer
    // to the shoulder than rest). Gate the sqrt on len_sq < rest² so the common
    // inactive case skips the sqrt entirely. Inside the gate, `length` and the
    // applied math are byte-identical to the original (same len_sq, same sqrt, same
    // `length < rest` branch). The ONLY semantic difference is the gate vs the
    // original `length < rest` comparison, which can disagree in a ULP-wide band
    // where round(rest²) rounds below rest² — `verify`/`--diff` is the arbiter of
    // whether that band ever occurs for these inputs.
    let dx0 = p2x - p1x;
    let dy0 = p2y - p1y;
    let len_sq = dx0 * dx0 + dy0 * dy0;
    let r = *rest.get_unchecked(k);
    if len_sq < r * r {
        let length = len_sq.sqrt();
        if length < r {
            let gd = if length == 0.0 {
                0.0
            } else {
                (length - r) / length
            };
            let diff = gd * 0.5;
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
        let gd = if length == 0.0 {
            0.0
        } else {
            (length - *rest.get_unchecked(k)) / length
        };
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
    grid: &FlatIntMap<Vec<GridLine>>,
    rest: &[f64; NITER],
    endur: &[f64; NITER],
    events: &mut Vec<(u8, i32, i32)>,
    frame_index: i32,
    hist: &mut HistGrid,
    touched_cells: &mut Vec<i64>,
    hist_snaps: &mut Vec<SnapNode>,
    active_cells: &mut ActiveCellCache,
    line_cache: &mut LineCellCache,
    coll: &mut Collisions,
    touched_lines: &mut Vec<i32>,
) {
    active_cells.begin_frame();
    line_cache.begin_frame();
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
        unsafe {
            resolve_iter_constraints(s, rest, endur);
        }
        for &i in COLLIDABLES.iter() {
            let (mut pxi, mut pyi, vxi, vyi) = unsafe {
                (
                    *s.px.get_unchecked(i),
                    *s.py.get_unchecked(i),
                    *s.vx.get_unchecked(i),
                    *s.vy.get_unchecked(i),
                )
            };
            let center_cell = cell_hash(pxi, pyi);
            // addToGrid (A): pre-collision snapshot.
            if TRACK {
                add_to_grid(
                    hist,
                    touched_cells,
                    hist_snaps,
                    active_cells,
                    center_cell,
                    frame_index,
                    pxi,
                    pyi,
                    vxi,
                    vyi,
                );
            }
            if let Some(lns) = line_cache.lookup(grid, center_cell) {
                let (mut prevxi, mut prevyi, fric) = unsafe {
                    (
                        *s.prevx.get_unchecked(i),
                        *s.prevy.get_unchecked(i),
                        *FRIC.get_unchecked(i),
                    )
                };
                for entry in lns.iter() {
                    let l = &entry.line;
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
                        if prevxi >= posx {
                            fvx = fvx * -1.0;
                        }
                        if prevyi < posy {
                            fvy = fvy * -1.0;
                        }
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
                        // addToGrid (B) + addToCollisions: post-collision, centered on the MOVED entity.
                        if TRACK {
                            let pcell = cell_hash(pxi, pyi);
                            add_to_grid(
                                hist,
                                touched_cells,
                                hist_snaps,
                                active_cells,
                                pcell,
                                frame_index,
                                pxi,
                                pyi,
                                vxi,
                                vyi,
                            );
                            add_to_collisions(coll, touched_lines, l.id, frame_index);
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
