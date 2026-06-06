//! Stateful engine — bit-faithful port of lr-core's LineEngine.js + the Immo
//! shared-cache model (immo/index.js). The load-bearing architecture:
//!
//! lr-core keeps ONE mutable `__computed__` cache per lineage (all versions derived
//! from one `new LineRiderEngine()` share it by reference). Every public read calls
//! `updateComputed()` first: if the cache isn't synced to the version being read, it
//! diffs that version's `linesList` against the cache's current lines
//! (`Immy.List.compareTo`) and replays `_addLine`/`_removeLine` to walk the cache
//! there — truncating the shared frame cache as it goes. The physics-frame budget
//! (`getLastFrameIndex` deltas) is therefore PATH-DEPENDENT on the search's read
//! order; reproducing it bit-for-bit requires reproducing this shared cache.
//!
//! We model each engine version as a node in a patch tree (Root / SetStart /
//! AddLine). `compareTo` for same-root lists is a walk of the patch chain, so
//! `update_computed(target)` = undo the current branch's AddLines back to the LCA
//! (`_removeLine`), then redo the target branch's (`_addLine`) — exactly the diff
//! lr-core applies. Forking is a cheap tree node; the heavy frame cache is shared.

use crate::frame::{
    index_of_collision_in_cell, index_of_collision_with_line, rollback_collisions, rollback_grid,
    ActiveCellCache, Collisions, HistGrid, SnapNode,
};
use crate::grid::{FlatIntMap, IntMap};
use crate::kernel::{compute_rest_endur, init_state, step_state, LineCellCache, State};
use crate::line::{build_line, line_cells, push_line, remove_line, GridLine, Line};
use crate::{
    BUTT, LFOOT, LHAND, NENT, NITER, NOSE, PEG, RFOOT, RHAND, RIDER_MOUNTED, SHOULDER, SLED_INTACT,
    STRING, TAIL,
};

// parts.BODY in lr-core order — the entities getRider averages (sum in this order
// then /6, matching Rider.getBody's averageVectors so the result is bit-identical).
const BODY: [usize; 6] = [BUTT, SHOULDER, RHAND, LHAND, LFOOT, RFOOT];
type Event = (u8, i32, i32);

// ── the single shared cache per lineage (LineEngine.__computed__ + Frame.grid/collisions) ──
struct Cache {
    rest: [f64; NITER],
    endur: [f64; NITER],
    cell_lines: FlatIntMap<Vec<GridLine>>, // ClassicGrid cellLinesMap (collision lookup)
    line_cache: LineCellCache,             // frame-local shortcut for repeated line-grid cells
    lines_cells: IntMap<i32, Vec<i64>>,    // ClassicGrid lineCellsMap (id → cells, for remove)
    frames: Vec<State>,                    // frames[0] = initial; lazily extended
    events: Vec<Event>,                    // flat per-frame collision records
    event_offsets: Vec<usize>,             // frame f => events[offset[f]..offset[f+1]]
    hist: HistGrid,                        // Frame.grid: collision-history for addLine invalidation
    touched_cells: Vec<i64>,               // flat per-frame reverse patch for hist rollback
    touched_cell_offsets: Vec<usize>,
    hist_snaps: Vec<SnapNode>, // extra same-cell/same-frame snapshots
    hist_snap_offsets: Vec<usize>,
    active_cells: ActiveCellCache, // frame-local shortcut for repeated history cells
    coll: Collisions,              // Frame.collisions: line id → frames (for removeLine)
    touched_lines: Vec<i32>,       // flat per-frame reverse patch for coll rollback
    touched_line_offsets: Vec<usize>,
    cur: State,      // == frames.last() when !cur_dirty; working state for stepping
    cur_dirty: bool, // set on truncation: `cur` is stale, resync from frames.last() before next step
}

impl Cache {
    fn new() -> Cache {
        let (rest, endur) = compute_rest_endur();
        let s = init_state(0.0, 0.0, 0.4, 0.0); // DEFAULT_START
        Cache {
            rest,
            endur,
            cell_lines: FlatIntMap::default(),
            line_cache: LineCellCache::default(),
            lines_cells: IntMap::default(),
            frames: vec![s.clone()],
            events: Vec::new(),
            event_offsets: vec![0, 0],
            hist: IntMap::default(),
            touched_cells: Vec::new(),
            touched_cell_offsets: vec![0, 0],
            hist_snaps: Vec::new(),
            hist_snap_offsets: vec![0, 0],
            active_cells: ActiveCellCache::default(),
            coll: IntMap::default(),
            touched_lines: Vec::new(),
            touched_line_offsets: vec![0, 0],
            cur: s,
            cur_dirty: false,
        }
    }

