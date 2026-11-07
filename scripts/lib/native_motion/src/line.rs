//! Lines — bit-faithful port of lr-core's:
//!   - lines/Line.js, SolidLine.js, AccLine.js (geometry, `collidesWith`)
//!   - grids/ClassicGrid.js cellLinesMap (the per-cell, id-descending line buckets)
//! `collide` (the forward-sim response) lives in the kernel; this owns the line
//! record, the `shouldCollide`/`collidesWith` predicate, and grid registration.

use std::rc::Rc;

use crate::grid::{append_classic_cells, hash_int_pair, LineGrid};

pub(crate) const MAX_FORCE_LENGTH: f64 = 10.0;
pub(crate) const ACC: f64 = 0.1;

/// A point stays within POINT_MARGIN on each axis of where its near lines were
/// chosen. That moves it at most √2 × POINT_MARGIN in any direction; LINE_REACH
/// leaves the rest for rounding, which is far smaller at the distances may_reach
/// accepts.
pub(crate) const POINT_MARGIN: f64 = 2.0;
const LINE_REACH: f64 = 3.0;
/// Beyond this distance from a line's origin, rounding is no longer negligible.
const CERTAIN_DISTANCE: f64 = 1e7;

/// Shared immutable geometry and its raster footprint, constructed once.
pub(crate) struct Line {
    pub id: i32,
    pub p1x: f64,
    pub p1y: f64,
    pub vecx: f64,
    pub vecy: f64,
    pub normx: f64,
    pub normy: f64,
    pub inv_len_sq: f64,
    pub left_bound: f64,
    pub right_bound: f64,
    pub is_acc: bool,
    pub accx: f64,
    pub accy: f64,
    pub collidable: bool,
    /// LINE_REACH along the segment, in units of its length.
    along_reach: f64,
    cell_range: std::ops::Range<usize>,
}

impl Line {
    pub(crate) fn new(id: i32, x1: f64, y1: f64, x2: f64, y2: f64, ty: i64, flags: i64) -> Self {
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
        let normx = (-vecy) * (inv_length * flip_sign);
        let normy = (vecx) * (inv_length * flip_sign);
        let extension = (MAX_FORCE_LENGTH / length).min(0.25);
        let left_bound = if left_ext { -extension } else { 0.0 };
        let right_bound = if right_ext { 1.0 + extension } else { 1.0 };
        let accx = (-normy) * (ACC * flip_sign);
        let accy = (normx) * (ACC * flip_sign);
        let collidable = ty == 0 || ty == 1;
        Self {
            id,
            p1x: x1,
            p1y: y1,
            vecx,
            vecy,
            normx,
            normy,
            inv_len_sq,
            left_bound,
            right_bound,
            is_acc,
            accx,
            accy,
            collidable,
            along_reach: LINE_REACH * inv_length,
            cell_range: 0..0,
        }
    }
}

/// A line reference keeps its immutable batch alive. Geometry is contiguous;
/// grid edits and detached caches clone ownership, never the line payloads.
/// The id is copied here because bucket searches read nothing else.
#[derive(Clone)]
pub(crate) struct LineRef {
    pub id: i32,
    batch: Rc<LineBatch>,
    index: usize,
}

struct LineBatch {
    lines: Vec<Line>,
    cells: Vec<(i64, i64)>,
}

impl LineRef {
    pub(crate) fn batch(mut lines: Vec<Line>) -> Vec<Self> {
        let mut cells = Vec::new();
        for line in &mut lines {
            let start = cells.len();
            if line.collidable {
                append_classic_cells(line.p1x, line.p1y, line.vecx, line.vecy, &mut cells);
            }
            line.cell_range = start..cells.len();
        }
        let batch = Rc::new(LineBatch { lines, cells });
        (0..batch.lines.len()).map(|index| Self { id: batch.lines[index].id, batch: batch.clone(), index }).collect()
    }

    pub(crate) fn cells(&self) -> &[(i64, i64)] {
        &self.batch.cells[self.cell_range.clone()]
    }
}

impl std::ops::Deref for LineRef {
    type Target = Line;
    #[inline]
    fn deref(&self) -> &Line { &self.batch.lines[self.index] }
}

#[cfg(test)]
pub(crate) fn build_line(id: i32, x1: f64, y1: f64, x2: f64, y2: f64, ty: i64, flags: i64) -> LineRef {
    LineRef::batch(vec![Line::new(id, x1, y1, x2, y2, ty, flags)]).pop().unwrap()
}

/// SolidLine.collidesWith / `shouldCollide` — the predicate (reads only pos+vel),
/// used both by the forward-sim collision and by the addLine invalidation scan.
#[inline]
pub(crate) fn collides_with(l: &Line, px: f64, py: f64, vx: f64, vy: f64) -> bool {
    let ox = px - l.p1x;
    let oy = py - l.p1y;
    let perp = l.normx * ox + l.normy * oy;
    let line_pos = (l.vecx * ox + l.vecy * oy) * l.inv_len_sq;
    let dir = l.normx * vx + l.normy * vy;
    dir > 0.0
        && perp > 0.0
        && perp < MAX_FORCE_LENGTH
        && line_pos >= l.left_bound
        && line_pos <= l.right_bound
}

