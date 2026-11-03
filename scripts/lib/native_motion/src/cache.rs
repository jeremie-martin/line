//! Computed frames and their derived indexes for one lineage. Geometry edits
//! invalidate this cache in reference order; history is materialized only when
//! an edit needs it. Copying the cache resets its borrowed query shortcuts.

use crate::grid::{FlatIntMap, IntMap};
use crate::history::CollisionHistory;
use crate::kernel::{
    compute_rest_endur, init_state, step_state, CollisionTrace, LineCellCache, State,
};
use crate::line::{line_cells, push_line, remove_line, GridLine, Line};
use crate::{
    BUTT, LFOOT, LHAND, NENT, NITER, NOSE, PEG, RFOOT, RHAND, RIDER_MOUNTED, SHOULDER, SLED_INTACT,
    STRING, TAIL,
};
use std::cell::OnceCell;

// parts.BODY in lr-core order — the entities getRider averages (sum in this order
// then /6, matching Rider.getBody's averageVectors so the result is bit-identical).
const BODY: [usize; 6] = [BUTT, SHOULDER, RHAND, LHAND, LFOOT, RFOOT];
const SLED_POINT_MASK: u32 = (1u32 << PEG) | (1u32 << TAIL) | (1u32 << NOSE) | (1u32 << STRING);
type Event = crate::kernel::Collision;

#[derive(Clone)]
pub(crate) struct FrameSummary {
    pub(crate) body_px: f64,
    pub(crate) body_py: f64,
    pub(crate) body_vx: f64,
    pub(crate) body_vy: f64,
    pub(crate) rider_fsu: i32,
    pub(crate) sled_fsu: i32,
    pub(crate) sled_points: [u8; 4], // first-contact order
    pub(crate) sled_count: u8,
    motion: OnceCell<[f64; 4]>, // pure observation; shared snapshots may fill it without copying
    pub(crate) contact_offset: usize,
    pub(crate) contact_count: usize,
}

impl FrameSummary {
    pub(crate) fn sled_mask(&self) -> u32 {
        self.sled_points[..self.sled_count as usize]
            .iter()
            .fold(0, |mask, point| mask | (1 << point))
    }
}

// ── the single shared cache per lineage (LineEngine.__computed__ + Frame.grid/collisions) ──
#[derive(Clone)]
pub(crate) struct FrameCache {
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

impl FrameCache {
    pub(crate) fn new() -> FrameCache {
        let (rest, endur) = compute_rest_endur();
        let s = init_state(0.0, 0.0, 0.4, 0.0); // DEFAULT_START
        let mut candidate_contacts = Vec::new();
        let summary = Self::summarize_frame(&s, &[], &mut candidate_contacts);
        FrameCache {
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

    pub(crate) fn last_frame_index(&self) -> i32 {
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
    pub(crate) fn set_frames_length(&mut self, len: usize) {
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
    pub(crate) fn add_line(&mut self, l: Line) {
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
    pub(crate) fn remove_lines(&mut self, ids: &[i32], removed: &mut Vec<i32>) {
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
    pub(crate) fn set_initial_states(&mut self, px: f64, py: f64, vx: f64, vy: f64) {
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
                None,
            );
            self.history.finish_frame();
        }
    }

    /// _computeFrame: lazily extend the cache to include frame `frame`.
    pub(crate) fn compute_to(&mut self, frame: usize, mut trace: Option<&mut CollisionTrace>) {
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
                trace.as_deref_mut().filter(|trace| trace.frame == fi),
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
    pub(crate) fn events_at(&self, f: usize) -> &[Event] {
        &self.events[self.event_offsets[f]..self.event_offsets[f + 1]]
    }

    pub(crate) fn frame_count(&self) -> usize {
        self.frames.len()
    }
    pub(crate) fn frame(&self, index: usize) -> &State {
        &self.frames[index]
    }
    pub(crate) fn summary(&self, index: usize) -> &FrameSummary {
        &self.summaries[index]
    }
    pub(crate) fn contacts(&self, start: usize, end: usize) -> &[f64] {
        &self.candidate_contacts[start..end]
    }

    /// Derived once per immutable frame, only when an observer asks for it.
    /// Clone preserves valid memo values; reset and rollback discard old frames.
    pub(crate) fn body_motion(&self, frame: usize) -> &[f64; 4] {
        self.summaries[frame].motion.get_or_init(|| {
            let s = self.frame(frame);
            let (mut cx, mut cy, mut vx, mut vy) = (0.0, 0.0, 0.0, 0.0);
            for i in 2..NENT {
                cx += s.px[i];
                cy += s.py[i];
                vx += s.px[i] - s.prevx[i];
                vy += s.py[i] - s.prevy[i];
            }
            cx /= 10.0;
            cy /= 10.0;
            vx /= 10.0;
            vy /= 10.0;
            let (mut momentum, mut radius2) = (0.0, 0.0);
            for i in 2..NENT {
                let rx = s.px[i] - cx;
                let ry = s.py[i] - cy;
                momentum += rx * (s.py[i] - s.prevy[i] - vy) - ry * (s.px[i] - s.prevx[i] - vx);
                radius2 += rx * rx + ry * ry;
            }
            [vx, vy, momentum, (radius2 / 10.0).sqrt()]
        })
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
        let mut sled_points = [0; 4];
        let mut sled_count = 0;
        for &(_, line_id, point_idx, _, _) in events {
            let bit = 1u32 << (point_idx as u32);
            if (SLED_POINT_MASK & bit) == 0 {
                continue;
            }
            if sled_mask & bit == 0 {
                sled_points[sled_count] = point_idx as u8;
                sled_count += 1;
                sled_mask |= bit;
            }
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
            sled_points,
            sled_count: sled_count as u8,
            motion: OnceCell::new(),
            contact_offset,
            contact_count: candidate_contacts.len() - contact_offset,
        }
    }
}
