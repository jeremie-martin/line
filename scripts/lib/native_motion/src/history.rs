//! Frame collision-history + collisions map — bit-faithful port of lr-core's
//! Frame.js. There is exactly ONE of each per lineage's shared cache (lr-core's
//! Frame.grid / Frame.collisions live on the cache's last frame and are only ever
//! read there and appended to during compute), so plain mutable maps with a
//! per-frame reverse patch (for `_setFramesLength` rollback) are observationally
//! identical to lr-core's persistent per-frame structures.
//!
//!   - `snapshotEntity` → `Snap{pos,vel}` (the parity fix)
//!   - `Frame.grid` (center cell → CellFrameList) + addToGrid + getIndexOfCollisionInCell
//!   - `Frame.collisions` (line id → frames) + addToCollisions + getIndexOfCollisionWithLine

use crate::grid::{hash_int_pair, IntMap};
use crate::line::{collides_with, Line, LineRef};
use std::cell::OnceCell;
use crate::shared_prefix::SharedPrefix;

/// snapshotEntity: pos + vel only (Frame.js:16 — the only fields the invalidation
/// replay reads).
#[derive(Clone, Copy)]
struct Snap {
    px: f64,
    py: f64,
    vx: f64,
    vy: f64,
}

#[derive(Clone)]
struct SnapNode {
    snap: Snap,
    next: i32,
}

/// A CellFrameList node: snapshots recorded in one center cell at one frame index,
/// in insertion order (collidable point order × pre/post per collision).
#[derive(Clone)]
struct CellFrame {
    index: i32,
    first: Snap,
    rest_head: i32,
    bounds: OnceCell<Option<SnapshotBounds>>,
}

/** Exact component ranges of the recorded snapshots. Apply the collision
 * predicate's subtraction/multiplication/addition in its original order to
 * range endpoints. Monotonicity gives conservative bounds without an epsilon. */
#[derive(Clone)]
struct SnapshotBounds {
    low: [f64; 4],
    high: [f64; 4],
}

impl SnapshotBounds {
    fn from_frame(frame: &CellFrame, links: &SharedPrefix<SnapNode>) -> Option<Self> {
        let mut bounds = Self { low: [f64::INFINITY; 4], high: [f64::NEG_INFINITY; 4] };
        let mut snap = frame.first;
        let mut next = frame.rest_head;
        loop {
            for (i, value) in [snap.px, snap.py, snap.vx, snap.vy].into_iter().enumerate() {
                if !value.is_finite() { return None; }
                bounds.low[i] = bounds.low[i].min(value);
                bounds.high[i] = bounds.high[i].max(value);
            }
            if next == -1 { return Some(bounds); }
            let node = &links[next as usize];
            snap = node.snap; next = node.next;
        }
    }

    fn excludes(&self, line: &Line) -> bool {
        if ![line.p1x, line.p1y, line.normx, line.normy, line.vecx, line.vecy, line.inv_len_sq]
            .iter().all(|v| v.is_finite()) { return false; }
        let (_, direction_max) = dot_bounds(line.normx, line.normy, self.low[2], self.high[2], self.low[3], self.high[3]);
        if direction_max <= 0.0 { return true; }
        let (x0, x1) = (self.low[0] - line.p1x, self.high[0] - line.p1x);
        let (y0, y1) = (self.low[1] - line.p1y, self.high[1] - line.p1y);
        let (perp_min, perp_max) = dot_bounds(line.normx, line.normy, x0, x1, y0, y1);
        if perp_max <= 0.0 || perp_min >= crate::line::MAX_FORCE_LENGTH { return true; }
        let (along_min, along_max) = dot_bounds(line.vecx, line.vecy, x0, x1, y0, y1);
        along_max * line.inv_len_sq < line.left_bound || along_min * line.inv_len_sq > line.right_bound
    }
}

#[inline]
fn dot_bounds(a: f64, b: f64, x0: f64, x1: f64, y0: f64, y1: f64) -> (f64, f64) {
    let (xmin, xmax) = if a >= 0.0 { (x0, x1) } else { (x1, x0) };
    let (ymin, ymax) = if b >= 0.0 { (y0, y1) } else { (y1, y0) };
    (a * xmin + b * ymin, a * xmax + b * ymax)
}

