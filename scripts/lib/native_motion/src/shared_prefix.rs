//! Append-only values share immutable chunks across detached engine caches.
//! Truncation changes the visible prefix; only an appended partial chunk needs
//! copying. No mutable reference can escape this store.

use std::{ops::Index, rc::Rc};

const CHUNK_VALUES: usize = 64;

#[derive(Clone)]
pub(crate) struct SharedPrefix<T> {
    chunks: Vec<Rc<Vec<T>>>,
    len: usize,
}

impl<T> Default for SharedPrefix<T> {
    fn default() -> Self { Self { chunks: Vec::new(), len: 0 } }
}

impl<T: Clone> SharedPrefix<T> {
    pub(crate) fn new(initial: T) -> Self {
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
        self.chunks.truncate(len.div_ceil(CHUNK_VALUES));
        self.len = len;
    }

    pub(crate) fn push(&mut self, value: T) {
        let offset = self.len % CHUNK_VALUES;
        if offset == 0 {
            self.chunks.push(Rc::new(Vec::with_capacity(CHUNK_VALUES)));
        }
        let tail = Rc::make_mut(self.chunks.last_mut().unwrap());
        tail.truncate(offset);
        tail.push(value);
        self.len += 1;
    }
}

impl<T> Index<usize> for SharedPrefix<T> {
    type Output = T;
    fn index(&self, index: usize) -> &T {
        assert!(index < self.len, "index outside the saved prefix");
        &self.chunks[index / CHUNK_VALUES][index % CHUNK_VALUES]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kernel::init_state;

    #[test]
    fn fork_truncate_append_and_reset_preserve_every_retained_state() {
        for length in [1, 63, 64, 65, 127, 128, 129, 2048] {
            let mut original = SharedPrefix::default();
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
                for chunk in 0..retained / CHUNK_VALUES {
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
    #[should_panic(expected = "index outside the saved prefix")]
    fn truncated_tail_is_not_readable() {
        let mut states = SharedPrefix::new(init_state(0.0, 0.0, 0.0, 0.0));
        states.push(init_state(1.0, 0.0, 0.0, 0.0));
        let _other = states.clone();
        states.truncate(1);
        let _ = &states[1];
    }
}
