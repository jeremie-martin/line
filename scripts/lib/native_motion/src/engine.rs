//! Immutable version handles over lineage-local frame caches. Reads reconcile
//! the cache through the version tree before observing or extending it. This
//! preserves lr-core's path-dependent frame budget, including sibling reads.
//! Handles, ancestry and optional solver observations have one arena owner.

use crate::cache::{FrameCache, FrameSummary};
use crate::kernel::CollisionTrace;
#[cfg(test)]
use crate::line::build_line;
use crate::line::LineRef;
use crate::{NENT, NOSE, PEG, STRING, TAIL};
use std::{cell::RefCell, rc::Rc};

pub(crate) const RAW_FRAME_STRIDE: usize = 13;

// ── version tree (each engine handle is a node) + per-lineage cache ──
enum Patch {
    Root,
    SetStart,
    /// One addLine batch, in insertion order. A batch is one version: lr-core's
    /// addLine([l1..ln]) applies its lines with no read in between.
    AddLines(Vec<LineRef>),
}

struct Version {
    lineage: u32,
    parent: i32, // -1 for root
    depth: u32,
    patch: Patch,
    start: [f64; 4],
    start_generation: u32, // initialStateMap identity (bumped on SetStart)
    freed: bool,           // the external handle no longer owns this version
    trace: Option<Box<CollisionTrace>>, // observation belongs to this version, never its siblings
    children: u32,         // direct descendants that still need this patch as ancestry
}

struct Lineage {
    // Detached lineages share an immutable snapshot until one needs to write.
    // Releasing the source first transfers the cache without cloning its data.
    cache: Rc<FrameCache>,
    current: i32,          // version the cache is currently synced to
    live: u32,             // handles in this lineage whose JS wrapper hasn't been freed
    version_ids: Vec<u32>, // reserved slots, including reclaimed nodes; reusable at lineage death
}

// One owner for version slots, lineage caches and reusable reconciliation scratch.
// An operation borrows it for the whole ABI call; no references escape that scope.
// RefCell enforces the non-reentrant boundary instead of relying on static-mut
// aliases. The WASM instance is single-threaded; native test threads own arenas.
pub(crate) struct EngineArena {
    versions: Vec<Option<Box<Version>>>,
    lineages: Vec<Option<Lineage>>,
    free_versions: Vec<u32>,
    free_lineages: Vec<u32>,
    generation: u32,
    undo: Vec<i32>,
    redo: Vec<LineRef>,
    removed: Vec<i32>,
}

impl EngineArena {
    const fn new() -> Self {
        Self {
            versions: Vec::new(),
            lineages: Vec::new(),
            free_versions: Vec::new(),
            free_lineages: Vec::new(),
            generation: 0,
            undo: Vec::new(),
            redo: Vec::new(),
            removed: Vec::new(),
        }
    }

