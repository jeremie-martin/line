//! Spatial-grid geometry — bit-faithful port of lr-core's:
//!   - utils/hashNumberPair.js  (`hashIntPair`, Szudzik pair → signed fold)
//!   - grids/getCellsFromLine.js (`classicCells` DDA float walk)
//!   - grids/ClassicGrid.js `getCellsNearEntity` (the 3×3 neighborhood)
//! Pure functions of geometry; no engine state. 14px cells.

use std::collections::HashMap;
use std::hash::{BuildHasher, Hasher};

pub(crate) const GRID_SIZE: f64 = 14.0;

pub(crate) type IntMap<K, V> = HashMap<K, V, IntBuildHasher>;

pub(crate) struct FlatIntMap<V> {
    keys: Vec<i64>,
    values: Vec<Option<V>>,
    states: Vec<u8>, // 0 empty, 1 occupied, 2 tombstone
    len: usize,
    used: usize,
}

impl<V> Default for FlatIntMap<V> {
    fn default() -> FlatIntMap<V> {
        FlatIntMap {
            keys: Vec::new(),
            values: Vec::new(),
            states: Vec::new(),
            len: 0,
            used: 0,
        }
    }
}

impl<V> FlatIntMap<V> {
    #[inline]
    fn hash(key: i64) -> usize {
        let mut x = key as u64;
        x ^= x >> 33;
        x = x.wrapping_mul(0xff51afd7ed558ccd);
        x ^= x >> 33;
        x = x.wrapping_mul(0xc4ceb9fe1a85ec53);
        (x ^ (x >> 33)) as usize
    }

    fn resize(&mut self, new_cap: usize) {
        let cap = new_cap.next_power_of_two().max(16);
        let old_keys = std::mem::replace(&mut self.keys, vec![0; cap]);
        let old_values = std::mem::replace(&mut self.values, (0..cap).map(|_| None).collect());
        let old_states = std::mem::replace(&mut self.states, vec![0; cap]);
        self.len = 0;
        self.used = 0;
        for ((key, value), state) in old_keys
            .into_iter()
            .zip(old_values.into_iter())
            .zip(old_states.into_iter())
        {
            if state == 1 {
                self.insert(key, value.unwrap());
            }
        }
    }

    #[inline]
    fn ensure_insert_capacity(&mut self) {
        if self.states.is_empty() || (self.used + 1) * 10 >= self.states.len() * 7 {
            self.resize((self.len + 1) * 2);
        }
    }

    #[inline]
    fn find(&self, key: i64) -> Option<usize> {
        if self.states.is_empty() {
            return None;
        }
        let mask = self.states.len() - 1;
        let mut i = Self::hash(key) & mask;
        loop {
            match self.states[i] {
                0 => return None,
                1 if self.keys[i] == key => return Some(i),
                _ => i = (i + 1) & mask,
            }
        }
    }

    fn find_insert_slot(&self, key: i64) -> Result<usize, usize> {
        let mask = self.states.len() - 1;
        let mut i = Self::hash(key) & mask;
        let mut first_tombstone = usize::MAX;
        loop {
            match self.states[i] {
                0 => {
                    return Err(if first_tombstone != usize::MAX {
                        first_tombstone
                    } else {
                        i
                    })
                }
                1 if self.keys[i] == key => return Ok(i),
                2 if first_tombstone == usize::MAX => first_tombstone = i,
                _ => {}
            }
            i = (i + 1) & mask;
        }
    }

    #[inline]
    pub(crate) fn get(&self, key: &i64) -> Option<&V> {
        self.find(*key).and_then(|i| self.values[i].as_ref())
    }

    #[inline]
    pub(crate) fn get_mut(&mut self, key: &i64) -> Option<&mut V> {
        let i = self.find(*key)?;
        self.values[i].as_mut()
    }