const ACTIVE_CELL_SLOTS: usize = 128;

struct ActiveCellCache {
    keys: [i64; ACTIVE_CELL_SLOTS],
    ptrs: [*mut CellFrame; ACTIVE_CELL_SLOTS],
    epochs: [u32; ACTIVE_CELL_SLOTS],
    current_epoch: u32,
}

// Shortcuts borrow nodes in the owning history map. A clone owns a different
// map, so its shortcuts must start empty rather than copy borrowed pointers.
impl Clone for ActiveCellCache {
    fn clone(&self) -> Self {
        Self::default()
    }
}

impl Default for ActiveCellCache {
    fn default() -> ActiveCellCache {
        ActiveCellCache {
            keys: [0; ACTIVE_CELL_SLOTS],
            ptrs: [std::ptr::null_mut(); ACTIVE_CELL_SLOTS],
            epochs: [0; ACTIVE_CELL_SLOTS],
            current_epoch: 1,
        }
    }
}

impl ActiveCellCache {
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
        ((cell as u64).wrapping_mul(0x9E3779B97F4A7C15) as usize) & (ACTIVE_CELL_SLOTS - 1)
    }

    #[inline]
    fn get(&mut self, cell: i64) -> Option<&mut CellFrame> {
        let slot = Self::slot(cell);
        if self.epochs[slot] == self.current_epoch && self.keys[slot] == cell {
            // SAFETY: only CollisionHistory owns these nodes. Recording within
            // a frame never moves its existing cell node; frame changes, reset
            // and rollback invalidate the epoch before the next lookup. Clones
            // start with empty shortcuts.
            Some(unsafe { &mut *self.ptrs[slot] })
        } else {
            None
        }
    }

    #[inline]
    fn put(&mut self, cell: i64, frame: &mut CellFrame) {
        let slot = Self::slot(cell);
        self.keys[slot] = cell;
        self.ptrs[slot] = frame;
        self.epochs[slot] = self.current_epoch;
    }
}

impl CellFrame {
    #[inline]
    fn any_collides(&self, snap_links: &SharedPrefix<SnapNode>, l: &Line) -> bool {
        if collides_with(
            l,
            self.first.px,
            self.first.py,
            self.first.vx,
            self.first.vy,
        ) {
            return true;
        }
        if self.rest_head == -1 { return false; }
        if self.bounds.get_or_init(|| SnapshotBounds::from_frame(self, snap_links))
            .as_ref().is_some_and(|bounds| bounds.excludes(l)) { return false; }
        self.rest_collides(snap_links, l)
    }

    #[cfg(test)]
    fn any_collides_exact(&self, snap_links: &SharedPrefix<SnapNode>, line: &Line) -> bool {
        collides_with(line, self.first.px, self.first.py, self.first.vx, self.first.vy)
            || self.rest_collides(snap_links, line)
    }

    #[inline]
    fn rest_collides(&self, snap_links: &SharedPrefix<SnapNode>, l: &Line) -> bool {
        let mut next = self.rest_head;
        while next != -1 {
            let n = &snap_links[next as usize];
            if collides_with(l, n.snap.px, n.snap.py, n.snap.vx, n.snap.vy) {
                return true;
            }
            next = n.next;
        }
        false
    }
}

/// Owns the invalidation indexes and their per-frame reverse patches together.
/// Frame zero is empty. All three boundary arrays advance and roll back in one
/// operation; their length is the source of truth for the tracked prefix.
#[derive(Clone)]
pub(crate) struct CollisionHistory {
    grid: HistGrid,
    collisions: Collisions,
    cells: Vec<i64>,
    cell_ends: Vec<usize>,
    snaps: SharedPrefix<SnapNode>,
    snap_ends: Vec<usize>,
    active: ActiveCellCache,
    lines: Vec<i32>,
    line_ends: Vec<usize>,
}

impl CollisionHistory {
    pub(crate) fn new() -> Self {
        Self {
            grid: HistGrid::default(),
            collisions: Collisions::default(),
            cells: Vec::new(),
            cell_ends: vec![0, 0],
            snaps: SharedPrefix::default(),
            snap_ends: vec![0, 0],
            active: ActiveCellCache::default(),
            lines: Vec::new(),
            line_ends: vec![0, 0],
        }
    }