    fn next_generation(&mut self) -> u32 {
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

    /// new LineRiderEngine(): a fresh lineage (lineage + root version).
    pub(crate) fn create(&mut self) -> u32 {
        let lineage = if let Some(id) = self.free_lineages.pop() {
            id
        } else {
            self.lineages.push(None);
            (self.lineages.len() - 1) as u32
        };
        let vid = self.alloc_version(Version {
            lineage,
            parent: -1,
            depth: 0,
            patch: Patch::Root,
            start: [0.0, 0.0, 0.4, 0.0],
            start_generation: 0,
            freed: false,
            trace: None,
            children: 0,
        });
        self.lineages[lineage as usize] = Some(Lineage {
            cache: Rc::new(FrameCache::new()),
            current: vid as i32,
            live: 1,
            version_ids: vec![vid],
        });
        vid
    }

    /// setStart: sync the cache to `h`, reset it to a single frame with the new start,
    /// and create a new version with a fresh initialStateMap identity.
    pub(crate) fn set_start(&mut self, h: u32, px: f64, py: f64, vx: f64, vy: f64) -> u32 {
        self.update_computed(h);
        let (lineage, parent_depth) = {
            let p = self.ver(h as i32);
            (p.lineage, p.depth)
        };
        let g = self.next_generation();
        let vid = self.alloc_version(Version {
            lineage,
            parent: h as i32,
            depth: parent_depth + 1,
            patch: Patch::SetStart,
            start: [px, py, vx, vy],
            start_generation: g,
            freed: false,
            trace: None,
            children: 0,
        });
        let hh = self.lineages[lineage as usize].as_mut().unwrap();
        Rc::make_mut(&mut hh.cache).set_initial_states(px, py, vx, vy);
        hh.current = vid as i32;
        hh.live += 1;
        hh.version_ids.push(vid);
        vid
    }

    /// addLine: sync the cache to `h`, add the line to the shared cache, create a new
    /// version (AddLines patch) that becomes the cache's current.
    #[cfg(test)]
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
    pub(crate) fn add_lines(&mut self, h: u32, lines: Vec<LineRef>) -> u32 {
        self.update_computed(h);
        let (lineage, parent_depth, start, start_generation) = {
            let p = self.ver(h as i32);
            (p.lineage, p.depth, p.start, p.start_generation)
        };
        let hh = self.lineages[lineage as usize].as_mut().unwrap();
        let cache = Rc::make_mut(&mut hh.cache);
        cache.add_lines(&lines);
        let vid = self.alloc_version(Version {
            lineage,
            parent: h as i32,
            depth: parent_depth + 1,
            patch: Patch::AddLines(lines),
            start,
            start_generation,
            freed: false,
            trace: None,
            children: 0,
        });
        let hh = self.lineages[lineage as usize].as_mut().unwrap();
        hh.current = vid as i32;
        hh.live += 1;
        hh.version_ids.push(vid);
        vid
    }

    /// free a handle: mark its version freed and drop the lineage's live count; when no
    /// live handle remains, reclaim the whole lineage (its cache + all version slots).
    pub(crate) fn free(&mut self, h: u32) {
        if !self.valid(h) {
            return;
        }
        let lineage_id = {
            let v = self.versions[h as usize].as_mut().unwrap();
            if v.freed {
                return; // already freed
            }
            v.freed = true;
            v.trace = None;
            v.lineage
        };
        let hh = self.lineages[lineage_id as usize].as_mut().unwrap();
        hh.live -= 1;
        if hh.live == 0 {
            let dead = self.lineages[lineage_id as usize].take().unwrap(); // releases this lineage's cache ownership
            for vid in dead.version_ids {
                self.versions[vid as usize] = None;
                self.free_versions.push(vid);
            }
            self.free_lineages.push(lineage_id);
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
                || self.lineages[v.lineage as usize].as_ref().unwrap().current == id
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
    /// (the patch walk) and initialStateMap (start_generation). The third, `constraints`, is
    /// baked as immutable rider const tables (lib.rs) — there is no ABI to change them
    /// — so it is constant across every version and needs no reconcile.
    fn update_computed(&mut self, target: u32) {
        let target = target as i32;
        let lineage = self.ver(target).lineage;
        let current = self.lineages[lineage as usize].as_ref().unwrap().current;
        if current == target {
            // Preparation already evicts this version's pending trace. Only a
            // sibling can refill that prefix, which changes the current version.
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

        let start_changed = ver(current).start_generation != ver(target).start_generation;
        let target_start = ver(target).start;

        let cache = Rc::make_mut(&mut self.lineages[lineage as usize].as_mut().unwrap().cache);
        // Reconcile geometry before the initial state, retaining scratch capacity.
        cache.remove_lines(undo_ids, &mut self.removed);
        cache.add_lines(redo_lines);
        redo_lines.clear();
        // initialStateMap reconcile: a SetStart somewhere between the two versions.
        if start_changed {
            cache.set_initial_states(
                target_start[0],
                target_start[1],
                target_start[2],
                target_start[3],
            );
        }
        self.lineages[lineage as usize].as_mut().unwrap().current = target;
        self.reclaim_unused(current);
        self.evict_pending_trace(target as u32);
    }

    // A sibling may have filled the shared cache since this trace was requested.
    // Evict before reporting the available prefix so metered readers charge replay.
    fn evict_pending_trace(&mut self, handle: u32) {
        let version = self.versions[handle as usize].as_ref().unwrap();
        if let Some(trace) = &version.trace {
            if trace.count == 0 {
                let cache = &mut self.lineages[version.lineage as usize]
                    .as_mut()
                    .unwrap()
                    .cache;
                if cache.frame_count() > trace.frame as usize {
                    Rc::make_mut(cache).set_frames_length(trace.frame as usize);
                }
            }
        }
    }

    // Every computing read reconciles and supplies only this version's trace.
    fn frame_cache(&mut self, handle: u32, frame: i32) -> Option<&FrameCache> {
        if frame < 0 || !self.valid(handle) {
            return None;
        }
        self.update_computed(handle);
        let lineage = self.ver(handle as i32).lineage;
        let cache = &mut self.lineages[lineage as usize].as_mut().unwrap().cache;
        if cache.frame_count() <= frame as usize {
            let trace = self.versions[handle as usize]
                .as_mut()
                .unwrap()
                .trace
                .as_deref_mut()
                .filter(|trace| trace.count == 0);
            Rc::make_mut(cache).compute_to(frame as usize, trace);
        }
        Some(cache)
    }

    // Observations reconcile the version but never extend its frame cache.
    fn cached_frame_cache(&mut self, handle: u32, frame: i32) -> Option<&FrameCache> {
        if frame < 0 || !self.valid(handle) {
            return None;
        }
        self.update_computed(handle);
        let cache = &self.lineages[self.ver(handle as i32).lineage as usize]
            .as_ref()
            .unwrap()
            .cache;
        (frame <= cache.last_frame_index()).then_some(cache)
    }

    /// One native call for a bounded replay. The caller chooses an affordable
    /// horizon and charges the actual cache extension, including early failure.
    pub(crate) fn advance_while_bound(&mut self, handle: u32, frame: i32) -> bool {
        if frame < 0 || !self.valid(handle) { return false; }
        self.update_computed(handle);
        let lineage = self.ver(handle as i32).lineage;
        let cache = &mut self.lineages[lineage as usize].as_mut().unwrap().cache;
        if cache.frame_count() > frame as usize { return cache.is_bound(frame as usize); }
        let trace = self.versions[handle as usize].as_mut().unwrap().trace.as_deref_mut()
            .filter(|trace| trace.count == 0);
        Rc::make_mut(cache).advance_while_bound(frame as usize, trace)
    }

    /// Whole-body motion, in the same point and arithmetic order as bodyMotion()
    /// in strike_impact.ts. Check and observe in one call; never simulate.
    pub(crate) fn body_motion_into(&mut self, handle: u32, frame: i32, out: &mut [f64]) -> bool {
        let Some(cache) = self.cached_frame_cache(handle, frame) else {
            return false;
        };
        out[..4].copy_from_slice(cache.body_motion(frame as usize));
        true
    }

    /// Packed cached-only [vx, vy, angular momentum, radius, contact] per frame.
    pub(crate) fn motion_window_into(
        &mut self,
        handle: u32,
        start: i32,
        end: i32,
        out: &mut Vec<f64>,
    ) -> bool {
        if start < 0 || end < start {
            return false;
        }
        let Some(cache) = self.cached_frame_cache(handle, end) else {
            return false;
        };
        out.clear();
        out.reserve((end - start + 1) as usize * 5);
        for frame in start as usize..=end as usize {
            out.extend_from_slice(cache.body_motion(frame));
            out.push((!cache.events_at(frame).is_empty()) as u8 as f64);
        }
        true
    }

    pub(crate) fn collision_trace_into(&self, handle: u32, out: &mut [f64]) -> usize {
        let Some(version) = self.versions.get(handle as usize).and_then(Option::as_ref) else {
            return 0;
        };
        let Some(trace) = &version.trace else {
            return 0;
        };
        out[..trace.points.len()].copy_from_slice(&trace.points);
        trace.count
    }

    pub(crate) fn last_frame_index(&mut self, h: u32) -> i32 {
        if !self.valid(h) {
            return -1;
        }
        self.update_computed(h);
        let lineage = self.ver(h as i32).lineage;
        self.lineages[lineage as usize]
            .as_ref()
            .unwrap()
            .cache
            .last_frame_index()
    }

    /// Compute (if needed) frame `f` of version `h` and write it into `out`:
    /// 12 entities × [px,py,prevx,prevy,vx,vy] (72 f64), then 12 fsu. No-op (leaves
    /// `out` untouched) on an invalid handle or negative frame. The typed wrapper
    /// rejects invalid reads before entering this private ABI.
    pub(crate) fn state_into(&mut self, h: u32, f: i32, out: &mut [f64]) {
        let Some(cache) = self.frame_cache(h, f) else {
            return;
        };
        let f = f as usize;
        let s = cache.frame(f);
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

    /// getRider, computed in Rust to avoid rebuilding the JS stateMap.
    /// Writes the summary, then the sled points. The summary: avg BODY pos.x/y, avg BODY vel.x/y (summed in BODY order then /6
    /// — bit-identical to Rider.getBody), then the RIDER_MOUNTED and SLED_INTACT fsu
    /// (the only two bindings the detector reads via rider.get(id).isBinded()).
    pub(crate) fn rider_into(&mut self, h: u32, f: i32, out: &mut [f64]) {
        let Some(cache) = self.frame_cache(h, f) else {
            return;
        };
        let f = f as usize;
        let s = cache.frame(f);
        let summary = cache.summary(f);
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

    /// Read all ordered collisions; the transport buffer retains its allocation.
    pub(crate) fn events_into(&mut self, h: u32, f: i32, out: &mut Vec<f64>) -> usize {
        let Some(cache) = self.frame_cache(h, f) else {
            return 0;
        };
        write_events(cache.events_at(f as usize), out)
    }

    pub(crate) fn cached_events_into(
        &mut self,
        h: u32,
        f: i32,
        out: &mut Vec<f64>,
    ) -> Option<usize> {
        let cache = self.cached_frame_cache(h, f)?;
        Some(write_events(cache.events_at(f as usize), out))
    }

    pub(crate) fn has_contact(&mut self, h: u32, f: i32) -> Option<bool> {
        let cache = self.cached_frame_cache(h, f)?;
        Some(!cache.events_at(f as usize).is_empty())
    }

    /// Combined detector hot path: compute frame `f` once, then write the getRider
    /// summary and first-contact point order to `scratch`, and the already
    /// deduplicated contact line ids to `contacts`. Never rebuild a cached summary.
    pub(crate) fn raw_frame_into(
        &mut self,
        h: u32,
        f: i32,
        scratch: &mut [f64],
        contacts: &mut Vec<f64>,
    ) -> usize {
        let Some(cache) = self.frame_cache(h, f) else {
            return 0;
        };
        let f = f as usize;
        let summary = cache.summary(f);
        write_raw_summary(summary, scratch);
        let count = summary.contact_count;
        grow_output(contacts, count);
        contacts[..count].copy_from_slice(
            cache.contacts(summary.contact_offset, summary.contact_offset + count),
        );
        count
    }

    /// Cached raw frames: the scalar payload, followed by contact offset/count.
    /// Read the complete window in one arena borrow without advancing physics.
    pub(crate) fn raw_window_into(
        &mut self,
        h: u32,
        start: i32,
        end: i32,
        out: &mut Vec<f64>,
        contacts: &mut Vec<f64>,
    ) -> i32 {
        if start < 0 || end < start {
            return -1;
        }
        let Some(cache) = self.cached_frame_cache(h, end) else {
            return -1;
        };
        let first_contact = cache.summary(start as usize).contact_offset;
        let last = cache.summary(end as usize);
        let contact_count = last.contact_offset + last.contact_count - first_contact;
        contacts.clear();
        contacts.extend_from_slice(cache.contacts(first_contact, first_contact + contact_count));
        let frame_count = (end - start + 1) as usize;
        grow_output(out, frame_count * RAW_FRAME_STRIDE);
        for i in 0..frame_count {
            let summary = cache.summary(start as usize + i);
            let row = &mut out[i * RAW_FRAME_STRIDE..(i + 1) * RAW_FRAME_STRIDE];
            write_raw_summary(summary, row);
            row[11] = (summary.contact_offset - first_contact) as f64;
            row[12] = summary.contact_count as f64;
        }
        contact_count as i32
    }

    /// Detach an already-computed immutable prefix into an independent lineage.
    /// Share its backing cache until a write; no stepping or new initial state.
    /// FrameCache::clone resets borrowed line queries when copy-on-write is necessary.
    pub(crate) fn detach(&mut self, h: u32) -> u32 {
        self.update_computed(h);
        let (cache, start, start_generation) = {
            let v = self.ver(h as i32);
            (
                self.lineages[v.lineage as usize]
                    .as_ref()
                    .unwrap()
                    .cache
                    .clone(),
                v.start,
                v.start_generation,
            )
        };
        let lineage = if let Some(id) = self.free_lineages.pop() {
            id
        } else {
            self.lineages.push(None);
            (self.lineages.len() - 1) as u32
        };
        let vid = self.alloc_version(Version {
            lineage,
            parent: -1,
            depth: 0,
            patch: Patch::Root,
            start,
            start_generation,
            freed: false,
            trace: None,
            children: 0,
        });
        self.lineages[lineage as usize] = Some(Lineage {
            cache,
            current: vid as i32,
            live: 1,
            version_ids: vec![vid],
        });
        vid
    }

    /// Evict the requested frame so a subsequent metered read records its solver
    /// states. This API performs no stepping: the caller charges the actual replay.
    pub(crate) fn prepare_collision_trace(&mut self, h: u32, frame: i32) {
        assert!(frame > 0);
        self.update_computed(h);
        let lineage = self.ver(h as i32).lineage;
        let cache = &mut self.lineages[lineage as usize].as_mut().unwrap().cache;
        if cache.frame_count() > frame as usize {
            Rc::make_mut(cache).set_frames_length(frame as usize);
        }
        let trace = &mut self.versions[h as usize].as_mut().unwrap().trace;
        if let Some(trace) = trace {
            trace.reset(frame);
        } else {
            *trace = Some(Box::new(CollisionTrace::new(frame)));
        }
    }

    /// Read only already-computed collision positions. A missing window is an error,
    /// never an implicit unmetered simulation. Branch invalidation applies normally.
    pub(crate) fn contact_positions(
        &mut self,
        h: u32,
        start: i32,
        end: i32,
        out: &mut Vec<f64>,
    ) -> bool {
        out.clear();
        if start < 0 || end < start {
            return false;
        }
        let Some(cache) = self.cached_frame_cache(h, end) else {
            return false;
        };
        for f in start as usize..=end as usize {
            for &(_, id, _, x, y) in cache.events_at(f) {
                out.extend_from_slice(&[id as f64, x, y]);
            }
        }
        true
    }
}

// Transport buffers retain their initialized high-water prefix. Only the count
// returned by the read is logical output; no per-entry capacity checks or caps.
fn grow_output(out: &mut Vec<f64>, needed: usize) {
    if out.len() < needed {
        out.resize(needed, 0.0);
    }
}

fn write_events(events: &[crate::kernel::Collision], out: &mut Vec<f64>) -> usize {
    grow_output(out, events.len() * 3);
    for (record, &(iteration, line, point, _, _)) in out.chunks_exact_mut(3).zip(events) {
        record[0] = iteration as f64;
        record[1] = line as f64;
        record[2] = point as f64;
    }
    events.len()
}

fn write_raw_summary(summary: &FrameSummary, out: &mut [f64]) {
    out[..7].copy_from_slice(&[
        summary.body_px,
        summary.body_py,
        summary.body_vx,
        summary.body_vy,
        summary.rider_fsu as f64,
        summary.sled_fsu as f64,
        summary.sled_count as f64,
    ]);
    for (i, point) in summary.sled_points[..summary.sled_count as usize]
        .iter()
        .enumerate()
    {
        out[7 + i] = *point as f64;
    }
}

thread_local! {
    static ARENA: RefCell<EngineArena> = const { RefCell::new(EngineArena::new()) };
}

pub(crate) fn with_arena<R>(operation: impl FnOnce(&mut EngineArena) -> R) -> R {
    ARENA.with(|arena| operation(&mut arena.borrow_mut()))
}

#[cfg(test)]
mod ownership_tests {
    use super::*;
    #[test]
    fn arena_scope_rejects_reentry_and_releases_its_borrow_after_unwind() {
        let handle = with_arena(|arena| arena.create());
        let nested = std::panic::catch_unwind(|| {
            with_arena(|_| with_arena(|arena| arena.last_frame_index(handle)))
        });
        assert!(nested.is_err());
        with_arena(|arena| {
            assert_eq!(arena.last_frame_index(handle), 0);
            arena.free(handle);
        });
    }

    #[test]
    fn independently_owned_arenas_do_not_share_handles_or_reconciliation() {
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
    fn event_output_keeps_every_record_past_the_former_capacity() {
        let events: Vec<_> = (0..20_000)
            .map(|i| ((i % 6) as u8, i, i % 12, 1.0, 2.0))
            .collect();
        let mut output = Vec::new();
        assert_eq!(write_events(&events, &mut output), 20_000);
        assert_eq!(output.len(), 60_000);
        for (i, record) in output.chunks_exact(3).enumerate() {
            assert_eq!(record, &[(i % 6) as f64, i as f64, (i % 12) as f64]);
        }
        let allocation = output.as_ptr();
        assert_eq!(write_events(&events[..2], &mut output), 2);
        assert_eq!(output.as_ptr(), allocation);
        assert_eq!(&output[..6], &[0.0, 0.0, 0.0, 1.0, 1.0, 1.0]);
        assert_eq!(write_events(&[], &mut output), 0);
        assert_eq!(output.as_ptr(), allocation);
    }

    #[test]
    fn traces_belong_to_versions_and_pending_sibling_replay_is_visible() {
        let mut arena = EngineArena::new();
        let base = arena.create();
        let sibling = arena.add_line(base, 7, 0, 10000.0, 10000.0, 11000.0, 10000.0, 0);
        let unrelated = arena.create();
        arena.prepare_collision_trace(base, 4);
        arena.prepare_collision_trace(sibling, 4);
        arena.prepare_collision_trace(unrelated, 4);
        let mut state = [0.0; 84];
        let mut trace = [0.0; crate::ITERATE * NENT * 6];
        arena.state_into(base, 4, &mut state);
        assert_eq!(arena.collision_trace_into(base, &mut trace), 6);
        let expected = trace;
        assert_eq!(arena.collision_trace_into(sibling, &mut trace), 0);
        assert_eq!(arena.collision_trace_into(unrelated, &mut trace), 0);
        assert_eq!(
            arena.last_frame_index(sibling),
            3,
            "pending trace exposes replay cost before a metered read"
        );
        arena.state_into(sibling, 4, &mut state);
        assert_eq!(arena.collision_trace_into(sibling, &mut trace), 6);
        assert_eq!(trace, expected);
        arena.state_into(unrelated, 10, &mut state);
        assert_eq!(arena.collision_trace_into(base, &mut trace), 6);
        assert_eq!(
            trace, expected,
            "another lineage must not overwrite an observation"
        );
        let child = arena.add_line(base, 8, 0, 12000.0, 10000.0, 13000.0, 10000.0, 0);
        assert_eq!(
            arena.collision_trace_into(child, &mut trace),
            0,
            "children do not inherit observations"
        );
        assert_eq!(arena.collision_trace_into(base, &mut trace), 6);
        assert_eq!(
            trace, expected,
            "lazy history replay must not record observations"
        );
        arena.free(base);
        assert_eq!(
            arena.collision_trace_into(base, &mut trace),
            0,
            "releasing a version releases its observation"
        );
    }

    #[test]
    fn released_branches_preserve_live_descendants_and_cache_ancestry() {
        let mut arena = EngineArena::new();
        let unrelated = arena.create();
        let root = arena.create();
        let start = arena.set_start(root, 0.0, -15.0, 4.0, 0.0);
        arena.free(root);
        let base = arena.add_line(start, 1, 0, -50.0, 10.0, 400.0, 10.0, 0);
        arena.free(start);
        let mut expected = [0.0; 84];
        arena.state_into(base, 40, &mut expected);
        let branch = arena.add_line(base, 2, 0, 600.0, 10.0, 700.0, 10.0, 0);
        arena.free(branch);
        assert!(
            arena.valid(branch),
            "cache current still needs its ancestry"
        );
        arena.last_frame_index(base);
        assert!(
            !arena.valid(branch),
            "released branch should be reclaimed after reconcile"
        );
        let mut actual = [0.0; 84];
        arena.state_into(base, 40, &mut actual);
        assert_eq!(actual, expected);
        let parent = arena.add_line(base, 3, 0, 600.0, 10.0, 700.0, 10.0, 0);
        assert_ne!(
            parent, branch,
            "dead slots cannot be reused inside a live lineage"
        );
        let leaf = arena.add_line(parent, 4, 0, 700.0, 10.0, 800.0, 10.0, 0);
        arena.free(parent);
        assert!(arena.valid(parent), "live child owns ancestry");
        arena.last_frame_index(base);
        assert!(arena.valid(parent));
        arena.state_into(leaf, 40, &mut actual);
        assert_eq!(actual, expected);
        arena.free(leaf);
        assert!(arena.valid(leaf), "cache still owns this branch");
        arena.last_frame_index(base);
        assert!(!arena.valid(leaf));
        assert!(!arena.valid(parent));
        arena.state_into(base, 40, &mut actual);
        assert_eq!(actual, expected);
        arena.free(base);
        assert!(!arena.valid(base));
        assert!(!arena.valid(root));
        assert!(!arena.valid(start));
        assert_eq!(
            arena.last_frame_index(unrelated),
            0,
            "other lineage is caller-owned"
        );
        arena.free(unrelated);
    }

    #[test]
    fn detached_prefixes_isolate_reads_edits_trace_eviction_and_released_sources() {
        let mut arena = EngineArena::new();
        let root = arena.create();
        let start = arena.set_start(root, 0.0, -15.0, 4.0, 0.0);
        arena.free(root);
        let base = arena.add_line(start, 1, 0, -50.0, 10.0, 800.0, 10.0, 0);
        arena.free(start);
        let mut at60 = [0.0; 84];
        arena.state_into(base, 60, &mut at60);
        let detached = arena.detach(base);
        let mut actual = [0.0; 84];
        arena.state_into(detached, 60, &mut actual);
        assert_eq!(actual, at60);
        let mut at100 = [0.0; 84];
        arena.state_into(detached, 100, &mut at100);
        assert_eq!(
            arena.last_frame_index(base),
            60,
            "extending a detached prefix must not extend its source"
        );
        arena.state_into(base, 60, &mut actual);
        assert_eq!(actual, at60);
        arena.state_into(base, 100, &mut actual);
        assert_eq!(actual, at100);
        let edited = arena.add_line(base, 2, 0, -50.0, 8.0, 800.0, 8.0, 0);
        arena.state_into(edited, 100, &mut actual);
        assert_ne!(actual, at100);
        assert_eq!(arena.last_frame_index(detached), 100);
        arena.state_into(detached, 100, &mut actual);
        assert_eq!(actual, at100);
        arena.prepare_collision_trace(detached, 40);
        assert_eq!(arena.last_frame_index(detached), 39);
        assert_eq!(
            arena.last_frame_index(edited),
            100,
            "trace eviction belongs only to its lineage"
        );
        arena.state_into(detached, 100, &mut actual);
        assert_eq!(actual, at100);
        let reset = arena.set_start(detached, 10.0, -25.0, 2.0, 1.0);
        assert_eq!(arena.last_frame_index(reset), 0);
        assert_eq!(arena.last_frame_index(edited), 100);
        arena.state_into(detached, 100, &mut actual);
        assert_eq!(actual, at100);
        let mut expected = [0.0; 84];
        arena.state_into(detached, 120, &mut expected);
        let transferred = arena.detach(detached);
        arena.free(reset);
        arena.free(detached);
        arena.free(edited);
        arena.free(base);
        arena.state_into(transferred, 120, &mut actual);
        assert_eq!(actual, expected);
        arena.state_into(transferred, 140, &mut actual);
        assert_eq!(arena.last_frame_index(transferred), 140);
        arena.free(transferred);
    }
}
