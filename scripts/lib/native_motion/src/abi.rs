//! Private compiler ABI, shipped together with wasm.ts. Exchange buffers are
//! borrowed until the next WASM call; the wrapper refreshes views after growth.
//! Engine state and observations are owned by the arena, not these buffers.

use crate::engine::with_arena;
use crate::line::{Line, LineRef};
use crate::{ITERATE, NENT};

// Variable outputs retain high-water storage and publish only their returned
// logical prefix. No batch-simulation limit constrains a stateful read.
static mut WINDOW: Vec<f64> = Vec::new();
static mut WINDOW_CONTACTS: Vec<f64> = Vec::new();
static mut EVENTS: Vec<f64> = Vec::new();

// State: 12 entities × six coordinates, then 12 binding counters.
// EVENTS carries ordered collision triples for update reads, or deduplicated
// contact line ids for raw-frame reads. Each operation returns its logical count.
const SCRATCH_LEN: usize = NENT * 6 + NENT;
static mut SCRATCH: [f64; SCRATCH_LEN] = [0.0; SCRATCH_LEN];
// add_lines batch input: per line (id, type, flags) in ADD_IDS and (x1, y1, x2, y2)
// in ADD_COORDS, for up to ADD_LINES_CAP lines.
const ADD_LINES_CAP: usize = 4096;
static mut ADD_IDS: [i32; ADD_LINES_CAP * 3] = [0; ADD_LINES_CAP * 3];
static mut ADD_COORDS: [f64; ADD_LINES_CAP * 4] = [0.0; ADD_LINES_CAP * 4];

#[no_mangle]
pub extern "C" fn window_ptr() -> u32 {
    unsafe { (&*&raw const WINDOW).as_ptr() as u32 }
}
#[no_mangle]
pub extern "C" fn window_contacts_ptr() -> u32 {
    unsafe { (&*&raw const WINDOW_CONTACTS).as_ptr() as u32 }
}
#[no_mangle]
pub extern "C" fn scratch_ptr() -> u32 {
    &raw const SCRATCH as u32
}
#[no_mangle]
pub extern "C" fn events_ptr() -> u32 {
    unsafe { (&*&raw const EVENTS).as_ptr() as u32 }
}
#[no_mangle]
pub extern "C" fn add_ids_ptr() -> u32 {
    &raw const ADD_IDS as u32
}
#[no_mangle]
pub extern "C" fn add_coords_ptr() -> u32 {
    &raw const ADD_COORDS as u32
}
#[no_mangle]
pub extern "C" fn add_lines_cap() -> u32 {
    ADD_LINES_CAP as u32
}

// ── stateful engine ABI (handles = version ids in engine.rs) ──
#[no_mangle]
pub extern "C" fn create_engine() -> u32 {
    with_arena(|arena| arena.create())
}

// Release the external ownership of a version. Descendants and the current cache
// retain any ancestry they need. Slots become reusable only at lineage death.
#[no_mangle]
pub extern "C" fn free_engine(h: u32) {
    with_arena(|arena| arena.free(h));
}

#[no_mangle]
pub extern "C" fn set_start(h: u32, px: f64, py: f64, vx: f64, vy: f64) -> u32 {
    with_arena(|arena| arena.set_start(h, px, py, vx, vy))
}

/// addLine for the first `n` lines of the ADD_IDS/ADD_COORDS buffers as one
/// version, applying the same ordered geometry edits for every batch size.
#[no_mangle]
pub extern "C" fn add_lines(h: u32, n: u32) -> u32 {
    let n = (n as usize).min(ADD_LINES_CAP);
    let ids = unsafe { &*&raw const ADD_IDS };
    let coords = unsafe { &*&raw const ADD_COORDS };
    let lines = (0..n)
        .map(|k| {
            Line::new(
                ids[k * 3],
                coords[k * 4],
                coords[k * 4 + 1],
                coords[k * 4 + 2],
                coords[k * 4 + 3],
                ids[k * 3 + 1] as i64,
                ids[k * 3 + 2] as i64,
            )
        })
        .collect();
    with_arena(|arena| arena.add_lines(h, LineRef::batch(lines)))
}

#[no_mangle]
pub extern "C" fn get_last_frame_index(h: u32) -> i32 {
    with_arena(|arena| arena.last_frame_index(h))
}

