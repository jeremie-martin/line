//! Lines — bit-faithful port of lr-core's:
//!   - lines/Line.js, SolidLine.js, AccLine.js (geometry, `collidesWith`)
//!   - grids/ClassicGrid.js cellLinesMap (the per-cell, id-descending line buckets)
//! `collide` (the forward-sim response) lives in the kernel; this owns the line
//! record, the `shouldCollide`/`collidesWith` predicate, and grid registration.

use crate::grid::{classic_cells, hash_int_pair, unhash_int_pair, FlatIntMap};

pub(crate) const MAX_FORCE_LENGTH: f64 = 10.0;
pub(crate) const ACC: f64 = 0.1;

/// Precomputed line geometry (matches SolidLine's cached fields).
#[derive(Clone)]
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
}

#[derive(Clone)]
pub(crate) struct GridLine {
    pub group: u8,
    pub line: Line,
}

pub(crate) fn build_line(id: i32, x1: f64, y1: f64, x2: f64, y2: f64, ty: i64, flags: i64) -> Line {
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
    Line {
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
        collidable: ty == 0 || ty == 1, // SCENERY(2) not collidable
    }
}

/// Cells a line rasterizes into, or empty for non-collidable lines.
pub(crate) fn line_cells(l: &Line) -> Vec<i64> {
    if l.collidable {
        classic_cells(l.p1x, l.p1y, l.vecx, l.vecy)
    } else {
        Vec::new()
    }
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

#[inline]
fn center_group(dx: i64, dy: i64) -> u8 {
    ((dx + 1) * 3 + (dy + 1)) as u8
}

#[inline]
fn insert_grid_line(bucket: &mut Vec<GridLine>, group: u8, l: &Line) {
    let id = l.id;
    let mut pos = bucket.len();
    for (idx, e) in bucket.iter().enumerate() {
        if e.group == group && e.line.id == id {
            return;
        }
        if pos == bucket.len() && (e.group > group || (e.group == group && e.line.id < id)) {
            pos = idx;
        }
    }
    bucket.insert(
        pos,
        GridLine {
            group,
            line: l.clone(),
        },
    );
}

/// ClassicGrid cellLinesMap.add, inverted for center-cell lookup: a line in
/// original cell C contributes to every entity center cell whose 3×3 neighborhood
/// contains C. Each center bucket is sorted by the original 3×3 cell order, then
/// by DESCENDING line id inside that cell, preserving getLinesNearEntity order.
pub(crate) fn push_line(grid: &mut FlatIntMap<Vec<GridLine>>, l: Line, cells: &[i64]) {
    for &cell in cells {
        let (cx, cy) = unhash_int_pair(cell);
        for dx in -1..=1 {
            for dy in -1..=1 {
                let center = hash_int_pair(cx - dx, cy - dy);
                let group = center_group(dx, dy);
                insert_grid_line(grid.get_or_insert_default(center), group, &l);
            }
        }
    }
}

/// ClassicGrid cellLinesMap.remove for the expanded center-cell buckets.
pub(crate) fn remove_line(grid: &mut FlatIntMap<Vec<GridLine>>, id: i32, cells: &[i64]) {
    for &cell in cells {
        let (cx, cy) = unhash_int_pair(cell);
        for dx in -1..=1 {
            for dy in -1..=1 {
                let center = hash_int_pair(cx - dx, cy - dy);
                let group = center_group(dx, dy);
                if let Some(bucket) = grid.get_mut(&center) {
                    bucket.retain(|e| !(e.line.id == id && e.group == group));
                    if bucket.is_empty() {
                        grid.remove(&center);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_line(id: i32) -> Line {
        build_line(id, 0.0, 0.0, 14.0, 1.0, 0, 0)
    }

    #[test]
    fn push_line_orders_each_cell_by_descending_line_id() {
        let mut grid = FlatIntMap::default();
        let cell = 42;
        push_line(&mut grid, test_line(10), &[cell]);
        push_line(&mut grid, test_line(30), &[cell]);
        push_line(&mut grid, test_line(20), &[cell]);
        let ids: Vec<i32> = grid.get(&cell).unwrap().iter().map(|e| e.line.id).collect();
        assert_eq!(ids, vec![30, 20, 10]);
    }

    #[test]
    fn push_line_keeps_one_entry_per_line_id_per_cell() {
        let mut grid = FlatIntMap::default();
        let cell = 42;
        push_line(&mut grid, test_line(10), &[cell, cell]);
        let ids: Vec<i32> = grid.get(&cell).unwrap().iter().map(|e| e.line.id).collect();
        assert_eq!(ids, vec![10]);
    }

    #[test]
    fn push_line_preserves_3x3_query_order_and_duplicates() {
        let mut grid = FlatIntMap::default();
        let center = hash_int_pair(0, 0);
        let group0 = hash_int_pair(-1, -1);
        let group1 = hash_int_pair(-1, 0);
        push_line(&mut grid, test_line(20), &[group0]);
        push_line(&mut grid, test_line(10), &[group1]);
        push_line(&mut grid, test_line(30), &[group0, group1]);
        let got: Vec<(u8, i32)> = grid
            .get(&center)
            .unwrap()
            .iter()
            .map(|e| (e.group, e.line.id))
            .collect();
        assert_eq!(got, vec![(0, 30), (0, 20), (1, 30), (1, 10)]);
    }

    #[test]
    fn remove_line_drops_id_and_empties_cell() {
        let mut grid = FlatIntMap::default();
        let cell = 42;
        push_line(&mut grid, test_line(10), &[cell]);
        push_line(&mut grid, test_line(20), &[cell]);
        remove_line(&mut grid, 10, &[cell]);
        assert_eq!(
            grid.get(&cell)
                .unwrap()
                .iter()
                .map(|e| e.line.id)
                .collect::<Vec<_>>(),
            vec![20]
        );
        remove_line(&mut grid, 20, &[cell]);
        assert!(grid.get(&cell).is_none());
    }
}
