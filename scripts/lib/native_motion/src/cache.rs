//! Computed frames and their derived indexes for one lineage. Geometry edits
//! invalidate this cache in reference order; history is materialized only when
//! an edit needs it. Copying the cache resets its borrowed query shortcuts.

use crate::grid::{LineGrid, IntMap};
use crate::shared_prefix::SharedPrefix;
use crate::history::CollisionHistory;
use crate::kernel::{
    init_state, step_state, CollisionTrace, LineCellCache, State,
};
use crate::line::{push_line, remove_line, LineRef};
use crate::{
    BUTT, LFOOT, LHAND, NENT, NOSE, PEG, RFOOT, RHAND, RIDER_MOUNTED, SHOULDER, SLED_INTACT,
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

// ── the single shared cache per lineage (LineEngine.__computed__ + Frame.grid/collisions) ──
#[derive(Clone)]
pub(crate) struct FrameCache {
    cell_lines: LineGrid, // ClassicGrid cellLinesMap (collision lookup)
    line_cache: LineCellCache,             // shortcut valid until the line grid changes
    lines: IntMap<i32, LineRef>, // id → shared geometry, including its removal footprint
    frames: SharedPrefix<State>,                        // frames[0] = initial; lazily extended
    events: Vec<Event>,                        // flat per-frame collision records
    event_offsets: Vec<usize>,                 // frame f => events[offset[f]..offset[f+1]]
    summaries: Vec<FrameSummary>, // per-frame compact read summaries for repeated detector windows
    contact_ids: Vec<f64>,        // flat per-frame sled contact line ids used by raw-frame reads
    // Invalidation indexes are materialized lazily, without recharging frames.
    history: CollisionHistory,
}

impl FrameCache {
    pub(crate) fn new() -> FrameCache {
        let s = init_state(0.0, 0.0, 0.4, 0.0); // DEFAULT_START
        let mut contact_ids = Vec::new();
        let summary = Self::summarize_frame(&s, &[], &mut contact_ids);
        FrameCache {
            cell_lines: LineGrid::default(),
            line_cache: LineCellCache::default(),
            lines: IntMap::default(),
            frames: SharedPrefix::new(s),
            events: Vec::new(),
            event_offsets: vec![0, 0],
            summaries: vec![summary],
            contact_ids,
            history: CollisionHistory::new(),
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
            self.contact_ids
                .truncate(self.summaries[len].contact_offset);
            self.summaries.truncate(len);
        }
    }

    /// Geometry registration never simulates between lines. Their invalidations
    /// therefore compose as one minimum over the same history, followed by one
    /// truncation. Preserve insertion order, including repeated line ids.
    pub(crate) fn add_lines(&mut self, lines: &[LineRef]) {
        if !lines.iter().any(|line| line.collidable) { return; }
        self.ensure_history();
        if let Some(first) = self.history.first_for_added_lines(lines, i32::MAX) {
            self.set_frames_length(first as usize);
        }
        self.line_cache.invalidate();
        for line in lines.iter().filter(|line| line.collidable) {
            self.line_cache.include_cells(line.cells());
            push_line(&mut self.cell_lines, line, line.cells());
            self.lines.insert(line.id, line.clone());
        }
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
            if let Some(line) = self.lines.remove(&id) {
                remove_line(&mut self.cell_lines, id, line.cells());
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
        self.frames.push(s);
        self.events.clear();
        self.event_offsets.clear();
        self.event_offsets.extend_from_slice(&[0, 0]);
        self.summaries.clear();
        self.contact_ids.clear();
        let summary = Self::summarize_frame(&self.frames[0], &[], &mut self.contact_ids);
        self.summaries.push(summary);
    }

    fn ensure_history(&mut self) {
        if self.history.len() >= self.frames.len() {
            return;
        }
        // Replay only the missing suffix with TRACK=true. The public frame/event
        // cache was already produced during the read; this pass fills just the
        // invalidation side indexes without changing simulated-frame accounting.
        let mut s = self.frames[self.history.len() - 1].clone();
        let mut events = Vec::new();
        while self.history.len() < self.frames.len() {
            events.clear();
            step_state::<true>(
                &mut s,
                &self.cell_lines,
                &mut events,
                &mut self.history,
                &mut self.line_cache,
                None,
            );
            self.history.finish_frame();
        }
    }

    /// _computeFrame: lazily extend the cache to include frame `frame`.
    pub(crate) fn compute_to(&mut self, frame: usize, mut trace: Option<&mut CollisionTrace>) {
        if self.frames.len() > frame { return; }
        crate::abi::count_steps(frame + 1 - self.frames.len());
        let mut s = self.frames[self.frames.len() - 1].clone();
        while self.frames.len() <= frame {
            let fi = self.frames.len() as i32;
            step_state::<false>(
                &mut s,
                &self.cell_lines,
                &mut self.events,
                &mut self.history,
                &mut self.line_cache,
                trace.as_deref_mut().filter(|trace| trace.frame == fi),
            );
            let summary = Self::summarize_frame(
                &s,
                &self.events[self.event_offsets[fi as usize]..],
                &mut self.contact_ids,
            );
            self.frames.push(s.clone());
            self.event_offsets.push(self.events.len());
            self.summaries.push(summary);
        }
    }

    #[inline]
    pub(crate) fn events_at(&self, f: usize) -> &[Event] {
        &self.events[self.event_offsets[f]..self.event_offsets[f + 1]]
    }

    /// Advance one frame at a time, stopping on the first broken binding. This
    /// shares the ordinary stepping path, including collision trace capture.
    pub(crate) fn advance_while_bound(&mut self, frame: usize, mut trace: Option<&mut CollisionTrace>) -> bool {
        while self.frames.len() <= frame {
            let next = self.frames.len();
            self.compute_to(next, trace.as_deref_mut());
            if !self.is_bound(next) { return false; }
        }
        self.is_bound(frame)
    }

    pub(crate) fn is_bound(&self, frame: usize) -> bool {
        let summary = self.summary(frame);
        summary.rider_fsu == -1 && summary.sled_fsu == -1
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
        &self.contact_ids[start..end]
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

    fn summarize_frame(s: &State, events: &[Event], contact_ids: &mut Vec<f64>) -> FrameSummary {
        let (mut px, mut py, mut vx, mut vy) = (0.0, 0.0, 0.0, 0.0);
        for &entity in BODY.iter() {
            px += s.px[entity];
            py += s.py[entity];
            vx += s.vx[entity];
            vy += s.vy[entity];
        }
        let n_body = BODY.len() as f64;
        let contact_offset = contact_ids.len();
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
            for &seen in contact_ids[contact_offset..].iter() {
                if seen == line_id {
                    seen_line = true;
                    break;
                }
            }
            if !seen_line {
                contact_ids.push(line_id);
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
            contact_count: contact_ids.len() - contact_offset,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::line::build_line;

    #[test]
    fn batched_registration_matches_ordered_single_edits_and_future_replay() {
        let mut base = FrameCache::new();
        base.set_initial_states(0.0, -15.0, 8.0, 0.0);
        base.add_lines(&[build_line(1, -50.0, 10.0, 800.0, 10.0, 0, 0)]);
        base.compute_to(80, None);
        for trial in 0..80 {
            let lines: Vec<_> = (0..24).map(|i| {
                let x = ((i * 31 + trial * 11) % 240 - 50) as f64;
                let y = ((i * 13 + trial * 17) % 60 - 30) as f64;
                build_line(2 + i % 19, x, y, x + 20.0, y + (trial % 5 - 2) as f64 * 10.0,
                    (i % 3) as i64, (trial % 8) as i64)
            }).collect();
            let mut batch = base.clone();
            let mut scalar = base.clone();
            batch.add_lines(&lines);
            for line in &lines { scalar.add_lines(std::slice::from_ref(line)); }
            assert_eq!(batch.last_frame_index(), scalar.last_frame_index());
            batch.compute_to(100, None);
            scalar.compute_to(100, None);
            for frame in 0..=100 {
                let a = batch.frame(frame);
                let b = scalar.frame(frame);
                for (a, b) in [(&a.px, &b.px), (&a.py, &b.py), (&a.prevx, &b.prevx),
                    (&a.prevy, &b.prevy), (&a.vx, &b.vx), (&a.vy, &b.vy)] {
                    assert_eq!(a.map(f64::to_bits), b.map(f64::to_bits));
                }
                assert_eq!(a.fsu, b.fsu);
                assert_eq!(batch.events_at(frame), scalar.events_at(frame));
            }
            let probe = [build_line(90, 0.0, 5.0, 120.0, 10.0, 0, 0)];
            batch.add_lines(&probe);
            scalar.add_lines(&probe);
            assert_eq!(batch.last_frame_index(), scalar.last_frame_index());
        }
    }
}
