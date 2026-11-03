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

use std::{cell::RefCell, rc::Rc};

use crate::frame::CollisionHistory;
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
const SLED_POINT_MASK: u32 = (1u32 << PEG) | (1u32 << TAIL) | (1u32 << NOSE) | (1u32 << STRING);
const CANDIDATE_WINDOW_STRIDE: usize = 9;
type Event = crate::kernel::Collision;

#[derive(Clone, Copy)]
struct FrameSummary {
    body_px: f64,
    body_py: f64,
    body_vx: f64,
    body_vy: f64,
    rider_fsu: i32,
    sled_fsu: i32,
    sled_mask: u32,
    contact_offset: usize,
    contact_count: usize,
}

// ── the single shared cache per lineage (LineEngine.__computed__ + Frame.grid/collisions) ──
#[derive(Clone)]
struct Cache {
    rest: [f64; NITER],
    endur: [f64; NITER],
    cell_lines: FlatIntMap<Vec<GridLine>>, // ClassicGrid cellLinesMap (collision lookup)
    line_cache: LineCellCache,             // shortcut valid until the line grid changes
    lines_cells: IntMap<i32, Vec<(i64, i64)>>, // ClassicGrid lineCellsMap (id → cell coords, for remove)
    frames: Vec<State>,                        // frames[0] = initial; lazily extended
    events: Vec<Event>,                        // flat per-frame collision records
    event_offsets: Vec<usize>,                 // frame f => events[offset[f]..offset[f+1]]
    summaries: Vec<FrameSummary>, // per-frame compact read summaries for repeated detector windows
    candidate_contacts: Vec<f64>, // flat per-frame sled contact line ids used by getCandidateWindow
    // Invalidation indexes are materialized lazily, without recharging frames.
    history: CollisionHistory,
    history_events: Vec<Event>, // scratch for lazy history replay
    cur: State,                 // == frames.last() when !cur_dirty; working state for stepping
    cur_dirty: bool, // set on truncation: `cur` is stale, resync from frames.last() before next step
}

impl Cache {
    fn new() -> Cache {
        let (rest, endur) = compute_rest_endur();
        let s = init_state(0.0, 0.0, 0.4, 0.0); // DEFAULT_START
        let mut candidate_contacts = Vec::new();
        let summary = Self::summarize_frame(&s, &[], &mut candidate_contacts);
        Cache {
            rest,
            endur,
            cell_lines: FlatIntMap::default(),
            line_cache: LineCellCache::default(),
            lines_cells: IntMap::default(),
            frames: vec![s.clone()],
            events: Vec::new(),
            event_offsets: vec![0, 0],
            summaries: vec![summary],
            candidate_contacts,
            history: CollisionHistory::new(),
            history_events: Vec::new(),
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
        self.history.truncate(len);
        self.frames.truncate(len);
        self.events.truncate(self.event_offsets[len]);
        self.event_offsets.truncate(len + 1);
        if len < self.summaries.len() {
            self.candidate_contacts
                .truncate(self.summaries[len].contact_offset);
            self.summaries.truncate(len);
        }
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
        self.ensure_history();
        let cells = line_cells(&l);
        let id = l.id;
        // Invalidation reads only history
        // and set_frames_length touches only history/frames — both disjoint from
        // cell_lines/lines_cells. So we run the invalidation loop first (borrowing
        // &l), then move l into push_line and cells into lines_cells, avoiding the
        // line + cells-Vec clones the original eager registration required. The grid
        // registration order vs invalidation is immaterial (disjoint state).
        for &(cx, cy) in cells.iter() {
            if let Some(idx) = self.history.first_in_cell(cx, cy, &l) {
                self.set_frames_length(idx as usize);
            }
        }
        self.line_cache.invalidate();
        push_line(&mut self.cell_lines, l, &cells);
        self.lines_cells.insert(id, cells);
    }

    /// _removeLine for each id in order: unregister the line, truncate to its
    /// FIRST collision frame. Removing lines never changes recorded collisions,
    /// and successive truncations (with their reverse-patch rollbacks) compose,
    /// so the lines leave the grid in the same order and the cache truncates
    /// once, to the earliest collision with any of them.
    fn remove_lines(&mut self, ids: &[i32], removed: &mut Vec<i32>) {
        if !ids.is_empty() {
            self.line_cache.invalidate();
        }
        removed.clear();
        let mut first: Option<i32> = None;
        for &id in ids {
            if let Some(cells) = self.lines_cells.remove(&id) {
                remove_line(&mut self.cell_lines, id, &cells);
                if let Some(f) = self.history.first_with_line(id) {
                    first = Some(first.map_or(f, |b| b.min(f)));
                }
                removed.push(id);
            }
        }
        // Indexed collisions belong to the tracked prefix, before every frame
        // the event scan could find.
        if first.is_none() && !removed.is_empty() {
            removed.sort_unstable();
            'scan: for f in self.history.len()..self.frames.len() {
                for &(_, line_id, _, _, _) in self.events_at(f) {
                    if removed.binary_search(&line_id).is_ok() {
                        first = Some(f as i32);
                        break 'scan;
                    }
                }
            }
        }
        if let Some(idx) = first {
            self.set_frames_length(idx as usize);
        }
    }

