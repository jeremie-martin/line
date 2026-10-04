# Impact strength candidates (2026-10-04)

Research only. The product still uses `line.strike.v1`. Nothing here is an
objective until it agrees with the owner's blind judgments on held-out pairs.

Tool: `tools/measure/impact_candidates.ts`. It writes one row per strike event
(`--out=FILE.jsonl`) and has a `--probes` mode for hand-built tracks.

**Blindness.** The candidates were designed without opening any
`labels/studies/*` file. They come from physics, perception and the owner's
verbal description. Two disclosures:

- I read the summary of the earlier slam-2026-10 study in
  `strike-definition-20261004.md`. That summary says that "spin magnitude does
  not predict choices" and that "abrupt stops were chosen as slamming".
- I did not read the round-1 results section of that file.

Nothing was fitted. The thresholds (20°, 3 frames, 0.1) are physical choices,
and their sensitivity is reported below.

## What each measure counts

Every hit changes the centre-of-mass velocity by the contact impulse
`imp = ΔV − g`. The measures differ in which parts of that change they count.

| part of the change | strike (`v̄·Δθ`, ≤ 6 frames) | motion_change (2-frame `abs(imp, ΔL/NR)`) | c_loss (energy) | **c_arrive** |
|---|---|---|---|---|
| turn of direction (landing, corner) | yes | yes | only its energy cost | yes, as speed into the surface |
| stop with no turn (head-on) | **no** (blind spot) | yes | yes | yes |
| speed gained from a push | no | yes | no (reads 0) | no |
| steady pressing (bend, guide curve) | **yes**, summed over 6 frames | partly (2 frames of it) | partly | **no** (a continuing push is subtracted) |
| floor then rail within 2 frames | summed | **cancels** (opposite vectors) | summed | two separate arrivals |
| spin change | no | yes | no | no (`c_arrive_spin`: yes) |
| speed along the surface | grows with it | no | grows (v·Δv) | no |

For a single inelastic floor landing, all four measures agree: each reads
about the normal speed `v·sin α`. They differ only in the rows above, so pairs
must be chosen from those rows.

## Candidates

### 1. `c_arrive`: how hard the rider drives into what it hits

For each contact frame f and each touched line ℓ:

- **Reference normal n.**
  - If a line touched at f−1 is within 20° of ℓ, n is that line's normal. The
    rider is already on that surface: a curve, or the body coming down where
    the sled already sits.
  - Otherwise n is ℓ's own normal (a *fresh* surface: touchdown, corner, or the
    rail on the other side).
- **Arrival speed** `a = max over touching points p of (v_p[f−1] + g)·n`.
- **Steady push** `b = 0` for a fresh surface. Otherwise `b = max(0, −imp[f−1]·n)`,
  the push that surface already gave the frame before.
- **Stopped** `s = Σ max(0, −imp[k]·n − b)` over `k = f … f+2`, counting only
  frames of unbroken contact. This is the centre-of-mass impulse, beyond the
  steady push.
- **Value** `min(a, s)`. The event's value is its strongest arrival. Like the
  other measures it is divided by 7.55.

**Rationale.** The owner describes a hit as the rider slamming or bumping
into geometry and visibly changing direction or speed. Physically, that is
the rider's speed into a surface, killed in a few frames.

- **Point velocities, not the centre of mass.** A rigid sled on a curve is a
  chord. Its centre of mass "approaches" every segment ahead by about
  `v·length/2r`. This read 0.16 on an r = 150 bend in the first draft. A point
  touching a surface it already slides on approaches it at about g.
- **The stop term guards against grazes.** A spinning limb can clip a line at
  high point speed, but the body as a whole is barely stopped.
- **Subtracting the steady push models the eye's prediction.** A force that
  merely continues, such as a bend, resting, or riding through a guide curve,
  is not a new event. This is the owner's "in the continuity".

**Owner statements it addresses:**

- tangential continuity → about 0;
- slam and bump → the speed into the surface;
- head-on → the full speed (strike reads about 0);
- faster into the same surface → linear;
- upper hits → no geometry names needed, because any surface normal works;
- floor then rail → two arrivals;
- "already rotating, then a subtle bump" → small, because nothing is stopped;
- smeared bends → about 0;
- curled-tip bump → the nose's speed into the line, as far as the body stops.

**Expected failure modes:**

- Spin-blind: a rotation reversal with little stopping reads low.
- Blind to speed along the surface. The same drop at horizontal speed 2 or 12
  reads 0.55 both times, while strike reads 0.42 and 0.56.
- Speed-up pushes read 0.
- The 3-frame centre-of-mass stop under-reads large redirections whose body
  follow-through takes longer. A 30° corner at v = 8 reads 0.41, against an
  ideal `8·sin 30°/7.55 = 0.53`.
- It needs the track's line normals. The compiler has them; geometry *names*
  are still not used.

