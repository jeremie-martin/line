//! Per-frame solver — bit-faithful port of lr-core's states/index.js (Point.step,
//! Binding) + constraints/index.js (Stick/RepelStick/BindStick/BindJoint) +
//! lines/SolidLine.collide, driven in LineEngine._getNextFrame order:
//!   step → 6×(resolve 22 iterating, collide 10) → resolve 3 non-iterating.
//!
//! The arithmetic here is REUSED VERBATIM from the proven kernel (bit-identical on
//! the committed tracks via verify:engine) — only the collision section is restructured
//! to use center-cell history and line lookup indexes equivalent to lr-core's
//! 3×3 neighborhood queries.

// Resolved positions belong to the collision that produced them, before later constraints.
pub(crate) type Collision = (u8, i32, i32, f64, f64);

use crate::history::CollisionHistory;
use crate::grid::{cell_cor_from_scaled, hash_int_pair, FlatIntMap, GRID_SIZE};
use crate::line::{Line, LineRef, MAX_FORCE_LENGTH};
use crate::{
    COLLIDING_POINTS, BASE, BUTT, GRAVITY_X, GRAVITY_Y, IS_POINT, ITERATE, JOINTS, LFOOT, LHAND, NENT,
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
    fn lookup(&mut self, grid: &FlatIntMap<Vec<LineRef>>, key: i64, cx: i64, cy: i64) -> &[*const Line] {
        let hash = (key as u64).wrapping_mul(0x9E3779B97F4A7C15);
        let slot = ((hash ^ (hash >> 32)) as usize) & (QUERY_SLOTS - 1);
        if self.epochs[slot] != self.current_epoch || self.keys[slot] != key {
            let lines = &mut self.lines[slot];
            lines.clear();
            for dx in -1..=1 {
                for dy in -1..=1 {
                    if let Some(bucket) = grid.get(&hash_int_pair(cx + dx, cy + dy)) {
                        lines.extend(bucket.iter().map(|entry| &**entry as *const Line));
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
    // Conservative occupied-cell bounds. Removals may leave them wider; clones
    // preserve geometry bounds while discarding borrowed neighborhood pointers.
    bounds: [f64; 4],
    // Point slots start at PEG; the first two entities only store binding status.
    point_cells: [PointCell; NENT - PEG],
    point_lines: [Vec<*const Line>; NENT - PEG], // ordered lines passing this frame's direction predicate
    queries: QueryCache,
}

// Queries borrow immutable lines owned by the grid. Edits invalidate all lists;
// cache clones start empty and never copy borrowed pointers.
impl Clone for LineCellCache {
    fn clone(&self) -> Self {
        Self { bounds: self.bounds, ..Self::default() }
    }
}

impl Default for LineCellCache {
    fn default() -> Self {
        Self {
            bounds: [f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY],
            point_cells: [PointCell::EMPTY; NENT - PEG],
            point_lines: std::array::from_fn(|_| Vec::new()),
            queries: QueryCache::default(),
        }
    }
}

impl LineCellCache {
    // Encoded coordinates, including neighboring cells, are at most 2^31 + 2.
    // Their pairing fits i64, so distinct cells cannot alias through overflow.
    const BOUNDED_CELL: i64 = 1 << 30;

    pub(crate) fn include_cells(&mut self, cells: &[(i64, i64)]) {
        for &(x, y) in cells {
            if !(-Self::BOUNDED_CELL..=Self::BOUNDED_CELL).contains(&x)
                || !(-Self::BOUNDED_CELL..=Self::BOUNDED_CELL).contains(&y) {
                // An unbounded envelope cannot exclude a point. Further unions
                // and copies preserve that conservative fallback automatically.
                self.bounds = [f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY];
                return;
            }
            self.bounds[0] = self.bounds[0].min((x as f64 - 2.0) * GRID_SIZE);
            self.bounds[1] = self.bounds[1].max((x as f64 + 2.0) * GRID_SIZE);
            self.bounds[2] = self.bounds[2].min((y as f64 - 2.0) * GRID_SIZE);
            self.bounds[3] = self.bounds[3].max((y as f64 + 2.0) * GRID_SIZE);
        }
    }

    /// Beyond a common face, every 3x3 point neighborhood is empty. The integer
    /// boundaries and their products by 14 are exact. Monotone rounded division
    /// keeps points beyond them at least two cells from any registered cell.
    fn outside_grid(&self, s: &State) -> bool {
        let mut faces = 15;
        for &(i, _) in &COLLIDING_POINTS {
            let (x, y) = (s.px[i], s.py[i]);
            faces &= (x < self.bounds[0]) as u8 | ((x > self.bounds[1]) as u8) << 1
                | ((y < self.bounds[2]) as u8) << 2 | ((y > self.bounds[3]) as u8) << 3;
            if faces == 0 || !(x.abs() < Self::BOUNDED_CELL as f64 * GRID_SIZE
                && y.abs() < Self::BOUNDED_CELL as f64 * GRID_SIZE) { return false; }
        }
        true
    }

    // Velocity is constant through all six sweeps, but changes at each step.
    // Refresh filtered point lists even when a replay reuses a frame index.
    // The shared neighborhood queries remain valid until a grid edit.
    #[inline]
    fn begin_frame(&mut self) {
        for point in &mut self.point_cells {
            point.epoch = 0;
        }
    }

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
    fn cache_point_lines(&mut self, grid: &FlatIntMap<Vec<LineRef>>, index: usize, vx: f64, vy: f64) {
        let point = &mut self.point_cells[index - PEG];
        if point.epoch == self.queries.current_epoch {
            return;
        }
        self.refresh_point_lines(grid, index, vx, vy);
    }

    // Keep the uncommon list rebuild out of each monomorphized point solver.
    #[inline(never)]
    fn refresh_point_lines(&mut self, grid: &FlatIntMap<Vec<LineRef>>, index: usize, vx: f64, vy: f64) {
        let point = &mut self.point_cells[index - PEG];
        let query = self.queries.lookup(grid, point.key, point.cell_x, point.cell_y);
        let lines = &mut self.point_lines[index - PEG];
        lines.clear();
        // Reserve once for the largest possible result before filtering. Growing
        // one pointer at a time fragments the WASM heap during long replays.
        lines.reserve(query.len());
        // Compact into the reserved buffer without Vec::push's capacity check
        // or a direction-dependent branch for each candidate. Rejected entries
        // overwrite the next unused slot; the accepted prefix stays ordered.
        let output = lines.as_mut_ptr();
        let mut count = 0;
        for &ptr in query {
            let line = unsafe { &*ptr };
            let passes = line.normx * vx + line.normy * vy > 0.0;
            // SAFETY: before input i, count <= i < query.len() <= capacity.
            // Pointers are Copy and have no destructor. The Vec stays length 0
            // until its fully initialized accepted prefix is published below.
            unsafe { output.add(count).write(ptr); }
            count += passes as usize;
        }
        // SAFETY: count <= query.len(), and every slot below count was written.
        unsafe { lines.set_len(count); }
        point.epoch = self.queries.current_epoch;
    }

    #[inline(always)]
    fn point_cell(&mut self, index: usize, px: f64, py: f64) -> i64 {
        Self::update_cell(&mut self.point_cells[index - PEG], px, py)
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

/// Rest lengths belong to the fixed rider topology, not to a frame cache.
/// Every solver call supplies fixed endpoints, so release compilation folds
/// this expression while preserving its original rounded arithmetic.
#[inline(always)]
fn rest_length(p1: usize, p2: usize, factor: f64) -> f64 {
    dist(BASE[p1].0, BASE[p1].1, BASE[p2].0, BASE[p2].1) * factor
}

#[inline(always)]
fn resolve_stick(s: &mut State, p1: usize, p2: usize) {
    let p1x = s.px[p1];
    let p1y = s.py[p1];
    let p2x = s.px[p2];
    let p2y = s.py[p2];
    let length = dist(p1x, p1y, p2x, p2y);
    let gd = if length == 0.0 {
        0.0
    } else {
        (length - rest_length(p1, p2, 1.0)) / length
    };
    let diff = gd * 0.5;
    let dx = (p1x - p2x) * diff;
    let dy = (p1y - p2y) * diff;
    s.px[p1] = p1x - dx;
    s.py[p1] = p1y - dy;
    s.px[p2] = p2x + dx;
    s.py[p2] = p2y + dy;
}

#[inline(always)]
fn resolve_repel(s: &mut State, p1: usize, p2: usize) {
    let p1x = s.px[p1];
    let p1y = s.py[p1];
    let p2x = s.px[p2];
    let p2y = s.py[p2];
    // For both fixed repel rests, sqrt(round(rest * rest)) == rest (tested
    // below). Monotonic sqrt therefore guarantees that length < rest implies
    // len_sq < round(rest * rest). The gate skips only inactive repels; the
    // original length check and response arithmetic remain inside it.
    let dx0 = p2x - p1x;
    let dy0 = p2y - p1y;
    let len_sq = dx0 * dx0 + dy0 * dy0;
    let r = rest_length(p1, p2, 0.5);
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
            s.px[p1] = p1x - dx;
            s.py[p1] = p1y - dy;
            s.px[p2] = p2x + dx;
            s.py[p2] = p2y + dy;
        }
    }
}

#[inline(always)]
fn resolve_bind(
    s: &mut State,
    p1: usize,
    p2: usize,
    bind: usize,
    endurance: f64,
) {
    let p1x = s.px[p1];
    let p1y = s.py[p1];
    let p2x = s.px[p2];
    let p2y = s.py[p2];
    // `length` (a sqrt) is only used on the intact branch (fsu == -1, ~97% of the
    // time). Computing it lazily inside the branch skips the sqrt for the ~3%
    // broken-bind calls where it was discarded — strictly bit-identical (the value,
    // when used, is the same dist(); when unused it has no observable effect).
    if s.fsu[bind] == -1 {
        let length = dist(p1x, p1y, p2x, p2y);
        let gd = if length == 0.0 {
            0.0
        } else {
            (length - rest_length(p1, p2, 1.0)) / length
        };
        let diff = gd * 0.5;
        if diff > endurance * rest_length(p1, p2, 1.0) * 0.5 {
            s.fsu[bind] = 0;
        } else {
            let dx = (p1x - p2x) * diff;
            let dy = (p1y - p2y) * diff;
            s.px[p1] = p1x - dx;
            s.py[p1] = p1y - dy;
            s.px[p2] = p2x + dx;
            s.py[p2] = p2y + dy;
        }
    }
}

#[inline(always)]
fn resolve_iter_constraints(s: &mut State) {
    resolve_stick(s, PEG, TAIL);
    resolve_stick(s, TAIL, NOSE);
    resolve_stick(s, NOSE, STRING);
    resolve_stick(s, STRING, PEG);
    resolve_stick(s, PEG, NOSE);
    resolve_stick(s, STRING, TAIL);
    resolve_bind(s, PEG, BUTT, RIDER_MOUNTED, 0.057);
    resolve_bind(s, TAIL, BUTT, RIDER_MOUNTED, 0.057);
    resolve_bind(s, NOSE, BUTT, RIDER_MOUNTED, 0.057);
    resolve_stick(s, SHOULDER, BUTT);
    resolve_stick(s, SHOULDER, LHAND);
    resolve_stick(s, SHOULDER, RHAND);
    resolve_stick(s, BUTT, LFOOT);
    resolve_stick(s, BUTT, RFOOT);
    resolve_stick(s, SHOULDER, RHAND);
    resolve_bind(s, SHOULDER, PEG, RIDER_MOUNTED, 0.057);
    resolve_bind(s, STRING, LHAND, RIDER_MOUNTED, 0.057);
    resolve_bind(s, STRING, RHAND, RIDER_MOUNTED, 0.057);
    resolve_bind(s, LFOOT, NOSE, RIDER_MOUNTED, 0.057);
    resolve_bind(s, RFOOT, NOSE, RIDER_MOUNTED, 0.057);
    resolve_repel(s, SHOULDER, LFOOT);
    resolve_repel(s, SHOULDER, RFOOT);
}

#[inline(always)]
#[allow(clippy::too_many_arguments)]
unsafe fn collide_point<const TRACK: bool>(
    s: &mut State,
    grid: &FlatIntMap<Vec<LineRef>>,
    events: &mut Vec<Collision>,
    frame_index: i32,
    history: &mut CollisionHistory,
    line_cache: &mut LineCellCache,
    it: u8,
    index: usize,
    fric: f64,
) {
    let (mut pxi, mut pyi, vxi, vyi) = (
        *s.px.get_unchecked(index),
        *s.py.get_unchecked(index),
        *s.vx.get_unchecked(index),
        *s.vy.get_unchecked(index),
    );
    let center_cell = line_cache.point_cell(index, pxi, pyi);
    // addToGrid (A): pre-collision snapshot.
    if TRACK {
        history.record_point(
            center_cell,
            frame_index,
            pxi,
            pyi,
            vxi,
            vyi,
        );
    }
    line_cache.cache_point_lines(grid, index, vxi, vyi);
    let lns = &line_cache.point_lines[index - PEG];
    if !lns.is_empty() {
        let (mut prevxi, mut prevyi) = (*s.prevx.get_unchecked(index), *s.prevy.get_unchecked(index));
        for &line in lns {
            // Entries point into immutable batch geometry owned by the grid.
            // Only point_cells is updated below; this query stays fixed during
            // the sweep even when a collision moves the entity to another cell.
            let l = &*line;
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
                let (mut fvx, mut fvy) = if fric == 0.0 {
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
                *s.px.get_unchecked_mut(index) = posx;
                *s.py.get_unchecked_mut(index) = posy;
                *s.prevx.get_unchecked_mut(index) = fvx;
                *s.prevy.get_unchecked_mut(index) = fvy;
                pxi = posx;
                pyi = posy;
                prevxi = fvx;
                prevyi = fvy;
                events.push((it, l.id, index as i32, posx, posy));
                // addToGrid (B) + addToCollisions: post-collision, centered on the MOVED entity.
                if TRACK {
                    let pcell = LineCellCache::update_cell(&mut line_cache.point_cells[index - PEG], pxi, pyi);
                    history.record_point(
                        pcell,
                        frame_index,
                        pxi,
                        pyi,
                        vxi,
                        vyi,
                    );
                    history.record_collision(l.id, frame_index);
                }
            }
        }
    }
}

/// One frame: step → 6×(constraints, collision) → BindJoints. `events` collects
/// (iteration, line_id, point_idx) per collision (for getUpdatesAtFrame). When
/// `track`, point snapshots and line collisions are recorded in `history` at
/// `frame_index`; recording is purely additive — it does not affect the physics.
#[allow(clippy::too_many_arguments)]
// Keep the large solver out of the frequently called cached-read path.
#[inline(never)]
pub(crate) fn step_state<const TRACK: bool>(
    s: &mut State,
    grid: &FlatIntMap<Vec<LineRef>>,
    events: &mut Vec<Collision>,
    frame_index: i32,
    history: &mut CollisionHistory,
    line_cache: &mut LineCellCache,
    mut trace: Option<&mut CollisionTrace>,
) {
    if TRACK { history.begin_frame(); }
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
            resolve_iter_constraints(s);
            if let Some(trace) = trace.as_deref_mut() { trace.record(s, it); }
            let it = it as u8;
            if TRACK || !line_cache.outside_grid(s) {
                for &(index, friction) in &COLLIDING_POINTS {
                    collide_point::<TRACK>(s, grid, events, frame_index, history, line_cache, it, index, friction);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_sweep_bounds_exclude_only_empty_neighborhoods() {
        for (slot, &(entity, _)) in COLLIDING_POINTS.iter().enumerate() {
            assert_eq!(entity, PEG + slot, "point slots follow the fixed rider topology");
        }
        let mut state = init_state(0.0, 0.0, 0.0, 0.0);
        for cell in [-LineCellCache::BOUNDED_CELL, -100, -1, 0, 1, 100, LineCellCache::BOUNDED_CELL] {
            let cells = [(cell, cell), (cell, (cell - 1).max(-LineCellCache::BOUNDED_CELL))];
            let mut cache = LineCellCache::default();
            cache.include_cells(&cells);
            cache.invalidate();
            let cloned = cache.clone();
            for face in [cell - 3, cell - 2, cell - 1, cell, cell + 1, cell + 2, cell + 3] {
                let boundary = face as f64 * GRID_SIZE;
                for x in [boundary.next_down(), boundary, boundary.next_up()] {
                  for swap in [false, true] {
                    for &(i, _) in &COLLIDING_POINTS {
                        let y = cell as f64 * GRID_SIZE;
                        (state.px[i], state.py[i]) = if swap { (y, x) } else { (x, y) };
                    }
                    assert_eq!(cache.outside_grid(&state), cloned.outside_grid(&state));
                    if cache.outside_grid(&state) {
                        for &(i, _) in &COLLIDING_POINTS {
                            let cx = cell_cor_from_scaled(state.px[i] / GRID_SIZE);
                            let cy = cell_cor_from_scaled(state.py[i] / GRID_SIZE);
                            for dx in -1..=1 { for dy in -1..=1 {
                                assert!(cells.iter().all(|&(x,y)| hash_int_pair(x,y) != hash_int_pair(cx+dx,cy+dy)));
                            }}
                        }
                    }
                  }
                }
            }
        }
        let mut cache = LineCellCache::default();
        cache.include_cells(&[(0,0)]);
        for &(i, _) in &COLLIDING_POINTS { state.px[i] = 100.0; state.py[i] = 100.0; }
        assert!(cache.outside_grid(&state));
        state.px[PEG] = 0.0; state.py[PEG] = 0.0;
        assert!(!cache.outside_grid(&state), "one overlapping point forbids skipping the sweep");
        for x in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, f64::MAX] {
            state.px[PEG] = x;
            assert!(!cache.outside_grid(&state));
        }
        state.px[PEG] = 100.0; state.py[PEG] = 100.0;
        cache.include_cells(&[(LineCellCache::BOUNDED_CELL + 1, 0)]);
        assert!(!cache.outside_grid(&state), "overflowing cell domains need ordinary queries");
    }

    #[test]
    fn squared_repel_gate_is_conservative_at_both_fixed_rest_boundaries() {
        for p2 in [LFOOT, RFOOT] {
            let rest = rest_length(SHOULDER, p2, 0.5);
            let square = rest * rest;
            assert_eq!(square.sqrt().to_bits(), rest.to_bits());
            for bits in square.to_bits() - 4..=square.to_bits() + 4 {
                let distance_squared = f64::from_bits(bits);
                assert!(!(distance_squared.sqrt() < rest) || distance_squared < square);
            }
        }
    }

    fn ids(cache: &mut LineCellCache, grid: &FlatIntMap<Vec<LineRef>>, x: f64, y: f64) -> Vec<i32> {
        cache.point_cell(PEG,x, y);
        cache.cache_point_lines(grid, PEG, 0.0, 1.0);
        cache.point_lines[0].iter().map(|&line| unsafe { (*line).id }).collect()
    }

    #[test]
    fn query_cache_invalidates_hits_misses_clones_and_epoch_wrap() {
        use crate::line::{build_line, push_line, remove_line};
        let mut grid = FlatIntMap::default();
        let mut cache = LineCellCache::default();
        assert!(ids(&mut cache, &grid, 1.0, 1.0).is_empty());
        let line = build_line(1, 0.0, 5.0, 10.0, 5.0, 0, 0);
        let cells = line.cells();
        cache.invalidate();
        push_line(&mut grid, &line, cells);
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
            push_line(&mut grid, &build_line(id, 0.0, 5.0, 10.0, 5.0, 0, 0), &cells);
        }
        assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), vec![3, 1, 3, 2]);
        let query = &cache.point_lines[0];
        LineCellCache::update_cell(&mut cache.point_cells[0], 14.0, 1.0);
        assert_eq!(query.iter().map(|&l| unsafe { (*l).id }).collect::<Vec<_>>(), vec![3, 1, 3, 2]);
        assert!(ids(&mut cache, &grid, 14.0, 1.0).is_empty());
        cache.invalidate();
        push_line(&mut grid, &build_line(4, 0.0, 5.0, 10.0, 5.0, 0, 0), &[(2, 0)]);
        assert_eq!(ids(&mut cache, &grid, 14.0, 1.0), vec![4]);
        cache.invalidate();
        remove_line(&mut grid, 4, &[(2, 0)]);
        assert!(ids(&mut cache, &grid, 14.0, 1.0).is_empty());
    }

    #[test]
    fn shared_query_eviction_does_not_replace_a_points_cached_lines() {
        use crate::line::{build_line, push_line};
        let mut grid = FlatIntMap::default();
        push_line(&mut grid, &build_line(1, 0.0, 5.0, 10.0, 5.0, 0, 0), &[(0, 0)]);
        let mut cache = LineCellCache::default();
        assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), vec![1]);
        for cx in 1..1024 {
            cache.queries.lookup(&grid, hash_int_pair(cx, 100), cx, 100);
        }
        assert_ne!(cache.queries.keys[0], 0); // evicted the shared query for (0,0)
        assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), vec![1]);
    }

    #[test]
    fn direction_filter_refreshes_each_frame_and_preserves_order_and_duplicates() {
        use crate::line::{build_line, push_line};
        let mut grid = FlatIntMap::default();
        push_line(&mut grid, &build_line(1, 0.0, 5.0, 10.0, 5.0, 0, 0), &[(0, 0), (0, 1)]);
        push_line(&mut grid, &build_line(2, 0.0, 5.0, 10.0, 5.0, 0, 1), &[(0, 0)]);
        push_line(&mut grid, &build_line(3, 5.0, 0.0, 5.0, 10.0, 1, 0), &[(0, 0)]);
        // A zero-length line has NaN normals and must never pass direction > 0.
        push_line(&mut grid, &build_line(4, 0.0, 0.0, 0.0, 0.0, 0, 0), &[(0, 0)]);
        let mut cache = LineCellCache::default();
        for (vx, vy, expected) in [
            (0.0, 1.0, vec![1, 1]),
            (0.0, -1.0, vec![2]),
            (-1.0, 1.0, vec![3, 1, 1]),
            (1.0, -1.0, vec![2]),
            (0.0, -0.0, vec![]),
            (f64::NAN, 1.0, vec![]),
            (0.0, f64::INFINITY, vec![1, 1]),
            (0.0, 1.0, vec![1, 1]),
        ] {
            let query_epoch = cache.queries.current_epoch;
            cache.begin_frame();
            assert_eq!(cache.queries.current_epoch, query_epoch);
            for _ in 0..6 {
                cache.point_cell(PEG,1.0, 1.0);
                cache.cache_point_lines(&grid, PEG, vx, vy);
                let got: Vec<i32> = cache.point_lines[0].iter().map(|&p| unsafe { (*p).id }).collect();
                assert_eq!(got, expected);
            }
        }
    }

    #[test]
    fn direction_compaction_handles_full_empty_and_growing_queries() {
        use crate::line::{build_line, push_line};
        let mut cache = LineCellCache::default();
        for count in [0, 1, 32, 4097, 3, 0, 65, 1] {
            let mut grid = FlatIntMap::default();
            for id in 0..count {
                push_line(&mut grid, &build_line(id, 0.0, 5.0, 10.0, 5.0, 0, 0), &[(0, 0), (0, 1)]);
            }
            cache.invalidate();
            let one_cell: Vec<i32> = (0..count).rev().collect();
            let expected: Vec<i32> = one_cell.iter().chain(one_cell.iter()).copied().collect();
            assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), expected);
            cache.begin_frame();
            cache.cache_point_lines(&grid, PEG, 0.0, -1.0);
            assert!(cache.point_lines[0].is_empty());
            // The entirely rejected pass must not leave stale output entries.
            cache.begin_frame();
            assert_eq!(ids(&mut cache, &grid, 1.0, 1.0), expected);
        }
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
            assert_eq!(cache.point_cell(PEG,x, y), crate::grid::cell_hash(x, y));
        }
    }
}

// A requested observation belongs to an engine version. The solver only writes
// into the explicitly supplied trace, never global state or lazy history replay.
pub(crate) struct CollisionTrace {
    pub frame: i32,
    pub count: usize,
    pub points: [f64; ITERATE * NENT * 6],
}

impl CollisionTrace {
    pub(crate) fn new(frame: i32) -> Self {
        Self { frame, count: 0, points: [0.0; ITERATE * NENT * 6] }
    }
    pub(crate) fn reset(&mut self, frame: i32) {
        self.frame = frame;
        self.count = 0;
    }
    #[cold]
    #[inline(never)]
    fn record(&mut self, s: &State, iteration: usize) {
        for i in 0..NENT {
            let k = (iteration * NENT + i) * 6;
            self.points[k] = s.px[i]; self.points[k + 1] = s.py[i];
            self.points[k + 2] = s.prevx[i]; self.points[k + 3] = s.prevy[i];
            self.points[k + 4] = s.vx[i]; self.points[k + 5] = s.vy[i];
        }
        self.count = iteration + 1;
    }
}