    /// setInitialStates: reset the frame cache to a single frame with a new start
    /// (lines/grid preserved). lr-core: `_setFramesLength(1)` + `frames[0] = new`.
    fn set_initial_states(&mut self, px: f64, py: f64, vx: f64, vy: f64) {
        let s = init_state(px, py, vx, vy);
        self.history.clear();
        self.frames.clear();
        self.frames.push(s.clone());
        self.events.clear();
        self.event_offsets.clear();
        self.event_offsets.extend_from_slice(&[0, 0]);
        self.summaries.clear();
        self.candidate_contacts.clear();
        let summary = Self::summarize_frame(&s, &[], &mut self.candidate_contacts);
        self.summaries.push(summary);
        self.history_events.clear();
        self.cur = s;
        self.cur_dirty = false;
    }

    fn ensure_history(&mut self) {
        if self.history.len() >= self.frames.len() {
            return;
        }
        // Replay only the missing suffix with TRACK=true. The public frame/event
        // cache was already produced during the read; this pass fills just the
        // invalidation side indexes without changing simulated-frame accounting.
        let mut s = self.frames[self.history.len() - 1].clone();
        while self.history.len() < self.frames.len() {
            let fi = self.history.len() as i32;
            self.history_events.clear();
            step_state::<true>(
                &mut s,
                &self.cell_lines,
                &self.rest,
                &self.endur,
                &mut self.history_events,
                fi,
                &mut self.history,
                &mut self.line_cache,
            );
            self.history.finish_frame();
        }
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
            step_state::<false>(
                &mut self.cur,
                &self.cell_lines,
                &self.rest,
                &self.endur,
                &mut self.events,
                fi,
                &mut self.history,
                &mut self.line_cache,
            );
            let summary = Self::summarize_frame(
                &self.cur,
                &self.events[self.event_offsets[fi as usize]..],
                &mut self.candidate_contacts,
            );
            self.frames.push(self.cur.clone());
            self.event_offsets.push(self.events.len());
            self.summaries.push(summary);
        }
    }

    #[inline]
    fn events_at(&self, f: usize) -> &[Event] {
        &self.events[self.event_offsets[f]..self.event_offsets[f + 1]]
    }

    fn summarize_frame(
        s: &State,
        events: &[Event],
        candidate_contacts: &mut Vec<f64>,
    ) -> FrameSummary {
        let (mut px, mut py, mut vx, mut vy) = (0.0, 0.0, 0.0, 0.0);
        for &entity in BODY.iter() {
            px += s.px[entity];
            py += s.py[entity];
            vx += s.vx[entity];
            vy += s.vy[entity];
        }
        let n_body = BODY.len() as f64;
        let contact_offset = candidate_contacts.len();
        let mut sled_mask = 0u32;
        for &(_, line_id, point_idx, _, _) in events {
            let bit = 1u32 << (point_idx as u32);
            if (SLED_POINT_MASK & bit) == 0 {
                continue;
            }
            sled_mask |= bit;
            let line_id = line_id as f64;
            let mut seen_line = false;
            for &seen in candidate_contacts[contact_offset..].iter() {
                if seen == line_id {
                    seen_line = true;
                    break;
                }
            }
            if !seen_line {
                candidate_contacts.push(line_id);
            }
        }
        FrameSummary {
            body_px: px / n_body,
            body_py: py / n_body,
            body_vx: vx / n_body,
            body_vy: vy / n_body,
            rider_fsu: s.fsu[RIDER_MOUNTED],
            sled_fsu: s.fsu[SLED_INTACT],
            sled_mask,
            contact_offset,
            contact_count: candidate_contacts.len() - contact_offset,
        }
    }
}