    fn last_frame_index(&self) -> i32 {
        (self.frames.len() - 1) as i32
    }

    /// _setFramesLength(len) — truncate to `len` frames, rolling the history grid +
    /// collisions back via their per-frame reverse patches. lr-core's
    /// `frames.length = index` would GROW the array if `index > length`; that never
    /// happens here (collision indices are recorded frames ≤ the last computed
    /// frame, and rollback drops their records in lockstep), so we only ever
    /// shrink. The debug_assert surfaces a future reconcile path that broke that
    /// invariant instead of silently diverging from JS. `len == 0` is unreachable
    /// (collision indices are ≥ 1) but guarded to avoid a `frames[len-1]` underflow.
    fn set_frames_length(&mut self, len: usize) {
        debug_assert!(
            len <= self.frames.len(),
            "set_frames_length would grow the cache (diverges from lr-core)"
        );
        if len == 0 || len >= self.frames.len() {
            return;
        }
        rollback_grid(
            &mut self.hist,
            &self.touched_cells,
            &self.touched_cell_offsets,
            len,
        );
        rollback_collisions(
            &mut self.coll,
            &self.touched_lines,
            &self.touched_line_offsets,
            len,
        );
        self.frames.truncate(len);
        self.events.truncate(self.event_offsets[len]);
        self.event_offsets.truncate(len + 1);
        self.touched_cells.truncate(self.touched_cell_offsets[len]);
        self.touched_cell_offsets.truncate(len + 1);
        self.hist_snaps.truncate(self.hist_snap_offsets[len]);
        self.hist_snap_offsets.truncate(len + 1);
        self.touched_lines.truncate(self.touched_line_offsets[len]);
        self.touched_line_offsets.truncate(len + 1);
        // Defer the `cur = frames[len-1].clone()` resync: a multi-line arc add
        // truncates many times in a row with no intervening step, so an eager clone
        // here is overwritten by the next truncation before it is ever stepped.
        // Mark stale instead; compute_to resyncs once, only when about to step.
        self.cur_dirty = true;
    }

    /// _addLine: register the line, then truncate the frame cache to its first
    /// collision frame per cell (in classicCells order; each truncation shortens
    /// the last frame the next cell scans — the running-minimum invalidation).
    fn add_line(&mut self, l: Line) {
        if !l.collidable {
            return; // grid.add returns [] for non-collidable: no registration, no invalidation
        }
        let cells = line_cells(&l);
        let id = l.id;
        // Invalidation reads only hist/hist_snaps (via index_of_collision_in_cell)
        // and set_frames_length touches only hist/coll/frames — both disjoint from
        // cell_lines/lines_cells. So we run the invalidation loop first (borrowing
        // &l), then move l into push_line and cells into lines_cells, avoiding the
        // line + cells-Vec clones the original eager registration required. The grid
        // registration order vs invalidation is immaterial (disjoint state).
        for &cell in cells.iter() {
            if let Some(idx) = index_of_collision_in_cell(
                &self.hist,
                &self.hist_snaps,
                cell,
                &l,
            ) {
                self.set_frames_length(idx as usize);
            }
        }
        push_line(&mut self.cell_lines, l, &cells);
        self.lines_cells.insert(id, cells);
    }

    /// _removeLine: unregister the line, truncate to its FIRST collision frame.
    fn remove_line(&mut self, id: i32) {
        if let Some(cells) = self.lines_cells.remove(&id) {
            remove_line(&mut self.cell_lines, id, &cells);
            if let Some(idx) = index_of_collision_with_line(&self.coll, id) {
                self.set_frames_length(idx as usize);
            }
        }
    }

