import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "frontier_pickup_progression_shifted",
  "title": "Frontier Pickup Progression, Shifted Thresholds",
  "duration": 60,
  "provenance": {
    "kind": "capability_manual",
    "authoring_brief": "A one-minute threshold score progresses from ordinary pulse through isolated 300ms, 250ms, 200ms, and 180ms pickups, always returning to the main beat. Variant: Nearby but nonuniform 320/270/220/160ms pickup-to-accent boundaries test threshold generalization."
  },
  "primary_family": "rapid_pickup_frontier",
  "diagnostic_tags": [
    "capability",
    "pickup_threshold",
    "progressive"
  ],
  "pulse_regions": [
    {
      "start": 0.6,
      "end": 58.2,
      "pulse_seconds": 0.6,
      "intent": "ordinary grid anchors increasingly short pickups"
    }
  ],
  "phases": [
    {
      "id": "control",
      "start": 0,
      "end": 8.4,
      "intent": "ordinary pulse establishes the control"
    },
    {
      "id": "pickup_300ms",
      "start": 8.4,
      "end": 21,
      "intent": "isolated 300ms anticipations"
    },
    {
      "id": "pickup_250ms",
      "start": 21,
      "end": 33.6,
      "intent": "bounded 250ms anticipations"
    },
    {
      "id": "pickup_200ms",
      "start": 33.6,
      "end": 46.2,
      "intent": "bounded 200ms anticipations"
    },
    {
      "id": "pickup_180ms",
      "start": 46.2,
      "end": 60,
      "intent": "ambitious 180ms boundary and release"
    }
  ],
  "phrases": {
    "control": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 0.6,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 1.2,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 1.8,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 2.4,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 3,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 3.6,
        "role": "accent",
        "impact": 0.72
      }
    ],
    "p300": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.68
      },
      {
        "offset": 0.6,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 1.2,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 1.48,
        "role": "pickup",
        "impact": 0.24
      },
      {
        "offset": 1.8,
        "role": "accent",
        "impact": 0.84
      },
      {
        "offset": 2.4,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 3,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 3.6,
        "role": "reentry",
        "impact": 0.74
      }
    ],
    "p250": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.7
      },
      {
        "offset": 0.6,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 1.2,
        "role": "primary",
        "impact": 0.56
      },
      {
        "offset": 1.53,
        "role": "pickup",
        "impact": 0.22
      },
      {
        "offset": 1.8,
        "role": "accent",
        "impact": 0.87
      },
      {
        "offset": 2.4,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 3,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 3.6,
        "role": "reentry",
        "impact": 0.76
      }
    ],
    "p200": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.72
      },
      {
        "offset": 0.6,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 1.2,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 1.58,
        "role": "pickup",
        "impact": 0.2
      },
      {
        "offset": 1.8,
        "role": "accent",
        "impact": 0.9
      },
      {
        "offset": 2.4,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 3,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 3.6,
        "role": "reentry",
        "impact": 0.78
      }
    ],
    "p180": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.74
      },
      {
        "offset": 0.6,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 1.2,
        "role": "primary",
        "impact": 0.54
      },
      {
        "offset": 1.64,
        "role": "pickup",
        "impact": 0.18
      },
      {
        "offset": 1.8,
        "role": "accent",
        "impact": 0.92
      },
      {
        "offset": 2.4,
        "role": "support",
        "impact": 0.35
      },
      {
        "offset": 3,
        "role": "primary",
        "impact": 0.68
      },
      {
        "offset": 3.6,
        "role": "reentry",
        "impact": 0.8
      }
    ]
  },
  "placements": [
    {
      "at": 0.6,
      "phrase": "control"
    },
    {
      "at": 4.8,
      "phrase": "control"
    },
    {
      "at": 9,
      "phrase": "p300"
    },
    {
      "at": 13.2,
      "phrase": "p300"
    },
    {
      "at": 17.4,
      "phrase": "p300"
    },
    {
      "at": 21.6,
      "phrase": "p250"
    },
    {
      "at": 25.8,
      "phrase": "p250"
    },
    {
      "at": 30,
      "phrase": "p250"
    },
    {
      "at": 34.2,
      "phrase": "p200"
    },
    {
      "at": 38.4,
      "phrase": "p200"
    },
    {
      "at": 42.6,
      "phrase": "p200"
    },
    {
      "at": 46.8,
      "phrase": "p180"
    },
    {
      "at": 51,
      "phrase": "p180"
    },
    {
      "at": 55.2,
      "phrase": "p180"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.34,
        "ease": "smooth",
        "intent": "ordinary control"
      },
      {
        "t": 21,
        "v": 0.26,
        "ease": "smooth",
        "intent": "shorter pickups stay supported"
      },
      {
        "t": 42,
        "v": 0.14,
        "ease": "smooth",
        "intent": "hard boundary minimizes air"
      },
      {
        "t": 60,
        "v": 0.28,
        "intent": "release"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.64,
        "ease": "smooth",
        "intent": "control speed"
      },
      {
        "t": 20,
        "v": 0.74,
        "ease": "smooth",
        "intent": "250ms phase"
      },
      {
        "t": 40,
        "v": 0.84,
        "ease": "smooth",
        "intent": "200ms phase"
      },
      {
        "t": 53,
        "v": 0.91,
        "ease": "easeOut",
        "intent": "180ms phase at high speed"
      },
      {
        "t": 60,
        "v": 0.72,
        "intent": "release"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0
} satisfies BenchmarkScoreDocument;

export const benchmarkCase = defineScoreCase({
  metadata: {
  "cohort": "capability",
  "musicBacked": false,
  "eligibleComponents": [
    "sync",
    "survival",
    "air",
    "speed",
    "impact"
  ],
  "diagnosticComponents": [],
  "id": "frontier_pickup_progression_shifted",
  "title": "Frontier Pickup Progression, Shifted Thresholds",
  "originFamily": "rapid_pickup_frontier",
  "phases": [
    {
      "id": "control",
      "start": 0,
      "end": 8.4,
      "intent": "ordinary pulse establishes the control"
    },
    {
      "id": "pickup_300ms",
      "start": 8.4,
      "end": 21,
      "intent": "isolated 300ms anticipations"
    },
    {
      "id": "pickup_250ms",
      "start": 21,
      "end": 33.6,
      "intent": "bounded 250ms anticipations"
    },
    {
      "id": "pickup_200ms",
      "start": 33.6,
      "end": 46.2,
      "intent": "bounded 200ms anticipations"
    },
    {
      "id": "pickup_180ms",
      "start": 46.2,
      "end": 60,
      "intent": "ambitious 180ms boundary and release"
    }
  ],
  "variant": {
    "parentId": "frontier_pickup_progression",
    "kind": "pickup_thresholds",
    "rationale": "Nearby but nonuniform 320/270/220/160ms pickup-to-accent boundaries test threshold generalization.",
    "parameters": {
      "p300_ms": 320,
      "p250_ms": 270,
      "p200_ms": 220,
      "p180_ms": 160
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
