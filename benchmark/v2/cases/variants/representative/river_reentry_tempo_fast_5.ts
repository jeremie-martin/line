import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "river_reentry_tempo_fast_5",
  "title": "River Reentry, 5% Faster",
  "duration": 55.1,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Long locally regular ride with independent fills, omissions, and two energetic returns. Variant: The complete authored program is time-scaled by 0.95 while preserving phrase structure and axis intent."
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
      "end": 23.028,
      "pulse_seconds": 0.541,
      "intent": "arrival settles into an even current"
    },
    {
      "start": 23.028,
      "end": 27.046,
      "pulse_seconds": 0.541,
      "intent": "short displaced fill"
    },
    {
      "start": 27.046,
      "end": 44.374,
      "pulse_seconds": 0.541,
      "intent": "stronger return of the current"
    }
  ],
  "phrases": {
    "arrival": [
      {
        "offset": 0.589,
        "role": "support",
        "impact": 0.12
      },
      {
        "offset": 1.168,
        "role": "support",
        "impact": 0.18
      },
      {
        "offset": 1.767,
        "role": "primary",
        "impact": 0.34
      },
      {
        "offset": 2.413,
        "role": "support",
        "impact": 0.22
      },
      {
        "offset": 2.926,
        "role": "accent",
        "impact": 0.58
      },
      {
        "offset": 3.534,
        "role": "primary",
        "impact": 0.42
      },
      {
        "offset": 4.094,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 4.617,
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
        "offset": 0.541,
        "role": "support",
        "impact": 0.42
      },
      {
        "offset": 1.083,
        "role": "primary",
        "impact": 0.56
      },
      {
        "offset": 1.624,
        "role": "support",
        "impact": 0.38
      },
      {
        "offset": 2.166,
        "role": "accent",
        "impact": 0.78
      },
      {
        "offset": 2.708,
        "role": "support",
        "impact": 0.46
      },
      {
        "offset": 3.249,
        "role": "primary",
        "impact": 0.61
      },
      {
        "offset": 3.791,
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
        "offset": 0.323,
        "role": "pickup",
        "impact": 0.36
      },
      {
        "offset": 0.769,
        "role": "fill",
        "impact": 0.52
      },
      {
        "offset": 1.311,
        "role": "primary",
        "impact": 0.69
      },
      {
        "offset": 1.852,
        "role": "support",
        "impact": 0.44
      },
      {
        "offset": 2.394,
        "role": "accent",
        "impact": 0.74
      },
      {
        "offset": 2.935,
        "role": "support",
        "impact": 0.39
      },
      {
        "offset": 3.477,
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
        "offset": 0.541,
        "role": "support",
        "impact": 0.48
      },
      {
        "offset": 1.083,
        "role": "primary",
        "impact": 0.66
      },
      {
        "offset": 1.624,
        "role": "support",
        "impact": 0.43
      },
      {
        "offset": 2.166,
        "role": "accent",
        "impact": 0.84
      },
      {
        "offset": 2.708,
        "role": "support",
        "impact": 0.51
      },
      {
        "offset": 3.249,
        "role": "primary",
        "impact": 0.7
      },
      {
        "offset": 3.791,
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
        "offset": 0.541,
        "role": "support",
        "impact": 0.36
      },
      {
        "offset": 1.083,
        "role": "primary",
        "impact": 0.52
      },
      {
        "offset": 2.166,
        "role": "tail",
        "impact": 0.31
      },
      {
        "offset": 2.708,
        "role": "tail",
        "impact": 0.24
      },
      {
        "offset": 3.8,
        "role": "tail",
        "impact": 0.2
      },
      {
        "offset": 5.13,
        "role": "tail",
        "impact": 0.14
      },
      {
        "offset": 6.65,
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
      "at": 5.7,
      "phrase": "current_a"
    },
    {
      "at": 10.032,
      "phrase": "current_a"
    },
    {
      "at": 14.364,
      "phrase": "current_a"
    },
    {
      "at": 18.696,
      "phrase": "current_a"
    },
    {
      "at": 23.028,
      "phrase": "displaced_fill"
    },
    {
      "at": 27.046,
      "phrase": "current_b"
    },
    {
      "at": 31.378,
      "phrase": "current_b"
    },
    {
      "at": 35.711,
      "phrase": "current_b"
    },
    {
      "at": 40.042,
      "phrase": "current_b"
    },
    {
      "at": 44.374,
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
        "t": 11.4,
        "v": 0.6,
        "ease": "smooth",
        "intent": "current begins to open"
      },
      {
        "t": 23.028,
        "v": 0.52,
        "ease": "smooth",
        "intent": "fill remains controlled"
      },
      {
        "t": 33.25,
        "v": 0.68,
        "ease": "smooth",
        "intent": "second body has more air"
      },
      {
        "t": 45.6,
        "v": 0.58,
        "ease": "smooth",
        "intent": "release settles"
      },
      {
        "t": 55.1,
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
        "t": 5.7,
        "v": 0.62,
        "ease": "smooth",
        "intent": "first current"
      },
      {
        "t": 20.9,
        "v": 0.78,
        "ease": "easeOut",
        "intent": "body crest"
      },
      {
        "t": 27.046,
        "v": 0.72,
        "ease": "smooth",
        "intent": "reentry reset"
      },
      {
        "t": 39.9,
        "v": 0.86,
        "ease": "smooth",
        "intent": "strong final body"
      },
      {
        "t": 55.1,
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
      "end": 5.7,
      "intent": "arrival"
    },
    {
      "id": "first_current",
      "start": 5.7,
      "end": 23.028,
      "intent": "first current"
    },
    {
      "id": "displaced_fill",
      "start": 23.028,
      "end": 27.046,
      "intent": "displaced fill"
    },
    {
      "id": "second_current",
      "start": 27.046,
      "end": 44.374,
      "intent": "second current"
    },
    {
      "id": "release",
      "start": 44.374,
      "end": 55.1,
      "intent": "release"
    }
  ]
} satisfies BenchmarkScoreDocument;

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
  "diagnosticComponents": [],
  "id": "river_reentry_tempo_fast_5",
  "title": "River Reentry, 5% Faster",
  "originFamily": "regular_exceptions",
  "phases": [
    {
      "id": "arrival",
      "start": 0,
      "end": 5.7,
      "intent": "arrival"
    },
    {
      "id": "first_current",
      "start": 5.7,
      "end": 23.028,
      "intent": "first current"
    },
    {
      "id": "displaced_fill",
      "start": 23.028,
      "end": 27.046,
      "intent": "displaced fill"
    },
    {
      "id": "second_current",
      "start": 27.046,
      "end": 44.374,
      "intent": "second current"
    },
    {
      "id": "release",
      "start": 44.374,
      "end": 55.1,
      "intent": "release"
    }
  ],
  "variant": {
    "parentId": "river_reentry",
    "kind": "global_tempo",
    "rationale": "The complete authored program is time-scaled by 0.95 while preserving phrase structure and axis intent.",
    "parameters": {
      "time_scale": 0.95
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