    /// setInitialStates: reset the frame cache to a single frame with a new start
    /// (lines/grid preserved). lr-core: `_setFramesLength(1)` + `frames[0] = new`.
    fn set_initial_states(&mut self, px: f64, py: f64, vx: f64, vy: f64) {
        let s = init_state(px, py, vx, vy);
        self.hist.clear();
        self.coll.clear();
        self.frames.clear();
        self.frames.push(s.clone());
        self.events.clear();
        self.event_offsets.clear();
        self.event_offsets.extend_from_slice(&[0, 0]);
        self.touched_cells.clear();
        self.touched_cell_offsets.clear();
        self.touched_cell_offsets.extend_from_slice(&[0, 0]);
        self.hist_snaps.clear();
        self.hist_snap_offsets.clear();
        self.hist_snap_offsets.extend_from_slice(&[0, 0]);
        self.touched_lines.clear();
        self.touched_line_offsets.clear();
        self.touched_line_offsets.extend_from_slice(&[0, 0]);
        self.cur = s;
        self.cur_dirty = false;
    }

    /// _computeFrame: lazily extend the cache to include frame `frame`.
    fn compute_to(&mut self, frame: usize) {
        // Resync `cur` from the (possibly truncated) tail once, only when we are
        // actually about to step — see set_frames_length's deferred-resync note.
        if self.frames.len() <= frame && self.cur_dirty {
            self.cur = self.frames[self.frames.len() - 1].clone();
            self.cur_dirty = false;
        }
        while self.frames.len() <= frame {
            let fi = self.frames.len() as i32;
            step_state::<true>(
                &mut self.cur,
                &self.cell_lines,
                &self.rest,
                &self.endur,
                &mut self.events,
                fi,
                &mut self.hist,
                &mut self.touched_cells,
                &mut self.hist_snaps,
                &mut self.active_cells,
                &mut self.line_cache,
                &mut self.coll,
                &mut self.touched_lines,
            );
            self.frames.push(self.cur.clone());
            self.event_offsets.push(self.events.len());
            self.touched_cell_offsets.push(self.touched_cells.len());
            self.hist_snap_offsets.push(self.hist_snaps.len());
            self.touched_line_offsets.push(self.touched_lines.len());
        }
    }

    #[inline]
    fn events_at(&self, f: usize) -> &[Event] {
        &self.events[self.event_offsets[f]..self.event_offsets[f + 1]]
    }
}

// ── version tree (each engine handle is a node) + per-lineage holder ──
enum Patch {
    Root,
    SetStart,
    AddLine(Line),
}

struct Version {
    holder: u32,
    parent: i32, // -1 for root
    depth: u32,
    patch: Patch,
    start: [f64; 4],
    start_gen: u32, // initialStateMap identity (bumped on SetStart)
    freed: bool,    // its JS handle has been freed (but kept while the holder lives, for ancestry)
}

struct Holder {
    cache: Cache,
    current: i32,          // version the cache is currently synced to
    live: u32,             // handles in this lineage whose JS wrapper hasn't been freed
    version_ids: Vec<u32>, // every version in this lineage (for reclamation)
}

// Versions/holders are kept in slot arenas with free lists. A whole lineage (its
// heavy shared cache + all its light version nodes) is reclaimed when its last
// handle is freed (live == 0) — at which point NO JS wrapper can reference any of
// its handles, so reusing the slots is safe. This bounds memory across a process
// that runs many compiles on one module instance (e.g. a multi-spec perf run).
static mut VERSIONS: Vec<Option<Version>> = Vec::new();
static mut HOLDERS: Vec<Option<Holder>> = Vec::new();
static mut FREE_VERSIONS: Vec<u32> = Vec::new();
static mut FREE_HOLDERS: Vec<u32> = Vec::new();
static mut GEN: u32 = 0;
// Reusable scratch for update_computed's patch-walk (undo ids + redo lines). Hoisted
// out of the per-call hot path: drained (not dropped) each reconcile so the backing
// allocations amortize to zero after warmup. Single-threaded WASM + no re-entrancy
// (the redo loop's cache.add_line never calls update_computed), so the statics are
// safe and the walk produces the identical id/line sequence as the old locals.
static mut RECONCILE_UNDO: Vec<i32> = Vec::new();
static mut RECONCILE_REDO: Vec<Line> = Vec::new();

