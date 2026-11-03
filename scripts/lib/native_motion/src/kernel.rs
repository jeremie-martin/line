//! Per-frame solver — bit-faithful port of lr-core's states/index.js (Point.step,
//! Binding) + constraints/index.js (Stick/RepelStick/BindStick/BindJoint) +
//! lines/SolidLine.collide, driven in LineEngine._getNextFrame order:
//!   step → 6×(resolve 22 iterating, collide 10) → resolve 3 non-iterating.
//!
//! The arithmetic here is REUSED VERBATIM from the proven kernel (bit-identical on
//! all 5 fixtures via wasm:check/trace) — only the collision section is restructured
//! to use center-cell history and line lookup indexes equivalent to lr-core's
//! 3×3 neighborhood queries.

// Resolved positions belong to the collision that produced them, before later constraints.
pub(crate) type Collision = (u8, i32, i32, f64, f64);

use crate::frame::{
    add_to_collisions, add_to_grid, ActiveCellCache, Collisions, HistGrid, SnapNode,
};
use crate::grid::{cell_cor_from_scaled, hash_int_pair, FlatIntMap, GRID_SIZE};
use crate::line::{GridLine, Line, MAX_FORCE_LENGTH};
use crate::{
    BASE, BUTT, GRAVITY_X, GRAVITY_Y, IS_POINT, ITER, ITERATE, JOINTS, LFOOT, LHAND, NENT, NITER,
    NOSE, PEG, RFOOT, RHAND, RIDER_MOUNTED, SHOULDER, STRING, TAIL,
};

#[derive(Clone, Copy)]
struct PointCell {
    key: i64,
    min_x: f64,
    max_x: f64,
    min_y: f64,
    max_y: f64,
    valid: bool,
    cell_x: i64,
    cell_y: i64,
    epoch: u32,
}

impl PointCell {
    const EMPTY: PointCell = PointCell {
        key: 0,
        min_x: 0.0,
        max_x: 0.0,
        min_y: 0.0,
        max_y: 0.0,
        valid: false,
        cell_x: 0,
        cell_y: 0,
        epoch: 0,
    };
}

const QUERY_SLOTS: usize = 64;

struct QueryCache {
    keys: [i64; QUERY_SLOTS],
    lines: [Vec<*const Line>; QUERY_SLOTS],
    epochs: [u32; QUERY_SLOTS],
    current_epoch: u32,
}

impl Default for QueryCache {
    fn default() -> Self {
        Self {
            keys: [0; QUERY_SLOTS],
            lines: std::array::from_fn(|_| Vec::new()),
            epochs: [0; QUERY_SLOTS],
            current_epoch: 1,
        }
    }
}

impl QueryCache {
    #[inline]
    fn invalidate(&mut self) {
        self.current_epoch = self.current_epoch.wrapping_add(1);
        if self.current_epoch == 0 {
            self.epochs.fill(0);
            self.current_epoch = 1;
        }
    }

    // Flatten only neighborhoods actually read. Buffers retain capacity across
    // eviction and invalidation; cell order and cross-cell duplicates are kept.
    #[inline]
    fn lookup(&mut self, grid: &FlatIntMap<Vec<GridLine>>, key: i64, cx: i64, cy: i64) -> &[*const Line] {
        let hash = (key as u64).wrapping_mul(0x9E3779B97F4A7C15);
        let slot = ((hash ^ (hash >> 32)) as usize) & (QUERY_SLOTS - 1);
        if self.epochs[slot] != self.current_epoch || self.keys[slot] != key {
            let lines = &mut self.lines[slot];
            lines.clear();
            for dx in -1..=1 {
                for dy in -1..=1 {
                    if let Some(bucket) = grid.get(&hash_int_pair(cx + dx, cy + dy)) {
                        lines.extend(bucket.iter().map(|entry| std::rc::Rc::as_ptr(&entry.line)));
                    }
                }
            }
            self.keys[slot] = key;
            self.epochs[slot] = self.current_epoch;
        }
        &self.lines[slot]
    }
}

pub(crate) struct LineCellCache {
    point_cells: [PointCell; NENT],
    point_lines: [Vec<*const Line>; NENT],
    queries: QueryCache,
}

// Queries borrow immutable lines owned by the grid. Edits invalidate all lists;
// detached engines start empty and never copy borrowed pointers.
impl Clone for LineCellCache {
    fn clone(&self) -> Self {
        Self::default()
    }
}

