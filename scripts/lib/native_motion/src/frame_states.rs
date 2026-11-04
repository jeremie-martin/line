//! Saved physics states share immutable chunks across detached engine caches.
//! Truncation changes the visible prefix; only an appended partial chunk needs
//! copying. The solver's mutable working state remains outside this store.

use crate::kernel::State;
use std::{ops::Index, rc::Rc};

const CHUNK_FRAMES: usize = 64;

#[derive(Clone, Default)]
pub(crate) struct FrameStates {
    chunks: Vec<Rc<Vec<State>>>,
    len: usize,
}

impl FrameStates {
    pub(crate) fn new(initial: State) -> Self {
        let mut states = Self::default();
        states.push(initial);
        states
    }

    pub(crate) fn len(&self) -> usize { self.len }

    pub(crate) fn clear(&mut self) {
        self.chunks.clear();
        self.len = 0;
    }

    pub(crate) fn truncate(&mut self, len: usize) {
        if len >= self.len { return; }
        self.chunks.truncate(len.div_ceil(CHUNK_FRAMES));
        self.len = len;
    }

    pub(crate) fn push(&mut self, state: State) {
        let offset = self.len % CHUNK_FRAMES;
        if offset == 0 {
            self.chunks.push(Rc::new(Vec::with_capacity(CHUNK_FRAMES)));
        }
        let tail = Rc::make_mut(self.chunks.last_mut().unwrap());
        tail.truncate(offset);
        tail.push(state);
        self.len += 1;
    }
}

impl Index<usize> for FrameStates {
    type Output = State;
    fn index(&self, index: usize) -> &State {
        assert!(index < self.len, "frame outside the saved prefix");
        &self.chunks[index / CHUNK_FRAMES][index % CHUNK_FRAMES]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kernel::init_state;

    #[test]
    fn fork_truncate_append_and_reset_preserve_every_retained_state() {
        for length in [1, 63, 64, 65, 127, 128, 129, 2048] {
            let mut original = FrameStates::default();
            for frame in 0..length { original.push(init_state(frame as f64, 0.0, 0.0, 0.0)); }
            for retained in [0, length / 2, length - 1, length] {
                let mut branch = original.clone();
                branch.truncate(retained);
                for frame in retained..retained + 100 {
                    branch.push(init_state(-(frame as f64), 0.0, 0.0, 0.0));
                }
                assert_eq!(original.len(), length);
                assert_eq!(branch.len(), retained + 100);
                for frame in 0..length { assert_eq!(original[frame].px[crate::PEG], frame as f64); }
                for frame in 0..branch.len() {
                    let expected = if frame < retained { frame as f64 } else { -(frame as f64) };
                    assert_eq!(branch[frame].px[crate::PEG], expected);
                }
                for chunk in 0..retained / CHUNK_FRAMES {
                    assert!(Rc::ptr_eq(&original.chunks[chunk], &branch.chunks[chunk]));
                }
                branch.clear();
                branch.push(init_state(5000.0, 0.0, 0.0, 0.0));
                assert_eq!(branch.len(), 1);
                assert_eq!(branch[0].px[crate::PEG], 5000.0);
                assert_eq!(original[0].px[crate::PEG], 0.0);
            }
        }
    }

    #[test]
    #[should_panic(expected = "frame outside the saved prefix")]
    fn truncated_tail_is_not_readable() {
        let mut states = FrameStates::new(init_state(0.0, 0.0, 0.0, 0.0));
        states.push(init_state(1.0, 0.0, 0.0, 0.0));
        let _other = states.clone();
        states.truncate(1);
        let _ = &states[1];
    }
}