    #[inline]
    pub(crate) fn len(&self) -> usize {
        self.cell_ends.len() - 1
    }

    pub(crate) fn clear(&mut self) {
        self.active.begin_frame();
        self.grid.clear();
        self.collisions.clear();
        self.cells.clear();
        self.snaps.clear();
        self.lines.clear();
        for ends in [
            &mut self.cell_ends,
            &mut self.snap_ends,
            &mut self.line_ends,
        ] {
            ends.clear();
            ends.extend_from_slice(&[0, 0]);
        }
    }

    pub(crate) fn truncate(&mut self, len: usize) {
        if len >= self.len() {
            return;
        }
        assert!(len > 0, "history always retains frame zero");
        self.active.begin_frame();
        rollback_grid(&mut self.grid, &self.cells, &self.cell_ends, len);
        rollback_collisions(&mut self.collisions, &self.lines, &self.line_ends, len);
        self.cells.truncate(self.cell_ends[len]);
        self.cell_ends.truncate(len + 1);
        self.snaps.truncate(self.snap_ends[len]);
        self.snap_ends.truncate(len + 1);
        self.lines.truncate(self.line_ends[len]);
        self.line_ends.truncate(len + 1);
    }

    #[inline]
    pub(crate) fn finish_frame(&mut self) {
        self.cell_ends.push(self.cells.len());
        self.snap_ends.push(self.snaps.len());
        self.line_ends.push(self.lines.len());
    }

    #[inline]
    pub(crate) fn begin_frame(&mut self) {
        self.active.begin_frame();
    }

    #[inline]
    pub(crate) fn record_point(
        &mut self,
        cell: i64,
        frame: i32,
        px: f64,
        py: f64,
        vx: f64,
        vy: f64,
    ) {
        debug_assert_eq!(frame as usize, self.len());
        let snap = Snap { px, py, vx, vy };
        if let Some(node) = self.active.get(cell) {
            append_snapshot(node, &mut self.snaps, snap);
            return;
        }
        let list = self.grid.entry(cell).or_default();
        if let Some(last) = list.last_mut() {
            if last.index == frame {
                append_snapshot(last, &mut self.snaps, snap);
                self.active.put(cell, last);
                return;
            }
        }
        list.push(CellFrame {
            index: frame,
            first: snap,
            rest_head: -1,
            bounds: OnceCell::new(),
        });
        self.active.put(cell, list.last_mut().unwrap());
        self.cells.push(cell);
    }

    #[inline]
    pub(crate) fn record_collision(&mut self, id: i32, frame: i32) {
        debug_assert_eq!(frame as usize, self.len());
        let list = self.collisions.entry(id).or_default();
        if list.last() != Some(&frame) {
            list.push(frame);
            self.lines.push(id);
        }
    }

    /// Earliest collision with any added line. The history is immutable for the
    /// complete registration batch: consecutive lines in the same raster cell
    /// can reuse its nine center-cell lists. Load only lists actually visited,
    /// retaining the adjacent-cell overlap skip within each line's footprint.
    pub(crate) fn first_for_added_lines(&self, lines: &[LineRef], before: i32) -> Option<i32> {
        let mut best = before;
        let mut query_cell = None;
        let mut lists: [Option<&[CellFrame]>; 9] = [None; 9];
        for line in lines.iter().filter(|line| line.collidable) {
            let mut previous: Option<(i64, i64)> = None;
            for &(gx, gy) in line.cells() {
                if query_cell != Some((gx, gy)) {
                    query_cell = Some((gx, gy));
                    lists.fill(None);
                }
                for dx in -1..=1 {
                    for dy in -1..=1 {
                        let cx = gx + dx;
                        let cy = gy + dy;
                        if previous.is_some_and(|(px, py)| cx.abs_diff(px) <= 1 && cy.abs_diff(py) <= 1) {
                            continue;
                        }
                        let slot = ((dx + 1) * 3 + dy + 1) as usize;
                        let list = *lists[slot].get_or_insert_with(|| self.grid
                            .get(&hash_int_pair(cx, cy)).map_or(&[], Vec::as_slice));
                        if let Some(index) = index_of_collision_in_list(list, &self.snaps, line, best) {
                            best = index;
                            if best == 1 { return Some(1); }
                        }
                    }
                }
                previous = Some((gx, gy));
            }
        }
        (best != before).then_some(best)
    }