// ── version tree (each engine handle is a node) + per-lineage holder ──
enum Patch {
    Root,
    SetStart,
    /// One addLine batch, in insertion order. A batch is one version: lr-core's
    /// addLine([l1..ln]) applies its lines with no read in between.
    AddLines(Vec<Line>),
}

struct Version {
    holder: u32,
    parent: i32, // -1 for root
    depth: u32,
    patch: Patch,
    start: [f64; 4],
    start_gen: u32, // initialStateMap identity (bumped on SetStart)
    freed: bool,    // the external handle no longer owns this version
    children: u32,  // direct descendants that still need this patch as ancestry
}

struct Holder {
    // Detached lineages share an immutable snapshot until one needs to write.
    // Releasing the source first transfers the cache without cloning its data.
    cache: Rc<Cache>,
    current: i32,          // version the cache is currently synced to
    live: u32,             // handles in this lineage whose JS wrapper hasn't been freed
    version_ids: Vec<u32>, // reserved slots, including reclaimed nodes; reusable at lineage death
}

impl Holder {
    // A cached read must not trigger copy-on-write. Only extending the prefix
    // mutates frame storage; grid edits and truncation use make_mut separately.
    fn compute_to(&mut self, frame: usize) -> &Cache {
        if self.cache.frames.len() <= frame {
            Rc::make_mut(&mut self.cache).compute_to(frame);
        }
        &self.cache
    }
}

// One owner for version slots, lineage caches and reusable reconciliation scratch.
// An operation borrows it for the whole ABI call; no references escape that scope.
// RefCell enforces the non-reentrant boundary instead of relying on static-mut
// aliases. The WASM instance is single-threaded; native test threads own arenas.
struct EngineArena {
    versions: Vec<Option<Box<Version>>>,
    holders: Vec<Option<Holder>>,
    free_versions: Vec<u32>,
    free_holders: Vec<u32>,
    generation: u32,
    undo: Vec<i32>,
    redo: Vec<Line>,
    removed: Vec<i32>,
}

impl EngineArena {
    const fn new() -> Self {
        Self {
            versions: Vec::new(),
            holders: Vec::new(),
            free_versions: Vec::new(),
            free_holders: Vec::new(),
            generation: 0,
            undo: Vec::new(),
            redo: Vec::new(),
            removed: Vec::new(),
        }
    }

    fn next_gen(&mut self) -> u32 {
        self.generation += 1;
        self.generation
    }
    fn valid(&self, h: u32) -> bool {
        matches!(self.versions.get(h as usize), Some(Some(_)))
    }
    fn ver(&self, id: i32) -> &Version {
        self.versions[id as usize].as_ref().unwrap()
    }

    fn alloc_version(&mut self, v: Version) -> u32 {
        if v.parent >= 0 {
            self.versions[v.parent as usize].as_mut().unwrap().children += 1;
        }
        if let Some(id) = self.free_versions.pop() {
            self.versions[id as usize] = Some(Box::new(v));
            id
        } else {
            self.versions.push(Some(Box::new(v)));
            (self.versions.len() - 1) as u32
        }
    }

    /// new LineRiderEngine(): a fresh lineage (holder + root version).
    fn create(&mut self) -> u32 {
        let holder = if let Some(id) = self.free_holders.pop() {
            id
        } else {
            self.holders.push(None);
            (self.holders.len() - 1) as u32
        };
        let vid = self.alloc_version(Version {
            holder,
            parent: -1,
            depth: 0,
            patch: Patch::Root,
            start: [0.0, 0.0, 0.4, 0.0],
            start_gen: 0,
            freed: false,
            children: 0,
        });
        self.holders[holder as usize] = Some(Holder {
            cache: Rc::new(Cache::new()),
            current: vid as i32,
            live: 1,
            version_ids: vec![vid],
        });
        vid
    }

