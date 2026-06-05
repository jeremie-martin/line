//! Spatial-grid geometry — bit-faithful port of lr-core's:
//!   - utils/hashNumberPair.js  (`hashIntPair`, Szudzik pair → signed fold)
//!   - grids/getCellsFromLine.js (`classicCells` DDA float walk)
//!   - grids/ClassicGrid.js `getCellsNearEntity` (the 3×3 neighborhood)
//! Pure functions of geometry; no engine state. 14px cells.

use std::marker::PhantomData;
use std::ops::Index;

pub(crate) const GRID_SIZE: f64 = 14.0;

pub(crate) trait IntKey: Copy {
    fn into_key(self) -> u64;
}

impl IntKey for i64 {
    #[inline]
    fn into_key(self) -> u64 {
        self as u64
    }
}

impl IntKey for i32 {
    #[inline]
    fn into_key(self) -> u64 {
        self as u32 as u64
    }
}

enum Bucket<V> {
    Empty,
    Deleted,
    Full { key: u64, value: V },
}

/// Small integer-key map for the WASM engine's grids. `std::HashMap` is general
/// and hashbrown-heavy; these maps only need exact-key lookup/update/remove, no
/// iteration and no randomized hashing.
pub(crate) struct IntMap<K: IntKey, V> {
    buckets: Vec<Bucket<V>>,
    len: usize,
    deleted: usize,
    _key: PhantomData<K>,
}

impl<K: IntKey, V> Default for IntMap<K, V> {
    fn default() -> Self {
        IntMap { buckets: Vec::new(), len: 0, deleted: 0, _key: PhantomData }
    }
}

impl<K: IntKey, V> IntMap<K, V> {
    #[inline]
    fn hash(key: u64) -> usize {
        ((key ^ (key >> 32)) as usize).wrapping_mul(0x9e3779b1usize)
    }

    fn empty_buckets(cap: usize) -> Vec<Bucket<V>> {
        let mut buckets = Vec::with_capacity(cap);
        buckets.resize_with(cap, || Bucket::Empty);
        buckets
    }

    #[inline]
    fn find_slot(&self, key: u64) -> Result<usize, usize> {
        if self.buckets.is_empty() {
            return Err(usize::MAX);
        }
        let mask = self.buckets.len() - 1;
        let mut i = Self::hash(key) & mask;
        let mut first_deleted = usize::MAX;
        loop {
            match &self.buckets[i] {
                Bucket::Empty => return Err(if first_deleted == usize::MAX { i } else { first_deleted }),
                Bucket::Deleted => {
                    if first_deleted == usize::MAX {
                        first_deleted = i;
                    }
                }
                Bucket::Full { key: k, .. } if *k == key => return Ok(i),
                Bucket::Full { .. } => {}
            }
            i = (i + 1) & mask;
        }
    }

    #[inline]
    fn should_grow(&self) -> bool {
        self.buckets.is_empty() || (self.len + self.deleted + 1) * 4 >= self.buckets.len() * 3
    }

    fn grow(&mut self) {
        let new_cap = if self.buckets.is_empty() { 16 } else { self.buckets.len() * 2 };
        let old = std::mem::replace(&mut self.buckets, Self::empty_buckets(new_cap));
        self.len = 0;
        self.deleted = 0;
        for bucket in old {
            if let Bucket::Full { key, value } = bucket {
                self.insert_raw(key, value);
            }
        }
    }

    fn insert_raw(&mut self, key: u64, value: V) {
        let idx = match self.find_slot(key) {
            Ok(idx) | Err(idx) => idx,
        };
        self.buckets[idx] = Bucket::Full { key, value };
        self.len += 1;
    }

    #[inline]
    pub(crate) fn get(&self, key: &K) -> Option<&V> {
        match self.find_slot((*key).into_key()) {
            Ok(idx) => match &self.buckets[idx] {
                Bucket::Full { value, .. } => Some(value),
                _ => None,
            },
            Err(_) => None,
        }
    }

    #[inline]
    pub(crate) fn get_mut(&mut self, key: &K) -> Option<&mut V> {
        match self.find_slot((*key).into_key()) {
            Ok(idx) => match &mut self.buckets[idx] {
                Bucket::Full { value, .. } => Some(value),
                _ => None,
            },
            Err(_) => None,
        }
    }

    pub(crate) fn insert(&mut self, key: K, value: V) -> Option<V> {
        if self.should_grow() {
            self.grow();
        }
        let key = key.into_key();
        match self.find_slot(key) {
            Ok(idx) => match std::mem::replace(&mut self.buckets[idx], Bucket::Full { key, value }) {
                Bucket::Full { value: old, .. } => Some(old),
                _ => None,
            },
            Err(idx) => {
                if matches!(self.buckets[idx], Bucket::Deleted) {
                    self.deleted -= 1;
                }
                self.buckets[idx] = Bucket::Full { key, value };
                self.len += 1;
                None
            }
        }
    }

    pub(crate) fn get_or_default(&mut self, key: K) -> &mut V where V: Default {
        if self.should_grow() {
            self.grow();
        }
        let key = key.into_key();
        let idx = match self.find_slot(key) {
            Ok(idx) => idx,
            Err(idx) => {
                if matches!(self.buckets[idx], Bucket::Deleted) {
                    self.deleted -= 1;
                }
                self.buckets[idx] = Bucket::Full { key, value: V::default() };
                self.len += 1;
                idx
            }
        };
        match &mut self.buckets[idx] {
            Bucket::Full { value, .. } => value,
            _ => unreachable!(),
        }
    }

    pub(crate) fn remove(&mut self, key: &K) -> Option<V> {
        let idx = self.find_slot((*key).into_key()).ok()?;
        let old = std::mem::replace(&mut self.buckets[idx], Bucket::Deleted);
        if let Bucket::Full { value, .. } = old {
            self.len -= 1;
            self.deleted += 1;
            Some(value)
        } else {
            None
        }
    }

    pub(crate) fn clear(&mut self) {
        for bucket in self.buckets.iter_mut() {
            *bucket = Bucket::Empty;
        }
        self.len = 0;
        self.deleted = 0;
    }

    #[cfg(test)]
    pub(crate) fn contains_key(&self, key: &K) -> bool {
        self.get(key).is_some()
    }
}

impl<K: IntKey, V> Index<&K> for IntMap<K, V> {
    type Output = V;

    fn index(&self, index: &K) -> &Self::Output {
        self.get(index).unwrap()
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
