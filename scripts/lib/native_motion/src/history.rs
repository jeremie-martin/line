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
use crate::line::{collides_with, Line};

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
    fn any_collides(&self, snap_links: &[SnapNode], l: &Line) -> bool {
        if collides_with(
            l,
            self.first.px,
            self.first.py,
            self.first.vx,
            self.first.vy,
        ) {
            return true;
        }
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
    snaps: Vec<SnapNode>,
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
            snaps: Vec::new(),
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

    #[inline]
    pub(crate) fn first_in_cell(&self, cx: i64, cy: i64, line: &Line) -> Option<i32> {
        index_of_collision_in_cell(&self.grid, &self.snaps, cx, cy, line)
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
fn append_snapshot(frame: &mut CellFrame, snap_links: &mut Vec<SnapNode>, snap: Snap) {
    let next = frame.rest_head;
    frame.rest_head = snap_links.len() as i32;
    snap_links.push(SnapNode { snap, next });
}

/// First node below `before` (ascending index) in one center-cell list whose
/// snapshots collide with the line.
#[inline]
fn index_of_collision_in_center_cell(
    grid: &HistGrid,
    snap_links: &[SnapNode],
    cell: i64,
    l: &Line,
    before: i32,
) -> Option<i32> {
    let list = grid.get(&cell)?;
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

/// Frame.getIndexOfCollisionInCell (Frame.js:122), represented through a
/// center-cell index: a line cell can collide with snapshots whose center cell is
/// any of the inverse 3×3 neighborhood cells.
#[inline]
fn index_of_collision_in_cell(
    grid: &HistGrid,
    snap_links: &[SnapNode],
    gx: i64,
    gy: i64,
    l: &Line,
) -> Option<i32> {
    let mut best = i32::MAX;
    for dx in -1..=1 {
        for dy in -1..=1 {
            let center = hash_int_pair(gx + dx, gy + dy);
            if let Some(idx) = index_of_collision_in_center_cell(grid, snap_links, center, l, best)
            {
                best = idx;
            }
        }
    }
    if best == i32::MAX {
        None
    } else {
        Some(best)
    }
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
        assert_eq!(history.first_in_cell(0, 0, &near), Some(1));
        assert_eq!(history.first_in_cell(10, 10, &far), Some(2));
        let mut detached = history.clone();
        assert!(detached.active.get(hash_int_pair(10, 10)).is_none());
        detached.truncate(2);
        assert_eq!(detached.len(), 2);
        assert_eq!(detached.first_with_line(8), None);
        assert_eq!(detached.first_in_cell(10, 10, &far), None);
        assert_eq!(detached.first_in_cell(0, 0, &near), Some(1));
        assert_eq!(history.first_with_line(8), Some(2));
        assert_eq!(history.first_in_cell(10, 10, &far), Some(2));
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
        assert_eq!(detached.first_in_cell(0, 0, &near), None);
        assert!(detached.active.get(hash_int_pair(0, 0)).is_none());
        history.clear();
        assert_eq!(history.len(), 1);
        assert_eq!(history.first_with_line(7), None);
        assert_eq!(history.first_with_line(8), None);
        assert_eq!(history.first_in_cell(10, 10, &far), None);
        assert!(history.active.get(hash_int_pair(10, 10)).is_none());
    }
}