impl Default for LineCellCache {
    fn default() -> Self {
        Self {
            point_cells: [PointCell::EMPTY; NENT],
            point_lines: std::array::from_fn(|_| Vec::new()),
            queries: QueryCache::default(),
        }
    }
}

impl LineCellCache {
    #[inline]
    pub(crate) fn invalidate(&mut self) {
        self.queries.invalidate();
        if self.queries.current_epoch == 1 {
            for point in &mut self.point_cells {
                point.epoch = 0;
            }
        }
    }

    #[inline]
    fn cache_point_lines<const I: usize>(&mut self, grid: &FlatIntMap<Vec<GridLine>>) {
        let point = &mut self.point_cells[I];
        if point.epoch == self.queries.current_epoch {
            return;
        }
        let query = self.queries.lookup(grid, point.key, point.cell_x, point.cell_y);
        let lines = &mut self.point_lines[I];
        lines.clear();
        lines.extend_from_slice(query);
        point.epoch = self.queries.current_epoch;
    }

    #[inline(always)]
    fn point_cell<const I: usize>(&mut self, px: f64, py: f64) -> i64 {
        Self::update_cell(&mut self.point_cells[I], px, py)
    }

    #[inline(always)]
    fn update_cell(cached: &mut PointCell, px: f64, py: f64) -> i64 {
        let scaled_x = px / GRID_SIZE;
        let scaled_y = py / GRID_SIZE;
        if cached.valid
            && scaled_x >= cached.min_x
            && scaled_x < cached.max_x
            && scaled_y >= cached.min_y
            && scaled_y < cached.max_y
        {
            return cached.key;
        }

        let cell_x = cell_cor_from_scaled(scaled_x);
        let cell_y = cell_cor_from_scaled(scaled_y);
        let min_x = cell_x as f64;
        let max_x = cell_x.checked_add(1).map_or(min_x, |value| value as f64);
        let min_y = cell_y as f64;
        let max_y = cell_y.checked_add(1).map_or(min_y, |value| value as f64);
        *cached = PointCell {
            key: hash_int_pair(cell_x, cell_y),
            min_x,
            max_x,
            min_y,
            max_y,
            valid: scaled_x.is_finite() && scaled_y.is_finite() && min_x < max_x && min_y < max_y,
            cell_x,
            cell_y,
            epoch: 0,
        };
        cached.key
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
    // `length` (a sqrt) is only used on the intact branch (fsu == -1, ~97% of the
    // time). Computing it lazily inside the branch skips the sqrt for the ~3%
    // broken-bind calls where it was discarded — strictly bit-identical (the value,
    // when used, is the same dist(); when unused it has no observable effect).
    if *s.fsu.get_unchecked(bind) == -1 {
        let length = dist(p1x, p1y, p2x, p2y);
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

#[inline(always)]
#[allow(clippy::too_many_arguments)]
unsafe fn collide_point<const I: usize, const ZERO_FRICTION: bool, const TRACK: bool>(
    s: &mut State,
    grid: &FlatIntMap<Vec<GridLine>>,
    events: &mut Vec<Collision>,
    frame_index: i32,
    hist: &mut HistGrid,
    touched_cells: &mut Vec<i64>,
    hist_snaps: &mut Vec<SnapNode>,
    active_cells: &mut ActiveCellCache,
    line_cache: &mut LineCellCache,
    coll: &mut Collisions,
    touched_lines: &mut Vec<i32>,
    it: u8,
    fric: f64,
) {
    let (mut pxi, mut pyi, vxi, vyi) = (
        *s.px.get_unchecked(I),
        *s.py.get_unchecked(I),
        *s.vx.get_unchecked(I),
        *s.vy.get_unchecked(I),
    );
    let center_cell = line_cache.point_cell::<I>(pxi, pyi);
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
    line_cache.cache_point_lines::<I>(grid);
    let lns = &line_cache.point_lines[I];
    if !lns.is_empty() {
        let (mut prevxi, mut prevyi) = (*s.prevx.get_unchecked(I), *s.prevy.get_unchecked(I));
        for &line in lns {
            // Entries point into immutable Rc<Line> records owned by the grid.
            // Only point_cells is updated below; this query stays fixed during
            // the sweep even when a collision moves the entity to another cell.
            let l = &*line;
            let pnt_dir = l.normx * vxi + l.normy * vyi;
            if pnt_dir > 0.0 {
                // Continue with the remaining canonical collision predicates.
            } else {
                continue;
            }
            let ox = pxi - l.p1x;
            let oy = pyi - l.p1y;
            let perp_comp = l.normx * ox + l.normy * oy;
            let line_pos = (l.vecx * ox + l.vecy * oy) * l.inv_len_sq;
            if perp_comp > 0.0
                && perp_comp < MAX_FORCE_LENGTH
                && line_pos >= l.left_bound
                && line_pos <= l.right_bound
            {
                let tx = l.normx * perp_comp - pxi;
                let ty = l.normy * perp_comp - pyi;
                let posx = tx * -1.0;
                let posy = ty * -1.0;
                let (mut fvx, mut fvy) = if ZERO_FRICTION {
                    (prevxi, prevyi)
                } else {
                    let mut fvx = (l.normy * fric) * perp_comp;
                    let mut fvy = ((-l.normx) * fric) * perp_comp;
                    if prevxi >= posx {
                        fvx = fvx * -1.0;
                    }
                    if prevyi < posy {
                        fvy = fvy * -1.0;
                    }
                    (fvx + prevxi, fvy + prevyi)
                };
                if l.is_acc {
                    fvx = fvx + l.accx;
                    fvy = fvy + l.accy;
                }
                *s.px.get_unchecked_mut(I) = posx;
                *s.py.get_unchecked_mut(I) = posy;
                *s.prevx.get_unchecked_mut(I) = fvx;
                *s.prevy.get_unchecked_mut(I) = fvy;
                pxi = posx;
                pyi = posy;
                prevxi = fvx;
                prevyi = fvy;
                events.push((it, l.id, I as i32, posx, posy));
                // addToGrid (B) + addToCollisions: post-collision, centered on the MOVED entity.
                if TRACK {
                    let pcell = LineCellCache::update_cell(&mut line_cache.point_cells[I], pxi, pyi);
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
    events: &mut Vec<Collision>,
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
            trace_collision_state(s, frame_index, it);
            let it = it as u8;
            collide_point::<PEG, false, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.8,
            );
            collide_point::<TAIL, true, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.0,
            );
            collide_point::<NOSE, true, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.0,
            );
            collide_point::<STRING, true, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.0,
            );
            collide_point::<BUTT, false, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.8,
            );
            collide_point::<SHOULDER, false, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.8,
            );
            collide_point::<RHAND, false, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.1,
            );
            collide_point::<LHAND, false, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.1,
            );
            collide_point::<LFOOT, true, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.0,
            );
            collide_point::<RFOOT, true, TRACK>(
                s,
                grid,
                events,
                frame_index,
                hist,
                touched_cells,
                hist_snaps,
                active_cells,
                line_cache,
                coll,
                touched_lines,
                it,
                0.0,
            );
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

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(cache: &mut LineCellCache, grid: &FlatIntMap<Vec<GridLine>>, x: f64, y: f64) -> Vec<i32> {
        cache.point_cell::<PEG>(x, y);
        cache.cache_point_lines::<PEG>(grid);
        cache.point_lines[PEG].iter().map(|&line| unsafe { (*line).id }).collect()
    }

    #[test]
    fn query_cache_invalidates_hits_misses_clones_and_epoch_wrap() {
        use crate::line::{build_line, line_cells, push_line, remove_line};
        let mut grid = FlatIntMap::default();
        let mut cache = LineCellCache::default();
        assert!(ids(&mut cache, &grid, 1.0, 1.0).is_empty());
        let line = build_line(1, 0.0, 5.0, 10.0, 5.0, 0, 0);
        let cells = line_cells(&line);
        cache.invalidate();
        push_line(&mut grid, line, &cells);
        assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), vec![1]);
        let mut cloned = cache.clone();
        let mut other = grid.clone();
        remove_line(&mut other, 1, &cells);
        assert!(ids(&mut cloned, &other, 1.0, 1.0).is_empty());
        cache.invalidate();
        remove_line(&mut grid, 1, &cells);
        for key in 100..1000 { grid.get_or_insert_default(key); }
        assert!(ids(&mut cache, &grid, 1.0, 1.0).is_empty());
        assert!(ids(&mut cache, &grid, 1400.0, -1400.0).is_empty());
        cache.queries.current_epoch = u32::MAX;
        cache.invalidate();
        assert_eq!(cache.queries.current_epoch, 1);
        assert!(cache.queries.epochs.iter().all(|&e| e == 0));
        assert!(cache.point_cells.iter().all(|p| p.epoch == 0));
        assert!(ids(&mut cache, &grid, 1400.0, -1400.0).is_empty());
    }

    #[test]
    fn flat_query_preserves_duplicates_and_survives_point_movement_during_sweep() {
        use crate::line::{build_line, push_line, remove_line};
        let mut grid = FlatIntMap::default();
        let mut cache = LineCellCache::default();
        for (id, cells) in [(1, vec![(-1, -1)]), (2, vec![(-1, 0)]), (3, vec![(-1, -1), (-1, 0)])] {
            push_line(&mut grid, build_line(id, 0.0, 5.0, 10.0, 5.0, 0, 0), &cells);
        }
        assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), vec![3, 1, 3, 2]);
        let query = &cache.point_lines[PEG];
        LineCellCache::update_cell(&mut cache.point_cells[PEG], 14.0, 1.0);
        assert_eq!(query.iter().map(|&l| unsafe { (*l).id }).collect::<Vec<_>>(), vec![3, 1, 3, 2]);
        assert!(ids(&mut cache, &grid, 14.0, 1.0).is_empty());
        cache.invalidate();
        push_line(&mut grid, build_line(4, 0.0, 5.0, 10.0, 5.0, 0, 0), &[(2, 0)]);
        assert_eq!(ids(&mut cache, &grid, 14.0, 1.0), vec![4]);
        cache.invalidate();
        remove_line(&mut grid, 4, &[(2, 0)]);
        assert!(ids(&mut cache, &grid, 14.0, 1.0).is_empty());
    }

    #[test]
    fn shared_query_eviction_does_not_replace_a_points_cached_lines() {
        use crate::line::{build_line, push_line};
        let mut grid = FlatIntMap::default();
        push_line(&mut grid, build_line(1, 0.0, 5.0, 10.0, 5.0, 0, 0), &[(0, 0)]);
        let mut cache = LineCellCache::default();
        assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), vec![1]);
        for cx in 1..1024 {
            cache.queries.lookup(&grid, hash_int_pair(cx, 100), cx, 100);
        }
        assert_ne!(cache.queries.keys[0], 0); // evicted the shared query for (0,0)
        assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), vec![1]);
    }

    #[test]
    fn point_cell_cache_matches_exact_grid_hash() {
        let mut cache = LineCellCache::default();
        let mut positions = Vec::new();
        for cell in -256..=256 {
            let boundary = cell as f64 * GRID_SIZE;
            positions.extend([
                (boundary - 1e-10, boundary + 1e-10),
                (boundary, boundary),
                (boundary + 1e-10, boundary - 1e-10),
                (boundary + GRID_SIZE * 0.5, boundary + GRID_SIZE * 0.75),
            ]);
        }

        let mut state = 0x6a09_e667_f3bc_c909_u64;
        for _ in 0..100_000 {
            state = state
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1_442_695_040_888_963_407);
            let x = ((state >> 11) as f64 / ((1_u64 << 53) as f64)) * 2e6 - 1e6;
            state = state
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1_442_695_040_888_963_407);
            let y = ((state >> 11) as f64 / ((1_u64 << 53) as f64)) * 2e6 - 1e6;
            positions.push((x, y));
        }

        for (x, y) in positions {
            assert_eq!(cache.point_cell::<PEG>(x, y), crate::grid::cell_hash(x, y));
        }
    }
}