#[allow(static_mut_refs)]
fn versions() -> &'static mut Vec<Option<Version>> {
    unsafe { &mut VERSIONS }
}
#[allow(static_mut_refs)]
fn holders() -> &'static mut Vec<Option<Holder>> {
    unsafe { &mut HOLDERS }
}
#[allow(static_mut_refs)]
fn free_versions() -> &'static mut Vec<u32> {
    unsafe { &mut FREE_VERSIONS }
}
#[allow(static_mut_refs)]
fn free_holders() -> &'static mut Vec<u32> {
    unsafe { &mut FREE_HOLDERS }
}
fn next_gen() -> u32 {
    unsafe {
        GEN += 1;
        GEN
    }
}

fn valid(h: u32) -> bool {
    matches!(versions().get(h as usize), Some(Some(_)))
}
fn ver(id: i32) -> &'static Version {
    versions()[id as usize].as_ref().unwrap()
}

fn alloc_version(v: Version) -> u32 {
    if let Some(id) = free_versions().pop() {
        versions()[id as usize] = Some(v);
        id
    } else {
        versions().push(Some(v));
        (versions().len() - 1) as u32
    }
}

/// new LineRiderEngine(): a fresh lineage (holder + root version).
pub(crate) fn create() -> u32 {
    let holder = if let Some(id) = free_holders().pop() {
        id
    } else {
        holders().push(None);
        (holders().len() - 1) as u32
    };
    let vid = alloc_version(Version {
        holder,
        parent: -1,
        depth: 0,
        patch: Patch::Root,
        start: [0.0, 0.0, 0.4, 0.0],
        start_gen: 0,
        freed: false,
    });
    holders()[holder as usize] = Some(Holder {
        cache: Cache::new(),
        current: vid as i32,
        live: 1,
        version_ids: vec![vid],
    });
    vid
}

/// setStart: sync the cache to `h`, reset it to a single frame with the new start,
/// and create a new version with a fresh initialStateMap identity.
pub(crate) fn set_start(h: u32, px: f64, py: f64, vx: f64, vy: f64) -> u32 {
    update_computed(h);
    let (holder, parent_depth) = {
        let p = ver(h as i32);
        (p.holder, p.depth)
    };
    let g = next_gen();
    let vid = alloc_version(Version {
        holder,
        parent: h as i32,
        depth: parent_depth + 1,
        patch: Patch::SetStart,
        start: [px, py, vx, vy],
        start_gen: g,
        freed: false,
    });
    let hh = holders()[holder as usize].as_mut().unwrap();
    hh.cache.set_initial_states(px, py, vx, vy);
    hh.current = vid as i32;
    hh.live += 1;
    hh.version_ids.push(vid);
    vid
}

/// addLine: sync the cache to `h`, add the line to the shared cache, create a new
/// version (AddLine patch) that becomes the cache's current.
pub(crate) fn add_line(
    h: u32,
    id: i32,
    ty: i32,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    flags: i32,
) -> u32 {
    update_computed(h);
    let l = build_line(id, x1, y1, x2, y2, ty as i64, flags as i64);
    let (holder, parent_depth, start, start_gen) = {
        let p = ver(h as i32);
        (p.holder, p.depth, p.start, p.start_gen)
    };
    let vid = alloc_version(Version {
        holder,
        parent: h as i32,
        depth: parent_depth + 1,
        patch: Patch::AddLine(l.clone()),
        start,
        start_gen,
        freed: false,
    });
    let hh = holders()[holder as usize].as_mut().unwrap();
    hh.cache.add_line(l);
    hh.current = vid as i32;
    hh.live += 1;
    hh.version_ids.push(vid);
    vid
}

/// free a handle: mark its version freed and drop the lineage's live count; when no
/// live handle remains, reclaim the whole holder (its cache + all version slots).
pub(crate) fn free(h: u32) {
    if !valid(h) {
        return;
    }
    let holder_id = {
        let v = versions()[h as usize].as_mut().unwrap();
        if v.freed {
            return; // already freed
        }
        v.freed = true;
        v.holder
    };
    let hh = holders()[holder_id as usize].as_mut().unwrap();
    hh.live -= 1;
    if hh.live == 0 {
        let dead = holders()[holder_id as usize].take().unwrap(); // drops the heavy Cache
        for vid in dead.version_ids {
            versions()[vid as usize] = None;
            free_versions().push(vid);
        }
        free_holders().push(holder_id);
    }
}

