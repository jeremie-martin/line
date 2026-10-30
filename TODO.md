# To do

Short list of agreed next tasks. Details and results go to REWORK.md.

1. **Cheaper candidate geometry** (agent, started 2026-10-30). Building and
   registering a candidate's track geometry is now most of a compile's CPU
   (physics is about 16% of a candidate). Structural only: identical tracks,
   proved by parity.
2. **Owner review of the Trouble spec variants** (kick, voice, slam, pulse):
   pick and mix, then the next round.
3. **Diagnosis of unwanted impacts** (agent, no compiler changes). How often
   unrequested hits happen, where (long floats, dense runs, upward hits), why
   the search keeps them, and candidate fixes as hypotheses. Example: slam
   seed 101, 0.38 at 3.85 s mid-float.

2 or 3 comes next after 1, depending on the owner's availability.