    #[inline]
    pub(crate) fn first_with_line(&self, id: i32) -> Option<i32> {
        self.collisions
            .get(&id)
            .and_then(|frames| frames.first().copied())
    }
}

/// Frame.grid: entity center-cell hash → CellFrameList (ascending-index nodes).
type HistGrid = IntMap<i64, Vec<CellFrame>>;
/// Frame.collisions: line id → ascending frame indices it collided (the IndexList).
type Collisions = IntMap<i32, Vec<i32>>;

#[inline]
fn append_snapshot(frame: &mut CellFrame, snap_links: &mut SharedPrefix<SnapNode>, snap: Snap) {
    frame.bounds.take();
    let next = frame.rest_head;
    frame.rest_head = snap_links.len() as i32;
    snap_links.push(SnapNode { snap, next });
}

/// First node below `before` (ascending index) in one center-cell list whose
/// snapshots collide with the line.
#[inline]
fn index_of_collision_in_list(
    list: &[CellFrame],
    snap_links: &SharedPrefix<SnapNode>,
    l: &Line,
    before: i32,
) -> Option<i32> {
    for cf in list.iter() {
        if cf.index >= before {
            break;
        }
        if cf.any_collides(snap_links, l) {
            return Some(cf.index);
        }
    }
    None
}

/// Roll the history grid back to `len` frames: for f in [len, top) descending, drop
/// the index-f node each cell it touched created (the reverse patch).
fn rollback_grid(grid: &mut HistGrid, touched: &[i64], offsets: &[usize], len: usize) {
    for f in (len..offsets.len() - 1).rev() {
        for &cell in touched[offsets[f]..offsets[f + 1]].iter() {
            if let Some(list) = grid.get_mut(&cell) {
                list.pop();
                if list.is_empty() {
                    grid.remove(&cell);
                }
            }
        }
    }
}

