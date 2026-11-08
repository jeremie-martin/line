// How a ride meets its song (generated/concept-lab/docs/TIMING-DESIGN.md). Two clocks: song time s (the recording, the spectrum,
// the sections, the drop, the authored beats) and ride time r (the compiled ride: physics frame f is r = f / 40). One relation:
//
//   r = s + offset      (offset in seconds; positive: the ride is shown that much early)
//
// Nothing else converts between the clocks. Pure, shared by Node and the browser.

export const FPS = 40;
/** A compiled ride runs 20 physics frames past its song (the compiler's tail), so it covers the song for any offset up to this. */
export const MAX_OFFSET = 0.5;

export const rideTime = (s, offset) => s + offset;
export const songTime = (r, offset) => r - offset;
/** The song time at which physics frame f is shown. */
export const songTimeOfFrame = (f, offset) => songTime(f / FPS, offset);

/** A ride's alignment, from its account (scene.ts): offset = the mean, over its matched hits, of (strongest frame − the beat it
 * answered), so that on average an impact's strongest frame meets its authored beat. Equal weight per hit; nothing tuned by hand.
 * A ride is aligned when it has recorded beats, at least one matched hit and an offset in [0, MAX_OFFSET]; otherwise it is shown
 * exactly as compiled (offset 0), and says why. */
export function alignment(account) {
  const asCompiled = reason => ({offset: 0, aligned: false, reason});
  if (!account) return asCompiled('no impact account');
  if (!account.targets.every(t => Number.isFinite(t.beat))) return asCompiled('no recorded beats');
  if (!account.matches.length) return asCompiled('no matched hit');
  const offset = account.matches.reduce((sum, m) => sum + account.events[m.event].peak / FPS - account.targets[m.target].beat, 0) / account.matches.length;
  if (!(offset >= 0 && offset <= MAX_OFFSET)) return asCompiled(`offset ${(offset * 1000).toFixed(1)} ms outside [0, ${MAX_OFFSET * 1000}] ms`);
  return {offset, aligned: true};
}
/** A ride's timing in words: "aligned, 29.7 ms" or "as compiled (no recorded beats)". */
export const describeTiming = ({offset, aligned, reason}) => aligned ? `aligned, ${(offset * 1000).toFixed(1)} ms` : `as compiled (${reason})`;
