import { defineScoreCase } from "../../case.ts";
import type { BenchmarkScoreDocument } from "../../../../../scripts/v0/benchmark_v2/score_model.ts";

export const scoreDocument = {
  "schema": "line.benchmark-v2.score.v1",
  "id": "regression_amplitude_mosaic_contrast_10",
  "title": "Regression Amplitude Mosaic, Stronger Contrast",
  "duration": 60,
  "provenance": {
    "kind": "legacy_informed_manual",
    "authoring_brief": "A long-form rewrite of useful V1 big-air, soar/settle, canyon-step, and dense combined-axis donors with elevation deliberately absent. Variant: amplitude contrast is scaled by 1.1 around the midpoint; timing remains fixed."
  },
  "primary_family": "legacy_amplitude_regression",
  "diagnostic_tags": [
    "regression",
    "amplitude",
    "cadence_change",
    "dense_to_spacious"
  ],
  "pulse_regions": [
    {
      "start": 0.65,
      "end": 19.5,
      "pulse_seconds": 0.65,
      "intent": "ordinary amplitude ramp"
    },
    {
      "start": 19.5,
      "end": 38.7,
      "pulse_seconds": 0.48,
      "intent": "dense middle settle"
    },
    {
      "start": 38.7,
      "end": 54.3,
      "pulse_seconds": 0.78,
      "intent": "spacious final canyon"
    }
  ],
  "phrases": {
    "ramp": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.58
      },
      {
        "offset": 0.65,
        "role": "support",
        "impact": 0.28
      },
      {
        "offset": 1.3,
        "role": "accent",
        "impact": 0.74
      },
      {
        "offset": 1.95,
        "role": "support",
        "impact": 0.31
      },
      {
        "offset": 2.6,
        "role": "primary",
        "impact": 0.55
      },
      {
        "offset": 3.25,
        "role": "support",
        "impact": 0.26
      },
      {
        "offset": 3.9,
        "role": "breath_exit",
        "impact": 0.82
      }
    ],
    "dense": [
      {
        "offset": 0,
        "role": "reentry",
        "impact": 0.8
      },
      {
        "offset": 0.48,
        "role": "support",
        "impact": 0.3
      },
      {
        "offset": 0.96,
        "role": "primary",
        "impact": 0.6
      },
      {
        "offset": 1.44,
        "role": "support",
        "impact": 0.27
      },
      {
        "offset": 1.92,
        "role": "accent",
        "impact": 0.86
      },
      {
        "offset": 2.4,
        "role": "support",
        "impact": 0.33
      },
      {
        "offset": 2.88,
        "role": "primary",
        "impact": 0.57
      },
      {
        "offset": 3.36,
        "role": "support",
        "impact": 0.29
      }
    ],
    "canyon": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.62
      },
      {
        "offset": 0.78,
        "role": "support",
        "impact": 0.29
      },
      {
        "offset": 1.56,
        "role": "accent",
        "impact": 0.8
      },
      {
        "offset": 2.34,
        "role": "support",
        "impact": 0.32
      },
      {
        "offset": 3.9,
        "role": "breath_exit",
        "impact": 0.9
      },
      {
        "offset": 4.68,
        "role": "reentry",
        "impact": 0.74
      }
    ],
    "tail": [
      {
        "offset": 0,
        "role": "primary",
        "impact": 0.54
      },
      {
        "offset": 0.78,
        "role": "support",
        "impact": 0.26
      },
      {
        "offset": 1.56,
        "role": "tail",
        "impact": 0.34
      },
      {
        "offset": 3.12,
        "role": "tail",
        "impact": 0.2
      },
      {
        "offset": 4.68,
        "role": "tail",
        "impact": 0.11
      }
    ]
  },
  "placements": [
    {
      "at": 0.65,
      "phrase": "ramp"
    },
    {
      "at": 5.2,
      "phrase": "ramp"
    },
    {
      "at": 9.75,
      "phrase": "ramp"
    },
    {
      "at": 14.3,
      "phrase": "ramp"
    },
    {
      "at": 18.85,
      "phrase": "dense"
    },
    {
      "at": 22.69,
      "phrase": "dense"
    },
    {
      "at": 26.53,
      "phrase": "dense"
    },
    {
      "at": 30.37,
      "phrase": "dense"
    },
    {
      "at": 34.21,
      "phrase": "dense"
    },
    {
      "at": 38.05,
      "phrase": "canyon"
    },
    {
      "at": 43.25,
      "phrase": "canyon"
    },
    {
      "at": 48.45,
      "phrase": "canyon"
    },
    {
      "at": 53.65,
      "phrase": "tail"
    }
  ],
  "axes": {
    "air": [
      {
        "t": 0,
        "v": 0.42,
        "ease": "smooth",
        "intent": "ordinary opening"
      },
      {
        "t": 16,
        "v": 0.74,
        "ease": "smooth",
        "intent": "ramp reaches broad air"
      },
      {
        "t": 28,
        "v": 0.36,
        "ease": "smooth",
        "intent": "dense middle settles"
      },
      {
        "t": 43,
        "v": 0.68,
        "ease": "easeOut",
        "intent": "spacious canyon opens"
      },
      {
        "t": 60,
        "v": 0.5,
        "intent": "tail"
      }
    ],
    "speed": [
      {
        "t": 0,
        "v": 0.5,
        "ease": "smooth",
        "intent": "opening"
      },
      {
        "t": 18,
        "v": 0.76,
        "ease": "smooth",
        "intent": "ramp accelerates"
      },
      {
        "t": 31,
        "v": 0.88,
        "ease": "smooth",
        "intent": "dense middle is fastest"
      },
      {
        "t": 43,
        "v": 0.58,
        "ease": "smooth",
        "intent": "canyon relaxes"
      },
      {
        "t": 60,
        "v": 0.66,
        "intent": "tail carries"
      }
    ],
    "amplitude": [
      {
        "t": 0,
        "v": 0.082,
        "ease": "smooth",
        "intent": "flat opening"
      },
      {
        "t": 9,
        "v": 0.478,
        "ease": "smooth",
        "intent": "ramp begins"
      },
      {
        "t": 17,
        "v": 0.94,
        "ease": "easeOut",
        "intent": "big-air crest"
      },
      {
        "t": 23,
        "v": 0.148,
        "ease": "smooth",
        "intent": "dense settle"
      },
      {
        "t": 33,
        "v": 0.038,
        "ease": "smooth",
        "intent": "minimum dense amplitude"
      },
      {
        "t": 41.95,
        "v": 0.896,
        "ease": "smooth",
        "intent": "first canyon arc"
      },
      {
        "t": 46.37,
        "v": 0.214,
        "ease": "smooth",
        "intent": "canyon floor"
      },
      {
        "t": 52.35,
        "v": 0.984,
        "ease": "easeOut",
        "intent": "final canyon crest"
      },
      {
        "t": 60,
        "v": 0.324,
        "intent": "tail settles"
      }
    ]
  },
  "preroll": 5,
  "jitter": 0,
  "phases": [
    {
      "id": "amplitude_ramp",
      "start": 0,
      "end": 19.5,
      "intent": "amplitude ramp"
    },
    {
      "id": "dense_settle",
      "start": 19.5,
      "end": 38.7,
      "intent": "dense settle"
    },
    {
      "id": "spacious_canyon",
      "start": 38.7,
      "end": 53.65,
      "intent": "spacious canyon"
    },
    {
      "id": "tail",
      "start": 53.65,
      "end": 60,
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
    "amplitude",
    "impact"
  ],
  "diagnosticComponents": [],
  "id": "regression_amplitude_mosaic_contrast_10",
  "title": "Regression Amplitude Mosaic, Stronger Contrast",
  "originFamily": "legacy_amplitude_regression",
  "phases": [
    {
      "id": "amplitude_ramp",
      "start": 0,
      "end": 19.5,
      "intent": "amplitude ramp"
    },
    {
      "id": "dense_settle",
      "start": 19.5,
      "end": 38.7,
      "intent": "dense settle"
    },
    {
      "id": "spacious_canyon",
      "start": 38.7,
      "end": 53.65,
      "intent": "spacious canyon"
    },
    {
      "id": "tail",
      "start": 53.65,
      "end": 60,
      "intent": "tail"
    }
  ],
  "variant": {
    "parentId": "regression_amplitude_mosaic",
    "kind": "axis_contrast",
    "rationale": "amplitude contrast is scaled by 1.1 around the midpoint; timing remains fixed.",
    "parameters": {
      "axis": "amplitude",
      "contrast": 1.1
    }
  }
},
  document: scoreDocument,
});

export default benchmarkCase.spec;