/// Roll the collisions map back to `len` frames (same reverse-patch shape).
fn rollback_collisions(
    coll: &mut Collisions,
    touched_lines: &[i32],
    offsets: &[usize],
    len: usize,
) {
    for f in (len..offsets.len() - 1).rev() {
        for &id in touched_lines[offsets[f]..offsets[f + 1]].iter() {
            if let Some(list) = coll.get_mut(&id) {
                list.pop();
                if list.is_empty() {
                    coll.remove(&id);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::line::build_line;

    #[test]
    fn shared_snapshot_chunks_preserve_source_after_branch_rollback_and_append() {
        let mut source = CollisionHistory::new();
        let cell = hash_int_pair(0, 0);
        for frame in 1..=130 {
            source.begin_frame();
            for point in 0..70 {
                source.record_point(cell, frame, point as f64, frame as f64, 0.0, 1.0);
            }
            source.finish_frame();
        }
        let values = |history: &CollisionHistory| (0..history.snaps.len()).map(|i| {
            let s = history.snaps[i].snap;
            [s.px.to_bits(), s.py.to_bits(), s.vx.to_bits(), s.vy.to_bits()]
        }).collect::<Vec<_>>();
        let original = values(&source);
        for keep in [1, 2, 63, 64, 65, 129, 131] {
            let mut branch = source.clone();
            branch.truncate(keep);
            let prefix = branch.snaps.len();
            for frame in keep..keep + 3 {
                branch.begin_frame();
                for point in 0..100 {
                    branch.record_point(cell, frame as i32, -(point as f64), -(frame as f64), -0.0, -1.0);
                }
                branch.finish_frame();
            }
            assert_eq!(values(&source), original);
            assert_eq!(&values(&branch)[..prefix], &original[..prefix]);
            assert_eq!(branch.len(), keep + 3);
            assert_eq!(source.len(), 131);
        }
    }

    #[test]
    fn snapshot_bounds_preserve_exact_predicates_and_reset_after_append() {
        let values = [-f64::MAX, -1.0e100, -10.0, -f64::MIN_POSITIVE, -0.0, 0.0,
            f64::MIN_POSITIVE, 1.0e-200, 1.0, 10.0, 1.0e100, f64::MAX, f64::INFINITY, f64::NAN];
        for trial in 0..200 {
            let mut frame = CellFrame { index: 1, first: Snap { px: -1.0, py: -1.0, vx: 0.0, vy: 1.0 },
                rest_head: -1, bounds: OnceCell::new() };
            let mut links = SharedPrefix::default();
            for i in 0..12 {
                append_snapshot(&mut frame, &mut links, Snap {
                    px: values[(trial + i) % values.len()], py: values[(trial * 3 + i) % values.len()],
                    vx: values[(trial * 5 + i) % values.len()], vy: values[(trial * 7 + i) % values.len()],
                });
            }
            for i in 0..24 {
                // Construct geometry directly; these predicate tests need no
                // raster walk over their deliberately extreme coordinates.
                let x = values[(trial + i) % values.len()];
                let y = values[(trial * 2 + i) % values.len()];
                let line = Line::new(i as i32, x, y, x + 10.0, y + i as f64 - 12.0, 0, (i % 8) as i64);
                assert_eq!(frame.any_collides(&links, &line), frame.any_collides_exact(&links, &line));
            }
        }
        let line = Line::new(1, 0.0, 0.0, 10.0, 0.0, 0, 0);
        let mut frame = CellFrame { index: 1, first: Snap { px: 1.0, py: -1.0, vx: 0.0, vy: 1.0 },
            rest_head: -1, bounds: OnceCell::new() };
        let mut links = SharedPrefix::default();
        append_snapshot(&mut frame, &mut links, Snap { px: 2.0, py: -2.0, vx: 0.0, vy: 1.0 });
        assert!(!frame.any_collides(&links, &line));
        assert!(frame.bounds.get().is_some());
        append_snapshot(&mut frame, &mut links, Snap { px: 2.0, py: 1.0, vx: 0.0, vy: 1.0 });
        assert!(frame.bounds.get().is_none());
        assert!(frame.any_collides(&links, &line));
    }

    #[test]
    fn overlapping_neighborhood_queries_equal_an_exhaustive_history_scan() {
        let mut history = CollisionHistory::new();
        for frame in 1..=80 {
            history.begin_frame();
            for point in 0..3 {
                let px = ((frame * 31 + point * 13) % 180 - 90) as f64;
                let py = ((frame * 17 + point * 7) % 70 - 35) as f64;
                let cell = hash_int_pair((px / 14.0).floor() as i64, (py / 14.0).floor() as i64);
                history.record_point(cell, frame, px, py, point as f64 - 1.0, 1.0);
            }
            history.finish_frame();
        }
        for through in [81, 61, 21, 1] {
            history.truncate(through);
            for i in 0..200 {
                let x = ((i * 17) % 200 - 100) as f64;
                let y = ((i * 13) % 100 - 50) as f64;
                let line = build_line(i, x, y, x + ((i * 11) % 100 - 50) as f64,
                    y + ((i * 7) % 60 - 30) as f64, 0, (i % 8) as i64);
                let mut expected = None;
                for &(gx, gy) in line.cells() {
                    for dx in -1..=1 {
                        for dy in -1..=1 {
                            if let Some(list) = history.grid.get(&hash_int_pair(gx + dx, gy + dy)) {
                                for frame in list {
                                    if frame.any_collides_exact(&history.snaps, &line) {
                                        expected = Some(expected.map_or(frame.index, |before: i32| before.min(frame.index)));
                                    }
                                }
                            }
                        }
                    }
                }
                assert_eq!(history.first_for_added_lines(std::slice::from_ref(&line), i32::MAX), expected);
                for before in [1, 3, 37, 81] {
                    assert_eq!(history.first_for_added_lines(std::slice::from_ref(&line), before), expected.filter(|&index| index < before));
                }
                assert_eq!(history.len(), through, "a query must not mutate history");
            }
        }
    }

    #[test]
    fn batch_neighborhood_reuse_matches_unfiltered_history() {
        let mut history = CollisionHistory::new();
        for frame in 1..40 {
            history.begin_frame();
            for point in 0..12 {
                let x = ((frame * 11 + point * 3) % 70 - 35) as f64;
                let y = ((frame * 7 + point * 13) % 70 - 35) as f64;
                history.record_point(hash_int_pair((x / 14.0).floor() as i64,
                    (y / 14.0).floor() as i64), frame, x, y, point as f64 - 4.0, 1.0);
            }
            history.finish_frame();
        }
        for trial in 0..200 {
            let x = ((trial * 11) % 90 - 45) as f64;
            let y = ((trial * 7) % 90 - 45) as f64;
            let lines: Vec<_> = (0..12).map(|i| build_line(i / 2, x + i as f64, y,
                x + i as f64 + (i % 3 * 14 + 1) as f64, y + (i % 5 - 2) as f64,
                (i % 3) as i64, (i % 8) as i64)).collect();
            for before in [1, 5, 20, i32::MAX] {
                let mut expected = before;
                for line in lines.iter().filter(|line| line.collidable) {
                    for &(gx, gy) in line.cells() {
                        for dx in -1..=1 { for dy in -1..=1 {
                            if let Some(list) = history.grid.get(&hash_int_pair(gx + dx, gy + dy)) {
                                for frame in list {
                                    if frame.index < expected && frame.any_collides_exact(&history.snaps, line) {
                                        expected = frame.index;
                                    }
                                }
                            }
                        }}
                    }
                }
                assert_eq!(history.first_for_added_lines(&lines, before),
                    (expected < before).then_some(expected));
            }
        }
    }

    #[test]
    fn rollback_and_clone_keep_history_queries_local_to_their_prefix() {
        let near = build_line(7, 0.0, 0.0, 10.0, 0.0, 0, 0);
        let far = build_line(8, 140.0, 140.0, 150.0, 140.0, 0, 0);
        let mut history = CollisionHistory::new();
        history.begin_frame();
        history.record_point(hash_int_pair(0, 0), 1, -1.0, 1.0, 0.0, 1.0);
        history.record_point(hash_int_pair(0, 0), 1, 1.0, 1.0, 0.0, 1.0);
        history.record_collision(7, 1);
        history.record_collision(7, 1);
        history.finish_frame();
        history.begin_frame();
        history.record_point(hash_int_pair(10, 10), 2, 141.0, 141.0, 0.0, 1.0);
        history.record_collision(8, 2);
        history.finish_frame();
        assert_eq!(history.len(), 3);
        assert_eq!(history.first_for_added_lines(std::slice::from_ref(&near), i32::MAX), Some(1));
        assert_eq!(history.first_for_added_lines(std::slice::from_ref(&far), i32::MAX), Some(2));
        let mut detached = history.clone();
        assert!(detached.active.get(hash_int_pair(10, 10)).is_none());
        detached.truncate(2);
        assert_eq!(detached.len(), 2);
        assert_eq!(detached.first_with_line(8), None);
        assert_eq!(detached.first_for_added_lines(std::slice::from_ref(&far), i32::MAX), None);
        assert_eq!(detached.first_for_added_lines(std::slice::from_ref(&near), i32::MAX), Some(1));
        assert_eq!(history.first_with_line(8), Some(2));
        assert_eq!(history.first_for_added_lines(std::slice::from_ref(&far), i32::MAX), Some(2));
        detached.begin_frame();
        detached.record_point(hash_int_pair(0, 0), 2, 2.0, 1.0, 0.0, 1.0);
        detached.record_collision(9, 2);
        detached.finish_frame();
        assert_eq!(detached.first_with_line(9), Some(2));
        assert_eq!(history.first_with_line(9), None);
        detached.begin_frame();
        detached.finish_frame(); // an empty frame still has a rollback boundary
        detached.truncate(1);
        assert_eq!(detached.len(), 1);
        assert_eq!(detached.first_with_line(7), None);
        assert_eq!(detached.first_with_line(9), None);
        assert_eq!(detached.first_for_added_lines(std::slice::from_ref(&near), i32::MAX), None);
        assert!(detached.active.get(hash_int_pair(0, 0)).is_none());
        history.clear();
        assert_eq!(history.len(), 1);
        assert_eq!(history.first_with_line(7), None);
        assert_eq!(history.first_with_line(8), None);
        assert_eq!(history.first_for_added_lines(std::slice::from_ref(&far), i32::MAX), None);
        assert!(history.active.get(hash_int_pair(10, 10)).is_none());
    }
}
