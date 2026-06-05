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

use crate::grid::{hash_int_pair, unhash_int_pair, IntMap};
use crate::line::{collides_with, Line};

/// snapshotEntity: pos + vel only (Frame.js:16 — the only fields the invalidation
/// replay reads).
#[derive(Clone, Copy)]
pub(crate) struct Snap {
    pub px: f64,
    pub py: f64,
    pub vx: f64,
    pub vy: f64,
}

pub(crate) struct SnapNode {
    snap: i32,
    next: i32,
}

/// A CellFrameList node: snapshots recorded in one center cell at one frame index,
/// in insertion order (COLLIDABLES order × pre/post per collision).
#[derive(Clone)]
pub(crate) struct CellFrame {
    pub index: i32,
    first: i32,
    rest_head: i32,
}

const ACTIVE_CELL_SLOTS: usize = 128;

pub(crate) struct ActiveCellCache {
    keys: [i64; ACTIVE_CELL_SLOTS],
    ptrs: [*mut CellFrame; ACTIVE_CELL_SLOTS],
    epochs: [u32; ACTIVE_CELL_SLOTS],
    current_epoch: u32,
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
    pub(crate) fn begin_frame(&mut self) {
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
    fn any_collides(&self, snap_links: &[SnapNode], snap_values: &[Snap], l: &Line) -> bool {
        let first = snap_values[self.first as usize];
        if collides_with(l, first.px, first.py, first.vx, first.vy) {
            return true;
        }
        let mut next = self.rest_head;
        while next != -1 {
            let n = &snap_links[next as usize];
            let snap = snap_values[n.snap as usize];
            if collides_with(l, snap.px, snap.py, snap.vx, snap.vy) {
                return true;
            }
            next = n.next;
        }
        false
    }
}

/// Frame.grid: entity center-cell hash → CellFrameList (ascending-index nodes).
pub(crate) type HistGrid = IntMap<i64, Vec<CellFrame>>;
/// Frame.collisions: line id → ascending frame indices it collided (the IndexList).
pub(crate) type Collisions = IntMap<i32, Vec<i32>>;

#[inline]
fn append_snapshot(frame: &mut CellFrame, snap_links: &mut Vec<SnapNode>, snap: i32) {
    let next = frame.rest_head;
    frame.rest_head = snap_links.len() as i32;
    snap_links.push(SnapNode { snap, next });
}

/// addToGrid for one cell (addEntityToCellFrames, Frame.js:100): append to the
/// cell's current-frame node, or start a new node (recording the cell in this
/// frame's reverse patch `touched`).
#[inline]
fn add_to_cell(
    grid: &mut HistGrid,
    touched: &mut Vec<i64>,
    snap_links: &mut Vec<SnapNode>,
    active: &mut ActiveCellCache,
    cell: i64,
    index: i32,
    snap: i32,
) {
    if let Some(frame) = active.get(cell) {
        append_snapshot(frame, snap_links, snap);
        return;
    }

    let list = grid.entry(cell).or_default();
    if let Some(last) = list.last_mut() {
        if last.index == index {
            append_snapshot(last, snap_links, snap);
            active.put(cell, last);
            return;
        }
    }
    list.push(CellFrame { index, first: snap, rest_head: -1 });
    active.put(cell, list.last_mut().unwrap());
    touched.push(cell);
}

/// addToGrid(entity, index): record the snapshot in the entity center cell.
/// Query-time expansion over a line cell's inverse 3×3 neighborhood preserves
/// lr-core's observable invalidation condition while avoiding the 9-way write fanout.
#[inline]
#[allow(clippy::too_many_arguments)]
pub(crate) fn add_to_grid(
    grid: &mut HistGrid,
    touched: &mut Vec<i64>,
    snap_links: &mut Vec<SnapNode>,
    snap_values: &mut Vec<Snap>,
    active: &mut ActiveCellCache,
    center_cell: i64,
    index: i32,
    px: f64,
    py: f64,
    vx: f64,
    vy: f64,
) {
    let snap = snap_values.len() as i32;
    snap_values.push(Snap { px, py, vx, vy });
    add_to_cell(grid, touched, snap_links, active, center_cell, index, snap);
}

/// First node below `before` (ascending index) in one center-cell list whose
/// snapshots collide with the line.
#[inline]
fn index_of_collision_in_center_cell(
    grid: &HistGrid,
    snap_links: &[SnapNode],
    snap_values: &[Snap],
    cell: i64,
    l: &Line,
    before: i32,
) -> Option<i32> {
    let list = grid.get(&cell)?;
    for cf in list.iter() {
        if cf.index >= before {
            break;
        }
        if cf.any_collides(snap_links, snap_values, l) {
            return Some(cf.index);
        }
    }
    None
}

/// Frame.getIndexOfCollisionInCell (Frame.js:122), represented through a
/// center-cell index: a line cell can collide with snapshots whose center cell is
/// any of the inverse 3×3 neighborhood cells.
#[inline]
pub(crate) fn index_of_collision_in_cell(
    grid: &HistGrid,
    snap_links: &[SnapNode],
    snap_values: &[Snap],
    cell: i64,
    l: &Line,
) -> Option<i32> {
    let (gx, gy) = unhash_int_pair(cell);
    let mut best = i32::MAX;
    for dx in -1..=1 {
        for dy in -1..=1 {
            let center = hash_int_pair(gx + dx, gy + dy);
            if let Some(idx) = index_of_collision_in_center_cell(grid, snap_links, snap_values, center, l, best) {
                best = idx;
            }
        }
    }
    if best == i32::MAX { None } else { Some(best) }
}

/// addToCollisions(line, index) (Frame.js:182): append `index` to the line's frame
/// list unless it's already the last (per-frame dedup). Records the line in this
/// frame's reverse patch `touched_lines` when a new entry is created.
#[inline]
pub(crate) fn add_to_collisions(coll: &mut Collisions, touched_lines: &mut Vec<i32>, line_id: i32, index: i32) {
    let list = coll.entry(line_id).or_default();
    if list.last() == Some(&index) {
        return;
    }
    list.push(index);
    touched_lines.push(line_id);
}

/// Frame.getIndexOfCollisionWithLine (Frame.js:133): the FIRST frame the line ever
/// collided (lineCollisions.get(0)) — the _removeLine truncation point.
#[inline]
pub(crate) fn index_of_collision_with_line(coll: &Collisions, line_id: i32) -> Option<i32> {
    coll.get(&line_id).and_then(|l| l.first().copied())
}

/// Roll the history grid back to `len` frames: for f in [len, top) descending, drop
/// the index-f node each cell it touched created (the reverse patch).
pub(crate) fn rollback_grid(grid: &mut HistGrid, touched: &[i64], offsets: &[usize], len: usize) {
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
pub(crate) fn rollback_collisions(coll: &mut Collisions, touched_lines: &[i32], offsets: &[usize], len: usize) {
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
