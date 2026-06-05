//! Frame collision-history + collisions map — bit-faithful port of lr-core's
//! Frame.js. There is exactly ONE of each per lineage's shared cache (lr-core's
//! Frame.grid / Frame.collisions live on the cache's last frame and are only ever
//! read there and appended to during compute), so plain mutable maps with a
//! per-frame reverse patch (for `_setFramesLength` rollback) are observationally
//! identical to lr-core's persistent per-frame structures.
//!
//!   - `snapshotEntity` → `Snap{pos,vel}` (the parity fix)
//!   - `Frame.grid` (cell → CellFrameList) + addToGrid + getIndexOfCollisionInCell
//!   - `Frame.collisions` (line id → frames) + addToCollisions + getIndexOfCollisionWithLine

use crate::grid::IntMap;
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
    snap: Snap,
    next: i32,
}

/// A CellFrameList node: snapshots recorded in one cell at one frame index, in
/// insertion order (COLLIDABLES order × the 3×3 fan-out × pre/post per collision).
#[derive(Clone)]
pub(crate) struct CellFrame {
    pub index: i32,
    first: Snap,
    rest_head: i32,
}

impl CellFrame {
    #[inline]
    fn any_collides(&self, snaps: &[SnapNode], l: &Line) -> bool {
        if collides_with(l, self.first.px, self.first.py, self.first.vx, self.first.vy) {
            return true;
        }
        let mut next = self.rest_head;
        while next != -1 {
            let n = &snaps[next as usize];
            if collides_with(l, n.snap.px, n.snap.py, n.snap.vx, n.snap.vy) {
                return true;
            }
            next = n.next;
        }
        false
    }
}

/// Frame.grid: cell hash → CellFrameList (ascending-index nodes).
pub(crate) type HistGrid = IntMap<i64, Vec<CellFrame>>;
/// Frame.collisions: line id → ascending frame indices it collided (the IndexList).
pub(crate) type Collisions = IntMap<i32, Vec<i32>>;

/// addToGrid for one cell (addEntityToCellFrames, Frame.js:100): append to the
/// cell's current-frame node, or start a new node (recording the cell in this
/// frame's reverse patch `touched`).
#[inline]
fn add_to_cell(grid: &mut HistGrid, touched: &mut Vec<i64>, snaps: &mut Vec<SnapNode>, cell: i64, index: i32, snap: Snap) {
    let list = grid.entry(cell).or_default();
    if let Some(last) = list.last_mut() {
        if last.index == index {
            let next = last.rest_head;
            last.rest_head = snaps.len() as i32;
            snaps.push(SnapNode { snap, next });
            return;
        }
    }
    list.push(CellFrame { index, first: snap, rest_head: -1 });
    touched.push(cell);
}

/// addToGrid(entity, index, cells): record the snapshot into all of the entity's
/// 3×3 cells (Frame.js:159).
#[inline]
#[allow(clippy::too_many_arguments)]
pub(crate) fn add_to_grid(
    grid: &mut HistGrid,
    touched: &mut Vec<i64>,
    snaps: &mut Vec<SnapNode>,
    cells: &[i64; 9],
    index: i32,
    px: f64,
    py: f64,
    vx: f64,
    vy: f64,
) {
    let snap = Snap { px, py, vx, vy };
    for &cell in cells.iter() {
        add_to_cell(grid, touched, snaps, cell, index, snap);
    }
}

/// Frame.getIndexOfCollisionInCell (Frame.js:122): first node (ascending index)
/// any of whose entities collides with the line.
#[inline]
pub(crate) fn index_of_collision_in_cell(grid: &HistGrid, snaps: &[SnapNode], cell: i64, l: &Line) -> Option<i32> {
    let list = grid.get(&cell)?;
    for cf in list.iter() {
        if cf.any_collides(snaps, l) {
            return Some(cf.index);
        }
    }
    None
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