/// False only when no position within POINT_MARGIN of (px, py) can satisfy the
/// position tests of `collides_with`. Nonfinite values stay in reach.
#[inline]
pub(crate) fn may_reach(l: &Line, px: f64, py: f64) -> bool {
    let ox = px - l.p1x;
    let oy = py - l.p1y;
    if !(ox.abs() < CERTAIN_DISTANCE && oy.abs() < CERTAIN_DISTANCE) { return true; }
    let perp = l.normx * ox + l.normy * oy;
    let line_pos = (l.vecx * ox + l.vecy * oy) * l.inv_len_sq;
    !(perp <= -LINE_REACH || perp >= MAX_FORCE_LENGTH + LINE_REACH
        || line_pos < l.left_bound - l.along_reach || line_pos > l.right_bound + l.along_reach)
}

// Original raster cells keep line ids in descending order. Neighborhood
// expansion happens on a cached read, rather than nine times on every edit.
#[inline]
fn bucket_position(bucket: &[LineRef], id: i32) -> (usize, bool) {
    let pos = bucket.partition_point(|e| e.id > id);
    (pos, pos < bucket.len() && bucket[pos].id == id)
}

pub(crate) fn push_line(grid: &mut LineGrid, line: &LineRef, cells: &[(i64, i64)]) {
    for &(cx, cy) in cells {
        let bucket = grid.get_or_insert(hash_int_pair(cx, cy));
        let (pos, found) = bucket_position(bucket, line.id);
        if !found {
            bucket.insert(pos, line.clone());
        }
    }
}