### 2. `c_arrive_spin`: arrival or spin change

`hypot(c_arrive, the largest 2-frame |ΔL|/(N·R) in the event / 7.55)`. Spin
uses motion_change's unit: the change of rotational speed at the radius of
gyration.

- **Purpose.** It tests only whether spin adds anything beyond arrival. A
  reversal (`ΔL ≈ 2L`) outweighs a same-direction speed-up (`ΔL ≈ 0.3L`)
  without any special rule.
- **Power is small.** It exceeds `c_arrive` by more than 0.1 on only 75 of
  3,236 events. 491 events reverse their spin (a sign change, at least
  0.3 px/frame on both sides), with median `c_arrive` 0.38 and median
  `c_arrive_spin` 0.42.

### 3. `c_loss`: ground-frame kinetic energy destroyed (negative result)

`√(2·max(0, Σ_event ½(abs(V[f−1]+g)² − abs(V[f])²)))`, the speed whose kinetic
energy contact removed. I tested it because "loses most of its speed" suggests
an energy framing. **I do not recommend testing it with the owner.** On the
data it fails for physical reasons:

- **It is not Galilean-invariant.** Losing Δv at speed v costs about `v·Δv`.
  - Friction braking reads as a slam. An example is PEG friction in
    july~luna~946081319, f758: from 12.0 to 9.9 px/frame over 5 frames,
    `c_loss` 0.97, strike 0.22.
  - The only invariant energy of a velocity change is `½abs(ΔV)²`, which is
    the momentum measure again.
- **Pushes that speed the rider up read 0.** 11% of events with strike ≥ 0.1
  have a net energy gain. Among them is current~amour~101 f142, strike 1.00:
  a guide rail pushes the inverted rider from 10.7 to 12.9 px/frame.
- Its rank agreement is 0.51 with strike and 0.60 with motion_change.

## Event identity

Arrivals give their own segmentation: each arrival onto a fresh surface is an
impact.

- **Doubles.** 511 strike events contain at least 2 distinct arrivals ≥ 0.1,
  and 109 of them have a second arrival ≥ 0.3. These are almost all floor and
  guide rail bouncing:
  - current and strike sets: 58 and 51;
  - **July: 0**, which is consistent with "July was cleaner".

  Example: strike~amour~303 f568–572. The nose hits the floor, the tail touches
  the guide, and the nose hits the floor again. motion_change reads 0.33,
  because the opposite pushes cancel in its 2-frame sum. Strike reads 0.95,
  `c_arrive` 0.60 plus a second arrival of 0.18.
- **Strong hits strike misses entirely.** 16 fresh arrivals ≥ 0.3 fall outside
  every strike event. All 16 come 6–8 frames after a strike event starts (1–3
  frames after its 6-frame window ends), in the same unbroken contact, with no
  renewal. An example is strike~luna~101: a touchdown of
  0.04 at f192, then an arrival of 0.70 at f198. This is the "hidden strike
  after a weak touch" gap, still present in v1 at the window boundary.
- **Renewals are not over-counted.** Only 1 of the 93 strike renewals ≥ 0.3
  has no arrival ≥ 0.05.

## Evidence

**Determinism.** Two runs of the final tool give identical output: `--out`
sha256 `b0fc3d625e471cfc…` both times.

**Probes** (`--probes`). Each feature is measured over 12 frames from its
first contact. Strike and motion_change are shown as their kernels over the
same window, because strike calls a smooth bend steering and creates no event.

| probe | strike | mc | c_arrive | c_loss | expected |
|---|---|---|---|---|---|
| free flight, 60 frames | 0 | 0 (max abs(imp) 1.7e-13) | 0 | 0 | 0 |
| flat drop h 20 / 60 / 140 | 0.26 / 0.51 / 0.80 | 0.26 / 0.47 / 0.79 | 0.30 / 0.55 / 0.90 | 0.33 / 0.61 / 0.97 | rises; normal speed 2.6 / 4.6 / 7.0 → 0.35 / 0.61 / 0.93 |
| same drop h60, vx 2 / 8 / 12 | 0.42 / 0.55 / 0.56 | 0.47 | 0.55 | 0.61 | owner to decide |
| head-on wall, v 4 | **0.19** | 0.39 | 0.43 | 0.52 | very big |
| 60° ramp, v 4 | 0.29 | 0.33 | 0.39 | 0.46 | big |
| tangential bend r150, v 8 | 0.36 | 0.17 | **0.08** | 0.28 | low |
| tangential bend r60, v 8 | **0.72** | 0.33 | **0.14** | 0.56 | low (90° in 190 ms) |
| 30° corner, v 8 | 0.52 | 0.36 | 0.41 | 0.57 | medium; ideal 0.53 |
| tangential landing on a slope, v 8 | 0.12 | 0.14 | 0.11 | 0.17 | about 0 |

