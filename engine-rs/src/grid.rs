//! Spatial-grid geometry — bit-faithful port of lr-core's:
//!   - utils/hashNumberPair.js  (`hashIntPair`, Szudzik pair → signed fold)
//!   - grids/getCellsFromLine.js (`classicCells` DDA float walk)
//!   - grids/ClassicGrid.js `getCellsNearEntity` (the 3×3 neighborhood)
//! Pure functions of geometry; no engine state. 14px cells.

use std::collections::HashMap;
use std::hash::{BuildHasher, Hasher};

pub(crate) const GRID_SIZE: f64 = 14.0;

pub(crate) type IntMap<K, V> = HashMap<K, V, IntBuildHasher>;

#[derive(Clone, Copy, Default)]
pub(crate) struct IntBuildHasher;

#[derive(Default)]
pub(crate) struct IntHasher {
    state: u64,
}

impl BuildHasher for IntBuildHasher {
    type Hasher = IntHasher;

    #[inline]
    fn build_hasher(&self) -> IntHasher {
        IntHasher { state: 0 }
    }
}

impl Hasher for IntHasher {
    #[inline]
    fn finish(&self) -> u64 {
        self.state
    }

    #[inline]
    fn write(&mut self, bytes: &[u8]) {
        let mut h = 0xcbf29ce484222325u64;
        for &b in bytes {
            h ^= b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
        self.state = h;
    }

    #[inline]
    fn write_i32(&mut self, i: i32) {
        self.state = i as u32 as u64;
    }

    #[inline]
    fn write_u32(&mut self, i: u32) {
        self.state = i as u64;
    }

    #[inline]
    fn write_i64(&mut self, i: i64) {
        self.state = i as u64;
    }

    #[inline]
    fn write_u64(&mut self, i: u64) {
        self.state = i;
    }
}

/// hashNumberPair.js: encode each coord (Szudzik), pair, then fold to a signed
/// int. Used verbatim for cell keys; must be exact for negative coords.
#[inline]
pub(crate) fn hash_int_pair(a: i64, b: i64) -> i64 {
    let aa = if a >= 0 { 2 * a } else { -2 * a - 1 };
    let bb = if b >= 0 { 2 * b } else { -2 * b - 1 };
    let c = if aa >= bb { aa * aa + aa + bb } else { bb * bb + aa };
    if c & 1 != 0 { -(c - 1) / 2 - 1 } else { c / 2 }
}

#[inline]
pub(crate) fn cell_cor(x: f64) -> i64 {
    (x / GRID_SIZE).floor() as i64
}

/// ClassicGrid.getCellsNearEntity: the 3×3 cell hashes around the entity's cell,
/// in lr-core's exact emission order (x0y0,x0y1,x0y2,x1y0,x1y1,x1y2,x2y0,x2y1,x2y2).
/// Shared by addToGrid (history recording) and the collision line lookup.
#[inline]
pub(crate) fn cells_near_entity(px: f64, py: f64) -> [i64; 9] {
    let gx = cell_cor(px);
    let gy = cell_cor(py);
    [
        hash_int_pair(gx - 1, gy - 1),
        hash_int_pair(gx - 1, gy),
        hash_int_pair(gx - 1, gy + 1),
        hash_int_pair(gx, gy - 1),
        hash_int_pair(gx, gy),
        hash_int_pair(gx, gy + 1),
        hash_int_pair(gx + 1, gy - 1),
        hash_int_pair(gx + 1, gy),
        hash_int_pair(gx + 1, gy + 1),
    ]
}

/// getCellsFromLine.js classicCells — the faithful float walk producing the cell
/// hashes a line rasterizes into, in walk order. `(p1x,p1y)`→`(p1x+vecx,p1y+vecy)`.
pub(crate) fn classic_cells(p1x: f64, p1y: f64, vecx: f64, vecy: f64) -> Vec<i64> {
    let p2x = p1x + vecx;
    let p2y = p1y + vecy;
    let cs_x = cell_cor(p1x);
    let cs_y = cell_cor(p1y);
    let mut cur_x = cs_x;
    let mut cur_y = cs_y;
    let mut cur_gx = p1x - GRID_SIZE * cs_x as f64;
    let mut cur_gy = p1y - GRID_SIZE * cs_y as f64;
    let ce_x = cell_cor(p2x);
    let ce_y = cell_cor(p2y);

    let mut cells = vec![hash_int_pair(cs_x, cs_y)];
    if (vecx == 0.0 && vecy == 0.0) || (cs_x == ce_x && cs_y == ce_y) {
        return cells;
    }
    let box_left = cs_x.min(ce_x);
    let box_right = cs_x.max(ce_x);
    let box_top = cs_y.min(ce_y);
    let box_bottom = cs_y.max(ce_y);

    let mut posx = p1x;
    let mut posy = p1y;
    loop {
        let dx;
        let dy;
        if cur_x < 0 {
            dx = (GRID_SIZE + cur_gx) * (if vecx > 0.0 { 1.0 } else { -1.0 });
        } else {
            dx = -cur_gx + (if vecx > 0.0 { GRID_SIZE } else { -1.0 });
        }
        if cur_y < 0 {
            dy = (GRID_SIZE + cur_gy) * (if vecy > 0.0 { 1.0 } else { -1.0 });
        } else {
            dy = -cur_gy + (if vecy > 0.0 { GRID_SIZE } else { -1.0 });
        }
        let (nposx, nposy) = if vecx == 0.0 {
            (posx, posy + dy)
        } else if vecy == 0.0 {
            (posx + dx, posy)
        } else {
            let slope = vecy / vecx;
            let y_next = posy + slope * dx;
            if (y_next - posy).abs() < dy.abs() {
                (posx + dx, y_next)
            } else if (y_next - posy).abs() == dy.abs() {
                (posx + dx, posy + dy)
            } else {
                (posx + vecx * dy / vecy, posy + dy)
            }
        };
        let nc_x = cell_cor(nposx);
        let nc_y = cell_cor(nposy);
        if nc_x >= box_left && nc_x <= box_right && nc_y >= box_top && nc_y <= box_bottom {
            cells.push(hash_int_pair(nc_x, nc_y));
            cur_x = nc_x;
            cur_y = nc_y;
            cur_gx = nposx - GRID_SIZE * nc_x as f64;
            cur_gy = nposy - GRID_SIZE * nc_y as f64;
            posx = nposx;
            posy = nposy;
        } else {
            break;
        }
    }
    cells
}
