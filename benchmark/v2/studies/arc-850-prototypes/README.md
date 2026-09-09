# Arc 850 research source

These compact patches preserve the three independent experimental checkouts
used by this campaign. Apply each separately to the base commit recorded in
its provenance JSON (975e7a63); they are not cumulative and are not deployed
compiler settings. Panel plans in the local archive bind the exact source and
options used by each measured trial, including earlier revisions of these
prototypes. The final patch alone does not represent every earlier panel.

- `learning`: boundary and memory prototypes, response-step and damping trials.
- `search`: additional response-memory distance and value-weight experiments.
- `objective`: control-policy mixtures and nearest measured examples; this
  produced the selected 852.1248 candidate before typed public integration.

Full source copies, all intermediate panel snapshots, model artifacts, datasets,
commands and adverse results remain in `archives/arc-850-852/`. The deployed
implementation is in `scripts/v0/optimizer/`, with dedicated memory and boundary
modules and without the unsuccessful experimental knobs. The compact research
summary is `../arc-850-research.json`.