    /// setStart: sync the cache to `h`, reset it to a single frame with the new start,
    /// and create a new version with a fresh initialStateMap identity.
    fn set_start(&mut self, h: u32, px: f64, py: f64, vx: f64, vy: f64) -> u32 {
        self.update_computed(h);
        let (holder, parent_depth) = {
            let p = self.ver(h as i32);
            (p.holder, p.depth)
        };
        let g = self.next_gen();
        let vid = self.alloc_version(Version {
            holder,
            parent: h as i32,
            depth: parent_depth + 1,
            patch: Patch::SetStart,
            start: [px, py, vx, vy],
            start_gen: g,
            freed: false,
            children: 0,
        });
        let hh = self.holders[holder as usize].as_mut().unwrap();
        Rc::make_mut(&mut hh.cache).set_initial_states(px, py, vx, vy);
        hh.current = vid as i32;
        hh.live += 1;
        hh.version_ids.push(vid);
        vid
    }

    /// addLine: sync the cache to `h`, add the line to the shared cache, create a new
    /// version (AddLines patch) that becomes the cache's current.
    fn add_line(
        &mut self,
        h: u32,
        id: i32,
        ty: i32,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        flags: i32,
    ) -> u32 {
        self.add_lines(
            h,
            vec![build_line(id, x1, y1, x2, y2, ty as i64, flags as i64)],
        )
    }

    /// addLine([l1..ln]): sync the cache to `h`, add each line to the shared cache in
    /// order, and create one version (AddLines patch) that becomes the cache's current.
    /// The cache sees the same _addLine sequence as n single-line versions would.
    fn add_lines(&mut self, h: u32, lines: Vec<Line>) -> u32 {
        self.update_computed(h);
        let (holder, parent_depth, start, start_gen) = {
            let p = self.ver(h as i32);
            (p.holder, p.depth, p.start, p.start_gen)
        };
        let hh = self.holders[holder as usize].as_mut().unwrap();
        let cache = Rc::make_mut(&mut hh.cache);
        for l in lines.iter() {
            cache.add_line(l.clone());
        }
        let vid = self.alloc_version(Version {
            holder,
            parent: h as i32,
            depth: parent_depth + 1,
            patch: Patch::AddLines(lines),
            start,
            start_gen,
            freed: false,
            children: 0,
        });
        let hh = self.holders[holder as usize].as_mut().unwrap();
        hh.current = vid as i32;
        hh.live += 1;
        hh.version_ids.push(vid);
        vid
    }

    /// free a handle: mark its version freed and drop the lineage's live count; when no
    /// live handle remains, reclaim the whole holder (its cache + all version slots).
    fn free(&mut self, h: u32) {
        if !self.valid(h) {
            return;
        }
        let holder_id = {
            let v = self.versions[h as usize].as_mut().unwrap();
            if v.freed {
                return; // already freed
            }
            v.freed = true;
            v.holder
        };
        let hh = self.holders[holder_id as usize].as_mut().unwrap();
        hh.live -= 1;
        if hh.live == 0 {
            let dead = self.holders[holder_id as usize].take().unwrap(); // releases this lineage's cache ownership
            for vid in dead.version_ids {
                self.versions[vid as usize] = None;
                self.free_versions.push(vid);
            }
            self.free_holders.push(holder_id);
        } else {
            self.reclaim_unused(h as i32);
        }
    }

