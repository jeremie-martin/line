import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "river_reentry",
  "title": "River Reentry",
  "duration": 58,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Long locally regular ride with independent fills, omissions, and two energetic returns."
  },
  "primary_family": "regular_exceptions",
  "diagnostic_tags": [
    "reentry",
    "bounded_fill",
    "long_form"
  ],
  "pulse_regions": [
    {
      "start": 0,
      "end": 24.24,
      "pulse_seconds": 0.57,
      "intent": "arrival settles into an even current"
    },
    {
      "start": 24.24,
      "end": 28.47,
      "pulse_seconds": 0.57,
      "intent": "short displaced fill"
    },
    {
      "start": 28.47,
      "end": 46.71,
      "pulse_seconds": 0.57,
      "intent": "stronger return of the current"
    }
  ],
  "phrases": {
    "arrival": [
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.12
      },
      {
        "offset": 1.23,
        "role": "support",
        "impact": 0.18
      },
      {
        "offset": 1.86,
        "role": "primary",
        "impact": 0.34
      },
      {
        "offset": 2.54,
        "role": "support",
        "impact": 0.22
      },
      {
        "offset": 3.08,
        "role": "accent",
        "impact": 0.58
      },
      {
        "offset": 3.72,
        "role": "primary",
        "impact": 0.42
      },
      {
        "offset": 4.31,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 4.86,
        "role": "reentry",
        "impact": 0.82
      }
    ],
    "current_a": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.72
      },
      {
        "offset": 0.57,
        "role": "support",
        "impact": 0.42
      },
      {
        "offset": 1.14,
        "role": "primary",
        "impact": 0.56
      },
      {
        "offset": 1.71,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 2.28,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 2.85,
        "role": "support",
        "impact": 0.46
      },
      {
        "offset": 3.42,
        "role": "primary",
        "impact": 0.61
      },
      {
        "offset": 3.99,
        "role": "support",
        "impact": 0.4
      }
    ],
    "displaced_fill": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.86
      },
      {
        "offset": 0.34,
        "role": "pickup",
        "impact": 0.36
      },
      {
        "offset": 0.81,
        "role": "fill",
        "impact": 0.52
      },
      {
        "offset": 1.38,
        "role": "primary",
        "impact": 0.69
      },
      {
        "offset": 1.95,
        "role": "support",
        "impact": 0.44
      },
      {
        "offset": 2.52,
        "role": "accent",
        "impact": 0.74
      },
      {
        "offset": 3.09,
        "role": "support",
        "impact": 0.39
      },
      {
        "offset": 3.66,
        "role": "breath_exit",
        "impact": 0.94
      }
    ],
    "current_b": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.96
      },
      {
        "offset": 0.57,
        "role": "support",
        "impact": 0.48
      },
      {
        "offset": 1.14,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 1.71,
        "role": "support",
        "impact": 0.43
      },
      {
        "offset": 2.28,
        "role": "accent",
        "impact": 0.84
      },
      {
        "offset": 2.85,
        "role": "support",
        "impact": 0.51
      },
      {
        "offset": 3.42,
        "role": "primary",
        "impact": 0.7
      },
      {
        "offset": 3.99,
        "role": "support",
        "impact": 0.45
      }
    ],
    "release": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.68
      },
      {
        "offset": 0.57,
        "role": "support",
        "impact": 0.36
      },
      {
        "offset": 1.14,
        "role": "primary",
        "impact": 0.52
      },
      {
        "offset": 2.28,
        "role": "tail",
        "impact": 0.31
      },
      {
        "offset": 2.85,
        "role": "tail",
        "impact": 0.24
      },
      {
        "offset": 4,
        "role": "tail",
        "impact": 0.2
      },
      {
        "offset": 5.4,
        "role": "tail",
        "impact": 0.14
      },
      {
        "offset": 7,
        "role": "tail",
        "impact": 0.1
      }
    ]
  },
  "placements": [
    {
      "at": 0,
      "phrase": "arrival"
    },
    {
      "at": 6,
      "phrase": "current_a"
    },
    {
      "at": 10.56,
      "phrase": "current_a"
    },
    {
      "at": 15.12,
      "phrase": "current_a"
    },
    {
      "at": 19.68,
      "phrase": "current_a"
    },
    {
      "at": 24.24,
      "phrase": "displaced_fill"
    },
    {
      "at": 28.47,
      "phrase": "current_b"
    },
    {
      "at": 33.03,
      "phrase": "current_b"
    },
    {
      "at": 37.59,
      "phrase": "current_b"
    },
    {
      "at": 42.15,
      "phrase": "current_b"
    },
    {
      "at": 46.71,
      "phrase": "release"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.46,
        "ease": "smooth",
        "intent": "supported arrival"
      },
      {
        "t": 12,
        "v": 0.6,
        "ease": "smooth",
        "intent": "current begins to open"
      },
      {
        "t": 24.24,
        "v": 0.52,
        "ease": "smooth",
        "intent": "fill remains controlled"
      },
      {
        "t": 35,
        "v": 0.68,
        "ease": "smooth",
        "intent": "second body has more air"
      },
      {
        "t": 48,
        "v": 0.58,
        "ease": "smooth",
        "intent": "release settles"
      },
      {
        "t": 58,
        "v": 0.42,
        "intent": "supported ending"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.38,
        "ease": "smooth",
        "intent": "measured entry"
      },
      {
        "t": 6,
        "v": 0.62,
        "ease": "smooth",
        "intent": "first current"
      },
      {
        "t": 22,
        "v": 0.78,
        "ease": "easeOut",
        "intent": "body crest"
      },
      {
        "t": 28.47,
        "v": 0.72,
        "ease": "smooth",
        "intent": "reentry reset"
      },
      {
        "t": 42,
        "v": 0.86,
        "ease": "smooth",
        "intent": "strong final body"
      },
      {
        "t": 58,
        "v": 0.54,
        "intent": "release"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "arrival",
      "start": 0,
      "end": 6,
      "intent": "arrival"
    },
    {
      "id": "first_current",
      "start": 6,
      "end": 24.24,
      "intent": "first current"
    },
    {
      "id": "displaced_fill",
      "start": 24.24,
      "end": 28.47,
      "intent": "displaced fill"
    },
    {
      "id": "second_current",
      "start": 28.47,
      "end": 46.71,
      "intent": "second current"
    },
    {
      "id": "release",
      "start": 46.71,
      "end": 58,
      "intent": "release"
    }
  ]
} as const satisfies BenchmarkScoreDocument;

export const benchmarkCase = defineScoreCase({
  metadata: {
  "cohort": "representative",
  "musicBacked": false,
  "eligibleComponents": [
    "sync",
    "survival",
    "air",
    "speed",
    "impact"
  ],
  "diagnosticComponents": []
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
