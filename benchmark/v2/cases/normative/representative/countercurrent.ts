import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "countercurrent",
  "title": "Countercurrent",
  "duration": 55,
  "provenance": {
    "kind": "reference_informed_manual",
    "authoring_brief": "Quiet uneven support gives way to a recurring pulse whose omissions redirect the phrase rather than copy a reference arrangement."
  },
  "primary_family": "regular_exceptions",
  "diagnostic_tags": [
    "support_intro",
    "omission",
    "impact_phrasing"
  ],
  "pulse_regions": [
    {
      "start": 0,
      "end": 8.38,
      "pulse_seconds": 0.62,
      "intent": "loose support around an implied pulse"
    },
    {
      "start": 8.38,
      "end": 47.44,
      "pulse_seconds": 0.62,
      "intent": "stable pulse repeatedly redirected by omissions"
    }
  ],
  "phrases": {
    "quiet_support": [
      {
        "offset": 0.48,
        "role": "support",
        "impact": 0.08
      },
      {
        "offset": 1.09,
        "role": "support",
        "impact": 0.12
      },
      {
        "offset": 1.73,
        "role": "support",
        "impact": 0.2
      },
      {
        "offset": 2.38,
        "role": "primary",
        "impact": 0.31
      },
      {
        "offset": 3.31,
        "role": "support",
        "impact": 0.14
      },
      {
        "offset": 4,
        "role": "accent",
        "impact": 0.46
      },
      {
        "offset": 4.65,
        "role": "support",
        "impact": 0.22
      },
      {
        "offset": 5.27,
        "role": "primary",
        "impact": 0.36
      },
      {
        "offset": 6.52,
        "role": "support",
        "impact": 0.18
      },
      {
        "offset": 7.14,
        "role": "reentry",
        "impact": 0.76
      }
    ],
    "pulse_a": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.78
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.39
      },
      {
        "offset": 1.24,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 1.86,
        "role": "accent",
        "impact": 0.71
      },
      {
        "offset": 2.48,
        "role": "support",
        "impact": 0.43
      },
      {
        "offset": 3.1,
        "role": "primary",
        "impact": 0.6
      },
      {
        "offset": 3.72,
        "role": "support",
        "impact": 0.35
      }
    ],
    "open_turn": [
      {
        "offset": 0,
        "role": "accent",
        "impact": 0.82
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.4
      },
      {
        "offset": 1.24,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 2.48,
        "role": "breath_exit",
        "impact": 0.9
      },
      {
        "offset": 3.1,
        "role": "support",
        "impact": 0.44
      },
      {
        "offset": 3.72,
        "role": "reentry",
        "impact": 0.72
      }
    ],
    "pulse_b": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.68
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.47
      },
      {
        "offset": 1.24,
        "role": "accent",
        "impact": 0.86
      },
      {
        "offset": 1.86,
        "role": "support",
        "impact": 0.42
      },
      {
        "offset": 2.48,
        "role": "primary",
        "impact": 0.64
      },
      {
        "offset": 3.1,
        "role": "support",
        "impact": 0.37
      },
      {
        "offset": 3.72,
        "role": "accent",
        "impact": 0.74
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.61
      },
      {
        "offset": 0.62,
        "role": "support",
        "impact": 0.34
      },
      {
        "offset": 1.24,
        "role": "tail",
        "impact": 0.29
      },
      {
        "offset": 2.48,
        "role": "tail",
        "impact": 0.22
      },
      {
        "offset": 3.72,
        "role": "tail",
        "impact": 0.17
      },
      {
        "offset": 5,
        "role": "tail",
        "impact": 0.12
      },
      {
        "offset": 6.4,
        "role": "tail",
        "impact": 0.08
      }
    ]
  },
  "placements": [
    {
      "at": 0,
      "phrase": "quiet_support"
    },
    {
      "at": 8.38,
      "phrase": "pulse_a"
    },
    {
      "at": 12.72,
      "phrase": "pulse_a"
    },
    {
      "at": 17.06,
      "phrase": "pulse_a"
    },
    {
      "at": 21.4,
      "phrase": "open_turn"
    },
    {
      "at": 25.74,
      "phrase": "pulse_b"
    },
    {
      "at": 30.08,
      "phrase": "pulse_b"
    },
    {
      "at": 34.42,
      "phrase": "pulse_b"
    },
    {
      "at": 38.76,
      "phrase": "pulse_b"
    },
    {
      "at": 43.1,
      "phrase": "pulse_b"
    },
    {
      "at": 47.44,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.38,
        "ease": "smooth",
        "intent": "quiet support stays close"
      },
      {
        "t": 8.38,
        "v": 0.54,
        "ease": "smooth",
        "intent": "pulse opens the ride"
      },
      {
        "t": 21.4,
        "v": 0.66,
        "ease": "easeOut",
        "intent": "omission gets visible space"
      },
      {
        "t": 30,
        "v": 0.58,
        "ease": "smooth",
        "intent": "return stays controlled"
      },
      {
        "t": 44,
        "v": 0.7,
        "ease": "smooth",
        "intent": "last body breathes"
      },
      {
        "t": 55,
        "v": 0.48,
        "intent": "tail settles"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.32,
        "ease": "smooth",
        "intent": "restrained support"
      },
      {
        "t": 8.38,
        "v": 0.58,
        "ease": "smooth",
        "intent": "pulse arrival"
      },
      {
        "t": 18,
        "v": 0.76,
        "ease": "smooth",
        "intent": "first body"
      },
      {
        "t": 24,
        "v": 0.64,
        "ease": "smooth",
        "intent": "turn releases pressure"
      },
      {
        "t": 40,
        "v": 0.84,
        "ease": "easeOut",
        "intent": "second body"
      },
      {
        "t": 55,
        "v": 0.5,
        "intent": "tail"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "quiet_support",
      "start": 0,
      "end": 8.38,
      "intent": "quiet support"
    },
    {
      "id": "first_pulse_body",
      "start": 8.38,
      "end": 21.4,
      "intent": "first pulse body"
    },
    {
      "id": "open_turn",
      "start": 21.4,
      "end": 25.74,
      "intent": "open turn"
    },
    {
      "id": "second_pulse_body",
      "start": 25.74,
      "end": 47.44,
      "intent": "second pulse body"
    },
    {
      "id": "tail",
      "start": 47.44,
      "end": 55,
      "intent": "tail"
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