    /// A released leaf can be discarded once the cache no longer needs its patch.
    /// Unwind its unowned ancestors too. The slot stays reserved in version_ids
    /// until lineage death, so stale handles cannot alias a newly allocated node.
    fn reclaim_unused(&mut self, mut id: i32) {
        while id >= 0 {
            let v = self.ver(id);
            if !v.freed
                || v.children > 0
                || self.holders[v.holder as usize].as_ref().unwrap().current == id
            {
                break;
            }
            let parent = v.parent;
            self.versions[id as usize] = None;
            if parent >= 0 {
                let p = self.versions[parent as usize].as_mut().unwrap();
                assert!(p.children > 0);
                p.children -= 1;
            }
            id = parent;
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
    fn update_computed(&mut self, target: u32) {
        let target = target as i32;
        let holder = self.ver(target).holder;
        let current = self.holders[holder as usize].as_ref().unwrap().current;
        if current == target {
            return;
        }

        // Walk to the LCA, collecting line ops (Immy.List.compareTo over a shared root).
        // Only AddLines patches carry lines (Root/SetStart carry none), so undo is
        // purely removes and redo purely adds. A batch's lines are collected most
        // recent first, like single-line versions. Scratch buffers are reused across calls
        // (cleared here, drained below) to avoid a per-reconcile Vec allocation.
        let versions = &self.versions;
        let ver = |id: i32| versions[id as usize].as_ref().unwrap();
        let undo_ids = &mut self.undo;
        let redo_lines = &mut self.redo;
        undo_ids.clear();
        redo_lines.clear();
        let mut a = current;
        let mut b = target;
        while ver(a).depth > ver(b).depth {
            if let Patch::AddLines(ls) = &ver(a).patch {
                undo_ids.extend(ls.iter().rev().map(|l| l.id));
            }
            a = ver(a).parent;
        }
        while ver(b).depth > ver(a).depth {
            if let Patch::AddLines(ls) = &ver(b).patch {
                redo_lines.extend(ls.iter().rev().cloned());
            }
            b = ver(b).parent;
        }
        while a != b {
            if let Patch::AddLines(ls) = &ver(a).patch {
                undo_ids.extend(ls.iter().rev().map(|l| l.id));
            }
            a = ver(a).parent;
            if let Patch::AddLines(ls) = &ver(b).patch {
                redo_lines.extend(ls.iter().rev().cloned());
            }
            b = ver(b).parent;
        }
        redo_lines.reverse(); // oldest-first

        let start_changed = ver(current).start_gen != ver(target).start_gen;
        let target_start = ver(target).start;

        let cache = Rc::make_mut(&mut self.holders[holder as usize].as_mut().unwrap().cache);
        // linesList reconcile (Immo runs this before initialStateMap). Drain the redo
        // scratch (moves the Lines out, keeps the buffer's capacity for reuse).
        cache.remove_lines(undo_ids, &mut self.removed);
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
        self.holders[holder as usize].as_mut().unwrap().current = target;
        self.reclaim_unused(current);
    }

    fn last_frame_index(&mut self, h: u32) -> i32 {
        if !self.valid(h) {
            return -1;
        }
        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        self.holders[holder as usize]
            .as_ref()
            .unwrap()
            .cache
            .last_frame_index()
    }

    /// Compute (if needed) frame `f` of version `h` and write it into `out`:
    /// 12 entities × [px,py,prevx,prevy,vx,vy] (72 f64), then 12 fsu. No-op (leaves
    /// `out` untouched) on an invalid handle or negative frame — matching the old
    /// engine's silent degradation rather than trapping the whole module.
    fn state_into(&mut self, h: u32, f: i32, out: &mut [f64]) {
        if !self.valid(h) || f < 0 {
            return;
        }
        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        let f = f as usize;
        let cache = self.holders[holder as usize]
            .as_mut()
            .unwrap()
            .compute_to(f);
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
    fn rider_into(&mut self, h: u32, f: i32, out: &mut [f64]) {
        if !self.valid(h) || f < 0 {
            return;
        }
        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        let f = f as usize;
        let cache = self.holders[holder as usize]
            .as_mut()
            .unwrap()
            .compute_to(f);
        let s = &cache.frames[f];
        let summary = cache.summaries[f];
        out[0] = summary.body_px;
        out[1] = summary.body_py;
        out[2] = summary.body_vx;
        out[3] = summary.body_vy;
        out[4] = summary.rider_fsu as f64;
        out[5] = summary.sled_fsu as f64;
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
    fn events_into(&mut self, h: u32, f: i32, out: &mut [f64], cap: usize) -> usize {
        if !self.valid(h) || f < 0 {
            return 0;
        }
        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        let f = f as usize;
        let cache = self.holders[holder as usize]
            .as_mut()
            .unwrap()
            .compute_to(f);
        let ev = cache.events_at(f);
        let n = ev.len().min(cap);
        for (k, &(it, id, pt, _, _)) in ev.iter().take(n).enumerate() {
            out[k * 3] = it as f64;
            out[k * 3 + 1] = id as f64;
            out[k * 3 + 2] = pt as f64;
        }
        n
    }

    /// Combined detector hot path: compute frame `f` once, then write the getRider
    /// summary to `scratch` and collision records to `events`.
    fn raw_frame_into(
        &mut self,
        h: u32,
        f: i32,
        scratch: &mut [f64],
        events: &mut [f64],
        cap: usize,
    ) -> usize {
        if !self.valid(h) || f < 0 {
            return 0;
        }
        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        let f = f as usize;
        let cache = self.holders[holder as usize]
            .as_mut()
            .unwrap()
            .compute_to(f);
        let summary = cache.summaries[f];
        scratch[0] = summary.body_px;
        scratch[1] = summary.body_py;
        scratch[2] = summary.body_vx;
        scratch[3] = summary.body_vy;
        scratch[4] = summary.rider_fsu as f64;
        scratch[5] = summary.sled_fsu as f64;

        let ev = cache.events_at(f);
        let n = ev.len().min(cap);
        for (k, &(it, id, pt, _, _)) in ev.iter().take(n).enumerate() {
            events[k * 3] = it as f64;
            events[k * 3 + 1] = id as f64;
            events[k * 3 + 2] = pt as f64;
        }
        n
    }

    /// Candidate-window detector ABI: compute a consecutive frame window once and
    /// write just the fields candidate scoring consumes. Layout per frame:
    /// [body_px, body_py, body_vx, body_vy, rider_fsu, sled_fsu, sled_mask,
    ///  contact_offset, contact_count]. Sled-side contact line ids are written
    /// contiguously to `contacts`, deduped per frame in collision-event order.
    fn candidate_window_into(
        &mut self,
        h: u32,
        start: i32,
        end: i32,
        out: &mut [f64],
        contacts: &mut [f64],
        cap: usize,
    ) -> i32 {
        if !self.valid(h) || start < 0 || end < start {
            return -1;
        }
        let frame_count = (end - start + 1) as usize;
        if frame_count * CANDIDATE_WINDOW_STRIDE > out.len() {
            return -1;
        }

        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        let cache = self.holders[holder as usize]
            .as_mut()
            .unwrap()
            .compute_to(end as usize);

        let mut contact_total = 0usize;
        for i in 0..frame_count {
            let frame = start as usize + i;
            let summary = cache.summaries[frame];
            let base = i * CANDIDATE_WINDOW_STRIDE;

            out[base] = summary.body_px;
            out[base + 1] = summary.body_py;
            out[base + 2] = summary.body_vx;
            out[base + 3] = summary.body_vy;
            out[base + 4] = summary.rider_fsu as f64;
            out[base + 5] = summary.sled_fsu as f64;

            let contact_start = contact_total;
            let contact_end = contact_total + summary.contact_count;
            if contact_end > cap {
                return -1;
            }
            if summary.contact_count > 0 {
                let src_start = summary.contact_offset;
                let src_end = src_start + summary.contact_count;
                contacts[contact_total..contact_end]
                    .copy_from_slice(&cache.candidate_contacts[src_start..src_end]);
                contact_total = contact_end;
            }

            out[base + 6] = summary.sled_mask as f64;
            out[base + 7] = contact_start as f64;
            out[base + 8] = (contact_total - contact_start) as f64;
        }

        contact_total as i32
    }

    /// Detach an already-computed immutable prefix into an independent lineage.
    /// Share its backing cache until a write; no stepping or new initial state.
    /// Cache::clone resets borrowed line queries when copy-on-write is necessary.
    fn detach(&mut self, h: u32) -> u32 {
        self.update_computed(h);
        let (cache, start, start_gen) = {
            let v = self.ver(h as i32);
            (
                self.holders[v.holder as usize]
                    .as_ref()
                    .unwrap()
                    .cache
                    .clone(),
                v.start,
                v.start_gen,
            )
        };
        let holder = if let Some(id) = self.free_holders.pop() {
            id
        } else {
            self.holders.push(None);
            (self.holders.len() - 1) as u32
        };
        let vid = self.alloc_version(Version {
            holder,
            parent: -1,
            depth: 0,
            patch: Patch::Root,
            start,
            start_gen,
            freed: false,
            children: 0,
        });
        self.holders[holder as usize] = Some(Holder {
            cache,
            current: vid as i32,
            live: 1,
            version_ids: vec![vid],
        });
        vid
    }

    /// Evict the requested frame so a subsequent metered read records its solver
    /// states. This API performs no stepping: the caller charges the actual replay.
    fn prepare_collision_trace(&mut self, h: u32, frame: i32) {
        assert!(frame > 0);
        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        let cache = &mut self.holders[holder as usize].as_mut().unwrap().cache;
        if cache.frames.len() > frame as usize {
            Rc::make_mut(cache).set_frames_length(frame as usize);
        }
        crate::kernel::set_trace_target(frame);
    }

    /// Read only already-computed collision positions. A missing window is an error,
    /// never an implicit unmetered simulation. Branch invalidation applies normally.
    fn contact_positions(&mut self, h: u32, start: i32, end: i32, out: &mut Vec<f64>) -> bool {
        out.clear();
        if !self.valid(h) || start < 0 || end < start {
            return false;
        }
        self.update_computed(h);
        let holder = self.ver(h as i32).holder;
        let cache = &self.holders[holder as usize].as_ref().unwrap().cache;
        if end > cache.last_frame_index() {
            return false;
        }
        for f in start as usize..=end as usize {
            for &(_, id, _, x, y) in cache.events_at(f) {
                out.extend_from_slice(&[id as f64, x, y]);
            }
        }
        true
    }
}

thread_local! {
    static ARENA: RefCell<EngineArena> = const { RefCell::new(EngineArena::new()) };
}

fn with_arena<R>(operation: impl FnOnce(&mut EngineArena) -> R) -> R {
    ARENA.with(|arena| operation(&mut arena.borrow_mut()))
}

#[cfg(test)]
fn valid(handle: u32) -> bool {
    with_arena(|arena| arena.valid(handle))
}

pub(crate) fn create() -> u32 {
    with_arena(|arena| arena.create())
}

pub(crate) fn set_start(h: u32, px: f64, py: f64, vx: f64, vy: f64) -> u32 {
    with_arena(|arena| arena.set_start(h, px, py, vx, vy))
}

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
    with_arena(|arena| arena.add_line(h, id, ty, x1, y1, x2, y2, flags))
}

pub(crate) fn add_lines(h: u32, lines: Vec<Line>) -> u32 {
    with_arena(|arena| arena.add_lines(h, lines))
}

pub(crate) fn free(h: u32) {
    with_arena(|arena| arena.free(h))
}

pub(crate) fn last_frame_index(h: u32) -> i32 {
    with_arena(|arena| arena.last_frame_index(h))
}

pub(crate) fn state_into(h: u32, f: i32, out: &mut [f64]) {
    with_arena(|arena| arena.state_into(h, f, out))
}

pub(crate) fn rider_into(h: u32, f: i32, out: &mut [f64]) {
    with_arena(|arena| arena.rider_into(h, f, out))
}

pub(crate) fn events_into(h: u32, f: i32, out: &mut [f64], cap: usize) -> usize {
    with_arena(|arena| arena.events_into(h, f, out, cap))
}

pub(crate) fn raw_frame_into(
    h: u32,
    f: i32,
    scratch: &mut [f64],
    events: &mut [f64],
    cap: usize,
) -> usize {
    with_arena(|arena| arena.raw_frame_into(h, f, scratch, events, cap))
}

pub(crate) fn candidate_window_into(
    h: u32,
    start: i32,
    end: i32,
    out: &mut [f64],
    contacts: &mut [f64],
    cap: usize,
) -> i32 {
    with_arena(|arena| arena.candidate_window_into(h, start, end, out, contacts, cap))
}

pub(crate) fn detach(h: u32) -> u32 {
    with_arena(|arena| arena.detach(h))
}

pub(crate) fn prepare_collision_trace(h: u32, frame: i32) {
    with_arena(|arena| arena.prepare_collision_trace(h, frame))
}

pub(crate) fn contact_positions(h: u32, start: i32, end: i32, out: &mut Vec<f64>) -> bool {
    with_arena(|arena| arena.contact_positions(h, start, end, out))
}

#[cfg(test)]
mod ownership_tests {
    use super::*;
    // Collision tracing still uses the ABI's single shared observation buffer.
    static ARENA_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    #[test]
    fn arena_scope_rejects_reentry_and_releases_its_borrow_after_unwind() {
        let handle = create();
        let nested = std::panic::catch_unwind(|| with_arena(|_| last_frame_index(handle)));
        assert!(nested.is_err());
        assert_eq!(last_frame_index(handle), 0);
        let other = create();
        free(handle);
        assert_eq!(last_frame_index(other), 0);
        free(other);
    }

    #[test]
    fn independently_owned_arenas_do_not_share_handles_or_reconciliation() {
        let _guard = ARENA_LOCK.lock().unwrap();
        let mut left = EngineArena::new();
        let mut right = EngineArena::new();
        let a = left.create();
        let b = right.create();
        assert_eq!(a, b); // ids are local to an arena
        let child = left.set_start(a, 10.0, -25.0, 2.0, 1.0);
        left.free(a);
        assert_eq!(right.last_frame_index(b), 0);
        let mut state = [0.0; 84];
        left.state_into(child, 20, &mut state);
        assert_eq!(left.last_frame_index(child), 20);
        assert_eq!(right.last_frame_index(b), 0);
        left.free(child);
        assert!(right.valid(b));
        right.free(b);
    }

    #[test]
    fn released_branches_preserve_live_descendants_and_cache_ancestry() {
        let _guard = ARENA_LOCK.lock().unwrap();
        let unrelated = create();
        let root = create();
        let start = set_start(root, 0.0, -15.0, 4.0, 0.0);
        free(root);
        let base = add_line(start, 1, 0, -50.0, 10.0, 400.0, 10.0, 0);
        free(start);
        let mut expected = [0.0; 84];
        state_into(base, 40, &mut expected);
        let branch = add_line(base, 2, 0, 600.0, 10.0, 700.0, 10.0, 0);
        free(branch);
        assert!(valid(branch), "cache current still needs its ancestry");
        last_frame_index(base);
        assert!(
            !valid(branch),
            "released branch should be reclaimed after reconcile"
        );
        let mut actual = [0.0; 84];
        state_into(base, 40, &mut actual);
        assert_eq!(actual, expected);
        let parent = add_line(base, 3, 0, 600.0, 10.0, 700.0, 10.0, 0);
        assert_ne!(
            parent, branch,
            "dead slots cannot be reused inside a live lineage"
        );
        let leaf = add_line(parent, 4, 0, 700.0, 10.0, 800.0, 10.0, 0);
        free(parent);
        assert!(valid(parent), "live child owns ancestry");
        last_frame_index(base);
        assert!(valid(parent));
        state_into(leaf, 40, &mut actual);
        assert_eq!(actual, expected);
        free(leaf);
        assert!(valid(leaf), "cache still owns this branch");
        last_frame_index(base);
        assert!(!valid(leaf));
        assert!(!valid(parent));
        state_into(base, 40, &mut actual);
        assert_eq!(actual, expected);
        free(base);
        assert!(!valid(base));
        assert!(!valid(root));
        assert!(!valid(start));
        assert_eq!(
            last_frame_index(unrelated),
            0,
            "other lineage is caller-owned"
        );
        free(unrelated);
    }

    #[test]
    fn detached_prefixes_isolate_reads_edits_trace_eviction_and_released_sources() {
        let _guard = ARENA_LOCK.lock().unwrap();
        let root = create();
        let start = set_start(root, 0.0, -15.0, 4.0, 0.0);
        free(root);
        let base = add_line(start, 1, 0, -50.0, 10.0, 800.0, 10.0, 0);
        free(start);
        let mut at60 = [0.0; 84];
        state_into(base, 60, &mut at60);
        let detached = detach(base);
        let mut actual = [0.0; 84];
        state_into(detached, 60, &mut actual);
        assert_eq!(actual, at60);
        let mut at100 = [0.0; 84];
        state_into(detached, 100, &mut at100);
        assert_eq!(
            last_frame_index(base),
            60,
            "extending a detached prefix must not extend its source"
        );
        state_into(base, 60, &mut actual);
        assert_eq!(actual, at60);
        state_into(base, 100, &mut actual);
        assert_eq!(actual, at100);
        let edited = add_line(base, 2, 0, -50.0, 8.0, 800.0, 8.0, 0);
        state_into(edited, 100, &mut actual);
        assert_ne!(actual, at100);
        assert_eq!(last_frame_index(detached), 100);
        state_into(detached, 100, &mut actual);
        assert_eq!(actual, at100);
        prepare_collision_trace(detached, 40);
        assert_eq!(last_frame_index(detached), 39);
        assert_eq!(
            last_frame_index(edited),
            100,
            "trace eviction belongs only to its lineage"
        );
        state_into(detached, 100, &mut actual);
        assert_eq!(actual, at100);
        crate::kernel::set_trace_target(-1);
        let reset = set_start(detached, 10.0, -25.0, 2.0, 1.0);
        assert_eq!(last_frame_index(reset), 0);
        assert_eq!(last_frame_index(edited), 100);
        state_into(detached, 100, &mut actual);
        assert_eq!(actual, at100);
        let mut expected = [0.0; 84];
        state_into(detached, 120, &mut expected);
        let transferred = detach(detached);
        free(reset);
        free(detached);
        free(edited);
        free(base);
        state_into(transferred, 120, &mut actual);
        assert_eq!(actual, expected);
        state_into(transferred, 140, &mut actual);
        assert_eq!(last_frame_index(transferred), 140);
        free(transferred);
    }
}