pub(crate) fn remove_line(grid: &mut LineGrid, id: i32, cells: &[(i64, i64)]) {
    for &(cx, cy) in cells {
        let key = hash_int_pair(cx, cy);
        if let Some(bucket) = grid.get_mut(&key) {
            let (pos, found) = bucket_position(bucket, id);
            if found { bucket.remove(pos); }
            if bucket.is_empty() { grid.remove_empty(&key); }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retired_slots_reuse_buffers_without_retaining_line_owners() {
        let mut grid = LineGrid::default();
        let cell = (0, 0);
        let key = hash_int_pair(cell.0, cell.1);
        let line = test_line(7);
        let owner = Rc::downgrade(&line.batch);
        push_line(&mut grid, &line, &[cell]);
        let buffer = grid.get(&key).unwrap().as_ptr();
        let capacity = grid.get(&key).unwrap().capacity();
        remove_line(&mut grid, 7, &[cell]);
        assert!(grid.get(&key).is_none(), "a retired bucket is invisible to queries");
        drop(line);
        assert!(owner.upgrade().is_none(), "spare capacity keeps no geometry alive");
        let mut clone = grid.clone();
        assert_eq!(clone.get_or_insert(key).capacity(), 0, "clones do not copy spare allocations");
        push_line(&mut grid, &test_line(8), &[cell]);
        assert_eq!(grid.get(&key).unwrap().as_ptr(), buffer);
        assert_eq!(grid.get(&key).unwrap().capacity(), capacity);
        assert_eq!(grid.get(&key).unwrap()[0].id, 8);
        assert!(clone.get(&key).unwrap().is_empty(), "clones own independent buckets");
        // Rehashing after recycling preserves the surviving entry and its owner.
        for x in 1..1000 { push_line(&mut grid, &test_line(x as i32 + 10), &[(x, 0)]); }
        assert_eq!(grid.get(&key).unwrap()[0].id, 8);
    }

    #[test]
    fn grid_and_surviving_entries_own_their_batch_after_other_references_drop() {
        let mut batch = LineRef::batch(vec![
            Line::new(1, 0.0, 0.0, 14.0, 0.0, 0, 0),
            Line::new(2, 0.0, 2.0, 14.0, 2.0, 0, 0),
        ]);
        let survivor = batch.pop().unwrap();
        let mut grid = LineGrid::default();
        push_line(&mut grid, &batch[0], &[(0, 0)]);
        drop(batch);
        assert!(collides_with(&survivor, 5.0, 3.0, 0.0, 1.0));
        assert!(collides_with(&grid.get(&hash_int_pair(0, 0)).unwrap()[0], 5.0, 1.0, 0.0, 1.0));
        remove_line(&mut grid, 1, &[(0, 0)]);
        assert!(collides_with(&survivor, 5.0, 3.0, 0.0, 1.0));
    }

    fn center_group(dx: i64, dy: i64) -> u8 { ((dx + 1) * 3 + dy + 1) as u8 }

    fn query(grid: &LineGrid, cx: i64, cy: i64) -> Vec<(u8, i32)> {
        let mut out = Vec::new();
        for dx in -1..=1 {
            for dy in -1..=1 {
                if let Some(bucket) = grid.get(&hash_int_pair(cx + dx, cy + dy)) {
                    out.extend(bucket.iter().map(|e| (center_group(dx, dy), e.id)));
                }
            }
        }
        out
    }

    fn test_line(id: i32) -> LineRef {
        build_line(id, 0.0, 0.0, 14.0, 1.0, 0, 0)
    }

    #[test]
    fn push_line_orders_each_cell_by_descending_line_id() {
        let mut grid = LineGrid::default();
        let cell = (3, 5);
        let key = hash_int_pair(cell.0, cell.1); // the original raster cell
        push_line(&mut grid, &test_line(10), &[cell]);
        push_line(&mut grid, &test_line(30), &[cell]);
        push_line(&mut grid, &test_line(20), &[cell]);
        let ids: Vec<i32> = grid.get(&key).unwrap().iter().map(|e| e.id).collect();
        assert_eq!(ids, vec![30, 20, 10]);
    }

    #[test]
    fn push_line_keeps_one_entry_per_line_id_per_cell() {
        let mut grid = LineGrid::default();
        let cell = (3, 5);
        let key = hash_int_pair(cell.0, cell.1);
        push_line(&mut grid, &test_line(10), &[cell, cell]);
        let ids: Vec<i32> = grid.get(&key).unwrap().iter().map(|e| e.id).collect();
        assert_eq!(ids, vec![10]);
    }

    #[test]
    fn push_line_preserves_3x3_query_order_and_duplicates() {
        let mut grid = LineGrid::default();
        let cell0 = (-1, -1);
        let cell1 = (-1, 0);
        push_line(&mut grid, &test_line(20), &[cell0]);
        push_line(&mut grid, &test_line(10), &[cell1]);
        push_line(&mut grid, &test_line(30), &[cell0, cell1]);
        let got = query(&grid, 0, 0);
        assert_eq!(got, vec![(0, 30), (0, 20), (1, 30), (1, 10)]);
    }

    #[test]
    fn remove_line_drops_id_and_empties_cell() {
        let mut grid = LineGrid::default();
        let cell = (3, 5);
        let key = hash_int_pair(cell.0, cell.1);
        push_line(&mut grid, &test_line(10), &[cell]);
        push_line(&mut grid, &test_line(20), &[cell]);
        remove_line(&mut grid, 10, &[cell]);
        assert_eq!(
            grid.get(&key)
                .unwrap()
                .iter()
                .map(|e| e.id)
                .collect::<Vec<_>>(),
            vec![20]
        );
        remove_line(&mut grid, 20, &[cell]);
        assert!(grid.get(&key).is_none());
    }

    /// The linear scans the binary searches replaced.
    fn reference_insert(bucket: &mut Vec<(u8, i32)>, group: u8, id: i32) {
        let mut pos = bucket.len();
        for (idx, &(g, i)) in bucket.iter().enumerate() {
            if g == group && i == id {
                return;
            }
            if pos == bucket.len() && (g > group || (g == group && i < id)) {
                pos = idx;
            }
        }
        bucket.insert(pos, (group, id));
    }

    #[test]
    fn bucket_search_matches_linear_scan_under_churn() {
        let mut grid = LineGrid::default();
        let mut reference: std::collections::HashMap<i64, Vec<(u8, i32)>> = Default::default();
        let mut live: Vec<(i32, Vec<(i64, i64)>)> = Vec::new();
        let mut seed = 0x2545F4914F6CDD1Du64;
        let mut next = |n: u64| {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            seed % n
        };
        for step in 0..4000 {
            if live.is_empty() || next(3) > 0 {
                let id = next(400) as i32;
                let cells: Vec<(i64, i64)> = (0..1 + next(3)).map(|_| (next(5) as i64 - 2, next(5) as i64 - 2)).collect();
                push_line(&mut grid, &test_line(id), &cells);
                for &(cx, cy) in &cells {
                    for dx in -1..=1 {
                        for dy in -1..=1 {
                            let bucket = reference.entry(hash_int_pair(cx - dx, cy - dy)).or_default();
                            reference_insert(bucket, center_group(dx, dy), id);
                        }
                    }
                }
                live.push((id, cells));
            } else {
                let (id, cells) = live.remove(next(live.len() as u64) as usize);
                remove_line(&mut grid, id, &cells);
                for &(cx, cy) in &cells {
                    for dx in -1..=1 {
                        for dy in -1..=1 {
                            let key = hash_int_pair(cx - dx, cy - dy);
                            let group = center_group(dx, dy);
                            if let Some(bucket) = reference.get_mut(&key) {
                                bucket.retain(|&(g, i)| !(i == id && g == group));
                                if bucket.is_empty() {
                                    reference.remove(&key);
                                }
                            }
                        }
                    }
                }
            }
            if step % 50 == 0 {
                for (key, expected) in &reference {
                    let (cx, cy) = crate::grid::unhash_int_pair(*key);
                    let got = query(&grid, cx, cy);
                    assert_eq!(&got, expected);
                }
                for x in -4..=4 {
                    for y in -4..=4 {
                        let key = hash_int_pair(x, y);
                        assert_eq!(!query(&grid, x, y).is_empty(), reference.contains_key(&key));
                    }
                }
            }
        }
    }
}