    pub(crate) fn get_or_insert_default(&mut self, key: i64) -> &mut V
    where
        V: Default,
    {
        self.ensure_insert_capacity();
        match self.find_insert_slot(key) {
            Ok(i) => self.values[i].as_mut().unwrap(),
            Err(i) => {
                if self.states[i] == 0 {
                    self.used += 1;
                }
                self.states[i] = 1;
                self.keys[i] = key;
                self.values[i] = Some(V::default());
                self.len += 1;
                self.values[i].as_mut().unwrap()
            }
        }
    }

    pub(crate) fn insert(&mut self, key: i64, value: V) -> Option<V> {
        self.ensure_insert_capacity();
        match self.find_insert_slot(key) {
            Ok(i) => self.values[i].replace(value),
            Err(i) => {
                if self.states[i] == 0 {
                    self.used += 1;
                }
                self.states[i] = 1;
                self.keys[i] = key;
                self.values[i] = Some(value);
                self.len += 1;
                None
            }
        }
    }

    pub(crate) fn remove(&mut self, key: &i64) -> Option<V> {
        let i = self.find(*key)?;
        self.states[i] = 2;
        self.len -= 1;
        self.values[i].take()
    }
}

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
        // The integer write_* paths fold a key in verbatim (identity). hashbrown
        // (SwissTable) derives the home bucket from the low bits AND a 7-bit control
        // tag from the TOP 7 bits of the hash. The hist/coll/lines_cells keys are
        // small-magnitude Szudzik cell ids / small line ids, so identity leaves the
        // top bits ~all zero — every key collides on the control tag, defeating the
        // SIMD tag filter. Multiply by the golden-ratio odd constant (bijective on
        // u64, so no new key collisions) to spread entropy into both the tag and
        // bucket bits. Probe-order only; never affects key→value mapping or output.
        // (cell_lines uses FlatIntMap, not this hasher.)
        self.state.wrapping_mul(0x9E3779B97F4A7C15)
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
    let c = if aa >= bb {
        aa * aa + aa + bb
    } else {
        bb * bb + aa
    };
    if c & 1 != 0 {
        -(c - 1) / 2 - 1
    } else {
        c / 2
    }
}

// Retained as the inverse of hash_int_pair for the round-trip property test; the hot
// paths now carry cell coords directly (classic_cells emits them) so no production
// code unhashes a stored cell any more.
#[allow(dead_code)]
pub(crate) fn unhash_int_pair(n: i64) -> (i64, i64) {
    let c = if n >= 0 { n * 2 } else { -(n + 1) * 2 + 1 };
    let x = (c as f64).sqrt() as i64;
    let r = c - x * x;
    let (aa, bb) = if r < x { (r, x) } else { (x, r - x) };
    let a = if aa & 1 != 0 { -(aa + 1) / 2 } else { aa / 2 };
    let b = if bb & 1 != 0 { -(bb + 1) / 2 } else { bb / 2 };
    (a, b)
}

#[inline]
pub(crate) fn cell_cor(x: f64) -> i64 {
    (x / GRID_SIZE).floor() as i64
}

#[inline]
pub(crate) fn cell_hash(px: f64, py: f64) -> i64 {
    hash_int_pair(cell_cor(px), cell_cor(py))
}

/// getCellsFromLine.js classicCells — the faithful float walk producing the integer
/// cell coords a line rasterizes into, in walk order. `(p1x,p1y)`→`(p1x+vecx,p1y+vecy)`.
/// Returns `(cx, cy)` pairs (not the Szudzik hash): every consumer immediately needs
/// the coords to enumerate the line's inverse-3×3 neighborhood, and emitting them
/// here avoids an `unhash_int_pair` (a sqrt) per stored cell downstream.
pub(crate) fn classic_cells(p1x: f64, p1y: f64, vecx: f64, vecy: f64) -> Vec<(i64, i64)> {
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

    let mut cells = vec![(cs_x, cs_y)];
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
            cells.push((nc_x, nc_y));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_int_pair_round_trips_grid_coords() {
        for x in -32..=32 {
            for y in -32..=32 {
                assert_eq!(unhash_int_pair(hash_int_pair(x, y)), (x, y));
            }
        }
    }
}
