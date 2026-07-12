# Continuous Support Geometry

## Objective

The compiler must generate useful candidates for short, ordinary, and long gaps
through one continuous physical model. Gap duration is an input, not a case
class. A production design must preserve the quality of ordinary tracks while
making several seconds of low-air supported riding representable.

The existing contact-centered generator is valuable evidence: it produces good
ordinary tracks and contains mature curvature, launch, and diversity choices.
It is not automatically the final representation, nor must it survive as an
exact compatibility branch. Its successful shapes may instead become priors or
basis functions in a more general model.

## Physical boundary

At a contact, the generator observes:

- entry position, velocity, speed, and heading;
- the time until the next authored contact;
- current and next air, speed, impact, elevation, and amplitude targets when
  those axes are defined;
- detector constraints, including the minimum airborne landing window;
- the existing committed track and remaining compute budget.

It controls at least:

- supported extent;
- contact and release angles;
- curvature distribution;
- geometric resolution;
- the release frame and state that result from those choices.

For a gap of `N` frames and effective air ask `a`, the natural timing target is
approximately:

```text
target grounded frames = N * (1 - a)
```

Distance is not generally `entry speed * grounded frames`. It is the integral
of riding speed until release. Gravity, slope, curvature, friction, collision
response, acceleration toward the next speed target, and early loss of contact
all change it. An analytical distance is therefore a prior whose error must be
measured, not a geometric truth.

## Candidate diversity

The generator should cover uncertainty around a physically meaningful center.
It should not use an arbitrary pixel interval or independent random jitter.
A deterministic panel should include:

- the central predicted solution;
- earlier and later release timing;
- shorter and longer support where both directions are physically useful;
- flatter and more curved shapes;
- coupled variations where length and curvature compensate for one another.

Low-discrepancy coordinates provide repeatable coverage. The range should come
from model residuals, local sensitivity, or an explicit conservative envelope.
Uncertainty should widen coverage when the model is unreliable and narrow it
when prediction is accurate.

## Promising formulations

### 1. Dynamics-aware time normalization

Keep grounded time as the primary quantity, but estimate distance from predicted
average riding speed rather than entry speed alone. The estimate can consume
entry and target speed, heading, slope, gravity, and a bounded acceleration
model. Candidate residuals are expressed in frames before conversion to distance.

This is the smallest principled refinement of the successful time-normalized
prototype.

### 2. Dimensionless shape-time family

Represent candidates in normalized coordinates such as grounded-time fraction,
support-length ratio, entry-to-exit speed ratio, curvature profile, and release
angle residual. Scale that normalized shape into the physical gap.

Successful incumbent arcs can seed normalized basis shapes without preserving
the incumbent algorithm as a special case. This is the preferred long-term
representation if a compact basis covers both ordinary and frontier behavior.

### 3. Local response-model inversion

Simulate a small, well-spaced probe design and fit a per-gap response model:

```text
length, curvature, release pitch
    -> grounded frames, release state, next-contact state
```

Invert the model to propose target-matching candidates, then validate every
proposal with exact physics. Prediction is a proposer, never a judge. This is a
natural extension of the existing aiming architecture.

### 4. Sequential coverage refinement

Use the same continuous generator in two bounded stages. An initial panel covers
the plausible shape-time envelope. Measured outcomes reveal target regions the
panel does not cover, and a few additional candidates refine those regions.

The trigger is measured response coverage, not duration, a named specification,
or an old-versus-new regime switch.

### 5. Boundary-state trajectory construction

Construct a supported trajectory between entry and desired release boundary
states using a compact curve representation, such as two or three curvature
controls. Solve for release time, position, velocity, and heading, then propose
nearby physically meaningful residuals.

This is the broadest redesign and carries the highest implementation and compute
risk. It should follow evidence that smaller formulations cannot represent the
needed response surface.

These are composable layers, not mutually exclusive products. The current best
working hypothesis is a dimensionless shape-time representation, a
dynamics-aware analytical prior, and a bounded local correction when the prior's
measured error warrants it.

## Required diagnostic

Before choosing another production formulation, measure every generated,
admitted, and selected candidate at representative short, ordinary, and long
gaps:

- desired and actual grounded frames;
- entry, mean-riding, and release speed;
- predicted and actual supported distance;
- support length, segment size, and curvature summary;
- release frame, position, velocity, and heading;
- predicted and realized next-contact state;
- candidate objective, pool rank, branch score, and selection;
- survival, landing, and off-beat gate outcome.

A deliberately wide offline panel must then distinguish three failure modes:

1. **Coverage:** no candidate in the proposed family satisfies the boundary.
2. **Centering:** useful candidates exist, but the analytical center or spread
   places too little density near them.
3. **Selection:** useful candidates are present and measured, but the ranker or
   lookahead chooses a worse continuation.

Changing production logic before separating these failures risks tuning the
generator to compensate for a ranking defect or vice versa.

## Acceptance contract

A production candidate must:

- use no specification identity or duration class;
- scale continuously with gap time, speed, air, and other authored axes;
- expose controlled, deterministic diversity around a physical center;
- keep exact simulation as the authority;
- complete the 4s-7s low-air frontier with evidence across seeds and budgets;
- avoid coherent representative, development-music, or legacy-regression loss;
- remain credible on the existing short-gap capability cases;
- justify any added compute with measured activation and yield telemetry.

Headline improvement is necessary but not sufficient while zero-score capability
rows can dominate aggregation. Per-stratum results, validity losses, largest case
losses, prefix stability, and output blast radius are mandatory operator gates.

## Current evidence

- The original normal generator cannot represent the frontier: useful admitted
  supports remain roughly 325 px while the 4s-7s cases demand thousands of
  pixels at their observed speeds.
- Pure time normalization makes the frontier broadly feasible, proving that
  support extent is causal. It also changes nearly every compile and causes
  coherent representative losses, so `entry speed * grounded frames` plus a
  fixed 45% spread is not a sufficient universal model.
- A continuous shape-to-time span retains frontier feasibility but displaces too
  much ordinary shape diversity in a fixed candidate pool.
- An adaptive air-coverage lane preserves most ordinary outputs and improves the
  full-suite profile, but it retains the incumbent generator as the common path.
  It is a useful control and possible component, not evidence that the unified
  representation problem is solved.

The selected development formulation now combines the useful layers without a
duration regime:

1. The mature sampled shape defines a candidate-specific support-time endpoint.
2. The deterministic family center defines whether an extent deficit exists.
   Deficits inside a measured 2x uncertainty band are exactly neutral; authority
   rises smoothly in log space and is full at 5x.
3. Four logarithmic support scales are crossed with the established launch span.
4. If the normal pool still entirely overshoots the next air ask, bounded
   refinement breadth rises from 8 to 32 with the measured deficit.
5. A refinement enters ranking only if its exact release timing improves the
   best normal-pool air error.

The exact neutral endpoint is deliberate numerical correctness. Computing
`exp(log(shapeLength))` at zero pressure introduced ~1e-14 coordinate changes
that redirected deterministic search and caused a 300-point high-air outlier.
Zero pressure and zero blend now return the sampled shape bytes directly.

Fresh six-seed, two-budget family evidence for `extent-and-coverage-gated`:

- headline delta `+16.43`, SE `1.08`, stable at 2/4/6 seed prefixes;
- 44 validity gains and zero losses;
- representative `+0.49`, capability `+107.24`;
- legacy regression and development music exactly neutral;
- 87.1% of paired output tracks hash-identical;
- no negative case in the largest-loss table.

This is development selection evidence, not a promotion verdict. Qualification
was not consulted and a fresh certified confirmation remains required.