#[no_mangle]
pub extern "C" fn get_state_map(h: u32, f: i32) {
    let out = unsafe { &mut *&raw mut SCRATCH };
    with_arena(|arena| arena.state_into(h, f, out));
}

#[no_mangle]
pub extern "C" fn get_body_motion(h: u32, f: i32) -> i32 {
    let out = unsafe { &mut *&raw mut SCRATCH };
    with_arena(|arena| arena.body_motion_into(h, f, out)) as i32
}

// Rider summary at the head of SCRATCH (avg pos.x/y, avg vel.x/y, RIDER_MOUNTED fsu,
// SLED_INTACT fsu), then the sled points.
#[no_mangle]
pub extern "C" fn get_rider(h: u32, f: i32) {
    let out = unsafe { &mut *&raw mut SCRATCH };
    with_arena(|arena| arena.rider_into(h, f, out));
}

#[no_mangle]
pub extern "C" fn advance_while_bound(h: u32, frame: i32) -> i32 {
    with_arena(|arena| arena.advance_while_bound(h, frame)) as i32
}

#[no_mangle]
pub extern "C" fn get_updates(h: u32, f: i32) -> i32 {
    let out = unsafe { &mut *&raw mut EVENTS };
    with_arena(|arena| arena.events_into(h, f, out)) as i32
}

#[no_mangle]
pub extern "C" fn get_cached_events(h: u32, f: i32) -> i32 {
    let out = unsafe { &mut *&raw mut EVENTS };
    with_arena(|arena| arena.cached_events_into(h, f, out)).map_or(-1, |n| n as i32)
}

#[no_mangle]
pub extern "C" fn has_contact(h: u32, f: i32) -> i32 {
    with_arena(|arena| arena.has_contact(h, f)).map_or(-1, |contact| contact as i32)
}

#[no_mangle]
pub extern "C" fn get_raw_frame(h: u32, f: i32) -> i32 {
    let scratch = unsafe { &mut *&raw mut SCRATCH };
    let events = unsafe { &mut *&raw mut EVENTS };
    with_arena(|arena| arena.raw_frame_into(h, f, scratch, events)) as i32
}

#[no_mangle]
pub extern "C" fn get_raw_window(h: u32, start: i32, end: i32) -> i32 {
    let out = unsafe { &mut *&raw mut WINDOW };
    let contacts = unsafe { &mut *&raw mut WINDOW_CONTACTS };
    with_arena(|arena| arena.raw_window_into(h, start, end, out, contacts))
}

#[no_mangle]
pub extern "C" fn get_motion_window(h: u32, start: i32, end: i32) -> i32 {
    let out = unsafe { &mut *&raw mut WINDOW };
    with_arena(|arena| arena.motion_window_into(h, start, end, out)) as i32
}

#[no_mangle]
pub extern "C" fn detach_engine(h: u32) -> u32 {
    with_arena(|arena| arena.detach(h))
}

#[no_mangle]
pub extern "C" fn prepare_collision_trace(h: u32, frame: i32) {
    with_arena(|arena| arena.prepare_collision_trace(h, frame));
}
static mut TRACE: [f64; ITERATE * NENT * 6] = [0.0; ITERATE * NENT * 6];
#[no_mangle]
pub extern "C" fn collision_trace_ptr() -> u32 {
    &raw const TRACE as u32
}
#[no_mangle]
pub extern "C" fn get_collision_trace(h: u32) -> u32 {
    let out = unsafe { &mut *&raw mut TRACE };
    with_arena(|arena| arena.collision_trace_into(h, out)) as u32
}

// A read buffer only: records are owned by the normal per-lineage frame cache.
static mut CONTACT_POSITIONS: Vec<f64> = Vec::new();
#[no_mangle]
pub extern "C" fn get_contact_positions(h: u32, start: i32, end: i32) -> i32 {
    let out = unsafe { &mut *&raw mut CONTACT_POSITIONS };
    if with_arena(|arena| arena.contact_positions(h, start, end, out)) {
        (out.len() / 3) as i32
    } else {
        -1
    }
}
#[no_mangle]
pub extern "C" fn contact_positions_ptr() -> u32 {
    unsafe { (&*&raw const CONTACT_POSITIONS).as_ptr() as u32 }
}