/// updateComputed: reconcile the shared cache from its current version to `target`
/// by walking the patch tree (undo current's AddLines to the LCA, redo target's),
/// then resetting the start if the initialStateMap identity differs.
///
/// Immo reconciles three state members; here only two can ever differ: linesList
/// (the patch walk) and initialStateMap (start_gen). The third, `constraints`, is
/// baked as immutable rider const tables (lib.rs) — there is no ABI to change them
/// — so it is constant across every version and needs no reconcile.
fn update_computed(target: u32) {
    let target = target as i32;
    let holder = ver(target).holder;
    let current = holders()[holder as usize].as_ref().unwrap().current;
    if current == target {
        return;
    }

    // Walk to the LCA, collecting line ops (Immy.List.compareTo over a shared root).
    // Only AddLine patches exist in the tree (Root/SetStart carry no line), so undo
    // is purely removes and redo purely adds. Scratch buffers are reused across calls
    // (cleared here, drained below) to avoid a per-reconcile Vec allocation.
    #[allow(static_mut_refs)]
    let undo_ids: &mut Vec<i32> = unsafe { &mut RECONCILE_UNDO }; // current-side AddLines to remove, most-recent-first
    #[allow(static_mut_refs)]
    let redo_lines: &mut Vec<Line> = unsafe { &mut RECONCILE_REDO }; // target-side AddLines to add, most-recent-first → reversed
    undo_ids.clear();
    redo_lines.clear();
    let mut a = current;
    let mut b = target;
    while ver(a).depth > ver(b).depth {
        if let Patch::AddLine(l) = &ver(a).patch {
            undo_ids.push(l.id);
        }
        a = ver(a).parent;
    }
    while ver(b).depth > ver(a).depth {
        if let Patch::AddLine(l) = &ver(b).patch {
            redo_lines.push(l.clone());
        }
        b = ver(b).parent;
    }
    while a != b {
        if let Patch::AddLine(l) = &ver(a).patch {
            undo_ids.push(l.id);
        }
        a = ver(a).parent;
        if let Patch::AddLine(l) = &ver(b).patch {
            redo_lines.push(l.clone());
        }
        b = ver(b).parent;
    }
    redo_lines.reverse(); // oldest-first

    let start_changed = ver(current).start_gen != ver(target).start_gen;
    let target_start = ver(target).start;

    let cache = &mut holders()[holder as usize].as_mut().unwrap().cache;
    // linesList reconcile (Immo runs this before initialStateMap). Drain the redo
    // scratch (moves the Lines out, keeps the buffer's capacity for reuse).
    for &id in undo_ids.iter() {
        cache.remove_line(id);
    }
    for l in redo_lines.drain(..) {
        cache.add_line(l);
    }
    // initialStateMap reconcile: a SetStart somewhere between the two versions.
    if start_changed {
        cache.set_initial_states(
            target_start[0],
            target_start[1],
            target_start[2],
            target_start[3],
        );
    }
    holders()[holder as usize].as_mut().unwrap().current = target;
}

pub(crate) fn last_frame_index(h: u32) -> i32 {
    if !valid(h) {
        return -1;
    }
    update_computed(h);
    let holder = ver(h as i32).holder;
    holders()[holder as usize]
        .as_ref()
        .unwrap()
        .cache
        .last_frame_index()
}

/// Compute (if needed) frame `f` of version `h` and write it into `out`:
/// 12 entities × [px,py,prevx,prevy,vx,vy] (72 f64), then 12 fsu. No-op (leaves
/// `out` untouched) on an invalid handle or negative frame — matching the old
/// engine's silent degradation rather than trapping the whole module.
pub(crate) fn state_into(h: u32, f: i32, out: &mut [f64]) {
    if !valid(h) || f < 0 {
        return;
    }
    update_computed(h);
    let holder = ver(h as i32).holder;
    let cache = &mut holders()[holder as usize].as_mut().unwrap().cache;
    let f = f as usize;
    cache.compute_to(f);
    let s = &cache.frames[f];
    for i in 0..NENT {
        let o = i * 6;
        out[o] = s.px[i];
        out[o + 1] = s.py[i];
        out[o + 2] = s.prevx[i];
        out[o + 3] = s.prevy[i];
        out[o + 4] = s.vx[i];
        out[o + 5] = s.vy[i];
    }
    for i in 0..NENT {
        out[NENT * 6 + i] = s.fsu[i] as f64;
    }
}