**Probes that end in a crash.** Some probes eject the rider within 2 frames:
h300, head-on v 8, the 60° ramp at v 8, and both ceiling hits (an upright
rider's head hitting a ceiling ejects it). Their numbers are truncated and are
not used. Production upper hits are survivable sled and guide contacts.

**Real rides** (36 rides; 4,130 events, 3,236 with strike ≥ 0.1). Spearman
rank correlation with tie-averaged ranks:

| | strike | motion_change | mcOwn | c_arrive |
|---|---|---|---|---|
| c_arrive | 0.753 | 0.812 | 0.850 | 1 |
| c_arrive_spin | 0.775 | 0.838 | 0.876 | 0.985 |
| c_loss | 0.513 | 0.599 | — | 0.536 |
| motion_change | 0.798 | 1 | 0.957 | 0.812 |
| mcOwn | 0.843 | 0.957 | 1 | 0.850 |

**Where `c_arrive` and strike disagree.** Counting events whose percentiles
differ by more than 0.3:

- strike ≫ `c_arrive`: 273 events. These are smeared, with median crisp 0.45
  against 0.69 overall: valley transitions and guide curves pressing for 5–6
  frames.
- `c_arrive` ≫ strike: 185 events. These are sharp single touchdowns (crisp
  0.94, 176 of them touchdowns).

**Across sets** (median, strike ≥ 0.1):

- strike: July 0.36, current 0.51, strike library 0.59;
- `c_arrive`: 0.33, 0.36, 0.37.

Most of what the strike-optimized libraries gained over July is contact that
`c_arrive` treats as pressing, not arrival. This is a self-grading warning if
`c_arrive` is validated.

**Sensitivity of `c_arrive`.** Rank correlation with the default:

- continuity threshold 10°: 0.927; 30°: 0.974;
- stop window 2 frames: 0.918; 4 frames: 0.967.

**Spinning grazes.** I selected spinning grazes without using any candidate:
top-decile spin before contact, and contact lasting ≤ 2 frames (n = 55). Every
measure ranks them low (median percentile 0.07–0.15). The check is
uninformative; it does not separate the candidates.

## Side findings for the main session

- **motion_change reads past its event.** It reads `onset … onset+5` without
  stopping at `e.end`. For 741 of 4,130 events, that window runs into the next
  event's frames.
  - Example: strike~amor~101 f1530. A 1-frame tail touch reads 0.73 because
    the landing 2 frames later falls inside its window. Clipped, it is 0.19.
  - The tool reports `mcOwn`, the same kernel clipped to the event's frames.
    Its rank correlation with the unclipped value is 0.957.
  - motion_change.ts was not modified.
- **Typecheck is not at 0 errors at HEAD.** `npx tsc --noEmit -p .` reports 4
  errors, all in `tools/measure/select_pairs.ts` line 70 (TS7053), and that
  file is unmodified in the tree. `impact_candidates.ts` adds 0 errors.
  `node tools/deps/reach.mjs` reports 0 unreachable.

## Recommendation

1. **Test `c_arrive` first.** It is the only candidate here that rejects
   smeared bends and guide pressing, reads head-on stops, and separates floor
   from rail without cancelling.
2. **Use `c_arrive_spin` only as a spin toggle,** on the 75 events where it
   differs from `c_arrive`.
3. **Drop `c_loss`.**

**Discriminating pairs**, in priority order. The counts are the events
available among the 3,236:

1. **Pressing against arrival.** Strike high, low crisp and low `c_arrive`,
   against a crisp touchdown with high `c_arrive`, matched on strike. 273
   against 185 events are available. This separates strike from `c_arrive`
   and mcOwn.
2. **Floor then rail.** A double-arrival event (second ≥ 0.3, 109 events)
   against a single hit matched on the first arrival. Ask whether there are
   one or two impacts, and which slams more. motion_change cancels on these.
3. **Stop against turn.** A stop-dominated hit against a redirection matched
   on `c_arrive`. Strike's blind spot: the head-on v 4 probe reads strike 0.19
   against `c_arrive` 0.43.
4. **Speed along the surface.** The same `c_arrive` with different tangential
   speeds. Only strike grows with tangential speed. This decides the owner's
   "faster", which is still ambiguous.
5. **Spin.**
   - From the 75 events where `c_arrive_spin` > `c_arrive` + 0.1, prefer
     reversals (`rotBefore·rotAfter < 0`), against non-spinning hits matched
     on `c_arrive`.
   - From the 196 events where mcOwn ≫ `c_arrive` (25 go the other way), 69
     close the gap once spin is added.

**Power.** If one candidate wins every decisive pair, 8 pairs exclude a true
preference rate ≥ 31% for the loser (`1 − 0.05^(1/n)`), and 12 pairs exclude
≥ 22%. Pair types 4 and 5 rest on few events, so their verdicts need the most
pairs per event.
