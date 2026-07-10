import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "regression_transition_mosaic_tempo_fast_5",
  "title": "Regression Transition Mosaic, 5% Faster",
  "duration": 57,
  "provenance": {
    "kind": "legacy_informed_manual",
    "authoring_brief": "A clean long-form rewrite of useful V1 initialization, verse/chorus, rhythm-ladder, and switchback behaviors without importing their timelines, grain, or elevation. Variant: The complete authored program is time-scaled by 0.95 while preserving phrase structure and axis intent."
  },
  "primary_family": "legacy_transition_regression",
  "diagnostic_tags": [
    "regression",
    "cold_start",
    "target_reversal",
    "mixed_cadence"
  ],
  "pulse_regions": [
    {
      "start": 0.76,
      "end": 12.92,
      "pulse_seconds": 0.76,
      "intent": "spacious initialization"
    },
    {
      "start": 12.92,
      "end": 33.44,
      "pulse_seconds": 0.513,
      "intent": "compact middle with cadence reversals"
    },
    {
      "start": 33.44,
      "end": 51.11,
      "pulse_seconds": 0.646,
      "intent": "expanded final section"
    }
  ],
  "phrases": {
    "cold_open": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.42
      },
      {
        "offset": 0.76,
        "role": "support",
        "impact": 0.24
      },
      {
        "offset": 1.52,
        "role": "primary",
        "impact": 0.52
      },
      {
        "offset": 2.28,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 3.04,
        "role": "accent",
        "impact": 0.7
      },
      {
        "offset": 3.8,
        "role": "reentry",
        "impact": 0.62
      }
    ],
    "ladder": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 0.513,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 0.855,
        "role": "pickup",
        "impact": 0.22
      },
      {
        "offset": 1.368,
        "role": "accent",
        "impact": 0.82
      },
      {
        "offset": 2.014,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 2.527,
        "role": "primary",
        "impact": 0.57
      },
      {
        "offset": 3.04,
        "role": "reentry",
        "impact": 0.73
      }
    ],
    "switchback": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.86
      },
      {
        "offset": 0.342,
        "role": "pickup",
        "impact": 0.25
      },
      {
        "offset": 0.912,
        "role": "primary",
        "impact": 0.61
      },
      {
        "offset": 1.909,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 2.242,
        "role": "fill",
        "impact": 0.46
      },
      {
        "offset": 2.812,
        "role": "reentry",
        "impact": 0.78
      }
    ],
    "expanded": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.6
      },
      {
        "offset": 0.646,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 1.292,
        "role": "accent",
        "impact": 0.76
      },
      {
        "offset": 1.938,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 2.584,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 3.876,
        "role": "breath_exit",
        "impact": 0.84
      },
      {
        "offset": 4.522,
        "role": "reentry",
        "impact": 0.7
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.52
      },
      {
        "offset": 0.646,
        "role": "support",
        "impact": 0.26
      },
      {
        "offset": 1.292,
        "role": "tail",
        "impact": 0.32
      },
      {
        "offset": 2.584,
        "role": "tail",
        "impact": 0.2
      },
      {
        "offset": 4.522,
        "role": "tail",
        "impact": 0.11
      }
    ]
  },
  "placements": [
    {
      "at": 0.76,
      "phrase": "cold_open"
    },
    {
      "at": 5.32,
      "phrase": "cold_open"
    },
    {
      "at": 9.88,
      "phrase": "ladder"
    },
    {
      "at": 13.262,
      "phrase": "ladder"
    },
    {
      "at": 16.644,
      "phrase": "switchback"
    },
    {
      "at": 19.798,
      "phrase": "ladder"
    },
    {
      "at": 23.18,
      "phrase": "switchback"
    },
    {
      "at": 26.334,
      "phrase": "ladder"
    },
    {
      "at": 29.716,
      "phrase": "switchback"
    },
    {
      "at": 32.87,
      "phrase": "expanded"
    },
    {
      "at": 37.715,
      "phrase": "expanded"
    },
    {
      "at": 42.56,
      "phrase": "expanded"
    },
    {
      "at": 47.405,
      "phrase": "expanded"
    },
    {
      "at": 52.25,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.3,
        "ease": "smooth",
        "intent": "cold supported initialization"
      },
      {
        "t": 13.3,
        "v": 0.64,
        "ease": "smooth",
        "intent": "first section opens"
      },
      {
        "t": 21.85,
        "v": 0.38,
        "ease": "smooth",
        "intent": "switchback reverses air"
      },
      {
        "t": 33.25,
        "v": 0.72,
        "ease": "smooth",
        "intent": "expanded final section"
      },
      {
        "t": 44.65,
        "v": 0.46,
        "ease": "easeOut",
        "intent": "late reversal"
      },
      {
        "t": 57,
        "v": 0.58,
        "intent": "tail"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.34,
        "ease": "smooth",
        "intent": "cold start"
      },
      {
        "t": 11.4,
        "v": 0.76,
        "ease": "smooth",
        "intent": "initial acceleration"
      },
      {
        "t": 20.9,
        "v": 0.48,
        "ease": "smooth",
        "intent": "opposes air reversal"
      },
      {
        "t": 32.3,
        "v": 0.86,
        "ease": "smooth",
        "intent": "compact drive"
      },
      {
        "t": 43.7,
        "v": 0.56,
        "ease": "smooth",
        "intent": "expanded relaxation"
      },
      {
        "t": 57,
        "v": 0.72,
        "intent": "final carry"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "cold_initialization",
      "start": 0,
      "end": 12.92,
      "intent": "cold initialization"
    },
    {
      "id": "compact_ladder",
      "start": 12.92,
      "end": 23.18,
      "intent": "compact ladder"
    },
    {
      "id": "switchback_drive",
      "start": 23.18,
      "end": 33.44,
      "intent": "switchback drive"
    },
    {
      "id": "expanded_section",
      "start": 33.44,
      "end": 47.405,
      "intent": "expanded section"
    },
    {
      "id": "tail",
      "start": 47.405,
      "end": 57,
      "intent": "tail"
    }
  ]
} satisfies BenchmarkScoreDocument;

export const benchmarkCase = defineScoreCase({
  metadata: {
  "cohort": "regression",
  "musicBacked": false,
  "eligibleComponents": [
    "sync",
    "survival",
    "air",
    "speed",
    "impact"
  ],
  "diagnosticComponents": [],
  "id": "regression_transition_mosaic_tempo_fast_5",
  "title": "Regression Transition Mosaic, 5% Faster",
  "originFamily": "legacy_transition_regression",
  "phases": [
    {
      "id": "cold_initialization",
      "start": 0,
      "end": 12.92,
      "intent": "cold initialization"
    },
    {
      "id": "compact_ladder",
      "start": 12.92,
      "end": 23.18,
      "intent": "compact ladder"
    },
    {
      "id": "switchback_drive",
      "start": 23.18,
      "end": 33.44,
      "intent": "switchback drive"
    },
    {
      "id": "expanded_section",
      "start": 33.44,
      "end": 47.405,
      "intent": "expanded section"
    },
    {
      "id": "tail",
      "start": 47.405,
      "end": 57,
      "intent": "tail"
    }
  ],
  "variant": {
    "parentId": "regression_transition_mosaic",
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