/// getRider, computed in Rust to avoid rebuilding the JS stateMap on the hot path.
/// Writes 6 f64: avg BODY pos.x/y, avg BODY vel.x/y (summed in BODY order then /6
/// — bit-identical to Rider.getBody), then the RIDER_MOUNTED and SLED_INTACT fsu
/// (the only two bindings the detector reads via rider.get(id).isBinded()).
pub(crate) fn rider_into(h: u32, f: i32, out: &mut [f64]) {
    if !valid(h) || f < 0 {
        return;
    }
    update_computed(h);
    let holder = ver(h as i32).holder;
    let cache = &mut holders()[holder as usize].as_mut().unwrap().cache;
    let f = f as usize;
    cache.compute_to(f);
    let s = &cache.frames[f];
    let (mut px, mut py, mut vx, mut vy) = (0.0, 0.0, 0.0, 0.0);
    for &i in BODY.iter() {
        px += s.px[i];
        py += s.py[i];
        vx += s.vx[i];
        vy += s.vy[i];
    }
    let n = BODY.len() as f64;
    out[0] = px / n;
    out[1] = py / n;
    out[2] = vx / n;
    out[3] = vy / n;
    out[4] = s.fsu[RIDER_MOUNTED] as f64;
    out[5] = s.fsu[SLED_INTACT] as f64;
    // Slots 6..29: PEG/TAIL/NOSE/STRING point states as 4 × [px,py,prevx,prevy,vx,vy].
    // These are the only point ids the compiler probes through getRider on the WASM
    // path; keeping them in the lean payload avoids the cold full-stateMap fallback.
    for (k, &i) in [PEG, TAIL, NOSE, STRING].iter().enumerate() {
        let o = 6 + k * 6;
        out[o] = s.px[i];
        out[o + 1] = s.py[i];
        out[o + 2] = s.prevx[i];
        out[o + 3] = s.prevy[i];
        out[o + 4] = s.vx[i];
        out[o + 5] = s.vy[i];
    }
}

/// Compute (if needed) frame `f` and write its collision records into `out` as
/// (iteration, line_id, point_idx) f64 triples; returns the count (capped at cap).
pub(crate) fn events_into(h: u32, f: i32, out: &mut [f64], cap: usize) -> usize {
    if !valid(h) || f < 0 {
        return 0;
    }
    update_computed(h);
    let holder = ver(h as i32).holder;
    let cache = &mut holders()[holder as usize].as_mut().unwrap().cache;
    let f = f as usize;
    cache.compute_to(f);
    let ev = cache.events_at(f);
    let n = ev.len().min(cap);
    for (k, &(it, id, pt)) in ev.iter().take(n).enumerate() {
        out[k * 3] = it as f64;
        out[k * 3 + 1] = id as f64;
        out[k * 3 + 2] = pt as f64;
    }
    n
}

/// Combined detector hot path: compute frame `f` once, then write the getRider
/// summary to `scratch` and collision records to `events`.
pub(crate) fn raw_frame_into(
    h: u32,
    f: i32,
    scratch: &mut [f64],
    events: &mut [f64],
    cap: usize,
) -> usize {
    if !valid(h) || f < 0 {
        return 0;
    }
    update_computed(h);
    let holder = ver(h as i32).holder;
    let cache = &mut holders()[holder as usize].as_mut().unwrap().cache;
    let f = f as usize;
    cache.compute_to(f);
    let s = &cache.frames[f];

    let (mut px, mut py, mut vx, mut vy) = (0.0, 0.0, 0.0, 0.0);
    for &i in BODY.iter() {
        px += s.px[i];
        py += s.py[i];
        vx += s.vx[i];
        vy += s.vy[i];
    }
    let n_body = BODY.len() as f64;
    scratch[0] = px / n_body;
    scratch[1] = py / n_body;
    scratch[2] = vx / n_body;
    scratch[3] = vy / n_body;
    scratch[4] = s.fsu[RIDER_MOUNTED] as f64;
    scratch[5] = s.fsu[SLED_INTACT] as f64;

    let ev = cache.events_at(f);
    let n = ev.len().min(cap);
    for (k, &(it, id, pt)) in ev.iter().take(n).enumerate() {
        events[k * 3] = it as f64;
        events[k * 3 + 1] = id as f64;
        events[k * 3 + 2] = pt as f64;
    }
    n
}