// Compiler observation only: copy state immediately before the collision sweep.
static mut TRACE_TARGET: i32 = -1;
static mut TRACE_COUNT: u32 = 0;
static mut COLLISION_TRACE: [f64; 6 * NENT * 6] = [0.0; 6 * NENT * 6];
pub(crate) fn set_trace_target(frame: i32) { unsafe { TRACE_TARGET = frame; TRACE_COUNT = 0; } }
pub(crate) fn collision_trace_ptr() -> u32 { &raw const COLLISION_TRACE as u32 }
pub(crate) fn collision_trace_count() -> u32 { unsafe { TRACE_COUNT } }
unsafe fn trace_collision_state(s: &State, frame: i32, iteration: usize) {
    if frame != TRACE_TARGET { return; }
    for i in 0..NENT {
        let k = (iteration * NENT + i) * 6;
        COLLISION_TRACE[k] = s.px[i]; COLLISION_TRACE[k + 1] = s.py[i];
        COLLISION_TRACE[k + 2] = s.prevx[i]; COLLISION_TRACE[k + 3] = s.prevy[i];
        COLLISION_TRACE[k + 4] = s.vx[i]; COLLISION_TRACE[k + 5] = s.vy[i];
    }
    TRACE_COUNT = (iteration + 1) as u32;
}
